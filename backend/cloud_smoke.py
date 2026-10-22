"""Actual inference trial. Run on a hosted runner or explicitly configured remote server only."""
import os
import sys

if os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("RUNNER_ENVIRONMENT") != "github-hosted":
    sys.exit("This smoke script requires a GitHub-hosted runner. Do not run inference on the development PC.")

import base64
import json
from pathlib import Path
import secrets
import time
import xml.etree.ElementTree as ET
from compare_notation import compare

import cairosvg
import verovio
from fastapi.testclient import TestClient

OUT = Path("build/recognition")
OUT.mkdir(parents=True, exist_ok=True)
os.environ["SCOREPREP_JOB_DIR"] = str(OUT / "jobs")
os.environ["SCOREPREP_WORKER_TOKEN"] = secrets.token_urlsafe(32)
from worker import app


def render(xml, stem, input_format="musicxml-hum"):
    toolkit = verovio.toolkit()
    toolkit.setOptions(dict(inputFrom=input_format, pageWidth=2100, pageHeight=2200,
                            scale=70, adjustPageHeight=True, breaks="auto", footer="none"))
    if not toolkit.loadData(xml):
        raise RuntimeError(toolkit.getLog())
    svg = toolkit.renderToSVG(1)
    (OUT / f"{stem}.svg").write_text(svg)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=str(OUT / f"{stem}.png"), output_width=1800,
                    background_color="white")


original = Path("backend/fixtures/recognition-study.musicxml").read_text()
render(original, "original-study", input_format="musicxml")
headers = {"Authorization": f"Bearer {os.environ['SCOREPREP_WORKER_TOKEN']}"}
with TestClient(app) as client:
    response = client.post("/v1/jobs", headers=headers, json=dict(
        mediaType="image/png",
        contentBase64=base64.b64encode((OUT / "original-study.png").read_bytes()).decode()))
    response.raise_for_status()
    job = response.json()
    print(f"Actual {job['engineName']} job: {job['id']}", flush=True)
    deadline = time.monotonic() + 1200
    while time.monotonic() < deadline:
        job = client.get(f"/v1/jobs/{job['id']}", headers=headers).json()
        (OUT / "job.json").write_text(json.dumps(job, indent=2))
        if job["state"] in ("failed", "succeeded"):
            break
        time.sleep(5)
    if job["state"] != "succeeded":
        raise RuntimeError(json.dumps(job, indent=2))
    recognized = job["pages"][0]["musicXML"]
    (OUT / "recognized.musicxml").write_text(recognized)
    render(recognized, "recognized-study")
    expected = ET.fromstring(original)
    actual = ET.fromstring(recognized)
    def notes(root):
        return [dict(step=n.findtext("pitch/step"), octave=n.findtext("pitch/octave"),
                     type=n.findtext("type"), staff=n.findtext("staff"), rest=n.find("rest") is not None)
                for n in root.findall(".//note")]
    comparison = dict(expectedMeasures=len(expected.findall(".//measure")),
                      recognizedMeasures=len(actual.findall(".//measure")),
                      expectedNotes=notes(expected), recognizedNotes=notes(actual))
    (OUT / "comparison.json").write_text(json.dumps(comparison, indent=2))
    report = compare(original, recognized)
    (OUT / "quality-report.json").write_text(json.dumps(report, indent=2))
    print(f"Musical quality passed: {report['matchesOwnedExercise']}", flush=True)
    print(f"Recognition completed: {len(notes(actual))} notes; review comparison.json and both images", flush=True)
    if not report["matchesOwnedExercise"]:
        raise AssertionError("Recognized pitch/onset/duration/key/meter does not match the owned exercise; raw evidence retained")
