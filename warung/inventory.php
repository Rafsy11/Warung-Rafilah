<?php
include 'config.php';

$message = '';
$message_type = '';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $conn = getConnection();
    
    if (isset($_POST['action'])) {
        $produk_id = intval($_POST['produk_id']);
        $jumlah = intval($_POST['jumlah']);
        $harga_satuan = floatval($_POST['harga_satuan']);
        $total_harga = $jumlah * $harga_satuan;
        
        if ($_POST['action'] == 'masuk') {
            $sql = "INSERT INTO stok_masuk (produk_id, jumlah, harga_satuan, total_harga) VALUES ($produk_id, $jumlah, $harga_satuan, $total_harga)";
            if ($conn->query($sql)) {
                // Update stok produk
                $conn->query("UPDATE produk SET stok = stok + $jumlah WHERE id = $produk_id");
                $message = "Stok masuk berhasil dicatat!";
                $message_type = "success";
            } else {
                $message = "Error: " . $conn->error;
                $message_type = "error";
            }
        } elseif ($_POST['action'] == 'keluar') {
            $sql = "INSERT INTO stok_keluar (produk_id, jumlah, harga_satuan, total_harga) VALUES ($produk_id, $jumlah, $harga_satuan, $total_harga)";
            if ($conn->query($sql)) {
                // Update stok produk
                $conn->query("UPDATE produk SET stok = stok - $jumlah WHERE id = $produk_id");
                $message = "Stok keluar berhasil dicatat!";
                $message_type = "success";
            } else {
                $message = "Error: " . $conn->error;
                $message_type = "error";
            }
        }
    }
    $conn->close();
}

// Ambil data
$conn = getConnection();
$produk_result = $conn->query("SELECT * FROM produk ORDER BY nama");
$stok_masuk_result = $conn->query("SELECT sm.*, p.nama FROM stok_masuk sm JOIN produk p ON sm.produk_id = p.id ORDER BY sm.tanggal DESC");
$stok_keluar_result = $conn->query("SELECT sk.*, p.nama FROM stok_keluar sk JOIN produk p ON sk.produk_id = p.id ORDER BY sk.tanggal DESC");
$conn->close();
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manajemen Inventory - Toko Rafilah</title>
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>🏪 Toko Rafilah Frozen Food</h1>
            <p>Sistem Manajemen Inventory & Keuangan</p>
        </header>

        <nav class="navbar">
            <a href="dashboard.php" class="nav-link">Dashboard</a>
            <a href="produk.php" class="nav-link">Produk</a>
            <a href="inventory.php" class="nav-link active">Inventory</a>
            <a href="keuangan.php" class="nav-link">Keuangan</a>
            <a href="kasir.php" class="nav-link">💳 Kasir</a>
        </nav>

        <main class="main-content">
            <h2>📥 Manajemen Inventory</h2>
            
            <?php if ($message): ?>
                <div class="alert alert-<?php echo $message_type; ?>">
                    <?php echo $message; ?>
                </div>
            <?php endif; ?>

            <!-- Stok Masuk Section -->
            <div class="form-section">
                <h3>Stok Masuk</h3>
                <form method="POST" class="form-grid">
                    <input type="hidden" name="action" value="masuk">
                    <select name="produk_id" required>
                        <option value="">Pilih Produk</option>
                        <?php
                        if ($produk_result && $produk_result->num_rows > 0) {
                            $produk_result->data_seek(0);
                            while ($row = $produk_result->fetch_assoc()) {
                                echo "<option value='" . $row['id'] . "'>" . htmlspecialchars($row['nama']) . " (Stok: " . $row['stok'] . ")</option>";
                            }
                        }
                        ?>
                    </select>
                    <input type="number" name="jumlah" placeholder="Jumlah" min="1" required>
                    <input type="number" name="harga_satuan" placeholder="Harga Satuan" min="0" step="0.01" required>
                    <button type="submit" class="btn btn-primary">Catat Stok Masuk</button>
                </form>
            </div>

            <div class="table-section">
                <h3>Riwayat Stok Masuk</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Produk</th>
                            <th>Jumlah</th>
                            <th>Harga Satuan</th>
                            <th>Total</th>
                            <th>Tanggal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php
                        if ($stok_masuk_result && $stok_masuk_result->num_rows > 0) {
                            $no = 1;
                            while ($row = $stok_masuk_result->fetch_assoc()) {
                                echo "<tr>
                                    <td>" . $no++ . "</td>
                                    <td>" . htmlspecialchars($row['nama']) . "</td>
                                    <td>" . $row['jumlah'] . "</td>
                                    <td>" . formatRupiah($row['harga_satuan']) . "</td>
                                    <td>" . formatRupiah($row['total_harga']) . "</td>
                                    <td>" . formatTanggal($row['tanggal']) . "</td>
                                </tr>";
                            }
                        } else {
                            echo "<tr><td colspan='6' class='center'>Tidak ada data</td></tr>";
                        }
                        ?>
                    </tbody>
                </table>
            </div>

            <!-- Stok Keluar Section -->
            <div class="form-section">
                <h3>Stok Keluar</h3>
                <form method="POST" class="form-grid">
                    <input type="hidden" name="action" value="keluar">
                    <select name="produk_id" required>
                        <option value="">Pilih Produk</option>
                        <?php
                        if ($produk_result && $produk_result->num_rows > 0) {
                            $produk_result->data_seek(0);
                            while ($row = $produk_result->fetch_assoc()) {
                                echo "<option value='" . $row['id'] . "'>" . htmlspecialchars($row['nama']) . " (Stok: " . $row['stok'] . ")</option>";
                            }
                        }
                        ?>
                    </select>
                    <input type="number" name="jumlah" placeholder="Jumlah" min="1" required>
                    <input type="number" name="harga_satuan" placeholder="Harga Satuan" min="0" step="0.01" required>
                    <button type="submit" class="btn btn-primary">Catat Stok Keluar</button>
                </form>
            </div>

            <div class="table-section">
                <h3>Riwayat Stok Keluar</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Produk</th>
                            <th>Jumlah</th>
                            <th>Harga Satuan</th>
                            <th>Total</th>
                            <th>Tanggal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php
                        if ($stok_keluar_result && $stok_keluar_result->num_rows > 0) {
                            $no = 1;
                            while ($row = $stok_keluar_result->fetch_assoc()) {
                                echo "<tr>
                                    <td>" . $no++ . "</td>
                                    <td>" . htmlspecialchars($row['nama']) . "</td>
                                    <td>" . $row['jumlah'] . "</td>
                                    <td>" . formatRupiah($row['harga_satuan']) . "</td>
                                    <td>" . formatRupiah($row['total_harga']) . "</td>
                                    <td>" . formatTanggal($row['tanggal']) . "</td>
                                </tr>";
                            }
                        } else {
                            echo "<tr><td colspan='6' class='center'>Tidak ada data</td></tr>";
                        }
                        ?>
                    </tbody>
                </table>
            </div>
        </main>
    </div>
</body>
</html>