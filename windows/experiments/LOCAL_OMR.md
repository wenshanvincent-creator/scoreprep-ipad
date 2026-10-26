# Local recognition engine comparison — 26 October 2026

The installed Windows client remains on Audiveris 5.11.0. These are real CPU
inference experiments, not an application update or a release acceptance result.
The reported dense printed cello page and every derived score remain private,
under ignored `.test-data/`. No user notation is included in this repository.

## Observed results

The source page has common time. A full bar below means four quarter-note beats;
this measures structural consistency, not pitch, symbol or fingering accuracy.

| Method | Seconds | Exported bars | Full bars | Recognized fingerings |
| --- | ---: | ---: | ---: | ---: |
| Audiveris, smooth 3x enlargement, adaptive threshold | 127.72 | 25 | 9 | 0 |
| Audiveris, same image, global threshold 110 | 285.26 | no export | — | — |
| Audiveris, same image, global threshold 160 | 164.01 | 25 | 14 | 9 |
| homr, original JPEG, upstream tuplet cleanup enabled | 83.35 | 25 | 25 | 0 |
| homr, original JPEG, upstream tuplet cleanup disabled | 131.12 | 25 | 22 | 0 |

Audiveris's first bar omitted its first note and lost the beams of the next
three notes. The alternate threshold did not repair that bar. It therefore
has not been enabled as an automatic recovery path.

Both homr runs exported 400 pitched notes. They recovered the first bar's 16
sixteenth-note events, including the previously omitted note. Visual comparison
still found a wrong chromatic alteration in that bar. There is no full-page
ground truth, so these counts are not an assertion of 400 correct notes.

With upstream tuplet cleanup disabled, bars 8 and 10 lasted 11/3 quarter beats,
and bar 25 lasted 19/5. The application correctly rejected bar 8. Upstream's
cleanup removes tuplets from bars shorter than its estimated typical duration;
using its postprocessed result alone would conceal this recognition problem.

The existing owned four-bar cello image was also recognized with cleanup disabled
in 13.62 seconds. Against its original MusicXML, all 16 pitch/onset/duration
events matched, including the tenor-to-bass clef change. All 16 printed fingerings
were omitted. This distinguishes note accuracy from preserving source markings.

## Actual engraving check

The postprocessed dense result passed `prepareMusic` and produced 400 performance
events through Verovio's timemap. Its SVG was rendered and visually inspected.
The output had no explicit MusicXML accidentals or beams. Although 116 pitch
alterations were present, all 116 SVG accidental groups were empty. The display
therefore omitted chromatic signs and left sixteenth notes individually flagged.
Reordering pitch children to the MusicXML schema did not change that behavior.
Successful MusicXML parsing and playback compilation are insufficient acceptance.

