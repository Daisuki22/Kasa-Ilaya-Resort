<?php

declare(strict_types=1);

return [
    'mail' => [
        'enabled' => true,
        'host' => 'smtp.gmail.com',
        'port' => 587,
        'username' => 'kasailaya2019@gmail.com',
        'password' => 'YOUR_GMAIL_APP_PASSWORD',
        'encryption' => 'tls',
        'from_email' => 'kasailaya2019@gmail.com',
        'from_name' => 'Kasa Ilaya Resort & Event Place',
        'admin_notification_email' => 'kasailayaresort.admin.user@gmail.com',
        'fallback_account' => 'backup',
        'accounts' => [
            'main' => [
                'username' => 'kasailaya2019@gmail.com',
                'password' => 'YOUR_MAIN_GMAIL_APP_PASSWORD',
                'from_email' => 'kasailaya2019@gmail.com',
                'from_name' => 'Kasa Ilaya Resort & Event Place',
            ],
            'booking' => [
                'username' => 'kasailayaresortbookings@gmail.com',
                'password' => 'YOUR_BOOKING_GMAIL_APP_PASSWORD',
                'from_email' => 'kasailayaresortbookings@gmail.com',
                'from_name' => 'Kasa Ilaya Resort & Event Place',
            ],
            'info' => [
                'username' => 'kasailayaresort.infos@gmail.com',
                'password' => 'YOUR_INFO_GMAIL_APP_PASSWORD',
                'from_email' => 'kasailayaresort.infos@gmail.com',
                'from_name' => 'Kasa Ilaya Resort & Event Place',
            ],
            'admin' => [
                'username' => 'kasailayaresort.admin.user@gmail.com',
                'password' => 'YOUR_ADMIN_GMAIL_APP_PASSWORD',
                'from_email' => 'kasailayaresort.admin.user@gmail.com',
                'from_name' => 'Kasa Ilaya Resort & Event Place',
            ],
            'backup' => [
                'username' => 'kasailayaresort.opt@gmail.com',
                'password' => 'YOUR_BACKUP_GMAIL_APP_PASSWORD',
                'from_email' => 'kasailayaresort.opt@gmail.com',
                'from_name' => 'Kasa Ilaya Resort & Event Place',
            ],
        ],
    ],
    'sms' => [
        'enabled' => true,
        'provider' => 'semaphore',
        'semaphore_api_key' => 'YOUR_SEMAPHORE_API_KEY',
        'semaphore_sender_name' => 'Kasa Ilaya Resort',
        'timeout' => 20,
        'debug' => false,
        'test_endpoint_enabled' => true,
    ],
    'firebase' => [
        'enabled' => true,
        'api_key' => 'YOUR_FIREBASE_WEB_API_KEY',
        'auth_domain' => 'your-project.firebaseapp.com',
        'project_id' => 'your-project-id',
        'storage_bucket' => 'your-project.appspot.com',
        'messaging_sender_id' => 'YOUR_FIREBASE_MESSAGING_SENDER_ID',
        'app_id' => 'YOUR_FIREBASE_WEB_APP_ID',
    ],
];
