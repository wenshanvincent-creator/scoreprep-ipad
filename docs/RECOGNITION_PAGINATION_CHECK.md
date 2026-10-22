# Native pagination investigation

Run `39773048865`, job `119805440061`, at integrated commit
`0b417bf5f356fab56ec1957a76a82e8ecec48ac4` passed all four native unit
tests, including actual homr piano voice assignment. It did not abort. The
actual-output UI test failed while waiting for Next, followed by two navigation
assertions. Source linkage and narrow/large-text fixture checks passed.

## Evidence and cause

The exported `recognition-landscape` and `recognition-large-notation` captures
both show `Source page 1 · 1 of 1`, with all eight bars visible. The latter has
larger notes. The accessibility debug description at 12:01:41 shows the plus
button still enabled; scale 80 disables it in the component. Therefore the
test's seven tap attempts did not reach the maximum size. It did not check
accepted size changes or wait for rendering to re-enable the controls.

An independent lightweight Verovio 6.3.0 engraving calculation with the saved
actual homr MusicXML, `musicxml-hum`, and the component's options at a
1210 × 665-point landscape reading area gives one page for scales 45–75 and
three pages at scale 80. This is a local layout calculation, not native runtime
proof or a new OMR inference. No production navigation defect was established
by the failed run.

## Focused verification change

Keep actual-output portrait and landscape captures. Before each size tap,
wait for the control to be enabled; after it, require the expected accessible
size value and a completed layout. Require the maximum-size control state,
Next availability, a changed page caption after Next and swipe, and the
original caption after Previous. Capture the largest size before navigation
and page two after swipe. These checks retain mandatory pagination assertions
on the actual output rather than skipping them when it fits one page.

A native rendering regression check now compares the saved actual homr output
at default and maximum sizes in that landscape reading area. The current
patch awaits the next combined macOS run; no simulator pass is claimed here.
