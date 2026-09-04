const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const homeScreen = document.getElementById("home-screen");
const previewScreen = document.getElementById("preview-screen");
const resultScreen = document.getElementById("result-screen");
const previewImage = document.getElementById("preview-image");
const infoBanner = document.getElementById("info-banner");
const errorBanner = document.getElementById("error-banner");
const cameraInput = document.getElementById("camera-input");
const galleryInput = document.getElementById("gallery-input");
const analyzeButton = document.getElementById("btn-analyze");
const installButton = document.getElementById("btn-install");
const resultTitle = document.getElementById("result-title");
const resultScientificName = document.getElementById("result-scientific-name");
const resultOriginalName = document.getElementById("result-original-name");
const resultConfidence = document.getElementById("result-confidence");
const confidenceMeter = document.querySelector(".confidence-meter");
const confidenceBar = document.getElementById("confidence-bar");
const resultConfidenceLevel = document.getElementById("result-confidence-level");
const resultMessage = document.getElementById("result-message");
const resultGuidance = document.getElementById("result-guidance");
const secondOpinionNotice = document.getElementById("second-opinion-notice");
const secondOpinionSection = document.getElementById("second-opinion-section");
const secondOpinionMessage = document.getElementById("second-opinion-message");
const secondOpinionPrimarySpecies = document.getElementById("second-opinion-primary-species");
const secondOpinionSpecies = document.getElementById("second-opinion-species");
const secondOpinionReasoning = document.getElementById("second-opinion-reasoning");
const secondOpinionUnavailable = document.getElementById("second-opinion-unavailable");
const speciesInfoSection = document.getElementById("species-info-section");
const speciesInfoUnavailable = document.getElementById("species-info-unavailable");
const speciesFields = {
  description: document.getElementById("species-description"),
  habitat: document.getElementById("species-habitat"),
  diet: document.getElementById("species-diet"),
  typicalSize: document.getElementById("species-typical-size"),
  maximumSize: document.getElementById("species-maximum-size"),
};
const speciesIdentificationFeatures = document.getElementById("species-identification-features");
const alternativesSection = document.getElementById("alternatives-section");
const alternativesList = document.getElementById("alternatives-list");
const catchbookScreen = document.getElementById("catchbook-screen");
const catchFormScreen = document.getElementById("catch-form-screen");
const catchDetailScreen = document.getElementById("catch-detail-screen");
const saveCatchButton = document.getElementById("btn-save-catch");
const catchList = document.getElementById("catch-list");
const catchbookEmpty = document.getElementById("catchbook-empty");
const catchbookError = document.getElementById("catchbook-error");
const catchbookSuccess = document.getElementById("catchbook-success");
const catchForm = document.getElementById("catch-form");
const catchFormError = document.getElementById("catch-form-error");
const catchSpeciesChoice = document.getElementById("catch-species-choice");
const catchSpeciesOptions = document.getElementById("catch-species-options");
const catchPendingNote = document.getElementById("catch-pending-note");
const catchFormImage = document.getElementById("catch-form-image");
const catchDetailImage = document.getElementById("catch-detail-image");
const catchDetailTitle = document.getElementById("catch-detail-title");
const catchDetailScientific = document.getElementById("catch-detail-scientific");
const catchDetailData = document.getElementById("catch-detail-data");
const catchIdentification = document.getElementById("catch-identification");
const catchIdentificationData = document.getElementById("catch-identification-data");
const deleteCatchDialog = document.getElementById("delete-catch-dialog");
const statisticsScreen = document.getElementById("statistics-screen");
const speciesScreen = document.getElementById("species-screen");
const catchSummary = document.getElementById("catch-summary");
const catchSummaryValues = document.getElementById("catch-summary-values");
const speciesSearch = document.getElementById("species-search");
const speciesList = document.getElementById("species-list");
const speciesEmpty = document.getElementById("species-empty");
const speciesDetail = document.getElementById("species-detail");
const watersScreen = document.getElementById("waters-screen");
const waterFormScreen = document.getElementById("water-form-screen");
const watersList = document.getElementById("waters-list");
const watersEmpty = document.getElementById("waters-empty");
const watersError = document.getElementById("waters-error");
const waterForm = document.getElementById("water-form");
const waterFormError = document.getElementById("water-form-error");
const deleteWaterDialog = document.getElementById("delete-water-dialog");
const waterDetailScreen = document.getElementById("water-detail-screen");
const waterDetailData = document.getElementById("water-detail-data");
const waterDetailStats = document.getElementById("water-detail-stats");
const waterCatchesList = document.getElementById("water-catches-list");
const locationStatus = document.getElementById("location-status");
const infoScreen = document.getElementById("info-screen");
const updateBanner = document.getElementById("update-banner");
const removeLocationButton = document.getElementById("btn-remove-location");

let selectedFile = null;
let previewObjectUrl = null;
let activeAnalysisId = null;
let analysisGeneration = 0;
let deferredInstallPrompt = null;
let latestAnalysis = null;
let selectedCatch = null;
let editingCatch = null;
let catchDetailImageUrl = null;
let catchFormImageUrl = null;
let catchbookSuccessTimer = null;
let speciesCatalog = null;
let pendingBackupRecords = null;
let editingWater = null;
let deletingWater = null;
let selectedWater = null;
let pendingLocation = null;
const catchStore = new CatchStore.IndexedDbCatchStore();
const waterStore = new WaterStore.IndexedDbWaterStore();
const localBackupStore = new LocalBackupStore.IndexedDbLocalBackupStore();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.register("/service-worker.js").then((registration) => {
      registration.addEventListener("updatefound", () => { const worker = registration.installing; worker?.addEventListener("statechange", () => { if (worker.state === "installed" && hadController) updateBanner.classList.remove("hidden"); }); });
    }).catch(() => {
      // Die App funktioniert auch ohne Service Worker weiter.
    });
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.classList.remove("hidden");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.classList.add("hidden");
});

function showHome() {
  infoScreen.classList.add("hidden"); infoScreen.setAttribute("aria-hidden", "true");
  watersScreen.classList.add("hidden"); waterFormScreen.classList.add("hidden");
  statisticsScreen.classList.add("hidden");
  speciesScreen.classList.add("hidden");
  catchbookScreen.classList.add("hidden");
  catchFormScreen.classList.add("hidden");
  catchDetailScreen.classList.add("hidden");
  previewScreen.classList.add("hidden");
  previewScreen.setAttribute("aria-hidden", "true");
  resultScreen.classList.add("hidden");
  resultScreen.setAttribute("aria-hidden", "true");
  homeScreen.classList.remove("hidden");
  homeScreen.removeAttribute("aria-hidden");
  setActiveNav("identify");
  homeScreen.focus();
}

