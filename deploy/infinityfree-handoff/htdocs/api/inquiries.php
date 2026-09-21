<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = request_method();
$action = (string) query_param('action', '');
$actor = current_user();

function actor_is_admin(?array $actor): bool
{
    if (!$actor) {
        return false;
    }

    $role = (string) ($actor['role'] ?? '');
    return $role === 'admin' || $role === 'super_admin';
}

function actor_is_super_admin(?array $actor): bool
{
    if (!$actor) {
        return false;
    }

    $role = (string) ($actor['role'] ?? '');
    $appRole = (string) ($actor['_app_role'] ?? '');
    return $role === 'super_admin' || $appRole === 'super_admin';
}

function normalize_email(string $email): string
{
    return mb_strtolower(trim($email));
}

function inquiry_token_hash(string $token): string
{
    return hash('sha256', trim($token));
}

function preview_text(string $message): string
{
    $message = preg_replace('/\s+/', ' ', trim($message)) ?? trim($message);
    if (mb_strlen($message) <= 180) {
        return $message;
    }

    return rtrim(mb_substr($message, 0, 177)) . '...';
}

function serialize_datetime(?string $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    return str_replace(' ', 'T', $value) . '.000Z';
}

function deserialize_inquiry(array $row): array
{
    $row['created_date'] = serialize_datetime((string) ($row['created_date'] ?? ''));
    $row['updated_date'] = serialize_datetime((string) ($row['updated_date'] ?? ''));
    $row['last_message_at'] = serialize_datetime((string) ($row['last_message_at'] ?? ''));
    $row['message_count'] = isset($row['message_count']) ? (int) $row['message_count'] : 0;
    return $row;
}

function deserialize_message(array $row): array
{
    $row['created_date'] = serialize_datetime((string) ($row['created_date'] ?? ''));
    $row['updated_date'] = serialize_datetime((string) ($row['updated_date'] ?? ''));
    return $row;
}

function log_inquiry_activity(?array $actor, string $action, string $inquiryId, string $details): void
{
    if (!table_exists(db(), 'activity_logs')) {
        return;
    }

    $statement = db()->prepare(
        'INSERT INTO activity_logs (id, created_date, updated_date, user_email, user_name, action, entity_type, entity_id, details)
         VALUES (:id, :created_date, :updated_date, :user_email, :user_name, :action, :entity_type, :entity_id, :details)'
    );

    $statement->execute([
        'id' => create_id('activitylog'),
        'created_date' => now_mysql(),
        'updated_date' => now_mysql(),
        'user_email' => $actor['email'] ?? null,
        'user_name' => $actor['full_name'] ?? ($actor['email'] ?? 'Guest'),
        'action' => $action,
        'entity_type' => 'Inquiry',
        'entity_id' => $inquiryId,
        'details' => $details,
    ]);
}

function inquiry_email_body(string $title, string $guestName, string $contentHtml): string
{
    $safeGuestName = htmlspecialchars($guestName !== '' ? $guestName : 'Guest', ENT_QUOTES | ENT_HTML5, 'UTF-8');

    return kasa_email_layout(
        $title,
        '<p style="margin:0 0 14px;">Hello ' . $safeGuestName . ',</p>' . $contentHtml
    );
}

