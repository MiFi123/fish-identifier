const { localizeCandidate } = require("./fish-localization");
const { getConfidenceLevel, shouldRecommendSecondOpinion } = require("./confidence");
const { getSpeciesInfo } = require("./fish-species-data");
const { createConsensus } = require("./consensus");

const BETTER_PHOTO_GUIDANCE = "Versuche ein neues Foto, auf dem der gesamte Fisch möglichst seitlich sichtbar und gut beleuchtet ist.";

function enrichCandidate(candidate) {
  if (!candidate) return null;
  const confidenceLevel = getConfidenceLevel(candidate.confidence);
  return {
    ...localizeCandidate(candidate),
    speciesInfo: getSpeciesInfo(candidate.scientificName),
    confidenceLevel: confidenceLevel.id,
    confidenceLabel: confidenceLevel.label,
  };
}

function createResultMessage({ fishDetected, primary }) {
  if (!fishDetected) return "Auf dem Bild konnte kein Fisch eindeutig erkannt werden.";
  if (!primary) return "Ein Fisch wurde erkannt, aber keiner Art zugeordnet.";
  if (primary.confidence === null || primary.confidence < 0.8) {
    return "Die Bestimmung ist nicht eindeutig.";
  }
  return "Die KI-Bestimmung ist ein Hinweis und keine garantierte Artenbestimmung.";
}

function enrichSecondOpinion(secondOpinion) {
  if (!secondOpinion) return null;
  const localized = localizeCandidate(secondOpinion);
  return { ...secondOpinion, localizedName: localized.localizedName, displayName: localized.displayName };
}

function createPrimaryAnalysisService(provider) {
  return {
    async analyzeImage(image) {
      const providerResult = await provider.analyzeImage(image);
      const [providerPrimary = null, ...providerAlternatives] = providerResult.candidates;
      const primary = enrichCandidate(providerPrimary);
      const alternatives = providerAlternatives.slice(0, 3).map(enrichCandidate);
      const uncertain = Boolean(primary) && (primary.confidence === null || primary.confidence < 0.8);

      const result = {
        success: true,
        fishDetected: providerResult.fishDetected,
        primary,
        alternatives,
        message: createResultMessage({ fishDetected: providerResult.fishDetected, primary }),
        guidance: uncertain ? BETTER_PHOTO_GUIDANCE : null,
        secondOpinionRecommended: shouldRecommendSecondOpinion(primary?.confidence),
        primaryAnalysis: primary,
        secondOpinion: null,
        consensus: null,
        secondOpinionUnavailable: false,
        secondOpinionStatus: !shouldRecommendSecondOpinion(primary?.confidence) ? "not_required" : "not_configured",
        secondOpinionErrorType: null,
        provider: provider.name,
      };

      return result;
    },
  };
}

async function runSecondOpinion(result, image, secondOpinionProvider) {
  try {
    result.secondOpinion = enrichSecondOpinion(await secondOpinionProvider.analyzeImage({
          ...image,
      fishial: { primary: result.primary, alternatives: result.alternatives },
    }));
    result.consensus = createConsensus({ primary: result.primary, alternatives: result.alternatives, secondOpinion: result.secondOpinion });
    result.secondOpinionStatus = "completed";
  } catch (error) {
    result.secondOpinionUnavailable = true;
    result.secondOpinionErrorType = error?.category || "unknown_error";
    result.secondOpinionStatus = ["rate_limit", "quota_exhausted"].includes(result.secondOpinionErrorType) ? "rate_limited" : "failed";
  }
  return result;
}

function createAnalysisService(provider, secondOpinionProvider = null) {
  const primaryService = createPrimaryAnalysisService(provider);
  return { async analyzeImage(image) {
    const result = await primaryService.analyzeImage(image);
    return !result.secondOpinionRecommended || !secondOpinionProvider ? result : runSecondOpinion(result, image, secondOpinionProvider);
  } };
}

module.exports = { createAnalysisService, createPrimaryAnalysisService, runSecondOpinion };