function showPreview() {
  watersScreen.classList.add("hidden"); waterFormScreen.classList.add("hidden");
  statisticsScreen.classList.add("hidden");
  speciesScreen.classList.add("hidden");
  catchbookScreen.classList.add("hidden");
  catchFormScreen.classList.add("hidden");
  catchDetailScreen.classList.add("hidden");
  homeScreen.classList.add("hidden");
  homeScreen.setAttribute("aria-hidden", "true");
  resultScreen.classList.add("hidden");
  resultScreen.setAttribute("aria-hidden", "true");
  previewScreen.classList.remove("hidden");
  previewScreen.removeAttribute("aria-hidden");
  setActiveNav("identify");
  previewScreen.focus();
}

function showResult() {
  watersScreen.classList.add("hidden"); waterFormScreen.classList.add("hidden");
  statisticsScreen.classList.add("hidden");
  speciesScreen.classList.add("hidden");
  catchbookScreen.classList.add("hidden");
  catchFormScreen.classList.add("hidden");
  catchDetailScreen.classList.add("hidden");
  previewScreen.classList.add("hidden");
  previewScreen.setAttribute("aria-hidden", "true");
  resultScreen.classList.remove("hidden");
  resultScreen.removeAttribute("aria-hidden");
  setActiveNav("identify");
  resultScreen.focus();
  requestAnimationFrame(() => resultScreen.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function clearPreviewObjectUrl() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove("hidden");
}

function clearError() {
  errorBanner.textContent = "";
  errorBanner.classList.add("hidden");
}

function validateImageFile(file) {
  if (!file) return "Es wurde kein Bild ausgewählt.";
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return "Bitte wähle ein JPG-, PNG- oder unterstütztes Bild aus.";
  }
  if (file.size === 0) return "Das ausgewählte Bild ist leer oder beschädigt.";
  if (file.size > MAX_IMAGE_SIZE_BYTES) return "Das Bild ist zu groß. Bitte wähle ein Bild mit höchstens 10 MB aus.";
  return null;
}

function openFileDialog(input) {
  clearError();
  input.value = "";
  input.click();
}

function handleFileSelected(file) {
  const validationError = validateImageFile(file);
  if (validationError) {
    showError(validationError);
    return;
  }

  analysisGeneration += 1;
  activeAnalysisId = null;
  latestAnalysis = null;
  clearPreviewObjectUrl();
  selectedFile = file;
  previewObjectUrl = URL.createObjectURL(file);
  previewImage.src = previewObjectUrl;
  infoBanner.classList.add("hidden");
  showPreview();
}

function resetSelection() {
  clearPreviewObjectUrl();
  selectedFile = null;
  previewImage.removeAttribute("src");
  cameraInput.value = "";
  galleryInput.value = "";
  infoBanner.textContent = "";
  infoBanner.classList.add("hidden");
}

function formatConfidence(confidence) {
  return Number.isFinite(confidence) ? `${Math.round(confidence * 100)} %` : null;
}

function candidateName(candidate) {
  return candidate.displayName || candidate.localizedName || candidate.commonName || candidate.scientificName || "Nicht benannte Art";
}

function renderAlternative(candidate) {
  const item = document.createElement("li");
  const name = document.createElement("span");
  const details = document.createElement("span");
  name.className = "alternative-name";
  details.className = "alternative-details";
  name.textContent = candidateName(candidate);
  const detailsParts = [candidate.scientificName, formatConfidence(candidate.confidence)].filter(Boolean);
  details.textContent = detailsParts.join(" · ");
  item.append(name, details);
  return item;
}

function renderResult(result) {
  const primary = result.primary;
  resultTitle.textContent = primary ? candidateName(primary) : "Keine Art bestimmt";
  resultScientificName.textContent = primary?.scientificName || "";
  resultScientificName.classList.toggle("hidden", !primary?.scientificName);

  const showOriginalName = primary?.localizedName && primary?.commonName && primary.localizedName !== primary.commonName;
  resultOriginalName.textContent = showOriginalName ? `Fishial: ${primary.commonName}` : "";
  resultOriginalName.classList.toggle("hidden", !showOriginalName);

  const confidence = primary ? formatConfidence(primary.confidence) : null;
  resultConfidence.textContent = confidence || "";
  resultConfidence.classList.toggle("hidden", !confidence);
  const confidencePercent = Number.isFinite(primary?.confidence) ? Math.round(primary.confidence * 100) : 0;
  confidenceBar.style.width = `${confidencePercent}%`;
  confidenceMeter.setAttribute("aria-valuenow", String(confidencePercent));
  resultConfidenceLevel.textContent = primary?.confidenceLabel || "";
  resultConfidenceLevel.classList.toggle("hidden", !primary?.confidenceLabel);
  resultMessage.textContent = result.message;
  resultGuidance.textContent = result.guidance || "";
  resultGuidance.classList.toggle("hidden", !result.guidance);
  const secondOpinionPending = result.secondOpinionStatus === "pending";
  secondOpinionNotice.textContent = "Zweite KI prüft die Bestimmung …";
  secondOpinionNotice.classList.toggle("hidden", !secondOpinionPending);
  const secondOpinion = result.secondOpinion;
  const consensus = result.consensus;
  secondOpinionMessage.textContent = consensus?.message || "";
  const secondOpinionName = secondOpinion ? candidateName(secondOpinion) : "";
  const hasDisagreement = consensus?.status === "disagreement";
  secondOpinionPrimarySpecies.textContent = hasDisagreement && primary ? `Primäre KI: ${candidateName(primary)}${primary.scientificName ? ` (${primary.scientificName})` : ""}` : "";
  secondOpinionPrimarySpecies.classList.toggle("hidden", !hasDisagreement || !primary);
  secondOpinionSpecies.textContent = secondOpinionName ? `Zweite Einschätzung: ${secondOpinionName}${secondOpinion.scientificName ? ` (${secondOpinion.scientificName})` : ""}` : "";
  secondOpinionSpecies.classList.toggle("hidden", !secondOpinionName);
  secondOpinionReasoning.textContent = secondOpinion?.reasoningSummary || "";
  secondOpinionReasoning.classList.toggle("hidden", !secondOpinion?.reasoningSummary);
  secondOpinionSection.classList.toggle("hidden", !secondOpinion || !consensus);
  if (result.secondOpinionStatus === "rate_limited") {
    secondOpinionUnavailable.textContent = "Die zweite KI-Analyse ist momentan ausgelastet. Das Ergebnis der primären Fischbestimmung wird weiterhin angezeigt.";
  } else {
    secondOpinionUnavailable.textContent = "Die zweite KI-Analyse war derzeit nicht verfügbar.";
  }
  secondOpinionUnavailable.classList.toggle("hidden", !result.secondOpinionUnavailable);

  const speciesInfo = primary?.speciesInfo;
  for (const [field, element] of Object.entries(speciesFields)) element.textContent = speciesInfo?.[field] || "";
  speciesIdentificationFeatures.replaceChildren();
  if (speciesInfo) {
    for (const feature of speciesInfo.identificationFeatures || []) {
      const item = document.createElement("li");
      item.textContent = feature;
      speciesIdentificationFeatures.append(item);
    }
  }
  speciesInfoSection.classList.toggle("hidden", !speciesInfo);
  speciesInfoUnavailable.classList.toggle("hidden", Boolean(speciesInfo) || !primary);

  alternativesList.replaceChildren();
  const alternatives = Array.isArray(result.alternatives) ? result.alternatives : [];
  alternatives.forEach((candidate) => alternativesList.append(renderAlternative(candidate)));
  alternativesSection.classList.toggle("hidden", alternatives.length === 0);
  saveCatchButton.classList.toggle("hidden", !primary);
}

