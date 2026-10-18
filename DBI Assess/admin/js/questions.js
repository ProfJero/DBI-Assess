// ============================================================
// ADMIN QUESTIONS - COMPLETE QUESTION BANK MANAGEMENT
// ============================================================

const Questions = {
    app: null,
    db: null,
    currentQuestion: null,
    currentTab: 'basic',
    allQuestions: [],
    filteredQuestions: [],
    selectedQuestions: [],
    currentPage: 1,
    itemsPerPage: 20,
    assessments: [],
    selectedAssessmentId: null,
    tags: [],
    questionBatch: [],
    currentBatchIndex: 0,
    defaultCategory: 'General',
    defaultDifficulty: 'medium',
    defaultPoints: 1,
    questionCount: 1,
    currentView: 'table',
    isReuseMode: false,
    selectedAssessmentForReuse: null,
    _reuseQuestions: [],

    // ============================================================
    // RENDER - Main entry point
    // ============================================================

    render(container, app) {
        this.app = app;
        this.db = app.db || app;
        
        container.innerHTML = this.getHTML();
        this.addStyles();
        
        setTimeout(() => {
            this.loadAssessments();
            this.loadQuestions();
        }, 100);
    },

    // ============================================================
    // GET HTML
    // ============================================================

    getHTML() {
        return `
            <!-- Stats Cards -->
            <div class="stats-grid" id="questionStats">
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="fas fa-question-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statTotal">0</div>
                        <div class="stat-label">Total Questions</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statEasy">0</div>
                        <div class="stat-label">Easy</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statMedium">0</div>
                        <div class="stat-label">Medium</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red"><i class="fas fa-bolt"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statHard">0</div>
                        <div class="stat-label">Hard</div>
                    </div>
                </div>
            </div>

            <!-- Action Bar -->
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
                <button class="btn-primary" onclick="window.Questions.openCreate()" id="newQuestionBtn">
                    <i class="fas fa-plus"></i> <span class="btn-text">New Question</span>
                    <span class="spinner"></span>
                </button>
                <button class="btn-secondary" onclick="window.Questions.openReuseModal()" id="reuseQuestionBtn">
                    <i class="fas fa-copy"></i> <span class="btn-text">Reuse Questions</span>
                    <span class="spinner"></span>
                </button>
                <button class="btn-secondary" onclick="window.Questions.openReuseAssessmentModal()" id="reuseAssessmentBtn">
                    <i class="fas fa-clone"></i> <span class="btn-text">Reuse Assessment</span>
                    <span class="spinner"></span>
                </button>
            </div>

            <!-- Filter Bar -->
            <div class="filter-bar">
                <div class="filter-group search-group">
                    <i class="fas fa-search"></i>
                    <input type="text" id="questionSearch" placeholder="Search questions by text, tags..." oninput="window.Questions.debounceFilter()">
                </div>
                <div class="filter-group">
                    <select id="filterAssessment" onchange="window.Questions.filter()">
                        <option value="">All Assessments</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterCategory" onchange="window.Questions.filter()">
                        <option value="">All Categories</option>
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
                <div class="filter-group">
                    <select id="filterDifficulty" onchange="window.Questions.filter()">
                        <option value="">All Difficulty</option>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterQuestionType" onchange="window.Questions.filter()">
                        <option value="">All Types</option>
                        <option value="multiple-choice">Multiple Choice</option>
                        <option value="multiple-select">Multiple Select</option>
                        <option value="true-false">True/False</option>
                        <option value="fill-blank">Fill in the Blank</option>
                        <option value="short-answer">Short Answer</option>
                        <option value="essay">Essay</option>
                        <option value="matching">Matching</option>
                        <option value="ordering">Ordering</option>
                        <option value="image">Image-based</option>
                        <option value="file-upload">File Upload</option>
                        <option value="code">Code Question</option>
                    </select>
                </div>
                <div class="filter-group">
                    <input type="text" id="filterTags" placeholder="Filter by tags..." oninput="window.Questions.filter()">
                </div>
            </div>

            <!-- Bulk Actions Bar -->
            <div class="bulk-actions-bar" id="bulkActionsBar" style="display: none;">
                <span id="selectedCount">0 questions selected</span>
                <div class="bulk-actions">
                    <button class="btn-secondary btn-sm" onclick="window.Questions.bulkDelete()" id="bulkDeleteBtn">
                        <i class="fas fa-trash"></i> <span class="btn-text">Delete</span>
                        <span class="spinner"></span>
                    </button>
                    <button class="btn-secondary btn-sm" onclick="window.Questions.bulkExport()" id="bulkExportBtn">
                        <i class="fas fa-download"></i> <span class="btn-text">Export</span>
                        <span class="spinner"></span>
                    </button>
                    <button class="btn-secondary btn-sm" onclick="window.Questions.bulkChangeCategory()" id="bulkCategoryBtn">
                        <i class="fas fa-tag"></i> <span class="btn-text">Change Category</span>
                        <span class="spinner"></span>
                    </button>
                    <button class="btn-secondary btn-sm" onclick="window.Questions.bulkChangeDifficulty()" id="bulkDifficultyBtn">
                        <i class="fas fa-signal"></i> <span class="btn-text">Change Difficulty</span>
                        <span class="spinner"></span>
                    </button>
                    <button class="btn-secondary btn-sm" onclick="window.Questions.bulkChangeAssessment()" id="bulkAssessmentBtn">
                        <i class="fas fa-file-alt"></i> <span class="btn-text">Change Assessment</span>
                        <span class="spinner"></span>
                    </button>
                    <button class="btn-secondary btn-sm" onclick="window.Questions.bulkAddFeedback()" id="bulkFeedbackBtn">
                        <i class="fas fa-comment"></i> <span class="btn-text">Add Feedback</span>
                        <span class="spinner"></span>
                    </button>
                    <button class="btn-secondary btn-sm" onclick="window.Questions.clearSelection()">
                        <i class="fas fa-times"></i> Clear
                    </button>
                </div>
            </div>

            <!-- Questions Table -->
            <div class="table-container">
                <div class="table-header">
                    <span>Question Bank</span>
                    <span class="table-count" id="questionCount">0 items</span>
                    <div class="view-options">
                        <button class="view-btn active" data-view="table" onclick="window.Questions.setView('table')" id="tableViewBtn">
                            <i class="fas fa-table"></i>
                        </button>
                        <button class="view-btn" data-view="grid" onclick="window.Questions.setView('grid')" id="gridViewBtn">
                            <i class="fas fa-th-large"></i>
                        </button>
                    </div>
                </div>
                <div class="table-scroll" id="questionsContainer">
                    <table id="questionsTable">
                        <thead>
                            <tr>
                                <th style="width: 36px;">
                                    <input type="checkbox" id="selectAll" onchange="window.Questions.toggleSelectAll()">
                                </th>
                                <th>Question</th>
                                <th>Assessment</th>
                                <th>Type</th>
                                <th>Category</th>
                                <th>Difficulty</th>
                                <th>Tags</th>
                                <th>Points</th>
                                <th>Feedback</th>
                                <th style="width: 120px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="questionsBody">
                            <tr>
                                <td colspan="10">
                                    <div class="empty-state">
                                        <i class="fas fa-spinner fa-spin"></i>
                                        <h3>Loading questions...</h3>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div id="questionsGridView" style="display: none;"></div>
                </div>
                <div class="table-footer" id="paginationControls">
                    <div class="pagination-info">
                        Showing <span id="pageStart">0</span> - <span id="pageEnd">0</span> of <span id="totalItems">0</span>
                    </div>
                    <div class="pagination-buttons">
                        <button class="btn-secondary btn-sm" onclick="window.Questions.prevPage()" id="prevPageBtn" disabled>
                            <i class="fas fa-chevron-left"></i> <span class="btn-text">Prev</span>
                            <span class="spinner"></span>
                        </button>
                        <span id="pageInfo">Page 1 of 1</span>
                        <button class="btn-secondary btn-sm" onclick="window.Questions.nextPage()" id="nextPageBtn" disabled>
                            <span class="btn-text">Next</span> <i class="fas fa-chevron-right"></i>
                            <span class="spinner"></span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Category Tags Quick View -->
            <div class="category-quick-view">
                <h4><i class="fas fa-tags"></i> Quick Filter by Category</h4>
                <div class="category-tags" id="categoryTags">
                    <button class="category-tag active" onclick="window.Questions.filterByCategory('')">All</button>
                    <button class="category-tag" onclick="window.Questions.filterByCategory('HTML')">HTML</button>
                    <button class="category-tag" onclick="window.Questions.filterByCategory('CSS')">CSS</button>
                    <button class="category-tag" onclick="window.Questions.filterByCategory('JavaScript')">JavaScript</button>
                    <button class="category-tag" onclick="window.Questions.filterByCategory('Python')">Python</button>
                    <button class="category-tag" onclick="window.Questions.filterByCategory('Data Analysis')">Data Analysis</button>
                    <button class="category-tag" onclick="window.Questions.filterByCategory('Photoshop')">Photoshop</button>
                    <button class="category-tag" onclick="window.Questions.filterByCategory('Robotics')">Robotics</button>
                    <button class="category-tag" onclick="window.Questions.filterByCategory('Cybersecurity')">Cybersecurity</button>
                    <button class="category-tag" onclick="window.Questions.filterByCategory('General')">General</button>
                </div>
            </div>
        `;
    },

    // ============================================================
    // SET LOADING STATE
    // ============================================================

    setLoading(element, isLoading) {
        if (!element) return;
        if (isLoading) {
            element.classList.add('loading');
            element.disabled = true;
        } else {
            element.classList.remove('loading');
            element.disabled = false;
        }
    },

    // ============================================================
    // ADD STYLES
    // ============================================================

    addStyles() {
        if (document.getElementById('questionsStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'questionsStyles';
        style.textContent = `
            .feedback-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 500;
                background: #dbeafe;
                color: #1d4ed8;
            }
            .feedback-badge.has-feedback {
                background: #dcfce7;
                color: #166534;
            }
            .feedback-badge.no-feedback {
                background: #fef3c7;
                color: #d97706;
            }
            .modal-body-inner {
                padding: 22px;
            }
            .modal-footer {
                padding: 16px 22px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                background: #fafafa;
                border-radius: 0 0 18px 18px;
            }
            .modal-body-inner .form-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 20px;
                padding-top: 16px;
                border-top: 1px solid #e5e7eb;
            }
        `;
        document.head.appendChild(style);
    },

    // ============================================================
    // LOAD ASSESSMENTS
    // ============================================================

    async loadAssessments() {
        try {
            const snapshot = await this.db.collection('assessments')
                .orderBy('title', 'asc')
                .get();
            
            this.assessments = [];
            const select = document.getElementById('filterAssessment');
            
            if (select) {
                while (select.options.length > 1) {
                    select.remove(1);
                }
            }
            
            snapshot.forEach(doc => {
                const data = doc.data();
                this.assessments.push({ id: doc.id, ...data });
                if (select) {
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = data.title || 'Untitled Assessment';
                    select.appendChild(option);
                }
            });
            
            if (select) {
                const option = document.createElement('option');
                option.value = 'unlinked';
                option.textContent = 'Unlinked Questions';
                select.appendChild(option);
            }
            
        } catch (error) {
            console.error('Error loading assessments:', error);
        }
    },

    // ============================================================
    // LOAD QUESTIONS
    // ============================================================

    async loadQuestions() {
        try {
            const snapshot = await this.db.collection('questions')
                .orderBy('createdAt', 'desc')
                .get();

            this.allQuestions = [];
            snapshot.forEach(doc => {
                this.allQuestions.push({ id: doc.id, ...doc.data() });
            });

            this.filteredQuestions = [...this.allQuestions];
            this.updateStats();
            this.renderTable();

        } catch (error) {
            console.error('Error loading questions:', error);
            const container = document.getElementById('questionsBody');
            if (container) {
                container.innerHTML = `
                    <tr>
                        <td colspan="10">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-circle" style="color: #dc2626; font-size: 32px;"></i>
                                <h3>Error Loading Questions</h3>
                                <p>${this.escapeHtml(error.message)}</p>
                                <button onclick="window.Questions.loadQuestions()" class="btn-primary" style="margin-top: 12px; display: inline-flex; width: auto; padding: 8px 20px;">
                                    <i class="fas fa-redo"></i> <span class="btn-text">Retry</span>
                                    <span class="spinner"></span>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    },

    // ============================================================
    // UPDATE STATS
    // ============================================================

    updateStats() {
        const total = this.allQuestions.length;
        const easy = this.allQuestions.filter(q => q.difficulty === 'easy').length;
        const medium = this.allQuestions.filter(q => q.difficulty === 'medium').length;
        const hard = this.allQuestions.filter(q => q.difficulty === 'hard').length;

        const statTotal = document.getElementById('statTotal');
        const statEasy = document.getElementById('statEasy');
        const statMedium = document.getElementById('statMedium');
        const statHard = document.getElementById('statHard');

        if (statTotal) statTotal.textContent = total;
        if (statEasy) statEasy.textContent = easy;
        if (statMedium) statMedium.textContent = medium;
        if (statHard) statHard.textContent = hard;
    },

    // ============================================================
    // RENDER TABLE
    // ============================================================

    renderTable() {
        const container = document.getElementById('questionsBody');
        const gridContainer = document.getElementById('questionsGridView');
        const countEl = document.getElementById('questionCount');
        const currentView = this.currentView || 'table';
        
        if (!container) return;

        const totalItems = this.filteredQuestions.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / this.itemsPerPage));
        
        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }
        
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = Math.min(start + this.itemsPerPage, totalItems);
        const pageItems = this.filteredQuestions.slice(start, end);

        if (countEl) {
            countEl.textContent = `${totalItems} items`;
        }

        this.updatePagination(totalItems, totalPages, start, end);

        if (pageItems.length === 0) {
            const emptyHtml = `
                <tr>
                    <td colspan="10">
                        <div class="empty-state">
                            <i class="fas fa-${this.allQuestions.length === 0 ? 'question-circle' : 'search'}" style="font-size: 40px; color: #d1d5db;"></i>
                            <h3>${this.allQuestions.length === 0 ? 'No questions in the bank' : 'No matching questions'}</h3>
                            <p>${this.allQuestions.length === 0 ? 'Click "New Question" to add your first question' : 'Try adjusting your filters'}</p>
                        </div>
                    </td>
                </tr>
            `;
            container.innerHTML = emptyHtml;
            if (gridContainer) gridContainer.innerHTML = emptyHtml;
            return;
        }

        if (currentView === 'grid') {
            this.renderGridView(pageItems);
            container.innerHTML = '';
        } else {
            this.renderTableView(pageItems);
            if (gridContainer) gridContainer.innerHTML = '';
        }
    },

    renderTableView(pageItems) {
        const container = document.getElementById('questionsBody');
        if (!container) return;

        const typeLabels = this.getTypeLabels();
        const typeClasses = this.getTypeClasses();
        const assessmentMap = this.getAssessmentMap();

        let html = '';
        pageItems.forEach((q) => {
            const isSelected = this.selectedQuestions.includes(q.id);
            const questionText = q.text || 'Untitled';
            const truncatedText = questionText.length > 60 ? questionText.substring(0, 60) + '...' : questionText;
            const assessmentTitle = assessmentMap[q.assessmentId] || 'Unlinked';
            
            const hasFeedback = q.feedback && q.feedback.length > 0;
            const feedbackCount = q.feedback ? q.feedback.length : 0;
            
            html += `
                <tr>
                    <td>
                        <input type="checkbox" class="question-select" data-id="${q.id}" ${isSelected ? 'checked' : ''} onchange="window.Questions.toggleSelect('${q.id}')">
                    </td>
                    <td>
                        <div class="question-text" title="${this.escapeHtml(questionText)}">
                            ${this.escapeHtml(truncatedText)}
                        </div>
                    </td>
                    <td>
                        <span class="badge-assessment" title="${this.escapeHtml(assessmentTitle)}">
                            <i class="fas fa-file-alt"></i>
                            ${this.escapeHtml(assessmentTitle)}
                        </span>
                    </td>
                    <td><span class="badge-type ${typeClasses[q.type] || ''}">${typeLabels[q.type] || q.type || 'Unknown'}</span></td>
                    <td>${this.escapeHtml(q.category || 'Uncategorized')}</td>
                    <td><span class="badge-difficulty ${q.difficulty || 'easy'}">${(q.difficulty || 'Easy').charAt(0).toUpperCase() + (q.difficulty || 'easy').slice(1)}</span></td>
                    <td>
                        <div class="tags-display" style="display:flex;flex-wrap:wrap;gap:4px;">
                            ${(q.tags || []).slice(0, 3).map(t => `<span class="tag-item">${this.escapeHtml(t)}</span>`).join('')}
                            ${(q.tags || []).length > 3 ? `<span class="tag-item">+${(q.tags || []).length - 3}</span>` : ''}
                            ${(q.tags || []).length === 0 ? '<span style="color: #9ca3af; font-size: 11px;">No tags</span>' : ''}
                        </div>
                    </td>
                    <td>${q.points || 10}</td>
                    <td>
                        <span class="feedback-badge ${hasFeedback ? 'has-feedback' : 'no-feedback'}">
                            <i class="fas ${hasFeedback ? 'fa-comment' : 'fa-comment-slash'}"></i>
                            ${hasFeedback ? feedbackCount : 'None'}
                        </span>
                    </td>
                    <td>
                        <div class="action-btns">
                            <button class="edit" onclick="window.Questions.openEdit('${q.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                                <span class="spinner"></span>
                            </button>
                            <button class="duplicate" onclick="window.Questions.duplicateQuestion('${q.id}')" title="Duplicate">
                                <i class="fas fa-copy"></i>
                                <span class="spinner"></span>
                            </button>
                            <button class="delete" onclick="window.Questions.deleteQuestion('${q.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                                <span class="spinner"></span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = html;
        this.updateBulkActions();
    },

    renderGridView(pageItems) {
        const container = document.getElementById('questionsGridView');
        if (!container) return;

        const typeLabels = this.getTypeLabels();
        const assessmentMap = this.getAssessmentMap();

        let html = '<div class="grid-view" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;padding:16px;">';
        
        pageItems.forEach((q) => {
            const isSelected = this.selectedQuestions.includes(q.id);
            const questionText = q.text || 'Untitled';
            const assessmentTitle = assessmentMap[q.assessmentId] || 'Unlinked';
            const hasFeedback = q.feedback && q.feedback.length > 0;
            
            html += `
                <div class="grid-card" style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:16px;transition:all 0.3s ease;${isSelected ? 'border-color:#166534;background:#f0fdf4;' : ''}">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
                        <input type="checkbox" class="question-select" data-id="${q.id}" ${isSelected ? 'checked' : ''} onchange="window.Questions.toggleSelect('${q.id}')">
                        <span class="badge-difficulty ${q.difficulty || 'easy'}">${(q.difficulty || 'Easy').charAt(0).toUpperCase() + (q.difficulty || 'easy').slice(1)}</span>
                    </div>
                    <div style="font-weight:500;font-size:14px;color:#1a1f2c;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px;">
                        ${this.escapeHtml(questionText)}
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
                        <span class="badge-type ${this.getTypeClasses()[q.type] || ''}">${typeLabels[q.type] || q.type || 'Unknown'}</span>
                        <span class="badge-assessment">
                            <i class="fas fa-file-alt"></i>
                            ${this.escapeHtml(assessmentTitle)}
                        </span>
                        <span style="font-size:12px;color:#6b7280;background:#f3f4f6;padding:2px 8px;border-radius:4px;">${q.points || 10} pts</span>
                        <span class="feedback-badge ${hasFeedback ? 'has-feedback' : 'no-feedback'}" style="font-size:10px;">
                            <i class="fas ${hasFeedback ? 'fa-comment' : 'fa-comment-slash'}"></i>
                            ${hasFeedback ? 'Has Feedback' : 'No Feedback'}
                        </span>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
                        ${(q.tags || []).slice(0, 3).map(t => `<span class="tag-item">${this.escapeHtml(t)}</span>`).join('')}
                        ${(q.tags || []).length > 3 ? `<span class="tag-item">+${(q.tags || []).length - 3}</span>` : ''}
                    </div>
                    <div style="display:flex;gap:4px;justify-content:flex-end;border-top:1px solid #f3f4f6;padding-top:8px;">
                        <button class="edit" onclick="window.Questions.openEdit('${q.id}')" style="background:none;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;color:#6b7280;font-size:13px;position:relative;min-width:32px;min-height:32px;display:inline-flex;align-items:center;justify-content:center;" title="Edit">
                            <i class="fas fa-edit"></i>
                            <span class="spinner" style="width:14px;height:14px;border:2px solid #e5e7eb;border-top-color:#166534;border-radius:50%;animation:spin 0.6s linear infinite;display:none;"></span>
                        </button>
                        <button class="duplicate" onclick="window.Questions.duplicateQuestion('${q.id}')" style="background:none;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;color:#6b7280;font-size:13px;position:relative;min-width:32px;min-height:32px;display:inline-flex;align-items:center;justify-content:center;" title="Duplicate">
                            <i class="fas fa-copy"></i>
                            <span class="spinner" style="width:14px;height:14px;border:2px solid #e5e7eb;border-top-color:#7c3aed;border-radius:50%;animation:spin 0.6s linear infinite;display:none;"></span>
                        </button>
                        <button class="delete" onclick="window.Questions.deleteQuestion('${q.id}')" style="background:none;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;color:#6b7280;font-size:13px;position:relative;min-width:32px;min-height:32px;display:inline-flex;align-items:center;justify-content:center;" title="Delete">
                            <i class="fas fa-trash"></i>
                            <span class="spinner" style="width:14px;height:14px;border:2px solid #e5e7eb;border-top-color:#dc2626;border-radius:50%;animation:spin 0.6s linear infinite;display:none;"></span>
                        </button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
        this.updateBulkActions();
    },

    getAssessmentMap() {
        const map = {};
        this.assessments.forEach(a => {
            map[a.id] = a.title || 'Untitled Assessment';
        });
        return map;
    },

    getTypeLabels() {
        return {
            'multiple-choice': 'Multiple Choice',
            'multiple-select': 'Multiple Select',
            'true-false': 'True/False',
            'fill-blank': 'Fill in Blank',
            'short-answer': 'Short Answer',
            'essay': 'Essay',
            'matching': 'Matching',
            'ordering': 'Ordering',
            'image': 'Image-based',
            'file-upload': 'File Upload',
            'code': 'Code Question'
        };
    },

    getTypeClasses() {
        return {
            'multiple-choice': 'multiple-choice',
            'multiple-select': 'multiple-select',
            'true-false': 'true-false',
            'fill-blank': 'fill-blank',
            'short-answer': 'short-answer',
            'essay': 'essay',
            'matching': 'matching',
            'ordering': 'ordering',
            'image': 'image',
            'file-upload': 'file-upload',
            'code': 'code'
        };
    },

    // ============================================================
    // VIEW TOGGLE
    // ============================================================

    setView(view) {
        this.currentView = view;
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        const table = document.getElementById('questionsTable');
        const grid = document.getElementById('questionsGridView');
        
        if (view === 'grid') {
            table.style.display = 'none';
            grid.style.display = 'block';
        } else {
            table.style.display = '';
            grid.style.display = 'none';
        }
        
        this.renderTable();
    },

    // ============================================================
    // PAGINATION
    // ============================================================

    updatePagination(totalItems, totalPages, start, end) {
        const pageStart = document.getElementById('pageStart');
        const pageEnd = document.getElementById('pageEnd');
        const totalItemsEl = document.getElementById('totalItems');
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');

        if (pageStart) pageStart.textContent = totalItems > 0 ? start + 1 : 0;
        if (pageEnd) pageEnd.textContent = end;
        if (totalItemsEl) totalItemsEl.textContent = totalItems;
        if (pageInfo) pageInfo.textContent = `Page ${this.currentPage} of ${totalPages || 1}`;
        
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
    },

    nextPage() {
        const totalPages = Math.ceil(this.filteredQuestions.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderTable();
        }
    },

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTable();
        }
    },

    // ============================================================
    // DEBOUNCE FILTER
    // ============================================================

    debounceFilter() {
        clearTimeout(this._filterTimeout);
        this._filterTimeout = setTimeout(() => this.filter(), 300);
    },

    // ============================================================
    // FILTER
    // ============================================================

    filter() {
        const search = document.getElementById('questionSearch')?.value?.toLowerCase() || '';
        const assessmentId = document.getElementById('filterAssessment')?.value || '';
        const category = document.getElementById('filterCategory')?.value || '';
        const difficulty = document.getElementById('filterDifficulty')?.value || '';
        const type = document.getElementById('filterQuestionType')?.value || '';
        const tags = document.getElementById('filterTags')?.value?.toLowerCase() || '';

        this.filteredQuestions = this.allQuestions.filter(q => {
            let match = true;
            
            if (search) {
                match = match && (
                    (q.text || '').toLowerCase().includes(search) ||
                    (q.category || '').toLowerCase().includes(search) ||
                    (q.tags || []).some(t => t.toLowerCase().includes(search))
                );
            }
            if (assessmentId) {
                if (assessmentId === 'unlinked') {
                    match = match && !q.assessmentId;
                } else {
                    match = match && q.assessmentId === assessmentId;
                }
            }
            if (category) match = match && q.category === category;
            if (difficulty) match = match && q.difficulty === difficulty;
            if (type) match = match && q.type === type;
            if (tags) {
                match = match && (q.tags || []).some(t => t.toLowerCase().includes(tags));
            }
            
            return match;
        });

        this.currentPage = 1;
        this.renderTable();
    },

    filterByCategory(category) {
        const select = document.getElementById('filterCategory');
        if (select) {
            select.value = category;
        }
        
        document.querySelectorAll('.category-tag').forEach(tag => {
            const tagText = tag.textContent;
            const isActive = tagText === category || (category === '' && tagText === 'All');
            tag.classList.toggle('active', isActive);
        });
        
        this.filter();
    },

    // ============================================================
    // SELECTION
    // ============================================================

    toggleSelect(id) {
        const index = this.selectedQuestions.indexOf(id);
        if (index > -1) {
            this.selectedQuestions.splice(index, 1);
        } else {
            this.selectedQuestions.push(id);
        }
        this.updateBulkActions();
        this.renderTable();
    },

    toggleSelectAll() {
        const checked = document.getElementById('selectAll')?.checked || false;
        const visibleIds = this.filteredQuestions
            .slice((this.currentPage - 1) * this.itemsPerPage, this.currentPage * this.itemsPerPage)
            .map(q => q.id);
        
        if (checked) {
            visibleIds.forEach(id => {
                if (!this.selectedQuestions.includes(id)) {
                    this.selectedQuestions.push(id);
                }
            });
        } else {
            this.selectedQuestions = this.selectedQuestions.filter(id => !visibleIds.includes(id));
        }
        this.updateBulkActions();
        this.renderTable();
    },

    clearSelection() {
        this.selectedQuestions = [];
        const selectAll = document.getElementById('selectAll');
        if (selectAll) selectAll.checked = false;
        this.updateBulkActions();
        this.renderTable();
    },

    updateBulkActions() {
        const bar = document.getElementById('bulkActionsBar');
        const count = document.getElementById('selectedCount');
        if (!bar) return;
        
        if (this.selectedQuestions.length === 0) {
            bar.style.display = 'none';
            return;
        }
        bar.style.display = 'flex';
        if (count) count.textContent = `${this.selectedQuestions.length} questions selected`;
    },

    // ============================================================
    // BULK OPERATIONS
    // ============================================================

    async bulkDelete() {
        if (this.selectedQuestions.length === 0) return;
        if (!confirm(`Delete ${this.selectedQuestions.length} questions? This action cannot be undone.`)) return;
        
        const btn = document.getElementById('bulkDeleteBtn');
        this.setLoading(btn, true);
        
        try {
            const batch = this.db.batch();
            this.selectedQuestions.forEach(id => {
                const ref = this.db.collection('questions').doc(id);
                batch.delete(ref);
            });
            await batch.commit();
            
            const count = this.selectedQuestions.length;
            this.selectedQuestions = [];
            this.updateBulkActions();
            await this.loadQuestions();
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast(`Deleted ${count} questions successfully`);
            }
        } catch (error) {
            console.error('Bulk delete error:', error);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error deleting questions: ' + error.message, true);
            }
        }
        
        this.setLoading(btn, false);
    },

    async bulkExport() {
        if (this.selectedQuestions.length === 0) return;
        
        const btn = document.getElementById('bulkExportBtn');
        this.setLoading(btn, true);
        
        try {
            const questions = this.allQuestions.filter(q => this.selectedQuestions.includes(q.id));
            const dataStr = JSON.stringify(questions, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `questions_export_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast(`Exported ${questions.length} questions successfully`);
            }
        } catch (error) {
            console.error('Export error:', error);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error exporting questions: ' + error.message, true);
            }
        }
        
        this.setLoading(btn, false);
    },

    // ============================================================
    // BULK CHANGE CATEGORY - Using Modal with Select
    // ============================================================

    async bulkChangeCategory() {
        if (this.selectedQuestions.length === 0) {
            window.showToast('Please select at least one question', true);
            return;
        }
        
        const btn = document.getElementById('bulkCategoryBtn');
        this.setLoading(btn, true);
        
        const categories = ['HTML', 'CSS', 'JavaScript', 'Python', 'Data Analysis', 'Photoshop', 'Robotics', 'Cybersecurity', 'General'];
        const categoryOptions = categories.map(c => `<option value="${c}">${c}</option>`).join('');
        
        const content = `
            <div class="modal-body-inner">
                <p style="color:#6b7280;margin-bottom:16px;">
                    Change category for <strong>${this.selectedQuestions.length}</strong> selected question(s)
                </p>
                <div class="form-group">
                    <label>New Category <span class="required">*</span></label>
                    <select id="bulkCategorySelect" style="width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;">
                        ${categoryOptions}
                    </select>
                </div>
                <div style="background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e5e7eb;margin-top:12px;">
                    <p style="font-size:13px;color:#6b7280;margin:0;">
                        <i class="fas fa-info-circle"></i> This will update the category for all selected questions
                    </p>
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" onclick="window.Questions.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="window.Questions.confirmBulkChangeCategory()">
                        <i class="fas fa-check"></i> Update Category
                    </button>
                </div>
            </div>
        `;
        
        this.openModal('Change Category for Selected Questions', content);
        this.setLoading(btn, false);
    },

    async confirmBulkChangeCategory() {
        const newCategory = document.getElementById('bulkCategorySelect')?.value;
        if (!newCategory) {
            window.showToast('Please select a category', true);
            return;
        }
        
        this.closeModal();
        
        const btn = document.getElementById('bulkCategoryBtn');
        this.setLoading(btn, true);
        
        try {
            const batch = this.db.batch();
            this.selectedQuestions.forEach(id => {
                const ref = this.db.collection('questions').doc(id);
                batch.update(ref, { category: newCategory });
            });
            await batch.commit();
            
            const count = this.selectedQuestions.length;
            this.selectedQuestions = [];
            this.updateBulkActions();
            await this.loadQuestions();
            
            window.showToast(`Category updated to "${newCategory}" for ${count} questions`);
        } catch (error) {
            console.error('Bulk category change error:', error);
            window.showToast('Error updating category: ' + error.message, true);
        }
        
        this.setLoading(btn, false);
    },

    // ============================================================
    // BULK CHANGE DIFFICULTY - Using Modal with Select
    // ============================================================

    async bulkChangeDifficulty() {
        if (this.selectedQuestions.length === 0) {
            window.showToast('Please select at least one question', true);
            return;
        }
        
        const btn = document.getElementById('bulkDifficultyBtn');
        this.setLoading(btn, true);
        
        const content = `
            <div class="modal-body-inner">
                <p style="color:#6b7280;margin-bottom:16px;">
                    Change difficulty for <strong>${this.selectedQuestions.length}</strong> selected question(s)
                </p>
                <div class="form-group">
                    <label>New Difficulty <span class="required">*</span></label>
                    <select id="bulkDifficultySelect" style="width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;">
                        <option value="easy">Easy</option>
                        <option value="medium" selected>Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                </div>
                <div style="background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e5e7eb;margin-top:12px;">
                    <p style="font-size:13px;color:#6b7280;margin:0;">
                        <i class="fas fa-info-circle"></i> This will update the difficulty for all selected questions
                    </p>
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" onclick="window.Questions.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="window.Questions.confirmBulkChangeDifficulty()">
                        <i class="fas fa-check"></i> Update Difficulty
                    </button>
                </div>
            </div>
        `;
        
        this.openModal('Change Difficulty for Selected Questions', content);
        this.setLoading(btn, false);
    },

    async confirmBulkChangeDifficulty() {
        const newDifficulty = document.getElementById('bulkDifficultySelect')?.value;
        if (!newDifficulty) {
            window.showToast('Please select a difficulty', true);
            return;
        }
        
        this.closeModal();
        
        const btn = document.getElementById('bulkDifficultyBtn');
        this.setLoading(btn, true);
        
        try {
            const batch = this.db.batch();
            this.selectedQuestions.forEach(id => {
                const ref = this.db.collection('questions').doc(id);
                batch.update(ref, { difficulty: newDifficulty });
            });
            await batch.commit();
            
            const count = this.selectedQuestions.length;
            this.selectedQuestions = [];
            this.updateBulkActions();
            await this.loadQuestions();
            
            window.showToast(`Difficulty updated to "${newDifficulty}" for ${count} questions`);
        } catch (error) {
            console.error('Bulk difficulty change error:', error);
            window.showToast('Error updating difficulty: ' + error.message, true);
        }
        
        this.setLoading(btn, false);
    },

    // ============================================================
    // BULK CHANGE ASSESSMENT
    // ============================================================

    async bulkChangeAssessment() {
        if (this.selectedQuestions.length === 0) {
            window.showToast('Please select at least one question', true);
            return;
        }
        
        const btn = document.getElementById('bulkAssessmentBtn');
        this.setLoading(btn, true);
        
        let assessmentOptions = '<option value="">Select an assessment...</option>';
        this.assessments.forEach(a => {
            assessmentOptions += `<option value="${a.id}">${this.escapeHtml(a.title)}</option>`;
        });
        
        const content = `
            <div class="modal-body-inner">
                <p style="color:#6b7280;margin-bottom:16px;">
                    Move <strong>${this.selectedQuestions.length}</strong> question(s) to a different assessment
                </p>
                <div class="form-group">
                    <label>Target Assessment <span class="required">*</span></label>
                    <select id="targetAssessmentSelect" style="width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;">
                        ${assessmentOptions}
                    </select>
                </div>
                <div style="background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e5e7eb;margin-top:12px;">
                    <p style="font-size:13px;color:#6b7280;margin:0;">
                        <i class="fas fa-info-circle"></i> This will change the assessment link for all selected questions
                    </p>
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" onclick="window.Questions.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="window.Questions.confirmBulkChangeAssessment()">
                        <i class="fas fa-check"></i> Move Questions
                    </button>
                </div>
            </div>
        `;
        
        this.openModal('Move Questions to Assessment', content);
        this.setLoading(btn, false);
    },

    async confirmBulkChangeAssessment() {
        const targetId = document.getElementById('targetAssessmentSelect')?.value;
        if (!targetId) {
            window.showToast('Please select an assessment', true);
            return;
        }
        
        this.closeModal();
        
        const btn = document.getElementById('bulkAssessmentBtn');
        this.setLoading(btn, true);
        
        try {
            const batch = this.db.batch();
            this.selectedQuestions.forEach(id => {
                const ref = this.db.collection('questions').doc(id);
                batch.update(ref, { assessmentId: targetId });
            });
            await batch.commit();
            
            await this.updateAssessmentQuestionCount(targetId);
            
            const count = this.selectedQuestions.length;
            this.selectedQuestions = [];
            this.updateBulkActions();
            await this.loadQuestions();
            
            window.showToast(`Moved ${count} questions to assessment successfully`);
        } catch (error) {
            console.error('Bulk assessment change error:', error);
            window.showToast('Error moving questions: ' + error.message, true);
        }
        
        this.setLoading(btn, false);
    },

    // ============================================================
    // BULK ADD FEEDBACK - Using Modal
    // ============================================================

    async bulkAddFeedback() {
        if (this.selectedQuestions.length === 0) {
            window.showToast('Please select at least one question', true);
            return;
        }
        
        const btn = document.getElementById('bulkFeedbackBtn');
        this.setLoading(btn, true);
        
        const content = `
            <div class="modal-body-inner">
                <p style="color:#6b7280;margin-bottom:16px;">
                    Add feedback/explanation to <strong>${this.selectedQuestions.length}</strong> selected question(s)
                </p>
                <div class="form-group">
                    <label>Feedback Text <span class="required">*</span></label>
                    <textarea id="bulkFeedbackText" rows="4" placeholder="Enter feedback explanation for students..." style="width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;resize:vertical;"></textarea>
                    <div class="help-text"><i class="fas fa-info-circle"></i> This will be shown to students after they answer the question</div>
                </div>
                <div style="background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e5e7eb;margin-top:12px;">
                    <p style="font-size:13px;color:#6b7280;margin:0;">
                        <i class="fas fa-lightbulb"></i> Good feedback helps students learn from their mistakes
                    </p>
                </div>
                <div class="form-actions">
                    <button class="btn-secondary" onclick="window.Questions.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="window.Questions.confirmBulkAddFeedback()">
                        <i class="fas fa-comment"></i> Add Feedback
                    </button>
                </div>
            </div>
        `;
        
        this.openModal('Add Feedback to Selected Questions', content);
        this.setLoading(btn, false);
    },

    async confirmBulkAddFeedback() {
        const feedbackText = document.getElementById('bulkFeedbackText')?.value?.trim();
        if (!feedbackText) {
            window.showToast('Please enter feedback text', true);
            return;
        }
        
        this.closeModal();
        
        const btn = document.getElementById('bulkFeedbackBtn');
        this.setLoading(btn, true);
        
        try {
            const batch = this.db.batch();
            this.selectedQuestions.forEach(id => {
                const ref = this.db.collection('questions').doc(id);
                batch.update(ref, { 
                    feedback: [feedbackText],
                    hasFeedback: true
                });
            });
            await batch.commit();
            
            const count = this.selectedQuestions.length;
            this.selectedQuestions = [];
            this.updateBulkActions();
            await this.loadQuestions();
            
            window.showToast(`Added feedback to ${count} questions successfully`);
        } catch (error) {
            console.error('Bulk feedback error:', error);
            window.showToast('Error adding feedback: ' + error.message, true);
        }
        
        this.setLoading(btn, false);
    },

    // ============================================================
    // REUSE QUESTIONS - Select questions from other assessments
    // ============================================================

    openReuseModal() {
        this.isReuseMode = true;
        this.selectedQuestions = [];
        
        let assessmentOptions = '<option value="">All Assessments</option>';
        this.assessments.forEach(a => {
            assessmentOptions += `<option value="${a.id}">${this.escapeHtml(a.title)}</option>`;
        });
        
        const content = `
            <div class="modal-body-inner">
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
                    <div style="flex:2;min-width:180px;">
                        <input type="text" id="reuseSearch" placeholder="Search questions..." oninput="window.Questions.filterReuseQuestions()" style="width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;">
                    </div>
                    <div style="flex:1;min-width:120px;">
                        <select id="reuseAssessmentFilter" onchange="window.Questions.filterReuseQuestions()" style="width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;">
                            ${assessmentOptions}
                        </select>
                    </div>
                    <div style="flex:1;min-width:120px;">
                        <select id="reuseCategoryFilter" onchange="window.Questions.filterReuseQuestions()" style="width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;">
                            <option value="">All Categories</option>
                            <option value="HTML">HTML</option>
                            <option value="CSS">CSS</option>
                            <option value="JavaScript">JavaScript</option>
                            <option value="Python">Python</option>
                            <option value="Data Analysis">Data Analysis</option>
                            <option value="General">General</option>
                        </select>
                    </div>
                </div>
                
                <div id="reuseQuestionsList" style="max-height:400px;overflow-y:auto;">
                    <div class="empty-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <h3>Loading questions...</h3>
                    </div>
                </div>
                
                <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <span style="font-size:13px;color:#6b7280;">
                        Selected: <strong id="reuseSelectedCount">0</strong> questions
                    </span>
                    <button class="btn-secondary btn-sm" onclick="window.Questions.selectAllReuseQuestions()">
                        <i class="fas fa-check-double"></i> Select All
                    </button>
                </div>
                
                <div class="form-group" style="margin-top:16px;">
                    <label>Target Assessment <span class="required">*</span></label>
                    <select id="reuseTargetAssessment" required style="width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;">
                        <option value="">Select target assessment...</option>
                        ${this.assessments.map(a => `<option value="${a.id}">${this.escapeHtml(a.title)}</option>`).join('')}
                    </select>
                    <div class="help-text"><i class="fas fa-info-circle"></i> Selected questions will be copied to this assessment</div>
                </div>
                
                <div class="form-actions">
                    <button class="btn-secondary" onclick="window.Questions.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="window.Questions.confirmReuseQuestions()">
                        <i class="fas fa-copy"></i> Copy Selected Questions
                    </button>
                </div>
            </div>
        `;
        
        this.openModal('Reuse Questions from Assessments', content);
        this.loadReuseQuestions();
    },

    async loadReuseQuestions() {
        try {
            const container = document.getElementById('reuseQuestionsList');
            if (!container) return;
            
            const snapshot = await this.db.collection('questions')
                .orderBy('createdAt', 'desc')
                .get();
            
            let questions = [];
            snapshot.forEach(doc => {
                questions.push({ id: doc.id, ...doc.data() });
            });
            
            this._reuseQuestions = questions;
            this._renderReuseQuestions(questions);
            
        } catch (error) {
            console.error('Error loading reuse questions:', error);
        }
    },

    filterReuseQuestions() {
        const search = document.getElementById('reuseSearch')?.value?.toLowerCase() || '';
        const assessmentId = document.getElementById('reuseAssessmentFilter')?.value || '';
        const category = document.getElementById('reuseCategoryFilter')?.value || '';
        
        let filtered = this._reuseQuestions || [];
        
        filtered = filtered.filter(q => {
            let match = true;
            if (search) {
                match = match && (q.text || '').toLowerCase().includes(search);
            }
            if (assessmentId) {
                match = match && q.assessmentId === assessmentId;
            }
            if (category) {
                match = match && q.category === category;
            }
            return match;
        });
        
        this._renderReuseQuestions(filtered);
    },

    _renderReuseQuestions(questions) {
        const container = document.getElementById('reuseQuestionsList');
        if (!container) return;
        
        if (questions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No questions found</h3>
                    <p>Try adjusting your filters</p>
                </div>
            `;
            return;
        }
        
        const assessmentMap = this.getAssessmentMap();
        
        let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
        questions.forEach((q) => {
            const isSelected = this.selectedQuestions.includes(q.id);
            const assessmentTitle = assessmentMap[q.assessmentId] || 'Unlinked';
            
            html += `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid ${isSelected ? '#166534' : '#e5e7eb'};border-radius:8px;background:${isSelected ? '#f0fdf4' : 'white'};transition:all 0.2s ease;">
                    <input type="checkbox" class="reuse-checkbox" data-id="${q.id}" ${isSelected ? 'checked' : ''} onchange="window.Questions.toggleReuseSelect('${q.id}')" style="width:16px;height:16px;accent-color:#166534;flex-shrink:0;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:500;font-size:14px;color:#1a1f2c;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                            ${this.escapeHtml(q.text || 'Untitled')}
                        </div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:12px;color:#6b7280;">
                            <span class="badge-assessment">${this.escapeHtml(assessmentTitle)}</span>
                            <span class="badge-type">${this.getTypeLabels()[q.type] || q.type || 'Unknown'}</span>
                            <span class="badge-difficulty ${q.difficulty || 'easy'}">${(q.difficulty || 'Easy').charAt(0).toUpperCase() + (q.difficulty || 'easy').slice(1)}</span>
                            <span>${q.points || 10} pts</span>
                        </div>
                    </div>
                    ${isSelected ? '<span style="color:#166534;font-weight:600;font-size:12px;">✓ Selected</span>' : ''}
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
        this.updateReuseSelectedCount();
    },

    toggleReuseSelect(id) {
        const index = this.selectedQuestions.indexOf(id);
        if (index > -1) {
            this.selectedQuestions.splice(index, 1);
        } else {
            this.selectedQuestions.push(id);
        }
        this.updateReuseSelectedCount();
        this.filterReuseQuestions();
    },

    selectAllReuseQuestions() {
        const checkboxes = document.querySelectorAll('.reuse-checkbox');
        const allIds = Array.from(checkboxes).map(cb => cb.dataset.id);
        this.selectedQuestions = allIds;
        this.updateReuseSelectedCount();
        this.filterReuseQuestions();
    },

    updateReuseSelectedCount() {
        const countEl = document.getElementById('reuseSelectedCount');
        if (countEl) {
            countEl.textContent = this.selectedQuestions.length;
        }
    },

    async confirmReuseQuestions() {
        if (this.selectedQuestions.length === 0) {
            window.showToast('Please select at least one question', true);
            return;
        }
        
        const targetId = document.getElementById('reuseTargetAssessment')?.value;
        if (!targetId) {
            window.showToast('Please select a target assessment', true);
            return;
        }
        
        try {
            const selectedQuestions = this._reuseQuestions.filter(q => this.selectedQuestions.includes(q.id));
            let copied = 0;
            
            for (const q of selectedQuestions) {
                const newQuestion = { ...q };
                delete newQuestion.id;
                delete newQuestion.createdAt;
                delete newQuestion.updatedAt;
                newQuestion.assessmentId = targetId;
                newQuestion.copiedFrom = q.id;
                newQuestion.copiedAt = firebase.firestore.FieldValue.serverTimestamp();
                
                await this.db.collection('questions').add(newQuestion);
                copied++;
            }
            
            await this.updateAssessmentQuestionCount(targetId);
            
            window.showToast(`Copied ${copied} questions to assessment successfully!`);
            
            this.closeModal();
            this.selectedQuestions = [];
            await this.loadQuestions();
            
        } catch (error) {
            console.error('Error reusing questions:', error);
            window.showToast('Error copying questions: ' + error.message, true);
        }
    },

    // ============================================================
    // REUSE ASSESSMENT - Duplicate entire assessment
    // ============================================================

    openReuseAssessmentModal() {
        let assessmentOptions = '<option value="">Select assessment to duplicate...</option>';
        this.assessments.forEach(a => {
            assessmentOptions += `<option value="${a.id}">${this.escapeHtml(a.title)} (${a.totalQuestions || 0} questions)</option>`;
        });
        
        const content = `
            <div class="modal-body-inner">
                <div class="form-group">
                    <label>Source Assessment <span class="required">*</span></label>
                    <select id="sourceAssessmentSelect" required style="width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;">
                        ${assessmentOptions}
                    </select>
                    <div class="help-text"><i class="fas fa-info-circle"></i> Select the assessment you want to duplicate</div>
                </div>
                
                <div class="form-group">
                    <label>New Assessment Title <span class="required">*</span></label>
                    <input type="text" id="newAssessmentTitle" placeholder="Enter new assessment title..." required style="width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;">
                    <div class="help-text"><i class="fas fa-info-circle"></i> The duplicated assessment will have this title</div>
                </div>
                
                <div style="background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #e5e7eb;margin-top:12px;">
                    <p style="font-size:13px;color:#6b7280;">
                        <i class="fas fa-info-circle"></i> 
                        This will duplicate the entire assessment including all its questions. 
                        The new assessment will be created as a draft.
                    </p>
                </div>
                
                <div class="form-actions">
                    <button class="btn-secondary" onclick="window.Questions.closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="window.Questions.confirmReuseAssessment()">
                        <i class="fas fa-clone"></i> Duplicate Assessment
                    </button>
                </div>
            </div>
        `;
        
        this.openModal('Reuse Assessment', content);
    },

    async confirmReuseAssessment() {
        const sourceId = document.getElementById('sourceAssessmentSelect')?.value;
        const newTitle = document.getElementById('newAssessmentTitle')?.value?.trim();
        
        if (!sourceId) {
            window.showToast('Please select a source assessment', true);
            return;
        }
        
        if (!newTitle) {
            window.showToast('Please enter a title for the new assessment', true);
            return;
        }
        
        const confirmBtn = document.querySelector('.form-actions .btn-primary') || document.querySelector('[onclick*="confirmReuseAssessment"]');
        this.setLoading(confirmBtn, true);
        
        try {
            const sourceDoc = await this.db.collection('assessments').doc(sourceId).get();
            if (!sourceDoc.exists) {
                throw new Error('Source assessment not found');
            }
            
            const sourceData = sourceDoc.data();
            
            const newAssessmentData = {
                ...sourceData,
                title: newTitle,
                status: 'draft',
                totalQuestions: 0,
                participants: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                duplicatedFrom: sourceId,
                duplicatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            delete newAssessmentData.id;
            
            const newAssessmentRef = await this.db.collection('assessments').add(newAssessmentData);
            
            const questionsSnap = await this.db.collection('questions')
                .where('assessmentId', '==', sourceId)
                .get();
            
            let copiedQuestions = 0;
            const batch = this.db.batch();
            
            questionsSnap.forEach(doc => {
                const qData = doc.data();
                const newQData = {
                    ...qData,
                    assessmentId: newAssessmentRef.id,
                    copiedFrom: doc.id,
                    copiedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                delete newQData.id;
                delete newQData.createdAt;
                delete newQData.updatedAt;
                
                const newRef = this.db.collection('questions').doc();
                batch.set(newRef, newQData);
                copiedQuestions++;
            });
            
            await batch.commit();
            
            await newAssessmentRef.update({
                totalQuestions: copiedQuestions
            });
            
            window.showToast(`Assessment duplicated successfully with ${copiedQuestions} questions!`);
            
            this.closeModal();
            this.setLoading(confirmBtn, false);
            await this.loadAssessments();
            await this.loadQuestions();
            
        } catch (error) {
            console.error('Error reusing assessment:', error);
            this.setLoading(confirmBtn, false);
            window.showToast('Error duplicating assessment: ' + error.message, true);
        }
    },

    // ============================================================
    // OPEN CREATE - Enhanced with Feedback
    // ============================================================

    openCreate() {
        const btn = document.getElementById('newQuestionBtn');
        this.setLoading(btn, true);
        
        this.questionBatch = [];
        this.currentBatchIndex = 0;
        this.defaultCategory = 'General';
        this.defaultDifficulty = 'medium';
        this.defaultPoints = 1;
        this.questionCount = 1;

        const content = this.getBatchSetupHTML();
        this.openModal('Add Questions to Assessment', content);
        setTimeout(() => {
            this.populateAssessmentDropdown();
            this.setLoading(btn, false);
        }, 100);
    },

    getBatchSetupHTML() {
        return `
            <div class="modal-body-inner">
                <form id="questionSetupForm" onsubmit="window.Questions.initializeBatch(event)">
                    <div class="form-group">
                        <label>Select Assessment <span class="required">*</span></label>
                        <select id="questionAssessment" required>
                            <option value="">Select an assessment...</option>
                        </select>
                        <div class="help-text"><i class="fas fa-info-circle"></i> All questions will be linked to this assessment</div>
                    </div>

                    <div class="form-group">
                        <label>Number of Questions <span class="required">*</span></label>
                        <input type="number" id="questionCountInput" min="1" max="50" value="1" required>
                        <div class="help-text"><i class="fas fa-info-circle"></i> How many questions do you want to add? (Max 50)</div>
                    </div>

                    <div class="batch-settings">
                        <div class="form-group">
                            <label>Default Category</label>
                            <select id="defaultCategory">
                                <option value="HTML">HTML</option>
                                <option value="CSS">CSS</option>
                                <option value="JavaScript">JavaScript</option>
                                <option value="Python">Python</option>
                                <option value="Data Analysis">Data Analysis</option>
                                <option value="Photoshop">Photoshop</option>
                                <option value="Robotics">Robotics</option>
                                <option value="Cybersecurity">Cybersecurity</option>
                                <option value="General" selected>General</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Default Difficulty</label>
                            <select id="defaultDifficulty">
                                <option value="easy">Easy</option>
                                <option value="medium" selected>Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Default Points</label>
                            <input type="number" id="defaultPoints" value="1" min="1">
                        </div>
                    </div>

                    <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; margin-top: 8px;" id="startBatchBtn">
                        <i class="fas fa-arrow-right"></i> <span class="btn-text">Start Adding Questions</span>
                        <span class="spinner"></span>
                    </button>
                </form>
            </div>
        `;
    },

    async initializeBatch(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('startBatchBtn');
        this.setLoading(submitBtn, true);
        
        const assessmentId = document.getElementById('questionAssessment')?.value || '';
        const count = parseInt(document.getElementById('questionCountInput')?.value) || 1;
        
        if (!assessmentId) {
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Please select an assessment', true);
            }
            this.setLoading(submitBtn, false);
            return;
        }

        if (count < 1 || count > 50) {
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Please enter a number between 1 and 50', true);
            }
            this.setLoading(submitBtn, false);
            return;
        }

        this.selectedAssessmentId = assessmentId;
        this.questionCount = count;
        this.defaultCategory = document.getElementById('defaultCategory').value;
        this.defaultDifficulty = document.getElementById('defaultDifficulty').value;
        this.defaultPoints = parseInt(document.getElementById('defaultPoints').value) || 1;

        this.questionBatch = [];
        for (let i = 0; i < count; i++) {
            this.questionBatch.push({
                type: 'multiple-choice',
                text: '',
                category: this.defaultCategory,
                difficulty: this.defaultDifficulty,
                tags: [],
                points: this.defaultPoints,
                options: ['', ''],
                correctAnswers: [],
                feedback: [],
                rubric: '',
                maxWordCount: 0,
                language: 'javascript',
                starterCode: '',
                solution: '',
                correct: 'true',
                codeSubType: 'writing',
                instructions: '',
                codeToRead: '',
                codeQuestions: '',
                codeWithErrors: '',
                codeCorrected: '',
                codeIncomplete: '',
                codeCompleted: '',
                imageUrl: '',
                imageAlt: '',
                fileTypes: 'all',
                maxFileSize: 5
            });
        }
        this.currentBatchIndex = 0;

        const content = this.getBatchFormHTML();
        this.openModal('Add Questions to Assessment', content);
        setTimeout(() => {
            this.populateAssessmentDropdown();
            const select = document.getElementById('questionAssessment');
            if (select) select.value = assessmentId;
            this.renderBatchNavigation();
            this.renderQuestionForm(0);
            this.applyDefaultsToAll();
            this.setLoading(submitBtn, false);
        }, 100);
    },

    applyDefaultsToAll() {
        this.questionBatch.forEach(q => {
            q.category = this.defaultCategory;
            q.difficulty = this.defaultDifficulty;
            q.points = this.defaultPoints;
        });
    },

    getBatchFormHTML() {
        return `
            <div class="modal-body-inner">
                <form id="questionForm" onsubmit="window.Questions.saveBatchQuestions(event)">
                    <div class="form-group" style="display:none;">
                        <select id="questionAssessment">
                            <option value="${this.selectedAssessmentId}"></option>
                        </select>
                    </div>

                    <div class="batch-settings" style="background:#f0fdf4;border-color:#86efac;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:12px;color:#166534;">Category</label>
                            <div style="font-weight:600;color:#1a1f2c;font-size:14px;">${this.defaultCategory}</div>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:12px;color:#166534;">Difficulty</label>
                            <div style="font-weight:600;color:#1a1f2c;font-size:14px;">${this.defaultDifficulty}</div>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:12px;color:#166534;">Points</label>
                            <div style="font-weight:600;color:#1a1f2c;font-size:14px;">${this.defaultPoints}</div>
                        </div>
                        <div style="font-size:12px;color:#6b7280;display:flex;align-items:center;gap:4px;">
                            <i class="fas fa-info-circle"></i> Applied to all questions
                        </div>
                    </div>

                    <div class="batch-navigation" id="batchNavigation">
                        <div class="batch-info">
                            <span class="question-number-badge">
                                <i class="fas fa-question-circle"></i>
                                Question <span id="currentQuestionNum">1</span> of <span id="totalQuestionsNum">1</span>
                            </span>
                        </div>
                        <div class="batch-nav-buttons">
                            <button type="button" onclick="window.Questions.navigateBatch(-1)" id="prevBatchBtn" disabled>
                                <i class="fas fa-chevron-left"></i> <span class="btn-text">Previous</span>
                                <span class="spinner-sm"></span>
                            </button>
                            <button type="button" onclick="window.Questions.navigateBatch(1)" id="nextBatchBtn">
                                <span class="btn-text">Next</span> <i class="fas fa-chevron-right"></i>
                                <span class="spinner-sm"></span>
                            </button>
                        </div>
                    </div>

                    <div id="questionFormContainer">
                        <!-- Dynamic content -->
                    </div>

                    <div class="batch-nav-bottom">
                        <div class="batch-info">
                            <span id="bottomQuestionInfo">Question 1 of 1</span>
                        </div>
                        <div class="batch-nav-buttons">
                            <button type="button" onclick="window.Questions.navigateBatch(-1)" id="bottomPrevBtn" disabled>
                                <i class="fas fa-chevron-left"></i> <span class="btn-text">Previous</span>
                                <span class="spinner-sm"></span>
                            </button>
                            <button type="button" onclick="window.Questions.navigateBatch(1)" id="bottomNextBtn">
                                <span class="btn-text">Next</span> <i class="fas fa-chevron-right"></i>
                                <span class="spinner-sm"></span>
                            </button>
                        </div>
                    </div>

                    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
                        <button type="button" class="btn-secondary btn-sm" onclick="window.Questions.addQuestionToBatch(); window.Questions.renderBatchNavigation(); window.Questions.renderQuestionForm(window.Questions.questionBatch.length - 1);">
                            <i class="fas fa-plus"></i> <span class="btn-text">Add Another Question</span>
                            <span class="spinner"></span>
                        </button>
                        <button type="button" class="btn-secondary btn-sm" onclick="window.Questions.removeQuestionFromBatch(window.Questions.currentBatchIndex);" id="removeQuestionBtn">
                            <i class="fas fa-trash"></i> <span class="btn-text">Remove Current</span>
                            <span class="spinner"></span>
                        </button>
                        <button type="button" class="btn-secondary btn-sm" onclick="window.Questions.duplicateCurrentQuestion();">
                            <i class="fas fa-copy"></i> <span class="btn-text">Duplicate</span>
                            <span class="spinner"></span>
                        </button>
                    </div>

                    <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; margin-top: 16px;" id="saveQuestionsBtn">
                        <i class="fas fa-save"></i> <span class="btn-text">Save All <span id="saveCount">1</span> Questions</span>
                        <span class="spinner"></span>
                    </button>
                </form>
            </div>
        `;
    },

    // ============================================================
    // BATCH NAVIGATION
    // ============================================================

    renderBatchNavigation() {
        const total = this.questionBatch.length;
        const current = this.currentBatchIndex + 1;
        
        const currentNum = document.getElementById('currentQuestionNum');
        const totalNum = document.getElementById('totalQuestionsNum');
        const saveCount = document.getElementById('saveCount');
        const bottomInfo = document.getElementById('bottomQuestionInfo');
        
        if (currentNum) currentNum.textContent = current;
        if (totalNum) totalNum.textContent = total;
        if (saveCount) saveCount.textContent = total;
        if (bottomInfo) bottomInfo.textContent = `Question ${current} of ${total}`;
        
        const prevDisabled = this.currentBatchIndex === 0;
        const nextDisabled = this.currentBatchIndex >= total - 1;
        
        const prevBtns = ['prevBatchBtn', 'bottomPrevBtn'];
        const nextBtns = ['nextBatchBtn', 'bottomNextBtn'];
        
        prevBtns.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = prevDisabled;
        });
        
        nextBtns.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = nextDisabled;
        });
    },

    navigateBatch(direction) {
        const newIndex = this.currentBatchIndex + direction;
        if (newIndex >= 0 && newIndex < this.questionBatch.length) {
            this.currentBatchIndex = newIndex;
            this.renderBatchNavigation();
            this.renderQuestionForm(this.currentBatchIndex);
            const container = document.getElementById('questionFormContainer');
            if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    addQuestionToBatch() {
        const lastQuestion = this.questionBatch[this.questionBatch.length - 1] || {};
        this.questionBatch.push({
            type: lastQuestion.type || 'multiple-choice',
            text: '',
            category: this.defaultCategory,
            difficulty: this.defaultDifficulty,
            tags: [],
            points: this.defaultPoints,
            options: ['', ''],
            correctAnswers: [],
            feedback: [],
            rubric: '',
            maxWordCount: 0,
            language: 'javascript',
            starterCode: '',
            solution: '',
            correct: 'true',
            codeSubType: 'writing',
            instructions: '',
            codeToRead: '',
            codeQuestions: '',
            codeWithErrors: '',
            codeCorrected: '',
            codeIncomplete: '',
            codeCompleted: '',
            imageUrl: '',
            imageAlt: '',
            fileTypes: 'all',
            maxFileSize: 5
        });
        this.currentBatchIndex = this.questionBatch.length - 1;
        this.renderBatchNavigation();
        this.renderQuestionForm(this.currentBatchIndex);
    },

    removeQuestionFromBatch(index) {
        if (this.questionBatch.length <= 1) {
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('You need at least one question', true);
            }
            return;
        }
        this.questionBatch.splice(index, 1);
        if (this.currentBatchIndex >= this.questionBatch.length) {
            this.currentBatchIndex = this.questionBatch.length - 1;
        }
        this.renderBatchNavigation();
        this.renderQuestionForm(this.currentBatchIndex);
    },

    duplicateCurrentQuestion() {
        const currentQuestion = this.questionBatch[this.currentBatchIndex];
        const newQuestion = JSON.parse(JSON.stringify(currentQuestion));
        newQuestion.text = currentQuestion.text ? currentQuestion.text + ' (Copy)' : '';
        this.questionBatch.splice(this.currentBatchIndex + 1, 0, newQuestion);
        this.currentBatchIndex++;
        this.renderBatchNavigation();
        this.renderQuestionForm(this.currentBatchIndex);
    },

    renderQuestionForm(index) {
        const container = document.getElementById('questionFormContainer');
        if (!container) return;
        
        const question = this.questionBatch[index];
        if (!question) return;
        
        container.innerHTML = this.getQuestionFormHTML(question, index);
        this.attachQuestionFormEvents(index);
    },

    getQuestionFormHTML(question, index) {
        const typeLabels = {
            'multiple-choice': 'Multiple Choice',
            'multiple-select': 'Multiple Select',
            'true-false': 'True/False',
            'fill-blank': 'Fill in the Blank',
            'short-answer': 'Short Answer',
            'essay': 'Essay',
            'matching': 'Matching',
            'ordering': 'Ordering',
            'image': 'Image-based',
            'file-upload': 'File Upload',
            'code': 'Code Question'
        };

        return `
            <div style="background:#f8fafc;padding:12px 16px;border-radius:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div>
                    <span class="question-number-badge">
                        <i class="fas fa-question-circle"></i> Question ${index + 1}
                    </span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <span class="sub-question-type">
                        <i class="fas fa-tag"></i> ${question.category || 'General'}
                    </span>
                    <span class="sub-question-type">
                        <i class="fas fa-signal"></i> ${question.difficulty || 'medium'}
                    </span>
                    <span class="sub-question-type">
                        <i class="fas fa-star"></i> ${question.points || 1} pts
                    </span>
                </div>
            </div>

            <div class="form-group">
                <label>Question Type <span class="required">*</span></label>
                <select id="qType_${index}" onchange="window.Questions.updateQuestionField(${index}, 'type', this.value); window.Questions.toggleOptionsContainer(${index});">
                    ${Object.entries(typeLabels).map(([value, label]) => `
                        <option value="${value}" ${question.type === value ? 'selected' : ''}>${label}</option>
                    `).join('')}
                </select>
            </div>

            <div class="form-group">
                <label>Question Text <span class="required">*</span></label>
                <textarea id="qText_${index}" rows="3" placeholder="Enter your question..." oninput="window.Questions.updateQuestionField(${index}, 'text', this.value)">${this.escapeHtml(question.text)}</textarea>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Category</label>
                    <select id="qCategory_${index}" onchange="window.Questions.updateQuestionField(${index}, 'category', this.value)">
                        <option value="HTML" ${question.category === 'HTML' ? 'selected' : ''}>HTML</option>
                        <option value="CSS" ${question.category === 'CSS' ? 'selected' : ''}>CSS</option>
                        <option value="JavaScript" ${question.category === 'JavaScript' ? 'selected' : ''}>JavaScript</option>
                        <option value="Python" ${question.category === 'Python' ? 'selected' : ''}>Python</option>
                        <option value="Data Analysis" ${question.category === 'Data Analysis' ? 'selected' : ''}>Data Analysis</option>
                        <option value="Photoshop" ${question.category === 'Photoshop' ? 'selected' : ''}>Photoshop</option>
                        <option value="Robotics" ${question.category === 'Robotics' ? 'selected' : ''}>Robotics</option>
                        <option value="Cybersecurity" ${question.category === 'Cybersecurity' ? 'selected' : ''}>Cybersecurity</option>
                        <option value="General" ${question.category === 'General' ? 'selected' : ''}>General</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Difficulty</label>
                    <select id="qDifficulty_${index}" onchange="window.Questions.updateQuestionField(${index}, 'difficulty', this.value)">
                        <option value="easy" ${question.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
                        <option value="medium" ${question.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="hard" ${question.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label>Tags (comma separated)</label>
                <input type="text" id="qTags_${index}" placeholder="e.g., forms, tables, grid" value="${(question.tags || []).join(', ')}" oninput="window.Questions.updateQuestionField(${index}, 'tags', this.value.split(',').map(t => t.trim()).filter(Boolean))">
                <div class="help-text"><i class="fas fa-info-circle"></i> Tags help with organization and filtering</div>
            </div>

            <div class="form-group">
                <label>Points</label>
                <input type="number" id="qPoints_${index}" value="${question.points || 1}" min="1" oninput="window.Questions.updateQuestionField(${index}, 'points', parseInt(this.value) || 1)">
            </div>

            <!-- FEEDBACK SECTION -->
            <div class="form-group" style="border:2px solid #dbeafe;border-radius:10px;padding:16px;background:#f8faff;">
                <label style="color:#1d4ed8;">
                    <i class="fas fa-comment"></i> Feedback / Explanation for Students
                </label>
                <div class="help-text" style="margin-bottom:8px;">
                    <i class="fas fa-info-circle"></i> This will be shown to students after they answer the question
                </div>
                <textarea id="qFeedback_${index}" rows="3" placeholder="Explain why the correct answer is right, or provide additional context..." oninput="window.Questions.updateQuestionField(${index}, 'feedback', [this.value])">${(question.feedback && question.feedback.length > 0) ? this.escapeHtml(question.feedback[0]) : ''}</textarea>
                <div class="help-text" style="margin-top:4px;color:#6b7280;">
                    <i class="fas fa-lightbulb"></i> Good feedback helps students learn from their mistakes
                </div>
            </div>

            <!-- Continue with rest of the form (options, true/false, etc.) -->
            <div id="codeSubTypeContainer_${index}" style="${question.type === 'code' ? '' : 'display:none;'}">
                <div class="form-group">
                    <label>Code Question Type</label>
                    <select id="codeSubType_${index}" onchange="window.Questions.updateQuestionField(${index}, 'codeSubType', this.value); window.Questions.renderQuestionForm(${index})">
                        <option value="writing" ${question.codeSubType === 'writing' ? 'selected' : ''}>Code Writing</option>
                        <option value="reading" ${question.codeSubType === 'reading' ? 'selected' : ''}>Code Reading</option>
                        <option value="correction" ${question.codeSubType === 'correction' ? 'selected' : ''}>Code Correction</option>
                        <option value="completion" ${question.codeSubType === 'completion' ? 'selected' : ''}>Code Completion</option>
                    </select>
                </div>
            </div>

            <div id="optionsContainer_${index}" style="${question.type === 'multiple-choice' || question.type === 'multiple-select' || question.type === 'matching' || question.type === 'ordering' ? '' : 'display:none;'}">
                <div class="options-container">
                    <div class="form-group">
                        <label>Answer Options <span class="required">*</span></label>
                        <div id="optionsList_${index}">
                            ${(question.options || ['', '']).map((opt, optIndex) => {
                                const isMultipleSelect = question.type === 'multiple-select';
                                const inputType = isMultipleSelect ? 'checkbox' : 'radio';
                                const inputName = `correct_${index}`;
                                const isCorrect = question.correctAnswers && question.correctAnswers.includes(opt);
                                return `
                                    <div class="option-row">
                                        <span class="option-label">${String.fromCharCode(65 + optIndex)}.</span>
                                        <input type="text" class="option-input" placeholder="Option ${String.fromCharCode(65 + optIndex)}" value="${this.escapeHtml(opt)}" oninput="window.Questions.updateOption(${index}, ${optIndex}, this.value)">
                                        <label class="option-correct-label">
                                            <input type="${inputType}" name="${inputName}" value="${optIndex}" ${isCorrect ? 'checked' : ''} onchange="window.Questions.updateCorrectAnswer(${index}, ${optIndex}, '${inputType}')">
                                            Correct
                                        </label>
                                        <button type="button" class="remove-option" onclick="window.Questions.removeOption(${index}, ${optIndex})" title="Remove option">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <button type="button" class="add-option-btn" onclick="window.Questions.addOptionToBatch(${index})">
                            <i class="fas fa-plus"></i> Add Option
                        </button>
                    </div>
                </div>
            </div>

            <div id="trueFalseContainer_${index}" style="${question.type === 'true-false' ? '' : 'display:none;'}">
                <div class="form-group">
                    <label>Correct Answer <span class="required">*</span></label>
                    <select id="trueFalseAnswer_${index}" onchange="window.Questions.updateQuestionField(${index}, 'correct', this.value)">
                        <option value="true" ${question.correct === 'true' ? 'selected' : ''}>True</option>
                        <option value="false" ${question.correct === 'false' ? 'selected' : ''}>False</option>
                    </select>
                </div>
            </div>

            <div id="fillBlankContainer_${index}" style="${question.type === 'fill-blank' ? '' : 'display:none;'}">
                <div class="form-group">
                    <label>Correct Answer(s) <span class="required">*</span></label>
                    <input type="text" id="fillBlankAnswers_${index}" placeholder="e.g., CSS, JavaScript" value="${(question.correctAnswers || []).join(', ')}" oninput="window.Questions.updateQuestionField(${index}, 'correctAnswers', this.value.split(',').map(a => a.trim()).filter(Boolean))">
                    <div class="help-text"><i class="fas fa-info-circle"></i> Separate multiple correct answers with commas</div>
                </div>
            </div>

            <div id="essayContainer_${index}" style="${question.type === 'essay' || question.type === 'short-answer' ? '' : 'display:none;'}">
                <div class="form-group">
                    <label>Sample Answer / Rubric</label>
                    <textarea id="essayRubric_${index}" rows="3" placeholder="Provide a sample answer or grading rubric..." oninput="window.Questions.updateQuestionField(${index}, 'rubric', this.value)">${this.escapeHtml(question.rubric || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>Max Word Count (Optional)</label>
                    <input type="number" id="essayWordCount_${index}" value="${question.maxWordCount || 0}" min="0" oninput="window.Questions.updateQuestionField(${index}, 'maxWordCount', parseInt(this.value) || 0)">
                </div>
            </div>

            <div id="codeContainer_${index}" style="${question.type === 'code' ? '' : 'display:none;'}">
                <div class="form-group">
                    <label>Programming Language</label>
                    <select id="codeLanguage_${index}" onchange="window.Questions.updateQuestionField(${index}, 'language', this.value)">
                        <option value="javascript" ${question.language === 'javascript' ? 'selected' : ''}>JavaScript</option>
                        <option value="python" ${question.language === 'python' ? 'selected' : ''}>Python</option>
                        <option value="html" ${question.language === 'html' ? 'selected' : ''}>HTML</option>
                        <option value="css" ${question.language === 'css' ? 'selected' : ''}>CSS</option>
                        <option value="sql" ${question.language === 'sql' ? 'selected' : ''}>SQL</option>
                        <option value="java" ${question.language === 'java' ? 'selected' : ''}>Java</option>
                    </select>
                </div>
            </div>
        `;
    },

    attachQuestionFormEvents(index) {
        this.toggleOptionsContainer(index);
        
        const typeSelect = document.getElementById(`qType_${index}`);
        if (typeSelect) {
            let currentType = typeSelect.value;
            typeSelect.addEventListener('change', function() {
                const newType = this.value;
                if ((currentType === 'multiple-choice' || currentType === 'multiple-select') && 
                    (newType === 'multiple-choice' || newType === 'multiple-select')) {
                    window.Questions.renderQuestionForm(index);
                }
                currentType = newType;
            });
        }
    },

    toggleOptionsContainer(index) {
        const question = this.questionBatch[index];
        if (!question) return;
        
        const type = question.type;
        const containers = [
            'optionsContainer',
            'trueFalseContainer',
            'fillBlankContainer',
            'essayContainer',
            'codeContainer',
            'imageContainer',
            'fileUploadContainer',
            'codeSubTypeContainer'
        ];
        
        containers.forEach(containerId => {
            const el = document.getElementById(`${containerId}_${index}`);
            if (el) el.style.display = 'none';
        });
        
        const optionsContainer = document.getElementById(`optionsContainer_${index}`);
        const trueFalseContainer = document.getElementById(`trueFalseContainer_${index}`);
        const fillBlankContainer = document.getElementById(`fillBlankContainer_${index}`);
        const essayContainer = document.getElementById(`essayContainer_${index}`);
        const codeContainer = document.getElementById(`codeContainer_${index}`);
        const imageContainer = document.getElementById(`imageContainer_${index}`);
        const fileUploadContainer = document.getElementById(`fileUploadContainer_${index}`);
        const codeSubTypeContainer = document.getElementById(`codeSubTypeContainer_${index}`);
        
        if (type === 'code' && codeSubTypeContainer) {
            codeSubTypeContainer.style.display = 'block';
        }
        
        switch(type) {
            case 'multiple-choice':
            case 'multiple-select':
            case 'matching':
            case 'ordering':
                if (optionsContainer) optionsContainer.style.display = 'block';
                break;
            case 'true-false':
                if (trueFalseContainer) trueFalseContainer.style.display = 'block';
                break;
            case 'fill-blank':
                if (fillBlankContainer) fillBlankContainer.style.display = 'block';
                break;
            case 'short-answer':
            case 'essay':
                if (essayContainer) essayContainer.style.display = 'block';
                break;
            case 'code':
                if (codeContainer) codeContainer.style.display = 'block';
                break;
            case 'image':
                if (imageContainer) imageContainer.style.display = 'block';
                break;
            case 'file-upload':
                if (fileUploadContainer) fileUploadContainer.style.display = 'block';
                break;
        }
    },

    updateQuestionField(index, field, value) {
        if (this.questionBatch[index]) {
            this.questionBatch[index][field] = value;
        }
    },

    updateOption(index, optIndex, value) {
        if (this.questionBatch[index]) {
            if (!this.questionBatch[index].options) {
                this.questionBatch[index].options = [];
            }
            this.questionBatch[index].options[optIndex] = value;
        }
    },

    updateCorrectAnswer(index, optIndex, inputType) {
        const question = this.questionBatch[index];
        if (!question) return;
        
        const optionText = question.options[optIndex];
        
        if (inputType === 'radio') {
            question.correctAnswers = [optionText];
        } else {
            const currentCorrect = question.correctAnswers || [];
            const indexInCorrect = currentCorrect.indexOf(optionText);
            
            if (indexInCorrect > -1) {
                currentCorrect.splice(indexInCorrect, 1);
            } else {
                currentCorrect.push(optionText);
            }
            question.correctAnswers = currentCorrect;
        }
    },

    addOptionToBatch(index) {
        const question = this.questionBatch[index];
        if (question) {
            if (!question.options) {
                question.options = [];
            }
            question.options.push('');
            this.renderQuestionForm(index);
        }
    },

    removeOption(index, optIndex) {
        const question = this.questionBatch[index];
        if (question && question.options && question.options.length > 2) {
            const removedOption = question.options[optIndex];
            question.options.splice(optIndex, 1);
            if (question.correctAnswers) {
                const idx = question.correctAnswers.indexOf(removedOption);
                if (idx > -1) {
                    question.correctAnswers.splice(idx, 1);
                }
            }
            this.renderQuestionForm(index);
        } else if (question && question.options && question.options.length <= 2) {
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Minimum 2 options required', true);
            }
        }
    },

    // ============================================================
    // POPULATE ASSESSMENT DROPDOWN
    // ============================================================

    populateAssessmentDropdown() {
        const select = document.getElementById('questionAssessment');
        if (!select) return;
        
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        this.assessments.forEach(assessment => {
            const option = document.createElement('option');
            option.value = assessment.id;
            option.textContent = assessment.title || 'Untitled Assessment';
            select.appendChild(option);
        });
        
        if (this.selectedAssessmentId) {
            select.value = this.selectedAssessmentId;
        }
    },

    // ============================================================
    // SAVE BATCH QUESTIONS
    // ============================================================

    async saveBatchQuestions(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('saveQuestionsBtn');
        this.setLoading(submitBtn, true);
        
        const assessmentId = this.selectedAssessmentId;
        
        if (!assessmentId) {
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Please select an assessment', true);
            }
            this.setLoading(submitBtn, false);
            return;
        }

        let hasError = false;
        let errorMessage = '';
        
        for (let i = 0; i < this.questionBatch.length; i++) {
            const q = this.questionBatch[i];
            if (!q.text || q.text.trim() === '') {
                hasError = true;
                errorMessage = `Question ${i + 1} is missing text`;
                break;
            }
            
            if (q.type === 'multiple-choice' || q.type === 'multiple-select') {
                const options = q.options || [];
                const validOptions = options.filter(o => o.trim() !== '');
                if (validOptions.length < 2) {
                    hasError = true;
                    errorMessage = `Question ${i + 1} needs at least 2 options`;
                    break;
                }
                if (!q.correctAnswers || q.correctAnswers.length === 0) {
                    hasError = true;
                    errorMessage = `Question ${i + 1} needs a correct answer`;
                    break;
                }
            }
            
            if (q.type === 'fill-blank' && (!q.correctAnswers || q.correctAnswers.length === 0)) {
                hasError = true;
                errorMessage = `Question ${i + 1} needs correct answer(s)`;
                break;
            }
        }
        
        if (hasError) {
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast(errorMessage, true);
            }
            this.setLoading(submitBtn, false);
            return;
        }

        try {
            let savedCount = 0;
            
            for (const question of this.questionBatch) {
                const questionData = {
                    assessmentId: assessmentId,
                    type: question.type || 'multiple-choice',
                    text: question.text || '',
                    category: question.category || 'General',
                    difficulty: question.difficulty || 'medium',
                    tags: question.tags || [],
                    points: question.points || 1,
                    options: question.options || [],
                    correctAnswer: question.correctAnswers || [],
                    feedback: question.feedback || [],
                    rubric: question.rubric || '',
                    maxWordCount: question.maxWordCount || 0,
                    language: question.language || 'javascript',
                    starterCode: question.starterCode || '',
                    solution: question.solution || '',
                    codeSubType: question.codeSubType || 'writing',
                    instructions: question.instructions || '',
                    codeToRead: question.codeToRead || '',
                    codeQuestions: question.codeQuestions || '',
                    codeWithErrors: question.codeWithErrors || '',
                    codeCorrected: question.codeCorrected || '',
                    codeIncomplete: question.codeIncomplete || '',
                    codeCompleted: question.codeCompleted || '',
                    imageUrl: question.imageUrl || '',
                    imageAlt: question.imageAlt || '',
                    fileTypes: question.fileTypes || 'all',
                    maxFileSize: question.maxFileSize || 5,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    usedInCount: 0,
                    hasFeedback: question.feedback && question.feedback.length > 0
                };

                if (question.type === 'true-false') {
                    questionData.correctAnswer = question.correct === 'true' ? ['True'] : ['False'];
                }

                await this.db.collection('questions').add(questionData);
                savedCount++;
            }

            await this.updateAssessmentQuestionCount(assessmentId);

            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast(`${savedCount} question(s) added successfully!`);
                this.closeModal();
            }
            
            this.questionBatch = [];
            this.currentBatchIndex = 0;
            this.setLoading(submitBtn, false);
            await this.loadQuestions();

        } catch (error) {
            console.error('Error saving questions:', error);
            this.setLoading(submitBtn, false);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error saving questions: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // UPDATE ASSESSMENT QUESTION COUNT
    // ============================================================

    async updateAssessmentQuestionCount(assessmentId) {
        try {
            const questionsSnap = await this.db.collection('questions')
                .where('assessmentId', '==', assessmentId)
                .get();
            
            const count = questionsSnap.size;
            await this.db.collection('assessments').doc(assessmentId).update({
                totalQuestions: count,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.warn('Could not update assessment question count:', error);
        }
    },

    // ============================================================
    // EDIT QUESTION
    // ============================================================

    async openEdit(id) {
        const button = event?.target?.closest?.('button') || document.querySelector(`[onclick*="openEdit('${id}')"]`);
        this.setLoading(button, true);

        try {
            const doc = await this.db.collection('questions').doc(id).get();
            if (!doc.exists) {
                if (typeof window !== 'undefined' && window.showToast) {
                    window.showToast('Question not found', true);
                }
                this.setLoading(button, false);
                return;
            }

            const data = doc.data();
            this.currentQuestion = { id: doc.id, ...data };
            
            const content = this.getEditFormHTML(data);
            this.openModal('Edit Question', content);
            setTimeout(() => {
                this.populateEditForm(data);
                this.setLoading(button, false);
            }, 100);

        } catch (error) {
            console.error('Error loading question:', error);
            this.setLoading(button, false);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error loading question: ' + error.message, true);
            }
        }
    },

    getEditFormHTML(data) {
        this.questionBatch = [data];
        this.currentBatchIndex = 0;
        return this.getBatchFormHTML();
    },

    populateEditForm(data) {
        this.populateAssessmentDropdown();
        
        const select = document.getElementById('questionAssessment');
        if (select && data.assessmentId) {
            select.value = data.assessmentId;
        }
        
        this.questionBatch = [data];
        this.currentBatchIndex = 0;
        this.renderBatchNavigation();
        this.renderQuestionForm(0);
        
        const assessmentSelect = document.getElementById('questionAssessment');
        if (assessmentSelect) {
            assessmentSelect.value = data.assessmentId || '';
        }
    },

    // ============================================================
    // DELETE QUESTION
    // ============================================================

    async deleteQuestion(id) {
        const button = event?.target?.closest?.('button') || document.querySelector(`[onclick*="deleteQuestion('${id}')"]`);
        
        if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
            return;
        }

        this.setLoading(button, true);

        try {
            const doc = await this.db.collection('questions').doc(id).get();
            const data = doc.data();
            
            await this.db.collection('questions').doc(id).delete();

            if (data && data.assessmentId) {
                await this.updateAssessmentQuestionCount(data.assessmentId);
            }

            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Question deleted successfully');
            }
            
            this.setLoading(button, false);
            await this.loadQuestions();

        } catch (error) {
            console.error('Error deleting question:', error);
            this.setLoading(button, false);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error deleting question: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // DUPLICATE QUESTION
    // ============================================================

    async duplicateQuestion(id) {
        const button = event?.target?.closest?.('button') || document.querySelector(`[onclick*="duplicateQuestion('${id}')"]`);
        this.setLoading(button, true);

        try {
            const doc = await this.db.collection('questions').doc(id).get();
            if (!doc.exists) {
                if (typeof window !== 'undefined' && window.showToast) {
                    window.showToast('Question not found', true);
                }
                this.setLoading(button, false);
                return;
            }

            const data = doc.data();
            delete data.createdAt;
            delete data.updatedAt;

            data.text = data.text + ' (Copy)';

            await this.db.collection('questions').add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                usedInCount: 0
            });

            if (data.assessmentId) {
                await this.updateAssessmentQuestionCount(data.assessmentId);
            }

            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Question duplicated successfully!');
            }
            
            this.setLoading(button, false);
            await this.loadQuestions();

        } catch (error) {
            console.error('Error duplicating question:', error);
            this.setLoading(button, false);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error duplicating question: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // MODAL HELPERS
    // ============================================================

    openModal(title, content) {
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const overlay = document.getElementById('modalOverlay');
        
        if (modalTitle) modalTitle.textContent = title || 'Modal';
        if (modalBody) modalBody.innerHTML = content || '';
        if (overlay) overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    closeModal() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.remove('show');
        document.body.style.overflow = '';
        this.isReuseMode = false;
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

window.Questions = Questions;

// Log to confirm loading
console.log('✅ Questions module loaded successfully');
console.log('📚 Available methods:', Object.keys(Questions));