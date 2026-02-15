<?php
include 'config.php';

$message = '';
$message_type = '';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $conn = getConnection();
    
    if (isset($_POST['action'])) {
        $deskripsi = $conn->real_escape_string($_POST['deskripsi']);
        $jumlah = floatval($_POST['jumlah']);
        $kategori = $conn->real_escape_string($_POST['kategori']);
        
        if ($_POST['action'] == 'pemasukkan') {
            $sql = "INSERT INTO pemasukkan (deskripsi, jumlah, kategori) VALUES ('$deskripsi', $jumlah, '$kategori')";
            if ($conn->query($sql)) {
                $message = "Pemasukkan berhasil dicatat!";
                $message_type = "success";
            } else {
                $message = "Error: " . $conn->error;
                $message_type = "error";
            }
        } elseif ($_POST['action'] == 'pengeluaran') {
            $sql = "INSERT INTO pengeluaran (deskripsi, jumlah, kategori) VALUES ('$deskripsi', $jumlah, '$kategori')";
            if ($conn->query($sql)) {
                $message = "Pengeluaran berhasil dicatat!";
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
$pemasukkan_result = $conn->query("SELECT * FROM pemasukkan ORDER BY tanggal DESC");
$pengeluaran_result = $conn->query("SELECT * FROM pengeluaran ORDER BY tanggal DESC");
$conn->close();
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manajemen Keuangan - Toko Rafilah</title>
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
            <a href="inventory.php" class="nav-link">Inventory</a>
            <a href="keuangan.php" class="nav-link active">Keuangan</a>
            <a href="kasir.php" class="nav-link">💳 Kasir</a>
        </nav>

        <main class="main-content">
            <h2>💰 Manajemen Keuangan</h2>
            
            <?php if ($message): ?>
                <div class="alert alert-<?php echo $message_type; ?>">
                    <?php echo $message; ?>
                </div>
            <?php endif; ?>

            <!-- Pemasukkan Section -->
            <div class="form-section">
                <h3>Catat Pemasukkan</h3>
                <form method="POST" class="form-grid">
                    <input type="hidden" name="action" value="pemasukkan">
                    <input type="text" name="deskripsi" placeholder="Deskripsi" required>
                    <select name="kategori" required>
                        <option value="">Pilih Kategori</option>
                        <option value="Penjualan">Penjualan</option>
                        <option value="Investasi">Investasi</option>
                        <option value="Lainnya">Lainnya</option>
                    </select>
                    <input type="number" name="jumlah" placeholder="Jumlah" min="0" step="0.01" required>
                    <button type="submit" class="btn btn-primary">Catat Pemasukkan</button>
                </form>
            </div>

            <div class="table-section">
                <h3>Riwayat Pemasukkan</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Deskripsi</th>
                            <th>Kategori</th>
                            <th>Jumlah</th>
                            <th>Tanggal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php
                        if ($pemasukkan_result && $pemasukkan_result->num_rows > 0) {
                            $no = 1;
                            while ($row = $pemasukkan_result->fetch_assoc()) {
                                echo "<tr>
                                    <td>" . $no++ . "</td>
                                    <td>" . htmlspecialchars($row['deskripsi']) . "</td>
                                    <td>" . htmlspecialchars($row['kategori']) . "</td>
                                    <td class='green'>" . formatRupiah($row['jumlah']) . "</td>
                                    <td>" . formatTanggal($row['tanggal']) . "</td>
                                </tr>";
                            }
                        } else {
                            echo "<tr><td colspan='5' class='center'>Tidak ada data</td></tr>";
                        }
                        ?>
                    </tbody>
                </table>
            </div>

            <!-- Pengeluaran Section -->
            <div class="form-section">
                <h3>Catat Pengeluaran</h3>
                <form method="POST" class="form-grid">
                    <input type="hidden" name="action" value="pengeluaran">
                    <input type="text" name="deskripsi" placeholder="Deskripsi" required>
                    <select name="kategori" required>
                        <option value="">Pilih Kategori</option>
                        <option value="Operasional">Operasional</option>
                        <option value="Gaji">Gaji</option>
                        <option value="Utilitas">Utilitas</option>
                        <option value="Pemeliharaan">Pemeliharaan</option>
                        <option value="Lainnya">Lainnya</option>
                    </select>
                    <input type="number" name="jumlah" placeholder="Jumlah" min="0" step="0.01" required>
                    <button type="submit" class="btn btn-primary">Catat Pengeluaran</button>
                </form>
            </div>

            <div class="table-section">
                <h3>Riwayat Pengeluaran</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Deskripsi</th>
                            <th>Kategori</th>
                            <th>Jumlah</th>
                            <th>Tanggal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php
                        if ($pengeluaran_result && $pengeluaran_result->num_rows > 0) {
                            $no = 1;
                            while ($row = $pengeluaran_result->fetch_assoc()) {
                                echo "<tr>
                                    <td>" . $no++ . "</td>
                                    <td>" . htmlspecialchars($row['deskripsi']) . "</td>
                                    <td>" . htmlspecialchars($row['kategori']) . "</td>
                                    <td class='red'>" . formatRupiah($row['jumlah']) . "</td>
                                    <td>" . formatTanggal($row['tanggal']) . "</td>
                                </tr>";
                            }
                        } else {
                            echo "<tr><td colspan='5' class='center'>Tidak ada data</td></tr>";
                        }
                        ?>
                    </tbody>
                </table>
            </div>
        </main>
    </div>
</body>
</html>