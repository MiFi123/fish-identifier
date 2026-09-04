// Scientific names are stable across Fishial model versions. Add new entries
// here rather than deriving translations from English common names.
const GERMAN_NAMES_BY_SCIENTIFIC_NAME = Object.freeze({
  "Esox lucius": "Hecht",
  "Salmo trutta": "Bachforelle",
  "Oncorhynchus mykiss": "Regenbogenforelle",
  "Sander lucioperca": "Zander",
  "Perca fluviatilis": "Flussbarsch",
  "Cyprinus carpio": "Karpfen",
  "Silurus glanis": "Wels",
  "Tinca tinca": "Schleie",
  "Squalius cephalus": "Döbel",
  "Aspius aspius": "Rapfen",
  "Rutilus rutilus": "Rotauge",
  "Scardinius erythrophthalmus": "Rotfeder",
  "Abramis brama": "Brasse",
  "Barbus barbus": "Barbe",
  "Leuciscus idus": "Aland",
  "Leuciscus leuciscus": "Hasel",
  "Alburnus alburnus": "Ukelei",
  "Gobio gobio": "Gründling",
  "Carassius carassius": "Karausche",
  "Carassius gibelio": "Giebel",
  "Ctenopharyngodon idella": "Graskarpfen",
  "Hypophthalmichthys molitrix": "Silberkarpfen",
  "Salvelinus fontinalis": "Bachsaibling",
  "Salvelinus alpinus": "Seesaibling",
  "Thymallus thymallus": "Äsche",
  "Hucho hucho": "Huchen",
  "Anguilla anguilla": "Europäischer Aal",
  "Anguilla rostrata": "Amerikanischer Aal",
  "Salmo salar": "Atlantischer Lachs",
  "Oncorhynchus tshawytscha": "Königslachs",
  "Oncorhynchus kisutch": "Silberlachs",
  "Oncorhynchus nerka": "Rotlachs",
  "Oncorhynchus keta": "Ketalachs",
  "Coregonus lavaretus": "Felchen",
  "Coregonus maraena": "Große Maräne",
  "Coregonus albula": "Kleine Maräne",
  "Osmerus eperlanus": "Stint",
  "Thymallus arcticus": "Arktische Äsche",
  "Micropterus salmoides": "Forellenbarsch",
  "Micropterus dolomieu": "Schwarzbarsch",
  "Ictalurus punctatus": "Katzenwels",
  "Ameiurus nebulosus": "Zwergwels",
  "Ameiurus melas": "Schwarzer Zwergwels",
  "Lepomis gibbosus": "Sonnenbarsch",
  "Morone saxatilis": "Streifenbarsch",
  "Pomoxis annularis": "Weißer Crappie",
  "Pomoxis nigromaculatus": "Schwarzer Crappie",
  "Esox masquinongy": "Maskinonge",
  "Sander canadensis": "Amerikanischer Zander",
  "Perca flavescens": "Gelbbarsch",
  "Rutilus pigus": "Frauennerfling",
  "Leuciscus leuciscus": "Hasel",
  "Leuciscus idus": "Aland",
  "Alburnus alburnus": "Ukelei",
  "Gobio gobio": "Gründling",
  "Phoxinus phoxinus": "Elritze",
  "Rhodeus amarus": "Bitterling",
  "Misgurnus fossilis": "Schlammpeitzger",
  "Cobitis taenia": "Steinbeißer",
  "Barbatula barbatula": "Bachschmerle",
  "Cottus gobio": "Groppe",
  "Pungitius pungitius": "Neunstachliger Stichling",
  "Gasterosteus aculeatus": "Dreistachliger Stichling",
  "Lota lota": "Quappe",
  "Carassius carassius": "Karausche",
  "Carassius gibelio": "Giebel",
  "Hypophthalmichthys molitrix": "Silberkarpfen",
  "Hypophthalmichthys nobilis": "Marmorkarpfen",
  "Mylopharyngodon piceus": "Schwarzer Amur",
  "Pseudorasbora parva": "Blaubandbärbling",
  "Romanogobio belingi": "Weißflossengründling",
  "Chondrostoma nasus": "Nase",
  "Vimba vimba": "Zährte",
  "Blicca bjoerkna": "Güster",
  "Leucaspius delineatus": "Moderlieschen",
  "Scardinius erythrophthalmus": "Rotfeder",
  "Abramis ballerus": "Zope",
  "Abramis sapa": "Zobel",
  "Pelecus cultratus": "Sichel",
  "Cyprinus rubrofuscus": "Amurkarpfen",
  "Acipenser naccarii": "Adriatischer Stör",
  "Acipenser stellatus": "Sternhausen",
  "Acipenser oxyrinchus": "Atlantischer Stör",
  "Huso huso": "Beluga-Stör",
  "Dicentrarchus labrax": "Europäischer Wolfsbarsch",
  "Sparus aurata": "Goldbrasse",
  "Mugil cephalus": "Meeräsche",
  "Platichthys flesus": "Flunder",
  "Pleuronectes platessa": "Scholle",
  "Gadus morhua": "Kabeljau",
  "Pollachius virens": "Köhler",
  "Merlangius merlangus": "Wittling",
  "Scomber scombrus": "Atlantische Makrele",
  "Clupea harengus": "Atlantischer Hering",
  "Alosa alosa": "Maifisch",
  "Alosa fallax": "Finte",
  "Petromyzon marinus": "Meerneunauge",
  "Lampetra fluviatilis": "Flussneunauge",
  "Lampetra planeri": "Bachneunauge",
  "Salmo marmoratus": "Marmorierte Forelle",
  "Oncorhynchus clarkii": "Cutthroat-Forelle",
  "Ambloplites rupestris": "Steinbarsch",
  "Lota lota": "Quappe",
  "Gasterosteus aculeatus": "Dreistachliger Stichling",
  "Acipenser sturio": "Europäischer Stör",
  "Acipenser ruthenus": "Sterlet",
  "Acipenser baerii": "Sibirischer Stör",
  "Acipenser gueldenstaedtii": "Russischer Stör",
  "Acipenser transmontanus": "Weißer Stör",
  "Acipenser fulvescens": "Amerikanischer See-Stör",
});

