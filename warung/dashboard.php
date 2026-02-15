<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

include 'config.php';
try {
    $conn = getConnection();
    
    if (!$conn) {
        die("Database connection failed");
    }
} catch (Exception $e) {
    die("Exception: " . $e->getMessage());
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Toko Rafilah Frozen Food - Dashboard</title>
    <link rel="stylesheet" href="assets/style.css">
    <script src="assets/script.js" defer></script>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <h1>🏪 Toko Rafilah Frozen Food</h1>
            <p>Sistem Manajemen Inventory & Keuangan</p>
        </header>

        <!-- Navigation -->
        <nav class="navbar">
            <a href="dashboard.php" class="nav-link active">Dashboard</a>
            <a href="produk.php" class="nav-link">Produk</a>
            <a href="inventory.php" class="nav-link">Inventory</a>
            <a href="keuangan.php" class="nav-link">Keuangan</a>
            <a href="kasir.php" class="nav-link">💳 Kasir</a>
        </nav>

        <!-- Main Content -->
        <main class="main-content">
            <h2>📊 Dashboard</h2>

            <!-- Stats Cards Container -->
            <div id="dashboard-stats" class="stat-cards"></div>

            <!-- Top Products Container -->
            <div id="dashboard-products" class="dashboard-section">
                <h3>🏆 Produk Stok Terbanyak</h3>
                <div id="products-table"></div>
            </div>

            <!-- Transactions Container -->
            <div id="dashboard-transactions" class="dashboard-section">
                <h3>📋 Transaksi Terbaru</h3>
                <div id="transactions-table"></div>
            </div>

            <script>
            // Dashboard data - embedded from database
            window.dashboardData = {
                stats: {
                    stok_value: <?php 
                        try {
                            $stmt = $conn->prepare("SELECT COALESCE(SUM(stok * harga_beli), 0) as total FROM produk");
                            if ($stmt && $stmt->execute()) {
                                $result = $stmt->get_result();
                                $row = $result->fetch_assoc();
                                echo isset($row['total']) ? (float)$row['total'] : 0;
                            } else {
                                echo 0;
                            }
                        } catch (Exception $e) {
                            echo 0;
                        }
                    ?>,
                    pemasukkan: <?php 
                        try {
                            $stmt = $conn->prepare("SELECT COALESCE(SUM(jumlah), 0) as total FROM pemasukkan");
                            if ($stmt && $stmt->execute()) {
                                $result = $stmt->get_result();
                                $row = $result->fetch_assoc();
                                echo isset($row['total']) ? (float)$row['total'] : 0;
                            } else {
                                echo 0;
                            }
                        } catch (Exception $e) {
                            echo 0;
                        }
                    ?>,
                    pengeluaran: <?php 
                        try {
                            $stmt = $conn->prepare("SELECT COALESCE(SUM(jumlah), 0) as total FROM pengeluaran");
                            if ($stmt && $stmt->execute()) {
                                $result = $stmt->get_result();
                                $row = $result->fetch_assoc();
                                echo isset($row['total']) ? (float)$row['total'] : 0;
                            } else {
                                echo 0;
                            }
                        } catch (Exception $e) {
                            echo 0;
                        }
                    ?>
                },
                products: [
                    <?php
                    try {
                        $stmt = $conn->prepare("SELECT nama, stok, harga_jual FROM produk ORDER BY stok DESC LIMIT 5");
                        if ($stmt && $stmt->execute()) {
                            $result = $stmt->get_result();
                            $first = true;
                            while ($row = $result->fetch_assoc()):
                                if (!$first) echo ",\n";
                                echo "            { nama: " . json_encode(sanitizeInput($row['nama'])) . ", stok: " . intval($row['stok']) . ", harga_jual: " . floatval($row['harga_jual']) . " }";
                                $first = false;
                            endwhile;
                        }
                    } catch (Exception $e) {
                        // Silent fail - empty products array
                    }
                    ?>
                ],
                transactions: [
                    <?php
                    try {
                        $stmt = $conn->prepare("
                            (SELECT 'Pemasukkan' as type, deskripsi, jumlah, tanggal FROM pemasukkan)
                            UNION ALL
                            (SELECT 'Pengeluaran' as type, deskripsi, jumlah, tanggal FROM pengeluaran)
                            ORDER BY tanggal DESC
                            LIMIT 10
                        ");
                        if ($stmt && $stmt->execute()) {
                            $result = $stmt->get_result();
                            $first = true;
                            while ($row = $result->fetch_assoc()):
                                if (!$first) echo ",\n";
                                echo "            { type: " . json_encode($row['type']) . ", deskripsi: " . json_encode(sanitizeInput($row['deskripsi'])) . ", jumlah: " . floatval($row['jumlah']) . ", tanggal: " . json_encode($row['tanggal']) . " }";
                                $first = false;
                            endwhile;
                        }
                    } catch (Exception $e) {
                        // Silent fail - empty transactions array
                    }
                    ?>
                ]
            };

            // Initialize dashboard
            function initDashboardNow() {
                if (typeof dashboardRender !== 'undefined') {
                    dashboardRender.renderStats(window.dashboardData.stats);
                    dashboardRender.renderProducts(window.dashboardData.products);
                    dashboardRender.renderTransactions(window.dashboardData.transactions);
                } else {
                    setTimeout(initDashboardNow, 100);
                }
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initDashboardNow);
            } else {
                initDashboardNow();
            }

            // Re-render on theme change
            document.addEventListener('themeChanged', initDashboardNow);
            </script>
        </main>
    </div>
</body>
</html>