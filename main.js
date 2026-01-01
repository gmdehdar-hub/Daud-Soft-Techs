// Data Management
const Storage = {
    get: (key) => {
        try {
            return JSON.parse(localStorage.getItem(`ledger_${key}`)) || [];
        } catch (e) {
            console.error("Storage get error", e);
            return [];
        }
    },
    set: (key, data) => {
        try {
            localStorage.setItem(`ledger_${key}`, JSON.stringify(data));
        } catch (e) {
            console.error("Storage set error", e);
        }
    },
    getSettings: () => {
        const defaults = {
            appName: 'Daud Dairy Products',
            phone: '0300-1234567',
            passcode: '1234', // Default passcode
            products: [
                { name: 'Milk', price: 180, unit: 'Liters' },
                { name: 'Butter', price: 1200, unit: 'kg' },
                { name: 'Cream', price: 800, unit: 'kg' },
                { name: 'Yogurt', price: 250, unit: 'kg' }
            ],
            services: [
                { name: 'Doctor Visit', price: 1000, unit: 'Visit' },
                { name: 'Feed Delivery', price: 500, unit: 'Trip' }
            ],
            suppliers: ['Local Farm A', 'Milk Center B']
        };
        try {
            const saved = localStorage.getItem('ledger_settings');
            if (!saved) return defaults;
            return JSON.parse(saved);
        } catch (e) {
            return defaults;
        }
    },
    setSettings: (data) => {
        localStorage.setItem('ledger_settings', JSON.stringify(data));
    },

    init: () => {
        if (!localStorage.getItem('ledger_sales')) {
            const dummySales = [
                { id: '1', date: '2025-12-01', client: 'Alice Smith', product: 'Milk', quantity: '10', unit: 'Liters', price: '180', amount: '1800', type: 'sale', timestamp: Date.now() }
            ];
            Storage.set('sales', dummySales);
            Storage.set('clients', ['Alice Smith']);
        }
        if (!localStorage.getItem('ledger_expenses')) {
            const dummyExp = [
                { id: 'e1', date: '2025-12-02', supplier: 'Local Farm A', product: 'Raw Milk', quantity: '50', price: '160', amount: '8000', type: 'expense', timestamp: Date.now() }
            ];
            Storage.set('expenses', dummyExp);
        }
    }
};

window.goDashboard = () => renderView('dashboard');

window.togglePass = (id) => {
    const el = document.getElementById(id);
    if (el) el.type = el.type === 'password' ? 'text' : 'password';
};

// Global State
let currentState = {
    currentView: 'dashboard',
    activeDetail: null, // Holds client/supplier name
    activeDetailType: null, // 'client' or 'supplier'
    editingId: null,
    editingType: null // 'sale', 'expense', 'payment_in', 'payment_out'
};

// Start logic
function kickoff() {
    Storage.init();
    updateDate();
    setupEventListeners();
    renderView('dashboard');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kickoff);
} else {
    kickoff();
}

