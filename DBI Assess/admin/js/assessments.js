// ============================================================
// ADMIN ASSESSMENTS - COMPLETE MANAGEMENT (WITH CERTIFICATE INTEGRATION)
// ============================================================

const Assessments = {
    app: null,
    db: null,
    currentAssessment: null,
    currentTab: 'basic',
    allAssessments: [],
    filteredAssessments: [],
    questions: [],
    
    // Pagination
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 1,

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
        }, 100);
    },

    // ============================================================
    // GET HTML
    // ============================================================

    getHTML() {
        return `
            <!-- Stats Cards -->
            <div class="stats-grid" id="assessmentStats">
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="fas fa-file-alt"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statTotal">0</div>
                        <div class="stat-label">Total Assessments</div>
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
                    <div class="stat-icon purple"><i class="fas fa-certificate"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statCertEligible">0</div>
                        <div class="stat-label">Certificate Eligible</div>
                    </div>
                </div>
            </div>

            <!-- Filter Bar -->
            <div class="filter-bar">
                <div class="filter-group search-group">
                    <i class="fas fa-search"></i>
                    <input type="text" id="assessmentSearch" placeholder="Search assessments..." oninput="Assessments.filter()">
                </div>
                <div class="filter-group">
                    <select id="filterStatus" onchange="Assessments.filter()">
                        <option value="">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="closed">Closed</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterType" onchange="Assessments.filter()">
                        <option value="">All Types</option>
                        <option value="quiz">Quiz</option>
                        <option value="assignment">Assignment</option>
                        <option value="practical">Practical</option>
                        <option value="coding">Coding Challenge</option>
                        <option value="survey">Survey</option>
                        <option value="final">Final Examination</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterDepartment" onchange="Assessments.filter()">
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
                <div class="filter-group" style="max-width: 180px;">
                    <select id="filterCertificate" onchange="Assessments.filter()">
                        <option value="">All Certificates</option>
                        <option value="eligible">Certificate Eligible</option>
                        <option value="not-eligible">Not Eligible</option>
                    </select>
                </div>
            </div>

            <!-- Assessment Table -->
            <div class="table-container">
                <div class="table-header">
                    <span>All Assessments</span>
                    <span class="table-count" id="assessmentCount">0 items</span>
                </div>
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Type</th>
                                <th>Department</th>
                                <th>Questions</th>
                                <th>Participants</th>
                                <th>Status</th>
                                <th>Certificate</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="assessmentsBody">
                            <tr>
                                <td colspan="9">
                                    <div class="empty-state">
                                        <i class="fas fa-spinner fa-spin"></i>
                                        <h3>Loading assessments...</h3>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!-- Pagination -->
                <div class="pagination-container" id="paginationContainer">
                    <div class="pagination-info" id="paginationInfo">Showing 0-0 of 0 items</div>
                    <div class="pagination-controls" id="paginationControls">
                        <button onclick="Assessments.goToPage(1)" id="pageFirst" title="First Page">
                            <i class="fas fa-angle-double-left"></i>
                        </button>
                        <button onclick="Assessments.goToPage(Assessments.currentPage - 1)" id="pagePrev" title="Previous Page">
                            <i class="fas fa-angle-left"></i>
                        </button>
                        <div id="pageNumbers"></div>
                        <button onclick="Assessments.goToPage(Assessments.currentPage + 1)" id="pageNext" title="Next Page">
                            <i class="fas fa-angle-right"></i>
                        </button>
                        <button onclick="Assessments.goToPage(Assessments.totalPages)" id="pageLast" title="Last Page">
                            <i class="fas fa-angle-double-right"></i>
                        </button>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <select id="itemsPerPageSelect" onchange="Assessments.changeItemsPerPage()" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 12px;">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                        </select>
                        <span style="font-size: 12px; color: #6b7280;">per page</span>
                    </div>
                </div>
            </div>
        `;
    },

    // ============================================================
    // ADD STYLES
    // ============================================================

    addStyles() {
        if (document.getElementById('assessmentsStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'assessmentsStyles';
        style.textContent = `
            .modal {
                max-width: 750px !important;
            }
            .modal-body {
                padding: 0 !important;
            }
            .modal-body-inner {
                padding: 22px;
            }
            
            .badge-certificate {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 14px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                white-space: nowrap;
            }
            .badge-certificate.eligible {
                background: #dcfce7;
                color: #166534;
            }
            .badge-certificate.eligible i {
                color: #16a34a;
            }
            .badge-certificate.not-eligible {
                background: #f3f4f6;
                color: #6b7280;
            }
            .badge-certificate.not-eligible i {
                color: #9ca3af;
            }
            
            .certificate-settings-preview {
                background: #f8fafc;
                border-radius: 10px;
                padding: 16px;
                border: 1px solid #e5e7eb;
                margin-top: 12px;
            }
            .certificate-settings-preview .preview-item {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                font-size: 13px;
                color: #4b5563;
            }
            .certificate-settings-preview .preview-item .label {
                color: #6b7280;
            }
            .certificate-settings-preview .preview-item .value {
                font-weight: 500;
                color: #1a1f2c;
            }
        `;
        document.head.appendChild(style);
    },

    // ============================================================
    // PAGINATION METHODS
    // ============================================================

    changeItemsPerPage() {
        const select = document.getElementById('itemsPerPageSelect');
        this.itemsPerPage = parseInt(select.value);
        this.currentPage = 1;
        this.renderTable();
    },

    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        if (page === this.currentPage) return;
        this.currentPage = page;
        this.renderTable();
    },

    updatePagination(totalItems) {
        this.totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;
        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages;
        }
        if (this.currentPage < 1) {
            this.currentPage = 1;
        }

        const start = (this.currentPage - 1) * this.itemsPerPage + 1;
        const end = Math.min(this.currentPage * this.itemsPerPage, totalItems);
        
        const infoEl = document.getElementById('paginationInfo');
        if (infoEl) {
            infoEl.textContent = totalItems > 0 ? `Showing ${start}-${end} of ${totalItems} items` : 'No items';
        }

        const firstBtn = document.getElementById('pageFirst');
        const lastBtn = document.getElementById('pageLast');
        const prevBtn = document.getElementById('pagePrev');
        const nextBtn = document.getElementById('pageNext');
        
        if (firstBtn) firstBtn.disabled = this.currentPage === 1 || totalItems === 0;
        if (prevBtn) prevBtn.disabled = this.currentPage === 1 || totalItems === 0;
        if (nextBtn) nextBtn.disabled = this.currentPage === this.totalPages || totalItems === 0;
        if (lastBtn) lastBtn.disabled = this.currentPage === this.totalPages || totalItems === 0;

        const pageNumbersEl = document.getElementById('pageNumbers');
        if (!pageNumbersEl) return;

        let html = '';
        const maxVisible = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            html += `<button onclick="Assessments.goToPage(1)">1</button>`;
            if (startPage > 2) {
                html += `<span class="page-dots">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button onclick="Assessments.goToPage(${i})" class="${i === this.currentPage ? 'active' : ''}">${i}</button>`;
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                html += `<span class="page-dots">...</span>`;
            }
            html += `<button onclick="Assessments.goToPage(${this.totalPages})">${this.totalPages}</button>`;
        }

        pageNumbersEl.innerHTML = html;
    },

    // ============================================================
    // LOAD ASSESSMENTS
    // ============================================================

    async loadAssessments() {
        try {
            const snapshot = await this.db.collection('assessments')
                .orderBy('createdAt', 'desc')
                .get();

            const container = document.getElementById('assessmentsBody');
            this.allAssessments = [];
            
            snapshot.forEach(doc => {
                this.allAssessments.push({ id: doc.id, ...doc.data() });
            });

            this.filteredAssessments = [...this.allAssessments];
            
            await this.loadQuestionCounts();
            
            this.updateStats();
            this.renderTable();

        } catch (error) {
            console.error('Error loading assessments:', error);
            const container = document.getElementById('assessmentsBody');
            if (container) {
                container.innerHTML = `
                    <tr>
                        <td colspan="9">
                            <div style="text-align: center; padding: 40px; color: #dc2626;">
                                <i class="fas fa-exclamation-circle" style="font-size: 32px; display: block; margin-bottom: 12px;"></i>
                                <p>Error loading assessments: ${error.message}</p>
                                <button onclick="Assessments.loadAssessments()" class="btn-primary" style="margin-top: 12px; display: inline-flex; width: auto; padding: 8px 20px;">
                                    <i class="fas fa-redo"></i> Retry
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    },

    async loadQuestionCounts() {
        try {
            const questionsSnap = await this.db.collection('questions')
                .select('assessmentId')
                .get();
            
            const questionCounts = {};
            questionsSnap.forEach(doc => {
                const data = doc.data();
                const assessmentId = data.assessmentId;
                if (assessmentId) {
                    questionCounts[assessmentId] = (questionCounts[assessmentId] || 0) + 1;
                }
            });
            
            this.allAssessments.forEach(assessment => {
                assessment.totalQuestions = questionCounts[assessment.id] || 0;
            });
        } catch (error) {
            console.warn('Could not load question counts:', error);
        }
    },

    // ============================================================
    // UPDATE STATS
    // ============================================================

    updateStats() {
        const total = this.allAssessments.length;
        const published = this.allAssessments.filter(a => a.status === 'published' && (a.totalQuestions || 0) > 0).length;
        const draft = this.allAssessments.filter(a => a.status === 'draft').length;
        const certEligible = this.allAssessments.filter(a => a.certificate && a.certificate.enabled === true).length;

        const statTotal = document.getElementById('statTotal');
        const statPublished = document.getElementById('statPublished');
        const statDraft = document.getElementById('statDraft');
        const statCertEligible = document.getElementById('statCertEligible');

        if (statTotal) statTotal.textContent = total;
        if (statPublished) statPublished.textContent = published;
        if (statDraft) statDraft.textContent = draft;
        if (statCertEligible) statCertEligible.textContent = certEligible;
    },

    // ============================================================
    // RENDER TABLE WITH PAGINATION
    // ============================================================

    renderTable() {
        const container = document.getElementById('assessmentsBody');
        const countEl = document.getElementById('assessmentCount');
        
        if (!container) return;

        const assessments = this.filteredAssessments;
        const totalItems = assessments.length;

        if (countEl) {
            countEl.textContent = `${totalItems} items`;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);
        const pageItems = assessments.slice(startIndex, endIndex);

        this.updatePagination(totalItems);

        if (totalItems === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="9">
                        <div class="empty-state">
                            <i class="fas fa-file-alt"></i>
                            <h3>${this.allAssessments.length === 0 ? 'No assessments created' : 'No matching assessments'}</h3>
                            <p>${this.allAssessments.length === 0 ? 'Click "New Assessment" to get started' : 'Try adjusting your filters'}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        pageItems.forEach(assessment => {
            const statusClass = assessment.status || 'draft';
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
            
            const hasQuestions = (assessment.totalQuestions || 0) > 0;
            const canPublish = hasQuestions && assessment.status === 'draft';
            const isPublished = assessment.status === 'published';
            const questionCount = assessment.totalQuestions || 0;
            
            // Certificate eligibility
            const isCertEligible = assessment.certificate && assessment.certificate.enabled === true;
            const certLabel = isCertEligible ? 'Eligible' : 'Not Eligible';
            const certClass = isCertEligible ? 'eligible' : 'not-eligible';
            const certIcon = isCertEligible ? 'fa-certificate' : 'fa-times-circle';
            
            html += `
                <tr>
                    <td><strong>${this.escapeHtml(assessment.title || 'Untitled')}</strong></td>
                    <td><span class="badge-type"><i class="fas ${typeIcons[assessment.type] || 'fa-file-alt'}"></i> ${typeLabels[assessment.type] || assessment.type || 'Quiz'}</span></td>
                    <td>${this.escapeHtml(assessment.department || 'N/A')}</td>
                    <td>
                        ${questionCount}
                        ${questionCount === 0 ? '<span style="color: #f59e0b; font-size: 11px; margin-left: 4px;">(No questions)</span>' : ''}
                    </td>
                    <td>${assessment.participants || 0}</td>
                    <td>
                        <span class="badge-status ${statusClass}">
                            <i class="fas ${statusIcons[statusClass] || 'fa-circle'}"></i>
                            ${statusLabels[statusClass] || statusClass}
                            ${canPublish ? ' <span style="font-size: 10px; color: #166534; font-weight: 400;">(Ready to publish)</span>' : ''}
                            ${!hasQuestions && statusClass === 'published' ? ' <span style="font-size: 10px; color: #dc2626; font-weight: 400;">(No questions!)</span>' : ''}
                        </span>
                    </td>
                    <td>
                        <span class="badge-certificate ${certClass}">
                            <i class="fas ${certIcon}"></i>
                            ${certLabel}
                        </span>
                    </td>
                    <td>${this.formatDate(assessment.createdAt)}</td>
                    <td>
                        <div class="action-btns">
                            <button class="view" onclick="Assessments.viewAssessment('${assessment.id}')" title="View">
                                <i class="fas fa-eye"></i>
                                <span class="spinner"></span>
                            </button>
                            <button class="edit" onclick="Assessments.openEdit('${assessment.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                                <span class="spinner"></span>
                            </button>
                            <button class="duplicate" onclick="Assessments.duplicateAssessment('${assessment.id}')" title="Duplicate">
                                <i class="fas fa-copy"></i>
                                <span class="spinner"></span>
                            </button>
                            ${canPublish ? `
                                <button class="edit" onclick="Assessments.publishAssessment('${assessment.id}')" title="Publish" style="color: #166534;">
                                    <i class="fas fa-rocket"></i>
                                    <span class="spinner"></span>
                                </button>
                            ` : ''}
                            ${isPublished ? `
                                <button class="edit" onclick="Assessments.closeAssessment('${assessment.id}')" title="Close" style="color: #d97706;">
                                    <i class="fas fa-times-circle"></i>
                                    <span class="spinner"></span>
                                </button>
                            ` : ''}
                            <button class="delete" onclick="Assessments.deleteAssessment('${assessment.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                                <span class="spinner"></span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = html;
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
    // FILTER
    // ============================================================

    filter() {
        const search = document.getElementById('assessmentSearch')?.value?.toLowerCase() || '';
        const status = document.getElementById('filterStatus')?.value || '';
        const type = document.getElementById('filterType')?.value || '';
        const department = document.getElementById('filterDepartment')?.value || '';
        const certificate = document.getElementById('filterCertificate')?.value || '';

        this.filteredAssessments = this.allAssessments.filter(a => {
            let match = true;
            
            if (search) {
                match = match && (
                    (a.title || '').toLowerCase().includes(search) ||
                    (a.description || '').toLowerCase().includes(search)
                );
            }
            if (status) {
                match = match && a.status === status;
            }
            if (type) {
                match = match && a.type === type;
            }
            if (department) {
                match = match && a.department === department;
            }
            if (certificate) {
                const isEligible = a.certificate && a.certificate.enabled === true;
                if (certificate === 'eligible') {
                    match = match && isEligible === true;
                } else if (certificate === 'not-eligible') {
                    match = match && isEligible === false;
                }
            }
            
            return match;
        });

        this.currentPage = 1;
        this.renderTable();
    },

    // ============================================================
    // VIEW ASSESSMENT
    // ============================================================

    viewAssessment(id) {
        const assessment = this.allAssessments.find(a => a.id === id);
        if (!assessment) {
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Assessment not found', true);
            }
            return;
        }

        const content = this.buildViewContent(assessment);
        this.openModal('Assessment Details', content);
    },

    buildViewContent(assessment) {
        const typeLabels = {
            quiz: 'Quiz',
            assignment: 'Assignment',
            practical: 'Practical',
            coding: 'Coding Challenge',
            survey: 'Survey',
            final: 'Final Examination'
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

        const isCertEligible = assessment.certificate && assessment.certificate.enabled === true;

        return `
            <div class="modal-body-inner">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div><strong>Title:</strong> ${this.escapeHtml(assessment.title || 'N/A')}</div>
                    <div><strong>Type:</strong> <span class="badge-type"><i class="fas ${typeIcons[assessment.type] || 'fa-file-alt'}"></i> ${typeLabels[assessment.type] || assessment.type || 'N/A'}</span></div>
                    <div><strong>Department:</strong> ${this.escapeHtml(assessment.department || 'N/A')}</div>
                    <div><strong>Status:</strong> <span class="badge-status ${assessment.status || 'draft'}"><i class="fas ${statusIcons[assessment.status] || 'fa-circle'}"></i> ${statusLabels[assessment.status] || assessment.status || 'Draft'}</span></div>
                    <div><strong>Program:</strong> ${this.escapeHtml(assessment.program || 'N/A')}</div>
                    <div><strong>Course:</strong> ${this.escapeHtml(assessment.course || 'N/A')}</div>
                    <div><strong>Facilitator:</strong> ${this.escapeHtml(assessment.facilitator || 'N/A')}</div>
                    <div><strong>Total Marks:</strong> ${assessment.totalMarks || 0}</div>
                    <div><strong>Passing Score:</strong> ${assessment.passingScore || 0}%</div>
                    <div><strong>Questions:</strong> ${assessment.totalQuestions || 0}</div>
                    <div><strong>Participants:</strong> ${assessment.participants || 0}</div>
                    <div><strong>Certificate:</strong> 
                        <span class="badge-certificate ${isCertEligible ? 'eligible' : 'not-eligible'}">
                            <i class="fas ${isCertEligible ? 'fa-certificate' : 'fa-times-circle'}"></i>
                            ${isCertEligible ? 'Eligible' : 'Not Eligible'}
                        </span>
                    </div>
                    <div><strong>Created:</strong> ${this.formatDate(assessment.createdAt)}</div>
                </div>
                ${assessment.description ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;"><strong>Description:</strong><p style="margin-top: 4px; color: #4b5563;">${this.escapeHtml(assessment.description)}</p></div>` : ''}
                
                <!-- Certificate Settings -->
                ${isCertEligible ? `
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                        <h4 style="font-size: 14px; font-weight: 600; color: #1a1f2c; margin-bottom: 8px;">
                            <i class="fas fa-certificate" style="color: #166534;"></i> Certificate Settings
                        </h4>
                        <div class="certificate-settings-preview">
                            <div class="preview-item">
                                <span class="label">Minimum Score</span>
                                <span class="value">${assessment.certificate.minScore || 70}%</span>
                            </div>
                            <div class="preview-item">
                                <span class="label">Template</span>
                                <span class="value">${assessment.certificate.template || 'Default'}</span>
                            </div>
                            <div class="preview-item">
                                <span class="label">Auto-Generate</span>
                                <span class="value">${assessment.certificate.autoGenerate ? 'Yes' : 'No'}</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Quick Stats -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <div style="text-align: center; background: #f8fafc; padding: 12px; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: 700; color: #1a1f2c;">${assessment.totalQuestions || 0}</div>
                        <div style="font-size: 12px; color: #6b7280;">Questions</div>
                    </div>
                    <div style="text-align: center; background: #f8fafc; padding: 12px; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: 700; color: #1a1f2c;">${assessment.participants || 0}</div>
                        <div style="font-size: 12px; color: #6b7280;">Participants</div>
                    </div>
                    <div style="text-align: center; background: #f8fafc; padding: 12px; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: 700; color: #1a1f2c;">${assessment.duration || 'N/A'}</div>
                        <div style="font-size: 12px; color: #6b7280;">Duration (min)</div>
                    </div>
                    <div style="text-align: center; background: #f8fafc; padding: 12px; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: 700; color: #1a1f2c;">${assessment.passingScore || 0}%</div>
                        <div style="font-size: 12px; color: #6b7280;">Passing Score</div>
                    </div>
                </div>
            </div>
        `;
    },

    // ============================================================
    // PUBLISH ASSESSMENT
    // ============================================================

    async publishAssessment(id) {
        const button = event?.target?.closest?.('button') || document.querySelector(`[onclick*="publishAssessment('${id}')"]`);
        this.setLoading(button, true);

        try {
            const questionsSnap = await this.db.collection('questions')
                .where('assessmentId', '==', id)
                .limit(1)
                .get();
            
            if (questionsSnap.empty) {
                if (typeof window !== 'undefined' && window.showToast) {
                    window.showToast('Cannot publish: Assessment has no questions. Please add questions first.', true);
                }
                this.setLoading(button, false);
                return;
            }

            if (!confirm('Are you sure you want to publish this assessment? It will be visible to students.')) {
                this.setLoading(button, false);
                return;
            }

            await this.db.collection('assessments').doc(id).update({
                status: 'published',
                publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Assessment published successfully!');
            }
            
            this.setLoading(button, false);
            await this.loadAssessments();

        } catch (error) {
            console.error('Error publishing assessment:', error);
            this.setLoading(button, false);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error publishing assessment: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // CLOSE ASSESSMENT
    // ============================================================

    async closeAssessment(id) {
        const button = event?.target?.closest?.('button') || document.querySelector(`[onclick*="closeAssessment('${id}')"]`);
        this.setLoading(button, true);

        if (!confirm('Are you sure you want to close this assessment? Students will no longer be able to submit.')) {
            this.setLoading(button, false);
            return;
        }

        try {
            await this.db.collection('assessments').doc(id).update({
                status: 'closed',
                closedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Assessment closed successfully!');
            }
            
            this.setLoading(button, false);
            await this.loadAssessments();

        } catch (error) {
            console.error('Error closing assessment:', error);
            this.setLoading(button, false);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error closing assessment: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // CREATE ASSESSMENT - OPEN MODAL
    // ============================================================

    openCreate() {
        const content = this.getCreateFormHTML();
        this.openModal('Create New Assessment', content);
        setTimeout(() => {
            this.switchTab('basic');
            this.toggleAnswerOptions();
            this.toggleCertificateSettings();
        }, 100);
    },

    getCreateFormHTML() {
        return `
            <div class="modal-body-inner">
                <form id="assessmentForm" onsubmit="Assessments.handleFormSubmit(event)">
                    <!-- Tabs -->
                    <div class="form-tabs">
                        <button type="button" class="tab-btn active" data-tab="basic" onclick="Assessments.switchTab('basic')">
                            <i class="fas fa-info-circle"></i> Basic
                        </button>
                        <button type="button" class="tab-btn" data-tab="timing" onclick="Assessments.switchTab('timing')">
                            <i class="fas fa-clock"></i> Timing
                        </button>
                        <button type="button" class="tab-btn" data-tab="settings" onclick="Assessments.switchTab('settings')">
                            <i class="fas fa-cog"></i> Settings
                        </button>
                        <button type="button" class="tab-btn" data-tab="anti-cheat" onclick="Assessments.switchTab('anti-cheat')">
                            <i class="fas fa-shield-alt"></i> Anti-Cheat
                        </button>
                        <button type="button" class="tab-btn" data-tab="certificate" onclick="Assessments.switchTab('certificate')">
                            <i class="fas fa-certificate"></i> Certificate
                        </button>
                    </div>

                    <!-- Tab 1: Basic Information -->
                    <div class="tab-panel active" id="tab-basic">
                        <div class="form-group">
                            <label>Assessment Title <span class="required">*</span></label>
                            <input type="text" id="assessTitle" placeholder="e.g., Introduction to Web Development" required>
                        </div>

                        <div class="form-group">
                            <label>Description</label>
                            <textarea id="assessDescription" rows="3" placeholder="Describe the assessment..."></textarea>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Department <span class="required">*</span></label>
                                <select id="assessDepartment" required>
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
                                <label>Program</label>
                                <input type="text" id="assessProgram" placeholder="e.g., Full Stack Web Development">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Course/Module</label>
                                <input type="text" id="assessCourse" placeholder="e.g., HTML & CSS Fundamentals">
                            </div>
                            <div class="form-group">
                                <label>Facilitator</label>
                                <input type="text" id="assessFacilitator" placeholder="e.g., John Doe">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Assessment Type <span class="required">*</span></label>
                                <select id="assessType" required>
                                    <option value="">Select Type</option>
                                    <option value="quiz">Quiz</option>
                                    <option value="assignment">Assignment</option>
                                    <option value="practical">Practical</option>
                                    <option value="coding">Coding Challenge</option>
                                    <option value="survey">Survey</option>
                                    <option value="final">Final Examination</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Total Marks <span class="required">*</span></label>
                                <input type="number" id="assessTotalMarks" placeholder="100" value="100" required min="1">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Passing Score (%) <span class="required">*</span></label>
                                <input type="number" id="assessPassingScore" placeholder="60" value="60" required min="0" max="100">
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select id="assessStatus">
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                    <option value="closed">Closed</option>
                                    <option value="archived">Archived</option>
                                </select>
                                <div class="help-text"><i class="fas fa-info-circle"></i> Note: You need to add questions before publishing</div>
                            </div>
                        </div>
                    </div>

                    <!-- Tab 2: Timing -->
                    <div class="tab-panel" id="tab-timing">
                        <div class="setting-section">
                            <h4><i class="fas fa-calendar-alt"></i> Schedule</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Start Date</label>
                                    <input type="datetime-local" id="assessStartDate">
                                    <div class="help-text"><i class="fas fa-info-circle"></i> When students can start</div>
                                </div>
                                <div class="form-group">
                                    <label>End Date</label>
                                    <input type="datetime-local" id="assessEndDate">
                                    <div class="help-text"><i class="fas fa-info-circle"></i> When submissions close</div>
                                </div>
                            </div>
                        </div>

                        <div class="setting-section">
                            <h4><i class="fas fa-hourglass-half"></i> Duration</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Duration (minutes)</label>
                                    <input type="number" id="assessDuration" placeholder="30" value="30" min="1">
                                    <div class="help-text"><i class="fas fa-info-circle"></i> Time allowed for the assessment</div>
                                </div>
                                <div class="form-group">
                                    <label>Grace Period (minutes)</label>
                                    <input type="number" id="assessGracePeriod" placeholder="5" value="5" min="0">
                                    <div class="help-text"><i class="fas fa-info-circle"></i> Extra time after the duration ends</div>
                                </div>
                            </div>
                        </div>

                        <div class="setting-section">
                            <h4><i class="fas fa-redo"></i> Attempts</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Number of Attempts</label>
                                    <input type="number" id="assessAttempts" placeholder="1" value="1" min="1">
                                    <div class="help-text"><i class="fas fa-info-circle"></i> How many times students can attempt</div>
                                </div>
                                <div class="form-group" style="display: flex; align-items: center; padding-top: 24px;">
                                    <label style="display: flex; align-items: center; gap: 8px; font-weight: 400; cursor: pointer;">
                                        <input type="checkbox" id="assessUnlimitedAttempts" onchange="Assessments.toggleAttempts()">
                                        <i class="fas fa-infinity"></i> Unlimited Attempts
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tab 3: Settings -->
                    <div class="tab-panel" id="tab-settings">
                        <div class="setting-section">
                            <h4><i class="fas fa-compass"></i> Navigation</h4>
                            <div class="checkbox-grid">
                                <label><input type="checkbox" id="assessRandomQuestions"> <i class="fas fa-random"></i> Random Questions</label>
                                <label><input type="checkbox" id="assessRandomOptions"> <i class="fas fa-random"></i> Random Options</label>
                                <label><input type="checkbox" id="assessShowTimer" checked> <i class="fas fa-clock"></i> Show Timer</label>
                                <label><input type="checkbox" id="assessShowProgress" checked> <i class="fas fa-chart-line"></i> Show Progress</label>
                                <label><input type="checkbox" id="assessOnePerPage" onchange="Assessments.toggleOnePerPage()"> <i class="fas fa-file-alt"></i> One Question Per Page</label>
                                <label><input type="checkbox" id="assessAllowBack" checked> <i class="fas fa-undo-alt"></i> Allow Back Navigation</label>
                            </div>
                        </div>

                        <div class="setting-section">
                            <h4><i class="fas fa-chart-bar"></i> Results & Feedback</h4>
                            <div class="form-group">
                                <label>Answer Display</label>
                                <select id="assessAnswerDisplay" class="form-control" onchange="Assessments.toggleAnswerOptions()">
                                    <option value="per-question">After Each Question</option>
                                    <option value="end">At End of Assessment</option>
                                    <option value="none">Don't Display</option>
                                    <option value="release">Hide Until Released</option>
                                </select>
                                <div class="help-text"><i class="fas fa-info-circle"></i> When to show correct answers</div>
                            </div>
                            <div id="answerDisplayOptions">
                                <div class="checkbox-grid" id="perQuestionOptions" style="display: none;">
                                    <label><input type="checkbox" id="assessShowImmediately" checked> <i class="fas fa-eye"></i> Show Immediately</label>
                                    <label><input type="checkbox" id="assessShowCorrectAnswers"> <i class="fas fa-check-double"></i> Show Correct Answers</label>
                                    <label><input type="checkbox" id="assessShowFeedback"> <i class="fas fa-comment"></i> Show Feedback</label>
                                    <label><input type="checkbox" id="assessShowScore" checked> <i class="fas fa-percent"></i> Show Score</label>
                                    <label><input type="checkbox" id="assessAnswersUnchangeable"> <i class="fas fa-lock"></i> Answers Unchangeable</label>
                                </div>
                                <div class="checkbox-grid" id="endOptions" style="display: none;">
                                    <label><input type="checkbox" id="assessShowEndScore" checked> <i class="fas fa-percent"></i> Show Score</label>
                                    <label><input type="checkbox" id="assessShowEndCorrect"> <i class="fas fa-check-double"></i> Show Correct Answers</label>
                                    <label><input type="checkbox" id="assessShowEndFeedback"> <i class="fas fa-comment"></i> Show Feedback</label>
                                    <label><input type="checkbox" id="assessAllowChangeBeforeSubmit"> <i class="fas fa-edit"></i> Allow Changes Before Submit</label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tab 4: Anti-Cheating -->
                    <div class="tab-panel" id="tab-anti-cheat">
                        <div class="setting-section">
                            <h4><i class="fas fa-lock"></i> Basic Protection</h4>
                            <div class="checkbox-grid">
                                <label><input type="checkbox" id="assessDisableCopy" checked> <i class="fas fa-copy"></i> Disable Copy</label>
                                <label><input type="checkbox" id="assessDisablePaste" checked> <i class="fas fa-paste"></i> Disable Paste</label>
                                <label><input type="checkbox" id="assessDisableRightClick" checked> <i class="fas fa-mouse-pointer"></i> Disable Right Click</label>
                                <label><input type="checkbox" id="assessDisableSelection" checked> <i class="fas fa-i-cursor"></i> Disable Text Selection</label>
                                <label><input type="checkbox" id="assessDisablePrint" checked> <i class="fas fa-print"></i> Disable Printing</label>
                            </div>
                        </div>

                        <div class="setting-section">
                            <h4><i class="fas fa-desktop"></i> Browser Monitoring</h4>
                            <div class="checkbox-grid">
                                <label><input type="checkbox" id="assessMonitorTabs"> <i class="fas fa-window-restore"></i> Detect Tab Switching</label>
                                <label><input type="checkbox" id="assessMonitorMinimize"> <i class="fas fa-window-minimize"></i> Detect Minimizing</label>
                                <label><input type="checkbox" id="assessMonitorDevTools"> <i class="fas fa-code"></i> Detect Developer Tools</label>
                                <label><input type="checkbox" id="assessMonitorRefresh"> <i class="fas fa-sync-alt"></i> Detect Refreshing</label>
                                <label><input type="checkbox" id="assessFullScreen"> <i class="fas fa-expand"></i> Force Full Screen Mode</label>
                            </div>
                        </div>

                        <div class="setting-section">
                            <h4><i class="fas fa-exclamation-triangle"></i> Warnings</h4>
                            <div class="form-group">
                                <label>Warnings Before Submit</label>
                                <input type="number" id="assessWarnings" placeholder="3" value="3" min="1" max="5">
                                <div class="help-text"><i class="fas fa-info-circle"></i> Number of warnings before auto-submission</div>
                            </div>
                        </div>
                    </div>

                    <!-- Tab 5: Certificate -->
                    <div class="tab-panel" id="tab-certificate">
                        <div class="setting-section">
                            <h4><i class="fas fa-certificate"></i> Certificate Settings</h4>
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 400;">
                                    <input type="checkbox" id="assessEnableCertificate" onchange="Assessments.toggleCertificateSettings()">
                                    <i class="fas fa-certificate" style="color: #166534;"></i>
                                    Enable Certificate for this Assessment
                                </label>
                                <div class="help-text"><i class="fas fa-info-circle"></i> Enable this to allow students to earn certificates from this assessment</div>
                            </div>
                            
                            <div id="certificateSettings" style="display: none; margin-top: 16px;">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Minimum Score for Certificate (%)</label>
                                        <input type="number" id="assessCertMinScore" placeholder="70" value="70" min="0" max="100">
                                        <div class="help-text"><i class="fas fa-info-circle"></i> Students must score at least this percentage to earn the certificate</div>
                                    </div>
                                    <div class="form-group">
                                        <label>Certificate Template</label>
                                        <select id="assessCertTemplate">
                                            <option value="default">Default</option>
                                            <option value="premium">Premium</option>
                                            <option value="simple">Simple</option>
                                        </select>
                                        <div class="help-text"><i class="fas fa-info-circle"></i> Choose the design style for the certificate</div>
                                    </div>
                                </div>
                                <div class="checkbox-grid">
                                    <label><input type="checkbox" id="assessCertAutoGenerate"> <i class="fas fa-robot"></i> Auto-Generate Certificates</label>
                                    <label><input type="checkbox" id="assessCertLockOnGenerate"> <i class="fas fa-lock"></i> Lock on Generation</label>
                                </div>
                                <div class="help-text" style="margin-top: 8px;">
                                    <i class="fas fa-info-circle"></i> "Lock on Generation" means certificates will be pending until manually released by admin
                                </div>
                            </div>
                        </div>
                    </div>

                    <button type="submit" class="btn-primary" style="width: 100%; justify-content: center; margin-top: 12px;" id="createAssessmentBtn">
                        <i class="fas fa-save"></i> <span class="btn-text">Create Assessment</span>
                        <span class="spinner"></span>
                    </button>
                </form>
            </div>
        `;
    },

    // ============================================================
    // TOGGLE FUNCTIONS
    // ============================================================

    toggleCertificateSettings() {
        const checkbox = document.getElementById('assessEnableCertificate');
        const settings = document.getElementById('certificateSettings');
        if (checkbox && settings) {
            settings.style.display = checkbox.checked ? 'block' : 'none';
        }
    },

    toggleAttempts() {
        const attemptsInput = document.getElementById('assessAttempts');
        const unlimitedCheckbox = document.getElementById('assessUnlimitedAttempts');
        if (attemptsInput && unlimitedCheckbox) {
            attemptsInput.disabled = unlimitedCheckbox.checked;
            if (unlimitedCheckbox.checked) {
                attemptsInput.value = '';
                attemptsInput.placeholder = 'Unlimited';
            } else {
                attemptsInput.placeholder = '1';
                attemptsInput.value = '1';
            }
        }
    },

    toggleOnePerPage() {
        const onePerPage = document.getElementById('assessOnePerPage');
        const allowBack = document.getElementById('assessAllowBack');
        if (onePerPage && onePerPage.checked && allowBack) {
            allowBack.checked = false;
            allowBack.disabled = true;
        } else if (allowBack) {
            allowBack.disabled = false;
        }
    },

    toggleAnswerOptions() {
        const display = document.getElementById('assessAnswerDisplay')?.value || 'per-question';
        const perQuestionOptions = document.getElementById('perQuestionOptions');
        const endOptions = document.getElementById('endOptions');
        const onePerPage = document.getElementById('assessOnePerPage');
        const allowBack = document.getElementById('assessAllowBack');
        const answersUnchangeable = document.getElementById('assessAnswersUnchangeable');

        if (perQuestionOptions) perQuestionOptions.style.display = 'none';
        if (endOptions) endOptions.style.display = 'none';

        if (display === 'per-question') {
            if (perQuestionOptions) {
                perQuestionOptions.style.display = 'grid';
                if (onePerPage) {
                    onePerPage.checked = true;
                    onePerPage.disabled = true;
                }
                if (allowBack) {
                    allowBack.checked = false;
                    allowBack.disabled = true;
                }
                if (answersUnchangeable) {
                    answersUnchangeable.checked = true;
                    answersUnchangeable.disabled = true;
                }
            }
        } else if (display === 'end') {
            if (endOptions) {
                endOptions.style.display = 'grid';
                if (onePerPage) {
                    onePerPage.checked = false;
                    onePerPage.disabled = false;
                }
                if (allowBack) {
                    allowBack.checked = true;
                    allowBack.disabled = false;
                }
                if (answersUnchangeable) {
                    answersUnchangeable.checked = false;
                    answersUnchangeable.disabled = false;
                }
            }
        } else {
            if (onePerPage) {
                onePerPage.checked = false;
                onePerPage.disabled = false;
            }
            if (allowBack) {
                allowBack.checked = true;
                allowBack.disabled = false;
            }
            if (answersUnchangeable) {
                answersUnchangeable.checked = false;
                answersUnchangeable.disabled = false;
            }
        }
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
    // COLLECT FORM DATA
    // ============================================================

    collectFormData() {
        const display = document.getElementById('assessAnswerDisplay')?.value || 'per-question';
        const isCertEnabled = document.getElementById('assessEnableCertificate')?.checked || false;
        
        return {
            title: document.getElementById('assessTitle')?.value?.trim() || '',
            description: document.getElementById('assessDescription')?.value?.trim() || '',
            department: document.getElementById('assessDepartment')?.value || '',
            program: document.getElementById('assessProgram')?.value?.trim() || '',
            course: document.getElementById('assessCourse')?.value?.trim() || '',
            facilitator: document.getElementById('assessFacilitator')?.value?.trim() || '',
            type: document.getElementById('assessType')?.value || '',
            totalMarks: parseInt(document.getElementById('assessTotalMarks')?.value) || 100,
            passingScore: parseInt(document.getElementById('assessPassingScore')?.value) || 60,
            status: document.getElementById('assessStatus')?.value || 'draft',
            startDate: document.getElementById('assessStartDate')?.value || null,
            endDate: document.getElementById('assessEndDate')?.value || null,
            duration: parseInt(document.getElementById('assessDuration')?.value) || 30,
            gracePeriod: parseInt(document.getElementById('assessGracePeriod')?.value) || 5,
            attempts: document.getElementById('assessUnlimitedAttempts')?.checked ? 999 : (parseInt(document.getElementById('assessAttempts')?.value) || 1),
            unlimitedAttempts: document.getElementById('assessUnlimitedAttempts')?.checked || false,
            randomQuestions: document.getElementById('assessRandomQuestions')?.checked || false,
            randomOptions: document.getElementById('assessRandomOptions')?.checked || false,
            showTimer: document.getElementById('assessShowTimer')?.checked !== false,
            showProgress: document.getElementById('assessShowProgress')?.checked !== false,
            onePerPage: document.getElementById('assessOnePerPage')?.checked || false,
            allowBack: document.getElementById('assessAllowBack')?.checked !== false,
            answerDisplay: display,
            showImmediately: document.getElementById('assessShowImmediately')?.checked || false,
            showCorrectAnswers: document.getElementById('assessShowCorrectAnswers')?.checked || false,
            showScore: document.getElementById('assessShowScore')?.checked || false,
            showFeedback: document.getElementById('assessShowFeedback')?.checked || false,
            answersUnchangeable: document.getElementById('assessAnswersUnchangeable')?.checked || false,
            showEndScore: document.getElementById('assessShowEndScore')?.checked || false,
            showEndCorrect: document.getElementById('assessShowEndCorrect')?.checked || false,
            showEndFeedback: document.getElementById('assessShowEndFeedback')?.checked || false,
            allowChangeBeforeSubmit: document.getElementById('assessAllowChangeBeforeSubmit')?.checked || false,
            antiCheat: {
                disableCopy: document.getElementById('assessDisableCopy')?.checked !== false,
                disablePaste: document.getElementById('assessDisablePaste')?.checked !== false,
                disableRightClick: document.getElementById('assessDisableRightClick')?.checked !== false,
                disableSelection: document.getElementById('assessDisableSelection')?.checked !== false,
                disablePrint: document.getElementById('assessDisablePrint')?.checked !== false,
                monitorTabs: document.getElementById('assessMonitorTabs')?.checked || false,
                monitorMinimize: document.getElementById('assessMonitorMinimize')?.checked || false,
                monitorDevTools: document.getElementById('assessMonitorDevTools')?.checked || false,
                monitorRefresh: document.getElementById('assessMonitorRefresh')?.checked || false,
                fullScreen: document.getElementById('assessFullScreen')?.checked || false,
                warnings: parseInt(document.getElementById('assessWarnings')?.value) || 3
            },
            certificate: {
                enabled: isCertEnabled,
                minScore: isCertEnabled ? parseInt(document.getElementById('assessCertMinScore')?.value) || 70 : 70,
                template: isCertEnabled ? document.getElementById('assessCertTemplate')?.value || 'default' : 'default',
                autoGenerate: isCertEnabled ? document.getElementById('assessCertAutoGenerate')?.checked || false : false,
                lockOnGenerate: isCertEnabled ? document.getElementById('assessCertLockOnGenerate')?.checked || false : false
            }
        };
    },

    // ============================================================
    // SAVE ASSESSMENT
    // ============================================================

    async saveAssessment(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('createAssessmentBtn');
        this.setLoading(submitBtn, true);

        const data = this.collectFormData();
        
        if (!data.title) {
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Please enter a title', true);
            }
            this.setLoading(submitBtn, false);
            return;
        }

        if (!data.department) {
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Please select a department', true);
            }
            this.setLoading(submitBtn, false);
            return;
        }

        if (!data.type) {
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Please select an assessment type', true);
            }
            this.setLoading(submitBtn, false);
            return;
        }

        try {
            await this.db.collection('assessments').add({
                ...data,
                totalQuestions: 0,
                participants: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Assessment created successfully! You can now add questions.');
                this.closeModal();
            }
            
            this.setLoading(submitBtn, false);
            await this.loadAssessments();

        } catch (error) {
            console.error('Error creating assessment:', error);
            this.setLoading(submitBtn, false);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error creating assessment: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // EDIT ASSESSMENT
    // ============================================================

    async openEdit(id) {
        const button = event?.target?.closest?.('button') || document.querySelector(`[onclick*="openEdit('${id}')"]`);
        this.setLoading(button, true);

        try {
            const doc = await this.db.collection('assessments').doc(id).get();
            if (!doc.exists) {
                if (typeof window !== 'undefined' && window.showToast) {
                    window.showToast('Assessment not found', true);
                }
                this.setLoading(button, false);
                return;
            }

            const data = doc.data();
            this.currentAssessment = { id: doc.id, ...data };

            const content = this.getEditFormHTML(data);
            this.openModal('Edit Assessment', content);
            setTimeout(() => {
                this.switchTab('basic');
                this.populateEditForm(data);
            }, 100);

            this.setLoading(button, false);

        } catch (error) {
            console.error('Error loading assessment:', error);
            this.setLoading(button, false);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error loading assessment', true);
            }
        }
    },

    populateEditForm(data) {
        const fields = ['title', 'description', 'department', 'program', 'course', 'facilitator', 'type', 'totalMarks', 'passingScore'];
        fields.forEach(field => {
            const el = document.getElementById(`assess${field.charAt(0).toUpperCase() + field.slice(1)}`);
            if (el) el.value = data[field] || '';
        });

        const statusEl = document.getElementById('assessStatus');
        if (statusEl) statusEl.value = data.status || 'draft';

        const startDate = document.getElementById('assessStartDate');
        const endDate = document.getElementById('assessEndDate');
        if (startDate) startDate.value = this.formatDateTimeInput(data.startDate);
        if (endDate) endDate.value = this.formatDateTimeInput(data.endDate);

        const duration = document.getElementById('assessDuration');
        const gracePeriod = document.getElementById('assessGracePeriod');
        if (duration) duration.value = data.duration || 30;
        if (gracePeriod) gracePeriod.value = data.gracePeriod || 5;

        const attempts = document.getElementById('assessAttempts');
        const unlimited = document.getElementById('assessUnlimitedAttempts');
        if (unlimited) {
            unlimited.checked = data.unlimitedAttempts || false;
            if (attempts) {
                attempts.disabled = unlimited.checked;
                if (unlimited.checked) {
                    attempts.value = '';
                    attempts.placeholder = 'Unlimited';
                } else {
                    attempts.value = data.attempts || 1;
                }
            }
        }

        const navFields = ['randomQuestions', 'randomOptions', 'showTimer', 'showProgress', 'onePerPage', 'allowBack'];
        navFields.forEach(field => {
            const el = document.getElementById(`assess${field.charAt(0).toUpperCase() + field.slice(1)}`);
            if (el) el.checked = data[field] || false;
        });

        const display = document.getElementById('assessAnswerDisplay');
        if (display) display.value = data.answerDisplay || 'per-question';
        
        const resultFields = ['showImmediately', 'showCorrectAnswers', 'showScore', 'showFeedback', 'answersUnchangeable', 
                              'showEndScore', 'showEndCorrect', 'showEndFeedback', 'allowChangeBeforeSubmit'];
        resultFields.forEach(field => {
            const el = document.getElementById(`assess${field.charAt(0).toUpperCase() + field.slice(1)}`);
            if (el) el.checked = data[field] || false;
        });

        const antiCheat = data.antiCheat || {};
        const antiCheatFields = ['disableCopy', 'disablePaste', 'disableRightClick', 'disableSelection', 'disablePrint',
                                 'monitorTabs', 'monitorMinimize', 'monitorDevTools', 'monitorRefresh', 'fullScreen'];
        antiCheatFields.forEach(field => {
            const el = document.getElementById(`assess${field.charAt(0).toUpperCase() + field.slice(1)}`);
            if (el) el.checked = antiCheat[field] || false;
        });

        const warnings = document.getElementById('assessWarnings');
        if (warnings) warnings.value = antiCheat.warnings || 3;

        // Certificate settings
        const cert = data.certificate || {};
        const enableCert = document.getElementById('assessEnableCertificate');
        if (enableCert) {
            enableCert.checked = cert.enabled || false;
            this.toggleCertificateSettings();
        }

        const certMinScore = document.getElementById('assessCertMinScore');
        const certTemplate = document.getElementById('assessCertTemplate');
        const certAutoGenerate = document.getElementById('assessCertAutoGenerate');
        const certLockOnGenerate = document.getElementById('assessCertLockOnGenerate');
        
        if (certMinScore) certMinScore.value = cert.minScore || 70;
        if (certTemplate) certTemplate.value = cert.template || 'default';
        if (certAutoGenerate) certAutoGenerate.checked = cert.autoGenerate || false;
        if (certLockOnGenerate) certLockOnGenerate.checked = cert.lockOnGenerate || false;

        // Update submit button text
        const submitBtn = document.getElementById('createAssessmentBtn');
        if (submitBtn) {
            const textSpan = submitBtn.querySelector('.btn-text');
            if (textSpan) textSpan.textContent = 'Update Assessment';
            const icon = submitBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-edit';
        }

        this.toggleAnswerOptions();
    },

    getEditFormHTML(data) {
        return this.getCreateFormHTML();
    },

    // ============================================================
    // UPDATE ASSESSMENT
    // ============================================================

    async updateAssessment(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('createAssessmentBtn');
        this.setLoading(submitBtn, true);

        const id = this.currentAssessment.id;
        const data = this.collectFormData();

        if (!data.title) {
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Please enter a title', true);
            }
            this.setLoading(submitBtn, false);
            return;
        }

        try {
            await this.db.collection('assessments').doc(id).update({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Assessment updated successfully!');
                this.closeModal();
            }
            
            this.setLoading(submitBtn, false);
            await this.loadAssessments();

        } catch (error) {
            console.error('Error updating assessment:', error);
            this.setLoading(submitBtn, false);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error updating assessment: ' + error.message, true);
            }
        }
    },

    // Override the form submit to use update when editing
    handleFormSubmit(e) {
        if (this.currentAssessment) {
            this.updateAssessment(e);
        } else {
            this.saveAssessment(e);
        }
    },

    // ============================================================
    // DELETE ASSESSMENT
    // ============================================================

    async deleteAssessment(id) {
        const button = event?.target?.closest?.('button') || document.querySelector(`[onclick*="deleteAssessment('${id}')"]`);
        
        if (!confirm('Are you sure you want to delete this assessment? This will also delete all associated questions and results. This action cannot be undone.')) {
            return;
        }

        this.setLoading(button, true);

        try {
            const questionsSnap = await this.db.collection('questions')
                .where('assessmentId', '==', id)
                .get();
            
            const batch = this.db.batch();
            questionsSnap.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            const resultsSnap = await this.db.collection('studentResults')
                .where('assessmentId', '==', id)
                .get();
            
            resultsSnap.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Also delete associated certificates
            const certSnap = await this.db.collection('certificates')
                .where('assessmentId', '==', id)
                .get();
            
            certSnap.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            batch.delete(this.db.collection('assessments').doc(id));
            await batch.commit();

            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Assessment deleted successfully');
            }
            
            this.setLoading(button, false);
            await this.loadAssessments();

        } catch (error) {
            console.error('Error deleting assessment:', error);
            this.setLoading(button, false);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error deleting assessment: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // DUPLICATE ASSESSMENT
    // ============================================================

    async duplicateAssessment(id) {
        const button = event?.target?.closest?.('button') || document.querySelector(`[onclick*="duplicateAssessment('${id}')"]`);
        this.setLoading(button, true);

        try {
            const doc = await this.db.collection('assessments').doc(id).get();
            if (!doc.exists) {
                if (typeof window !== 'undefined' && window.showToast) {
                    window.showToast('Assessment not found', true);
                }
                this.setLoading(button, false);
                return;
            }

            const data = doc.data();
            delete data.createdAt;
            delete data.updatedAt;

            data.title = data.title + ' (Copy)';
            data.status = 'draft';
            // Reset certificate settings for copy
            if (data.certificate) {
                data.certificate.enabled = false;
            }

            await this.db.collection('assessments').add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Assessment duplicated successfully!');
            }
            
            this.setLoading(button, false);
            await this.loadAssessments();

        } catch (error) {
            console.error('Error duplicating assessment:', error);
            this.setLoading(button, false);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error duplicating assessment: ' + error.message, true);
            }
        }
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

        // Attach form submit handler
        const form = document.getElementById('assessmentForm');
        if (form) {
            form.onsubmit = (e) => this.handleFormSubmit(e);
        }
    },

    closeModal() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.remove('show');
        document.body.style.overflow = '';
        this.currentAssessment = null;
        
        // Reset submit button text
        const submitBtn = document.getElementById('createAssessmentBtn');
        if (submitBtn) {
            const textSpan = submitBtn.querySelector('.btn-text');
            if (textSpan) textSpan.textContent = 'Create Assessment';
            const icon = submitBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-save';
        }
    },

    // ============================================================
    // HELPER FUNCTIONS
    // ============================================================

    formatDateTimeInput(date) {
        if (!date) return '';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            if (isNaN(d.getTime())) return '';
            return d.toISOString().slice(0, 16);
        } catch {
            return '';
        }
    },

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

window.Assessments = Assessments;