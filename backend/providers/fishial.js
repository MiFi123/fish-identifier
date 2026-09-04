const crypto = require("crypto");
const { ProviderConfigurationError, ProviderRequestError } = require("../errors");

const TOKEN_TTL_MS = 9 * 60 * 1000;

function getSafeText(responseBody) {
  if (responseBody && typeof responseBody.message === "string") return responseBody.message;
  return "";
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeCandidates(recognitionResponse) {
  const firstFish = Array.isArray(recognitionResponse.objects)
    ? recognitionResponse.objects[0]
    : null;
  const species = Array.isArray(firstFish?.species) ? firstFish.species : [];
  const definitions = recognitionResponse.definitions && typeof recognitionResponse.definitions === "object"
    ? recognitionResponse.definitions
    : {};

  return species.map((candidate) => {
    const definition = definitions[candidate.id] || {};
    return {
      commonName: typeof definition.commonName === "string" ? definition.commonName : null,
      scientificName: typeof definition.scientificName === "string" ? definition.scientificName : null,
      confidence: Number.isFinite(candidate.certainty) ? candidate.certainty : null,
    };
  });
}

function createFishialProvider({ clientId, clientSecret, baseUrl, fetchImplementation = fetch }) {
  let tokenCache = null;

  async function getAccessToken() {
    if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;

    let response;
    try {
      response = await fetchImplementation(`${baseUrl}/v2/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new ProviderRequestError(undefined, { cause: error });
    }

    const body = await parseResponse(response);
    if (!response.ok || !body?.access_token) {
      throw new ProviderRequestError("Die Anmeldung bei der KI-Analyse ist fehlgeschlagen.");
    }

    tokenCache = { value: body.access_token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return tokenCache.value;
  }

  return {
    name: "fishial",
    async analyzeImage({ buffer, mimeType }) {
      if (!clientId || !clientSecret) throw new ProviderConfigurationError();

      const accessToken = await getAccessToken();
      let response;
      try {
        response = await fetchImplementation(`${baseUrl}/v2/recognize`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": mimeType,
            "Fishial-Image-SHA-512": crypto.createHash("sha512").update(buffer).digest("hex"),
          },
          body: buffer,
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error) {
        throw new ProviderRequestError(undefined, { cause: error });
      }

      const body = await parseResponse(response);
      if (!response.ok || body?.ok !== true) {
        const providerMessage = getSafeText(body);
        throw new ProviderRequestError(
          providerMessage ? "Die KI konnte dieses Bild nicht verarbeiten." : undefined,
        );
      }

      const fishDetected = Array.isArray(body.objects) && body.objects.length > 0;
      return {
        fishDetected,
        detectedFishCount: fishDetected ? body.objects.length : 0,
        candidates: normalizeCandidates(body),
      };
    },
  };
}

module.exports = { createFishialProvider };
