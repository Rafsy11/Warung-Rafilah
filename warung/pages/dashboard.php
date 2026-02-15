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
            $stmt = $conn->prepare("SELECT COALESCE(SUM(stok * harga_beli), 0) as total FROM produk");
            $stmt->execute();
            $result = $stmt->get_result();
            echo (float)($result->fetch_assoc()['total'] ?? 0);
        ?>,
        pemasukkan: <?php 
            $stmt = $conn->prepare("SELECT COALESCE(SUM(jumlah), 0) as total FROM pemasukkan");
            $stmt->execute();
            $result = $stmt->get_result();
            echo (float)($result->fetch_assoc()['total'] ?? 0);
        ?>,
        pengeluaran: <?php 
            $stmt = $conn->prepare("SELECT COALESCE(SUM(jumlah), 0) as total FROM pengeluaran");
            $stmt->execute();
            $result = $stmt->get_result();
            echo (float)($result->fetch_assoc()['total'] ?? 0);
        ?>
    },
    products: [
        <?php
        $stmt = $conn->prepare("SELECT nama, stok, harga_jual FROM produk ORDER BY stok DESC LIMIT 5");
        $stmt->execute();
        $result = $stmt->get_result();
        $first = true;
        while ($row = $result->fetch_assoc()):
            if (!$first) echo ",\n";
            echo "            { nama: " . json_encode(sanitizeInput($row['nama'])) . ", stok: " . intval($row['stok']) . ", harga_jual: " . floatval($row['harga_jual']) . " }";
            $first = false;
        endwhile;
        ?>
    ],
    transactions: [
        <?php
        $stmt = $conn->prepare("
            (SELECT 'Pemasukkan' as type, deskripsi, jumlah, tanggal FROM pemasukkan)
            UNION ALL
            (SELECT 'Pengeluaran' as type, deskripsi, jumlah, tanggal FROM pengeluaran)
            ORDER BY tanggal DESC
            LIMIT 10
        ");
        $stmt->execute();
        $result = $stmt->get_result();
        $first = true;
        while ($row = $result->fetch_assoc()):
            if (!$first) echo ",\n";
            echo "            { type: " . json_encode($row['type']) . ", deskripsi: " . json_encode(sanitizeInput($row['deskripsi'])) . ", jumlah: " . floatval($row['jumlah']) . ", tanggal: " . json_encode($row['tanggal']) . " }";
            $first = false;
        endwhile;
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