Subsequent Windows core work completed the missing accidental and beam display
without rewriting the candidate's pitch or duration events; see
[the engraving verification](../VERIFICATION.md#engraving-completion-during-recognition-optimization).
The clearer rendering also exposed a wrong treble-clef interpretation in bars
21–22, confirmed against the source image and the other engine's staff geometry.
Recognition accuracy and source-fingering retention remain unfinished.

Before integrating a complementary engine, the unresolved work is: image-backed
accidental decisions, retaining printed fingerings, distinguishing fingering
numerals from actual tuplets, and exporting explicit readable notation. Neither
silently changing durations to fill bars nor copying uncertain attributes from
another engine is a validated solution.

## Reproduction tools

- `scripts/evaluate-homr.py SOURCE NEW_PRIVATE_OUTPUT` runs the pinned homr
  revision in an independently prepared Python evaluation environment. It verifies
  the three fp32 model hashes, uses CPU only, two intra-op threads and segmentation
  batch size one. It copies the input, records source integrity, versions, exit
  status, elapsed time and model hashes. It does not download or train models or
  write to the application's library. Tuplet cleanup is disabled by default;
  `--upstream-tuplet-cleanup` explicitly enables the upstream heuristic for comparison.
- `node --import tsx scripts/inspect-recognition.ts INPUT NEW_PRIVATE_OUTPUT [REFERENCE]`
  applies the existing cello preparation and Verovio pipeline, exports SVG pages,
  and reports validation and performance results. With a reference it also checks
  exact pitch/onset/duration events and retention of original fingerings. Without
  one it explicitly reports musical accuracy as unevaluated. It generates no
  recommended fingerings during inspection.

Run these from `windows/`, one inference process at a time. The model files must
already be available; see the pinned asset provenance in
[`backend/notices/PROVENANCE.md`](../../backend/notices/PROVENANCE.md).

Engine revision:
[`ab369ac54277afab582afa4725441f7cbba76593`](https://github.com/liebharc/homr/tree/ab369ac54277afab582afa4725441f7cbba76593).
The observed evaluation environment used Python 3.13.9, ONNX Runtime 1.29.0,
NumPy 2.3.5 and OpenCV 4.13.0. Dependency/model packaging is not included in the
Windows installer. The existing Apple application and remote worker are unchanged.

## Source marks and malformed tuplets

Source-note association now projects the head row from independent staff/clef
geometry and registers single-voice note order against detected heads. Pairings
must be shared by every optimal registration; ambiguous repetitions abstain.
Actual homr output on the original owned 16-note exercise, combined with actual
glyph observations, restores every printed fingering on its correct note without
altering pitch/onset/duration. Existing fingerings remain authoritative.

The new owned 28-note exercise independently covers dense sixteenth-note beams,
real triplets and quintuplets. Its original MusicXML and renderer-supplied head
positions are the reference; actual Audiveris/OCR outputs supply source evidence.
Introducing a four-note 3:2 error and omitting its fingerings is fully recovered
to that reference, including all nine original fingerings, while retaining both
real tuplets. Unexplained numeral and incomplete-beam-group cases abstain.

The recovery decision requires distinct source heads and stems, exactly the
expected beam count in a complete shared physical group, and a supported
fingering 0 or 1; source tuplet glyphs and unexplained numerals prevent changes.
No target meter length enters this decision. On the private dense-page baseline,
two of the three malformed groups are repaired. The last group remains unresolved
because of the digit-font ambiguity. The inspector now explicitly lists partial
measures: this known 3.8-quarter final bar remains visible even though the normal
parser permits a partial first/final bar for legitimate incomplete measures.

Glyph-only separation of the top staff edge uncovers a real touching fingering 1.
It adds only that observation on the private page, unlike the rejected five-line
removal experiment, and leaves the music-model input unchanged. A real CPU OCR
regression retains all 16 owned digits after synthetic staff-line contact without
duplicates or input changes. English OCR was evaluated but did not resolve the
old-font 3/8 ambiguity, so it was not adopted.

The 11 targeted layout/association/rhythm checks, two real glyph OCR checks and
Windows build pass. Full private-page reference comparison, accidental and
ornament recovery, packaged worker integration and installed replacement remain
unfinished. This is development evidence, not an installed-app acceptance result.

The first measure's known anticipated-flat error is now recovered from its two
literal surrounding signs and three matched source heads within the same physical
bar. A new original 16-note chromatic reference and actual Audiveris geometry
check carried naturals, octave-specific state and bar resets. The recovery leaves
explicit conflicting signs and missing/broken source evidence untouched. The
three new checks and the 11 existing related checks pass, as does the Windows
build. On the private source, the manually transcribed first-bar reference now
matches all 16 pitch/onset/duration events, four fingerings and 16 staccato marks;
the actual rendered first system was inspected. This comparison covers that bar,
not the whole page.

A further comparison view masked only five recognized fingering glyphs at the
five false trill locations, preserving the imported source. Actual pinned CPU
inference took 48.75 seconds: all five trills disappeared while all 400 pitched
note/type-duration events were identical to the unmasked baseline. The same three
raw malformed tuplets remained. This is causal evidence for the observed glyph
confusion; it has not been integrated as an ornament correction. An owned case
containing a real trill alongside a fingering remains necessary before adoption.

## Automatic desktop candidate

The owned real-trill control is now implemented: eight quarter notes with three
printed finger-4 marks, two sharing genuine trills. Actual inference invents one
extra trill; a copy masking only those digits preserves both genuine trills,
removes the extra and retains every musical event. Source-head/context matching
permits only that occurrence's correction, followed by original fingering recovery.
Three decision regressions cover the real results and rejection of changed
pitches, weak glyph evidence or missing physical ownership. The same policy
resolves the five private-page false trills without changing its 400 core events.

The desktop now runs the complementary pipeline automatically on every canonical
page. Its portable Python 3.12.14 runtime, exact dependencies and CPU models are
bundled alongside Audiveris; no developer interpreter or network service is used.
Each page's source geometry, original glyphs and corrections are reconciled
before multi-page joining. A known unresolved source-backed final-bar tuplet is
rejected explicitly, despite the general parser allowing legitimate final pickups.
The private dense page still has the old-font 3/8 ambiguity and final timing issue;
full independent transcription and installation acceptance remain unfinished.

Actual screenshot inspection exposed a separate piano defect that parsed event
comparison missed: the direct engraver mishandled interleaved short backups.
Normalizing explicit note times into contiguous voice/staff lanes restores all
64 rendered onsets/ends and the independent reference's 32 attack groups/quarters.
True chord membership and printed fingerings are retained. These two renderer
regressions pass alongside the existing 31 checks; the Windows build passes.

The first repackaged image/reopen and ornament imports passed, but a two-page PDF
hit the test's 150-second limit near its second-page completion, and small-image
import exposed a transient Windows EPERM while replacing project metadata.
The PDF allowance is now 240 seconds. Metadata replacement now waits a bounded
1.575 seconds for this specific Windows error, preserving old JSON and propagating
failure if the lock persists. A real Windows file-handle regression passes.
These findings prompted another complete packaged import run before acceptance.

That four-case packaged run now passes (6.2 minutes total), including both PDF
pages, automatic small-image recovery and real trill/fingering reconciliation.
The actual saved piano editions also match all independently rendered start/end
times: image 64 events/32 attack groups/32 quarters; PDF 128/64/64. The small
cello result matches all 16 original note events and fingerings. Source bytes
remain unchanged and screenshots show the corrected voice alignment. This
does not resolve the private dense page or replace the installed application.

## Role-conditioned printed digits

Further comparisons of raw/isolated glyphs, nearby-digit strips, contrast views,
PP-OCRv5 Latin/server and PP-OCRv6 small did not consistently resolve the old-font
3/8 confusion. They were not adopted as replacement models. The server variant
took 241.34 seconds on the owned 28-component image, so its full-page trial was
stopped after that measured latency result. Downloaded comparison weights remain
private evaluation assets and are not bundled.

The current worker instead rereads only numerals in independently established
complete fingering rows, with explicit source heads/beams and tuplet protection.
CTC single-character likelihoods retain both absolute evidence and the posterior
conditioned on the fingering alphabet; a large conditional value alone cannot
authorize a change. The new owned 36-note/12-fingering source includes genuine
3/5/8 tuplets and actual layout/OCR outputs. Its deliberately corrupted digit
observation recovers from the original pixels, while a real printed octuplet 8,
incomplete row and missing beam evidence abstain. Four targeted decision tests,
the ten existing association/ornament/rhythm checks, three actual glyph-model
checks and the Windows build pass.

On the private page, this resolves the last group's 3/2/0 readings and supports
the remaining four-note false 5:4 repair from its complete two-beam source group.
An independent transcription made directly from the original final measure now
matches all 16 pitch/onset/duration events and seven printed fingerings. Its final
written accidental carry is retained, rather than inferred from a printed 0.
All three known malformed groups are now source-supported repairs; no target
meter fullness is used. Four other eligible fingering marks remain unresolved
and the full private-page reference is incomplete, so this is not whole-page
acceptance or an installed upgrade.
