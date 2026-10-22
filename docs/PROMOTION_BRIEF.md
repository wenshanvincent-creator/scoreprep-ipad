# Promotion brief

## Current showcase

**Your score. Your practice tempo. Hands-free line changes.**

Chinese direction: **保留你的谱子和标记，跟着练习速度自动换行。**

The useful moment is simple: the musician keeps playing while the next system
comes forward at the chosen practice tempo. Current and upcoming music stay
visible, using the original score. A single transport drives the beat and line
changes, including pickups and explicit compound-meter pulses.

Native simulator checks have verified the uninterrupted automatic take,
largest-text controls, manual interruption and captured metronome output.
Full preview acceptance, including the complete preparation and repeat flow,
is still in progress. Use [the verification notes](PRACTICE_VERIFICATION.md) to
choose the accepted source and captures before filming.

## Short native demonstration

1. Open **Pickup and pulse** with **Open practice exercise**, then **Practice**.
   Show the current area and the next one together.
2. Keep 100% speed and a one-bar count-in. Press Play, then make no navigation
   commands during the take. Count-in lasts three seconds; line changes occur
   at eight and twelve seconds, with Finished at sixteen.
3. Let the change to 6/8 remain visible. Its dotted-quarter pulse is explicit;
   silent mode also has a visible beat.
4. After the complete repeat flow passes its gate, show 200% speed and an A–B
   return, followed by an immediate touch pause. Keep the actual controls and
   resulting music visible.
5. End with **Your score. Your practice tempo. Hands-free line changes.** and
   [the public repository](https://github.com/wenshanvincent-creator/scoreprep-ipad).

[PRACTICE_DEMO.md](PRACTICE_DEMO.md) gives exact settings, timings and the
workflow for an imported score. Use a continuous native take for the line
changes. A simulator recording is a simulator preview; a later recording with
an instrument and physical iPad should state that device and passage.

## Optional recognition angle

**Make the score comfortable to read.** Show the original, open its clean
edition, enlarge notation, compare the source and reopen the saved edition
offline. [TRY_PREVIEW.md](TRY_PREVIEW.md) distinguishes the recorded cloud-result
walkthrough from a new conversion through a configured worker. The owned homr
trial matches 64 note events, key and meter; its final barline style differs.

## Larger flagship, still planned

**Play at your own pace. The score follows.**

Chinese direction: **你来决定节奏，乐谱跟着你走。**

Follow Me would listen to the performance, hold during a pause, and follow
changes in the musician's pace. The first trial will use classical chroma and
causal online DTW, without training a model. This behavior has not been
validated and needs its own real-performance demonstration.

Tempo-guided practice uses the app's selected speed. A tempo-setting change
does not demonstrate microphone following. Voice is the next bounded
experiment after the practice preview; Follow Me comes afterward.