const catchListImageUrls = [];

function setActiveNav(section) {
  document.getElementById("nav-identify").classList.toggle("is-active", section === "identify");
  document.getElementById("nav-catchbook").classList.toggle("is-active", section === "catchbook");
  document.getElementById("nav-species").classList.toggle("is-active", section === "species");
}

function hideAllScreens() {
  for (const screen of [homeScreen, previewScreen, resultScreen, catchbookScreen, catchFormScreen, catchDetailScreen, statisticsScreen, speciesScreen, watersScreen, waterFormScreen, waterDetailScreen, infoScreen]) {
    screen.classList.add("hidden");
    screen.setAttribute("aria-hidden", "true");
  }
}

function showCatchbook({ saved = false } = {}) {
  hideAllScreens();
  catchbookScreen.classList.remove("hidden");
  catchbookScreen.removeAttribute("aria-hidden");
  setActiveNav("catchbook");
  catchbookSuccess.classList.toggle("hidden", !saved);
  if (catchbookSuccessTimer) clearTimeout(catchbookSuccessTimer);
  if (saved) catchbookSuccessTimer = setTimeout(() => catchbookSuccess.classList.add("hidden"), 3_500);
  renderCatchbook();
  catchbookScreen.focus();
}

function localDateTimeParts() {
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

function formatCatchDate(catchRecord) {
  const [year, month, day] = catchRecord.caughtDate.split("-");
  return `${day}.${month}.${year}`;
}

function formatGermanNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits }).format(value);
}

function formatLength(lengthCm) {
  return lengthCm ? `${formatGermanNumber(lengthCm, 1)} cm` : "";
}

function formatWeight(weightGrams) {
  return CatchStore.formatWeight(weightGrams);
}

function clearCatchListImageUrls() {
  while (catchListImageUrls.length) URL.revokeObjectURL(catchListImageUrls.pop());
}

function showCatchbookError(message) {
  catchbookError.textContent = message;
  catchbookError.classList.remove("hidden");
}

async function renderCatchbook() {
  catchbookError.classList.add("hidden");
  catchList.replaceChildren();
  clearCatchListImageUrls();
  try {
    const catches = await catchStore.list();
    catchbookEmpty.classList.toggle("hidden", catches.length !== 0);
    const stats = CatchStatistics.calculateCatchStatistics(catches);
    catchSummary.classList.toggle("hidden", catches.length === 0);
    catchSummaryValues.textContent = [
      `${stats.total} ${stats.total === 1 ? "Fang" : "Fänge"}`,
      `${stats.speciesCount} ${stats.speciesCount === 1 ? "Art" : "Arten"}`,
      stats.longest ? `Längster: ${formatLength(stats.longest.value)}` : "",
      stats.heaviest ? `Schwerster: ${formatWeight(stats.heaviest.value)}` : "",
    ].filter(Boolean).join(" · ");
    for (const catchRecord of catches) {
      const item = document.createElement("li");
      const card = document.createElement("button");
      card.type = "button";
      card.className = "catch-card";
      card.addEventListener("click", () => showCatchDetail(catchRecord.id));
      if (catchRecord.imageBlob) {
        const image = document.createElement("img");
        const imageUrl = URL.createObjectURL(catchRecord.imageBlob);
        catchListImageUrls.push(imageUrl);
        image.className = "catch-thumbnail";
        image.src = imageUrl;
        image.alt = `Fangfoto: ${catchRecord.speciesName}`;
        card.append(image);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "catch-thumbnail-placeholder";
        placeholder.textContent = "🐟";
        placeholder.setAttribute("aria-hidden", "true");
        card.append(placeholder);
      }
      const content = document.createElement("div");
      content.className = "catch-card-content";
      const title = document.createElement("h2");
      title.className = "catch-card-title";
      title.textContent = catchRecord.speciesName;
      const date = document.createElement("p");
      date.className = "catch-card-date";
      date.textContent = formatCatchDate(catchRecord);
      const meta = document.createElement("p");
      meta.className = "catch-card-meta";
      meta.textContent = [formatLength(catchRecord.lengthCm), formatWeight(catchRecord.weightGrams), catchRecord.waterNameSnapshot || catchRecord.waterName].filter(Boolean).join(" · ");
      content.append(title, date, meta);
      card.append(content);
      item.append(card);
      catchList.append(item);
    }
  } catch {
    showCatchbookError("Das Fangbuch konnte auf diesem Gerät nicht geladen werden.");
  }
}

function clearCatchDetailImage() {
  if (catchDetailImageUrl) URL.revokeObjectURL(catchDetailImageUrl);
  catchDetailImageUrl = null;
  catchDetailImage.removeAttribute("src");
  catchDetailImage.classList.add("hidden");
}

function setCatchFormImage(imageBlob) {
  if (catchFormImageUrl) URL.revokeObjectURL(catchFormImageUrl);
  catchFormImageUrl = null;
  catchFormImage.removeAttribute("src");
  catchFormImage.classList.add("hidden");
  if (imageBlob) {
    catchFormImageUrl = URL.createObjectURL(imageBlob);
    catchFormImage.src = catchFormImageUrl;
    catchFormImage.classList.remove("hidden");
  }
}

