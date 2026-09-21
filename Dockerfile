FROM node:20-alpine AS frontend

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV VITE_BASE_PATH=/
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM php:8.2-fpm

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default \
    && docker-php-ext-install pdo pdo_mysql mysqli \
    && { \
        echo ""; \
        echo "clear_env = no"; \
        echo "env[MYSQLHOST] = \$MYSQLHOST"; \
        echo "env[MYSQLPORT] = \$MYSQLPORT"; \
        echo "env[MYSQLDATABASE] = \$MYSQLDATABASE"; \
        echo "env[MYSQLUSER] = \$MYSQLUSER"; \
        echo "env[MYSQLPASSWORD] = \$MYSQLPASSWORD"; \
        echo "env[KASA_API_PATH] = \$KASA_API_PATH"; \
        echo "env[RAILWAY_PUBLIC_DOMAIN] = \$RAILWAY_PUBLIC_DOMAIN"; \
    } >> /usr/local/etc/php-fpm.d/www.conf

WORKDIR /var/www/html

COPY deploy/railway/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend /app/dist/ /var/www/html/
COPY api/ /var/www/html/api/
COPY vendor/ /var/www/html/vendor/
COPY img/ /var/www/html/img/
COPY entities/ /var/www/html/entities/
COPY kasa_ilaya_resort_updated.sql /var/www/html/kasa_ilaya_resort_updated.sql

RUN rm -f /var/www/html/api/config.local.php \
    && mkdir -p /var/www/html/api/uploads /var/www/html/api/runtime/sessions \
    && chown -R www-data:www-data /var/www/html/api/uploads /var/www/html/api/runtime

ENV KASA_API_PATH=/api

EXPOSE 80

CMD ["sh", "-c", "php-fpm -D && nginx -g 'daemon off;'"]
