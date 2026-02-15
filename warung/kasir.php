<?php
/**
 * Sistem Kasir (POS) - API Endpoint
 * Handles AJAX requests for product data and transaction processing
 * Used by pages/kasir.php
 */

require_once 'config.php';
require_once 'session.php';

// Only handle POST requests for API
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Check if user is logged in
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

header('Content-Type: application/json');
$action = $_POST['action'] ?? '';

$db = getDB();

// Get all products
if ($action === 'get_products') {
    $result = $db->query("SELECT id, nama, harga_jual, stok FROM produk ORDER BY nama");
    $products = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $products[] = $row;
        }
    }
    echo json_encode($products);
    exit;
}

// Save transaction
if ($action === 'save_transaction') {
    $items = json_decode($_POST['items'] ?? '[]', true);
    $total = floatval($_POST['total'] ?? 0);
    $payment = floatval($_POST['payment'] ?? 0);
    $change = floatval($_POST['change'] ?? 0);
    
    if (empty($items) || $total <= 0) {
        echo json_encode(['success' => false, 'message' => 'Transaksi tidak valid']);
        exit;
    }
    
    $db->begin_transaction();
    
    try {
        $stmt = $db->prepare("INSERT INTO pemasukkan (deskripsi, jumlah) VALUES (?, ?)");
        
        $description = 'Penjualan - ' . count($items) . ' item';
        $stmt->bind_param('sd', $description, $total);
        
        if (!$stmt->execute()) {
            throw new Exception("Gagal menyimpan transaksi");
        }
        
        $transaction_id = $db->insert_id;
        
        foreach ($items as $item) {
            $product_id = intval($item['id']);
            $quantity = intval($item['quantity']);
            
            $update_stmt = $db->prepare("UPDATE produk SET stok = stok - ? WHERE id = ? AND stok >= ?");
            $update_stmt->bind_param('iii', $quantity, $product_id, $quantity);
            
            if (!$update_stmt->execute()) {
                throw new Exception("Stok tidak cukup");
            }
            
            $inv_stmt = $db->prepare("INSERT INTO stok_keluar (produk_id, jumlah, harga_satuan, total_harga) VALUES (?, ?, ?, ?)");
            $item_price = floatval($item['price']);
            $item_total = $item_price * $quantity;
            $inv_stmt->bind_param('iddd', $product_id, $quantity, $item_price, $item_total);
            $inv_stmt->execute();
        }
        
        $db->commit();
        
        echo json_encode(['success' => true, 'message' => 'Transaksi berhasil', 'transaction_id' => $transaction_id]);
        
    } catch (Exception $e) {
        $db->rollback();
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// Invalid action
echo json_encode(['error' => 'Invalid action']);
?>
