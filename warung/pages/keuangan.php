<?php
$message = '';
$message_type = '';

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    try {
        $action = sanitizeInput($_POST['action'] ?? '');
        
        if ($action === 'pemasukkan') {
            $deskripsi = isset($_POST['deskripsi']) ? sanitizeInput($_POST['deskripsi']) : '';
            $jumlah = isset($_POST['jumlah']) ? floatval($_POST['jumlah']) : 0;
            $kategori = isset($_POST['kategori']) ? sanitizeInput($_POST['kategori']) : '';
            
            if (empty($deskripsi) || $jumlah <= 0 || empty($kategori)) {
                throw new Exception('Semua data harus diisi dengan nilai yang valid');
            }
            $stmt = $conn->prepare("INSERT INTO pemasukkan (deskripsi, jumlah, kategori) VALUES (?, ?, ?)");
            $stmt->bind_param("sds", $deskripsi, $jumlah, $kategori);
            
            if ($stmt->execute()) {
                $message = "✓ Pemasukkan berhasil dicatat!";
                $message_type = "success";
            } else {
                throw new Exception($stmt->error);
            }
            
        } elseif ($action === 'pengeluaran') {
            $deskripsi = isset($_POST['deskripsi']) ? sanitizeInput($_POST['deskripsi']) : '';
            $jumlah = isset($_POST['jumlah']) ? floatval($_POST['jumlah']) : 0;
            $kategori = isset($_POST['kategori']) ? sanitizeInput($_POST['kategori']) : '';
            
            if (empty($deskripsi) || $jumlah <= 0 || empty($kategori)) {
                throw new Exception('Semua data harus diisi dengan nilai yang valid');
            }
            
            $stmt = $conn->prepare("INSERT INTO pengeluaran (deskripsi, jumlah, kategori) VALUES (?, ?, ?)");
            $stmt->bind_param("sds", $deskripsi, $jumlah, $kategori);
            
            if ($stmt->execute()) {
                $message = "✓ Pengeluaran berhasil dicatat!";
                $message_type = "success";
            } else {
                throw new Exception($stmt->error);
            }
            
        } elseif ($action === 'delete_pemasukkan' || $action === 'delete_pengeluaran') {
            $id = intval($_POST['id'] ?? 0);
            
            if ($id <= 0) {
                throw new Exception('ID tidak valid');
            }
            
            $table = ($action === 'delete_pemasukkan') ? 'pemasukkan' : 'pengeluaran';
            $stmt = $conn->prepare("DELETE FROM {$table} WHERE id = ?");
            $stmt->bind_param("i", $id);
            
            if ($stmt->execute()) {
                $message = "✓ Data berhasil dihapus!";
                $message_type = "success";
            } else {
                throw new Exception($stmt->error);
            }
        }
    } catch (Exception $e) {
        $message = "✗ Error: " . htmlspecialchars($e->getMessage());
        $message_type = "error";
    }
}

// Fetch pemasukkan
$stmt = $conn->prepare("SELECT id, deskripsi, kategori, jumlah, tanggal FROM pemasukkan ORDER BY tanggal DESC");
$stmt->execute();
$pemasukkan_result = $stmt->get_result();

// Fetch pengeluaran
$stmt = $conn->prepare("SELECT id, deskripsi, kategori, jumlah, tanggal FROM pengeluaran ORDER BY tanggal DESC");
$stmt->execute();
$pengeluaran_result = $stmt->get_result();
?>

<h2>💰 Manajemen Keuangan</h2>

<?php if ($message): ?>
    <div class="alert alert-<?php echo $message_type; ?>">
        <span><?php echo $message; ?></span>
        <button type="button" class="alert-close" onclick="this.parentElement.style.display='none';">&times;</button>
    </div>
<?php endif; ?>

<!-- Pemasukkan Section -->
<section class="form-section">
    <h3>📈 Catat Pemasukkan</h3>
    <form method="POST" class="form-grid">
        <input type="hidden" name="action" value="pemasukkan">
        
        <input type="text" name="deskripsi" placeholder="Deskripsi Pemasukkan" required aria-label="Deskripsi">
        
        <select name="kategori" required aria-label="Kategori Pemasukkan">
            <option value="">Pilih Kategori</option>
            <option value="Penjualan">Penjualan</option>
            <option value="Investasi">Investasi</option>
            <option value="Bonus">Bonus</option>
            <option value="Lainnya">Lainnya</option>
        </select>
        
        <input type="text" inputmode="numeric" name="jumlah" placeholder="Jumlah (Rp)" min="0" required aria-label="Jumlah">
        
        <button type="submit" class="btn btn-primary">💾 Catat Pemasukkan</button>
    </form>
    <div class="timestamp-display">
        🕐 Waktu Input: <strong><?php echo date('d/m/Y H:i:s'); ?></strong>
    </div>
