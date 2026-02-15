<?php
/**
 * Session Management with Device Persistence
 */

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Check if user is logged in (session or device token)
 */
function isLoggedIn() {
    // Check session first
    if (isset($_SESSION['user_id']) && !empty($_SESSION['user_id'])) {
        return true;
    }
    
    // Check device token in cookie
    if (isset($_COOKIE['device_token']) && !empty($_COOKIE['device_token'])) {
        $token = $_COOKIE['device_token'];
        // Only try to restore if not already attempted
        if (!isset($_SESSION['device_restored'])) {
            return validateAndRestoreDeviceToken($token);
        }
        return isset($_SESSION['user_id']);
    }
    
    return false;
}

/**
 * Validate device token and restore session if valid
 */
function validateAndRestoreDeviceToken($token) {
    if (empty($token)) {
        return false;
    }
    
    try {
        $db = getDB();
        
        $stmt = $db->prepare("
            SELECT dt.user_id, dt.is_active, dt.expires_at,
                   u.id, u.username, u.email, u.nama_lengkap
            FROM device_tokens dt
            JOIN users u ON dt.user_id = u.id
            WHERE dt.token = ? AND dt.is_active = TRUE
            AND IFNULL(dt.expires_at > NOW(), TRUE)
            LIMIT 1
        ");
        
        if (!$stmt) {
            return false;
        }
        
        $stmt->bind_param("s", $token);
        
        if (!$stmt->execute()) {
            $stmt->close();
            return false;
        }
        
        $result = $stmt->get_result();
        
        if ($result && $result->num_rows === 1) {
            $user = $result->fetch_assoc();
            
            // Restore session
            setUserSession($user);
            $_SESSION['device_token'] = $token;
            $_SESSION['device_restored'] = true;
            
            // Update last used timestamp
            $update_stmt = $db->prepare("UPDATE device_tokens SET last_used = NOW() WHERE token = ?");
            if ($update_stmt) {
                $update_stmt->bind_param("s", $token);
                $update_stmt->execute();
                $update_stmt->close();
            }
            
            $stmt->close();
            return true;
        }
        
        $stmt->close();
    } catch (Exception $e) {
        // Silently fail - will redirect to login
        error_log("Device token validation error: " . $e->getMessage());
    }
    
    return false;
}

/**
 * Get current user
 */
function getCurrentUser() {
    if (!isLoggedIn()) {
        return null;
    }
    
    return [
        'id' => $_SESSION['user_id'],
        'username' => $_SESSION['username'] ?? '',
        'email' => $_SESSION['email'] ?? '',
        'nama_lengkap' => $_SESSION['nama_lengkap'] ?? ''
    ];
}

/**
 * Require login - redirect to login if not authenticated
 */
function requireLogin() {
    if (!isLoggedIn()) {
        header('Location: login.php');
        exit;
    }
}

/**
 * Set user session
 */
function setUserSession($user) {
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['nama_lengkap'] = $user['nama_lengkap'];
}

/**
 * Create device token for remember-me functionality
 */
function createDeviceToken($user_id, $remember_days = 30) {
    try {
        $db = getDB();
        
        // Generate secure token
        $token = bin2hex(random_bytes(32));
        
        // Get device info
        $device_ua = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
        $ip_address = getClientIP();
        $device_name = getDeviceName($device_ua);
        
        // Set expiration
        $expires_at = date('Y-m-d H:i:s', time() + ($remember_days * 24 * 60 * 60));
        
        // Insert token
        $stmt = $db->prepare("
            INSERT INTO device_tokens (user_id, token, device_name, device_ua, ip_address, expires_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, TRUE)
        ");
        
        if (!$stmt) {
            return null;
        }
        
        // Bind parameters with proper types: i=int, s=string
        $stmt->bind_param("isssss", $user_id, $token, $device_name, $device_ua, $ip_address, $expires_at);
        
        if ($stmt->execute()) {
            $stmt->close();
            return $token;
        }
        
        $stmt->close();
    } catch (Exception $e) {
        error_log("Error creating device token: " . $e->getMessage());
    }
    
    return null;
}

/**
 * Get device name from user agent
 */
function getDeviceName($user_agent) {
    $device_name = 'Unknown Device';
    
    if (preg_match('/(iPhone|iPad)/i', $user_agent)) {
        $device_name = 'Apple Device';
    } elseif (preg_match('/(Android)/i', $user_agent)) {
        $device_name = 'Android Device';
    } elseif (preg_match('/(Windows)/i', $user_agent)) {
        $device_name = 'Windows';
    } elseif (preg_match('/(Macintosh)/i', $user_agent)) {
        $device_name = 'Mac';
    } elseif (preg_match('/(Linux)/i', $user_agent)) {
        $device_name = 'Linux';
    }
    
    return $device_name;
}

/**
 * Get client IP address
 */
function getClientIP() {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        if (array_key_exists($key, $_SERVER) === true) {
            foreach (explode(',', $_SERVER[$key]) as $ip) {
                $ip = trim($ip);
                if (filter_var($ip, FILTER_VALIDATE_IP,
                    FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false) {
                    return $ip;
                }
            }
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
}

/**
 * Logout user with device token cleanup
 */
function logoutUser() {
    // Remove device token if exists
    if (isset($_COOKIE['device_token'])) {
        try {
            $db = Database::getInstance();
            $conn = $db->getConnection();
            
            $stmt = $conn->prepare("UPDATE device_tokens SET is_active = FALSE WHERE token = ?");
            if ($stmt) {
                $stmt->bind_param("s", $_COOKIE['device_token']);
                $stmt->execute();
                $stmt->close();
            }
        } catch (Exception $e) {
            // Silently fail
        }
        
        // Remove cookie
        setcookie('device_token', '', time() - 3600, '/', '', false, true);
        unset($_COOKIE['device_token']);
    }
    
    // Destroy session
    session_destroy();
    setcookie('PHPSESSID', '', time() - 3600, '/');
    
    header('Location: login.php');
    exit;
}

?>
