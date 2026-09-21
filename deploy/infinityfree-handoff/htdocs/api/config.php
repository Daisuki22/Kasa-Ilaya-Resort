<?php

declare(strict_types=1);

function merge_local_config(array $base, array $overrides): array
{
    foreach ($overrides as $key => $value) {
        if (is_array($value) && isset($base[$key]) && is_array($base[$key])) {
            $base[$key] = merge_local_config($base[$key], $value);
            continue;
        }

        $base[$key] = $value;
    }

    return $base;
}

$projectName = basename(dirname(__DIR__));

$gmailHost = getenv('KASA_GMAIL_SMTP_HOST') ?: 'smtp.gmail.com';
$gmailPort = (int) (getenv('KASA_GMAIL_SMTP_PORT') ?: 587);
$gmailEncryption = strtolower((string) (getenv('KASA_GMAIL_SMTP_ENCRYPTION') ?: 'tls'));
$mailFromName = getenv('MAIL_FROM_NAME') ?: (getenv('KASA_MAIL_FROM_NAME') ?: 'Kasa Ilaya Resort & Event Place');

function gmail_mail_account_config(
    string $key,
    string $defaultEmail,
    string $defaultName,
    string $host,
    int $port,
    string $encryption
): array {
    $prefix = 'KASA_MAIL_' . strtoupper($key) . '_';
    $email = getenv($prefix . 'EMAIL') ?: $defaultEmail;

    return [
        'host' => getenv($prefix . 'SMTP_HOST') ?: $host,
        'port' => (int) (getenv($prefix . 'SMTP_PORT') ?: $port),
        'username' => getenv($prefix . 'SMTP_USER') ?: (getenv($prefix . 'EMAIL') ?: $email),
        'password' => getenv($prefix . 'SMTP_PASS') ?: '',
        'api_key' => getenv($prefix . 'SMTP_API_KEY') ?: '',
        'encryption' => strtolower((string) (getenv($prefix . 'SMTP_ENCRYPTION') ?: $encryption)),
        'from_email' => getenv($prefix . 'FROM_EMAIL') ?: $email,
        'from_name' => getenv($prefix . 'FROM_NAME') ?: $defaultName,
        'reply_to_email' => getenv($prefix . 'REPLY_TO_EMAIL') ?: '',
        'reply_to_name' => getenv($prefix . 'REPLY_TO_NAME') ?: '',
    ];
}

