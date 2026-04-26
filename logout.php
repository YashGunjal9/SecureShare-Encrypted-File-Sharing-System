<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

if (isLoggedIn()) {
    $user = currentUser();
    logActivity($pdo, (int)$user['id'], null, 'logout', ucfirst($user['role']) . ' logged out');
}

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}

session_destroy();
session_start();
setFlash('success', 'You have been logged out.');
redirect('login.php');
