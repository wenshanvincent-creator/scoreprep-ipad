# Windows dependencies and corresponding sources

ScorePrep's source is MIT licensed. The recognizer is a separate local CLI
program. Its license and the licenses of its bundled dependencies remain their
own. No model training is performed.

| Component | Version | License and upstream |
| --- | --- | --- |
| Audiveris | 5.11.0 | AGPL-3.0-or-later; https://github.com/Audiveris/audiveris/tree/5.11.0 |
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
