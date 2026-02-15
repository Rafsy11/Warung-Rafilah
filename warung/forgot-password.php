<?php
/**
 * Forgot Password Handler
 */

require_once 'config.php';
require_once 'mailer.php';

$response = ['success' => false, 'message' => ''];

// Handle forgot password request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = sanitizeInput($_POST['email'] ?? '');
    
    if (empty($email)) {
        $response['message'] = 'Email tidak boleh kosong';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $response['message'] = 'Email tidak valid';
    } else {
        try {
            $db = Database::getInstance();
            $conn = $db->getConnection();
            
            // Find user by email
            $stmt = $conn->prepare("SELECT id, username FROM users WHERE email = ?");
            
            if ($stmt) {
                $stmt->bind_param("s", $email);
                $stmt->execute();
                $result = $stmt->get_result();
                
                if ($result->num_rows === 1) {
                    $user = $result->fetch_assoc();
                    
                    // Generate reset token
                    $reset_token = bin2hex(random_bytes(32));
                    $expires_at = date('Y-m-d H:i:s', strtotime('+1 hour'));
                    
                    // Save reset token
                    $insert_stmt = $conn->prepare("INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)");
                    
                    if ($insert_stmt) {
                        $insert_stmt->bind_param("iss", $user['id'], $reset_token, $expires_at);
                        
                        if ($insert_stmt->execute()) {
                            // Send reset email
                            $emailService = getEmailService();
                            $emailService->sendPasswordResetEmail($user['id'], $email, $user['username'], $reset_token);
                            
                            $response['success'] = true;
                            $response['message'] = '✓ Link reset password telah dikirim ke email ' . htmlspecialchars($email);
                        } else {
                            $response['message'] = 'Terjadi kesalahan saat membuat reset token';
                        }
                        $insert_stmt->close();
                    }
                } else {
                    // Don't reveal if email exists or not (security)
                    $response['success'] = true;
                    $response['message'] = '✓ Jika email terdaftar, link reset password akan dikirim. Cek email Anda.';
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
    <title>Lupa Password - Toko Rafilah</title>
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

        input[type="email"] {
            width: 100%;
            padding: 12px 14px;
            border: 1.5px solid #e5e7eb;
            border-radius: 10px;
            font-size: 0.95em;
            font-family: 'Poppins', sans-serif;
            transition: all 0.3s ease;
        }

        input[type="email"]:focus {
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

        .info-box {
            background: #f0f4ff;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 0.85em;
            color: #667eea;
            line-height: 1.5;
        }

        .info-box strong {
            display: block;
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Lupa Password?</h1>
        <p class="subtitle">Masukkan email akun Anda untuk menerima link reset password</p>

        <div class="info-box">
            <strong>📧 Cara Kerjanya:</strong>
            Kami akan mengirim link reset password ke email Anda. Link berlaku selama 1 jam.
        </div>

        <div class="alert alert-success" id="success-alert"></div>
        <div class="alert alert-error" id="error-alert"></div>

        <form id="forgot-form" onsubmit="handleForgot(event)">
            <div class="form-group">
                <label for="email">Email Akun</label>
                <input type="email" id="email" name="email" placeholder="nama@example.com" required>
            </div>

            <button type="submit" class="submit-btn" id="submit-btn">Kirim Link Reset Password</button>
        </form>

        <a href="login.php" class="back-link">← Kembali ke Login</a>
    </div>

    <script>
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

        function hideAlerts() {
            document.getElementById('success-alert').classList.remove('show');
            document.getElementById('error-alert').classList.remove('show');
        }

        async function handleForgot(e) {
            e.preventDefault();

            hideAlerts();

            const email = document.getElementById('email').value;
            const btn = document.getElementById('submit-btn');

            if (!email.trim()) {
                showAlert('error-alert', '❌ Email tidak boleh kosong', 'error');
                return;
            }

            btn.disabled = true;
            btn.textContent = '⏳ Memproses...';

            try {
                const formData = new FormData();
                formData.append('email', email);

                const response = await fetch('forgot-password.php', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.success) {
                    showAlert('success-alert', '✓ ' + data.message, 'success');
                    document.getElementById('forgot-form').reset();
                } else {
                    showAlert('error-alert', '❌ ' + data.message, 'error');
                }
            } catch (error) {
                showAlert('error-alert', '❌ Terjadi kesalahan: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Kirim Link Reset Password';
            }
        }
    </script>
</body>
</html>
