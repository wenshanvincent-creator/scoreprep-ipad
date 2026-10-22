# Private recognition worker

This worker wraps the pinned, unmodified homr ONNX CLI. Run it on a remote
Linux server or cloud runner. Never execute model inference on the development
PC. No endpoint has been deployed by this repository.

## Container and service settings

On the remote host, from the repository root:

```sh
docker build -f backend/Dockerfile -t scoreprep-omr:v1 .
docker run --rm --name scoreprep-omr \
  --memory=8g --cpus=2 --pids-limit=128 \
  -e SCOREPREP_WORKER_TOKEN \
  -p 127.0.0.1:8000:8000 \
  -v scoreprep-jobs:/data/jobs scoreprep-omr:v1
```

Set a randomly generated bearer token through the host's secret manager. The
service fails closed if it is missing. Bind only to loopback/private networking;
use an authenticated HTTPS gateway or private tunnel for iPad access. Do not
publish port 8000 unauthenticated. Keep one uvicorn process and one inference
thread; each page uses a fresh CLI subprocess with a 15-minute timeout. CPU
execution is supported on the remote host; a CUDA server is not required for
the bounded trial. No training is performed.

Use a 120-second request timeout at the gateway, a 28-MiB body limit, and an
1800-second client polling window. Source inputs are up to 20 MiB and eight
pages. PDF rasterization is capped at 2400 pixels on its longest edge, with
page indexes kept in document order; image inputs honor EXIF orientation and
composite transparency onto white. The recognition engine internally resizes
its own input. Original upload bytes remain untouched in the job folder.

Persistent `/data/jobs` contains originals, rasterized pages, per-page logs,
MusicXML and atomic job metadata. It is private user data: restrict volume
access and define retention with the deployment owner. For the development
service, stop the container before deleting an expired job directory. There
is no public production multi-tenant service, automatic garbage collection or
durable external queue in this V1 worker. Unfinished jobs become explicit
failures after restart and can be resubmitted. Failed pages retain diagnostics;
later pages are skipped instead of fabricated. Completed earlier pages remain
available for review even when a later page fails.

## Reproduce the cloud trial

The two oemer trials failed musical quality; their raw output remains in
fixtures/observed-omr and fixtures/observed-oemer-straight. The active worker
now uses homr with explicit remote CPU execution and title OCR disabled.

The independent `Recognition and notation evidence` GitHub workflow runs on
this PR. It installs Python 3.11, pinned requirements, pinned homr source and
three upstream ONNX asset archives, then records their SHA-256 receipts. The trial
generates a printed PNG from the owned exercise and submits it through the
authenticated worker API in process. **The API host is in process, but the
OMR subprocess and model predictions are real.** No public HTTP endpoint is
opened. The next job downloads that actual MusicXML response and compiles the
native Swift package with Xcode 16.4, then captures iPad simulator UI evidence.

Artifacts separate original PNG/XML, actual recognized XML, comparison data,
worker diagnostics, model receipts and native screenshots. See
`docs/RECOGNITION_BUILD_STATUS.md` for the latest observed result and limits.
The native harness also has an explicit `--fixture` mode, whose evidence is
labeled fixture engraving; it does not count as recognition evidence.

## Integration

See `docs/RECOGNITION_API.md`. App composition supplies a private HTTPS endpoint
and Keychain credential, saves job IDs, persists per-page XML with source indexes,
and owns review decisions, original comparison and offline reopen. The supplied
reader only engraves MusicXML and supports size changes and manual navigation.

## Dependencies and provenance

See `notices/PROVENANCE.md`. The dependency source/license and model-data
provenance are recorded separately. Model weights are downloaded onto cloud
compute, not bundled in the app or committed to this repository.
