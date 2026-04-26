<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

requireRole('user');

$user = currentUser();
$userId = (int)$user['id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();

    if (!isset($_FILES['shared_file']) || !is_array($_FILES['shared_file'])) {
        setFlash('danger', 'Select a file to upload.');
        redirect('upload.php');
    }

    $file = $_FILES['shared_file'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        setFlash('danger', 'Upload failed. Try again.');
        redirect('upload.php');
    }

    if (!is_uploaded_file($file['tmp_name'])) {
        setFlash('danger', 'Invalid upload request.');
        redirect('upload.php');
    }

    $size = (int)$file['size'];

    if ($size <= 0 || $size > MAX_UPLOAD_BYTES) {
        setFlash('danger', 'File size must be between 1 byte and ' . formatBytes(MAX_UPLOAD_BYTES) . '.');
        redirect('upload.php');
    }

    $originalName = sanitizeOriginalFilename((string)$file['name']);
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

    if (!in_array($extension, ALLOWED_EXTENSIONS, true)) {
        setFlash('danger', 'This file type is not allowed.');
        redirect('upload.php');
    }

    $storedName = $userId . '_' . date('YmdHis') . '_' . bin2hex(random_bytes(12)) . '.' . $extension;
    $destination = UPLOAD_DIR . DIRECTORY_SEPARATOR . $storedName;

    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        setFlash('danger', 'Could not save the uploaded file.');
        redirect('upload.php');
    }

    $relativePath = 'uploads/' . $storedName;
    $mimeType = detectMimeType($destination);

    $stmt = $pdo->prepare(
        'INSERT INTO files (user_id, filename, stored_filename, filepath, mime_type, size)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$userId, $originalName, $storedName, $relativePath, $mimeType, $size]);
    $fileId = (int)$pdo->lastInsertId();

    logActivity($pdo, $userId, $fileId, 'upload', 'Uploaded ' . $originalName);
    setFlash('success', 'File uploaded successfully.');
    redirect('files.php');
}

$pageTitle = 'Upload File';
$activePage = 'upload';
require_once __DIR__ . '/includes/header.php';
?>

<div class="app-shell">
    <?php require_once __DIR__ . '/includes/sidebar.php'; ?>

    <main class="app-main">
        <div class="page-heading">
            <div>
                <span class="badge rounded-pill badge-soft mb-2">Upload</span>
                <h1 class="h2 mb-1">Upload File</h1>
                <p class="muted mb-0">Files stay private until you generate a tokenized sharing link.</p>
            </div>
        </div>

        <section class="glass-card upload-panel">
            <form method="post" enctype="multipart/form-data">
                <input type="hidden" name="csrf_token" value="<?= e(csrfToken()) ?>">
                <div class="mb-3">
                    <label for="shared_file" class="form-label">Select file</label>
                    <input class="form-control" type="file" name="shared_file" id="shared_file" required>
                    <div class="form-text text-secondary">
                        Allowed: <?= e(implode(', ', ALLOWED_EXTENSIONS)) ?>. Maximum size: <?= e(formatBytes(MAX_UPLOAD_BYTES)) ?>.
                    </div>
                </div>
                <div class="d-flex flex-wrap gap-2">
                    <button class="btn btn-primary" type="submit">
                        <i class="bi bi-cloud-arrow-up"></i> Upload
                    </button>
                    <a class="btn btn-outline-light" href="files.php">
                        <i class="bi bi-folder2-open"></i> View Files
                    </a>
                </div>
            </form>
        </section>
    </main>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
