const THEME_KEY = "warung_theme";
const SIDEBAR_MENU_KEY = "warung_sidebar_menu";

document.addEventListener("DOMContentLoaded", () => {
    initializeThemeToggle();
    initializeSidebarToggle();
    initializeAlerts();
    initializeFormSubmit();
    initializeNumberFormatting();
    initializeTimestamp();
    initializeFAB();
    initializeResponsiveTables();
    renderDashboardIfReady();
});

document.addEventListener("themeChanged", () => {
    renderDashboardIfReady();
});

let responsiveResizeTimer;
window.addEventListener("resize", () => {
    window.clearTimeout(responsiveResizeTimer);
    responsiveResizeTimer = window.setTimeout(() => {
        initializeResponsiveTables();
        renderDashboardIfReady();
    }, 120);
});

function initializeThemeToggle() {
    const htmlEl = document.documentElement;
    const themeToggle = document.getElementById("theme-toggle");
    const themeLabel = document.getElementById("theme-toggle-label");
    const savedTheme = localStorage.getItem(THEME_KEY);

    if (savedTheme === "dark") {
        htmlEl.setAttribute("data-theme", "dark");
    } else {
        htmlEl.removeAttribute("data-theme");
    }

    updateThemeLabel();

    if (!themeToggle) {
        return;
    }

    themeToggle.addEventListener("click", () => {
        const isDark = htmlEl.getAttribute("data-theme") === "dark";

        if (isDark) {
            htmlEl.removeAttribute("data-theme");
            localStorage.setItem(THEME_KEY, "light");
            showToast("Tema terang aktif.");
        } else {
            htmlEl.setAttribute("data-theme", "dark");
            localStorage.setItem(THEME_KEY, "dark");
            showToast("Tema gelap aktif.");
        }

        updateThemeLabel();
        document.dispatchEvent(new CustomEvent("themeChanged"));
    });

    function updateThemeLabel() {
        if (!themeLabel) {
            return;
        }

        const isDark = htmlEl.getAttribute("data-theme") === "dark";
        themeLabel.textContent = isDark ? "Terang" : "Gelap";
    }
}

function initializeSidebarToggle() {
    const sidebar = document.querySelector(".sidebar");
    const toggleButton = document.getElementById("sidebar-toggle");
    const toggleText = document.getElementById("sidebar-toggle-text");
    const menuStack = document.getElementById("sidebar-menu");

    if (!sidebar || !toggleButton || !toggleText || !menuStack) {
        return;
    }

    const savedState = localStorage.getItem(SIDEBAR_MENU_KEY);
    const isOpen = savedState === null ? window.innerWidth > 640 : savedState === "open";

    applySidebarState(isOpen);

    toggleButton.addEventListener("click", () => {
        const nextState = sidebar.dataset.menuOpen !== "true";
        applySidebarState(nextState);
    });

    function applySidebarState(isExpanded) {
        sidebar.classList.toggle("is-collapsed", !isExpanded);
        sidebar.dataset.menuOpen = isExpanded ? "true" : "false";
        toggleButton.setAttribute("aria-expanded", String(isExpanded));
        toggleButton.setAttribute(
            "aria-label",
            isExpanded ? "Sembunyikan pilihan menu" : "Tampilkan pilihan menu"
        );
        toggleText.textContent = isExpanded ? "Sembunyikan menu" : "Tampilkan menu";
        menuStack.setAttribute("aria-hidden", String(!isExpanded));
        menuStack.inert = !isExpanded;
        localStorage.setItem(SIDEBAR_MENU_KEY, isExpanded ? "open" : "closed");
    }
}

function initializeAlerts() {
    const alerts = document.querySelectorAll(".alert");

    alerts.forEach((alert) => {
        const closeBtn = alert.querySelector(".alert-close");

        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                alert.remove();
            });
        }

        window.setTimeout(() => {
            if (alert.isConnected) {
                alert.remove();
            }
        }, 5000);
    });
}

