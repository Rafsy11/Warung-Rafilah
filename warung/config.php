<?php
// Error handling for development
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors as HTML (breaks JSON)
ini_set('log_errors', 1);
ini_set('error_log', dirname(__FILE__) . '/error.log');

// ============== CONFIG ==============
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'toko_rafilah');

// ============== DATABASE CLASS ==============
class Database {
    private $conn;
    private static $instance = null;

    private function __construct() {
        $this->connect();
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    private function connect() {
        $this->conn = new mysqli(DB_HOST, DB_USER, DB_PASS);
        
        if ($this->conn->connect_error) {
            throw new Exception("Connection failed: " . $this->conn->connect_error);
        }

        // Create database
        $this->conn->query("CREATE DATABASE IF NOT EXISTS " . DB_NAME);
        $this->conn->select_db(DB_NAME);
        $this->conn->set_charset("utf8mb4");
        
        $this->initializeTables();
    }

    private function initializeTables() {
        $tables = [
            "CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                nama_lengkap VARCHAR(100) NOT NULL,
                email_verified BOOLEAN DEFAULT TRUE,
                email_token VARCHAR(255),
                last_login TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            
            "CREATE TABLE IF NOT EXISTS password_resets (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX (token)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            
            "CREATE TABLE IF NOT EXISTS email_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                email_type VARCHAR(50) NOT NULL,
                recipient VARCHAR(100) NOT NULL,
                subject VARCHAR(255),
                status VARCHAR(20) DEFAULT 'sent',
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX (user_id, email_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            
            "CREATE TABLE IF NOT EXISTS email_notifications (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                notification_type VARCHAR(50) NOT NULL,
                title VARCHAR(255),
                content TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX (user_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            
            "CREATE TABLE IF NOT EXISTS produk (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nama VARCHAR(100) NOT NULL UNIQUE,
                harga_beli DECIMAL(12, 2) NOT NULL,
                harga_jual DECIMAL(12, 2) NOT NULL,
                stok INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            
            "CREATE TABLE IF NOT EXISTS stok_masuk (
                id INT PRIMARY KEY AUTO_INCREMENT,
                produk_id INT NOT NULL,
                jumlah INT NOT NULL,
                harga_satuan DECIMAL(12, 2) NOT NULL,
                total_harga DECIMAL(12, 2) NOT NULL,
                tanggal TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (produk_id) REFERENCES produk(id) ON DELETE CASCADE,
                INDEX (tanggal)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            
            "CREATE TABLE IF NOT EXISTS stok_keluar (
                id INT PRIMARY KEY AUTO_INCREMENT,
                produk_id INT NOT NULL,
                jumlah INT NOT NULL,
                harga_satuan DECIMAL(12, 2) NOT NULL,
                total_harga DECIMAL(12, 2) NOT NULL,
                tanggal TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (produk_id) REFERENCES produk(id) ON DELETE CASCADE,
                INDEX (tanggal)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            
            "CREATE TABLE IF NOT EXISTS pengeluaran (
                id INT PRIMARY KEY AUTO_INCREMENT,
                deskripsi VARCHAR(255) NOT NULL,
                jumlah DECIMAL(12, 2) NOT NULL,
                kategori VARCHAR(50),
                tanggal TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (tanggal)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            
            "CREATE TABLE IF NOT EXISTS pemasukkan (
                id INT PRIMARY KEY AUTO_INCREMENT,
                deskripsi VARCHAR(255) NOT NULL,
                jumlah DECIMAL(12, 2) NOT NULL,
                kategori VARCHAR(50),
                tanggal TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (tanggal)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            
            "CREATE TABLE IF NOT EXISTS device_tokens (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                device_name VARCHAR(255),
                device_ua VARCHAR(500),
                ip_address VARCHAR(45),
                last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NULL DEFAULT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX (user_id),
                INDEX (token),
                INDEX (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        ];

        foreach ($tables as $sql) {
            if (!$this->conn->query($sql)) {
                throw new Exception("Error creating table: " . $this->conn->error);
            }
        }
        
        // Add missing columns to users table (if upgrading from old version)
        $this->addMissingColumns();
    }
    
    private function addMissingColumns() {
        // Check and add email_verified column
        $result = $this->conn->query("SHOW COLUMNS FROM users LIKE 'email_verified'");
        if ($result->num_rows === 0) {
            $this->conn->query("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT TRUE");
        } else {
            // Set all existing users as verified (email not required)
            $this->conn->query("UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL OR email_verified = FALSE");
        }
        
        // Check and add email_token column
        $result = $this->conn->query("SHOW COLUMNS FROM users LIKE 'email_token'");
        if ($result->num_rows === 0) {
            $this->conn->query("ALTER TABLE users ADD COLUMN email_token VARCHAR(255)");
        }
        
        // Check and add last_login column
        $result = $this->conn->query("SHOW COLUMNS FROM users LIKE 'last_login'");
        if ($result->num_rows === 0) {
            $this->conn->query("ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL");
        }
    }

    public function getConnection() {
        return $this->conn;
    }

    public function prepare($sql) {
        return $this->conn->prepare($sql);
    }

    public function query($sql) {
        return $this->conn->query($sql);
    }

    public function close() {
        if ($this->conn) {
            $this->conn->close();
        }
    }

    public function __destruct() {
        $this->close();
    }
}

// ============== HELPER FUNCTIONS ==============
function getDB() {
    return Database::getInstance()->getConnection();
}

function formatRupiah($value) {
    return "Rp " . number_format((float)$value, 0, ',', '.');
}

function formatTanggal($tanggal) {
    try {
        $date = new DateTime($tanggal);
        return $date->format('d/m/Y H:i');
    } catch (Exception $e) {
        return $tanggal;
    }
}

function sanitizeInput($input) {
    return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
}

function getCurrentPage() {
    return isset($_GET['page']) ? sanitizeInput($_GET['page']) : 'dashboard';
}
?>
