function createSecondOpinionDiagnostics({ environment = process.env.NODE_ENV || "development", logger = console } = {}) {
  const stats = {
    geminiRequests: 0,
    geminiAttempts: 0,
    geminiRetries: 0,
    geminiSuccesses: 0,
    geminiFailures: 0,
    geminiTimeouts: 0,
    gemini503s: 0,
    geminiRateLimits: 0,
  };
  const development = environment !== "production";

  return {
    requested(model) {
      stats.geminiRequests += 1;
      if (development) {
        logger.log("Gemini second opinion requested");
        logger.log(`Gemini model: ${model}`);
      }
    },
    attemptStarted(attempt) {
      stats.geminiAttempts += 1;
      if (development) logger.log(`Gemini attempt ${attempt} started`);
    },
    httpStatus(attempt, status) {
      if (status === 503) stats.gemini503s += 1;
      if (development) logger.log(`Gemini attempt ${attempt} HTTP status: ${status}`);
    },
    retryScheduled(attempt) {
      stats.geminiRetries += 1;
      if (development) logger.log(`Gemini retry scheduled after attempt ${attempt}`);
    },
    attemptFailed(attempt, category) {
      if (category === "timeout") stats.geminiTimeouts += 1;
      if (category === "rate_limit" || category === "quota_exhausted") stats.geminiRateLimits += 1;
      if (development) {
        if (category === "timeout") logger.log(`Gemini attempt ${attempt} timed out`);
        if (category === "rate_limit" || category === "quota_exhausted") logger.log("Gemini rate/quota limit reached");
      }
    },
    completed() {
      stats.geminiSuccesses += 1;
      if (development) logger.log("Gemini completed");
    },
    failed(category) {
      stats.geminiFailures += 1;
      if (development) {
        logger.log(`Gemini failed: ${category}`);
      }
    },
    snapshot() { return { ...stats }; },
  };
}

module.exports = { createSecondOpinionDiagnostics };
