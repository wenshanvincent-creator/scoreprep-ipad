"""Single-process private oemer worker. Inference runs only in a remote subprocess."""
import base64
import binascii
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import io
import json
import os
from pathlib import Path
import subprocess
import threading
import uuid
import xml.etree.ElementTree as ET

from fastapi import FastAPI, Header, HTTPException, Request
from PIL import Image, ImageOps
import pypdfium2 as pdfium

ENGINE_REVISION = "dbe2a933d630d0f74805d717960eb259473f5978"
MAX_BYTES = 20 * 1024 * 1024
MAX_PAGES = 8
ROOT = Path(os.environ.get("SCOREPREP_JOB_DIR", "/data/jobs"))
TOKEN = os.environ.get("SCOREPREP_WORKER_TOKEN", "")
POOL = ThreadPoolExecutor(max_workers=1)  # oemer uses process-global layer state.
LOCK = threading.Lock()
app = FastAPI(title="ScorePrep private recognition worker", version="1.0.0")


def authorize(authorization):
    if not TOKEN:
        raise HTTPException(503, "Worker token has not been configured")
    if not hmac.compare_digest(authorization or "", f"Bearer {TOKEN}"):
        raise HTTPException(401, "Invalid worker credential")


def job_path(job_id):
    try:
        return ROOT / str(uuid.UUID(job_id))
    except ValueError:
        raise HTTPException(404, "Unknown job")


def save(folder, job):
    with LOCK:
        temp = folder / "job.tmp"
        temp.write_text(json.dumps(job), encoding="utf-8")
        temp.replace(folder / "job.json")


def rasterize(data, media_type, folder):
    """Preserve page order. Store the byte-identical original separately."""
    paths = []
    if media_type == "application/pdf":
        document = pdfium.PdfDocument(data)
        try:
            if not 1 <= len(document) <= MAX_PAGES:
                raise ValueError(f"PDF must contain 1–{MAX_PAGES} pages")
            for index in range(len(document)):
                page = document[index]
                width, height = page.get_size()
                if width <= 0 or height <= 0 or max(width, height) > 20000:
                    raise ValueError("Unsupported PDF page dimensions")
                bitmap = page.render(scale=min(3, 2400 / max(width, height)))
                image = bitmap.to_pil().convert("RGB")
                path = folder / f"source-{index:04d}.png"
                image.save(path)
                paths.append(path)
                bitmap.close()
                page.close()
        finally:
            document.close()
    elif media_type in ("image/png", "image/jpeg"):
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in ("PNG", "JPEG"):
                raise ValueError("Image must be PNG or JPEG")
            image = ImageOps.exif_transpose(image)
            image.thumbnail((2400, 3200))
            # Transparency is white paper, not black symbols.
            rgba = image.convert("RGBA")
            paper = Image.new("RGBA", rgba.size, "white")
            paper.alpha_composite(rgba)
            path = folder / "source-0000.png"
            paper.convert("RGB").save(path)
            paths.append(path)
    else:
        raise ValueError("Supported formats: PDF, PNG, JPEG")
    return paths


def recognize(folder, job):
    job["state"] = "running"
    save(folder, job)
    for page in job["pages"]:
        index = page["sourcePageIndex"]
        page["state"] = "running"
        save(folder, job)
        output = folder / f"page-{index:04d}.musicxml"
        try:
            with (folder / f"page-{index:04d}.log").open("w") as log:
                result = subprocess.run(
                    ["oemer", str(folder / f"source-{index:04d}.png"), "-o", str(output)],
                    stdout=log, stderr=subprocess.STDOUT, timeout=900, check=False)
            if result.returncode:
                raise RuntimeError(f"oemer exited with status {result.returncode}")
            xml = output.read_text(encoding="utf-8")
            root = ET.fromstring(xml)
            if root.tag.split("}")[-1] not in ("score-partwise", "score-timewise"):
                raise ValueError("oemer output is not a MusicXML score")
            if not root.findall(".//note"):
                raise ValueError("oemer produced no notes; review the original")
            page.update(state="succeeded", musicXML=xml, reviewRequired=True,
                        musicXMLSHA256=hashlib.sha256(output.read_bytes()).hexdigest())
            job["completedPages"] += 1
        except (OSError, ValueError, RuntimeError, ET.ParseError, subprocess.TimeoutExpired) as error:
            log_path = folder / f"page-{index:04d}.log"
            detail = log_path.read_text(errors="replace")[-3000:] if log_path.exists() else ""
            page.update(state="failed", error=f"{error}\n{detail}")
            job.update(state="failed", error=f"Source page {index + 1}: {error}")
            for pending in job["pages"]:
                if pending["state"] == "queued":
                    pending.update(state="skipped", error="Earlier source page failed")
            save(folder, job)
            return
        save(folder, job)
    job["state"] = "succeeded"
    save(folder, job)


@app.post("/v1/jobs", status_code=202)
async def submit(request: Request, authorization: str | None = Header(default=None)):
    authorize(authorization)
    chunks = bytearray()
    async for chunk in request.stream():
        chunks.extend(chunk)
        if len(chunks) > MAX_BYTES * 4 // 3 + 4096:
            raise HTTPException(413, "Document exceeds 20 MiB")
    try:
        payload = json.loads(chunks)
        data = base64.b64decode(payload["contentBase64"], validate=True)
        media_type = payload["mediaType"]
        if not data or len(data) > MAX_BYTES:
            raise ValueError("Document must contain 1 byte–20 MiB")
    except (ValueError, KeyError, TypeError, binascii.Error) as error:
        raise HTTPException(422, str(error))
    job_id = str(uuid.uuid4())
    folder = ROOT / job_id
    folder.mkdir(parents=True)
    (folder / "original").write_bytes(data)
    try:
        paths = rasterize(data, media_type, folder)
    except Exception as error:
        # Input decode errors are request failures, never successful empty jobs.
        raise HTTPException(422, str(error))
    job = dict(schemaVersion=1, id=job_id, state="queued", completedPages=0,
               engineRevision=ENGINE_REVISION,
               originalSHA256=hashlib.sha256(data).hexdigest(),
               pages=[dict(sourcePageIndex=i, state="queued") for i in range(len(paths))])
    save(folder, job)
    POOL.submit(recognize, folder, job)
    return job


@app.get("/v1/jobs/{job_id}")
def status(job_id: str, authorization: str | None = Header(default=None)):
    authorize(authorization)
    path = job_path(job_id) / "job.json"
    if not path.exists():
        raise HTTPException(404, "Unknown job")
    return json.loads(path.read_text(encoding="utf-8"))


@app.on_event("startup")
def recover_interrupted_jobs():
    ROOT.mkdir(parents=True, exist_ok=True)
    for path in ROOT.glob("*/job.json"):
        job = json.loads(path.read_text(encoding="utf-8"))
        if job["state"] in ("queued", "running"):
            job.update(state="failed", error="Worker restarted before recognition completed; submit again")
            for page in job["pages"]:
                if page["state"] in ("queued", "running"):
                    page.update(state="failed", error="Worker restarted")
            save(path.parent, job)
