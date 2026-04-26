<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

requireRole('user');

$user = currentUser();
$userId = (int)$user['id'];

$fileCountStmt = $pdo->prepare('SELECT COUNT(*) FROM files WHERE user_id = ?');
$fileCountStmt->execute([$userId]);
$fileCount = (int)$fileCountStmt->fetchColumn();

$downloadCountStmt = $pdo->prepare(
    "SELECT COUNT(*)
     FROM activity_logs al
     INNER JOIN files f ON f.id = al.file_id
     WHERE f.user_id = ? AND al.action = 'download'"
);
$downloadCountStmt->execute([$userId]);
$downloadCount = (int)$downloadCountStmt->fetchColumn();

$sharedCountStmt = $pdo->prepare(
    'SELECT COUNT(*)
     FROM shared_links sl
     INNER JOIN files f ON f.id = sl.file_id
     WHERE f.user_id = ?'
);
$sharedCountStmt->execute([$userId]);
$sharedCount = (int)$sharedCountStmt->fetchColumn();

$recentStmt = $pdo->prepare(
    'SELECT f.*, sl.token, sl.expiry_date
     FROM files f
     LEFT JOIN shared_links sl ON sl.file_id = f.id
     WHERE f.user_id = ?
     ORDER BY f.created_at DESC
     LIMIT 5'
);
$recentStmt->execute([$userId]);
$recentFiles = $recentStmt->fetchAll();

$activityStmt = $pdo->prepare(
    'SELECT al.action, al.details, al.created_at, f.filename
     FROM activity_logs al
     LEFT JOIN files f ON f.id = al.file_id
     WHERE al.user_id = ?
     ORDER BY al.created_at DESC
     LIMIT 6'
);
$activityStmt->execute([$userId]);
$activities = $activityStmt->fetchAll();

$pageTitle = 'Dashboard';
$activePage = 'dashboard';
require_once __DIR__ . '/includes/header.php';
?>

<div class="app-shell">
    <?php require_once __DIR__ . '/includes/sidebar.php'; ?>

    <main class="app-main">
        <div class="page-heading">
            <div>
                <span class="badge rounded-pill badge-soft mb-2">Dashboard</span>
                <h1 class="h2 mb-1">Welcome, <?= e($user['name']) ?></h1>
                <p class="muted mb-0"><?= e($user['email']) ?></p>
            </div>
            <a class="btn btn-primary" href="upload.php">
                <i class="bi bi-cloud-arrow-up"></i> Upload File
            </a>
        </div>

        <div class="row g-3 mb-4">
            <div class="col-md-4">
                <div class="stat-card">
                    <i class="bi bi-folder2-open"></i>
                    <span class="muted d-block mt-3">Uploaded Files</span>
                    <strong><?= $fileCount ?></strong>
                </div>
            </div>
            <div class="col-md-4">
                <div class="stat-card">
                    <i class="bi bi-download"></i>
                    <span class="muted d-block mt-3">File Downloads</span>
                    <strong><?= $downloadCount ?></strong>
                </div>
            </div>
            <div class="col-md-4">
                <div class="stat-card">
                    <i class="bi bi-link-45deg"></i>
                    <span class="muted d-block mt-3">Shared Links</span>
                    <strong><?= $sharedCount ?></strong>
                </div>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-xl-5">
                <section class="glass-card">
                    <h2 class="h5 mb-3">Quick Upload</h2>
                    <form action="upload.php" method="post" enctype="multipart/form-data">
                        <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
                        <div class="mb-3">
                            <label class="form-label" for="shared_file">Choose File</label>
                            <input class="form-control" type="file" id="shared_file" name="shared_file" required>
                            <div class="form-text text-secondary">
                                Max <?= e(formatBytes(MAX_UPLOAD_BYTES)) ?>. Allowed: <?= e(implode(', ', ALLOWED_EXTENSIONS)) ?>.
                            </div>
                        </div>
                        <button class="btn btn-primary" type="submit">
                            <i class="bi bi-upload"></i> Upload
                        </button>
                    </form>
                </section>

                <section class="glass-card mt-4">
                    <h2 class="h5 mb-3">Recent Activity</h2>
                    <?php if (!$activities): ?>
                        <div class="empty-state compact">No activity yet.</div>
                    <?php else: ?>
                        <div class="activity-list">
                            <?php foreach ($activities as $activity): ?>
                                <div class="activity-item">
                                    <span class="activity-icon"><i class="bi bi-activity"></i></span>
                                    <div>
                                        <strong><?= e(ucwords(str_replace('_', ' ', $activity['action']))) ?></strong>
                                        <p class="mb-0 muted small">
                                            <?= e($activity['details'] ?: ($activity['filename'] ?? 'System activity')) ?>
                                            · <?= e(date('M d, h:i A', strtotime($activity['created_at']))) ?>
                                        </p>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </section>
            </div>

            <div class="col-xl-7">
                <section class="glass-card">
                    <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
                        <h2 class="h5 mb-0">Recent Files</h2>
                        <a class="btn btn-outline-light btn-sm" href="files.php">
                            <i class="bi bi-folder2-open"></i> View All
                        </a>
                    </div>

                    <?php if (!$recentFiles): ?>
                        <div class="empty-state">No uploads yet.</div>
                    <?php else: ?>
                        <div class="table-responsive">
                            <table class="table table-dark-custom align-middle mb-0">
                                <thead>
                                <tr>
                                    <th>File</th>
                                    <th>Size</th>
                                    <th>Uploaded</th>
                                    <th>Link</th>
                                    <th class="text-end">Action</th>
                                </tr>
                                </thead>
                                <tbody>
                                <?php foreach ($recentFiles as $file): ?>
                                    <tr>
                                        <td class="text-break"><?= e($file['filename']) ?></td>
                                        <td><?= e(formatBytes((int)$file['size'])) ?></td>
                                        <td><?= e(date('M d, Y', strtotime($file['created_at']))) ?></td>
                                        <td>
                                            <?php if ($file['token']): ?>
                                                <span class="badge badge-soft"><?= e(formatDateTime($file['expiry_date'])) ?></span>
                                            <?php else: ?>
                                                <span class="muted">Not shared</span>
                                            <?php endif; ?>
                                        </td>
                                        <td class="text-end">
                                            <a class="btn btn-outline-light btn-sm" href="download.php?id=<?= (int)$file['id'] ?>">
                                                <i class="bi bi-download"></i>
                                            </a>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    <?php endif; ?>
                </section>
            </div>
        </div>
    </main>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
