# Windows score workspace

The Windows client imports and recognizes locally, opens a reflowed digital
score and offers tuning, synthesized demonstration and actual microphone
following. Original bytes remain in the local library. Manual crop/timing/review
screens and server configuration are removed.

Use sandboxed Electron, React, bundled Verovio, Web Audio and local pitch/chroma
processing. Audiveris runs as a separate bounded CPU process.

Palette: paper #FFFFFF, surround #F2F4F6, ink #18242C, rehearsal blue #285E79,
muted #63717B. Segoe UI Variable/Segoe UI with Microsoft YaHei UI for controls,
tabular numerals for Hz/cents. Keep musical typography intact.

Wide: compact library beside the broad score; title/instrument/actions toolbar,
small notation controls and a narrow following status footer. Scroll freely and
click a measure to anchor practice. Narrow windows wrap the toolbar, reflow the
music and allow collapsing the library. No welcome slogans or secondary cards.

The tuner uses the selected instrument, adjustable A4 and sounding-pitch open
strings/chromatic targets. Start listening is explicit. Reference tones,
demonstration, hiding the app and leaving the active view release microphone input.

UI acceptance requires native Windows screenshots at default and narrow sizes,
a functioning automatic import flow, actual bar clicks, offline reopen, audible
synthesis and microphone lifecycle checks. Distinguish synthesized capture PCM
from a physical cello rehearsal.
