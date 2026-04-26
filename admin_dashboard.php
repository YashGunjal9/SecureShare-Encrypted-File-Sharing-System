<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

requireRole('admin');

$admin = currentUser();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();

    $action = $_POST['action'] ?? '';

    if ($action === 'delete_file') {
        $fileId = (int)($_POST['file_id'] ?? 0);

        if ($fileId > 0 && deleteFileById($pdo, $fileId, null, true)) {
            setFlash('success', 'File deleted.');
        } else {
            setFlash('danger', 'File could not be deleted.');
        }

        redirect('admin_dashboard.php#files');
    }

    if ($action === 'delete_user') {
        $userId = (int)($_POST['user_id'] ?? 0);

        if ($userId === (int)$admin['id']) {
            setFlash('danger', 'You cannot delete your own admin account.');
            redirect('admin_dashboard.php#users');
        }

        $userStmt = $pdo->prepare("SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1");
        $userStmt->execute([$userId]);
        $targetUser = $userStmt->fetch();

        if (!$targetUser || $targetUser['role'] === 'admin') {
            setFlash('danger', 'That user account is protected.');
            redirect('admin_dashboard.php#users');
        }

        $fileStmt = $pdo->prepare('SELECT filepath FROM files WHERE user_id = ?');
        $fileStmt->execute([$userId]);
        $paths = $fileStmt->fetchAll(PDO::FETCH_COLUMN);

        $delete = $pdo->prepare("DELETE FROM users WHERE id = ? AND role = 'user'");
        $delete->execute([$userId]);

        foreach ($paths as $path) {
            deletePhysicalFile((string)$path);
        }

        logActivity($pdo, (int)$admin['id'], null, 'delete_user', 'Deleted user ' . $targetUser['email']);
        setFlash('success', 'User and their files were deleted.');
        redirect('admin_dashboard.php#users');
    }
}

$totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'user'")->fetchColumn();
$totalFiles = (int)$pdo->query('SELECT COUNT(*) FROM files')->fetchColumn();
$totalLinks = (int)$pdo->query('SELECT COUNT(*) FROM shared_links')->fetchColumn();
$totalDownloads = (int)$pdo->query("SELECT COUNT(*) FROM activity_logs WHERE action = 'download'")->fetchColumn();

$users = $pdo->query(
    'SELECT u.id, u.name, u.email, u.role, u.created_at,
            COUNT(DISTINCT f.id) AS file_count
     FROM users u
     LEFT JOIN files f ON f.user_id = u.id
     GROUP BY u.id, u.name, u.email, u.role, u.created_at
     ORDER BY u.created_at DESC'
)->fetchAll();

$files = $pdo->query(
    'SELECT f.*, u.name AS owner_name, u.email AS owner_email, sl.token, sl.expiry_date
     FROM files f
     INNER JOIN users u ON u.id = f.user_id
     LEFT JOIN shared_links sl ON sl.file_id = f.id
     ORDER BY f.created_at DESC'
)->fetchAll();

$logs = $pdo->query(
    'SELECT al.*, u.name AS user_name, u.email AS user_email, f.filename
     FROM activity_logs al
     LEFT JOIN users u ON u.id = al.user_id
     LEFT JOIN files f ON f.id = al.file_id
     ORDER BY al.created_at DESC
     LIMIT 30'
)->fetchAll();

$pageTitle = 'Admin Dashboard';
$activePage = 'admin_dashboard';
require_once __DIR__ . '/includes/header.php';
?>

