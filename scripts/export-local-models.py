"""Build-time conversion only. Production inference never imports PyTorch."""
import gc
import json
import os
from pathlib import Path
import shutil
import numpy as np
import torch
from torch import nn
from torchvision.models import resnet18

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get('FISHIAL_SOURCE_ROOT', ROOT / 'model-source'))
TARGET = Path(os.environ.get('LOCAL_ONNX_DIR', ROOT / 'model-onnx'))
TARGET.mkdir(exist_ok=True, parents=True)
torch.set_num_threads(1)

class Classifier(nn.Module):
    def __init__(self, count):
        super().__init__()
        self.backbone = resnet18(weights=None)
        self.backbone.fc = nn.Identity()
        self.embeddings = nn.Linear(512, 256)
        self.fc_parallel = nn.Linear(512, count)
    def forward(self, image):
        return self.embeddings(self.backbone(image))

def export_model(model, size, name):
    destination = TARGET / (name + '.onnx')
    if destination.exists():
        print(name + ' already exported', flush=True)
        return
    example = torch.zeros(1, 3, size, size)
    with torch.inference_mode():
        torch.onnx.export(model.eval(), example, str(destination), dynamo=False,
                          opset_version=17, input_names=['image'], output_names=['output'],
                          external_data=False)
    print(name + ' exported: ' + str(destination.stat().st_size), flush=True)

def main():
    directory = SOURCE / 'resnet18-v6'
    labels = json.loads((directory / 'labels.json').read_text(encoding='utf-8'))
    classifier = Classifier(len(labels))
    classifier.load_state_dict(torch.load(directory / 'model.ckpt', map_location='cpu', weights_only=True), strict=True)
    export_model(classifier, 224, 'classifier')
    del classifier
    gc.collect()
    for folder, size, name in [('segmentator-fpn', 416, 'segmentator'), ('detector-v10', 640, 'detector')]:
        model = torch.jit.load(str(SOURCE / folder / 'model.ts'), map_location='cpu')
        export_model(model, size, name)
        del model
        gc.collect()
    database = torch.load(directory / 'embeddings.pt', map_location='cpu', weights_only=True).numpy()
    valid = np.isfinite(database).all(axis=2) & (database.sum(axis=2) < 10000)
    counts = valid.sum(axis=1)
    if np.any(counts == 0):
        raise ValueError('An empty reference class cannot be exported')
    np.save(TARGET / 'references.npy', database[valid])
    np.save(TARGET / 'offsets.npy', np.concatenate(([0], np.cumsum(counts))))
    shutil.copyfile(directory / 'labels.json', TARGET / 'labels.json')
    shutil.copyfile(directory / 'test_image.png', TARGET / 'example.png')
    print(json.dumps({'classes': len(labels), 'referenceCount': int(counts.sum()), 'referenceBytes': int(database[valid].nbytes)}), flush=True)

if __name__ == '__main__':
    main()
