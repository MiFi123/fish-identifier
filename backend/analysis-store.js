const crypto = require("crypto");

class AnalysisStore {
  constructor({ ttlMs = 5 * 60 * 1000, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.entries = new Map();
    this.cleanupTimer = setInterval(() => this.cleanup(), Math.min(ttlMs, 60_000));
    this.cleanupTimer.unref();
  }

  create({ buffer, mimeType, result }) {
    this.cleanup();
    const id = crypto.randomUUID();
    const entry = { id, buffer, mimeType, result, createdAt: this.now(), status: "pending", promise: null };
    this.entries.set(id, entry);
    return entry;
  }

  get(id) {
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (this.now() - entry.createdAt > this.ttlMs) {
      this.entries.delete(id);
      return null;
    }
    return entry;
  }

  async startSecondOpinion(id, task) {
    const entry = this.get(id);
    if (!entry) return null;
    if (entry.status === "processing") return entry.promise;
    if (entry.status === "completed" || entry.status === "failed") return entry.result;
    entry.status = "processing";
    entry.promise = (async () => {
      try {
        entry.result = await task(entry);
        entry.status = entry.result.secondOpinionStatus === "completed" ? "completed" : "failed";
        return entry.result;
      } finally {
        entry.buffer = null;
        entry.mimeType = null;
      }
    })();
    return entry.promise;
  }

  cleanup() {
    for (const [id, entry] of this.entries) if (this.now() - entry.createdAt > this.ttlMs) this.entries.delete(id);
  }

  size() { this.cleanup(); return this.entries.size; }

  dispose() { clearInterval(this.cleanupTimer); }
}

module.exports = { AnalysisStore };
