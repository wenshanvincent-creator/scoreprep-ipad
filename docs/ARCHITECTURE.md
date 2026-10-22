# Architecture

## Recognition pipeline

Keep the existing source reader and musical-timing foundation. V1 adds a remote
homr worker, a thin native recognition client and a Verovio rendering view.
MusicXML is the interchange artifact for recognized notation. Original-page
coordinates remain the authority for source images and existing markings.
Do not replace those two representations with one lossy model.

ScoreRecognition owns the native client and result contract;
ScoreRendering/Recognition owns the engraving view; backend wraps the existing
OMR engine. Shared ScoreCore persistence and app composition are integrated
separately. V1's actual cloud OMR output and native Verovio evidence are recorded
in V1_NATIVE_VERIFICATION.md.

## Boundaries

ScoreCore owns the Codable project, normalized source rectangles, section
occurrences and timing compilation. Source-system coordinates are normalized
from the top-left of the displayed source page. Native renderers translate
PDF coordinate conventions at their boundary.

ScoreRendering owns PDF/image drawing and, later, annotation projection and
export. It must render from original content rather than UI thumbnails.

ScoreCore owns the continuous PracticeTransport clock mapping and pulse planner.
ScoreAudio's native PracticeController samples that transport and schedules
clicks through AVAudioPlayerNode using the same monotonic host clock. Its short
lookahead wakeups do not accumulate musical time. TempoPreview remains the
independent one-bar timing-editor preview.

ScoreApp owns navigation, local storage and integration. Original imported PDFs
are copied into app-owned storage before their security-scoped access ends.
The project stores only the relative source filename.

## Shared contracts

- TimeSignature expresses a numerator and denominator.
- BeatUnit explicitly defines quarter-note beats per tempo pulse.
- TimingSegment expresses performed quarter-note beats and a reference tempo.
  Its starting bar phase drives pickup entrances and pulse accent scheduling.
- SourceSystem references one source page, one normalized crop and optional
  confirmed timing. Untimed systems cannot compile into automatic playback.
- ScoreSection lists source-system IDs.
- SectionOccurrence gives each traversal of a section its own identity.
- TimelineCompiler expands occurrences into stable system spans. A repeated
  source system is still the same source; its playback occurrence is distinct.
- CompiledTimeline uses half-open time spans. A boundary belongs to the next
  system; the final endpoint means playback has finished.
- ScoreProject.recognizedEdition is optional so existing library JSON still
  decodes. RecognizedEdition stores the engine identity, date and ordered
  RecognizedSourcePage records. Each record keeps its zero-based source page,
  app-generated local MusicXML filename and unreviewed/accepted/rejected state.
  These records never replace the original source filename, crops or timing.
- PendingRecognition retains a remote job ID, worker URL and original checksum
  so polling can resume. Worker credentials stay in Keychain, outside project
  JSON. Results must match the pending job and original bytes before saving.

TimingEditor edits the complete ordered timing array for one source system at
a time. Its starting beat is one-based using the written denominator; storage
retains quarter-note phase and untouched values exactly. ScorePreparation is a
sheet draft that validates against the actual source page count and applies to
the latest project, preserving recognition metadata and unchanged timing.

PracticeView owns one controller for an immutable compiled route. Current and
upcoming music use occurrence IDs; repeated source systems remain distinct.
Preparation changes invalidate that presentation. Display refresh samples the
transport, and audible and silent beats consume the same pulse state. Pause,
seek, speed, sound and loop commands cancel old scheduled audio generations.
Backgrounding or an audio interruption pauses without automatic resume.
See PRACTICE_CONTROLLER_API.md for the native interface and timing semantics.

## Validation boundaries

PDF import verifies the format, readability and supported page count.
Timeline compilation verifies references and confirmed musical timing.
Local-store decoding surfaces malformed metadata as an error. View code should
not silently replace invalid projects with a demo.

## Build

project.yml is the source of the native Xcode project. XcodeGen generates
ScorePrep.xcodeproj so parallel sessions do not edit a generated project file.
The app links the local ScoreCore package and the pinned native Verovio toolkit.
tools/prepare_verovio.py prepares its local Swift package in build/dependencies
from an exact upstream revision and applies the documented narrow humlib bounds
guards. Both native CI entry points run this preparation before XcodeGen.
Its built-in musicxml-hum import path preserves the interleaved piano voices
returned by homr. The remote worker runs the existing OMR models; the iPad
retains the original and saves per-source-page MusicXML for offline engraving.
