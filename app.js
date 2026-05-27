// ==========================================
// STATE
// ==========================================
let currentUser = null;
let expenses = []; // Loaded from Firestore
let currentBaseCurrency = localStorage.getItem('baseCurrency') || 'MYR';
let exchangeRates = {}; // Anchor: USD

// ==========================================
// DOM ELEMENTS
// ==========================================
// Auth
const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('appScreen');
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');

// Sidebar user info
const userAvatar = document.getElementById('userAvatar');
const userDisplayName = document.getElementById('userDisplayName');
const userEmail = document.getElementById('userEmail');
const headerUsername = document.getElementById('headerUsername');

// Dashboard Elements
const baseCurrencySelect = document.getElementById('baseCurrency');
const rateStatus = document.getElementById('rateStatus');
const baseCurrencyLabels = document.querySelectorAll('.base-currency-label');

const dailyTotalEl = document.getElementById('dailyTotal');
const monthlyTotalEl = document.getElementById('monthlyTotal');
const totalTransactionsEl = document.getElementById('totalTransactions');

const transactionList = document.getElementById('transactionList');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const tableWrapper = document.getElementById('tableWrapper');

// Chart instances
let categoryChartInstance = null;
let trendChartInstance = null;

// Modal
let itemToDelete = null;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Check if Firebase config is missing
    if (!firebase.apps.length || firebaseConfig.apiKey === "YOUR_API_KEY") {
        showError('loginError', 'Firebase is not configured. Please add your credentials to firebase-config.js');
        showError('signupError', 'Firebase is not configured. Please add your credentials to firebase-config.js');
    }

    baseCurrencySelect.value = currentBaseCurrency;
    
    // Set up Firebase Auth Listener
    if (auth) {
        auth.onAuthStateChanged(handleAuthStateChange);
    }
    
    // Setup inputs and currency preview
    setupEventListeners();
});

// ==========================================
// AUTHENTICATION LOGIC
// ==========================================
function switchTab(tab) {
    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        loginError.classList.add('hidden');
    } else {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        signupError.classList.add('hidden');
    }
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function showError(elId, msg) {
    const el = document.getElementById(elId);
    el.textContent = msg;
    el.classList.remove('hidden');
}

async function handleLogin(e) {
    e.preventDefault();
    loginError.classList.add('hidden');
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in...';

    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        // auth listener will trigger UI change
    } catch (err) {
        showError('loginError', err.message);
        btn.disabled = false;
        btn.innerHTML = '<span>Log In</span><i class="fa-solid fa-arrow-right"></i>';
    }
}

async function handleSignup(e) {
    e.preventDefault();
    signupError.classList.add('hidden');
    
    const pass = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    
    if (pass !== confirm) {
        showError('signupError', "Passwords do not match.");
        return;
    }

    const btn = document.getElementById('signupBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating...';

    const email = document.getElementById('signupEmail').value;
    const name = document.getElementById('signupName').value;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        await userCredential.user.updateProfile({ displayName: name });
        // auth listener will trigger UI change
    } catch (err) {
        showError('signupError', err.message);
        btn.disabled = false;
        btn.innerHTML = '<span>Create Account</span><i class="fa-solid fa-user-plus"></i>';
    }
}

function handleLogout() {
    auth.signOut();
}

let unsubscribeFirestore = null;

function handleAuthStateChange(user) {
    if (user) {
        // User logged in
        currentUser = user;
        
        // Update UI
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        
        const name = user.displayName || 'User';
        userDisplayName.textContent = name;
        headerUsername.textContent = name;
        userEmail.textContent = user.email;
        userAvatar.textContent = name.charAt(0).toUpperCase();

        // Init App Data
        initDashboard();
        
    } else {
        // User logged out
        currentUser = null;
        expenses = [];
        
        if (unsubscribeFirestore) {
            unsubscribeFirestore();
            unsubscribeFirestore = null;
        }

        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        
        // Reset auth buttons
        document.getElementById('loginBtn').disabled = false;
        document.getElementById('loginBtn').innerHTML = '<span>Log In</span><i class="fa-solid fa-arrow-right"></i>';
        document.getElementById('signupBtn').disabled = false;
        document.getElementById('signupBtn').innerHTML = '<span>Create Account</span><i class="fa-solid fa-user-plus"></i>';
        
        // Reset forms
        loginForm.reset();
        signupForm.reset();
    }
}


// ==========================================
// CORE APP LOGIC
// ==========================================

async function initDashboard() {
    // 1. Set Date input default to today
    document.getElementById('expenseDate').valueAsDate = new Date();
    
    // 2. Fetch Rates
    await fetchExchangeRates();
    
    // 3. Listen to Firestore
    listenToExpenses();
}

