const { FISH_SPECIES_DATA } = require('./fish-species-data');
const { getGermanFishName } = require('./fish-localization');

// These rules are editorial interpretations of the existing local profiles,
// not automatically extracted Fishial annotations. Missing values mean UNKNOWN.
const QUESTIONS = [
  { id: 'eel', label: 'Schlangenförmiger Körper', weight: 4 },
  { id: 'deep', label: 'Sehr hoher, seitlich flacher Körper', weight: 2 },
  { id: 'duckMouth', label: 'Breites, entenschnabelartiges Maul', weight: 4 },
  { id: 'barbels', label: 'Barteln am Maul', weight: 3 },
  { id: 'armor', label: 'Reihen knöcherner Schilder', weight: 4 },
  { id: 'adipose', label: 'Kleine Fettflosse vor der Schwanzflosse', weight: 3 },
  { id: 'twoDorsal', label: 'Zwei getrennte Rückenflossen', weight: 3 },
  { id: 'rearDorsal', label: 'Rückenflosse weit hinten', weight: 3 },
  { id: 'sailDorsal', label: 'Sehr große, segelartige Rückenflosse', weight: 4 },
  { id: 'longAnal', label: 'Sehr lange Afterflosse an der Unterseite', weight: 2 },
  { id: 'bands', label: 'Dunkle Querbänder an den Seiten', weight: 2 },
  { id: 'redFins', label: 'Deutlich rote Bauch- oder Afterflossen', weight: 1 },
  { id: 'rainbow', label: 'Rötliches Band längs der Seite', weight: 3 },
  { id: 'redSpots', label: 'Rote und dunkle Punkte mit hellem Rand', weight: 3 },
  { id: 'wormPattern', label: 'Helle, wurmförmige Zeichnung am Rücken', weight: 3 },
  { id: 'redEyes', label: 'Rote Iris', weight: 1 },
  { id: 'upMouth', label: 'Maul zeigt nach oben / Unterkiefer steht vor', weight: 2 },
  { id: 'downMouth', label: 'Maul an der Unterseite des Kopfes', weight: 2 },
];

const PROFILES = {
  'Esox lucius': { duckMouth: true, rearDorsal: true, eel: false, armor: false, adipose: false, barbels: false },
  'Sander lucioperca': { twoDorsal: true, bands: true, eel: false, adipose: false, barbels: false, armor: false },
  'Perca fluviatilis': { twoDorsal: true, bands: true, redFins: true, eel: false, adipose: false, barbels: false, armor: false },
  'Silurus glanis': { barbels: true, longAnal: true, eel: false, armor: false, adipose: false },
  'Cyprinus carpio': { barbels: true, deep: true, eel: false, adipose: false, armor: false },
  'Tinca tinca': { barbels: true, redEyes: true, eel: false, armor: false, adipose: false },
  'Squalius cephalus': { eel: false, armor: false, adipose: false, barbels: false, upMouth: false },
  'Aspius aspius': { upMouth: true, eel: false, adipose: false, armor: false, barbels: false },
  'Rutilus rutilus': { redEyes: true, redFins: true, upMouth: false, eel: false, adipose: false, barbels: false, armor: false },
  'Scardinius erythrophthalmus': { redFins: true, upMouth: true, deep: true, eel: false, adipose: false, barbels: false, armor: false },
  'Abramis brama': { deep: true, longAnal: true, eel: false, adipose: false, barbels: false, armor: false },
  'Barbus barbus': { barbels: true, downMouth: true, eel: false, adipose: false, armor: false },
  'Salmo trutta': { adipose: true, redSpots: true, eel: false, barbels: false, armor: false },
  'Oncorhynchus mykiss': { adipose: true, rainbow: true, eel: false, barbels: false, armor: false },
  'Salvelinus fontinalis': { adipose: true, wormPattern: true, eel: false, barbels: false, armor: false },
  'Thymallus thymallus': { adipose: true, sailDorsal: true, eel: false, barbels: false, armor: false },
  'Anguilla anguilla': { eel: true, armor: false, adipose: false, barbels: false },
  'Ctenopharyngodon idella': { eel: false, armor: false, adipose: false, barbels: false, deep: false },
  'Acipenser sturio': { armor: true, barbels: true, downMouth: true, eel: false, adipose: false },
  'Acipenser ruthenus': { armor: true, barbels: true, downMouth: true, eel: false, adipose: false },
  'Acipenser baerii': { armor: true, barbels: true, downMouth: true, eel: false, adipose: false },
};
const ALIASES = { 'Leuciscus aspius': 'Aspius aspius', 'Cyprinus carpio carpio': 'Cyprinus carpio' };
const canonicalName = name => ALIASES[name] || name;

function validateTraits(traits) {
  if (!traits || typeof traits !== 'object' || Array.isArray(traits)) throw new Error('INVALID_TRAITS');
  const keys = new Set(QUESTIONS.map(question => question.id));
  for (const [id, value] of Object.entries(traits)) {
    if (!keys.has(id) || ![true, false, null].includes(value)) throw new Error('INVALID_TRAITS');
  }
}

function rankCandidates({ traits = {}, candidates = [] } = {}) {
  validateTraits(traits);
  if (!Array.isArray(candidates) || candidates.length > 300) throw new Error('INVALID_CANDIDATES');
  const imageDistances = new Map();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate.scientificName !== 'string' || candidate.scientificName.length > 100 || !Number.isFinite(candidate.distance) || candidate.distance < 0 || candidate.distance > 1000) throw new Error('INVALID_CANDIDATES');
    const name = canonicalName(candidate.scientificName);
    imageDistances.set(name, Math.min(candidate.distance, imageDistances.get(name) ?? Infinity));
  }
  const answered = QUESTIONS.filter(question => typeof traits[question.id] === 'boolean');
  if (!imageDistances.size && !answered.length) return [];
  const names = new Set(imageDistances.keys());
  if (answered.length) Object.keys(PROFILES).forEach(name => names.add(name));
  const results = [...names].map(scientificName => {
    const profile = PROFILES[scientificName] || {};
    const matched = [], contradicted = [], unknown = [];
    let evidence = 0;
    for (const question of answered) {
      if (typeof profile[question.id] !== 'boolean') { unknown.push(question.label); continue; }
      if (profile[question.id] === traits[question.id]) {
        evidence += question.weight;
        matched.push(question.label + (traits[question.id] ? ': ja' : ': nein'));
      } else {
        evidence -= question.weight * 1.5;
        contradicted.push(question.label + (traits[question.id] ? ': laut Profil nein' : ': laut Profil ja'));
      }
    }
    const distance = imageDistances.get(scientificName) ?? null;
    const imageScore = distance === null ? 0 : 1 - distance / 8.84;
    const traitScore = evidence / Math.max(12, answered.reduce((sum, question) => sum + question.weight, 0));
    // Rejected photo candidates keep their distance ordering. Manual-only
    // suggestions remain labelled and never acquire a fake image score.
    const score = imageScore + traitScore * (imageDistances.size ? 0.35 : 1);
    return { scientificName, displayName: getGermanFishName(scientificName) || scientificName,
      distance, score, matched, contradicted, unknown, knownAnswers: matched.length + contradicted.length,
      profile: FISH_SPECIES_DATA[scientificName] || null, source: distance === null ? 'traits' : 'photo' };
  }).filter(candidate => imageDistances.size ? (candidate.distance !== null || candidate.score > 0) : candidate.matched.length > 0 && candidate.score > 0);
  return results.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName, 'de')).slice(0, 5);
}

module.exports = { QUESTIONS, PROFILES, ALIASES, canonicalName, rankCandidates, validateTraits };
