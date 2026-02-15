/**
 * Toko Rafilah - Main JavaScript
 * Utility functions and interactions - Mobile Optimized
 */

// Detect if mobile device
const isMobile = () => window.innerWidth <= 768;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    initializeAlerts();
    initializeThemeToggle();
    initializeFAB();
    initializeFormSubmit();
    initializeNumberFormatting();
    
    // Only run heavy animations on desktop
    if (!isMobile()) {
        initializeScrollAnimations();
        initializeCardAnimations();
        initializeAdvancedInteractions();
    } else {
        // Lightweight mobile animations
        initializeMobileScrollAnimations();
    }
    
    addCustomStyles();
    initializeTableEnhancements();
});

// Lightweight mobile scroll animations
function initializeMobileScrollAnimations() {
    const observerOptions = {
        threshold: 0.05,
        rootMargin: '0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe only main elements
    document.querySelectorAll('.card, .summary-box, .form-section, .table-section').forEach(el => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.3s ease';
        observer.observe(el);
    });
}

// Enhanced alerts with better animations
function initializeAlerts() {
    const alerts = document.querySelectorAll('.alert');
    const animDuration = isMobile() ? 300 : 500;
    
    alerts.forEach((alert, index) => {
        if (!isMobile()) {
            alert.style.animationDelay = `${index * 0.1}s`;
        }
        
        setTimeout(() => {
            if (!isMobile()) {
                alert.style.animation = 'slideUp 0.5s ease-out forwards';
            }
            setTimeout(() => {
                alert.style.display = 'none';
            }, animDuration);
        }, 5500);

        // Close button functionality
        const closeBtn = alert.querySelector('.alert-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                if (!isMobile()) {
                    alert.style.animation = 'slideUp 0.4s ease-out forwards';
                    setTimeout(() => alert.remove(), 400);
                } else {
                    alert.remove();
                }
            });
        }
    });
}

// Theme toggle with smooth transitions
function initializeThemeToggle() {
    const htmlEl = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('tr_theme');

    if (saved === 'dark') {
        htmlEl.setAttribute('data-theme', 'dark');
        if (themeToggle) themeToggle.textContent = '☀️';
    } else {
        htmlEl.removeAttribute('data-theme');
        if (themeToggle) themeToggle.textContent = '🌙';
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Reduce animation on mobile
            if (!isMobile()) {
                this.style.animation = 'rotate-slow 0.6s ease-in-out';
            }
            
            if (htmlEl.getAttribute('data-theme') === 'dark') {
                htmlEl.removeAttribute('data-theme');
                localStorage.setItem('tr_theme', 'light');
                this.textContent = '🌙';
                showToast('📱 Mode terang diaktifkan');
            } else {
                htmlEl.setAttribute('data-theme', 'dark');
                localStorage.setItem('tr_theme', 'dark');
                this.textContent = '☀️';
                showToast('🌙 Mode gelap diaktifkan');
            }
            
            // Dispatch theme changed event for dashboard re-render
            document.dispatchEvent(new CustomEvent('themeChanged'));
        });
    }
}

// Initialize FAB (Floating Action Buttons)
function initializeFAB() {
    const fabHelp = document.getElementById('fab-help');
    if (fabHelp) {
        fabHelp.addEventListener('click', function() {
            showToast('❓ Butuh bantuan? Hubungi admin atau lihat README untuk dokumentasi lengkap');
        });
    }

    // Add ripple effect to FAB only on desktop
    if (!isMobile()) {
        const fabButtons = document.querySelectorAll('.fab-btn');
        fabButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                const ripple = document.createElement('span');
                ripple.style.position = 'absolute';
                ripple.style.borderRadius = '50%';
                ripple.style.background = 'rgba(255, 255, 255, 0.5)';
                ripple.style.pointerEvents = 'none';
                this.style.position = 'relative';
                this.appendChild(ripple);

                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = e.clientX - rect.left - size / 2 + 'px';
                ripple.style.top = e.clientY - rect.top - size / 2 + 'px';
                ripple.style.animation = 'ripple 0.6s ease-out';
                
                setTimeout(() => ripple.remove(), 600);
            });
        });
    }
}

