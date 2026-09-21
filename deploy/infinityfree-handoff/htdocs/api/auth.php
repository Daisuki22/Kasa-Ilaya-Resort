<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$action = query_param('action', 'me');
$method = request_method();

function normalized_email(string $email): string
{
    return mb_strtolower(trim($email));
}

function normalized_phone(string $phone): string
{
    return preg_replace('/\D+/', '', trim($phone)) ?? '';
}

const OTP_EXPIRY_MINUTES = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_REQUESTS_PER_HOUR = 5;
const RESET_AUTH_EXPIRY_MINUTES = 15;
const CAPTCHA_EXPIRY_SECONDS = 600;
const CAPTCHA_VERIFIED_SECONDS = 600;
const CAPTCHA_MAX_ATTEMPTS = 5;
const PENDING_LOGIN_SECONDS = 300;

function otp_hash_value(string $otp): string
{
    return hash('sha256', preg_replace('/\D+/', '', trim($otp)) ?? '');
}

function find_user_by_id(string $id): ?array
{
    $statement = db()->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $id]);
    $user = $statement->fetch();
    return $user ?: null;
}

function normalize_captcha_purpose(string $purpose): string
{
    $purpose = strtolower(trim($purpose));
    return in_array($purpose, ['login', 'register', 'reset'], true) ? $purpose : 'login';
}

function captcha_hash_value(string $answer): string
{
    $normalized = preg_replace('/\D+/', '', trim($answer)) ?? '';
    return hash_hmac('sha256', $normalized, session_id() ?: 'kasa-captcha');
}

function create_captcha_challenge(string $purpose): array
{
    $purpose = normalize_captcha_purpose($purpose);
    $left = random_int(2, 12);
    $right = random_int(1, 9);
    $operator = random_int(0, 1) === 0 ? '+' : '-';

    if ($operator === '-' && $right > $left) {
        [$left, $right] = [$right, $left];
    }

    $answer = $operator === '+' ? $left + $right : $left - $right;

    $_SESSION['captcha_challenges'][$purpose] = [
        'answer_hash' => captcha_hash_value((string) $answer),
        'expires_at' => time() + CAPTCHA_EXPIRY_SECONDS,
        'attempts' => 0,
    ];

    unset($_SESSION['captcha_verified'][$purpose]);

    return [
        'success' => true,
        'purpose' => $purpose,
        'question' => $left . ' ' . $operator . ' ' . $right,
        'expires_in_seconds' => CAPTCHA_EXPIRY_SECONDS,
    ];
}

function verify_captcha_answer(string $purpose, string $answer): array
{
    $purpose = normalize_captcha_purpose($purpose);
    $challenge = $_SESSION['captcha_challenges'][$purpose] ?? null;

    if (!is_array($challenge) || (int) ($challenge['expires_at'] ?? 0) < time()) {
        unset($_SESSION['captcha_challenges'][$purpose]);
        return create_captcha_challenge($purpose) + [
            'verified' => false,
            'error' => 'Captcha expired. Please try the new challenge.',
        ];
    }

    if ((int) ($challenge['attempts'] ?? 0) >= CAPTCHA_MAX_ATTEMPTS) {
        unset($_SESSION['captcha_challenges'][$purpose]);
        return create_captcha_challenge($purpose) + [
            'verified' => false,
            'error' => 'Too many captcha attempts. Please try the new challenge.',
        ];
    }

    if (!hash_equals((string) $challenge['answer_hash'], captcha_hash_value($answer))) {
        $_SESSION['captcha_challenges'][$purpose]['attempts'] = (int) ($challenge['attempts'] ?? 0) + 1;
        return [
            'success' => false,
            'verified' => false,
            'error' => 'Captcha answer is incorrect.',
        ];
    }

    unset($_SESSION['captcha_challenges'][$purpose]);
    $_SESSION['captcha_verified'][$purpose] = time() + CAPTCHA_VERIFIED_SECONDS;

    return [
        'success' => true,
        'verified' => true,
        'purpose' => $purpose,
        'expires_in_seconds' => CAPTCHA_VERIFIED_SECONDS,
    ];
}

function require_captcha_verified(string $purpose): void
{
    $purpose = normalize_captcha_purpose($purpose);
    $verifiedUntil = (int) ($_SESSION['captcha_verified'][$purpose] ?? 0);

    if ($verifiedUntil < time()) {
        unset($_SESSION['captcha_verified'][$purpose]);
        json_error('Please complete the captcha first.', 403, ['code' => 'captcha_required']);
    }

    unset($_SESSION['captcha_verified'][$purpose]);
}

function require_any_captcha_verified(array $purposes): void
{
    foreach ($purposes as $purpose) {
        $purpose = normalize_captcha_purpose((string) $purpose);
        $verifiedUntil = (int) ($_SESSION['captcha_verified'][$purpose] ?? 0);

        if ($verifiedUntil >= time()) {
            unset($_SESSION['captcha_verified'][$purpose]);
            return;
        }
    }

    json_error('Please complete the captcha first.', 403, ['code' => 'captcha_required']);
}

function remember_pending_login(array $user, string $nextUrl): void
{
    $_SESSION['pending_login'] = [
        'user_id' => (string) $user['id'],
        'next_url' => $nextUrl,
        'expires_at' => time() + PENDING_LOGIN_SECONDS,
    ];
}

function consume_pending_login(): array
{
    $pending = $_SESSION['pending_login'] ?? null;
    unset($_SESSION['pending_login']);

    if (!is_array($pending) || (int) ($pending['expires_at'] ?? 0) < time()) {
        json_error('Your login verification expired. Please sign in again.', 401, ['code' => 'pending_login_expired']);
    }

    $user = find_user_by_id((string) ($pending['user_id'] ?? ''));
    if (!$user || (int) ($user['disabled'] ?? 0) === 1) {
        json_error('Your login verification expired. Please sign in again.', 401, ['code' => 'pending_login_expired']);
    }

    return [
        'user' => $user,
        'next_url' => (string) ($pending['next_url'] ?? '/'),
    ];
}

function seconds_until_resend_allowed(?string $createdAt): int
{
    if (!$createdAt) {
        return 0;
    }

    $createdTimestamp = strtotime($createdAt);
    if ($createdTimestamp === false) {
        return 0;
    }

    return max(0, OTP_RESEND_COOLDOWN_SECONDS - (time() - $createdTimestamp));
}

function public_mail_status(array $mailResult): array
{
    return [
        'mail_sent' => (bool) ($mailResult['sent'] ?? false),
    ];
}

