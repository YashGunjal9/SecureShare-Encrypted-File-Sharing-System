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
        $errors[] = 'Enter a valid email address.';
    }

    if ($password === '') {
        $errors[] = 'Password is required.';
    }

    if (!$errors) {
        $stmt = $pdo->prepare("SELECT id, name, email, password, role FROM users WHERE email = ? AND role = 'user' LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password'])) {
            session_regenerate_id(true);
            $_SESSION['user'] = [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
            ];

            logActivity($pdo, (int)$user['id'], null, 'login', 'User logged in');
            setFlash('success', 'Welcome back, ' . $user['name'] . '.');
            redirect('dashboard.php');
        }

        $errors[] = 'Invalid user email or password.';
    }
}

$pageTitle = 'User Login';
require_once __DIR__ . '/includes/header.php';
?>

<main class="auth-wrap">
    <section class="auth-card">
        <div class="text-center mb-4">
            <div class="brand-icon mx-auto mb-3"><i class="bi bi-shield-lock"></i></div>
            <h1 class="h3 mb-1">User Login</h1>
            <p class="muted mb-0">Access your secure file workspace.</p>
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
                <label for="email" class="form-label">Email</label>
                <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-envelope"></i></span>
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
                <i class="bi bi-box-arrow-in-right"></i> Login
            </button>
        </form>

        <div class="auth-links">
            <a href="register.php">Create user account</a>
            <a href="admin_login.php">Admin login</a>
        </div>
    </section>
</main>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
