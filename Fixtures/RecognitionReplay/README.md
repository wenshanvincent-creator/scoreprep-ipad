# Recorded cloud OMR result

This owned ScorePrep piano exercise and raw job response came from the actual
remote oemer run [39759659441](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39759659441),
at source revision 6b3a2c04185a99cc80e92145f3c68eed34ec40db.
The original MusicXML is backend/fixtures/recognition-study.musicxml.

The result is intentionally **unreviewed**: the first run converted some notes
to rests, changed the key and omitted meter. It is a regression fixture for
source identity, review/rejection and offline persistence, not an accurate
edition or evidence of live network recognition inside the simulator.

The native DEBUG replay imports original.png through the real local library,
decodes job.json, verifies its original SHA-256 and saves its MusicXML through
the same persistence path as a completed request. No inference runs during
this replay. Fresh inference and input/engine fixes run remotely in the
recognition workflow. No models, credentials or private scores are included.
