<?php
include 'config.php';

// Proses form
$message = '';
$message_type = '';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $conn = getConnection();
    
    if (isset($_POST['action'])) {
        if ($_POST['action'] == 'add') {
            $nama = $conn->real_escape_string($_POST['nama']);
            $harga_beli = floatval($_POST['harga_beli']);
            $harga_jual = floatval($_POST['harga_jual']);
            
            $sql = "INSERT INTO produk (nama, harga_beli, harga_jual) VALUES ('$nama', $harga_beli, $harga_jual)";
            if ($conn->query($sql)) {
                $message = "Produk berhasil ditambahkan!";
                $message_type = "success";
            } else {
                $message = "Error: " . $conn->error;
                $message_type = "error";
            }
        } elseif ($_POST['action'] == 'edit') {
            $id = intval($_POST['id']);
            $nama = $conn->real_escape_string($_POST['nama']);
            $harga_beli = floatval($_POST['harga_beli']);
            $harga_jual = floatval($_POST['harga_jual']);
            
            $sql = "UPDATE produk SET nama='$nama', harga_beli=$harga_beli, harga_jual=$harga_jual WHERE id=$id";
            if ($conn->query($sql)) {
                $message = "Produk berhasil diubah!";
                $message_type = "success";
            } else {
                $message = "Error: " . $conn->error;
                $message_type = "error";
            }
        } elseif ($_POST['action'] == 'delete') {
            $id = intval($_POST['id']);
            $sql = "DELETE FROM produk WHERE id=$id";
            if ($conn->query($sql)) {
                $message = "Produk berhasil dihapus!";
                $message_type = "success";
            } else {
                $message = "Error: " . $conn->error;
                $message_type = "error";
            }
        }
    }
    $conn->close();
}

// Ambil data produk
$conn = getConnection();
$result = $conn->query("SELECT * FROM produk ORDER BY nama");
$conn->close();
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manajemen Produk - Toko Rafilah</title>
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
            <a href="produk.php" class="nav-link active">Produk</a>
            <a href="inventory.php" class="nav-link">Inventory</a>
            <a href="keuangan.php" class="nav-link">Keuangan</a>
            <a href="kasir.php" class="nav-link">💳 Kasir</a>
        </nav>

        <main class="main-content">
            <h2>📦 Manajemen Produk</h2>
            
            <?php if ($message): ?>
                <div class="alert alert-<?php echo $message_type; ?>">
                    <?php echo $message; ?>
                </div>
            <?php endif; ?>

            <div class="form-section">
                <h3>Tambah/Edit Produk</h3>
                <form method="POST" class="form-grid">
                    <input type="hidden" name="action" value="add">
                    <input type="hidden" name="id" id="id" value="">
                    <input type="text" name="nama" id="nama" placeholder="Nama Produk" required>
                    <input type="number" name="harga_beli" id="harga_beli" placeholder="Harga Beli" min="0" step="0.01" required>
                    <input type="number" name="harga_jual" id="harga_jual" placeholder="Harga Jual" min="0" step="0.01" required>
                    <button type="submit" class="btn btn-primary">Simpan Produk</button>
                    <button type="button" class="btn btn-secondary" onclick="resetForm()">Reset</button>
                </form>
            </div>

            <div class="table-section">
                <h3>Daftar Produk</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Nama Produk</th>
                            <th>Harga Beli</th>
                            <th>Harga Jual</th>
                            <th>Stok</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php
                        if ($result && $result->num_rows > 0) {
                            $no = 1;
                            while ($row = $result->fetch_assoc()) {
                                echo "<tr>
                                    <td>" . $no++ . "</td>
                                    <td>" . htmlspecialchars($row['nama']) . "</td>
                                    <td>" . formatRupiah($row['harga_beli']) . "</td>
                                    <td>" . formatRupiah($row['harga_jual']) . "</td>
                                    <td>" . $row['stok'] . "</td>
                                    <td>
                                        <button class='btn btn-small' onclick='editProduk(" . json_encode($row) . ")'>Edit</button>
                                        <form method='POST' style='display:inline;' onsubmit=\"return confirm('Yakin ingin menghapus?');\">
                                            <input type='hidden' name='action' value='delete'>
                                            <input type='hidden' name='id' value='" . $row['id'] . "'>
                                            <button type='submit' class='btn btn-small btn-danger'>Hapus</button>
                                        </form>
                                    </td>
                                </tr>";
                            }
                        } else {
                            echo "<tr><td colspan='6' class='center'>Tidak ada data produk</td></tr>";
                        }
                        ?>
                    </tbody>
                </table>
            </div>
        </main>
    </div>

    <script>
        function editProduk(produk) {
            document.querySelector('input[name="action"]').value = 'edit';
            document.getElementById('id').value = produk.id;
            document.getElementById('nama').value = produk.nama;
            document.getElementById('harga_beli').value = produk.harga_beli;
            document.getElementById('harga_jual').value = produk.harga_jual;
            document.querySelector('button[type="submit"]').textContent = 'Update Produk';
            document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
        }

        function resetForm() {
            document.querySelector('input[name="action"]').value = 'add';
            document.getElementById('id').value = '';
            document.getElementById('nama').value = '';
            document.getElementById('harga_beli').value = '';
            document.getElementById('harga_jual').value = '';
            document.querySelector('button[type="submit"]').textContent = 'Simpan Produk';
        }
    </script>
</body>
</html>