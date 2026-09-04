const assert = require("assert/strict");
const { getGermanFishName, localizeCandidate } = require("../backend/fish-localization");
const { getConfidenceLevel, shouldRecommendSecondOpinion } = require("../backend/confidence");
const { getSpeciesInfo } = require("../backend/fish-species-data");
const { createAnalysisService } = require("../backend/analysis-service");
const { FISH_SPECIES_DATA } = require("../backend/fish-species-data");
const { createGeminiProvider } = require("../backend/providers/gemini");
const { createSecondOpinionDiagnostics } = require("../backend/second-opinion-diagnostics");

const names = {
  "Esox lucius": "Hecht",
  "Salmo trutta": "Bachforelle",
  "Oncorhynchus mykiss": "Regenbogenforelle",
  "Sander lucioperca": "Zander",
  "Squalius cephalus": "Döbel",
  "Anguilla anguilla": "Europäischer Aal",
  "Gasterosteus aculeatus": "Dreistachliger Stichling",
};
for (const [scientificName, expected] of Object.entries(names)) assert.equal(getGermanFishName(scientificName), expected);
assert.equal(getGermanFishName("Unknown species"), null);
assert.equal(getGermanFishName("  ANGUILLA   ANGUILL A ".replace("ANGUILL A", "ANGUILLA")), "Europäischer Aal");
assert.ok(getSpeciesInfo("  Anguilla   anguilla "));

assert.equal(getConfidenceLevel(0.8).id, "high");
assert.equal(getConfidenceLevel(0.79).id, "likely");
assert.equal(getConfidenceLevel(0.59).id, "uncertain");
assert.equal(getConfidenceLevel(0.39).id, "unreliable");
assert.equal(shouldRecommendSecondOpinion(0.79), true);
assert.equal(shouldRecommendSecondOpinion(0.8), false);
assert.equal(shouldRecommendSecondOpinion(0.95), false);

const mirrorCarp = localizeCandidate({ commonName: "Mirror carp", scientificName: "Cyprinus carpio", confidence: 0.84 });
assert.equal(mirrorCarp.localizedName, "Karpfen");
assert.equal(mirrorCarp.displayName, "Spiegelkarpfen (Karpfen)");
const cutbow = localizeCandidate({ commonName: "Cutbow trout", scientificName: "Oncorhynchus mykiss", confidence: 0.72 });
assert.equal(cutbow.localizedName, null);
assert.equal(cutbow.displayName, "Cutbow trout");

async function analyze(candidates, fishDetected = true, secondOpinionProvider = null) {
  return createAnalysisService(
    { name: "test", analyzeImage: async () => ({ fishDetected, candidates }) },
    secondOpinionProvider,
  ).analyzeImage({ buffer: Buffer.from("test"), mimeType: "image/png" });
}

function secondOpinion(result) {
  return { name: "gemini", analyzeImage: async () => result };
}

const geminiInput = {
  buffer: Buffer.from("test-image"),
  mimeType: "image/png",
  fishial: { primary: { commonName: "Roach", scientificName: "Rutilus rutilus", confidence: 0.79 }, alternatives: [] },
};
const geminiSuccessBody = {
  candidates: [{ content: { parts: [{ text: JSON.stringify({
    fishDetected: true, commonName: "Roach", scientificName: "Rutilus rutilus", confidence: 0.72, uncertain: false, reasoningSummary: "Merkmale passen.",
  }) }] } }],
};
function geminiErrorResponse(status, apiStatus, message = "temporary") {
  return new Response(JSON.stringify({ error: { code: status, status: apiStatus, message } }), { status, headers: { "content-type": "application/json", "retry-after": "0" } });
}

