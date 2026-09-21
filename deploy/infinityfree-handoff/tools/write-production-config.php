<?php

declare(strict_types=1);

$root = dirname(__DIR__, 3);
$sourceConfig = $root . '/api/config.local.php';
$targetConfig = dirname(__DIR__) . '/htdocs/api/config.local.php';

if (!is_file($sourceConfig)) {
    fwrite(STDERR, "Missing local config.\n");
    exit(1);
}

$local = require $sourceConfig;

$required = [
    'KASA_DB_HOST',
    'KASA_DB_NAME',
    'KASA_DB_USER',
    'KASA_DB_PASS',
    'KASA_FRONTEND_URL',
];

foreach ($required as $name) {
    if ((string) getenv($name) === '') {
        fwrite(STDERR, "Missing environment variable: {$name}\n");
        exit(1);
    }
}

$config = [
    'db' => [
        'host' => (string) getenv('KASA_DB_HOST'),
        'port' => (string) (getenv('KASA_DB_PORT') ?: '3306'),
        'name' => (string) getenv('KASA_DB_NAME'),
        'user' => (string) getenv('KASA_DB_USER'),
        'pass' => (string) getenv('KASA_DB_PASS'),
        'charset' => 'utf8mb4',
    ],
    'api_path' => '/api',
    'frontend_url' => rtrim((string) getenv('KASA_FRONTEND_URL'), '/'),
    'mail' => $local['mail'] ?? ['enabled' => false],
    'sms' => [
        'enabled' => false,
        'test_endpoint_enabled' => false,
    ],
    'firebase' => [
        'enabled' => false,
    ],
];

$body = "<?php\n\ndeclare(strict_types=1);\n\nreturn " . var_export($config, true) . ";\n";

if (file_put_contents($targetConfig, $body) === false) {
    fwrite(STDERR, "Unable to write production config.\n");
    exit(1);
}

echo "Production config written.\n";
