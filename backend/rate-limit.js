const { AppError } = require("./errors");

function createRateLimiter({ windowMs, maxRequests, maxClients = 10000, now = Date.now }) {
  const requestsByIp = new Map();
  let nextSweep = 0;

  return (req, res, next) => {
    const timestamp = now();
    if (timestamp >= nextSweep) {
      for (const [ip, entry] of requestsByIp) if (entry.until <= timestamp) requestsByIp.delete(ip);
      nextSweep = timestamp + Math.min(windowMs, 60000);
    }
    const clientIp = req.ip;
    let entry = requestsByIp.get(clientIp);
    if (!entry || entry.until <= timestamp) {
      if (!entry && requestsByIp.size >= maxClients) {
        res.set('Retry-After', String(Math.max(1, Math.ceil(windowMs / 1000))));
        return next(new AppError('Die Analyse ist gerade ausgelastet.', { status: 503, code: 'RATE_LIMIT_CAPACITY' }));
      }
      entry = { count: 0, until: timestamp + windowMs };
      requestsByIp.set(clientIp, entry);
    }

    if (entry.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.until - timestamp) / 1_000));
      res.set("Retry-After", String(retryAfterSeconds));
      return next(
        new AppError("Zu viele Anfragen. Bitte versuche es in einigen Minuten erneut.", {
          status: 429,
          code: "RATE_LIMITED",
        }),
      );
    }

    entry.count += 1;
    return next();
  };
}

module.exports = { createRateLimiter };
