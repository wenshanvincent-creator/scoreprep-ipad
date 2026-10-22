"""Fetch upstream ONNX assets on the worker; record hashes for the run receipt."""
import hashlib
import importlib.util
import json
from pathlib import Path
import urllib.request


def prepare():
    root = Path(importlib.util.find_spec("oemer").origin).parent
    assets = []
    for name, folder, length in [
        ("1st_model.onnx", "unet_big", 70767752),
        ("2nd_model.onnx", "seg_net", 38448467),
    ]:
        target = root / "checkpoints" / folder / "model.onnx"
        target.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://github.com/BreezeWhite/oemer/releases/download/checkpoints/{name}"
        if not target.exists():
            urllib.request.urlretrieve(url, target)
        data = target.read_bytes()
        if len(data) != length:
            raise ValueError(f"Unexpected upstream asset size: {name}")
        assets.append(dict(name=name, url=url, bytes=length,
                           sha256=hashlib.sha256(data).hexdigest()))
    Path("backend-model-receipt.json").write_text(json.dumps(assets, indent=2))


if __name__ == "__main__":
    prepare()
