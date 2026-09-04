const assert = require("assert/strict");
const { BENCHMARK_MODELS } = require("../backend/gemini-benchmark");
const { createGeminiProvider } = require("../backend/providers/gemini");

assert.deepEqual(BENCHMARK_MODELS, ["gemini-3.6-flash", "gemini-3.5-flash"]);

let calls = 0;
const provider = createGeminiProvider({
  apiKey: "test", model: "gemini-3.6-flash", maxAttempts: 1,
  fetchImplementation: async () => { calls += 1; return new Response(JSON.stringify({ error: { status: "UNAVAILABLE" } }), { status: 503 }); },
});
const image = { buffer: Buffer.from("test"), mimeType: "image/png", fishial: { primary: null, alternatives: [] } };
(async () => {
  await assert.rejects(() => provider.analyzeImage(image), (error) => error.status === 503);
  assert.equal(calls, 1, "The development benchmark must not retry automatically.");
  console.log("Gemini-Benchmark-Tests erfolgreich.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
