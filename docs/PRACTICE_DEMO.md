# Tempo-guided practice walkthrough

Use the native ScorePrep scheme built with Xcode 16.4. The practice candidate
is under native verification; acceptance evidence belongs in
PRACTICE_VERIFICATION.md once the integrated checks and image review finish.

## The included exercise

1. From the library, choose **Open practice exercise**. It imports the owned
   **Pickup and pulse** score into the normal local library, with three prepared
   areas and confirmed timing. No recognition service or microphone is needed.
2. Choose **Practice**. The current area is **Pickup and bar 1**; **Bar 2** is
   shown next. Rotate the iPad to try both orientations.
3. Keep speed at **100%** and the count-in at **1** in **Practice options**.
   Choose sound or silent practice, then press **Play**.

| Time after Play | Expected display |
| --- | --- |
| 0–3 seconds | Count-in beats 1, 2, 3 before the beat-four pickup. |
| 3–8 seconds | Pickup and bar 1; Bar 2 is upcoming. |
| 8–12 seconds | Bar 2; Bars 3–4 are upcoming. |
| 12–16 seconds | Bars 3–4 in 6/8, with dotted-quarter pulses on beats 1 and 4. |
| 16 seconds | Finished, with no upcoming area. |

Audible mode adds a short common startup lead before this timeline. The beat
indicator and line focus use the same transport as the scheduled clicks.
Silent mode shows the beat without audio output. The score does not listen to
the player: it advances at the selected practice tempo.

4. Press **Stop**, choose **50%** speed, and play again. Passage and count-in
   durations double. During playback, change speed to **100%**; the current
   musical position is retained.
5. During a count-in or playback, press **Next**, **Previous**, or swipe
   horizontally. Practice pauses at the selected area. **Resume** continues
   without another count-in. **Stop**, then **Play** starts a new take.
6. Open **Practice options** and choose an A–B range, such as the first two
   areas. Both are included. Apply the loop, then resume; the upcoming area at
   B is A. Turn the loop off in the same options sheet.
7. Open **Original pages** to see the complete source, or choose **Done** to
   return to reading. The screen stays awake while the practice view is active;
   leaving or backgrounding restores normal idle behavior.

## Prepare an imported score

1. Import a PDF, JPEG or PNG. In its score menu, choose **Reading areas and
   order** to open **Prepare score**.
2. Shape the initial full-page area around one complete musical system. Keep
   every staff, clef and marking within its outline. Give it a useful name.
3. Choose **Add reading area**, select its section, and shape the next area.
   Repeat for the systems you want to practice. The full original stays intact.
4. Use **Reading order** to edit the area sequence within sections, then add
   reading passes for repeats. Moving an item in the page's area list changes
   manual browsing; musical order is edited inside its section.
5. Save preparation. For every performed area, open its timing editor and
   confirm duration in quarter-note beats, meter, BPM, tempo pulse and starting
   beat in the bar. Add a timing segment when tempo or meter changes within an
   area. An entrance on beat four is entered as **4**.
6. Save timing and choose **Practice**. Unconfirmed areas prevent automatic
   practice. Adjusting a crop clears its timing so the changed content can be
   checked again; unchanged areas retain their timing.

Duration includes rests and held notes. In 6/8, a bar contains three
quarter-note beats, and a dotted-quarter tempo of 60 gives two pulses and two
seconds per bar. The app does not infer musical time from note spacing.

## A short promotion take

Use **Your score. Your practice tempo. Hands-free line changes.**

Record the included exercise first: show current/upcoming notation, start a
one-bar count-in, and let all three areas advance in one continuous take. Then
show silent beats, a speed change, an A–B repeat and immediate manual pause.
Keep the native screen and audible clicks together when demonstrating sound.

Describe a simulator recording as a simulator preview. A real-instrument,
physical-iPad recording is a later check. Audio following and voice commands
are separate future features and are not part of this demonstration.
