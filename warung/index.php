<?php
include 'config.php';
include 'session.php';

// Check if logged in
if (!isLoggedIn()) {
    // Redirect to login page
    header('Location: login.php');
    exit;
}

try {
    $db = Database::getInstance();
    $conn = $db->getConnection();
    $page = getCurrentPage();
    
    // Validasi halaman
    $allowed_pages = ['dashboard', 'produk', 'inventory', 'keuangan', 'kasir'];
    if (!in_array($page, $allowed_pages)) {
        $page = 'dashboard';
    }
    
    // Get current user
    $user = getCurrentUser();
} catch (Exception $e) {
    die('Error: ' . htmlspecialchars($e->getMessage()));
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <meta name="description" content="Sistem Manajemen Inventory & Keuangan untuk Toko Rafilah Frozen Food">
    <title>Toko Rafilah | Sistem Manajemen Inventory & Keuangan</title>
    <meta name="theme-color" content="#6b46c1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <div class="header-content">
                <div class="header-left">
                    <h1>🏪 Toko Rafilah Frozen Food</h1>
                    <p>Sistem Manajemen Inventory & Keuangan</p>
                </div>
                <div class="header-actions">
                    <div class="user-info">
                        <span class="username"><?php echo htmlspecialchars($user['nama_lengkap'] ?? $user['username']); ?></span>
                    </div>
                    <button class="btn-icon" id="theme-toggle" title="Toggle theme"></button>
                    <a href="auth.php?action=logout" class="btn-icon" title="Logout" onclick="return confirm('Yakin ingin logout?')">🚪</a>
                </div>
            </div>
        </header>

        <!-- Navigation -->
        <nav class="navbar" role="navigation" aria-label="Main navigation">
            <a href="?page=dashboard" class="nav-link <?php echo $page === 'dashboard' ? 'active' : ''; ?>" title="Dashboard">
                <span class="nav-icon">📊</span><span>Dashboard</span>
            </a>
            <a href="?page=produk" class="nav-link <?php echo $page === 'produk' ? 'active' : ''; ?>" title="Manajemen Produk">
                <span class="nav-icon">📦</span><span>Produk</span>
            </a>
            <a href="?page=inventory" class="nav-link <?php echo $page === 'inventory' ? 'active' : ''; ?>" title="Manajemen Inventory">
                <span class="nav-icon">📥</span><span>Inventory</span>
            </a>
            <a href="?page=keuangan" class="nav-link <?php echo $page === 'keuangan' ? 'active' : ''; ?>" title="Manajemen Keuangan">
                <span class="nav-icon">💰</span><span>Keuangan</span>
            </a>
            <a href="?page=kasir" class="nav-link <?php echo $page === 'kasir' ? 'active' : ''; ?>" title="Sistem Kasir">
                <span class="nav-icon">💳</span><span>Kasir</span>
            </a>
        </nav>

        <!-- Main Content -->
        <main class="main-content" role="main">
            <?php
            try {
                $page_file = "pages/{$page}.php";
                if (file_exists($page_file)) {
                    include $page_file;
                } else {
                    echo '<div class="alert alert-error">Halaman tidak ditemukan</div>';
                }
            } catch (Exception $e) {
                echo '<div class="alert alert-error">';
                echo '<strong>Error:</strong> ' . htmlspecialchars($e->getMessage());
                echo '</div>';
            }
            ?>
        </main>
    </div>

    <footer class="footer">
        <p>&copy; 2026 Toko Rafilah Frozen Food. All rights reserved.</p>
    </footer>

    <div class="fab" role="navigation" aria-label="Quick actions">
        <a href="?page=produk&action=add" class="fab-btn" title="Tambah Produk">＋</a>
        <button class="fab-btn secondary" id="fab-help" title="Bantuan">?</button>
    </div>

    <!-- Mobile Optimization - Load first for better performance -->
    <script src="assets/device-manager.js" defer></script>
    <script src="assets/mobile-optimize.js" defer></script>
    <script src="assets/script.js" defer></script>
</body>
</html>
