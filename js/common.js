// --- SHARED STATE ---
let selectedProjId = null;
let selectedMember = null;
let isTaskEdit = false;
let isProjectEdit = false;
let allProjects = {};
let currentTasks = {};
let currentMembers = {};
let currentSprints = {};

const statusOrder = ['NotStarted', 'InProgress', 'AlmostDone', 'InReview', 'Done'];
const statusMap = {
    'NotStarted': { label: 'Not Started', class: 'status-not-started', hoverClass: 'hover:bg-gray-500/10 hover:text-gray-400', color: 'bg-gray-600', iconColor: 'text-gray-400', icon: 'circle-dashed' },
    'InProgress': { label: 'In Progress', class: 'status-in-progress', hoverClass: 'hover:bg-blue-500/10 hover:text-blue-400', color: 'bg-blue-500', iconColor: 'text-blue-400', icon: 'clock' },
    'AlmostDone': { label: 'Almost Done', class: 'status-almost-done', hoverClass: 'hover:bg-purple-500/10 hover:text-purple-400', color: 'bg-purple-500', iconColor: 'text-purple-400', icon: 'loader' },
    'InReview': { label: 'In Review', class: 'status-in-review', hoverClass: 'hover:bg-amber-500/10 hover:text-amber-400', color: 'bg-amber-500', iconColor: 'text-amber-400', icon: 'eye' },
    'Done': { label: 'Done', class: 'status-done', hoverClass: 'hover:bg-emerald-500/10 hover:text-emerald-400', color: 'bg-emerald-500', iconColor: 'text-emerald-400', icon: 'check-circle' }
};

let iconList = [
    'layers', 'briefcase', 'code', 'layout', 'database', 'user', 'users', 'settings', 'terminal', 'cpu',
    'globe', 'zap', 'activity', 'chart-bar', 'folder', 'calendar', 'clipboard-list', 'cloud', 'shield', 'rocket',
    'check-circle', 'star', 'heart', 'flag', 'map', 'camera', 'video', 'music', 'shopping-cart', 'package',
    'box', 'truck', 'wrench', 'anchor', 'award', 'book', 'bookmark', 'coffee', 'command', 'compass',
    'credit-card', 'feather', 'file-text', 'gift', 'hard-drive', 'image', 'key', 'link', 'mail', 'monitor'
];

function updateIconCount() {
    const badge = document.getElementById('icon-count-badge');
    if (badge) badge.innerText = `${iconList.length} Available`;
}

function refreshIcons() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Initializer
function startCommon() {
    injectSharedUI();
    updateIconCount();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startCommon);
} else {
    startCommon();
}

// --- NAVIGATION & LOGOUT ---
function logout() {
    localStorage.clear();
    const prefix = window.location.pathname.includes('/pages/') ? '../' : '';
    window.location.href = prefix + "index.html";
}

function backToProjects() {
    selectedProjId = null;
    selectedMember = null;
    localStorage.removeItem('tt_member');
    localStorage.removeItem('tt_project');
    const prefix = window.location.pathname.includes('/pages/') ? '../' : '';
    window.location.href = prefix + "index.html";
}

// Launch Meeting Overlay
async function openMeetingModal(mode = 'join') {
    if (typeof openMeetingOverlay === 'function') {
        openMeetingOverlay(mode);
    } else {
        showNotification("Connecting to secure server...", true);
        setTimeout(() => {
            if (typeof openMeetingOverlay === 'function') {
                openMeetingOverlay(mode);
            } else {
                console.error("Meeting Overlay logic strictly missing.");
            }
        }, 1500);
    }
}


function backToMembers() {
    selectedMember = null;
    localStorage.removeItem('tt_member');
    if (selectedProjId) {
        const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
        window.location.href = prefix + "team.html";
    } else {
        backToProjects();
    }
}

function handleGlobalBack() {
    // Determine context based on URL or identifiable DOM elements
    if (document.getElementById('dashboard-view')) {
        backToMembers();
    } else if (document.getElementById('member-view')) {
        backToProjects();
    }
}

// --- UX HELPERS & MODALS ---
function hideLoader() {
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.classList.add('hidden'), 700);
    }
}

