<?php

declare(strict_types=1);

$host = (string) (getenv('KASA_FTP_HOST') ?: 'ftpupload.net');
$user = (string) getenv('KASA_FTP_USER');
$pass = (string) getenv('KASA_FTP_PASS');

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

foreach (['/', '/htdocs', '/htdocs/api', '/htdocs/assets', '/kasailayaresort.gt.tc', '/kasailayaresort.gt.tc/htdocs'] as $path) {
    echo "\n{$path}\n";
    $items = ftp_nlist($connection, $path) ?: [];
    foreach (array_slice($items, 0, 30) as $item) {
        echo "  {$item}\n";
    }
    if (count($items) > 30) {
        echo "  ... " . (count($items) - 30) . " more\n";
    }
}

ftp_close($connection);
