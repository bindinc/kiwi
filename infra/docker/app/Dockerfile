ARG BASE_IMAGE=python:3.12-slim-bookworm
FROM ${BASE_IMAGE}

USER root
RUN getent group app >/dev/null 2>&1 || groupadd --system app \
    && id -u app >/dev/null 2>&1 || useradd --system --gid app --create-home --home-dir /home/app app
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        libffi8 \
    && rm -rf /var/lib/apt/lists/*
ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app
COPY pyproject.toml /app/pyproject.toml
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libffi-dev \
        libssl-dev \
        cargo \
    && uv pip install --system -r pyproject.toml \
    && apt-get purge -y --auto-remove \
        build-essential \
        libffi-dev \
        libssl-dev \
        cargo \
    && rm -rf /var/lib/apt/lists/*
COPY app/ /app

EXPOSE 8000
USER app
CMD ["gunicorn", "-b", "0.0.0.0:8000", "main:app"]
