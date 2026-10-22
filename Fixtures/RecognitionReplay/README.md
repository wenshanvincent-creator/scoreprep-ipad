# Recorded cloud OMR result

This owned ScorePrep piano exercise and raw job response came from the actual
remote homr run [39763758219](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39763758219),
at source revision 10c7c4e817510691d6bf87e7bc62177219dc2207.
Worker job: 0c9fcdfd-e2a0-43ca-8c8e-aa456bc36bd2.
The original MusicXML is backend/fixtures/recognition-study.musicxml.

The result is initially **unreviewed**. On this one printed exercise, its 64
pitch/onset/duration events, eight measures, C-major key and 4/4 meter match
the source. This is a regression fixture for source identity, native display,
acceptance/rejection and offline persistence. It does not establish accuracy
for arbitrary scores or live network recognition inside the simulator.
The earlier failed oemer outputs remain under backend/fixtures/observed-omr
and observed-oemer-straight.

The native DEBUG replay imports original.png through the real local library,
decodes job.json, verifies its original SHA-256 and saves its MusicXML through
the same persistence path as a completed request. No inference runs during
this replay. Fresh inference and input/engine fixes run remotely in the
recognition workflow. No models, credentials or private scores are included.
