ARG BASE_IMAGE=alpine:3.11
FROM ${BASE_IMAGE}

USER root
RUN id -u app >/dev/null 2>&1 || (addgroup -S app && adduser -S app -G app)
RUN apk add --no-cache python3 curl ca-certificates
ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh
ENV PATH="/root/.local/bin:$PATH"
RUN uv pip install --system \
    "flask>=2.0.0" \
    "flask-oidc>=2.0.0" \
    "authlib>=1.0.0" \
    "Flask-Session>=0.5.0" \
    "requests>=2.28.0" \
    "gunicorn>=20.1.0"

WORKDIR /app
COPY app/ /app

EXPOSE 8000
USER app
CMD ["gunicorn", "-b", "0.0.0.0:8000", "main:app"]