async function fetchExchangeRates() {
    rateStatus.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Fetching rates...';
    rateStatus.classList.add('visible');
    
    try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        const data = await response.json();
        exchangeRates = data.usd;
        
        rateStatus.innerHTML = '<i class="fa-solid fa-check" style="color:var(--accent-success)"></i> Live rates active';
        setTimeout(() => rateStatus.classList.remove('visible'), 3000);
        
        // Triggers UI re-render if data was already loaded
        updateDashboardUI();
    } catch (error) {
        console.error("Failed to fetch exchange rates:", error);
        exchangeRates = { usd: 1, myr: 4.7, idr: 15600 };
        rateStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-danger)"></i> Offline rates';
    }
}

// Subscribe to real-time updates from Firestore
function listenToExpenses() {
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    tableWrapper.classList.add('hidden');

    const expensesRef = db.collection('users').doc(currentUser.uid).collection('expenses');
    
    // Order by date descending
    unsubscribeFirestore = expensesRef.orderBy('date', 'desc').onSnapshot(snapshot => {
        loadingState.classList.add('hidden');
        
        expenses = [];
        snapshot.forEach(doc => {
            expenses.push({ id: doc.id, ...doc.data() });
        });
        
        updateDashboardUI();
    }, error => {
        console.error("Error listening to expenses:", error);
        loadingState.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><p>Error loading data</p>';
    });
}

// Convert amount using USD as anchor
function convertCurrency(amount, fromCurrency, toCurrency) {
    if (!exchangeRates || Object.keys(exchangeRates).length === 0) return amount;
    
    fromCurrency = fromCurrency.toLowerCase();
    toCurrency = toCurrency.toLowerCase();
    
    if (fromCurrency === toCurrency) return amount;
    
    const amountInUSD = amount / exchangeRates[fromCurrency];
    return amountInUSD * exchangeRates[toCurrency];
}

function formatMoney(amount, currency) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function onBaseCurrencyChange(val) {
    currentBaseCurrency = val;
    localStorage.setItem('baseCurrency', val);
    baseCurrencyLabels.forEach(label => label.textContent = currentBaseCurrency);
    updateDashboardUI();
    updateLivePreview();
}

function setupEventListeners() {
    // Live currency preview
    const amtInput = document.getElementById('amount');
    const curSelect = document.getElementById('expenseCurrency');
    
    const updatePreview = () => updateLivePreview();
    amtInput.addEventListener('input', updatePreview);
    curSelect.addEventListener('change', updatePreview);
}

function updateLivePreview() {
    const amt = parseFloat(document.getElementById('amount').value);
    const cur = document.getElementById('expenseCurrency').value;
    const previewEl = document.getElementById('conversionPreview');
    
    if (isNaN(amt) || amt <= 0 || cur === currentBaseCurrency) {
        previewEl.textContent = '';
        return;
    }
    
    const converted = convertCurrency(amt, cur, currentBaseCurrency);
    previewEl.textContent = `≈ ${formatMoney(converted, currentBaseCurrency)}`;
}

// ==========================================
// FIRESTORE CRUD
// ==========================================

