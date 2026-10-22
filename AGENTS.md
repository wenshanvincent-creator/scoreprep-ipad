# Working on ScorePrep

- Build a native iPad app. Keep musical content readable and preserve original
  notation, source coordinates and user markings.
- Read docs/ARCHITECTURE.md and docs/WORKSTREAMS.md before changing shared
  models or working in parallel.
- Packages/ScoreCore is plain Swift. Do not import UIKit, SwiftUI, PDFKit or
  AVFoundation there.
- Keep one musical timing convention: quarter-note beats. Tempo pulse units
  are explicit; 6/8 does not imply a quarter-note metronome pulse.
- Validate imported documents and confirmed timing at their input boundaries.
  Surface actual failures; do not invent timing for an unconfirmed score.
- Each parallel session uses its own branch and worktree. Inspect status before
  editing. The integration session owns project.yml, workflow files, app
  composition and shared-model changes.
- Do not commit private scores, account information, signing material or local
  machine paths. Use the app's generated exercise or redistributable fixtures.
- No real model execution on the development PC. OMR is outside this milestone.
- Core check on macOS: swift test --package-path Packages/ScoreCore.
- Native check on macOS: bash tools/ci.sh. Review simulator artifacts and state
  precisely which device/audio features were actually tested.
- Add tests for realistic timing, route, persistence or coordinate regressions.
  Do not add tests for trivial UI formatting or re-run checks without a reason.
