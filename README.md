# SecureShare - Secure File Sharing System

SecureShare is a beginner-friendly full-stack PHP/MySQL project for secure file uploads, authenticated downloads, role-based admin access, and tokenized sharing links with optional expiration.

## Tech Stack

- Frontend: HTML, CSS, Bootstrap 5, JavaScript
- Backend: PHP with PDO
- Database: MySQL
- Local server: XAMPP

## Folder Structure

```text
SecureShare/
|-- .htaccess
|-- README.md
|-- database.sql
|-- index.php
|-- register.php
|-- login.php
|-- admin_login.php
|-- dashboard.php
|-- user_dashboard.php
|-- upload.php
|-- files.php
|-- profile.php
|-- admin_dashboard.php
|-- download.php
|-- qr.php
|-- logout.php
|-- assets/
|   |-- css/
|   |   `-- style.css
|   `-- js/
|       `-- app.js
|-- includes/
|   |-- .htaccess
|   |-- config.php
|   |-- functions.php
|   |-- header.php
|   |-- sidebar.php
|   |-- footer.php
|   `-- qr_generator.php
`-- uploads/
    |-- .htaccess
    `-- index.html
```

## Database Tables

- `users`: registered users and admins with bcrypt password hashes
- `files`: uploaded file records with original filename, protected path, size, MIME type, and upload date
- `shared_links`: one secure token per shared file with optional `expiry_date`
- `activity_logs`: basic upload, download, login, delete, and sharing activity

## XAMPP Setup

1. Copy this project folder into:

   ```text
   C:\xampp\htdocs\SecureShare
   ```

2. Start Apache and MySQL from the XAMPP Control Panel.

3. Open phpMyAdmin:

   ```text
   http://localhost/phpmyadmin
   ```

4. Import `database.sql`.

5. Check `includes/config.php`. The default XAMPP settings are already configured:

   ```php
   DB_HOST = localhost
   DB_NAME = secure_file_share
   DB_USER = root
   DB_PASS = empty password
   ```

6. Open the project:

   ```text
   http://localhost/SecureShare
   ```

## Default Admin Login

- URL: `http://localhost/SecureShare/admin_login.php`
- Email: `admin@secureshare.local`
- Password: `Admin@12345`

Change the default admin password after first login.

## User Flow

1. Register a user account at `register.php`.
2. Log in at `login.php`.
3. Upload files from `upload.php`.
4. Manage files from `files.php`.
5. Generate a secure link with no expiry, 1 day, 7 days, or 30 days.
6. Download through `download.php`; direct access to `/uploads` is blocked.

## Security Features

- Passwords use PHP `password_hash(..., PASSWORD_BCRYPT)` and `password_verify()`.
- SQL queries use PDO prepared statements.
- Sessions use strict mode, HTTP-only cookies, and SameSite=Lax.
- Forms include CSRF tokens.
- Uploaded file extensions and sizes are validated.
- Stored filenames are randomized.
- `/uploads` and `/includes` are protected by `.htaccess`.
- Shared links use random 64-character tokens and optional expiry dates.
- Admin actions and downloads are recorded in `activity_logs`.
