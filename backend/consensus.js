const { normalizeScientificName } = require("./fish-localization");

function sameSpecies(left, right) {
  const leftName = normalizeScientificName(left?.scientificName);
  const rightName = normalizeScientificName(right?.scientificName);
  return Boolean(leftName && rightName && leftName === rightName);
}

function createConsensus({ primary, alternatives, secondOpinion }) {
  if (!secondOpinion || !secondOpinion.fishDetected || secondOpinion.uncertain || !secondOpinion.scientificName) {
    return { status: "second_opinion_uncertain", selectedSpecies: null, message: "Die zweite Analyse konnte keine Art zuverlässig bestimmen." };
  }
  if (sameSpecies(primary, secondOpinion)) {
    return { status: "agreement", selectedSpecies: primary, message: "Beide Analysen stimmen in der Artbestimmung überein." };
  }
  const confirmedAlternative = alternatives.find((candidate) => sameSpecies(candidate, secondOpinion));
  if (confirmedAlternative) {
    return { status: "alternative_confirmed", selectedSpecies: confirmedAlternative, message: "Die zweite Analyse bestätigt eine alternative Fishial-Art." };
  }
  return { status: "disagreement", selectedSpecies: null, message: "Die beiden Analysen kommen zu unterschiedlichen Ergebnissen." };
}

module.exports = { createConsensus };
