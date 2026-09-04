class GeminiSecondOpinionError extends Error {
  constructor(category, { status = null, retryAfterMs = null, cause } = {}) {
    super(category, { cause });
    this.name = "GeminiSecondOpinionError";
    this.category = category;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    fishDetected: { type: "BOOLEAN" },
    commonName: { type: "STRING" },
    scientificName: { type: "STRING" },
    confidence: { type: "NUMBER" },
    uncertain: { type: "BOOLEAN" },
    reasoningSummary: { type: "STRING" },
  },
  required: ["fishDetected", "commonName", "scientificName", "confidence", "uncertain", "reasoningSummary"],
};

const GEMINI_REQUEST_TIMEOUT_MS = 20_000;

function buildPrompt(fishial) {
  const alternatives = fishial.alternatives.map((candidate) => `${candidate.commonName || "Unbenannt"} (${candidate.scientificName || "ohne wissenschaftlichen Namen"}, ${candidate.confidence ?? "unbekannt"})`).join("; ");
  return [
    "Bestimme die Fischart auf diesem Bild. Prüfe sichtbare Merkmale eigenständig, nutze die folgenden Fishial-Vorschläge nur als Kontext.",
    `Fishial Top-Ergebnis: ${fishial.primary?.commonName || "unbekannt"} (${fishial.primary?.scientificName || "ohne wissenschaftlichen Namen"}, ${fishial.primary?.confidence ?? "unbekannt"}).`,
    `Fishial Alternativen: ${alternatives || "keine"}.`,
    "Gib ausschließlich die verlangte JSON-Struktur zurück. reasoningSummary muss eine kurze sachliche Begründung mit höchstens 240 Zeichen sein; keine ausführliche Gedankenkette.",
  ].join("\n");
}

function readResponseText(body) {
  const parts = body?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.find((part) => typeof part.text === "string")?.text : null;
  if (!text) throw new GeminiSecondOpinionError("invalid_response");
  try { return JSON.parse(text); } catch { throw new GeminiSecondOpinionError("invalid_response"); }
}

function normalizeGeminiResponse(value) {
  if (!value || typeof value !== "object" || typeof value.fishDetected !== "boolean" || typeof value.uncertain !== "boolean") {
    throw new GeminiSecondOpinionError("invalid_response");
  }
  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new GeminiSecondOpinionError("invalid_response");
  return {
    provider: "gemini",
    fishDetected: value.fishDetected,
    commonName: typeof value.commonName === "string" ? value.commonName.trim() : null,
    scientificName: typeof value.scientificName === "string" ? value.scientificName.trim() : null,
    confidence,
    uncertain: value.uncertain,
    reasoningSummary: typeof value.reasoningSummary === "string" ? value.reasoningSummary.trim().slice(0, 240) : "",
  };
}

function retryAfterMilliseconds(response) {
  const seconds = Number(response.headers?.get("retry-after"));
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1_000, 3_000) : 500;
}

async function classifyHttpError(response) {
  const body = await response.json().catch(() => null);
  const providerStatus = String(body?.error?.status || "").toUpperCase();
  const providerMessage = String(body?.error?.message || "").toLowerCase();
  if (response.status === 429 || providerStatus === "RESOURCE_EXHAUSTED") {
    const category = providerMessage.includes("quota") ? "quota_exhausted" : "rate_limit";
    return new GeminiSecondOpinionError(category, { status: response.status, retryAfterMs: retryAfterMilliseconds(response) });
  }
  if (response.status === 400) return new GeminiSecondOpinionError("invalid_request", { status: response.status });
  if (response.status === 401 || response.status === 403) return new GeminiSecondOpinionError("authentication_error", { status: response.status });
  if (response.status === 503) return new GeminiSecondOpinionError("provider_unavailable", { status: response.status, retryAfterMs: retryAfterMilliseconds(response) });
  return new GeminiSecondOpinionError("provider_unavailable", { status: response.status });
}

function classifyTransportError(error) {
  if (error instanceof GeminiSecondOpinionError) return error;
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return new GeminiSecondOpinionError("timeout", { cause: error, retryAfterMs: 500 });
  return new GeminiSecondOpinionError("unknown_error", { cause: error });
}

function retryable(error) {
  return ["rate_limit", "quota_exhausted", "provider_unavailable", "timeout"].includes(error.category)
    && (error.status === null || error.status === 429 || error.status === 503);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createGeminiProvider({ apiKey, model, fetchImplementation = fetch, diagnostics = null, maxAttempts = 2, onHttpStatus = null }) {
  return {
    name: "gemini",
    isConfigured: Boolean(apiKey && model),
    async analyzeImage({ buffer, mimeType, fishial }) {
      if (!apiKey || !model) throw new GeminiSecondOpinionError("provider_unavailable");
      diagnostics?.requested(model);
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          diagnostics?.attemptStarted(attempt + 1);
          const response = await fetchImplementation(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [
                { text: buildPrompt(fishial) },
                { inlineData: { mimeType, data: buffer.toString("base64") } },
              ] }],
              generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
            }),
            // A retry creates a new signal, so each HTTP attempt receives its own full budget.
            signal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS),
          });
          diagnostics?.httpStatus(attempt + 1, response.status);
          onHttpStatus?.(response.status);
          if (!response.ok) throw await classifyHttpError(response);
          const body = await response.json().catch(() => null);
          const result = normalizeGeminiResponse(readResponseText(body));
          diagnostics?.completed();
          return result;
        } catch (error) {
          const safeError = classifyTransportError(error);
          diagnostics?.attemptFailed(attempt + 1, safeError.category);
          if (attempt < maxAttempts - 1 && retryable(safeError)) {
            diagnostics?.retryScheduled(attempt + 1);
            await sleep(safeError.retryAfterMs ?? 500);
            continue;
          }
          diagnostics?.failed(safeError.category);
          throw safeError;
        }
      }
      throw new GeminiSecondOpinionError("unknown_error");
    },
  };
}

module.exports = { createGeminiProvider, normalizeGeminiResponse, GeminiSecondOpinionError, GEMINI_REQUEST_TIMEOUT_MS };
