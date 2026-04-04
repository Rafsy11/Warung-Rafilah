<?php
include 'config.php';
include 'session.php';

if (!isLoggedIn()) {
    header('Location: login.php');
    exit;
}

try {
    $db = Database::getInstance();
    $conn = $db->getConnection();
    $page = getCurrentPage();

    $allowed_pages = ['dashboard', 'produk', 'inventory', 'keuangan', 'kasir'];
    if (!in_array($page, $allowed_pages, true)) {
        $page = 'dashboard';
    }

    $user = getCurrentUser();
} catch (Exception $e) {
    die('Error: ' . htmlspecialchars($e->getMessage()));
}

$page_meta = [
    'dashboard' => [
        'label' => 'Ringkasan',
        'description' => 'Pantau pergerakan stok, pemasukan, dan pengeluaran dari satu panel kendali.'
    ],
    'produk' => [
        'label' => 'Produk',
        'description' => 'Kelola katalog produk, harga beli, dan harga jual dengan alur yang lebih rapi.'
    ],
    'inventory' => [
        'label' => 'Inventory',
        'description' => 'Catat stok masuk dan stok keluar tanpa kehilangan konteks operasional harian.'
    ],
    'keuangan' => [
        'label' => 'Keuangan',
        'description' => 'Susun arus kas toko dengan tampilan yang lebih tenang dan mudah dibaca.'
    ],
    'kasir' => [
        'label' => 'Kasir',
        'description' => 'Gunakan POS yang fokus pada pencarian produk, keranjang, dan pembayaran cepat.'
    ]
];

$current_meta = $page_meta[$page];
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <meta name="description" content="Sistem operasional toko untuk manajemen inventory, keuangan, dan kasir">
    <meta name="theme-color" content="#2563eb">
    <title>Rafilah Storeboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/style.css">
</head>
<body data-page="<?php echo htmlspecialchars($page); ?>">
    <div class="app-shell">
        <aside class="sidebar">
            <a href="?page=dashboard" class="brand-panel">
                <span class="brand-kicker">Warung OS</span>
                <strong>Rafilah Storeboard</strong>
                <p>Versi baru yang lebih fokus untuk stok, kas, dan aktivitas toko harian.</p>
            </a>

            <div class="sidebar-card">
                <span class="sidebar-label">Akun aktif</span>
                <strong><?php echo htmlspecialchars($user['nama_lengkap'] ?? $user['username']); ?></strong>
                <p><?php echo htmlspecialchars($current_meta['description']); ?></p>
            </div>

            <button
                type="button"
                class="sidebar-toggle"
                id="sidebar-toggle"
                aria-expanded="true"
                aria-controls="sidebar-menu"
            >
                <span class="sidebar-toggle-copy">
                    <span class="sidebar-toggle-label">Pilihan menu</span>
                    <strong id="sidebar-toggle-text">Sembunyikan menu</strong>
                </span>
                <span class="sidebar-toggle-icon" aria-hidden="true"></span>
            </button>

            <div class="sidebar-menu-stack" id="sidebar-menu">
                <nav class="sidebar-nav" role="navigation" aria-label="Main navigation">
                    <a href="?page=dashboard" class="nav-link <?php echo $page === 'dashboard' ? 'active' : ''; ?>">
                        <span class="nav-icon">DB</span>
                        <span>Dashboard</span>
                    </a>
                    <a href="?page=produk" class="nav-link <?php echo $page === 'produk' ? 'active' : ''; ?>">
                        <span class="nav-icon">PR</span>
                        <span>Produk</span>
                    </a>
                    <a href="?page=inventory" class="nav-link <?php echo $page === 'inventory' ? 'active' : ''; ?>">
                        <span class="nav-icon">IV</span>
                        <span>Inventory</span>
                    </a>
                    <a href="?page=keuangan" class="nav-link <?php echo $page === 'keuangan' ? 'active' : ''; ?>">
                        <span class="nav-icon">KU</span>
                        <span>Keuangan</span>
                    </a>
                    <a href="?page=kasir" class="nav-link <?php echo $page === 'kasir' ? 'active' : ''; ?>">
                        <span class="nav-icon">KS</span>
                        <span>Kasir</span>
                    </a>
                </nav>

                <div class="sidebar-card">
                    <span class="sidebar-label">Hari ini</span>
                    <strong><?php echo date('d M Y'); ?></strong>
                    <p>Mulai dari menu samping, lalu pindah antar modul tanpa kehilangan konteks kerja.</p>
                </div>

                <a href="auth.php?action=logout" class="logout-link" onclick="return confirm('Yakin ingin keluar?')">Keluar dari aplikasi</a>
            </div>
        </aside>

        <section class="workspace">
            <header class="workspace-header">
                <div class="workspace-masthead">
                    <span class="eyebrow"><?php echo htmlspecialchars($current_meta['label']); ?></span>
                    <div class="workspace-copy">
                        <h1>Panel kendali toko</h1>
                        <p><?php echo htmlspecialchars($current_meta['description']); ?></p>
                    </div>
                </div>

                <div class="workspace-tools">
                    <div class="user-chip">
                        <span class="user-chip-label">Masuk sebagai</span>
                        <strong><?php echo htmlspecialchars($user['username']); ?></strong>
                    </div>

                    <button class="tool-button" id="theme-toggle" type="button" aria-label="Ubah tema">
                        <span class="tool-button-title">Tema</span>
                        <span class="tool-button-value" id="theme-toggle-label">Gelap</span>
                    </button>

                    <a href="?page=produk" class="tool-button accent-button">
                        <span class="tool-button-title">Aksi cepat</span>
                        <span class="tool-button-value">Kelola data</span>
                    </a>
                </div>
            </header>

            <main class="workspace-content main-content" role="main">
                <?php
                try {
                    $page_file = "pages/{$page}.php";
                    if (file_exists($page_file)) {
                        include $page_file;
                    } else {
                        echo '<div class="alert alert-error"><span>Halaman tidak ditemukan.</span></div>';
                    }
                } catch (Exception $e) {
                    echo '<div class="alert alert-error">';
                    echo '<span><strong>Error:</strong> ' . htmlspecialchars($e->getMessage()) . '</span>';
                    echo '</div>';
                }
                ?>
            </main>

            <footer class="workspace-footer">
                Rafilah Storeboard <?php echo date('Y'); ?>. Tampilan baru ini tetap memakai alur data yang sama agar aman dipakai langsung.
            </footer>
        </section>
    </div>

    <div class="fab" role="navigation" aria-label="Quick actions">
        <a href="?page=produk" class="fab-btn" title="Kelola data">Data</a>
        <button class="fab-btn secondary" id="fab-help" type="button" title="Bantuan">Help</button>
    </div>

    <script src="assets/script.js" defer></script>
</body>
</html>