function normalizeScientificName(scientificName) {
  if (typeof scientificName !== "string") return null;
  const normalized = scientificName.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
  return normalized || null;
}

const GERMAN_NAMES_BY_NORMALIZED_SCIENTIFIC_NAME = Object.freeze(
  Object.fromEntries(Object.entries(GERMAN_NAMES_BY_SCIENTIFIC_NAME).map(([name, localizedName]) => [normalizeScientificName(name), localizedName])),
);

function getGermanFishName(scientificName) {
  const normalizedScientificName = normalizeScientificName(scientificName);
  return normalizedScientificName ? GERMAN_NAMES_BY_NORMALIZED_SCIENTIFIC_NAME[normalizedScientificName] || null : null;
}

function localizeCandidate(candidate) {
  const normalizedCommonName = typeof candidate.commonName === "string"
    ? candidate.commonName.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
    : "";
  // A cutbow is a hybrid, not a synonym for rainbow trout.
  if (normalizedCommonName === "cutbow trout") {
    return { ...candidate, localizedName: null, displayName: candidate.commonName };
  }

  const localizedName = getGermanFishName(candidate.scientificName);
  const displayName = normalizedCommonName === "mirror carp" && normalizeScientificName(candidate.scientificName) === "cyprinus carpio"
    ? "Spiegelkarpfen (Karpfen)"
    : localizedName;
  return {
    ...candidate,
    localizedName,
    displayName,
  };
}

module.exports = { GERMAN_NAMES_BY_SCIENTIFIC_NAME, getGermanFishName, localizeCandidate, normalizeScientificName };
