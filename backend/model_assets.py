"""Fetch upstream ONNX assets on the worker; record hashes for the run receipt."""
import hashlib
import importlib.util
import json
from pathlib import Path
import urllib.request


def prepare():
    root = Path(importlib.util.find_spec("oemer").origin).parent
    assets = []
    for name, folder, length, expected_hash in [
        ("1st_model.onnx", "unet_big", 70767752, "37512e858731096439746f60b377c049f07055b4a23ec6eb9a178ce92cfba174"),
        ("2nd_model.onnx", "seg_net", 38448467, "ed2e1a86ea75712ee6cdc740e96f7a36753543cf9bb980227c071c9256d9d82e"),
    ]:
        target = root / "checkpoints" / folder / "model.onnx"
        target.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://github.com/BreezeWhite/oemer/releases/download/checkpoints/{name}"
        if not target.exists():
            urllib.request.urlretrieve(url, target)
        data = target.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if len(data) != length or digest != expected_hash:
            raise ValueError(f"Upstream asset does not match the verified trial: {name}")
        assets.append(dict(name=name, url=url, bytes=length,
                           sha256=digest))
    Path("backend-model-receipt.json").write_text(json.dumps(assets, indent=2))


if __name__ == "__main__":
    prepare()
