# V1 recognition integration contract

All source indexes are **zero-based**, contiguous, and in original PDF order.
One source image has index 0. Each source page has its own MusicXML document;
never join documents into a single XML string.

The worker now uses pinned homr after both the default and known-straight-page
oemer trials failed musical quality. The client/job/page contract is unchanged.
The optional deskew field only records historical oemer receipts.

## Public Swift entry points

`RecognitionClient(baseURL: URL, bearerToken: String, session: URLSession = .shared)`

- `submit(document: Data, mediaType: String) async throws -> RecognitionJob`
- `job(id: String) async throws -> RecognitionJob`
- `waitForResult(id: String, timeout: Duration = .seconds(1800), progress: @Sendable (RecognitionJob) async -> Void) async throws -> RecognitionJob`

Supported MIME types: `application/pdf`, `image/png`, `image/jpeg`. Up to 20 MiB
and eight source pages. Submission returns HTTP 202 after source validation.
Save the original locally before sending; the server also preserves its bytes.
Keep the job ID so polling can resume after a network error. Poll cancellation
does not cancel server inference. Transport, HTTP and decoding errors throw.
Failed jobs throw `RecognitionClientError.failed(RecognitionJob)` from wait;
the value retains successful prior pages and the failing page's error.

`RecognitionState`: queued, running, succeeded, failed, skipped.

`RecognitionJob` (Codable, Sendable, Identifiable) fields:
`schemaVersion: Int` (1), `id: String` (UUID), `state: RecognitionState`,
`completedPages: Int`, `engineRevision: String`, `engineName: String?`, `originalSHA256: String`, `deskew: Bool?`,
`pages: [RecognitionPage]`, `error: String?`.

`RecognitionPage` (Codable, Sendable, Identifiable) fields:
`sourcePageIndex: Int`, `state: RecognitionState`, `musicXML: String?`,
`reviewRequired: Bool?`, `musicXMLSHA256: String?`, `error: String?`.
Its ID is sourcePageIndex. Success requires nonempty MusicXML for every page.
engineName is optional so the first oemer receipts still decode. Use engineName
when present, and record the exact engineRevision alongside saved provenance.
Progress is completed source pages / total source pages, not model percent.
Every generated page starts with reviewRequired=true. Integration owns persisted
unreviewed/accepted/rejected decisions and local filenames.

## Renderer entry point

`RecognizedScoreView(pages: [RecognitionPage], initialSourcePageIndex: Int = 0, onSourcePageChanged: ((Int) -> Void)? = nil)`

The optional initial source index seeds the first layout. Size/rotation reflow
then preserves the currently visible source. The callback reports visible source
changes (including the first successful layout) so integration can align original
comparison and review actions. Create a fresh view identity when opening a
different edition; ordinary review-state changes can update the existing pages.

Accepts successful page values, including ones reconstructed from local
MusicXML and persisted source indexes. Requires ordered, unique indexes; input
errors are visible. The view needs no service connection. Verovio performs
layout locally without an ML model. Its own controls adjust reading size and
turn rendered pages via swipe or buttons. A source page can yield several
rendered pages, each with sourcePageIndex and renderedPageIndex (zero-based).
The component shows a review-needed caption; caller owns review actions and
original comparison. To reopen, read saved XML and construct RecognitionPage
with `.succeeded`, the sourcePageIndex and reviewRequired from saved metadata.

Engraving explicitly uses Verovio's built-in musicxml-hum importer. The direct
importer in the pinned library misassigns homr's interleaved piano voices; the
built-in alternate importer retains their musical timing without changing the
stored raw XML. This choice is checked against the actual homr result fixture.

## HTTP

Authenticated `POST /v1/jobs` with JSON:

```json
{"mediaType":"image/png","contentBase64":"<base64 original bytes>"}
```

Authenticated `GET /v1/jobs/{UUID}` returns the same job shape. All endpoints
require `Authorization: Bearer <private-worker-token>`. No public endpoint is
deployed by this work. Supply an HTTPS gateway and Keychain-held credentials
in integration; no credential belongs in project JSON. Single uvicorn worker,
one inference at a time. On restart, unfinished jobs become explicit failures.
Full operational setup and evidence are in RECOGNITION_BUILD_STATUS.md.
