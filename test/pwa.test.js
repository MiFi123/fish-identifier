const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const manifest = JSON.parse(read("public/manifest.webmanifest"));
const html = read("public/index.html");
const app = read("public/app.js");
const worker = read("public/service-worker.js");
const catchStore = read("public/catch-store.js");

assert.equal(manifest.name, "Fish Identifier");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.orientation, "portrait-primary");
assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
assert.match(html, /id="camera-input"[^>]*accept="image\/\*"[^>]*capture="environment"/);
assert.match(app, /serviceWorker\.register\("\/service-worker\.js"\)/);
assert.match(html, /<script src="catch-store\.js"><\/script>/);
assert.match(worker, /"\/catch-store\.js"/);
assert.match(app, /Für die Fischbestimmung wird eine Internetverbindung benötigt\./);
assert.doesNotMatch(app, /% Übereinstimmung/);
assert.doesNotMatch(html, /% Übereinstimmung|Übereinstimmung der Bestimmung/);
assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
assert.match(worker, /request\.method !== "GET"/);
assert.match(worker, /caches\.delete\(key\)/);
assert.doesNotMatch(catchStore, /fetch\(/, "Fangbuchdaten dürfen keine API-Anfrage auslösen");
for (const icon of ["favicon.svg", "icon-192.svg", "icon-512.svg", "icon-maskable.svg"]) {
  assert.ok(fs.existsSync(path.join(projectRoot, "public", "icons", icon)), `${icon} fehlt`);
}

console.log("PWA-Tests erfolgreich.");
