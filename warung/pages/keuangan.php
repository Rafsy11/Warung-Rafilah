<?php
$message = '';
$message_type = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    try {
        $action = sanitizeInput($_POST['action'] ?? '');

        if ($action === 'pemasukkan') {
            $deskripsi = isset($_POST['deskripsi']) ? sanitizeInput($_POST['deskripsi']) : '';
            $jumlah = isset($_POST['jumlah']) ? floatval($_POST['jumlah']) : 0;
            $kategori = isset($_POST['kategori']) ? sanitizeInput($_POST['kategori']) : '';

            if (empty($deskripsi) || $jumlah <= 0 || empty($kategori)) {
                throw new Exception('Semua data harus diisi dengan nilai yang valid.');
            }

            $stmt = $conn->prepare("INSERT INTO pemasukkan (deskripsi, jumlah, kategori) VALUES (?, ?, ?)");
            $stmt->bind_param("sds", $deskripsi, $jumlah, $kategori);

            if ($stmt->execute()) {
                $message = 'Pemasukan berhasil dicatat.';
                $message_type = 'success';
            } else {
                throw new Exception($stmt->error);
            }
        } elseif ($action === 'pengeluaran') {
            $deskripsi = isset($_POST['deskripsi']) ? sanitizeInput($_POST['deskripsi']) : '';
            $jumlah = isset($_POST['jumlah']) ? floatval($_POST['jumlah']) : 0;
            $kategori = isset($_POST['kategori']) ? sanitizeInput($_POST['kategori']) : '';

            if (empty($deskripsi) || $jumlah <= 0 || empty($kategori)) {
                throw new Exception('Semua data harus diisi dengan nilai yang valid.');
            }

            $stmt = $conn->prepare("INSERT INTO pengeluaran (deskripsi, jumlah, kategori) VALUES (?, ?, ?)");
            $stmt->bind_param("sds", $deskripsi, $jumlah, $kategori);

            if ($stmt->execute()) {
                $message = 'Pengeluaran berhasil dicatat.';
                $message_type = 'success';
            } else {
                throw new Exception($stmt->error);
            }
        } elseif ($action === 'delete_pemasukkan' || $action === 'delete_pengeluaran') {
            $id = intval($_POST['id'] ?? 0);

            if ($id <= 0) {
                throw new Exception('ID transaksi tidak valid.');
            }

            $table = ($action === 'delete_pemasukkan') ? 'pemasukkan' : 'pengeluaran';
            $stmt = $conn->prepare("DELETE FROM {$table} WHERE id = ?");
            $stmt->bind_param("i", $id);

            if ($stmt->execute()) {
                $message = 'Data keuangan berhasil dihapus.';
                $message_type = 'success';
            } else {
                throw new Exception($stmt->error);
            }
        }
    } catch (Exception $e) {
        $message = 'Error: ' . htmlspecialchars($e->getMessage());
        $message_type = 'error';
    }
}

$stmt = $conn->prepare("SELECT id, deskripsi, kategori, jumlah, tanggal FROM pemasukkan ORDER BY tanggal DESC");
$stmt->execute();
$pemasukkan_result = $stmt->get_result();

$stmt = $conn->prepare("SELECT id, deskripsi, kategori, jumlah, tanggal FROM pengeluaran ORDER BY tanggal DESC");
$stmt->execute();
$pengeluaran_result = $stmt->get_result();
?>

<h2>Manajemen Keuangan</h2>
<p class="page-lead">
    Simpan pemasukan dan pengeluaran dengan kategori yang jelas supaya cashflow toko mudah dipantau.
</p>

<?php if ($message): ?>
    <div class="alert alert-<?php echo $message_type; ?>">
        <span><?php echo $message; ?></span>
        <button type="button" class="alert-close" onclick="this.parentElement.remove();">&times;</button>
    </div>
<?php endif; ?>

<section class="form-section">
    <h3>Catat Pemasukan</h3>
    <form method="POST" class="form-grid">
        <input type="hidden" name="action" value="pemasukkan">

        <input type="text" name="deskripsi" placeholder="Deskripsi pemasukan" required aria-label="Deskripsi">

        <select name="kategori" required aria-label="Kategori Pemasukan">
            <option value="">Pilih kategori</option>
            <option value="Penjualan">Penjualan</option>
            <option value="Investasi">Investasi</option>
            <option value="Bonus">Bonus</option>
            <option value="Lainnya">Lainnya</option>
        </select>

        <input type="text" inputmode="numeric" name="jumlah" placeholder="Jumlah (Rp)" min="0" required aria-label="Jumlah">

        <button type="submit" class="btn btn-primary">Catat pemasukan</button>
    </form>
    <div class="timestamp-display">
        Waktu input: <strong><?php echo date('d/m/Y H:i:s'); ?></strong>
    </div>
</section>

<section class="table-section">
    <h3>Riwayat Pemasukan</h3>

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
                                <form method="POST" style="display:inline;" onsubmit="return confirm('Yakin ingin menghapus data ini?');">
                                    <input type="hidden" name="action" value="delete_pemasukkan">
                                    <input type="hidden" name="id" value="<?php echo $row['id']; ?>">
                                    <button type="submit" class="btn btn-sm btn-danger">Hapus</button>
                                </form>
                            </td>
                        </tr>
                    <?php endwhile; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            Belum ada riwayat pemasukan.
        </div>
    <?php endif; ?>
</section>

<section class="form-section">
    <h3>Catat Pengeluaran</h3>
    <form method="POST" class="form-grid">
        <input type="hidden" name="action" value="pengeluaran">

        <input type="text" name="deskripsi" placeholder="Deskripsi pengeluaran" required aria-label="Deskripsi">

        <select name="kategori" required aria-label="Kategori Pengeluaran">
            <option value="">Pilih kategori</option>
            <option value="Operasional">Operasional</option>
            <option value="Gaji">Gaji</option>
            <option value="Utilitas">Utilitas</option>
            <option value="Pemeliharaan">Pemeliharaan</option>
            <option value="Lainnya">Lainnya</option>
        </select>

        <input type="text" inputmode="numeric" name="jumlah" placeholder="Jumlah (Rp)" min="0" required aria-label="Jumlah">

        <button type="submit" class="btn btn-primary">Catat pengeluaran</button>
    </form>
    <div class="timestamp-display">
        Waktu input: <strong><?php echo date('d/m/Y H:i:s'); ?></strong>
    </div>
</section>

<section class="table-section">
    <h3>Riwayat Pengeluaran</h3>

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
                                <form method="POST" style="display:inline;" onsubmit="return confirm('Yakin ingin menghapus data ini?');">
                                    <input type="hidden" name="action" value="delete_pengeluaran">
                                    <input type="hidden" name="id" value="<?php echo $row['id']; ?>">
                                    <button type="submit" class="btn btn-sm btn-danger">Hapus</button>
                                </form>
                            </td>
                        </tr>
                    <?php endwhile; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            Belum ada riwayat pengeluaran.
        </div>
    <?php endif; ?>
</section>

<script src="/warung/assets/scroll-restoration.js"></script>

<script>
window.addEventListener('DOMContentLoaded', () => {
    if (window.scrollRestoration) {
        // Hook kept for future custom settings.
    }
});
</script>
