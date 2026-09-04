const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MemoryCatchStore, normalizeCatch } = require(path.join(__dirname, "..", "public", "catch-store.js"));

async function run() {
  const store = new MemoryCatchStore();
  const identification = { primarySpecies: "Graskarpfen", secondOpinionSpecies: "Döbel", consensusType: "disagreement" };
  const older = await store.save({ speciesName: "Hecht", caughtDate: "2026-09-01", caughtTime: "10:30", lengthCm: "75", weightGrams: "3500", waterName: "Testsee", note: "Am Schilf", identification });
  const newer = await store.save({ speciesName: "Döbel", scientificName: "Squalius cephalus", caughtDate: "2026-09-03", caughtTime: "11:00", lengthCm: "70,5", weightGrams: "1250" });
  assert.notEqual(older.id, newer.id, "Jeder Fang braucht eine eigene ID");
  assert.equal((await store.list())[0].speciesName, "Döbel", "Neueste Fänge stehen zuerst");
  assert.equal((await store.get(older.id)).weightGrams, 3500, "Neue Gewichte werden in Gramm gespeichert");
  assert.equal(newer.lengthCm, 70.5, "Länge darf eine Nachkommastelle haben");
  const linked = await store.save({ speciesName: "Barsch", caughtDate: "2026-09-03", waterId: "water-1", waterNameSnapshot: "Alter See" });
  assert.equal(linked.waterId, "water-1");
  assert.equal(linked.waterNameSnapshot, "Alter See");
  assert.equal(linked.waterName, "Alter See", "Kompatibilitätsfeld bleibt für bestehende Auswertungen erhalten");

  const updated = await store.update(older.id, { speciesName: "Döbel", scientificName: "Squalius cephalus", caughtDate: "2026-09-02", caughtTime: "12:00", lengthCm: "76", weightGrams: "", waterName: "Testsee", note: "Manuell korrigiert" });
  assert.equal(updated.speciesName, "Döbel", "Die manuell eingegebene Art wird gespeichert");
  assert.equal(updated.scientificName, "Squalius cephalus", "Der wissenschaftliche Name bleibt editierbar");
  assert.equal(updated.weightGrams, null, "Optionale Gewichte dürfen leer bleiben");
  assert.deepEqual(updated.identification, identification, "Die ursprüngliche KI-Historie bleibt beim Bearbeiten erhalten");

  store.records.set("legacy-3002", { id: "legacy-3002", speciesName: "Barbe", caughtDate: "2026-09-01", caughtTime: "09:00", caughtAt: "2026-09-01T09:00:00", createdAt: "2026-09-01T09:00:00.000Z", weightKg: 3.002 });
  assert.equal((await store.get("legacy-3002")).weightGrams, 3002, "Alte weightKg-Daten werden korrekt als Gramm gelesen");
  store.records.set("legacy-water", { id: "legacy-water", speciesName: "Karpfen", caughtDate: "2026-09-01", caughtTime: "", caughtAt: "2026-09-01T00:00:00", createdAt: "2026-09-01T00:00:00.000Z", waterName: "Historischer Weiher" });
  const legacyWater = await store.get("legacy-water");
  assert.equal(legacyWater.waterId, null);
  assert.equal(legacyWater.waterNameSnapshot, "Historischer Weiher", "Legacy-waterName wird beim Lesen als Snapshot behandelt");

  await assert.rejects(() => store.save({ speciesName: "Hecht", caughtDate: "2026-09-03", lengthCm: "70,43" }), /höchstens eine Nachkommastelle/);
  await assert.rejects(() => store.save({ speciesName: "Hecht", caughtDate: "2026-09-03", weightGrams: "12.5" }), /ganze Zahl/);
  await assert.rejects(() => store.save({ speciesName: "Hecht", caughtDate: "2026-09-03", weightGrams: "-1" }), /ganze Zahl/);
  const disagreement = normalizeCatch({ speciesName: "Döbel", caughtDate: "2026-09-03", identification });
  assert.equal(disagreement.speciesName, "Döbel", "Die gewählte Art wird gespeichert, nicht still die primäre KI");
  assert.equal(disagreement.identification.consensusType, "disagreement");

  const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  assert.match(app, /new Intl\.NumberFormat\("de-DE"/);
  assert.match(html, /name="speciesName" maxlength="120" required/);
  assert.match(html, /name="scientificName" maxlength="160"/);
  assert.doesNotMatch(html, /name="speciesName"[^>]*readonly|name="scientificName"[^>]*readonly/);

  await store.remove(newer.id);
  assert.equal(await store.get(newer.id), null);
  console.log("Fangbuch-Store-Tests erfolgreich.");
}

run();
