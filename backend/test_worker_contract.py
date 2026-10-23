"""Boundary/ordering tests only; subprocess is stubbed, so these are NOT OMR evidence."""
import base64
import io
import json
import struct
import zlib
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

    def testTwentyMiBSlashRichPNGIsAcceptedWithoutJSONSlashEscaping(self):
        # A valid private ancillary PNG chunk makes an exact-size, slash-rich
        # fixture without a large checked-in binary or expensive model execution.
        buffer = io.BytesIO()
        Image.new("RGB", (64, 64), "white").save(buffer, format="PNG")
        png = buffer.getvalue()
        padding = b"\xff" * (worker.MAX_BYTES - len(png) - 12)
        chunk = b"vpAg" + padding
        document = (png[:-12] + struct.pack(">I", len(padding)) + chunk
                    + struct.pack(">I", zlib.crc32(chunk)) + png[-12:])
        self.assertEqual(len(document), worker.MAX_BYTES)
        Image.open(io.BytesIO(document)).verify()
        body = json.dumps(dict(mediaType="image/png", contentBase64=base64.b64encode(
            document).decode()), separators=(",", ":")).encode()
        self.assertLessEqual(len(body), worker.MAX_BYTES * 4 // 3 + 4096)
        with TestClient(worker.app) as client, patch.object(worker.POOL, "submit") as engine:
            response = client.post("/v1/jobs", headers=self.headers, content=body)
            self.assertEqual(response.status_code, 202)
            self.assertEqual((worker.ROOT / response.json()["id"] / "original").read_bytes(), document)
            engine.assert_called_once()
            engine.reset_mock()
            # Default Swift JSONEncoder used to expand these slashes. Keep the
            # worker's bounded request guard; the client must use compact encoding.
            escaped = body.replace(b"/", b"\\/")
            self.assertGreater(len(escaped), 28 * 1024 * 1024)
            response = client.post("/v1/jobs", headers=self.headers, content=escaped)
            self.assertEqual(response.status_code, 413)
            engine.assert_not_called()

    def testDecodedDocumentAboveTwentyMiBIsRejectedBeforeRasterization(self):
        document = b"a" * (worker.MAX_BYTES + 1)
        body = json.dumps(dict(mediaType="image/png", contentBase64=base64.b64encode(
            document).decode()), separators=(",", ":")).encode()
        self.assertLessEqual(len(body), worker.MAX_BYTES * 4 // 3 + 4096)
        with TestClient(worker.app) as client, patch.object(worker.POOL, "submit") as engine, \
                patch.object(worker, "rasterize") as rasterize:
            response = client.post("/v1/jobs", headers=self.headers, content=body)
            self.assertEqual(response.status_code, 422)
            self.assertIn("20 MiB", response.json()["detail"])
            rasterize.assert_not_called()
            engine.assert_not_called()

    def testRawRequestLimitRemainsBounded(self):
        limit = worker.MAX_BYTES * 4 // 3 + 4096
        # Valid JSON but missing required keys distinguishes reaching the decoder
        # (422) from failing the raw streaming guard (413).
        body = b"{}" + b" " * (limit - 2)
        with TestClient(worker.app) as client, patch.object(worker.POOL, "submit") as engine:
            self.assertEqual(client.post("/v1/jobs", headers=self.headers,
                                         content=body).status_code, 422)
            self.assertEqual(client.post("/v1/jobs", headers=self.headers,
                                         content=body + b" ").status_code, 413)
            engine.assert_not_called()

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
                Path(command[-1]).with_suffix(".musicxml").write_text(XML)
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
