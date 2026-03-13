FROM composer:2 AS vendor-dev

WORKDIR /app

COPY composer.json composer.lock symfony.lock ./
RUN composer install \
    --prefer-dist \
    --no-interaction \
    --no-progress \
    --no-scripts

FROM composer:2 AS vendor-prod

WORKDIR /app

COPY composer.json composer.lock symfony.lock ./
RUN composer install \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --no-progress \
    --no-scripts \
    --optimize-autoloader

FROM dunglas/frankenphp:1-php8.3-alpine AS runtime-base

RUN apk add --no-cache bash curl git unzip \
    && mkdir -p /tmp/kiwi-sessions /app/var/cache /app/var/log

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

WORKDIR /app

COPY infra/docker/app/Caddyfile /etc/caddy/Caddyfile
COPY infra/docker/app/php.ini /usr/local/etc/php/conf.d/kiwi.ini

EXPOSE 8000

FROM runtime-base AS dev

ENV APP_ENV=dev \
    APP_DEBUG=1

COPY --from=vendor-dev /app/vendor /app/vendor

COPY .env ./
COPY .env.test ./
COPY bin ./bin
COPY composer.json composer.lock symfony.lock ./
COPY config ./config
COPY fixtures ./fixtures
COPY phpunit.xml.dist ./
COPY public ./public
COPY scripts ./scripts
COPY src ./src
COPY templates ./templates

CMD ["/bin/sh", "/app/scripts/app-entrypoint.sh"]

FROM runtime-base AS prod-build

ENV APP_ENV=prod \
    APP_DEBUG=0

COPY --from=vendor-prod /app/vendor /app/vendor

COPY .env ./
COPY .env.test ./
COPY bin ./bin
COPY composer.json composer.lock symfony.lock ./
COPY config ./config
COPY fixtures ./fixtures
COPY phpunit.xml.dist ./
COPY public ./public
COPY scripts ./scripts
COPY src ./src
COPY templates ./templates

RUN composer dump-autoload \
    --classmap-authoritative \
    --no-dev \
    --no-interaction \
    && php bin/console cache:clear

FROM runtime-base AS prod

ENV APP_ENV=prod \
    APP_DEBUG=0

RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && chown -R www-data:www-data /tmp/kiwi-sessions /app

COPY --from=prod-build --chown=www-data:www-data /app /app


USER www-data

CMD ["/bin/sh", "/app/scripts/app-entrypoint.sh"]
