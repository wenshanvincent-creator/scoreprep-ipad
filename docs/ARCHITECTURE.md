# Architecture

## Boundaries

ScoreCore owns the Codable project, normalized source rectangles, section
occurrences and timing compilation. Source-system coordinates are normalized
from the top-left of the displayed source page. Native renderers translate
PDF coordinate conventions at their boundary.

ScoreRendering owns PDF/image drawing and, later, annotation projection and
export. It must render from original content rather than UI thumbnails.

ScoreAudio owns audio scheduling and the continuous playback transport.
TempoPreview is a short one-bar spike, not the finished synchronized transport.

ScoreApp owns navigation, local storage and integration. Original imported PDFs
are copied into app-owned storage before their security-scoped access ends.
The project stores only the relative source filename.

## Shared contracts

- TimeSignature expresses a numerator and denominator.
- BeatUnit explicitly defines quarter-note beats per tempo pulse.
- TimingSegment expresses performed quarter-note beats and a reference tempo.
  Its starting bar phase is available for pickups and future accent scheduling.
- SourceSystem references one source page, one normalized crop and optional
  confirmed timing. Untimed systems cannot compile into automatic playback.
- ScoreSection lists source-system IDs.
- SectionOccurrence gives each traversal of a section its own identity.
- TimelineCompiler expands occurrences into stable system spans. A repeated
  source system is still the same source; its playback occurrence is distinct.
- CompiledTimeline uses half-open time spans. A boundary belongs to the next
  system; the final endpoint means playback has finished.

The first app edits timing for one source system at a time. The continuous
transport will derive visual focus and audio events from one clock, preserving
logical musical position through pauses, seeks, speed changes and loops.

## Validation boundaries

PDF import verifies the format, readability and supported page count.
Timeline compilation verifies references and confirmed musical timing.
Local-store decoding surfaces malformed metadata as an error. View code should
not silently replace invalid projects with a demo.

## Build

project.yml is the source of the native Xcode project. XcodeGen generates
ScorePrep.xcodeproj so parallel sessions do not edit a generated project file.
The app links the local ScoreCore package; there are no runtime third-party
dependencies in the initial milestone.
