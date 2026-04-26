<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

$file = null;
$token = trim($_GET['token'] ?? '');
$id = (int)($_GET['id'] ?? 0);
$downloadDetails = '';
$actorId = null;

if ($token !== '') {
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        http_response_code(404);
        exit('File not found.');
    }

    $stmt = $pdo->prepare(
        'SELECT f.*
         FROM shared_links sl
         INNER JOIN files f ON f.id = sl.file_id
         WHERE sl.token = ?
           AND (sl.expiry_date IS NULL OR sl.expiry_date > NOW())
         LIMIT 1'
    );
    $stmt->execute([$token]);
    $file = $stmt->fetch();
    $actorId = $file ? (int)$file['user_id'] : null;
    $downloadDetails = 'Downloaded through secure link';
} elseif ($id > 0) {
    requireLogin();

    $stmt = $pdo->prepare('SELECT * FROM files WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $candidate = $stmt->fetch();

    if ($candidate) {
        $user = currentUser();
        $isOwner = (int)$candidate['user_id'] === (int)$user['id'];
        $isAdmin = ($user['role'] ?? '') === 'admin';

        if ($isOwner || $isAdmin) {
            $file = $candidate;
            $actorId = (int)$user['id'];
            $downloadDetails = $isAdmin ? 'Admin downloaded file' : 'Owner downloaded file';
        }
    }
}

if (!$file) {
    http_response_code(404);
    exit('File not found or link expired.');
}

$absolutePath = absoluteUploadPath((string)$file['filepath']);

if (!isPathInsideDirectory($absolutePath, UPLOAD_DIR) || !is_file($absolutePath)) {
    http_response_code(404);
    exit('File not found.');
}

$downloadName = str_replace(['"', "\r", "\n"], '', basename((string)$file['filename']));
$mimeType = $file['mime_type'] ?: detectMimeType($absolutePath);

logActivity($pdo, $actorId, (int)$file['id'], 'download', $downloadDetails . ': ' . $file['filename']);

header('Content-Description: File Transfer');
header('Content-Type: ' . $mimeType);
header('Content-Disposition: attachment; filename="' . $downloadName . '"');
header('Content-Length: ' . filesize($absolutePath));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store, no-cache, must-revalidate');
readfile($absolutePath);
exit;
