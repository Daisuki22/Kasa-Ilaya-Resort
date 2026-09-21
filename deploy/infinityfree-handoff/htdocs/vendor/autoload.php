<?php

declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $prefixes = [
        'PHPMailer\\PHPMailer\\' => __DIR__ . '/phpmailer/phpmailer/src/',
        'Psr\\Log\\' => __DIR__ . '/compat/psr/log/',
        'League\\OAuth2\\Client\\Grant\\' => __DIR__ . '/compat/league/oauth2-client/Grant/',
        'League\\OAuth2\\Client\\Provider\\' => __DIR__ . '/compat/league/oauth2-client/Provider/',
        'League\\OAuth2\\Client\\Token\\' => __DIR__ . '/compat/league/oauth2-client/Token/',
    ];

    foreach ($prefixes as $prefix => $basePath) {
        if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
            continue;
        }

        $relativeClass = substr($class, strlen($prefix));
        $path = $basePath . str_replace('\\', '/', $relativeClass) . '.php';

        if (is_file($path)) {
            require $path;
        }

        return;
    }
});
