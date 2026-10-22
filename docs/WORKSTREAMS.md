# Parallel work

Current phase: **V1 — import, recognize, clean display, manual swipe**.
Read MVP_PLAN.md, ARCHITECTURE.md and UI_SKILLS.md before implementing.

| Chat | Owns | Current task |
| --- | --- | --- |
| Integration | Shared ScoreCore contracts, app entry point, project.yml and workflows | Contracts, composition and end-to-end V1 verification. |
| Reader and preparation | ScoreApp except ScorePrepApp.swift; existing PDF rendering and preparation views | PDF/image import, local originals, manual navigation and review integration. |
| Recognition and rendering | ScoreRecognition, ScoreRendering/Recognition, backend and owned tests/fixtures | Remote oemer wrapper, typed client and Verovio rendering component. |
| Metronome and practice | ScoreAudio and practice controls | Deferred until V1 passes. |

Each active chat uses its own branch/worktree. Inspect local and remote state,
keep to owned paths, and return a commit/draft PR. Do not push or merge main.
Integration owns shared contracts and composition. Recognition/Rendering may
make narrowly scoped project.yml additions for its sources, Verovio dependency
and dedicated tests, preserving the existing targets/toolchain.

Before UI code, read the installed mobile-ios-design and swiftui-expert-skill
instructions and the existing frontend-design process. Write READER_UI_PLAN.md
or RECOGNITION_UI_PLAN.md under docs. Inspect actual native portrait/landscape
screenshots before delivery.

No model inference on the development PC, no custom training, no hosting
purchase or unauthenticated production deployment. Preserve original scores
and surface actual errors. Do not implement voice or score following in V1.
