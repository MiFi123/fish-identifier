"""Small CPU-only ONNX runtime. JSON lines; no network, saved photos or PyTorch."""
import base64
import io
import json
import os
from pathlib import Path
import sys
import time
import warnings
if os.name == 'nt' and os.environ.get('LOCAL_DLL_DIR'):
    _dll_directory = os.add_dll_directory(os.environ['LOCAL_DLL_DIR'])
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = Path(os.environ.get('LOCAL_MODEL_DIR', ROOT / 'model-onnx'))
Image.MAX_IMAGE_PIXELS = 20_000_000
warnings.simplefilter('error', Image.DecompressionBombWarning)
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)[:, None, None]
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)[:, None, None]

def tensor(image, size, normalized=True):
    value = np.asarray(image.resize((size, size), Image.Resampling.BILINEAR), dtype=np.float32).transpose(2, 0, 1) / 255
    if normalized:
        value = (value - MEAN) / STD
    return np.ascontiguousarray(value[None])

def session(name):
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    options.enable_cpu_mem_arena = False
    options.enable_mem_pattern = False
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.log_severity_level = 3
    return ort.InferenceSession(str(DIRECTORY / (name + '.onnx')), options, providers=['CPUExecutionProvider'])

def load_models():
    labels = json.loads((DIRECTORY / 'labels.json').read_text(encoding='utf-8'))
    offsets = np.load(DIRECTORY / 'offsets.npy', allow_pickle=False)
    models = {name: session(name) for name in ['detector', 'segmentator', 'classifier']}
    return labels, offsets, models

def run(model, value):
    return model.run(None, {model.get_inputs()[0].name: value})[0]

def detections(image, model):
    width, height = image.size
    scale = min(640 / width, 640 / height)
    resized = image.resize((round(width * scale), round(height * scale)), Image.Resampling.BILINEAR)
    left, top = (640 - resized.width) // 2, (640 - resized.height) // 2
    letterbox = Image.new('RGB', (640, 640))
    letterbox.paste(resized, (left, top))
    output = run(model, tensor(letterbox, 640, normalized=False))[0]
    boxes = output[output[:, 4] >= 0.25].copy()
    if not len(boxes):
        return []
    boxes[:, [0, 2]] = ((boxes[:, [0, 2]] - left) / scale).clip(0, width)
    boxes[:, [1, 3]] = ((boxes[:, [1, 3]] - top) / scale).clip(0, height)
    boxes = boxes[(boxes[:, 2] - boxes[:, 0] > 10) & (boxes[:, 3] - boxes[:, 1] > 10)]
    kept = []
    for box in sorted(boxes, key=lambda box: -box[4]):
        area = (box[2] - box[0]) * (box[3] - box[1])
        overlap = False
        for other in kept:
            intersection = max(0, min(box[2], other[2]) - max(box[0], other[0])) * max(0, min(box[3], other[3]) - max(box[1], other[1]))
            other_area = (other[2] - other[0]) * (other[3] - other[1])
            if intersection / max(1, area + other_area - intersection) > 0.3:
                overlap = True
                break
        if not overlap:
            kept.append(box)
    return sorted(kept, key=lambda box: -(box[2] - box[0]) * (box[3] - box[1]))