// Enhanced form submission with visual feedback
function initializeFormSubmit() {
    const isMobileDevice = isMobile();
    
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            // Remove number formatting before submission
            const numberInputs = this.querySelectorAll('input[type="number"], input[inputmode="numeric"], input[data-format="currency"], input.number-format');
            numberInputs.forEach(input => {
                // Remove formatting and keep only digits
                input.value = input.value.replace(/\./g, '');
            });
            
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn && !submitBtn.classList.contains('no-loading')) {
                const originalText = submitBtn.innerHTML;
                const originalState = submitBtn.disabled;
                
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.7';
                submitBtn.innerHTML = '⏳ Memproses...';
                
                const timeout = isMobileDevice ? 800 : 1200;
                setTimeout(() => {
                    if (submitBtn.disabled) {
                        submitBtn.disabled = originalState;
                        submitBtn.style.opacity = '1';
                        submitBtn.innerHTML = originalText;
                    }
                }, timeout);
            }
        });

        // Form input focus effects
        if (!isMobileDevice) {
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.addEventListener('focus', function() {
                    this.style.transform = 'scale(1.02)';
                });
                input.addEventListener('blur', function() {
                    this.style.transform = 'scale(1)';
                });
            });
        }
    });
}

// Initialize number formatting for input fields
function initializeNumberFormatting() {
    // Select all numeric inputs (type="text" with inputmode="numeric" or type="number")
    const numberInputs = document.querySelectorAll('input[inputmode="numeric"], input[type="number"], input[data-format="currency"], input.number-format');
    
    numberInputs.forEach(input => {
        // Format existing value if any
        if (input.value) {
            input.value = formatNumberWithSeparators(input.value);
        }
        
        // Listen to input changes
        input.addEventListener('input', function(e) {
            // Get current value and remove non-digits
            const cleanValue = this.value.replace(/\D/g, '');
            
            // Format with separators
            this.value = formatNumberWithSeparators(cleanValue);
            
            // Prevent typing non-numeric characters
            if (!/^\d*$/.test(this.value.replace(/\./g, ''))) {
                this.value = this.value.replace(/[^\d.]/g, '');
            }
        });
        
        // Handle paste events
        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const cleanValue = pastedText.replace(/\D/g, '');
            
            if (cleanValue) {
                this.value = formatNumberWithSeparators(cleanValue);
            }
        });
        
        // Handle blur to ensure proper formatting
        input.addEventListener('blur', function() {
            const cleanValue = this.value.replace(/\D/g, '');
            if (cleanValue) {
                this.value = formatNumberWithSeparators(cleanValue);
            }
        });
    });
}

// Format number with thousand separators (Indonesian style: 1.000.000)
function formatNumberWithSeparators(value) {
    // Remove all dots first
    value = value.replace(/\./g, '');
    
    // Remove all non-digit characters
    value = value.replace(/\D/g, '');
    
    // Add dots as thousand separators from right to left
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Scroll animations for elements (desktop only)
function initializeScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe cards and sections
    document.querySelectorAll('.card, .summary-box, .form-section, .table-section').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    });
}

// Animate numbers on cards (desktop only)
function initializeCardAnimations() {
    const numbers = document.querySelectorAll('.big-number');
    numbers.forEach(num => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const text = entry.target.textContent;
                    // Skip animation if text contains currency symbols or letters
                    if (!/[A-Za-z]/.test(text)) {
                        animateNumber(entry.target);
                    }
                    observer.unobserve(entry.target);
                }
            });
        });
        observer.observe(num);
    });
}

