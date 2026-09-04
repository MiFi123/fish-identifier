const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MemoryWaterStore } = require("../public/water-store.js");
const { MemoryCatchStore } = require("../public/catch-store.js");

(async () => {
  const waters = new MemoryWaterStore();
  const catches = new MemoryCatchStore();
  const water = await waters.save({ name: "Testsee", type: "See" });
  const caught = await catches.save({ speciesName: "Hecht", caughtDate: "2026-09-03", waterId: water.id, waterNameSnapshot: water.name });
  await waters.update(water.id, { name: "Neuer Testsee", type: "See" });
  assert.equal((await catches.get(caught.id)).waterNameSnapshot, "Testsee", "Umbenennen verändert historische Fang-Snapshots nicht");
  assert.equal((await catches.get(caught.id)).waterId, water.id, "Umbenennen erhält die Verknüpfung");
  await waters.remove(water.id);
  assert.equal((await catches.get(caught.id)).waterNameSnapshot, "Testsee", "Löschen erhält Fang und Snapshot");
  assert.equal((await catches.list()).length, 1, "Gewässer löschen löscht keine Fänge");

  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  const catchStoreSource = fs.readFileSync(path.join(__dirname, "..", "public", "catch-store.js"), "utf8");
  const waterStoreSource = fs.readFileSync(path.join(__dirname, "..", "public", "water-store.js"), "utf8");
  assert.match(html, /id="btn-manage-waters"/);
  assert.match(html, /id="waters-screen"/);
  assert.match(html, /name="waterId"/);
  assert.match(app, /waterNameSnapshot/);
  assert.match(app, /entry\.waterId === water\.id/);
  assert.match(catchStoreSource, /contains\("waters"\)/);
  assert.match(waterStoreSource, /contains\("catches"\)/);
  console.log("Gewässer-Integrations-Tests erfolgreich.");
})();
