FROM dunglas/frankenphp:1.13.2-php8.5.12-trixie AS php-base

# Reject stale upstream images that predate the PHP security fixes.
RUN php -r 'exit(version_compare(PHP_VERSION, "8.5.12", ">=") ? 0 : 1);'

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash curl git unzip \
    && install-php-extensions intl pdo_pgsql \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/var/cache /app/var/log

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

WORKDIR /app

# Resolve the lockfile against the same PHP and extensions that will run it.
FROM php-base AS vendor-dev

COPY composer.json composer.lock symfony.lock ./
RUN composer install \
    --prefer-dist \
    --no-interaction \
    --no-progress \
    --no-scripts

FROM php-base AS vendor-prod

COPY composer.json composer.lock symfony.lock ./
RUN composer install \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --no-progress \
    --no-scripts \
    --optimize-autoloader

FROM php-base AS runtime-base

COPY infra/docker/app/Caddyfile /etc/caddy/Caddyfile
COPY infra/docker/app/php.ini /usr/local/etc/php/conf.d/kiwi.ini

EXPOSE 8000

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

FROM runtime-base AS dev

ENV APP_ENV=dev \
    APP_DEBUG=1

COPY --from=vendor-dev /app/vendor /app/vendor

COPY .env ./
COPY .env.test ./
COPY assets ./assets
COPY bin ./bin
COPY composer.json composer.lock symfony.lock ./
COPY config ./config
COPY fixtures ./fixtures
COPY importmap.php ./
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
COPY assets ./assets
COPY bin ./bin
COPY composer.json composer.lock symfony.lock ./
COPY config ./config
COPY fixtures ./fixtures
COPY importmap.php ./
COPY phpunit.xml.dist ./
COPY public ./public
COPY scripts ./scripts
COPY src ./src
COPY templates ./templates

RUN composer dump-autoload \
    --classmap-authoritative \
    --no-dev \
    --no-interaction \
    && php bin/console asset-map:compile \
    && php bin/console cache:clear

FROM runtime-base AS prod

ENV APP_ENV=prod \
    APP_DEBUG=0

RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && chown -R www-data:www-data /app

COPY --from=prod-build --chown=www-data:www-data /app /app


USER www-data

CMD ["/bin/sh", "/app/scripts/app-entrypoint.sh"]
