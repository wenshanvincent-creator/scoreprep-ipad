"""Isolated Windows CPU experiment; not the application's installed recognizer.

Use an evaluation environment containing the pinned homr source and verified
fp32 assets. No downloads, library writes, model training or source modifications.
"""
import argparse
import contextlib
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import sys
import time

REVISION = "ab369ac54277afab582afa4725441f7cbba76593"
MODELS = {
    "segmentation/segnet_308-3296ccd40960f90ca6ab9c035cca945675d30a0f.onnx":
        "6ed36640db4ef5d223098b6d5efe4eda97c66b24a2c72faab8a018c749003a8d",
    "transformer/encoder_pytorch_model_465-597144cab54c8f6d0f6c9619df5c5312694eadd6.onnx":
        "92bd18338dc8da3c9b00185008ab14719ff9f912efe785ca42d7b623e06e0c6b",
    "transformer/decoder_pytorch_model_465-597144cab54c8f6d0f6c9619df5c5312694eadd6.onnx":
        "18801c1e3657bdea1b031db90b10d66e15accfc1d607780f09a9e059133e886a",
}


def digest(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path, help="New private output directory")
    parser.add_argument("--upstream-tuplet-cleanup", action="store_true",
                        help="Explicitly allow upstream's metrical tuplet removal heuristic")
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    if source.suffix.lower() not in (".png", ".jpg", ".jpeg", ".pdf"):
        parser.error("Use a PDF, PNG or JPEG source")

    import homr
    distribution = importlib.metadata.distribution("homr")
    origin = json.loads(distribution.read_text("direct_url.json") or "{}")
    if origin.get("vcs_info", {}).get("commit_id") != REVISION:
        raise RuntimeError("Evaluation requires the pinned homr Git revision")
    root = Path(homr.__file__).parent
    for name, expected in MODELS.items():
        if digest(root / name) != expected:
            raise RuntimeError(f"Model SHA-256 mismatch: {name}")

    for name in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
        os.environ[name] = "2"
    import cv2
    import onnxruntime as ort
    cv2.setNumThreads(2)
    original_session = ort.InferenceSession

    class BoundedSession(original_session):
        def __init__(self, path_or_bytes, sess_options=None, providers=None, **kwargs):
            options = sess_options or ort.SessionOptions()
            options.intra_op_num_threads = 2
            options.inter_op_num_threads = 1
            options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            super().__init__(path_or_bytes, sess_options=options,
                             providers=["CPUExecutionProvider"], **kwargs)

    ort.InferenceSession = BoundedSession
    import homr.main as engine
    import homr.staff_parsing as staff_parsing
    original_extract = engine.extract

    def bounded_extract(*values, **kwargs):
        kwargs["batch_size"] = 1
        return original_extract(*values, **kwargs)

    engine.extract = bounded_extract
    original_cleanup = staff_parsing.remove_duplicated_symbols

    def cleanup(symbols, cleanup_tuplets=True):
        return original_cleanup(symbols, cleanup_tuplets=args.upstream_tuplet_cleanup)

    staff_parsing.remove_duplicated_symbols = cleanup
    args.output.mkdir(parents=True, exist_ok=False)
    output = args.output.resolve()
    copied = output / ("source" + source.suffix.lower())
    shutil.copyfile(source, copied)
    source_hash = digest(source)
    receipt = {
        "engine": "homr", "revision": REVISION, "sourceSHA256": source_hash,
        "pid": os.getpid(), "state": "running",
        "models": MODELS, "threads": 2, "segmentationBatch": 1,
        "upstreamTupletCleanup": args.upstream_tuplet_cleanup,
        "python": sys.version, "onnxruntime": ort.__version__,
        "numpy": importlib.metadata.version("numpy"), "opencv": cv2.__version__,
    }
    sys.argv = ["homr", "--gpu", "no", "--no-title", str(copied)]
    (output / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    started = time.monotonic()
    code = None
    try:
        with (output / "recognizer.log").open("w", encoding="utf-8", buffering=1) as log:
            with contextlib.redirect_stdout(log), contextlib.redirect_stderr(log):
                try:
                    engine.main()
                    code = 0
                except SystemExit as error:
                    code = error.code or 0
    finally:
        receipt.update(state="finished" if code == 0 else "failed",
                       seconds=round(time.monotonic() - started, 2), exitCode=code,
                       sourceUnchanged=digest(source) == source_hash,
                       exports=[p.name for p in output.glob("*.musicxml")])
        (output / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps(receipt))
    if code or not receipt["exports"] or not receipt["sourceUnchanged"]:
        raise SystemExit(code or 1)


if __name__ == "__main__":
    main()
