// ============================================================
// ADMIN RESULTS - GROUPED BY STUDENT + ASSESSMENT
// ============================================================

const Results = {
    app: null,
    db: null,
    currentResult: null,
    allResults: [],
    filteredResults: [],
    selectedResults: [],
    allAssessments: [],
    allStudents: [],
    currentPage: 1,
    itemsPerPage: 20,

    // ============================================================
    // RENDER - Main entry point
    // ============================================================

    render(container, app) {
        this.app = app;
        this.db = app.db || app;
        
        container.innerHTML = this.getHTML();
        this.addStyles();
        
        setTimeout(() => {
            this.loadResults();
            this.loadAssessments();
            this.loadStudents();
        }, 100);
    },

    // ============================================================
    // GET HTML
    // ============================================================

    getHTML() {
        return `
            <!-- Stats Cards -->
            <div class="stats-grid" id="resultStats">
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="fas fa-file-alt"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statTotal">0</div>
                        <div class="stat-label">Total Submissions</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statPassed">0</div>
                        <div class="stat-label">Passed</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red"><i class="fas fa-times-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statFailed">0</div>
                        <div class="stat-label">Failed</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange"><i class="fas fa-chart-line"></i></div>
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
                    <input type="text" id="resultSearch" placeholder="Search by student, assessment..." oninput="Results.debounceFilter()">
                </div>
                <div class="filter-group">
                    <select id="filterAssessment" onchange="Results.filter()">
                        <option value="">All Assessments</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterStatus" onchange="Results.filter()">
                        <option value="">All Status</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterDate" onchange="Results.filter()">
                        <option value="">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                </div>
            </div>

            <!-- Results Table -->
            <div class="table-container">
                <div class="table-header">
                    <span>Results (Grouped by Student & Assessment)</span>
                    <span class="table-count" id="resultCount">0 items</span>
                </div>
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 36px;">
                                    <input type="checkbox" id="selectAll" onchange="Results.toggleSelectAll()">
                                </th>
                                <th>Student</th>
                                <th>Assessment</th>
                                <th>Latest Score</th>
                                <th>Status</th>
                                <th>Attempts</th>
                                <th>Last Attempt</th>
                                <th style="width: 140px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="resultsBody">
                            <tr>
                                <td colspan="8">
                                    <div class="empty-state">
                                        <i class="fas fa-spinner fa-spin"></i>
                                        <h3>Loading results...</h3>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!-- Pagination -->
                <div class="table-footer" id="paginationControls">
                    <div class="pagination-info">
                        Showing <span id="pageStart">0</span> - <span id="pageEnd">0</span> of <span id="totalItems">0</span>
                    </div>
                    <div class="pagination-buttons">
                        <button class="btn-secondary btn-sm" onclick="Results.prevPage()" id="prevPageBtn" disabled>
                            <i class="fas fa-chevron-left"></i> Prev
                        </button>
                        <span id="pageInfo">Page 1 of 1</span>
                        <button class="btn-secondary btn-sm" onclick="Results.nextPage()" id="nextPageBtn" disabled>
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // ============================================================
    // ADD STYLES
    // ============================================================

    addStyles() {
        if (document.getElementById('resultsStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'resultsStyles';
        style.textContent = `
            .table-footer {
                padding: 12px 20px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
                background: #f8fafc;
            }
            .pagination-info {
                font-size: 13px;
                color: #6b7280;
            }
            .pagination-buttons {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .pagination-buttons #pageInfo {
                font-size: 13px;
                color: #6b7280;
                min-width: 80px;
                text-align: center;
            }
            .score-bar {
                width: 100%;
                height: 6px;
                background: #f3f4f6;
                border-radius: 3px;
                overflow: hidden;
                margin-top: 4px;
            }
            .score-bar .score-fill {
                height: 100%;
                border-radius: 3px;
                transition: width 0.6s ease;
            }
            .score-bar .score-fill.high { background: #10b981; }
            .score-bar .score-fill.medium { background: #f59e0b; }
            .score-bar .score-fill.low { background: #ef4444; }
            
            /* Attempts Modal Styles */
            .attempts-modal-wrapper {
                padding: 4px 0;
            }
            .attempts-modal-wrapper .summary-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 12px;
                margin-bottom: 20px;
                padding: 16px;
                background: #f8fafc;
                border-radius: 10px;
                border: 1px solid #e5e7eb;
            }
            .attempts-modal-wrapper .summary-grid .summary-item {
                display: flex;
                flex-direction: column;
            }
            .attempts-modal-wrapper .summary-grid .summary-item .label {
                font-size: 11px;
                text-transform: uppercase;
                color: #6b7280;
                font-weight: 600;
                letter-spacing: 0.5px;
            }
            .attempts-modal-wrapper .summary-grid .summary-item .value {
                font-size: 16px;
                font-weight: 700;
                color: #1a1f2c;
                margin-top: 2px;
            }
            .attempts-modal-wrapper .summary-grid .summary-item .value.passed { color: #16a34a; }
            .attempts-modal-wrapper .summary-grid .summary-item .value.failed { color: #dc2626; }
            
            .attempts-table-wrapper {
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                overflow: hidden;
            }
            .attempts-table-wrapper table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
                min-width: auto;
            }
            .attempts-table-wrapper th {
                background: #f8fafc;
                padding: 10px 14px;
                text-align: left;
                font-size: 11px;
                font-weight: 600;
                color: #6b7280;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-bottom: 1px solid #e5e7eb;
            }
            .attempts-table-wrapper td {
                padding: 10px 14px;
                border-bottom: 1px solid #f3f4f6;
                vertical-align: middle;
            }
            .attempts-table-wrapper tr:last-child td {
                border-bottom: none;
            }
            .attempts-table-wrapper tr:hover td {
                background: #fafafa;
            }
            .attempts-table-wrapper .attempt-badge {
                display: inline-block;
                padding: 2px 12px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
            }
            .attempts-table-wrapper .attempt-badge.latest {
                background: #dbeafe;
                color: #1d4ed8;
            }
            .attempts-table-wrapper .attempt-badge.attempt-num {
                background: #f3f4f6;
                color: #4b5563;
            }
            .attempts-table-wrapper .status-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
            }
            .attempts-table-wrapper .status-badge.passed {
                background: #dcfce7;
                color: #166534;
            }
            .attempts-table-wrapper .status-badge.failed {
                background: #fee2e2;
                color: #991b1b;
            }
            .attempts-table-wrapper .score-cell {
                font-weight: 700;
            }
            .attempts-table-wrapper .score-cell.high { color: #16a34a; }
            .attempts-table-wrapper .score-cell.medium { color: #d97706; }
            .attempts-table-wrapper .score-cell.low { color: #dc2626; }
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
            
            this.allAssessments = [];
            const select = document.getElementById('filterAssessment');
            
            if (select) {
                while (select.options.length > 1) {
                    select.remove(1);
                }
            }
            
            snapshot.forEach(doc => {
                const data = doc.data();
                this.allAssessments.push({ id: doc.id, ...data });
                if (select) {
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = data.title || 'Untitled Assessment';
                    select.appendChild(option);
                }
            });
            
        } catch (error) {
            console.error('Error loading assessments:', error);
        }
    },

    // ============================================================
    // LOAD STUDENTS
    // ============================================================

    async loadStudents() {
        try {
            const snapshot = await this.db.collection('users')
                .orderBy('firstName')
                .get();
            
            this.allStudents = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                this.allStudents.push({ id: doc.id, ...data });
            });
            
        } catch (error) {
            console.error('Error loading students:', error);
        }
    },

    // ============================================================
    // LOAD RESULTS - GROUP BY STUDENT + ASSESSMENT
    // ============================================================

    async loadResults() {
        try {
            const snapshot = await this.db.collection('studentResults')
                .orderBy('submittedAt', 'desc')
                .get();

            // Group by studentId + assessmentId
            const groups = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                const key = `${data.studentId || 'unknown'}_${data.assessmentId || 'unknown'}`;
                if (!groups[key]) {
                    groups[key] = {
                        studentId: data.studentId,
                        assessmentId: data.assessmentId,
                        attempts: []
                    };
                }
                groups[key].attempts.push({ id: doc.id, ...data });
            });

            // Convert groups to array and sort attempts
            this.allResults = Object.values(groups).map(group => {
                // Sort attempts by attemptNumber descending (latest first)
                group.attempts.sort((a, b) => (b.attemptNumber || 0) - (a.attemptNumber || 0));
                // Compute latest attempt
                const latest = group.attempts[0] || {};
                return {
                    ...group,
                    studentId: group.studentId,
                    assessmentId: group.assessmentId,
                    latestScore: latest.score || 0,
                    passed: latest.passed || false,
                    lastAttemptDate: latest.submittedAt || null,
                    attemptCount: group.attempts.length,
                    attempts: group.attempts
                };
            });

            this.filteredResults = [...this.allResults];
            
            this.updateStats();
            this.renderTable();

        } catch (error) {
            console.error('Error loading results:', error);
            const container = document.getElementById('resultsBody');
            if (container) {
                container.innerHTML = `
                    <tr>
                        <td colspan="8">
                            <div style="text-align: center; padding: 40px; color: #dc2626;">
                                <i class="fas fa-exclamation-circle" style="font-size: 32px; display: block; margin-bottom: 12px;"></i>
                                <p>Error loading results: ${error.message}</p>
                                <button onclick="Results.loadResults()" class="btn-primary" style="margin-top: 12px; display: inline-flex; width: auto; padding: 8px 20px;">
                                    <i class="fas fa-redo"></i> Retry
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
        // Stats over all individual attempts (not groups)
        let totalAttempts = 0;
        let passed = 0;
        let failed = 0;
        let totalScore = 0;
        let scoreCount = 0;

        this.allResults.forEach(group => {
            group.attempts.forEach(attempt => {
                totalAttempts++;
                if (attempt.passed === true) passed++;
                else if (attempt.passed === false) failed++;
                if (attempt.score !== undefined && attempt.score !== null) {
                    totalScore += attempt.score;
                    scoreCount++;
                }
            });
        });

        const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

        document.getElementById('statTotal').textContent = totalAttempts;
        document.getElementById('statPassed').textContent = passed;
        document.getElementById('statFailed').textContent = failed;
        document.getElementById('statAvgScore').textContent = avgScore + '%';
    },

    // ============================================================
    // RENDER TABLE - GROUPED ROWS
    // ============================================================

    renderTable() {
        const container = document.getElementById('resultsBody');
        const countEl = document.getElementById('resultCount');
        
        if (!container) return;

        const totalItems = this.filteredResults.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / this.itemsPerPage));
        
        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }
        
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = Math.min(start + this.itemsPerPage, totalItems);
        const pageItems = this.filteredResults.slice(start, end);

        if (countEl) {
            countEl.textContent = `${totalItems} groups`;
        }

        this.updatePagination(totalItems, totalPages, start, end);

        if (pageItems.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="empty-state">
                            <i class="fas fa-chart-bar"></i>
                            <h3>${this.allResults.length === 0 ? 'No results yet' : 'No matching results'}</h3>
                            <p>${this.allResults.length === 0 ? 'Results will appear after students complete assessments' : 'Try adjusting your filters'}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        pageItems.forEach((group) => {
            const isSelected = this.selectedResults.includes(group.studentId + '_' + group.assessmentId);
            const studentName = this.getStudentName(group.studentId);
            const assessmentTitle = this.getAssessmentTitle(group.assessmentId);
            const statusClass = group.passed ? 'passed' : 'failed';
            const statusLabel = group.passed ? 'Passed' : 'Failed';
            const score = group.latestScore || 0;
            
            let scoreClass = 'low';
            if (score >= 70) scoreClass = 'high';
            else if (score >= 50) scoreClass = 'medium';
            
            const lastDate = group.lastAttemptDate ? this.formatDate(group.lastAttemptDate) : 'N/A';
            
            html += `
                <tr>
                    <td>
                        <input type="checkbox" class="result-select" data-id="${group.studentId}_${group.assessmentId}" ${isSelected ? 'checked' : ''} onchange="Results.toggleSelect('${group.studentId}_${group.assessmentId}')">
                    </td>
                    <td>
                        <div style="font-weight: 500; color: #1a1f2c;">${this.escapeHtml(studentName)}</div>
                        <div style="font-size: 12px; color: #6b7280;">${this.escapeHtml(group.studentId || 'N/A')}</div>
                    </td>
                    <td>
                        <div style="font-weight: 500; color: #1a1f2c;">${this.escapeHtml(assessmentTitle)}</div>
                        <div style="font-size: 12px; color: #6b7280;">${this.escapeHtml(group.assessmentId || 'N/A')}</div>
                    </td>
                    <td>
                        <div style="font-weight: 700; color: ${score >= 70 ? '#166534' : score >= 50 ? '#d97706' : '#dc2626'};">
                            ${score}%
                        </div>
                        <div class="score-bar">
                            <div class="score-fill ${scoreClass}" style="width: ${Math.min(score, 100)}%"></div>
                        </div>
                    </td>
                    <td>
                        <span class="badge-status ${statusClass}">
                            <i class="fas ${group.passed ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                            ${statusLabel}
                        </span>
                    </td>
                    <td>
                        <span class="attempt-badge ${group.attemptCount > 1 ? 'latest' : ''}">
                            ${group.attemptCount} attempt${group.attemptCount > 1 ? 's' : ''}
                        </span>
                    </td>
                    <td>${lastDate}</td>
                    <td>
                        <div class="action-btns">
                            <button class="view" onclick="Results.viewGroup('${group.studentId}', '${group.assessmentId}')" title="View All Attempts">
                                <i class="fas fa-list"></i>
                            </button>
                            <button class="export" onclick="Results.exportGroup('${group.studentId}', '${group.assessmentId}')" title="Export All">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="delete" onclick="Results.deleteGroup('${group.studentId}', '${group.assessmentId}')" title="Delete All Attempts">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = html;
    },

    // ============================================================
    // GET STUDENT / ASSESSMENT NAMES
    // ============================================================

    getStudentName(studentId) {
        if (!studentId) return 'Unknown Student';
        const student = this.allStudents.find(s => s.studentId === studentId || s.id === studentId);
        if (student) {
            const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
            return name || student.studentId || student.id || studentId;
        }
        return studentId;
    },

    getAssessmentTitle(assessmentId) {
        if (!assessmentId) return 'Unknown Assessment';
        const assessment = this.allAssessments.find(a => a.id === assessmentId);
        return assessment ? assessment.title || 'Untitled' : assessmentId;
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
        const totalPages = Math.ceil(this.filteredResults.length / this.itemsPerPage);
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
    // FILTER - works on grouped results
    // ============================================================

    filter() {
        const search = document.getElementById('resultSearch')?.value?.toLowerCase() || '';
        const assessmentId = document.getElementById('filterAssessment')?.value || '';
        const status = document.getElementById('filterStatus')?.value || '';
        const dateFilter = document.getElementById('filterDate')?.value || '';

        this.filteredResults = this.allResults.filter(group => {
            let match = true;
            const studentName = this.getStudentName(group.studentId).toLowerCase();
            const assessmentTitle = this.getAssessmentTitle(group.assessmentId).toLowerCase();
            
            if (search) {
                match = match && (
                    studentName.includes(search) ||
                    assessmentTitle.includes(search) ||
                    (group.studentId || '').toLowerCase().includes(search)
                );
            }
            if (assessmentId) {
                match = match && group.assessmentId === assessmentId;
            }
            if (status) {
                if (status === 'passed') match = match && group.passed === true;
                else if (status === 'failed') match = match && group.passed === false;
            }
            if (dateFilter) {
                // Use latest attempt date for filtering
                const date = group.lastAttemptDate?.toDate?.() || new Date(group.lastAttemptDate || 0);
                const now = new Date();
                if (dateFilter === 'today') {
                    match = match && date.toDateString() === now.toDateString();
                } else if (dateFilter === 'week') {
                    const weekAgo = new Date(now);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    match = match && date >= weekAgo;
                } else if (dateFilter === 'month') {
                    const monthAgo = new Date(now);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    match = match && date >= monthAgo;
                }
            }
            
            return match;
        });

        this.currentPage = 1;
        this.renderTable();
    },

    // ============================================================
    // SELECTION
    // ============================================================

    toggleSelect(key) {
        const index = this.selectedResults.indexOf(key);
        if (index > -1) {
            this.selectedResults.splice(index, 1);
        } else {
            this.selectedResults.push(key);
        }
        this.renderTable();
    },

    toggleSelectAll() {
        const checked = document.getElementById('selectAll')?.checked || false;
        const visibleKeys = this.filteredResults
            .slice((this.currentPage - 1) * this.itemsPerPage, this.currentPage * this.itemsPerPage)
            .map(group => `${group.studentId}_${group.assessmentId}`);
        
        if (checked) {
            visibleKeys.forEach(key => {
                if (!this.selectedResults.includes(key)) {
                    this.selectedResults.push(key);
                }
            });
        } else {
            this.selectedResults = this.selectedResults.filter(key => !visibleKeys.includes(key));
        }
        this.renderTable();
    },

    // ============================================================
    // VIEW GROUP - Show all attempts in a professional modal
    // ============================================================

    viewGroup(studentId, assessmentId) {
        const group = this.allResults.find(g => g.studentId === studentId && g.assessmentId === assessmentId);
        if (!group) {
            showToast('Group not found', true);
            return;
        }

        const studentName = this.getStudentName(studentId);
        const assessmentTitle = this.getAssessmentTitle(assessmentId);

        // Build attempts table
        let attemptsRows = '';
        group.attempts.forEach((attempt, idx) => {
            const isLatest = idx === 0;
            const statusClass = attempt.passed ? 'passed' : 'failed';
            const statusLabel = attempt.passed ? 'Passed' : 'Failed';
            const date = this.formatDate(attempt.submittedAt);
            const score = attempt.score || 0;
            let scoreClass = 'low';
            if (score >= 70) scoreClass = 'high';
            else if (score >= 50) scoreClass = 'medium';
            
            attemptsRows += `
                <tr>
                    <td>
                        <span class="attempt-badge ${isLatest ? 'latest' : 'attempt-num'}">
                            #${attempt.attemptNumber || (idx+1)} ${isLatest ? '⭐ Latest' : ''}
                        </span>
                    </td>
                    <td class="score-cell ${scoreClass}">${score}%</td>
                    <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                    <td>${date}</td>
                </tr>
            `;
        });

        const content = `
            <div class="attempts-modal-wrapper">
                <!-- Summary Grid -->
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="label">Student</span>
                        <span class="value">${this.escapeHtml(studentName)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Student ID</span>
                        <span class="value">${this.escapeHtml(studentId || 'N/A')}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Assessment</span>
                        <span class="value">${this.escapeHtml(assessmentTitle)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Attempts</span>
                        <span class="value">${group.attempts.length}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Latest Score</span>
                        <span class="value ${group.passed ? 'passed' : 'failed'}">${group.latestScore || 0}%</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Latest Status</span>
                        <span class="value ${group.passed ? 'passed' : 'failed'}">${group.passed ? '✅ Passed' : '❌ Failed'}</span>
                    </div>
                </div>

                <!-- Attempts Table -->
                <h4 style="font-size: 14px; font-weight: 600; color: #1a1f2c; margin-bottom: 10px;">
                    <i class="fas fa-list-ul" style="color: #166534;"></i> All Attempts
                </h4>
                <div class="attempts-table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Attempt</th>
                                <th>Score</th>
                                <th>Status</th>
                                <th>Submitted</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${attemptsRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.openModal('Attempts for ' + studentName, content);
    },

    // ============================================================
    // EXPORT GROUP - Export all attempts as CSV
    // ============================================================

    exportGroup(studentId, assessmentId) {
        const group = this.allResults.find(g => g.studentId === studentId && g.assessmentId === assessmentId);
        if (!group) {
            showToast('Group not found', true);
            return;
        }

        const studentName = this.getStudentName(studentId);
        const assessmentTitle = this.getAssessmentTitle(assessmentId);
        const headers = ['Student ID', 'Student Name', 'Assessment', 'Attempt', 'Score', 'Status', 'Submitted'];
        const rows = group.attempts.map((attempt, idx) => [
            studentId || 'N/A',
            studentName,
            assessmentTitle,
            attempt.attemptNumber || (idx+1),
            attempt.score || 0,
            attempt.passed ? 'Passed' : 'Failed',
            this.formatDate(attempt.submittedAt)
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `results_${studentId}_${assessmentId}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Attempts exported successfully!');
    },

    // ============================================================
    // DELETE GROUP - Delete all attempts for this student/assessment
    // ============================================================

    async deleteGroup(studentId, assessmentId) {
        if (!confirm(`Delete all attempts for student ${studentId} on assessment ${assessmentId}? This cannot be undone.`)) {
            return;
        }

        try {
            const snapshot = await this.db.collection('studentResults')
                .where('studentId', '==', studentId)
                .where('assessmentId', '==', assessmentId)
                .get();

            const batch = this.db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            showToast('All attempts deleted successfully');
            await this.loadResults();
        } catch (error) {
            console.error('Error deleting group:', error);
            showToast('Error deleting attempts: ' + error.message, true);
        }
    },

    // ============================================================
    // EXPORT ALL RESULTS (all groups as CSV)
    // ============================================================

    exportResults() {
        if (this.filteredResults.length === 0) {
            showToast('No results to export', true);
            return;
        }

        const headers = ['Student ID', 'Student Name', 'Assessment', 'Attempt', 'Score', 'Status', 'Submitted'];
        const rows = [];
        this.filteredResults.forEach(group => {
            const studentName = this.getStudentName(group.studentId);
            const assessmentTitle = this.getAssessmentTitle(group.assessmentId);
            group.attempts.forEach((attempt, idx) => {
                rows.push([
                    group.studentId || 'N/A',
                    studentName,
                    assessmentTitle,
                    attempt.attemptNumber || (idx+1),
                    attempt.score || 0,
                    attempt.passed ? 'Passed' : 'Failed',
                    this.formatDate(attempt.submittedAt)
                ]);
            });
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `all_results_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('All results exported successfully!');
    },

    // ============================================================
    // MODAL HELPERS
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
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'N/A';
        }
    }
};

// ============================================================
// EXPORT FOR GLOBAL ACCESS
// ============================================================

window.Results = Results;