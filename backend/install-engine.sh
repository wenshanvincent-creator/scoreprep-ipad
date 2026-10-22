#!/usr/bin/env bash
set -euo pipefail
# Execute on the remote worker only. Never install/run the engine on the dev PC.
python -m pip install -r backend/requirements.txt
python -m pip install 'homr[cpu] @ git+https://github.com/liebharc/homr.git@ab369ac54277afab582afa4725441f7cbba76593'
python backend/model_assets.py
