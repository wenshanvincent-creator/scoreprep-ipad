# ScorePrep Windows 0.3.1

Windows 10/11 x64 desktop application. This branch integrates complementary
homr and Audiveris CPU recognition, source-glyph recovery and a portable Python
runtime. It is a development candidate; the installed 0.3.1 and published 0.3.0
preview have not yet been replaced. The package includes the optical music
recognition engines, Java/Python runtimes, OCR data and score renderer.
Users need no server, API key, Python, Java installation or account. Import,
reading, tuning, synthesis and microphone following work locally and offline.

1. Select the score's instrument, then import a printed PDF, PNG or JPEG.
2. Recognition runs automatically and opens a reflowed digital score. Original
   bytes remain in the local library. No crop, timing entry or review gate.
3. Choose **开始练习** to tune first, or skip tuning and begin listening.
4. Play at your own pace. Matching microphone input advances the highlighted
   notes; silence waits. Click a measure to establish a new starting point.
5. **合成试听** plays the recognized score at the selected speed. It uses a
   simple synthesized tone; it does not imitate an acoustic instrument.

Cello is rendered entirely in bass clef without rewriting note pitches. Source
fingerings stay intact when recommendations are hidden. Bowed strings, guitar
and piano have rule-based recommendations; choices favor low positions and
small shifts. Fingerings depend on the player's hand and technique. Wind
profiles preserve printed fingerings and use concert-pitch chromatic tuning;
this version does not generate instrument-specific wind fingering diagrams.

Profiles include cello, violin, viola, double bass, guitar, piano, flute,
clarinet, oboe, bassoon, alto saxophone, trumpet, horn and trombone. Import the
corresponding single-instrument part; piano's two staves are one instrument.
A4 is adjustable from 415–466 Hz. String presets use their sounding open strings.

Printed scores only, up to 20 pages. Recognition can take tens of seconds per
page on a laptop CPU and is not infallible. A structurally valid MusicXML export
cannot establish that every symbol was recognized correctly. Actual processing
and timing failures are shown in the affected score; they are not silently
replaced by invented notes or blamed on image clarity.

The local follower matches pitches/attacks or chord chroma in a short forward
window. It waits during pauses and uncertain input. Manual measure clicks allow
returns. It is intended for one nearby instrument in a quiet room, not ensemble
separation or arbitrary jumps. Real cello rehearsal acceptance is separate from
synthetic PCM and Windows capture tests.

Microphone input is requested only after a user listening action and is never
recorded or uploaded. Reference tones, demonstration playback, leaving the
score/tuner, minimizing and system suspension release capture. Windows microphone
privacy settings must permit desktop apps.

Old preview projects retain their source and metadata. Opening an old project
without a local edition automatically recognizes its saved source. Their former
manual preparation and remote credentials are no longer used by this Windows UI.
The native Apple app and remote backend remain separate and unchanged.

## Build

From `windows/` with Node.js 24, npm and Windows x64:

```powershell
npm ci
# Prepare the isolated neural runtime first; see recognition/README.md.
npm run runtime
npm run build
npm test
npm run test:desktop
npm run package
```

Runtime preparation downloads the pinned official Audiveris MSI and OCR data,
checks SHA-256 and administratively extracts into `.runtime/`; it does not run
inference or install a shared application. It also verifies the separately
prepared neural inventory and synchronizes its worker source and notices.
Recognition launches on import.
Packaging copies the complete runtime outside ASAR and retains its legal files.
One recognition process tree runs at a time, with 2 active processors and a 3 GiB
Java heap ceiling. Neural inference uses CPU-only ONNX sessions with two threads
and one staff batch. Jobs resume after application restart. Each attempt has its
own output folder, so a failed retry cannot reuse an earlier successful export.

Main-process IPC owns files and the recognizer; the renderer has sandboxing,
context isolation, no Node integration and blocked navigation. MusicXML transforms
and local musical/audio rules live in `src/core/`. The worker uses Verovio's
performance timemap, including expanded repeat IDs, rather than image coordinates.

See [verification](VERIFICATION.md) and [licenses and sources](THIRD_PARTY.md).

## Small image adaptation

When the engine reports a measured staff spacing below its 11-pixel entrance
threshold, its layout view is automatically resized once to a useful staff scale,
with a 3x enlargement cap. The original file is unchanged. The derived PNG and
processing recipe are stored with that attempt. Images and every PDF page share
an EXIF-normalized/300-DPI PNG coordinate frame; the neural input retains that
frame while the adapted Audiveris view is mapped back to it. Very small,
undersampled notation still gets a specific
resolution error. Other engine and musical validation failures remain distinct.

Moderate sharpening was compared on a real dense score and reduced structural
quality, so it is not enabled by default. Upscaling passed the size gate but did
not reliably restore the entire difficult score; it is not a guarantee of note,
bar, articulation or fingering accuracy. Complete timing checks remain required.
