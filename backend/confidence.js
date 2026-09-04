const CONFIDENCE_LEVELS = Object.freeze([
  { id: "high", minimum: 0.8, label: "Hohe Sicherheit" },
  { id: "likely", minimum: 0.6, label: "Wahrscheinlich" },
  { id: "uncertain", minimum: 0.4, label: "Unsichere Bestimmung" },
  { id: "unreliable", minimum: 0, label: "Keine zuverlässige Bestimmung" },
]);

const SECOND_OPINION_THRESHOLD = 0.8;

function getConfidenceLevel(confidence) {
  if (!Number.isFinite(confidence)) return CONFIDENCE_LEVELS.at(-1);
  return CONFIDENCE_LEVELS.find((level) => confidence >= level.minimum) || CONFIDENCE_LEVELS.at(-1);
}

function shouldRecommendSecondOpinion(confidence) {
  return Number.isFinite(confidence) && confidence < SECOND_OPINION_THRESHOLD;
}

module.exports = { CONFIDENCE_LEVELS, SECOND_OPINION_THRESHOLD, getConfidenceLevel, shouldRecommendSecondOpinion };
