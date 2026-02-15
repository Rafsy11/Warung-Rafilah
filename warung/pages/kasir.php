<h2>💳 Sistem Kasir (POS)</h2>

<style>
.kasir-container {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 20px;
    height: calc(100vh - 300px);
}

.kasir-products {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.search-section {
    background: var(--card-bg);
    padding: 15px;
    border-radius: 10px;
    box-shadow: var(--shadow);
}

.search-box {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
}

.search-box input {
    padding: 10px 12px;
    border: 2px solid var(--border);
    border-radius: 8px;
    background: var(--input-bg);
    color: var(--text-color);
    font-size: 14px;
    transition: border-color 0.3s;
}

.search-box input:focus {
    outline: none;
    border-color: var(--primary);
}

.search-box button {
    padding: 10px 15px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    transition: background 0.3s;
}

.search-box button:hover {
    background: var(--primary-dark);
}

.products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
    max-height: 600px;
    overflow-y: auto;
    padding: 5px;
}

.product-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 12px;
    padding: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.35);
    color: white;
    position: relative;
    overflow: hidden;
}

.product-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.1);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.product-card:hover {
    transform: translateY(-5px) scale(1.02);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5);
}

.product-card:hover::before {
    opacity: 1;
}

.product-card.no-stock {
    background: linear-gradient(135deg, #ccc 0%, #999 100%);
    box-shadow: 0 4px 15px rgba(150, 150, 150, 0.35);
    opacity: 0.7;
    cursor: not-allowed;
}

.product-name {
    font-weight: 700;
    color: white;
    margin-bottom: 8px;
    font-size: 14px;
    word-break: break-word;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.product-price {
    font-size: 16px;
    color: #ffd700;
    font-weight: 800;
    margin-bottom: 8px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.product-stock {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 8px;
    font-weight: 500;
}

.btn-add {
    background: white;
    color: #667eea;
    border: 2px solid white;
    padding: 10px 8px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    transition: all 0.3s ease;
    width: 100%;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.product-card:hover .btn-add {
    background: #ffd700;
    color: #333;
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
}

.product-card.no-stock .btn-add,
.btn-add:disabled {
    background: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.6);
    cursor: not-allowed;
    border-color: rgba(255, 255, 255, 0.3);
}

.btn-add:hover:not(:disabled) {
    background: #ffd700;
    transform: scale(1.05);
}

/* Cart Sidebar */
.cart-sidebar {
    background: var(--card-bg);
    border-radius: 10px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    max-height: calc(100vh - 300px);
    border: 2px solid var(--border);
}

.cart-header {
    background: var(--primary);
    color: white;
    padding: 15px;
    font-weight: 600;
    font-size: 16px;
}

.cart-items {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.cart-item {
    background: rgba(102, 126, 234, 0.05);
    padding: 12px;
    margin-bottom: 0;
    border-radius: 6px;
    border: 1px solid rgba(102, 126, 234, 0.15);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 12px;
}

.cart-item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
}

.cart-item-info {
    flex: 1;
    min-width: 0;
}

.cart-item-name {
    font-weight: 700;
    color: var(--text-color);
    word-break: break-word;
    font-size: 13px;
}

.cart-item-price {
    color: var(--primary);
    font-size: 12px;
    margin-top: 2px;
    font-weight: 600;
}

.cart-item-qty {
    display: flex;
    align-items: center;
    gap: 0;
    background: white;
    border-radius: 6px 0 0 6px;
    border: 2px solid var(--primary);
    border-right: none;
    padding: 0;
}

.qty-btn {
    background: var(--primary);
    border: none;
    cursor: pointer;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: white;
    transition: all 0.2s ease;
    font-size: 14px;
    border-radius: 0;
    flex-shrink: 0;
}

.qty-btn:first-child {
    border-radius: 5px 0 0 5px;
}

.qty-btn:hover {
    background: #5568d3;
    transform: scale(0.98);
}

.qty-btn:active {
    transform: scale(0.95);
}

.qty-input {
    width: 40px;
    border: none;
    border-radius: 0;
    text-align: center;
    font-weight: 600;
    color: var(--primary);
    background: white;
    font-size: 13px;
    padding: 8px 4px;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.qty-input:focus {
    outline: none;
}

.cart-item-controls {
    display: flex;
    align-items: center;
    gap: 0;
}

.cart-item-total {
    font-weight: 700;
    color: var(--primary);
    font-size: 13px;
    padding-top: 8px;
    border-top: 1px solid rgba(102, 126, 234, 0.2);
}

.btn-remove-item {
    background: #ff4444;
    color: white;
    border: 2px solid #ff4444;
    width: 40px;
    height: 40px;
    border-radius: 0 6px 6px 0;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
}

.btn-remove-item:hover {
    background: #cc0000;
    border-color: #cc0000;
    transform: scale(0.98);
}

.empty-cart {
    text-align: center;
    padding: 40px 10px;
    color: var(--text-muted);
    font-size: 13px;
}

.empty-cart-icon {
    font-size: 48px;
    margin-bottom: 10px;
}

.cart-footer {
    background: var(--input-bg);
    padding: 15px;
    border-top: 1px solid var(--border);
}

.summary-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 12px;
}

.summary-row.total {
    border-top: 2px solid var(--border);
    padding-top: 8px;
    font-weight: 700;
    font-size: 14px;
    color: var(--primary);
}

.cart-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 15px;
}

.btn-action {
    padding: 10px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 12px;
    transition: all 0.3s;
}

.btn-clear {
    background: var(--border);
    color: var(--text-color);
}

.btn-clear:hover {
    background: #cbd5e1;
}

.btn-pay {
    background: var(--success);
    color: white;
    grid-column: 1 / -1;
}

.btn-pay:hover {
    background: #047857;
}

/* Modal */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 1000;
    align-items: center;
    justify-content: center;
}

.modal.active {
    display: flex;
}

.modal-content {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 25px;
    max-width: 450px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease;
    color: var(--text-color);
}

@keyframes slideUp {
    from {
        transform: translateY(50px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.modal-header {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 20px;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
    font-size: 13px;
    color: var(--text-color);
}

.form-group input {
    width: 100%;
    padding: 10px;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 13px;
    background: var(--card-bg);
    color: var(--text-color);
    transition: border-color 0.3s;
}

.form-group input:focus {
    outline: none;
    border-color: var(--primary);
}

.payment-info {
    background: var(--input-bg);
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 12px;
}

.payment-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
}

.payment-row.total {
    font-weight: 700;
    font-size: 16px;
    color: var(--primary);
    border-top: 2px solid var(--border);
    padding-top: 8px;
}

.payment-row.change {
    color: var(--success);
    font-weight: 700;
}

.modal-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 20px;
}

.btn {
    padding: 10px 15px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    transition: all 0.3s;
}

.btn-primary {
    background: var(--primary);
    color: white;
}

.btn-primary:hover {
    background: var(--primary-dark);
}

.btn-secondary {
    background: var(--border);
    color: var(--text-color);
}

.btn-secondary:hover {
    background: #cbd5e1;
}

.btn-success {
    background: var(--success);
    color: white;
    grid-column: 1 / -1;
}

.btn-success:hover {
    background: #047857;
}

/* Alert */
.alert-box {
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 999;
    max-width: 400px;
}

.alert {
    padding: 12px 15px;
    border-radius: 6px;
    margin-bottom: 10px;
    font-size: 13px;
    animation: slideDown 0.3s ease;
}

@keyframes slideDown {
    from {
        transform: translateY(-10px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.alert-success {
    background: var(--success);
    color: white;
}

.alert-error {
    background: var(--danger);
    color: white;
}

.alert-info {
    background: var(--primary);
    color: white;
}

/* Loading */
.loading {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 2px solid var(--border);
    border-top: 2px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 1024px) {
    .kasir-container {
        grid-template-columns: 1fr;
        height: auto;
    }

    .cart-sidebar {
        display: none !important;
    }

    .products-grid {
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    }
}

/* Mobile Responsive */
@media (max-width: 768px) {
    .kasir-container {
        grid-template-columns: 1fr;
        gap: 10px;
        padding: 10px;
        height: auto;
    }

    .kasir-products {
        gap: 10px;
    }

    .search-section {
        padding: 10px;
    }

    .search-box {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
    }

    .search-box input {
        padding: 10px 12px;
        border-radius: 6px;
    }

    .search-box button {
        padding: 10px 12px;
        border-radius: 6px;
    }

    .products-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        max-height: 400px;
        padding-bottom: 100px;
    }

    .product-card {
        padding: 12px;
    }

    .product-name {
        font-size: 12px;
    }

    .product-price {
        font-size: 14px;
    }

    .product-stock {
        font-size: 10px;
    }

    .btn-add {
        padding: 10px;
        font-size: 13px;
        min-height: 44px;
    }

    /* Hide cart sidebar on mobile */
    .cart-sidebar {
        display: none !important;
    }

    /* Bottom Cart Bar */
    .cart-bottom-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--card-bg);
        border-top: 2px solid var(--primary);
        z-index: 98;
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
        display: none;
        flex-direction: column;
        max-height: 60vh;
        overflow: hidden;
    }

    .cart-bottom-bar.active {
        display: flex;
    }

    .cart-bottom-items-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .cart-bottom-item {
        background: rgba(102, 126, 234, 0.05);
        padding: 6px;
        border-radius: 4px;
        border: 1px solid rgba(102, 126, 234, 0.15);
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .cart-bottom-item-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 4px;
    }

    .cart-bottom-item-name {
        font-weight: 600;
        font-size: 10px;
        color: var(--text-color);
        flex: 1;
    }

    .cart-bottom-item-price {
        font-size: 9px;
        color: var(--text-muted);
        white-space: nowrap;
    }

    .cart-bottom-item-controls {
        display: flex;
        align-items: center;
        gap: 3px;
    }

    .cart-bottom-qty-btn {
        background: var(--primary);
        color: white;
        border: none;
        width: 28px;
        height: 28px;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 11px;
        line-height: 1;
        flex-shrink: 0;
        border-radius: 3px;
    }

    .cart-bottom-qty-input {
        width: 28px;
        height: 28px;
        border: 1px solid var(--primary);
        text-align: center;
        font-weight: 600;
        padding: 0;
        font-size: 10px;
        line-height: 26px;
        flex-shrink: 0;
    }

    .cart-bottom-item-total {
        font-weight: 700;
        font-size: 9px;
        color: var(--primary);
        white-space: nowrap;
    }

    .cart-bottom-item-delete {
        background: #ff4444;
        color: white;
        border: none;
        width: 28px;
        height: 28px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        border-radius: 3px;
        flex-shrink: 0;
    }

    .cart-bottom-footer {
        background: var(--input-bg);
        padding: 8px;
        border-top: 1px solid var(--border);
    }

    .cart-bottom-summary-line {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 8px;
        color: var(--primary);
    }

    .cart-bottom-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
    }

    .cart-bottom-btn-clear {
        background: var(--border);
        color: var(--text-color);
        border: none;
        padding: 8px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 11px;
        cursor: pointer;
        min-height: 36px;
    }

    .cart-bottom-btn-pay {
        background: var(--success);
        color: white;
        border: none;
        padding: 8px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 11px;
        cursor: pointer;
        min-height: 36px;
    }

    /* Cart Detail Modal */
    .cart-detail-overlay {
        display: none !important;
    }

    .cart-detail-sheet {
        display: none !important;
        visibility: hidden !important;
    }

    .cart-detail-header {
        display: none !important;
    }

    .cart-detail-items {
        display: none !important;
    }

    .cart-detail-footer {
        display: none !important;
    }

    .cart-detail-close {
        display: none !important;
    }

    .cart-detail-items {
        display: none !important;
    }

    .cart-detail-item {
        display: none !important;
    }

    .cart-detail-item-name {
        display: none !important;
    }

    .cart-detail-item-price {
        display: none !important;
    }

    .cart-detail-item-controls {
        display: none !important;
    }

    .cart-detail-item-qty {
        display: none !important;
    }

    .cart-detail-qty-btn {
        display: none !important;
    }

    .cart-detail-qty-input {
        display: none !important;
    }

    .cart-detail-item-total {
        display: none !important;
    }

    .cart-detail-item-delete {
        display: none !important;
    }

    .cart-detail-footer {
        background: var(--input-bg);
        padding: 10px;
        border-top: 1px solid var(--border);
    }

    .cart-detail-summary {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 10px;
    }

    .cart-detail-summary-row {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
    }

    .cart-detail-summary-row.total {
        font-weight: 700;
        font-size: 12px;
        color: var(--primary);
        border-top: 1px solid var(--border);
        padding-top: 4px;
    }

    .cart-detail-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
    }

    .cart-detail-btn {
        display: none !important;
    }

    .cart-detail-btn-clear {
        display: none !important;
    }

    .cart-detail-btn-pay {
        display: none !important;
    }

    .cart-detail-actions {
        display: none !important;
    }

    .cart-detail-summary {
        display: none !important;
    }

    .cart-detail-summary-row {
        display: none !important;
    }

    .modal-content {
        width: 90%;
        padding: 15px;
    }

    .btn {
        min-height: 44px;
        font-size: 13px;
    }

    /* Hide cart detail sheet on mobile */
    .cart-detail-overlay {
        display: none !important;
    }

    .cart-detail-sheet {
        display: none !important;
    }
}

