<?php
$stmt = $conn->prepare("SELECT COALESCE(SUM(stok * harga_beli), 0) AS total FROM produk");
$stmt->execute();
$inventory_value = (float) (($stmt->get_result()->fetch_assoc()['total'] ?? 0));

$stmt = $conn->prepare("SELECT COALESCE(SUM(jumlah), 0) AS total FROM pemasukkan");
$stmt->execute();
$income_total = (float) (($stmt->get_result()->fetch_assoc()['total'] ?? 0));

$stmt = $conn->prepare("SELECT COALESCE(SUM(jumlah), 0) AS total FROM pengeluaran");
$stmt->execute();
$expense_total = (float) (($stmt->get_result()->fetch_assoc()['total'] ?? 0));

$stmt = $conn->prepare("SELECT COUNT(*) AS total FROM produk WHERE stok <= 5");
$stmt->execute();
$low_stock_count = (int) (($stmt->get_result()->fetch_assoc()['total'] ?? 0));
?>

<h2>Dashboard</h2>
<p class="page-lead">
    Ringkasan singkat kondisi toko hari ini.
</p>

<section class="dashboard-card">
    <div class="section-heading">
        <div>
            <span class="section-eyebrow">Ringkasan</span>
            <h3>Info inti</h3>
        </div>
        <p>Fokus ke angka yang paling penting dulu.</p>
    </div>
    <div id="dashboard-stats" class="stat-cards"></div>
</section>

<section class="dashboard-card">
    <div class="section-heading">
        <div>
            <span class="section-eyebrow">Aktivitas</span>
            <h3>Transaksi terbaru</h3>
        </div>
        <p>Catatan terbaru yang masuk ke sistem.</p>
    </div>
    <div id="transactions-table"></div>
</section>

<script>
window.dashboardData = {
    stats: {
        stok_value: <?php echo $inventory_value; ?>,
        pemasukkan: <?php echo $income_total; ?>,
        pengeluaran: <?php echo $expense_total; ?>,
        low_stock: <?php echo $low_stock_count; ?>
    },
    transactions: [
        <?php
        $stmt = $conn->prepare("
            (SELECT 'Pemasukkan' AS type, deskripsi, jumlah, tanggal FROM pemasukkan)
            UNION ALL
            (SELECT 'Pengeluaran' AS type, deskripsi, jumlah, tanggal FROM pengeluaran)
            ORDER BY tanggal DESC
            LIMIT 6
        ");
        $stmt->execute();
        $result = $stmt->get_result();
        $first = true;

        while ($row = $result->fetch_assoc()):
            if (!$first) {
                echo ",\n";
            }

            echo "            { type: " . json_encode($row['type']) . ", deskripsi: " . json_encode(sanitizeInput($row['deskripsi'])) . ", jumlah: " . floatval($row['jumlah']) . ", tanggal: " . json_encode($row['tanggal']) . " }";
            $first = false;
        endwhile;
        ?>
    ]
};
</script>
