<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function db_connection(): PDO
{
    return db();
}