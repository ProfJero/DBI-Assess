// ============================================================
// DBI ASSESS STUDENT - MAIN APP
// ============================================================

const App = {
    // Firebase instances
    db: null,
    currentUser: null,
    currentPage: 'dashboard',

    // ============================================================
    // INITIALIZATION
    // ============================================================

    init() {
        console.log('🚀 Initializing DBI Assess Student...');
        
        // Initialize Firebase
        this.initFirebase();
        
        // Check authentication
        this.checkAuth();
        
        // Setup event listeners
        this.setupEventListeners();
    },

    // ============================================================
    // FIREBASE INITIALIZATION
    // ============================================================

    initFirebase() {
        const firebaseConfig = {
            apiKey: "AIzaSyCdrmMMmZ0xdC2A_GXdAcWnUAa1i6QbjwQ",
            authDomain: "dbi-assess.firebaseapp.com",
            projectId: "dbi-assess",
            storageBucket: "dbi-assess.firebasestorage.app",
            messagingSenderId: "558455201415",
            appId: "1:558455201415:web:4a12a7b7c4cff9ecb6a222",
            measurementId: "G-FE2BPSJ4C5"
        };
        
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        this.db = firebase.firestore();
        
        // Enable offline persistence
        this.db.enablePersistence({ synchronizeTabs: true })
            .catch(err => console.warn('Persistence warning:', err));
        
        console.log('✅ Firebase initialized');
    },

    // ============================================================
    // AUTHENTICATION
    // ============================================================

    checkAuth() {
        // Check session storage
        const userData = sessionStorage.getItem('dbi_assess_user');
        
        if (userData) {
            try {
                this.currentUser = JSON.parse(userData);
                console.log('👤 Student logged in (session):', this.currentUser.studentId);
                this.updateStudentUI();
                this.loadInitialPage();
                return;
            } catch (e) {
                console.warn('Invalid session data:', e);
            }
        }

        // If no session, redirect to login
        console.log('🔐 No student logged in, redirecting...');
        this.redirectToLogin();
    },

    loadInitialPage() {
        // Load the dashboard
        setTimeout(() => {
            this.navigateTo('dashboard');
        }, 300);
    },

    redirectToLogin() {
        if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
            window.location.href = '../index.html';
        }
    },

    updateStudentUI() {
        if (!this.currentUser) return;
        
        const name = this.currentUser.firstName || 'Student';
        const avatar = document.getElementById('studentAvatar');
        const nameEl = document.getElementById('studentName');
        const idEl = document.getElementById('studentId');

        if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
        if (nameEl) nameEl.textContent = name;
        if (idEl) idEl.textContent = this.currentUser.studentId || 'N/A';
    },

    // ============================================================
    // NAVIGATION
    // ============================================================

    navigateTo(page) {
        if (!this.currentUser) {
            this.redirectToLogin();
            return;
        }

        console.log(`📄 Navigating to: ${page}`);
        this.currentPage = page;

        // Update sidebar
        document.querySelectorAll('.sidebar-menu .menu-item[data-page]').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });

        // Update title
        const titles = {
            dashboard: ['Dashboard', 'Welcome to your learning dashboard'],
            assessments: ['My Assessments', 'View and take your assessments'],
            results: ['My Results', 'View your assessment results'],
            profile: ['My Profile', 'View and manage your profile']
        };

        const title = titles[page] || ['Page', ''];
        document.getElementById('pageTitle').textContent = title[0];
        document.getElementById('pageSubtitle').textContent = title[1];

        // Load page content
        const container = document.getElementById('pageContent');
        
        switch(page) {
            case 'dashboard':
                if (typeof Dashboard !== 'undefined') {
                    Dashboard.render(container, this);
                }
                break;
            case 'assessments':
                if (typeof Assessments !== 'undefined') {
                    Assessments.render(container, this);
                }
                break;
            case 'results':
                if (typeof Results !== 'undefined') {
                    Results.render(container, this);
                }
                break;
            case 'profile':
                if (typeof Profile !== 'undefined') {
                    Profile.render(container, this);
                }
                break;
            default:
                if (typeof Dashboard !== 'undefined') {
                    Dashboard.render(container, this);
                }
        }
    },

    // ============================================================
    // EVENT LISTENERS
    // ============================================================

    setupEventListeners() {
        // Hamburger menu
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', () => {
                document.getElementById('sidebar').classList.toggle('open');
                document.getElementById('sidebarOverlay').classList.toggle('show');
            });
        }

        // Close sidebar on overlay click
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                document.getElementById('sidebar').classList.remove('open');
                document.getElementById('sidebarOverlay').classList.remove('show');
            });
        }

        // Close sidebar on window resize (desktop)
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                document.getElementById('sidebar').classList.remove('open');
                document.getElementById('sidebarOverlay').classList.remove('show');
            }
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    },

    // ============================================================
    // LOGOUT
    // ============================================================

    async logout() {
        if (confirm('Are you sure you want to logout?')) {
            try {
                sessionStorage.removeItem('dbi_assess_user');
                window.location.href = '../index.html';
            } catch (error) {
                console.error('Logout error:', error);
                this.showToast('Error logging out', true);
            }
        }
    },

    // ============================================================
    // TOAST
    // ============================================================

    showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        if (!toast) return;
        
        toastMessage.textContent = message;
        toast.className = 'toast';
        if (isError) {
            toast.classList.add('error');
            toast.querySelector('i').className = 'fas fa-exclamation-circle';
        } else {
            toast.classList.add('success');
            toast.querySelector('i').className = 'fas fa-check-circle';
        }
        toast.classList.add('show');
        
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    },

    // ============================================================
    // MODAL
    // ============================================================

    openModal(title, content) {
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const overlay = document.getElementById('modalOverlay');
        
        if (modalTitle) modalTitle.textContent = title;
        if (modalBody) modalBody.innerHTML = content;
        if (overlay) overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    closeModal() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.remove('show');
        document.body.style.overflow = '';
    },

    // ============================================================
    // HELPERS
    // ============================================================

    formatDate(date) {
        if (!date) return 'N/A';
        try {
            if (date.toDate) {
                return date.toDate().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return 'N/A';
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ============================================================
// GLOBAL FUNCTIONS (for onclick handlers)
// ============================================================

function navigateTo(page) {
    App.navigateTo(page);
}

function closeModal() {
    App.closeModal();
}

function showToast(message, isError = false) {
    App.showToast(message, isError);
}

function handleLogout() {
    App.logout();
}