// Animate number counting
function animateNumber(element) {
    const text = element.textContent.trim();
    const match = text.match(/(\d+)/);
    if (!match) return;

    const targetNum = parseInt(match[1]);
    const duration = isMobile() ? 800 : 1200;
    const startTime = Date.now();
    const originalText = text;

    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentNum = Math.floor(targetNum * progress);
        element.textContent = originalText.replace(match[1], currentNum.toLocaleString('id-ID'));

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            element.textContent = originalText;
        }
    };

    animate();
}

// Enhanced table row hover
function initializeTableEnhancements() {
    const rows = document.querySelectorAll('.data-table tbody tr');
    rows.forEach(row => {
        row.style.cursor = 'pointer';
        row.style.userSelect = 'none';
    });
}

// Format currency
function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Math.round(value));
}

// Enhanced toast notifications with icons
function showToast(msg, duration = 3500) {
    const toast = document.createElement('div');
    toast.className = 'tr-toast';
    toast.textContent = msg;
    toast.style.fontSize = '1em';
    toast.style.fontWeight = '600';
    toast.style.letterSpacing = '0.3px';
    
    // Reduced effects for mobile
    if (isMobile()) {
        toast.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.95), rgba(240, 147, 251, 0.85))';
        toast.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
    } else {
        toast.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.95), rgba(240, 147, 251, 0.85))';
        toast.style.backdropFilter = 'blur(8px)';
        toast.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.3)';
    }
    
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('visible'), 10);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, duration);

    return toast;
}

// Add enhanced custom styles
function addCustomStyles() {
    const style = document.createElement('style');
    const animDuration = isMobile() ? '0.2s' : '0.5s';
    
    let cssContent = `
        @keyframes slideUp {
            from {
                opacity: 1;
                transform: translateY(0);
            }
            to {
                opacity: 0;
                transform: translateY(-25px);
            }
        }

        @keyframes ripple {
            from {
                opacity: 0.5;
                transform: scale(0);
            }
            to {
                opacity: 0;
                transform: scale(1);
            }
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        /* Smooth transitions for form inputs */
        input:focus, select:focus, textarea:focus {
            transition: all ${isMobile() ? '0.15s' : '0.3s'} cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        /* Loading animation */
        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.6;
            }
        }

        /* Text selection style */
        ::selection {
            background: rgba(102, 126, 234, 0.4);
            color: inherit;
        }

        /* Better focus states */
        button:focus, a:focus {
            outline: none;
            box-shadow: 0 0 0 ${isMobile() ? '2px' : '4px'} rgba(102, 126, 234, 0.3);
        }
    `;
    
    // Add reduced animations on mobile
    if (isMobile()) {
        cssContent += `
        /* Reduce animations on mobile */
        @media (max-width: 768px) {
            * {
                animation-duration: 0.2s !important;
            }
        }
        
        @media (prefers-reduced-motion: reduce) {
            * {
                animation: none !important;
                transition: none !important;
            }
        }
        `;
    }
    
    style.textContent = cssContent;
    document.head.appendChild(style);
}

// Log app info
console.log('%c🏪 Toko Rafilah', 'color: #667eea; font-size: 16px; font-weight: bold;');
console.log('%cSistem Manajemen Inventory & Keuangan', 'color: #f093fb; font-size: 12px; font-weight: 600;');
console.log('%cVersion 3.0 - Mobile Optimized', 'color: #38ef7d; font-size: 11px; font-weight: 400;');

// Advanced scroll and interaction effects (Optimized for performance)
function initializeAdvancedInteractions() {
    if (isMobile()) return; // Skip on mobile
    
    // Smooth scroll reveal animations
    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -60px 0px'
    };

    const revealObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'scale-in 0.6s ease-out forwards';
                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.card, .summary-box').forEach(el => {
        revealObserver.observe(el);
    });
}

// Throttle function for performance
function throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
        const now = new Date().getTime();
        if (now - lastCall < delay) return;
        lastCall = now;
        return func(...args);
    };
}

/**
 * Update timestamp real-time
 */
function initializeTimestamp() {
    const currentTimeElement = document.getElementById('currentTime');
    const timestampDisplay = document.querySelector('.timestamp-display');
    
    if (currentTimeElement) {
        function updateTime() {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            
            currentTimeElement.textContent = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
        }
        
        updateTime();
        setInterval(updateTime, 1000);
    }
}

