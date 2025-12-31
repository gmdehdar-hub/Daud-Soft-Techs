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
            products: [
                { name: 'Milk', price: 180, unit: 'Liters' },
                { name: 'Butter', price: 1200, unit: 'kg' },
                { name: 'Cream', price: 800, unit: 'kg' },
                { name: 'Yogurt', price: 250, unit: 'kg' }
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
                { id: '1', date: '2025-12-01', client: 'Alice Smith', product: 'Milk', quantity: '10', unit: 'Liters', price: '180', amount: '1800', timestamp: Date.now() }
            ];
            Storage.set('sales', dummySales);
            Storage.set('clients', ['Alice Smith']);
        }
        if (!localStorage.getItem('ledger_expenses')) {
            const dummyExp = [
                { id: 'e1', date: '2025-12-02', supplier: 'Local Farm A', product: 'Raw Milk', quantity: '50', price: '160', amount: '8000', timestamp: Date.now() }
            ];
            Storage.set('expenses', dummyExp);
        }
    }
};

// Global State
let currentState = {
    currentView: 'dashboard',
    editingId: null,
    editingType: null
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
function renderView(view) {
    currentState.currentView = view;
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
            case 'clients': renderClients(); break;
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

    const totalSales = sales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const totalExp = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const balance = totalSales - totalExp;

    document.getElementById('view-container').innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-label">Total Sales</span>
                <span class="stat-value">Rs. ${totalSales.toLocaleString()}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Total Expenditure</span>
                <span class="stat-value">Rs. ${totalExp.toLocaleString()}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Net Balance</span>
                <span class="stat-value" style="color: ${balance >= 0 ? 'var(--success)' : 'var(--danger)'}">
                    Rs. ${balance.toLocaleString()}
                </span>
            </div>
        </div>
        <div class="content-block">
            <h3 class="block-title">Overview Transactions</h3>
            <div class="data-table-container">
                <table>
                    <thead><tr><th>Date</th><th>Label</th><th>Description</th><th>Amount</th></tr></thead>
                    <tbody>
                        ${[...sales, ...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8).map(item => `
                            <tr>
                                <td>${new Date(item.date).toLocaleDateString()}</td>
                                <td>${item.client || item.supplier}</td>
                                <td>${item.product} (${item.quantity} ${item.unit || ''})</td>
                                <td style="color:${item.client ? 'var(--success)' : 'var(--danger)'}">Rs. ${Number(item.amount).toLocaleString()}</td>
                            </tr>
                        `).join('')}
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

    // Convert products to string for easy editing initially
    const prodStr = settings.products.map(p => `${p.name}:${p.price}:${p.unit}`).join(', ');

    document.getElementById('view-container').innerHTML = `
        <div class="content-block" style="max-width: 700px;">
            <h3>Business Branding & Pricing</h3>
            <form id="settings-form" style="margin-top: 1rem;">
                <div class="form-group">
                    <label>Business Name</label>
                    <input type="text" id="set-appname" value="${settings.appName}" required>
                </div>
                <div class="form-group">
                    <label>Phone Number</label>
                    <input type="text" id="set-phone" value="${settings.phone}" required>
                </div>
                <div class="form-group">
                    <label>Products & Pricing (Format: Product:Price:Unit)</label>
                    <textarea id="set-products" rows="6" placeholder="Milk:180:Liters, Butter:1200:kg">${prodStr}</textarea>
                    <small style="color:var(--text-muted)">Separate products with commas. Example: Milk:180:Liters</small>
                </div>
                <div class="form-group">
                    <label>Suppliers (Comma separated)</label>
                    <textarea id="set-suppliers" rows="3">${settings.suppliers.join(', ')}</textarea>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%">Save All Settings</button>
            </form>

            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 2px solid var(--border);">
                <h3>Data Safety & Backups</h3>
                <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">
                    Download a copy of your data to keep it safe in your folder.
                </p>
                <div style="display:flex; gap:10px;">
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
            return {
                name: parts[0] || 'Unknown',
                price: Number(parts[1]) || 0,
                unit: parts[2] || 'Unit'
            };
        });

        const newSettings = {
            appName: document.getElementById('set-appname').value,
            phone: document.getElementById('set-phone').value,
            products: parsedProducts,
            suppliers: document.getElementById('set-suppliers').value.split(',').map(i => i.trim()).filter(i => i)
        };
        Storage.setSettings(newSettings);
        alert('Settings Saved Successfully!');
        renderView('dashboard');
    };
}

// Sale List
function renderSalesList() {
    const sales = Storage.get('sales');
    document.getElementById('view-title').textContent = 'Sales Records';
    document.getElementById('view-container').innerHTML = `
        <div class="content-block">
            <div class="block-header">
                <input type="text" id="sales-search" placeholder="Search client..." class="search-input">
            </div>
            <div class="data-table-container">
                <table>
                    <thead><tr><th>Date</th><th>Client</th><th>Product</th><th>Qty</th><th>Total</th><th>Actions</th></tr></thead>
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
    if (!sales.length) return '<tr><td colspan="6" style="text-align:center">No records.</td></tr>';
    return sales.map(s => `
        <tr>
            <td>${new Date(s.date).toLocaleDateString()}</td>
            <td><strong>${s.client}</strong></td>
            <td>${s.product}</td>
            <td>${s.quantity} ${s.unit || ''}</td>
            <td style="color:var(--success)">Rs. ${Number(s.amount).toLocaleString()}</td>
            <td>
                <button onclick="window.viewReceipt('${s.id}')" class="btn-text" style="color:var(--warning)">Rec</button>
                <button onclick="window.editEntry('${s.id}', 'sale')" class="btn-text">Edit</button>
                <button onclick="window.deleteEntry('${s.id}', 'sale')" class="btn-text danger">Del</button>
            </td>
        </tr>
    `).join('');
}

// Expense List
function renderExpenseList() {
    const exp = Storage.get('expenses');
    document.getElementById('view-title').textContent = 'Expenditure Records';
    document.getElementById('view-container').innerHTML = `
        <div class="content-block">
            <div class="block-header">
                <input type="text" id="exp-search" placeholder="Search supplier..." class="search-input">
            </div>
            <div class="data-table-container">
                <table>
                    <thead><tr><th>Date</th><th>Supplier</th><th>Product</th><th>Qty</th><th>Amount</th><th>Actions</th></tr></thead>
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
    if (!exp.length) return '<tr><td colspan="6" style="text-align:center">No records.</td></tr>';
    return exp.map(e => `
        <tr>
            <td>${new Date(e.date).toLocaleDateString()}</td>
            <td><strong>${e.supplier || 'N/A'}</strong></td>
            <td>${e.product || 'N/A'}</td>
            <td>${e.quantity || '0'} ${e.unit || ''}</td>
            <td style="color:var(--danger)">Rs. ${Number(e.amount).toLocaleString()}</td>
            <td>
                <button onclick="window.viewReceipt('${e.id}', 'expense')" class="btn-text" style="color:var(--warning)">Rec</button>
                <button onclick="window.editEntry('${e.id}', 'expense')" class="btn-text">Edit</button>
                <button onclick="window.deleteEntry('${e.id}', 'expense')" class="btn-text danger">Del</button>
            </td>
        </tr>
    `).join('');
}

// Monthly Reports
function renderReports() {
    const sales = Storage.get('sales');
    const exp = Storage.get('expenses');
    const monthly = {};
    [...sales, ...exp].forEach(item => {
        const d = new Date(item.date);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthly[k]) monthly[k] = { name: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), s: 0, e: 0, items: [] };
        if (item.client) monthly[k].s += Number(item.amount); else monthly[k].e += Number(item.amount);
        monthly[k].items.push(item);
    });
    const sorted = Object.keys(monthly).sort((a, b) => b.localeCompare(a));
    document.getElementById('view-title').textContent = 'Monthly Reports';
    document.getElementById('view-container').innerHTML = `
        <div class="content-block">
            ${sorted.map(k => `
                <div style="margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:10px">
                        <div>
                            <h3 style="color:var(--primary); margin:0">${monthly[k].name}</h3>
                            <div style="font-size:0.95rem; margin-top:5px; background:rgba(255,255,255,0.03); padding:8px; border-radius:8px">
                                <span style="color:var(--success)">Total Sales: Rs. ${monthly[k].s.toLocaleString()}</span> | 
                                <span style="color:var(--danger)">Total Expenses: Rs. ${monthly[k].e.toLocaleString()}</span> | 
                                <span style="font-weight:bold; color:${monthly[k].s - monthly[k].e >= 0 ? 'var(--success)' : 'var(--danger)'}">
                                    Net Balance: Rs. ${(monthly[k].s - monthly[k].e).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <button class="btn btn-secondary" onclick="window.printReport('${k}', '${monthly[k].name}')">Print / Save PDF</button>
                    </div>
                    <div class="data-table-container">
                        <table>
                            <thead><tr><th>Date</th><th>Label</th><th>Product</th><th>Qty</th><th>Total</th><th>Actions</th></tr></thead>
                            <tbody>
                                ${monthly[k].items.sort((a, b) => new Date(b.date) - new Date(a.date)).map(item => `
                                    <tr>
                                        <td>${new Date(item.date).toLocaleDateString()}</td>
                                        <td><strong>${item.client || item.supplier}</strong> <span class="badge ${item.client ? 'badge-sale' : 'badge-exp'}">${item.client ? 'S' : 'E'}</span></td>
                                        <td>${item.product}</td>
                                        <td>${item.quantity || '-'} ${item.unit || ''}</td>
                                        <td style="color:${item.client ? 'var(--success)' : 'var(--danger)'}">Rs. ${Number(item.amount).toLocaleString()}</td>
                                        <td>
                                            <div style="display:flex; gap:5px">
                                                <button onclick="window.viewReceipt('${item.id}', '${item.client ? 'sale' : 'expense'}')" class="btn-text" style="color:var(--warning)">Rec</button>
                                                <button onclick="window.editEntry('${item.id}', '${item.client ? 'sale' : 'expense'}')" class="btn-text">Edit</button>
                                                <button onclick="window.deleteEntry('${item.id}', '${item.client ? 'sale' : 'expense'}')" class="btn-text danger">Del</button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `).join('') || '<p>No data recorded yet.</p>'}
        </div>
    `;
}

// Utility: Printing Summary Report
window.printReport = (key, name) => {
    const sales = Storage.get('sales').filter(x => x.date.startsWith(key));
    const exp = Storage.get('expenses').filter(x => x.date.startsWith(key));
    const totalS = sales.reduce((a, b) => a + Number(b.amount), 0);
    const totalE = exp.reduce((a, b) => a + Number(b.amount), 0);
    const settings = Storage.getSettings();

    const html = `
        <div style="padding:40px; font-family:sans-serif; color:black;">
            <h1 style="text-align:center; color:#333">${settings.appName}</h1>
            <h2 style="text-align:center">${name} Summary Statement</h2>
            <hr/>
            <div style="display:flex; justify-content:space-around; margin:20px 0; border:1px solid #ddd; padding:20px; border-radius:10px">
                <div><p>Total Sales:</p><h3 style="color:green">Rs. ${totalS.toLocaleString()}</h3></div>
                <div><p>Total Expenses:</p><h3 style="color:red">Rs. ${totalE.toLocaleString()}</h3></div>
                <div><p>Net Profit/Loss:</p><h3 style="color:${totalS - totalE >= 0 ? 'green' : 'red'}">Rs. ${(totalS - totalE).toLocaleString()}</h3></div>
            </div>
            <h3>Detailed Transactions</h3>
            <table style="width:100%; border-collapse:collapse;">
                <tr style="background:#f4f4f4">
                    <th style="border:1px solid #ddd; padding:8px; text-align:left">Date</th>
                    <th style="border:1px solid #ddd; padding:8px; text-align:left">Party</th>
                    <th style="border:1px solid #ddd; padding:8px; text-align:left">Product</th>
                    <th style="border:1px solid #ddd; padding:8px; text-align:right">Amount</th>
                </tr>
                ${[...sales, ...exp].sort((a, b) => new Date(a.date) - new Date(b.date)).map(item => `
                    <tr>
                        <td style="border:1px solid #ddd; padding:8px">${new Date(item.date).toLocaleDateString()}</td>
                        <td style="border:1px solid #ddd; padding:8px">${item.client || item.supplier} (${item.client ? 'Sale' : 'Exp'})</td>
                        <td style="border:1px solid #ddd; padding:8px">${item.product} (x${item.quantity})</td>
                        <td style="border:1px solid #ddd; padding:8px; text-align:right; color:${item.client ? 'green' : 'red'}">Rs. ${Number(item.amount).toLocaleString()}</td>
                    </tr>
                `).join('')}
            </table>
            <p style="text-align:center; margin-top:30px; font-size:0.8rem">Printed on: ${new Date().toLocaleString()}</p>
        </div>
    `;
    const win = window.open('', '', 'width=900,height=900');
    win.document.write(`<html><head><title>Report_${name}</title></head><body onload="window.print();window.close()">${html}</body></html>`);
    win.document.close();
};

// Modal Logic
function openModal(type, id = null) {
    currentState.editingType = type;
    currentState.editingId = id;
    const isEdit = !!id;
    const settings = Storage.getSettings();
    const clients = Storage.get('clients');
    const data = isEdit ? (type === 'sale' ? Storage.get('sales').find(s => s.id === id) : Storage.get('expenses').find(e => e.id === id)) : null;

    document.getElementById('modal-title').textContent = (isEdit ? 'Edit ' : 'New ') + (type === 'sale' ? 'Sale' : 'Expenditure');

    let labelText = type === 'sale' ? 'Client' : 'Supplier';
    let dropdownSearch = type === 'sale' ? clients : settings.suppliers;

    document.getElementById('entry-form').innerHTML = `
        <div class="form-group"><label>Date</label><input type="date" name="date" value="${data ? data.date : new Date().toISOString().split('T')[0]}" required></div>
        <div class="form-group">
            <label>${labelText}</label>
            <select name="party" id="modal-party-select" required>
                <option value="">-- Select ${labelText} --</option>
                ${dropdownSearch.map(c => `<option value="${c}" ${data && (data.client === c || data.supplier === c) ? 'selected' : ''}>${c}</option>`).join('')}
                ${type === 'sale' ? '<option value="NEW">+ Add New Client</option>' : ''}
            </select>
            <input type="text" id="new-client-input" placeholder="Enter new client name" style="display:none; margin-top:5px">
        </div>
        <div class="form-group">
            <label>Product</label>
            <select name="product" id="modal-product-select" required>
                <option value="">-- Choose Product --</option>
                ${settings.products.map(p => `<option value="${p.name}" ${data && data.product === p.name ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Quantity | Unit | Price</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1.5fr; gap:10px">
                <input type="number" name="quantity" id="modal-qty" value="${data ? data.quantity : ''}" step="any" placeholder="Qty" required>
                <input type="text" name="unit" id="modal-unit" value="${data ? data.unit : ''}" placeholder="Unit" readonly>
                <input type="number" name="price" id="modal-price" value="${data ? data.price : ''}" step="any" placeholder="Price" required>
            </div>
        </div>
        <div class="form-group">
            <label>Total Amount (Rs.)</label>
            <input type="number" name="amount" id="modal-amount" value="${data ? data.amount : ''}" step="any" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px">${isEdit ? 'Update' : 'Save'}</button>
    `;

    const productSelect = document.getElementById('modal-product-select');
    const unitInput = document.getElementById('modal-unit');
    const priceInput = document.getElementById('modal-price');
    const qtyInput = document.getElementById('modal-qty');
    const amountInput = document.getElementById('modal-amount');

    productSelect.onchange = (e) => {
        const prod = settings.products.find(p => p.name === e.target.value);
        if (prod) {
            unitInput.value = prod.unit;
            priceInput.value = prod.price;
            if (qtyInput.value) amountInput.value = (Number(qtyInput.value) * prod.price).toFixed(2);
        }
    };

    const calc = () => {
        const total = Number(qtyInput.value || 0) * Number(priceInput.value || 0);
        amountInput.value = total > 0 ? total.toFixed(2) : '';
    };
    qtyInput.oninput = calc;
    priceInput.oninput = calc;

    const partySelect = document.getElementById('modal-party-select');
    if (partySelect) {
        partySelect.onchange = (e) => {
            const input = document.getElementById('new-client-input');
            input.style.display = e.target.value === 'NEW' ? 'block' : 'none';
            if (e.target.value === 'NEW') input.required = true;
        };
    }
    document.getElementById('modal-container').classList.add('active');
}

function setupEventListeners() {
    document.getElementById('add-sale-btn').onclick = () => openModal('sale');
    document.getElementById('add-exp-btn').onclick = () => openModal('expense');
    document.querySelector('.close-modal').onclick = () => document.getElementById('modal-container').classList.remove('active');

    document.getElementById('entry-form').onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const type = currentState.editingType;

        const entry = {
            id: currentState.editingId || Date.now().toString(),
            date: fd.get('date'),
            amount: fd.get('amount'),
            product: fd.get('product'),
            quantity: fd.get('quantity'),
            unit: fd.get('unit'),
            price: fd.get('price'),
            timestamp: Date.now()
        };

        if (type === 'sale') {
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
        document.getElementById('modal-container').classList.remove('active');
        renderView(currentState.currentView);
    };

    const navItems = document.querySelectorAll('.nav-links li');
    navItems.forEach(item => item.onclick = () => renderView(item.dataset.view));
    window.onclick = (e) => { if (e.target === document.getElementById('modal-container')) document.getElementById('modal-container').classList.remove('active'); };
}

window.editEntry = (id, type) => openModal(type, id);
window.deleteEntry = (id, type) => {
    if (confirm('Delete this record?')) {
        const key = type === 'sale' ? 'sales' : 'expenses';
        Storage.set(key, Storage.get(key).filter(i => i.id !== id));
        renderView(currentState.currentView);
    }
};

// Receipt Viewer (Unified for Sales and Expenses)
window.viewReceipt = (id, type = 'sale') => {
    const list = type === 'sale' ? Storage.get('sales') : Storage.get('expenses');
    const item = list.find(x => x.id === id);
    const settings = Storage.getSettings();
    if (!item) return;

    const label = type === 'sale' ? 'Customer' : 'Supplier';
    const partyName = item.client || item.supplier;

    document.getElementById('modal-title').textContent = type === 'sale' ? 'Sales Receipt' : 'Expense Voucher';
    document.getElementById('entry-form').innerHTML = `
        <div id="receipt-box" style="padding:20px; color:black; background:white; font-family:monospace; border:1px solid #ddd">
            <h2 style="text-align:center">${settings.appName}</h2>
            <p style="text-align:center; margin-top:-10px">Phone: ${settings.phone}</p>
            <h4 style="text-align:center; text-transform:uppercase; border:1px solid #000; padding:5px; margin:10px 0">
                ${type === 'sale' ? 'Sales Receipt' : 'Expense Voucher'}
            </h4>
            <p><strong>Date:</strong> ${new Date(item.date).toLocaleDateString()} &nbsp; <strong>No:</strong> ${item.id.slice(-5)}</p>
            <p><strong>${label}:</strong> ${partyName}</p>
            <hr/>
            <table style="width:100%">
                <tr><td>Product:</td><td style="text-align:right">${item.product}</td></tr>
                <tr><td>Qty:</td><td style="text-align:right">${item.quantity} ${item.unit || ''}</td></tr>
                <tr><td>Rate:</td><td style="text-align:right">Rs. ${item.price || '-'}</td></tr>
                <tr style="font-weight:bold; font-size:1.1rem; border-top:1px solid #000">
                    <td style="padding-top:10px">Total:</td>
                    <td style="padding-top:10px; text-align:right">Rs. ${Number(item.amount).toLocaleString()}</td>
                </tr>
            </table>
            <p style="margin-top:30px; text-align:center; font-size:0.8rem">Software powered by Daud Soft Techs</p>
        </div>
        <div style="display:flex; gap:10px; margin-top:20px">
            <button type="button" class="btn btn-primary" onclick="window.doPrint()" style="flex:1">Print / Save PDF</button>
            <button type="button" class="btn btn-secondary" onclick="window.doWhatsApp('${partyName}', '${item.amount}', '${type}')" style="flex:1; background:#25d366; color:white">WhatsApp</button>
        </div>
    `;
    document.getElementById('modal-container').classList.add('active');
};
window.doPrint = () => {
    const html = document.getElementById('receipt-box').innerHTML;
    const win = window.open('', '', 'width=600,height=600');
    win.document.write(`<html><body onload="window.print();window.close()">${html}</body></html>`);
    win.document.close();
};
window.doWhatsApp = (name, amount, type = 'sale') => {
    const label = type === 'sale' ? 'Sales Receipt' : 'Expense Voucher';
    const msg = `*${label} from Daud Dairy Products*%0AName: ${name}%0AAmount: Rs. ${Number(amount).toLocaleString()}%0AThank you!`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
};

// Client Statement Printing (Optimized for PDF)
window.printClientStatement = (client) => {
    const sales = Storage.get('sales').filter(s => s.client === client);
    const total = sales.reduce((sum, s) => sum + Number(s.amount), 0);
    const settings = Storage.getSettings();
    const html = `<div style="padding:30px; font-family:sans-serif; color:black;">
        <h1 style="text-align:center; margin:0">${settings.appName}</h1>
        <p style="text-align:center; margin-top:0">Phone: ${settings.phone}</p>
        <h2 style="text-align:center; border-bottom: 2px solid #333; padding-bottom:10px">Account Statement: ${client}</h2>
        <table style="width:100%; border-collapse:collapse; margin-top:20px">
            <thead><tr style="background:#eee"><th style="border:1px solid #ddd; padding:10px">Date</th><th style="border:1px solid #ddd; padding:10px">Product</th><th style="border:1px solid #ddd; padding:10px">Qty</th><th style="border:1px solid #ddd; padding:10px">Amount</th></tr></thead>
            <tbody>${sales.map(s => `<tr><td style="border:1px solid #ddd; padding:10px">${new Date(s.date).toLocaleDateString()}</td><td style="border:1px solid #ddd; padding:10px">${s.product}</td><td style="border:1px solid #ddd; padding:10px">${s.quantity} ${s.unit || ''}</td><td style="border:1px solid #ddd; padding:10px; text-align:right">Rs. ${Number(s.amount).toLocaleString()}</td></tr>`).join('')}</tbody>
            <tfoot><tr style="font-weight:bold; background: #fafafa"><td colspan="3" style="border:1px solid #ddd; padding:10px; text-align:right">Total Balance Due:</td><td style="border:1px solid #ddd; padding:10px; text-align:right">Rs. ${total.toLocaleString()}</td></tr></tfoot>
        </table>
        <p style="margin-top:40px; text-align:center; font-size:0.8rem">Printed via Daud Soft Techs - ${new Date().toLocaleString()}</p>
    </div>`;
    const win = window.open('', '', 'width=900,height=900');
    win.document.write(`<html><head><title>Statement_${client}</title></head><body>${html}</body><script>window.onload=function(){window.print();window.close();}</script></html>`);
    win.document.close();
};

function renderClients() {
    const sales = Storage.get('sales');
    const clients = Storage.get('clients');
    document.getElementById('view-title').textContent = 'Client Directory';
    document.getElementById('view-container').innerHTML = `<div class="stats-grid">
        ${clients.map(c => {
        const total = sales.filter(s => s.client === c).reduce((sum, s) => sum + Number(s.amount), 0);
        return `<div class="stat-card" style="cursor:pointer" onclick="window.renderClientDetail('${c}')">
                <span class="stat-label">Client</span><span class="stat-value" style="font-size:1.4rem">${c}</span>
                <span class="stat-trend trend-up">Balance: Rs. ${total.toLocaleString()}</span>
            </div>`;
    }).join('') || '<p>No clients yet.</p>'}
    </div>`;
}
window.renderClientDetail = (client) => {
    const sales = Storage.get('sales').filter(s => s.client === client);
    const total = sales.reduce((sum, s) => sum + Number(s.amount), 0);
    document.getElementById('view-container').innerHTML = `
        <div class="content-block">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
                <button class="btn btn-secondary" onclick="window.renderView('clients')">← Back</button>
                <button class="btn btn-primary" onclick="window.printClientStatement('${client}')">Print Full Statement</button>
            </div>
            <table>
                <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Amount</th><th>Actions</th></tr></thead>
                <tbody>${sales.map(s => `<tr><td>${new Date(s.date).toLocaleDateString()}</td><td>${s.product}</td><td>${s.quantity} ${s.unit}</td><td>Rs. ${Number(s.amount).toLocaleString()}</td>
                <td><button onclick="window.viewReceipt('${s.id}')" class="btn-text">Rec</button><button onclick="window.editEntry('${s.id}', 'sale')" class="btn-text">Edit</button><button onclick="window.deleteEntry('${s.id}', 'sale')" class="btn-text danger">Del</button></td></tr>`).join('')}</tbody>
                <tfoot><tr style="font-weight:bold"><td>Total</td><td colspan="2"></td><td>Rs. ${total.toLocaleString()}</td><td></td></tr></tfoot>
            </table>
        </div>`;
};
// Backup & Restore Logic
window.backupData = () => {
    const data = {
        sales: Storage.get('sales'),
        expenses: Storage.get('expenses'),
        clients: Storage.get('clients'),
        settings: Storage.getSettings()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ledger_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

window.restoreData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm('This will overwrite your current data. Continue?')) {
                if (data.sales) Storage.set('sales', data.sales);
                if (data.expenses) Storage.set('expenses', data.expenses);
                if (data.clients) Storage.set('clients', data.clients);
                if (data.settings) Storage.setSettings(data.settings);
                alert('Data Restored Successfully!');
                location.reload();
            }
        } catch (err) {
            alert('Error: Invalid backup file.');
        }
    };
    reader.readAsText(file);
};