/* Receipt Styling - SIMPLE INVOICE */
.receipt {
    background: white;
    padding: 8px;
    max-width: 400px;
    margin: 0 auto;
    font-family: 'Courier New', monospace;
    font-size: 10px;
    line-height: 1.2;
    color: #000;
}

.receipt-header {
    text-align: center;
    margin-bottom: 4px;
}

.receipt-title {
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 2px;
}

.receipt-items {
    margin-bottom: 3px;
}

.receipt-item {
    margin-bottom: 1px;
    font-size: 9px;
}

.receipt-summary {
    margin-bottom: 2px;
}

.receipt-footer {
    text-align: center;
    font-size: 9px;
    margin-top: 2px;
}

/* PRINT STYLE - 48MM THERMAL PAPER - SIMPLE */
@media print {
    /* reset and ensure white background */
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #fff; color: #000; }

    /* Hide everything on the page */
    body > * { display: none !important; }

    /* Explicitly hide common overlay/backdrop elements */
    .modal-backdrop, .overlay, .backdrop, .modal { display: none !important; }

    /* Reveal only the receipt content for printing */
    #receiptContent, #receiptContent * { display: block !important; visibility: visible !important; }
    #receiptContent { position: absolute !important; left: 0; top: 0; width: 48mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; color: #000 !important; }

    /* Simple receipt styling */
    .receipt { box-shadow: none !important; border-radius: 0 !important; background: transparent !important; width: 48mm; padding: 2mm 3mm; font-size: 8px; line-height: 1.1; color: #000; }
    .receipt-header { text-align: center; margin-bottom: 2px; }
    .receipt-title { font-size: 10px; font-weight: 700; margin-bottom: 1px; }
    .receipt-items { margin-bottom: 2px; }
    .receipt-item { margin-bottom: 1px; font-size: 8px; }
    .receipt-summary { margin-bottom: 1px; font-size: 8px; }
    .receipt-footer { text-align: center; font-size: 8px; margin-top: 1px; }

    @page { margin: 0; size: 48mm auto; }
}
</style>

<div class="kasir-container">
    <!-- Products Section -->
    <div class="kasir-products">
        <!-- Search Section -->
        <div class="search-section">
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Cari produk..." oninput="searchProducts()">
                <button onclick="loadProducts()" style="background: var(--success);">↻ Refresh</button>
            </div>
        </div>

        <!-- Products Grid -->
        <div class="products-grid" id="productsGrid">
            <div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--text-muted);">
                <div class="loading"></div>
            </div>
        </div>
    </div>

    <!-- Cart Sidebar -->
    <div class="cart-sidebar">
        <div class="cart-header">🛒 Keranjang Belanja</div>

        <div class="cart-items" id="cartItems">
            <div class="empty-cart">
                <div class="empty-cart-icon">🛒</div>
                <div>Keranjang masih kosong</div>
            </div>
        </div>

        <div class="cart-footer">
            <div class="summary-row">
                <label>Subtotal:</label>
                <span id="subtotal">Rp 0</span>
            </div>
            <div class="summary-row">
                <label>PPN (0%):</label>
                <span id="tax">Rp 0</span>
            </div>
            <div class="summary-row total">
                <label>Total:</label>
                <span id="totalPrice">Rp 0</span>
            </div>
            <div class="cart-actions">
                <button class="btn-action btn-clear" onclick="clearCart()">Batal</button>
                <button class="btn-action btn-pay" onclick="openPaymentModal()">Bayar</button>
            </div>
        </div>
    </div>
