# Windows client dependencies

The Windows client contains no OMR engine or model weights. Recognition uses the
configured remote service. This client uses these unmodified upstream packages;
the lockfile records exact package integrity hashes.

| Component | Version | License / upstream source |
| --- | --- | --- |
| Electron | 45.0.0 | MIT; Chromium and other notices included with the application runtime. https://github.com/electron/electron/tree/v45.0.0 |
| React / React DOM | 19.3.1 | MIT; https://github.com/facebook/react |
| PDF.js | 6.4.299 | Apache-2.0; https://github.com/mozilla/pdf.js |
| pdf-lib | 1.17.1 | MIT; https://github.com/Hopding/pdf-lib |
| Pitchy | 4.1.0 | 0BSD; McLeod pitch method, no learned model. https://github.com/ianprime0509/pitchy |
| Verovio WASM with Humdrum | 6.3.0 | LGPL-3.0-or-later; https://github.com/rism-digital/verovio/tree/version-6.3.0 ; npm distribution https://www.npmjs.com/package/verovio/v/6.3.0 |

Verovio's corresponding source is the upstream version-6.3.0 source, including
its bundled Humdrum dependencies. The distributed WASM implementation is not
patched. It uses the upstream `musicxml-hum` importer. Its LGPL/GPL license texts
are included here. ScorePrep's MIT source and build instructions are in this
repository; users may modify/rebuild the client and replace its Verovio package.
Reverse engineering for debugging modifications to LGPL components is permitted.

Package license files are retained in this directory. The application runtime
also includes LICENSE and LICENSES.chromium.html in its installation directory.
Source fixture artwork and the app icon are original ScorePrep repository assets.
