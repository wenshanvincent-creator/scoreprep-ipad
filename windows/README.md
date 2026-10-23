# ScorePrep Windows 0.2

Windows 10/11 x64 desktop client alongside the existing native Apple app.
Install the generated `release/ScorePrep-0.2.0-Windows-x64.exe`; the installed
application needs no Node.js, account or server for reading, practice or tuning.
This preview installer is unsigned.

## Start practicing

1. Open the included practice exercise, or import a PDF, PNG or JPEG.
2. For an import, choose **准备练习**. Drag complete systems on the original,
   confirm each area's performed quarter-note count, meter, explicit pulse,
   BPM and pickup phase. Arrange repeated occurrences, then save.
3. Choose **开始练习**. The tuner opens first. It defaults to **大提琴**;
   select C2, G2, D3 or A3, then explicitly click **开始监听**.
4. Sustain one open string at a time. The display shows the detected octave,
   frequency, cents above/below the selected target and an in-tune band of ±5 cents.
   An octave error is displayed as an octave error. The app never folds it into
   a false in-tune reading.
5. **参考音** stops microphone input and plays the selected sounding pitch.
   Click **开始监听** again to resume tuning. **调好，开始练习** or **跳过调音**
   releases the microphone before starting count-in and practice.

Presets: cello, violin, viola, double bass, standard guitar and high-G ukulele.
Chromatic mode shows concert/sounding pitch, including for transposing winds.
A4 calibration is 415–466 Hz, default 440 Hz. Presets use equal temperament.
Choose an input device after the first permission grant. Headphones help when
checking a reference tone; input is deliberately stopped during reference playback.

If microphone access is denied, enable desktop-app microphone access in Windows
Settings → Privacy & security → Microphone, then retry. Tuning processes PCM
locally using Pitchy's McLeod pitch method; no recording is saved or uploaded.
Minimizing/hiding the window, system sleep, input interruption and leaving the
tuner stop capture. A pending permission/capture result is also stopped if the
tuner has already closed.

Practice shows current and upcoming systems together, with count-in, speed,
audible/silent metronome, manual navigation and occurrence-based A–B loops.
One AudioContext clock drives both audio scheduling and visual musical position.
The score advances using confirmed timing. Live score following remains later work.

## Recognition and saved files

Original bytes and top-left normalized reading areas stay in the local library.
Completed recognized editions also reopen offline. New OMR uses the existing
[authenticated remote worker](../backend/README.md), configured under **设置**.
There is no preconfigured deployed service. Worker credentials use Windows DPAPI
through Electron safeStorage and are separate from project metadata. The renderer
cannot read the credential. Recognition uploads only the explicitly selected score.

Compare each recognized source page with its original before accepting it.
Worker errors are visible; a saved queued job can be queried again. Local reading
supports up to 20 pages; the existing worker limit remains 8 pages / 20 MiB.
Source documents, projects and encrypted settings are under the application's
per-user roaming data directory (`ScorePrep/library` and `ScorePrep/worker.json`).

## Build and checks

From this directory on Windows, with Node.js 24 and npm:

```powershell
npm ci
npm run build
npm start
npm test
npm run test:desktop
npm run package
```

The package command installs the pinned Electron runtime if needed and produces
a per-user NSIS installer. Build inputs are local TypeScript/React, bundled PDF.js,
Verovio WASM with the Humdrum importer and source fixtures from the parent repo.
No OMR engine/model executes on this PC. Apple code and shared CI are unchanged.
`electron/main.ts` owns persistence, dialogs, credentials, authenticated requests
and restricted IPC; `src/core` owns portable musical/pitch rules; `src/audio.ts`
owns local capture and playback lifecycle. Renderer Node integration is disabled,
with sandboxing, context isolation, a CSP and blocked external navigation.

See [verification](VERIFICATION.md), [design](DESIGN.md) and
[third-party notices](THIRD_PARTY.md).
