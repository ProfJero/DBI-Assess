// ============================================================
// ADMIN STUDENTS - COMPLETE STUDENT MANAGEMENT
// Now uses Main DB (rth-admin-dues) -> eventRegistrations
// ============================================================

const Students = {
    app: null,
    db: null,
    currentStudent: null,
    allStudents: [],
    filteredStudents: [],
    selectedStudents: [],
    currentPage: 1,
    itemsPerPage: 20,
    filters: {
        search: '',
        status: '',
        school: '',
        educationLevel: '',
        sortBy: 'newest'
    },

    // ============================================================
    // RENDER - Main entry point
    // ============================================================

    render(container, app) {
        this.app = app;
        this.db = app.db || app;
        
        container.innerHTML = this.getHTML();
        this.addStyles();
        
        setTimeout(() => {
            this.loadStudents();
        }, 100);
    },

    // ============================================================
    // GET HTML (unchanged)
    // ============================================================

    getHTML() {
        return `
            <!-- Stats Cards -->
            <div class="stats-grid" id="studentStats">
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="fas fa-users"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statTotal">0</div>
                        <div class="stat-label">Total Students</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="fas fa-user-check"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statActive">0</div>
                        <div class="stat-label">Active</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange"><i class="fas fa-user-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statPending">0</div>
                        <div class="stat-label">Pending</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red"><i class="fas fa-user-slash"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statSuspended">0</div>
                        <div class="stat-label">Suspended</div>
                    </div>
                </div>
            </div>

            <!-- Filter Bar -->
            <div class="filter-bar">
                <div class="filter-group search-group">
                    <i class="fas fa-search"></i>
                    <input type="text" id="studentSearch" placeholder="Search by name, ID, email..." oninput="Students.debounceFilter()">
                </div>
                <div class="filter-group">
                    <select id="filterStatus" onchange="Students.filter()">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="suspended">Suspended</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterSchool" onchange="Students.filter()">
                        <option value="">All Schools</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterEducationLevel" onchange="Students.filter()">
                        <option value="">All Education Levels</option>
                        <option value="jhs-1">JHS 1</option>
                        <option value="jhs-2">JHS 2</option>
                        <option value="jhs-3">JHS 3</option>
                        <option value="shs-1">SHS 1</option>
                        <option value="shs-2">SHS 2</option>
                        <option value="shs-3">SHS 3</option>
                        <option value="year-1">Year 1 (Tertiary)</option>
                        <option value="year-2">Year 2 (Tertiary)</option>
                        <option value="year-3">Year 3 (Tertiary)</option>
                        <option value="year-4">Year 4 (Tertiary)</option>
                        <option value="postgraduate">Postgraduate</option>
                        <option value="other">Other</option>
                    </select>
                </div>
            </div>

            <!-- Bulk Actions Bar -->
            <div class="bulk-actions-bar" id="bulkActionsBar" style="display: none;">
                <span id="selectedCount">0 students selected</span>
                <div class="bulk-actions">
                    <button class="btn-secondary btn-sm" onclick="Students.bulkSuspend()">
                        <i class="fas fa-pause"></i> Suspend
                    </button>
                    <button class="btn-secondary btn-sm" onclick="Students.bulkActivate()">
                        <i class="fas fa-play"></i> Activate
                    </button>
                    <button class="btn-secondary btn-sm" onclick="Students.bulkDelete()">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button class="btn-secondary btn-sm" onclick="Students.clearSelection()">
                        <i class="fas fa-times"></i> Clear
                    </button>
                </div>
            </div>

            <!-- Students Table -->
            <div class="table-container">
                <div class="table-header">
                    <span>All Students</span>
                    <span class="table-count" id="studentCount">0 items</span>
                </div>
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 36px;">
                                    <input type="checkbox" id="selectAll" onchange="Students.toggleSelectAll()">
                                </th>
                                <th>Student ID</th>
                                <th>Name</th>
                                <th>School</th>
                                <th>Education Level</th>
                                <th>Status</th>
                                <th>Registered</th>
                                <th style="width: 120px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="studentsBody">
                            <tr>
                                <td colspan="8">
                                    <div class="empty-state">
                                        <i class="fas fa-spinner fa-spin"></i>
                                        <h3>Loading students...</h3>
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
                        <button class="btn-secondary btn-sm" onclick="Students.prevPage()" id="prevPageBtn" disabled>
                            <i class="fas fa-chevron-left"></i> Prev
                        </button>
                        <span id="pageInfo">Page 1 of 1</span>
                        <button class="btn-secondary btn-sm" onclick="Students.nextPage()" id="nextPageBtn" disabled>
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // ============================================================
    // ADD STYLES – UPDATED with full modal styles
    // ============================================================

    addStyles() {
        if (document.getElementById('studentsStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'studentsStyles';
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
            .bulk-actions-bar {
                background: #f0fdf4;
                border: 1px solid #86efac;
                border-radius: 10px;
                padding: 12px 16px;
                margin-bottom: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }
            .bulk-actions-bar #selectedCount {
                font-weight: 600;
                color: #166534;
                font-size: 14px;
            }
            .bulk-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            /* ===== MODAL STYLES ===== */
            .modal-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 9999;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }
            .modal-overlay.show {
                display: flex;
            }
            .modal {
                background: white;
                border-radius: 12px;
                max-width: 600px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: modalSlideIn 0.25s ease-out;
            }
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            .modal-header {
                padding: 16px 20px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: sticky;
                top: 0;
                background: white;
                border-radius: 12px 12px 0 0;
                z-index: 1;
            }
            .modal-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 700;
                color: #1a1f2c;
            }
            .modal-header .close-modal {
                background: none;
                border: none;
                font-size: 28px;
                line-height: 1;
                cursor: pointer;
                color: #6b7280;
                transition: color 0.2s ease;
            }
            .modal-header .close-modal:hover {
                color: #1a1f2c;
            }
            .modal-body {
                padding: 20px;
            }
            .modal-body-inner .form-group {
                margin-bottom: 14px;
            }
            .modal-body-inner .form-group label {
                display: block;
                font-weight: 600;
                margin-bottom: 4px;
                font-size: 13px;
                color: #1a1f2c;
            }
            .modal-body-inner .form-group .required {
                color: #dc2626;
                margin-left: 2px;
            }
            .modal-body-inner .form-group input,
            .modal-body-inner .form-group select {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                font-size: 13px;
                font-family: 'Inter', sans-serif;
                background: #f8fafc;
                transition: border-color 0.2s ease;
            }
            .modal-body-inner .form-group input:focus,
            .modal-body-inner .form-group select:focus {
                border-color: #22c55e;
                outline: none;
                background: white;
            }
            .modal-body-inner .help-text {
                font-size: 12px;
                color: #6b7280;
                margin-top: 4px;
            }
            .modal-body-inner .form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }
            .modal-body-inner .btn-primary {
                background: linear-gradient(135deg, #166534, #22c55e);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 10px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                justify-content: center;
                width: 100%;
            }
            .modal-body-inner .btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 15px rgba(22, 101, 52, 0.3);
            }
            .badge-status {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 14px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
            }
            .badge-status.active { background: #dcfce7; color: #166534; }
            .badge-status.inactive { background: #fee2e2; color: #991b1b; }
            .badge-status.pending { background: #fef3c7; color: #92400e; }
            .badge-status.suspended { background: #f3f4f6; color: #4b5563; }

            @media (max-width: 480px) {
                .modal-body-inner .form-row {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    },

    // ============================================================
    // LOAD STUDENTS - NOW FROM MAIN DB (eventRegistrations)
    // ============================================================

    async loadStudents() {
        try {
            const snapshot = await this.db.collection('eventRegistrations')
                .orderBy('createdAt', 'desc')
                .get();

            this.allStudents = [];
            const schools = new Set();
            
            snapshot.forEach(doc => {
                const data = doc.data();
                data.status = data.status || 'active';
                this.allStudents.push({ id: doc.id, ...data });
                if (data.school) schools.add(data.school);
            });

            this.filteredStudents = [...this.allStudents];
            this.populateSchoolFilter(schools);
            this.updateStats();
            this.renderTable();

        } catch (error) {
            console.error('Error loading students:', error);
            const container = document.getElementById('studentsBody');
            if (container) {
                container.innerHTML = `
                    <tr>
                        <td colspan="8">
                            <div style="text-align: center; padding: 40px; color: #dc2626;">
                                <i class="fas fa-exclamation-circle" style="font-size: 32px; display: block; margin-bottom: 12px;"></i>
                                <p>Error loading students: ${error.message}</p>
                                <button onclick="Students.loadStudents()" class="btn-primary" style="margin-top: 12px; display: inline-flex; width: auto; padding: 8px 20px;">
                                    <i class="fas fa-redo"></i> Retry
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    },

    populateSchoolFilter(schools) {
        const select = document.getElementById('filterSchool');
        if (!select) return;
        while (select.options.length > 1) {
            select.remove(1);
        }
        const sortedSchools = Array.from(schools).sort();
        sortedSchools.forEach(school => {
            if (school && school.trim()) {
                const option = document.createElement('option');
                option.value = school;
                option.textContent = school;
                select.appendChild(option);
            }
        });
    },

    // ============================================================
    // UPDATE STATS
    // ============================================================

    updateStats() {
        const total = this.allStudents.length;
        const active = this.allStudents.filter(s => s.status === 'active').length;
        const pending = this.allStudents.filter(s => s.status === 'pending').length;
        const suspended = this.allStudents.filter(s => s.status === 'suspended' || s.status === 'inactive').length;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statActive').textContent = active;
        document.getElementById('statPending').textContent = pending;
        document.getElementById('statSuspended').textContent = suspended;
        document.getElementById('studentCount').textContent = total;
    },

    // ============================================================
    // RENDER TABLE
    // ============================================================

    renderTable() {
        const container = document.getElementById('studentsBody');
        const countEl = document.getElementById('studentCount');
        if (!container) return;

        const totalItems = this.filteredStudents.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / this.itemsPerPage));
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = Math.min(start + this.itemsPerPage, totalItems);
        const pageItems = this.filteredStudents.slice(start, end);

        countEl.textContent = `${totalItems} items`;
        this.updatePagination(totalItems, totalPages, start, end);

        if (pageItems.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <h3>${this.allStudents.length === 0 ? 'No students registered' : 'No matching students'}</h3>
                            <p>${this.allStudents.length === 0 ? 'Students will appear here after registration' : 'Try adjusting your filters'}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        pageItems.forEach((student) => {
            const isSelected = this.selectedStudents.includes(student.id);
            const name = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'N/A';
            const statusClass = student.status || 'active';
            const statusLabels = { active: 'Active', pending: 'Pending', suspended: 'Suspended', inactive: 'Inactive' };
            const statusIcons = { active: 'fa-check-circle', pending: 'fa-clock', suspended: 'fa-ban', inactive: 'fa-times-circle' };
            
            html += `
                <tr>
                    <td>
                        <input type="checkbox" class="student-select" data-id="${student.id}" ${isSelected ? 'checked' : ''} onchange="Students.toggleSelect('${student.id}')">
                    </td>
                    <td><strong>${this.escapeHtml(student.studentId || 'N/A')}</strong></td>
                    <td>${this.escapeHtml(name)}</td>
                    <td>${this.escapeHtml(student.school || 'N/A')}</td>
                    <td>${this.escapeHtml(this.getEducationLevelLabel(student.educationLevel || ''))}</td>
                    <td><span class="badge-status ${statusClass}"><i class="fas ${statusIcons[statusClass] || 'fa-circle'}"></i> ${statusLabels[statusClass] || statusClass}</span></td>
                    <td>${this.formatDate(student.createdAt)}</td>
                    <td>
                        <div class="action-btns">
                            <button class="view" onclick="Students.viewStudent('${student.id}')" title="View">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="edit" onclick="Students.openEdit('${student.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${student.status === 'active' ? `
                                <button class="suspend" onclick="Students.suspendStudent('${student.id}')" title="Suspend" style="color: #d97706;">
                                    <i class="fas fa-pause"></i>
                                </button>
                            ` : student.status === 'suspended' ? `
                                <button class="edit" onclick="Students.activateStudent('${student.id}')" title="Activate" style="color: #166534;">
                                    <i class="fas fa-play"></i>
                                </button>
                            ` : ''}
                            <button class="delete" onclick="Students.deleteStudent('${student.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = html;
        this.updateBulkActions();
    },

    getEducationLevelLabel(value) {
        const labels = {
            'jhs-1': 'JHS 1',
            'jhs-2': 'JHS 2',
            'jhs-3': 'JHS 3',
            'shs-1': 'SHS 1',
            'shs-2': 'SHS 2',
            'shs-3': 'SHS 3',
            'year-1': 'Year 1 (Tertiary)',
            'year-2': 'Year 2 (Tertiary)',
            'year-3': 'Year 3 (Tertiary)',
            'year-4': 'Year 4 (Tertiary)',
            'postgraduate': 'Postgraduate',
            'other': 'Other'
        };
        return labels[value] || value || 'N/A';
    },

    // ============================================================
    // PAGINATION
    // ============================================================

    updatePagination(totalItems, totalPages, start, end) {
        document.getElementById('pageStart').textContent = totalItems > 0 ? start + 1 : 0;
        document.getElementById('pageEnd').textContent = end;
        document.getElementById('totalItems').textContent = totalItems;
        document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${totalPages || 1}`;
        document.getElementById('prevPageBtn').disabled = this.currentPage <= 1;
        document.getElementById('nextPageBtn').disabled = this.currentPage >= totalPages;
    },

    nextPage() {
        const totalPages = Math.ceil(this.filteredStudents.length / this.itemsPerPage);
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
    // FILTERING
    // ============================================================

    debounceFilter() {
        clearTimeout(this._filterTimeout);
        this._filterTimeout = setTimeout(() => this.filter(), 300);
    },

    filter() {
        const search = document.getElementById('studentSearch')?.value?.toLowerCase() || '';
        const status = document.getElementById('filterStatus')?.value || '';
        const school = document.getElementById('filterSchool')?.value || '';
        const educationLevel = document.getElementById('filterEducationLevel')?.value || '';

        this.filteredStudents = this.allStudents.filter(s => {
            const name = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
            let match = true;
            if (search) match = match && (name.includes(search) || (s.studentId || '').toLowerCase().includes(search) || (s.email || '').toLowerCase().includes(search));
            if (status) match = match && (s.status || 'active') === status;
            if (school) match = match && (s.school || '') === school;
            if (educationLevel) match = match && (s.educationLevel || '') === educationLevel;
            return match;
        });

        this.currentPage = 1;
        this.renderTable();
    },

    // ============================================================
    // SELECTION
    // ============================================================

    toggleSelect(id) {
        const index = this.selectedStudents.indexOf(id);
        if (index > -1) this.selectedStudents.splice(index, 1);
        else this.selectedStudents.push(id);
        this.updateBulkActions();
        this.renderTable();
    },

    toggleSelectAll() {
        const checked = document.getElementById('selectAll')?.checked || false;
        const visibleIds = this.filteredStudents
            .slice((this.currentPage - 1) * this.itemsPerPage, this.currentPage * this.itemsPerPage)
            .map(s => s.id);
        if (checked) {
            visibleIds.forEach(id => {
                if (!this.selectedStudents.includes(id)) this.selectedStudents.push(id);
            });
        } else {
            this.selectedStudents = this.selectedStudents.filter(id => !visibleIds.includes(id));
        }
        this.updateBulkActions();
        this.renderTable();
    },

    clearSelection() {
        this.selectedStudents = [];
        document.getElementById('selectAll').checked = false;
        this.updateBulkActions();
        this.renderTable();
    },

    updateBulkActions() {
        const bar = document.getElementById('bulkActionsBar');
        const count = document.getElementById('selectedCount');
        if (!bar) return;
        if (this.selectedStudents.length === 0) {
            bar.style.display = 'none';
            return;
        }
        bar.style.display = 'flex';
        count.textContent = `${this.selectedStudents.length} students selected`;
    },

    // ============================================================
    // VIEW STUDENT
    // ============================================================

    viewStudent(id) {
        const student = this.allStudents.find(s => s.id === id);
        if (!student) {
            if (window.showToast) window.showToast('Student not found', true);
            return;
        }
        const content = this.buildViewContent(student);
        this.openModal('Student Details', content);
    },

    buildViewContent(student) {
        const name = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'N/A';
        const statusClass = student.status || 'active';
        const statusLabels = { active: 'Active', pending: 'Pending', suspended: 'Suspended', inactive: 'Inactive' };
        return `
            <div class="modal-body-inner">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div><strong>Student ID:</strong> ${this.escapeHtml(student.studentId || 'N/A')}</div>
                    <div><strong>Name:</strong> ${this.escapeHtml(name)}</div>
                    <div><strong>Email:</strong> ${this.escapeHtml(student.email || 'N/A')}</div>
                    <div><strong>Phone:</strong> ${this.escapeHtml(student.phone || 'N/A')}</div>
                    <div><strong>School:</strong> ${this.escapeHtml(student.school || 'N/A')}</div>
                    <div><strong>Community:</strong> ${this.escapeHtml(student.community || 'N/A')}</div>
                    <div><strong>Education Level:</strong> ${this.escapeHtml(this.getEducationLevelLabel(student.educationLevel || ''))}</div>
                    <div><strong>Status:</strong> <span class="badge-status ${statusClass}">${statusLabels[statusClass] || statusClass}</span></div>
                    <div><strong>Gender:</strong> ${this.escapeHtml(student.gender || 'N/A')}</div>
                    <div><strong>Registered:</strong> ${this.formatDate(student.createdAt)}</div>
                </div>
                ${student.expectations ? `
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                        <strong>Learning Expectations:</strong>
                        <p style="margin-top: 4px; color: #4b5563;">${this.escapeHtml(student.expectations)}</p>
                    </div>
                ` : ''}
                ${student.howHeard ? `
                    <div style="margin-top: 8px;">
                        <strong>How Heard:</strong>
                        <span style="color: #4b5563;">${this.escapeHtml(student.howHeard)}</span>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // ============================================================
    // CREATE STUDENT
    // ============================================================

    openCreate() {
        const content = `
            <div class="modal-body-inner">
                <form id="studentForm" onsubmit="Students.saveStudent(event)">
                    <div class="form-group">
                        <label>Student ID <span class="required">*</span></label>
                        <input type="text" id="studentId" placeholder="e.g., DBI-26-001" required>
                        <div class="help-text"><i class="fas fa-info-circle"></i> Format: DBI-YY-XXX</div>
                    </div>
                    <div class="form-group">
                        <label>Password <span class="required">*</span></label>
                        <input type="text" id="studentPassword" placeholder="e.g., DBI#1234" required>
                        <div class="help-text"><i class="fas fa-info-circle"></i> Format: DBI#XXXX (4 random numbers)</div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>First Name <span class="required">*</span></label>
                            <input type="text" id="firstName" placeholder="First name" required>
                        </div>
                        <div class="form-group">
                            <label>Last Name <span class="required">*</span></label>
                            <input type="text" id="lastName" placeholder="Last name" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Gender</label>
                        <select id="gender">
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>School</label>
                        <input type="text" id="school" placeholder="e.g., Abura Dunkwa SHS">
                    </div>
                    <div class="form-group">
                        <label>Community</label>
                        <input type="text" id="community" placeholder="e.g., Ayeldu">
                    </div>
                    <div class="form-group">
                        <label>Education Level</label>
                        <select id="educationLevel">
                            <option value="">Select Education Level</option>
                            <option value="jhs-1">JHS 1</option>
                            <option value="jhs-2">JHS 2</option>
                            <option value="jhs-3">JHS 3</option>
                            <option value="shs-1">SHS 1</option>
                            <option value="shs-2">SHS 2</option>
                            <option value="shs-3">SHS 3</option>
                            <option value="year-1">Year 1 (Tertiary)</option>
                            <option value="year-2">Year 2 (Tertiary)</option>
                            <option value="year-3">Year 3 (Tertiary)</option>
                            <option value="year-4">Year 4 (Tertiary)</option>
                            <option value="postgraduate">Postgraduate</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="tel" id="phone" placeholder="+233 24 123 4567">
                    </div>
                    <div class="form-group">
                        <label>Email (Optional)</label>
                        <input type="email" id="email" placeholder="student@example.com">
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select id="status">
                            <option value="active">Active</option>
                            <option value="pending">Pending</option>
                            <option value="suspended">Suspended</option>
                        </select>
                    </div>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> Add Student
                    </button>
                </form>
            </div>
        `;
        this.openModal('Add New Student', content);
    },

    // ============================================================
    // SAVE STUDENT
    // ============================================================

    async saveStudent(e) {
        e.preventDefault();
        
        const studentId = document.getElementById('studentId').value.trim();
        const password = document.getElementById('studentPassword').value.trim();
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const gender = document.getElementById('gender').value;
        const school = document.getElementById('school').value.trim();
        const community = document.getElementById('community').value.trim();
        const educationLevel = document.getElementById('educationLevel').value;
        const phone = document.getElementById('phone').value.trim();
        const email = document.getElementById('email').value.trim();
        const status = document.getElementById('status').value;

        if (!studentId || !password || !firstName || !lastName) {
            if (window.showToast) window.showToast('Please fill in all required fields', true);
            return;
        }
        if (!studentId.match(/^DBI-\d{2}-\d{3}$/)) {
            if (window.showToast) window.showToast('Student ID must be in format: DBI-YY-XXX', true);
            return;
        }

        try {
            const existingQuery = await this.db.collection('eventRegistrations')
                .where('studentId', '==', studentId)
                .get();
            if (!existingQuery.empty) {
                if (window.showToast) window.showToast(`Student ID ${studentId} already exists`, true);
                return;
            }

            await this.db.collection('eventRegistrations').add({
                studentId, password, firstName, lastName,
                gender: gender || '', school: school || 'N/A',
                community: community || 'N/A', educationLevel: educationLevel || '',
                phone: phone || '', email: email || '',
                status: status || 'active',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (window.showToast) window.showToast('Student added successfully!');
            this.closeModal();
            await this.loadStudents();

        } catch (error) {
            console.error('Error saving student:', error);
            if (window.showToast) window.showToast('Error saving student: ' + error.message, true);
        }
    },

    // ============================================================
    // EDIT STUDENT
    // ============================================================

    async openEdit(id) {
        try {
            const doc = await this.db.collection('eventRegistrations').doc(id).get();
            if (!doc.exists) {
                if (window.showToast) window.showToast('Student not found', true);
                return;
            }
            const data = doc.data();
            data.status = data.status || 'active';
            this.currentStudent = { id: doc.id, ...data };

            const content = `
                <div class="modal-body-inner">
                    <form id="studentForm" onsubmit="Students.updateStudent(event)">
                        <div class="form-group">
                            <label>Student ID <span class="required">*</span></label>
                            <input type="text" id="studentId" value="${this.escapeHtml(data.studentId || '')}" required>
                            <div class="help-text"><i class="fas fa-info-circle"></i> Format: DBI-YY-XXX</div>
                        </div>
                        <div class="form-group">
                            <label>Password <span class="required">*</span></label>
                            <input type="text" id="studentPassword" value="${this.escapeHtml(data.password || '')}" required>
                            <div class="help-text"><i class="fas fa-info-circle"></i> Format: DBI#XXXX</div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>First Name <span class="required">*</span></label>
                                <input type="text" id="firstName" value="${this.escapeHtml(data.firstName || '')}" required>
                            </div>
                            <div class="form-group">
                                <label>Last Name <span class="required">*</span></label>
                                <input type="text" id="lastName" value="${this.escapeHtml(data.lastName || '')}" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Gender</label>
                            <select id="gender">
                                <option value="">Select Gender</option>
                                <option value="male" ${data.gender === 'male' ? 'selected' : ''}>Male</option>
                                <option value="female" ${data.gender === 'female' ? 'selected' : ''}>Female</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>School</label>
                            <input type="text" id="school" value="${this.escapeHtml(data.school || '')}">
                        </div>
                        <div class="form-group">
                            <label>Community</label>
                            <input type="text" id="community" value="${this.escapeHtml(data.community || '')}">
                        </div>
                        <div class="form-group">
                            <label>Education Level</label>
                            <select id="educationLevel">
                                <option value="">Select Education Level</option>
                                <option value="jhs-1" ${data.educationLevel === 'jhs-1' ? 'selected' : ''}>JHS 1</option>
                                <option value="jhs-2" ${data.educationLevel === 'jhs-2' ? 'selected' : ''}>JHS 2</option>
                                <option value="jhs-3" ${data.educationLevel === 'jhs-3' ? 'selected' : ''}>JHS 3</option>
                                <option value="shs-1" ${data.educationLevel === 'shs-1' ? 'selected' : ''}>SHS 1</option>
                                <option value="shs-2" ${data.educationLevel === 'shs-2' ? 'selected' : ''}>SHS 2</option>
                                <option value="shs-3" ${data.educationLevel === 'shs-3' ? 'selected' : ''}>SHS 3</option>
                                <option value="year-1" ${data.educationLevel === 'year-1' ? 'selected' : ''}>Year 1 (Tertiary)</option>
                                <option value="year-2" ${data.educationLevel === 'year-2' ? 'selected' : ''}>Year 2 (Tertiary)</option>
                                <option value="year-3" ${data.educationLevel === 'year-3' ? 'selected' : ''}>Year 3 (Tertiary)</option>
                                <option value="year-4" ${data.educationLevel === 'year-4' ? 'selected' : ''}>Year 4 (Tertiary)</option>
                                <option value="postgraduate" ${data.educationLevel === 'postgraduate' ? 'selected' : ''}>Postgraduate</option>
                                <option value="other" ${data.educationLevel === 'other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Phone</label>
                            <input type="tel" id="phone" value="${this.escapeHtml(data.phone || '')}">
                        </div>
                        <div class="form-group">
                            <label>Email (Optional)</label>
                            <input type="email" id="email" value="${this.escapeHtml(data.email || '')}">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="status">
                                <option value="active" ${data.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="pending" ${data.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="suspended" ${data.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                            </select>
                        </div>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> Update Student
                        </button>
                    </form>
                </div>
            `;
            this.openModal('Edit Student', content);

        } catch (error) {
            console.error('Error loading student:', error);
            if (window.showToast) window.showToast('Error loading student: ' + error.message, true);
        }
    },

    // ============================================================
    // UPDATE STUDENT
    // ============================================================

    async updateStudent(e) {
        e.preventDefault();
        const id = this.currentStudent.id;
        const studentId = document.getElementById('studentId').value.trim();
        const password = document.getElementById('studentPassword').value.trim();
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const gender = document.getElementById('gender').value;
        const school = document.getElementById('school').value.trim();
        const community = document.getElementById('community').value.trim();
        const educationLevel = document.getElementById('educationLevel').value;
        const phone = document.getElementById('phone').value.trim();
        const email = document.getElementById('email').value.trim();
        const status = document.getElementById('status').value;

        if (!studentId || !password || !firstName || !lastName) {
            if (window.showToast) window.showToast('Please fill in all required fields', true);
            return;
        }

        try {
            await this.db.collection('eventRegistrations').doc(id).update({
                studentId, password, firstName, lastName,
                gender: gender || '', school: school || 'N/A',
                community: community || 'N/A', educationLevel: educationLevel || '',
                phone: phone || '', email: email || '',
                status: status || 'active',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (window.showToast) window.showToast('Student updated successfully!');
            this.closeModal();
            await this.loadStudents();

        } catch (error) {
            console.error('Error updating student:', error);
            if (window.showToast) window.showToast('Error updating student: ' + error.message, true);
        }
    },

    // ============================================================
    // SUSPEND / ACTIVATE / DELETE
    // ============================================================

    async suspendStudent(id) {
        if (!confirm('Are you sure you want to suspend this student?')) return;
        try {
            await this.db.collection('eventRegistrations').doc(id).update({
                status: 'suspended',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (window.showToast) window.showToast('Student suspended successfully');
            await this.loadStudents();
        } catch (error) {
            console.error('Error suspending student:', error);
            if (window.showToast) window.showToast('Error suspending student: ' + error.message, true);
        }
    },

    async activateStudent(id) {
        if (!confirm('Are you sure you want to activate this student?')) return;
        try {
            await this.db.collection('eventRegistrations').doc(id).update({
                status: 'active',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (window.showToast) window.showToast('Student activated successfully');
            await this.loadStudents();
        } catch (error) {
            console.error('Error activating student:', error);
            if (window.showToast) window.showToast('Error activating student: ' + error.message, true);
        }
    },

    async deleteStudent(id) {
        if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) return;
        try {
            await this.db.collection('eventRegistrations').doc(id).delete();
            if (window.showToast) window.showToast('Student deleted successfully');
            await this.loadStudents();
        } catch (error) {
            console.error('Error deleting student:', error);
            if (window.showToast) window.showToast('Error deleting student: ' + error.message, true);
        }
    },

    // ============================================================
    // BULK OPERATIONS (stubbed)
    // ============================================================

    bulkSuspend() {
        if (this.selectedStudents.length === 0) return;
        if (!confirm(`Suspend ${this.selectedStudents.length} students?`)) return;
        if (window.showToast) window.showToast('Bulk suspend coming soon!');
    },

    bulkActivate() {
        if (this.selectedStudents.length === 0) return;
        if (!confirm(`Activate ${this.selectedStudents.length} students?`)) return;
        if (window.showToast) window.showToast('Bulk activate coming soon!');
    },

    bulkDelete() {
        if (this.selectedStudents.length === 0) return;
        if (!confirm(`Delete ${this.selectedStudents.length} students? This action cannot be undone.`)) return;
        if (window.showToast) window.showToast('Bulk delete coming soon!');
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
                    year: 'numeric', month: 'short', day: 'numeric'
                });
            }
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
        } catch {
            return 'N/A';
        }
    }
};

// ============================================================
// EXPORT FOR GLOBAL ACCESS
// ============================================================

window.Students = Students;