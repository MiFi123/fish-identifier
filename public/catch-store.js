(function attachCatchStore(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CatchStore = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const DB_NAME = "fish-identifier-catchbook";
  const STORE_NAME = "catches";
  const MAX_WATER_NAME_LENGTH = 120;
  const MAX_NOTE_LENGTH = 1_000;

  function createId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `catch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function optionalPositiveNumber(value, label) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} muss eine positive Zahl sein.`);
    return number;
  }

  function normalizeLength(value) {
    if (value === "" || value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!/^\d+(?:[.,]\d)?$/.test(text)) throw new Error("Die Länge darf höchstens eine Nachkommastelle haben.");
    return optionalPositiveNumber(text.replace(",", "."), "Die Länge");
  }

  function normalizeWeightGrams(value) {
    if (value === "" || value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!/^\d+$/.test(text)) throw new Error("Das Gewicht muss eine positive ganze Zahl in Gramm sein.");
    return optionalPositiveNumber(text, "Das Gewicht");
  }
  function normalizeWeightInput(value, unit = "kg") {
    if (value === "" || value === null || value === undefined) return null;
    const text = String(value).trim();
    if (unit === "g") {
      if (!/^\d+$/.test(text)) throw new Error("Das Gewicht in Gramm muss eine positive ganze Zahl sein.");
      return optionalPositiveNumber(text, "Das Gewicht");
    }
    if (unit !== "kg" || !/^\d+(?:[.,]\d{1,3})?$/.test(text)) throw new Error("Bitte gib ein gültiges Gewicht in kg oder g ein.");
    const grams = Math.round(Number(text.replace(",", ".")) * 1_000);
    if (grams <= 0) throw new Error("Das Gewicht muss eine positive Zahl sein.");
    return grams;
  }
  function weightInputFromGrams(value) {
    const grams = value === null || value === undefined || value === "" ? null : Number(value);
    if (!Number.isFinite(grams) || grams <= 0) return { value: "", unit: "kg" };
    return grams >= 1_000 ? { value: String(grams / 1_000).replace(".", ","), unit: "kg" } : { value: String(Math.round(grams)), unit: "g" };
  }
  function formatWeight(weightGrams) {
    const grams = Number(weightGrams);
    if (!Number.isFinite(grams) || grams <= 0) return "";
    return grams < 1_000 ? `${new Intl.NumberFormat("de-DE").format(grams)} g` : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(grams / 1_000)} kg`;
  }
  function normalizeLocation(location) {
    if (location === null || location === undefined || location === "") return null;
    const latitude = Number(location.latitude), longitude = Number(location.longitude);
    const accuracy = location.accuracy === null || location.accuracy === undefined ? null : Number(location.accuracy);
    const capturedAt = String(location.capturedAt || "");
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Der Breitengrad ist ungültig.");
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Der Längengrad ist ungültig.");
    if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) throw new Error("Die Standortgenauigkeit ist ungültig.");
    if (!capturedAt || !Number.isFinite(Date.parse(capturedAt))) throw new Error("Der Zeitpunkt der Standorterfassung ist ungültig.");
    return { latitude, longitude, accuracy, capturedAt: new Date(capturedAt).toISOString() };
  }

  function normalizeStoredRecord(record) {
    if (!record) return null;
    const waterNameSnapshot = String(record.waterNameSnapshot ?? record.waterName ?? "").trim();
    const waterId = record.waterId ? String(record.waterId) : null;
    record = { ...record, waterId, waterNameSnapshot, waterName: waterNameSnapshot };
    if (record.weightGrams === undefined && record.weightKg !== null && record.weightKg !== "" && Number.isFinite(Number(record.weightKg)) && Number(record.weightKg) > 0) {
      return { ...record, weightGrams: Math.round(Number(record.weightKg) * 1_000) };
    }
    return record;
  }

  function normalizeCatch(input, { id = createId(), createdAt = new Date().toISOString(), imageBlob = null } = {}) {
    const speciesName = String(input.speciesName || "").trim();
    const caughtDate = String(input.caughtDate || "").trim();
    const caughtTime = String(input.caughtTime || "").trim();
    const waterId = input.waterId ? String(input.waterId).trim() : null;
    const waterNameSnapshot = String(input.waterNameSnapshot ?? input.waterName ?? "").trim();
    const note = String(input.note || "").trim();
    if (!speciesName) throw new Error("Bitte gib eine Fischart an.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(caughtDate)) throw new Error("Bitte gib ein gültiges Fangdatum an.");
    if (caughtTime && !/^\d{2}:\d{2}$/.test(caughtTime)) throw new Error("Bitte gib eine gültige Uhrzeit an.");
    if (waterNameSnapshot.length > MAX_WATER_NAME_LENGTH) throw new Error(`Der Gewässername darf höchstens ${MAX_WATER_NAME_LENGTH} Zeichen haben.`);
    if (note.length > MAX_NOTE_LENGTH) throw new Error(`Die Notiz darf höchstens ${MAX_NOTE_LENGTH} Zeichen haben.`);

    return {
      id,
      speciesName,
      scientificName: String(input.scientificName || "").trim(),
      caughtDate,
      caughtTime,
      caughtAt: `${caughtDate}T${caughtTime || "00:00"}:00`,
      lengthCm: normalizeLength(input.lengthCm),
      weightGrams: normalizeWeightGrams(input.weightGrams ?? (input.weightKg === undefined ? "" : Math.round(Number(input.weightKg) * 1_000))),
      waterId,
      waterNameSnapshot,
      waterName: waterNameSnapshot,
      note,
      imageBlob,
      createdAt,
      identification: input.identification || null,
      location: normalizeLocation(input.location),
    };
  }

  function sortNewestFirst(catches) {
    return [...catches].sort((left, right) => right.caughtAt.localeCompare(left.caughtAt) || right.createdAt.localeCompare(left.createdAt));
  }

  class MemoryCatchStore {
    constructor() { this.records = new Map(); }
    async save(input) {
      const record = normalizeCatch(input, { imageBlob: input.imageBlob || null });
      this.records.set(record.id, record);
      return record;
    }
    async list() { return sortNewestFirst([...this.records.values()].map(normalizeStoredRecord)); }
    async get(id) { return normalizeStoredRecord(this.records.get(id)); }
    async update(id, input) {
      const existing = await this.get(id);
      if (!existing) throw new Error("Der Fang wurde nicht gefunden.");
      const record = normalizeCatch({ ...input, identification: input.identification ?? existing.identification }, { id, createdAt: existing.createdAt, imageBlob: existing.imageBlob });
      this.records.set(id, record);
      return record;
    }
    async remove(id) { this.records.delete(id); }
    async importRecords(records, mode) { const incoming = records.map(normalizeStoredRecord); if (mode === "replace") this.records.clear(); for (const record of incoming) if (mode === "replace" || !this.records.has(record.id)) this.records.set(record.id, record); return this.list(); }
  }

  class IndexedDbCatchStore {
    constructor() { this.dbPromise = null; }
    open() {
      if (this.dbPromise) return this.dbPromise;
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 3);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
          if (!request.result.objectStoreNames.contains("waters")) request.result.createObjectStore("waters", { keyPath: "id" });
          if (!request.result.objectStoreNames.contains("backups")) request.result.createObjectStore("backups", { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Das Fangbuch konnte nicht geöffnet werden."));
      });
      return this.dbPromise;
    }
    async transaction(mode, action) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let result;
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error || new Error("Das Fangbuch konnte nicht gespeichert werden."));
        transaction.onabort = () => reject(transaction.error || new Error("Das Fangbuch konnte nicht gespeichert werden."));
        result = action(store);
      });
    }
    async save(input) {
      const record = normalizeCatch(input, { imageBlob: input.imageBlob || null });
      await this.transaction("readwrite", (store) => store.put(record));
      return record;
    }
    async list() {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(sortNewestFirst(request.result.map(normalizeStoredRecord)));
        request.onerror = () => reject(request.error || new Error("Das Fangbuch konnte nicht geladen werden."));
      });
    }
    async get(id) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
        request.onsuccess = () => resolve(normalizeStoredRecord(request.result));
        request.onerror = () => reject(request.error || new Error("Der Fang konnte nicht geladen werden."));
      });
    }
    async update(id, input) {
      const existing = await this.get(id);
      if (!existing) throw new Error("Der Fang wurde nicht gefunden.");
      const record = normalizeCatch({ ...input, identification: input.identification ?? existing.identification }, { id, createdAt: existing.createdAt, imageBlob: existing.imageBlob });
      await this.transaction("readwrite", (store) => store.put(record));
      return record;
    }
    async remove(id) { await this.transaction("readwrite", (store) => store.delete(id)); }
    async importRecords(records, mode) {
      const normalized = records.map(normalizeStoredRecord);
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("Das Backup konnte nicht wiederhergestellt werden."));
        if (mode === "replace") store.clear();
        if (mode === "merge") {
          normalized.forEach((record) => { const request = store.get(record.id); request.onsuccess = () => { if (!request.result) store.put(record); }; });
        } else normalized.forEach((record) => store.put(record));
      });
    }
  }

  async function compressImage(blob) {
    if (!(blob instanceof Blob) || !blob.type.startsWith("image/") || !("createImageBitmap" in window)) return blob || null;
    try {
      const image = await createImageBitmap(blob);
      const longestSide = Math.max(image.width, image.height);
      const scale = Math.min(1, 1280 / longestSide);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      const compressed = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      return compressed && compressed.size < blob.size ? compressed : blob;
    } catch {
      return blob;
    }
  }

  return { IndexedDbCatchStore, MemoryCatchStore, normalizeCatch, normalizeStoredRecord, normalizeLocation, normalizeWeightInput, weightInputFromGrams, formatWeight, sortNewestFirst, compressImage, MAX_WATER_NAME_LENGTH, MAX_NOTE_LENGTH };
});