// ============================================
// DASHBOARD RENDERER
// ============================================

// Export rendering functions for use in dashboard.php
window.dashboardRender = {
    renderStats: function(statsData) {
        const statsContainer = document.getElementById('dashboard-stats');
        if (!statsContainer) return;

        const netProfit = statsData.pemasukkan - statsData.pengeluaran;

        const statCards = [
            {
                title: 'Keuntungan Bersih',
                icon: '💰',
                value: formatCurrency(netProfit),
                cardClass: 'card-primary',
                valueClass: netProfit >= 0 ? 'text-success' : 'text-danger'
            },
            {
                title: 'Total Stok',
                icon: '📦',
                value: formatCurrency(statsData.stok_value),
                cardClass: 'card-secondary',
                valueClass: ''
            },
            {
                title: 'Total Pemasukkan',
                icon: '📈',
                value: formatCurrency(statsData.pemasukkan),
                cardClass: 'card-success',
                valueClass: ''
            },
            {
                title: 'Total Pengeluaran',
                icon: '📉',
                value: formatCurrency(statsData.pengeluaran),
                cardClass: 'card-danger',
                valueClass: ''
            }
        ];

        statsContainer.innerHTML = statCards.map(card => `
            <div class="stat-card ${card.cardClass}">
                <div class="stat-icon">${card.icon}</div>
                <div class="stat-content">
                    <div class="stat-label">${escapeHtml(card.title)}</div>
                    <div class="stat-value ${card.valueClass}">${card.value}</div>
                </div>
            </div>
        `).join('');
        
        // Apply grid display
        statsContainer.style.display = 'grid';
        // Mobile optimizer will adjust grid columns based on width
    },

    renderProducts: function(products) {
        const productsTable = document.getElementById('products-table');
        if (!productsTable) return;

        if (!products || products.length === 0) {
            productsTable.innerHTML = '<p class="text-center text-muted">Belum ada produk</p>';
            return;
        }

        const tableHTML = `
            <table class="simple-table">
                <thead>
                    <tr>
                        <th>Produk</th>
                        <th class="text-center">Stok</th>
                        <th class="text-right">Harga</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(p => `
                        <tr>
                            <td>${escapeHtml(p.nama)}</td>
                            <td class="text-center"><strong>${p.stok} pcs</strong></td>
                            <td class="text-right">${formatCurrency(p.harga_jual)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        productsTable.innerHTML = tableHTML;
    },

    renderTransactions: function(transactions) {
        const transactionsTable = document.getElementById('transactions-table');
        if (!transactionsTable) return;

        if (!transactions || transactions.length === 0) {
            transactionsTable.innerHTML = '<p class="text-center text-muted">Belum ada transaksi</p>';
            return;
        }

        const tableHTML = `
            <table class="simple-table">
                <thead>
                    <tr>
                        <th width="12%">Tipe</th>
                        <th width="50%">Keterangan</th>
                        <th width="18%" class="text-right">Jumlah</th>
                        <th width="20%">Tanggal</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(t => {
                        const isIncome = t.type === 'Pemasukkan';
                        const badgeClass = isIncome ? 'badge-success' : 'badge-danger';
                        const valueClass = isIncome ? 'text-success' : 'text-danger';
                        const formattedDate = formatDate(t.tanggal);
                        
                        return `
                            <tr>
                                <td>
                                    <span class="badge ${badgeClass}">${escapeHtml(t.type)}</span>
                                </td>
                                <td>${escapeHtml(t.deskripsi)}</td>
                                <td class="text-right ${valueClass}">
                                    <strong>${formatCurrency(t.jumlah)}</strong>
                                </td>
                                <td>${formattedDate}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        transactionsTable.innerHTML = tableHTML;
    }
};

// Utility functions
function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Math.round(value));
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Call timestamp initialization when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeTimestamp();
});