function initializeFormSubmit() {
    const forms = document.querySelectorAll("form");

    forms.forEach((form) => {
        form.addEventListener("submit", () => {
            const numberInputs = form.querySelectorAll(
                'input[type="number"], input[inputmode="numeric"], input[data-format="currency"], input.number-format'
            );

            numberInputs.forEach((input) => {
                input.value = input.value.replace(/\./g, "");
            });

            const submitBtn = form.querySelector('button[type="submit"]');
            if (!submitBtn || submitBtn.classList.contains("no-loading")) {
                return;
            }

            if (!submitBtn.dataset.originalText) {
                submitBtn.dataset.originalText = submitBtn.innerHTML;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = "Menyimpan...";

            window.setTimeout(() => {
                if (submitBtn.isConnected) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = submitBtn.dataset.originalText || "Simpan";
                }
            }, 1200);
        });
    });
}

function initializeNumberFormatting() {
    const numberInputs = document.querySelectorAll(
        'input[inputmode="numeric"], input[type="number"], input[data-format="currency"], input.number-format'
    );

    numberInputs.forEach((input) => {
        if (input.value) {
            input.value = formatNumberWithSeparators(input.value);
        }

        input.addEventListener("input", function onInput() {
            const cleanValue = this.value.replace(/\D/g, "");
            this.value = formatNumberWithSeparators(cleanValue);
        });

        input.addEventListener("paste", function onPaste(event) {
            event.preventDefault();
            const pastedText = (event.clipboardData || window.clipboardData).getData("text");
            this.value = formatNumberWithSeparators(pastedText);
        });

        input.addEventListener("blur", function onBlur() {
            const cleanValue = this.value.replace(/\D/g, "");
            this.value = formatNumberWithSeparators(cleanValue);
        });
    });
}

function formatNumberWithSeparators(value) {
    return String(value || "")
        .replace(/\./g, "")
        .replace(/\D/g, "")
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function initializeTimestamp() {
    const currentTimeElement = document.getElementById("currentTime");
    if (!currentTimeElement) {
        return;
    }

    const formatter = new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    const update = () => {
        currentTimeElement.textContent = formatter.format(new Date());
    };

    update();
    window.setInterval(update, 1000);
}

function initializeFAB() {
    const fabHelp = document.getElementById("fab-help");
    if (!fabHelp) {
        return;
    }

    fabHelp.addEventListener("click", () => {
        showToast("Butuh bantuan cepat? Buka halaman produk, inventory, atau kasir dari menu samping.");
    });
}

function initializeResponsiveTables() {
    const wrappers = document.querySelectorAll(".table-responsive");

    wrappers.forEach((wrapper) => {
        const table = wrapper.querySelector(".data-table");
        if (!table) {
            return;
        }

        const headers = Array.from(table.querySelectorAll("thead th")).map((header) =>
            header.textContent.trim() || "Kolom"
        );

        table.querySelectorAll("tbody tr").forEach((row) => {
            Array.from(row.children).forEach((cell, index) => {
                if (cell.tagName !== "TD") {
                    return;
                }

                cell.setAttribute("data-label", headers[index] || `Kolom ${index + 1}`);
            });
        });

        if (window.innerWidth <= 640) {
            wrapper.classList.add("table-stack");
        } else {
            wrapper.classList.remove("table-stack");
        }
    });
}

function showToast(message, duration = 2800) {
    const toast = document.createElement("div");
    toast.className = "tr-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("visible");
    });

    window.setTimeout(() => {
        toast.classList.remove("visible");
        window.setTimeout(() => {
            toast.remove();
        }, 240);
    }, duration);
}

function renderDashboardIfReady() {
    if (!window.dashboardData || !window.dashboardRender) {
        return;
    }

    window.dashboardRender.renderStats(window.dashboardData.stats || {});
    window.dashboardRender.renderTransactions(window.dashboardData.transactions || []);
}

