# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 ScorePrep contributors
"""Verified, bounded CPU inference for the desktop worker."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path

REVISION = "ab369ac54277afab582afa4725441f7cbba76593"
MODELS = {
    "segmentation/segnet_308-3296ccd40960f90ca6ab9c035cca945675d30a0f.onnx":
        "6ed36640db4ef5d223098b6d5efe4eda97c66b24a2c72faab8a018c749003a8d",
    "transformer/encoder_pytorch_model_465-597144cab54c8f6d0f6c9619df5c5312694eadd6.onnx":
        "92bd18338dc8da3c9b00185008ab14719ff9f912efe785ca42d7b623e06e0c6b",
    "transformer/decoder_pytorch_model_465-597144cab54c8f6d0f6c9619df5c5312694eadd6.onnx":
        "18801c1e3657bdea1b031db90b10d66e15accfc1d607780f09a9e059133e886a",
}


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


class VerifiedEngine:
    def __init__(self, cleanup_tuplets=False):
        for name in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
            os.environ[name] = "2"
        distribution = importlib.metadata.distribution("homr")
        origin = json.loads(distribution.read_text("direct_url.json") or "{}")
        if origin.get("vcs_info", {}).get("commit_id") != REVISION:
            raise RuntimeError("The recognizer requires the pinned homr Git revision")
        import homr
        for name, expected in MODELS.items():
            if digest(Path(homr.__file__).parent / name) != expected:
                raise RuntimeError(f"Recognition model SHA-256 mismatch: {name}")
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
        import homr.staff_parsing as parsing
        original_extract = engine.extract

        def bounded_extract(*args, **kwargs):
            kwargs["batch_size"] = 1
            return original_extract(*args, **kwargs)

        engine.extract = bounded_extract
        original_cleanup = parsing.remove_duplicated_symbols

        def cleanup(symbols, cleanup_tuplets=True):
            return original_cleanup(symbols, cleanup_tuplets=self.cleanup_tuplets)

        self.cleanup_tuplets = cleanup_tuplets
        parsing.remove_duplicated_symbols = cleanup
        self.engine = engine
        self.config = engine.ProcessingConfig(
            enable_debug=False, enable_cache=False, write_staff_positions=False,
            read_staff_positions=False, selected_staff=-1, transformer_use_gpu=False,
            segnet_use_gpu=False, coreml_encoder=False, title_detection=False,
        )
        self.xml_args = engine.XmlGeneratorArguments()
        ort.set_default_logger_severity(3)

    def recognize(self, image):
        # process_image does not invoke the CLI's model/title downloads or merge
        # pages before source evidence has been associated with each page.
        return Path(self.engine.process_image(str(image), self.config, self.xml_args))