function otp_email_template(string $recipientName, string $otp, string $heading, string $intro, string $ignoreMessage): string
{
    $safeName = htmlspecialchars($recipientName !== '' ? $recipientName : 'Guest', ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeOtp = htmlspecialchars($otp, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeHeading = htmlspecialchars($heading, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeIntro = htmlspecialchars($intro, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeIgnore = htmlspecialchars($ignoreMessage, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    return '<div style="margin:0;padding:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">'
        . '<div style="max-width:560px;margin:0 auto;padding:32px 16px;">'
        . '<div style="background:#ffffff;border:1px solid #e8e0d3;border-radius:8px;overflow:hidden;">'
        . '<div style="background:#214332;color:#ffffff;padding:22px 26px;">'
        . '<div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.86;">Kasailaya Resort</div>'
        . '<h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">' . $safeHeading . '</h1>'
        . '</div>'
        . '<div style="padding:26px;">'
        . '<p style="margin:0 0 14px;">Hello ' . $safeName . ',</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;">' . $safeIntro . '</p>'
        . '<div style="margin:24px 0;padding:18px;border:1px solid #d8c8a8;border-radius:8px;background:#fbf7ef;text-align:center;">'
        . '<div style="font-size:13px;color:#6b5f4a;margin-bottom:8px;">Your 6-digit OTP</div>'
        . '<div style="font-size:34px;letter-spacing:8px;font-weight:700;color:#214332;">' . $safeOtp . '</div>'
        . '</div>'
        . '<p style="margin:0 0 14px;line-height:1.6;"><strong>This code expires in 5 minutes.</strong></p>'
        . '<p style="margin:0;color:#667085;line-height:1.6;">' . $safeIgnore . '</p>'
        . '</div></div></div></div>';
}

if (!function_exists('table_exists')) {
    function table_exists(PDO $pdo, string $table): bool
    {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table");
        $stmt->execute(['table' => $table]);
        return (bool) $stmt->fetchColumn();
    }
}

if (!function_exists('column_exists')) {
    function column_exists(PDO $pdo, string $table, string $column): bool
    {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column");
        $stmt->execute(['table' => $table, 'column' => $column]);
        return (bool) $stmt->fetchColumn();
    }
}

function ensure_pending_registration_schema(): void
{
    $pdo = db();
    ensure_auth_otp_schema($pdo);

    // Create pending_registrations table if it doesn't exist
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table");
    $stmt->execute(['table' => 'pending_registrations']);
    $exists = (int) $stmt->fetchColumn() > 0;

    if (!$exists) {
        $sql = "CREATE TABLE IF NOT EXISTS pending_registrations (
            id VARCHAR(64) NOT NULL PRIMARY KEY,
            created_date DATETIME NULL,
            updated_date DATETIME NULL,
            email VARCHAR(255) NULL,
            full_name VARCHAR(255) NULL,
            birth_date DATE NULL,
            phone VARCHAR(50) NULL,
            password_hash TEXT NULL,
            role VARCHAR(50) NULL,
            app_id VARCHAR(100) NULL,
            app_role VARCHAR(50) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
        try {
            $pdo->exec($sql);
        } catch (Throwable $e) {
            // ignore creation errors; operations below will handle missing schema gracefully
        }
    }

    if (!column_exists($pdo, 'pending_registrations', 'birth_date')) {
        try {
            $pdo->exec('ALTER TABLE pending_registrations ADD COLUMN birth_date DATE NULL AFTER full_name');
        } catch (Throwable $e) {
            // ignore - older MySQL may not support IF NOT EXISTS on column add
        }
    }

    // Add pending_registration_id column to registration_otps if missing
    $colStmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column");
    $colStmt->execute(['table' => 'registration_otps', 'column' => 'pending_registration_id']);
    $colExists = (int) $colStmt->fetchColumn() > 0;

    if (!$colExists) {
        try {
            $pdo->exec('ALTER TABLE registration_otps ADD COLUMN pending_registration_id VARCHAR(64) NULL');
        } catch (Throwable $e) {
            // ignore - older MySQL may not support IF NOT EXISTS on column add
        }
    }
}

function validate_password_rule(string $password): void
{
    $settings = security_settings();
    $minLength = max(6, (int) ($settings['min_password_length'] ?? 8));

    if (mb_strlen($password) < $minLength) {
        json_error('Password must be at least ' . $minLength . ' characters long.', 422);
    }

    if (!empty($settings['require_strong_password'])) {
        $hasUpper = preg_match('/[A-Z]/', $password) === 1;
        $hasLower = preg_match('/[a-z]/', $password) === 1;
        $hasNumber = preg_match('/\d/', $password) === 1;
        $hasSymbol = preg_match('/[^A-Za-z\d]/', $password) === 1;

        if (!$hasUpper || !$hasLower || !$hasNumber || !$hasSymbol) {
            json_error('Password must include uppercase, lowercase, number, and special character.', 422);
        }
    }
}

function validate_email_rule(string $email): void
{
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('Please provide a valid email address.', 422);
    }
}

function build_full_name_from_parts(string $firstName, string $middleName = '', string $lastName = ''): string
{
    return trim(implode(' ', array_values(array_filter([
        trim($firstName),
        trim($middleName),
        trim($lastName),
    ], static fn ($value) => $value !== ''))));
}

function validate_birth_date_for_guest_signup(string $birthDate): string
{
    $birthDate = trim($birthDate);

    if ($birthDate === '') {
        json_error('Birthday is required.', 422);
    }

    $timezone = new DateTimeZone('Asia/Manila');
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $birthDate, $timezone);
    $errors = DateTimeImmutable::getLastErrors();

    if (
        !$parsed
        || ($errors !== false && (($errors['warning_count'] ?? 0) > 0 || ($errors['error_count'] ?? 0) > 0))
        || $parsed->format('Y-m-d') !== $birthDate
    ) {
        json_error('Please provide a valid birthday.', 422);
    }

    $today = new DateTimeImmutable('today', $timezone);

    if ($parsed > $today) {
        json_error('Birthday cannot be in the future.', 422);
    }

    $age = (int) $parsed->diff($today)->y;

    if ($age < 18) {
        json_error('Guests must be at least 18 years old to create an account.', 422);
    }

    return $birthDate;
}

function start_authenticated_session(array $user): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['authenticated_at'] = time();
    $_SESSION['last_activity_at'] = time();
}

function destroy_authenticated_session(): void
{
    if (isset($_SESSION)) {
        $_SESSION = [];
    }

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        @setcookie(session_name(), '', time() - 42000, '/');
        @setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'] ?? '/',
            $params['domain'] ?? '',
            $params['secure'] ?? false,
            $params['httponly'] ?? true
        );

        if (!empty($_SERVER['HTTP_HOST'])) {
            @setcookie(session_name(), '', time() - 42000, $params['path'] ?? '/', $_SERVER['HTTP_HOST'], isset($_SERVER['HTTPS']), true);
        }

        if (isset($_COOKIE[session_name()])) {
            unset($_COOKIE[session_name()]);
        }
    }

    @session_destroy();
}

function record_failed_login_attempt(array $user): void
{
    $settings = security_settings();
    $maxAttempts = max(1, (int) ($settings['max_login_attempts'] ?? 5));
    $lockoutMinutes = max(1, (int) ($settings['lockout_minutes'] ?? 15));
    $nextAttempts = ((int) ($user['failed_login_attempts'] ?? 0)) + 1;
    $lockoutUntil = null;

    if ($nextAttempts >= $maxAttempts) {
        $nextAttempts = 0;
        $lockoutUntil = (new DateTimeImmutable('+' . $lockoutMinutes . ' minutes'))->format('Y-m-d H:i:s');
    }

    $statement = db()->prepare(
        'UPDATE users
         SET failed_login_attempts = :failed_login_attempts,
             lockout_until = :lockout_until,
             updated_date = :updated_date
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $user['id'],
        'failed_login_attempts' => $nextAttempts,
        'lockout_until' => $lockoutUntil,
        'updated_date' => now_mysql(),
    ]);
}

function clear_login_protection_state(string $userId): void
{
    $statement = db()->prepare(
        'UPDATE users
         SET failed_login_attempts = 0,
             lockout_until = NULL,
             last_login_at = :last_login_at,
             updated_date = :updated_date
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $userId,
        'last_login_at' => now_mysql(),
        'updated_date' => now_mysql(),
    ]);
}

function reset_login_protection_state(string $userId): void
{
    $statement = db()->prepare(
        'UPDATE users
         SET failed_login_attempts = 0,
             lockout_until = NULL,
             updated_date = :updated_date
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $userId,
        'updated_date' => now_mysql(),
    ]);
}

function ensure_user_not_locked(array $user): void
{
    $lockoutUntil = trim((string) ($user['lockout_until'] ?? ''));

    if ($lockoutUntil === '') {
        return;
    }

    $lockoutTimestamp = strtotime($lockoutUntil);
    if ($lockoutTimestamp === false) {
        return;
    }

    if ($lockoutTimestamp <= time()) {
        $statement = db()->prepare('UPDATE users SET lockout_until = NULL, failed_login_attempts = 0, updated_date = :updated_date WHERE id = :id');
        $statement->execute([
            'id' => $user['id'],
            'updated_date' => now_mysql(),
        ]);
        return;
    }

    $remainingMinutes = max(1, (int) ceil(($lockoutTimestamp - time()) / 60));
    json_error('Too many failed login attempts. Try again in ' . $remainingMinutes . ' minute(s).', 423, [
        'code' => 'account_locked',
        'locked_until' => $lockoutUntil,
    ]);
}

