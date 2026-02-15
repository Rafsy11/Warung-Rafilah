<?php
/**
 * Email Service Handler
 * Handles all email operations
 */

class EmailService {
    private $conn;
    private $from_email = 'noreply@tokorafilah.local';
    private $from_name = 'Toko Rafilah';
    
    public function __construct($db_connection) {
        $this->conn = $db_connection;
    }
    
    /**
     * Send email via PHP mail() - configured to use MailHog for testing
     */
    public function send($to_email, $subject, $body, $user_id = null, $email_type = 'general') {
        // Prepare headers
        $headers = "MIME-Version: 1.0\r\n";
        $headers .= "Content-type: text/html; charset=UTF-8\r\n";
        $headers .= "From: {$this->from_name} <{$this->from_email}>\r\n";
        
        // Send via PHP mail() - uses SMTP configured in php.ini
        // For local development with MailHog: php.ini SMTP=localhost:1025
        // For production: Configure real SMTP or use PHPMailer
        // Suppress warnings with @ operator
        $sent = false;
        try {
            // Try to send email, suppress any warnings/errors
            $sent = @mail($to_email, $subject, $body, $headers);
        } catch (Exception $e) {
            // email sending failed, but don't crash the app
            error_log("Mail error: " . $e->getMessage());
            $sent = false;
        }
        
        // Log to database regardless of success/failure
        $status = $sent ? 'sent' : 'failed';
        $this->logEmail($user_id, $email_type, $to_email, $subject, $status);
        
        return $sent;
    }
    
    /**
     * Send email verification link
     */
    public function sendVerificationEmail($user_id, $email, $username, $token) {
        $verification_link = "http://{$_SERVER['HTTP_HOST']}/tes_web/verify-email.php?token=" . urlencode($token);
        
        $subject = "Verifikasi Email - Toko Rafilah";
        
        $body = "
        <html>
        <body style='font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;'>
            <div style='max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                <h2 style='color: #667eea; margin-bottom: 20px;'>🏪 Verifikasi Email Anda</h2>
                
                <p>Halo <strong>{$username}</strong>,</p>
                
                <p>Terima kasih telah mendaftar di Toko Rafilah! Silakan verifikasi email Anda dengan mengklik tombol di bawah ini:</p>
                
                <div style='text-align: center; margin: 30px 0;'>
                    <a href='{$verification_link}' style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;'>
                        ✓ Verifikasi Email
                    </a>
                </div>
                
                <p>Atau copy link ini di browser Anda:</p>
                <p style='word-break: break-all; background: #f0f4ff; padding: 10px; border-radius: 5px;'>{$verification_link}</p>
                
                <p style='color: #666; font-size: 12px; margin-top: 20px;'>Link ini berlaku selama 24 jam.</p>
                
                <hr style='border: none; border-top: 1px solid #ddd; margin: 20px 0;'>
                
                <p style='color: #999; font-size: 12px;'>
                    © 2026 Toko Rafilah. All rights reserved.<br>
                    Jangan share email ini ke orang lain.
                </p>
            </div>
        </body>
        </html>
        ";
        
        return $this->send($email, $subject, $body, $user_id, 'verification');
    }
    
    /**
     * Send password reset link
     */
    public function sendPasswordResetEmail($user_id, $email, $username, $token) {
        $reset_link = "http://{$_SERVER['HTTP_HOST']}/tes_web/reset-password.php?token=" . urlencode($token);
        
        $subject = "Reset Password - Toko Rafilah";
        
        $body = "
        <html>
        <body style='font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;'>
            <div style='max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                <h2 style='color: #667eea; margin-bottom: 20px;'>🔐 Reset Password</h2>
                
                <p>Halo <strong>{$username}</strong>,</p>
                
                <p>Kami menerima permintaan untuk reset password akun Anda. Klik tombol di bawah untuk membuat password baru:</p>
                
                <div style='text-align: center; margin: 30px 0;'>
                    <a href='{$reset_link}' style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;'>
                        🔑 Reset Password
                    </a>
                </div>
                
                <p>Atau copy link ini di browser Anda:</p>
                <p style='word-break: break-all; background: #f0f4ff; padding: 10px; border-radius: 5px;'>{$reset_link}</p>
                
                <p style='color: #ef4444; font-size: 12px; margin-top: 20px;'>⚠️ Link ini berlaku selama 1 jam dan hanya bisa digunakan sekali.</p>
                
                <p style='color: #666; margin-top: 20px;'>Jika Anda tidak meminta reset password, abaikan email ini.</p>
                
                <hr style='border: none; border-top: 1px solid #ddd; margin: 20px 0;'>
                
                <p style='color: #999; font-size: 12px;'>
                    © 2026 Toko Rafilah. All rights reserved.<br>
                    Jangan share email ini ke orang lain.
                </p>
            </div>
        </body>
        </html>
        ";
        
        return $this->send($email, $subject, $body, $user_id, 'password_reset');
    }
    
