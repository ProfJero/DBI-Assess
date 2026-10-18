// ============================================================
// ADMIN DASHBOARD - COMPLETE DASHBOARD MODULE
// ============================================================

const Dashboard = {
    app: null,
    db: null,
    allAssessments: [],
    allQuestions: [],
    allStudents: [],
    allResults: [],
    allUsers: [],
    recentActivities: [],

    // ============================================================
    // RENDER - Main entry point
    // ============================================================

    render(container, app) {
        this.app = app;
        this.db = app.db || app;
        
        container.innerHTML = this.getHTML();
        this.addStyles();
        
        setTimeout(() => {
            this.loadDashboardData();
        }, 100);
    },

    // ============================================================
    // GET HTML
    // ============================================================

    getHTML() {
        return `
            <!-- Stats Cards -->
            <div class="stats-grid" id="dashboardStats">
                <div class="stat-card">
                    <div class="stat-top">
                        <div>
                            <div class="stat-number" id="statAssessments">0</div>
                            <div class="stat-label">Total Assessments</div>
                        </div>
                        <div class="stat-icon blue"><i class="fas fa-file-alt"></i></div>
                    </div>
                    <span class="stat-change up"><i class="fas fa-arrow-up"></i> Active</span>
                </div>
                
                <div class="stat-card">
                    <div class="stat-top">
                        <div>
                            <div class="stat-number" id="statQuestions">0</div>
                            <div class="stat-label">Total Questions</div>
                        </div>
                        <div class="stat-icon green"><i class="fas fa-question-circle"></i></div>
                    </div>
                    <span class="stat-change up"><i class="fas fa-arrow-up"></i> Available</span>
                </div>
                
                <div class="stat-card">
                    <div class="stat-top">
                        <div>
                            <div class="stat-number" id="statStudents">0</div>
                            <div class="stat-label">Registered Students</div>
                        </div>
                        <div class="stat-icon orange"><i class="fas fa-users"></i></div>
                    </div>
                    <span class="stat-change up"><i class="fas fa-arrow-up"></i> Active</span>
                </div>
                
                <div class="stat-card">
                    <div class="stat-top">
                        <div>
                            <div class="stat-number" id="statCompleted">0</div>
                            <div class="stat-label">Assessments Completed</div>
                        </div>
                        <div class="stat-icon purple"><i class="fas fa-check-circle"></i></div>
                    </div>
                    <span class="stat-change up"><i class="fas fa-arrow-up"></i> Completed</span>
                </div>
            </div>

            <!-- Two Column Layout -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Recent Assessments - 2 columns -->
                <div class="lg:col-span-2">
                    <div class="section-header">
                        <h2>Recent Assessments</h2>
                        <div class="section-actions">
                            <a href="assessments.html" class="btn-secondary btn-sm">
                                <i class="fas fa-arrow-right"></i> View All
                            </a>
                        </div>
                    </div>

                    <div class="table-container">
                        <div class="table-header">
                            <span>Your Assessments</span>
                            <span class="text-sm text-gray-500" id="recentCount">0 items</span>
                        </div>
                        <div class="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Type</th>
                                        <th>Questions</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                    </tr>
                                </thead>
                                <tbody id="recentAssessmentsBody">
                                    <tr>
                                        <td colspan="5">
                                            <div class="empty-state">
                                                <i class="fas fa-file-alt"></i>
                                                <h3>No assessments yet</h3>
                                                <p>Create your first assessment to get started</p>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Recent Activity - 1 column -->
                <div class="lg:col-span-1">
                    <div class="section-header">
                        <h2>Recent Activity</h2>
                    </div>

                    <div class="bg-white rounded-12 border border-gray-200 p-4" style="border-radius:12px;border:1px solid #e5e7eb;padding:16px;">
                        <div id="recentActivityList">
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-clock text-3xl mb-3 block text-gray-300"></i>
                                <p>No recent activity</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Quick Stats Row -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div class="bg-white rounded-12 border border-gray-200 p-4 text-center" style="border-radius:12px;border:1px solid #e5e7eb;padding:16px;">
                    <div class="text-2xl font-bold text-blue-600" id="quickPublished">0</div>
                    <div class="text-sm text-gray-600">Published</div>
                </div>
                <div class="bg-white rounded-12 border border-gray-200 p-4 text-center" style="border-radius:12px;border:1px solid #e5e7eb;padding:16px;">
                    <div class="text-2xl font-bold text-yellow-600" id="quickDraft">0</div>
                    <div class="text-sm text-gray-600">Drafts</div>
                </div>
                <div class="bg-white rounded-12 border border-gray-200 p-4 text-center" style="border-radius:12px;border:1px solid #e5e7eb;padding:16px;">
                    <div class="text-2xl font-bold text-green-600" id="quickCompleted">0</div>
                    <div class="text-sm text-gray-600">Completed</div>
                </div>
                <div class="bg-white rounded-12 border border-gray-200 p-4 text-center" style="border-radius:12px;border:1px solid #e5e7eb;padding:16px;">
                    <div class="text-2xl font-bold text-purple-600" id="quickStudents">0</div>
                    <div class="text-sm text-gray-600">Students</div>
                </div>
            </div>
        `;
    },

    // ============================================================
    // ADD STYLES
    // ============================================================

    addStyles() {
        if (document.getElementById('dashboardStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'dashboardStyles';
        style.textContent = `
            .rounded-12 {
                border-radius: 12px;
            }
        `;
        document.head.appendChild(style);
    },

    // ============================================================
    // LOAD DASHBOARD DATA
    // ============================================================

    async loadDashboardData() {
        try {
            this.showLoading();
            
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

            // Update stats
            this.updateStats();
            
            // Load recent assessments
            this.loadRecentAssessments();
            
            // Load recent activity
            this.loadRecentActivity();
            
            // Update sidebar counts
            this.updateSidebarCounts();

            this.hideLoading();

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.hideLoading();
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error loading dashboard data: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // UPDATE STATS
    // ============================================================

    updateStats() {
        const totalAssessments = this.allAssessments.length;
        const totalQuestions = this.allQuestions.length;
        const totalStudents = this.allStudents.length;
        const totalCompleted = this.allResults.length;

        const published = this.allAssessments.filter(a => a.status === 'published' && (a.totalQuestions || 0) > 0).length;
        const draft = this.allAssessments.filter(a => a.status === 'draft').length;

        document.getElementById('statAssessments').textContent = totalAssessments;
        document.getElementById('statQuestions').textContent = totalQuestions;
        document.getElementById('statStudents').textContent = totalStudents;
        document.getElementById('statCompleted').textContent = totalCompleted;

        document.getElementById('quickPublished').textContent = published;
        document.getElementById('quickDraft').textContent = draft;
        document.getElementById('quickCompleted').textContent = totalCompleted;
        document.getElementById('quickStudents').textContent = totalStudents;

        // Update counts in sidebar
        document.getElementById('assessmentCount').textContent = totalAssessments;
        document.getElementById('questionCount').textContent = totalQuestions;
        document.getElementById('studentCount').textContent = totalStudents;
    },

    // ============================================================
    // LOAD RECENT ASSESSMENTS
    // ============================================================

    loadRecentAssessments() {
        const tbody = document.getElementById('recentAssessmentsBody');
        const countEl = document.getElementById('recentCount');
        
        if (!tbody) return;

        const recent = this.allAssessments
            .sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                return dateB - dateA;
            })
            .slice(0, 5);

        if (countEl) {
            countEl.textContent = `${recent.length} items`;
        }

        if (recent.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <i class="fas fa-file-alt"></i>
                            <h3>No assessments yet</h3>
                            <p>Create your first assessment to get started</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const typeLabels = {
            quiz: 'Quiz',
            assignment: 'Assignment',
            practical: 'Practical',
            coding: 'Coding Challenge',
            survey: 'Survey',
            final: 'Final Exam'
        };
        const typeIcons = {
            quiz: 'fa-file-alt',
            assignment: 'fa-file-pdf',
            practical: 'fa-flask',
            coding: 'fa-code',
            survey: 'fa-poll',
            final: 'fa-graduation-cap'
        };
        const statusLabels = {
            draft: 'Draft',
            published: 'Published',
            closed: 'Closed',
            archived: 'Archived'
        };
        const statusIcons = {
            draft: 'fa-pencil-alt',
            published: 'fa-check-circle',
            closed: 'fa-lock',
            archived: 'fa-archive'
        };

        let html = '';
        recent.forEach(assessment => {
            const statusClass = assessment.status || 'draft';
            const createdDate = assessment.createdAt?.toDate?.() || new Date(assessment.createdAt || Date.now());
            
            html += `
                <tr>
                    <td><strong>${this.escapeHtml(assessment.title || 'Untitled')}</strong></td>
                    <td><span class="badge-type"><i class="fas ${typeIcons[assessment.type] || 'fa-file-alt'}"></i> ${typeLabels[assessment.type] || assessment.type || 'Quiz'}</span></td>
                    <td>${assessment.totalQuestions || 0}</td>
                    <td><span class="badge-status ${statusClass}"><i class="fas ${statusIcons[statusClass] || 'fa-circle'}"></i> ${statusLabels[statusClass] || statusClass}</span></td>
                    <td>${this.formatDate(createdDate)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    // ============================================================
    // LOAD RECENT ACTIVITY
    // ============================================================

    loadRecentActivity() {
        const container = document.getElementById('recentActivityList');
        if (!container) return;

        // Generate sample recent activities based on data
        const activities = [];

        // Add assessment creations
        this.allAssessments.slice(0, 3).forEach(assessment => {
            const date = assessment.createdAt?.toDate?.() || new Date(assessment.createdAt || Date.now());
            activities.push({
                icon: 'blue',
                iconClass: 'fa-plus',
                title: 'Assessment Created',
                desc: `"${assessment.title || 'Untitled'}" was created`,
                time: date,
                type: 'assessment'
            });
        });

        // Add question creations
        this.allQuestions.slice(0, 3).forEach(question => {
            const date = question.createdAt?.toDate?.() || new Date(question.createdAt || Date.now());
            activities.push({
                icon: 'green',
                iconClass: 'fa-question',
                title: 'Question Added',
                desc: `New question added to the bank`,
                time: date,
                type: 'question'
            });
        });

        // Add student registrations
        this.allStudents.slice(0, 2).forEach(student => {
            const date = student.createdAt?.toDate?.() || new Date(student.createdAt || Date.now());
            const name = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
            activities.push({
                icon: 'purple',
                iconClass: 'fa-user-plus',
                title: 'Student Registered',
                desc: `${name} registered on the platform`,
                time: date,
                type: 'student'
            });
        });

        // Add results
        this.allResults.slice(0, 2).forEach(result => {
            const date = result.submittedAt?.toDate?.() || new Date(result.submittedAt || Date.now());
            const score = result.score || 0;
            const passed = result.passed ? 'Passed' : 'Failed';
            activities.push({
                icon: result.passed ? 'green' : 'red',
                iconClass: result.passed ? 'fa-check' : 'fa-times',
                title: `${passed} Assessment`,
                desc: `Student scored ${score}% on "${result.assessmentTitle || 'Untitled'}"`,
                time: date,
                type: 'result'
            });
        });

        // Sort by time (newest first)
        activities.sort((a, b) => b.time - a.time);
        
        // Take top 10
        const recentActivities = activities.slice(0, 10);

        if (recentActivities.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-clock text-3xl mb-3 block text-gray-300"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        let html = '';
        recentActivities.forEach(activity => {
            const timeAgo = this.timeAgo(activity.time);
            html += `
                <div class="activity-item">
                    <div class="activity-icon ${activity.icon}">
                        <i class="fas ${activity.iconClass}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-desc">${activity.desc}</div>
                    </div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    // ============================================================
    // UPDATE SIDEBAR COUNTS
    // ============================================================

    updateSidebarCounts() {
        document.getElementById('assessmentCount').textContent = this.allAssessments.length;
        document.getElementById('questionCount').textContent = this.allQuestions.length;
        document.getElementById('studentCount').textContent = this.allStudents.length;
    },

    // ============================================================
    // LOADING STATE
    // ============================================================

    showLoading() {
        // Could add a loading overlay if needed
    },

    hideLoading() {
        // Could remove loading overlay if needed
    },

    // ============================================================
    // HELPER FUNCTIONS
    // ============================================================

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    formatDate(date) {
        if (!date) return 'N/A';
        try {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return 'N/A';
        }
    },

    timeAgo(date) {
        if (!date) return 'N/A';
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return this.formatDate(date);
    }
};

// ============================================================
// EXPORT FOR GLOBAL ACCESS
// ============================================================

window.Dashboard = Dashboard;