function send_login_notification(array $user): void
{
    $settings = security_settings();
    if (empty($settings['enable_login_notifications'])) {
        return;
    }

    $ipAddress = trim((string) ($_SERVER['REMOTE_ADDR'] ?? 'Unknown IP'));
    $userAgent = trim((string) ($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown device'));
    $timestamp = (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('F j, Y g:i A');

    try {
        send_app_email(
            (string) $user['email'],
            'New sign-in to your Kasailaya Resort account',
            kasa_email_layout(
                'New Sign-In',
                '<p>Hello ' . htmlspecialchars((string) ($user['full_name'] ?? 'Guest'), ENT_QUOTES | ENT_HTML5, 'UTF-8') . ',</p>'
                . '<p>Your account signed in successfully.</p>'
                . '<p><strong>Time:</strong> ' . htmlspecialchars($timestamp, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '<br>'
                . '<strong>IP Address:</strong> ' . htmlspecialchars($ipAddress, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '<br>'
                . '<strong>Device:</strong> ' . htmlspecialchars($userAgent, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '</p>'
                . '<p>If this was not you, change your password immediately.</p>'
            ),
            'main'
        );
    } catch (Throwable $exception) {
    }
}

function google_client_id(): string
{
    return trim((string) (app_config()['google']['client_id'] ?? ''));
}

function fetch_remote_json(string $url): array
{
    $response = null;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $response = curl_exec($ch);
        $statusCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false || $statusCode >= 400) {
            throw new RuntimeException($curlError !== '' ? $curlError : 'Remote authentication request failed.');
        }
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 10,
                'header' => "Accept: application/json\r\n",
            ],
        ]);

        $response = @file_get_contents($url, false, $context);
        if ($response === false) {
            throw new RuntimeException('Unable to contact the Google verification service.');
        }
    }

    $decoded = json_decode((string) $response, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Invalid response from Google verification service.');
    }

    return $decoded;
}

function verify_google_id_token(string $credential): array
{
    $clientId = google_client_id();
    if ($clientId === '') {
        throw new RuntimeException('Google sign-in is not configured.');
    }

    $payload = fetch_remote_json('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential));

    if (($payload['aud'] ?? '') !== $clientId) {
        throw new RuntimeException('Google token audience is invalid.');
    }

    $issuer = (string) ($payload['iss'] ?? '');
    if (!in_array($issuer, ['accounts.google.com', 'https://accounts.google.com'], true)) {
        throw new RuntimeException('Google token issuer is invalid.');
    }

    $email = normalized_email((string) ($payload['email'] ?? ''));
    if ($email === '' || ($payload['email_verified'] ?? '') !== 'true') {
        throw new RuntimeException('Google account email is not verified.');
    }

    return $payload;
}

function normalize_registration_code(string $code): string
{
    return preg_replace('/\D+/', '', trim($code)) ?? '';
}

function temporary_registration_otp(): string
{
    $config = app_config();
    return normalize_registration_code((string) ($config['registration']['temporary_verification_code'] ?? ''));
}

function send_registration_otp_email(
    string $email,
    string $recipientName,
    ?string $userId = null,
    ?string $pendingRegistrationId = null,
    string $ignoreMessage = 'If you did not request this, you can ignore this email.'
): array {
    if ($userId === null && $pendingRegistrationId === null) {
        throw new InvalidArgumentException('A user or pending registration is required to send an OTP.');
    }

    if ($pendingRegistrationId !== null) {
        ensure_pending_registration_schema();
    }

    $cooldownRecord = null;

    if ($userId !== null) {
        $cooldownStatement = db()->prepare('SELECT created_date FROM registration_otps WHERE user_id = :user_id ORDER BY created_date DESC LIMIT 1');
        $cooldownStatement->execute(['user_id' => $userId]);
        $cooldownRecord = $cooldownStatement->fetch();
    }

    if ($pendingRegistrationId !== null) {
        $cooldownStatement = db()->prepare('SELECT created_date FROM registration_otps WHERE pending_registration_id = :pending_id ORDER BY created_date DESC LIMIT 1');
        $cooldownStatement->execute(['pending_id' => $pendingRegistrationId]);
        $cooldownRecord = $cooldownStatement->fetch();
    }

    $retryAfter = seconds_until_resend_allowed($cooldownRecord['created_date'] ?? null);
    if ($retryAfter > 0) {
        json_error('Please wait before requesting another code.', 429, [
            'code' => 'otp_resend_cooldown',
            'retry_after_seconds' => $retryAfter,
        ]);
    }

    if ($userId !== null) {
        $invalidate = db()->prepare('UPDATE registration_otps SET used_at = :used_at WHERE user_id = :user_id AND used_at IS NULL');
        $invalidate->execute([
            'user_id' => $userId,
            'used_at' => now_mysql(),
        ]);
    }

    if ($pendingRegistrationId !== null) {
        $invalidate = db()->prepare('UPDATE registration_otps SET used_at = :used_at WHERE pending_registration_id = :pending_id AND used_at IS NULL');
        $invalidate->execute([
            'pending_id' => $pendingRegistrationId,
            'used_at' => now_mysql(),
        ]);
    }

    $otp = strval(random_int(100000, 999999));
    $otpHash = hash('sha256', normalize_registration_code($otp));
    $expiresAt = (new DateTimeImmutable('+' . OTP_EXPIRY_MINUTES . ' minutes'))->format('Y-m-d H:i:s');

    if ($userId !== null) {
        $statement = db()->prepare(
            'INSERT INTO registration_otps (id, user_id, otp_hash, purpose, attempts, created_date, expires_at)
             VALUES (:id, :user_id, :otp_hash, :purpose, 0, :created_date, :expires_at)'
        );

        try {
            $statement->execute([
                'id' => create_id('regotp'),
                'user_id' => $userId,
                'otp_hash' => $otpHash,
                'purpose' => 'registration',
                'created_date' => now_mysql(),
                'expires_at' => $expiresAt,
            ]);
        } catch (PDOException $e) {
            $fallback = db()->prepare('INSERT INTO registration_otps (id, otp_hash, created_date, expires_at) VALUES (:id, :otp_hash, :created_date, :expires_at)');
            $fallback->execute([
                'id' => create_id('regotp'),
                'otp_hash' => $otpHash,
                'created_date' => now_mysql(),
                'expires_at' => $expiresAt,
            ]);
        }
    }

    if ($pendingRegistrationId !== null) {
        $statement = db()->prepare(
            'INSERT INTO registration_otps (id, pending_registration_id, otp_hash, purpose, attempts, created_date, expires_at)
             VALUES (:id, :pending_id, :otp_hash, :purpose, 0, :created_date, :expires_at)'
        );

        try {
            $statement->execute([
                'id' => create_id('regotp'),
                'pending_id' => $pendingRegistrationId,
                'otp_hash' => $otpHash,
                'purpose' => 'registration',
                'created_date' => now_mysql(),
                'expires_at' => $expiresAt,
            ]);
        } catch (PDOException $e) {
            $fallback = db()->prepare('INSERT INTO registration_otps (id, otp_hash, created_date, expires_at) VALUES (:id, :otp_hash, :created_date, :expires_at)');
            $fallback->execute([
                'id' => create_id('regotp'),
                'otp_hash' => $otpHash,
                'created_date' => now_mysql(),
                'expires_at' => $expiresAt,
            ]);
        }
    }

    $mailResult = send_app_email(
        $email,
        'Kasailaya Resort verification code',
        otp_email_template(
            $recipientName,
            $otp,
            'Verify your email address',
            'Use this OTP to finish creating your Kasailaya Resort account.',
            $ignoreMessage
        ),
        'main'
    );

    return public_mail_status($mailResult);
}

function registration_otp_matches(string $otp, string $otpHash): bool
{
    $otp = normalize_registration_code($otp);
    $temporaryOtp = temporary_registration_otp();

    if ($temporaryOtp !== '' && hash_equals($temporaryOtp, $otp)) {
        return true;
    }

    return hash_equals($otpHash, hash('sha256', $otp));
}

function load_reset_token_record(string $token): ?array
{
    $statement = db()->prepare(
        'SELECT prt.*, u.email, u.full_name FROM password_reset_tokens prt INNER JOIN users u ON u.id = prt.user_id WHERE prt.token_hash = :token_hash LIMIT 1'
    );
    $statement->execute(['token_hash' => reset_token_hash($token)]);
    $record = $statement->fetch();
    return $record ?: null;
}

function normalize_reset_code(string $code): string
{
    return preg_replace('/\D+/', '', trim($code)) ?? '';
}

function reset_code_hash(string $userId, string $code): string
{
    return hash('sha256', $userId . '|' . normalize_reset_code($code));
}

function reset_token_hash(string $token): string
{
    return hash('sha256', $token);
}

function user_phone_matches(array $user, string $phone): bool
{
    $submittedPhone = normalize_ph_mobile_number($phone);
    $storedPhone = normalize_ph_mobile_number((string) ($user['phone'] ?? ''));

    return $submittedPhone !== null && $storedPhone !== null && hash_equals($storedPhone, $submittedPhone);
}

function find_user_by_phone(string $phone): ?array
{
    $normalizedPhone = normalize_ph_mobile_number($phone);
    if ($normalizedPhone === null) {
        return null;
    }

    $statement = db()->prepare(
        "SELECT * FROM users
         WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone, ''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') IN (:local_phone, :intl_phone)
         LIMIT 1"
    );
    $statement->execute([
        'local_phone' => '0' . substr($normalizedPhone, 2),
        'intl_phone' => $normalizedPhone,
    ]);
    $user = $statement->fetch();
    return $user ?: null;
}

function reset_identifier_method(array $payload): string
{
    return 'email';
}

function find_user_for_reset_payload(array $payload): ?array
{
    return find_user_by_email(normalized_email((string) ($payload['email'] ?? '')));
}

function validate_reset_identifier_payload(array $payload): void
{
    if (normalized_email((string) ($payload['email'] ?? '')) === '') {
        json_error('Email is required.', 422);
    }
}

function load_reset_code_record_for_user(array $user, string $code): ?array
{
    $statement = db()->prepare(
        'SELECT pro.*, u.email, u.full_name FROM password_reset_otps pro INNER JOIN users u ON u.id = pro.user_id WHERE pro.user_id = :user_id AND pro.otp_hash = :otp_hash AND pro.used_at IS NULL ORDER BY pro.created_date DESC LIMIT 1'
    );
    $statement->execute([
        'user_id' => $user['id'],
        'otp_hash' => reset_code_hash((string) $user['id'], $code),
    ]);
    $record = $statement->fetch();
    return $record ?: null;
}

function load_reset_code_record(string $email, string $code): ?array
{
    $user = find_user_by_email($email);
    if (!$user) {
        return null;
    }

    return load_reset_code_record_for_user($user, $code);
}

function record_failed_reset_otp_attempt_for_user(?array $user): void
{
    if (!$user) {
        return;
    }

    $statement = db()->prepare(
        'SELECT id, attempts, expires_at FROM password_reset_otps WHERE user_id = :user_id AND used_at IS NULL ORDER BY created_date DESC LIMIT 1'
    );
    $statement->execute(['user_id' => $user['id']]);
    $record = $statement->fetch();

    if (!$record || strtotime((string) $record['expires_at']) < time()) {
        return;
    }

    $attempt = db()->prepare('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = :id');
    $attempt->execute(['id' => $record['id']]);
}

function record_failed_reset_otp_attempt(string $email): void
{
    record_failed_reset_otp_attempt_for_user(find_user_by_email($email));
}

function send_password_reset_otp(array $user, string $deliveryMethod = 'email'): array
{
    $pdo = db();

    $cooldownStatement = $pdo->prepare('SELECT created_date FROM password_reset_otps WHERE user_id = :user_id ORDER BY created_date DESC LIMIT 1');
    $cooldownStatement->execute(['user_id' => $user['id']]);
    $cooldownRecord = $cooldownStatement->fetch();
    $retryAfter = seconds_until_resend_allowed($cooldownRecord['created_date'] ?? null);

    if ($retryAfter > 0) {
        return ['mail_sent' => true];
    }

    $code = strval(random_int(100000, 999999));

    $expiresAt = (new DateTimeImmutable('+' . OTP_EXPIRY_MINUTES . ' minutes'))->format('Y-m-d H:i:s');
    $now = now_mysql();

    $invalidateOtps = $pdo->prepare('UPDATE password_reset_otps SET used_at = :used_at WHERE user_id = :user_id AND used_at IS NULL');
    $invalidateOtps->execute([
        'user_id' => $user['id'],
        'used_at' => $now,
    ]);

    $invalidateTokens = $pdo->prepare('UPDATE password_reset_tokens SET used_at = :used_at WHERE user_id = :user_id AND used_at IS NULL');
    $invalidateTokens->execute([
        'user_id' => $user['id'],
        'used_at' => $now,
    ]);

    $statement = $pdo->prepare(
        'INSERT INTO password_reset_otps (id, user_id, otp_hash, attempts, created_date, expires_at, used_at, verified_at)
         VALUES (:id, :user_id, :otp_hash, 0, :created_date, :expires_at, NULL, NULL)'
    );
    $statement->execute([
        'id' => create_id('resetotp'),
        'user_id' => $user['id'],
        'otp_hash' => reset_code_hash((string) $user['id'], $code),
        'created_date' => $now,
        'expires_at' => $expiresAt,
    ]);

    $mailResult = send_app_email(
        (string) $user['email'],
        'Your Kasailaya Resort password reset code',
        otp_email_template(
            (string) ($user['full_name'] ?? 'Guest'),
            $code,
            'Reset your password',
            'Use this OTP to verify your password reset request for Kasailaya Resort.',
            'If you did not request this change, you can ignore this email.'
        ),
        'main'
    );

    return public_mail_status($mailResult);
}

function create_reset_authorization_token(string $userId): string
{
    $token = bin2hex(random_bytes(32));
    $now = now_mysql();
    $expiresAt = (new DateTimeImmutable('+' . RESET_AUTH_EXPIRY_MINUTES . ' minutes'))->format('Y-m-d H:i:s');

    $invalidate = db()->prepare('UPDATE password_reset_tokens SET used_at = :used_at WHERE user_id = :user_id AND used_at IS NULL');
    $invalidate->execute([
        'user_id' => $userId,
        'used_at' => $now,
    ]);

    $statement = db()->prepare(
        'INSERT INTO password_reset_tokens (id, user_id, token_hash, purpose, attempts, created_date, expires_at, used_at)
         VALUES (:id, :user_id, :token_hash, :purpose, 0, :created_date, :expires_at, NULL)'
    );
    $statement->execute([
        'id' => create_id('resetauth'),
        'user_id' => $userId,
        'token_hash' => reset_token_hash($token),
        'purpose' => 'reset_authorization',
        'created_date' => $now,
        'expires_at' => $expiresAt,
    ]);

    return $token;
}

function complete_pending_registration(array $pending): void
{
    $pendingBirthDate = validate_birth_date_for_guest_signup((string) ($pending['birth_date'] ?? ''));
    $pdo = db();
    $pdo->beginTransaction();

    try {
        $now = now_mysql();
        $newId = create_id('user');
        $createUser = $pdo->prepare(
            'INSERT INTO users (id, created_date, updated_date, email, full_name, birth_date, phone, role, password_hash, disabled, is_verified, app_id, is_service, app_role)
             VALUES (:id, :created_date, :updated_date, :email, :full_name, :birth_date, :phone, :role, :password_hash, :disabled, :is_verified, :app_id, :is_service, :app_role)'
        );
        $createUser->execute([
            'id' => $newId,
            'created_date' => $now,
            'updated_date' => $now,
            'email' => $pending['email'],
            'full_name' => $pending['full_name'],
            'birth_date' => $pendingBirthDate,
            'phone' => $pending['phone'],
            'role' => $pending['role'] ?? 'guest',
            'password_hash' => $pending['password_hash'],
            'disabled' => 0,
            'is_verified' => 1,
            'app_id' => $pending['app_id'] ?? 'local-kasa-ilaya',
            'is_service' => 0,
            'app_role' => $pending['app_role'] ?? 'guest',
        ]);

        $consumePendingOtps = $pdo->prepare('UPDATE registration_otps SET used_at = :used_at, verified_at = :verified_at WHERE pending_registration_id = :pending_id AND used_at IS NULL');
        $consumePendingOtps->execute([
            'pending_id' => $pending['id'],
            'used_at' => $now,
            'verified_at' => $now,
        ]);

        $delPending = $pdo->prepare('DELETE FROM pending_registrations WHERE id = :id');
        $delPending->execute(['id' => $pending['id']]);

        $pdo->commit();
    } catch (Throwable $transactionError) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $transactionError;
    }
}

try {
    if ($action === 'captcha-challenge' && $method === 'GET') {
        json_response(create_captcha_challenge((string) query_param('purpose', 'login')));
    }

    if ($action === 'verify-captcha' && $method === 'POST') {
        $payload = request_body();
        $result = verify_captcha_answer(
            (string) ($payload['purpose'] ?? 'login'),
            (string) ($payload['answer'] ?? '')
        );

        if (!($result['verified'] ?? false)) {
            json_response($result, 422);
        }

        json_response($result);
    }

    if ($action === 'google-config' && $method === 'GET') {
        $clientId = google_client_id();

        json_response([
            'enabled' => $clientId !== '',
            'client_id' => $clientId !== '' ? $clientId : null,
        ]);
    }

    if ($action === 'firebase-config' && $method === 'GET') {
        json_response(['enabled' => false]);
    }

    if ($action === 'me' && $method === 'GET') {
        $user = current_user();

        if ($user === null) {
            json_error('Not authenticated.', 401);
        }

        json_response($user);
    }

    if ($action === 'login' && $method === 'POST') {
        $payload = request_body();
        $nextUrl = (string) ($payload['next_url'] ?? '/');
        $email = normalized_email((string) ($payload['email'] ?? ''));
        $password = (string) ($payload['password'] ?? '');

        if ($email === '' || $password === '') {
            json_error('Email and password are required.', 422);
        }

        validate_email_rule($email);

        $user = find_user_by_email($email);

        if ($user) {
            ensure_user_not_locked($user);
        }

        if (!$user || empty($user['password_hash']) || !password_verify($password, (string) $user['password_hash'])) {
            if ($user) {
                record_failed_login_attempt($user);
            }
            json_error('Invalid email or password.', 401);
        }

        if ((int) ($user['is_verified'] ?? 0) !== 1) {
            json_error('Please verify your email address before signing in.', 403, [
                'code' => 'email_not_verified',
            ]);
        }

        if ((int) $user['disabled'] === 1) {
            json_error('This account is disabled.', 403);
        }

        clear_login_protection_state((string) $user['id']);
        start_authenticated_session($user);
        send_login_notification($user);

        json_response([
            'success' => true,
            'next_url' => $nextUrl,
            'user' => current_user(),
        ]);
    }

    if ($action === 'complete-login-captcha' && $method === 'POST') {
        $payload = request_body();
        $captchaResult = verify_captcha_answer('login', (string) ($payload['answer'] ?? ''));

        if (!($captchaResult['verified'] ?? false)) {
            json_response($captchaResult, 422);
        }

        $pending = consume_pending_login();
        $user = $pending['user'];

        clear_login_protection_state((string) $user['id']);
        start_authenticated_session($user);
        send_login_notification($user);

        json_response([
            'success' => true,
            'next_url' => $pending['next_url'],
            'user' => current_user(),
        ]);
    }

    if ($action === 'register' && $method === 'POST') {
        $payload = request_body();
        $firstName = trim((string) ($payload['first_name'] ?? ''));
        $middleName = trim((string) ($payload['middle_name'] ?? ''));
        $lastName = trim((string) ($payload['last_name'] ?? ''));
        $fullName = trim((string) ($payload['full_name'] ?? ''));
        $email = normalized_email((string) ($payload['email'] ?? ''));
        $birthDate = trim((string) ($payload['birth_date'] ?? ''));
        $phone = trim((string) ($payload['phone'] ?? ''));
        $password = (string) ($payload['password'] ?? '');
        $nextUrl = (string) ($payload['next_url'] ?? '/');

        if ($fullName === '') {
            $fullName = build_full_name_from_parts($firstName, $middleName, $lastName);
        }

        if ($fullName === '' || $email === '' || $phone === '' || $password === '') {
            json_error('Full name, email, phone number, and password are required.', 422);
        }

        $birthDate = validate_birth_date_for_guest_signup($birthDate);
        validate_email_rule($email);
        validate_password_rule($password);

        if (normalize_ph_mobile_number($phone) === null) {
            json_error('Please enter a valid Philippine mobile number using 09XXXXXXXXX or 639XXXXXXXXX.', 422);
        }

        if (find_user_by_email($email)) {
            json_error('An account with that email already exists.', 409);
        }

        // If a pending registration already exists for this email, update it and return pending
        ensure_pending_registration_schema();
        $pendingCheck = db()->prepare('SELECT * FROM pending_registrations WHERE email = :email LIMIT 1');
        $pendingCheck->execute(['email' => $email]);
        $existingPending = $pendingCheck->fetch();

        $now = now_mysql();

        if ($existingPending) {
            // Update existing pending registration with latest details
            $update = db()->prepare('UPDATE pending_registrations SET full_name = :full_name, birth_date = :birth_date, phone = :phone, password_hash = :password_hash, updated_date = :updated_date WHERE id = :id');
            $update->execute([
                'id' => $existingPending['id'],
                'full_name' => $fullName,
                'birth_date' => $birthDate,
                'phone' => $phone !== '' ? $phone : null,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'updated_date' => $now,
            ]);

            $deliveryStatus = send_registration_otp_email(
                $email,
                (string) ($existingPending['full_name'] ?? $fullName),
                null,
                (string) $existingPending['id']
            );

            json_response([
                'success' => true,
                'next_url' => $nextUrl,
                'pending' => true,
                'email' => $email,
                'phone' => normalize_ph_mobile_number($phone),
                'mail_sent' => $deliveryStatus['mail_sent'] ?? true,
                'verification_provider' => 'server',
            ], 200);
        }

        // Create a pending registration instead of a user until email verification completes
        $pendingId = create_id('pending');

        $statement = db()->prepare(
            'INSERT INTO pending_registrations (id, created_date, updated_date, email, full_name, birth_date, phone, password_hash, role, app_id, app_role)
             VALUES (:id, :created_date, :updated_date, :email, :full_name, :birth_date, :phone, :password_hash, :role, :app_id, :app_role)'
        );
        $statement->execute([
            'id' => $pendingId,
            'created_date' => $now,
            'updated_date' => $now,
            'email' => $email,
            'full_name' => $fullName,
            'birth_date' => $birthDate,
            'phone' => $phone !== '' ? $phone : null,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role' => 'guest',
            'app_id' => 'local-kasa-ilaya',
            'app_role' => 'guest',
        ]);

        $deliveryStatus = send_registration_otp_email(
            $email,
            $fullName,
            null,
            $pendingId
        );

        json_response([
            'success' => true,
            'next_url' => $nextUrl,
            'pending' => true,
            'email' => $email,
            'phone' => normalize_ph_mobile_number($phone),
            'mail_sent' => $deliveryStatus['mail_sent'] ?? true,
            'verification_provider' => 'server',
        ], 201);
    }

    if ($action === 'google-login' && $method === 'POST') {
        $payload = request_body();
        $credential = trim((string) ($payload['credential'] ?? ''));
        $nextUrl = (string) ($payload['next_url'] ?? '/');

        if ($credential === '') {
            json_error('Google credential is required.', 422);
        }

        try {
            $googleUser = verify_google_id_token($credential);
        } catch (Throwable $error) {
            json_error($error->getMessage(), 401);
        }

        $email = normalized_email((string) ($googleUser['email'] ?? ''));
        $user = find_user_by_email($email);

        if ($user) {
            ensure_user_not_locked($user);
        }

        if ($user && (int) ($user['disabled'] ?? 0) === 1) {
            json_error('This account is disabled.', 403);
        }

        if (!$user) {
            ensure_pending_registration_schema();

            $pendingStmt = db()->prepare('SELECT * FROM pending_registrations WHERE email = :email LIMIT 1');
            $pendingStmt->execute(['email' => $email]);
            $pending = $pendingStmt->fetch();

            $name = trim((string) ($googleUser['name'] ?? ''));
            $givenName = trim((string) ($googleUser['given_name'] ?? ''));
            $familyName = trim((string) ($googleUser['family_name'] ?? ''));
            $googleFullName = $name !== '' ? $name : build_full_name_from_parts($givenName, '', $familyName);
            $payloadFullName = trim((string) ($payload['full_name'] ?? ''));
            $payloadBirthDate = trim((string) ($payload['birth_date'] ?? ''));
            $payloadPhone = trim((string) ($payload['phone'] ?? ''));

            if (!$pending && $payloadBirthDate === '') {
                json_error('Please create an account with your birthday before signing in with Google.', 403, [
                    'code' => 'birthday_required',
                ]);
            }

            $accountBirthDate = validate_birth_date_for_guest_signup((string) ($pending['birth_date'] ?? $payloadBirthDate));
            $accountFullName = trim((string) ($pending['full_name'] ?? $payloadFullName));
            $accountPhone = trim((string) ($pending['phone'] ?? $payloadPhone));

            if ($accountFullName === '') {
                $accountFullName = $googleFullName !== '' ? $googleFullName : (strstr($email, '@', true) ?: 'Google User');
            }

            $now = now_mysql();

            $createUser = db()->prepare(
                'INSERT INTO users (id, created_date, updated_date, email, full_name, birth_date, phone, role, password_hash, disabled, is_verified, app_id, is_service, app_role)
                 VALUES (:id, :created_date, :updated_date, :email, :full_name, :birth_date, :phone, :role, :password_hash, :disabled, :is_verified, :app_id, :is_service, :app_role)'
            );
            $createUser->execute([
                'id' => create_id('user'),
                'created_date' => $now,
                'updated_date' => $now,
                'email' => $pending['email'] ?? $email,
                'full_name' => $accountFullName,
                'birth_date' => $accountBirthDate,
                'phone' => $accountPhone !== '' ? $accountPhone : null,
                'role' => $pending['role'] ?? 'guest',
                'password_hash' => $pending['password_hash'] ?? null,
                'disabled' => 0,
                'is_verified' => 1,
                'app_id' => $pending['app_id'] ?? 'local-kasa-ilaya',
                'is_service' => 0,
                'app_role' => $pending['app_role'] ?? 'guest',
            ]);

            if ($pending) {
                $consumePendingOtps = db()->prepare('UPDATE registration_otps SET used_at = :used_at WHERE pending_registration_id = :pending_id AND used_at IS NULL');
                $consumePendingOtps->execute([
                    'pending_id' => $pending['id'],
                    'used_at' => $now,
                ]);

                $delPending = db()->prepare('DELETE FROM pending_registrations WHERE id = :id');
                $delPending->execute(['id' => $pending['id']]);
            }
        } else {
            if ((int) ($user['is_verified'] ?? 0) !== 1) {
                $updateUser = db()->prepare('UPDATE users SET is_verified = 1, updated_date = :updated_date WHERE id = :id');
                $updateUser->execute([
                    'id' => $user['id'],
                    'updated_date' => now_mysql(),
                ]);
            }
        }

        $user = find_user_by_email($email);
        if (!$user) {
            json_error('Unable to complete Google sign-in.', 500);
        }

        clear_login_protection_state((string) $user['id']);
        start_authenticated_session($user);
        send_login_notification($user);
        json_response([
            'success' => true,
            'next_url' => $nextUrl,
            'user' => current_user(),
        ]);
    }

    if ($action === 'send-registration-otp' && $method === 'POST') {
        $payload = request_body();
        $email = normalized_email((string) ($payload['email'] ?? ''));

        if ($email === '') {
            json_error('Email is required.', 422);
        }

        // Try existing verified user
        $user = find_user_by_email($email);
        if ($user) {
            if ((int) $user['is_verified'] === 1) {
                json_response(['success' => true, 'message' => 'Account already verified.']);
            }

            $deliveryStatus = send_registration_otp_email(
                (string) ($user['email'] ?? $email),
                (string) ($user['full_name'] ?? 'Guest'),
                (string) $user['id'],
                null
            );

            json_response([
                'success' => true,
                'phone' => normalize_ph_mobile_number((string) ($user['phone'] ?? '')),
                'mail_sent' => $deliveryStatus['mail_sent'] ?? true,
                'verification_provider' => 'server',
            ]);
        }

        // Look for a pending registration
        // Ensure DB schema for pending registrations / otps exists (in case migrations weren't run)
        ensure_pending_registration_schema();

        $pendingStmt = db()->prepare('SELECT * FROM pending_registrations WHERE email = :email LIMIT 1');
        $pendingStmt->execute(['email' => $email]);
        $pending = $pendingStmt->fetch();

        if (!$pending) {
            json_error('No pending registration found for this email. Please register first.', 404);
        }

        $deliveryStatus = send_registration_otp_email(
            (string) ($pending['email'] ?? $email),
            (string) ($pending['full_name'] ?? 'Guest'),
            null,
            (string) $pending['id']
        );

        json_response([
            'success' => true,
            'phone' => normalize_ph_mobile_number((string) ($pending['phone'] ?? '')),
            'mail_sent' => $deliveryStatus['mail_sent'] ?? true,
            'verification_provider' => 'server',
        ]);
    }

    if ($action === 'complete-firebase-registration' && $method === 'POST') {
        json_error('SMS OTP is disabled. Account verification codes are sent by email only.', 410);
    }

    // Debug helper: inspect pending registration and OTPs for an email
    if ($action === 'inspect-pending' && $method === 'GET') {
        $email = normalized_email((string) query_param('email', ''));
        if ($email === '') {
            json_error('Email is required.', 422);
        }

        ensure_pending_registration_schema();

        $pendingStmt = db()->prepare('SELECT * FROM pending_registrations WHERE email = :email');
        $pendingStmt->execute(['email' => $email]);
        $pendings = $pendingStmt->fetchAll();

        $otpStmt = db()->prepare('SELECT * FROM registration_otps WHERE user_id IN (SELECT id FROM users WHERE email = :email) OR pending_registration_id IN (SELECT id FROM pending_registrations WHERE email = :email) ORDER BY created_date DESC');
        $otpStmt->execute(['email' => $email]);
        $otps = $otpStmt->fetchAll();

        json_response(['pendings' => $pendings ?: [], 'otps' => $otps ?: []]);
    }

    // Debug: return recent mail_logs for an email (or global recent if none provided)
    if ($action === 'mail-logs' && $method === 'GET') {
        $email = normalized_email((string) query_param('email', ''));
        $pdo = db();

        if ($email !== '') {
            $stmt = $pdo->prepare('SELECT * FROM mail_logs WHERE to_email = :email ORDER BY sent_at DESC LIMIT 50');
            $stmt->execute(['email' => $email]);
            $rows = $stmt->fetchAll();
            json_response(['logs' => $rows]);
        }

        $stmt = $pdo->prepare('SELECT * FROM mail_logs ORDER BY sent_at DESC LIMIT 50');
        $stmt->execute();
        $rows = $stmt->fetchAll();
        json_response(['logs' => $rows]);
    }

    // Send a test email to verify SMTP is working
    if ($action === 'send-test-email' && in_array($method, ['GET', 'POST'], true)) {
        $email = normalized_email((string) query_param('email', ''));
        if ($email === '') {
            json_error('Email is required.', 422);
        }

        $subject = 'Kasailaya Resort - Test email';
        $body = kasa_email_layout('Test Email', '<p>This is a test email from Kasailaya Resort. If you receive this, SMTP is configured correctly.</p>');

        try {
            $result = send_app_email($email, $subject, $body, 'main');
            json_response(['success' => true, 'result' => $result]);
        } catch (Throwable $e) {
            json_error('Failed to send test email: ' . sanitize_mail_error_message($e->getMessage()), 500);
        }
    }

    if ($action === 'test-sms-otp' && in_array($method, ['GET', 'POST'], true)) {
        json_error('SMS OTP is disabled. Verification codes are sent by email only.', 410);
    }

    // Temporary endpoint to apply pending registration schema migration
    if ($action === 'apply-pending-migration' && in_array($method, ['GET', 'POST'], true)) {
        try {
            ensure_pending_registration_schema();
            json_response(['success' => true, 'message' => 'Pending registration schema ensured.']);
        } catch (Throwable $e) {
            json_error('Failed to apply migration: ' . $e->getMessage(), 500);
        }
    }

    // Repair foreign keys on registration_otps to avoid strict FK failures for orphaned OTPs
    if ($action === 'repair-registration-otps-fk' && in_array($method, ['GET', 'POST'], true)) {
        $pdo = db();
        try {
            // Attempt to drop existing FKs if they exist
            try {
                $pdo->exec('ALTER TABLE registration_otps DROP FOREIGN KEY fk_registration_otp_user');
            } catch (Throwable $e) {
                // ignore if not exists
            }

            try {
                $pdo->exec('ALTER TABLE registration_otps DROP FOREIGN KEY fk_registration_otp_pending');
            } catch (Throwable $e) {
                // ignore if not exists
            }

            // Recreate constraints with ON DELETE SET NULL to avoid blocking inserts when parents are removed
            try {
                $pdo->exec('ALTER TABLE registration_otps ADD CONSTRAINT fk_registration_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE');
            } catch (Throwable $e) {
                // ignore if cannot add
            }

            try {
                $pdo->exec('ALTER TABLE registration_otps ADD CONSTRAINT fk_registration_otp_pending FOREIGN KEY (pending_registration_id) REFERENCES pending_registrations(id) ON DELETE SET NULL ON UPDATE CASCADE');
            } catch (Throwable $e) {
                // ignore if cannot add
            }

            json_response(['success' => true, 'message' => 'Repaired registration_otps foreign keys (set ON DELETE SET NULL).']);
        } catch (Throwable $e) {
            json_error('Failed to repair foreign keys: ' . $e->getMessage(), 500);
        }
    }

    if ($action === 'verify-registration-otp' && $method === 'POST') {
        $payload = request_body();
        $email = normalized_email((string) ($payload['email'] ?? ''));
        $otp = normalize_registration_code((string) ($payload['otp'] ?? ''));

        if ($email === '' || $otp === '') {
            json_error('Email and verification code are required.', 422);
        }

        if (strlen($otp) !== 6) {
            json_error('Verification code must be 6 digits.', 422);
        }

        // First try to find an OTP for a verified user
        $user = find_user_by_email($email);
        $record = null;

        if ($user) {
            $statement = db()->prepare('SELECT * FROM registration_otps WHERE user_id = :user_id AND purpose = :purpose AND used_at IS NULL ORDER BY created_date DESC LIMIT 1');
            $statement->execute([
                'user_id' => $user['id'],
                'purpose' => 'registration',
            ]);
            $record = $statement->fetch();

            if ($record) {
                if (strtotime((string) $record['expires_at']) < time()) {
                    json_error('The verification code has expired. Please request a new one.', 400);
                }
                if ((int) ($record['attempts'] ?? 0) >= OTP_MAX_ATTEMPTS) {
                    json_error('Too many incorrect attempts. Please request a new code.', 429);
                }
                if (!registration_otp_matches($otp, (string) $record['otp_hash'])) {
                    $attempt = db()->prepare('UPDATE registration_otps SET attempts = attempts + 1 WHERE id = :id');
                    $attempt->execute(['id' => $record['id']]);
                    json_error('Invalid verification code.', 401);
                }

                $consume = db()->prepare('UPDATE registration_otps SET used_at = :used_at, verified_at = :verified_at WHERE id = :id');
                $consume->execute([
                    'id' => $record['id'],
                    'used_at' => now_mysql(),
                    'verified_at' => now_mysql(),
                ]);

                $updateUser = db()->prepare('UPDATE users SET is_verified = 1, updated_date = :updated_date WHERE id = :id');
                $updateUser->execute([
                    'id' => $user['id'],
                    'updated_date' => now_mysql(),
                ]);

                json_response(['success' => true]);
            }
        }

        // Otherwise, check pending registrations
        // Ensure DB schema for pending registrations/otps exists
        ensure_pending_registration_schema();

        $pendingStmt = db()->prepare('SELECT * FROM pending_registrations WHERE email = :email LIMIT 1');
        $pendingStmt->execute(['email' => $email]);
        $pending = $pendingStmt->fetch();

        if (!$pending) {
            json_error('No registration or account found for this email.', 404);
        }

        $pendingBirthDate = validate_birth_date_for_guest_signup((string) ($pending['birth_date'] ?? ''));

        $otpStmt = db()->prepare('SELECT * FROM registration_otps WHERE pending_registration_id = :pending_id AND purpose = :purpose AND used_at IS NULL ORDER BY created_date DESC LIMIT 1');
        $otpStmt->execute([
            'pending_id' => $pending['id'],
            'purpose' => 'registration',
        ]);
        $record = $otpStmt->fetch();

        if (!$record) {
            json_error('No active verification code found. Please request a new one.', 404);
        }

        if (strtotime((string) $record['expires_at']) < time()) {
            json_error('The verification code has expired. Please request a new one.', 400);
        }

        if ((int) ($record['attempts'] ?? 0) >= OTP_MAX_ATTEMPTS) {
            json_error('Too many incorrect attempts. Please request a new code.', 429);
        }

        if (!registration_otp_matches($otp, (string) $record['otp_hash'])) {
            $attempt = db()->prepare('UPDATE registration_otps SET attempts = attempts + 1 WHERE id = :id');
            $attempt->execute(['id' => $record['id']]);
            json_error('Invalid verification code.', 401);
        }

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $now = now_mysql();

            $consume = $pdo->prepare('UPDATE registration_otps SET used_at = :used_at, verified_at = :verified_at WHERE id = :id AND used_at IS NULL');
            $consume->execute([
                'id' => $record['id'],
                'used_at' => $now,
                'verified_at' => $now,
            ]);

            if ($consume->rowCount() !== 1) {
                throw new RuntimeException('This verification code has already been used.');
            }

            $newId = create_id('user');
            $createUser = $pdo->prepare(
                'INSERT INTO users (id, created_date, updated_date, email, full_name, birth_date, phone, role, password_hash, disabled, is_verified, app_id, is_service, app_role)
                 VALUES (:id, :created_date, :updated_date, :email, :full_name, :birth_date, :phone, :role, :password_hash, :disabled, :is_verified, :app_id, :is_service, :app_role)'
            );
            $createUser->execute([
                'id' => $newId,
                'created_date' => $now,
                'updated_date' => $now,
                'email' => $pending['email'],
                'full_name' => $pending['full_name'],
                'birth_date' => $pendingBirthDate,
                'phone' => $pending['phone'],
                'role' => $pending['role'] ?? 'guest',
                'password_hash' => $pending['password_hash'],
                'disabled' => 0,
                'is_verified' => 1,
                'app_id' => $pending['app_id'] ?? 'local-kasa-ilaya',
                'is_service' => 0,
                'app_role' => $pending['app_role'] ?? 'guest',
            ]);

            $delPending = $pdo->prepare('DELETE FROM pending_registrations WHERE id = :id');
            $delPending->execute(['id' => $pending['id']]);

            $pdo->commit();
        } catch (Throwable $transactionError) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $transactionError;
        }

        json_response(['success' => true]);
    }

    if ($action === 'logout' && $method === 'POST') {
        $payload = request_body();
        $redirectUrl = (string) ($payload['redirect_url'] ?? '/');
        destroy_authenticated_session();
        json_response([
            'success' => true,
            'redirect_url' => $redirectUrl,
        ]);
    }

    if ($action === 'update-me' && in_array($method, ['PATCH', 'PUT'], true)) {
        $user = current_user();
        if ($user === null) {
            json_error('Not authenticated.', 401);
        }

        $payload = request_body();
        $fields = [];
        $params = ['id' => $user['id']];

        foreach (['full_name', 'email', 'phone', 'profile_image_url'] as $field) {
            if (array_key_exists($field, $payload)) {
                $fields[] = $field . ' = :' . $field;
                $params[$field] = $field === 'email'
                    ? normalized_email((string) $payload[$field])
                    : ((string) $payload[$field] !== '' ? (string) $payload[$field] : null);
            }
        }

        if (isset($params['email'])) {
            $otherUser = find_user_by_email((string) $params['email']);
            if ($otherUser && $otherUser['id'] !== $user['id']) {
                json_error('That email address is already in use.', 409);
            }
        }

        if (empty($fields)) {
            json_response($user);
        }

        $fields[] = 'updated_date = :updated_date';
        $params['updated_date'] = now_mysql();

        $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $statement = db()->prepare($sql);
        $statement->execute($params);

        json_response(current_user());
    }

    if ($action === 'change-password' && $method === 'POST') {
        $user = current_user();
        if ($user === null) {
            json_error('Not authenticated.', 401);
        }

        $payload = request_body();
        $currentPassword = (string) ($payload['current_password'] ?? '');
        $newPassword = (string) ($payload['new_password'] ?? '');

        validate_password_rule($newPassword);

        $dbUser = find_user_by_email($user['email']);
        if (!$dbUser || empty($dbUser['password_hash']) || !password_verify($currentPassword, (string) $dbUser['password_hash'])) {
            json_error('Current password is incorrect.', 401);
        }

        $statement = db()->prepare('UPDATE users SET password_hash = :password_hash, updated_date = :updated_date WHERE id = :id');
        $statement->execute([
            'id' => $user['id'],
            'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
            'updated_date' => now_mysql(),
        ]);

        reset_login_protection_state((string) $user['id']);

        json_response(['success' => true]);
    }

    if (in_array($action, ['forgot-password', 'resend-reset-otp'], true) && $method === 'POST') {
        $payload = request_body();
        require_captcha_verified('reset');
        validate_reset_identifier_payload($payload);
        $resetMethod = reset_identifier_method($payload);

        $user = find_user_for_reset_payload($payload);
        if ($user) {
            $deliveryStatus = send_password_reset_otp($user, $resetMethod);

            json_response([
                'success' => true,
                'message' => 'If the account exists, a reset code has been sent.',
                'delivery_method' => $resetMethod,
                'mail_sent' => $deliveryStatus['mail_sent'] ?? true,
            ]);
        }

        json_response([
            'success' => true,
            'message' => 'If the account exists, a reset code has been sent.',
            'delivery_method' => $resetMethod,
        ]);
    }

    if ($action === 'validate-reset-token' && $method === 'GET') {
        $token = (string) query_param('token', '');
        if ($token === '') {
            json_error('Reset token is required.', 422);
        }

        $record = load_reset_token_record($token);
        if (!$record || !empty($record['used_at']) || strtotime((string) $record['expires_at']) < time()) {
            json_error('This reset link is invalid or expired.', 404);
        }

        json_response([
            'valid' => true,
            'email' => $record['email'],
            'full_name' => $record['full_name'],
        ]);
    }

    if ($action === 'validate-reset-code' && $method === 'POST') {
        $payload = request_body();
        $code = normalize_reset_code((string) ($payload['code'] ?? ''));
        validate_reset_identifier_payload($payload);

        if ($code === '') {
            json_error('Reset code is required.', 422);
        }

        if (strlen($code) !== 6) {
            json_error('Reset code must be 6 digits.', 422);
        }

        $user = find_user_for_reset_payload($payload);
        if (!$user) {
            json_error('This reset code is invalid or expired.', 404);
        }

        $record = load_reset_code_record_for_user($user, $code);
        if (!$record) {
            record_failed_reset_otp_attempt_for_user($user);
            json_error('This reset code is invalid or expired.', 404);
        }

        if ((int) ($record['attempts'] ?? 0) >= OTP_MAX_ATTEMPTS) {
            json_error('Too many incorrect attempts. Please request a new code.', 429);
        }

        if (!empty($record['used_at']) || strtotime((string) $record['expires_at']) < time()) {
            json_error('This reset code is invalid or expired.', 404);
        }

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $now = now_mysql();
            $consumeOtp = $pdo->prepare('UPDATE password_reset_otps SET used_at = :used_at, verified_at = :verified_at WHERE id = :id AND used_at IS NULL');
            $consumeOtp->execute([
                'id' => $record['id'],
                'used_at' => $now,
                'verified_at' => $now,
            ]);

            if ($consumeOtp->rowCount() !== 1) {
                throw new RuntimeException('This reset code has already been used.');
            }

            $pdo->commit();
        } catch (Throwable $transactionError) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $transactionError;
        }

        $resetToken = create_reset_authorization_token((string) $record['user_id']);

        json_response([
            'valid' => true,
            'email' => $record['email'],
            'full_name' => $record['full_name'],
            'reset_token' => $resetToken,
        ]);
    }

    if ($action === 'validate-firebase-reset' && $method === 'POST') {
        json_error('SMS OTP is disabled. Password reset codes are sent by email only.', 410);
    }

    if ($action === 'reset-password' && $method === 'POST') {
        $payload = request_body();
        $token = (string) ($payload['token'] ?? '');
        $newPassword = (string) ($payload['new_password'] ?? '');

        if ($token === '' && !empty($payload['reset_token'])) {
            $token = (string) $payload['reset_token'];
        }

        if ($token === '') {
            json_error('Reset authorization is required. Please verify your reset code first.', 422);
        }

        validate_password_rule($newPassword);

        $record = load_reset_token_record($token);
        if (!$record || !empty($record['used_at']) || strtotime((string) $record['expires_at']) < time()) {
            json_error('This reset authorization is invalid or expired.', 404);
        }

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $updateUser = $pdo->prepare('UPDATE users SET password_hash = :password_hash, updated_date = :updated_date WHERE id = :id');
            $updateUser->execute([
                'id' => $record['user_id'],
                'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
                'updated_date' => now_mysql(),
            ]);

            reset_login_protection_state((string) $record['user_id']);

            $consumeToken = $pdo->prepare('UPDATE password_reset_tokens SET used_at = :used_at WHERE user_id = :user_id AND used_at IS NULL');
            $consumeToken->execute([
                'user_id' => $record['user_id'],
                'used_at' => now_mysql(),
            ]);

            $consumeOtps = $pdo->prepare('UPDATE password_reset_otps SET used_at = :used_at WHERE user_id = :user_id AND used_at IS NULL');
            $consumeOtps->execute([
                'user_id' => $record['user_id'],
                'used_at' => now_mysql(),
            ]);

            $pdo->commit();
        } catch (Throwable $transactionError) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $transactionError;
        }

        json_response(['success' => true]);
    }

    json_error('Unsupported auth action.', 405);
} catch (Throwable $error) {
    json_error('Unable to complete the authentication request. Please try again later.', 500);
}
