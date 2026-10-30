#!/usr/bin/env bash
set -euo pipefail
npm ci --no-audit --no-fund
python3 -m venv .model-venv
.model-venv/bin/python -m pip install -r requirements-hosted.txt
python3 -m venv .export-venv
.export-venv/bin/python -m pip install --index-url https://download.pytorch.org/whl/cpu 'torch==2.15.0+cpu' 'torchvision==0.29.2+cpu'
.export-venv/bin/python -m pip install 'onnx==1.23.2'
.export-venv/bin/python scripts/download-local-models.py
.export-venv/bin/python scripts/export-local-models.py
OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 .model-venv/bin/python scripts/smoke-hosted.py
