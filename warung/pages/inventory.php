<?php
$message = '';
$message_type = '';

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    try {
        $action = sanitizeInput($_POST['action'] ?? '');
        
        if ($action === 'masuk' || $action === 'keluar') {
            $produk_id = isset($_POST['produk_id']) ? intval($_POST['produk_id']) : 0;
            $jumlah = isset($_POST['jumlah']) ? intval($_POST['jumlah']) : 0;
            $harga_satuan = isset($_POST['harga_satuan']) ? floatval($_POST['harga_satuan']) : 0;
            
            if ($produk_id <= 0 || $jumlah <= 0 || $harga_satuan < 0) {
                throw new Exception('Data tidak valid');
            }
            
            $total_harga = $jumlah * $harga_satuan;
        }
        
        if ($action === 'masuk') {
            // Insert stok masuk
            $stmt = $conn->prepare("INSERT INTO stok_masuk (produk_id, jumlah, harga_satuan, total_harga) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("iddd", $produk_id, $jumlah, $harga_satuan, $total_harga);
            
            if ($stmt->execute()) {
                // Update stok produk
                $stmt2 = $conn->prepare("UPDATE produk SET stok = stok + ? WHERE id = ?");
                $stmt2->bind_param("ii", $jumlah, $produk_id);
                $stmt2->execute();
                
                $message = "✓ Stok masuk berhasil dicatat!";
                $message_type = "success";
            } else {
                throw new Exception($stmt->error);
            }
            
        } elseif ($action === 'keluar') {
            // Insert stok keluar (validation already done above in the if block)
            $stmt = $conn->prepare("INSERT INTO stok_keluar (produk_id, jumlah, harga_satuan, total_harga) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("iddd", $produk_id, $jumlah, $harga_satuan, $total_harga);
            
            if ($stmt->execute()) {
                // Update stok produk
                $stmt2 = $conn->prepare("UPDATE produk SET stok = stok - ? WHERE id = ?");
                $stmt2->bind_param("ii", $jumlah, $produk_id);
                $stmt2->execute();
                
                $message = "✓ Stok keluar berhasil dicatat!";
                $message_type = "success";
            } else {
                throw new Exception($stmt->error);
            }
            
        } elseif ($action === 'delete_masuk' || $action === 'delete_keluar') {
            $id = intval($_POST['id'] ?? 0);
            
            if ($id <= 0) {
                throw new Exception('ID tidak valid');
            }
            
            $table = ($action === 'delete_masuk') ? 'stok_masuk' : 'stok_keluar';
            $operation = ($action === 'delete_masuk') ? '+' : '-';
            
            // Get the record first
            $stmt = $conn->prepare("SELECT produk_id, jumlah FROM {$table} WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($row = $result->fetch_assoc()) {
                $prod_id = $row['produk_id'];
                $qty = $row['jumlah'];
                
                // Delete the record
                $stmt = $conn->prepare("DELETE FROM {$table} WHERE id = ?");
                $stmt->bind_param("i", $id);
                
                if ($stmt->execute()) {
                    // Update stok (add back if masuk, subtract if keluar)
                    if ($operation === '+') {
                        $stmt2 = $conn->prepare("UPDATE produk SET stok = stok - ? WHERE id = ?");
                    } else {
                        $stmt2 = $conn->prepare("UPDATE produk SET stok = stok + ? WHERE id = ?");
                    }
                    $stmt2->bind_param("ii", $qty, $prod_id);
                    $stmt2->execute();
                    
                    $message = "✓ Data berhasil dihapus!";
                    $message_type = "success";
                } else {
                    throw new Exception($stmt->error);
                }
            }
        }
    } catch (Exception $e) {
        $message = "✗ Error: " . htmlspecialchars($e->getMessage());
        $message_type = "error";
    }
}

// Fetch all products
$stmt = $conn->prepare("SELECT id, nama, stok FROM produk ORDER BY nama");
$stmt->execute();
$produk_result = $stmt->get_result();

// Fetch stok_masuk
$stmt = $conn->prepare("SELECT sm.*, p.nama FROM stok_masuk sm JOIN produk p ON sm.produk_id = p.id ORDER BY sm.tanggal DESC");
$stmt->execute();
$stok_masuk_result = $stmt->get_result();

// Fetch stok_keluar
$stmt = $conn->prepare("SELECT sk.*, p.nama FROM stok_keluar sk JOIN produk p ON sk.produk_id = p.id ORDER BY sk.tanggal DESC");
$stmt->execute();
$stok_keluar_result = $stmt->get_result();
?>

<h2>📥 Manajemen Inventory</h2>

<?php if ($message): ?>
    <div class="alert alert-<?php echo $message_type; ?>">
        <span><?php echo $message; ?></span>
        <button type="button" class="alert-close" onclick="this.parentElement.style.display='none';">&times;</button>
    </div>
<?php endif; ?>

<!-- Stok Masuk Section -->
<section class="form-section">
    <h3>📦 Catat Stok Masuk</h3>
    <form method="POST" class="form-grid">
        <input type="hidden" name="action" value="masuk">
        
        <select name="produk_id" required aria-label="Pilih Produk">
            <option value="">Pilih Produk</option>
            <?php
            if ($produk_result->num_rows > 0) {
                $produk_result->data_seek(0);
                while ($row = $produk_result->fetch_assoc()) {
                    echo "<option value='" . $row['id'] . "'>" . sanitizeInput($row['nama']) . 
                         " (Stok: " . $row['stok'] . ")</option>";
                }
            }
            ?>
        </select>
        
        <input type="text" inputmode="numeric" name="jumlah" placeholder="Jumlah Unit" min="1" required aria-label="Jumlah">
        <input type="text" inputmode="numeric" name="harga_satuan" placeholder="Harga Satuan (Rp)" min="0" required aria-label="Harga Satuan">
        
        <button type="submit" class="btn btn-primary">✅ Catat Stok Masuk</button>
    </form>
    <div class="timestamp-display">
        🕐 Waktu Input: <strong><?php echo date('d/m/Y H:i:s'); ?></strong>
    </div>
</section>

<!-- Riwayat Stok Masuk -->
<section class="table-section">
    <h3>📋 Riwayat Stok Masuk</h3>
    
    <?php if ($stok_masuk_result->num_rows > 0): ?>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th width="5%">No</th>
                        <th width="25%">Produk</th>
                        <th width="10%" class="text-center">Jumlah</th>
                        <th width="15%" class="text-right">Harga/Unit</th>
                        <th width="15%" class="text-right">Total</th>
                        <th width="15%">Tanggal</th>
                        <th width="15%" class="text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $no = 1;
                    while ($row = $stok_masuk_result->fetch_assoc()):
                    ?>
                        <tr>
                            <td><?php echo $no++; ?></td>
                            <td><?php echo sanitizeInput($row['nama']); ?></td>
                            <td class="text-center"><badge><?php echo $row['jumlah']; ?></badge></td>
                            <td class="text-right"><?php echo formatRupiah($row['harga_satuan']); ?></td>
                            <td class="text-right"><strong><?php echo formatRupiah($row['total_harga']); ?></strong></td>
                            <td><?php echo formatTanggal($row['tanggal']); ?></td>
                            <td class="text-center">
                                <form method="POST" style="display:inline;" 
                                      onsubmit="return confirm('Yakin ingin menghapus?');">
                                    <input type="hidden" name="action" value="delete_masuk">
                                    <input type="hidden" name="id" value="<?php echo $row['id']; ?>">
                                    <button type="submit" class="btn btn-sm btn-danger">🗑️ Hapus</button>
                                </form>
                            </td>
                        </tr>
                    <?php endwhile; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <p>📭 Belum ada riwayat stok masuk</p>
        </div>
    <?php endif; ?>
</section>

<!-- Stok Keluar Section -->
<section class="form-section">
    <h3>📦 Catat Stok Keluar</h3>
    <form method="POST" class="form-grid">
        <input type="hidden" name="action" value="keluar">
        
        <select name="produk_id" required aria-label="Pilih Produk">
            <option value="">Pilih Produk</option>
            <?php
            if ($produk_result->num_rows > 0) {
                $produk_result->data_seek(0);
                while ($row = $produk_result->fetch_assoc()) {
                    echo "<option value='" . $row['id'] . "'>" . sanitizeInput($row['nama']) . 
                         " (Stok: " . $row['stok'] . ")</option>";
                }
            }
            ?>
        </select>
        
        <input type="text" inputmode="numeric" name="jumlah" placeholder="Jumlah Unit" min="1" required aria-label="Jumlah">
        <input type="text" inputmode="numeric" name="harga_satuan" placeholder="Harga Satuan (Rp)" min="0" required aria-label="Harga Satuan">
        
        <button type="submit" class="btn btn-primary">✅ Catat Stok Keluar</button>
    </form>
    <div class="timestamp-display">
        🕐 Waktu Input: <strong><?php echo date('d/m/Y H:i:s'); ?></strong>
    </div>
</section>

<!-- Riwayat Stok Keluar -->
<section class="table-section">
    <h3>📋 Riwayat Stok Keluar</h3>
    
    <?php if ($stok_keluar_result->num_rows > 0): ?>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th width="5%">No</th>
                        <th width="25%">Produk</th>
                        <th width="10%" class="text-center">Jumlah</th>
                        <th width="15%" class="text-right">Harga/Unit</th>
                        <th width="15%" class="text-right">Total</th>
                        <th width="15%">Tanggal</th>
                        <th width="15%" class="text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $no = 1;
                    while ($row = $stok_keluar_result->fetch_assoc()):
                    ?>
                        <tr>
                            <td><?php echo $no++; ?></td>
                            <td><?php echo sanitizeInput($row['nama']); ?></td>
                            <td class="text-center"><badge><?php echo $row['jumlah']; ?></badge></td>
                            <td class="text-right"><?php echo formatRupiah($row['harga_satuan']); ?></td>
                            <td class="text-right"><strong><?php echo formatRupiah($row['total_harga']); ?></strong></td>
                            <td><?php echo formatTanggal($row['tanggal']); ?></td>
                            <td class="text-center">
                                <form method="POST" style="display:inline;" 
                                      onsubmit="return confirm('Yakin ingin menghapus?');">
                                    <input type="hidden" name="action" value="delete_keluar">
                                    <input type="hidden" name="id" value="<?php echo $row['id']; ?>">
                                    <button type="submit" class="btn btn-sm btn-danger">🗑️ Hapus</button>
                                </form>
                            </td>
                        </tr>
                    <?php endwhile; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <p>📭 Belum ada riwayat stok keluar</p>
        </div>
    <?php endif; ?>
</section>
