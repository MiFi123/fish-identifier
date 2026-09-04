const path = require("path");
const dotenv = require("dotenv");

// Load credentials from the project root, regardless of the folder from which
// `node server.js` was started.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

function positiveInteger(value, fallback, variableName) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${variableName} muss eine positive ganze Zahl sein.`);
  }
  return parsed;
}

function booleanValue(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
}

const nodeEnv = (process.env.NODE_ENV || "development").trim().toLowerCase();
const appEnv = (process.env.APP_ENV || (nodeEnv === "production" ? "production" : "development")).trim().toLowerCase();
if (!["development", "test", "production"].includes(nodeEnv)) throw new Error("NODE_ENV muss development, test oder production sein.");
if (!["development", "beta", "production", "test"].includes(appEnv)) throw new Error("APP_ENV muss development, beta, test oder production sein.");

module.exports = {
  nodeEnv,
  appEnv,
  isProductionLike: nodeEnv === "production" || appEnv === "beta" || appEnv === "production",
  trustProxy: booleanValue(process.env.TRUST_PROXY),
  port: positiveInteger(process.env.PORT, 3000, "PORT"),
  host: (process.env.HOST || "0.0.0.0").trim(),
  maxUploadSizeBytes: positiveInteger(
    process.env.MAX_UPLOAD_SIZE_BYTES,
    10 * 1024 * 1024,
    "MAX_UPLOAD_SIZE_BYTES",
  ),
  provider: (process.env.AI_PROVIDER || "FISHIAL").toUpperCase(),
  rateLimit: {
    windowMs: positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 600_000, "RATE_LIMIT_WINDOW_MS"),
    maxRequests: positiveInteger(process.env.RATE_LIMIT_MAX_REQUESTS, 10, "RATE_LIMIT_MAX_REQUESTS"),
  },
  secondOpinionRateLimit: { windowMs: positiveInteger(process.env.SECOND_OPINION_RATE_LIMIT_WINDOW_MS, 600_000, "SECOND_OPINION_RATE_LIMIT_WINDOW_MS"), maxRequests: positiveInteger(process.env.SECOND_OPINION_RATE_LIMIT_MAX_REQUESTS, 10, "SECOND_OPINION_RATE_LIMIT_MAX_REQUESTS") },
  fishial: {
    clientId: process.env.FISHIAL_CLIENT_ID,
    clientSecret: process.env.FISHIAL_CLIENT_SECRET,
    baseUrl: (process.env.FISHIAL_BASE_URL || "https://api-recognition.fishial.ai").replace(/\/$/, ""),
  },
  secondOpinion: {
    enabled: booleanValue(process.env.SECOND_OPINION_ENABLED),
    provider: (process.env.SECOND_OPINION_PROVIDER || "").trim().toUpperCase(),
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim(),
  },
};

module.exports.validateStartup = function validateStartup() {
  if (!module.exports.isProductionLike) return;
  const missing = [];
  if (module.exports.provider === "FISHIAL" && !module.exports.fishial.clientId) missing.push("FISHIAL_CLIENT_ID");
  if (module.exports.provider === "FISHIAL" && !module.exports.fishial.clientSecret) missing.push("FISHIAL_CLIENT_SECRET");
  if (module.exports.secondOpinion.enabled && module.exports.secondOpinion.provider === "GEMINI" && !module.exports.gemini.apiKey) missing.push("GEMINI_API_KEY");
  if (missing.length) throw new Error(`Produktionskonfiguration unvollständig: ${missing.join(", ")}`);
};
