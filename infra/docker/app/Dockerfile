ARG NODE_IMAGE=node:22-alpine
ARG BASE_IMAGE=python:3.12-alpine
FROM ${NODE_IMAGE} AS frontend-builder

WORKDIR /workspace/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM ${BASE_IMAGE}

USER root
RUN id -u app >/dev/null 2>&1 || (addgroup -S app && adduser -S app -G app)
RUN apk add --no-cache curl ca-certificates libffi openssl
ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app
COPY pyproject.toml /app/pyproject.toml
RUN apk add --no-cache --virtual .build-deps \
    build-base \
    libffi-dev \
    openssl-dev \
    cargo \
    && uv pip install --system -r pyproject.toml \
    && apk del .build-deps
COPY app/ /app
COPY --from=frontend-builder /workspace/frontend/dist/ /app/static/assets/vue/

EXPOSE 8000
USER app
CMD ["gunicorn", "-b", "0.0.0.0:8000", "main:app"]