</div>

<!-- Mobile Bottom Cart Bar -->
<div class="cart-bottom-bar" id="cartBottomBar">
    <div class="cart-bottom-items-list" id="cartBottomItemsList"></div>
    <div class="cart-bottom-footer">
        <div class="cart-bottom-summary-line">
            <span>Total:</span>
            <span id="mobileCartTotalAmount">Rp 0</span>
        </div>
        <div class="cart-bottom-actions">
            <button class="cart-bottom-btn-clear" onclick="clearCart()">Batal</button>
            <button class="cart-bottom-btn-pay" onclick="openPaymentModal()">Bayar</button>
        </div>
    </div>
</div>

<!-- Cart Detail Sheet -->
<div class="cart-detail-overlay" id="cartDetailOverlay" onclick="toggleCartDetail()"></div>
<div class="cart-detail-sheet" id="cartDetailSheet">
    <div class="cart-detail-header">
        🛒 Keranjang Belanja
        <button class="cart-detail-close" onclick="toggleCartDetail()">✕</button>
    </div>
    <div class="cart-detail-items" id="cartDetailItems">
        <div style="text-align: center; padding: 20px; color: var(--text-muted);">Keranjang kosong</div>
    </div>
    <div class="cart-detail-footer">
        <div class="cart-detail-summary">
            <div class="cart-detail-summary-row">
                <label>Subtotal:</label>
                <span id="detailSubtotal">Rp 0</span>
            </div>
            <div class="cart-detail-summary-row">
                <label>PPN (0%):</label>
                <span id="detailTax">Rp 0</span>
            </div>
            <div class="cart-detail-summary-row total">
                <label>Total:</label>
                <span id="detailTotal">Rp 0</span>
            </div>
        </div>
        <div class="cart-detail-actions">
            <button class="cart-detail-btn cart-detail-btn-clear" onclick="clearCart()">Batal</button>
            <button class="cart-detail-btn cart-detail-btn-pay" onclick="openPaymentModal()">Bayar</button>
        </div>
    </div>
