<?php
$message = '';
$message_type = '';

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    try {
        $action = sanitizeInput($_POST['action'] ?? '');
        
        if ($action === 'add') {
            $nama = isset($_POST['nama']) ? sanitizeInput($_POST['nama']) : '';
            $harga_beli = isset($_POST['harga_beli']) ? floatval($_POST['harga_beli']) : 0;
            $harga_jual = isset($_POST['harga_jual']) ? floatval($_POST['harga_jual']) : 0;
            
            if (empty($nama) || $harga_beli <= 0 || $harga_jual <= 0) {
                throw new Exception('Semua data harus diisi dengan nilai yang valid');
            }
            
            $stmt = $conn->prepare("INSERT INTO produk (nama, harga_beli, harga_jual) VALUES (?, ?, ?)");
            $stmt->bind_param("sdd", $nama, $harga_beli, $harga_jual);
            
            if ($stmt->execute()) {
                $message = "✓ Produk berhasil ditambahkan!";
                $message_type = "success";
            } else {
                throw new Exception($stmt->error);
            }
            
        } elseif ($action === 'edit') {
            $id = isset($_POST['id']) ? intval($_POST['id']) : 0;
            $nama = isset($_POST['nama']) ? sanitizeInput($_POST['nama']) : '';
            $harga_beli = isset($_POST['harga_beli']) ? floatval($_POST['harga_beli']) : 0;
            $harga_jual = isset($_POST['harga_jual']) ? floatval($_POST['harga_jual']) : 0;
            
            if ($id <= 0 || empty($nama) || $harga_beli <= 0 || $harga_jual <= 0) {
                throw new Exception('Semua data harus diisi dengan nilai yang valid');
            }
            
            $stmt = $conn->prepare("UPDATE produk SET nama = ?, harga_beli = ?, harga_jual = ? WHERE id = ?");
            $stmt->bind_param("sddi", $nama, $harga_beli, $harga_jual, $id);
            
            if ($stmt->execute()) {
                $message = "✓ Produk berhasil diperbarui!";
                $message_type = "success";
            } else {
                throw new Exception($stmt->error);
            }
            
        } elseif ($action === 'delete') {
            $id = isset($_POST['id']) ? intval($_POST['id']) : 0;
            
            if ($id <= 0) {
                throw new Exception('ID produk tidak valid');
            }
            
            $stmt = $conn->prepare("DELETE FROM produk WHERE id = ?");
            $stmt->bind_param("i", $id);
            
            if ($stmt->execute()) {
                $message = "✓ Produk berhasil dihapus!";
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

// Fetch all products
$stmt = $conn->prepare("SELECT id, nama, harga_beli, harga_jual, stok FROM produk ORDER BY nama ASC");
$stmt->execute();
$products_result = $stmt->get_result();
?>

<h2>📦 Manajemen Produk</h2>

<?php if ($message): ?>
    <div class="alert alert-<?php echo $message_type; ?>">
        <span><?php echo $message; ?></span>
        <button type="button" class="alert-close" onclick="this.parentElement.style.display='none';">&times;</button>
    </div>
<?php endif; ?>

<!-- Form Section -->
<section class="form-section">
    <h3>Tambah/Edit Produk</h3>
    <form method="POST" class="form-grid" id="produkForm">
        <input type="hidden" name="action" value="add">
        <input type="hidden" name="id" id="id" value="">
        
        <input type="text" name="nama" id="nama" placeholder="Nama Produk" required aria-label="Nama Produk">
        
        <input type="text" inputmode="numeric" name="harga_beli" id="harga_beli" placeholder="Harga Beli (Rp)" 
               min="0" required aria-label="Harga Beli">
        
        <input type="text" inputmode="numeric" name="harga_jual" id="harga_jual" placeholder="Harga Jual (Rp)" 
               min="0" required aria-label="Harga Jual">
        
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Simpan Produk</button>
            <button type="button" class="btn btn-secondary" onclick="resetForm()">🔄 Reset</button>
        </div>
    </form>
    
    <!-- Timestamp Display -->
    <div class="timestamp-display">
        🕐 Waktu Input: <strong id="currentTime"><?php echo date('d/m/Y H:i:s'); ?></strong>
    </div>
</section>

<!-- Table Section -->
<section class="table-section">
    <h3>📋 Daftar Produk</h3>
    
    <?php if ($products_result->num_rows > 0): ?>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th width="5%">No</th>
                        <th width="35%">Nama Produk</th>
                        <th width="15%" class="text-right">Harga Beli</th>
                        <th width="15%" class="text-right">Harga Jual</th>
                        <th width="10%" class="text-center">Stok</th>
                        <th width="20%" class="text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $no = 1;
                    while ($row = $products_result->fetch_assoc()):
                        $profit = $row['harga_jual'] - $row['harga_beli'];
                        $profit_class = $profit > 0 ? 'text-success' : 'text-danger';
                    ?>
                        <tr>
                            <td><?php echo $no++; ?></td>
                            <td><strong><?php echo sanitizeInput($row['nama']); ?></strong></td>
                            <td class="text-right"><?php echo formatRupiah($row['harga_beli']); ?></td>
                            <td class="text-right <?php echo $profit_class; ?>">
                                <?php echo formatRupiah($row['harga_jual']); ?>
                            </td>
                            <td class="text-center">
                                <span class="badge <?php echo $row['stok'] > 0 ? 'badge-info' : 'badge-warning'; ?>">
                                    <?php echo $row['stok']; ?>
                                </span>
                            </td>
                            <td class="text-center action-buttons">
                                <button class="btn btn-sm btn-primary" 
                                        onclick='editProduk(<?php echo json_encode($row); ?>)' 
                                        title="Edit Produk"
                                        data-icon="✏️"><span class="btn-text">✏️ Edit</span></button>
                                
                                <form method="POST" style="display:inline;" 
                                      onsubmit="return confirm('Yakin ingin menghapus produk ini? Stok akan direset.');">
                                    <input type="hidden" name="action" value="delete">
                                    <input type="hidden" name="id" value="<?php echo $row['id']; ?>">
                                    <button type="submit" class="btn btn-sm btn-danger" title="Hapus Produk" data-icon="🗑️"><span class="btn-text">🗑️ Hapus</span></button>
                                </form>
                            </td>
                        </tr>
                    <?php endwhile; ?>
                </tbody>
            </table>
        </div>
    <?php else: ?>
        <div class="empty-state">
            <p>📭 Belum ada produk. Silakan tambahkan produk baru di atas.</p>
        </div>
    <?php endif; ?>
</section>

<script>
function editProduk(produk) {
    document.querySelector('input[name="action"]').value = 'edit';
    document.getElementById('id').value = produk.id;
    document.getElementById('nama').value = produk.nama;
    document.getElementById('harga_beli').value = produk.harga_beli;
    document.getElementById('harga_jual').value = produk.harga_jual;
    
    const btn = document.querySelector('#produkForm button[type="submit"]');
    btn.textContent = '✏️ Update Produk';
    
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('nama').focus();
}

function resetForm() {
    document.querySelector('input[name="action"]').value = 'add';
    document.getElementById('id').value = '';
    document.getElementById('nama').value = '';
    document.getElementById('harga_beli').value = '';
    document.getElementById('harga_jual').value = '';
    
    const btn = document.querySelector('#produkForm button[type="submit"]');
    btn.textContent = '💾 Simpan Produk';
    
    document.getElementById('nama').focus();
}
</script>
