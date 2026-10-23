# Windows desktop and pre-practice tuning

Vincent selected an installable Windows application and common instrument
presets, with cello mandatory for his own test. Keep the Apple app intact.
The Windows client retains library import, reading-area preparation, explicit
timing/repeats, current/upcoming practice, single-clock metronome and remote
recognition/review. Original bytes remain the source of truth.

Use Electron with isolated/sandboxed local rendering, React, PDF.js, bundled
Verovio WASM with Humdrum, Web Audio and classical pitch detection. Windows
stores originals and metadata in its application-data folder; encrypted worker
credentials remain outside project files. No model runs on this computer.

Palette: paper #FFFFFF, surround #F2F4F6, ink #18242C, rehearsal blue #285E79,
muted #63717B, active #D59B2D. Segoe UI Variable/Segoe UI for Windows controls,
tabular numerals for Hz/cents. Keep musical type untouched. A quiet library
rail and toolbar surround a large white score; no marketing/dashboard cards.

Wide: [library 220px] [title / original or notation / prepare / tune]
                     [               score paper                ]
                     [ previous / position / speed / play / next ]
Practice: current system dominates; the next system is visible immediately
below. Preparation lists areas/order beside a draggable top-left crop overlay.
On a narrow desktop window preparation controls stack and the library narrows.
Practice hides the library and keeps music and transport in one viewport.

Before Play, open a tuning sheet with instrument, A4 reference, optional target
string, large detected note, a -50…+50-cent meter, Hz and clear lower/higher/
in-tune status. Start listening is explicit. Offer reference tone, continue and
skip. Cello is C2–G2–D3–A3, measured at sounding pitch; common strings use their
own octave-correct presets. Winds use chromatic concert-pitch mode, explicitly
labeled as sounding pitch; the app never infers an instrument from a waveform.

Use labeled native-like controls, visible focus, Escape to close, 44px primary
targets, keyboard-accessible page controls and sufficient contrast. No moving needle
without a reliable pitched signal. Do not describe a generated tone as a real
instrument check. Inspect wide/narrow/tuning/practice views before delivery.

Review: the score and tuner needle are the only prominent surfaces. Every
control serves rehearsal or provenance. The palette carries forward ScorePrep;
the desktop layout uses Windows type and keyboard interaction. Follow the
installed frontend-design plan/build/critique process without adding unrelated
iOS visual effects.
