# UI skills and the design gate

Reviewed on 22 October 2026 before starting the parallel UI workstreams.

## Selected skills

| Skill | Role | Source |
| --- | --- | --- |
| frontend-design | Subject-specific visual direction and plan/build/screenshot critique. The integration environment already provides this skill; it is not redistributed here. | [Skill listing](https://skills.sh/anthropics/skills/frontend-design) |
| mobile-ios-design | Native navigation, adaptable iPad layouts, semantic typography, touch interaction and accessibility. | [Source](https://github.com/wshobson/agents/tree/main/plugins/ui-design/skills/mobile-ios-design) |
| swiftui-expert-skill | SwiftUI data flow, stable identity, resizable layouts, rendering and accessible controls. | [Source](https://github.com/avdlee/swiftui-agent-skill/tree/main/skills/swiftui-expert-skill) |

The two native skills are installed as project-local copies under
.agents/skills and recorded in skills-lock.json. Their upstream MIT licenses
are retained alongside them. Read the relevant referenced documents, not just
the skill names. Treat examples as guidance and verify needed APIs against
Apple's documentation and the actual SDK.

Discovery found other skills, including swiftui-pro and web-oriented taste
skills. The selected pair separates native UI guidance from implementation
guidance. The local design-taste-frontend skill explicitly excludes app
screens, so it is not the design authority for this iPad interface.

## Required preflight

1. Read this guide, DESIGN.md and both project-local SKILL.md files. Use the
   installed frontend-design skill when available for the visual-direction
   process. Do not copy its local licensed source into the public repository.
2. Before UI code, write a compact plan in the workstream's own
   READER_UI_PLAN.md or METRONOME_UI_PLAN.md. Describe the main action,
   hierarchy, state ownership, layout adaptations and relevant accessibility
   behavior.
3. Review that plan against the music-reading task. Music stays dominant;
   preparation and practice controls should not compete with the score.
4. Build using the project's current iPadOS 18 target. Do not adopt newer APIs
   solely because a skill mentions them, migrate unrelated models or add visual
   effects unrelated to reading. PDFKit and PencilKit bridges are intentional.
5. Capture and inspect native UI in portrait and landscape, plus a narrow iPad
   window when relevant. Check larger text settings, meaningful VoiceOver
   labels, adequate touch targets and Reduce Motion behavior for the changed UI.
6. Fix observed clipping, hidden controls, unreadable music or interaction
   conflicts before presenting the UI as complete. State which checks were
   simulator checks and which were performed on hardware.

Use the existing first-build screenshot in BUILD_STATUS.md as a factual
baseline, not a visual limit. The skill gate is part of each session's initial
instructions and applies before feature UI implementation.