function updateDate() {
    const el = document.getElementById('current-date');
    if (el) {
        el.textContent = new Date().toLocaleDateString('en-PK', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
}

// Navigation
function renderView(view, detail = null, detailType = null) {
    currentState.currentView = view;
    currentState.activeDetail = detail;
    currentState.activeDetailType = detailType;

    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => link.classList.toggle('active', link.dataset.view === view));

    const viewContainer = document.getElementById('view-container');
    const viewTitle = document.getElementById('view-title');
    if (!viewContainer || !viewTitle) return;

    viewContainer.innerHTML = '';

    try {
        switch (view) {
            case 'dashboard': renderDashboard(); break;
            case 'sales': renderSalesList(); break;
            case 'expenditure': renderExpenseList(); break;
            case 'suppliers':
                if (detail) renderSupplierDetail(detail);
                else renderSuppliers();
                break;
            case 'clients':
                if (detail) renderClientDetail(detail);
                else renderClients();
                break;
            case 'reports': renderReports(); break;
            case 'settings': renderSettings(); break;
        }
    } catch (e) {
        console.error("View render failed", e);
    }
}
window.renderView = renderView;

function renderDashboard() {
    const settings = Storage.getSettings();
    document.getElementById('view-title').textContent = settings.appName;
    const sales = Storage.get('sales');
    const expenses = Storage.get('expenses');

    // Net Sales logic: Sale entries increase value, Payment entries (dues clearing) decrease balance but increase cash
    // For Dashboard Stats: 
    // Total Sales = Total value of products sold (Sale type only)
    // Total Expenses = Total value of products bought (Expense type only)
    const valSales = sales.filter(s => s.type !== 'payment').reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const valExp = expenses.filter(e => e.type !== 'payment').reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const balance = valSales - valExp;

    document.getElementById('view-container').innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-label">Total Product Sales</span>
                <span class="stat-value">Rs. ${valSales.toLocaleString()}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Total Purchases</span>
                <span class="stat-value">Rs. ${valExp.toLocaleString()}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Stock Balance (Profit/Loss)</span>
                <span class="stat-value" style="color: ${balance >= 0 ? 'var(--success)' : 'var(--danger)'}">
                    Rs. ${balance.toLocaleString()}
                </span>
            </div>
        </div>
        <div class="content-block">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem">
                <h3 class="block-title">Recent Transactions</h3>
                <div style="display:flex; gap:10px">
                    <button class="btn btn-primary" onclick="window.openModal('payment_in')" style="padding: 0.5rem 1rem; font-size: 0.8rem; background: var(--success)">+ Cash In (Client)</button>
                    <button class="btn btn-primary" onclick="window.openModal('payment_out')" style="padding: 0.5rem 1rem; font-size: 0.8rem; background: var(--danger)">- Cash Out (Supplier)</button>
                </div>
            </div>
            <div class="data-table-container">
                <table>
                    <thead><tr><th>Date</th><th>Label</th><th>Description</th><th>Amount</th><th>Type</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${[...sales, ...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map(item => {
        const isSale = !!item.client;
        const isExp = !!item.supplier;
        const isPayment = item.type === 'payment';
        const typeForEdit = isPayment ? (isSale ? 'payment_in' : 'payment_out') : (isSale ? 'sale' : 'expense');
        return `
                                <tr>
                                    <td>${new Date(item.date).toLocaleDateString()}</td>
                                    <td><strong>${item.client || item.supplier}</strong></td>
                                    <td>${isPayment ? '💰 Payment' : item.product}</td>
                                    <td style="color:${isSale ? 'var(--success)' : 'var(--danger)'}">Rs. ${Number(item.amount).toLocaleString()}</td>
                                    <td><span class="badge ${isPayment ? 'badge-exp' : (isSale ? 'badge-sale' : 'badge-exp')}">${isPayment ? 'Payment' : (isSale ? 'Sale' : 'Purchase')}</span></td>
                                    <td>
                                        <div style="display:flex; gap:5px">
                                            <button onclick="window.editEntry('${item.id}', '${typeForEdit}')" class="btn-text">Edit</button>
                                            <button onclick="window.deleteEntry('${item.id}', '${typeForEdit}')" class="btn-text danger">Del</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
    }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Settings View
function renderSettings() {
    const settings = Storage.getSettings();
    document.getElementById('view-title').textContent = 'App Settings';

    const prodStr = settings.products.map(p => `${p.name}:${p.price}:${p.unit}`).join(', ');
    const servicesStr = (settings.services || []).map(s => `${s.name}:${s.price}:${s.unit}`).join(', ');

    document.getElementById('view-container').innerHTML = `
        <div class="content-block" style="max-width: 700px;">
            <h3>Business Branding & Pricing</h3>
            <form id="settings-form" style="margin-top: 1rem;">
                <div class="form-group"><label>Business Name</label><input type="text" id="set-appname" value="${settings.appName}" required></div>
                <div class="form-group"><label>Phone Number</label><input type="text" id="set-phone" value="${settings.phone}" required></div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom: 20px;">
                    <div class="form-group">
                        <label>Current Passcode</label>
                        <div class="password-wrapper">
                            <input type="password" id="set-passcode" value="${settings.passcode || '1234'}" required>
                            <button type="button" class="toggle-password" onclick="window.togglePass('set-passcode')">👁️</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>New Passcode</label>
                        <div class="password-wrapper">
                            <input type="password" id="set-new-pass" placeholder="Enter New Code">
                            <button type="button" class="toggle-password" onclick="window.togglePass('set-new-pass')">👁️</button>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Products & Pricing (Format: Product:Price:Unit)</label>
                    <textarea id="set-products" rows="4">${prodStr}</textarea>
                </div>
                <div class="form-group">
                    <label>Services & Fees (Format: Service:Price:Unit)</label>
                    <textarea id="set-services" rows="4">${servicesStr}</textarea>
                </div>
                <div class="form-group">
                    <label>Suppliers (Comma separated)</label>
                    <textarea id="set-suppliers" rows="3">${settings.suppliers.join(', ')}</textarea>
                </div>
                <div class="form-group">
                    <label>Clients (Comma separated)</label>
                    <textarea id="set-clients" rows="3">${Storage.get('clients').join(', ')}</textarea>
                </div>
                <button type="submit" id="save-settings-btn" class="btn btn-primary" style="width:100%">Save All Settings</button>
            </form>

            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 2px solid var(--border);">
                <h3>Data Safety & Backups</h3>
                <div style="display:flex; gap:10px; margin-top:1rem">
                    <button class="btn btn-secondary" onclick="window.backupData()" style="flex:1">💾 Download Backup</button>
                    <button class="btn btn-secondary" onclick="document.getElementById('restore-input').click()" style="flex:1">📂 Restore Backup</button>
                    <input type="file" id="restore-input" style="display:none" accept=".json" onchange="window.restoreData(event)">
                </div>
            </div>
        </div>
    `;

    document.getElementById('settings-form').onsubmit = (e) => {
        e.preventDefault();

        const prodRaw = document.getElementById('set-products').value.split(',').map(i => i.trim()).filter(i => i);
        const parsedProducts = prodRaw.map(str => {
            const parts = str.split(':');
            return { name: parts[0] || 'Unknown', price: Number(parts[1]) || 0, unit: parts[2] || 'Unit' };
        });

        const servRaw = document.getElementById('set-services').value.split(',').map(i => i.trim()).filter(i => i);
        const parsedServices = servRaw.map(str => {
            const parts = str.split(':');
            return { name: parts[0] || 'Unknown', price: Number(parts[1]) || 0, unit: parts[2] || 'Unit' };
        });

        const newSettings = {
            appName: document.getElementById('set-appname').value,
            phone: document.getElementById('set-phone').value,
            passcode: document.getElementById('set-new-pass').value || document.getElementById('set-passcode').value,
            products: parsedProducts,
            services: parsedServices,
            suppliers: document.getElementById('set-suppliers').value.split(',').map(i => i.trim()).filter(i => i)
        };
        Storage.setSettings(newSettings);
        Storage.set('clients', document.getElementById('set-clients').value.split(',').map(i => i.trim()).filter(i => i));

        // Settings Feedback
        const btn = document.getElementById('save-settings-btn');
        const oldText = btn.textContent;
        btn.textContent = '✅ Settings Updated Successfully!';
        btn.style.background = 'var(--success)';
        setTimeout(() => {
            btn.textContent = oldText;
            btn.style.background = '';
        }, 2000);
    };
}

// Sales
function renderSalesList() {
    const sales = Storage.get('sales');
    document.getElementById('view-title').textContent = 'Sales Records';
    document.getElementById('view-container').innerHTML = `
        <div class="content-block">
            <div class="block-header"><input type="text" id="sales-search" placeholder="Search client..." class="search-input"></div>
            <div class="data-table-container">
                <table>
                    <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Product</th><th>Qty</th><th>Total</th><th>Actions</th></tr></thead>
                    <tbody id="sales-body">${renderSalesRows(sales)}</tbody>
                </table>
            </div>
        </div>
    `;
    const search = document.getElementById('sales-search');
    if (search) search.oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = sales.filter(s => s.client.toLowerCase().includes(term));
        document.getElementById('sales-body').innerHTML = renderSalesRows(filtered);
    };
}

function renderSalesRows(sales) {
    if (!sales.length) return '<tr><td colspan="7" style="text-align:center">No records.</td></tr>';
    return sales.sort((a, b) => new Date(b.date) - new Date(a.date)).map(s => `
        <tr>
            <td>${new Date(s.date).toLocaleDateString()}</td>
            <td><strong>${s.client}</strong></td>
            <td><span class="badge ${s.type === 'payment' ? 'badge-exp' : 'badge-sale'}">${s.type === 'payment' ? 'Cash Rec' : 'Credit Sale'}</span></td>
            <td>${s.type === 'payment' ? '-' : s.product}</td>
            <td>${s.type === 'payment' ? '-' : `${s.quantity} ${s.unit || ''}`}</td>
            <td style="color:var(--success)">Rs. ${Number(s.amount).toLocaleString()}</td>
            <td>
                <button onclick="window.viewReceipt('${s.id}', 'sale')" class="btn-text" style="color:var(--warning)">Rec</button>
                <button onclick="window.editEntry('${s.id}', '${s.type === 'payment' ? 'payment_in' : 'sale'}')" class="btn-text">Edit</button>
                <button onclick="window.deleteEntry('${s.id}', '${s.type === 'payment' ? 'payment_in' : 'sale'}')" class="btn-text danger">Del</button>
            </td>
        </tr>
    `).join('');
}

// Expenditure
function renderExpenseList() {
    const exp = Storage.get('expenses');
    document.getElementById('view-title').textContent = 'Expenditure Records';
    document.getElementById('view-container').innerHTML = `
        <div class="content-block">
            <div class="block-header"><input type="text" id="exp-search" placeholder="Search supplier..." class="search-input"></div>
            <div class="data-table-container">
                <table>
                    <thead><tr><th>Date</th><th>Supplier</th><th>Type</th><th>Product</th><th>Qty</th><th>Amount</th><th>Actions</th></tr></thead>
                    <tbody id="exp-body">${renderExpenseRows(exp)}</tbody>
                </table>
            </div>
        </div>
    `;
    const search = document.getElementById('exp-search');
    if (search) search.oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = exp.filter(i => (i.supplier || '').toLowerCase().includes(term));
        document.getElementById('exp-body').innerHTML = renderExpenseRows(filtered);
    };
}

function renderExpenseRows(exp) {
    if (!exp.length) return '<tr><td colspan="7" style="text-align:center">No records.</td></tr>';
    return exp.sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
        <tr>
            <td>${new Date(e.date).toLocaleDateString()}</td>
            <td><strong>${e.supplier || 'N/A'}</strong></td>
            <td><span class="badge ${e.type === 'payment' ? 'badge-sale' : 'badge-exp'}">${e.type === 'payment' ? 'Cash Paid' : 'Purchase'}</span></td>
            <td>${e.type === 'payment' ? '-' : e.product}</td>
            <td>${e.type === 'payment' ? '-' : `${e.quantity} ${e.unit || ''}`}</td>
            <td style="color:var(--danger)">Rs. ${Number(e.amount).toLocaleString()}</td>
            <td>
                <button onclick="window.viewReceipt('${e.id}', 'expense')" class="btn-text" style="color:var(--warning)">Rec</button>
                <button onclick="window.editEntry('${e.id}', '${e.type === 'payment' ? 'payment_out' : 'expense'}')" class="btn-text">Edit</button>
                <button onclick="window.deleteEntry('${e.id}', '${e.type === 'payment' ? 'payment_out' : 'expense'}')" class="btn-text danger">Del</button>
            </td>
        </tr>
    `).join('');
}

// Suppliers & Clients Accounts
function renderSuppliers() {
    const exp = Storage.get('expenses');
    const settings = Storage.getSettings();
    document.getElementById('view-title').textContent = 'Supplier Accounts';
    document.getElementById('view-container').innerHTML = `
        <div class="stats-grid">
            ${settings.suppliers.map(s => {
        const totalPurchased = exp.filter(e => e.supplier === s && e.type !== 'payment').reduce((a, b) => a + Number(b.amount), 0);
        const totalPaid = exp.filter(e => e.supplier === s && e.type === 'payment').reduce((a, b) => a + Number(b.amount), 0);
        const due = totalPurchased - totalPaid;
        return `
                <div class="stat-card" style="cursor:pointer" onclick="window.renderView('suppliers', '${s}', 'supplier')">
                        <span class="stat-label">Supplier</span><span class="stat-value">${s}</span>
                        <span class="stat-trend ${due > 0 ? 'trend-down' : 'trend-up'}">Balance Due: Rs. ${due.toLocaleString()}</span>
                    </div>
                `;
    }).join('') || '<p>No suppliers defined.</p>'}
        </div>
    `;
}

window.renderSupplierDetail = (supplier) => {
    const exp = Storage.get('expenses').filter(e => e.supplier === supplier);
    const totalPurchased = exp.filter(e => e.type !== 'payment').reduce((a, b) => a + Number(b.amount), 0);
    const totalPaid = exp.filter(e => e.type === 'payment').reduce((a, b) => a + Number(b.amount), 0);
    const due = totalPurchased - totalPaid;

    document.getElementById('view-container').innerHTML = `
        <div class="content-block">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:10px">
                <button class="btn btn-secondary" onclick="window.renderView('suppliers')">← Back to List</button>
                <div style="display:flex; gap:10px; align-items:center">
                    <span style="font-weight:bold">Due: Rs. ${due.toLocaleString()}</span>
                    <button class="btn btn-secondary" onclick="window.printSupplierStatement('${supplier}')">🖨️ Print Statement</button>
                    <button class="btn btn-primary" onclick="window.openModal('payment_out', null, '${supplier}')">Record Payment</button>
                </div>
            </div>
            <div class="data-table-container">
                <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Product</th><th>Amount</th><th>Actions</th></tr></thead>
                    <tbody>${exp.sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
                        <tr>
                            <td>${new Date(e.date).toLocaleDateString()}</td>
                            <td><span class="badge ${e.type === 'payment' ? 'badge-sale' : 'badge-exp'}">${e.type === 'payment' ? 'Payment' : 'Purchase'}</span></td>
                            <td>${e.product || '-'}</td>
                            <td style="color:var(--danger)">Rs. ${Number(e.amount).toLocaleString()}</td>
                            <td>
                                <div style="display:flex; gap:5px">
                                    <button onclick="window.viewReceipt('${e.id}', 'expense')" class="btn-text">Rec</button>
                                    <button onclick="window.editEntry('${e.id}', '${e.type === 'payment' ? 'payment_out' : 'expense'}')" class="btn-text">Edit</button>
                                    <button onclick="window.deleteEntry('${e.id}', '${e.type === 'payment' ? 'payment_out' : 'expense'}')" class="btn-text danger">Del</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                    <tfoot><tr style="font-weight:bold"><td colspan="3" style="text-align:right">Total Remaining Due:</td><td>Rs. ${due.toLocaleString()}</td><td></td></tr></tfoot>
                </table>
            </div>
        </div>
    `;
};

function renderClients() {
    const sales = Storage.get('sales');
    const clients = Storage.get('clients');
    document.getElementById('view-title').textContent = 'Client Accounts';
    document.getElementById('view-container').innerHTML = `
        <div class="stats-grid">
            ${clients.map(c => {
        const totalSales = sales.filter(s => s.client === c && s.type !== 'payment').reduce((a, b) => a + Number(b.amount), 0);
        const totalPaid = sales.filter(s => s.client === c && s.type === 'payment').reduce((a, b) => a + Number(b.amount), 0);
        const balance = totalSales - totalPaid;
        return `
                <div class="stat-card" style="cursor:pointer" onclick="window.renderView('clients', '${c}', 'client')">
                        <span class="stat-label">Client</span><span class="stat-value">${c}</span>
                        <span class="stat-trend ${balance > 0 ? 'trend-down' : 'trend-up'}">Balance: Rs. ${balance.toLocaleString()}</span>
                    </div>
                `;
    }).join('') || '<p>No clients yet.</p>'}
        </div>
    `;
}

window.renderClientDetail = (client) => {
    const sales = Storage.get('sales').filter(s => s.client === client);
    const totalSales = sales.filter(s => s.type !== 'payment').reduce((a, b) => a + Number(b.amount), 0);
    const totalPaid = sales.filter(s => s.type === 'payment').reduce((a, b) => a + Number(b.amount), 0);
    const balance = totalSales - totalPaid;

    document.getElementById('view-container').innerHTML = `
        <div class="content-block">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:10px">
                <button class="btn btn-secondary" onclick="window.renderView('clients')">← Back to List</button>
                <div style="display:flex; gap:10px; align-items:center">
                    <span style="font-weight:bold">Balance: Rs. ${balance.toLocaleString()}</span>
                    <button class="btn btn-secondary" onclick="window.printClientStatement('${client}')">🖨️ Print Statement</button>
                    <button class="btn btn-primary" onclick="window.openModal('payment_in', null, '${client}')" style="background:var(--success)">Receive Payment</button>
                </div>
            </div>
            <div class="data-table-container">
                <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Product</th><th>Amount</th><th>Actions</th></tr></thead>
                    <tbody>${sales.sort((a, b) => new Date(b.date) - new Date(a.date)).map(s => `
                        <tr>
                            <td>${new Date(s.date).toLocaleDateString()}</td>
                            <td><span class="badge ${s.type === 'payment' ? 'badge-exp' : 'badge-sale'}">${s.type === 'payment' ? 'Payment' : 'Sale'}</span></td>
                            <td>${s.product || '-'}</td>
                            <td style="color:var(--success)">Rs. ${Number(s.amount).toLocaleString()}</td>
                            <td>
                                <div style="display:flex; gap:5px">
                                    <button onclick="window.viewReceipt('${s.id}', 'sale')" class="btn-text">Rec</button>
                                    <button onclick="window.editEntry('${s.id}', '${s.type === 'payment' ? 'payment_in' : 'sale'}')" class="btn-text">Edit</button>
                                    <button onclick="window.deleteEntry('${s.id}', '${s.type === 'payment' ? 'payment_in' : 'sale'}')" class="btn-text danger">Del</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                    <tfoot><tr style="font-weight:bold"><td colspan="3" style="text-align:right">Total Remaining Balance:</td><td>Rs. ${balance.toLocaleString()}</td><td></td></tr></tfoot>
                </table>
            </div>
        </div>
    `;
};

// Modals
const isClientSide = (type) => type.includes('sale') || type === 'payment_in';

function openModal(type, id = null, prefilledParty = null) {
    currentState.editingType = type;
    currentState.editingId = id;
    const isEdit = !!id;
    const isPayment = type.startsWith('payment');
    const settings = Storage.getSettings();
    const clients = Storage.get('clients');
    const data = isEdit ? (isClientSide(type) ? Storage.get('sales').find(s => s.id === id) : Storage.get('expenses').find(e => e.id === id)) : null;

    let title = (isEdit ? 'Edit ' : 'New ') + (type.includes('sale') ? 'Sale' : 'Expenditure');
    if (type === 'payment_in') title = 'Receive Payment (Client)';
    if (type === 'payment_out') title = 'Make Payment (Supplier)';
    document.getElementById('modal-title').textContent = title;

    const isDirectSale = type === 'sale';
    const isDirectExp = type === 'expense';
    const isClientSideCheck = type.includes('sale') || type === 'payment_in' || type === 'service';

    let labelText = isClientSideCheck ? 'Client' : 'Supplier';
    let partyList = isClientSideCheck ? clients : settings.suppliers;

    let formHtml = `
        <div class="form-group"><label>Date</label><input type="date" name="date" value="${data ? data.date : new Date().toISOString().split('T')[0]}" required></div>
        <div class="form-group">
            <label>${labelText}</label>
            <select name="party" id="modal-party-select" required>
                <option value="" disabled selected>-- Select ${labelText} --</option>
                ${partyList.map(p => `<option value="${p}" ${(prefilledParty === p || (data && (data.client === p || data.supplier === p))) ? 'selected' : ''}>${p}</option>`).join('')}
                ${isClientSide ? '<option value="NEW">+ Add New Client</option>' : ''}
            </select>
            <input type="text" id="new-client-input" placeholder="Type new client name here" style="display:none; margin-top:10px">
        </div>
    `;

    if (!isPayment) {
        const productList = settings.products.map(p => ({ ...p, cat: 'Product' }));
        const serviceList = (settings.services || []).map(s => ({ ...s, cat: 'Service' }));
        const combined = [...productList, ...serviceList];

        formHtml += `
            <div class="form-group">
                <label>Product / Service</label>
                <select name="product" id="modal-product-select" required>
                    <option value="" disabled selected>-- Choose Item --</option>
                    <optgroup label="Daily Products">
                        ${settings.products.map(p => `<option value="${p.name}" ${data && data.product === p.name ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </optgroup>
                    <optgroup label="Professional Services">
                        ${(settings.services || []).map(s => `<option value="${s.name}" ${data && data.product === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </optgroup>
                </select>
            </div>
            <div class="form-group">
                <label>Qty | Unit | Rate</label>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1.5fr; gap:10px">
                    <input type="number" name="quantity" id="modal-qty" value="${data ? data.quantity : ''}" step="any" placeholder="Qty" required>
                    <input type="text" name="unit" id="modal-unit" value="${data ? data.unit : ''}" placeholder="Unit" readonly>
                    <input type="number" name="price" id="modal-price" value="${data ? data.price : ''}" step="any" placeholder="Rate" required>
                </div>
                <small style="color:var(--text-muted)">You can manually change the rate for this specific sale.</small>
            </div>
        `;
    }

    formHtml += `
        <div class="form-group">
            <label>Total Amount (Rs.)</label>
            <input type="number" name="amount" id="modal-amount" value="${data ? data.amount : ''}" step="any" placeholder="Amount" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px">${isEdit ? 'Update' : 'Save Entry'}</button>
    `;

    document.getElementById('entry-form').innerHTML = formHtml;

    // Logic
    const prodSel = document.getElementById('modal-product-select');
    const unitIn = document.getElementById('modal-unit');
    const priceIn = document.getElementById('modal-price');
    const qtyIn = document.getElementById('modal-qty');
    const amountIn = document.getElementById('modal-amount');

    if (prodSel) {
        prodSel.onchange = (e) => {
            const combined = [...settings.products, ...settings.services];
            const item = combined.find(p => p.name === e.target.value);
            if (item) {
                unitIn.value = item.unit;
                priceIn.value = item.price;
                if (qtyIn.value) amountIn.value = (Number(qtyIn.value) * item.price).toFixed(2);
            }
        };
    }

    const calc = () => {
        if (qtyIn && priceIn) {
            const total = Number(qtyIn.value || 0) * Number(priceIn.value || 0);
            amountIn.value = total > 0 ? total.toFixed(2) : '';
        }
    };
    if (qtyIn) qtyIn.oninput = calc;
    if (priceIn) priceIn.oninput = calc;

    const partySel = document.getElementById('modal-party-select');
    if (partySel) partySel.onchange = (e) => {
        const ni = document.getElementById('new-client-input');
        if (ni) ni.style.display = e.target.value === 'NEW' ? 'block' : 'none';
    };

    document.getElementById('modal-container').classList.add('active');
}

window.editEntry = (id, type) => {
    openModal(type, id);
};

window.deleteEntry = (id, type) => {
    if (confirm('Are you sure you want to delete this record?')) {
        const key = isClientSide(type) ? 'sales' : 'expenses';
        const data = Storage.get(key).filter(i => i.id !== id);
        Storage.set(key, data);
        renderView(currentState.currentView, currentState.activeDetail, currentState.activeDetailType);
    }
};

function setupEventListeners() {
    document.getElementById('add-sale-btn').onclick = () => openModal('sale');
    document.getElementById('add-exp-btn').onclick = () => openModal('expense');
    document.querySelector('.close-modal').onclick = () => document.getElementById('modal-container').classList.remove('active');

    document.getElementById('entry-form').onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const type = currentState.editingType;
        const isClient = type === 'sale' || type === 'payment_in';
        const isPayment = type.startsWith('payment');

        const entry = {
            id: currentState.editingId || Date.now().toString(),
            date: fd.get('date'),
            amount: fd.get('amount'),
            product: fd.get('product') || (isPayment ? 'Payment' : ''),
            quantity: fd.get('quantity') || '',
            unit: fd.get('unit') || '',
            price: fd.get('price') || '',
            type: isPayment ? 'payment' : (isClient ? (type === 'service' ? 'service' : 'sale') : 'expense'),
            timestamp: Date.now()
        };

        if (isClient) {
            let client = fd.get('party');
            if (client === 'NEW') {
                client = document.getElementById('new-client-input').value;
                let cList = Storage.get('clients');
                if (!cList.includes(client)) { cList.push(client); Storage.set('clients', cList); }
            }
            entry.client = client;
            let data = Storage.get('sales');
            if (currentState.editingId) data = data.map(s => s.id === currentState.editingId ? entry : s);
            else data.push(entry);
            Storage.set('sales', data);
        } else {
            entry.supplier = fd.get('party');
            let data = Storage.get('expenses');
            if (currentState.editingId) data = data.map(e => e.id === currentState.editingId ? entry : e);
            else data.push(entry);
            Storage.set('expenses', data);
        }
        if (currentState.editingId) {
            document.getElementById('modal-container').classList.remove('active');
        } else {
            // Reset for next entry but keep Date and Party for convenience
            const prod = document.getElementById('modal-product-select');
            const qty = document.getElementById('modal-qty');
            const rate = document.getElementById('modal-price');
            const amt = document.getElementById('modal-amount');
            if (prod) prod.selectedIndex = 0;
            if (qty) qty.value = '';
            if (rate) rate.value = '';
            if (amt) amt.value = '';

            // Show a quick "Saved" feedback
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = '✅ Saved! Add Next...';
            btn.style.background = 'var(--success)';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 1500);
        }
        renderView(currentState.currentView, currentState.activeDetail, currentState.activeDetailType);
    };

    document.querySelectorAll('.nav-links li').forEach(item => item.onclick = () => renderView(item.dataset.view));
    window.onclick = (e) => { if (e.target.id === 'modal-container') document.getElementById('modal-container').classList.remove('active'); };

    // Login Logic
    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        const settings = Storage.getSettings();
        const input = document.getElementById('login-pass').value;
        if (input === settings.passcode || input === '1234') {
            document.getElementById('login-overlay').style.display = 'none';
        } else {
            const err = document.getElementById('login-error');
            err.style.display = 'block';
            setTimeout(() => { err.style.display = 'none'; }, 2000);
        }
    };
}

// Reports
function renderReports() {
    const sales = Storage.get('sales');
    const exp = Storage.get('expenses');
    const monthly = {};
    [...sales, ...exp].forEach(item => {
        const d = new Date(item.date);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthly[k]) monthly[k] = { name: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), s: 0, e: 0, items: [] };
        // Reports: Sales (Credits - Payments In) vs Expenses (Purchases - Payments Out)
        // Actually, users usually want to see: total sold vs total bought.
        if (item.client) {
            if (item.type === 'payment') monthly[k].s -= 0; // Don't subtract payments from "Sales Volume"
            else monthly[k].s += Number(item.amount);
        } else {
            if (item.type === 'payment') monthly[k].e -= 0;
            else monthly[k].e += Number(item.amount);
        }
        monthly[k].items.push(item);
    });
    const sorted = Object.keys(monthly).sort((a, b) => b.localeCompare(a));
    document.getElementById('view-title').textContent = 'Monthly Reports';
    document.getElementById('view-container').innerHTML = `
        <div class="content-block">
            ${sorted.map(k => `
                <div style="margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem">
                        <div>
                            <h3 style="color:var(--primary); margin:0">${monthly[k].name}</h3>
                            <div style="font-size:0.95rem; margin-top:5px; background:rgba(255,255,255,0.03); padding:8px; border-radius:8px">
                                <span style="color:var(--success)">Sales: Rs. ${monthly[k].s.toLocaleString()}</span> | 
                                <span style="color:var(--danger)">Purchases: Rs. ${monthly[k].e.toLocaleString()}</span> | 
                                <span style="font-weight:bold">Balance: Rs. ${(monthly[k].s - monthly[k].e).toLocaleString()}</span>
                            </div>
                        </div>
                        <button class="btn btn-secondary" onclick="window.printReport('${k}', '${monthly[k].name}')">Print / Save PDF</button>
                    </div>
                </div>
            `).join('') || '<p>No data recorded.</p>'}
        </div>
    `;
}

// Receipt & Printing
window.viewReceipt = (id, type = 'sale') => {
    const list = type === 'sale' ? Storage.get('sales') : Storage.get('expenses');
    const item = list.find(x => x.id === id);
    const settings = Storage.getSettings();
    if (!item) return;
    const isClient = !!item.client;
    const isPayment = item.type === 'payment';
    const label = isClient ? 'Customer' : 'Supplier';
    const partyName = item.client || item.supplier;

    document.getElementById('modal-title').textContent = isPayment ? 'Payment Voucher' : (isClient ? 'Sales Receipt' : 'Purchase Voucher');
    document.getElementById('entry-form').innerHTML = `
        <div id="receipt-box" style="padding:20px; color:black; background:white; font-family:monospace; border:1px solid #ddd">
            <h2 style="text-align:center; margin-bottom:5px">${settings.appName}</h2>
            <p style="text-align:center; margin-top:0; margin-bottom:20px">Phone: ${settings.phone}</p>
            <h4 style="text-align:center; text-transform:uppercase; border:1px solid #000; padding:10px; margin:20px 0">
                ${isPayment ? 'Payment Voucher' : (isClient ? 'Sales Receipt' : 'Purchase Voucher')}
            </h4>
            <p><strong>Date:</strong> ${new Date(item.date).toLocaleDateString()} &nbsp; <strong>No:</strong> ${item.id.slice(-5)}</p>
            <p><strong>${label}:</strong> ${partyName}</p>
            <hr/>
            <table style="width:100%">
                ${isPayment ? `<tr><td>Details:</td><td style="text-align:right">Cash Payment Received/Paid</td></tr>` : `
                <tr><td>Product:</td><td style="text-align:right">${item.product}</td></tr>
                <tr><td>Qty:</td><td style="text-align:right">${item.quantity} ${item.unit || ''}</td></tr>
                <tr><td>Rate:</td><td style="text-align:right">Rs. ${item.price}</td></tr>`}
                <tr style="font-weight:bold; font-size:1.1rem; border-top:1px solid #000"><td style="padding-top:10px">Amount:</td><td style="padding-top:10px; text-align:right">Rs. ${Number(item.amount).toLocaleString()}</td></tr>
            </table>
            <p style="margin-top:30px; text-align:center; font-size:0.8rem">Software powered by Daud Soft Techs</p>
        </div>
        <div style="display:flex; gap:10px; margin-top:20px">
            <button type="button" class="btn btn-primary" onclick="window.doPrintReceipt()" style="flex:1">Print / Save PDF</button>
            <button type="button" class="btn btn-secondary" onclick="window.doWhatsApp('${partyName}', '${item.amount}', '${item.type}')" style="flex:1; background:#25d366; color:white">WhatsApp</button>
        </div>
    `;
    document.getElementById('modal-container').classList.add('active');
};
// Helper for High-Quality Printing
window.doPrint = (content, title = 'Print Document') => {
    const win = window.open('', '', 'width=900,height=900');
    if (!win) {
        alert("Please allow popups to print reports.");
        return;
    }
    const style = `
        body { font-family: 'Inter', sans-serif; padding: 40px; color: #111; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f8fafc; text-align: left; padding: 12px; border: 1px solid #e2e8f0; font-size: 13px; text-transform: uppercase; color: #64748b; }
        td { padding: 12px; border: 1px solid #e2e8f0; font-size: 14px; }
        .text-right { text-align: right; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #6366f1; padding-bottom: 20px; }
        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        @media print { .no-print { display: none; } }
    `;
    win.document.write(`<html><head><title>${title}</title><style>${style}</style></head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => {
        win.print();
        win.close();
    }, 500);
};

window.doPrintReceipt = () => {
    const html = document.getElementById('receipt-box').innerHTML;
    const settings = Storage.getSettings();
    const content = `
        <div class="header">
            <img src="./logo.jpg" style="width:80px; height:80px; border-radius:12px; margin-bottom:10px">
            <h1 style="margin:0; color:#6366f1">${settings.appName}</h1>
            <p style="margin:5px 0">Phone: ${settings.phone}</p>
        </div>
        ${html}
        <div class="footer">Software powered by Daud Soft Techs (0300-1234567)</div>
    `;
    window.doPrint(content, 'Receipt');
};

window.doWhatsApp = (n, a, t) => {
    const settings = Storage.getSettings();
    const msg = `*${t === 'payment' ? 'Payment' : 'Receipt'} from ${settings.appName}*%0AName: ${n}%0AAmount: Rs. ${Number(a).toLocaleString()}%0AThank you!`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
};

window.printClientStatement = (client) => {
    const sales = Storage.get('sales').filter(s => s.client === client).sort((a, b) => new Date(a.date) - new Date(b.date));
    const totalSales = sales.filter(s => s.type !== 'payment').reduce((a, b) => a + Number(b.amount), 0);
    const totalPaid = sales.filter(s => s.type === 'payment').reduce((a, b) => a + Number(b.amount), 0);
    const settings = Storage.getSettings();
    const html = `
        <div class="header">
            <img src="./logo.jpg" style="width:80px; height:80px; border-radius:12px; margin-bottom:10px">
            <h1 style="margin:0; color:#6366f1">${settings.appName}</h1>
            <p style="margin:5px 0">Phone: ${settings.phone}</p>
            <h2 style="margin-top:15px; text-transform:uppercase; letter-spacing:1px">Client Statement</h2>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:20px">
            <span><strong>Client:</strong> ${client}</span>
            <span><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</span>
        </div>
        <table>
            <thead><tr><th>Date</th><th>Description</th><th>Product</th><th class="text-right">Amount</th></tr></thead>
            <tbody>${sales.map(s => `<tr><td>${new Date(s.date).toLocaleDateString()}</td><td>${s.type === 'payment' ? 'Cash Received' : 'Credit Sale'}</td><td>${s.product || '-'}</td><td class="text-right">Rs. ${Number(s.amount).toLocaleString()}</td></tr>`).join('')}</tbody>
            <tfoot>
                <tr style="font-weight:bold"><td colspan="3" class="text-right">Total Sales:</td><td class="text-right">Rs. ${totalSales.toLocaleString()}</td></tr>
                <tr style="font-weight:bold"><td colspan="3" class="text-right">Total Received:</td><td class="text-right">Rs. ${totalPaid.toLocaleString()}</td></tr>
                <tr style="font-weight:bold; background:#f1f5f9"><td colspan="3" class="text-right">Current Balance:</td><td class="text-right">Rs. ${(totalSales - totalPaid).toLocaleString()}</td></tr>
            </tfoot>
        </table>
        <div class="footer">Software powered by Daud Soft Techs (0300-1234567)</div>
    `;
    window.doPrint(html, `Statement_${client}`);
};

window.printSupplierStatement = (supplier) => {
    const exp = Storage.get('expenses').filter(e => e.supplier === supplier).sort((a, b) => new Date(a.date) - new Date(b.date));
    const totalPurchased = exp.filter(e => e.type !== 'payment').reduce((a, b) => a + Number(b.amount), 0);
    const totalPaid = exp.filter(e => e.type === 'payment').reduce((a, b) => a + Number(b.amount), 0);
    const settings = Storage.getSettings();
    const html = `
        <div class="header">
            <img src="./logo.jpg" style="width:80px; height:80px; border-radius:12px; margin-bottom:10px">
            <h1 style="margin:0; color:#6366f1">${settings.appName}</h1>
            <p style="margin:5px 0">Phone: ${settings.phone}</p>
            <h2 style="margin-top:15px; text-transform:uppercase; letter-spacing:1px">Supplier Statement</h2>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:20px">
            <span><strong>Supplier:</strong> ${supplier}</span>
            <span><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</span>
        </div>
        <table>
            <thead><tr><th>Date</th><th>Type</th><th>Product</th><th class="text-right">Amount</th></tr></thead>
            <tbody>${exp.map(e => `<tr><td>${new Date(e.date).toLocaleDateString()}</td><td>${e.type === 'payment' ? 'Cash Paid' : 'Inventory Purchase'}</td><td>${e.product || '-'}</td><td class="text-right">Rs. ${Number(e.amount).toLocaleString()}</td></tr>`).join('')}</tbody>
            <tfoot>
                <tr style="font-weight:bold"><td colspan="3" class="text-right">Total Purchased:</td><td class="text-right">Rs. ${totalPurchased.toLocaleString()}</td></tr>
                <tr style="font-weight:bold"><td colspan="3" class="text-right">Total Paid:</td><td class="text-right">Rs. ${totalPaid.toLocaleString()}</td></tr>
                <tr style="font-weight:bold; background:#f1f5f9"><td colspan="3" class="text-right">Remaining Due:</td><td class="text-right">Rs. ${(totalPurchased - totalPaid).toLocaleString()}</td></tr>
            </tfoot>
        </table>
        <div class="footer">Software powered by Daud Soft Techs (0300-1234567)</div>
    `;
    window.doPrint(html, `Statement_${supplier}`);
};

window.printReport = (key, name) => {
    const sales = Storage.get('sales').filter(x => x.date.startsWith(key));
    const exp = Storage.get('expenses').filter(x => x.date.startsWith(key));
    const totalS = sales.filter(s => s.type !== 'payment').reduce((a, b) => a + Number(b.amount), 0);
    const totalE = exp.filter(e => e.type !== 'payment').reduce((a, b) => a + Number(b.amount), 0);
    const settings = Storage.getSettings();

    const html = `
        <div class="header">
            <img src="./logo.jpg" style="width:80px; height:80px; border-radius:12px; margin-bottom:10px">
            <h1 style="margin:0; color:#6366f1">${settings.appName}</h1>
            <h2 style="margin:10px 0">${name} Summary Report</h2>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:20px; margin-bottom:30px">
            <div style="padding:15px; background:#f0fdf4; border-radius:10px; text-align:center; border:1px solid #bbf7d0">
                <p style="margin:0; font-size:12px; color:#166534">TOTAL SALES</p>
                <h3 style="margin:5px 0; color:#15803d">Rs. ${totalS.toLocaleString()}</h3>
            </div>
            <div style="padding:15px; background:#fef2f2; border-radius:10px; text-align:center; border:1px solid #fecaca">
                <p style="margin:0; font-size:12px; color:#991b1b">TOTAL PURCHASES</p>
                <h3 style="margin:5px 0; color:#b91c1c">Rs. ${totalE.toLocaleString()}</h3>
            </div>
            <div style="padding:15px; background:#f1f5f9; border-radius:10px; text-align:center; border:1px solid #e2e8f0">
                <p style="margin:0; font-size:12px; color:#475569">NET BALANCE</p>
                <h3 style="margin:5px 0; color:#1e293b">Rs. ${(totalS - totalE).toLocaleString()}</h3>
            </div>
        </div>
        <table>
            <thead><tr><th>Date</th><th>Party</th><th>Description</th><th class="text-right">Amount</th></tr></thead>
            <tbody>${[...sales, ...exp].sort((a, b) => new Date(a.date) - new Date(b.date)).map(item => `
                <tr>
                    <td>${new Date(item.date).toLocaleDateString()}</td>
                    <td>${item.client || item.supplier}</td>
                    <td>${item.product || 'Payment'}</td>
                    <td class="text-right">Rs. ${Number(item.amount).toLocaleString()}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        <div class="footer">Software powered by Daud Soft Techs (0300-1234567)</div>
    `;
    window.doPrint(html, `${name}_Report`);
};

window.backupData = () => {
    const data = { sales: Storage.get('sales'), expenses: Storage.get('expenses'), clients: Storage.get('clients'), settings: Storage.getSettings() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ledger_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

window.restoreData = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const d = JSON.parse(e.target.result);
        if (confirm('Overwrite data?')) { Storage.set('sales', d.sales); Storage.set('expenses', d.expenses); Storage.set('clients', d.clients); Storage.setSettings(d.settings); location.reload(); }
    };
    reader.readAsText(file);
};
