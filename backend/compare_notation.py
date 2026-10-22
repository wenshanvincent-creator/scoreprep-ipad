"""Check the owned simple exercise's musical events, not XML serialization order.

This intentionally covers the fixture (no repeats/transposition/grace notes).
It is not a general MusicXML validator or a broad OMR accuracy benchmark.
"""
from collections import Counter
from fractions import Fraction
import json
from pathlib import Path
import xml.etree.ElementTree as ET


def describe(xml):
    root = ET.fromstring(xml)
    events = []
    divisions = 1
    for part_index, part in enumerate(root.findall("part")):
        for measure_index, measure in enumerate(part.findall("measure")):
            cursor = Fraction(0)
            last_start = cursor
            for item in measure:
                if item.tag == "attributes":
                    divisions = int(item.findtext("divisions", str(divisions)))
                elif item.tag == "backup":
                    cursor -= Fraction(int(item.findtext("duration")), divisions)
                elif item.tag == "forward":
                    cursor += Fraction(int(item.findtext("duration")), divisions)
                elif item.tag == "note":
                    duration = Fraction(int(item.findtext("duration", "0")), divisions)
                    chord = item.find("chord") is not None
                    start = last_start if chord else cursor
                    pitch = item.find("pitch")
                    if pitch is not None:
                        events.append((part_index, measure_index, item.findtext("staff", "1"),
                                       str(start), str(duration), pitch.findtext("step"),
                                       int(pitch.findtext("alter", "0")), int(pitch.findtext("octave"))))
                    if not chord:
                        last_start = start
                        cursor += duration
    return dict(measures=len(root.findall(".//measure")), pitchedEvents=events,
                rests=len(root.findall(".//note/rest")),
                keys=[key.findtext("fifths") for key in root.findall(".//attributes/key")],
                meters=[(time.findtext("beats"), time.findtext("beat-type")) for time in root.findall(".//attributes/time")])


def compare(expected_xml, recognized_xml):
    expected = describe(expected_xml)
    actual = describe(recognized_xml)
    missing = list((Counter(expected["pitchedEvents"]) - Counter(actual["pitchedEvents"])).elements())
    extra = list((Counter(actual["pitchedEvents"]) - Counter(expected["pitchedEvents"])).elements())
    return dict(matchesOwnedExercise=not missing and not extra and expected["keys"] == actual["keys"]
                and expected["meters"] == actual["meters"] and actual["rests"] == 0
                and expected["measures"] == actual["measures"],
                expected=expected, actual=actual,
                missingOrChangedPitchedEvents=missing, unexpectedPitchedEvents=extra,
                eventFields=["partIndex", "measureIndex", "staff", "onsetQuarterBeats", "durationQuarterBeats", "step", "alter", "octave"])


if __name__ == "__main__":
    import sys
    report = compare(Path(sys.argv[1]).read_text(), Path(sys.argv[2]).read_text())
    Path(sys.argv[3]).write_text(json.dumps(report, indent=2))
    print("Matches owned exercise:", report["matchesOwnedExercise"])
    print("Missing or changed events:", len(report["missingOrChangedPitchedEvents"]))
    print("Unexpected events:", len(report["unexpectedPitchedEvents"]))
