<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$entity = (string) query_param('entity', '');
$config = entity_config($entity);
$table = $config['table'];
$fields = $config['fields'];
$method = request_method();

function is_super_admin_actor(?array $actor): bool
{
    if (!$actor) {
        return false;
    }

    $role = (string) ($actor['role'] ?? '');
    $appRole = (string) ($actor['_app_role'] ?? $actor['app_role'] ?? '');

    return $role === 'super_admin' || $appRole === 'super_admin';
}

function is_admin_actor(?array $actor): bool
{
    if (!$actor) {
        return false;
    }

    $role = (string) ($actor['role'] ?? '');
    $appRole = (string) ($actor['_app_role'] ?? $actor['app_role'] ?? '');

    return in_array($role, ['admin', 'super_admin'], true) || in_array($appRole, ['admin', 'super_admin'], true);
}

if ($entity === 'User') {
    $actor = current_user();

    if (!is_super_admin_actor($actor)) {
        json_error('Forbidden.', 403);
    }
}

const REBOOKING_MIN_NOTICE_DAYS = 7;

function parse_booking_policy_date(string $value, string $fieldLabel): DateTimeImmutable
{
    $timezone = new DateTimeZone('Asia/Manila');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', trim($value), $timezone);
    $errors = DateTimeImmutable::getLastErrors();

    if (
        !$date
        || ($errors !== false && (($errors['warning_count'] ?? 0) > 0 || ($errors['error_count'] ?? 0) > 0))
        || $date->format('Y-m-d') !== trim($value)
    ) {
        json_error($fieldLabel . ' must be a valid date.', 422);
    }

    return $date;
}

function booking_start_datetime(array $booking, ?string $dateOverride = null): DateTimeImmutable
{
    $date = parse_booking_policy_date($dateOverride ?: (string) ($booking['booking_date'] ?? ''), 'Booking date')->format('Y-m-d');
    $tourType = (string) ($booking['tour_type'] ?? '');
    $timezone = new DateTimeZone('Asia/Manila');
    $time = $tourType === 'day_tour' ? '08:00:00' : '18:00:00';

    return new DateTimeImmutable($date . ' ' . $time, $timezone);
}

