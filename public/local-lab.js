'use strict';
const byId = id => document.getElementById(id);
let selectedFile = null, previewUrl = null, imageCandidates = [], questions = [], busy = false, modelReady = false, refinementVersion = 0;

function notice(text, error = false) { byId('notice').textContent = text; byId('notice').classList.toggle('error', error); }
function setBusy(value) {
  busy = value;
  for (const id of ['example', 'photo', 'reset']) byId(id).disabled = busy;
  byId('analyze').disabled = busy || !selectedFile || !modelReady;
  byId('analyze').textContent = busy ? 'Fisch wird untersucht …' : 'Fisch bestimmen';
  document.querySelectorAll('.question select').forEach(select => { select.disabled = busy; });
}
async function jsonResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || 'Die Anfrage konnte nicht verarbeitet werden.');
  return data;
}
function traits() {
  return Object.fromEntries(questions.map(question => {
    const value = byId('trait-' + question.id).value;
    return [question.id, value === 'unknown' ? null : value === 'yes'];
  }));
}
function clearAnswers() {
  document.querySelectorAll('.question select').forEach(select => { select.value = 'unknown'; select.classList.remove('answered'); });
  byId('traits-status').textContent = 'Noch keine Merkmale ausgewählt.';
}
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function renderResults(ranking) {
  byId('results').replaceChildren();
  byId('empty-state').hidden = ranking.length > 0;
  byId('result-note').hidden = ranking.length === 0;
  ranking.forEach((candidate, index) => {
    const card = node('article', undefined, 'candidate');
    const head = node('div', undefined, 'candidate-head');
    head.append(node('span', String(index + 1).padStart(2, '0'), 'rank'));
    const title = node('div');
    title.append(node('h3', candidate.displayName), node('div', candidate.scientificName, 'latin'));
    head.append(title); card.append(head);
    const evidence = candidate.source === 'traits' ? 'Nur anhand der Merkmale · kein Bildvorschlag für diese Art' : `Bildabstand ${candidate.distance.toFixed(2)} · kleiner bedeutet ähnlicher${candidate.distance >= 8.84 ? ' · schwache Bildähnlichkeit' : ''}`;
    card.append(node('p', evidence, 'distance'));
    for (const [items, className, prefix] of [[candidate.matched, 'matches', '✓ '], [candidate.contradicted, 'conflicts', '↯ ']]) {
      if (items.length) {
        const list = node('ul', undefined, className);
        items.forEach(text => list.append(node('li', prefix + text)));
        card.append(list);
      }
    }
    if (!candidate.profile && Object.values(traits()).some(value => value !== null)) card.append(node('p', 'Für diese Art fehlen hier Merkmalsregeln; deine Antworten konnten sie nicht prüfen.', 'small muted'));
    if (candidate.profile) {
      const details = node('details');
      details.append(node('summary', 'Erkennungsmerkmale ansehen'));
      const list = node('ul'); candidate.profile.identificationFeatures.forEach(feature => list.append(node('li', feature)));
      details.append(list, node('p', 'Lebensraum: ' + candidate.profile.habitat)); card.append(details);
    }
    byId('results').append(card);
  });
}
async function refine() {
  const currentVersion = ++refinementVersion;
  const answers = traits();
  const count = Object.values(answers).filter(value => value !== null).length;
  byId('traits-status').textContent = count ? `${count} Merkmale beantwortet. Die Vorschläge werden abgeglichen.` : 'Noch keine Merkmale ausgewählt.';
  try {
    const data = await jsonResponse(await fetch('/api/lab/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ traits: answers, candidates: imageCandidates }) }));
    if (currentVersion !== refinementVersion) return;
    renderResults(data.ranking);
    if (!imageCandidates.length && count) {
      byId('result-explanation').textContent = data.ranking.length ? 'Vorschläge aus deinen Antworten. Ohne Foto werden nur die 21 vorhandenen Artenprofile verglichen.' : 'Die Antworten ergeben im kleinen Artenkatalog keinen passenden Vorschlag. Unklare Merkmale lieber offenlassen.';
    }
    byId('traits-status').textContent = count ? `${count} Merkmale abgeglichen. Fehlende Profilangaben bleiben unbekannt.` : 'Noch keine Merkmale ausgewählt.';
  } catch (error) { if (currentVersion === refinementVersion) notice(error.message, true); }
}
function selectFile(file, example = false) {
  ++refinementVersion;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  selectedFile = null; imageCandidates = []; clearAnswers(); renderResults([]);
  byId('upload-label').hidden = false;
  byId('cutout-wrap').hidden = true; byId('preview-wrap').hidden = true; byId('timing').textContent = '';
  byId('example-note').hidden = !example;
  byId('result-explanation').textContent = 'Hier erscheinen die Vorschläge. Du kannst auch ohne Foto mit den Merkmalen beginnen.';
  if (!file || file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    notice('Bitte ein JPEG-, PNG- oder WebP-Foto mit höchstens 10 MB auswählen.', true); setBusy(false); return;
  }
  selectedFile = file; previewUrl = URL.createObjectURL(file);
  byId('upload-label').hidden = true;
  byId('preview').src = previewUrl; byId('preview-wrap').hidden = false; byId('file-label').textContent = file.name;
  notice('Foto bereit. Das Foto wird zur Erkennung an unseren Testserver übertragen.'); setBusy(false);
}
async function analyze() {
  if (!selectedFile || busy || !modelReady) return;
  ++refinementVersion;
  imageCandidates = []; renderResults([]); byId('cutout-wrap').hidden = true;
  setBusy(true); notice('Der Fisch wird freigestellt und mit den Referenzbildern des Modells verglichen …');
  try {
    const form = new FormData(); form.append('image', selectedFile);
    const result = await jsonResponse(await fetch('/api/lab/analyze', { method: 'POST', body: form }));
    imageCandidates = result.candidates;
    byId('timing').textContent = `${(result.elapsedMs / 1000).toFixed(1)} s · 0 externe Aufrufe`;
    byId('result-explanation').textContent = result.message;
    if (result.cutout) { byId('cutout').src = result.cutout; byId('cutout-wrap').hidden = false; }
    notice(result.status === 'candidates' ? 'Vorschläge gefunden. Mit sichtbaren Merkmalen kannst du sie weiter eingrenzen.' : result.message, result.status !== 'candidates');
    renderResults(result.ranking);
    if (Object.values(traits()).some(value => value !== null)) await refine();
  } catch (error) { notice(error.message, true); }
  finally { setBusy(false); }
}
byId('photo').addEventListener('change', event => { if (event.target.files[0]) selectFile(event.target.files[0]); });
byId('analyze').addEventListener('click', analyze);
byId('example').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try {
    const response = await fetch('/api/lab/example');
    if (!response.ok) throw new Error('Das Beispielbild fehlt im Modellpaket.');
    selectFile(new File([await response.blob()], 'Fishial-Beispiel-Schleie.png', { type: 'image/png' }), true);
    await analyze();
  } catch (error) { notice(error.message, true); }
  finally { setBusy(false); }
});
byId('reset').addEventListener('click', () => {
  ++refinementVersion; clearAnswers(); imageCandidates = []; selectedFile = null;
  if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null;
  byId('photo').value = ''; byId('preview-wrap').hidden = true; byId('cutout-wrap').hidden = true;
  byId('upload-label').hidden = false;
  byId('example-note').hidden = true; byId('timing').textContent = ''; renderResults([]);
  byId('result-explanation').textContent = 'Hier erscheinen die Vorschläge. Du kannst auch ohne Foto mit den Merkmalen beginnen.';
  notice('Bereit für einen neuen Versuch.'); setBusy(false);
});
async function loadStatus() {
  try {
    const status = await jsonResponse(await fetch('/api/lab/status'));
    if (!questions.length) {
      questions = status.questions;
      for (const question of questions) {
        const label = node('label', undefined, 'question'); label.htmlFor = 'trait-' + question.id;
        label.append(node('span', question.label));
        const select = node('select'); select.id = label.htmlFor;
        [['unknown', 'Unklar / nicht sichtbar'], ['yes', 'Ja'], ['no', 'Nein']].forEach(([value, text]) => { const option = node('option', text); option.value = value; select.append(option); });
        select.addEventListener('change', () => { select.classList.toggle('answered', select.value !== 'unknown'); refine(); });
        label.append(select); byId('questions').append(label);
      }
    }
    modelReady = status.state === 'ready';
    byId('model-state').textContent = modelReady ? `Modell bereit · ${status.speciesCount} Arten` : status.state === 'loading' ? 'Modell wird geladen' : 'Fotomodell nicht verfügbar';
    byId('model-state').classList.toggle('ready', modelReady);
    byId('coverage').textContent = `Das heruntergeladene Modell enthält ${status.speciesCount} Arten. Für ${status.profileCount} Arten liegen lokale Merkmalsprofile vor. Diese Profilarten fehlen im Fotomodell: ${status.missingProfiles.join(', ') || 'keine'}. Fehlende Arten können nur über Merkmale vorgeschlagen werden.`;
    if (!selectedFile && !Object.values(traits()).some(value => value !== null)) notice(modelReady ? 'Bereit. Foto auswählen oder das Beispiel testen.' : status.state === 'loading' ? 'Das Fischmodell wird geladen. Die Merkmalsbestimmung ist bereits nutzbar.' : 'Das Fotomodell ist nicht verfügbar. Die Merkmalsbestimmung funktioniert trotzdem.', !['loading', 'ready'].includes(status.state));
    setBusy(busy);
    if (status.state === 'loading') setTimeout(loadStatus, 2000);
  } catch { notice('Der Testserver ist nicht erreichbar.', true); }
}
loadStatus();
