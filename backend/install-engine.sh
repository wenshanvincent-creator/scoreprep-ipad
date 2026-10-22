#!/usr/bin/env bash
set -euo pipefail
# Execute on the remote worker only. Never install/run the engine on the dev PC.
python -m pip install -r backend/requirements.txt
python -m pip install --no-deps 'oemer @ git+https://github.com/BreezeWhite/oemer.git@dbe2a933d630d0f74805d717960eb259473f5978'
python backend/model_assets.py
