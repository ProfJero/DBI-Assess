// ============================================================
// DBI ASSESS ADMIN - MAIN APP
// ============================================================

const App = {
    // Firebase instances
    db: null,
    auth: null,
    currentUser: null,
    currentPage: 'dashboard',
    isAdmin: false,
    adminData: null,

    // Data stores
    allAssessments: [],
    allQuestions: [],
    allStudents: [],
    allResults: [],

    // ============================================================
    // INITIALIZATION
    // ============================================================

    init() {
        console.log('🚀 Initializing DBI Assess Admin...');
        
        // Initialize Firebase
        this.initFirebase();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check authentication
        this.checkAuth();
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
        
        this.auth = firebase.auth();
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
        // Check session storage first
        const userData = sessionStorage.getItem('dbi_admin_user');
        
        if (userData) {
            try {
                this.currentUser = JSON.parse(userData);
                this.isAdmin = true;
                this.adminData = this.currentUser;
                console.log('👤 Admin logged in (session):', this.currentUser.email);
                this.updateAdminUI();
                this.loadInitialData();
                return;
            } catch (e) {
                console.warn('Invalid session data:', e);
            }
        }

        // Check Firebase Auth state
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log('👤 Firebase Auth user:', user.email || user.uid);
                
                try {
                    const adminDoc = await this.db.collection('admins').doc(user.uid).get();
                    
                    if (adminDoc.exists) {
                        const adminData = adminDoc.data();
                        this.currentUser = {
                            uid: user.uid,
                            email: user.email,
                            ...adminData
                        };
                        this.isAdmin = true;
                        this.adminData = this.currentUser;
                        
                        sessionStorage.setItem('dbi_admin_user', JSON.stringify(this.currentUser));
                        
                        console.log('✅ Admin verified:', this.currentUser.email);
                        this.updateAdminUI();
                        this.loadInitialData();
                    } else {
                        console.warn('⚠️ User is not an admin');
                        this.showAccessDenied();
                    }
                } catch (error) {
                    console.error('Error checking admin status:', error);
                    this.showToast('Error verifying admin status', true);
                }
            } else {
                console.log('🔐 No user logged in');
                // Redirect to login
                // window.location.href = 'index.html';
            }
        });
    },

    loadInitialData() {
        // Load all data from Firebase
        this.loadAllData().then(() => {
            // Navigate to dashboard
            this.navigateTo('dashboard');
        });
    },

    showAccessDenied() {
        const container = document.getElementById('pageContent');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 80px 20px;">
                    <i class="fas fa-lock" style="font-size: 64px; color: #dc2626; display: block; margin-bottom: 20px;"></i>
                    <h2 style="color: #1a1f2c; margin-bottom: 12px;">Access Denied</h2>
                    <p style="color: #6b7280; max-width: 400px; margin: 0 auto;">You don't have admin privileges. Please contact the system administrator.</p>
                    <button onclick="App.logout()" class="btn-primary" style="margin-top: 24px; display: inline-flex; width: auto; padding: 12px 32px;">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            `;
        }
    },

    updateAdminUI() {
        if (!this.currentUser) return;
        
        const name = this.currentUser.name || this.currentUser.email || 'Admin';
        const avatar = document.getElementById('adminAvatar');
        const nameEl = document.getElementById('adminName');
        const roleEl = document.getElementById('adminRole');

        if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
        if (nameEl) nameEl.textContent = name;
        if (roleEl) roleEl.textContent = this.currentUser.role || 'Super Admin';
    },

    // ============================================================
    // DATA LOADING
    // ============================================================

    async loadAllData() {
        try {
            console.log('📊 Loading data from Firebase...');
            
            // Load all collections in parallel
            const [assessmentsSnap, questionsSnap, studentsSnap, resultsSnap] = await Promise.all([
                this.db.collection('assessments').get(),
                this.db.collection('questions').get(),
                this.db.collection('users').get(),
                this.db.collection('studentResults').get()
            ]);

            // Store data
            this.allAssessments = [];
            assessmentsSnap.forEach(doc => {
                this.allAssessments.push({ id: doc.id, ...doc.data() });
            });

            this.allQuestions = [];
            questionsSnap.forEach(doc => {
                this.allQuestions.push({ id: doc.id, ...doc.data() });
            });

            this.allStudents = [];
            studentsSnap.forEach(doc => {
                this.allStudents.push({ id: doc.id, ...doc.data() });
            });

            this.allResults = [];
            resultsSnap.forEach(doc => {
                this.allResults.push({ id: doc.id, ...doc.data() });
            });

            // Update counts
            document.getElementById('assessmentCount').textContent = this.allAssessments.length;
            document.getElementById('questionCount').textContent = this.allQuestions.length;
            document.getElementById('studentCount').textContent = this.allStudents.length;

            console.log(`📊 Data loaded: ${this.allAssessments.length} assessments, ${this.allQuestions.length} questions, ${this.allStudents.length} students, ${this.allResults.length} results`);

        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Error loading data: ' + error.message, true);
        }
    },

    getData(collection) {
        switch(collection) {
            case 'assessments': return this.allAssessments;
            case 'questions': return this.allQuestions;
            case 'students': return this.allStudents;
            case 'results': return this.allResults;
            default: return [];
        }
    },

    refreshData(collection) {
        this.loadAllData();
    },

    // ============================================================
    // NAVIGATION - UPDATED
    // ============================================================

    navigateTo(page) {
        if (!this.isAdmin) {
            this.showToast('Please login as admin first', true);
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
            dashboard: ['Dashboard', 'Overview of your assessment platform'],
            assessments: ['Assessments', 'Manage your assessment library'],
            questions: ['Question Bank', 'Manage all assessment questions'],
            students: ['Student Management', 'View and manage registered students'],
            results: ['Assessment Results', 'View student performance analytics'],
            settings: ['Settings', 'Configure your assessment platform']
        };

        const title = titles[page] || ['Page', ''];
        document.getElementById('pageTitle').textContent = title[0];
        document.getElementById('pageSubtitle').textContent = title[1];

        // Load page content using the page modules
        const container = document.getElementById('pageContent');
        
        switch(page) {
            case 'dashboard':
                if (typeof Dashboard !== 'undefined' && Dashboard.render) {
                    Dashboard.render(container, this);
                } else {
                    container.innerHTML = '<div style="text-align:center;padding:40px;">Dashboard module not loaded</div>';
                }
                break;
            case 'assessments':
                if (typeof Assessments !== 'undefined' && Assessments.load) {
                    Assessments.load(this.db);
                } else {
                    container.innerHTML = '<div style="text-align:center;padding:40px;">Assessments module not loaded</div>';
                }
                break;
            case 'questions':
                if (typeof Questions !== 'undefined' && Questions.render) {
                    Questions.render(container, this);
                } else {
                    container.innerHTML = '<div style="text-align:center;padding:40px;">Questions module not loaded</div>';
                }
                break;
            case 'students':
                if (typeof Students !== 'undefined' && Students.render) {
                    Students.render(container, this);
                } else {
                    container.innerHTML = '<div style="text-align:center;padding:40px;">Students module not loaded</div>';
                }
                break;
            case 'results':
                if (typeof Results !== 'undefined' && Results.render) {
                    Results.render(container, this);
                } else {
                    container.innerHTML = '<div style="text-align:center;padding:40px;">Results module not loaded</div>';
                }
                break;
            case 'settings':
                if (typeof Settings !== 'undefined' && Settings.render) {
                    Settings.render(container, this);
                } else {
                    container.innerHTML = '<div style="text-align:center;padding:40px;">Settings module not loaded</div>';
                }
                break;
            default:
                if (typeof Dashboard !== 'undefined' && Dashboard.render) {
                    Dashboard.render(container, this);
                } else {
                    container.innerHTML = '<div style="text-align:center;padding:40px;">Page not found</div>';
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
                await this.auth.signOut();
                sessionStorage.removeItem('dbi_admin_user');
                window.location.href = 'index.html';
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
        
        if (!toast) {
            console.warn('Toast element not found');
            return;
        }
        
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
    },

    getAssessmentTitle(id) {
        const assessment = this.allAssessments.find(a => a.id === id);
        return assessment ? assessment.title : 'Unknown';
    },

    getStudentName(id) {
        const student = this.allStudents.find(s => s.studentId === id);
        if (student) {
            return `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.studentId;
        }
        return id || 'Unknown';
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

function toggleAdminMenu() {
    // Simple toggle for now - can be expanded
}

console.log('%c📊 DBI Assess Admin Panel', 'font-size: 20px; font-weight: bold; color: #166534;');
console.log('%c🔐 Admin System v1.0', 'font-size: 14px; color: #22c55e;');
console.log('%c📚 Manage assessments, questions, and students', 'font-size: 14px; color: #6b7280;');