function appendDetail(label, value) {
  if (!value) return;
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value;
  row.append(term, description);
  catchDetailData.append(row);
}

async function showCatchDetail(id) {
  try {
    const catchRecord = await catchStore.get(id);
    if (!catchRecord) return showCatchbook();
    selectedCatch = catchRecord;
    hideAllScreens();
    catchDetailScreen.classList.remove("hidden");
    catchDetailScreen.removeAttribute("aria-hidden");
    setActiveNav("catchbook");
    clearCatchDetailImage();
    if (catchRecord.imageBlob) {
      catchDetailImageUrl = URL.createObjectURL(catchRecord.imageBlob);
      catchDetailImage.src = catchDetailImageUrl;
      catchDetailImage.classList.remove("hidden");
    }
    catchDetailTitle.textContent = catchRecord.speciesName;
    catchDetailScientific.textContent = catchRecord.scientificName || "";
    catchDetailScientific.classList.toggle("hidden", !catchRecord.scientificName);
    catchDetailData.replaceChildren();
    appendDetail("Datum", formatCatchDate(catchRecord));
    appendDetail("Uhrzeit", catchRecord.caughtTime);
    appendDetail("Länge", formatLength(catchRecord.lengthCm));
    appendDetail("Gewicht", formatWeight(catchRecord.weightGrams));
    appendDetail("Gewässer", catchRecord.waterNameSnapshot || catchRecord.waterName);
    appendDetail("Notiz", catchRecord.note);
    if (catchRecord.location) {
      const { latitude, longitude, accuracy } = catchRecord.location;
      appendDetail("Standort", `${Math.abs(latitude).toLocaleString("de-DE",{maximumFractionDigits:5})}° ${latitude < 0 ? "S" : "N"} · ${Math.abs(longitude).toLocaleString("de-DE",{maximumFractionDigits:5})}° ${longitude < 0 ? "W" : "E"}${accuracy !== null ? ` · Genauigkeit ca. ${Math.round(accuracy)} m` : ""}`);
    }
    const identification = catchRecord.identification;
    if (identification?.primarySpecies) {
      const lines = [`Primäre KI: ${identification.primarySpecies}`, identification.primaryConfidence !== null && identification.primaryConfidence !== undefined ? `Sicherheit: ${Math.round(identification.primaryConfidence * 100)} %` : ""];
      if (identification.secondOpinionSpecies) lines.push(`Zweite KI: ${identification.secondOpinionSpecies}`);
      if (identification.consensusType) lines.push(`Ergebnis: ${identification.consensusType}`);
      catchIdentificationData.textContent = lines.filter(Boolean).join("\n");
      catchIdentification.classList.remove("hidden");
    } else {
      catchIdentification.classList.add("hidden");
    }
    catchDetailScreen.focus();
  } catch {
    showCatchbookError("Der Fang konnte nicht geladen werden.");
    showCatchbook();
  }
}

function setCatchFormError(message = "") {
  catchFormError.textContent = message;
  catchFormError.classList.toggle("hidden", !message);
}

function setSpeciesFields(candidate) {
  catchForm.elements.speciesName.value = candidateName(candidate);
  catchForm.elements.scientificName.value = candidate.scientificName || "";
}

function identificationFromResult(result) {
  return {
    primarySpecies: result.primary ? candidateName(result.primary) : "",
    primaryScientificName: result.primary?.scientificName || "",
    primaryConfidence: result.primary?.confidence ?? null,
    secondOpinionSpecies: result.secondOpinion ? candidateName(result.secondOpinion) : "",
    secondOpinionScientificName: result.secondOpinion?.scientificName || "",
    consensusType: result.consensus?.status || null,
  };
}

function addSpeciesOption(candidate, label, checked) {
  const option = document.createElement("label");
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "speciesChoice";
  radio.checked = checked;
  radio.addEventListener("change", () => setSpeciesFields(candidate));
  const text = document.createElement("span");
  text.textContent = `${label}: ${candidateName(candidate)}${candidate.scientificName ? ` (${candidate.scientificName})` : ""}`;
  option.append(radio, text);
  catchSpeciesOptions.append(option);
}

async function fillWaterOptions(record = null) {
  const select = catchForm.elements.waterId;
  select.replaceChildren(new Option("Kein Gewässer", ""));
  const waters = await waterStore.list();
  waters.forEach((water) => select.add(new Option(`${water.name} · ${water.type}`, water.id)));
  if (record?.waterId && !waters.some((water) => water.id === record.waterId)) {
    select.add(new Option(`${record.waterNameSnapshot || record.waterName} (gelöscht)`, record.waterId));
  } else if (!record?.waterId && (record?.waterNameSnapshot || record?.waterName)) {
    select.add(new Option(`${record.waterNameSnapshot || record.waterName} (alter Eintrag)`, "legacy"));
  }
  select.value = record?.waterId || ((record?.waterNameSnapshot || record?.waterName) ? "legacy" : "");
}

async function openCatchForm(record = null) {
  editingCatch = record;
  catchForm.reset();
  setCatchFormError();
  catchSpeciesOptions.replaceChildren();
  const isEditing = Boolean(record);
  document.getElementById("catch-form-eyebrow").textContent = isEditing ? "Fang bearbeiten" : "Fang speichern";
  document.getElementById("catch-form-title").textContent = isEditing ? "Fang bearbeiten" : "Fang speichern";
  catchSpeciesChoice.classList.add("hidden");
  catchPendingNote.classList.add("hidden");
  pendingLocation = record?.location || null;
  locationStatus.textContent = pendingLocation ? "Standort gespeichert ✓" : "";
  removeLocationButton.classList.toggle("hidden", !pendingLocation);
  setCatchFormImage(isEditing ? record.imageBlob : latestAnalysis?.imageBlob);
  if (isEditing) {
    for (const [key, value] of Object.entries({ speciesName: record.speciesName, scientificName: record.scientificName, caughtDate: record.caughtDate, caughtTime: record.caughtTime, lengthCm: record.lengthCm ?? "", note: record.note })) catchForm.elements[key].value = value;
    const weightInput = CatchStore.weightInputFromGrams(record.weightGrams);
    catchForm.elements.weightInput.value = weightInput.value;
    catchForm.elements.weightUnit.value = weightInput.unit;
  } else if (latestAnalysis?.result?.primary) {
    const result = latestAnalysis.result;
    setSpeciesFields(result.primary);
    catchPendingNote.classList.toggle("hidden", result.secondOpinionStatus !== "pending");
    if (result.consensus?.status === "disagreement" && result.secondOpinion) {
      catchSpeciesChoice.classList.remove("hidden");
      addSpeciesOption(result.primary, "Primäre Bestimmung", true);
      addSpeciesOption(result.secondOpinion, "Zweite KI-Einschätzung", false);
    }
    const now = localDateTimeParts();
    catchForm.elements.caughtDate.value = now.date;
    catchForm.elements.caughtTime.value = now.time;
  } else {
    return;
  }
  try { await fillWaterOptions(record); } catch { setCatchFormError("Die Gewässer konnten nicht geladen werden."); }
  hideAllScreens();
  catchFormScreen.classList.remove("hidden");
  catchFormScreen.removeAttribute("aria-hidden");
  setActiveNav("catchbook");
  catchFormScreen.focus();
}

