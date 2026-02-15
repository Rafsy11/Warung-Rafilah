<?php
/**
 * Reset Password Handler
 */

require_once 'config.php';

$token = isset($_GET['token']) ? sanitizeInput($_GET['token']) : '';
$token_valid = false;
$error_message = '';

if (!empty($token)) {
    try {
        $db = Database::getInstance();
        $conn = $db->getConnection();
        
        // Check if token is valid and not expired
        $stmt = $conn->prepare("SELECT id, user_id, expires_at FROM password_resets WHERE token = ? AND expires_at > NOW()");
        
        if ($stmt) {
            $stmt->bind_param("s", $token);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows === 1) {
                $token_valid = true;
            } else {
                $error_message = 'Token reset password tidak valid atau sudah kadaluarsa';
            }
            $stmt->close();
        }
    } catch (Exception $e) {
        $error_message = 'Error: ' . $e->getMessage();
    }
}

// Handle password reset submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = sanitizeInput($_POST['token'] ?? '');
    $password = $_POST['password'] ?? '';
    $password_confirm = $_POST['password_confirm'] ?? '';
    
    $response = ['success' => false, 'message' => ''];
    
    if (empty($password)) {
        $response['message'] = 'Password tidak boleh kosong';
    } elseif (strlen($password) < 6) {
        $response['message'] = 'Password minimal 6 karakter';
    } elseif ($password !== $password_confirm) {
        $response['message'] = 'Password tidak cocok';
    } else {
        try {
            $db = Database::getInstance();
            $conn = $db->getConnection();
            
            // Get reset record
            $stmt = $conn->prepare("SELECT user_id FROM password_resets WHERE token = ? AND expires_at > NOW()");
            
            if ($stmt) {
                $stmt->bind_param("s", $token);
                $stmt->execute();
                $result = $stmt->get_result();
                
                if ($result->num_rows === 1) {
                    $reset_record = $result->fetch_assoc();
                    $user_id = $reset_record['user_id'];
                    
                    // Hash new password
                    $hashed_password = password_hash($password, PASSWORD_BCRYPT);
                    
                    // Update user password
                    $update_stmt = $conn->prepare("UPDATE users SET password = ? WHERE id = ?");
                    
                    if ($update_stmt) {
                        $update_stmt->bind_param("si", $hashed_password, $user_id);
                        
                        if ($update_stmt->execute()) {
                            // Delete used reset token
                            $delete_stmt = $conn->prepare("DELETE FROM password_resets WHERE token = ?");
                            if ($delete_stmt) {
                                $delete_stmt->bind_param("s", $token);
                                $delete_stmt->execute();
                                $delete_stmt->close();
                            }
                            
                            $response['success'] = true;
                            $response['message'] = 'Password berhasil diperbarui! Silakan login dengan password baru';
                        } else {
                            $response['message'] = 'Terjadi kesalahan saat memperbarui password';
                        }
                        $update_stmt->close();
                    }
                } else {
                    $response['message'] = 'Token tidak valid atau sudah kadaluarsa';
                }
                $stmt->close();
            }
        } catch (Exception $e) {
            $response['message'] = 'Error: ' . $e->getMessage();
        }
    }
    
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - Toko Rafilah</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Poppins', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 450px;
            width: 100%;
        }

        h1 {
            color: #667eea;
            margin-bottom: 10px;
            text-align: center;
            font-size: 1.8em;
        }

        .subtitle {
            color: #666;
            text-align: center;
            margin-bottom: 30px;
            font-size: 0.95em;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            font-size: 0.9em;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
        }

        input {
            width: 100%;
            padding: 12px 14px;
            border: 1.5px solid #e5e7eb;
            border-radius: 10px;
            font-size: 0.95em;
            font-family: 'Poppins', sans-serif;
            transition: all 0.3s ease;
        }

        input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .alert {
            padding: 12px 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-size: 0.9em;
            display: none;
            animation: slideDown 0.3s ease;
        }

        .alert.show {
            display: block;
        }

        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .alert-success {
            background: #d1f2eb;
            color: #065f46;
            border-left: 4px solid #10b981;
        }

        .alert-error {
            background: #fee2e2;
            color: #991b1b;
            border-left: 4px solid #ef4444;
        }

        .alert-warning {
            background: #fef3c7;
            color: #92400e;
            border-left: 4px solid #f59e0b;
        }

        .submit-btn {
            width: 100%;
            padding: 13px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 0.95em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: 'Poppins', sans-serif;
            margin-top: 10px;
        }

        .submit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }

        .submit-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }

        .back-link {
            display: block;
            text-align: center;
            margin-top: 20px;
            color: #667eea;
            text-decoration: none;
            font-size: 0.9em;
            font-weight: 600;
        }

        .back-link:hover {
            text-decoration: underline;
        }

        .password-strength {
            font-size: 0.85em;
            margin-top: 5px;
            padding: 8px;
            border-radius: 5px;
            display: none;
        }

        .password-strength.show {
            display: block;
        }

        .strength-weak {
            background: #fee2e2;
            color: #991b1b;
        }

        .strength-medium {
            background: #fef3c7;
            color: #92400e;
        }

        .strength-strong {
            background: #d1f2eb;
            color: #065f46;
        }
    </style>
