FROM composer:2 AS build

WORKDIR /app

COPY composer.json composer.lock symfony.lock ./
RUN composer install \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --no-progress \
    --no-scripts \
    --optimize-autoloader

COPY . .

RUN composer dump-autoload \
    --classmap-authoritative \
    --no-dev \
    --no-interaction

RUN APP_ENV=prod APP_DEBUG=0 php bin/console cache:clear

FROM dunglas/frankenphp:1-php8.3-alpine

ENV APP_ENV=prod \
    APP_DEBUG=0

RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && apk add --no-cache bash curl \
    && mkdir -p /tmp/kiwi-sessions /app/var/cache /app/var/log \
    && chown -R www-data:www-data /tmp/kiwi-sessions /app

WORKDIR /app

COPY infra/docker/app/Caddyfile /etc/caddy/Caddyfile
COPY infra/docker/app/php.ini /usr/local/etc/php/conf.d/kiwi.ini
COPY --from=build --chown=www-data:www-data /app /app

EXPOSE 8000

USER www-data

CMD ["/bin/sh", "/app/scripts/app-entrypoint.sh"]