async function showWaters() {
  hideAllScreens(); watersScreen.classList.remove("hidden"); watersScreen.removeAttribute("aria-hidden"); setActiveNav("catchbook");
  watersList.replaceChildren(); watersError.classList.add("hidden");
  try {
    const [waters, catches] = await Promise.all([waterStore.list(), catchStore.list()]);
    watersEmpty.classList.toggle("hidden", waters.length !== 0);
    for (const water of waters) {
      const item = document.createElement("li"); const card = document.createElement("article"); card.className = "water-card";
      const title = document.createElement("h2"); title.textContent = water.name;
      const details = document.createElement("p"); details.textContent = [water.type, water.region].filter(Boolean).join(" · ");
      const count = catches.filter((entry) => entry.waterId === water.id).length;
      const usage = document.createElement("p"); usage.textContent = `${count} ${count === 1 ? "zugeordneter Fang" : "zugeordnete Fänge"}`;
      const actions = document.createElement("div"); actions.className = "inline-actions";
      const edit = document.createElement("button"); edit.type = "button"; edit.className = "btn btn-secondary"; edit.textContent = "Öffnen"; edit.addEventListener("click", () => showWaterDetail(water.id));
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "btn btn-text danger-button"; remove.textContent = "Löschen"; remove.addEventListener("click", () => { deletingWater = water; deleteWaterDialog.showModal(); });
      actions.append(edit, remove); card.append(title, details, usage, actions); item.append(card); watersList.append(item);
    }
  } catch { watersError.textContent = "Die Gewässer konnten nicht geladen werden."; watersError.classList.remove("hidden"); }
  watersScreen.focus();
}

async function showWaterDetail(id) {
  const [water, allCatches] = await Promise.all([waterStore.get(id), catchStore.list()]); if (!water) return showWaters(); selectedWater = water;
  const catches = allCatches.filter(item => item.waterId === id); const stats = CatchStatistics.summarizeWater(catches);
  hideAllScreens(); waterDetailScreen.classList.remove("hidden"); waterDetailScreen.removeAttribute("aria-hidden"); setActiveNav("catchbook");
  document.getElementById("water-detail-title").textContent = water.name; waterDetailData.replaceChildren(); waterDetailStats.replaceChildren();
  const add=(target,label,value)=>{const row=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=label;dd.textContent=value||"–";row.append(dt,dd);target.append(row);};
  add(waterDetailData,"Gewässertyp",water.type); add(waterDetailData,"Region",water.region); add(waterDetailData,"Notiz",water.note);
  add(waterDetailStats,"Anzahl Fänge",String(stats.count)); add(waterDetailStats,"Unterschiedliche Fischarten",String(stats.speciesCount)); add(waterDetailStats,"Längster Fang",stats.longest?`${stats.longest.item.speciesName} · ${formatLength(stats.longest.value)}`:"Kein Längenwert vorhanden"); add(waterDetailStats,"Schwerster Fang",stats.heaviest?`${stats.heaviest.item.speciesName} · ${formatWeight(stats.heaviest.value)}`:"Kein Gewichtswert vorhanden"); add(waterDetailStats,"Häufigste Fischart",stats.topSpecies?`${stats.topSpecies.name} · ${stats.topSpecies.count}`:"Noch keine Fischart");
  waterCatchesList.replaceChildren(); document.getElementById("water-catches-empty").classList.toggle("hidden",catches.length!==0);
  for(const record of catches){const li=document.createElement("li"),button=document.createElement("button");button.type="button";button.className="catch-card";button.addEventListener("click",()=>showCatchDetail(record.id));const placeholder=document.createElement("div");placeholder.className="catch-thumbnail-placeholder";placeholder.textContent="🐟";if(record.imageBlob){const image=document.createElement("img");image.className="catch-thumbnail";image.src=URL.createObjectURL(record.imageBlob);catchListImageUrls.push(image.src);button.append(image);}else button.append(placeholder);const content=document.createElement("div");content.className="catch-card-content";const title=document.createElement("h2");title.className="catch-card-title";title.textContent=record.speciesName;const meta=document.createElement("p");meta.className="catch-card-meta";meta.textContent=[formatCatchDate(record),formatLength(record.lengthCm),formatWeight(record.weightGrams)].filter(Boolean).join(" · ");content.append(title,meta);button.append(content);li.append(button);waterCatchesList.append(li);}
  waterDetailScreen.focus();
}

function openWaterForm(water = null) {
  editingWater = water; waterForm.reset(); waterFormError.classList.add("hidden");
  document.getElementById("water-form-title").textContent = water ? "Gewässer bearbeiten" : "Gewässer hinzufügen";
  const typeSelect = waterForm.elements.type; typeSelect.replaceChildren(); WaterStore.TYPES.forEach((type) => typeSelect.add(new Option(type, type)));
  if (water) for (const key of ["name", "type", "region", "note"]) waterForm.elements[key].value = water[key] || "";
  hideAllScreens(); waterFormScreen.classList.remove("hidden"); waterFormScreen.removeAttribute("aria-hidden"); setActiveNav("catchbook"); waterFormScreen.focus();
}

function makeHeading(title) { const heading = document.createElement("h2"); heading.textContent = title; return heading; }
function makeList(items) { const list = document.createElement("ul"); list.className = "stat-list"; for (const [left, right] of items) { const row = document.createElement("li"); const a = document.createElement("span"); const b = document.createElement("strong"); a.textContent = left; b.textContent = right; row.append(a, b); list.append(row); } return list; }

