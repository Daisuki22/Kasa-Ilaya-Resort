<?php

declare(strict_types=1);

$localRoot = realpath((string) (getenv('KASA_LOCAL_DIR') ?: dirname(__DIR__) . '/htdocs'));
$host = (string) (getenv('KASA_FTP_HOST') ?: 'ftpupload.net');
$user = (string) getenv('KASA_FTP_USER');
$pass = (string) getenv('KASA_FTP_PASS');
$remoteRoot = rtrim((string) (getenv('KASA_REMOTE_DIR') ?: '/htdocs'), '/');

if (!$localRoot || $user === '' || $pass === '') {
    fwrite(STDERR, "Missing upload configuration.\n");
    exit(1);
}

$connection = ftp_connect($host, 21, 30);
if (!$connection || !ftp_login($connection, $user, $pass)) {
    fwrite(STDERR, "FTP login failed.\n");
    exit(1);
}

ftp_pasv($connection, true);

function ftpEnsureDir($connection, string $remoteDir): void
{
    $parts = array_values(array_filter(explode('/', str_replace('\\', '/', $remoteDir))));
    $path = '';
    foreach ($parts as $part) {
        $path .= '/' . $part;
        @ftp_mkdir($connection, $path);
    }
}

function uploadTree($connection, string $localRoot, string $remoteRoot): int
{
    $uploaded = 0;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($localRoot, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $item) {
        $relative = str_replace('\\', '/', substr($item->getPathname(), strlen($localRoot) + 1));
        $remote = $remoteRoot . '/' . $relative;

        if ($item->isDir()) {
            ftpEnsureDir($connection, $remote);
            continue;
        }

        ftpEnsureDir($connection, dirname($remote));
        if (!ftp_put($connection, $remote, $item->getPathname(), FTP_BINARY)) {
            fwrite(STDERR, "Failed to upload: {$relative}\n");
            exit(1);
        }

        $uploaded++;
        if ($uploaded % 50 === 0) {
            echo "Uploaded {$uploaded} files...\n";
        }
    }

    return $uploaded;
}

$count = uploadTree($connection, $localRoot, $remoteRoot);
ftp_close($connection);

echo "Upload complete: {$count} files.\n";