window.dashboardRender = {
    renderStats(statsData) {
        const statsContainer = document.getElementById("dashboard-stats");
        if (!statsContainer) {
            return;
        }

        const stokValue = Number(statsData.stok_value || 0);
        const pemasukkan = Number(statsData.pemasukkan || 0);
        const pengeluaran = Number(statsData.pengeluaran || 0);
        const lowStock = Number(statsData.low_stock || 0);
        const netProfit = pemasukkan - pengeluaran;

        const statCards = [
            {
                label: "Saldo bersih",
                value: formatCurrency(netProfit),
                tone: netProfit >= 0 ? "tone-positive" : "tone-expense",
                accent: netProfit >= 0 ? "Pemasukan masih unggul" : "Pengeluaran lebih besar"
            },
            {
                label: "Nilai stok",
                value: formatCurrency(stokValue),
                tone: "tone-stock",
                accent: "Total modal yang tersimpan"
            },
            {
                label: "Stok rendah",
                value: `${lowStock} produk`,
                tone: lowStock > 0 ? "tone-expense" : "tone-income",
                accent: lowStock > 0 ? "Perlu dicek ulang" : "Semua stok aman"
            }
        ];

        statsContainer.innerHTML = statCards
            .map((card) => {
                return `
                    <article class="stat-card ${card.tone}">
                        <div class="stat-label">${escapeHtml(card.label)}</div>
                        <div class="stat-value">${escapeHtml(card.value)}</div>
                        <span class="stat-accent">${escapeHtml(card.accent)}</span>
                    </article>
                `;
            })
            .join("");
    },

    renderProducts(products) {
        const productsTable = document.getElementById("products-table");
        if (!productsTable) {
            return;
        }

        if (!products.length) {
            productsTable.innerHTML = '<div class="empty-state">Belum ada produk untuk ditampilkan.</div>';
            return;
        }

        if (window.innerWidth <= 640) {
            productsTable.innerHTML = `
                <div class="dashboard-list">
                    ${products
                        .map((product) => {
                            return `
                                <article class="dashboard-list-item">
                                    <div class="item-row">
                                        <span class="item-title">${escapeHtml(product.nama)}</span>
                                        <span class="badge badge-neutral">${escapeHtml(String(product.stok))} unit</span>
                                    </div>
                                    <div class="item-meta">Harga jual ${escapeHtml(formatCurrency(product.harga_jual))}</div>
                                </article>
                            `;
                        })
                        .join("")}
                </div>
            `;
            return;
        }

        productsTable.innerHTML = `
            <div class="table-responsive">
                <table class="simple-table">
                    <thead>
                        <tr>
                            <th>Produk</th>
                            <th class="text-center">Stok</th>
                            <th class="text-right">Harga jual</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products
                            .map((product) => {
                                return `
                                    <tr>
                                        <td><strong>${escapeHtml(product.nama)}</strong></td>
                                        <td class="text-center"><span class="badge badge-neutral">${escapeHtml(
                                            String(product.stok)
                                        )} unit</span></td>
                                        <td class="text-right">${escapeHtml(formatCurrency(product.harga_jual))}</td>
                                    </tr>
                                `;
                            })
                            .join("")}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderTransactions(transactions) {
        const transactionsTable = document.getElementById("transactions-table");
        if (!transactionsTable) {
            return;
        }

        if (!transactions.length) {
            transactionsTable.innerHTML = '<div class="empty-state">Belum ada transaksi terbaru.</div>';
            return;
        }

        transactionsTable.innerHTML = `
            <div class="dashboard-feed">
                ${transactions
                    .map((transaction) => {
                        const isIncome = transaction.type === "Pemasukkan";
                        const badgeClass = isIncome ? "badge-success" : "badge-danger";
                        const valueClass = isIncome ? "text-success" : "text-danger";

                        return `
                            <article class="dashboard-feed-item">
                                <div class="item-row">
                                    <span class="badge ${badgeClass}">${escapeHtml(transaction.type)}</span>
                                    <span class="${valueClass}"><strong>${escapeHtml(
                                        formatCurrency(transaction.jumlah)
                                    )}</strong></span>
                                </div>
                                <div class="item-title">${escapeHtml(transaction.deskripsi)}</div>
                                <div class="item-meta">${escapeHtml(formatDate(transaction.tanggal))}</div>
                            </article>
                        `;
                    })
                    .join("")}
            </div>
        `;
    }
};

function formatCurrency(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Math.round(Number(value || 0)));
}

function formatDate(dateStr) {
    const safeDate = new Date(String(dateStr).replace(" ", "T"));

    if (Number.isNaN(safeDate.getTime())) {
        return String(dateStr || "");
    }

    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(safeDate);
}

function escapeHtml(text) {
    const safeText = String(text ?? "");
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    return safeText.replace(/[&<>"']/g, (char) => map[char]);
}
