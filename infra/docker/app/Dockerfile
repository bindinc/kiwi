ARG BASE_IMAGE=alpine:3.11
FROM ${BASE_IMAGE}

USER root
RUN id -u app >/dev/null 2>&1 || (addgroup -S app && adduser -S app -G app)
RUN apk add --no-cache python3 curl ca-certificates
ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app
COPY pyproject.toml /app/pyproject.toml
RUN uv pip install --system -r pyproject.toml
COPY app/ /app

EXPOSE 8000
USER app
CMD ["gunicorn", "-b", "0.0.0.0:8000", "main:app"]
