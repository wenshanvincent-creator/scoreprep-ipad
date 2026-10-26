# ScorePrep Windows

- This Windows desktop client is explicitly authorized alongside the existing Apple app.
- Keep Apple targets, shared CI and native source untouched during this workstream.
- Preserve source bytes, normalized top-left reading areas, occurrence IDs,
  quarter-note timing, explicit tempo pulse units and visible worker errors.
- Use the AudioContext clock for practice audio and focus. Tuner input is local
  DSP only; request audio permission after Start listening and release input
  before reference playback, leaving tuning, starting practice or hiding the app.
- Vincent explicitly authorized local OMR/model inference on this development PC
  on 26 October 2026 for this Windows upgrade. Prefer local CPU recognition and
  bundle the inference runtime; no training. This supersedes the old remote-only
  rule for Windows. Keep the Apple app and existing remote worker unchanged.
- Import automatically recognizes and opens reflowed playable notation. Remove
  manual crop/timing/review gates and server/token configuration from Windows UI.
- Follow the actual performance, including slower playing and pauses; never label
  timer-based advancement as listening. Manual measure clicks reset following.
- Preserve original fingering. Recommendations favor low positions/fewer shifts;
  cello uses bass clef throughout without changing sounding pitch.
- Build: npm run build. Targeted checks: npm test; npm run test:desktop.
- Inspect real packaged Windows UI and state the boundary between synthetic
  audio checks, OS microphone acquisition and Vincent's cello field test.