    /**
     * Send login notification
     */
    public function sendLoginNotification($user_id, $email, $username) {
        $subject = "Login Baru - Toko Rafilah";
        
        $ip_address = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
        $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
        $timestamp = date('d/m/Y H:i:s');
        
        $body = "
        <html>
        <body style='font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;'>
            <div style='max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                <h2 style='color: #667eea; margin-bottom: 20px;'>📍 Login dari Perangkat Baru</h2>
                
                <p>Halo <strong>{$username}</strong>,</p>
                
                <p>Akun Anda baru saja login dari perangkat baru. Berikut detail loginnya:</p>
                
                <div style='background: #f0f4ff; padding: 15px; border-radius: 5px; margin: 20px 0;'>
                    <p><strong>📅 Waktu:</strong> {$timestamp}</p>
                    <p><strong>🌐 IP Address:</strong> {$ip_address}</p>
                    <p><strong>💻 Perangkat:</strong> {$user_agent}</p>
                </div>
                
                <p style='color: #666;'>Jika ini bukan Anda, segera ubah password akun Anda.</p>
                
                <hr style='border: none; border-top: 1px solid #ddd; margin: 20px 0;'>
                
                <p style='color: #999; font-size: 12px;'>
                    © 2026 Toko Rafilah. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        ";
        
        return $this->send($email, $subject, $body, $user_id, 'login_notification');
    }
    
    /**
     * Send monthly activity summary
     */
    public function sendActivitySummary($user_id, $email, $username, $summary_data) {
        $subject = "Ringkasan Aktivitas Bulanan - Toko Rafilah";
        
        $body = "
        <html>
        <body style='font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;'>
            <div style='max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                <h2 style='color: #667eea; margin-bottom: 20px;'>📊 Ringkasan Aktivitas Bulanan</h2>
                
                <p>Halo <strong>{$username}</strong>,</p>
                
                <p>Berikut ringkasan aktivitas akun Anda bulan ini:</p>
                
                <div style='background: #f0f4ff; padding: 15px; border-radius: 5px; margin: 20px 0;'>
                    <p><strong>🔑 Login Terakhir:</strong> {$summary_data['last_login']}</p>
                    <p><strong>🔍 Total Login:</strong> {$summary_data['total_logins']}</p>
                    <p><strong>📅 Bulan:</strong> " . date('F Y') . "</p>
                </div>
                
                <p>Terima kasih telah menggunakan Toko Rafilah!</p>
                
                <hr style='border: none; border-top: 1px solid #ddd; margin: 20px 0;'>
                
                <p style='color: #999; font-size: 12px;'>
                    © 2026 Toko Rafilah. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        ";
        
        return $this->send($email, $subject, $body, $user_id, 'activity_summary');
    }
    
    /**
     * Log email to database
     */
    private function logEmail($user_id, $email_type, $recipient, $subject, $status = 'sent') {
        $stmt = $this->conn->prepare("INSERT INTO email_logs (user_id, email_type, recipient, subject, status) VALUES (?, ?, ?, ?, ?)");
        
        if ($stmt) {
            $stmt->bind_param("issss", $user_id, $email_type, $recipient, $subject, $status);
            $stmt->execute();
            $stmt->close();
        }
    }
    
    /**
     * Add notification to notification log
     */
    public function addNotification($user_id, $type, $title, $content) {
        $stmt = $this->conn->prepare("INSERT INTO email_notifications (user_id, notification_type, title, content) VALUES (?, ?, ?, ?)");
        
        if ($stmt) {
            $stmt->bind_param("isss", $user_id, $type, $title, $content);
            $stmt->execute();
            $stmt->close();
            return true;
        }
        return false;
    }
    
    /**
     * Get unread notifications
     */
    public function getNotifications($user_id) {
        $stmt = $this->conn->prepare("SELECT * FROM email_notifications WHERE user_id = ? ORDER BY created_at DESC");
        
        if ($stmt) {
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $notifications = $result->fetch_all(MYSQLI_ASSOC);
            $stmt->close();
            return $notifications;
        }
        return [];
    }
}

/**
 * Helper function untuk akses email service
 */
function getEmailService() {
    require_once 'config.php';
    $db = Database::getInstance()->getConnection();
    return new EmailService($db);
}

?>
