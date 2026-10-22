"""Prepare pinned homr CPU ONNX assets on the remote worker, without inference."""
import hashlib
import importlib.util
import json
from pathlib import Path
import urllib.request
import zipfile

ASSETS = [
    ("segmentation", "segnet_308-3296ccd40960f90ca6ab9c035cca945675d30a0f", "1d4277354a8397a6830ef1279232e6d989c2d254b7451525e53ff3d3754b1f70"),
    ("transformer", "encoder_pytorch_model_465-597144cab54c8f6d0f6c9619df5c5312694eadd6", "48cd28aef03d230e30e4983d7444e882225e3710a07880c4c15523c55ae7b7b1"),
    ("transformer", "decoder_pytorch_model_465-597144cab54c8f6d0f6c9619df5c5312694eadd6", "8012b73b05cc18fcf38596185cf2c27b35deb121f376c0037d8601917884fbac"),
]


def prepare():
    root = Path(importlib.util.find_spec("homr").origin).parent
    receipts = []
    for folder, stem, digest in ASSETS:
        target = root / folder
        archive = target / f"{stem}.zip"
        url = f"https://github.com/liebharc/homr/releases/download/onnx_checkpoints/{stem}.zip"
        urllib.request.urlretrieve(url, archive)
        actual_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
        if actual_hash != digest:
            raise ValueError(f"Upstream asset hash mismatch: {stem}")
        with zipfile.ZipFile(archive) as bundle:
            for member in bundle.infolist():
                destination = (target / member.filename).resolve()
                if not destination.is_relative_to(target.resolve()):
                    raise ValueError("Model archive member escapes its target")
            bundle.extractall(target)
        if not (target / f"{stem}.onnx").exists():
            raise ValueError(f"Model archive is missing its expected ONNX file: {stem}")
        receipts.append(dict(name=stem, url=url, archiveSHA256=digest,
                             files=[dict(name=p.name, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
                                    for p in target.glob(stem + "*") if p.is_file() and p != archive]))
        archive.unlink()
    Path("backend-model-receipt.json").write_text(json.dumps(receipts, indent=2))


if __name__ == "__main__":
    prepare()