function ensure_rebooking_date_available(array $booking, string $requestedDate, string $excludeId): void
{
    $timezone = new DateTimeZone('Asia/Manila');
    $today = new DateTimeImmutable('today', $timezone);
    $newDate = parse_booking_policy_date($requestedDate, 'Requested rebooking date');

    if ($newDate <= $today) {
        json_error('Rebooking date must be a future date.', 422);
    }

    if ($requestedDate === (string) ($booking['booking_date'] ?? '')) {
        json_error('Please choose a different date for rebooking.', 422);
    }

    $statement = db()->prepare(
        'SELECT id FROM bookings
         WHERE package_id = :package_id
           AND booking_date = :booking_date
           AND tour_type = :tour_type
           AND status IN (\'pending\', \'confirmed\', \'completed\')
           AND id <> :exclude_id
         LIMIT 1'
    );
    $statement->execute([
        'package_id' => (string) ($booking['package_id'] ?? ''),
        'booking_date' => $requestedDate,
        'tour_type' => (string) ($booking['tour_type'] ?? ''),
        'exclude_id' => $excludeId,
    ]);

    if ($statement->fetch()) {
        json_error('The requested rebooking date is already reserved for this package and tour type.', 409);
    }
}

function booking_payload_has_rebooking_fields(array $payload): bool
{
    foreach ([
        'rebooking_status',
        'rebooking_original_date',
        'rebooking_requested_date',
        'rebooking_reason',
        'rebooking_requested_at',
        'rebooking_resolved_at',
        'rebooking_resolution_note',
        'rebooking_count',
    ] as $field) {
        if (array_key_exists($field, $payload)) {
            return true;
        }
    }

    return false;
}

function apply_rebooking_policy(array $existing, array &$payload): void
{
    if (!booking_payload_has_rebooking_fields($payload)) {
        return;
    }

    $actor = current_user();
    $isAdmin = is_admin_actor($actor);
    $actorEmail = mb_strtolower(trim((string) ($actor['email'] ?? '')));
    $bookingEmail = mb_strtolower(trim((string) ($existing['customer_email'] ?? '')));
    $currentStatus = (string) ($existing['status'] ?? 'pending');
    $oldRebookingStatus = (string) ($existing['rebooking_status'] ?? 'none');
    $newRebookingStatus = (string) ($payload['rebooking_status'] ?? $oldRebookingStatus);

    if (!$isAdmin && ($actorEmail === '' || $actorEmail !== $bookingEmail)) {
        json_error('You can only request rebooking for your own reservations.', 403);
    }

    if (!$isAdmin && array_key_exists('booking_date', $payload)) {
        json_error('The booking date can only be changed after admin approval.', 403);
    }

    if (!in_array($newRebookingStatus, ['none', 'pending', 'approved', 'declined'], true)) {
        json_error('Invalid rebooking status.', 422);
    }

    if (!$isAdmin && $newRebookingStatus !== 'pending') {
        json_error('Guests can only submit pending rebooking requests.', 403);
    }

    if ($newRebookingStatus === 'pending') {
        if (!in_array($currentStatus, ['pending', 'confirmed'], true)) {
            json_error('Only pending or confirmed bookings can request rebooking.', 422);
        }

        if ((int) ($existing['rebooking_count'] ?? 0) >= 1) {
            json_error('This booking has already used its allowed rebooking request.', 422);
        }

        if ($oldRebookingStatus === 'pending') {
            json_error('This booking already has a pending rebooking request.', 409);
        }

        $bookingStart = booking_start_datetime($existing);
        $cutoff = $bookingStart->modify('-' . REBOOKING_MIN_NOTICE_DAYS . ' days');
        $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Manila'));
        if ($now > $cutoff) {
            json_error('Rebooking requests must be submitted at least 7 days before the reservation date.', 422);
        }

        $rawRequestedDate = trim((string) ($payload['rebooking_requested_date'] ?? ''));
        if ($rawRequestedDate === '') {
            json_error('Requested rebooking date is required.', 422);
        }

        parse_booking_policy_date($rawRequestedDate, 'Requested rebooking date');
        $requestedDate = mysql_date($rawRequestedDate);
        ensure_rebooking_date_available($existing, $requestedDate, (string) $existing['id']);

        $reason = trim((string) ($payload['rebooking_reason'] ?? ''));
        if (mb_strlen($reason) < 10) {
            json_error('Please include a short reason for the rebooking request.', 422);
        }

        $payload['rebooking_status'] = 'pending';
        $payload['rebooking_requested_date'] = $requestedDate;
        $payload['rebooking_reason'] = $reason;
        $payload['rebooking_original_date'] = (string) ($existing['rebooking_original_date'] ?? '') !== ''
            ? $existing['rebooking_original_date']
            : $existing['booking_date'];
        $payload['rebooking_requested_at'] = now_mysql();
        $payload['rebooking_resolved_at'] = null;
        $payload['rebooking_resolution_note'] = null;
        return;
    }

    if (in_array($newRebookingStatus, ['approved', 'declined'], true) && !$isAdmin) {
        json_error('Only admins can approve or decline rebooking requests.', 403);
    }

    if ($newRebookingStatus === 'approved') {
        if ($oldRebookingStatus !== 'pending' || empty($existing['rebooking_requested_date'])) {
            json_error('Only pending rebooking requests can be approved.', 422);
        }

        $requestedDate = mysql_date((string) $existing['rebooking_requested_date']);
        ensure_rebooking_date_available($existing, $requestedDate, (string) $existing['id']);

        $payload['booking_date'] = $requestedDate;
        $payload['rebooking_status'] = 'approved';
        $payload['rebooking_resolved_at'] = now_mysql();
        $payload['rebooking_count'] = ((int) ($existing['rebooking_count'] ?? 0)) + 1;
        $payload['rebooking_original_date'] = (string) ($existing['rebooking_original_date'] ?? '') !== ''
            ? $existing['rebooking_original_date']
            : $existing['booking_date'];
        return;
    }

    if ($newRebookingStatus === 'declined') {
        if ($oldRebookingStatus !== 'pending') {
            json_error('Only pending rebooking requests can be declined.', 422);
        }

        $payload['rebooking_status'] = 'declined';
        $payload['rebooking_resolved_at'] = now_mysql();
        $payload['rebooking_resolution_note'] = trim((string) ($payload['rebooking_resolution_note'] ?? 'Declined by resort admin.'));
        unset($payload['booking_date']);
    }
}

function validate_booking_constraints(array $record, ?string $excludeId = null): void
{
    $packageId = (string) ($record['package_id'] ?? '');
    $guestCount = isset($record['guest_count']) ? (int) $record['guest_count'] : 0;
    $bookingDate = (string) ($record['booking_date'] ?? '');
    $tourType = (string) ($record['tour_type'] ?? '');
    $customerEmail = mb_strtolower(trim((string) ($record['customer_email'] ?? '')));
    $status = (string) ($record['status'] ?? 'pending');

    if ($packageId === '' || $guestCount < 1) {
        json_error('Booking must include a valid package and guest count.', 422);
    }

    if ($bookingDate === '' || $tourType === '') {
        json_error('Booking must include a valid date and tour type.', 422);
    }

    if ($customerEmail === '') {
        json_error('Booking must include a valid customer email.', 422);
    }

    $statement = db()->prepare('SELECT max_guests FROM packages WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $packageId]);
    $package = $statement->fetch();

    if (!$package) {
        json_error('Selected package was not found.', 404);
    }

    $maxGuests = (int) ($package['max_guests'] ?? 0);
    if ($maxGuests < 1) {
        json_error('This package is not configured with a valid guest limit.', 422);
    }

    if ($guestCount > $maxGuests) {
        json_error('Guest count exceeds the allowed limit for this package.', 422);
    }

    $activeStatuses = ['pending', 'confirmed', 'completed'];
    if (!in_array($status, $activeStatuses, true)) {
        return;
    }

    $duplicateSql = 'SELECT id FROM bookings
        WHERE package_id = :package_id
          AND booking_date = :booking_date
          AND tour_type = :tour_type
          AND customer_email = :customer_email
          AND status IN (\'pending\', \'confirmed\', \'completed\')';

    $duplicateParams = [
        'package_id' => $packageId,
        'booking_date' => $bookingDate,
        'tour_type' => $tourType,
        'customer_email' => $customerEmail,
    ];

    if ($excludeId !== null) {
        $duplicateSql .= ' AND id <> :exclude_id';
        $duplicateParams['exclude_id'] = $excludeId;
    }

    $duplicateSql .= ' LIMIT 1';
    $duplicateStatement = db()->prepare($duplicateSql);
    $duplicateStatement->execute($duplicateParams);

    if ($duplicateStatement->fetch()) {
        json_error('You already have an active reservation for this package, date, and tour type.', 409);
    }

    $availabilitySql = 'SELECT COUNT(*) FROM bookings
        WHERE package_id = :package_id
          AND booking_date = :booking_date
          AND tour_type = :tour_type
          AND status IN (\'pending\', \'confirmed\', \'completed\')';

    $availabilityParams = [
        'package_id' => $packageId,
        'booking_date' => $bookingDate,
        'tour_type' => $tourType,
    ];

    if ($excludeId !== null) {
        $availabilitySql .= ' AND id <> :exclude_id';
        $availabilityParams['exclude_id'] = $excludeId;
    }

    $availabilityStatement = db()->prepare($availabilitySql);
    $availabilityStatement->execute($availabilityParams);
    $activeBookingCount = (int) $availabilityStatement->fetchColumn();

    if ($activeBookingCount >= 1) {
        json_error('This date is already fully reserved for the selected package and tour type.', 409);
    }
}

function validate_review_constraints(array &$record, ?string $excludeId = null): void
{
    $bookingId = (string) ($record['booking_id'] ?? '');
    $guestEmail = mb_strtolower(trim((string) ($record['guest_email'] ?? '')));
    $rating = isset($record['rating']) ? (int) $record['rating'] : 0;
    $reviewText = trim((string) ($record['review_text'] ?? ''));

    if ($bookingId === '' || $guestEmail === '' || $rating < 1 || $rating > 5 || $reviewText === '') {
        json_error('Review must include a valid booking, email, rating, and review text.', 422);
    }

    $bookingStatement = db()->prepare('SELECT * FROM bookings WHERE id = :id LIMIT 1');
    $bookingStatement->execute(['id' => $bookingId]);
    $booking = $bookingStatement->fetch();

    if (!$booking) {
        json_error('Booking for this review was not found.', 404);
    }

    if (!booking_review_is_available($booking)) {
        json_error('Reviews are available only after the booked stay or tour has ended.', 422);
    }

    if (mb_strtolower(trim((string) ($booking['customer_email'] ?? ''))) !== $guestEmail) {
        json_error('Review email does not match the booking owner.', 403);
    }

    $reviewSql = 'SELECT id FROM reviews WHERE booking_id = :booking_id';
    $reviewParams = ['booking_id' => $bookingId];

    if ($excludeId !== null) {
        $reviewSql .= ' AND id <> :exclude_id';
        $reviewParams['exclude_id'] = $excludeId;
    }

    $reviewSql .= ' LIMIT 1';
    $reviewStatement = db()->prepare($reviewSql);
    $reviewStatement->execute($reviewParams);

    if ($reviewStatement->fetch()) {
        json_error('A review has already been submitted for this booking.', 409);
    }

    $record['guest_name'] = (string) ($booking['customer_name'] ?? $record['guest_name'] ?? 'Guest');
    $record['package_name'] = (string) ($booking['package_name'] ?? $record['package_name'] ?? '');
    $record['booking_reference'] = (string) ($booking['booking_reference'] ?? $record['booking_reference'] ?? '');
    $record['is_approved'] = true;
}

function booking_review_is_available(array $booking): bool
{
    $status = (string) ($booking['status'] ?? '');
    if ($status === 'cancelled' || $status === 'pending') {
        return false;
    }

    $bookingDate = trim((string) ($booking['booking_date'] ?? ''));
    $tourType = trim((string) ($booking['tour_type'] ?? ''));

    if ($bookingDate === '' || $tourType === '') {
        return false;
    }

    try {
        $timezone = new DateTimeZone('Asia/Manila');
        $start = new DateTimeImmutable($bookingDate . ' 08:00:00', $timezone);

        if ($tourType === 'day_tour') {
            $end = new DateTimeImmutable($bookingDate . ' 18:00:00', $timezone);
        } elseif ($tourType === 'night_tour') {
            $start = new DateTimeImmutable($bookingDate . ' 18:00:00', $timezone);
            $end = $start->modify('+12 hours');
        } elseif ($tourType === '22_hours') {
            $end = $start->modify('+22 hours');
        } else {
            return false;
        }

        $now = new DateTimeImmutable('now', $timezone);
        return $now >= $end;
    } catch (Throwable $exception) {
        return false;
    }
}

function auto_cancel_expired_pending_bookings(): void
{
    $timezone = new DateTimeZone('Asia/Manila');
    $now = (new DateTimeImmutable('now', $timezone))->format('Y-m-d H:i:s');

    $expiredStatement = db()->prepare(
        "SELECT id, booking_reference
         FROM bookings
         WHERE status = 'pending'
           AND (
             (tour_type = 'day_tour' AND CONCAT(booking_date, ' 18:00:00') < :now_day_tour)
             OR (tour_type = 'night_tour' AND CONCAT(DATE_ADD(booking_date, INTERVAL 1 DAY), ' 06:00:00') < :now_night_tour)
             OR (tour_type = '22_hours' AND CONCAT(DATE_ADD(booking_date, INTERVAL 1 DAY), ' 16:00:00') < :now_twenty_two_hours)
           )"
    );
    $expiredStatement->execute([
        'now_day_tour' => $now,
        'now_night_tour' => $now,
        'now_twenty_two_hours' => $now,
    ]);
    $expiredBookings = $expiredStatement->fetchAll();

    if (empty($expiredBookings)) {
        return;
    }

    $expiredIds = array_column($expiredBookings, 'id');
    $placeholders = [];
    $params = ['updated_date' => now_mysql()];

    foreach ($expiredIds as $index => $id) {
        $paramName = 'id_' . $index;
        $placeholders[] = ':' . $paramName;
        $params[$paramName] = $id;
    }

    $updateStatement = db()->prepare(
        'UPDATE bookings
         SET status = \'cancelled\', payment_status = \'unpaid\', updated_date = :updated_date
         WHERE status = \'pending\' AND id IN (' . implode(', ', $placeholders) . ')'
    );
    $updateStatement->execute($params);

    $logStatement = db()->prepare(
        'INSERT INTO activity_logs
         (id, created_date, updated_date, user_email, user_name, action, entity_type, entity_id, details)
         VALUES (:id, :created_date, :updated_date, :user_email, :user_name, :action, :entity_type, :entity_id, :details)'
    );

    foreach ($expiredBookings as $booking) {
        $reference = (string) ($booking['booking_reference'] ?? $booking['id']);
        $logStatement->execute([
            'id' => create_id('activitylog'),
            'created_date' => now_mysql(),
            'updated_date' => now_mysql(),
            'user_email' => 'system@kasa-ilaya.local',
            'user_name' => 'System',
            'action' => 'Auto Cancelled Booking',
            'entity_type' => 'Booking',
            'entity_id' => $booking['id'],
            'details' => "Automatically cancelled expired pending booking {$reference}.",
        ]);
    }
}

function validate_upcoming_schedule_constraints(array &$record): void
{
    $title = trim((string) ($record['title'] ?? ''));
    $scheduleDate = trim((string) ($record['schedule_date'] ?? ''));
    $startTime = trim((string) ($record['start_time'] ?? ''));
    $endTime = trim((string) ($record['end_time'] ?? ''));

    if ($title === '' || $scheduleDate === '') {
        json_error('Schedule must include a title and date.', 422);
    }

    if ($startTime !== '' && !preg_match('/^\d{2}:\d{2}$/', $startTime)) {
        json_error('Start time must use HH:MM format.', 422);
    }

    if ($endTime !== '' && !preg_match('/^\d{2}:\d{2}$/', $endTime)) {
        json_error('End time must use HH:MM format.', 422);
    }

    if ($startTime !== '' && $endTime !== '' && strcmp($startTime, $endTime) >= 0) {
        json_error('End time must be later than start time.', 422);
    }

    $record['title'] = $title;
    $record['schedule_date'] = $scheduleDate;
    $record['start_time'] = $startTime === '' ? null : $startTime;
    $record['end_time'] = $endTime === '' ? null : $endTime;
    $record['location'] = trim((string) ($record['location'] ?? '')) ?: null;
    $record['description'] = trim((string) ($record['description'] ?? '')) ?: null;
    $record['created_by_name'] = trim((string) ($record['created_by_name'] ?? '')) ?: null;
    $record['created_by_email'] = trim((string) ($record['created_by_email'] ?? '')) ?: null;
}

function validate_payment_qr_code_constraints(array &$record, ?string $excludeId = null): void
{
    $label = trim((string) ($record['label'] ?? ''));
    $imageUrl = trim((string) ($record['image_url'] ?? ''));
    $displayOrder = isset($record['display_order']) ? (int) $record['display_order'] : 1;

    if ($label === '' || $imageUrl === '') {
        json_error('QR code entries must include a label and QR image.', 422);
    }

    if ($displayOrder < 1 || $displayOrder > 3) {
        json_error('QR code display order must be between 1 and 3.', 422);
    }


    // Only count active QR codes (is_active = 1)
    $countSql = 'SELECT COUNT(*) FROM payment_qr_codes WHERE is_active = 1';
    $params = [];
    if ($excludeId !== null) {
        $countSql .= ' AND id <> :exclude_id';
        $params['exclude_id'] = $excludeId;
    }
    $statement = db()->prepare($countSql);
    $statement->execute($params);
    $otherCount = (int) $statement->fetchColumn();
    if ($otherCount >= 3) {
        json_error('You can manage up to 3 QR codes only.', 422);
    }

    $record['label'] = $label;
    $record['image_url'] = $imageUrl;
    $record['account_name'] = trim((string) ($record['account_name'] ?? '')) ?: null;
    $record['account_number'] = trim((string) ($record['account_number'] ?? '')) ?: null;
    $record['instructions'] = trim((string) ($record['instructions'] ?? '')) ?: null;
    $record['display_order'] = $displayOrder;
    $record['is_active'] = array_key_exists('is_active', $record) ? (bool) $record['is_active'] : true;
}

function booking_label(string $value): string
{
    return ucwords(str_replace('_', ' ', $value));
}

function booking_money($value): string
{
    return 'PHP ' . number_format((float) ($value ?? 0), 2);
}

function booking_guest_email_body(array $booking, string $title, string $message): string
{
    $safeName = htmlspecialchars((string) ($booking['customer_name'] ?? 'Guest'), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeReference = htmlspecialchars((string) ($booking['booking_reference'] ?? $booking['id'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safePackage = htmlspecialchars((string) ($booking['package_name'] ?? 'Selected package'), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeTour = htmlspecialchars(booking_label((string) ($booking['tour_type'] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeDate = htmlspecialchars((string) ($booking['booking_date'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeStatus = htmlspecialchars(booking_label((string) ($booking['status'] ?? 'pending')), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safePaymentStatus = htmlspecialchars(booking_label((string) ($booking['payment_status'] ?? 'unpaid')), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeTotal = htmlspecialchars(booking_money($booking['total_amount'] ?? 0), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeRebookingStatus = htmlspecialchars(booking_label((string) ($booking['rebooking_status'] ?? 'none')), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeOriginalDate = htmlspecialchars((string) ($booking['rebooking_original_date'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $safeRequestedDate = htmlspecialchars((string) ($booking['rebooking_requested_date'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $rebookingRows = '';

    if (($booking['rebooking_status'] ?? 'none') !== 'none') {
        $rebookingRows = '<tr><td style="padding:10px 12px;background:#fbf7ef;font-weight:bold;">Rebooking status</td><td style="padding:10px 12px;">' . $safeRebookingStatus . '</td></tr>'
            . ($safeOriginalDate !== '' ? '<tr><td style="padding:10px 12px;background:#fbf7ef;font-weight:bold;">Original date</td><td style="padding:10px 12px;">' . $safeOriginalDate . '</td></tr>' : '')
            . ($safeRequestedDate !== '' ? '<tr><td style="padding:10px 12px;background:#fbf7ef;font-weight:bold;">Requested date</td><td style="padding:10px 12px;">' . $safeRequestedDate . '</td></tr>' : '');
    }

    return kasa_email_layout(
        $title,
        '<p style="margin:0 0 14px;">Hello ' . $safeName . ',</p>'
        . '<p style="margin:0 0 18px;">' . $safeMessage . '</p>'
        . '<table style="width:100%;border-collapse:collapse;margin:18px 0;border:1px solid #e8e0d3;">'
        . '<tr><td style="padding:10px 12px;background:#fbf7ef;font-weight:bold;">Reference</td><td style="padding:10px 12px;">' . $safeReference . '</td></tr>'
        . '<tr><td style="padding:10px 12px;background:#fbf7ef;font-weight:bold;">Package</td><td style="padding:10px 12px;">' . $safePackage . '</td></tr>'
        . '<tr><td style="padding:10px 12px;background:#fbf7ef;font-weight:bold;">Tour</td><td style="padding:10px 12px;">' . $safeTour . '</td></tr>'
        . '<tr><td style="padding:10px 12px;background:#fbf7ef;font-weight:bold;">Date</td><td style="padding:10px 12px;">' . $safeDate . '</td></tr>'
        . '<tr><td style="padding:10px 12px;background:#fbf7ef;font-weight:bold;">Booking status</td><td style="padding:10px 12px;">' . $safeStatus . '</td></tr>'
        . '<tr><td style="padding:10px 12px;background:#fbf7ef;font-weight:bold;">Payment status</td><td style="padding:10px 12px;">' . $safePaymentStatus . '</td></tr>'
        . $rebookingRows
        . '<tr><td style="padding:10px 12px;background:#fbf7ef;font-weight:bold;">Total</td><td style="padding:10px 12px;">' . $safeTotal . '</td></tr>'
        . '</table>'
        . '<p style="margin:18px 0 0;">Thank you for choosing Kasailaya Resort.</p>'
    );
}

function notify_booking_guest(array $booking, string $event): void
{
    $email = trim((string) ($booking['customer_email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return;
    }

    $reference = (string) ($booking['booking_reference'] ?? $booking['id'] ?? 'reservation');
    $status = (string) ($booking['status'] ?? 'pending');
    $paymentStatus = (string) ($booking['payment_status'] ?? 'unpaid');
    $subject = 'Reservation update - ' . $reference . ' | Kasailaya Resort';
    $title = 'Reservation Update';
    $message = 'Your reservation details have been updated.';

    if ($event === 'created') {
        $subject = 'Reservation received - ' . $reference . ' | Kasailaya Resort';
        $title = 'Reservation Received';
        $message = 'We received your reservation request. Our team will review your details and payment proof, then send another update when the booking status changes.';
    } elseif ($event === 'confirmed' || ($status === 'confirmed' && $paymentStatus === 'paid')) {
        $subject = 'Reservation confirmed - ' . $reference . ' | Kasailaya Resort';
        $title = 'Reservation Confirmed';
        $message = 'Your reservation has been confirmed. Please keep this booking reference for check-in.';
    } elseif ($event === 'payment_paid' || $paymentStatus === 'paid') {
        $subject = 'Payment verified - ' . $reference . ' | Kasailaya Resort';
        $title = 'Payment Verified';
        $message = 'Your payment has been verified. Your booking status is shown below.';
    } elseif ($event === 'cancelled' || $status === 'cancelled') {
        $subject = 'Reservation cancelled - ' . $reference . ' | Kasailaya Resort';
        $title = 'Reservation Cancelled';
        $message = 'Your reservation has been cancelled. Contact the resort if you need assistance with this booking.';
    } elseif ($event === 'rescheduled') {
        $subject = 'Reservation rescheduled - ' . $reference . ' | Kasailaya Resort';
        $title = 'Reservation Rescheduled';
        $message = 'Your reservation date has been updated by the resort. Please review the updated booking details below.';
    } elseif ($event === 'rebooking_requested') {
        $subject = 'Rebooking request received - ' . $reference . ' | Kasailaya Resort';
        $title = 'Rebooking Request Received';
        $message = 'We received your rebooking request. Your original reservation date remains active until the resort approves the new date.';
    } elseif ($event === 'rebooking_approved') {
        $subject = 'Rebooking approved - ' . $reference . ' | Kasailaya Resort';
        $title = 'Rebooking Approved';
        $message = 'Your rebooking request has been approved. Your reservation date has been updated below.';
    } elseif ($event === 'rebooking_declined') {
        $subject = 'Rebooking request declined - ' . $reference . ' | Kasailaya Resort';
        $title = 'Rebooking Request Declined';
        $message = 'Your rebooking request was declined. Your original reservation date remains active unless your booking status says otherwise.';
    }

    $result = safe_send_app_email($email, $subject, booking_guest_email_body($booking, $title, $message), 'booking');
    if (empty($result['sent'])) {
        error_log('Kasailaya Resort booking email failed for ' . $reference . ': ' . ($result['error'] ?? 'unknown error'));
    }
}

function notify_admin_booking_event(array $booking, string $event): void
{
    $adminEmail = admin_notification_email();
    if ($adminEmail === '' || !filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        return;
    }

    $reference = htmlspecialchars((string) ($booking['booking_reference'] ?? $booking['id'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $guest = htmlspecialchars((string) ($booking['customer_name'] ?? 'Guest'), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $guestEmail = htmlspecialchars((string) ($booking['customer_email'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $status = htmlspecialchars(booking_label((string) ($booking['status'] ?? 'pending')), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $paymentStatus = htmlspecialchars(booking_label((string) ($booking['payment_status'] ?? 'unpaid')), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $amount = htmlspecialchars(booking_money($booking['payment_amount_due'] ?? $booking['reservation_fee_amount'] ?? $booking['total_amount'] ?? 0), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $eventLabel = booking_label($event);

    $body = kasa_email_layout(
        'Reservation Alert',
        '<p style="margin:0 0 14px;">A reservation event needs admin attention.</p>'
        . '<p style="margin:0 0 14px;"><strong>Event:</strong> ' . htmlspecialchars($eventLabel, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '</p>'
        . '<p style="margin:0 0 14px;"><strong>Reference:</strong> ' . $reference . '<br>'
        . '<strong>Guest:</strong> ' . $guest . '<br>'
        . '<strong>Email:</strong> ' . $guestEmail . '<br>'
        . '<strong>Status:</strong> ' . $status . '<br>'
        . '<strong>Payment:</strong> ' . $paymentStatus . '<br>'
        . '<strong>Submitted amount:</strong> ' . $amount . '</p>'
    );

    $result = safe_send_app_email($adminEmail, 'Reservation alert - ' . (string) ($booking['booking_reference'] ?? $booking['id'] ?? ''), $body, 'admin');
    if (empty($result['sent'])) {
        error_log('Kasailaya Resort admin booking email failed: ' . ($result['error'] ?? 'unknown error'));
    }
}

function booking_email_event(?array $before, array $after): ?string
{
    if ($before === null) {
        return 'created';
    }

    $oldStatus = (string) ($before['status'] ?? '');
    $newStatus = (string) ($after['status'] ?? '');
    $oldPayment = (string) ($before['payment_status'] ?? '');
    $newPayment = (string) ($after['payment_status'] ?? '');

    if ($oldStatus !== 'cancelled' && $newStatus === 'cancelled') {
        return 'cancelled';
    }

    if ($oldStatus !== 'confirmed' && $newStatus === 'confirmed') {
        return 'confirmed';
    }

    if ($oldPayment !== 'paid' && $newPayment === 'paid') {
        return 'payment_paid';
    }

    if ($oldStatus !== $newStatus || $oldPayment !== $newPayment) {
        return 'updated';
    }

    $oldRebooking = (string) ($before['rebooking_status'] ?? 'none');
    $newRebooking = (string) ($after['rebooking_status'] ?? 'none');

    if ($oldRebooking !== 'pending' && $newRebooking === 'pending') {
        return 'rebooking_requested';
    }

    if ($oldRebooking === 'pending' && $newRebooking === 'approved') {
        return 'rebooking_approved';
    }

    if ($oldRebooking === 'pending' && $newRebooking === 'declined') {
        return 'rebooking_declined';
    }

    if ((string) ($before['booking_date'] ?? '') !== (string) ($after['booking_date'] ?? '')) {
        return 'rescheduled';
    }

    return null;
}

function validate_resort_rule_constraints(array &$record): void
{
    $title = trim((string) ($record['title'] ?? ''));
    $description = trim((string) ($record['description'] ?? ''));
    $sortOrder = isset($record['sort_order']) ? (int) $record['sort_order'] : 1;

    if ($title === '' || $description === '') {
        json_error('Resort rules must include a title and description.', 422);
    }

    $record['title'] = $title;
    $record['description'] = $description;
    $record['sort_order'] = max(1, $sortOrder);
    $record['is_active'] = array_key_exists('is_active', $record) ? (bool) $record['is_active'] : true;
}

function validate_package_constraints(array &$record, ?string $excludeId = null): void
{
    $name = trim((string) ($record['name'] ?? ''));
    if ($name === '') {
        json_error('Package name is required.', 422);
    }

    $dayTourPrice = max(0, (float) ($record['day_tour_price'] ?? 0));
    $nightTourPrice = max(0, (float) ($record['night_tour_price'] ?? 0));
    $twentyTwoHourPrice = max(0, (float) ($record['twenty_two_hour_price'] ?? 0));
    $legacyPrice = max(0, (float) ($record['price'] ?? 0));

    if ($dayTourPrice <= 0 && $nightTourPrice <= 0 && $twentyTwoHourPrice <= 0 && $legacyPrice <= 0) {
        json_error('Please add at least one package price.', 422);
    }

    $record['name'] = $name;
    $record['description'] = trim((string) ($record['description'] ?? ''));
    $record['tour_type'] = in_array(($record['tour_type'] ?? ''), ['day_tour', 'night_tour', '22_hours'], true)
        ? $record['tour_type']
        : 'day_tour';
    $record['day_tour_price'] = $dayTourPrice;
    $record['night_tour_price'] = $nightTourPrice;
    $record['twenty_two_hour_price'] = $twentyTwoHourPrice;
    $record['price'] = $legacyPrice > 0 ? $legacyPrice : min(array_filter([$dayTourPrice, $nightTourPrice, $twentyTwoHourPrice], static fn(float $price): bool => $price > 0));
    $record['max_guests'] = max(1, (int) ($record['max_guests'] ?? 1));
    $record['is_active'] = array_key_exists('is_active', $record) ? (bool) $record['is_active'] : true;

    if (!$record['is_active']) {
        return;
    }

    $sql = 'SELECT id FROM packages WHERE LOWER(TRIM(name)) = LOWER(TRIM(:name)) AND is_active = 1';
    $params = ['name' => $name];

    if ($excludeId !== null && $excludeId !== '') {
        $sql .= ' AND id <> :exclude_id';
        $params['exclude_id'] = $excludeId;
    }

    $sql .= ' LIMIT 1';
    $statement = db()->prepare($sql);
    $statement->execute($params);

    if ($statement->fetch()) {
        json_error('An active package with this name already exists. Edit the existing package or archive it first.', 409);
    }
}

try {
    if ($method === 'GET') {
        if ($entity === 'Booking') {
            auto_cancel_expired_pending_bookings();
        }

        $sortField = (string) query_param('sort', '');
        $limit = query_param('limit');
        $filterJson = (string) query_param('filter', '');
        $filters = [];

        if ($filterJson !== '') {
            $decoded = json_decode($filterJson, true);
            if (is_array($decoded)) {
                $filters = $decoded;
            }
        }

        $where = [];
        $params = [];

        foreach ($filters as $field => $value) {
            if (!in_array($field, $fields, true)) {
                continue;
            }

            if (is_array($value) && !empty($value)) {
                $placeholders = [];
                foreach (array_values($value) as $index => $entry) {
                    $paramName = ':' . $field . '_' . $index;
                    $placeholders[] = $paramName;
                    $params[$paramName] = serialize_value($config, $field, $entry);
                }
                $where[] = sprintf('`%s` IN (%s)', $field, implode(', ', $placeholders));
                continue;
            }

            $paramName = ':' . $field;
            $where[] = sprintf('`%s` = %s', $field, $paramName);
            $params[$paramName] = serialize_value($config, $field, $value);
        }

        $sql = 'SELECT * FROM `' . $table . '`';
        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        if ($sortField !== '') {
            $descending = str_starts_with($sortField, '-');
            $fieldName = $descending ? substr($sortField, 1) : $sortField;
            if (in_array($fieldName, $fields, true)) {
                $sql .= ' ORDER BY `' . $fieldName . '` ' . ($descending ? 'DESC' : 'ASC');
            }
        }

        if ($limit !== null && ctype_digit((string) $limit)) {
            $sql .= ' LIMIT ' . (int) $limit;
        }

        $statement = db()->prepare($sql);
        $statement->execute($params);
        $rows = $statement->fetchAll();

        json_response(array_map(static fn(array $row): array => deserialize_row($config, $row), $rows));
    }

    if ($method === 'POST') {
        $payload = request_body();
        $now = now_mysql();
        $record = [
            'id' => $payload['id'] ?? create_id(strtolower($entity)),
            'created_date' => $payload['created_date'] ?? $now,
            'updated_date' => $payload['updated_date'] ?? $now,
        ];

        foreach ($fields as $field) {
            if (array_key_exists($field, $payload)) {
                $record[$field] = $payload[$field];
            }
        }

        if ($entity === 'Booking') {
            $record['booking_reference'] = $record['booking_reference'] ?? ('KI-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)));
            $record['status'] = $record['status'] ?? 'pending';
            $record['payment_status'] = $record['payment_status'] ?? (!empty($record['receipt_url']) ? 'pending_verification' : 'unpaid');
            validate_booking_constraints($record);
        }

        if ($entity === 'Package') {
            validate_package_constraints($record);
        }

        if ($entity === 'Review') {
            validate_review_constraints($record);
        }

        if ($entity === 'UpcomingSchedule') {
            validate_upcoming_schedule_constraints($record);
        }

        if ($entity === 'FoundItem') {
            $record['status'] = $record['status'] ?? 'unclaimed';
        }

        if ($entity === 'LostItemReport') {
            $record['status'] = $record['status'] ?? 'searching';
        }

        if ($entity === 'PaymentQrCode') {
            validate_payment_qr_code_constraints($record);
        }

        if ($entity === 'ResortRule') {
            validate_resort_rule_constraints($record);
        }

        $insertFields = [];
        $insertPlaceholders = [];
        $params = [];

        foreach ($fields as $field) {
            if (!array_key_exists($field, $record)) {
                continue;
            }

            $insertFields[] = '`' . $field . '`';
            $placeholder = ':' . $field;
            $insertPlaceholders[] = $placeholder;
            $params[$placeholder] = serialize_value($config, $field, $record[$field]);
        }

        $sql = sprintf(
            'INSERT INTO `%s` (%s) VALUES (%s)',
            $table,
            implode(', ', $insertFields),
            implode(', ', $insertPlaceholders)
        );

        $statement = db()->prepare($sql);
        $statement->execute($params);

        $fetch = db()->prepare('SELECT * FROM `' . $table . '` WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $record['id']]);
        $created = $fetch->fetch();

        if ($entity === 'Booking' && $created) {
            notify_booking_guest($created, 'created');
            notify_admin_booking_event($created, 'new_reservation');
        }

        json_response(deserialize_row($config, $created ?: []), 201);
    }

    if (in_array($method, ['PATCH', 'PUT'], true)) {
        $id = (string) query_param('id', '');
        if ($id === '') {
            json_error('Missing entity id.', 422);
        }

        $payload = request_body();
        $updates = [];
        $params = ['id' => $id];

        if ($entity === 'Booking') {
            $existingStatement = db()->prepare('SELECT * FROM `' . $table . '` WHERE id = :id LIMIT 1');
            $existingStatement->execute(['id' => $id]);
            $existingRecord = $existingStatement->fetch();

            if (!$existingRecord) {
                json_error('Record not found.', 404);
            }

            apply_rebooking_policy($existingRecord, $payload);
            $bookingRecord = array_merge($existingRecord, $payload);
            validate_booking_constraints($bookingRecord, $id);
        }

        if ($entity === 'Review') {
            $existingStatement = db()->prepare('SELECT * FROM `' . $table . '` WHERE id = :id LIMIT 1');
            $existingStatement->execute(['id' => $id]);
            $existingRecord = $existingStatement->fetch();

            if (!$existingRecord) {
                json_error('Record not found.', 404);
            }

            $reviewRecord = array_merge($existingRecord, $payload);
            validate_review_constraints($reviewRecord, $id);
        }

        if ($entity === 'UpcomingSchedule') {
            $existingStatement = db()->prepare('SELECT * FROM `' . $table . '` WHERE id = :id LIMIT 1');
            $existingStatement->execute(['id' => $id]);
            $existingRecord = $existingStatement->fetch();

            if (!$existingRecord) {
                json_error('Record not found.', 404);
            }

            $scheduleRecord = array_merge($existingRecord, $payload);
            validate_upcoming_schedule_constraints($scheduleRecord);
            $payload = $scheduleRecord;
        }

        if ($entity === 'PaymentQrCode') {
            $existingStatement = db()->prepare('SELECT * FROM `' . $table . '` WHERE id = :id LIMIT 1');
            $existingStatement->execute(['id' => $id]);
            $existingRecord = $existingStatement->fetch();

            if (!$existingRecord) {
                json_error('Record not found.', 404);
            }

            $qrRecord = array_merge($existingRecord, $payload);
            validate_payment_qr_code_constraints($qrRecord, $id);
            $payload = $qrRecord;
        }

        if ($entity === 'Package') {
            $existingStatement = db()->prepare('SELECT * FROM `' . $table . '` WHERE id = :id LIMIT 1');
            $existingStatement->execute(['id' => $id]);
            $existingRecord = $existingStatement->fetch();

            if (!$existingRecord) {
                json_error('Record not found.', 404);
            }

            $packageRecord = array_merge($existingRecord, $payload);
            validate_package_constraints($packageRecord, $id);
            $payload = $packageRecord;
        }

        if ($entity === 'ResortRule') {
            $existingStatement = db()->prepare('SELECT * FROM `' . $table . '` WHERE id = :id LIMIT 1');
            $existingStatement->execute(['id' => $id]);
            $existingRecord = $existingStatement->fetch();

            if (!$existingRecord) {
                json_error('Record not found.', 404);
            }

            $ruleRecord = array_merge($existingRecord, $payload);
            validate_resort_rule_constraints($ruleRecord);
            $payload = $ruleRecord;
        }

        foreach ($fields as $field) {
            if ($field === 'id' || $field === 'created_date' || $field === 'updated_date') {
                continue;
            }

            if (!array_key_exists($field, $payload)) {
                continue;
            }

            $updates[] = '`' . $field . '` = :' . $field;
            $params[$field] = serialize_value($config, $field, $payload[$field]);
        }

        $updates[] = '`updated_date` = :updated_date';
        $params['updated_date'] = now_mysql();

        $statement = db()->prepare('UPDATE `' . $table . '` SET ' . implode(', ', $updates) . ' WHERE id = :id');
        $statement->execute($params);

        $fetch = db()->prepare('SELECT * FROM `' . $table . '` WHERE id = :id LIMIT 1');
        $fetch->execute(['id' => $id]);
        $updated = $fetch->fetch();

        if (!$updated) {
            json_error('Record not found.', 404);
        }

        if ($entity === 'Booking') {
            $event = booking_email_event($existingRecord ?? null, $updated);
            if ($event !== null) {
                notify_booking_guest($updated, $event);
                if (in_array($event, ['created', 'confirmed', 'payment_paid', 'cancelled', 'updated', 'rescheduled', 'rebooking_requested', 'rebooking_approved', 'rebooking_declined'], true)) {
                    notify_admin_booking_event($updated, $event);
                }
            }
        }

        json_response(deserialize_row($config, $updated));
    }

    if ($method === 'DELETE') {
        $id = (string) query_param('id', '');
        if ($id === '') {
            json_error('Missing entity id.', 422);
        }

        $statement = db()->prepare('DELETE FROM `' . $table . '` WHERE id = :id');
        $statement->execute(['id' => $id]);

        json_response(['success' => true, 'id' => $id]);
    }

    json_error('Unsupported entity method.', 405);
} catch (Throwable $error) {
    json_error($error->getMessage(), 500);
}
