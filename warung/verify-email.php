<?php
/**
 * Email Verification Handler
 */

require_once 'config.php';

$verified = false;
$message = '';
$token = isset($_GET['token']) ? sanitizeInput($_GET['token']) : '';

if (empty($token)) {
    $message = '❌ Token verifikasi tidak ditemukan';
} else {
    try {
        $db = Database::getInstance();
        $conn = $db->getConnection();
        
        // Find user with this token
        $stmt = $conn->prepare("SELECT id, username, email FROM users WHERE email_token = ?");
        
        if ($stmt) {
            $stmt->bind_param("s", $token);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows === 1) {
                $user = $result->fetch_assoc();
                
                // Update user - mark as verified
                $update_stmt = $conn->prepare("UPDATE users SET email_verified = TRUE, email_token = NULL WHERE id = ?");
                
                if ($update_stmt) {
                    $update_stmt->bind_param("i", $user['id']);
                    
                    if ($update_stmt->execute()) {
                        $verified = true;
                        $message = '✓ Email berhasil diverifikasi! Anda sekarang bisa login.';
                    } else {
                        $message = '❌ Terjadi kesalahan saat verifikasi email';
                    }
                    $update_stmt->close();
                }
            } else {
                $message = '❌ Token verifikasi tidak valid atau sudah kadaluarsa';
            }
            $stmt->close();
        }
    } catch (Exception $e) {
        $message = '❌ Error: ' . $e->getMessage();
    }
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifikasi Email - Toko Rafilah</title>
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
            padding: 50px 40px;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }

        .icon {
            font-size: 4em;
            margin-bottom: 20px;
        }

        h1 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.8em;
        }

        p {
            color: #666;
            font-size: 1em;
            line-height: 1.6;
            margin-bottom: 30px;
        }

        .success p {
            color: #10b981;
        }

        .error p {
            color: #ef4444;
        }

        a {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.3s ease;
        }

        a:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }

        .divider {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 30px 0;
        }

        .info {
            background: #f0f4ff;
            padding: 15px;
            border-radius: 8px;
            color: #667eea;
            font-size: 0.9em;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <?php if ($verified): ?>
            <div class="success">
                <div class="icon">✓</div>
                <h1>Email Terverifikasi!</h1>
                <p><?php echo htmlspecialchars($message); ?></p>
                
                <div class="info">
                    Email akun Anda telah berhasil diverifikasi dan siap digunakan.
                </div>
                
                <a href="login.php">← Kembali ke Login</a>
            </div>
        <?php else: ?>
            <div class="error">
                <div class="icon">✗</div>
                <h1>Verifikasi Gagal</h1>
                <p><?php echo htmlspecialchars($message); ?></p>
                
                <div class="info">
                    Silakan periksa kembali link verifikasi Anda atau coba daftar akun baru.
                </div>
                
                <a href="login.php">← Kembali ke Login</a>
            </div>
        <?php endif; ?>
    </div>
</body>
</html>
