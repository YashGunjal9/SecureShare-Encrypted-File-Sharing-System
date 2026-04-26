<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

if (isLoggedIn()) {
    redirectByRole();
}

$pageTitle = 'Secure File Sharing';
$activePage = 'home';
require_once __DIR__ . '/includes/header.php';
?>

<main class="landing">
    <section class="landing-hero container">
        <div class="row align-items-center g-4">
            <div class="col-lg-7">
                <span class="badge rounded-pill badge-soft mb-3">
                    <i class="bi bi-shield-check me-1"></i> PHP, MySQL, Bootstrap
                </span>
                <h1>SecureShare</h1>
                <p class="lead-copy">
                    A dark-theme secure file sharing system with user dashboards, protected uploads, tokenized links, optional expiry, and admin monitoring.
                </p>
                <div class="d-flex flex-wrap gap-2 mt-4">
                    <a class="btn btn-primary btn-lg" href="login.php">
                        <i class="bi bi-box-arrow-in-right"></i> User Login
                    </a>
                    <a class="btn btn-outline-light btn-lg" href="register.php">
                        <i class="bi bi-person-plus"></i> Register
                    </a>
                    <a class="btn btn-outline-info btn-lg" href="admin_login.php">
                        <i class="bi bi-person-lock"></i> Admin
                    </a>
                </div>
            </div>
            <div class="col-lg-5">
                <div class="security-visual" aria-label="Secure file sharing preview">
                    <div class="visual-topbar">
                        <span></span><span></span><span></span>
                    </div>
                    <div class="visual-row">
                        <i class="bi bi-file-earmark-lock"></i>
                        <div>
                            <strong>proposal.pdf</strong>
                            <small>Encrypted path, token link</small>
                        </div>
                        <span class="visual-pill">Active</span>
                    </div>
                    <div class="visual-row">
                        <i class="bi bi-link-45deg"></i>
                        <div>
                            <strong>Secure link</strong>
                            <small>Expires in 7 days</small>
                        </div>
                        <span class="visual-pill muted-pill">Copy</span>
                    </div>
                    <div class="visual-meter">
                        <span style="width: 72%"></span>
                    </div>
                    <div class="visual-grid">
                        <div><strong>24</strong><small>Uploads</small></div>
                        <div><strong>18</strong><small>Downloads</small></div>
                        <div><strong>6</strong><small>Shared</small></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="feature-grid mt-5">
            <article class="feature-tile">
                <i class="bi bi-cloud-arrow-up"></i>
                <h2 class="h5 mt-3">Protected Uploads</h2>
                <p class="muted mb-0">Files are saved with randomized names and blocked from direct folder access.</p>
            </article>
            <article class="feature-tile">
                <i class="bi bi-link-45deg"></i>
                <h2 class="h5 mt-3">Secure Sharing</h2>
                <p class="muted mb-0">Download links use unique tokens and optional expiry dates.</p>
            </article>
            <article class="feature-tile">
                <i class="bi bi-activity"></i>
                <h2 class="h5 mt-3">Admin Monitoring</h2>
                <p class="muted mb-0">Admins can review users, files, deletes, uploads, and download activity.</p>
            </article>
        </div>
    </section>
</main>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