</div>
<div class="alert-box" id="alertBox"></div>



<!-- Payment Modal -->
<div class="modal" id="paymentModal">
    <div class="modal-content">
        <div class="modal-header">💳 Konfirmasi Pembayaran</div>

        <div class="payment-info" id="paymentSummary">
            <div class="payment-row">
                <label>Total Harga:</label>
                <span id="modalTotal">Rp 0</span>
            </div>
            <div class="payment-row">
                <label>Jumlah Item:</label>
                <span id="modalItemCount">0</span>
            </div>
        </div>

        <div class="form-group">
            <label>Jumlah Pembayaran</label>
            <input type="text" id="paymentAmount" placeholder="Masukkan jumlah pembayaran" oninput="formatInputNumber(event); calculateChange()">
        </div>

        <div class="payment-info">
            <div class="payment-row">
                <label>Total:</label>
                <span id="displayTotal">Rp 0</span>
            </div>
            <div class="payment-row change" id="changeRow" style="display: none;">
                <label>Kembalian:</label>
                <span id="displayChange">Rp 0</span>
            </div>
        </div>

        <div class="modal-buttons">
            <button class="btn btn-secondary" onclick="closePaymentModal()">Batal</button>
            <button class="btn btn-success" onclick="processPayment()">Selesaikan</button>
        </div>
    </div>
</div>

<!-- Receipt Modal -->
<div class="modal" id="receiptModal">
    <div class="modal-content" style="max-width: 300px; text-align: center;">
        <h3 style="margin-bottom: 15px;">✓ Transaksi Berhasil</h3>
        <p style="margin-bottom: 20px; color: #666;">Nota telah dibuka di jendela baru untuk dicetak</p>
        <button class="btn btn-primary" onclick="completeTransaction()" style="width: 100%;">Transaksi Baru</button>
    </div>
