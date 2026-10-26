# Recognition worker notices

`engine.py` and `worker.py` are distributed under AGPL-3.0-only; see LICENSE.txt.
The Electron client, independent glyph reader and printed-text adapter retain the repository's MIT
license. RapidOCR and its bundled recognition model retain their Apache-2.0
notices. Dependency licenses are retained in the portable runtime's installed
distributions, including PDFium's third-party notices.

The Python worker imports homr at revision
`ab369ac54277afab582afa4725441f7cbba76593` and uses its published fp32 ONNX models.
The upstream package is unchanged. Our wrapper bounds CPU sessions to two
threads, runs segmentation batches of one, disables title recognition and
metrical tuplet cleanup, and processes each page separately. All wrapper source
is supplied as ordinary editable Python files. The full upstream source archive,
license and license FAQ are included under the runtime's sources/notices folders.

The upstream FAQ records the weights' AGPL terms and unresolved questions about
training-data permissions for commercial use. Including that FAQ does not assert
that those questions have been cleared. This prototype does not train models or
download training data.

The worker is invoked as a separate local CLI using the bundled Python runtime.
It exchanges PNG, MusicXML and JSON files with the desktop client; it provides no
network service. Build versions are pinned in requirements.txt, and file/model
hashes are recorded in runtime-receipt.json. See README.md for reconstruction.

The printed-text adapter reuses the already bundled Audiveris Tesseract 5.5.2,
Leptonica 1.87.0 native libraries and English trained data. It verifies the two
JAR hashes and trained-data hash before loading them. Existing upstream notices
remain in the recognizer bundle; the adapter neither trains nor downloads assets.
