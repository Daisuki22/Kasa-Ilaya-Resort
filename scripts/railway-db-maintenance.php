<?php

declare(strict_types=1);

$mode = $argv[1] ?? 'summary';
$allowedModes = ['summary', 'cleanup', 'create-app-user'];

if (!in_array($mode, $allowedModes, true)) {
    fwrite(STDERR, "Usage: php scripts/railway-db-maintenance.php [summary|cleanup]\n");
    exit(2);
}

$dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    getenv('MYSQLHOST') ?: getenv('KASA_DB_HOST') ?: '127.0.0.1',
    getenv('MYSQLPORT') ?: getenv('KASA_DB_PORT') ?: '3306',
    getenv('MYSQLDATABASE') ?: getenv('KASA_DB_NAME') ?: 'railway'
);

$pdo = new PDO($dsn, getenv('MYSQLUSER') ?: getenv('KASA_DB_USER') ?: 'root', getenv('MYSQLPASSWORD') ?: getenv('KASA_DB_PASS') ?: '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$tables = [
    'users',
    'pending_registrations',
    'registration_otps',
    'password_reset_otps',
    'password_reset_tokens',
    'bookings',
    'reviews',
    'inquiries',
    'inquiry_messages',
    'activity_logs',
    'upcoming_schedules',
];

function count_rows(PDO $pdo, string $table): int
{
    try {
        return (int) $pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
    } catch (Throwable) {
        return -1;
    }
}

function print_summary(PDO $pdo, array $tables): void
{
    echo "Database summary\n";
    foreach ($tables as $table) {
        $count = count_rows($pdo, $table);
        if ($count >= 0) {
            echo "- $table: $count\n";
        }
    }

    echo "\nUsers\n";
    $users = $pdo->query('SELECT id, email, full_name, role, disabled, is_verified, created_date FROM users ORDER BY created_date')->fetchAll();
    foreach ($users as $user) {
        echo sprintf(
            "- %s | %s | %s | disabled=%s | verified=%s\n",
            $user['email'],
            $user['full_name'],
            $user['role'],
            (string) $user['disabled'],
            (string) $user['is_verified']
        );
    }
}

if ($mode === 'summary') {
    print_summary($pdo, $tables);
    exit(0);
}

if ($mode === 'create-app-user') {
    $appUser = getenv('KASA_APP_DB_USER') ?: 'kasa_app';
    $appPassword = getenv('KASA_APP_DB_PASS') ?: '';
    $database = getenv('MYSQLDATABASE') ?: getenv('KASA_DB_NAME') ?: 'railway';

    if ($appPassword === '') {
        fwrite(STDERR, "KASA_APP_DB_PASS is required.\n");
        exit(2);
    }

    $quotedUser = $pdo->quote($appUser);
    $quotedPassword = $pdo->quote($appPassword);
    $pdo->exec("CREATE USER IF NOT EXISTS $quotedUser@'%' IDENTIFIED BY $quotedPassword");
    $pdo->exec("ALTER USER $quotedUser@'%' IDENTIFIED BY $quotedPassword");
    $pdo->exec("GRANT ALL PRIVILEGES ON `$database`.* TO $quotedUser@'%'");
    $pdo->exec('FLUSH PRIVILEGES');

    echo "App database user is ready: $appUser\n";
    exit(0);
}

$pdo->beginTransaction();

try {
    $truncateTables = [
        'password_reset_otps',
        'password_reset_tokens',
        'registration_otps',
        'pending_registrations',
        'inquiry_messages',
        'inquiries',
        'reviews',
        'bookings',
        'activity_logs',
        'upcoming_schedules',
    ];

    foreach ($truncateTables as $table) {
        $pdo->exec("DELETE FROM `$table`");
    }

    $deleteUsers = $pdo->prepare(
        "DELETE FROM users
         WHERE email IN (
            'user@gmail.com',
            'admin@gmail.com',
            'sample@gmail.com',
            'guest@kasa-ilaya.local',
            'admin@kasa-ilaya.local'
         )
         OR role = 'guest'"
    );
    $deleteUsers->execute();

    $pdo->commit();
} catch (Throwable $error) {
    $pdo->rollBack();
    throw $error;
}

echo "Cleanup complete.\n\n";
print_summary($pdo, $tables);
