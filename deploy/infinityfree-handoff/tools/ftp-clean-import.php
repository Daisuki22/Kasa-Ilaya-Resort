<?php

declare(strict_types=1);

$host = (string) (getenv('KASA_FTP_HOST') ?: 'ftpupload.net');
$user = (string) getenv('KASA_FTP_USER');
$pass = (string) getenv('KASA_FTP_PASS');
$remoteRoot = rtrim((string) (getenv('KASA_REMOTE_DIR') ?: '/htdocs'), '/');

if ($user === '' || $pass === '') {
    fwrite(STDERR, "Missing FTP credentials.\n");
    exit(1);
}

$connection = ftp_connect($host, 21, 30);
if (!$connection || !ftp_login($connection, $user, $pass)) {
    fwrite(STDERR, "FTP login failed.\n");
    exit(1);
}

ftp_pasv($connection, true);

$files = [
    $remoteRoot . '/api/deploy-import.php',
    $remoteRoot . '/api/deploy-health.php',
    $remoteRoot . '/api/deploy-repair.php',
    $remoteRoot . '/api/kasa_ilaya_resort_updated.sql',
];

foreach ($files as $file) {
    @ftp_delete($connection, $file);
}

ftp_close($connection);

echo "Temporary import files removed.\n";