def components(bitmap):
    height, width = bitmap.shape
    seen = np.zeros_like(bitmap, dtype=bool)
    found = []
    for y, x in zip(*np.nonzero(bitmap)):
        if seen[y, x]:
            continue
        pending, points = [(int(y), int(x))], []
        seen[y, x] = True
        while pending:
            cy, cx = pending.pop()
            points.append((cy, cx))
            for ny, nx in [(cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)]:
                if 0 <= ny < height and 0 <= nx < width and bitmap[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    pending.append((ny, nx))
        if len(points) >= 12:
            found.append(points)
    return sorted(found, key=len, reverse=True)

def no_fish(started):
    return {'status': 'no_fish', 'candidates': [], 'elapsedMs': round((time.perf_counter() - started) * 1000),
            'message': 'Kein Fisch ausreichend deutlich erkannt. Bitte ein näheres Foto mit einem einzelnen Fisch versuchen.'}

def analyze(encoded, loaded):
    started = time.perf_counter()
    labels, offsets, models = loaded
    image = Image.open(io.BytesIO(base64.b64decode(encoded, validate=True)))
    if image.format not in ['JPEG', 'PNG', 'WEBP'] or min(image.size) < 32 or image.width * image.height > 20_000_000:
        raise ValueError('Unsupported image')
    image = ImageOps.exif_transpose(image).convert('RGB')
    image.thumbnail((1600, 1600))
    boxes = detections(image, models['detector'])
    if not boxes:
        return no_fish(started)
    box = boxes[0]
    padding = max(2, round(max(image.size) * 0.01))
    image = image.crop((max(0, int(box[0]) - padding), max(0, int(box[1]) - padding), min(image.width, int(box[2]) + padding), min(image.height, int(box[3]) + padding)))
    logits = run(models['segmentator'], tensor(image, 416))[0, 0]
    probability = 1 / (1 + np.exp(-np.clip(logits, -50, 50)))
    small = np.asarray(Image.fromarray(probability).resize((104, 104), Image.Resampling.BILINEAR)) > 0.5
    parts = components(small)
    if not parts or len(parts[0]) / small.size < 0.005:
        return no_fish(started)
    selected = np.zeros_like(small, dtype=np.uint8)
    yy, xx = zip(*parts[0])
    selected[yy, xx] = 255
    mask = np.asarray(Image.fromarray(probability).resize(image.size, Image.Resampling.BILINEAR)) > 0.5
    mask &= np.asarray(Image.fromarray(selected).resize(image.size, Image.Resampling.NEAREST)) > 0
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return no_fish(started)
    pixels = np.asarray(image).copy()
    pixels[~mask] = 0
    cutout = Image.fromarray(pixels).crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    embedding = run(models['classifier'], tensor(cutout, 224))[0]
    # Compact, file-backed references. Per-class work avoids a huge temporary.
    references = np.load(DIRECTORY / 'references.npy', mmap_mode='r', allow_pickle=False)
    distances = []
    for index in range(len(labels)):
        rows = references[offsets[index]:offsets[index + 1]]
        difference = rows - embedding
        distance = np.sqrt(np.square(difference).sum(axis=1).min())
        distances.append({'scientificName': labels[str(index)], 'distance': round(float(distance), 5)})
    del references
    distances.sort(key=lambda item: item['distance'])
    status = 'candidates' if distances[0]['distance'] < 8.84 else 'unrecognized'
    message = 'Mögliche Arten – bitte anhand der Merkmale prüfen.' if status == 'candidates' else 'Keine ausreichend ähnliche Art im Modell gefunden. Die Art kann fehlen oder das Foto ungeeignet sein.'
    multiple = len(boxes) > 1
    if multiple:
        message += ' Mehrere Fische erkannt; ausgewertet wurde nur der größte.'
    preview = io.BytesIO()
    cutout.thumbnail((640, 400))
    cutout.save(preview, format='PNG')
    return {'status': status, 'candidates': distances, 'message': message, 'multipleFishPossible': multiple,
            'cutout': 'data:image/png;base64,' + base64.b64encode(preview.getvalue()).decode('ascii'),
            'elapsedMs': round((time.perf_counter() - started) * 1000), 'speciesCount': len(labels),
            'model': 'Fishial YOLOv10 / FPN / ResNet18 v6 (ONNX CPU)'}

def emit(value):
    print(json.dumps(value, allow_nan=False), flush=True)

def main():
    loaded = load_models()
    emit({'type': 'ready', 'speciesCount': len(loaded[0])})
    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            emit({'id': request['id'], 'result': analyze(request['image'], loaded)})
        except Exception as error:
            print(type(error).__name__ + ': hosted inference failed', file=sys.stderr, flush=True)
            emit({'id': request.get('id'), 'error': 'Dieses Foto konnte nicht verarbeitet werden. Bitte ein JPEG-, PNG- oder WebP-Foto mit höchstens 20 Megapixeln versuchen.'})
        finally:
            request.clear()
            line = None

if __name__ == '__main__':
    main()
