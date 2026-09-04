const { AppError } = require("./errors");

function createRateLimiter({ windowMs, maxRequests }) {
  const requestsByIp = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const clientIp = req.ip;
    const activeRequests = (requestsByIp.get(clientIp) || []).filter(
      (timestamp) => now - timestamp < windowMs,
    );

    if (activeRequests.length >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - activeRequests[0])) / 1_000));
      res.set("Retry-After", String(retryAfterSeconds));
      return next(
        new AppError("Zu viele Anfragen. Bitte versuche es in einigen Minuten erneut.", {
          status: 429,
          code: "RATE_LIMITED",
        }),
      );
    }

    activeRequests.push(now);
    requestsByIp.set(clientIp, activeRequests);
    return next();
  };
}

module.exports = { createRateLimiter };
