const { AppError } = require("../errors");
const { createFishialProvider } = require("./fishial");
const { createGeminiProvider } = require("./gemini");

function createAnalysisProvider(config) {
  switch (config.provider) {
    case "FISHIAL":
      return createFishialProvider(config.fishial);
    case "GEMINI":
    case "OPENAI":
      throw new AppError("Der ausgewählte KI-Anbieter ist noch nicht verfügbar.", {
        status: 503,
        code: "PROVIDER_NOT_IMPLEMENTED",
      });
    default:
      throw new AppError("Der konfigurierte KI-Anbieter ist unbekannt.", {
        status: 500,
        code: "PROVIDER_UNKNOWN",
      });
  }
}

function createSecondOpinionProvider(config, options = {}) {
  if (!config.secondOpinion.enabled || config.secondOpinion.provider !== "GEMINI") return null;
  const provider = createGeminiProvider({ ...config.gemini, ...options });
  return provider.isConfigured ? provider : null;
}

module.exports = { createAnalysisProvider, createSecondOpinionProvider };
