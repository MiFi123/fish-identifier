const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const multer = require('multer');
const { LocalModel } = require('./local-model');
const { QUESTIONS, PROFILES, canonicalName, rankCandidates } = require('./local-traits');
const { createRateLimiter } = require('./rate-limit');
const { protectApi, validateUploadedImage, createWorkLimiter } = require('./request-security');
const { AppError } = require('./errors');

function registerLocalLab(app, { enabled = process.env.LOCAL_LAB_ENABLED === 'true', model = new LocalModel() } = {}) {
  if (!enabled) return null;
  const root = path.join(__dirname, '../public');
  const router = express.Router();
  router.use(protectApi, (req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });
  router.get('/status', (req, res) => {
    let labels = [];
    try { labels = Object.values(JSON.parse(fs.readFileSync(path.join(model.modelDirectory, 'labels.json'), 'utf8'))); } catch {}
    const names = new Set(labels.map(canonicalName));
    res.json({ state: model.state, mode: 'hosted', speciesCount: labels.length, profileCount: Object.keys(PROFILES).length,
      missingProfiles: Object.keys(PROFILES).filter(name => !names.has(name)), questions: QUESTIONS, externalCalls: false, imageStorage: false });
  });
  router.get('/example', (req, res) => res.sendFile(path.join(model.modelDirectory, 'example.png')));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0, parts: 1, headerPairs: 32 },
    fileFilter(req, file, callback) { callback(['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ? null : new AppError('Bitte JPEG, PNG oder WebP verwenden.', { status: 415, code: 'INVALID_IMAGE' }), true); } });
  const work = createWorkLimiter(1);
  router.post('/analyze', createRateLimiter({ windowMs: 600_000, maxRequests: 10 }),
    (req, res, next) => model.state !== 'ready' ? next(new AppError('Das Testmodell startet gerade. Bitte kurz warten.', { status: 503, code: 'LOCAL_MODEL_NOT_READY' })) : next(),
    work, upload.single('image'), validateUploadedImage, async (req, res, next) => {
      req.analysisWork.start();
      try {
        if (!req.file) throw new AppError('Bitte zuerst ein Fischfoto auswählen.', { status: 400, code: 'IMAGE_REQUIRED' });
        const result = await model.analyzeImage({ buffer: req.file.buffer });
        res.json({ ...result, ranking: rankCandidates({ candidates: result.candidates }), externalCalls: 0 });
      } catch (error) { next(error); }
      finally { if (req.file) req.file.buffer = null; req.analysisWork.release(); }
    });
  router.post('/refine', createRateLimiter({ windowMs: 60_000, maxRequests: 120 }), express.json({ limit: '100kb' }), (req, res, next) => {
    try { res.json({ ranking: rankCandidates(req.body) }); }
    catch { next(new AppError('Ungültige Merkmale oder Bildkandidaten.', { status: 400, code: 'INVALID_TRAITS' })); }
  });
  router.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return next(new AppError('Ungültige Anfrage.', { status: 400, code: 'INVALID_JSON' }));
    if (error.type === 'entity.too.large') return next(new AppError('Die Anfrage ist zu groß.', { status: 413, code: 'REQUEST_TOO_LARGE' }));
    return next(error);
  });
  app.use('/api/lab', router);
  app.get(/^\/versuch$/, (req, res) => res.redirect(302, '/versuch/'));
  app.get('/versuch/', (req, res) => { res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }); res.sendFile(path.join(root, 'local-lab.html')); });
  for (const filename of ['local-lab.js', 'local-lab.css']) app.get('/versuch/' + filename, (req, res) => { res.set('Cache-Control', 'no-store'); res.sendFile(path.join(root, filename)); });
  model.start();
  return model;
}
module.exports = { registerLocalLab };
