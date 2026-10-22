"""Original eight-bar exercise; no third-party musical score content."""
from pathlib import Path
import xml.etree.ElementTree as ET


def write_fixture(path):
    score = ET.Element("score-partwise", version="4.0")
    work = ET.SubElement(score, "work")
    ET.SubElement(work, "work-title").text = "ScorePrep eight-bar study"
    parts = ET.SubElement(score, "part-list")
    definition = ET.SubElement(parts, "score-part", id="P1")
    ET.SubElement(definition, "part-name").text = "Piano"
    part = ET.SubElement(score, "part", id="P1")
    right = ["C5 D5 E5 G5", "G5 E5 D5 C5", "D5 E5 F5 A5", "G5 F5 E5 D5",
             "E5 F5 G5 C6", "B5 A5 G5 E5", "F5 E5 D5 G5", "C5 E5 G5 C5"]
    left = ["C3 E3 G3 E3", "C3 G3 E3 C3", "D3 F3 A3 F3", "G2 B2 D3 G3",
            "C3 E3 G3 E3", "A2 C3 E3 C3", "G2 B2 D3 G3", "C3 G3 E3 C3"]
    for i in range(8):
        measure = ET.SubElement(part, "measure", number=str(i + 1))
        if i == 0:
            attributes = ET.SubElement(measure, "attributes")
            ET.SubElement(attributes, "divisions").text = "1"
            key = ET.SubElement(attributes, "key")
            ET.SubElement(key, "fifths").text = "0"
            time = ET.SubElement(attributes, "time")
            ET.SubElement(time, "beats").text = "4"
            ET.SubElement(time, "beat-type").text = "4"
            ET.SubElement(attributes, "staves").text = "2"
            for number, sign, line in [("1", "G", "2"), ("2", "F", "4")]:
                clef = ET.SubElement(attributes, "clef", number=number)
                ET.SubElement(clef, "sign").text = sign
                ET.SubElement(clef, "line").text = line
        for staff, passage in [("1", right[i]), ("2", left[i])]:
            if staff == "2":
                backup = ET.SubElement(measure, "backup")
                ET.SubElement(backup, "duration").text = "4"
            for pitch_name in passage.split():
                note = ET.SubElement(measure, "note")
                pitch = ET.SubElement(note, "pitch")
                ET.SubElement(pitch, "step").text = pitch_name[0]
                ET.SubElement(pitch, "octave").text = pitch_name[1]
                ET.SubElement(note, "duration").text = "1"
                ET.SubElement(note, "voice").text = staff
                ET.SubElement(note, "type").text = "quarter"
                ET.SubElement(note, "staff").text = staff
        if i == 7:
            barline = ET.SubElement(measure, "barline", location="right")
            ET.SubElement(barline, "bar-style").text = "light-heavy"
    ET.indent(score)
    Path(path).write_bytes(ET.tostring(score, encoding="utf-8", xml_declaration=True))


if __name__ == "__main__":
    write_fixture("backend/fixtures/recognition-study.musicxml")