<div class="app-shell">
    <?php require_once __DIR__ . '/includes/sidebar.php'; ?>

    <main class="app-main">
        <div class="page-heading">
            <div>
                <span class="badge rounded-pill badge-soft mb-2">Admin Dashboard</span>
                <h1 class="h2 mb-1">System Overview</h1>
                <p class="muted mb-0">Manage users, files, sharing links, and system activity.</p>
            </div>
        </div>

        <div class="row g-3 mb-4">
            <div class="col-md-3 col-sm-6">
                <div class="stat-card">
                    <i class="bi bi-people"></i>
                    <span class="muted d-block mt-3">Users</span>
                    <strong><?= $totalUsers ?></strong>
                </div>
            </div>
            <div class="col-md-3 col-sm-6">
                <div class="stat-card">
                    <i class="bi bi-files"></i>
                    <span class="muted d-block mt-3">Files</span>
                    <strong><?= $totalFiles ?></strong>
                </div>
            </div>
            <div class="col-md-3 col-sm-6">
                <div class="stat-card">
                    <i class="bi bi-link-45deg"></i>
                    <span class="muted d-block mt-3">Shared Links</span>
                    <strong><?= $totalLinks ?></strong>
                </div>
            </div>
            <div class="col-md-3 col-sm-6">
                <div class="stat-card">
                    <i class="bi bi-download"></i>
                    <span class="muted d-block mt-3">Downloads</span>
                    <strong><?= $totalDownloads ?></strong>
                </div>
            </div>
        </div>

        <section class="glass-card mb-4" id="users">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 mb-0">All Users</h2>
                <span class="badge badge-soft"><?= count($users) ?> accounts</span>
            </div>
            <div class="table-responsive">
                <table class="table table-dark-custom align-middle mb-0">
                    <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Files</th>
                        <th>Joined</th>
                        <th class="text-end">Action</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php foreach ($users as $user): ?>
                        <tr>
                            <td><?= e($user['name']) ?></td>
                            <td><?= e($user['email']) ?></td>
                            <td><span class="badge badge-soft"><?= e($user['role']) ?></span></td>
                            <td><?= (int)$user['file_count'] ?></td>
                            <td><?= e(date('M d, Y', strtotime($user['created_at']))) ?></td>
                            <td class="text-end">
                                <?php if ($user['role'] !== 'admin'): ?>
                                    <form method="post" class="d-inline" data-confirm="Delete this user and all of their files?">
                                        <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
                                        <input type="hidden" name="action" value="delete_user">
                                        <input type="hidden" name="user_id" value="<?= (int)$user['id'] ?>">
                                        <button class="btn btn-outline-danger btn-sm" type="submit">
                                            <i class="bi bi-trash"></i> Delete
                                        </button>
                                    </form>
                                <?php else: ?>
                                    <span class="muted">Protected</span>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </section>

        <section class="glass-card mb-4" id="files">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 mb-0">All Uploaded Files</h2>
                <span class="badge badge-soft"><?= count($files) ?> files</span>
            </div>
            <div class="table-responsive">
                <table class="table table-dark-custom align-middle mb-0">
                    <thead>
                    <tr>
                        <th>File</th>
                        <th>Owner</th>
                        <th>Size</th>
                        <th>Uploaded</th>
                        <th>Link</th>
                        <th class="text-end">Action</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php if (!$files): ?>
                        <tr>
                            <td colspan="6" class="text-center muted py-4">No files uploaded.</td>
                        </tr>
                    <?php endif; ?>
                    <?php foreach ($files as $file): ?>
                        <?php $expired = $file['expiry_date'] && strtotime($file['expiry_date']) <= time(); ?>
                        <tr>
                            <td class="text-break"><?= e($file['filename']) ?></td>
                            <td>
                                <?= e($file['owner_name']) ?><br>
                                <span class="small muted"><?= e($file['owner_email']) ?></span>
                            </td>
                            <td><?= e(formatBytes((int)$file['size'])) ?></td>
                            <td><?= e(date('M d, Y h:i A', strtotime($file['created_at']))) ?></td>
                            <td>
                                <?php if ($file['token']): ?>
                                    <?php if ($expired): ?>
                                        <span class="badge text-bg-danger">Expired</span>
                                    <?php else: ?>
                                        <a href="<?= e(secureDownloadUrl($file['token'])) ?>" target="_blank" rel="noopener">Open</a>
                                    <?php endif; ?>
                                <?php else: ?>
                                    <span class="muted">No link</span>
                                <?php endif; ?>
                            </td>
                            <td class="text-end">
                                <a class="btn btn-outline-light btn-sm" href="download.php?id=<?= (int)$file['id'] ?>">
                                    <i class="bi bi-download"></i>
                                </a>
                                <form method="post" class="d-inline" data-confirm="Delete this file permanently?">
                                    <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
                                    <input type="hidden" name="action" value="delete_file">
                                    <input type="hidden" name="file_id" value="<?= (int)$file['id'] ?>">
                                    <button class="btn btn-outline-danger btn-sm" type="submit">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </form>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </section>

        <section class="glass-card" id="activity">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 mb-0">Activity Logs</h2>
                <span class="badge badge-soft">Latest <?= count($logs) ?></span>
            </div>
            <div class="table-responsive">
                <table class="table table-dark-custom align-middle mb-0">
                    <thead>
                    <tr>
                        <th>Action</th>
                        <th>User</th>
                        <th>File</th>
                        <th>Details</th>
                        <th>IP</th>
                        <th>Date</th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php if (!$logs): ?>
                        <tr>
                            <td colspan="6" class="text-center muted py-4">No activity logged yet.</td>
                        </tr>
                    <?php endif; ?>
                    <?php foreach ($logs as $log): ?>
                        <tr>
                            <td><span class="badge badge-soft"><?= e(ucwords(str_replace('_', ' ', $log['action']))) ?></span></td>
                            <td>
                                <?= e($log['user_name'] ?? 'Deleted user') ?><br>
                                <span class="small muted"><?= e($log['user_email'] ?? '') ?></span>
                            </td>
                            <td><?= e($log['filename'] ?? 'N/A') ?></td>
                            <td class="text-break"><?= e($log['details'] ?? '') ?></td>
                            <td><?= e($log['ip_address'] ?? 'N/A') ?></td>
                            <td><?= e(date('M d, Y h:i A', strtotime($log['created_at']))) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </section>
    </main>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
