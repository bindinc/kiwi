ARG BASE_IMAGE=alpine:3.11
FROM ${BASE_IMAGE}

USER root
RUN id -u app >/dev/null 2>&1 || (addgroup -S app && adduser -S app -G app)
RUN apk add --no-cache python3 py3-pip \
    && python3 -m pip install --no-cache-dir flask gunicorn

WORKDIR /app
COPY app/ /app

EXPOSE 8000
USER app
CMD ["gunicorn", "-b", "0.0.0.0:8000", "server:app"]
