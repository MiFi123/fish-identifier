const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const { registerLocalLab } = require('../backend/local-lab-routes');
const { rankCandidates } = require('../backend/local-traits');

async function setup(t, enabled = true) {
  let calls = 0;
  const model = { state: 'ready', modelDirectory: path.join(__dirname, '../model-onnx'), start() {}, close() {}, async analyzeImage() {
    calls++;
    return { status: 'candidates', elapsedMs: 1, candidates: [{ scientificName: 'Tinca tinca', distance: 5 }] };
  } };
  const app = express();
  app.set('trust proxy', 1);
  registerLocalLab(app, { enabled, model });
  app.use((error, req, res, next) => res.status(error.status || (error.name === 'MulterError' ? 400 : 500)).json({ error: error.code }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { root: `http://127.0.0.1:${server.address().port}`, model, calls: () => calls };
}

test('Test ist bei deaktivierter Konfiguration nicht erreichbar', async t => {
  const { root } = await setup(t, false);
  assert.equal((await fetch(root + '/api/lab/status')).status, 404);
  assert.equal((await fetch(root + '/versuch/')).status, 404);
});
test('Testseite und Assets funktionieren unter einem Unterpfad ohne Redirect-Schleife', async t => {
  const { root } = await setup(t);
  const redirect = await fetch(root + '/versuch', { redirect: 'manual' });
  assert.equal(redirect.status, 302); assert.equal(redirect.headers.get('location'), '/versuch/');
  const page = await fetch(root + '/versuch/'); assert.equal(page.status, 200);
  assert.match(await page.text(), /an unseren Testserver übertragen/);
  assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow');
  for (const asset of ['local-lab.js', 'local-lab.css']) assert.equal((await fetch(root + '/versuch/' + asset)).status, 200);
});
test('Foto geht nur an den eigenen Worker und es gibt keine Cloud-Zweitmeinung', async t => {
  const { root, calls } = await setup(t);
  const form = new FormData();
  form.append('image', new Blob([Buffer.from('89504e470d0a1a0a0000', 'hex')], { type: 'image/png' }), 'fish.png');
  const response = await fetch(root + '/api/lab/analyze', { method: 'POST', body: form });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.externalCalls, 0); assert.equal(data.ranking[0].scientificName, 'Tinca tinca');
  assert.equal(calls(), 1);
});
test('Unbereite Modelle, falsche Bilder und fremde Origins werden abgefangen', async t => {
  const { root, model, calls } = await setup(t);
  model.state = 'loading';
  assert.equal((await fetch(root + '/api/lab/analyze', { method: 'POST' })).status, 503);
  model.state = 'ready';
  assert.equal((await fetch(root + '/api/lab/analyze', { method: 'POST', headers: { Origin: 'https://other.invalid' } })).status, 403);
  const form = new FormData(); form.append('image', new Blob(['not an image'], { type: 'image/png' }), 'bad.png');
  assert.equal((await fetch(root + '/api/lab/analyze', { method: 'POST', body: form })).status, 415);
  assert.equal(calls(), 0);
});
test('HTTPS hinter dem Render-Proxy bleibt Same-Origin', async t => {
  const { root } = await setup(t);
  const origin = root.replace('http:', 'https:');
  const response = await fetch(root + '/api/lab/refine', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https', Origin: origin }, body: JSON.stringify({ traits: { eel: true } }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ranking[0].scientificName, 'Anguilla anguilla');
});
test('Ungültiges JSON und unbekannte Merkmale liefern 400', async t => {
  const { root } = await setup(t);
  for (const body of ['{bad', JSON.stringify({ traits: { injected: true } })]) {
    assert.equal((await fetch(root + '/api/lab/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })).status, 400);
  }
});
test('Unbekannt ist keine Abwesenheit; schwache Kandidaten werden weiterhin nach Abstand sortiert', () => {
  assert.deepEqual(rankCandidates({ traits: { adipose: null } }), []);
  assert.equal(rankCandidates({ traits: { duckMouth: true, rearDorsal: true } })[0].scientificName, 'Esox lucius');
  assert.deepEqual(rankCandidates({ candidates: [{ scientificName: 'Esox lucius', distance: 9 }, { scientificName: 'Anguilla anguilla', distance: 14 }] }).map(item => item.distance), [9, 14]);
});
