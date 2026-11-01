FROM python:3.12-slim

RUN pip install --no-cache-dir uv==0.9.27

WORKDIR /app

# Runtime dependencies only: hmmlearn and statsmodels are test references
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY cql_batch ./cql_batch

RUN useradd --uid 1001 --no-create-home batch
USER batch

CMD ["/app/.venv/bin/python", "-m", "cql_batch.fit_regimes"]
