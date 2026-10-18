// ============================================================
// ADMIN QUIZZES - COMPLETE MANAGEMENT SYSTEM
// ============================================================

const Quizzes = {
    app: null,
    db: null,
    currentQuiz: null,
    currentTab: 'basic',
    allQuizzes: [],
    filteredQuizzes: [],
    questionBank: [],
    currentQuestions: [],

    // ============================================================
    // RENDER - Main entry point
    // ============================================================

    render(container, app) {
        this.app = app;
        this.db = app.db;
        
        container.innerHTML = this.getHTML();
        this.addStyles();
        
        setTimeout(() => {
            this.loadQuizzes();
        }, 100);
    },

    load(db) {
        this.db = db || App.db;
        const container = document.getElementById('pageContent');
        if (container) {
            this.render(container, { db: this.db });
        }
    },

    // ============================================================
    // GET HTML
    // ============================================================

    getHTML() {
        return `
            <!-- Page Header -->
            <div class="page-header">
                <div>
                    <h2>Quiz Management</h2>
                    <p class="subtitle">Create, manage, and monitor all quizzes</p>
                </div>
                <div class="header-actions">
                    <button class="btn-primary" onclick="Quizzes.openCreate()">
                        <i class="fas fa-plus"></i> New Quiz
                    </button>
                    <button class="btn-secondary" onclick="Quizzes.openQuestionBank()">
                        <i class="fas fa-database"></i> Question Bank
                    </button>
                </div>
            </div>

            <!-- Stats Cards -->
            <div class="stats-grid" id="quizStats">
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="fas fa-file-alt"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statTotal">0</div>
                        <div class="stat-label">Total Quizzes</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statPublished">0</div>
                        <div class="stat-label">Published</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange"><i class="fas fa-pencil-alt"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statDraft">0</div>
                        <div class="stat-label">Drafts</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple"><i class="fas fa-calendar-alt"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statScheduled">0</div>
                        <div class="stat-label">Scheduled</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statExpired">0</div>
                        <div class="stat-label">Expired</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon teal"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statAvgScore">0%</div>
                        <div class="stat-label">Average Score</div>
                    </div>
                </div>
            </div>

            <!-- Filter Bar -->
            <div class="filter-bar">
                <div class="filter-group search-group">
                    <i class="fas fa-search"></i>
                    <input type="text" id="quizSearch" placeholder="Search quizzes..." oninput="Quizzes.filter()">
                </div>
                <div class="filter-group">
                    <select id="filterQuizStatus" onchange="Quizzes.filter()">
                        <option value="">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="closed">Closed</option>
                        <option value="expired">Expired</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterQuizDepartment" onchange="Quizzes.filter()">
                        <option value="">All Departments</option>
                        <option value="Software Development">Software Development</option>
                        <option value="Graphics & Multimedia">Graphics & Multimedia</option>
                        <option value="Data Analysis">Data Analysis</option>
                        <option value="Digital Marketing">Digital Marketing</option>
                        <option value="Cybersecurity">Cybersecurity</option>
                        <option value="Network & Cloud">Network & Cloud</option>
                        <option value="Digital Skills">Digital Skills</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterQuizProgramme" onchange="Quizzes.filter()">
                        <option value="">All Programmes</option>
                        <option value="BridgeCode 2026">BridgeCode 2026</option>
                        <option value="Digital Skills">Digital Skills</option>
                        <option value="Web Development">Web Development</option>
                        <option value="Data Science">Data Science</option>
                        <option value="Cybersecurity">Cybersecurity</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterQuizFacilitator" onchange="Quizzes.filter()">
                        <option value="">All Facilitators</option>
                        <!-- Will be populated dynamically -->
                    </select>
                </div>
            </div>

            <!-- Quiz Cards Grid -->
            <div class="quiz-grid" id="quizGrid">
                <div class="empty-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <h3>Loading quizzes...</h3>
                </div>
            </div>
        `;
    },

    // ============================================================
    // ADD STYLES
    // ============================================================

    addStyles() {
        if (document.getElementById('quizzesStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'quizzesStyles';
        style.textContent = `
            /* Quiz Grid */
            .quiz-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }

            .quiz-card {
                background: white;
                border-radius: 12px;
                border: 1px solid #e5e7eb;
                overflow: hidden;
                transition: all 0.3s ease;
                position: relative;
            }
            .quiz-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 30px rgba(0,0,0,0.08);
            }

            .quiz-card-header {
                padding: 16px 20px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                background: #f8fafc;
            }
            .quiz-card-header .quiz-title {
                font-size: 16px;
                font-weight: 700;
                color: #1a1f2c;
                margin: 0;
                flex: 1;
            }
            .quiz-card-header .quiz-title a {
                color: #1a1f2c;
                text-decoration: none;
            }
            .quiz-card-header .quiz-title a:hover {
                color: #166534;
            }

            .quiz-card-body {
                padding: 16px 20px;
            }
            .quiz-card-body .quiz-meta {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px 16px;
                font-size: 13px;
                color: #4b5563;
            }
            .quiz-card-body .quiz-meta .meta-item {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .quiz-card-body .quiz-meta .meta-item i {
                color: #6b7280;
                width: 16px;
                font-size: 12px;
            }

            .quiz-card-footer {
                padding: 12px 20px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                background: #fafafa;
            }
            .quiz-card-footer .quiz-actions {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
            }
            .quiz-card-footer .quiz-actions button {
                background: none;
                border: none;
                padding: 4px 8px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s ease;
                color: #6b7280;
                font-family: 'Inter', sans-serif;
            }
            .quiz-card-footer .quiz-actions button:hover {
                background: #f3f4f6;
                color: #1a1f2c;
            }
            .quiz-card-footer .quiz-actions button.preview:hover {
                color: #1d4ed8;
                background: #dbeafe;
            }
            .quiz-card-footer .quiz-actions button.edit:hover {
                color: #166534;
                background: #dcfce7;
            }
            .quiz-card-footer .quiz-actions button.duplicate:hover {
                color: #7c3aed;
                background: #ede9fe;
            }
            .quiz-card-footer .quiz-actions button.results:hover {
                color: #d97706;
                background: #fef3c7;
            }
            .quiz-card-footer .quiz-actions button.delete:hover {
                color: #dc2626;
                background: #fee2e2;
            }
            .quiz-card-footer .quiz-actions button.publish:hover {
                color: #166534;
                background: #dcfce7;
            }

            .quiz-status-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 3px 10px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
            }
            .quiz-status-badge.draft { background: #f3f4f6; color: #6b7280; }
            .quiz-status-badge.published { background: #dcfce7; color: #166534; }
            .quiz-status-badge.scheduled { background: #dbeafe; color: #1d4ed8; }
            .quiz-status-badge.closed { background: #fee2e2; color: #dc2626; }
            .quiz-status-badge.expired { background: #fef3c7; color: #d97706; }

            .quiz-type-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                border-radius: 6px;
                font-size: 10px;
                font-weight: 500;
                background: #e5e7eb;
                color: #4b5563;
            }

            /* Quiz Stats Bar */
            .quiz-stats-bar {
                display: flex;
                gap: 16px;
                padding: 8px 0;
                font-size: 12px;
                color: #6b7280;
                flex-wrap: wrap;
            }
            .quiz-stats-bar .stat-item {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .quiz-stats-bar .stat-item i {
                font-size: 12px;
            }

            /* Question Bank Modal */
            .question-bank-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 12px;
                max-height: 400px;
                overflow-y: auto;
            }
            .question-bank-item {
                background: #f8fafc;
                padding: 12px 16px;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .question-bank-item:hover {
                border-color: #166534;
                background: #f0fdf4;
            }
            .question-bank-item.selected {
                border-color: #166534;
                background: #dcfce7;
            }
            .question-bank-item .q-text {
                font-size: 13px;
                font-weight: 500;
                color: #1a1f2c;
            }
            .question-bank-item .q-meta {
                font-size: 11px;
                color: #6b7280;
                margin-top: 4px;
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            /* Responsive */
            @media (max-width: 1024px) {
                .stats-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
            }

            @media (max-width: 768px) {
                .stats-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                .quiz-grid {
                    grid-template-columns: 1fr;
                }
                .filter-bar {
                    flex-direction: column;
                }
                .filter-group {
                    min-width: 100%;
                }
                .quiz-card-body .quiz-meta {
                    grid-template-columns: 1fr;
                }
                .quiz-card-footer {
                    flex-direction: column;
                    align-items: stretch;
                }
                .quiz-card-footer .quiz-actions {
                    justify-content: center;
                }
                .page-header {
                    flex-direction: column;
                    align-items: flex-start;
                }
                .page-header .header-actions {
                    width: 100%;
                }
                .page-header .header-actions .btn-primary,
                .page-header .header-actions .btn-secondary {
                    flex: 1;
                    justify-content: center;
                }
            }

            @media (max-width: 480px) {
                .stats-grid {
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }
                .stat-card {
                    padding: 12px;
                }
                .stat-card .stat-number {
                    font-size: 18px;
                }
                .quiz-card-header {
                    flex-direction: column;
                    gap: 8px;
                }
                .quiz-card-header .quiz-title {
                    font-size: 14px;
                }
            }
        `;
        document.head.appendChild(style);
    },

    // ============================================================
    // LOAD QUIZZES
    // ============================================================

    async loadQuizzes() {
        try {
            const snapshot = await this.db.collection('quizzes')
                .orderBy('createdAt', 'desc')
                .get();

            this.allQuizzes = [];
            snapshot.forEach(doc => {
                this.allQuizzes.push({ id: doc.id, ...doc.data() });
            });

            this.filteredQuizzes = [...this.allQuizzes];
            this.updateStats();
            this.renderQuizzes();

        } catch (error) {
            console.error('Error loading quizzes:', error);
            document.getElementById('quizGrid').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle" style="color: #dc2626;"></i>
                    <h3>Error Loading Quizzes</h3>
                    <p>${error.message}</p>
                    <button onclick="Quizzes.loadQuizzes()" class="btn-primary" style="margin-top: 12px;">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    },

    // ============================================================
    // UPDATE STATS
    // ============================================================

    updateStats() {
        const total = this.allQuizzes.length;
        const published = this.allQuizzes.filter(q => q.status === 'published').length;
        const draft = this.allQuizzes.filter(q => q.status === 'draft').length;
        const scheduled = this.allQuizzes.filter(q => q.status === 'scheduled').length;
        const expired = this.allQuizzes.filter(q => q.status === 'expired').length;
        
        // Calculate average score from results
        let totalScore = 0;
        let scoreCount = 0;
        this.allQuizzes.forEach(q => {
            if (q.averageScore) {
                totalScore += q.averageScore;
                scoreCount++;
            }
        });
        const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statPublished').textContent = published;
        document.getElementById('statDraft').textContent = draft;
        document.getElementById('statScheduled').textContent = scheduled;
        document.getElementById('statExpired').textContent = expired;
        document.getElementById('statAvgScore').textContent = avgScore + '%';
    },

    // ============================================================
    // RENDER QUIZZES
    // ============================================================

    renderQuizzes() {
        const container = document.getElementById('quizGrid');
        
        if (this.filteredQuizzes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h3>${this.allQuizzes.length === 0 ? 'No quizzes created' : 'No matching quizzes'}</h3>
                    <p>${this.allQuizzes.length === 0 ? 'Click "New Quiz" to get started' : 'Try adjusting your filters'}</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.filteredQuizzes.forEach(quiz => {
            const statusClass = quiz.status || 'draft';
            const statusLabels = {
                draft: 'Draft',
                published: 'Published',
                scheduled: 'Scheduled',
                closed: 'Closed',
                expired: 'Expired'
            };
            const typeLabels = {
                quiz: '📝 Quiz',
                assignment: '📄 Assignment',
                practical: '🔬 Practical',
                coding: '💻 Coding'
            };

            html += `
                <div class="quiz-card">
                    <div class="quiz-card-header">
                        <div>
                            <h4 class="quiz-title">
                                <a href="#" onclick="Quizzes.viewQuiz('${quiz.id}')">${this.escapeHtml(quiz.title || 'Untitled')}</a>
                            </h4>
                            <div style="margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap;">
                                <span class="quiz-status-badge ${statusClass}">${statusLabels[statusClass] || statusClass}</span>
                                <span class="quiz-type-badge">${typeLabels[quiz.type] || quiz.type || 'Quiz'}</span>
                            </div>
                        </div>
                        <div style="font-size: 12px; color: #6b7280; white-space: nowrap;">
                            ${this.formatDate(quiz.createdAt)}
                        </div>
                    </div>

                    <div class="quiz-card-body">
                        <div class="quiz-meta">
                            <div class="meta-item"><i class="fas fa-building"></i> ${this.escapeHtml(quiz.department || 'N/A')}</div>
                            <div class="meta-item"><i class="fas fa-graduation-cap"></i> ${this.escapeHtml(quiz.programme || 'N/A')}</div>
                            <div class="meta-item"><i class="fas fa-book"></i> ${this.escapeHtml(quiz.course || 'N/A')}</div>
                            <div class="meta-item"><i class="fas fa-user"></i> ${this.escapeHtml(quiz.facilitator || 'N/A')}</div>
                            <div class="meta-item"><i class="fas fa-question-circle"></i> ${quiz.questionCount || 0} questions</div>
                            <div class="meta-item"><i class="fas fa-clock"></i> ${quiz.duration || 30} min</div>
                            <div class="meta-item"><i class="fas fa-percent"></i> ${quiz.passingScore || 60}% pass</div>
                            <div class="meta-item"><i class="fas fa-users"></i> ${quiz.participants || 0} participants</div>
                        </div>
                        ${quiz.description ? `<div style="margin-top: 8px; font-size: 13px; color: #4b5563; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${this.escapeHtml(quiz.description)}</div>` : ''}
                    </div>

                    <div class="quiz-card-footer">
                        <div class="quiz-stats-bar">
                            <span class="stat-item"><i class="fas fa-check-circle" style="color: #166534;"></i> ${quiz.completedCount || 0} completed</span>
                            <span class="stat-item"><i class="fas fa-users" style="color: #1d4ed8;"></i> ${quiz.participants || 0} started</span>
                            ${quiz.averageScore ? `<span class="stat-item"><i class="fas fa-chart-line" style="color: #d97706;"></i> ${quiz.averageScore}% avg</span>` : ''}
                        </div>
                        <div class="quiz-actions">
                            <button class="preview" onclick="Quizzes.previewQuiz('${quiz.id}')" title="Preview">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="edit" onclick="Quizzes.openEdit('${quiz.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="duplicate" onclick="Quizzes.duplicateQuiz('${quiz.id}')" title="Duplicate">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="publish" onclick="Quizzes.togglePublish('${quiz.id}')" title="${quiz.status === 'published' ? 'Unpublish' : 'Publish'}">
                                <i class="fas ${quiz.status === 'published' ? 'fa-eye-slash' : 'fa-eye'}"></i>
                            </button>
                            <button class="results" onclick="Quizzes.viewResults('${quiz.id}')" title="Results">
                                <i class="fas fa-chart-bar"></i>
                            </button>
                            <button class="delete" onclick="Quizzes.deleteQuiz('${quiz.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    // ============================================================
    // FILTER
    // ============================================================

    filter() {
        const search = document.getElementById('quizSearch')?.value?.toLowerCase() || '';
        const status = document.getElementById('filterQuizStatus')?.value || '';
        const department = document.getElementById('filterQuizDepartment')?.value || '';
        const programme = document.getElementById('filterQuizProgramme')?.value || '';
        const facilitator = document.getElementById('filterQuizFacilitator')?.value || '';

        this.filteredQuizzes = this.allQuizzes.filter(q => {
            let match = true;
            
            if (search) {
                match = match && (
                    (q.title || '').toLowerCase().includes(search) ||
                    (q.description || '').toLowerCase().includes(search) ||
                    (q.code || '').toLowerCase().includes(search) ||
                    (q.programme || '').toLowerCase().includes(search)
                );
            }
            if (status) match = match && q.status === status;
            if (department) match = match && q.department === department;
            if (programme) match = match && q.programme === programme;
            if (facilitator) match = match && q.facilitator === facilitator;
            
            return match;
        });

        this.renderQuizzes();
    },

    // ============================================================
    // CREATE QUIZ - Complete
    // ============================================================

    openCreate() {
        const content = this.getCreateFormHTML();
        if (typeof App !== 'undefined' && App.openModal) {
            App.openModal('Create New Quiz', content);
            setTimeout(() => {
                this.switchTab('basic');
            }, 100);
        }
    },

    getCreateFormHTML() {
        return `
            <form id="quizForm" onsubmit="Quizzes.saveQuiz(event)">
                <!-- Tabs -->
                <div class="form-tabs">
                    <button type="button" class="tab-btn active" data-tab="basic" onclick="Quizzes.switchTab('basic')">
                        <i class="fas fa-info-circle"></i> Basic
                    </button>
                    <button type="button" class="tab-btn" data-tab="settings" onclick="Quizzes.switchTab('settings')">
                        <i class="fas fa-cog"></i> Settings
                    </button>
                    <button type="button" class="tab-btn" data-tab="questions" onclick="Quizzes.switchTab('questions')">
                        <i class="fas fa-question-circle"></i> Questions
                    </button>
                    <button type="button" class="tab-btn" data-tab="security" onclick="Quizzes.switchTab('security')">
                        <i class="fas fa-shield-alt"></i> Security
                    </button>
                    <button type="button" class="tab-btn" data-tab="scoring" onclick="Quizzes.switchTab('scoring')">
                        <i class="fas fa-percent"></i> Scoring
                    </button>
                </div>

                <!-- Tab 1: Basic Information -->
                <div class="tab-panel active" id="tab-basic">
                    <div class="form-group">
                        <label>Quiz Title <span class="required">*</span></label>
                        <input type="text" id="quizTitle" placeholder="e.g., HTML Fundamentals Quiz" required>
                    </div>
                    <div class="form-group">
                        <label>Quiz Code</label>
                        <input type="text" id="quizCode" placeholder="e.g., HTML-101" oninput="this.value = this.value.toUpperCase()">
                        <div class="help-text">Unique identifier for the quiz</div>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="quizDescription" rows="3" placeholder="Describe the quiz..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Instructions</label>
                        <textarea id="quizInstructions" rows="3" placeholder="Instructions for students..."></textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Department <span class="required">*</span></label>
                            <select id="quizDepartment" required>
                                <option value="">Select Department</option>
                                <option value="Software Development">Software Development</option>
                                <option value="Graphics & Multimedia">Graphics & Multimedia</option>
                                <option value="Data Analysis">Data Analysis</option>
                                <option value="Digital Marketing">Digital Marketing</option>
                                <option value="Cybersecurity">Cybersecurity</option>
                                <option value="Network & Cloud">Network & Cloud</option>
                                <option value="Digital Skills">Digital Skills</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Programme <span class="required">*</span></label>
                            <select id="quizProgramme" required>
                                <option value="">Select Programme</option>
                                <option value="BridgeCode 2026">BridgeCode 2026</option>
                                <option value="Digital Skills">Digital Skills</option>
                                <option value="Web Development">Web Development</option>
                                <option value="Data Science">Data Science</option>
                                <option value="Cybersecurity">Cybersecurity</option>
                                <option value="Software Engineering">Software Engineering</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Course/Module <span class="required">*</span></label>
                            <select id="quizCourse" required>
                                <option value="">Select Course</option>
                                <option value="HTML & CSS">HTML & CSS</option>
                                <option value="JavaScript">JavaScript</option>
                                <option value="Python">Python</option>
                                <option value="Data Analysis">Data Analysis</option>
                                <option value="Photoshop">Photoshop</option>
                                <option value="Robotics">Robotics</option>
                                <option value="Cybersecurity">Cybersecurity</option>
                                <option value="Digital Marketing">Digital Marketing</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Facilitator</label>
                            <input type="text" id="quizFacilitator" placeholder="e.g., John Doe">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Quiz Type</label>
                            <select id="quizType">
                                <option value="quiz">📝 Quiz</option>
                                <option value="assignment">📄 Assignment</option>
                                <option value="practical">🔬 Practical</option>
                                <option value="coding">💻 Coding Challenge</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="quizStatus">
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Tab 2: Settings -->
                <div class="tab-panel" id="tab-settings">
                    <div class="setting-section">
                        <h4><i class="fas fa-clock"></i> Time & Attempts</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Time Limit (minutes)</label>
                                <input type="number" id="quizDuration" placeholder="30" value="30" min="1">
                            </div>
                            <div class="form-group">
                                <label>Passing Score (%)</label>
                                <input type="number" id="quizPassingScore" placeholder="60" value="60" min="0" max="100">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Total Marks</label>
                                <input type="number" id="quizTotalMarks" placeholder="100" value="100" min="1">
                            </div>
                            <div class="form-group">
                                <label>Number of Attempts</label>
                                <input type="number" id="quizAttempts" placeholder="1" value="1" min="1">
                            </div>
                        </div>
                        <div class="checkbox-grid">
                            <label><input type="checkbox" id="quizUnlimitedAttempts"> Unlimited Attempts</label>
                            <label><input type="checkbox" id="quizAutoSubmit" checked> Auto Submit When Time Ends</label>
                            <label><input type="checkbox" id="quizSaveProgress" checked> Save Progress Automatically</label>
                        </div>
                    </div>

                    <div class="setting-section">
                        <h4><i class="fas fa-compass"></i> Navigation</h4>
                        <div class="checkbox-grid">
                            <label><input type="checkbox" id="quizShuffleQuestions"> Shuffle Questions</label>
                            <label><input type="checkbox" id="quizShuffleOptions"> Shuffle Answer Options</label>
                            <label><input type="checkbox" id="quizOnePerPage"> One Question Per Page</label>
                            <label><input type="checkbox" id="quizAllowBack" checked> Allow Back Navigation</label>
                            <label><input type="checkbox" id="quizShowTimer" checked> Show Timer</label>
                            <label><input type="checkbox" id="quizShowProgress" checked> Show Progress Bar</label>
                        </div>
                    </div>

                    <div class="setting-section">
                        <h4><i class="fas fa-calendar-alt"></i> Schedule</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Start Date</label>
                                <input type="datetime-local" id="quizStartDate">
                            </div>
                            <div class="form-group">
                                <label>End Date</label>
                                <input type="datetime-local" id="quizEndDate">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tab 3: Questions -->
                <div class="tab-panel" id="tab-questions">
                    <div class="setting-section">
                        <h4><i class="fas fa-plus-circle"></i> Add Questions</h4>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;">
                            <button type="button" class="btn-secondary btn-sm" onclick="Quizzes.addQuestion()">
                                <i class="fas fa-plus"></i> New Question
                            </button>
                            <button type="button" class="btn-secondary btn-sm" onclick="Quizzes.openQuestionBank()">
                                <i class="fas fa-database"></i> Import from Bank
                            </button>
                            <button type="button" class="btn-secondary btn-sm" onclick="Quizzes.randomSelectQuestions()">
                                <i class="fas fa-random"></i> Random Select
                            </button>
                            <button type="button" class="btn-secondary btn-sm" onclick="Quizzes.clearQuestions()">
                                <i class="fas fa-trash"></i> Clear All
                            </button>
                        </div>
                        <div id="questionList" style="max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px;">
                            <div class="help-text" style="text-align: center; padding: 20px;">
                                <i class="fas fa-question-circle"></i> No questions added yet. Click "New Question" to add.
                            </div>
                        </div>
                        <div class="help-text" style="margin-top: 8px;">
                            <i class="fas fa-info-circle"></i> You can add up to 50 questions per quiz.
                        </div>
                    </div>
                </div>

                <!-- Tab 4: Security -->
                <div class="tab-panel" id="tab-security">
                    <div class="setting-section">
                        <h4><i class="fas fa-lock"></i> Basic Protection</h4>
                        <div class="checkbox-grid">
                            <label><input type="checkbox" id="quizDisableCopy" checked> Disable Copy</label>
                            <label><input type="checkbox" id="quizDisablePaste" checked> Disable Paste</label>
                            <label><input type="checkbox" id="quizDisableRightClick" checked> Disable Right Click</label>
                            <label><input type="checkbox" id="quizDisableSelection" checked> Disable Text Selection</label>
                            <label><input type="checkbox" id="quizDisablePrint"> Disable Printing</label>
                        </div>
                    </div>

                    <div class="setting-section">
                        <h4><i class="fas fa-desktop"></i> Browser Monitoring</h4>
                        <div class="checkbox-grid">
                            <label><input type="checkbox" id="quizMonitorTabs"> Detect Tab Switching</label>
                            <label><input type="checkbox" id="quizMonitorMinimize"> Detect Minimizing</label>
                            <label><input type="checkbox" id="quizMonitorDevTools"> Detect Developer Tools</label>
                            <label><input type="checkbox" id="quizMonitorRefresh"> Detect Refreshing</label>
                            <label><input type="checkbox" id="quizFullScreen"> Force Full Screen Mode</label>
                        </div>
                    </div>

                    <div class="setting-section">
                        <h4><i class="fas fa-exclamation-triangle"></i> Violation Handling</h4>
                        <div class="form-group">
                            <label>Warnings Before Submit</label>
                            <input type="number" id="quizWarnings" placeholder="3" value="3" min="1" max="5">
                            <div class="help-text">Number of warnings before auto-submission</div>
                        </div>
                        <div class="checkbox-grid">
                            <label><input type="checkbox" id="quizLogActivities" checked> Log Suspicious Activities</label>
                        </div>
                    </div>
                </div>

                <!-- Tab 5: Scoring -->
                <div class="tab-panel" id="tab-scoring">
                    <div class="setting-section">
                        <h4><i class="fas fa-check-circle"></i> Scoring Options</h4>
                        <div class="checkbox-grid">
                            <label><input type="checkbox" id="quizAutoMark" checked> Auto Mark Objective Questions</label>
                            <label><input type="checkbox" id="quizManualEssay"> Manual Mark Essays</label>
                            <label><input type="checkbox" id="quizNegativeMarking"> Enable Negative Marking</label>
                            <label><input type="checkbox" id="quizPartialMarks"> Allow Partial Marks</label>
                        </div>
                        <div class="form-group" style="margin-top: 12px;">
                            <label>Negative Marking Value</label>
                            <input type="number" id="quizNegativeValue" placeholder="-0.25" value="-0.25" step="0.25">
                            <div class="help-text">Points deducted for wrong answers</div>
                        </div>
                    </div>

                    <div class="setting-section">
                        <h4><i class="fas fa-trophy"></i> Grade Boundaries</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label>A Grade (%)</label>
                                <input type="number" id="quizGradeA" placeholder="80" value="80" min="0" max="100">
                            </div>
                            <div class="form-group">
                                <label>B Grade (%)</label>
                                <input type="number" id="quizGradeB" placeholder="70" value="70" min="0" max="100">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>C Grade (%)</label>
                                <input type="number" id="quizGradeC" placeholder="60" value="60" min="0" max="100">
                            </div>
                            <div class="form-group">
                                <label>D Grade (%)</label>
                                <input type="number" id="quizGradeD" placeholder="50" value="50" min="0" max="100">
                            </div>
                        </div>
                        <div class="help-text">Students scoring below D grade will fail</div>
                    </div>
                </div>

                <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; margin-top: 12px;">
                    <i class="fas fa-save"></i> Create Quiz
                </button>
            </form>
        `;
    },

    // ============================================================
    // SWITCH TAB
    // ============================================================

    switchTab(tab) {
        document.querySelectorAll('.form-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `tab-${tab}`);
        });
    },

    // ============================================================
    // SAVE QUIZ
    // ============================================================

    async saveQuiz(e) {
        e.preventDefault();
        
        const data = this.collectQuizData();
        
        if (!data.title) {
            if (typeof App !== 'undefined') App.showToast('Please enter a quiz title', true);
            return;
        }

        if (!data.department || !data.programme || !data.course) {
            if (typeof App !== 'undefined') App.showToast('Please fill in all required fields', true);
            return;
        }

        try {
            await this.db.collection('quizzes').add({
                ...data,
                questionCount: this.currentQuestions?.length || 0,
                participants: 0,
                completedCount: 0,
                averageScore: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (typeof App !== 'undefined') {
                App.showToast('Quiz created successfully!');
                App.closeModal();
            }
            
            await this.loadQuizzes();

        } catch (error) {
            console.error('Error creating quiz:', error);
            if (typeof App !== 'undefined') App.showToast('Error creating quiz: ' + error.message, true);
        }
    },

    collectQuizData() {
        return {
            title: document.getElementById('quizTitle')?.value?.trim() || '',
            code: document.getElementById('quizCode')?.value?.trim() || '',
            description: document.getElementById('quizDescription')?.value?.trim() || '',
            instructions: document.getElementById('quizInstructions')?.value?.trim() || '',
            department: document.getElementById('quizDepartment')?.value || '',
            programme: document.getElementById('quizProgramme')?.value || '',
            course: document.getElementById('quizCourse')?.value || '',
            facilitator: document.getElementById('quizFacilitator')?.value?.trim() || '',
            type: document.getElementById('quizType')?.value || 'quiz',
            status: document.getElementById('quizStatus')?.value || 'draft',
            // Settings
            duration: parseInt(document.getElementById('quizDuration')?.value) || 30,
            passingScore: parseInt(document.getElementById('quizPassingScore')?.value) || 60,
            totalMarks: parseInt(document.getElementById('quizTotalMarks')?.value) || 100,
            attempts: parseInt(document.getElementById('quizAttempts')?.value) || 1,
            unlimitedAttempts: document.getElementById('quizUnlimitedAttempts')?.checked || false,
            autoSubmit: document.getElementById('quizAutoSubmit')?.checked !== false,
            saveProgress: document.getElementById('quizSaveProgress')?.checked !== false,
            // Navigation
            shuffleQuestions: document.getElementById('quizShuffleQuestions')?.checked || false,
            shuffleOptions: document.getElementById('quizShuffleOptions')?.checked || false,
            onePerPage: document.getElementById('quizOnePerPage')?.checked || false,
            allowBack: document.getElementById('quizAllowBack')?.checked !== false,
            showTimer: document.getElementById('quizShowTimer')?.checked !== false,
            showProgress: document.getElementById('quizShowProgress')?.checked !== false,
            // Schedule
            startDate: document.getElementById('quizStartDate')?.value || null,
            endDate: document.getElementById('quizEndDate')?.value || null,
            // Security
            antiCheat: {
                disableCopy: document.getElementById('quizDisableCopy')?.checked !== false,
                disablePaste: document.getElementById('quizDisablePaste')?.checked !== false,
                disableRightClick: document.getElementById('quizDisableRightClick')?.checked !== false,
                disableSelection: document.getElementById('quizDisableSelection')?.checked !== false,
                disablePrint: document.getElementById('quizDisablePrint')?.checked || false,
                monitorTabs: document.getElementById('quizMonitorTabs')?.checked || false,
                monitorMinimize: document.getElementById('quizMonitorMinimize')?.checked || false,
                monitorDevTools: document.getElementById('quizMonitorDevTools')?.checked || false,
                monitorRefresh: document.getElementById('quizMonitorRefresh')?.checked || false,
                fullScreen: document.getElementById('quizFullScreen')?.checked || false,
                warnings: parseInt(document.getElementById('quizWarnings')?.value) || 3,
                logActivities: document.getElementById('quizLogActivities')?.checked !== false
            },
            // Scoring
            scoring: {
                autoMark: document.getElementById('quizAutoMark')?.checked !== false,
                manualEssay: document.getElementById('quizManualEssay')?.checked || false,
                negativeMarking: document.getElementById('quizNegativeMarking')?.checked || false,
                partialMarks: document.getElementById('quizPartialMarks')?.checked || false,
                negativeValue: parseFloat(document.getElementById('quizNegativeValue')?.value) || -0.25,
                gradeA: parseInt(document.getElementById('quizGradeA')?.value) || 80,
                gradeB: parseInt(document.getElementById('quizGradeB')?.value) || 70,
                gradeC: parseInt(document.getElementById('quizGradeC')?.value) || 60,
                gradeD: parseInt(document.getElementById('quizGradeD')?.value) || 50
            },
            // Questions (stored as references)
            questions: this.currentQuestions || []
        };
    },

    // ============================================================
    // QUESTION MANAGEMENT
    // ============================================================

    addQuestion() {
        const content = this.getQuestionFormHTML();
        if (typeof App !== 'undefined') {
            App.openModal('Add Question', content);
        }
    },

    getQuestionFormHTML() {
        return `
            <form id="questionForm" onsubmit="Quizzes.saveQuestion(event)">
                <div class="form-group">
                    <label>Question Type <span class="required">*</span></label>
                    <select id="questionType" required>
                        <option value="multiple-choice">Multiple Choice</option>
                        <option value="multiple-select">Multiple Select</option>
                        <option value="true-false">True/False</option>
                        <option value="fill-blank">Fill in the Blank</option>
                        <option value="short-answer">Short Answer</option>
                        <option value="essay">Essay</option>
                        <option value="matching">Matching</option>
                        <option value="ordering">Ordering</option>
                        <option value="image">Image-based Question</option>
                        <option value="file-upload">File Upload</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Question <span class="required">*</span></label>
                    <textarea id="questionText" rows="3" placeholder="Enter your question..." required></textarea>
                </div>

                <div class="form-group">
                    <label>Category</label>
                    <select id="questionCategory">
                        <option value="">Select Category</option>
                        <option value="HTML">HTML</option>
                        <option value="CSS">CSS</option>
                        <option value="JavaScript">JavaScript</option>
                        <option value="Python">Python</option>
                        <option value="Data Analysis">Data Analysis</option>
                        <option value="Photoshop">Photoshop</option>
                        <option value="Robotics">Robotics</option>
                        <option value="Cybersecurity">Cybersecurity</option>
                        <option value="General">General</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Difficulty</label>
                    <select id="questionDifficulty">
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Tags (comma separated)</label>
                    <input type="text" id="questionTags" placeholder="e.g., forms, tables, grid">
                    <div class="help-text">Tags help with organization and filtering</div>
                </div>

                <div class="form-group">
                    <label>Points <span class="required">*</span></label>
                    <input type="number" id="questionPoints" placeholder="10" value="10" required min="1">
                </div>

                <!-- Multiple Choice Options -->
                <div id="optionsContainer" class="setting-section">
                    <h4><i class="fas fa-list"></i> Answer Options</h4>
                    <div id="optionsList">
                        <div class="option-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                            <input type="text" placeholder="Option A" class="option-input" style="flex: 1; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 6px;">
                            <label style="display: flex; align-items: center; gap: 4px; font-size: 12px;">
                                <input type="checkbox" class="option-correct"> Correct
                            </label>
                            <button type="button" onclick="this.parentElement.remove()" style="background: none; border: none; color: #dc2626; cursor: pointer;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <button type="button" class="btn-secondary btn-sm" onclick="Quizzes.addOption()" style="margin-top: 8px;">
                        <i class="fas fa-plus"></i> Add Option
                    </button>
                </div>

                <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; margin-top: 12px;">
                    <i class="fas fa-save"></i> Add Question
                </button>
            </form>
        `;
    },

    addOption() {
        const container = document.getElementById('optionsList');
        const optionCount = container.querySelectorAll('.option-row').length;
        const letter = String.fromCharCode(65 + optionCount);
        
        const row = document.createElement('div');
        row.className = 'option-row';
        row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';
        row.innerHTML = `
            <input type="text" placeholder="Option ${letter}" class="option-input" style="flex: 1; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 6px;">
            <label style="display: flex; align-items: center; gap: 4px; font-size: 12px;">
                <input type="checkbox" class="option-correct"> Correct
            </label>
            <button type="button" onclick="this.parentElement.remove()" style="background: none; border: none; color: #dc2626; cursor: pointer;">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(row);
    },

    saveQuestion(e) {
        e.preventDefault();
        const question = {
            type: document.getElementById('questionType').value,
            text: document.getElementById('questionText').value.trim(),
            category: document.getElementById('questionCategory').value,
            difficulty: document.getElementById('questionDifficulty').value,
            tags: document.getElementById('questionTags').value.split(',').map(t => t.trim()).filter(Boolean),
            points: parseInt(document.getElementById('questionPoints').value) || 10,
            options: []
        };

        // Collect options
        document.querySelectorAll('.option-row').forEach(row => {
            const input = row.querySelector('.option-input');
            const correct = row.querySelector('.option-correct').checked;
            if (input.value.trim()) {
                question.options.push({
                    text: input.value.trim(),
                    correct: correct
                });
            }
        });

        if (!this.currentQuestions) this.currentQuestions = [];
        this.currentQuestions.push(question);

        if (typeof App !== 'undefined') {
            App.showToast('Question added successfully!');
            App.closeModal();
            this.updateQuestionList();
        }
    },

    updateQuestionList() {
        const container = document.getElementById('questionList');
        if (!container) return;

        if (!this.currentQuestions || this.currentQuestions.length === 0) {
            container.innerHTML = `
                <div class="help-text" style="text-align: center; padding: 20px;">
                    <i class="fas fa-question-circle"></i> No questions added yet.
                </div>
            `;
            return;
        }

        let html = '';
        this.currentQuestions.forEach((q, index) => {
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f3f4f6; gap: 8px;">
                    <div style="flex: 1; font-size: 13px;">
                        <span style="font-weight: 500;">Q${index + 1}.</span> ${this.escapeHtml(q.text.substring(0, 60))}${q.text.length > 60 ? '...' : ''}
                        <span style="font-size: 11px; color: #6b7280; margin-left: 8px;">
                            (${q.type}, ${q.points} pts)
                        </span>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button type="button" onclick="Quizzes.editQuestion(${index})" style="background: none; border: none; color: #166534; cursor: pointer; padding: 4px 6px; border-radius: 4px;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" onclick="Quizzes.removeQuestion(${index})" style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 4px 6px; border-radius: 4px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    removeQuestion(index) {
        if (confirm('Remove this question?')) {
            this.currentQuestions.splice(index, 1);
            this.updateQuestionList();
        }
    },

    editQuestion(index) {
        // TODO: Implement edit functionality
        if (typeof App !== 'undefined') {
            App.showToast('Edit functionality coming soon!');
        }
    },

    clearQuestions() {
        if (confirm('Remove all questions?')) {
            this.currentQuestions = [];
            this.updateQuestionList();
        }
    },

    openQuestionBank() {
        // TODO: Implement question bank modal
        if (typeof App !== 'undefined') {
            App.showToast('Question Bank coming soon!');
        }
    },

    randomSelectQuestions() {
        // TODO: Implement random selection
        if (typeof App !== 'undefined') {
            App.showToast('Random selection coming soon!');
        }
    },

    // ============================================================
    // PREVIEW QUIZ
    // ============================================================

    previewQuiz(id) {
        const quiz = this.allQuizzes.find(q => q.id === id);
        if (!quiz) {
            if (typeof App !== 'undefined') App.showToast('Quiz not found', true);
            return;
        }

        // Open preview in new tab or modal
        if (typeof App !== 'undefined') {
            App.showToast('Preview mode - showing student view');
            // In production, this would open the student view
        }
    },

    // ============================================================
    // TOGGLE PUBLISH
    // ============================================================

    async togglePublish(id) {
        const quiz = this.allQuizzes.find(q => q.id === id);
        if (!quiz) return;

        const newStatus = quiz.status === 'published' ? 'draft' : 'published';
        const action = newStatus === 'published' ? 'publish' : 'unpublish';

        if (!confirm(`Are you sure you want to ${action} this quiz?`)) return;

        try {
            await this.db.collection('quizzes').doc(id).update({
                status: newStatus,
                publishedAt: newStatus === 'published' ? firebase.firestore.FieldValue.serverTimestamp() : null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (typeof App !== 'undefined') {
                App.showToast(`Quiz ${action}ed successfully!`);
            }
            
            await this.loadQuizzes();

        } catch (error) {
            console.error('Error toggling publish:', error);
            if (typeof App !== 'undefined') {
                App.showToast('Error updating quiz status: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // VIEW RESULTS
    // ============================================================

    viewResults(id) {
        if (typeof App !== 'undefined') {
            App.showToast('Results analytics coming soon!');
        }
    },

    // ============================================================
    // DUPLICATE QUIZ
    // ============================================================

    async duplicateQuiz(id) {
        try {
            const doc = await this.db.collection('quizzes').doc(id).get();
            if (!doc.exists) {
                if (typeof App !== 'undefined') App.showToast('Quiz not found', true);
                return;
            }

            const data = doc.data();
            delete data.createdAt;
            delete data.updatedAt;
            delete data.participants;
            delete data.completedCount;
            delete data.averageScore;

            data.title = data.title + ' (Copy)';
            data.status = 'draft';

            await this.db.collection('quizzes').add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (typeof App !== 'undefined') {
                App.showToast('Quiz duplicated successfully!');
            }
            
            await this.loadQuizzes();

        } catch (error) {
            console.error('Error duplicating quiz:', error);
            if (typeof App !== 'undefined') {
                App.showToast('Error duplicating quiz: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // DELETE QUIZ
    // ============================================================

    async deleteQuiz(id) {
        if (!confirm('Are you sure you want to delete this quiz? This will also delete all results and activity logs. This action cannot be undone.')) {
            return;
        }

        try {
            // Delete all results for this quiz
            const resultsSnap = await this.db.collection('studentResults')
                .where('quizId', '==', id)
                .get();
            
            const batch = this.db.batch();
            resultsSnap.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete activity logs
            const logsSnap = await this.db.collection('activityLogs')
                .where('quizId', '==', id)
                .get();
            
            logsSnap.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete the quiz
            batch.delete(this.db.collection('quizzes').doc(id));
            await batch.commit();

            if (typeof App !== 'undefined') {
                App.showToast('Quiz deleted successfully');
            }
            
            await this.loadQuizzes();

        } catch (error) {
            console.error('Error deleting quiz:', error);
            if (typeof App !== 'undefined') {
                App.showToast('Error deleting quiz: ' + error.message, true);
            }
        }
    },

    viewQuiz(id) {
        const quiz = this.allQuizzes.find(q => q.id === id);
        if (!quiz) {
            if (typeof App !== 'undefined') App.showToast('Quiz not found', true);
            return;
        }

        // Show quiz details modal
        const content = this.buildQuizDetailsHTML(quiz);
        if (typeof App !== 'undefined') {
            App.openModal('Quiz Details', content);
        }
    },

    buildQuizDetailsHTML(quiz) {
        const statusLabels = {
            draft: 'Draft',
            published: 'Published',
            scheduled: 'Scheduled',
            closed: 'Closed',
            expired: 'Expired'
        };
        const typeLabels = {
            quiz: '📝 Quiz',
            assignment: '📄 Assignment',
            practical: '🔬 Practical',
            coding: '💻 Coding'
        };

        return `
            <div style="padding: 4px 0;">
                <h3 style="font-size: 20px; margin-bottom: 8px;">${this.escapeHtml(quiz.title)}</h3>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
                    <span class="quiz-status-badge ${quiz.status || 'draft'}">${statusLabels[quiz.status] || 'Draft'}</span>
                    <span class="quiz-type-badge">${typeLabels[quiz.type] || quiz.type || 'Quiz'}</span>
                    ${quiz.code ? `<span class="quiz-type-badge">Code: ${this.escapeHtml(quiz.code)}</span>` : ''}
                </div>

                ${quiz.description ? `<p style="color: #4b5563; margin-bottom: 12px;">${this.escapeHtml(quiz.description)}</p>` : ''}

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; padding: 16px; background: #f8fafc; border-radius: 8px;">
                    <div><strong>Department:</strong> ${this.escapeHtml(quiz.department || 'N/A')}</div>
                    <div><strong>Programme:</strong> ${this.escapeHtml(quiz.programme || 'N/A')}</div>
                    <div><strong>Course:</strong> ${this.escapeHtml(quiz.course || 'N/A')}</div>
                    <div><strong>Facilitator:</strong> ${this.escapeHtml(quiz.facilitator || 'N/A')}</div>
                    <div><strong>Duration:</strong> ${quiz.duration || 30} min</div>
                    <div><strong>Passing Score:</strong> ${quiz.passingScore || 60}%</div>
                    <div><strong>Total Marks:</strong> ${quiz.totalMarks || 100}</div>
                    <div><strong>Questions:</strong> ${quiz.questionCount || 0}</div>
                    <div><strong>Participants:</strong> ${quiz.participants || 0}</div>
                    <div><strong>Completed:</strong> ${quiz.completedCount || 0}</div>
                    <div><strong>Average Score:</strong> ${quiz.averageScore || 0}%</div>
                    <div><strong>Created:</strong> ${this.formatDate(quiz.createdAt)}</div>
                </div>

                ${quiz.instructions ? `
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                        <strong>Instructions:</strong>
                        <p style="margin-top: 4px; color: #4b5563; font-size: 14px;">${this.escapeHtml(quiz.instructions)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // ============================================================
    // OPEN EDIT
    // ============================================================

    async openEdit(id) {
        try {
            const doc = await this.db.collection('quizzes').doc(id).get();
            if (!doc.exists) {
                if (typeof App !== 'undefined') App.showToast('Quiz not found', true);
                return;
            }

            const data = doc.data();
            this.currentQuiz = { id: doc.id, ...data };
            this.currentQuestions = data.questions || [];

            // Load edit form with data
            const content = this.getEditFormHTML(data);
            if (typeof App !== 'undefined') {
                App.openModal('Edit Quiz', content);
                setTimeout(() => {
                    this.switchTab('basic');
                    this.updateQuestionList();
                }, 100);
            }

        } catch (error) {
            console.error('Error loading quiz:', error);
            if (typeof App !== 'undefined') {
                App.showToast('Error loading quiz: ' + error.message, true);
            }
        }
    },

    getEditFormHTML(data) {
        // Similar to create form but with values filled in
        // For brevity, we'll use the same form but with data pre-filled
        // In production, you'd build this with all the values
        return this.getCreateFormHTML(); // Simplified - would need to populate fields
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
    }
};

// ============================================================
// EXPORT FOR GLOBAL ACCESS
// ============================================================

window.Quizzes = Quizzes;