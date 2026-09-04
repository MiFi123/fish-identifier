const assert = require("assert/strict");
const { AnalysisStore } = require("../backend/analysis-store");

(async () => {
  let now = 0;
  const store = new AnalysisStore({ ttlMs: 100, now: () => now });
  const entry = store.create({ buffer: Buffer.from("image"), mimeType: "image/png", result: { success: true, secondOpinionStatus: "pending" } });
  let providerCalls = 0;
  const task = async (storedEntry) => {
    providerCalls += 1;
    await Promise.resolve();
    return { ...storedEntry.result, secondOpinionStatus: "completed", secondOpinion: { provider: "gemini" } };
  };
  const [first, second] = await Promise.all([store.startSecondOpinion(entry.id, task), store.startSecondOpinion(entry.id, task)]);
  assert.equal(providerCalls, 1);
  assert.equal(first.secondOpinionStatus, "completed");
  assert.equal(second.secondOpinionStatus, "completed");
  assert.equal(store.get(entry.id).buffer, null);
  now = 101;
  assert.equal(store.get(entry.id), null);
  store.dispose();
  console.log("Analysis-Store-Tests erfolgreich.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
