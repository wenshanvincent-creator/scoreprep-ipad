# Recognition and engraving dependency provenance

Reviewed 22 October 2026 from upstream source and release metadata.

| Component | Exact source | Notice / status |
| --- | --- | --- |
| oemer Python CLI, version 0.1.8 metadata | [BreezeWhite/oemer dbe2a933d630d0f74805d717960eb259473f5978](https://github.com/BreezeWhite/oemer/tree/dbe2a933d630d0f74805d717960eb259473f5978) | Upstream MIT text retained as oemer-MIT.txt, including its original placeholder copyright line. Source is installed unmodified with --no-deps; our dependency versions are explicit. |
| First ONNX segmentation model | [Upstream checkpoints release](https://github.com/BreezeWhite/oemer/releases/tag/checkpoints), asset 50273314, 1st_model.onnx, 70,767,752 bytes | Downloaded only on remote worker. Release asset has no upstream SHA digest; trial records its SHA-256. |
| Second ONNX segmentation model | Same release, asset 50273348, 2nd_model.onnx, 38,448,467 bytes | Same receipt policy. No H5/TensorFlow models are needed. |
| Model metadata and SVM classifiers | Same pinned oemer source, checkpoints metadata.pkl and sklearn_models/*.model | Trusted pinned upstream pickle assets; never load user-supplied pickle files. |
| Verovio native toolkit | [version-6.3.0 / 425dd7b6ba26edcecbe345c10b15586d095743d9](https://github.com/rism-digital/verovio/tree/425dd7b6ba26edcecbe345c10b15586d095743d9) | LGPL-3.0; COPYING and COPYING.LESSER retained. Swift tools 5.9, iOS 16 minimum, native C++23 implementation; Xcode 16.4 build evidence is recorded separately. The package includes its data/font resources. |
| PDF rasterization | pypdfium2 4.30.0 | Apache-2.0/BSD-3-Clause wrapper; PDFium dependencies retain bundled notices in installed distribution. Server-only. |
| ONNX Runtime / scientific stack | Exact direct versions in backend/requirements.txt | Server-only dependencies; upstream distributions retain their own license files. No weights or binaries are redistributed here. |
| Printed exercise | backend/fixtures/recognition-study.musicxml | Original ScorePrep contributors exercise, repository MIT license. |

The successful [cloud trial 39759659441](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39759659441)
recorded SHA-256 `37512e858731096439746f60b377c049f07055b4a23ec6eb9a178ce92cfba174`
for the first ONNX asset and `ed2e1a86ea75712ee6cdc740e96f7a36753543cf9bb980227c071c9256d9d82e`
for the second. model_assets.py now requires these exact hashes before a worker
image can build. This pins the observed bytes; it is not an upstream signature.

## Model asset and training-data boundary

The [pinned oemer README](https://github.com/BreezeWhite/oemer/blob/dbe2a933d630d0f74805d717960eb259473f5978/README.md)
states that model one uses CVC-MUSCIMA distortions; model two and the SVM
classifiers use DeepScores-extended. The source repository's MIT file is not a
separate, explicit weight license or a statement clearing all training data.

The [CVC-MUSCIMA dataset publisher](https://dag.cvc.uab.es/dataset/cvc-muscima/)
states non-commercial/research-use terms. The [DeepScoresV2 record](https://zenodo.org/records/4012193)
and its API metadata identify CC-BY-4.0. This implementation uses existing
published models for a bounded technical trial; it does not download training
datasets or train models. Commercial service/App Store release requires
resolution of the weight/data permission question with upstream rights holders.
This is an unresolved release dependency, not a claim that code MIT licensing
clears model assets. No alternative engine is selected by this work.

For references requested by the CVC publisher: M. Visani, V. C. Kieu, A. Fornés,
N. Journet, *The ICDAR 2013 Music Scores Competition: Staff Removal*, ICDAR
2013, pp. 1439–1443; and A. Fornés et al., *The ICDAR/GREC 2013 Music Scores
Competition: Staff Removal*, LNCS 8746 (2014).

Verovio remains an upstream library rather than a replacement engraver.
Public source and full notices are supplied. Distribution packaging must retain
applicable font/dependency notices and satisfy the library's license terms;
App Store distribution has not been performed or signed in this task.