async function handleAddExpense(e) {
    e.preventDefault();
    
    const btn = document.getElementById('addExpenseBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Adding...';

    const amount = parseFloat(document.getElementById('amount').value);
    const currency = document.getElementById('expenseCurrency').value;
    const category = document.getElementById('category').value;
    const date = document.getElementById('expenseDate').value;
    const description = document.getElementById('description').value;
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();

    const expenseData = {
        amount, currency, category, date, description, createdAt: timestamp
    };

    try {
        await db.collection('users').doc(currentUser.uid).collection('expenses').add(expenseData);
        
        // Reset form
        document.getElementById('amount').value = '';
        document.getElementById('description').value = '';
        document.getElementById('category').value = '';
        document.getElementById('conversionPreview').textContent = '';
        
    } catch (err) {
        console.error("Error adding expense:", err);
        alert("Failed to add expense.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Transaction';
    }
}

function requestDelete(id) {
    itemToDelete = id;
    document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
    itemToDelete = null;
    document.getElementById('deleteModal').classList.add('hidden');
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!itemToDelete) return;
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.textContent = "Deleting...";

    try {
        await db.collection('users').doc(currentUser.uid).collection('expenses').doc(itemToDelete).delete();
        closeDeleteModal();
    } catch (err) {
        console.error("Error deleting expense:", err);
        alert("Failed to delete.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Delete";
    }
});

// ==========================================
// UI RENDERERS
// ==========================================

function updateDashboardUI() {
    renderTransactions();
    calculateSummaries();
    updateCharts();
}

function renderTransactions() {
    transactionList.innerHTML = '';
    
    // Filtering
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filterCat = document.getElementById('filterCategory').value;
    
    let filtered = expenses;
    if (searchTerm) {
        filtered = filtered.filter(exp => 
            (exp.description && exp.description.toLowerCase().includes(searchTerm)) || 
            (exp.category && exp.category.toLowerCase().includes(searchTerm))
        );
    }
    if (filterCat) {
        filtered = filtered.filter(exp => exp.category === filterCat);
    }

    if (filtered.length === 0) {
        tableWrapper.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    tableWrapper.classList.remove('hidden');
    emptyState.classList.add('hidden');

    filtered.forEach(exp => {
        const convertedAmount = convertCurrency(exp.amount, exp.currency, currentBaseCurrency);
        
        // Date formatting
        let dateStr = "Unknown";
        if (exp.date) {
            const [y,m,d] = exp.date.split('-');
            dateStr = new Date(y, m-1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${exp.description || '-'}</td>
            <td><span class="category-badge">${exp.category}</span></td>
            <td>${formatMoney(exp.amount, exp.currency)}</td>
            <td style="font-weight: 600; color: var(--accent-primary)">${formatMoney(convertedAmount, currentBaseCurrency)}</td>
            <td>
                <button class="btn-delete" onclick="requestDelete('${exp.id}')" title="Delete">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        transactionList.appendChild(tr);
    });
}

function calculateSummaries() {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM

    let dailySum = 0;
    let monthlySum = 0;

    expenses.forEach(exp => {
        const converted = convertCurrency(exp.amount, exp.currency, currentBaseCurrency);
        
        if (exp.date === todayStr) {
            dailySum += converted;
        }
        if (exp.date && exp.date.startsWith(currentMonthStr)) {
            monthlySum += converted;
        }
    });

    dailyTotalEl.textContent = formatMoney(dailySum, currentBaseCurrency);
    monthlyTotalEl.textContent = formatMoney(monthlySum, currentBaseCurrency);
    totalTransactionsEl.textContent = expenses.length;
}

function updateCharts() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Inter';

    const categoryData = {};
    const trendData = {}; 
    
    // Initialize last 7 days (including today)
    const sortedDates = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        // Correct timezone offset issue
        const dStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        trendData[dStr] = 0;
        sortedDates.push(dStr);
    }

    expenses.forEach(exp => {
        const converted = convertCurrency(exp.amount, exp.currency, currentBaseCurrency);
        
        // Category
        if (categoryData[exp.category]) {
            categoryData[exp.category] += converted;
        } else {
            categoryData[exp.category] = converted;
        }
        
        // Trend
        if (trendData[exp.date] !== undefined) {
            trendData[exp.date] += converted;
        }
    });

    renderCategoryChart(categoryData);
    renderTrendChart(trendData, sortedDates);
}

function renderCategoryChart(dataObj) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const emptyMsg = document.getElementById('categoryChartEmpty');
    
    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    const labels = Object.keys(dataObj);
    const data = Object.values(dataObj);
    
    if (labels.length === 0) {
        emptyMsg.classList.remove('hidden');
        document.getElementById('categoryChart').style.display = 'none';
        return;
    }
    
    emptyMsg.classList.add('hidden');
    document.getElementById('categoryChart').style.display = 'block';

    const colors = {
        'Food & Dining': '#3b82f6',
        'Transportation': '#10b981',
        'Shopping': '#f59e0b',
        'Entertainment': '#8b5cf6',
        'Transfers': '#64748b',
        'Utilities': '#0ea5e9',
        'Healthcare': '#ef4444',
        'Education': '#ec4899',
        'Other': '#94a3b8'
    };

    const bgColors = labels.map(l => colors[l] || colors['Other']);

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#f8fafc', padding: 20, font: { size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${formatMoney(ctx.raw, currentBaseCurrency)}`
                    }
                }
            },
            cutout: '75%'
        }
    });
}

function renderTrendChart(dataObj, sortedDates) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    const labels = sortedDates.map(dateStr => {
        const [y,m,d] = dateStr.split('-');
        return new Date(y, m-1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const data = sortedDates.map(dateStr => dataObj[dateStr]);

    // Dynamic gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.2)');

    trendChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Spend (${currentBaseCurrency})`,
                data: data,
                backgroundColor: gradient,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    border: { display: false },
                    ticks: {
                        callback: (val) => {
                            if (val >= 1000) return (val/1000) + 'k';
                            return val;
                        }
                    }
                },
                x: {
                    grid: { display: false },
                    border: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${formatMoney(ctx.raw, currentBaseCurrency)}`
                    }
                }
            }
        }
    });
}
