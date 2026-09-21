<?php

declare(strict_types=1);

$localSmtpUser = 'b65d6e001@smtp-brevo.com';
$localSmtpPass = 'xsmtpsib-0233e301401110e91bcc5c98b9c77149ed254ab52b34102e1ad03c0eac347743-EvWbEgIcjNXLE6jf';
$localMailFrom = 'kasailayaresort.infos@gmail.com';
$localSemaphoreApiKey = 'c0ee592215d738b243ca6f26c5172e50';
$localGmailAppPasswords = [
    'main' => 'rlgl ugud rqzw htyu',
    'booking' => 'vcev ifye cgrg jiou',
    'info' => 'yvjf rczr hfom vxgb',
    'admin' => 'wuju ovuy sdiy ftmr',
    'backup' => 'yjhv udif nzfe tdbk',
];

$smtpUser = trim((string) (getenv('KASA_SMTP_USER') ?: $localSmtpUser));
$smtpPass = preg_replace('/\s+/', '', (string) (getenv('KASA_SMTP_PASS') ?: $localSmtpPass)) ?? '';
$mailFrom = trim((string) (getenv('KASA_MAIL_FROM_EMAIL') ?: ($localMailFrom !== '' ? $localMailFrom : $smtpUser)));
$gmailHost = getenv('KASA_GMAIL_SMTP_HOST') ?: 'smtp.gmail.com';
$gmailPort = (int) (getenv('KASA_GMAIL_SMTP_PORT') ?: 587);
$gmailEncryption = strtolower((string) (getenv('KASA_GMAIL_SMTP_ENCRYPTION') ?: 'tls'));
$gmailAccount = static function (string $key, string $email) use ($gmailHost, $gmailPort, $gmailEncryption, $localGmailAppPasswords): array {
    $prefix = 'KASA_MAIL_' . strtoupper($key) . '_';
    $password = preg_replace('/\s+/', '', (string) (getenv($prefix . 'SMTP_PASS') ?: ($localGmailAppPasswords[$key] ?? ''))) ?? '';

    return [
        'host' => getenv($prefix . 'SMTP_HOST') ?: $gmailHost,
        'port' => (int) (getenv($prefix . 'SMTP_PORT') ?: $gmailPort),
        'username' => getenv($prefix . 'SMTP_USER') ?: $email,
        'password' => $password,
        'api_key' => '',
        'encryption' => strtolower((string) (getenv($prefix . 'SMTP_ENCRYPTION') ?: $gmailEncryption)),
        'from_email' => getenv($prefix . 'FROM_EMAIL') ?: $email,
        'from_name' => getenv($prefix . 'FROM_NAME') ?: 'Kasa Ilaya Resort & Event Place',
        'reply_to_email' => getenv($prefix . 'REPLY_TO_EMAIL') ?: $email,
        'reply_to_name' => getenv($prefix . 'REPLY_TO_NAME') ?: 'Kasa Ilaya Resort & Event Place',
    ];
};
$hasGmailAppPassword = false;
foreach (['MAIN', 'BOOKING', 'INFO', 'ADMIN', 'BACKUP'] as $mailAccountKey) {
    $localPasswordKey = strtolower($mailAccountKey);
    if (trim((string) getenv('KASA_MAIL_' . $mailAccountKey . '_SMTP_PASS')) !== ''
        || trim((string) ($localGmailAppPasswords[$localPasswordKey] ?? '')) !== ''
    ) {
        $hasGmailAppPassword = true;
        break;
    }
}

return [
    'google' => [
        'client_id' => getenv('KASA_GOOGLE_CLIENT_ID') ?: '834800627360-tj8514jf4tqk46oodm358bu9thvub21f.apps.googleusercontent.com',
    ],
    'mail' => [
        'enabled' => ($smtpUser !== '' && $smtpPass !== '' && $mailFrom !== '') || $hasGmailAppPassword,
        'host' => getenv('KASA_SMTP_HOST') ?: 'smtp-relay.brevo.com',
        'port' => (int) (getenv('KASA_SMTP_PORT') ?: 587),
        'username' => $smtpUser,
        'password' => $smtpPass,
        'api_key' => '',
        'encryption' => strtolower((string) (getenv('KASA_SMTP_ENCRYPTION') ?: 'tls')),
        'from_email' => $mailFrom,
        'from_name' => getenv('KASA_MAIL_FROM_NAME') ?: 'Kasa Ilaya Resort & Event Place',
        'reply_to_email' => getenv('KASA_MAIL_REPLY_TO_EMAIL') ?: $mailFrom,
        'reply_to_name' => getenv('KASA_MAIL_REPLY_TO_NAME') ?: 'Kasa Ilaya Resort & Event Place',
        'timeout' => (int) (getenv('KASA_SMTP_TIMEOUT') ?: 20),
        'admin_notification_email' => getenv('KASA_ADMIN_NOTIFICATION_EMAIL') ?: 'kasailayaresort.admin.user@gmail.com',
        'fallback_account' => getenv('KASA_MAIL_FALLBACK_ACCOUNT') ?: 'backup',
        'accounts' => [
            'main' => $gmailAccount('main', 'kasailaya2019@gmail.com'),
            'booking' => $gmailAccount('booking', 'kasailayaresortbookings@gmail.com'),
            'info' => $gmailAccount('info', 'kasailayaresort.infos@gmail.com'),
            'admin' => $gmailAccount('admin', 'kasailayaresort.admin.user@gmail.com'),
            'backup' => $gmailAccount('backup', 'kasailayaresort.opt@gmail.com'),
        ],
    ],
    'sms' => [
        'enabled' => true,
        'provider' => 'semaphore',
        'semaphore_api_key' => getenv('SEMAPHORE_API_KEY') ?: $localSemaphoreApiKey,
        'semaphore_sender_name' => getenv('SEMAPHORE_SENDER_NAME') ?: '',
        'timeout' => (int) (getenv('KASA_SMS_TIMEOUT') ?: 20),
        'debug' => filter_var(getenv('KASA_SMS_DEBUG') ?: 'false', FILTER_VALIDATE_BOOLEAN),
        'test_endpoint_enabled' => filter_var(getenv('KASA_SMS_TEST_ENDPOINT_ENABLED') ?: 'true', FILTER_VALIDATE_BOOLEAN),
    ],
    'firebase' => [
        'enabled' => true,
        'api_key' => 'AIzaSyCSD7gKbDw3NUmFa3FUoCEQ8KuBWeISTsE',
        'auth_domain' => 'kasa-ilaya-resort.firebaseapp.com',
        'project_id' => 'kasa-ilaya-resort',
        'storage_bucket' => 'kasa-ilaya-resort.firebasestorage.app',
        'messaging_sender_id' => '1002517564566',
        'app_id' => '1:1002517564566:web:407bafd9814f5daa3e86b7',
    ],
];
