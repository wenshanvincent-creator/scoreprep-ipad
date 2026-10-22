FROM python:3.11.11-slim-bookworm
WORKDIR /worker
RUN apt-get update && apt-get install -y --no-install-recommends git libglib2.0-0 libgomp1 && rm -rf /var/lib/apt/lists/*
COPY backend/ backend/
RUN bash backend/install-engine.sh
RUN useradd --uid 10001 --create-home worker && mkdir -p /data/jobs && chown -R worker /data
USER worker
ENV SCOREPREP_JOB_DIR=/data/jobs MPLCONFIGDIR=/tmp/matplotlib OMP_NUM_THREADS=2
EXPOSE 8000
CMD ["uvicorn", "backend.worker:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
