<?php
/**
 * Authentication Handler
 */

// Set JSON header FIRST to prevent error output corruption
header('Content-Type: application/json');

// Set error handling to prevent output before JSON response
ob_start();
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    global $response;
    
    // Don't fail on mail() errors - they're not critical
    if (strpos($errstr, 'mail()') !== false || strpos($errstr, 'mailserver') !== false) {
        error_log("Email error (non-critical): " . $errstr);
        return true; // Suppress error
    }
    
    // For other errors, return them in response
    if (empty($response['message'])) {
        $response['message'] = 'Server error: ' . $errstr;
    }
    
    return true; // Don't use PHP default error handler
});

require_once 'config.php';
require_once 'session.php';
require_once 'mailer.php';

$response = ['success' => false, 'message' => ''];

// DEBUG: Log incoming request
error_log("Auth request: action=" . ($_POST['action'] ?? $_GET['action'] ?? 'none'));

// Only initialize email service if needed (for login/signup/logout)
$emailService = null;
if (isset($_POST['action']) || isset($_GET['action'])) {
    try {
        // For now, disable email service to avoid timeout issues
        // $emailService = getEmailService();
        $emailService = null; // Temporarily disabled
    } catch (Exception $e) {
        error_log("Email error: " . $e->getMessage());
        $response['message'] = 'Email service not available';
    }
}

// ============ LOGIN ============
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'login') {
    $username = sanitizeInput($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $remember_me = isset($_POST['remember_me']) && $_POST['remember_me'] === 'on';
    
    // Validation
    if (empty($username)) {
        $response['message'] = 'Username tidak boleh kosong';
    } elseif (empty($password)) {
        $response['message'] = 'Password tidak boleh kosong';
    } else {
        try {
            $db = getDB();
            error_log("Database connection OK");
            
            $stmt = $db->prepare("SELECT id, username, email, nama_lengkap, password FROM users WHERE username = ?");
            
            if ($stmt) {
                $stmt->bind_param("s", $username);
                $stmt->execute();
                $result = $stmt->get_result();
                
                if ($result->num_rows === 1) {
                    $user = $result->fetch_assoc();
                    
                    if (password_verify($password, $user['password'])) {
                        // Login successful
                        setUserSession($user);
                        
                        // Handle remember-me device token (skip if fails)
                        if ($remember_me) {
                            try {
                                $token = createDeviceToken($user['id'], 30); // 30 days
                                if ($token) {
                                    setcookie(
                                        'device_token',
                                        $token,
                                        [
                                            'expires' => time() + (30 * 24 * 60 * 60),
                                            'path' => '/',
                                            'httponly' => true,
                                            'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
                                            'samesite' => 'Lax'
                                        ]
                                    );
                                    $_SESSION['device_token'] = $token;
                                    $response['device_token'] = $token;
                                    $response['token_expires_at'] = date('c', time() + (30 * 24 * 60 * 60));
                                }
                            } catch (Exception $e) {
                                error_log("Device token error (non-critical): " . $e->getMessage());
                            }
                        }
                        
                        // Return user data
                        $response['user'] = [
                            'id' => $user['id'],
                            'username' => $user['username'],
                            'email' => $user['email'],
                            'nama_lengkap' => $user['nama_lengkap']
                        ];
                        
                        // Update last login time (skip if fails)
                        try {
                            $update_stmt = $db->prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?");
                            if ($update_stmt) {
                                $update_stmt->bind_param("i", $user['id']);
                                $update_stmt->execute();
                                $update_stmt->close();
                            }
                        } catch (Exception $e) {
                            error_log("Update login time failed: " . $e->getMessage());
                        }
                        
                        // Email notification (completely skipped for now)
                        // if ($emailService) {
                        //     try {
                        //         $emailService->sendLoginNotification($user['id'], $user['email'], $user['username']);
                        //     } catch (Exception $e) {
                        //         error_log("Email notification failed (non-critical): " . $e->getMessage());
                        //     }
                        // }
                        
                        $response['success'] = true;
                        $response['message'] = 'Login berhasil!';
                        $response['redirect'] = 'index.php';
                    } else {
                        $response['message'] = 'Username atau password salah';
                    }
                } else {
                    $response['message'] = 'Username tidak ditemukan';
                }
                $stmt->close();
            } else {
                $response['message'] = 'Error database preparation: ' . $db->error;
            }
        } catch (Exception $e) {
            error_log("Login exception: " . $e->getMessage());
            $response['message'] = 'Terjadi kesalahan server: ' . $e->getMessage();
        }
    }
}

// ============ SIGNUP ============
elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'signup') {
    // Signup feature disabled
    $response['success'] = false;
    $response['message'] = 'Fitur pendaftaran telah dinonaktifkan. Hubungi administrator untuk membuat akun baru.';
}

// ============ VALIDATE DEVICE TOKEN (for Remember Device) ============
elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'validate_device_token') {
    $input = json_decode(file_get_contents('php://input'), true);
    $device_token = $input['device_token'] ?? '';
    $device_id = $input['device_id'] ?? '';
    
    if (empty($device_token)) {
        $response['message'] = 'Device token tidak valid';
    } else {
        $db = getDB();
        
        // Query device token
        $stmt = $db->prepare("
            SELECT dt.user_id, dt.expires_at, u.id, u.username, u.email, u.nama_lengkap
            FROM device_tokens dt
            JOIN users u ON dt.user_id = u.id
            WHERE dt.token = ? AND dt.is_active = 1 AND dt.expires_at > NOW()
            LIMIT 1
        ");
        
        if ($stmt) {
            $stmt->bind_param("s", $device_token);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows === 1) {
                $data = $result->fetch_assoc();
                $user_id = $data['user_id'];
                $user = [
                    'id' => $data['id'],
                    'username' => $data['username'],
                    'email' => $data['email'],
                    'nama_lengkap' => $data['nama_lengkap']
                ];
                
                // Set session
                $_SESSION['user_id'] = $user_id;
                $_SESSION['user'] = $user;
                $_SESSION['login_time'] = time();
                $_SESSION['device_token'] = $device_token;
                
                // Update last_used timestamp
                $update_stmt = $db->prepare("UPDATE device_tokens SET last_used = NOW() WHERE token = ?");
                if ($update_stmt) {
                    $update_stmt->bind_param("s", $device_token);
                    $update_stmt->execute();
                    $update_stmt->close();
                }
                
                $response['success'] = true;
                $response['message'] = 'Device token valid';
                $response['user'] = $user;
                $response['expires_at'] = $data['expires_at'];
            } else {
                $response['message'] = 'Device token tidak valid atau sudah expired';
            }
            $stmt->close();
        } else {
            $response['message'] = 'Error database: ' . $db->error;
        }
    }
}

// ============ LOGOUT ============
elseif (isset($_GET['action']) && $_GET['action'] === 'logout') {
    logoutUser();
}

// Clear output buffer and return JSON response
ob_end_clean();
echo json_encode($response);
?>
