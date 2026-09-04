const { GERMAN_NAMES_BY_SCIENTIFIC_NAME, normalizeScientificName } = require("./fish-localization");
const { FISH_SPECIES_DATA } = require("./fish-species-data");

function getSpeciesCatalog() {
  return Object.entries(GERMAN_NAMES_BY_SCIENTIFIC_NAME)
    .map(([scientificName, germanName]) => ({ scientificName, germanName, ...(FISH_SPECIES_DATA[scientificName] || {}) }))
    .sort((left, right) => left.germanName.localeCompare(right.germanName, "de"));
}

function findSpecies(scientificName) {
  const normalized = normalizeScientificName(scientificName);
  return getSpeciesCatalog().find((species) => normalizeScientificName(species.scientificName) === normalized) || null;
}

module.exports = { getSpeciesCatalog, findSpecies };
