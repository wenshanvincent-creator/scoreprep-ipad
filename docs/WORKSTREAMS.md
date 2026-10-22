# Parallel work

Use one repository with separate branches/worktrees, rather than separate
repositories. Wait for a passing foundation build and stable contracts before
starting native feature branches.

| Session | Owns | Initial task |
| --- | --- | --- |
| Integration | App composition, project.yml, workflows, shared ScoreCore contracts | Keep main buildable; integrate completed branches and verify the entire reading flow. |
| Reader and preparation | ScoreRendering, ScoreReader, ScoreLibrary and preparation views | Editable system crops, portrait/landscape layout, next-system context and PDF export. |
| Metronome and practice | ScoreAudio, TimingEditor and new practice controls | Continuous transport, beat-driven focus, count-in, speed, loops and interruption handling. |
| Pencil and release | Annotation integration and device validation | Start after source transforms stabilize; implement source-linked drawings and collect device evidence. |

Start with integration plus at most two feature sessions. Pencil work overlaps
the reader's coordinate transforms, so it should follow that contract.

Each session should:

1. Read AGENTS.md, the architecture and current main status.
2. Create its own branch/worktree from the latest agreed main commit.
3. Keep changes within its ownership; request an interface change before
   editing another session's module or the shared data model.
4. State what changed and provide relevant test/build results.
5. Return a commit/PR for integration. Do not push directly to main while
   another session is integrating.

## Reader session brief

Implement editable complete-system crops and readable iPad layout using the
existing SourceSystem and NormalizedRect contracts. Preserve full piano
systems and printed markings. Share view/export transforms. Do not add OMR or
change timing models. Verify coordinate and export behavior with owned
fixtures, and report physical-device coverage separately.

## Metronome session brief

Implement the continuous metronome/reader transport from CompiledTimeline.
Use an audio/host-time clock rather than accumulated UI timer callbacks.
Provide count-in, accents, visual-only mode, practice speed, tap tempo and
system-level loops. Handle pause/seek/loop invalidation and interruptions.
Do not infer score timing from image spacing or change reader coordinates.
Prove timing calculations separately from real audio/display synchronization.
Expose current timeline position and transport actions for integration into
the reader. Keep ScoreReader and ScoreLibrary changes in the reader workstream;
the integration session will connect the full-score practice entry point.
TimingEditor may demonstrate the owned transport controls without claiming
that full-score automatic advancement has been integrated. A narrowly scoped
project.yml change to add a dedicated audio unit-test target is permitted for
this session; leave the existing app and UI-test targets unchanged.

## Required UI preparation

Before either workstream implements interface changes, follow UI_SKILLS.md:
read the project-local native design/SwiftUI skills, write the workstream's
UI plan, and review native screenshots before delivery. The integration
environment's existing frontend-design skill provides the visual-direction
process. Respect the current iPadOS 18 target and the existing PDF/Pencil
bridges.

The first foundation build has passed; see BUILD_STATUS.md. Reader and
metronome work are the first two parallel sessions. Each receives an isolated
worktree and these skill requirements in its initial brief.