function notify_inquiry_created(array $inquiry, string $message): void
{
    $guestEmail = trim((string) ($inquiry['guest_email'] ?? ''));
    $guestName = (string) ($inquiry['guest_name'] ?? 'Guest');
    $subject = (string) ($inquiry['subject'] ?? 'Inquiry');

    if ($guestEmail !== '' && filter_var($guestEmail, FILTER_VALIDATE_EMAIL)) {
        $body = inquiry_email_body(
            'Inquiry Received',
            $guestName,
            '<p style="margin:0 0 14px;">Thank you for contacting Kasailaya Resort. We received your message and our team will respond as soon as possible.</p>'
            . '<p style="margin:0 0 14px;"><strong>Subject:</strong> ' . htmlspecialchars($subject, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '</p>'
        );
        safe_send_app_email($guestEmail, 'We received your inquiry | Kasailaya Resort', $body, 'info');
    }

    $adminEmail = admin_notification_email();
    if ($adminEmail === '' || !filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        return;
    }

    $adminBody = kasa_email_layout(
        'New Customer Inquiry',
        '<p style="margin:0 0 14px;">A new customer inquiry was submitted.</p>'
        . '<p style="margin:0 0 14px;"><strong>Subject:</strong> ' . htmlspecialchars($subject, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '<br>'
        . '<strong>Guest:</strong> ' . htmlspecialchars($guestName, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '<br>'
        . '<strong>Email:</strong> ' . htmlspecialchars($guestEmail, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '<br>'
        . '<strong>Phone:</strong> ' . htmlspecialchars((string) ($inquiry['guest_phone'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8') . '</p>'
        . '<blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #214332;background:#f6fbf7;">'
        . nl2br(htmlspecialchars($message, ENT_QUOTES | ENT_HTML5, 'UTF-8'))
        . '</blockquote>'
    );
    safe_send_app_email($adminEmail, 'New inquiry - ' . $subject . ' | Kasailaya Resort', $adminBody, 'admin');
}

function load_inquiry(string $id): ?array
{
    $statement = db()->prepare(
        'SELECT inquiries.*, 
                assigned_admin.full_name AS assigned_admin_name,
                assigned_admin.email AS assigned_admin_email,
                (SELECT COUNT(*) FROM inquiry_messages WHERE inquiry_id = inquiries.id) AS message_count,
                (SELECT sender_type FROM inquiry_messages WHERE inquiry_id = inquiries.id ORDER BY created_date DESC, id DESC LIMIT 1) AS last_sender_type,
                (SELECT sender_name FROM inquiry_messages WHERE inquiry_id = inquiries.id ORDER BY created_date DESC, id DESC LIMIT 1) AS last_sender_name
         FROM inquiries
         LEFT JOIN users AS assigned_admin ON assigned_admin.id = inquiries.assigned_admin_id
         WHERE inquiries.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $inquiry = $statement->fetch();

    return $inquiry ?: null;
}

function load_inquiry_messages(string $inquiryId): array
{
    $statement = db()->prepare(
        'SELECT * FROM inquiry_messages WHERE inquiry_id = :inquiry_id ORDER BY created_date ASC, id ASC'
    );
    $statement->execute(['inquiry_id' => $inquiryId]);
    return array_map('deserialize_message', $statement->fetchAll());
}

function inquiry_owned_by_actor(?array $actor, array $inquiry): bool
{
    if (!$actor) {
        return false;
    }

    if (!empty($inquiry['user_id']) && ($inquiry['user_id'] === ($actor['id'] ?? null))) {
        return true;
    }

    $actorEmail = normalize_email((string) ($actor['email'] ?? ''));
    $inquiryEmail = normalize_email((string) ($inquiry['guest_email'] ?? ''));
    return $actorEmail !== '' && $actorEmail === $inquiryEmail;
}

function inquiry_token_matches(array $inquiry, ?string $token): bool
{
    $token = trim((string) $token);
    $hash = (string) ($inquiry['guest_token_hash'] ?? '');

    if ($token === '' || $hash === '') {
        return false;
    }

    return hash_equals($hash, inquiry_token_hash($token));
}

function ensure_inquiry_access(?array $actor, array $inquiry, ?string $token = null): void
{
    if (actor_is_admin($actor) || inquiry_owned_by_actor($actor, $inquiry) || inquiry_token_matches($inquiry, $token)) {
        return;
    }

    json_error('Forbidden.', 403);
}

function create_guest_token(): string
{
    return bin2hex(random_bytes(16));
}

try {
    if ($method === 'GET' && $action === 'list') {
        if (!actor_is_admin($actor)) {
            json_error('Forbidden.', 403);
        }

        $status = trim((string) query_param('status', ''));
        $params = [];
        $sql = 'SELECT inquiries.*, 
                       assigned_admin.full_name AS assigned_admin_name,
                       assigned_admin.email AS assigned_admin_email,
                       (SELECT COUNT(*) FROM inquiry_messages WHERE inquiry_id = inquiries.id) AS message_count,
                       (SELECT sender_type FROM inquiry_messages WHERE inquiry_id = inquiries.id ORDER BY created_date DESC, id DESC LIMIT 1) AS last_sender_type,
                       (SELECT sender_name FROM inquiry_messages WHERE inquiry_id = inquiries.id ORDER BY created_date DESC, id DESC LIMIT 1) AS last_sender_name
                FROM inquiries
                LEFT JOIN users AS assigned_admin ON assigned_admin.id = inquiries.assigned_admin_id';

        if ($status !== '' && in_array($status, ['open', 'in_progress', 'resolved', 'closed', 'archived'], true)) {
            $sql .= ' WHERE inquiries.status = :status';
            $params['status'] = $status;
        } else {
            $sql .= " WHERE inquiries.status <> 'archived'";
        }

        $sql .= ' ORDER BY inquiries.last_message_at DESC, inquiries.updated_date DESC';
        $statement = db()->prepare($sql);
        $statement->execute($params);
        $rows = $statement->fetchAll();
        json_response(array_map('deserialize_inquiry', $rows));
    }

    if ($method === 'POST' && $action === 'mine') {
        $payload = request_body();
        $tokens = $payload['tokens'] ?? [];
        $results = [];

        if ($actor && !actor_is_admin($actor)) {
            $statement = db()->prepare(
                'SELECT inquiries.*, 
                        assigned_admin.full_name AS assigned_admin_name,
                        assigned_admin.email AS assigned_admin_email,
                        (SELECT COUNT(*) FROM inquiry_messages WHERE inquiry_id = inquiries.id) AS message_count,
                        (SELECT sender_type FROM inquiry_messages WHERE inquiry_id = inquiries.id ORDER BY created_date DESC, id DESC LIMIT 1) AS last_sender_type,
                        (SELECT sender_name FROM inquiry_messages WHERE inquiry_id = inquiries.id ORDER BY created_date DESC, id DESC LIMIT 1) AS last_sender_name
                 FROM inquiries
                 LEFT JOIN users AS assigned_admin ON assigned_admin.id = inquiries.assigned_admin_id
                 WHERE inquiries.user_id = :user_id OR inquiries.guest_email = :guest_email
                 ORDER BY inquiries.last_message_at DESC, inquiries.updated_date DESC'
            );
            $statement->execute([
                'user_id' => $actor['id'] ?? '',
                'guest_email' => normalize_email((string) ($actor['email'] ?? '')),
            ]);

            foreach ($statement->fetchAll() as $row) {
                $results[$row['id']] = deserialize_inquiry($row);
            }
        }

        if (is_array($tokens)) {
            foreach ($tokens as $tokenRow) {
                $inquiryId = trim((string) ($tokenRow['id'] ?? ''));
                $token = trim((string) ($tokenRow['token'] ?? ''));
                if ($inquiryId === '' || $token === '') {
                    continue;
                }

                $inquiry = load_inquiry($inquiryId);
                if (!$inquiry || !inquiry_token_matches($inquiry, $token)) {
                    continue;
                }

                $results[$inquiryId] = deserialize_inquiry($inquiry);
            }
        }

        $sorted = array_values($results);
        usort($sorted, static function (array $left, array $right): int {
            return strcmp((string) ($right['last_message_at'] ?? ''), (string) ($left['last_message_at'] ?? ''));
        });

        json_response($sorted);
    }

    if ($method === 'POST' && $action === 'create') {
        $payload = request_body();
        $name = trim((string) ($payload['name'] ?? ($actor['full_name'] ?? '')));
        $email = normalize_email((string) ($payload['email'] ?? ($actor['email'] ?? '')));
        $phone = trim((string) ($payload['phone'] ?? ($actor['phone'] ?? '')));
        $subject = trim((string) ($payload['subject'] ?? ''));
        $message = trim((string) ($payload['message'] ?? ''));

        if ($name === '') {
            json_error('Please enter your name.', 422);
        }

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            json_error('Please enter a valid email address.', 422);
        }

        if ($subject === '') {
            json_error('Please enter an inquiry subject.', 422);
        }

        if ($message === '') {
            json_error('Please enter your message.', 422);
        }

        $now = now_mysql();
        $inquiryId = create_id('inquiry');
        $messageId = create_id('inquirymessage');
        $guestToken = create_guest_token();
        $userId = actor_is_admin($actor) ? null : ($actor['id'] ?? null);

        $createInquiry = db()->prepare(
            'INSERT INTO inquiries
             (id, created_date, updated_date, guest_name, guest_email, guest_phone, subject, status, user_id, assigned_admin_id, guest_token_hash, last_message_at, last_message_preview)
             VALUES
             (:id, :created_date, :updated_date, :guest_name, :guest_email, :guest_phone, :subject, :status, :user_id, :assigned_admin_id, :guest_token_hash, :last_message_at, :last_message_preview)'
        );
        $createInquiry->execute([
            'id' => $inquiryId,
            'created_date' => $now,
            'updated_date' => $now,
            'guest_name' => $name,
            'guest_email' => $email,
            'guest_phone' => $phone === '' ? null : $phone,
            'subject' => $subject,
            'status' => 'open',
            'user_id' => $userId,
            'assigned_admin_id' => null,
            'guest_token_hash' => inquiry_token_hash($guestToken),
            'last_message_at' => $now,
            'last_message_preview' => preview_text($message),
        ]);

        $createMessage = db()->prepare(
            'INSERT INTO inquiry_messages
             (id, created_date, updated_date, inquiry_id, sender_type, sender_name, sender_email, sender_user_id, message)
             VALUES
             (:id, :created_date, :updated_date, :inquiry_id, :sender_type, :sender_name, :sender_email, :sender_user_id, :message)'
        );
        $createMessage->execute([
            'id' => $messageId,
            'created_date' => $now,
            'updated_date' => $now,
            'inquiry_id' => $inquiryId,
            'sender_type' => 'guest',
            'sender_name' => $name,
            'sender_email' => $email,
            'sender_user_id' => $userId,
            'message' => $message,
        ]);

        log_inquiry_activity($actor, 'Created Inquiry', $inquiryId, 'Created inquiry "' . $subject . '" from ' . $email . '.');

        $createdInquiry = load_inquiry($inquiryId);
        if ($createdInquiry) {
            notify_inquiry_created($createdInquiry, $message);
        }

        json_response([
            'inquiry' => deserialize_inquiry($createdInquiry ?: []),
            'messages' => load_inquiry_messages($inquiryId),
            'guest_access_token' => $guestToken,
        ], 201);
    }

    if ($method === 'POST' && $action === 'thread') {
        $payload = request_body();
        $id = trim((string) ($payload['id'] ?? ''));
        $token = trim((string) ($payload['token'] ?? ''));

        if ($id === '') {
            json_error('Missing inquiry id.', 422);
        }

        $inquiry = load_inquiry($id);
        if (!$inquiry) {
            json_error('Inquiry not found.', 404);
        }

        ensure_inquiry_access($actor, $inquiry, $token);

        json_response([
            'inquiry' => deserialize_inquiry($inquiry),
            'messages' => load_inquiry_messages($id),
        ]);
    }

    if ($method === 'POST' && $action === 'reply') {
        $id = trim((string) query_param('id', ''));
        $payload = request_body();
        $token = trim((string) ($payload['token'] ?? ''));
        $message = trim((string) ($payload['message'] ?? ''));

        if ($id === '') {
            json_error('Missing inquiry id.', 422);
        }

        if ($message === '') {
            json_error('Please enter a message.', 422);
        }

        $inquiry = load_inquiry($id);
        if (!$inquiry) {
            json_error('Inquiry not found.', 404);
        }

        ensure_inquiry_access($actor, $inquiry, $token);

        if (($inquiry['status'] ?? 'open') === 'closed') {
            json_error('This inquiry is already closed. Messaging is no longer available.', 422);
        }

        $now = now_mysql();
        $isAdminReply = actor_is_admin($actor);
        $senderName = $isAdminReply
            ? trim((string) ($actor['full_name'] ?? $actor['email'] ?? 'Admin'))
            : trim((string) ($actor['full_name'] ?? $inquiry['guest_name'] ?? 'Guest'));
        $senderEmail = $isAdminReply
            ? normalize_email((string) ($actor['email'] ?? ''))
            : normalize_email((string) ($actor['email'] ?? $inquiry['guest_email'] ?? ''));
        $nextStatus = $isAdminReply
            ? (($inquiry['status'] ?? 'open') === 'resolved' ? 'in_progress' : ($inquiry['status'] ?? 'open' ?: 'in_progress'))
            : 'open';

        if ($isAdminReply && $nextStatus === 'open') {
            $nextStatus = 'in_progress';
        }

        $insertMessage = db()->prepare(
            'INSERT INTO inquiry_messages
             (id, created_date, updated_date, inquiry_id, sender_type, sender_name, sender_email, sender_user_id, message)
             VALUES
             (:id, :created_date, :updated_date, :inquiry_id, :sender_type, :sender_name, :sender_email, :sender_user_id, :message)'
        );
        $insertMessage->execute([
            'id' => create_id('inquirymessage'),
            'created_date' => $now,
            'updated_date' => $now,
            'inquiry_id' => $id,
            'sender_type' => $isAdminReply ? 'admin' : 'guest',
            'sender_name' => $senderName,
            'sender_email' => $senderEmail !== '' ? $senderEmail : null,
            'sender_user_id' => $actor['id'] ?? null,
            'message' => $message,
        ]);

        $updateInquiry = db()->prepare(
            'UPDATE inquiries
             SET updated_date = :updated_date,
                 status = :status,
                 assigned_admin_id = :assigned_admin_id,
                 last_message_at = :last_message_at,
                 last_message_preview = :last_message_preview
             WHERE id = :id'
        );
        $updateInquiry->execute([
            'id' => $id,
            'updated_date' => $now,
            'status' => $nextStatus,
            'assigned_admin_id' => $isAdminReply ? (($inquiry['assigned_admin_id'] ?: ($actor['id'] ?? null)) ?: null) : ($inquiry['assigned_admin_id'] ?: null),
            'last_message_at' => $now,
            'last_message_preview' => preview_text($message),
        ]);

        if ($isAdminReply) {
            try {
                send_app_email(
                    (string) $inquiry['guest_email'],
                    'Reply to your inquiry: ' . (string) $inquiry['subject'],
                    inquiry_email_body(
                        'Inquiry Reply',
                        (string) $inquiry['guest_name'],
                        '<p style="margin:0 0 14px;">A resort admin replied to your inquiry.</p>'
                        . '<blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #214332;background:#f6fbf7;">'
                        . nl2br(htmlspecialchars($message, ENT_QUOTES | ENT_HTML5, 'UTF-8'))
                        . '</blockquote>'
                        . '<p style="margin:0;">You can continue the conversation on the Contact page.</p>'
                    ),
                    'info'
                );
            } catch (Throwable $error) {
                error_log('Kasailaya Resort inquiry reply email failed: ' . sanitize_mail_error_message($error->getMessage()));
            }
        }

        log_inquiry_activity(
            $actor,
            $isAdminReply ? 'Replied to Inquiry' : 'Guest Replied to Inquiry',
            $id,
            ($isAdminReply ? 'Admin' : 'Guest') . ' replied to inquiry "' . (string) $inquiry['subject'] . '".'
        );

        $updatedInquiry = load_inquiry($id);
        json_response([
            'inquiry' => deserialize_inquiry($updatedInquiry ?: []),
            'messages' => load_inquiry_messages($id),
        ]);
    }

    if ($method === 'PATCH' && $action === 'status') {
        if (!actor_is_admin($actor)) {
            json_error('Forbidden.', 403);
        }

        $id = trim((string) query_param('id', ''));
        $payload = request_body();
        $status = trim((string) ($payload['status'] ?? ''));

        if ($id === '') {
            json_error('Missing inquiry id.', 422);
        }

        if (!in_array($status, ['open', 'in_progress', 'resolved', 'closed'], true)) {
            json_error('Invalid inquiry status.', 422);
        }

        $inquiry = load_inquiry($id);
        if (!$inquiry) {
            json_error('Inquiry not found.', 404);
        }

        $statement = db()->prepare(
            'UPDATE inquiries
             SET status = :status,
                 updated_date = :updated_date,
                 assigned_admin_id = :assigned_admin_id
             WHERE id = :id'
        );
        $statement->execute([
            'id' => $id,
            'status' => $status,
            'updated_date' => now_mysql(),
            'assigned_admin_id' => $inquiry['assigned_admin_id'] ?: ($actor['id'] ?? null),
        ]);

        log_inquiry_activity($actor, 'Updated Inquiry Status', $id, 'Marked inquiry "' . (string) $inquiry['subject'] . '" as ' . $status . '.');

        $updatedInquiry = load_inquiry($id);
        json_response([
            'inquiry' => deserialize_inquiry($updatedInquiry ?: []),
            'messages' => load_inquiry_messages($id),
        ]);
    }

    if ($method === 'PATCH' && $action === 'archive') {
        if (!actor_is_admin($actor)) {
            json_error('Forbidden.', 403);
        }

        $id = trim((string) query_param('id', ''));

        if ($id === '') {
            json_error('Missing inquiry id.', 422);
        }

        $inquiry = load_inquiry($id);
        if (!$inquiry) {
            json_error('Inquiry not found.', 404);
        }

        $statement = db()->prepare(
            'UPDATE inquiries
             SET status = :status,
                 updated_date = :updated_date,
                 assigned_admin_id = :assigned_admin_id
             WHERE id = :id'
        );
        $statement->execute([
            'id' => $id,
            'status' => 'archived',
            'updated_date' => now_mysql(),
            'assigned_admin_id' => $inquiry['assigned_admin_id'] ?: ($actor['id'] ?? null),
        ]);

        log_inquiry_activity($actor, 'Archived Inquiry', $id, 'Archived inquiry "' . (string) $inquiry['subject'] . '".');

        $updatedInquiry = load_inquiry($id);
        json_response([
            'inquiry' => deserialize_inquiry($updatedInquiry ?: []),
            'messages' => load_inquiry_messages($id),
        ]);
    }
} catch (Throwable $error) {
    json_error('An unexpected error occurred: ' . $error->getMessage(), 500);
}
