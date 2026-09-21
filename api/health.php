<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$database = [
    'ok' => false,
    'message' => 'Not checked',
];

try {
    db()->query('SELECT 1');
    $database = [
        'ok' => true,
        'message' => 'Connected',
    ];
} catch (Throwable $error) {
    $database = [
        'ok' => false,
        'message' => $error->getMessage(),
    ];
}

json_response([
    'ok' => $database['ok'],
    'app' => 'Kasa Ilaya Resort',
    'php' => PHP_VERSION,
    'database' => $database,
]);