</div>

<script>
// ========== APPLICATION STATE ==========
const app = {
    products: [],
    cart: [],
    currentTransaction: null
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    loadProducts();
});

// ========== UTILITY FUNCTIONS ==========
function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

function formatNumberWithSeparator(value) {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseFormattedNumber(value) {
    return parseInt(value.toString().replace(/\./g, '')) || 0;
}

function formatInputNumber(event) {
    let value = event.target.value.replace(/\D/g, '');
    if (value) {
        value = formatNumberWithSeparator(value);
    }
    event.target.value = value;
}

function showAlert(message, type = 'success') {
    const alertBox = document.getElementById('alertBox');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alertBox.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 4000);
}

// ========== PRODUCT MANAGEMENT ==========
function loadProducts() {
    const form = new FormData();
    form.append('action', 'get_products');

    console.log('Loading products from: /warung/kasir.php');
    
    fetch('/warung/kasir.php', {
        method: 'POST',
        body: form
    })
    .then(response => {
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.text().then(text => {
            console.log('Response text:', text);
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Failed to parse JSON:', e);
                throw new Error('Invalid JSON response: ' + text.substring(0, 200));
            }
        });
    })
    .then(data => {
        console.log('Products loaded:', data);
        app.products = data;
        renderProducts(data);
    })
    .catch(error => {
        console.error('Error loading products:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        showAlert('Gagal memuat produk: ' + error.message, 'error');
    });
}

function renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = '';

    if (products.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--text-muted);">Tidak ada produk</div>';
        return;
    }

    products.forEach(product => {
        const hasStock = product.stok > 0;
        const div = document.createElement('div');
        div.className = `product-card ${!hasStock ? 'no-stock' : ''}`;
        
        const btn = document.createElement('button');
        btn.className = 'btn-add';
        btn.innerHTML = hasStock ? '➕ Tambah' : '❌ Habis';
        btn.disabled = !hasStock;
        btn.style.cursor = hasStock ? 'pointer' : 'not-allowed';
        
        // Attach data to button for event handler
        btn.dataset.productId = product.id;
        btn.dataset.productName = product.nama;
        btn.dataset.price = product.harga_jual;
        btn.dataset.stock = product.stok;
        
        // Attach click event listener
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log(`Button clicked for product: ${product.nama}`);
            addToCart(product.id, product.nama, product.harga_jual, product.stok);
        });
        
        div.innerHTML = `
            <div class="product-name">${product.nama}</div>
            <div class="product-price">${formatRupiah(product.harga_jual)}</div>
            <div class="product-stock">Stok: ${product.stok}</div>
        `;
        div.appendChild(btn);
        grid.appendChild(div);
        
        // Debug log
        console.log(`Produk: ${product.nama}, ID: ${product.id}, Harga: ${product.harga_jual}, Stok: ${product.stok}, HasStock: ${hasStock}`);
    });
}

function searchProducts() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    
    if (!query) {
        renderProducts(app.products);
        return;
    }

    const filtered = app.products.filter(p => 
        p.nama.toLowerCase().includes(query)
    );
    renderProducts(filtered);
}

// ========== CART MANAGEMENT ==========
function addToCart(productId, productName, price, stock) {
    console.log(`Adding to cart: ID=${productId}, Name=${productName}, Price=${price}, Stock=${stock}`);
    
    let item = app.cart.find(item => item.id === productId);

    if (item) {
        if (item.quantity < stock) {
            item.quantity++;
        } else {
            console.warn(`Stock not enough: ${item.quantity} >= ${stock}`);
            showAlert('Stok tidak cukup!', 'error');
            return;
        }
    } else {
        app.cart.push({
            id: productId,
            name: productName,
            price: price,
            quantity: 1,
            stock: stock
        });
    }

    updateCart();
    showAlert(`${productName} ditambahkan`, 'info');
}

function updateCartItem(productId, quantity) {
    const item = app.cart.find(item => item.id === productId);
    
    if (!item) return;

    quantity = Math.max(1, Math.min(quantity, item.stock));
    item.quantity = quantity;

    updateCart();
}

function removeFromCart(productId) {
    app.cart = app.cart.filter(item => item.id !== productId);
    updateCart();
}

function clearCart() {
    if (app.cart.length === 0) {
        showAlert('Keranjang sudah kosong', 'info');
        return;
    }

    if (confirm('Yakin ingin mengosongkan keranjang?')) {
        app.cart = [];
        updateCart();
    }
}

