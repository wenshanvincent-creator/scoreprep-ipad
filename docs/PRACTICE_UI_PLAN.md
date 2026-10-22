# Reader / Practice UI plan

Plan only, 22 October 2026. Baseline: Reader a5c2aa8 and the integration
MVP_PLAN.md V3 read at 5b26b7b. Implementation awaits integration's explicit
confirmation that the combined V1 gate passed; phase ordering stays unchanged.

## Ownership and direction

Keep iPadOS 18, the native mobile-ios-design / swiftui-expert-skill guidance and
existing frontend-design direction: white paper, semantic chrome, rehearsal
blue, San Francisco controls and a small labeled active-position mark. Music
occupies the main surface; preparation uses sheets.

Integration owns one shared ScoreLibrary, ScoreCore mutations, composition and
the future transport. Reader owns preparation drafts, page/area selection,
reading size and drawing. Practice consumes transport state; it owns no second
playing flag, musical clock or advancement timer. Isolate frequent beat updates
from score drawing. Prepare, Read and Practice share the same saved score.

## Multiple complete-system areas on one page

Import currently creates one full-page SourceSystem per page; updateCrop edits
one existing rectangle. Reuse SourceSystem's existing pageIndex, stable ID,
normalized top-left bounds and optional confirmed timing for additional areas.

- Add a page-level Reading areas sheet: pinned full-original preview with
  numbered outlines; area list; Add, edit, remove and explicit reorder controls.
  Selecting a list entry selects its outline. Retain accessible edge sliders.
  Add starts a user-selected draft rectangle, never inferred staves or timing.
  Help says "Keep all staves, clefs and markings inside the outline."
- Save an ordered page-area collection atomically through the shared library.
  Preserve unchanged IDs/timing, clear timing only for changed crops, and leave
  new areas untimed. Reuse the import placeholder's ID for the first prepared
  area when appropriate; do not retain a duplicate full-page practice entry.
  Full-original reading remains independently available and bytes stay intact.
- Add a Reading order list using existing sections/system IDs, labeled by page
  and area. Root must reconcile page-area order and section membership in the
  same mutation; sorting rectangles by y must not silently rearrange custom
  sections/repeats. Removing an area shows route impact and removes references
  atomically rather than leaving dangling IDs.
- Preparation edits pause practice before committing and invalidate the compiled
  route. Root remaps or reports the resulting selection; old system offsets
  must not be reused against a changed route.

Needed root interfaces: save ordered page areas; reorder section membership;
remove an area with affected references; publish project/route revision and
valid selection. These are interface requirements, not implementations here.

## Current plus upcoming music

Practice replaces the one-area-only surface with a continuous music stand:
`title / mode -> current complete system -> upcoming complete system -> controls`.
Reuse original drawing; do not stretch notation or introduce dashboard cards.
Current and Up next derive from the performed route, including repeats and the
successor at an active loop boundary. End of passage replaces nonexistent next
music. Both complete systems should be visible in regular portrait/landscape.

| Space | Behavior |
| --- | --- |
| Portrait | Collapse library for practice; stack current/upcoming music at reading width. |
| Landscape | Hide library by default, keeping its native toggle; spend width on two stacked complete systems. |
| Narrow / short | Keep navigation identity and a vertical music surface. Scroll whole systems when needed; keep upcoming content and the chosen reading size. |
| Large text | Scale labels; reflow secondary controls into a sheet. Pause, Previous and Next remain in a reserved safe-area bar; notation size stays independently adjustable. |

Never truncate a piano staff to fit. Extreme height/reading-size combinations
need native prototypes to establish visible upcoming context. Use 44-point
controls, Reduce Motion and occurrence-qualified VoiceOver labels; beat pulses
must not repeatedly interrupt spoken navigation.

Verovio reflow and original crops have different coordinates. Clean practice
needs Rendering/Core to supply system IDs, layout revision and verified musical
links. Prepared original systems can support practice while this mapping is
unavailable; state that limitation and keep V1 page review accessible. Do not
reuse scan rectangles as SVG crops.

## Manual control and root transport interface

Proposed navigation policy: swipe and Previous/Next issue the same local command.
During play/count-in, it immediately pauses and seeks to the target performed
occurrence's beginning, remaining paused until Play. Pause holds the exact beat
offset. Root cancels queued audio/advancement and publishes authoritative focus
in the same UI event; no bar-end wait, network request or animation delays the
command, and a stale update must not undo it.

| Required interface | Meaning |
| --- | --- |
| Route / position | Project and route revision; current/upcoming occurrenceID + systemOffset with source systemID separately. Repeated source systems retain distinct performed positions. |
| Clock snapshot | Idle/count-in/playing/paused/ended/error; quarter-beat offset, meter/bar phase, explicit tempo pulse and beat phase from one clock. Count-in remaining is separate from passage beats. |
| Play, pause, seek, previous, next | Atomic local commands returning resulting position/available neighbors, including active loop boundaries; interruption of count-in consumes no passage beats. |
| Speed and audible/silent mode | Preserve logical musical position when speed changes; both sound modes share clock/focus. UI displays accepted state rather than rescaling another elapsed timer. |
| Count-in / system A-B loop | Root schedules and defines endpoints/successors. UI selects occurrence-qualified A/B. An explicit jump outside A-B pauses and deactivates the loop, retaining its selected endpoints. |
| Failure / invalidation | Report missing timing, invalid route or unavailable output. Keep manual reading available; Start identifies unconfirmed systems instead of inventing duration. |

Extend the timing sheet with performed quarter-note beats and starting bar phase,
alongside meter, BPM and explicit pulse. A bar-count-only editor cannot represent
every pickup/held passage. Root validates and compiles half-open spans and owns
end/loop behavior. The beat display samples that clock; it drives neither audio
nor automatic navigation. Voice/following code remains outside this UI work.

## Remaining gaps and later acceptance

- Combined V1 approval is pending for this workstream. Multi-area mutation/UI,
  reading-order editing, pickup/beat editing, current/upcoming composition and
  continuous transport/count-in/loop controls are absent. TempoPreview remains
  the existing one-bar spike.
- Clean-system/source/beat mapping and Verovio layout invalidation need a shared
  contract; page-level MusicXML alone does not provide them. Extreme compact
  layouts and spoken accessibility behavior remain unverified.
- After authorization, target real regressions: several areas survive reopen,
  reorder and deletion with intact originals/references; crops invalidate only
  affected timing; repeat focus stays distinct; queued advancement cannot undo
  manual interruption. Check pickup, 6/8 dotted pulse, count-in, speed changes,
  pause/resume, A-B wrapping and the final boundary against root's transport.
- Inspect composed native portrait/landscape, narrow and large-text captures
  with current/upcoming notation and crop controls. Distinguish simulator audio
  evidence from a real iPad/musician demonstration. This prose-only plan needs
  no new cloud test run.