async function showStatistics() {
  hideAllScreens(); statisticsScreen.classList.remove("hidden"); statisticsScreen.removeAttribute("aria-hidden"); setActiveNav("catchbook");
  const sections = ["statistics-overview", "statistics-records", "statistics-species", "statistics-activity", "statistics-waters"].map((id) => document.getElementById(id));
  sections.forEach((section) => section.replaceChildren());
  const [statisticsCatches, statisticsWaters] = await Promise.all([catchStore.list(), waterStore.list()]);
  const stats = CatchStatistics.calculateCatchStatistics(statisticsCatches, undefined, statisticsWaters);
  sections[0].append(makeHeading("Übersicht"), makeList([["Gespeicherte Fänge", stats.total], ["Unterschiedliche Arten", stats.speciesCount], ["Dokumentiertes Gewicht", formatWeight(stats.totalWeightGrams) || "–"], ["Durchschnittliche Länge", stats.averageLengthCm ? formatLength(stats.averageLengthCm) : "–"], ["Durchschnittliches Gewicht", stats.averageWeightGrams ? formatWeight(Math.round(stats.averageWeightGrams)) : "–"]]));
  const recordText = (record, unit) => record ? `${record.item.speciesName} · ${unit(record.value)} · ${formatCatchDate(record.item)}` : "Noch kein Rekord";
  sections[1].append(makeHeading("Deine Rekorde"), makeList([["Längster Fang", recordText(stats.longest, formatLength)], ["Schwerster Fang", recordText(stats.heaviest, formatWeight)]]));
  sections[2].append(makeHeading("Am häufigsten gefangen"), stats.topSpecies.length ? makeList(stats.topSpecies.map((entry) => [entry.name, entry.count])) : document.createTextNode("Noch keine Fänge gespeichert."));
  sections[3].append(makeHeading("Aktivität der letzten 6 Monate"));
  const maximum = Math.max(1, ...stats.months.map((month) => month.count));
  for (const month of stats.months) { const row = document.createElement("div"); row.className = "activity-row"; const name = document.createElement("span"); const bar = document.createElement("div"); const fill = document.createElement("span"); const count = document.createElement("strong"); name.textContent = new Intl.DateTimeFormat("de-DE", { month: "long" }).format(month.date); fill.style.width = `${month.count / maximum * 100}%`; bar.className = "activity-bar"; count.textContent = month.count; bar.append(fill); row.append(name, bar, count); sections[3].append(row); }
  sections[4].append(makeHeading("Deine häufigsten Gewässer"), stats.topWaters.length ? makeList(stats.topWaters.map((entry) => [entry.name, `${entry.count} Fänge · ${entry.speciesCount} Arten`])) : document.createTextNode("Noch keine Gewässer dokumentiert."));
  statisticsScreen.focus();
}

async function loadSpeciesCatalog() {
  if (speciesCatalog) return speciesCatalog;
  const response = await fetch("/api/species");
  if (!response.ok) throw new Error("Das Artenlexikon ist derzeit nicht verfügbar.");
  const data = await response.json();
  speciesCatalog = Array.isArray(data.species) ? data.species : [];
  return speciesCatalog;
}

function renderSpeciesList(query = "") {
  const needle = query.trim().toLocaleLowerCase("de");
  const matches = (speciesCatalog || []).filter((species) => [species.germanName, species.scientificName].some((value) => value.toLocaleLowerCase("de").includes(needle)));
  speciesList.replaceChildren(); speciesDetail.classList.add("hidden"); speciesEmpty.classList.toggle("hidden", matches.length !== 0);
  for (const species of matches) { const card = document.createElement("button"); const title = document.createElement("h2"); const scientific = document.createElement("p"); card.type = "button"; card.className = "species-card"; title.textContent = species.germanName; scientific.textContent = [species.scientificName, species.typicalSize].filter(Boolean).join(" · "); card.append(title, scientific); card.addEventListener("click", () => showSpeciesDetail(species)); speciesList.append(card); }
}

function showSpeciesDetail(species) {
  speciesList.replaceChildren(); speciesEmpty.classList.add("hidden"); speciesDetail.replaceChildren(); speciesDetail.classList.remove("hidden");
  const title = document.createElement("h1"); const scientific = document.createElement("p"); title.textContent = species.germanName; scientific.className = "scientific-name"; scientific.textContent = species.scientificName; speciesDetail.append(title, scientific);
  for (const [label, value] of [["Beschreibung", species.description], ["Lebensraum", species.habitat], ["Nahrung", species.diet], ["Typische Größe", species.typicalSize], ["Maximalgröße", species.maximumSize]]) { if (value) { const heading = makeHeading(label); const text = document.createElement("p"); text.textContent = value; speciesDetail.append(heading, text); } }
  if (species.identificationFeatures?.length) { speciesDetail.append(makeHeading("Erkennungsmerkmale")); const list = document.createElement("ul"); species.identificationFeatures.forEach((feature) => { const item = document.createElement("li"); item.textContent = feature; list.append(item); }); speciesDetail.append(list); } else { const hint = document.createElement("p"); hint.textContent = "Für diese Fischart sind noch nicht alle Informationen hinterlegt."; speciesDetail.append(hint); }
  const back = document.createElement("button"); back.type = "button"; back.className = "btn btn-text"; back.textContent = "Zurück zur Artenübersicht"; back.addEventListener("click", () => renderSpeciesList(speciesSearch.value)); speciesDetail.append(back);
}

async function showSpecies() {
  hideAllScreens(); speciesScreen.classList.remove("hidden"); speciesScreen.removeAttribute("aria-hidden"); setActiveNav("species");
  try { await loadSpeciesCatalog(); renderSpeciesList(speciesSearch.value); } catch { speciesList.replaceChildren(); speciesEmpty.textContent = "Das Artenlexikon ist offline noch nicht verfügbar."; speciesEmpty.classList.remove("hidden"); }
  speciesScreen.focus();
}

async function requestSecondOpinion(analysisId, generation, primaryResult) {
  try {
    const response = await fetch(`/api/analyze/${encodeURIComponent(analysisId)}/second-opinion`, { method: "POST" });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) throw new Error("Die zweite KI-Analyse war derzeit nicht verfügbar.");
    if (generation !== analysisGeneration || analysisId !== activeAnalysisId) return;
    if (latestAnalysis) latestAnalysis.result = result;
    renderResult(result);
  } catch {
    if (generation !== analysisGeneration || analysisId !== activeAnalysisId) return;
    const failedResult = {
      ...primaryResult,
      secondOpinionStatus: "failed",
      secondOpinionUnavailable: true,
    };
    if (latestAnalysis) latestAnalysis.result = failedResult;
    renderResult(failedResult);
  }
}

