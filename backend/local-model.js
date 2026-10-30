const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');
const fs = require('node:fs');
const { AppError } = require('./errors');

class LocalModel {
  constructor({ pythonPath, modelDirectory, spawnImplementation = spawn } = {}) {
    this.pythonPath = pythonPath || process.env.LOCAL_PYTHON || path.join(__dirname, '..', '.model-venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    this.modelDirectory = modelDirectory || process.env.LOCAL_MODEL_DIR || path.join(__dirname, '..', 'model-onnx');
    this.spawn = spawnImplementation;
    this.state = 'stopped';
    this.pending = null;
    this.sequence = 0;
  }
  start() {
    if (this.child) return;
    if (!fs.existsSync(this.pythonPath)) { this.state = 'missing_runtime'; return; }
    if (!['classifier.onnx', 'segmentator.onnx', 'detector.onnx', 'references.npy', 'offsets.npy', 'labels.json'].every(name => fs.existsSync(path.join(this.modelDirectory, name)))) { this.state = 'missing_model'; return; }
    this.state = 'loading';
    const child = this.child = this.spawn(this.pythonPath, ['-u', path.join(__dirname, '../scripts/hosted_worker.py')], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LOCAL_MODEL_DIR: this.modelDirectory, PYTHONDONTWRITEBYTECODE: '1', OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1' },
    });
    this.startTimer = setTimeout(() => { if (this.state === 'loading') { this.state = 'failed'; child.kill(); } }, 120_000);
    this.startTimer.unref();
    const reader = readline.createInterface({ input: child.stdout });
    reader.on('line', line => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message.type === 'ready') { clearTimeout(this.startTimer); this.state = 'ready'; this.speciesCount = message.speciesCount; return; }
      if (!this.pending || message.id !== this.pending.id) return;
      const pending = this.pending;
      clearTimeout(pending.timer);
      this.pending = null;
      if (message.error) pending.reject(new AppError(message.error, { status: 422, code: 'LOCAL_INFERENCE_FAILED' }));
      else pending.resolve(message.result);
    });
    // Drain diagnostic output without collecting image data or Python paths.
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => this.fail());
    child.on('error', () => this.fail());
    child.on('exit', () => { clearTimeout(this.startTimer); reader.close(); this.child = null; this.fail(); });
  }
  fail() {
    if (this.state !== 'stopped') this.state = 'failed';
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new AppError('Das lokale Modell ist nicht verfügbar. Bitte den Testserver neu starten.', { status: 503, code: 'LOCAL_MODEL_FAILED' }));
      this.pending = null;
    }
  }
  analyzeImage({ buffer }) {
    if (this.state !== 'ready') throw new AppError('Das lokale Modell wird noch geladen oder ist nicht eingerichtet.', { status: 503, code: 'LOCAL_MODEL_NOT_READY' });
    if (this.pending) throw new AppError('Eine lokale Erkennung läuft bereits. Bitte kurz warten.', { status: 429, code: 'LOCAL_MODEL_BUSY' });
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        if (!this.pending || this.pending.id !== id) return;
        this.pending = null;
        this.state = 'failed';
        this.child?.kill();
        reject(new AppError('Die lokale Erkennung hat zu lange gedauert. Bitte den Testserver neu starten.', { status: 504, code: 'LOCAL_MODEL_TIMEOUT' }));
      }, 90_000);
      this.pending = { id, timer, resolve, reject };
      this.child.stdin.write(JSON.stringify({ id, image: buffer.toString('base64') }) + '\n');
    });
  }
  close() { this.state = 'stopped'; clearTimeout(this.startTimer); this.fail(); this.child?.kill(); }
}
module.exports = { LocalModel };
