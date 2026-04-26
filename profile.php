<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

requireRole('user');

$user = currentUser();
$userId = (int)$user['id'];
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();

    $action = $_POST['action'] ?? '';

    if ($action === 'update_profile') {
        $name = trim($_POST['name'] ?? '');

        if (strlen($name) < 2 || strlen($name) > 120) {
            $errors[] = 'Name must be between 2 and 120 characters.';
        }

        if (!$errors) {
            $stmt = $pdo->prepare('UPDATE users SET name = ? WHERE id = ?');
            $stmt->execute([$name, $userId]);
            $_SESSION['user']['name'] = $name;
            logActivity($pdo, $userId, null, 'profile_update', 'Updated profile name');
            setFlash('success', 'Profile updated.');
            redirect('profile.php');
        }
    }

    if ($action === 'update_password') {
        $currentPassword = (string)($_POST['current_password'] ?? '');
        $newPassword = (string)($_POST['new_password'] ?? '');
        $confirmPassword = (string)($_POST['confirm_password'] ?? '');

        $stmt = $pdo->prepare('SELECT password FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $hash = (string)$stmt->fetchColumn();

        if (!password_verify($currentPassword, $hash)) {
            $errors[] = 'Current password is incorrect.';
        }

        if (strlen($newPassword) < 8) {
            $errors[] = 'New password must be at least 8 characters.';
        }

        if ($newPassword !== $confirmPassword) {
            $errors[] = 'New passwords do not match.';
        }

        if (!$errors) {
            $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
            $stmt->execute([$newHash, $userId]);
            logActivity($pdo, $userId, null, 'password_update', 'Updated password');
            setFlash('success', 'Password updated.');
            redirect('profile.php');
        }
    }
}

$countStmt = $pdo->prepare('SELECT COUNT(*) FROM files WHERE user_id = ?');
$countStmt->execute([$userId]);
$fileCount = (int)$countStmt->fetchColumn();

$pageTitle = 'Profile';
$activePage = 'profile';
require_once __DIR__ . '/includes/header.php';
?>

<div class="app-shell">
    <?php require_once __DIR__ . '/includes/sidebar.php'; ?>

    <main class="app-main">
        <div class="page-heading">
            <div>
                <span class="badge rounded-pill badge-soft mb-2">Profile</span>
                <h1 class="h2 mb-1">Account Settings</h1>
                <p class="muted mb-0">Manage your user profile and password.</p>
            </div>
        </div>

        <?php if ($errors): ?>
            <div class="alert alert-danger">
                <?php foreach ($errors as $error): ?>
                    <div><?= e($error) ?></div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <div class="row g-4">
            <div class="col-lg-5">
                <section class="glass-card">
                    <h2 class="h5 mb-3">User Info</h2>
                    <div class="profile-summary mb-4">
                        <div class="avatar avatar-lg"><i class="bi bi-person"></i></div>
                        <div>
                            <strong><?= e($_SESSION['user']['name']) ?></strong>
                            <p class="muted mb-0"><?= e($user['email']) ?></p>
                            <p class="muted mb-0"><?= $fileCount ?> uploaded files</p>
                        </div>
                    </div>

                    <form method="post">
                        <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
                        <input type="hidden" name="action" value="update_profile">
                        <div class="mb-3">
                            <label class="form-label" for="name">Name</label>
                            <input class="form-control" id="name" name="name" value="<?= e($_SESSION['user']['name']) ?>" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label" for="email">Email</label>
                            <input class="form-control" id="email" value="<?= e($user['email']) ?>" readonly>
                        </div>
                        <button class="btn btn-primary" type="submit">
                            <i class="bi bi-check2-circle"></i> Save Profile
                        </button>
                    </form>
                </section>
            </div>

            <div class="col-lg-7">
                <section class="glass-card">
                    <h2 class="h5 mb-3">Change Password</h2>
                    <form method="post">
                        <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
                        <input type="hidden" name="action" value="update_password">
                        <div class="mb-3">
                            <label class="form-label" for="current_password">Current Password</label>
                            <input class="form-control" type="password" id="current_password" name="current_password" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label" for="new_password">New Password</label>
                            <input class="form-control" type="password" id="new_password" name="new_password" required minlength="8">
                        </div>
                        <div class="mb-4">
                            <label class="form-label" for="confirm_password">Confirm New Password</label>
                            <input class="form-control" type="password" id="confirm_password" name="confirm_password" required minlength="8">
                        </div>
                        <button class="btn btn-primary" type="submit">
                            <i class="bi bi-key"></i> Update Password
                        </button>
                    </form>
                </section>
            </div>
        </div>
    </main>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
