# Windows preview verification — 23 October 2026

Windows client branch: `feat/windows-tuner`, based on Apple main
`4743f42046551495f3557acdd2f01bd8896025b6`. Apple sources, native project and
shared workflow files are untouched. This is an additional Electron client.

## Checks completed

- TypeScript check and Vite/esbuild production build pass with Node 24.19.0.
- Ten targeted core checks pass: pickup/count-in and half-open line boundaries,
  compound tempo pulses, nondividing pulse grids across A–B cycles, pause/resume,
  speed changes, seek outside loops, terminal fractional pulse display, independent
  repeated occurrences, unconfirmed timing rejection and worker result identity.
- Tuning checks cover all four cello strings at 44.1 and 48 kHz, with offsets
  −23/0/+19 cents and a second harmonic stronger than the fundamental. Error is
  below 0.6 cents for these synthesized inputs. Silence, weak input and seeded
  noise produce no success reading. Manual C2 target with C3 input reports +1200
  cents. A4=442 calibrates A3 to 221 Hz.
- Bundled Verovio 6.3.0 WASM `musicxml-hum` preserves all 64 pitch/onset/duration
  events across both staves of the repository's untouched actual homr result.
  This reuses recorded remote output; it does not run OMR locally.
- Four real Electron/Windows UI checks pass: source exercise/save/cold reopen;
  tuner and practice transport; two-page PDF import/second-page drag-crop and
  confirmed timing; authenticated worker protocol/review with a local contract
  replay server. That server checks bearer authentication and exact source bytes,
  returns a real 503 before explicit resume, then replays actual saved homr XML.
  DPAPI ciphertext is saved and subsequently decrypted for the request; project
  JSON and renderer settings never contain the token.
- The capture check sends harmonic-rich C2 at −15 cents through Chromium's fake
  audio device and the actual getUserMedia → analyser → worker → UI path.
  It checks no implicit capture, reference playback cleanup, minimize/restore,
  closing the tuner, simulated input loss, late capture completion after close,
  proceeding into practice, and permission denial. All acquired tracks end.
- Real window screenshots were inspected at default and 800px window widths.
  Practice controls, current music and upcoming context fit in the same viewport.
  PDF preparation and original/recognized notation comparison were inspected.

Commands: `npm run build`, `npm test`, `npm run test:desktop`. Checks were rerun
only for changed behavior or a diagnosed failure. Screenshot examples are under
`docs/screenshots/`; temporary traces and data stay ignored.

## Evidence boundary

The frequency measurements use synthesized audio, not Vincent's cello. Chromium's
fake capture device does not establish a physical Windows microphone's sensitivity,
driver behavior, bow noise or room-noise performance. Real cello/microphone rehearsal
is Vincent's next acceptance check. Choose a string manually first, especially C2.
New remote OMR needs the configured private service; the Windows protocol replay
is not a new cloud inference run. Existing remote inference evidence remains in
[the original homr receipt](../backend/fixtures/observed-homr/README.md).

This preview has no code-signing certificate, auto-update or cross-device library
sync. The installer is per-user and the same installed app works offline for
original reading, saved recognized editions, practice and tuning.