</head>
<body>
    <div class="container">
        <?php if (!$token_valid && !empty($token)): ?>
            <div class="alert alert-warning show">
                <strong>❌ Token Tidak Valid</strong><br>
                <?php echo htmlspecialchars($error_message); ?>
            </div>
            <a href="forgot-password.php" class="back-link">← Minta Link Reset Password Baru</a>
        <?php elseif (!$token_valid && empty($token)): ?>
            <div class="alert alert-warning show">
                <strong>❌ Token Hilang</strong><br>
                Silakan gunakan link reset password yang dikirim ke email Anda.
            </div>
            <a href="forgot-password.php" class="back-link">← Minta Link Reset Password</a>
        <?php else: ?>
            <h1>🔑 Reset Password</h1>
            <p class="subtitle">Masukkan password baru untuk akun Anda</p>

            <div class="alert alert-success" id="success-alert"></div>
            <div class="alert alert-error" id="error-alert"></div>

            <form id="reset-form" onsubmit="handleReset(event)">
                <input type="hidden" id="token" value="<?php echo htmlspecialchars($token); ?>">

                <div class="form-group">
                    <label for="password">Password Baru</label>
                    <input type="password" id="password" name="password" placeholder="Minimal 6 karakter" required>
                    <div class="password-strength" id="strength-indicator"></div>
                </div>

                <div class="form-group">
                    <label for="password_confirm">Konfirmasi Password</label>
                    <input type="password" id="password_confirm" name="password_confirm" placeholder="Ulangi password" required>
                </div>

                <button type="submit" class="submit-btn" id="submit-btn">Reset Password</button>
            </form>

            <a href="login.php" class="back-link">← Kembali ke Login</a>
        <?php endif; ?>
    </div>

    <script>
        // Password strength indicator
        document.getElementById('password').addEventListener('input', function() {
            const password = this.value;
            const indicator = document.getElementById('strength-indicator');

            if (password.length === 0) {
                indicator.classList.remove('show');
                return;
            }

            indicator.classList.add('show');

            if (password.length < 6) {
                indicator.className = 'password-strength show strength-weak';
                indicator.textContent = '⚠️ Password terlalu pendek';
            } else if (password.length < 12 && !/[^a-zA-Z0-9]/.test(password)) {
                indicator.className = 'password-strength show strength-medium';
                indicator.textContent = '⚡ Password cukup kuat (tambah karakter khusus untuk lebih kuat)';
            } else {
                indicator.className = 'password-strength show strength-strong';
                indicator.textContent = '✓ Password kuat';
            }
        });

        function showAlert(element, message, type) {
            const alert = document.getElementById(element);
            alert.textContent = message;
            alert.classList.add('show');
            if (type === 'success') {
                alert.classList.remove('alert-error');
                alert.classList.add('alert-success');
            } else {
                alert.classList.remove('alert-success');
                alert.classList.add('alert-error');
            }
        }

        async function handleReset(e) {
            e.preventDefault();

            const token = document.getElementById('token').value;
            const password = document.getElementById('password').value;
            const passwordConfirm = document.getElementById('password_confirm').value;
            const btn = document.getElementById('submit-btn');

            document.getElementById('success-alert').classList.remove('show');
            document.getElementById('error-alert').classList.remove('show');

            // Validate
            if (!password.trim()) {
                showAlert('error-alert', '❌ Password tidak boleh kosong', 'error');
                return;
            }
            if (password.length < 6) {
                showAlert('error-alert', '❌ Password minimal 6 karakter', 'error');
                return;
            }
            if (password !== passwordConfirm) {
                showAlert('error-alert', '❌ Password tidak cocok', 'error');
                return;
            }

            btn.disabled = true;
            btn.textContent = '⏳ Memperbarui Password...';

            try {
                const formData = new FormData();
                formData.append('token', token);
                formData.append('password', password);
                formData.append('password_confirm', passwordConfirm);

                const response = await fetch('reset-password.php', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.success) {
                    showAlert('success-alert', '✓ ' + data.message, 'success');
                    setTimeout(() => {
                        window.location.href = 'login.php';
                    }, 2000);
                } else {
                    showAlert('error-alert', '❌ ' + data.message, 'error');
                }
            } catch (error) {
                showAlert('error-alert', '❌ Terjadi kesalahan: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Reset Password';
            }
        }
    </script>
</body>
</html>
