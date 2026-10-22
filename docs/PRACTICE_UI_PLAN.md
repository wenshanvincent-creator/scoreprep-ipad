# Reader / Practice UI plan

Updated 22 October 2026. The original plan used Reader a5c2aa8 and integration
MVP_PLAN.md at 5b26b7b. Independent practice implementation is now authorized on
the shared practice foundation; integration retains the final V1 capture/merge
gate. Preparation and controller wiring below are implemented checkpoints,
with native interaction and layout acceptance still pending.

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
  and area. Save page catalog and explicit section membership in the
  same mutation; catalog moves preserve every existing section sequence; sorting rectangles by y must not silently rearrange custom
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

- Combined V1 approval remains integration's gate. Preparation, reading order,
  fractional multi-segment timing and the first current/upcoming controller
  wiring and authoritative pulse display are implemented on the independent
  practice branch. Native UI acceptance is pending.
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
  evidence from a real iPad/musician demonstration. Root coordinates the next
  native run; do not trigger duplicate builds for intermediate checkpoints.

## Preparation / timing implementation slice

Authorized independent practice work now starts at shared commit 2242efb,
while integration retains the final V1 capture/merge gate. This first slice
implemented preparation and timing first. Current/upcoming practice composition
now uses the subsequently supplied audio controller contract below.

Concrete interfaces: seed a local ScorePreparation(project:) draft, mutate its
systems/sections/readingOrder explicitly, then call the existing
ScoreLibrary.savePreparation(projectID:draft:) once. Keep source-area and repeat
occurrence UUIDs. Catalog moves affect manual browsing only; section membership
and musical order change explicitly in Reading order and save in the same draft. Root's
applying(to:) preserves latest recognition/source data and unchanged-area timing.
Save timing through updateTiming(projectID:systemID:segments:) with the entire
array, never a rounded bar count or only its first segment.

UI: a native page-sized preparation sheet has Areas / Reading order modes.
Keep an outlined full-page preview beside controls in wide layouts and pinned
above a scrolling list in narrow/large-text layouts. Explicit Add, move up/down,
remove and section membership controls work without spatial order inference.
Source review and original-page access remain in the reader. A separate timing
sheet edits a stable-identity list of segments: duration in fractional quarter-note beats, a one-based starting beat using the
written denominator, numerator/denominator, BPM and explicit pulse unit. Convert
that beat to Core quarter-beat phase internally; retain untouched phase exactly.
Numeric input is validated on save; invalid text never silently keeps an old
number. Preserve all untouched segment values and show actual validation errors.

Evidence: focused draft-operation/persistence tests plus native interaction
checks for add/reorder/remove, repeat identities, atomic save/cancel, fractional
pickup and multi-segment cold reopen. Use the owned pickup-and-pulse fixture
when resource wiring is available; existing generated source remains usable.
Do not launch duplicate builds while root verification is active. This work
adds no transport clock, playing flag, voice, following or model inference.

PracticeView lifecycle requirement for its later controller-wiring slice:
keep UIApplication.shared.isIdleTimerDisabled true while the music stand is
visible and foreground-active, including paused rehearsal. Restore normal idle
behavior on exit or backgrounding; restore the visible-view policy on foreground
return. This belongs to view/composition lifecycle, independent of audio or
playing state, with no new settings screen. API checked against
[Apple UIApplication.isIdleTimerDisabled](https://developer.apple.com/documentation/uikit/uiapplication/isidletimerdisabled).

## Concrete practice controller wiring

The preparation/timing slice is committed separately (7c60689; exercise wiring
at aad5851). PracticeView now targets controller interface 98c6c55, constructing
one StateObject per confirmed compiled route and observing its exact current /
upcoming spans. Play/pause/resume/stop, manual seek, speed, audible/silent mode,
count-in seconds and occurrence-qualified A-B selection call the controller.
No view timer, counter, audio scheduler or duplicate pulse/meter arithmetic is
added. The authoritative pulse display uses Audio's subsequently supplied state
as described below.

Pulse-display slice: consume Audio 8b293d9's `currentPulse` directly in a small
status child. Display its one-based denominator beat, downbeat accent and
sampled progress in both sound modes and count-in. A static neutral marker
replaces it while ready/paused/finished; Reduce Motion omits the progress ring.
Do not infer pulse counts from meter, schedule animation with a second clock,
or announce every pulse through VoiceOver. The notation subtree stays isolated
from these frequent updates. Native tests must observe a visible pulse in
silent count-in and playback, and its disappearance on manual pause.

Focused UI checks now cover count-in and running manual interruption, explicit
resume, end/stop, repeat-occurrence loop endpoints and wrapping, original-page
access, fresh-controller reopening, large-text transport reachability, and
unconfirmed-source rejection with manual reading retained. They export native
portrait/landscape/large-text and repeat-loop captures when root runs the suite.
These checks have been authored, not yet executed on this practice UI head.

A separate automatic-advance UI take starts at area 1, silent at 100% with no
count-in, and makes no transport or navigation commands after Play. It observes
area 2 at 5 seconds, area 3 at 9 seconds and Finished at 13 seconds, with a
runner-clock bracket around Play and 1.25 seconds of UI observation allowance.
It captures all three current/upcoming compositions and attaches measured
timing JSON. This verifies automatic visible focus independently of the manual
Next/end test; exact transport/audio timing remains covered by their own tests.

First composed native candidate bc3c8b1 (run 39788035850) compiled and passed
34 Core, 13 native and the existing 7 UI tests. The six new practice UI tests
failed before their intended assertions: collapsed portrait sidebar, ambiguous
global Done selectors, a partly clipped Add menu row, and offscreen segment
fields. Focused corrections open the actual sidebar, uniquely identify sheet
completion/menu choices, and reveal complete targets inside their own Form
viewport before each action. Landscape tests now apply rotation after launch
and assert app-frame orientation. Original action, persistence and automatic
5/9/13-second boundary assertions remain. The corrected UI tests await root's
next composed native run.

A full-screen practice presentation pauses on disappearance. Preparation/timing
changes invalidate it; reopening compiles a fresh controller. Invalid timing
keeps the original reader available with the actual preparation error. Original
pages remain reachable from both reader and practice. Foreground-visible practice
keeps the idle timer disabled even while paused; exit/background restores normal
idle behavior. This lifecycle policy is separate from controller scheduling.

Catalog-order correction: moveArea changes systems on that source page only.
A custom C,A,B section or repeated A,B,A membership sequence is preserved along
with occurrence UUIDs; the section editor is the authority for musical order.
Starting beat in bar is one-based: 4/4 beat 4 maps to Core phase 3, and 6/8 beat 4
to phase 1.5. Untouched values retain the original Core phase exactly even when
one-based floating-point display conversion would otherwise introduce rounding.
