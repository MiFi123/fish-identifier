const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { AnalysisStore } = require('../backend/analysis-store');
const { createRateLimiter } = require('../backend/rate-limit');
const { createWorkLimiter, validateUploadedImage } = require('../backend/request-security');
const { createGeminiProvider } = require('../backend/providers/gemini');
const { createFishialProvider } = require('../backend/providers/fishial');

test('retained image bytes and entry count are bounded, including work past its TTL', async () => {
  let now = 0;
  const store = new AnalysisStore({ now: () => now, ttlMs: 100, maxEntries: 2, maxBytes: 8 });
  try {
    const first = store.create({ buffer: Buffer.alloc(5), mimeType: 'image/png', result: {} });
    assert.throws(() => store.create({ buffer: Buffer.alloc(4), result: {} }), error => error.code === 'ANALYSIS_CAPACITY');
    let done;
    const pending = store.startSecondOpinion(first.id, () => new Promise(resolve => { done = resolve; }));
    now = 101; store.cleanup();
    assert.equal(store.size(), 1);
    assert.throws(() => store.create({ buffer: Buffer.alloc(4), result: {} }));
    done({ secondOpinionStatus: 'completed' }); await pending;
    assert.equal(first.buffer, null);
    store.create({ buffer: Buffer.alloc(4), result: {} });
    store.create({ buffer: Buffer.alloc(4), result: {} });
    assert.throws(() => store.create({ buffer: Buffer.alloc(0), result: {} }));
  } finally { store.dispose(); }
});

test('rate-limit tracking is bounded and expired clients release capacity', () => {
  let now = 0;
  const limiter = createRateLimiter({ windowMs: 100, maxRequests: 1, maxClients: 2, now: () => now });
  const check = ip => { let error; limiter({ ip }, { set() {} }, issue => { error = issue; }); return error; };
  assert.equal(check('client-a'), undefined);
  assert.equal(check('client-a').status, 429);
  assert.equal(check('client-b'), undefined);
  assert.equal(check('client-c').code, 'RATE_LIMIT_CAPACITY');
  now = 101;
  assert.equal(check('client-c'), undefined);
});

test('disconnecting cannot bypass provider concurrency limits; rejected uploads release slots', () => {
  const limit = createWorkLimiter(1);
  const req = {}, res = new EventEmitter(); res.set = () => {};
  limit(req, res, error => assert.equal(error, undefined));
  req.analysisWork.start(); res.emit('close');
  let rejected;
  limit({}, res, error => { rejected = error; });
  assert.equal(rejected.code, 'ANALYSIS_BUSY');
  req.analysisWork.release(); req.analysisWork.release();
  const upload = {}, response = new EventEmitter(); response.set = () => {};
  limit(upload, response, error => assert.equal(error, undefined));
  response.emit('close');
  limit({}, res, error => assert.equal(error, undefined));
});

test('all supported image families require matching signatures', () => {
  const cases = [
    ['image/jpeg', Buffer.from([255, 216, 255, 224])],
    ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ['image/gif', Buffer.from('GIF89a')],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
    ['image/heic', Buffer.from('\0\0\0\x18ftypheic0000')],
    ['image/heif', Buffer.from('\0\0\0\x18ftypmif10000')],
  ];
  for (const [mimetype, buffer] of cases) {
    validateUploadedImage({ file: { mimetype, buffer } }, {}, error => assert.equal(error, undefined));
    validateUploadedImage({ file: { mimetype, buffer: Buffer.from('<script>malicious</script>') } }, {}, error => assert.equal(error.status, 415));
  }
});

test('API rejects cross-site requests, spoofed images and multipart extras before provider calls', async t => {
  process.env.NODE_ENV = 'test'; process.env.APP_ENV = 'test'; process.env.SECOND_OPINION_ENABLED = 'false';
  process.env.RATE_LIMIT_MAX_REQUESTS = '1000'; process.env.MAX_UPLOAD_SIZE_BYTES = '1024';
  process.env.GEMINI_API_KEY = '';
  let providerCalls = 0;
  require('../backend/providers').createAnalysisProvider = () => ({ name: 'fixture', async analyzeImage() { providerCalls++; return { fishDetected: false, candidates: [] }; } });
  const { app } = require('../server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7noAAAAASUVORK5CYII=', 'base64');
  const upload = (data = png, extra = false) => { const form = new FormData(); form.append('image', new Blob([data], { type: 'image/png' }), 'fish.png'); if (extra) form.append('extra', 'ignored?'); return form; };
  assert.equal((await fetch(`${base}/api/analyze`, { method: 'POST', headers: { Origin: 'https://evil.example' }, body: upload() })).status, 403);
  assert.equal((await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Sec-Fetch-Site': 'cross-site' }, body: upload() })).status, 403);
  assert.equal((await fetch(`${base}/api/analyze`, { method: 'POST', body: upload(Buffer.from('not an image')) })).status, 415);
  assert.equal((await fetch(`${base}/api/analyze`, { method: 'POST', body: upload(png, true) })).status, 400);
  assert.equal((await fetch(`${base}/api/analyze`, { method: 'POST', body: upload(Buffer.alloc(1025)) })).status, 413);
  assert.equal(providerCalls, 0);
  const valid = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { Origin: base }, body: upload() });
  assert.equal(valid.status, 200); assert.equal(providerCalls, 1);
  assert.equal(valid.headers.get('cache-control'), 'no-store');
  assert.equal((await fetch(`${base}/api/health`)).headers.get('cache-control'), 'no-store');
  const benchmark = upload(); benchmark.append('repetitions', '1');
  const benchmarkResponse = await fetch(`${base}/api/dev/gemini-benchmark`, { method: 'POST', body: benchmark });
  assert.equal(benchmarkResponse.status, 503);
  assert.equal((await benchmarkResponse.json()).error.code, 'GEMINI_NOT_CONFIGURED');
});

test('provider requests keep API keys out of URLs and refuse redirects', async () => {
  const gemini = createGeminiProvider({ apiKey: 'fixture-secret', model: 'fixture', maxAttempts: 1, fetchImplementation: async (url, options) => {
    assert.ok(!url.includes('fixture-secret')); assert.equal(options.headers['x-goog-api-key'], 'fixture-secret'); assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ fishDetected: false, uncertain: true, confidence: 0 }) }] } }] }));
  } });
  await gemini.analyzeImage({ buffer: Buffer.from('fixture'), mimeType: 'image/png', fishial: { primary: null, alternatives: [] } });
  let requests = 0;
  const fishial = createFishialProvider({ clientId: 'fixture', clientSecret: 'fixture-secret', baseUrl: 'https://provider.example', fetchImplementation: async (url, options) => {
    requests++; assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify(url.endsWith('/auth') ? { access_token: 'fixture-token' } : { ok: true, objects: [] }));
  } });
  await fishial.analyzeImage({ buffer: Buffer.from('fixture'), mimeType: 'image/png' });
  assert.equal(requests, 2);
});