function updateCart() {
    const cartItems = document.getElementById('cartItems');
    
    if (app.cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-icon">🛒</div>
                <div>Keranjang masih kosong</div>
            </div>
        `;
    } else {
        cartItems.innerHTML = '';
        
        app.cart.forEach(item => {
            const cartItemDiv = document.createElement('div');
            cartItemDiv.className = 'cart-item';
            cartItemDiv.dataset.productId = item.id;
            
            // Header section with name and delete button
            const headerDiv = document.createElement('div');
            headerDiv.className = 'cart-item-header';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'cart-item-info';
            infoDiv.innerHTML = `
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${formatRupiah(item.price)} / barang</div>
            `;
            
            // Quantity control section
            const qtyContainerDiv = document.createElement('div');
            qtyContainerDiv.className = 'cart-item-qty';
            
            const minusBtn = document.createElement('button');
            minusBtn.className = 'qty-btn';
            minusBtn.innerHTML = '−';
            minusBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log(`Minus button clicked for product ID: ${item.id}`);
                updateCartItem(item.id, item.quantity - 1);
            });
            
            const qtyInput = document.createElement('input');
            qtyInput.type = 'text';
            qtyInput.className = 'qty-input';
            qtyInput.value = item.quantity;
            qtyInput.style.textAlign = 'center';
            qtyInput.addEventListener('change', function() {
                let newQty = parseInt(this.value) || 1;
                console.log(`Quantity input changed for product ID: ${item.id} to ${newQty}`);
                updateCartItem(item.id, newQty);
            });
            qtyInput.addEventListener('input', function() {
                // Allow only numbers
                this.value = this.value.replace(/[^0-9]/g, '');
            });
            
            const plusBtn = document.createElement('button');
            plusBtn.className = 'qty-btn';
            plusBtn.innerHTML = '+';
            plusBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log(`Plus button clicked for product ID: ${item.id}`);
                updateCartItem(item.id, item.quantity + 1);
            });
            
            qtyContainerDiv.appendChild(minusBtn);
            qtyContainerDiv.appendChild(qtyInput);
            qtyContainerDiv.appendChild(plusBtn);
            
            // Remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove-item';
            removeBtn.innerHTML = '🗑️';
            removeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log(`Remove button clicked for product ID: ${item.id}`);
                removeFromCart(item.id);
            });
            
            // Controls container - qty + remove in one row
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'cart-item-controls';
            controlsDiv.appendChild(qtyContainerDiv);
            controlsDiv.appendChild(removeBtn);
            
            // Total section
            const totalDiv = document.createElement('div');
            totalDiv.className = 'cart-item-total';
            totalDiv.textContent = `Total: ${formatRupiah(item.price * item.quantity)}`;
            
            // Assemble: header (info), controls (qty + remove), total
            headerDiv.appendChild(infoDiv);
            cartItemDiv.appendChild(headerDiv);
            cartItemDiv.appendChild(controlsDiv);
            cartItemDiv.appendChild(totalDiv);
            
            cartItems.appendChild(cartItemDiv);
        });
    }

    calculateTotals();
}

function calculateTotals() {
    const subtotal = app.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = 0;
    const total = subtotal + tax;

    document.getElementById('subtotal').textContent = formatRupiah(subtotal);
    document.getElementById('tax').textContent = formatRupiah(tax);
    document.getElementById('totalPrice').textContent = formatRupiah(total);

    // Update mobile bottom bar
    updateMobileCartBar();
    updateCartDetail();
}

// ========== MOBILE CART BAR ==========
function updateMobileCartBar() {
    const cartBar = document.getElementById('cartBottomBar');
    const itemsList = document.getElementById('cartBottomItemsList');
    const totalAmount = document.getElementById('mobileCartTotalAmount');
    
    const subtotal = app.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (app.cart.length === 0) {
        cartBar.classList.remove('active');
    } else {
        cartBar.classList.add('active');
        itemsList.innerHTML = '';
        
        app.cart.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-bottom-item';
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'cart-bottom-item-header';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'cart-bottom-item-name';
            nameSpan.textContent = item.name;
            
            const priceSpan = document.createElement('span');
            priceSpan.className = 'cart-bottom-item-price';
            priceSpan.textContent = formatRupiah(item.price);
            
            headerDiv.appendChild(nameSpan);
            headerDiv.appendChild(priceSpan);
            
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'cart-bottom-item-controls';
            
            const minusBtn = document.createElement('button');
            minusBtn.className = 'cart-bottom-qty-btn';
            minusBtn.textContent = '−';
            minusBtn.onclick = (e) => { e.stopPropagation(); updateCartItem(item.id, item.quantity - 1); };
            
            const qtyInput = document.createElement('input');
            qtyInput.type = 'number';
            qtyInput.className = 'cart-bottom-qty-input';
            qtyInput.value = item.quantity;
            qtyInput.onchange = (e) => { let v = parseInt(e.target.value) || 1; updateCartItem(item.id, v); };
            
            const plusBtn = document.createElement('button');
            plusBtn.className = 'cart-bottom-qty-btn';
            plusBtn.textContent = '+';
            plusBtn.onclick = (e) => { e.stopPropagation(); updateCartItem(item.id, item.quantity + 1); };
            
            const totalSpan = document.createElement('span');
            totalSpan.className = 'cart-bottom-item-total';
            totalSpan.textContent = formatRupiah(item.price * item.quantity);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'cart-bottom-item-delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.onclick = (e) => { e.stopPropagation(); removeFromCart(item.id); };
            
            controlsDiv.appendChild(minusBtn);
            controlsDiv.appendChild(qtyInput);
            controlsDiv.appendChild(plusBtn);
            controlsDiv.appendChild(totalSpan);
            controlsDiv.appendChild(deleteBtn);
            
            itemDiv.appendChild(headerDiv);
            itemDiv.appendChild(controlsDiv);
            
            itemsList.appendChild(itemDiv);
        });
        
        totalAmount.textContent = formatRupiah(subtotal);
    }
}

function toggleCartDetail(e) {
    if (e) {
        e.stopPropagation();
    }
    const overlay = document.getElementById('cartDetailOverlay');
    const sheet = document.getElementById('cartDetailSheet');
    
    overlay.classList.toggle('active');
    sheet.classList.toggle('active');
}

function updateCartDetail() {
    const detailItems = document.getElementById('cartDetailItems');
    const subtotal = app.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = 0;
    const total = subtotal + tax;

    if (app.cart.length === 0) {
        detailItems.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Keranjang kosong</div>';
    } else {
        detailItems.innerHTML = '';
        app.cart.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-detail-item';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'cart-detail-item-name';
            nameDiv.textContent = item.name;
            
            const priceDiv = document.createElement('div');
            priceDiv.className = 'cart-detail-item-price';
            priceDiv.textContent = formatRupiah(item.price) + ' / barang';
            
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'cart-detail-item-controls';
            
            const qtyDiv = document.createElement('div');
            qtyDiv.className = 'cart-detail-item-qty';
            
            const minusBtn = document.createElement('button');
            minusBtn.className = 'cart-detail-qty-btn';
            minusBtn.textContent = '−';
            minusBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); updateCartItem(item.id, item.quantity - 1); return false; };
            
            const qtyInput = document.createElement('input');
            qtyInput.type = 'number';
            qtyInput.className = 'cart-detail-qty-input';
            qtyInput.value = item.quantity;
            qtyInput.onchange = (e) => { let v = parseInt(e.target.value) || 1; updateCartItem(item.id, v); };
            
            const plusBtn = document.createElement('button');
            plusBtn.className = 'cart-detail-qty-btn';
            plusBtn.textContent = '+';
            plusBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); updateCartItem(item.id, item.quantity + 1); return false; };
            
            qtyDiv.appendChild(minusBtn);
            qtyDiv.appendChild(qtyInput);
            qtyDiv.appendChild(plusBtn);
            
            const totalDiv = document.createElement('div');
            totalDiv.className = 'cart-detail-item-total';
            totalDiv.textContent = formatRupiah(item.price * item.quantity);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'cart-detail-item-delete';
            deleteBtn.textContent = '🗑️';
            deleteBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); removeFromCart(item.id); return false; };
            
            controlsDiv.appendChild(qtyDiv);
            controlsDiv.appendChild(totalDiv);
            controlsDiv.appendChild(deleteBtn);
            
            itemDiv.appendChild(nameDiv);
            itemDiv.appendChild(priceDiv);
            itemDiv.appendChild(controlsDiv);
            
            detailItems.appendChild(itemDiv);
        });
    }

    document.getElementById('detailSubtotal').textContent = formatRupiah(subtotal);
    document.getElementById('detailTax').textContent = formatRupiah(tax);
    document.getElementById('detailTotal').textContent = formatRupiah(total);
}

// ========== PAYMENT MODAL ==========
function openPaymentModal() {
    if (app.cart.length === 0) {
        showAlert('Tambahkan produk ke keranjang!', 'error');
        return;
    }

    const total = app.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('modalTotal').textContent = formatRupiah(total);
    document.getElementById('modalItemCount').textContent = app.cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('displayTotal').textContent = formatRupiah(total);
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentAmount').focus();
    document.getElementById('changeRow').style.display = 'none';
    
    document.getElementById('paymentModal').classList.add('active');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

function calculateChange() {
    const total = app.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const paymentStr = document.getElementById('paymentAmount').value;
    const payment = parseFormattedNumber(paymentStr);
    const change = payment - total;

    if (payment >= total && payment > 0) {
        document.getElementById('changeRow').style.display = 'flex';
        document.getElementById('displayChange').textContent = formatRupiah(change);
    } else {
        document.getElementById('changeRow').style.display = 'none';
    }
}

function processPayment() {
    const paymentStr = document.getElementById('paymentAmount').value;
    const paymentAmount = parseFormattedNumber(paymentStr);
    const total = app.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (paymentAmount < total) {
        showAlert('Pembayaran tidak cukup!', 'error');
        return;
    }

    const change = paymentAmount - total;
    const items = app.cart.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price
    }));

    const form = new FormData();
    form.append('action', 'save_transaction');
    form.append('items', JSON.stringify(items));
    form.append('total', total);
    form.append('payment', paymentAmount);
    form.append('change', change);

    const btn = event.target;
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>';

    fetch('/warung/kasir.php', {
        method: 'POST',
        body: form
    })
    .then(response => {
        console.log('Payment response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.text().then(text => {
            console.log('Payment response text:', text);
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Failed to parse payment response:', e);
                throw new Error('Invalid JSON response: ' + text.substring(0, 200));
            }
        });
    })
    .then(data => {
        console.log('Payment response data:', data);
        
        if (data.success) {
            app.currentTransaction = {
                id: data.transaction_id,
                items: items,
                total: total,
                payment: paymentAmount,
                change: change,
                timestamp: new Date()
            };

            closePaymentModal();
            showReceipt();
            showAlert('Transaksi berhasil!', 'success');
        } else {
            showAlert(data.message || 'Gagal memproses transaksi', 'error');
            btn.disabled = false;
            btn.textContent = 'Selesaikan';
        }
    })
    .catch(error => {
        console.error('Error processing payment:', error);
        console.error('Error message:', error.message);
        showAlert('Terjadi kesalahan: ' + error.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Selesaikan';
    });
}

// ========== RECEIPT PRINT SYSTEM ==========
function showReceipt() {
    const trans = app.currentTransaction;
    
    // Helper format rupiah untuk window baru
    const currencyFormat = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };
    
    // Buat window baru untuk preview print
    const printWindow = window.open('', 'RECEIPT_PRINT', 'width=400,height=700');
    
    // HTML nota dengan layout yang lebih natural dan readable
    const receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>NOTA RAFILAH</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Courier New', monospace; 
                    background: white; 
                    padding: 0;
                }
                .receipt {
                    width: 44mm;
                    margin: 0 auto;
                    background: white;
                    padding: 0;
                    font-size: 6px;
                    line-height: 1.15;
                    color: #000;
                    overflow: hidden;
                    box-sizing: border-box;
                }
                
                /* HEADER SECTION */
                .receipt-header {
                    text-align: center;
                    margin-bottom: 2px;
                    padding-bottom: 1px;
                    border-bottom: 2px solid #000;
                }
                .receipt-store-name {
                    font-weight: bold;
                    font-size: 8px;
                    margin-bottom: 0.5px;
                    letter-spacing: 0;
                }
                .receipt-datetime {
                    font-size: 5.5px;
                    color: #333;
                }
                
                /* ITEMS SECTION */
                .receipt-items {
                    margin: 2px 0;
                    padding: 0;
                }
                .receipt-item {
                    display: block;
                    margin-bottom: 2px;
                    font-size: 6px;
                    word-wrap: break-word;
                }
                .receipt-item div {
                    word-break: break-word;
                    overflow-wrap: break-word;
                }
                .receipt-item div:last-child {
                    text-align: right;
                    font-weight: bold;
                    white-space: nowrap;
                    margin-bottom: 0.5px;
                }
                .receipt-item div:first-child {
                    margin-bottom: 1px;
                }
                
                /* DIVIDER */
                .receipt-divider {
                    border-bottom: 1px dashed #000;
                    margin: 1px 0;
                }
                
                /* SUMMARY SECTION */
                .receipt-summary {
                    margin: 1px 0;
                    padding: 1px 0;
                }
                .receipt-summary-line {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5px;
                    font-size: 6px;
                    gap: 1px;
                    min-height: auto;
                }
                .receipt-summary-line span:last-child {
                    text-align: right;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .receipt-summary-line.total {
                    font-weight: bold;
                    border-bottom: 1px solid #000;
                    padding-bottom: 0.5px;
                    margin-bottom: 1px;
                }
                .receipt-summary-line.payment {
                    margin-top: 0.5px;
                }
                
                /* FOOTER */
                .receipt-footer {
                    text-align: center;
                    margin-top: 1px;
                    padding-top: 1px;
                    border-top: 1px dashed #000;
                    font-size: 6px;
                    font-weight: bold;
                }
                
                /* PRINT STYLES */
                @media print {
                    body { margin: 0; padding: 0; background: white; overflow: hidden; width: 44mm; }
                    .receipt { width: 44mm; margin: 0; padding: 0; max-width: 44mm; }
                    @page { margin: 0; size: 48mm auto; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                <!-- HEADER -->
                <div class="receipt-header">
                    <div class="receipt-store-name">═ TOKO RAFILAH ═</div>
                    <div class="receipt-datetime">
                        ${trans.timestamp.toLocaleDateString('id-ID')}<br>
                        ${trans.timestamp.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}
                    </div>
                </div>
                
                <!-- ITEMS -->
                <div class="receipt-items">
                    ${trans.items.map((item, idx) => `
                        <div class="receipt-item">
                            <div>${item.quantity}x ${item.name}</div>
                            <div style="text-align: right; font-weight: bold;">${currencyFormat(item.price * item.quantity)}</div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- DIVIDER -->
                <div class="receipt-divider"></div>
                
                <!-- SUMMARY -->
                <div class="receipt-summary">
                    <div class="receipt-summary-line total">
                        <span>TOTAL</span>
                        <span>${currencyFormat(trans.total)}</span>
                    </div>
                    <div class="receipt-summary-line payment">
                        <span>Bayar</span>
                        <span>${currencyFormat(trans.payment)}</span>
                    </div>
                    <div class="receipt-summary-line">
                        <span>Kembali</span>
                        <span style="font-weight: bold;">${currencyFormat(trans.change)}</span>
                    </div>
                </div>
                
                <!-- FOOTER -->
                <div class="receipt-footer">
                    ✓ TERIMA KASIH ✓
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Tulis ke window baru
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    
    // Trigger print dialog setelah halaman siap
    printWindow.onload = function() {
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };
}

function completeTransaction() {
    document.getElementById('receiptModal').classList.remove('active');
    app.cart = [];
    updateCart();
    loadProducts();
}
</script>

