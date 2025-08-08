## ------------------------------- Builder Stage ------------------------------ ## 
FROM python:3.13-bookworm AS builder

RUN apt-get update && apt-get install --no-install-recommends -y \
        build-essential && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Download the latest installer, install it and then remove it
ADD https://astral.sh/uv/install.sh /install.sh
RUN chmod -R 655 /install.sh && /install.sh && rm /install.sh

# Set up the UV environment path correctly
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app

COPY ./pyproject.toml .

RUN uv sync

## ------------------------------- Production Stage ------------------------------ ##
FROM python:3.13-slim-bookworm AS production

# Workdir first
WORKDIR /app

# Copy virtual env from builder and app sources
COPY --from=builder /app/.venv .venv
COPY /src src

# Ensure venv is on PATH for subsequent steps
ENV PATH="/app/.venv/bin:$PATH"

# Install Playwright browsers and required system dependencies at build-time
# This avoids runtime downloads which can fail on internal-only networks
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN python -m pip install --no-cache-dir --upgrade pip && \
    python -m playwright install --with-deps chromium && \
    mkdir -p ${PLAYWRIGHT_BROWSERS_PATH} && \
    chown -R root:root ${PLAYWRIGHT_BROWSERS_PATH}

# Drop privileges after installing system-level deps
RUN useradd --create-home appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose the specified port for FastAPI
EXPOSE $PORT

# Start the application with FastAPI in production mode, using environment variable references
CMD ["fastapi", "run", "src/main.py"]




