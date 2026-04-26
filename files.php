<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

requireRole('user');

$userId = (int)currentUser()['id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();

    $action = $_POST['action'] ?? '';
    $fileId = (int)($_POST['file_id'] ?? 0);

    if ($fileId <= 0 || !fileBelongsToUser($pdo, $fileId, $userId)) {
        setFlash('danger', 'File not found.');
        redirect('files.php');
    }

    if ($action === 'generate_link') {
        try {
            $expiryDate = expiryDateFromOption((string)($_POST['expiry_option'] ?? 'never'));
            createOrUpdateSharedLink($pdo, $fileId, $expiryDate);
            logActivity($pdo, $userId, $fileId, 'share_link', $expiryDate ? 'Generated link expiring ' . $expiryDate : 'Generated non-expiring link');
            setFlash('success', 'Secure sharing link generated.');
        } catch (Throwable $exception) {
            setFlash('danger', 'Could not generate a secure link.');
        }
    }

    if ($action === 'delete_file') {
        if (deleteFileById($pdo, $fileId, $userId)) {
            setFlash('success', 'File deleted.');
        } else {
            setFlash('danger', 'File could not be deleted.');
        }
    }

    redirect('files.php');
}

$stmt = $pdo->prepare(
    'SELECT f.*, sl.token, sl.expiry_date, sl.created_at AS link_created_at
     FROM files f
     LEFT JOIN shared_links sl ON sl.file_id = f.id
     WHERE f.user_id = ?
     ORDER BY f.created_at DESC'
);
$stmt->execute([$userId]);
$files = $stmt->fetchAll();

$pageTitle = 'My Files';
$activePage = 'files';
require_once __DIR__ . '/includes/header.php';
?>

<div class="app-shell">
    <?php require_once __DIR__ . '/includes/sidebar.php'; ?>

    <main class="app-main">
        <div class="page-heading">
            <div>
                <span class="badge rounded-pill badge-soft mb-2">Files</span>
                <h1 class="h2 mb-1">My Files</h1>
                <p class="muted mb-0">Download, delete, or share your uploaded files with token links.</p>
            </div>
            <a class="btn btn-primary" href="upload.php">
                <i class="bi bi-cloud-arrow-up"></i> Upload
            </a>
        </div>

        <?php if (!$files): ?>
            <div class="empty-state">
                <i class="bi bi-folder2-open fs-1 d-block mb-3"></i>
                No files uploaded yet.
            </div>
        <?php else: ?>
            <div class="row g-3">
                <?php foreach ($files as $index => $file): ?>
                    <?php
                    $hasLink = !empty($file['token']);
                    $downloadUrl = $hasLink ? secureDownloadUrl($file['token']) : '';
                    $inputId = 'shareLink' . $index;
                    $isExpired = $file['expiry_date'] && strtotime($file['expiry_date']) <= time();
                    ?>
                    <div class="col-xl-4 col-md-6">
                        <article class="file-card">
                            <div class="d-flex gap-3 align-items-start mb-3">
                                <span class="file-icon"><i class="bi bi-file-earmark-lock"></i></span>
                                <div class="min-w-0">
                                    <h2 class="h6 mb-1 text-break"><?= e($file['filename']) ?></h2>
                                    <p class="muted small mb-0">
                                        <?= e(formatBytes((int)$file['size'])) ?> · <?= e(date('M d, Y h:i A', strtotime($file['created_at']))) ?>
                                    </p>
                                </div>
                            </div>

                            <div class="d-flex flex-wrap gap-2 mb-3">
                                <a class="btn btn-outline-light btn-sm" href="download.php?id=<?= (int)$file['id'] ?>">
                                    <i class="bi bi-download"></i> Download
                                </a>
                                <form method="post" data-confirm="Delete this file permanently?">
                                    <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
                                    <input type="hidden" name="action" value="delete_file">
                                    <input type="hidden" name="file_id" value="<?= (int)$file['id'] ?>">
                                    <button class="btn btn-outline-danger btn-sm" type="submit">
                                        <i class="bi bi-trash"></i> Delete
                                    </button>
                                </form>
                            </div>

                            <?php if ($hasLink): ?>
                                <div class="d-flex justify-content-between align-items-center gap-2 mb-2">
                                    <span class="badge <?= $isExpired ? 'text-bg-danger' : 'badge-soft' ?>">
                                        <?= $isExpired ? 'Expired' : e(formatDateTime($file['expiry_date'])) ?>
                                    </span>
                                </div>
                                <label class="form-label small muted" for="<?= e($inputId) ?>">Secure link</label>
                                <div class="input-group mb-3">
                                    <input class="form-control link-field" id="<?= e($inputId) ?>" value="<?= e($downloadUrl) ?>" readonly>
                                    <button class="btn btn-outline-light" type="button" data-copy="#<?= e($inputId) ?>" aria-label="Copy link">
                                        <i class="bi bi-copy"></i>
                                    </button>
                                </div>
                                <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
                                    <span class="qr-box">
                                        <img src="qr.php?token=<?= e($file['token']) ?>" alt="QR code for <?= e($file['filename']) ?>">
                                    </span>
                                    <div class="d-grid gap-2">
                                        <a class="btn btn-primary btn-sm <?= $isExpired ? 'disabled' : '' ?>" href="<?= e($downloadUrl) ?>" target="_blank" rel="noopener">
                                            <i class="bi bi-box-arrow-up-right"></i> Open Link
                                        </a>
                                        <a class="btn btn-outline-light btn-sm" href="qr.php?token=<?= e($file['token']) ?>&download=1">
                                            <i class="bi bi-qr-code"></i> QR Code
                                        </a>
                                    </div>
                                </div>
                            <?php endif; ?>

                            <form method="post" class="share-form">
                                <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
                                <input type="hidden" name="action" value="generate_link">
                                <input type="hidden" name="file_id" value="<?= (int)$file['id'] ?>">
                                <label class="form-label small muted" for="expiry<?= (int)$file['id'] ?>">Link expiry</label>
                                <div class="input-group">
                                    <select class="form-select" id="expiry<?= (int)$file['id'] ?>" name="expiry_option">
                                        <option value="never">Never</option>
                                        <option value="1d">1 day</option>
                                        <option value="7d">7 days</option>
                                        <option value="30d">30 days</option>
                                    </select>
                                    <button class="btn btn-primary" type="submit">
                                        <i class="bi bi-link-45deg"></i> <?= $hasLink ? 'Update' : 'Share' ?>
                                    </button>
                                </div>
                            </form>
                        </article>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </main>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
