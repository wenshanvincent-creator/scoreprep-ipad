# ScorePrep Windows

- This Windows desktop client is explicitly authorized alongside the existing Apple app.
- Keep Apple targets, shared CI and native source untouched during this workstream.
- Preserve source bytes, normalized top-left reading areas, occurrence IDs,
  quarter-note timing, explicit tempo pulse units and visible worker errors.
- Use the AudioContext clock for practice audio and focus. Tuner input is local
  DSP only; request audio permission after Start listening and release input
  before reference playback, leaving tuning, starting practice or hiding the app.
- No local OMR/model execution. The existing authenticated remote worker stays
  the only recognition service. Never save credentials in project JSON.
- Build: npm run build. Targeted checks: npm test; npm run test:desktop.
- Inspect real packaged Windows UI and state the boundary between synthetic
  audio checks, OS microphone acquisition and Vincent's cello field test.
