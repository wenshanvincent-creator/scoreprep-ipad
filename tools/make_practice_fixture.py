"""Compose an owned exercise; optional Verovio engraving, never OMR inference."""
import argparse
from pathlib import Path
import xml.etree.ElementTree as ET


def child(parent, tag, text=None, **attributes):
    element = ET.SubElement(parent, tag, attributes)
    if text is not None:
        element.text = str(text)
    return element


def write_score(path):
    score = ET.Element("score-partwise", version="4.0")
    child(child(score, "work"), "work-title", "Pickup and pulse")
    identification = child(score, "identification")
    child(identification, "creator", "ScorePrep original exercise", type="composer")
    definition = child(child(score, "part-list"), "score-part", id="P1")
    child(definition, "part-name", "Piano")
    part = child(score, "part", id="P1")
    # Divisions are two per quarter. Three explicitly printed grand-staff systems.
    measures = [
        ("0", False, 4, 4, "quarter", 2, "G4", "G3", 2, "quarter"),
        ("1", False, 4, 4, "quarter", 2, "C5 D5 E5 G5", "C3 E3 G3 E3", 2, "quarter"),
        ("2", True, 4, 4, "quarter", 2, "G5 E5 D5 C5", "C3 G3 E3 C3", 2, "quarter"),
        ("3", True, 6, 8, "eighth", 1, "C5 D5 E5 G5 E5 D5", "C3 G3", 3, "quarter"),
        ("4", False, 6, 8, "eighth", 1, "E5 F5 G5 E5 D5 C5", "G2 C3", 3, "quarter"),
    ]
    for number, new_system, beats, denominator, kind, duration, right, left, bass_duration, bass_kind in measures:
        measure = child(part, "measure", number=number)
        if number == "0":
            measure.set("implicit", "yes")
        if new_system:
            child(measure, "print", **{"new-system": "yes"})
        if number in {"0", "3"}:
            attributes = child(measure, "attributes")
            if number == "0":
                child(attributes, "divisions", 2)
                child(child(attributes, "key"), "fifths", 0)
            meter = child(attributes, "time")
            child(meter, "beats", beats)
            child(meter, "beat-type", denominator)
            if number == "0":
                child(attributes, "staves", 2)
                for staff, sign, line in [(1, "G", 2), (2, "F", 4)]:
                    clef = child(attributes, "clef", number=str(staff))
                    child(clef, "sign", sign)
                    child(clef, "line", line)
            direction = child(measure, "direction", placement="above")
            child(child(direction, "direction-type"), "words",
                  "Dotted quarter = 60" if denominator == 8 else "Quarter note = 60")
            child(direction, "sound", tempo="90" if denominator == 8 else "60")
        for staff, passage, note_duration, note_kind in [
            (1, right, duration, kind), (2, left, bass_duration, bass_kind)
        ]:
            if staff == 2:
                child(child(measure, "backup"), "duration", duration * len(right.split()))
            for note_index, name in enumerate(passage.split()):
                note = child(measure, "note")
                pitch = child(note, "pitch")
                child(pitch, "step", name[0])
                child(pitch, "octave", name[1])
                child(note, "duration", note_duration)
                child(note, "voice", staff)
                child(note, "type", note_kind)
                if note_duration == 3:
                    child(note, "dot")
                child(note, "staff", staff)
                if note_kind == "eighth":
                    child(note, "beam", ["begin", "continue", "end"][note_index % 3], number="1")
        if number == "4":
            child(child(measure, "barline", location="right"), "bar-style", "light-heavy")
    ET.indent(score)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(ET.tostring(score, encoding="utf-8", xml_declaration=True))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("Fixtures/Practice/pickup-and-pulse.musicxml"))
    parser.add_argument("--svg", type=Path, help="Optional SVG output using installed Verovio 6.3.0")
    args = parser.parse_args()
    write_score(args.output)
    if args.svg:
        import verovio

        toolkit = verovio.toolkit()
        if not toolkit.getVersion().startswith("6.3.0"):
            raise RuntimeError("Use the pinned Verovio 6.3.0 engraving version")
        toolkit.setOptions({"inputFrom": "musicxml", "breaks": "encoded", "scale": 50,
                            "pageWidth": 2100, "pageHeight": 2500, "adjustPageHeight": True,
                            "pageMarginLeft": 80, "pageMarginRight": 80,
                            "pageMarginTop": 80, "pageMarginBottom": 80, "footer": "none"})
        if not toolkit.loadData(args.output.read_text(encoding="utf-8")) or toolkit.getPageCount() != 1:
            raise RuntimeError("The owned practice exercise must engrave to one source page")
        args.svg.parent.mkdir(parents=True, exist_ok=True)
        args.svg.write_text(toolkit.renderToSVG(1), encoding="utf-8")