document.getElementById("btn-camera").addEventListener("click", () => openFileDialog(cameraInput));
document.getElementById("btn-info").addEventListener("click", () => { hideAllScreens(); infoScreen.classList.remove("hidden"); infoScreen.removeAttribute("aria-hidden"); infoScreen.focus(); });
document.getElementById("btn-info-back").addEventListener("click", showHome);
document.getElementById("btn-reload-app").addEventListener("click", () => window.location.reload());
document.getElementById("btn-copy-feedback").addEventListener("click", async () => { const text=document.getElementById("feedback-text").value.trim(),status=document.getElementById("feedback-status");if(!text){status.textContent="Bitte schreibe zuerst eine Rückmeldung.";return;}try{await navigator.clipboard.writeText(text);status.textContent="Feedback kopiert ✓";}catch{status.textContent="Bitte markiere den Text und kopiere ihn manuell.";} });
document.getElementById("btn-gallery").addEventListener("click", () => openFileDialog(galleryInput));
document.getElementById("nav-identify").addEventListener("click", showHome);
document.getElementById("nav-catchbook").addEventListener("click", showCatchbook);
document.getElementById("nav-species").addEventListener("click", showSpecies);
document.getElementById("btn-show-statistics").addEventListener("click", showStatistics);
document.getElementById("btn-manage-waters").addEventListener("click", showWaters);
document.getElementById("btn-waters-back").addEventListener("click", showCatchbook);
document.getElementById("btn-add-water").addEventListener("click", () => openWaterForm());
document.getElementById("btn-water-cancel").addEventListener("click", showWaters);
document.getElementById("btn-water-detail-back").addEventListener("click", showWaters);
document.getElementById("btn-edit-water").addEventListener("click", () => selectedWater && openWaterForm(selectedWater));
document.getElementById("btn-use-location").addEventListener("click", () => {
  if (!window.isSecureContext) { locationStatus.textContent = "Für die Standortfunktion ist eine sichere Verbindung erforderlich."; return; }
  if (!navigator.geolocation) { locationStatus.textContent = "Dein Browser unterstützt die Standortfunktion nicht."; return; }
  locationStatus.textContent = "Standort wird ermittelt …";
  navigator.geolocation.getCurrentPosition(position => { pendingLocation={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,capturedAt:new Date(position.timestamp||Date.now()).toISOString()};locationStatus.textContent="Standort gespeichert ✓";removeLocationButton.classList.remove("hidden"); }, error => { locationStatus.textContent=error.code===1?"Standortzugriff wurde nicht erlaubt.":error.code===3?"Die Standortabfrage hat zu lange gedauert.":"Der Standort konnte nicht ermittelt werden."; }, {enableHighAccuracy:true,timeout:10000,maximumAge:0});
});
removeLocationButton.addEventListener("click",()=>{pendingLocation=null;locationStatus.textContent="Standort entfernt.";removeLocationButton.classList.add("hidden");});
document.getElementById("btn-delete-water-cancel").addEventListener("click", () => deleteWaterDialog.close());
document.getElementById("btn-delete-water-confirm").addEventListener("click", async () => { if (deletingWater) await waterStore.remove(deletingWater.id); deletingWater = null; deleteWaterDialog.close(); showWaters(); });
waterForm.addEventListener("submit", async (event) => {
  event.preventDefault(); waterFormError.classList.add("hidden");
  const values = Object.fromEntries(new FormData(waterForm));
  try { if (editingWater) await waterStore.update(editingWater.id, values); else await waterStore.save(values); editingWater = null; showWaters(); }
  catch (error) { waterFormError.textContent = error.message || "Das Gewässer konnte nicht gespeichert werden."; waterFormError.classList.remove("hidden"); }
});
document.getElementById("btn-statistics-back").addEventListener("click", showCatchbook);
speciesSearch.addEventListener("input", () => { if (speciesCatalog) renderSpeciesList(speciesSearch.value); });
const backupInput = document.getElementById("backup-input");
const backupStatus = document.getElementById("backup-status");
const importDialog = document.getElementById("import-dialog");
const localBackupDate = document.getElementById("local-backup-date");
const localBackupRestoreButton = document.getElementById("btn-local-backup-restore");
async function refreshLocalBackupStatus() {
  try { const record = await localBackupStore.get(); localBackupRestoreButton.disabled = !record; localBackupDate.textContent = record ? `Lokale Sicherung: ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.createdAt))}` : "Lokale Sicherung: noch nicht vorhanden"; }
  catch { localBackupRestoreButton.disabled = true; localBackupDate.textContent = "Lokale Sicherung konnte nicht geladen werden."; }
}
document.getElementById("btn-backup-export").addEventListener("click", async () => {
  try {
    const [catches, waters] = await Promise.all([catchStore.list(), waterStore.list()]);
    const backup = await CatchBackup.createBackup(catches, waters, "0.6.1");
    await localBackupStore.save(backup);
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `fish-identifier-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
    backupStatus.textContent = "Fangbuch lokal gesichert und Backup-Datei erstellt ✓";
    await refreshLocalBackupStatus();
  } catch { backupStatus.textContent = "Das Fangbuch konnte nicht gesichert werden."; }
});
document.getElementById("btn-backup-import").addEventListener("click", () => { backupInput.value = ""; backupInput.click(); });
localBackupRestoreButton.addEventListener("click", async () => {
  if (!window.confirm("Das letzte lokale Backup ersetzt alle aktuellen Fänge und Gewässer. Fortfahren?")) return;
  try { const record = await localBackupStore.get(); if (!record) throw new Error("missing"); const validated = await CatchBackup.validateBackup(record.backup); await CatchBackup.restoreBackup(await catchStore.open(), validated, "replace"); backupStatus.textContent = "Letztes lokales Backup wiederhergestellt ✓"; await Promise.all([renderCatchbook(), refreshLocalBackupStatus()]); }
  catch { backupStatus.textContent = "Das lokale Backup ist ungültig und wurde nicht wiederhergestellt."; }
});
refreshLocalBackupStatus();
backupInput.addEventListener("change", async () => {
  try { const text = await backupInput.files[0].text(); pendingBackupRecords = await CatchBackup.validateBackup(JSON.parse(text)); document.getElementById("import-summary").textContent = `${pendingBackupRecords.catches.length} Fänge und ${pendingBackupRecords.waters.length} Gewässer im Backup gefunden.`; importDialog.showModal(); }
  catch { pendingBackupRecords = null; backupStatus.textContent = "Die Backup-Datei ist ungültig."; }
});
async function importBackup(mode) {
  if (!pendingBackupRecords) return;
  if (mode === "replace" && !window.confirm("Alle derzeit gespeicherten Fänge auf diesem Gerät werden ersetzt. Fortfahren?")) return;
  try { await CatchBackup.restoreBackup(await catchStore.open(), pendingBackupRecords, mode); importDialog.close(); backupStatus.textContent = `Backup wiederhergestellt ✓ ${pendingBackupRecords.catches.length} Fänge und ${pendingBackupRecords.waters.length} Gewässer verarbeitet.`; pendingBackupRecords = null; renderCatchbook(); }
  catch { backupStatus.textContent = "Das Backup konnte nicht wiederhergestellt werden."; }
}
document.getElementById("btn-import-merge").addEventListener("click", () => importBackup("merge"));
document.getElementById("btn-import-replace").addEventListener("click", () => importBackup("replace"));
document.getElementById("btn-import-cancel").addEventListener("click", () => importDialog.close());
document.getElementById("btn-empty-identify").addEventListener("click", showHome);
saveCatchButton.addEventListener("click", () => openCatchForm());
document.getElementById("btn-catch-cancel").addEventListener("click", () => editingCatch ? showCatchDetail(editingCatch.id) : showResult());
document.getElementById("btn-back-catchbook").addEventListener("click", showCatchbook);
document.getElementById("btn-edit-catch").addEventListener("click", () => selectedCatch && openCatchForm(selectedCatch));
document.getElementById("btn-delete-catch").addEventListener("click", () => deleteCatchDialog.showModal());
document.getElementById("btn-delete-cancel").addEventListener("click", () => deleteCatchDialog.close());
document.getElementById("btn-delete-confirm").addEventListener("click", async () => {
  if (selectedCatch) await catchStore.remove(selectedCatch.id);
  deleteCatchDialog.close();
  selectedCatch = null;
  showCatchbook();
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  installButton.disabled = true;
  await deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.classList.add("hidden");
  installButton.disabled = false;
});

cameraInput.addEventListener("change", (event) => handleFileSelected(event.target.files[0]));
galleryInput.addEventListener("change", (event) => handleFileSelected(event.target.files[0]));

previewImage.addEventListener("error", () => {
  resetSelection();
  showHome();
  showError("Dieses Bild kann in deinem Browser nicht angezeigt werden. Bitte wähle ein anderes Bild aus.");
});

document.getElementById("btn-retake").addEventListener("click", () => {
  analysisGeneration += 1;
  activeAnalysisId = null;
  latestAnalysis = null;
  resetSelection();
  clearError();
  showHome();
});

document.getElementById("btn-analyze").addEventListener("click", async () => {
  if (!selectedFile) {
    resetSelection();
    showHome();
    showError("Bitte wähle zuerst ein Bild aus.");
    return;
  }

  const generation = analysisGeneration;
  if (!navigator.onLine) {
    infoBanner.textContent = "Für die Fischbestimmung wird eine Internetverbindung benötigt.";
    infoBanner.classList.remove("hidden");
    return;
  }
  analyzeButton.disabled = true;
  analyzeButton.textContent = "Fisch wird analysiert …";
  infoBanner.textContent = "Das Bild wird analysiert. Bitte einen Moment warten.";
  infoBanner.classList.remove("hidden");

  try {
    const formData = new FormData();
    formData.append("image", selectedFile, selectedFile.name);
    const response = await fetch("/api/analyze", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || "Die Bildanalyse ist momentan nicht verfügbar.");
    }

    if (generation !== analysisGeneration) return;
    activeAnalysisId = data.analysisId || null;
    latestAnalysis = { result: data, imageBlob: selectedFile };
    renderResult(data);
    resetSelection();
    showResult();
    if (data.secondOpinionStatus === "pending" && activeAnalysisId) requestSecondOpinion(activeAnalysisId, generation, data);
  } catch (error) {
    infoBanner.textContent = error.message || "Die Bildanalyse ist momentan nicht verfügbar.";
    infoBanner.classList.remove("hidden");
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "Fisch bestimmen";
  }
});

document.getElementById("btn-new-fish").addEventListener("click", () => {
  analysisGeneration += 1;
  activeAnalysisId = null;
  latestAnalysis = null;
  resetSelection();
  clearError();
  showHome();
});

catchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setCatchFormError();
  const fields = catchForm.elements;
  let normalizedWeight;
  try { normalizedWeight = CatchStore.normalizeWeightInput(fields.weightInput.value, fields.weightUnit.value); }
  catch (error) { setCatchFormError(error.message); return; }
  const selectedWaterId = fields.waterId.value;
  let waterId = selectedWaterId && selectedWaterId !== "legacy" ? selectedWaterId : null;
  let waterNameSnapshot = "";
  if (selectedWaterId === "legacy" || (editingCatch?.waterId && editingCatch.waterId === selectedWaterId)) {
    waterNameSnapshot = editingCatch?.waterNameSnapshot || editingCatch?.waterName || "";
  } else if (waterId) {
    const selectedWater = await waterStore.get(waterId);
    if (!selectedWater) { setCatchFormError("Das ausgewählte Gewässer existiert nicht mehr."); return; }
    waterNameSnapshot = selectedWater.name;
  }
  const values = {
    speciesName: fields.speciesName.value,
    scientificName: fields.scientificName.value,
    caughtDate: fields.caughtDate.value,
    caughtTime: fields.caughtTime.value,
    lengthCm: fields.lengthCm.value,
    weightGrams: normalizedWeight,
    waterId,
    waterNameSnapshot,
    note: fields.note.value,
    identification: editingCatch?.identification || (latestAnalysis ? identificationFromResult(latestAnalysis.result) : null),
    location: pendingLocation,
  };
  const submitButton = document.getElementById("btn-catch-submit");
  submitButton.disabled = true;
  try {
    if (editingCatch) {
      await catchStore.update(editingCatch.id, values);
    } else {
      const imageBlob = await CatchStore.compressImage(latestAnalysis?.imageBlob || null);
      await catchStore.save({ ...values, imageBlob });
    }
    editingCatch = null;
    showCatchbook({ saved: true });
  } catch (error) {
    setCatchFormError(error.message || "Der Fang konnte nicht gespeichert werden.");
  } finally {
    submitButton.disabled = false;
  }
});

window.addEventListener("beforeunload", () => {
  clearPreviewObjectUrl();
  clearCatchDetailImage();
  if (catchFormImageUrl) URL.revokeObjectURL(catchFormImageUrl);
  clearCatchListImageUrls();
});
