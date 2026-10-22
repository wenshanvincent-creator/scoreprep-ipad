# Parallel work

Current milestone: **v0.1 practice engineering gate passed**.
Read MVP_PLAN.md, ARCHITECTURE.md and UI_SKILLS.md before implementing.

V1's native engineering gate passed at 276418b, including inspected integrated
portrait/landscape and offline-reopen captures. V2's integrated native gate
passed at a60b347, including its UI, live mixer and automatic repeat checks.
Recognition's final native gate also passed at 06cdab1. Integration owns the
accepted sources and evidence in PRACTICE_VERIFICATION.md. Voice and following
stay outside this preview.

| Chat | Owns | Current task |
| --- | --- | --- |
| Integration | Shared ScoreCore contracts, app entry point, project.yml and workflows | v0.1 integrated and verified; owns evidence and follow-up scope. |
| Reader and preparation | Preparation/timing views, ScoreReader and focused LibraryView wiring; owned reader UI tests | Implemented and integrated; idle pending a new scoped task. |
| Recognition and rendering chat, continuing as Metronome/Practice | ScoreAudio, pulse-planning code/tests, controller API and recognition harness | Implemented, integrated and verified; idle pending a new scoped task. |

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
