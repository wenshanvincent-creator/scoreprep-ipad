# ScorePrep Windows 0.3

Windows 10/11 x64 desktop application. The installer includes the CPU optical
music recognition engine, Java runtime, English OCR data and score renderer.
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
without a local edition offers recognition from its saved source. Their former
manual preparation and remote credentials are no longer used by this Windows UI.
The native Apple app and remote backend remain separate and unchanged.

## Build

From `windows/` with Node.js 24, npm and Windows x64:

```powershell
npm ci
npm run runtime
npm run build
npm test
npm run test:desktop
npm run package
```

Runtime preparation downloads the pinned official Audiveris MSI and OCR data,
checks SHA-256 and administratively extracts into `.runtime/`; it does not run
inference or install a shared application. Recognition launches on import.
Packaging copies the complete runtime outside ASAR and retains its legal files.
One recognition process tree runs at a time, with 2 active processors and a 3 GiB
Java heap ceiling. Jobs resume after application restart. Each attempt has its
own output folder, so a failed retry cannot reuse an earlier successful export.

Main-process IPC owns files and the recognizer; the renderer has sandboxing,
context isolation, no Node integration and blocked navigation. MusicXML transforms
and local musical/audio rules live in `src/core/`. The worker uses Verovio's
performance timemap, including expanded repeat IDs, rather than image coordinates.

See [verification](VERIFICATION.md) and [licenses and sources](THIRD_PARTY.md).