$config = [
    'db' => [
        'host' => getenv('KASA_DB_HOST') ?: '127.0.0.1',
        'port' => getenv('KASA_DB_PORT') ?: '3306',
        'name' => getenv('KASA_DB_NAME') ?: 'kasa_ilaya_resort',
        'user' => getenv('KASA_DB_USER') ?: 'root',
        'pass' => getenv('KASA_DB_PASS') ?: '',
        'charset' => 'utf8mb4',
    ],
    'project_name' => $projectName,
    'api_path' => '/' . $projectName . '/api',
    'uploads_path' => __DIR__ . '/uploads',
    'frontend_url' => rtrim((string) (getenv('KASA_FRONTEND_URL') ?: ''), '/'),
    'mail' => [
        'enabled' => filter_var(getenv('KASA_MAIL_ENABLED') ?: 'false', FILTER_VALIDATE_BOOLEAN),
        'host' => getenv('BREVO_SMTP_HOST') ?: (getenv('KASA_SMTP_HOST') ?: $gmailHost),
        'port' => (int) (getenv('BREVO_SMTP_PORT') ?: (getenv('KASA_SMTP_PORT') ?: $gmailPort)),
        'username' => getenv('BREVO_SMTP_USERNAME') ?: (getenv('KASA_SMTP_USER') ?: (getenv('KASA_MAIL_MAIN_EMAIL') ?: 'kasailaya2019@gmail.com')),
        'password' => getenv('BREVO_SMTP_PASSWORD') ?: (getenv('KASA_SMTP_PASS') ?: (getenv('KASA_MAIL_MAIN_SMTP_PASS') ?: '')),
        'api_key' => getenv('BREVO_SMTP_PASSWORD') ?: (getenv('KASA_SMTP_API_KEY') ?: ''),
        'encryption' => strtolower((string) (getenv('KASA_SMTP_ENCRYPTION') ?: $gmailEncryption)),
        'from_email' => getenv('MAIL_FROM_EMAIL') ?: (getenv('KASA_MAIL_FROM_EMAIL') ?: (getenv('KASA_MAIL_MAIN_EMAIL') ?: 'kasailaya2019@gmail.com')),
        'from_name' => $mailFromName,
        'reply_to_email' => getenv('KASA_MAIL_REPLY_TO_EMAIL') ?: '',
        'reply_to_name' => getenv('KASA_MAIL_REPLY_TO_NAME') ?: '',
        'timeout' => (int) (getenv('KASA_SMTP_TIMEOUT') ?: 20),
        'admin_notification_email' => getenv('KASA_ADMIN_NOTIFICATION_EMAIL') ?: (getenv('KASA_MAIL_ADMIN_EMAIL') ?: 'kasailayaresort.admin.user@gmail.com'),
        'fallback_account' => getenv('KASA_MAIL_FALLBACK_ACCOUNT') ?: 'backup',
        'accounts' => [
            'main' => gmail_mail_account_config('main', 'kasailaya2019@gmail.com', $mailFromName, $gmailHost, $gmailPort, $gmailEncryption),
            'booking' => gmail_mail_account_config('booking', 'kasailayaresortbookings@gmail.com', $mailFromName, $gmailHost, $gmailPort, $gmailEncryption),
            'info' => gmail_mail_account_config('info', 'kasailayaresort.infos@gmail.com', $mailFromName, $gmailHost, $gmailPort, $gmailEncryption),
            'admin' => gmail_mail_account_config('admin', 'kasailayaresort.admin.user@gmail.com', $mailFromName, $gmailHost, $gmailPort, $gmailEncryption),
            'backup' => gmail_mail_account_config('backup', 'kasailayaresort2026@gmail.com', $mailFromName, $gmailHost, $gmailPort, $gmailEncryption),
        ],
    ],
    'sms' => [
        'enabled' => filter_var(getenv('KASA_SMS_ENABLED') ?: 'false', FILTER_VALIDATE_BOOLEAN),
        'provider' => strtolower((string) (getenv('KASA_SMS_PROVIDER') ?: 'semaphore')),
        'semaphore_api_key' => getenv('SEMAPHORE_API_KEY') ?: (getenv('KASA_SEMAPHORE_API_KEY') ?: ''),
        'semaphore_sender_name' => getenv('SEMAPHORE_SENDER_NAME') ?: (getenv('KASA_SEMAPHORE_SENDER_NAME') ?: ''),
        'timeout' => (int) (getenv('KASA_SMS_TIMEOUT') ?: 20),
        'debug' => filter_var(getenv('KASA_SMS_DEBUG') ?: 'false', FILTER_VALIDATE_BOOLEAN),
        'test_endpoint_enabled' => filter_var(getenv('KASA_SMS_TEST_ENDPOINT_ENABLED') ?: 'false', FILTER_VALIDATE_BOOLEAN),
    ],
    'registration' => [
        'temporary_verification_code' => trim((string) (getenv('KASA_TEMP_REGISTRATION_OTP') ?: '')),
    ],
    'google' => [
        'client_id' => trim((string) (getenv('KASA_GOOGLE_CLIENT_ID') ?: '')),
    ],
    'firebase' => [
        'enabled' => filter_var(getenv('KASA_FIREBASE_PHONE_AUTH_ENABLED') ?: 'false', FILTER_VALIDATE_BOOLEAN),
        'api_key' => trim((string) (getenv('KASA_FIREBASE_API_KEY') ?: '')),
        'auth_domain' => trim((string) (getenv('KASA_FIREBASE_AUTH_DOMAIN') ?: '')),
        'project_id' => trim((string) (getenv('KASA_FIREBASE_PROJECT_ID') ?: '')),
        'storage_bucket' => trim((string) (getenv('KASA_FIREBASE_STORAGE_BUCKET') ?: '')),
        'messaging_sender_id' => trim((string) (getenv('KASA_FIREBASE_MESSAGING_SENDER_ID') ?: '')),
        'app_id' => trim((string) (getenv('KASA_FIREBASE_APP_ID') ?: '')),
    ],
];

$localConfigPath = __DIR__ . '/config.local.php';
if (is_file($localConfigPath)) {
    $localConfig = require $localConfigPath;
    if (is_array($localConfig)) {
        $config = merge_local_config($config, $localConfig);
    }
}

return $config;
