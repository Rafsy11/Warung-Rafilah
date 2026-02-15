/**
 * Mobile Optimization Module
 * Handles responsive layout fixes for mobile devices
 * Dynamically adjusts fonts, spacing, tables, and UI elements
 */

class MobileOptimizer {
    constructor() {
        this.breakpoints = {
            mobile: 480,
            tablet: 768,
            desktop: 1024
        };
        
        this.currentWidth = window.innerWidth;
        this.isMobile = this.currentWidth <= this.breakpoints.mobile;
        this.isTablet = this.currentWidth > this.breakpoints.mobile && this.currentWidth <= this.breakpoints.tablet;
        this.isDesktop = this.currentWidth > this.breakpoints.tablet;
        
        this.init = this.init.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    init() {
        // Initial optimization
        this.optimizeLayout();
        this.optimizeTypography();
        this.optimizeTables();
        this.optimizeCards();
        this.optimizeNavigation();
        this.optimizeForms();
        this.optimizeButtons();
        this.optimizeSpacing();
        
        // Listen to resize events
        window.addEventListener('resize', this.handleResize);
        
        // Observer for dynamic content
        this.observeNewElements();
    }

    handleResize() {
        const oldWidth = this.currentWidth;
        this.currentWidth = window.innerWidth;
        
        // Update device type
        const wasDesktop = oldWidth > this.breakpoints.tablet;
        const isNowDesktop = this.currentWidth > this.breakpoints.tablet;
        
        if (wasDesktop !== isNowDesktop) {
            this.optimizeLayout();
            this.optimizeTypography();
            this.optimizeTables();
            this.optimizeCards();
            this.optimizeNavigation();
            this.optimizeForms();
            this.optimizeButtons();
            this.optimizeSpacing();
        }
    }

    /**
     * Optimize overall layout proportions
     */
    optimizeLayout() {
        const root = document.documentElement;
        
        if (this.currentWidth <= 480) {
            root.style.setProperty('--container-padding', '10px');
            root.style.setProperty('--gap-xs', '4px');
            root.style.setProperty('--gap-sm', '8px');
            root.style.setProperty('--gap-md', '12px');
            root.style.setProperty('--gap-lg', '16px');
        } else if (this.currentWidth <= 768) {
            root.style.setProperty('--container-padding', '12px');
            root.style.setProperty('--gap-xs', '6px');
            root.style.setProperty('--gap-sm', '10px');
            root.style.setProperty('--gap-md', '14px');
            root.style.setProperty('--gap-lg', '18px');
        } else {
            root.style.setProperty('--container-padding', '16px');
            root.style.setProperty('--gap-xs', '8px');
            root.style.setProperty('--gap-sm', '12px');
            root.style.setProperty('--gap-md', '16px');
            root.style.setProperty('--gap-lg', '24px');
        }

        // Apply container padding
        const container = document.querySelector('.container');
        if (container) {
            if (this.currentWidth <= 480) {
                container.style.padding = '10px';
            } else if (this.currentWidth <= 768) {
                container.style.padding = '12px';
            } else {
                container.style.padding = '16px';
            }
        }
    }

    /**
     * Optimize typography for mobile
     */
    optimizeTypography() {
        const root = document.documentElement;
        
        if (this.currentWidth <= 480) {
            // Mobile typography
            root.style.setProperty('--font-size-xs', '11px');
            root.style.setProperty('--font-size-sm', '12px');
            root.style.setProperty('--font-size-base', '13px');
            root.style.setProperty('--font-size-lg', '14px');
            root.style.setProperty('--font-size-xl', '16px');
            root.style.setProperty('--font-size-2xl', '18px');
            root.style.setProperty('--font-size-3xl', '20px');
            
            // Adjust header
            document.querySelectorAll('h1').forEach(el => {
                el.style.fontSize = '18px';
                el.style.marginBottom = '4px';
            });
            
            document.querySelectorAll('h2').forEach(el => {
                el.style.fontSize = '16px';
                el.style.marginBottom = '8px';
            });
            
            document.querySelectorAll('h3').forEach(el => {
                el.style.fontSize = '14px';
                el.style.marginBottom = '6px';
            });
            
            // Adjust paragraphs
            document.querySelectorAll('p').forEach(el => {
                el.style.fontSize = '13px';
                el.style.lineHeight = '1.4';
                el.style.marginBottom = '8px';
            });
            
        } else if (this.currentWidth <= 768) {
            // Tablet typography
            document.querySelectorAll('h1').forEach(el => {
                el.style.fontSize = '22px';
            });
            
            document.querySelectorAll('h2').forEach(el => {
                el.style.fontSize = '18px';
            });
            
            document.querySelectorAll('h3').forEach(el => {
                el.style.fontSize = '16px';
            });
            
        } else {
            // Desktop - reset to normal
            document.querySelectorAll('h1').forEach(el => {
                el.style.fontSize = '';
            });
            
            document.querySelectorAll('h2').forEach(el => {
                el.style.fontSize = '';
            });
            
            document.querySelectorAll('h3').forEach(el => {
                el.style.fontSize = '';
            });
        }
    }

    /**
     * Convert tables to mobile-friendly card layout
     */
    optimizeTables() {
        const tables = document.querySelectorAll('table:not(.no-mobile-optimize)');
        
        tables.forEach(table => {
            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');
            
            if (!thead || !tbody) return;
            
            // Get headers
            const headers = Array.from(thead.querySelectorAll('th')).map(th => th.textContent.trim());
            
            if (this.currentWidth <= this.breakpoints.tablet) {
                // Convert to card layout  
                this.convertTableToCards(table, headers, tbody);
                table.style.display = 'none';
            } else {
                // Show table normally
                if (table.dataset.originalDisplay) {
                    table.style.display = table.dataset.originalDisplay;
                } else {
                    table.style.display = 'table';
                }
                
                // Remove card layout if exists
                const cardsContainer = table.previousElementSibling;
                if (cardsContainer && cardsContainer.classList.contains('mobile-cards-container')) {
                    cardsContainer.remove();
                }
            }
        });
    }

    /**
     * Convert a table to card layout
     */
    convertTableToCards(table, headers, tbody) {
        let cardsContainer = table.previousElementSibling;
        
        // Create or update container
        if (!cardsContainer || !cardsContainer.classList.contains('mobile-cards-container')) {
            cardsContainer = document.createElement('div');
            cardsContainer.className = 'mobile-cards-container';
            table.parentNode.insertBefore(cardsContainer, table);
        }
        
        cardsContainer.innerHTML = '';
        
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            let cardHTML = '<div class="mobile-card">';
            
            cells.forEach((cell, index) => {
                const header = headers[index] || `Column ${index + 1}`;
                const value = cell.innerHTML;
                cardHTML += `
                    <div class="card-row">
                        <div class="card-label">${escapeHtml(header)}</div>
                        <div class="card-value">${value}</div>
                    </div>
                `;
            });
            
            cardHTML += '</div>';
            cardsContainer.insertAdjacentHTML('beforeend', cardHTML);
        });
        
