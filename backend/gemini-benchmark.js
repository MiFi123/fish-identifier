const { createGeminiProvider } = require("./providers/gemini");

const BENCHMARK_MODELS = Object.freeze(["gemini-3.6-flash", "gemini-3.5-flash"]);

function safeResult({ model, attempt, startedAt, response, error, httpStatus }) {
  const durationMs = Date.now() - startedAt;
  if (response) {
    return {
      model, attempt, success: true, durationMs, httpStatus: httpStatus || 200,
      timeout: false, serviceUnavailable: false, rateLimited: false,
      commonName: response.commonName, scientificName: response.scientificName, confidence: response.confidence,
      error: null,
    };
  }
  return {
    model, attempt, success: false, durationMs, httpStatus: error?.status || httpStatus || null,
    timeout: error?.category === "timeout", serviceUnavailable: error?.status === 503,
    rateLimited: ["rate_limit", "quota_exhausted"].includes(error?.category),
    commonName: null, scientificName: null, confidence: null, error: error?.category || "unknown_error",
  };
}

async function runGeminiBenchmark({ apiKey, models = BENCHMARK_MODELS, image, repetitions = 2 }) {
  const safeRepetitions = Math.max(1, Math.min(Number(repetitions) || 1, 2));
  const results = [];
  for (const model of models) {
    for (let attempt = 1; attempt <= safeRepetitions; attempt += 1) {
      let httpStatus = null;
      const provider = createGeminiProvider({
        apiKey, model, maxAttempts: 1,
        onHttpStatus: (status) => { httpStatus = status; },
      });
      const startedAt = Date.now();
      try {
        const response = await provider.analyzeImage({
          buffer: image.buffer,
          mimeType: image.mimeType,
          fishial: { primary: null, alternatives: [] },
        });
        results.push(safeResult({ model, attempt, startedAt, response, httpStatus }));
      } catch (error) {
        results.push(safeResult({ model, attempt, startedAt, error, httpStatus }));
      }
    }
  }
  return results;
}

module.exports = { BENCHMARK_MODELS, runGeminiBenchmark };
