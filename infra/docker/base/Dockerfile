ARG ALPINE_VERSION=3.19
FROM alpine:${ALPINE_VERSION}

RUN addgroup -S app \
    && adduser -S app -G app \
    && apk add --no-cache ca-certificates

USER app
WORKDIR /app
