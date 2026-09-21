<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$action = (string) query_param('action', '');
$method = request_method();

function packages_summary(): array
{
    $statement = db()->query('SELECT name, price, max_guests FROM packages WHERE is_active = 1 ORDER BY created_date DESC');
    return $statement->fetchAll();
}

function validate_uploaded_receipt_file(array $file): void
{
    $allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    $maxBytes = 8 * 1024 * 1024;
    $minBytes = 12 * 1024;
    $size = (int) ($file['size'] ?? 0);
    $tmpName = (string) ($file['tmp_name'] ?? '');
    $extension = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));

    if ($size < $minBytes) {
        json_error('Payment proof was rejected because the file is too small to be a readable receipt.', 422);
    }

    if ($size > $maxBytes) {
        json_error('Payment proof was rejected because the file is larger than 8 MB.', 422);
    }

    if (!in_array($extension, $allowedExtensions, true)) {
        json_error('Payment proof was rejected. Upload a JPG, PNG, or WebP receipt image only.', 422);
    }

    $mimeType = '';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $mimeType = (string) finfo_file($finfo, $tmpName);
            finfo_close($finfo);
        }
    }

    if ($mimeType === '' && function_exists('mime_content_type')) {
        $mimeType = (string) mime_content_type($tmpName);
    }

    if (!in_array($mimeType, $allowedMimeTypes, true)) {
        json_error('Payment proof was rejected because the uploaded file is not a supported receipt image.', 422);
    }

    $imageInfo = @getimagesize($tmpName);
    if ($imageInfo === false) {
        json_error('Payment proof was rejected because the image could not be read.', 422);
    }

    [$width, $height] = $imageInfo;
    if ($width < 360 || $height < 360) {
        json_error('Payment proof was rejected because the image resolution is too low.', 422);
    }

    if ($width > 8000 || $height > 8000) {
        json_error('Payment proof was rejected because the image dimensions are too large.', 422);
    }

    $ratio = $width / max(1, $height);
    if ($ratio > 0.98) {
        json_error('Payment proof was rejected. Upload a portrait payment receipt screenshot, not a landscape image.', 422);
    }

    if ($ratio < 0.28) {
        json_error('Payment proof was rejected because the image shape does not look like a readable receipt.', 422);
    }
}

function validate_uploaded_profile_image_file(array $file): void
{
    $allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    $maxBytes = 5 * 1024 * 1024;
    $size = (int) ($file['size'] ?? 0);
    $tmpName = (string) ($file['tmp_name'] ?? '');
    $extension = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));

    if ($size <= 0 || $size > $maxBytes) {
        json_error('Profile photo must be an image file up to 5 MB.', 422);
    }

    if (!in_array($extension, $allowedExtensions, true)) {
        json_error('Profile photo must be a JPG, PNG, or WebP image.', 422);
    }

    $mimeType = '';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $mimeType = (string) finfo_file($finfo, $tmpName);
            finfo_close($finfo);
        }
    }

    if ($mimeType === '' && function_exists('mime_content_type')) {
        $mimeType = (string) mime_content_type($tmpName);
    }

    if (!in_array($mimeType, $allowedMimeTypes, true)) {
        json_error('Profile photo must be a readable JPG, PNG, or WebP image.', 422);
    }

    $imageInfo = @getimagesize($tmpName);
    if ($imageInfo === false) {
        json_error('Profile photo could not be read as an image.', 422);
    }

    [$width, $height] = $imageInfo;
    if ($width < 120 || $height < 120) {
        json_error('Profile photo must be at least 120 x 120 pixels.', 422);
    }
}

try {
    if ($action === 'upload-file' && $method === 'POST') {
        if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
            json_error('No file uploaded.', 422);
        }

        $file = $_FILES['file'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            json_error('File upload failed.', 422);
        }

        $purpose = (string) ($_POST['purpose'] ?? '');
        if ($purpose === 'payment_receipt') {
            validate_uploaded_receipt_file($file);
        }
        if ($purpose === 'profile_image') {
            validate_uploaded_profile_image_file($file);
        }

        $config = app_config();
        $extension = pathinfo((string) $file['name'], PATHINFO_EXTENSION);
        $targetDir = $config['uploads_path'] . '/' . gmdate('Y/m');
        if (!is_dir($targetDir) && !mkdir($targetDir, 0777, true) && !is_dir($targetDir)) {
            throw new RuntimeException('Unable to create upload directory.');
        }

        $fileName = uniqid('upload_', true) . ($extension ? '.' . strtolower($extension) : '');
        $targetPath = $targetDir . '/' . $fileName;

        if (!move_uploaded_file((string) $file['tmp_name'], $targetPath)) {
            throw new RuntimeException('Unable to save uploaded file.');
        }

        $relative = 'uploads/' . gmdate('Y/m') . '/' . $fileName;
        json_response([
            'file_url' => absolute_api_url($relative),
        ]);
    }

    if ($action === 'send-email' && $method === 'POST') {
        $payload = request_body();
        $result = send_app_email(
            (string) ($payload['to'] ?? ''),
            (string) ($payload['subject'] ?? ''),
            (string) ($payload['body'] ?? ''),
            (string) ($payload['purpose'] ?? 'main')
        );

        json_response($result, ($result['sent'] ?? false) ? 200 : 202);
    }

    if ($action === 'invoke-llm' && $method === 'POST') {
        $payload = request_body();
        $prompt = strtolower((string) ($payload['prompt'] ?? ''));
        $packages = packages_summary();

        if (str_contains($prompt, 'package') || str_contains($prompt, 'price')) {
            $lines = array_map(
                static fn(array $item): string => '- ' . $item['name'] . ': PHP ' . number_format((float) $item['price'], 0) . ' for up to ' . $item['max_guests'] . ' guests',
                $packages
            );
            json_response(['response' => "Here are the current packages:\n" . implode("\n", $lines) . "\n\nYou can open the Packages page and book directly."]);
        }

        if (str_contains($prompt, 'book')) {
            json_response(['response' => 'To make a booking, open the Packages page, choose a package, and submit the reservation form. Your booking will be stored in the local database.']);
        }

        if (str_contains($prompt, 'lost') || str_contains($prompt, 'found')) {
            json_response(['response' => 'The Lost and Found pages are connected to the local database. Guests can submit reports, and admins can manage found items and claim records.']);
        }

        json_response(['response' => 'I can help with packages, bookings, amenities, and lost-and-found questions for Kasa Ilaya Resort.']);
    }

    json_error('Unsupported integration action.', 405);
} catch (Throwable $error) {
    json_error($error->getMessage(), 500);
}
