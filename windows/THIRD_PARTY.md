# Windows dependencies and corresponding sources

ScorePrep's Electron client is MIT licensed. The separate local recognition
workers and bundled dependencies retain their own licenses, listed below.
No model training is performed.

| Component | Version | License and upstream |
| --- | --- | --- |
| Audiveris | 5.11.0 | AGPL-3.0-or-later; https://github.com/Audiveris/audiveris/tree/5.11.0 |
| homr CPU worker and ONNX weights | ab369ac54277afab582afa4725441f7cbba76593 | AGPL-3.0; full source/license/FAQ in `resources/neural/sources` and `resources/neural/notices` |
| Python recognition wrapper | source in this repository | AGPL-3.0-only; editable engine.py and worker.py in `resources/neural` |
| CPython | 3.12.14 | PSF and bundled third-party notices in `resources/neural/python/LICENSE.txt` |
| ONNX Runtime | 1.29.0 | MIT; upstream license/third-party notices retained in the installed distribution |
| RapidOCR / PaddleOCR recognition model | 3.7.0 / PP-OCRv4 | Apache-2.0; upstream distribution notices retained |
| NumPy / headless OpenCV / Pillow / PDFium | exact versions in recognition/requirements.txt | Individual upstream licenses retained in installed distributions under `resources/neural/python/Lib/site-packages` |
| Audiveris Java runtime | Azul Zulu25.34+17 CRaC CA / OpenJDK 25.0.3+9 LTS | GPL-2.0 with Classpath and Assembly exceptions; full notices in `recognizer/runtime/legal` |
| English OCR data | tessdata 4.1.0 | Apache-2.0; https://github.com/tesseract-ocr/tessdata/tree/4.1.0 |
| Electron | 45.0.0 | MIT and Chromium notices; https://github.com/electron/electron/tree/v45.0.0 |
| React / React DOM | 19.3.1 | MIT; https://github.com/facebook/react |
| pdf-lib | 1.17.1 | MIT; https://github.com/Hopding/pdf-lib |
| Pitchy | 4.1.0 | MIT; https://github.com/ianprime0509/pitchy |
| fft.js | 4.0.4 | MIT; https://github.com/indutny/fft.js |
| fflate | 0.8.3 | MIT; https://github.com/101arrowz/fflate |
| @xmldom/xmldom | 0.9.12 | MIT; https://github.com/xmldom/xmldom |
| Verovio | 6.3.0 | LGPL-3.0-or-later; https://github.com/rism-digital/verovio/tree/version-6.3.0 |

The installer retains the Audiveris runtime's Java legal notices, JAR license and
notice files, and a SHA-256 inventory under `resources/recognizer`. Audiveris's
complete 5.11.0 source archive is included in `resources/recognizer/sources`.
Its build scripts specify the upstream dependency versions and repositories.
Audiveris JARs and classifiers are unchanged. `Audiveris.cfg` is adjusted to a
3 GiB maximum heap and two active processors. The separate English OCR resource
is pinned and checked in the runtime preparation script.

The application bundles the unmodified upstream Verovio WASM distribution.
It uses the direct MusicXML importer to preserve stable note and measure IDs.
LGPL/GPL texts are in `resources/app.asar/dist/notices`. Rebuild instructions and
exact npm integrity hashes are in this repository and its lockfile; users may
modify the client and replace its Verovio package. Reverse engineering for
modification/debugging of LGPL components is permitted.

Java upstream source access: https://www.azul.com/products/core/openjdk-terms-of-use/
and https://github.com/CRaC/openjdk-builds . The precise bundled runtime identifies
itself as Zulu25.34+17-CRaC-CA, build 25.0.3+9-LTS. Its binary modules are the
upstream Audiveris distribution's unchanged runtime, with their legal files.

Other package license files are retained under `dist/notices`; Electron also
includes `LICENSE` and `LICENSES.chromium.html` in the installation directory.
The app icon and included practice artwork are original repository assets.

The separate Python worker includes its pinned upstream source, our complete
wrapper/build source, the AGPL text and homr's license FAQ. The FAQ records
unresolved training-data permission questions for commercial use; this prototype
does not claim those questions have been cleared. It performs local inference
with existing published weights and does not train a model.
