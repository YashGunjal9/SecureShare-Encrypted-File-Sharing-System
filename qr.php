<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/qr_generator.php';

$token = trim($_GET['token'] ?? '');

if ($token === '' || !preg_match('/^[a-f0-9]{64}$/', $token)) {
    http_response_code(404);
    exit('QR code not found.');
}

$stmt = $pdo->prepare(
    'SELECT token
     FROM shared_links
     WHERE token = ?
       AND (expiry_date IS NULL OR expiry_date > NOW())
     LIMIT 1'
);
$stmt->execute([$token]);
$linkToken = $stmt->fetchColumn();

if (!$linkToken) {
    http_response_code(404);
    exit('QR code not found.');
}

try {
    $svg = SimpleQrCode::svg(secureDownloadUrl((string)$linkToken));
} catch (Throwable $exception) {
    http_response_code(500);
    exit('Could not generate QR code.');
}

header('Content-Type: image/svg+xml; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

if (isset($_GET['download'])) {
    header('Content-Disposition: attachment; filename="secure-link-qr-' . substr((string)$linkToken, 0, 8) . '.svg"');
}

echo $svg;
