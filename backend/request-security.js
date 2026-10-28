const { AppError } = require('./errors');

function protectApi(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'POST') return next();
  const origin = req.get('origin');
  if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) {
    return next(new AppError('Diese Anfrage ist nicht erlaubt.', { status: 403, code: 'ORIGIN_NOT_ALLOWED' }));
  }
  return next();
}

function validateUploadedImage(req, res, next) {
  if (!req.file) return next();
  const { buffer, mimetype } = req.file;
  const starts = (...bytes) => bytes.every((byte, index) => buffer[index] === byte);
  const isoBrand = buffer.length >= 16 && buffer.toString('ascii', 4, 8) === 'ftyp'
    && /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(buffer.toString('ascii', 8, 12));
  const valid = {
    'image/jpeg': starts(0xff, 0xd8, 0xff),
    'image/png': starts(137, 80, 78, 71, 13, 10, 26, 10),
    'image/gif': /^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6)),
    'image/webp': buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
    'image/heic': isoBrand,
    'image/heif': isoBrand,
  }[mimetype];
  if (!valid) return next(new AppError('Die Datei ist kein unterstütztes Bild oder passt nicht zum angegebenen Bildtyp.', { status: 415, code: 'INVALID_IMAGE_CONTENT' }));
  return next();
}

function createWorkLimiter(maxConcurrent = 4) {
  let active = 0;
  return (req, res, next) => {
    if (active >= maxConcurrent) {
      res.set('Retry-After', '2');
      return next(new AppError('Die Analyse ist gerade ausgelastet. Bitte kurz warten und erneut versuchen.', { status: 503, code: 'ANALYSIS_BUSY' }));
    }
    active += 1;
    let running = false, released = false;
    const release = () => { if (!released) { released = true; active -= 1; } };
    req.analysisWork = { start() { running = true; }, release };
    // A disconnected caller must not release a slot while its provider request still runs.
    const disconnected = () => { if (!running) release(); };
    res.once('close', disconnected);
    res.once('finish', disconnected);
    return next();
  };
}

module.exports = { protectApi, validateUploadedImage, createWorkLimiter };
