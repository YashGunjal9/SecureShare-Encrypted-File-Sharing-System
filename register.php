<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

if (isLoggedIn()) {
    redirectByRole();
}

$errors = [];
$name = '';
$email = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();

    $name = trim($_POST['name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = (string)($_POST['password'] ?? '');
    $confirmPassword = (string)($_POST['confirm_password'] ?? '');

    if (strlen($name) < 2 || strlen($name) > 120) {
        $errors[] = 'Name must be between 2 and 120 characters.';
    }

    if (!validateEmail($email)) {
        $errors[] = 'Enter a valid email address.';
    }

    if (strlen($password) < 8) {
        $errors[] = 'Password must be at least 8 characters.';
    }

    if ($password !== $confirmPassword) {
        $errors[] = 'Passwords do not match.';
    }

    if (!$errors) {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email = ?');
        $stmt->execute([$email]);

        if ((int)$stmt->fetchColumn() > 0) {
            $errors[] = 'That email is already registered.';
        }
    }

    if (!$errors) {
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
        $stmt->execute([$name, $email, $hash, 'user']);
        $userId = (int)$pdo->lastInsertId();

        logActivity($pdo, $userId, null, 'register', 'User account created');
        setFlash('success', 'Account created. You can log in now.');
        redirect('login.php');
    }
}

$pageTitle = 'Register';
require_once __DIR__ . '/includes/header.php';
?>

<main class="auth-wrap">
    <section class="auth-card">
        <div class="text-center mb-4">
            <div class="brand-icon mx-auto mb-3"><i class="bi bi-person-plus"></i></div>
            <h1 class="h3 mb-1">Create Account</h1>
            <p class="muted mb-0">Register as a user to upload and share files.</p>
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
                <label for="name" class="form-label">Name</label>
                <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-person"></i></span>
                    <input class="form-control" type="text" id="name" name="name" value="<?= e($name) ?>" required>
                </div>
            </div>
            <div class="mb-3">
                <label for="email" class="form-label">Email</label>
                <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-envelope"></i></span>
                    <input class="form-control" type="email" id="email" name="email" value="<?= e($email) ?>" required>
                </div>
            </div>
            <div class="mb-3">
                <label for="password" class="form-label">Password</label>
                <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-key"></i></span>
                    <input class="form-control" type="password" id="password" name="password" required minlength="8">
                </div>
            </div>
            <div class="mb-4">
                <label for="confirm_password" class="form-label">Confirm Password</label>
                <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-key-fill"></i></span>
                    <input class="form-control" type="password" id="confirm_password" name="confirm_password" required minlength="8">
                </div>
            </div>
            <button class="btn btn-primary w-100" type="submit">
                <i class="bi bi-person-check"></i> Register
            </button>
        </form>

        <div class="auth-links">
            <a href="login.php">Already have an account?</a>
            <a href="admin_login.php">Admin login</a>
        </div>
    </section>
</main>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
