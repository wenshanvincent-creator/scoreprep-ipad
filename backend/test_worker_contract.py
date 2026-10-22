"""Boundary/ordering tests only; subprocess is stubbed, so these are NOT OMR evidence."""
import base64
import io
import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image
import worker

XML = '<score-partwise version="4.0"><part-list/><part id="P1"><measure number="1"><note><rest/><duration>1</duration><type>quarter</type></note></measure></part></score-partwise>'


class WorkerContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root_patch = patch.object(worker, "ROOT", Path(self.temp.name))
        self.token_patch = patch.object(worker, "TOKEN", "contract-test-only")
        self.root_patch.start()
        self.token_patch.start()
        self.headers = {"Authorization": "Bearer contract-test-only"}

    def tearDown(self):
        self.root_patch.stop()
        self.token_patch.stop()
        self.temp.cleanup()

    def testUnauthorizedAndInvalidDocumentDoNotStartEngine(self):
        with TestClient(worker.app) as client, patch.object(worker.POOL, "submit") as engine:
            self.assertEqual(client.post("/v1/jobs", json={}).status_code, 401)
            self.assertEqual(client.post("/v1/jobs", headers=self.headers,
                                         json={"mediaType": "image/png", "contentBase64": "?"}).status_code, 422)
            engine.assert_not_called()

    def testOriginalBytesRemainIdenticalAndPageStartsAtZero(self):
        image = Image.new("RGB", (64, 64), "white")
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        data = buffer.getvalue()
        with TestClient(worker.app) as client, patch.object(worker.POOL, "submit"):
            response = client.post("/v1/jobs", headers=self.headers, json=dict(
                mediaType="image/png", contentBase64=base64.b64encode(data).decode()))
            self.assertEqual(response.status_code, 202)
            job = response.json()
            self.assertEqual(job["pages"], [dict(sourcePageIndex=0, state="queued")])
            self.assertEqual((worker.ROOT / job["id"] / "original").read_bytes(), data)

    def testSourceOrderAndPartialFailureAreRetained(self):
        folder = worker.ROOT / "ordered-job"
        folder.mkdir()
        job = dict(state="queued", completedPages=0,
                   pages=[dict(sourcePageIndex=i, state="queued") for i in range(3)])
        commands = []
        def run(command, **kwargs):
            commands.append(command)
            class Result: returncode = 0 if len(commands) == 1 else 1
            if len(commands) == 1:
                Path(command[-1]).write_text(XML)
            return Result()
        with patch.object(worker.subprocess, "run", side_effect=run):
            worker.recognize(folder, job)
        result = json.loads((folder / "job.json").read_text())
        self.assertEqual([p["sourcePageIndex"] for p in result["pages"]], [0, 1, 2])
        self.assertEqual([p["state"] for p in result["pages"]], ["succeeded", "failed", "skipped"])
        self.assertEqual(result["completedPages"], 1)
        self.assertEqual(result["pages"][0]["musicXML"], XML)
        self.assertTrue(result["pages"][0]["reviewRequired"])
        self.assertEqual(len(commands), 2)

    def testPDFRasterizationKeepsOriginalPageIndexesAndDimensions(self):
        document = worker.pdfium.PdfDocument.new()
        document.new_page(width=300, height=200)
        document.new_page(width=400, height=600)
        data = io.BytesIO()
        document.save(data)
        document.close()
        with TestClient(worker.app) as client, patch.object(worker.POOL, "submit"):
            response = client.post("/v1/jobs", headers=self.headers, json=dict(
                mediaType="application/pdf", contentBase64=base64.b64encode(data.getvalue()).decode()))
            self.assertEqual(response.status_code, 202)
            job = response.json()
            self.assertEqual([p["sourcePageIndex"] for p in job["pages"]], [0, 1])
            folder = worker.ROOT / job["id"]
            with Image.open(folder / "source-0000.png") as page:
                self.assertEqual(page.size, (900, 600))
            with Image.open(folder / "source-0001.png") as page:
                self.assertEqual(page.size, (1200, 1800))

    def testRestartMakesInterruptedJobAnExplicitFailure(self):
        folder = worker.ROOT / "interrupted"
        folder.mkdir()
        worker.save(folder, dict(state="running", completedPages=0,
                                 pages=[dict(sourcePageIndex=0, state="running")]))
        worker.recover_interrupted_jobs()
        result = json.loads((folder / "job.json").read_text())
        self.assertEqual(result["state"], "failed")
        self.assertEqual(result["pages"][0]["state"], "failed")


if __name__ == "__main__":
    unittest.main()
