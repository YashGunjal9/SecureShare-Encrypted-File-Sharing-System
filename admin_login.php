<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

if (isLoggedIn()) {
    redirectByRole();
}

$errors = [];
$email = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();

    $email = trim($_POST['email'] ?? '');
    $password = (string)($_POST['password'] ?? '');

    if (!validateEmail($email)) {
        $errors[] = 'Enter a valid admin email address.';
    }

    if ($password === '') {
        $errors[] = 'Password is required.';
    }

    if (!$errors) {
        $stmt = $pdo->prepare("SELECT id, name, email, password, role FROM users WHERE email = ? AND role = 'admin' LIMIT 1");
        $stmt->execute([$email]);
        $admin = $stmt->fetch();

        if ($admin && password_verify($password, $admin['password'])) {
            session_regenerate_id(true);
            $_SESSION['user'] = [
                'id' => (int)$admin['id'],
                'name' => $admin['name'],
                'email' => $admin['email'],
                'role' => $admin['role'],
            ];

            logActivity($pdo, (int)$admin['id'], null, 'admin_login', 'Admin logged in');
            setFlash('success', 'Admin session started.');
            redirect('admin_dashboard.php');
        }

        $errors[] = 'Invalid admin email or password.';
    }
}

$pageTitle = 'Admin Login';
require_once __DIR__ . '/includes/header.php';
?>

<main class="auth-wrap">
    <section class="auth-card">
        <div class="text-center mb-4">
            <div class="brand-icon mx-auto mb-3"><i class="bi bi-person-lock"></i></div>
            <h1 class="h3 mb-1">Admin Login</h1>
            <p class="muted mb-0">Use the administrator account to manage users, files, and logs.</p>
        </div>

        <?php if ($errors): ?>
            <div class="alert alert-danger">
                <?php foreach ($errors as $error): ?>
                    <div><?= e($error) ?></div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <form method="post" novalidate>
            <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
            <div class="mb-3">
                <label for="email" class="form-label">Admin Email</label>
                <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-envelope-lock"></i></span>
                    <input class="form-control" type="email" id="email" name="email" value="<?= e($email) ?>" required autofocus>
                </div>
            </div>
            <div class="mb-3">
                <label for="password" class="form-label">Password</label>
                <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-key"></i></span>
                    <input class="form-control" type="password" id="password" name="password" required>
                </div>
            </div>
            <button class="btn btn-primary w-100" type="submit">
                <i class="bi bi-shield-check"></i> Login as Admin
            </button>
        </form>

        <p class="small muted text-center mt-4 mb-0">
            Default admin: admin@secureshare.local / Admin@12345
        </p>
    </section>
</main>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