function showNotification(msg, isWarning = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    const toastMsg = document.getElementById('toast-msg');
    const iconBg = document.getElementById('toast-icon-bg');
    const icon = document.getElementById('toast-icon');

    toastMsg.innerText = msg;
    if (isWarning) {
        iconBg.classList.replace('bg-emerald-500/10', 'bg-red-500/10');
        icon.classList.replace('text-emerald-500', 'text-red-500');
        icon.setAttribute('data-lucide', 'alert-circle');
    } else {
        iconBg.classList.replace('bg-red-500/10', 'bg-emerald-500/10');
        icon.classList.replace('text-red-500', 'text-emerald-500');
        icon.setAttribute('data-lucide', 'check');
    }
    refreshIcons();
    toast.classList.remove('translate-y-32', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-32', 'opacity-0'), 3500);
}

// --- ADMIN MODE LOGIC ---
let logoClicks = 0;
let logoClickTimer = null;

function isAdminActive() {
    return localStorage.getItem('tt_admin_mode') === 'true';
}

function handleLogoClick(e) {
    if (e) e.stopPropagation();

    logoClicks++;
    if (logoClickTimer) clearTimeout(logoClickTimer);

    logoClickTimer = setTimeout(() => {
        logoClicks = 0;
    }, 3000);

    if (logoClicks >= 10) {
        logoClicks = 0;
        openAdminModal();
    }
}

function openAdminModal() {
    const modal = document.getElementById('admin-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const input = document.getElementById('admin-password');
    if (input) {
        input.value = '';
        input.focus();
    }
}

function closeAdminModal() {
    const modal = document.getElementById('admin-modal');
    if (modal) modal.classList.add('hidden');
}

function verifyAdminAccess() {
    const input = document.getElementById('admin-password');
    if (!input) return;

    if (input.value === 'admin123') {
        localStorage.setItem('tt_admin_mode', 'true');
        showNotification("Admin Mode Activated - All restrictions bypassed", false);
        closeAdminModal();
        updateHeaderAdminUI();
    } else {
        showNotification("Invalid Admin Password", true);
        input.value = '';
        input.focus();
    }
}

function deactivateAdminMode() {
    localStorage.removeItem('tt_admin_mode');
    showNotification("Admin Mode Deactivated", true);
    updateHeaderAdminUI();
}

function updateHeaderAuthUI(user) {
    const container = document.getElementById('header-auth-container');
    if (!container) return;

    if (user) {
        // Logged In -> Show Logout
        container.innerHTML = `
            <button onclick="handleLogout()" class="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all group">
                <i data-lucide="log-out" class="w-3.5 h-3.5 text-red-500"></i>
                <span class="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Logout</span>
            </button>
        `;
    } else {
        // Logged Out -> Show Login
        container.innerHTML = `
            <button onclick="openMeetingModal('join')" class="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all group">
                <i data-lucide="user" class="w-3.5 h-3.5 text-emerald-500"></i>
                <span class="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Login</span>
            </button>
        `;
    }
    refreshIcons();
}


function updateHeaderAdminUI() {
    const container = document.getElementById('admin-exit-container');
    if (!container) return;

    if (isAdminActive()) {
        container.innerHTML = `
            <button onclick="deactivateAdminMode()" class="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-gray-900/90 border border-red-500/30 text-red-500 hover:bg-gray-800 transition-all animate-pulse-red group">
                <i data-lucide="log-out" class="w-3.5 h-3.5 text-red-500"></i>
                <span class="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Exit Admin</span>
            </button>
        `;
    } else {
        container.innerHTML = '';
    }
    refreshIcons();
}


// Security Modal
let securityCallback = null;
function requestSecurityAuth(callback) {
    securityCallback = callback;
    const modal = document.getElementById('security-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    const tokenInput = document.getElementById('security-token');
    const title = modal.querySelector('h3');
    const sub = modal.querySelector('p');

    // Step 1: Password
    title.innerText = "Security Auth";
    sub.innerText = "Enter security password";
    tokenInput.placeholder = "PASSWORD";
    tokenInput.type = "password";
    tokenInput.value = '';
    tokenInput.focus();

    let isPasswordDone = false;

    const handleConfirm = () => {
        const val = tokenInput.value.trim().toLowerCase();

        if (!isPasswordDone) {
            if (val === 'delete-force') {
                isPasswordDone = true;
                tokenInput.value = '';
                tokenInput.type = "text";
                tokenInput.placeholder = "TOKEN";
                sub.innerText = "Type 'delete' to confirm";
                tokenInput.focus();
            } else {
                showNotification("Invalid Security Password", true);
            }
        } else {
            if (val === 'delete') {
                closeSecurityModal();
                if (securityCallback) securityCallback();
            } else {
                showNotification("Type 'delete' to confirm", true);
            }
        }
    };

    document.getElementById('security-confirm-btn').onclick = handleConfirm;
    tokenInput.onkeydown = (e) => {
        if (e.key === 'Enter') handleConfirm();
    };
}

function closeSecurityModal() {
    const modal = document.getElementById('security-modal');
    if (modal) {
        modal.classList.add('hidden');
        // Reset type for next open
        document.getElementById('security-token').type = "text";
    }
}

function closeSubtaskOverlay() {
    const overlay = document.getElementById('subtask-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function closeSubtaskWarning() {
    const warning = document.getElementById('subtask-warning-modal');
    if (warning) warning.classList.add('hidden');
}

// Generic Modal (close function is shared)
function closeGenericModal() {
    const modal = document.getElementById('generic-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// --- SHARED UI INJECTION (REDUNDANCY FIX) ---
function injectSharedUI() {
    // 0. Navigation Bar
    if (!document.querySelector('nav')) {
        const nav = document.createElement('nav');
        nav.className = 'fixed top-4 md:top-6 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] md:w-[calc(100%-48px)] max-w-7xl glass z-50 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between pointer-events-auto rounded-2xl md:rounded-[32px] border border-white/10 shadow-2xl backdrop-blur-xl transition-all duration-300';
        nav.innerHTML = `
            <div id="logo-container-wrapper" class="flex items-center space-x-2 md:space-x-4">
                <div id="logo-container" class="flex items-center space-x-2 md:space-x-3 group cursor-pointer" onclick="handleLogoClick(event)">
                    <div class="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br from-purple-600 to-cyan-600 flex items-center justify-center group-hover:rotate-12 transition-all duration-500 shadow-xl shadow-purple-500/20">
                        <i data-lucide="activity" class="w-5 h-5 md:w-6 md:h-6 text-white"></i>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-lg md:text-2xl font-black tracking-tighter">TaskTrace</span>
                    </div>
                </div>
                <div id="admin-exit-container"></div>
            </div>
            <div id="breadcrumb-container" class="hidden lg:flex justify-center items-center space-x-3 text-[12px] font-black uppercase tracking-[0.2em] pointer-events-auto">
                <!-- Breadcrumbs injected here -->
            </div>
            <div class="flex justify-end items-center space-x-2 md:space-x-4">
                <div id="nav-actions" class="flex items-center space-x-1 md:space-x-2"></div>
                <!-- Auth Actions Container -->
                <div id="header-auth-container" class="flex items-center space-x-1 md:space-x-2"></div>
                <div class="px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl bg-white/5 border border-white/10 flex items-center space-x-1 md:space-x-2">
                    <span class="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-cyan-400">v2.0</span>
                    <div class="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
                </div>
            </div>
        `;
        document.body.appendChild(nav);

        // Initial state
        updateHeaderAdminUI();

        // --- AUTH OBSERVER FOR HEADER ---
        if (typeof auth !== 'undefined') {
            auth.onAuthStateChanged(user => {
                updateHeaderAuthUI(user);
            });
        }
    }

    // 1. Loading Overlay
    if (!document.getElementById('loading-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'fixed inset-0 z-[200] bg-gray-950 flex items-center justify-center transition-opacity duration-700';
        overlay.innerHTML = `
            <div class="flex flex-col items-center">
                <div class="relative">
                    <div class="w-16 h-16 border-4 border-white/5 rounded-full"></div>
                    <div class="absolute top-0 left-0 w-16 h-16 border-4 border-accent-purple border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p id="loading-text" class="text-gray-400 mt-6 font-medium tracking-widest uppercase text-xs animate-pulse">Initializing</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // 2. Notification Toast
    if (!document.getElementById('toast')) {
        const toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 md:left-auto md:right-8 md:translate-x-0 z-[200] transform translate-y-32 opacity-0 transition-all duration-500 pointer-events-none';
        toast.innerHTML = `
            <div class="glass px-8 py-5 rounded-3xl flex items-center space-x-4 border-emerald-500/20 shadow-2xl">
                <div id="toast-icon-bg" class="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                    <i data-lucide="check" id="toast-icon" class="w-6 h-6 text-emerald-500"></i>
                </div>
                <div>
                    <span id="toast-msg" class="font-black text-sm block">Action successful!</span>
                    <span id="toast-sub" class="text-[9px] text-gray-500 uppercase font-black tracking-widest">Database updated</span>
                </div>
            </div>
        `;
        document.body.appendChild(toast);
    }

    // 3. Security Modal
    if (!document.getElementById('security-modal')) {
        const securityModal = document.createElement('div');
        securityModal.id = 'security-modal';
        securityModal.className = 'fixed inset-0 z-[110] bg-gray-950/80 backdrop-blur-md hidden flex items-center justify-center p-6';
        securityModal.innerHTML = `
            <div class="bg-[#111] border border-white/5 w-full max-w-sm rounded-[32px] p-10 animate-fadeIn relative overflow-hidden">
                <div class="flex flex-col items-center text-center space-y-6">
                    <div class="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                        <i data-lucide="shield-alert" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black">Security Auth</h3>
                        <p class="text-gray-500 text-sm mt-1 uppercase tracking-tighter font-bold">Type 'delete' to confirm</p>
                    </div>
                    <input type="text" id="security-token" class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-red-500 transition-all font-mono text-center tracking-widest" placeholder="TOKEN">
                    <div class="flex w-full space-x-3">
                        <button onclick="closeSecurityModal()" class="flex-1 py-4 rounded-2xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 transition-all uppercase text-[10px] tracking-widest">Cancel</button>
                        <button id="security-confirm-btn" class="flex-1 py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-500/20 uppercase text-[10px] tracking-widest">Authorize</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(securityModal);
    }

    // 4. Admin Access Modal
    if (!document.getElementById('admin-modal')) {
        const adminModal = document.createElement('div');
        adminModal.id = 'admin-modal';
        adminModal.className = 'fixed inset-0 z-[120] bg-gray-950/90 backdrop-blur-xl hidden flex items-center justify-center p-6';
        adminModal.innerHTML = `
            <div class="glass w-full max-w-sm rounded-[32px] p-10 animate-fadeIn relative overflow-hidden border border-white/10 shadow-2xl">
                <div class="flex flex-col items-center text-center space-y-6">
                    <div class="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                        <i data-lucide="shield-check" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter">Admin Access</h3>
                        <p class="text-gray-500 text-[10px] mt-1 uppercase tracking-widest font-bold">Enter Root Password</p>
                    </div>
                    <input type="password" id="admin-password" class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-cyan-500 transition-all font-mono text-center tracking-widest" placeholder="••••••••">
                    <div class="flex w-full space-x-3">
                        <button onclick="closeAdminModal()" class="flex-1 py-4 rounded-2xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 transition-all uppercase text-[10px] tracking-widest">Cancel</button>
                        <button onclick="verifyAdminAccess()" class="flex-1 py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-all shadow-lg shadow-cyan-500/20 uppercase text-[10px] tracking-widest">Unlock</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(adminModal);

        // Handle Enter key for password
        const passInput = adminModal.querySelector('#admin-password');
        if (passInput) {
            passInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') verifyAdminAccess();
            });
        }
    }

    // 5. Footer
    if (!document.querySelector('footer')) {
        const footer = document.createElement('footer');
        footer.className = 'w-full bg-gray-950/5 border-t border-white/5 pt-16 pb-10 px-10 mt-10 relative overflow-hidden';
        footer.innerHTML = `
            <div class="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-16 relative z-10 text-left">
                <div class="space-y-6">
                    <div class="flex items-center space-x-3 group cursor-pointer" onclick="backToProjects()">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-cyan-600 flex items-center justify-center group-hover:rotate-12 transition-all duration-500 shadow-xl shadow-purple-500/20">
                            <i data-lucide="activity" class="w-6 h-6 text-white"></i>
                        </div>
                        <span class="text-2xl font-black tracking-tighter">TaskTrace</span>
                    </div>
                    <p class="text-gray-500 text-xs leading-relaxed max-w-xs font-medium">Professional real-time project management. All data synchronized via Firebase Cloud.</p>
                    <div class="flex items-center space-x-4 text-gray-400">
                        <a href="https://github.com/Chanii2024" target="_blank" class="hover:text-white transition-all"><i data-lucide="github" class="w-4 h-4"></i></a>
                        <a href="https://linkedin.com/in/chaniru-weerasinghe-36aa2a326/" target="_blank" class="hover:text-white transition-all"><i data-lucide="linkedin" class="w-4 h-4"></i></a>
                        <a href="https://facebook.com/Chanii2003/" target="_blank" class="hover:text-white transition-all"><i data-lucide="facebook" class="w-4 h-4"></i></a>
                        <a href="https://www.instagram.com/chaniruweerasinghe" target="_blank" class="hover:text-white transition-all"><i data-lucide="instagram" class="w-4 h-4"></i></a>
                    </div>
                </div>
                <div class="space-y-6">
                    <h4 class="text-[10px] font-black uppercase tracking-[0.2em] text-white opacity-60">Build Stack</h4>
                    <ul class="space-y-3 text-gray-500 text-xs font-bold">
                        <li>HTML5</li>
                        <li>CSS3 (Tailwind)</li>
                        <li>JavaScript (ES6)</li>
                        <li>Firebase Realtime DB</li>
                        <li>Lucide Icons</li>
                    </ul>
                </div>
                <div class="space-y-6">
                    <h4 class="text-[10px] font-black uppercase tracking-[0.2em] text-white opacity-60">System Status</h4>
                    <p class="text-gray-500 text-xs font-bold flex items-center space-x-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Firebase Realtime Cloud</span>
                    </p>
                    <p class="text-gray-500 text-[10px] font-medium leading-relaxed uppercase tracking-widest">v2.0.1 Stable Production</p>
                    <p class="text-gray-500 text-[10px] font-medium">All systems operational</p>
                </div>
                <div class="space-y-6">
                    <h4 class="text-[10px] font-black uppercase tracking-[0.2em] text-white opacity-60">Developed By</h4>
                    <div class="glass p-5 rounded-2xl border border-white/5 bg-white/[0.01]">
                        <p class="text-sm font-black text-white">Chaniru Weerasinghe</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(footer);
    }

    // 6. Subtask Overlay Modal
    if (!document.getElementById('subtask-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'subtask-overlay';
        overlay.className = 'fixed inset-0 z-[120] bg-gray-950/80 backdrop-blur-md hidden flex items-center justify-center p-4 sm:p-8 animate-fadeIn';
        // Dismiss on outside click
        overlay.onclick = (e) => { if (e.target === overlay) closeSubtaskOverlay(); };
        overlay.innerHTML = `
            <div class="glass w-[95vw] h-auto max-h-[95vh] max-w-none rounded-[24px] md:rounded-[32px] relative shadow-2xl flex flex-col overflow-hidden bg-[#0a0f18] border border-white/[0.08]">
                <!-- Close Button -->
                <button onclick="closeSubtaskOverlay()" class="absolute top-6 right-6 z-[110] p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all group">
                    <i data-lucide="x" class="w-5 h-5 group-hover:rotate-90 transition-transform duration-300"></i>
                </button>                <!-- Header Area: Fixed -->
                <div class="px-8 sm:px-12 pt-10 pb-6 border-b border-white/5 flex flex-col shrink-0 relative">
                    <div class="flex items-start justify-between w-full mb-4">
                        <div class="flex flex-wrap items-center gap-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest" id="subtask-overlay-meta">
                            <span id="subtask-overlay-id" class="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-md hidden">#ID</span>
                            <span id="subtask-overlay-sprint" class="bg-blue-900/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-md hidden">Sprint</span>
                            <span id="subtask-overlay-deadline" class="bg-rose-900/30 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-md hidden">Deadline</span>
                        </div>
                    </div>
                    <div class="flex items-center justify-between w-full group">
                        <h3 id="subtask-overlay-title" class="text-3xl sm:text-5xl font-extrabold tracking-tight text-white flex-grow line-clamp-2">Task Title</h3>
                        <div id="overlay-status-dropdown" class="flex-shrink-0 ml-8">
                            <!-- Status button injected dynamically -->
                        </div>
                    </div>
                </div>

                <!-- Scrollable Content: Table & Description -->
                <div class="px-4 sm:px-12 pt-6 flex-grow overflow-y-auto custom-scrollbar flex flex-col min-h-0">
                    <!-- Description Area -->
                    <div id="subtask-overlay-desc-container" class="w-full mb-10 hidden">
                        <p id="subtask-overlay-desc" class="text-sm font-medium text-gray-400 leading-relaxed whitespace-pre-wrap break-words"></p>
                    </div>
                    
                    <div class="w-full flex-grow flex flex-col">
                        <div class="flex justify-between items-center w-full mb-4 border-b border-white/5 pb-3">
                            <h4 class="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Main Task Subtasks</h4>
                            <span id="subtask-overlay-progress-text" class="text-[11px] font-bold text-blue-500 uppercase tracking-widest">0/0 DONE</span>
                        </div>
                        
                        <div class="w-full overflow-x-auto custom-scrollbar pb-4">
                            <table class="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr class="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold border-b border-white/5">
                                        <th class="py-4 w-12 text-center">#</th>
                                        <th class="p-4 border-l border-white/5">Subtask Detail</th>
                                        <th class="p-4 w-32 sm:w-48 text-left border-l border-white/5 pl-8 text-gray-400">Status</th>
                                    </tr>
                                </thead>
                                <tbody id="subtask-overlay-table-body" class="text-xs sm:text-sm divide-y divide-white/5 font-bold">
                                    <!-- Subtasks injected here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- Footer Area: Fixed -->
                <div class="px-8 sm:px-12 py-6 border-t border-white/5 shrink-0 bg-[#0a0f18]/50 backdrop-blur-md">
                    <div class="flex items-center justify-between w-full">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                <i data-lucide="user" class="w-5 h-5 text-gray-400"></i>
                            </div>
                            <div>
                                <p class="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Assignee</p>
                                <p id="subtask-overlay-assignee" class="text-sm font-bold text-gray-300">Name</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // 7. Subtask Warning Modal (for manual completed checks)
    if (!document.getElementById('subtask-warning-modal')) {
        const warningModal = document.createElement('div');
        warningModal.id = 'subtask-warning-modal';
        warningModal.className = 'fixed inset-0 z-[130] bg-gray-950/80 backdrop-blur-md hidden flex items-center justify-center p-6';
        warningModal.innerHTML = `
            <div class="glass w-full max-w-sm rounded-[32px] p-8 md:p-10 animate-fadeIn relative overflow-hidden border border-white/5">
                <div class="flex flex-col items-center text-center space-y-6">
                    <div class="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <i data-lucide="alert-triangle" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <h3 class="text-xl md:text-2xl font-black">Warning</h3>
                        <p class="text-gray-400 text-xs mt-3 leading-relaxed font-medium">There are pending subtasks in this main task. How would you like to proceed?</p>
                    </div>
                    <div class="flex flex-col w-full space-y-3">
                        <button id="warning-complete-btn" class="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-gray-950 font-black transition-all shadow-lg shadow-amber-500/20 uppercase text-[10px] tracking-widest">Mark All Done & Complete</button>
                        <button id="warning-cancel-btn" onclick="closeSubtaskWarning()" class="w-full py-4 rounded-2xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 transition-all uppercase text-[10px] tracking-widest">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(warningModal);
    }

    // 5. Generic Modal (Consolidated)
    if (!document.getElementById('generic-modal')) {
        const modal = document.createElement('div');
        modal.id = 'generic-modal';
        modal.className = 'hidden fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8';
        modal.innerHTML = `
            <div class="fixed inset-0 bg-gray-950/95 backdrop-blur-md" onclick="closeGenericModal()"></div>
            <div class="glass w-full max-w-lg rounded-3xl md:rounded-[40px] relative animate-fadeIn shadow-2xl overflow-hidden flex flex-col max-h-full">
                <div class="p-6 md:p-10 overflow-y-auto custom-scrollbar">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <h3 id="modal-title" class="text-2xl font-black tracking-tight">New Main Task</h3>
                            <p id="modal-sub" class="text-gray-500 text-[10px] mt-0.5 uppercase tracking-tighter font-bold">Details</p>
                        </div>
                        <button onclick="closeGenericModal()" class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-gray-400 hover:text-white transition-all">
                            <i data-lucide="x" class="w-6 h-6"></i>
                        </button>
                    </div>

                    <!-- Project Form -->
                    <form id="project-form" class="hidden space-y-5" onsubmit="handleProjectSubmit(event)">
                        <input type="hidden" id="p-id">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Project Name</label>
                            <input type="text" id="p-name" class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-accent-purple transition-all font-medium" placeholder="E.g. TaskTrace Redesign">
                        </div>
                        <div>
                            <div class="flex items-center justify-between mb-2 ml-1">
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest">Project Icon</label>
                            </div>
                            <div class="relative group/picker">
                                <div class="flex items-center space-x-4 mb-4">
                                    <div id="p-icon-preview" class="w-14 h-14 rounded-2xl bg-accent-purple/20 flex items-center justify-center border border-accent-purple/30">
                                        <i data-lucide="layers" class="w-7 h-7 text-accent-purple"></i>
                                    </div>
                                    <div class="flex-grow">
                                        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest italic">Choose a symbol that represents your workspace</p>
                                    </div>
                                </div>
                                <div id="icon-grid" class="grid grid-cols-5 gap-3 h-48 overflow-y-auto p-4 bg-gray-900/50 rounded-2xl border border-white/5 custom-scrollbar"></div>
                                <input type="hidden" id="p-icon" value="layers">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Theme Color</label>
                            <div class="flex flex-wrap gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div class="color-option w-10 h-10 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:scale-110" style="background: linear-gradient(135deg, #a855f7, #7e22ce)" onclick="selectColor('#a855f7', '#7e22ce')" data-color="#a855f7"></div>
                                <div class="color-option w-10 h-10 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:scale-110" style="background: linear-gradient(135deg, #06b6d4, #0e7490)" onclick="selectColor('#06b6d4', '#0e7490')" data-color="#06b6d4"></div>
                                <div class="color-option w-10 h-10 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:scale-110" style="background: linear-gradient(135deg, #10b981, #047857)" onclick="selectColor('#10b981', '#047857')" data-color="#10b981"></div>
                                <div class="color-option w-10 h-10 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:scale-110" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8)" onclick="selectColor('#3b82f6', '#1d4ed8')" data-color="#3b82f6"></div>
                                <button type="submit" id="project-submit-btn" class="w-full mt-4 py-4 bg-accent-purple hover:bg-purple-600 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-purple-500/20">Action</button>
                                <input type="hidden" id="p-color-from" value="#a855f7"><input type="hidden" id="p-color-to" value="#7e22ce">
                            </div>
                        </div>
                    </form>

                    <form id="member-form" class="hidden space-y-6" onsubmit="handleMemberSubmit(event)">
                        <input type="hidden" id="m-id">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Member Name</label>
                            <input type="text" id="m-name" required class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-accent-purple transition-all font-medium" placeholder="E.g. Chaniru">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Member Role</label>
                            <input type="text" id="m-role" required class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-accent-purple transition-all font-medium" placeholder="E.g. Lead Designer">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Theme Color</label>
                            <div class="flex flex-wrap gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div class="member-color-option w-10 h-10 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:scale-110" style="background: linear-gradient(135deg, #a855f7, #7e22ce)" onclick="selectMemberColor('#a855f7', '#7e22ce')" data-color="#a855f7"></div>
                                <div class="member-color-option w-10 h-10 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:scale-110" style="background: linear-gradient(135deg, #06b6d4, #0e7490)" onclick="selectMemberColor('#06b6d4', '#0e7490')" data-color="#06b6d4"></div>
                                <div class="member-color-option w-10 h-10 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:scale-110" style="background: linear-gradient(135deg, #10b981, #047857)" onclick="selectMemberColor('#10b981', '#047857')" data-color="#10b981"></div>
                                <div class="member-color-option w-10 h-10 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:scale-110" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8)" onclick="selectMemberColor('#3b82f6', '#1d4ed8')" data-color="#3b82f6"></div>
                                <div class="member-color-option w-10 h-10 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:scale-110" style="background: linear-gradient(135deg, #f59e0b, #d97706)" onclick="selectMemberColor('#f59e0b', '#d97706')" data-color="#f59e0b"></div>
                                <div class="member-color-option w-10 h-10 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:scale-110" style="background: linear-gradient(135deg, #ef4444, #dc2626)" onclick="selectMemberColor('#ef4444', '#dc2626')" data-color="#ef4444"></div>
                                <input type="hidden" id="m-color-from" value="#a855f7">
                                <input type="hidden" id="m-color-to" value="#7e22ce">
                            </div>
                        </div>
                        <button type="submit" id="member-submit-btn" class="w-full py-5 bg-accent-purple hover:bg-purple-600 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-purple-500/20 text-white">Action</button>
                    </form>

                    <!-- Invite Form -->
                    <form id="invite-form" class="hidden space-y-6" onsubmit="handleInviteSubmit(event)">
                        <div class="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 mb-6">
                            <p class="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-2">Invitation Link</p>
                            <p class="text-xs text-gray-400 leading-relaxed font-medium">Generate a secure link to invite a new member. They must log in to accept.</p>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Member Role (Optional)</label>
                            <input type="text" id="i-role" class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-indigo-500 transition-all font-medium text-gray-300" placeholder="E.g. Lead Designer">
                        </div>
                        <div id="invite-link-container" class="hidden space-y-4 animate-fadeIn">
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Generated Link</label>
                            <div class="flex items-center space-x-2">
                                <input type="text" id="i-link" readonly class="flex-grow bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none font-mono text-xs text-indigo-400" value="">
                                <button type="button" onclick="copyInviteLink()" class="p-4 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-lg shadow-indigo-500/20">
                                    <i data-lucide="copy" class="w-5 h-5"></i>
                                </button>
                            </div>
                        </div>
                        <button type="submit" id="invite-submit-btn" class="w-full py-5 bg-indigo-500 hover:bg-indigo-600 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 text-white">Generate Invite Link</button>
                    </form>

                    <!-- Sprint Form -->
                    <form id="sprint-form" class="hidden space-y-6" onsubmit="handleSprintSubmit(event)">
                        <div id="s-name-container">
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1 cursor-not-allowed" for="s-name">Sprint</label>
                            <input type="text" id="s-name" readonly class="w-full bg-gray-900/50 border border-white/5 rounded-2xl px-5 py-4 focus:outline-none transition-all font-medium relative z-10 text-gray-500 cursor-not-allowed" placeholder="Auto-generated" autocomplete="off">
                        </div>
                        <div id="s-edit-container" class="hidden">
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Select Sprint to Extend</label>
                            <div class="custom-dropdown w-full" id="dropdown-s-edit">
                                <div class="dropdown-trigger w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex justify-between items-center !text-base !font-medium !text-gray-300 !normal-case" onclick="toggleDropdown(event, 's-edit')">
                                    <span id="s-edit-label">Select Sprint</span>
                                    <i data-lucide="chevron-down" class="w-5 h-5 text-gray-500 transition-transform duration-300"></i>
                                </div>
                                <div class="dropdown-menu !w-full" id="s-edit-options"></div>
                                <input type="hidden" id="s-edit-name">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">End Date (Deadline)</label>
                            <input type="date" id="s-end-date" required class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-accent-purple transition-all font-medium text-gray-300 [color-scheme:dark]">
                        </div>
                        <button type="submit" class="w-full py-5 bg-cyan-500 hover:bg-cyan-600 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-cyan-500/20 text-white">Create Sprint</button>
                    </form>

                    <!-- Task Form -->
                    <form id="task-form" class="hidden space-y-6" onsubmit="handleTaskSubmit(event)">
                        <input type="hidden" id="task-id">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Task Title</label>
                            <input type="text" id="t-title" required class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-accent-purple transition-all font-medium" placeholder="Objective name">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Sub-tasks / Details</label>
                            <div class="tag-container" id="tag-container">
                                <div id="tags-list" class="flex flex-wrap gap-2"></div>
                                <input type="text" id="tag-input" placeholder="Press Enter to add..." autocomplete="off">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Sprint</label>
                            <div class="custom-dropdown w-full" id="dropdown-t-sprint">
                                <div class="dropdown-trigger w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex justify-between items-center !text-base !font-medium !text-gray-300 !normal-case" onclick="toggleDropdown(event, 't-sprint')">
                                    <span id="t-sprint-label">Select Sprint</span>
                                    <i data-lucide="chevron-down" class="w-5 h-5 text-gray-500 transition-transform duration-300"></i>
                                </div>
                                <div class="dropdown-menu !w-full" id="t-sprint-options"></div>
                                <input type="hidden" id="t-sprint">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Assign To</label>
                            <div class="custom-dropdown w-full" id="dropdown-t-member">
                                <div class="dropdown-trigger w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex justify-between items-center !text-base !font-medium !text-gray-300 !normal-case" onclick="toggleDropdown(event, 't-member')">
                                    <span id="t-member-label">Select Member</span>
                                    <i data-lucide="chevron-down" class="w-5 h-5 text-gray-500 transition-transform duration-300"></i>
                                </div>
                                <div class="dropdown-menu !w-full" id="t-member-options"></div>
                                <input type="hidden" id="t-member" required>
                            </div>
                        </div>
                        <button type="submit" id="task-submit-btn" class="w-full py-5 bg-accent-purple hover:bg-purple-600 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-purple-500/20 text-white">Action</button>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // 6. Meeting Overlay
    if (!document.getElementById('meeting-overlay')) {
        const meetingOverlay = document.createElement('div');
        meetingOverlay.id = 'meeting-overlay';
        meetingOverlay.className = 'fixed inset-0 z-[195] bg-gray-950/95 backdrop-blur-2xl hidden flex flex-col animate-fadeIn overflow-hidden';
        meetingOverlay.innerHTML = `
            <!-- Auth Screen (Login/Signup) -->
            <div id="overlay-auth-view" class="hidden flex-grow flex flex-col items-center justify-center p-6 md:p-12 animate-fadeIn relative">
                <button onclick="closeMeetingOverlay()" class="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
                <div class="glass p-10 md:p-12 rounded-[48px] border border-white/10 w-full max-w-md shadow-2xl relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500"></div>
                    
                    <div class="mb-8 text-center">
                        <div class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                            <i data-lucide="shield-check" class="w-8 h-8 text-indigo-400"></i>
                        </div>
                        <h2 id="auth-title" class="text-2xl font-black tracking-tight text-white mb-2">Secure Access</h2>
                        <p id="auth-subtitle" class="text-gray-500 text-[10px] font-bold uppercase tracking-widest italic">Authentication required for voice tasks</p>
                    </div>

                    <form id="auth-form" onsubmit="handleAuthSubmit(event)" class="space-y-5">
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Email Address</label>
                            <div class="relative group">
                                <i data-lucide="mail" class="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors"></i>
                                <input type="email" id="auth-email" required placeholder="name@company.com" 
                                    class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all font-medium">
                            </div>
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-4">Password</label>
                            <div class="relative group">
                                <i data-lucide="lock" class="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors"></i>
                                <input type="password" id="auth-password" required placeholder="••••••••" 
                                    class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all font-medium">
                            </div>
                        </div>

                        <button type="submit" id="auth-submit-btn" class="w-full py-4 bg-indigo-500 hover:bg-indigo-600 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 text-white text-xs mt-4">
                            Log In
                        </button>
                    </form>

                    <div class="mt-8 pt-8 border-t border-white/5 flex flex-col items-center space-y-4">
                        <button onclick="toggleAuthMode()" id="auth-toggle-btn" class="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-indigo-400 transition-colors">
                            Need an account? Sign Up
                        </button>
                    </div>
                </div>
            </div>

            <!-- Welcome / Select Meeting Screen -->
            <div id="overlay-welcome-view" class="hidden flex-grow flex flex-col items-center justify-center p-6 md:p-12 animate-fadeIn relative">
                <button onclick="closeMeetingOverlay()" class="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
                <div class="max-w-4xl w-full text-center mb-12">
                    <h2 class="text-4xl md:text-5xl font-black tracking-tighter text-white mb-4">Welcome to TaskTrace</h2>
                    <p class="text-gray-500 font-medium italic uppercase tracking-widest text-[10px]">Select an ongoing meeting to join or start a new Main Task</p>
                </div>
                <div id="overlay-welcome-grid" class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl overflow-y-auto custom-scrollbar p-4">
                    <!-- Ongoing meetings list -->
                    <div id="welcome-new-meeting-btn" onclick="showMeetingCreateForm()" class="glass p-10 rounded-[40px] border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500/50 hover:bg-white/5 transition-all group active:scale-95 min-h-[220px]">
                        <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                            <i data-lucide="plus" class="w-8 h-8"></i>
                        </div>
                        <h3 class="text-lg font-black text-white mb-2">Start New Main Task</h3>
                        <p class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Create a fresh session for your team</p>
                    </div>
                </div>
            </div>

            <!-- Identify Yourself Screen -->
            <div id="overlay-login-view" class="hidden flex-grow flex flex-col items-center justify-center p-6 md:p-12 animate-fadeIn relative">
                <button onclick="closeMeetingOverlay()" class="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
                <div class="max-w-4xl w-full text-center mb-12">
                    <h2 class="text-4xl md:text-5xl font-black tracking-tighter text-white mb-4">Identify Yourself</h2>
                    <p class="text-gray-500 font-medium italic uppercase tracking-widest text-[10px]">Select your profile to access the meeting room</p>
                </div>
                <div id="overlay-login-grid" class="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-5xl overflow-y-auto custom-scrollbar p-4">
                    <!-- Members injected here -->
                </div>
            </div>

            <!-- Creation Form -->
            <div id="overlay-create-view" class="hidden flex-grow flex flex-col items-center justify-center p-6 md:p-12 animate-fadeIn relative">
                <button onclick="closeMeetingOverlay()" class="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
                <div class="glass p-12 rounded-[48px] border border-white/10 w-full max-w-2xl shadow-2xl relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                    <div class="mb-10 text-center">
                        <h2 class="text-3xl font-black tracking-tight text-white mb-2">Initiate Meeting</h2>
                        <p class="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Define your task objectives</p>
                    </div>
                    
                    <div class="space-y-6">
                        <div>
                            <label class="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 ml-1">Meeting Title</label>
                            <input type="text" id="m-title" placeholder="e.g. Weekly Strategy Sync" class="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-medium">
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 ml-1">Date</label>
                                <input type="date" id="m-date" class="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 ml-1">Start Time</label>
                                <input type="time" id="m-time" class="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-medium">
                            </div>
                        </div>

                        <div>
                            <label class="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 ml-1">Associate Sprint</label>
                            <div class="relative group">
                                <select id="m-sprint" class="w-full appearance-none bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-medium cursor-pointer">
                                    <option value="None" class="bg-gray-900">General Sync (No Sprint)</option>
                                </select>
                                <div class="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                </div>
                            </div>
                        </div>

                        <button onclick="saveMeetingAndJoin()" class="w-full py-5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl text-white font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-indigo-500/20 mt-4">
                            Save & Initialize Meeting
                        </button>
                    </div>
                </div>
            </div>

            <!-- Maximize View -->
            <div id="meeting-maximized" class="flex flex-col h-full w-full p-6 md:p-12 relative">
                <!-- Minimize Button -->
                <button onclick="minimizeMeeting()" class="absolute top-6 right-20 z-[160] p-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all group" title="Minimize">
                    <i data-lucide="minus" class="w-5 h-5"></i>
                </button>
                <!-- Close Button (Leave) -->
                <button onclick="handleOverlayLeave()" class="absolute top-6 right-6 z-[160] p-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-red-500 transition-all group" title="Leave">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>

                <!-- Meeting Content -->
                <div class="max-w-7xl mx-auto w-full flex-grow flex flex-col">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                        <div>
                            <div class="flex items-center space-x-3 mb-2">
                                <span class="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20 flex items-center space-x-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span>Live Session</span>
                                </span>
                                <span id="overlay-meeting-timer" class="text-gray-500 text-[10px] font-black uppercase tracking-widest">00:00:00</span>
                            </div>
                            <h1 id="overlay-meeting-title" class="text-4xl md:text-5xl font-black tracking-tighter text-white">Initializing...</h1>
                            <div class="flex items-center space-x-3 mt-1">
                                <p id="overlay-meeting-date" class="text-gray-500 font-medium italic uppercase tracking-widest text-[10px]">Loading...</p>
                                <span id="lobby-status-tag" class="hidden px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-widest rounded border border-amber-500/20">Lobby Mode</span>
                            </div>
                        </div>
                        <div class="flex items-center space-x-4">
                            <div class="glass px-6 py-3 rounded-2xl border border-white/5 flex items-center space-x-4">
                                <div class="flex items-center space-x-2">
                                    <i data-lucide="users" class="w-4 h-4 text-gray-500"></i>
                                    <span id="overlay-participant-count" class="text-sm font-black text-white">0</span>
                                </div>
                                <div class="w-px h-4 bg-white/10"></div>
                                <div class="flex items-center space-x-2">
                                    <i data-lucide="mic" class="w-4 h-4 text-gray-500" id="overlay-global-mic-icon"></i>
                                    <span id="overlay-mic-status-text" class="text-[10px] font-black uppercase tracking-widest text-gray-500">Muted</span>
                                </div>
                                <div class="w-px h-4 bg-white/10"></div>
                                <button onclick="retryAgoraConnection()" class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500 hover:text-cyan-400 transition-all" title="Retry Voice Connection">
                                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div id="overlay-participants-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:gap-8 mb-20 min-h-[400px] overflow-y-auto custom-scrollbar pr-4">
                        <!-- Dynamic Grid -->
                    </div>
                </div>

                <!-- Main Controls -->
                <div class="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center space-x-4 z-50">
                    <div class="glass px-8 py-5 rounded-[32px] border border-white/10 shadow-2xl flex items-center space-x-6">
                        <button onclick="toggleOverlayMic()" class="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 group relative">
                            <i data-lucide="mic-off" id="overlay-icon-mic" class="w-6 h-6 text-gray-400 group-hover:text-white transition-colors"></i>
                            <span class="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-gray-900 text-white text-[8px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/5 shadow-xl">Meta + M</span>
                        </button>
                        
                        <!-- Lobby Controls (Share & Start) -->
                        <div id="lobby-controls" class="hidden flex items-center space-x-4 border-l border-white/10 pl-6">
                            <button onclick="shareMeetingLink()" class="flex items-center space-x-2 px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 group">
                                <i data-lucide="share-2" class="w-4 h-4 text-gray-400 group-hover:text-cyan-400 transition-colors"></i>
                                <span>Invite Link</span>
                            </button>
                            <button id="overlay-btn-start" onclick="startMeetingSession()" class="hidden px-10 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-lg shadow-emerald-500/20">
                                Start Session
                            </button>
                        </div>

                        <button id="overlay-btn-leave" onclick="handleOverlayLeave()" class="hidden px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] transition-all active:scale-95">
                            I'm done
                        </button>
                        <button id="overlay-btn-end" onclick="confirmEndOverlayMeeting()" class="hidden px-8 py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-lg shadow-red-500/20">
                            End Meeting
                        </button>
                    </div>
                </div>
            </div>

            <!-- Minimized Pill View -->
            <div id="meeting-minimized" class="hidden fixed bottom-8 right-8 z-[160] animate-fadeIn">
                <div onclick="maximizeMeeting()" class="glass py-4 pl-6 pr-4 rounded-full border border-indigo-500/30 flex items-center space-x-4 cursor-pointer hover:bg-indigo-500/10 transition-all shadow-2xl group active:scale-95">
                    <div class="relative">
                        <div class="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                            <i data-lucide="video" class="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform"></i>
                        </div>
                        <span id="minimized-mic-indicator" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-gray-950 hidden"></span>
                        <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-gray-950"></span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black tracking-widest text-white uppercase leading-none">Meeting Live</span>
                        <span id="minimized-timer" class="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">00:00</span>
                    </div>
                    <div class="w-px h-6 bg-white/10 mx-1"></div>
                    <button onclick="event.stopPropagation(); toggleOverlayMic()" class="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                        <i data-lucide="mic-off" id="minimized-icon-mic" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

            <!-- Overlay Report View -->
            <div id="overlay-report-view" class="hidden flex-grow overflow-y-auto w-full p-6 md:p-12 animate-fadeIn bg-gray-950/50">
                <div class="max-w-4xl mx-auto flex flex-col items-center">
                    <div class="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-8 border border-emerald-500/20">
                        <i data-lucide="award" class="w-10 h-10"></i>
                    </div>
                    <h2 class="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-white">Meeting Concluded</h2>
                    <p class="text-gray-500 font-medium italic uppercase tracking-widest text-[10px] mb-12">Analytics & Participation Report</p>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-12">
                        <div class="glass p-10 rounded-[40px] border border-white/5 flex flex-col items-center text-center">
                            <span class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Total Session Time</span>
                            <span id="overlay-report-duration" class="text-5xl font-black tracking-tighter text-white">00:00:00</span>
                        </div>
                        <div class="glass p-10 rounded-[40px] border border-white/5 flex flex-col items-center text-center">
                            <span class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Contributors</span>
                            <span id="overlay-report-member-count" class="text-5xl font-black tracking-tighter text-cyan-400">0</span>
                        </div>
                    </div>

                    <div class="glass w-full rounded-[40px] border border-white/5 overflow-hidden mb-12">
                        <div id="overlay-report-members-list" class="flex flex-col">
                            <!-- Members -->
                        </div>
                    </div>

                    <button onclick="dismissOverlayReport()" class="px-10 py-5 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-white font-black uppercase tracking-widest text-[10px] transition-all">
                        Close Report
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(meetingOverlay);
    }
    refreshIcons();

    // 7. Inject Meeting Logic & Dependencies (Agora + Custom Overlay Logic)
    if (!document.getElementById('meeting-logic-scripts')) {
        const scriptContainer = document.createElement('div');
        scriptContainer.id = 'meeting-logic-scripts';
        document.body.appendChild(scriptContainer);

        // Agora RTC SDK
        const agoraScript = document.createElement('script');
        agoraScript.src = "https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js";
        scriptContainer.appendChild(agoraScript);

        // Meeting Overlay Logic (Load independently)
        const overlayScript = document.createElement('script');
        const isInternal = window.location.pathname.includes('/pages/');
        overlayScript.src = isInternal ? '../js/meeting-overlay.js' : 'js/meeting-overlay.js';
        scriptContainer.appendChild(overlayScript);
    }
}

// Set Theme Colors based on Project Data
function applyProjectTheme(project) {
    if (!project) return;
    const root = document.documentElement;
    root.style.setProperty('--accent-from', project.colorFrom || '#a855f7');
    root.style.setProperty('--accent-to', project.colorTo || '#7e22ce');
}

// Navigation UI update (Header logic generic)
function setupHeader(viewId) {
    const nav = document.querySelector('nav');
    const logoContainer = document.getElementById('logo-container');

    // Improved check for landing page (works locally, in VS Code Live Server, or GitHub Pages)
    const isRoot = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || viewId === 'project-view';

    if (nav && logoContainer) {
        if (isRoot) {
            // Keep Logo on the left side for landing page
            logoContainer.style.gridColumn = "1";
            logoContainer.classList.remove('justify-center');

            // Adjust nav width to match landing page content width (max-w-7xl)
            nav.classList.remove('max-w-5xl', 'w-[calc(100%-32px)]');
            nav.classList.add('max-w-7xl', 'w-[calc(100%-48px)]');
        } else {
            // Reset to Left on Internal Pages
            logoContainer.style.gridColumn = "1";
            logoContainer.classList.remove('justify-center');

            // Revert nav width to match internal pages
            nav.classList.remove('max-w-5xl', 'w-[calc(100%-32px)]');
            nav.classList.add('max-w-7xl', 'w-[calc(100%-48px)]');
        }
    }

    updateBreadcrumbs();
    refreshIcons();
}

function updateBreadcrumbs() {
    const container = document.getElementById('breadcrumb-container');
    if (!container) return;

    const path = [];
    const isRoot = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || !window.location.pathname.includes('/pages/');

    // Home - Only show if not on Home page
    if (!isRoot) {
        path.push(`<a href="#" onclick="backToProjects()" class="text-white/40 hover:text-white transition-all">Home</a>`);
    }

    // Project
    const projId = localStorage.getItem('tt_project');
    if (projId) {
        const projName = localStorage.getItem('tt_project_name') || 'Project';
        if (path.length > 0) path.push(`<span class="text-white/10 mx-1">/</span>`);
        path.push(`<a href="#" onclick="backToMembers()" class="text-white/40 hover:text-white transition-all">${projName}</a>`);
    }

    // Member
    const membId = localStorage.getItem('tt_member');
    if (membId && window.location.pathname.includes('workspace.html')) {
        const membName = localStorage.getItem('tt_member_name') || 'Member';
        if (path.length > 0) path.push(`<span class="text-white/10 mx-1">/</span>`);
        path.push(`<span class="text-accent-purple">${membName}</span>`);
    }

    container.innerHTML = path.join('');
}

// --- TASK MANAGEMENT LOGIC (CONSOLIDATED) ---
let currentSubTasks = [];

function setupTagInput() {
    const input = document.getElementById('tag-input');
    if (!input) return;

    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = input.value.trim();
            if (val) {
                currentSubTasks.push({ title: val, status: 'NotStarted' });
                input.value = '';
                renderTagsInModal();
            }
        }
    };
}

function renderTagsInModal() {
    const list = document.getElementById('tags-list');
    if (!list) return;
    list.innerHTML = '';
    currentSubTasks.forEach((st, idx) => {
        const title = typeof st === 'object' ? (st.title || 'Task') : st;
        const tag = document.createElement('div');
        tag.className = 'px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg flex items-center space-x-2 group animate-fadeIn';
        tag.innerHTML = `
            <span class="text-[11px] font-medium text-gray-300">${title}</span>
            <button type="button" onclick="removeTag(${idx})" class="text-gray-600 hover:text-red-400 transition-colors">
                <i data-lucide="x" class="w-3 h-3"></i>
            </button>
        `;
        list.appendChild(tag);
    });
    refreshIcons();
}

function removeTag(idx) {
    currentSubTasks.splice(idx, 1);
    renderTagsInModal();
}

function toggleDropdown(e, type) {
    e.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${type}`);
    dropdown.classList.toggle('active');
}

function updateMemberDropdown() {
    const label = document.getElementById('t-member-label');
    const hiddenInput = document.getElementById('t-member');
    const optionsGrid = document.getElementById('t-member-options');
    if (!optionsGrid) return;

    optionsGrid.innerHTML = '';


    Object.keys(currentMembers).forEach(id => {
        const m = currentMembers[id];
        const item = document.createElement('div');
        item.className = `dropdown-item ${hiddenInput.value === id ? 'selected' : ''}`;
        item.onclick = (e) => {
            e.stopPropagation();
            hiddenInput.value = id;
            label.innerText = m.name;
            document.getElementById('dropdown-t-member').classList.remove('active');
            updateMemberDropdown();
        };
        item.innerHTML = `
            <span>${m.name}</span>
            ${hiddenInput.value === id ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : ''}
        `;
        optionsGrid.appendChild(item);
    });
    refreshIcons();
}

function updateTaskModalSprintDropdown() {
    const label = document.getElementById('t-sprint-label');
    const hiddenInput = document.getElementById('t-sprint');
    const optionsGrid = document.getElementById('t-sprint-options');
    if (!optionsGrid) return;

    optionsGrid.innerHTML = '';
    // Add scrollable class for longer lists
    optionsGrid.classList.add('max-h-60', 'overflow-y-auto', 'custom-scrollbar');

    // Add "None" option
    const noneItem = document.createElement('div');
    noneItem.className = `dropdown-item ${hiddenInput.value === '' ? 'selected' : ''}`;
    noneItem.onclick = (e) => {
        e.stopPropagation();
        hiddenInput.value = '';
        label.innerText = 'Select Sprint';
        document.getElementById('dropdown-t-sprint').classList.remove('active');
        updateTaskModalSprintDropdown(); // Refresh selection state
    };
    noneItem.innerHTML = `<span>None</span>`;
    optionsGrid.appendChild(noneItem);

    // Get unique sprint names from BOTH Tasks and Defined Sprints (Unify with dashboard logic)
    const sprints = new Set();
    Object.keys(currentSprints || {}).forEach(k => sprints.add(k));
    Object.values(currentTasks || {}).forEach(t => {
        if (t.sprintName) sprints.add(t.sprintName);
    });

    const sprintList = Array.from(sprints).sort((a, b) => {
        const na = parseInt(a), nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });

    sprintList.forEach(s => {
        const item = document.createElement('div');
        item.className = `dropdown-item ${hiddenInput.value === s ? 'selected' : ''}`;

        // Find end date from currentSprints or fallback to searching tasks
        let deadline = currentSprints[s]?.endDate;
        if (!deadline) {
            const taskWithDate = Object.values(currentTasks).find(t => t.sprintName === s && t.endDate);
            if (taskWithDate) deadline = taskWithDate.endDate;
        }

        item.onclick = (e) => {
            e.stopPropagation();
            hiddenInput.value = s;
            label.innerText = isNaN(parseInt(s)) ? s : `Sprint ${s}`;
            document.getElementById('dropdown-t-sprint').classList.remove('active');

            // Auto-fill end date from sprint if available
            if (currentSprints[s] && currentSprints[s].endDate) {
                // The task form hidden endDate will be handled on submit via currentSprints
            }
            updateTaskModalSprintDropdown(); // Refresh selection state
        };
        const displayLabel = isNaN(parseInt(s)) ? s : `Sprint ${s}`;
        const dateSpan = deadline
            ? `<span class="text-[9px] text-gray-500 ml-auto uppercase font-bold">${deadline}</span>`
            : '';

        item.innerHTML = `
            <span>${displayLabel}</span>
            ${dateSpan}
        `;
        optionsGrid.appendChild(item);
    });
    refreshIcons();
}

function handleTaskSubmit(e) {
    e.preventDefault();
    const titleVal = document.getElementById('t-title').value.trim();
    const assignedToVal = document.getElementById('t-member').value;

    if (!titleVal || !assignedToVal) {
        showNotification("Please fill all task criteria", true);
        return;
    }

    const sprName = document.getElementById('t-sprint').value.trim();
    const data = {
        title: titleVal,
        subTasks: currentSubTasks,
        assignedTo: assignedToVal,
        sprintName: sprName,
        endDate: (sprName && currentSprints[sprName]) ? currentSprints[sprName].endDate : '',
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    if (isTaskEdit) {
        const id = document.getElementById('task-id').value;
        database.ref(`projects/${selectedProjId}/tasks/${id}`).update(data)
            .then(() => {
                closeGenericModal();
                showNotification("Main Task objectives updated");
            });
    } else {
        data.status = 'NotStarted';
        data.createdAt = firebase.database.ServerValue.TIMESTAMP;
        database.ref(`projects/${selectedProjId}/tasks`).push(data)
            .then(() => {
                closeGenericModal();
                showNotification("Main Task launched successfully!");
            });
    }
}

function handleProjectSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('p-id') ? document.getElementById('p-id').value : null;
    const name = document.getElementById('p-name').value.trim();
    const icon = document.getElementById('p-icon').value;
    const colorFrom = document.getElementById('p-color-from').value;
    const colorTo = document.getElementById('p-color-to').value;

    if (!name) {
        showNotification("Project needs a name!", true);
        return;
    }

    closeGenericModal();

    const data = {
        name,
        icon,
        colorFrom,
        colorTo,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    if (isProjectEdit && id) {
        database.ref(`projects/${id}`).update(data)
            .then(() => showNotification("Project updated!"))
            .catch(err => showNotification("Error updating project: " + err.message, true));
    } else {
        data.createdAt = firebase.database.ServerValue.TIMESTAMP;
        database.ref('projects').push(data)
            .then(() => showNotification("Project created successfully!"))
            .catch(err => showNotification("Error creating project: " + err.message, true));
    }
}
function handleMemberSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('m-id').value;
    const name = document.getElementById('m-name').value.trim();
    const role = document.getElementById('m-role').value.trim();
    const colorFrom = document.getElementById('m-color-from').value;
    const colorTo = document.getElementById('m-color-to').value;

    if (!name || !role) {
        showNotification("Please provide both name and role", true);
        return;
    }

    const data = {
        name: name,
        role: role,
        colorFrom: colorFrom,
        colorTo: colorTo,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    if (window.isSelfLinking && auth.currentUser) {
        data.linkedUid = auth.currentUser.uid;
        data.email = auth.currentUser.email;
        window.isSelfLinking = false;
    }


    if (id) {
        database.ref(`projects/${selectedProjId}/members/${id}`).update(data)
            .then(() => {
                closeGenericModal();
                showNotification(`Updated details for ${name}`);
            })
            .catch(err => showNotification("Error updating member: " + err.message, true));
    } else {
        data.createdAt = firebase.database.ServerValue.TIMESTAMP;
        database.ref(`projects/${selectedProjId}/members`).push(data)
            .then(() => {
                closeGenericModal();
                showNotification(`Welcome to the team, ${name}!`);
            })
            .catch(err => showNotification("Error adding member: " + err.message, true));
    }
}

function handleSprintSubmit(e) {
    e.preventDefault();
    const isEdit = !document.getElementById('s-edit-container').classList.contains('hidden');
    const name = isEdit ? document.getElementById('s-edit-name').value : document.getElementById('s-name').value.trim();
    const endDate = document.getElementById('s-end-date').value;

    if (!name || !endDate) {
        showNotification("Please set both sprint name and deadline", true);
        return;
    }

    database.ref(`projects/${selectedProjId}/sprints/${name}`).update({
        endDate: endDate,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    })
        .then(() => {
            closeGenericModal();
            showNotification(isEdit ? `Sprint ${name} deadline extended!` : `Sprint ${name} established!`);
            // Also update tasks if backend doesn't handle it
            Object.keys(currentTasks).forEach(tid => {
                const t = currentTasks[tid];
                if (t.sprintName === name) {
                    database.ref(`projects/${selectedProjId}/tasks/${tid}`).update({ endDate: endDate });
                }
            });
        })
        .catch(err => showNotification("Error updating sprint: " + err.message, true));
}

function updateSprintEditDropdown() {
    const label = document.getElementById('s-edit-label');
    const hiddenInput = document.getElementById('s-edit-name');
    const optionsGrid = document.getElementById('s-edit-options');
    if (!optionsGrid) return;
    optionsGrid.innerHTML = '';
    optionsGrid.classList.add('max-h-60', 'overflow-y-auto', 'custom-scrollbar');

    // Get unique sprint names from BOTH Tasks and Defined Sprints
    const sprints = new Set();
    Object.keys(currentSprints || {}).forEach(k => sprints.add(k));
    Object.values(currentTasks || {}).forEach(t => {
        if (t.sprintName) sprints.add(t.sprintName);
    });

    const sprintList = Array.from(sprints).sort((a, b) => {
        const na = parseInt(a), nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });

    sprintList.forEach(s => {
        const item = document.createElement('div');
        item.className = `dropdown-item ${hiddenInput.value === s ? 'selected' : ''}`;

        // Find best possible deadline preview
        let deadline = currentSprints[s]?.endDate;
        if (!deadline) {
            const taskWithDate = Object.values(currentTasks).find(t => t.sprintName === s && t.endDate);
            if (taskWithDate) deadline = taskWithDate.endDate;
        }

        item.onclick = (e) => {
            e.stopPropagation();
            hiddenInput.value = s;
            label.innerText = isNaN(parseInt(s)) ? s : `Sprint ${s}`;
            document.getElementById('s-end-date').value = deadline || '';
            document.getElementById('dropdown-s-edit').classList.remove('active');
            updateSprintEditDropdown();
        };

        const displayLabel = isNaN(parseInt(s)) ? s : 'Sprint ' + s;
        const dateSpan = deadline ? `<span class="text-[9px] text-gray-500 ml-auto uppercase font-bold">${deadline}</span>` : '';

        item.innerHTML = `<span>${displayLabel}</span>${dateSpan}`;
        optionsGrid.appendChild(item);
    });
    refreshIcons();
}

function openGenericModal(type, extra = null) {
    document.getElementById('generic-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Reset all forms
    const projectForm = document.getElementById('project-form');
    const memberForm = document.getElementById('member-form');
    const taskForm = document.getElementById('task-form');
    const sprintForm = document.getElementById('sprint-form');
    const inviteForm = document.getElementById('invite-form');
    if (projectForm) projectForm.classList.add('hidden');
    if (memberForm) memberForm.classList.add('hidden');
    if (taskForm) taskForm.classList.add('hidden');
    if (sprintForm) sprintForm.classList.add('hidden');
    if (inviteForm) inviteForm.classList.add('hidden');

    const title = document.getElementById('modal-title');
    const sub = document.getElementById('modal-sub');

    if (type === 'project') {
        if (projectForm) projectForm.classList.remove('hidden');
        if (extra) {
            isProjectEdit = true;
            const p = allProjects[extra];
            title.innerText = "Edit Project";
            sub.innerText = "Update workspace details";
            document.getElementById('p-id').value = extra;
            document.getElementById('p-name').value = p.name;
            document.getElementById('project-submit-btn').innerText = "Update Project";
            if (typeof selectIcon === 'function') {
                selectIcon(p.icon || 'layers');
                selectColor(p.colorFrom || '#a855f7', p.colorTo || '#7e22ce');
            }
        } else {
            isProjectEdit = false;
            title.innerText = "New Project";
            sub.innerText = "Start a fresh collaboration space";
            projectForm.reset();
            document.getElementById('project-submit-btn').innerText = "Create Project";
            if (typeof selectIcon === 'function') {
                selectIcon('layers');
                selectColor('#a855f7', '#7e22ce');
            }
        }
    } else if (type === 'task') {
        if (taskForm) taskForm.classList.remove('hidden');
        setupTagInput();
        if (extra) {
            isTaskEdit = true;
            const t = currentTasks[extra];
            title.innerText = "Edit Main Task";
            sub.innerText = "Refine the objectives";
            if (document.getElementById('task-id')) document.getElementById('task-id').value = extra;
            document.getElementById('t-title').value = t.title;
            currentSubTasks = [...(t.subTasks || [])];
            document.getElementById('t-member').value = t.assignedTo;
            document.getElementById('t-sprint').value = t.sprintName || '';
            const mName = currentMembers[t.assignedTo]?.name || t.assignedTo;
            document.getElementById('t-member-label').innerText = mName;

            const sName = t.sprintName || '';
            const sLabel = sName ? (isNaN(parseInt(sName)) ? sName : `Sprint ${sName}`) : 'Select Sprint';
            document.getElementById('t-sprint-label').innerText = sLabel;

            document.getElementById('task-submit-btn').innerText = "Update Main Task";
        } else {
            isTaskEdit = false;
            title.innerText = "New Main Task";
            sub.innerText = "Assign a new objective";
            taskForm.reset();
            currentSubTasks = [];

            // Auto-select if in a specific member's workspace
            if (window.location.pathname.includes('workspace.html') && selectedMember && selectedMember !== 'Global') {
                const cachedName = localStorage.getItem('tt_member_name');
                const memberName = (currentMembers[selectedMember]?.name) || cachedName || selectedMember;
                document.getElementById('t-member').value = selectedMember;
                document.getElementById('t-member-label').innerText = memberName;
            } else {
                document.getElementById('t-member').value = '';
                document.getElementById('t-member-label').innerText = 'Select Member';
            }

            document.getElementById('t-sprint').value = '';
            document.getElementById('t-sprint-label').innerText = 'Select Sprint';

            document.getElementById('task-submit-btn').innerText = "Launch Task";
        }
        renderTagsInModal();
        updateMemberDropdown();
        if (typeof updateTaskModalSprintDropdown === 'function') {
            updateTaskModalSprintDropdown();
        }
    } else if (type === 'member') {
        if (memberForm) memberForm.classList.remove('hidden');
        if (extra) {
            const m = currentMembers[extra];
            title.innerText = "Edit Member";
            sub.innerText = `Updating profile`;
            document.getElementById('m-id').value = extra;
            document.getElementById('m-name').value = m.name;
            document.getElementById('m-role').value = m.role;
            selectMemberColor(m.colorFrom || '#a855f7', m.colorTo || '#7e22ce');
            document.getElementById('member-submit-btn').innerText = "Update Member";
        } else {
            title.innerText = "Add Team Member";
            const projName = (allProjects[selectedProjId] && allProjects[selectedProjId].name) || 'Project';
            sub.innerText = `Adding to ${projName}`;
            memberForm.reset();
            document.getElementById('m-id').value = '';
            selectMemberColor('#a855f7', '#7e22ce');
            document.getElementById('member-submit-btn').innerText = "Add Member";
        }
    } else if (type === 'invite') {
        if (inviteForm) inviteForm.classList.remove('hidden');
        title.innerText = "Invite Collaborator";
        sub.innerText = "Share project access";
        inviteForm.reset();
        document.getElementById('invite-link-container').classList.add('hidden');
        document.getElementById('invite-submit-btn').classList.remove('hidden');
        document.getElementById('invite-submit-btn').innerText = "Generate Invite Link";
    } else if (type === 'sprint') {
        if (sprintForm) sprintForm.classList.remove('hidden');
        const nameContainer = document.getElementById('s-name-container');
        const editContainer = document.getElementById('s-edit-container');
        const submitBtn = sprintForm.querySelector('button[type="submit"]');

        if (extra === 'edit') {
            title.innerText = "Extend Deadline";
            sub.innerText = "Reschedule an existing sprint";
            if (nameContainer) nameContainer.classList.add('hidden');
            if (editContainer) editContainer.classList.remove('hidden');
            if (submitBtn) {
                submitBtn.innerText = "Update Deadline";
                submitBtn.className = "w-full py-5 bg-emerald-500 hover:bg-emerald-600 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 text-white";
            }
            document.getElementById('s-edit-name').value = '';
            document.getElementById('s-edit-label').innerText = 'Select Sprint';
            updateSprintEditDropdown();
        } else {
            title.innerText = "Add Sprint";
            sub.innerText = "Set a project deadline";
            if (nameContainer) nameContainer.classList.remove('hidden');
            if (editContainer) editContainer.classList.add('hidden');
            if (submitBtn) {
                submitBtn.innerText = "Create Sprint";
                submitBtn.className = "w-full py-5 bg-cyan-500 hover:bg-cyan-600 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-cyan-500/20 text-white";
            }
            sprintForm.reset();

            // Auto-suggest logic
            const nameInput = document.getElementById('s-name');
            if (nameInput) {
                const sprintKeys = new Set(Object.keys(currentSprints || {}));
                Object.values(currentTasks || {}).forEach(t => { if (t.sprintName) sprintKeys.add(t.sprintName); });
                let nextNum = 1;
                if (sprintKeys.size > 0) {
                    const nums = Array.from(sprintKeys).map(k => parseInt(k)).filter(n => !isNaN(n));
                    if (nums.length > 0) nextNum = Math.max(...nums) + 1;
                }
                nameInput.value = nextNum;
            }
        }

        // Shared Date Logic
        const dateInput = document.getElementById('s-end-date');
        if (dateInput && extra !== 'edit') {
            let minDateObj = new Date();
            const existingDatesSet = new Set();
            Object.values(currentSprints || {}).forEach(s => { if (s.endDate) existingDatesSet.add(s.endDate); });
            Object.values(currentTasks || {}).forEach(t => { if (t.sprintName && t.endDate) existingDatesSet.add(t.endDate); });
            const existingDates = Array.from(existingDatesSet);
            if (existingDates.length > 0) {
                const latestDateString = existingDates.reduce((a, b) => new Date(a) > new Date(b) ? a : b);
                const latestDateObj = new Date(latestDateString);
                latestDateObj.setDate(latestDateObj.getDate() + 1);
                if (latestDateObj > minDateObj) minDateObj = latestDateObj;
            }
            const yyyy = minDateObj.getFullYear();
            const mm = String(minDateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(minDateObj.getDate()).padStart(2, '0');
            dateInput.min = `${yyyy}-${mm}-${dd}`;
            dateInput.value = `${yyyy}-${mm}-${dd}`;
        } else if (dateInput) {
            dateInput.min = ""; // No min restriction for editing/extending
        }
    }

    refreshIcons();

    setTimeout(() => {
        const firstInput = document.querySelector(`#${type}-form input[type="text"]:not([readonly])`);
        if (firstInput) firstInput.focus();
    }, 200);
}

function selectMemberColor(from, to) {
    const fromInput = document.getElementById('m-color-from');
    const toInput = document.getElementById('m-color-to');
    if (!fromInput || !toInput) return;

    fromInput.value = from;
    toInput.value = to;

    const allOptions = document.querySelectorAll('.member-color-option');
    allOptions.forEach(opt => {
        const optColor = opt.getAttribute('data-color');
        if (optColor === from) {
            opt.classList.add('border-white', 'scale-110');
            opt.classList.remove('border-transparent');
        } else {
            opt.classList.remove('border-white', 'scale-110');
            opt.classList.add('border-transparent');
        }
    });
}

// Global Welcome Interface for logged-out users
window.showWelcomeInterface = function () {
    hideLoader();
    let welcome = document.getElementById('global-welcome-interface');
    if (!welcome) {
        welcome = document.createElement('div');
        welcome.id = 'global-welcome-interface';
        welcome.className = 'fixed inset-0 z-[190] bg-[#05070a] flex flex-col items-center justify-center p-6 sm:p-10 animate-fadeIn overflow-hidden';

        const isRoot = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
        const logoPath = isRoot ? 'images/logo.png' : '../images/logo.png';

        welcome.innerHTML = `
            <div class="absolute inset-0 pointer-events-none">
                <div class="absolute w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[150px] -top-60 -left-60 mix-blend-screen opacity-80"></div>
                <div class="absolute w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-[150px] -bottom-60 -right-60 mix-blend-screen opacity-80"></div>
                <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDE1Ii8+Cjwvc3ZnPg==')] opacity-30 mix-blend-overlay"></div>
            </div>
            
            <!-- Top Left Logo -->
            <div class="absolute top-8 left-8 md:top-12 md:left-12 flex items-center space-x-4 z-20 group">
                <div class="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl shadow-2xl flex items-center justify-center border border-white/5 bg-gradient-to-br from-[#101520] to-[#0a0f18] relative">
                    <span class="absolute inset-0 rounded-2xl md:rounded-3xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.05)] pointer-events-none"></span>
                    <img src="${logoPath}" alt="Logo" class="w-10 h-10 md:w-14 md:h-14 object-contain drop-shadow-2xl transition-transform group-hover:scale-110" onerror="this.src=''; this.className='hidden'; this.nextElementSibling.classList.remove('hidden');">
                    <i data-lucide="layers" class="w-8 h-8 text-indigo-400 hidden"></i>
                </div>
            </div>
            
            <!-- Centered Massive Title & Content -->
            <div class="relative z-10 flex flex-col items-center justify-center text-center w-full max-w-5xl mx-auto flex-grow mt-16 md:mt-0">
                <h1 class="text-[80px] md:text-[130px] font-black tracking-tighter mb-4 md:mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500 drop-shadow-2xl leading-none">TaskTrace</h1>
                
                <p class="text-gray-400 text-lg md:text-2xl font-medium leading-relaxed mb-12 md:mb-16 max-w-2xl mx-auto drop-shadow-sm px-4">
                    Welcome to the secure collaboration hub. Please authenticate your identity to access your workspace.
                </p>
                
                <div class="w-full max-w-[320px] md:max-w-sm mx-auto">
                    <button onclick="dismissWelcomeAndLogin()" class="w-full relative group overflow-hidden rounded-[24px] p-[2px] shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 hover:-translate-y-1">
                        <span class="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-[24px] opacity-80 group-hover:opacity-100 bg-[length:200%_auto] animate-gradient transition-opacity"></span>
                        <div class="relative flex items-center justify-center space-x-4 bg-gray-950/90 backdrop-blur-3xl px-6 py-5 md:px-8 md:py-6 rounded-[22px] transition-all group-hover:bg-gray-950/70">
                            <i data-lucide="shield-check" class="w-5 h-5 md:w-6 md:h-6 text-indigo-400 group-hover:text-white transition-colors duration-300"></i>
                            <span class="font-black text-white tracking-widest uppercase text-xs md:text-sm drop-shadow-md">Secure Login</span>
                        </div>
                    </button>
                </div>
            </div>
            
            <div class="absolute bottom-6 md:bottom-12 text-center w-full z-10">
                <p class="text-[9px] md:text-[10px] uppercase tracking-[0.4em] font-black text-white/30 truncate px-4">Enterprise Grade Task Management</p>
            </div>
        `;
        document.body.appendChild(welcome);
        if (typeof refreshIcons === 'function') refreshIcons();
    }
    welcome.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
}

window.dismissWelcomeAndLogin = function () {
    if (typeof openMeetingOverlay === 'function') {
        openMeetingOverlay('join');
    } else {
        showNotification("Security module connecting...", true);
        setTimeout(() => {
            if (typeof openMeetingOverlay === 'function') {
                openMeetingOverlay('join');
            } else {
                showNotification("Could not secure connection. Please refresh the page.", true);
            }
        }, 1200);
    }
}