        cardsContainer.style.display = 'block';
    }

    /**
     * Optimize stat cards layout
     */
    optimizeCards() {
        const statsContainer = document.getElementById('dashboard-stats');
        if (!statsContainer) return;
        
        const cards = statsContainer.querySelectorAll('.stat-card');
        
        if (this.currentWidth <= 480) {
            // Single column on mobile
            statsContainer.style.display = 'grid';
            statsContainer.style.gridTemplateColumns = '1fr';
            statsContainer.style.gap = '10px';
            
            cards.forEach(card => {
                card.style.padding = '12px';
                card.style.minHeight = '80px';
                
                const icon = card.querySelector('.stat-icon');
                const content = card.querySelector('.stat-content');
                
                if (icon) icon.style.fontSize = '24px';
                if (content) {
                    const label = content.querySelector('.stat-label');
                    const value = content.querySelector('.stat-value');
                    
                    if (label) label.style.fontSize = '12px';
                    if (value) value.style.fontSize = '14px';
                }
            });
            
        } else if (this.currentWidth <= 768) {
            // 2 columns on tablet
            statsContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
            statsContainer.style.gap = '12px';
            
            cards.forEach(card => {
                card.style.padding = '14px';
            });
            
        } else {
            // 4 columns on desktop
            statsContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
            statsContainer.style.gap = '16px';
            
            cards.forEach(card => {
                card.style.padding = '16px';
            });
        }
    }

    /**
     * Optimize navigation layout
     */
    optimizeNavigation() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;
        
        const navLinks = navbar.querySelectorAll('.nav-link');
        
        if (this.currentWidth <= 480) {
            navbar.style.overflowX = 'auto';
            navbar.style.overflowY = 'hidden';
            navbar.style.whiteSpace = 'nowrap';
            navbar.style.paddingBottom = '8px';
            navbar.style.gap = '6px';
            
            navLinks.forEach(link => {
                link.style.fontSize = '12px';
                link.style.padding = '8px 12px';
                link.style.minHeight = '40px';
                link.style.display = 'inline-flex';
                link.style.alignItems = 'center';
                
                const icon = link.querySelector('.nav-icon');
                const span = link.querySelector('span:last-child');
                
                if (icon) {
                    // Show icon only on very small screens
                    if (this.currentWidth <= 380) {
                        icon.style.display = 'block';
                        if (span) span.style.display = 'none';
                    } else {
                        icon.style.display = 'inline';
                        icon.style.marginRight = '4px';
                    }
                }
            });
            
        } else if (this.currentWidth <= 768) {
            navbar.style.gap = '8px';
            navLinks.forEach(link => {
                link.style.fontSize = '13px';
                link.style.padding = '10px 14px';
            });
            
        } else {
            navLinks.forEach(link => {
                link.style.fontSize = '';
                link.style.padding = '';
            });
        }
    }

    /**
     * Optimize form elements
     */
    optimizeForms() {
        const forms = document.querySelectorAll('form');
        
        forms.forEach(form => {
            const inputs = form.querySelectorAll('input, select, textarea');
            const formGroups = form.querySelectorAll('.form-group, .form-row');
            
            if (this.currentWidth <= 480) {
                // Stack form elements vertically on mobile
                formGroups.forEach(group => {
                    group.style.display = 'block';
                    group.style.marginBottom = '10px';
                });
                
                inputs.forEach(input => {
                    input.style.width = '100%';
                    input.style.padding = '10px 8px';
                    input.style.fontSize = '14px';
                    input.style.minHeight = '40px';
                });
                
                // Adjust labels
                form.querySelectorAll('label').forEach(label => {
                    label.style.display = 'block';
                    label.style.marginBottom = '6px';
                    label.style.fontSize = '13px';
                });
                
            } else if (this.currentWidth <= 768) {
                formGroups.forEach(group => {
                    group.style.display = 'grid';
                    group.style.gridTemplateColumns = 'repeat(2, 1fr)';
                    group.style.gap = '12px';
                });
                
                inputs.forEach(input => {
                    input.style.padding = '10px 10px';
                    input.style.fontSize = '13px';
                });
                
            } else {
                inputs.forEach(input => {
                    input.style.padding = '';
                    input.style.fontSize = '';
                });
            }
        });
    }

    /**
     * Optimize button sizes and spacing
     */
    optimizeButtons() {
        const buttons = document.querySelectorAll('button, .btn, a.btn, .btn-primary, .btn-secondary, .btn-danger');
        
        buttons.forEach(btn => {
            if (this.currentWidth <= 480) {
                // Larger touch targets on mobile
                if (!btn.classList.contains('btn-icon')) {
                    btn.style.minHeight = '44px';
                    btn.style.padding = '10px 14px';
                    btn.style.fontSize = '13px';
                    btn.style.borderRadius = '6px';
                    btn.style.minWidth = '80px';
                } else {
                    btn.style.minHeight = '40px';
                    btn.style.minWidth = '40px';
                    btn.style.fontSize = '16px';
                }
                
            } else if (this.currentWidth <= 768) {
                if (!btn.classList.contains('btn-icon')) {
                    btn.style.minHeight = '42px';
                    btn.style.padding = '9px 13px';
                    btn.style.fontSize = '13px';
                }
                
            } else {
                btn.style.minHeight = '';
                btn.style.padding = '';
                btn.style.fontSize = '';
                btn.style.minWidth = '';
            }
        });
    }

    /**
     * Optimize spacing and margins
     */
    optimizeSpacing() {
        const sections = document.querySelectorAll('section, .section, .dashboard-section, .form-section');
        
        sections.forEach(section => {
            if (this.currentWidth <= 480) {
                section.style.marginBottom = '12px';
                section.style.padding = '12px';
            } else if (this.currentWidth <= 768) {
                section.style.marginBottom = '14px';
                section.style.padding = '14px';
            } else {
                section.style.marginBottom = '';
                section.style.padding = '';
            }
        });
        
        // Adjust cards spacing
        document.querySelectorAll('.card').forEach(card => {
            if (this.currentWidth <= 480) {
                card.style.marginBottom = '10px';
                card.style.padding = '12px';
            } else if (this.currentWidth <= 768) {
                card.style.marginBottom = '12px';
                card.style.padding = '14px';
            } else {
                card.style.marginBottom = '';
                card.style.padding = '';
            }
        });
    }

    /**
     * Add CSS styles dynamically
     */
    addDynamicStyles() {
        if (document.getElementById('mobile-optimize-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'mobile-optimize-styles';
        style.textContent = `
            /* Mobile Cards Container */
            .mobile-cards-container {
                display: grid;
                gap: 10px;
                margin-bottom: 16px;
            }

            .mobile-card {
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 12px;
                display: grid;
                gap: 10px;
            }

            [data-theme="dark"] .mobile-card {
                background: var(--surface);
                border-color: var(--border);
            }

            .card-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                padding: 8px 0;
                border-bottom: 1px solid var(--border);
            }

            .card-row:last-child {
                border-bottom: none;
            }

            .card-label {
                font-size: 12px;
                font-weight: 600;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                flex: 1;
                min-width: 100px;
            }

            .card-value {
                font-size: 14px;
                font-weight: 600;
                color: var(--text-color);
                text-align: right;
                flex: 1;
                min-width: 100px;
            }

            /* Mobile optimizations */
            @media (max-width: 480px) {
                body {
                    font-size: 13px;
                }

                .container {
                    padding: 10px !important;
                }

                header {
                    padding: 10px;
                }

                .header-content {
                    flex-direction: column;
                    gap: 8px;
                }

                .header-left h1 {
                    font-size: 18px !important;
                }

                .header-left p {
                    font-size: 12px !important;
                }

                .navbar {
                    overflow-x: auto;
                    gap: 6px;
                }

                .nav-link {
                    font-size: 12px !important;
                    padding: 8px 12px !important;
                    white-space: nowrap;
                }

                .main-content {
                    padding: 10px 0;
                }

                .card,
                .form-section,
                .table-section {
                    padding: 12px !important;
                    margin-bottom: 10px !important;
                }

                .btn:not(.btn-icon) {
                    min-height: 44px !important;
                    padding: 10px 14px !important;
                    font-size: 13px !important;
                }

                .btn-icon {
                    min-height: 40px !important;
                    min-width: 40px !important;
                    font-size: 16px !important;
                }

                input, select, textarea {
                    font-size: 14px !important;
                    padding: 10px 8px !important;
                    min-height: 40px !important;
                }

                table {
                    font-size: 12px;
                }

                /* Improve table readability */
                table th {
                    font-size: 11px;
                    padding: 8px 4px !important;
                }

                table td {
                    padding: 8px 4px !important;
                }

                .text-right {
                    text-align: right;
                }

                .text-center {
                    text-align: center;
                }
            }

            @media (max-width: 768px) and (min-width: 481px) {
                .header-content {
                    gap: 12px;
                }

                .navbar {
                    gap: 8px;
                }

                .card,
                .form-section,
                .table-section {
                    padding: 14px !important;
                    margin-bottom: 12px !important;
                }

                .btn:not(.btn-icon) {
                    min-height: 42px !important;
                    padding: 9px 13px !important;
                    font-size: 13px !important;
                }

                input, select, textarea {
                    font-size: 13px !important;
                    padding: 10px !important;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Observe new elements added dynamically
     */
    observeNewElements() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            if (node.tagName === 'TABLE') {
                                // Re-optimize tables
                                setTimeout(() => this.optimizeTables(), 100);
                            }
                            
                            if (node.classList && node.classList.contains('stat-card')) {
                                setTimeout(() => this.optimizeCards(), 100);
                            }
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Escape HTML helper
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        const optimizer = new MobileOptimizer();
        optimizer.addDynamicStyles();
        optimizer.init();
        
        // Make it global for debugging
        window.mobileOptimizer = optimizer;
    });
} else {
    const optimizer = new MobileOptimizer();
    optimizer.addDynamicStyles();
    optimizer.init();
    window.mobileOptimizer = optimizer;
}
