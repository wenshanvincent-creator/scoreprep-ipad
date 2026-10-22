# Parallel work

Current phase: **V2 — tempo-guided practice completing v0.1**.
Read MVP_PLAN.md, ARCHITECTURE.md and UI_SKILLS.md before implementing.

V1's native engineering gate passed at 276418b, including inspected integrated
portrait/landscape and offline-reopen captures. V2 remains separate work until
its UI, audio and demonstration checks pass. Voice and following stay deferred.

| Chat | Owns | Current task |
| --- | --- | --- |
| Integration | Shared ScoreCore contracts, app entry point, project.yml and workflows | Review/composition, V2 native verification and the reproducible practice demonstration. |
| Reader and preparation | Preparation/timing views, ScoreReader and focused LibraryView callback wiring; owned reader UI tests | Multi-area editing, explicit reading order and pickup/full timing arrays; then current/upcoming practice view. |
| Recognition and rendering chat, continuing as Metronome/Practice | ScoreAudio, new pulse-planning code/tests and documented controller API | Shared-clock audible/silent metronome, count-in, speed/loops and immediate interruption. Recognition code is stable. |

Each active chat uses its own branch/worktree. Inspect local and remote state,
keep to owned paths, and return a commit/draft PR. Workstream chats do not push
or merge main; integration merges reviewed PRs after their recorded gates pass.
Integration owns shared contracts and composition. Recognition/Rendering may
make narrowly scoped project.yml additions for its sources, Verovio dependency
and dedicated tests, preserving the existing targets/toolchain.
For the V2 handoff, integration authorizes the audio chat to add the new pure
pulse planner and narrowly extend PracticeTransport if its documented API needs
it. Coordinate before changing existing ScoreCore persistence or reader files.
The reader chat does not edit ScoreAudio or recognition integration tests.

Before UI code, read the installed mobile-ios-design and swiftui-expert-skill
instructions and the existing frontend-design process. Write READER_UI_PLAN.md
or RECOGNITION_UI_PLAN.md under docs. Inspect actual native portrait/landscape
screenshots before delivery.

No model inference on the development PC, no custom training, no hosting
purchase or unauthenticated production deployment. Preserve original scores
and surface actual errors. Do not implement voice or score following in V1.