(async () => {
  const result = await analyze([
    { commonName: "Northern pike", scientificName: "Esox lucius", confidence: 0.86 },
    { commonName: "Lake trout", scientificName: "Salvelinus namaycush", confidence: 0.54 },
    { commonName: "A", scientificName: "A", confidence: 0.3 },
    { commonName: "B", scientificName: "B", confidence: 0.2 },
    { commonName: "C", scientificName: "C", confidence: 0.1 },
  ]);
  assert.equal(result.primary.localizedName, "Hecht");
  assert.equal(result.primary.confidenceLabel, "Hohe Sicherheit");
  assert.equal(result.secondOpinionRecommended, false);
  assert.equal(result.primary.speciesInfo.typicalSize, "40–100 cm");
  assert.equal(result.alternatives.length, 3);
  assert.equal(result.alternatives[0].localizedName, null);

  let secureResultCalls = 0;
  const secureResult = await analyze(
    [{ commonName: "Northern pike", scientificName: "Esox lucius", confidence: 0.86 }],
    true,
    { name: "gemini", analyzeImage: async () => { secureResultCalls += 1; return {}; } },
  );
  assert.equal(secureResultCalls, 0);
  assert.equal(secureResult.secondOpinion, null);

  const mappedWithoutProfile = await analyze([{ commonName: "Ide", scientificName: "Leuciscus idus", confidence: 0.7 }]);
  assert.equal(mappedWithoutProfile.primary.localizedName, "Aland");
  assert.equal(mappedWithoutProfile.primary.speciesInfo, null);

  const unknown = await analyze([{ commonName: "Unknown", scientificName: "Unknown species", confidence: 0.7 }]);
  assert.equal(unknown.primary.localizedName, null);
  assert.equal(unknown.primary.speciesInfo, null);

  const uncertain = await analyze([{ commonName: "Chub", scientificName: "Squalius cephalus", confidence: 0.59 }]);
  assert.match(uncertain.message, /nicht eindeutig/);
  assert.ok(uncertain.guidance);
  assert.equal(uncertain.secondOpinionRecommended, true);
  assert.equal(uncertain.secondOpinionStatus, "not_configured");

  const agreement = await analyze(
    [{ commonName: "Roach", scientificName: "Rutilus rutilus", confidence: 0.79 }],
    true,
    secondOpinion({ provider: "gemini", fishDetected: true, commonName: "Roach", scientificName: "Rutilus rutilus", confidence: 0.72, uncertain: false, reasoningSummary: "Körperform passt." }),
  );
  assert.equal(agreement.consensus.status, "agreement");
  assert.equal(agreement.secondOpinionStatus, "completed");

  const alternativeConfirmed = await analyze(
    [
      { commonName: "Cutbow trout", scientificName: "Hybrid", confidence: 0.72 },
      { commonName: "Rainbow trout", scientificName: "Oncorhynchus mykiss", confidence: 0.64 },
    ],
    true,
    secondOpinion({ provider: "gemini", fishDetected: true, commonName: "Rainbow trout", scientificName: "Oncorhynchus mykiss", confidence: 0.7, uncertain: false, reasoningSummary: "Seitenband sichtbar." }),
  );
  assert.equal(alternativeConfirmed.consensus.status, "alternative_confirmed");
  assert.equal(alternativeConfirmed.consensus.selectedSpecies.localizedName, "Regenbogenforelle");

  const disagreement = await analyze(
    [{ commonName: "Roach", scientificName: "Rutilus rutilus", confidence: 0.75 }],
    true,
    secondOpinion({ provider: "gemini", fishDetected: true, commonName: "Chub", scientificName: "Squalius cephalus", confidence: 0.65, uncertain: false, reasoningSummary: "Großes Maul." }),
  );
  assert.equal(disagreement.consensus.status, "disagreement");

  const secondOpinionUncertain = await analyze(
    [{ commonName: "Roach", scientificName: "Rutilus rutilus", confidence: 0.75 }],
    true,
    secondOpinion({ provider: "gemini", fishDetected: false, commonName: null, scientificName: null, confidence: 0, uncertain: true, reasoningSummary: "Nicht sicher bestimmbar." }),
  );
  assert.equal(secondOpinionUncertain.consensus.status, "second_opinion_uncertain");

  for (const failure of [new Error("timeout"), new Error("http"), new Error("invalid-json")]) {
    const fallback = await analyze(
      [{ commonName: "Roach", scientificName: "Rutilus rutilus", confidence: 0.79 }],
      true,
      { name: "gemini", analyzeImage: async () => { throw failure; } },
    );
    assert.equal(fallback.primary.localizedName, "Rotauge");
    assert.equal(fallback.secondOpinion, null);
    assert.equal(fallback.secondOpinionUnavailable, true);
  }

  let calls = 0;
  const rateLimitedProvider = createGeminiProvider({
    apiKey: "test", model: "gemini-3.6-flash",
    fetchImplementation: async () => { calls += 1; return geminiErrorResponse(429, "RESOURCE_EXHAUSTED", "rate limit"); },
  });
  await assert.rejects(() => rateLimitedProvider.analyzeImage(geminiInput), (error) => error.category === "rate_limit");
  assert.equal(calls, 2);

  calls = 0;
  const unavailableProvider = createGeminiProvider({
    apiKey: "test", model: "gemini-3.6-flash",
    fetchImplementation: async () => { calls += 1; return geminiErrorResponse(503, "UNAVAILABLE"); },
  });
  await assert.rejects(() => unavailableProvider.analyzeImage(geminiInput), (error) => error.category === "provider_unavailable");
  assert.equal(calls, 2);

  calls = 0;
  const invalidRequestProvider = createGeminiProvider({
    apiKey: "test", model: "gemini-3.6-flash",
    fetchImplementation: async () => { calls += 1; return geminiErrorResponse(400, "INVALID_ARGUMENT"); },
  });
  await assert.rejects(() => invalidRequestProvider.analyzeImage(geminiInput), (error) => error.category === "invalid_request");
  assert.equal(calls, 1);

  calls = 0;
  const authProvider = createGeminiProvider({
    apiKey: "test", model: "gemini-3.6-flash",
    fetchImplementation: async () => { calls += 1; return geminiErrorResponse(401, "UNAUTHENTICATED"); },
  });
  await assert.rejects(() => authProvider.analyzeImage(geminiInput), (error) => error.category === "authentication_error");
  assert.equal(calls, 1);

  calls = 0;
  const forbiddenProvider = createGeminiProvider({
    apiKey: "test", model: "gemini-3.6-flash",
    fetchImplementation: async () => { calls += 1; return geminiErrorResponse(403, "PERMISSION_DENIED"); },
  });
  await assert.rejects(() => forbiddenProvider.analyzeImage(geminiInput), (error) => error.category === "authentication_error");
  assert.equal(calls, 1);

  calls = 0;
  const timeoutProvider = createGeminiProvider({
    apiKey: "test", model: "gemini-3.6-flash",
    fetchImplementation: async () => {
      calls += 1;
      const error = new Error("timeout");
      error.name = "TimeoutError";
      throw error;
    },
  });
  await assert.rejects(() => timeoutProvider.analyzeImage(geminiInput), (error) => error.category === "timeout");
  assert.equal(calls, 2);

  calls = 0;
  const retrySuccessProvider = createGeminiProvider({
    apiKey: "test", model: "gemini-3.6-flash",
    fetchImplementation: async () => {
      calls += 1;
      return calls === 1 ? geminiErrorResponse(503, "UNAVAILABLE") : new Response(JSON.stringify(geminiSuccessBody), { status: 200 });
    },
  });
  const retriedGemini = await retrySuccessProvider.analyzeImage(geminiInput);
  assert.equal(calls, 2);
  assert.equal(retriedGemini.scientificName, "Rutilus rutilus");

  const timeoutError = () => {
    const error = new Error("timeout");
    error.name = "TimeoutError";
    return error;
  };
  const silentDiagnostics = () => createSecondOpinionDiagnostics({ environment: "production" });

  let diagnostics = silentDiagnostics();
  calls = 0;
  const timeoutThenSuccess = createGeminiProvider({
    apiKey: "test", model: "gemini-3.6-flash", diagnostics,
    fetchImplementation: async () => {
      calls += 1;
      if (calls === 1) throw timeoutError();
      return new Response(JSON.stringify(geminiSuccessBody), { status: 200 });
    },
  });
  await timeoutThenSuccess.analyzeImage(geminiInput);
  assert.deepEqual(diagnostics.snapshot(), { geminiRequests: 1, geminiAttempts: 2, geminiRetries: 1, geminiSuccesses: 1, geminiFailures: 0, geminiTimeouts: 1, gemini503s: 0, geminiRateLimits: 0 });

  diagnostics = silentDiagnostics();
  calls = 0;
  const unavailableThenSuccess = createGeminiProvider({
    apiKey: "test", model: "gemini-3.6-flash", diagnostics,
    fetchImplementation: async () => {
      calls += 1;
      return calls === 1 ? geminiErrorResponse(503, "UNAVAILABLE") : new Response(JSON.stringify(geminiSuccessBody), { status: 200 });
    },
  });
  await unavailableThenSuccess.analyzeImage(geminiInput);
  assert.deepEqual(diagnostics.snapshot(), { geminiRequests: 1, geminiAttempts: 2, geminiRetries: 1, geminiSuccesses: 1, geminiFailures: 0, geminiTimeouts: 0, gemini503s: 1, geminiRateLimits: 0 });

  diagnostics = silentDiagnostics();
  calls = 0;
  const unavailableThenTimeout = createGeminiProvider({
    apiKey: "test", model: "gemini-3.6-flash", diagnostics,
    fetchImplementation: async () => {
      calls += 1;
      if (calls === 1) return geminiErrorResponse(503, "UNAVAILABLE");
      throw timeoutError();
    },
  });
  await assert.rejects(() => unavailableThenTimeout.analyzeImage(geminiInput), (error) => error.category === "timeout");
  assert.deepEqual(diagnostics.snapshot(), { geminiRequests: 1, geminiAttempts: 2, geminiRetries: 1, geminiSuccesses: 0, geminiFailures: 1, geminiTimeouts: 1, gemini503s: 1, geminiRateLimits: 0 });

  diagnostics = silentDiagnostics();
  const twoTimeouts = createGeminiProvider({
    apiKey: "test", model: "gemini-3.6-flash", diagnostics,
    fetchImplementation: async () => { throw timeoutError(); },
  });
  await assert.rejects(() => twoTimeouts.analyzeImage(geminiInput), (error) => error.category === "timeout");
  assert.deepEqual(diagnostics.snapshot(), { geminiRequests: 1, geminiAttempts: 2, geminiRetries: 1, geminiSuccesses: 0, geminiFailures: 1, geminiTimeouts: 2, gemini503s: 0, geminiRateLimits: 0 });

  diagnostics = silentDiagnostics();
  const firstAttemptSuccess = createGeminiProvider({
    apiKey: "test", model: "gemini-3.6-flash", diagnostics,
    fetchImplementation: async () => new Response(JSON.stringify(geminiSuccessBody), { status: 200 }),
  });
  await firstAttemptSuccess.analyzeImage(geminiInput);
  assert.deepEqual(diagnostics.snapshot(), { geminiRequests: 1, geminiAttempts: 1, geminiRetries: 0, geminiSuccesses: 1, geminiFailures: 0, geminiTimeouts: 0, gemini503s: 0, geminiRateLimits: 0 });

  const eel = await analyze([{ commonName: "European eel", scientificName: " Anguilla anguilla ", confidence: 0.86 }]);
  assert.equal(eel.primary.localizedName, "Europäischer Aal");
  assert.ok(eel.primary.speciesInfo);

  const noFish = await analyze([], false);
  assert.equal(noFish.primary, null);
  assert.equal(noFish.guidance, null);
  assert.match(noFish.message, /kein Fisch/i);
  console.log("Phase-3-Tests erfolgreich.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