</section>

<!-- Riwayat Pemasukkan -->
<section class="table-section">
    <h3>📋 Riwayat Pemasukkan</h3>
    
    <?php if ($pemasukkan_result->num_rows > 0): ?>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th width="5%">No</th>
                        <th width="35%">Deskripsi</th>
                        <th width="15%">Kategori</th>
                        <th width="20%" class="text-right">Jumlah</th>
                        <th width="15%">Tanggal</th>
                        <th width="10%" class="text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $no = 1;
                    while ($row = $pemasukkan_result->fetch_assoc()):
                    ?>
                        <tr>
                            <td><?php echo $no++; ?></td>
                            <td><?php echo sanitizeInput($row['deskripsi']); ?></td>
                            <td><span class="badge badge-info"><?php echo sanitizeInput($row['kategori']); ?></span></td>
                            <td class="text-right text-success"><strong><?php echo formatRupiah($row['jumlah']); ?></strong></td>
                            <td><?php echo formatTanggal($row['tanggal']); ?></td>
                            <td class="text-center">
                                <form method="POST" style="display:inline;" 
                                      onsubmit="return confirm('Yakin ingin menghapus?');">
                                    <input type="hidden" name="action" value="delete_pemasukkan">
                                    <input type="hidden" name="id" value="<?php echo $row['id']; ?>">
                                    <button type="submit" class="btn btn-sm btn-danger">🗑️</button>
                                </form>
                            </td>
                        </tr>
                    <?php endwhile; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <p>📭 Belum ada riwayat pemasukkan</p>
        </div>
    <?php endif; ?>
</section>

<!-- Pengeluaran Section -->
<section class="form-section">
    <h3>📉 Catat Pengeluaran</h3>
    <form method="POST" class="form-grid">
        <input type="hidden" name="action" value="pengeluaran">
        
        <input type="text" name="deskripsi" placeholder="Deskripsi Pengeluaran" required aria-label="Deskripsi">
        
        <select name="kategori" required aria-label="Kategori Pengeluaran">
            <option value="">Pilih Kategori</option>
            <option value="Operasional">Operasional</option>
            <option value="Gaji">Gaji</option>
            <option value="Utilitas">Utilitas</option>
            <option value="Pemeliharaan">Pemeliharaan</option>
            <option value="Lainnya">Lainnya</option>
        </select>
        
        <input type="text" inputmode="numeric" name="jumlah" placeholder="Jumlah (Rp)" min="0" required aria-label="Jumlah">
        
        <button type="submit" class="btn btn-primary">💾 Catat Pengeluaran</button>
    </form>
    <div class="timestamp-display">
        🕐 Waktu Input: <strong><?php echo date('d/m/Y H:i:s'); ?></strong>
    </div>
</section>

<!-- Riwayat Pengeluaran -->
<section class="table-section">
    <h3>📋 Riwayat Pengeluaran</h3>
    
    <?php if ($pengeluaran_result->num_rows > 0): ?>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th width="5%">No</th>
                        <th width="35%">Deskripsi</th>
                        <th width="15%">Kategori</th>
                        <th width="20%" class="text-right">Jumlah</th>
                        <th width="15%">Tanggal</th>
                        <th width="10%" class="text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $no = 1;
                    while ($row = $pengeluaran_result->fetch_assoc()):
                    ?>
                        <tr>
                            <td><?php echo $no++; ?></td>
                            <td><?php echo sanitizeInput($row['deskripsi']); ?></td>
                            <td><span class="badge badge-warning"><?php echo sanitizeInput($row['kategori']); ?></span></td>
                            <td class="text-right text-danger"><strong><?php echo formatRupiah($row['jumlah']); ?></strong></td>
                            <td><?php echo formatTanggal($row['tanggal']); ?></td>
                            <td class="text-center">
                                <form method="POST" style="display:inline;" 
                                      onsubmit="return confirm('Yakin ingin menghapus?');">
                                    <input type="hidden" name="action" value="delete_pengeluaran">
                                    <input type="hidden" name="id" value="<?php echo $row['id']; ?>">
                                    <button type="submit" class="btn btn-sm btn-danger">🗑️</button>
                                </form>
                            </td>
                        </tr>
                    <?php endwhile; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <p>📭 Belum ada riwayat pengeluaran</p>
        </div>
    <?php endif; ?>
</section>
