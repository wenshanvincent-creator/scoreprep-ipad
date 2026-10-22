# Native Humdrum import failure and patch review

Native acceptance subsequently passed at 276418b, with hardening enabled and
the original result unchanged. See [V1_NATIVE_VERIFICATION.md](V1_NATIVE_VERIFICATION.md)
for the passing unit/UI runs and inspected captures. The failure investigation
below is retained as the patch receipt.

Source checkpoint: 8e50294. iPadOS 18.5 simulator, Xcode 16.4.
[Run 39765175832](https://github.com/wenshanvincent-creator/scoreprep-ipad/actions/runs/39765175832),
native artifact 12420518265, crash attachment
EE27C71B-8630-4AF2-97BE-1C8D5B09FB37.ips.

The hosted native-unit app exits while bootstrapping its actual score view;
the UI-test app launch also exits before its controls can be queried.
This checkpoint is a failed native runtime trial, despite successful compilation
and successful remote recognition. No V1 pass is claimed from this run.

## Actual exception

EXC_CRASH, SIGABRT, Abort trap 6. Faulting renderer thread 1:

```text
abort
std::vector<std::pair<int, int>>::operator[]
hum::MxmlEvent::getStaffIndex
hum::Tool_musicxml2hum::reindexMeasure
hum::Tool_musicxml2hum::reindexVoices
hum::Tool_musicxml2hum::convert
vrv::Toolkit::LoadData
vrvToolkit_loadData
VerovioToolkit.loadData
VerovioRenderer.render
```

The trace establishes a hardened vector-bound assertion. It does not indicate
stack exhaustion, an unavailable importer, or a demonstrated log-stream race.

## Source and input boundary

At pinned upstream 425dd7b6ba26edcecbe345c10b15586d095743d9:

- src/hum/humlib.cpp:49443 initializes MxmlEvent.m_voice to -1.
- parseEvent starts tempvoice=-1 and tempstaff=1; non-voiced events such as
  the first attributes element and the backup elements in the actual raw homr
  document contain no voice child. They retain a negative voice while receiving
  the default positive staff.
- getVoiceNumber returns that nonzero -1 unchanged.
- getStaffIndex:50292 tests only voice < mapping.size(), then indexes mapping[voice].
- getCrossStaffOffset:50325 has the same missing lower bound.

Thus a negative voice passes the upper-bound-only test. The first attributes
event is a concrete triggering input in this fixture, and backup/barline events
also exercise non-voiced parsing. The crash attachment does not identify an
event XML pointer; that classification is source/input analysis, not a claim
of an instrumented debugger observation.

Current upstream develop 6601e8543a214dc7df4543a77f7e0897df7924c8 and tagged
6.2.1 retain the same two guards. A version downgrade is not a demonstrated fix.

## Narrow fix and required acceptance

Integration owns dependency preparation through `python3 tools/prepare_verovio.py`
before XcodeGen. It prepares the local Swift package at
`build/dependencies/verovio`; `tools/ci.sh` and `backend/native-ci.sh` invoke it.
There is one preparer and one source path. The original MusicXML, notes, voice
labels and timing remain unchanged. The full engine is not vendored.

Read-only review of that preparer and public patch found exactly the two
`getVoiceNumber() >= 0` additions. Independent computation against the pinned
upstream source confirmed these LF-normalized SHA-256 values:

- Original humlib.cpp: 8ac7d09a3350247c8c6599e3bb4aaa2c4d582772b3cb2fecd35b9a9ce688ff99.
- Two-guard patched file: 2bef068f92cd28abdf4fe40024060426c7a34ac0c267e00f2508545dcb963a29.

The script rejects different revisions or unrelated tracked changes, checks
exact patch context and accepts the expected already-patched hash. C++
hardening remains enabled. This review is source/patch evidence; runtime
acceptance must come from the next native run.

Integration pushed this preparation and patch as
`520095eda803d0198a869030ea22c33242376023`. It owns the fresh combined native
run and screenshot acceptance. The recognition workstream retains its actual
homr-output regression unchanged and does not duplicate inference/builds.
The unpatched recognition branch is not a passing runtime checkpoint.

The existing actual-output native regression checks four notes per staff/bar
after the built-in importer; the component UI checks first render, repeated
layout, page navigation and source callbacks. Review the prepared patch and
run these on the verified SDK before recording a native pass. Simulator and
physical-device evidence remain separate.

## Local package resolution

The first prepared-checkout app run, 39768871134 at 520095e, passed source
preparation but stopped during Swift-package resolution, before compiling or
executing the app. The published Package.swift declares VerovioToolkitTests
without a corresponding test directory. As a local package, SwiftPM reported
overlapping library/test sources. The additional public
tools/patches/verovio-local-package.patch removes that empty declaration;
there are no upstream test implementations to remove at this revision.
All ScorePrep native regression targets remain enabled. Both native entry
scripts now describe the prepared package before simulator boot, so this
specific packaging failure is reported early. The next native run must still
establish that the bounds fix resolves the runtime crash.

## Second hardened-runtime failure

At 8fbf8ce, package resolution and compilation passed. Fixture-only narrow/large
text and source-page callback UI checks passed, while the actual homr result
still terminated the app. Run 39769984895, artifact 12422846622, crash attachment
B2B1FE6F-BE49-41F1-B8DA-13964F17D0A8.ips reports:

```text
std::list<hum::GridSlice*>::back
hum::Tool_musicxml2hum::processPrintElement
hum::Tool_musicxml2hum::appendZeroEvents
hum::Tool_musicxml2hum::convertNowEvents
hum::Tool_musicxml2hum::insertMeasure
```

processPrintElement calls outdata->back() before its existing null-token check.
The actual input begins measure six with print new-system=yes, before any
musical slices have been appended. The patch now sets gs to null for an empty
measure; the existing addGlobalComment path explicitly supports an empty list
and retains the layout marker. No note or timing data is changed.

tools/patches/verovio-import.patch contains this empty-list check and the two
negative-voice checks. The final normalized-LF source SHA-256 is
dcdb9e08af2c01198a20b3180705230de560e4b8bbd890fb9a4144f3f297b4cc.
The prior two-guard hash above remains the receipt for the earlier patch.
The actual-output regression and UI test remain required; the new source fix
is not a native-runtime pass until rerun evidence proves it.
