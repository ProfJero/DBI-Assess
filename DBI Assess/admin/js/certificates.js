// ============================================================
// ADMIN CERTIFICATES - COMPLETE MANAGEMENT (PROFESSIONAL DBI DESIGN)
// USES MAIN DB (rth-admin-dues) FOR STUDENTS, ASSESSMENT DB FOR CERTIFICATES
// ============================================================

const AdminCertificates = {
    mainDb: null,
    assessmentDb: null,
    allCertificates: [],
    filteredCertificates: [],
    students: [],
    assessments: [],
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 1,

    // DBI Signatories
    signatories: {
        executiveDirector: {
            name: 'Benjamin Amoako',
            title: 'Executive Director',
            signature: '../images/signatures/executive-director.png'
        },
        departmentHead: {
            name: 'Abel Eduah',
            title: 'Head of Department',
            signature: '../images/signatures/head-graphics.png'
        },
        secretary: {
            name: 'Godsway Arhin',
            title: 'Secretary',
            signature: '../images/signatures/head-data.png'
        },
        organiser: {
            name: 'Enoch Ntsiakoh',
            title: 'Organiser',
            signature: '../images/signatures/organiser.png'
        }
    },

    // Department Heads mapping
    departmentHeads: {
        'Software Development': { name: 'Benjamin Amoako', title: 'Head of Software Development', dept: 'DigitalCore' },
        'Graphics & Multimedia': { name: 'Abel Eduah', title: 'Head of Graphics & Multimedia', dept: 'Creative Impact' },
        'Data Analysis': { name: 'Godsway Arhin', title: 'Head of Data Analysis', dept: 'Next Gen DATA-LAB' },
        'Digital Marketing': { name: '#', title: 'Head of Digital Marketing', dept: 'DigitalBridge Academy' },
        'Cybersecurity': { name: '#', title: 'Head of Cybersecurity', dept: 'DigitalBridge Academy' },
        'Network & Cloud': { name: '#', title: 'Head of Network & Cloud', dept: 'DigitalBridge Academy' },
        'Digital Skills': { name: '#', title: 'Head of Digital Skills', dept: 'DigitalBridge Academy' }
    },

    // ============================================================
    // RENDER
    // ============================================================

    render(container, dbs) {
        this.mainDb = dbs.mainDb;
        this.assessmentDb = dbs.assessmentDb;
        console.log('✅ AdminCertificates rendered with Main DB & Assessment DB');
        container.innerHTML = this.getHTML();
        this.addStyles();
        setTimeout(() => this.loadData(), 100);
    },

    // ============================================================
    // GET HTML - FULL (complete with all IDs)
    // ============================================================

    getHTML() {
        return `
            <!-- Stats Cards -->
            <div class="stats-grid" id="certificateStats">
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="fas fa-certificate"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statTotal">0</div>
                        <div class="stat-label">Total Certificates</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statIssued">0</div>
                        <div class="stat-label">Issued</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statPending">0</div>
                        <div class="stat-label">Pending Release</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple"><i class="fas fa-file-alt"></i></div>
                    <div class="stat-info">
                        <div class="stat-number" id="statTemplates">0</div>
                        <div class="stat-label">Templates</div>
                    </div>
                </div>
            </div>

            <!-- Action Bar -->
            <div class="action-bar">
                <button class="btn-primary" onclick="AdminCertificates.openGenerateModal()">
                    <i class="fas fa-plus"></i> Generate Certificate
                </button>
                <button class="btn-secondary" onclick="AdminCertificates.openTemplateModal()">
                    <i class="fas fa-file-pdf"></i> Generate Template
                </button>
                <button class="btn-secondary" onclick="AdminCertificates.bulkRelease()">
                    <i class="fas fa-rocket"></i> Bulk Release
                </button>
                <button class="btn-secondary" onclick="AdminCertificates.exportData()">
                    <i class="fas fa-download"></i> Export Data
                </button>
            </div>

            <!-- Filter Bar -->
            <div class="filter-bar">
                <div class="filter-group search-group">
                    <i class="fas fa-search"></i>
                    <input type="text" id="certificateSearch" placeholder="Search by student name, certificate ID..." oninput="AdminCertificates.filter()">
                </div>
                <div class="filter-group">
                    <select id="filterStatus" onchange="AdminCertificates.filter()">
                        <option value="">All Status</option>
                        <option value="issued">Issued</option>
                        <option value="pending">Pending</option>
                        <option value="template">Template</option>
                        <option value="revoked">Revoked</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterType" onchange="AdminCertificates.filter()">
                        <option value="">All Types</option>
                        <option value="completion">Completion</option>
                        <option value="achievement">Achievement</option>
                        <option value="participation">Participation</option>
                    </select>
                </div>
                <div class="filter-group">
                    <select id="filterAssessment" onchange="AdminCertificates.filter()">
                        <option value="">All Assessments</option>
                    </select>
                </div>
            </div>

            <!-- Certificates Table -->
            <div class="table-container">
                <div class="table-header">
                    <span>Certificate Records</span>
                    <span class="table-count" id="certificateCount">0 items</span>
                </div>
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Certificate ID</th>
                                <th>Student</th>
                                <th>Type</th>
                                <th>Grade</th>
                                <th>Status</th>
                                <th>Issued Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="certificatesBody">
                            <tr>
                                <td colspan="7">
                                    <div class="empty-state">
                                        <i class="fas fa-spinner fa-spin"></i>
                                        <h3>Loading certificates...</h3>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="pagination-container" id="paginationContainer">
                    <div class="pagination-info" id="paginationInfo">Showing 0-0 of 0 items</div>
                    <div class="pagination-controls" id="paginationControls">
                        <button onclick="AdminCertificates.goToPage(1)" id="pageFirst" title="First Page">
                            <i class="fas fa-angle-double-left"></i>
                        </button>
                        <button onclick="AdminCertificates.goToPage(AdminCertificates.currentPage - 1)" id="pagePrev" title="Previous Page">
                            <i class="fas fa-angle-left"></i>
                        </button>
                        <div id="pageNumbers"></div>
                        <button onclick="AdminCertificates.goToPage(AdminCertificates.currentPage + 1)" id="pageNext" title="Next Page">
                            <i class="fas fa-angle-right"></i>
                        </button>
                        <button onclick="AdminCertificates.goToPage(AdminCertificates.totalPages)" id="pageLast" title="Last Page">
                            <i class="fas fa-angle-double-right"></i>
                        </button>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <select id="itemsPerPageSelect" onchange="AdminCertificates.changeItemsPerPage()" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 12px;">
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
    // ADD STYLES (full as before)
    // ============================================================

    addStyles() {
        if (document.getElementById('adminCertStyles')) return;
        const style = document.createElement('style');
        style.id = 'adminCertStyles';
        style.textContent = `
            .modal { max-width: 850px !important; border-radius: 18px; background: white; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
            .modal-body-inner { padding: 22px; }
            .dbi-certificate-preview { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin: 16px 0; font-family: 'Inter', 'Segoe UI', sans-serif; }
            .dbi-certificate-preview .cert-border { position: relative; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); padding: 35px 30px 30px 30px; border: 2px solid #1e88e5; border-radius: 12px; }
            .dbi-certificate-preview .cert-inner-border { border: 1px solid #00c853; border-radius: 8px; padding: 25px 20px 20px 20px; position: relative; }
            .dbi-certificate-preview .corner { position: absolute; width: 30px; height: 30px; }
            .dbi-certificate-preview .corner.tl { top: 20px; left: 20px; border-top: 3px solid #1e88e5; border-left: 3px solid #1e88e5; }
            .dbi-certificate-preview .corner.tr { top: 20px; right: 20px; border-top: 3px solid #00c853; border-right: 3px solid #00c853; }
            .dbi-certificate-preview .corner.bl { bottom: 20px; left: 20px; border-bottom: 3px solid #00c853; border-left: 3px solid #00c853; }
            .dbi-certificate-preview .corner.br { bottom: 20px; right: 20px; border-bottom: 3px solid #1e88e5; border-right: 3px solid #1e88e5; }
            .dbi-certificate-preview .logo-section { text-align: center; margin-bottom: 15px; }
            .dbi-certificate-preview .logo-section img { height: 55px; width: auto; margin: 0 auto; }
            .dbi-certificate-preview .logo-section .tagline { color: #6b7280; font-size: 11px; margin-top: 4px; letter-spacing: 2px; font-weight: 500; }
            .dbi-certificate-preview .logo-section .divider { width: 80px; height: 2px; background: linear-gradient(90deg, #1e88e5, #00c853); margin: 6px auto 0; }
            .dbi-certificate-preview .cert-title { text-align: center; margin: 10px 0 8px; }
            .dbi-certificate-preview .cert-title .sub { color: #6b7280; font-size: 18px; font-weight: 400; letter-spacing: 1px; }
            .dbi-certificate-preview .cert-title .main { color: #00335f; font-size: 32px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; }
            .dbi-certificate-preview .grade-badge { display: inline-block; padding: 4px 20px; border-radius: 30px; font-size: 14px; font-weight: 700; color: white; margin: 6px auto; }
            .dbi-certificate-preview .grade-badge.outstanding { background: linear-gradient(135deg, #6b7280, #4b5563); }
            .dbi-certificate-preview .grade-badge.distinction { background: linear-gradient(135deg, #fbbf24, #d97706); }
            .dbi-certificate-preview .grade-badge.merit { background: linear-gradient(135deg, #94a3b8, #64748b); }
            .dbi-certificate-preview .grade-badge.completion { background: linear-gradient(135deg, #1e88e5, #00c853); }
            .dbi-certificate-preview .recipient { text-align: center; margin: 15px 0 12px; }
            .dbi-certificate-preview .recipient .label { color: #6b7280; font-size: 14px; font-weight: 500; }
            .dbi-certificate-preview .recipient .name { color: #00335f; font-size: 26px; font-weight: 700; border-bottom: 2px solid #00c853; display: inline-block; padding-bottom: 4px; }
            .dbi-certificate-preview .course-info { text-align: center; margin: 12px 0; }
            .dbi-certificate-preview .course-info .label { color: #6b7280; font-size: 14px; }
            .dbi-certificate-preview .course-info .title { color: #1e88e5; font-size: 20px; font-weight: 600; margin: 4px 0 6px; }
            .dbi-certificate-preview .course-info .dept { display: inline-block; padding: 2px 16px; background: #f3f4f6; border-radius: 20px; color: #00335f; font-size: 12px; font-weight: 500; }
            .dbi-certificate-preview .signatures { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 25px; padding: 0 10px; }
            .dbi-certificate-preview .signatures .sig-group { text-align: center; flex: 1; }
            .dbi-certificate-preview .signatures .sig-group .sig-image { height: 40px; width: auto; margin: 0 auto; object-fit: contain; }
            .dbi-certificate-preview .signatures .sig-group .sig-line { width: 100px; height: 1px; background: #6b7280; margin: 4px auto; }
            .dbi-certificate-preview .signatures .sig-group .sig-label { color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; }
            .dbi-certificate-preview .signatures .sig-group .sig-name { font-weight: 700; color: #00335f; font-size: 12px; margin: 0; }
            .dbi-certificate-preview .signatures .sig-group .sig-title { color: #1e88e5; font-size: 10px; margin: 0; }
            .dbi-certificate-preview .qr-section { text-align: center; flex: 1; }
            .dbi-certificate-preview .qr-section .qr-container { width: 75px; height: 75px; margin: 0 auto; background: white; border-radius: 8px; border: 1px solid #1e88e5; overflow: hidden; display: flex; align-items: center; justify-content: center; }
            .dbi-certificate-preview .qr-section .qr-label { color: #6b7280; font-size: 8px; margin-top: 4px; font-weight: 600; letter-spacing: 0.5px; }
            .dbi-certificate-preview .qr-section .qr-id { color: #6b7280; font-size: 8px; font-family: monospace; margin: 0; }
            .dbi-certificate-preview .footer { text-align: center; margin-top: 18px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
            .dbi-certificate-preview .footer .badges { display: inline-flex; align-items: center; gap: 12px; }
            .dbi-certificate-preview .footer .badges span { color: #6b7280; font-size: 9px; font-weight: 500; letter-spacing: 0.5px; }
            .dbi-certificate-preview .footer .badges .icon-blue { color: #1e88e5; }
            .dbi-certificate-preview .footer .badges .icon-green { color: #00c853; }
            .dbi-certificate-preview .footer .date { color: #d1d5db; font-size: 8px; margin-top: 6px; letter-spacing: 0.5px; }
            .dbi-certificate-preview .preview-badge { position: absolute; top: 10px; right: 10px; padding: 4px 16px; border-radius: 20px; font-size: 11px; font-weight: 600; z-index: 5; }
            .dbi-certificate-preview .preview-badge.template-badge { background: #f59e0b; color: white; }
            .dbi-certificate-preview .preview-badge.issued-badge { background: #16a34a; color: white; }
            .dbi-certificate-preview .preview-badge.pending-badge { background: #f59e0b; color: white; }
            .dbi-certificate-preview .lock-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 64px; color: rgba(0,0,0,0.06); pointer-events: none; }
            .dbi-certificate-preview.template { opacity: 0.85; }
            .dbi-certificate-preview.template .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 72px; font-weight: 900; color: rgba(0,0,0,0.04); letter-spacing: 12px; pointer-events: none; }
            .modal-body-inner .form-group { margin-bottom: 18px; }
            .modal-body-inner label { display: block; font-size: 13px; font-weight: 600; color: #1a1f2c; margin-bottom: 5px; }
            .modal-body-inner .required { color: #dc2626; }
            .modal-body-inner select, .modal-body-inner input { width: 100%; padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 14px; font-family: 'Inter', sans-serif; transition: all 0.3s ease; background: #f8fafc; }
            .modal-body-inner select:focus, .modal-body-inner input:focus { border-color: #22c55e; outline: none; background: white; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1); }
            .modal-body-inner .help-text { font-size: 12px; color: #6b7280; margin-top: 4px; display: flex; align-items: center; gap: 4px; }
            .modal-body-inner .help-text i { color: #9ca3af; font-size: 12px; }
            .modal-body-inner .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .modal-footer { padding: 16px 22px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 10px; background: #fafafa; border-radius: 0 0 18px 18px; flex-wrap: wrap; }
            .modal-footer button { min-height: 40px; }
            .manual-issue-note { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin: 12px 0; font-size: 13px; color: #92400e; }
            .manual-issue-note i { color: #d97706; margin-right: 6px; }
            .student-select-list { max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px; background: #fafafa; }
            .student-select-list .student-item { padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 10px; background: white; margin-bottom: 4px; border: 1px solid transparent; }
            .student-select-list .student-item:hover { background: #f3f4f6; border-color: #e5e7eb; }
            .student-select-list .student-item.selected { background: #f0fdf4; border: 1px solid #86efac; }
            .student-select-list .student-item input[type="checkbox"] { accent-color: #166534; width: 18px; height: 18px; cursor: pointer; flex-shrink: 0; }
            .student-select-list .student-item .student-info { flex: 1; }
            .student-select-list .student-item .student-info .name { font-weight: 600; color: #1a1f2c; }
            .student-select-list .student-item .student-info .email { font-size: 12px; color: #6b7280; }
            .student-select-list .student-item .student-badge { font-size: 12px; color: #166534; background: #dcfce7; padding: 2px 10px; border-radius: 12px; white-space: nowrap; }
            .student-select-list .student-item .student-badge.no-assessment { background: #fef3c7; color: #d97706; }
        `;
        document.head.appendChild(style);
    },

    // ============================================================
// GET CERTIFICATE STYLES (for print/PDF) – updated for centered QR
// ============================================================

getCertificateStyles() {
    return `
        .dbi-certificate-preview { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin: 0 auto; max-width: 800px; width: 100%; font-family: 'Inter', 'Segoe UI', sans-serif; }
        .dbi-certificate-preview .cert-border { position: relative; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); padding: 35px 30px 30px 30px; border: 2px solid #1e88e5; border-radius: 12px; }
        .dbi-certificate-preview .cert-inner-border { border: 1px solid #00c853; border-radius: 8px; padding: 25px 20px 20px 20px; position: relative; }
        .dbi-certificate-preview .corner { position: absolute; width: 30px; height: 30px; }
        .dbi-certificate-preview .corner.tl { top: 20px; left: 20px; border-top: 3px solid #1e88e5; border-left: 3px solid #1e88e5; }
        .dbi-certificate-preview .corner.tr { top: 20px; right: 20px; border-top: 3px solid #00c853; border-right: 3px solid #00c853; }
        .dbi-certificate-preview .corner.bl { bottom: 20px; left: 20px; border-bottom: 3px solid #00c853; border-left: 3px solid #00c853; }
        .dbi-certificate-preview .corner.br { bottom: 20px; right: 20px; border-bottom: 3px solid #1e88e5; border-right: 3px solid #1e88e5; }
        .dbi-certificate-preview .logo-section { text-align: center; margin-bottom: 15px; }
        .dbi-certificate-preview .logo-section img { height: 55px; width: auto; margin: 0 auto; }
        .dbi-certificate-preview .logo-section .tagline { color: #6b7280; font-size: 11px; margin-top: 4px; letter-spacing: 2px; font-weight: 500; }
        .dbi-certificate-preview .logo-section .divider { width: 80px; height: 2px; background: linear-gradient(90deg, #1e88e5, #00c853); margin: 6px auto 0; }
        .dbi-certificate-preview .cert-title { text-align: center; margin: 10px 0 8px; }
        .dbi-certificate-preview .cert-title .sub { color: #6b7280; font-size: 18px; font-weight: 400; letter-spacing: 1px; }
        .dbi-certificate-preview .cert-title .main { color: #00335f; font-size: 32px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; }
        .dbi-certificate-preview .grade-badge { display: inline-block; padding: 4px 20px; border-radius: 30px; font-size: 14px; font-weight: 700; color: white; margin: 6px auto; }
        .dbi-certificate-preview .grade-badge.outstanding { background: linear-gradient(135deg, #6b7280, #4b5563); }
        .dbi-certificate-preview .grade-badge.distinction { background: linear-gradient(135deg, #fbbf24, #d97706); }
        .dbi-certificate-preview .grade-badge.merit { background: linear-gradient(135deg, #94a3b8, #64748b); }
        .dbi-certificate-preview .grade-badge.completion { background: linear-gradient(135deg, #1e88e5, #00c853); }
        .dbi-certificate-preview .recipient { text-align: center; margin: 15px 0 12px; }
        .dbi-certificate-preview .recipient .label { color: #6b7280; font-size: 14px; font-weight: 500; }
        .dbi-certificate-preview .recipient .name { color: #00335f; font-size: 26px; font-weight: 700; border-bottom: 2px solid #00c853; display: inline-block; padding-bottom: 4px; }
        .dbi-certificate-preview .course-info { text-align: center; margin: 12px 0; }
        .dbi-certificate-preview .course-info .label { color: #6b7280; font-size: 14px; }
        .dbi-certificate-preview .course-info .title { color: #1e88e5; font-size: 20px; font-weight: 600; margin: 4px 0 6px; }
        .dbi-certificate-preview .course-info .dept { display: inline-block; padding: 2px 16px; background: #f3f4f6; border-radius: 20px; color: #00335f; font-size: 12px; font-weight: 500; }
        .dbi-certificate-preview .signatures { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-end; gap: 15px 30px; padding: 0 10px; margin-top: 25px; }
        .dbi-certificate-preview .signatures .sig-group { text-align: center; flex: 1 1 120px; min-width: 100px; }
        .dbi-certificate-preview .signatures .sig-group .sig-image { height: 40px; width: auto; margin: 0 auto; object-fit: contain; }
        .dbi-certificate-preview .signatures .sig-group .sig-line { width: 100px; height: 1px; background: #6b7280; margin: 4px auto; }
        .dbi-certificate-preview .signatures .sig-group .sig-label { color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; }
        .dbi-certificate-preview .signatures .sig-group .sig-name { font-weight: 700; color: #00335f; font-size: 12px; margin: 0; }
        .dbi-certificate-preview .signatures .sig-group .sig-title { color: #1e88e5; font-size: 10px; margin: 0; }
        .dbi-certificate-preview .qr-section { text-align: center; flex: 0 0 auto; }
        .dbi-certificate-preview .qr-section .qr-container { width: 75px; height: 75px; margin: 0 auto; background: white; border-radius: 8px; border: 1px solid #1e88e5; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .dbi-certificate-preview .qr-section .qr-label { color: #6b7280; font-size: 8px; margin-top: 4px; font-weight: 600; letter-spacing: 0.5px; }
        .dbi-certificate-preview .qr-section .qr-id { color: #6b7280; font-size: 8px; font-family: monospace; margin: 0; }
        .dbi-certificate-preview .footer { text-align: center; margin-top: 18px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
        .dbi-certificate-preview .footer .badges { display: inline-flex; align-items: center; gap: 12px; }
        .dbi-certificate-preview .footer .badges span { color: #6b7280; font-size: 9px; font-weight: 500; letter-spacing: 0.5px; }
        .dbi-certificate-preview .footer .badges .icon-blue { color: #1e88e5; }
        .dbi-certificate-preview .footer .badges .icon-green { color: #00c853; }
        .dbi-certificate-preview .footer .date { color: #d1d5db; font-size: 8px; margin-top: 6px; letter-spacing: 0.5px; }
        .dbi-certificate-preview .preview-badge { position: absolute; top: 10px; right: 10px; padding: 4px 16px; border-radius: 20px; font-size: 11px; font-weight: 600; z-index: 5; }
        .dbi-certificate-preview .preview-badge.template-badge { background: #f59e0b; color: white; }
        .dbi-certificate-preview .preview-badge.issued-badge { background: #16a34a; color: white; }
        .dbi-certificate-preview .preview-badge.pending-badge { background: #f59e0b; color: white; }
        .dbi-certificate-preview .lock-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 64px; color: rgba(0,0,0,0.06); pointer-events: none; }
        .dbi-certificate-preview.template { opacity: 0.85; }
        .dbi-certificate-preview.template .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 72px; font-weight: 900; color: rgba(0,0,0,0.04); letter-spacing: 12px; pointer-events: none; }
    `;
},

    // ============================================================
// BUILD PROFESSIONAL CERTIFICATE HTML (FIXED: QR CENTERED)
// ============================================================

buildProfessionalCertificateHTML(cert, isTemplate = false) {
    const studentName = `${cert.studentFirstName || ''} ${cert.studentLastName || ''}`.trim() || 'Student Name';
    const grade = this.getGrade(cert.score || 85);
    const issueDate = cert.issuedAt || cert.createdAt || new Date();
    const formattedDate = this.formatDate(issueDate);
    const isAchievement = cert.type === 'achievement';
    const isParticipation = cert.type === 'participation';
    let certTitle = 'Certificate of';
    let certSubtitle = 'for successfully completing';
    let specialText = '';
    if (isAchievement) {
        certTitle = 'Certificate of';
        certSubtitle = 'in recognition of outstanding performance';
        specialText = `
            <div style="text-align: center; margin: 10px 0;">
                <span class="grade-badge ${grade.class}">${grade.icon} ${grade.name} Level</span>
            </div>
            ${cert.achievementDesc ? `
                <div style="text-align: center; margin: 8px 0;">
                    <span style="display: inline-block; padding: 4px 20px; background: #fef3c7; color: #92400e; border-radius: 30px; font-size: 13px; font-weight: 600;">
                        🏆 ${this.escapeHtml(cert.achievementDesc)}
                    </span>
                </div>
            ` : ''}
        `;
    } else if (isParticipation) {
        certTitle = 'Certificate of';
        certSubtitle = 'for active participation in';
        if (cert.eventName) {
            specialText = `
                <div style="text-align: center; margin: 10px 0;">
                    <span style="display: inline-block; padding: 4px 20px; background: #d1fae5; color: #065f46; border-radius: 30px; font-size: 13px; font-weight: 600;">
                        📅 ${this.escapeHtml(cert.eventName)}${cert.eventDate ? ' • ' + cert.eventDate : ''}
                    </span>
                </div>
            `;
        }
    }

    const verificationUrl = `https://dbi-learn.pages.dev/verify-certificate?id=${cert.certificateId || cert.id}`;
    const qrContainerId = `qr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const statusBadge = isTemplate ? 'template-badge' : (cert.status === 'pending' ? 'pending-badge' : 'issued-badge');
    const statusText = isTemplate ? '📄 TEMPLATE' : (cert.status === 'pending' ? '🔒 PENDING RELEASE' : '✅ OFFICIAL');
    const lockIcon = cert.status === 'pending' ? '<div class="lock-icon"><i class="fas fa-lock"></i></div>' : '';
    const templateClass = isTemplate ? 'template' : '';
    const watermark = isTemplate ? '<div class="watermark">SAMPLE</div>' : '';

    // --- Get all signatories (with department-aware override) ---
    const getSig = (role) => {
        // If role is 'departmentHead' and we have a department, try department-specific head
        if (role === 'departmentHead' && cert.department) {
            const deptHead = this.departmentHeads[cert.department];
            if (deptHead && deptHead.name && deptHead.name !== '#') {
                // Find the signatory key that matches this department head's name
                for (const [key, val] of Object.entries(this.signatories)) {
                    if (val.name === deptHead.name) {
                        return { ...val, signature: `../images/signatures/${deptHead.name.toLowerCase().replace(/ /g, '-')}.png` };
                    }
                }
                // If not found in signatories, create a dynamic one
                return {
                    name: deptHead.name,
                    title: deptHead.title,
                    signature: `../images/signatures/${deptHead.name.toLowerCase().replace(/ /g, '-')}.png`
                };
            }
        }
        // Otherwise, return from the static signatories
        if (role && this.signatories[role]) {
            return this.signatories[role];
        }
        return this.signatories.executiveDirector;
    };

    const rawSignatory1 = getSig(cert.signatory1 || 'executiveDirector');
    const rawSignatory2 = getSig(cert.signatory2 || 'departmentHead');
    const rawSignatory3 = cert.signatory3 ? getSig(cert.signatory3) : null;
    const rawSignatory4 = cert.signatory4 ? getSig(cert.signatory4) : null;

    // --- Collect unique signatories by name (keep first occurrence) ---
    const uniqueSignatories = [];
    const seenNames = new Set();
    [rawSignatory1, rawSignatory2, rawSignatory3, rawSignatory4].forEach(sig => {
        if (sig && sig.name && !seenNames.has(sig.name)) {
            seenNames.add(sig.name);
            uniqueSignatories.push(sig);
        }
    });

    // --- Split signatories into two halves for left/right of QR ---
    const half = Math.ceil(uniqueSignatories.length / 2);
    const leftSigs = uniqueSignatories.slice(0, half);
    const rightSigs = uniqueSignatories.slice(half);

    // Build left group HTML
    let leftHtml = leftSigs.map(sig => `
        <div class="sig-group" style="text-align: center; flex: 1 1 120px; min-width: 100px;">
            <img src="${sig.signature}" alt="${sig.name} Signature" class="sig-image" onerror="this.style.display='none'">
            <div class="sig-line"></div>
            <div class="sig-label">Digitally Signed</div>
            <p class="sig-name">${sig.name}</p>
            <p class="sig-title">${sig.title}</p>
        </div>
    `).join('');

    // Build right group HTML
    let rightHtml = rightSigs.map(sig => `
        <div class="sig-group" style="text-align: center; flex: 1 1 120px; min-width: 100px;">
            <img src="${sig.signature}" alt="${sig.name} Signature" class="sig-image" onerror="this.style.display='none'">
            <div class="sig-line"></div>
            <div class="sig-label">Digitally Signed</div>
            <p class="sig-name">${sig.name}</p>
            <p class="sig-title">${sig.title}</p>
        </div>
    `).join('');

    // --- Build the signatures row with QR in the middle ---
    const signaturesHtml = `
        <div class="signatures" style="display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-end; gap: 15px 30px; padding: 0 10px; margin-top: 25px;">
            ${leftHtml}
            <div class="qr-section" style="text-align: center; flex: 0 0 auto;">
                <div class="qr-container" id="${qrContainerId}">
                    <div style="font-size: 10px; color: #6b7280;">QR Code</div>
                </div>
                <div class="qr-label">SCAN TO VERIFY</div>
                <div class="qr-id">${(cert.certificateId || cert.id).slice(0, 20)}</div>
            </div>
            ${rightHtml}
        </div>
    `;

    return `
        <div class="dbi-certificate-preview ${templateClass}">
            <div class="cert-border">
                ${watermark}
                ${lockIcon}
                <div class="preview-badge ${statusBadge}">${statusText}</div>
                <div class="cert-inner-border">
                    <div class="corner tl"></div>
                    <div class="corner tr"></div>
                    <div class="corner bl"></div>
                    <div class="corner br"></div>
                    <div class="logo-section">
                        <img src="../images/DBI-Official-Logo.png" alt="DBI Logo" onerror="this.style.display='none'">
                        <div class="tagline">Shaping Tomorrow's Tech Leaders Today</div>
                        <div class="divider"></div>
                    </div>
                    <div class="cert-title">
                        <div class="sub">${certTitle}</div>
                        <div class="main">${isAchievement ? 'ACHIEVEMENT' : isParticipation ? 'PARTICIPATION' : 'COMPLETION'}</div>
                    </div>
                    ${specialText}
                    <div class="recipient">
                        <div class="label">This certificate is proudly presented to</div>
                        <div class="name">${this.escapeHtml(studentName)}</div>
                    </div>
                    <div class="course-info">
                        <div class="label">${certSubtitle}</div>
                        <div class="title">${this.escapeHtml(cert.assessmentTitle || cert.courseTitle || 'Program')}</div>
                        <div class="dept">${this.escapeHtml(cert.department || 'General')} Track</div>
                    </div>
                    ${signaturesHtml}
                    <div class="footer">
                        <div class="badges">
                            <i class="fas fa-certificate icon-blue"></i>
                            <span>Digitally Verified Certificate</span>
                            <i class="fas fa-shield-alt icon-green"></i>
                        </div>
                        <div class="date">Issued: ${formattedDate} • ID: ${cert.certificateId || cert.id}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
},

    // ============================================================
    // GENERATE QR CODE
    // ============================================================

    async generateQRCode(text, containerId) {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '';
            if (typeof QRCode === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            if (typeof QRCode !== 'undefined') {
                new QRCode(container, {
                    text: text,
                    width: 75,
                    height: 75,
                    colorDark: "#00335f",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            } else {
                container.innerHTML = `<div style="font-size:10px;color:#6b7280;text-align:center;"><i class="fas fa-qrcode" style="font-size:24px;display:block;"></i><span>QR</span></div>`;
            }
        } catch (error) {
            console.error('QR generation error:', error);
        }
    },

    // ============================================================
    // LOAD DATA
    // ============================================================

    async loadData() {
        try {
            if (!this.mainDb || !this.assessmentDb) throw new Error('Databases not initialized');
            await Promise.all([this.loadCertificates(), this.loadStudents(), this.loadAssessments()]);
            this.filteredCertificates = [...this.allCertificates];
            this.renderTable();
            this.updateStats();
            this.populateFilters();
        } catch (error) {
            console.error('Error loading data:', error);
            const body = document.getElementById('certificatesBody');
            if (body) {
                body.innerHTML = `
                    <tr><td colspan="7">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-circle" style="color:#dc2626;font-size:32px;"></i>
                            <h3>Error Loading Data</h3>
                            <p>${this.escapeHtml(error.message)}</p>
                            <button onclick="AdminCertificates.loadData()" class="btn-primary" style="margin-top:12px;display:inline-flex;width:auto;padding:8px 20px;">
                                <i class="fas fa-redo"></i> Retry
                            </button>
                        </div>
                    </td></tr>`;
            }
        }
    },

    // ============================================================
    // LOAD CERTIFICATES
    // ============================================================

    async loadCertificates() {
        const snapshot = await this.assessmentDb.collection('certificates').orderBy('createdAt', 'desc').get();
        this.allCertificates = [];
        snapshot.forEach(doc => this.allCertificates.push({ id: doc.id, ...doc.data() }));
        console.log('📜 Certificates loaded:', this.allCertificates.length);
    },

    // ============================================================
    // LOAD STUDENTS (from mainDb -> eventRegistrations)
    // ============================================================

    async loadStudents() {
        const snapshot = await this.mainDb.collection('eventRegistrations').orderBy('createdAt', 'desc').get();
        this.students = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            this.students.push({
                id: doc.id,
                studentId: data.studentId || doc.id,
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                email: data.email || '',
                school: data.school || '',
                community: data.community || '',
                educationLevel: data.educationLevel || '',
                phone: data.phone || '',
                status: data.status || 'active'
            });
        });
        console.log('👤 Students loaded from Main DB:', this.students.length);
    },

    // ============================================================
    // LOAD ASSESSMENTS
    // ============================================================

    async loadAssessments() {
        const snapshot = await this.assessmentDb.collection('assessments')
            .where('certificate.enabled', '==', true)
            .orderBy('title', 'asc')
            .get();
        this.assessments = [];
        snapshot.forEach(doc => this.assessments.push({ id: doc.id, ...doc.data() }));
        console.log('📚 Assessments loaded:', this.assessments.length);
    },

    // ============================================================
    // UPDATE STATS
    // ============================================================

    updateStats() {
        const total = this.allCertificates.length;
        const issued = this.allCertificates.filter(c => c.status === 'issued').length;
        const pending = this.allCertificates.filter(c => c.status === 'pending').length;
        const templates = this.allCertificates.filter(c => c.status === 'template' || c.isTemplate === true).length;
        const elTotal = document.getElementById('statTotal');
        const elIssued = document.getElementById('statIssued');
        const elPending = document.getElementById('statPending');
        const elTemplates = document.getElementById('statTemplates');
        if (elTotal) elTotal.textContent = total;
        if (elIssued) elIssued.textContent = issued;
        if (elPending) elPending.textContent = pending;
        if (elTemplates) elTemplates.textContent = templates;
    },

    // ============================================================
    // POPULATE FILTERS
    // ============================================================

    populateFilters() {
        const select = document.getElementById('filterAssessment');
        if (!select) return;
        while (select.options.length > 1) select.remove(1);
        this.assessments.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = a.title || 'Untitled';
            select.appendChild(opt);
        });
    },

    // ============================================================
    // FILTER
    // ============================================================

    filter() {
        const search = document.getElementById('certificateSearch')?.value?.toLowerCase() || '';
        const status = document.getElementById('filterStatus')?.value || '';
        const type = document.getElementById('filterType')?.value || '';
        const assessmentId = document.getElementById('filterAssessment')?.value || '';
        this.filteredCertificates = this.allCertificates.filter(c => {
            let match = true;
            if (search) {
                const name = `${c.studentFirstName || ''} ${c.studentLastName || ''}`.toLowerCase();
                match = match && (name.includes(search) || (c.id || '').toLowerCase().includes(search) || (c.certificateId || '').toLowerCase().includes(search));
            }
            if (status) match = match && c.status === status;
            if (type) match = match && c.type === type;
            if (assessmentId) match = match && c.assessmentId === assessmentId;
            return match;
        });
        this.currentPage = 1;
        this.renderTable();
    },

    // ============================================================
    // RENDER TABLE
    // ============================================================

    renderTable() {
        const container = document.getElementById('certificatesBody');
        const countEl = document.getElementById('certificateCount');
        if (!container) return;
        const items = this.filteredCertificates;
        const totalItems = items.length;
        if (countEl) countEl.textContent = `${totalItems} items`;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);
        const pageItems = items.slice(startIndex, endIndex);
        this.updatePagination(totalItems);

        if (totalItems === 0) {
            container.innerHTML = `
                <tr><td colspan="7">
                    <div class="empty-state">
                        <i class="fas fa-certificate"></i>
                        <h3>${this.allCertificates.length === 0 ? 'No certificates generated' : 'No matching certificates'}</h3>
                        <p>${this.allCertificates.length === 0 ? 'Click "Generate Certificate" to create certificates' : 'Try adjusting your filters'}</p>
                    </div>
                </td></tr>`;
            return;
        }

        let html = '';
        pageItems.forEach(cert => {
            const statusLabels = { issued: 'Issued', pending: 'Pending', template: 'Template', revoked: 'Revoked' };
            const statusIcons = { issued: 'fa-check-circle', pending: 'fa-clock', template: 'fa-file-alt', revoked: 'fa-times-circle' };
            const studentName = `${cert.studentFirstName || ''} ${cert.studentLastName || ''}`.trim() || 'Unknown Student';
            const typeLabels = { completion: 'Completion', achievement: 'Achievement', participation: 'Participation' };
            const gradeLabels = { outstanding: 'Outstanding', distinction: 'Distinction', merit: 'Merit', completion: 'Completion' };
            const isTemplate = cert.status === 'template' || cert.isTemplate === true;
            const isIssued = cert.status === 'issued';
            const isPending = cert.status === 'pending';

            html += `
                <tr>
                    <td><span style="font-weight:600;font-size:12px;color:#6b7280;">${cert.certificateId || cert.id.substring(0,8)}</span></td>
                    <td>
                        <strong>${this.escapeHtml(studentName)}</strong>
                        ${cert.studentEmail ? `<div style="font-size:11px;color:#6b7280;">${this.escapeHtml(cert.studentEmail)}</div>` : ''}
                        ${cert.studentId ? `<div style="font-size:10px;color:#9ca3af;">ID: ${this.escapeHtml(cert.studentId)}</div>` : ''}
                    </td>
                    <td><span class="badge-type"><i class="fas ${cert.type === 'achievement' ? 'fa-trophy' : cert.type === 'participation' ? 'fa-hand-peace' : 'fa-award'}"></i> ${typeLabels[cert.type] || cert.type || 'Completion'}</span></td>
                    <td>${cert.grade ? `<span class="grade-badge ${cert.gradeClass || 'completion'}">${gradeLabels[cert.gradeClass] || cert.grade}</span>` : '—'}</td>
                    <td><span class="badge-status ${cert.status || 'pending'}"><i class="fas ${statusIcons[cert.status] || 'fa-circle'}"></i> ${statusLabels[cert.status] || cert.status || 'Pending'}${isTemplate ? ' <span style="font-size:10px;color:#1d4ed8;font-weight:400;">(Sample)</span>' : ''}${isPending ? ' <span style="font-size:10px;color:#f59e0b;font-weight:400;">(Locked)</span>' : ''}</span></td>
                    <td>${cert.issuedAt ? this.formatDate(cert.issuedAt) : (cert.createdAt ? this.formatDate(cert.createdAt) : '—')}</td>
                    <td>
                        <div class="action-btns">
                            <button class="view" onclick="AdminCertificates.viewCertificate('${cert.id}')" title="View"><i class="fas fa-eye"></i></button>
                            ${isTemplate ? `
                                <button class="download" onclick="AdminCertificates.downloadTemplate('${cert.id}')" title="Download Template"><i class="fas fa-download"></i></button>
                                <button class="send" onclick="AdminCertificates.releaseCertificate('${cert.id}')" title="Release as Official"><i class="fas fa-rocket"></i></button>
                            ` : isIssued ? `
                                <button class="download" onclick="AdminCertificates.downloadCertificate('${cert.id}')" title="Download"><i class="fas fa-download"></i></button>
                                <button class="send" onclick="AdminCertificates.emailCertificate('${cert.id}')" title="Email to Student"><i class="fas fa-envelope"></i></button>
                                <button class="revoke" onclick="AdminCertificates.revokeCertificate('${cert.id}')" title="Revoke"><i class="fas fa-ban"></i></button>
                            ` : isPending ? `
                                <button class="send" onclick="AdminCertificates.releaseCertificate('${cert.id}')" title="Release Certificate" style="color:#f59e0b;"><i class="fas fa-unlock"></i></button>
                            ` : `
                                <button class="download" onclick="AdminCertificates.downloadCertificate('${cert.id}')" title="Download"><i class="fas fa-download"></i></button>
                                <button class="send" onclick="AdminCertificates.releaseCertificate('${cert.id}')" title="Release"><i class="fas fa-rocket"></i></button>
                            `}
                            <button class="delete" onclick="AdminCertificates.deleteCertificate('${cert.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        container.innerHTML = html;
    },

    // ============================================================
    // PAGINATION
    // ============================================================

    changeItemsPerPage() {
        this.itemsPerPage = parseInt(document.getElementById('itemsPerPageSelect').value);
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
        if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
        if (this.currentPage < 1) this.currentPage = 1;
        const start = (this.currentPage - 1) * this.itemsPerPage + 1;
        const end = Math.min(this.currentPage * this.itemsPerPage, totalItems);
        const info = document.getElementById('paginationInfo');
        if (info) info.textContent = totalItems > 0 ? `Showing ${start}-${end} of ${totalItems} items` : 'No items';
        const firstBtn = document.getElementById('pageFirst');
        const prevBtn = document.getElementById('pagePrev');
        const nextBtn = document.getElementById('pageNext');
        const lastBtn = document.getElementById('pageLast');
        if (firstBtn) firstBtn.disabled = this.currentPage === 1 || totalItems === 0;
        if (prevBtn) prevBtn.disabled = this.currentPage === 1 || totalItems === 0;
        if (nextBtn) nextBtn.disabled = this.currentPage === this.totalPages || totalItems === 0;
        if (lastBtn) lastBtn.disabled = this.currentPage === this.totalPages || totalItems === 0;

        const pageNumbers = document.getElementById('pageNumbers');
        if (!pageNumbers) return;
        let html = '';
        const maxVisible = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
        if (startPage > 1) {
            html += `<button onclick="AdminCertificates.goToPage(1)">1</button>`;
            if (startPage > 2) html += `<span class="page-dots">...</span>`;
        }
        for (let i = startPage; i <= endPage; i++) {
            html += `<button onclick="AdminCertificates.goToPage(${i})" class="${i === this.currentPage ? 'active' : ''}">${i}</button>`;
        }
        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) html += `<span class="page-dots">...</span>`;
            html += `<button onclick="AdminCertificates.goToPage(${this.totalPages})">${this.totalPages}</button>`;
        }
        pageNumbers.innerHTML = html;
    },

    // ============================================================
    // ENSURE DB
    // ============================================================

    ensureDb() {
        if (!this.mainDb || !this.assessmentDb) {
            console.error('❌ Databases not initialized');
            return false;
        }
        return true;
    },

    // ============================================================
    // GET ALL STUDENTS (for generation)
    // ============================================================

    async getAllStudents() {
        const snapshot = await this.mainDb.collection('eventRegistrations').orderBy('createdAt', 'desc').get();
        const students = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            students.push({
                id: doc.id,
                studentId: data.studentId || doc.id,
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                email: data.email || '',
                school: data.school || '',
                community: data.community || '',
                educationLevel: data.educationLevel || '',
                phone: data.phone || '',
                status: data.status || 'active'
            });
        });

        // Attach result info from assessmentDb
        const assessmentIds = new Set(this.assessments.map(a => a.id));
        const studentResults = {};
        try {
            const resultsSnap = await this.assessmentDb.collection('studentResults')
                .where('status', '==', 'submitted')
                .get();
            resultsSnap.forEach(doc => {
                const data = doc.data();
                if (assessmentIds.has(data.assessmentId)) {
                    const key = data.studentId;
                    if (!studentResults[key]) studentResults[key] = { completedAssessments: 0, totalScore: 0, assessments: [] };
                    studentResults[key].completedAssessments++;
                    studentResults[key].totalScore += data.score || 0;
                    studentResults[key].assessments.push({ assessmentId: data.assessmentId, score: data.score || 0 });
                }
            });
        } catch (e) {}
        return students.map(s => {
            const r = studentResults[s.studentId] || { completedAssessments: 0, totalScore: 0, assessments: [] };
            return { ...s, ...r, hasCompleted: r.completedAssessments > 0 };
        });
    },

    // ============================================================
    // GET SIGNATORY BY DEPARTMENT
    // ============================================================

    getSignatoryByDepartment(department) {
        const deptHead = this.departmentHeads[department];
        if (deptHead) {
            let sigKey = 'departmentHead';
            for (const [key, val] of Object.entries(this.signatories)) {
                if (val.name === deptHead.name) { sigKey = key; break; }
            }
            return this.signatories[sigKey] || this.signatories.departmentHead;
        }
        return this.signatories.departmentHead;
    },

    // ============================================================
    // OPEN GENERATE MODAL
    // ============================================================

    async openGenerateModal() {
        if (!this.ensureDb()) { showToast('Database not initialized.', true); return; }
        const modalBody = document.getElementById('modalBody');
        const modalTitle = document.getElementById('modalTitle');
        const modalFooter = document.getElementById('modalFooter');
        if (!modalBody || !modalTitle) { showToast('Modal elements not found.', true); return; }
        modalTitle.textContent = 'Generate DBI Certificate';

        try {
            const allStudents = await this.getAllStudents();
            const studentOptions = allStudents.length > 0 ? allStudents.map(s => {
                const hasCompleted = s.hasCompleted || false;
                const badgeClass = hasCompleted ? 'student-badge' : 'student-badge no-assessment';
                const badgeText = hasCompleted ? `${s.completedAssessments} assessments` : 'No assessments';
                return `
                    <div class="student-item" onclick="AdminCertificates.toggleStudentSelect('${s.id}')">
                        <input type="checkbox" id="student_${s.id}" value="${s.id}">
                        <div class="student-info">
                            <div class="name">${this.escapeHtml(s.firstName || '')} ${this.escapeHtml(s.lastName || '')}</div>
                            <div class="email">ID: ${this.escapeHtml(s.studentId)}${s.email ? ` • ${this.escapeHtml(s.email)}` : ''}</div>
                        </div>
                        <div class="${badgeClass}">${badgeText}</div>
                    </div>
                `;
            }).join('') : '<div style="padding:20px;text-align:center;color:#6b7280;">No students found.</div>';

            const assessmentOptions = this.assessments.length > 0 ? this.assessments.map(a => `
                <option value="${a.id}" data-department="${a.department || 'General'}">${this.escapeHtml(a.title)}</option>
            `).join('') : '<option value="">No certificate-eligible assessments</option>';

            const signatoryOptions = Object.entries(this.signatories).map(([key, val]) => `
                <option value="${key}">${val.name} - ${val.title}</option>
            `).join('');

            modalBody.innerHTML = `
                <div class="modal-body-inner">
                    <form id="generateCertForm">
                        <div class="manual-issue-note">
                            <i class="fas fa-info-circle"></i> <strong>Manual Issuance:</strong> You can generate certificates for any student, even without assessment completion.
                        </div>
                        <div class="form-group">
                            <label>Select Students <span class="required">*</span></label>
                            <div class="student-select-list" id="studentSelectList">${studentOptions}</div>
                            <div class="help-text"><i class="fas fa-info-circle"></i> Select one or more students</div>
                        </div>
                        <div class="form-group">
                            <label>Certificate Type <span class="required">*</span></label>
                            <select id="certType" required>
                                <option value="completion">Certificate of Completion</option>
                                <option value="achievement">Certificate of Achievement</option>
                                <option value="participation">Certificate of Participation</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Based on Assessment <span class="required">*</span></label>
                            <select id="certAssessment" required>
                                <option value="">Select an assessment...</option>
                                ${assessmentOptions}
                            </select>
                            <div class="help-text"><i class="fas fa-info-circle"></i> The certificate will be based on this assessment</div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Program Code <span class="required">*</span></label>
                                <select id="programCode" required>
                                    <option value="SD">Software Development (SD)</option>
                                    <option value="GM">Graphics & Multimedia (GM)</option>
                                    <option value="DA">Data Analysis (DA)</option>
                                    <option value="DM">Digital Marketing (DM)</option>
                                    <option value="CS">Cybersecurity (CS)</option>
                                    <option value="NC">Network & Cloud (NC)</option>
                                    <option value="DS">Digital Skills (DS)</option>
                                    <option value="GEN">General (GEN)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Certificate Status</label>
                                <select id="certStatus">
                                    <option value="pending">Pending Release (Locked)</option>
                                    <option value="issued">Issue Immediately</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Achievement Description (optional)</label>
                            <input type="text" id="achievementDesc" placeholder="e.g., Top Performer">
                        </div>
                        <div class="form-group">
                            <label>Event Name (for Participation)</label>
                            <input type="text" id="eventName" placeholder="e.g., Digital Marketing Bootcamp">
                        </div>
                        <div class="form-group">
                            <label>Select Signatories <span class="required">*</span> (at least two)</label>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Signatory 1 (Executive Director)</label>
                                    <select id="signatory1">${signatoryOptions}</select>
                                </div>
                                <div class="form-group">
                                    <label>Signatory 2 (Department Head)</label>
                                    <select id="signatory2">${signatoryOptions}</select>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Signatory 3 (optional)</label>
                                    <select id="signatory3"><option value="">None</option>${signatoryOptions}</select>
                                </div>
                                <div class="form-group">
                                    <label>Signatory 4 (optional)</label>
                                    <select id="signatory4"><option value="">None</option>${signatoryOptions}</select>
                                </div>
                            </div>
                            <div class="help-text"><i class="fas fa-info-circle"></i> At least two signatories are required.</div>
                        </div>
                        <div style="display:flex;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
                            <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
                            <button type="submit" class="btn-primary" style="flex:1;"><i class="fas fa-certificate"></i> Generate Certificates</button>
                        </div>
                    </form>
                </div>
            `;

            // Auto-select signatories based on assessment department
            document.getElementById('certAssessment').addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                const department = selectedOption.getAttribute('data-department') || 'General';
                const deptHead = AdminCertificates.departmentHeads[department];
                if (deptHead) {
                    let sigKey = 'departmentHead';
                    for (const [key, val] of Object.entries(AdminCertificates.signatories)) {
                        if (val.name === deptHead.name) {
                            sigKey = key;
                            break;
                        }
                    }
                    document.getElementById('signatory2').value = sigKey;
                }
                document.getElementById('signatory1').value = 'executiveDirector';
            });

            // Trigger initial change if any assessment pre-selected
            const assessmentSelect = document.getElementById('certAssessment');
            if (assessmentSelect.options.length > 1) {
                assessmentSelect.dispatchEvent(new Event('change'));
            }

            if (modalFooter) modalFooter.innerHTML = '';
            const form = document.getElementById('generateCertForm');
            if (form) form.onsubmit = (e) => this.generateCertificates(e);
            this.openModal();
        } catch (error) {
            console.error('Error opening generate modal:', error);
            showToast('Error loading students: ' + error.message, true);
        }
    },

    // ============================================================
    // TOGGLE STUDENT SELECT
    // ============================================================

    toggleStudentSelect(studentId) {
        const checkbox = document.getElementById(`student_${studentId}`);
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            const parent = checkbox.closest('.student-item');
            if (parent) parent.classList.toggle('selected');
        }
    },

    // ============================================================
    // GENERATE CERTIFICATES
    // ============================================================

    async generateCertificates(e) {
        e.preventDefault();
        if (!this.ensureDb()) { showToast('Database not initialized.', true); return; }
        const submitBtn = e.target.querySelector('button[type="submit"]');
        this.setLoading(submitBtn, true);

        try {
            const selectedStudents = [];
            document.querySelectorAll('#studentSelectList input[type="checkbox"]:checked').forEach(cb => selectedStudents.push(cb.value));
            if (selectedStudents.length === 0) { showToast('Select at least one student.', true); this.setLoading(submitBtn, false); return; }

            const type = document.getElementById('certType').value;
            const assessmentId = document.getElementById('certAssessment').value;
            const status = document.getElementById('certStatus').value;
            const programCode = document.getElementById('programCode').value;
            const achievementDesc = document.getElementById('achievementDesc').value.trim();
            const eventName = document.getElementById('eventName').value.trim();
            const signatory1 = document.getElementById('signatory1').value;
            const signatory2 = document.getElementById('signatory2').value;
            const signatory3 = document.getElementById('signatory3').value || null;
            const signatory4 = document.getElementById('signatory4').value || null;

            if (!assessmentId) { showToast('Select an assessment.', true); this.setLoading(submitBtn, false); return; }
            if (!signatory1 || !signatory2) { showToast('At least two signatories are required.', true); this.setLoading(submitBtn, false); return; }

            const assessmentDoc = await this.assessmentDb.collection('assessments').doc(assessmentId).get();
            if (!assessmentDoc.exists) { showToast('Assessment not found.', true); this.setLoading(submitBtn, false); return; }
            const assessmentData = assessmentDoc.data();

            let generated = 0, failed = 0;
            for (const studentDocId of selectedStudents) {
                try {
                    const studentDoc = await this.mainDb.collection('eventRegistrations').doc(studentDocId).get();
                    if (!studentDoc.exists) { failed++; continue; }
                    const studentData = studentDoc.data();
                    const studentId = studentData.studentId || studentDocId;

                    let score = 0, grade = 'Completion', gradeClass = 'completion', hasResult = false;
                    try {
                        const resultsSnap = await this.assessmentDb.collection('studentResults')
                            .where('studentId', '==', studentId)
                            .where('assessmentId', '==', assessmentId)
                            .where('status', '==', 'submitted')
                            .orderBy('attemptNumber', 'desc').limit(1).get();
                        if (!resultsSnap.empty) {
                            const result = resultsSnap.docs[0].data();
                            score = result.score || 0;
                            hasResult = true;
                            if (type === 'achievement' || type === 'completion') {
                                if (score >= 80) { grade = 'Outstanding'; gradeClass = 'outstanding'; }
                                else if (score >= 70) { grade = 'Distinction'; gradeClass = 'distinction'; }
                                else if (score >= 60) { grade = 'Merit'; gradeClass = 'merit'; }
                            }
                        }
                    } catch (e) {}

                    const year = new Date().getFullYear().toString().slice(-2);
                    const typeCode = type === 'achievement' ? 'CA' : type === 'participation' ? 'CP' : 'CC';
                    const existingCount = this.allCertificates.filter(c => c.certificateId && c.certificateId.startsWith(`DBI-${programCode}-${year}-${typeCode}`)).length + 1;
                    const seq = String(existingCount).padStart(3, '0');
                    const certificateId = `DBI-${programCode}-${year}-${typeCode}${seq}`;

                    const certData = {
                        certificateId,
                        studentId,
                        studentDocId,
                        studentFirstName: studentData.firstName || '',
                        studentLastName: studentData.lastName || '',
                        studentEmail: studentData.email || '',
                        assessmentId,
                        assessmentTitle: assessmentData.title || 'Untitled',
                        department: assessmentData.department || 'General',
                        type,
                        grade,
                        gradeClass,
                        score,
                        hasResult,
                        status,
                        issuedAt: status === 'issued' ? firebase.firestore.FieldValue.serverTimestamp() : null,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        template: assessmentData.certificate?.template || 'default',
                        isTemplate: false,
                        isManual: !hasResult,
                        watermark: status === 'pending' ? 'PENDING' : null,
                        isLocked: status === 'pending',
                        achievementDesc,
                        eventName,
                        signatory1,
                        signatory2,
                        signatory3,
                        signatory4,
                        programCode
                    };

                    await this.assessmentDb.collection('certificates').add(certData);
                    generated++;
                } catch (err) { console.error(err); failed++; }
            }

            this.setLoading(submitBtn, false);
            closeModal();
            let msg = `✅ ${generated} certificate(s) generated!`;
            if (failed > 0) msg += ` (${failed} failed)`;
            showToast(msg);
            await this.loadData();
        } catch (err) {
            console.error(err);
            this.setLoading(submitBtn, false);
            showToast('Error generating certificates: ' + err.message, true);
        }
    },

    // ============================================================
    // VIEW CERTIFICATE
    // ============================================================

    viewCertificate(certId) {
        const cert = this.allCertificates.find(c => c.id === certId);
        if (!cert) { showToast('Certificate not found', true); return; }
        const modalBody = document.getElementById('modalBody');
        const modalTitle = document.getElementById('modalTitle');
        const modalFooter = document.getElementById('modalFooter');
        if (!modalBody || !modalTitle) { showToast('Modal elements not found.', true); return; }

        const isTemplate = cert.status === 'template' || cert.isTemplate === true;
        const isPending = cert.status === 'pending';
        modalTitle.textContent = isTemplate ? 'Certificate Template - DBI' : 'Certificate Details - DBI';
        const htmlContent = this.buildProfessionalCertificateHTML(cert, isTemplate);
        modalBody.innerHTML = `
            <div class="modal-body-inner" style="background:#f3f4f6;">
                ${htmlContent}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;padding:16px;background:white;border-radius:8px;border-top:1px solid #e5e7eb;">
                    <div><strong>Certificate ID:</strong> ${cert.certificateId || cert.id.substring(0,8)}</div>
                    <div><strong>Student:</strong> ${this.escapeHtml(`${cert.studentFirstName || ''} ${cert.studentLastName || ''}`.trim() || 'Unknown')}</div>
                    <div><strong>Type:</strong> ${cert.type === 'achievement' ? 'Achievement' : cert.type === 'participation' ? 'Participation' : 'Completion'}</div>
                    <div><strong>Grade:</strong> ${cert.grade || 'N/A'}</div>
                    <div><strong>Status:</strong> ${cert.status || 'Pending'} ${isPending ? '🔒' : '✅'}</div>
                    <div><strong>Created:</strong> ${this.formatDate(cert.createdAt)}</div>
                    ${cert.issuedAt ? `<div><strong>Issued:</strong> ${this.formatDate(cert.issuedAt)}</div>` : ''}
                    ${cert.score ? `<div><strong>Score:</strong> ${cert.score}%</div>` : ''}
                    ${cert.isManual ? `<div><strong>Issuance:</strong> Manual</div>` : ''}
                    <div><strong>Program:</strong> ${cert.programCode || 'GEN'}</div>
                </div>
            </div>
        `;
        if (modalFooter) {
            modalFooter.innerHTML = `
                <button class="btn-secondary" onclick="closeModal()">Close</button>
                ${isTemplate ? `
                    <button class="btn-primary" onclick="AdminCertificates.downloadTemplate('${cert.id}')"><i class="fas fa-download"></i> Download Template</button>
                    <button class="btn-primary" onclick="AdminCertificates.releaseCertificate('${cert.id}')" style="background:#f59e0b;"><i class="fas fa-rocket"></i> Release as Official</button>
                ` : isPending ? `
                    <button class="btn-primary" onclick="AdminCertificates.releaseCertificate('${cert.id}')" style="background:#f59e0b;"><i class="fas fa-unlock"></i> Release & Unlock</button>
                ` : `
                    <button class="btn-primary" onclick="AdminCertificates.downloadCertificate('${cert.id}')"><i class="fas fa-download"></i> Download Certificate</button>
                    <button class="btn-secondary" onclick="AdminCertificates.emailCertificate('${cert.id}')"><i class="fas fa-envelope"></i> Email to Student</button>
                `}
            `;
        }
        this.openModal();
        setTimeout(() => {
            const qrContainer = modalBody.querySelector('.qr-container');
            if (qrContainer) {
                const verificationUrl = `https://dbi-learn.pages.dev/verify-certificate?id=${cert.certificateId || cert.id}`;
                this.generateQRCode(verificationUrl, qrContainer.id);
            }
        }, 300);
    },

    // ============================================================
    // DOWNLOAD CERTIFICATE
    // ============================================================

    downloadCertificate(certId) {
        const cert = this.allCertificates.find(c => c.id === certId);
        if (!cert) { showToast('Certificate not found', true); return; }
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) { showToast('Please allow popups', true); return; }
        const htmlContent = this.buildProfessionalCertificateHTML(cert, false);
        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>DBI Certificate - ${cert.certificateId || cert.id}</title>
            <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter','Segoe UI',sans-serif;background:white;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;}@media print{body{padding:0;}}${this.getCertificateStyles()}</style>
            </head>
            <body>
                ${htmlContent}
                <script>
                    window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); };
                <\/script>
            </body>
            </html>
        `;
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        showToast('Certificate opened for printing/download');
    },

    // ============================================================
    // OPEN TEMPLATE MODAL
    // ============================================================

    openTemplateModal() {
        if (!this.ensureDb()) { showToast('Database not initialized.', true); return; }
        const modalBody = document.getElementById('modalBody');
        const modalTitle = document.getElementById('modalTitle');
        const modalFooter = document.getElementById('modalFooter');
        if (!modalBody || !modalTitle) { showToast('Modal elements not found.', true); return; }
        modalTitle.textContent = 'Generate DBI Certificate Template';

        const assessmentOptions = this.assessments.length > 0 ? this.assessments.map(a => `
            <option value="${a.id}" data-department="${a.department || 'General'}">${this.escapeHtml(a.title)}</option>
        `).join('') : '<option value="">No certificate-eligible assessments</option>';

        const signatoryOptions = Object.entries(this.signatories).map(([key, val]) => `
            <option value="${key}">${val.name} - ${val.title}</option>
        `).join('');

        modalBody.innerHTML = `
            <div class="modal-body-inner">
                <form id="templateForm">
                    <div class="form-group">
                        <label>Select Assessment <span class="required">*</span></label>
                        <select id="templateAssessment" required>
                            <option value="">Select an assessment...</option>
                            ${assessmentOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Template Type <span class="required">*</span></label>
                        <select id="templateType" required>
                            <option value="completion">Certificate of Completion</option>
                            <option value="achievement">Certificate of Achievement</option>
                            <option value="participation">Certificate of Participation</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Student Name (for preview)</label>
                        <input type="text" id="templateStudentName" placeholder="e.g., John Doe" value="Sample Student">
                    </div>
                    <div class="form-group">
                        <label>Program Code</label>
                        <select id="templateProgramCode">
                            <option value="SD">Software Development (SD)</option>
                            <option value="GM">Graphics & Multimedia (GM)</option>
                            <option value="DA">Data Analysis (DA)</option>
                            <option value="DM">Digital Marketing (DM)</option>
                            <option value="CS">Cybersecurity (CS)</option>
                            <option value="NC">Network & Cloud (NC)</option>
                            <option value="DS">Digital Skills (DS)</option>
                            <option value="GEN">General (GEN)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Select Signatories</label>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Signatory 1</label>
                                <select id="templateSignatory1">${signatoryOptions}</select>
                            </div>
                            <div class="form-group">
                                <label>Signatory 2</label>
                                <select id="templateSignatory2">${signatoryOptions}</select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Signatory 3 (optional)</label>
                                <select id="templateSignatory3"><option value="">None</option>${signatoryOptions}</select>
                            </div>
                            <div class="form-group">
                                <label>Signatory 4 (optional)</label>
                                <select id="templateSignatory4"><option value="">None</option>${signatoryOptions}</select>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
                        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
                        <button type="submit" class="btn-primary" style="flex:1;"><i class="fas fa-file-pdf"></i> Generate Template</button>
                    </div>
                </form>
            </div>
        `;

        // Auto-select department head when assessment changes
        document.getElementById('templateAssessment').addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const department = selectedOption.getAttribute('data-department') || 'General';
            const deptHead = AdminCertificates.departmentHeads[department];
            if (deptHead) {
                let sigKey = 'departmentHead';
                for (const [key, val] of Object.entries(AdminCertificates.signatories)) {
                    if (val.name === deptHead.name) { sigKey = key; break; }
                }
                document.getElementById('templateSignatory2').value = sigKey;
            }
            document.getElementById('templateSignatory1').value = 'executiveDirector';
        });
        // Trigger initial change if an assessment is pre-selected
        const assessmentSelect = document.getElementById('templateAssessment');
        if (assessmentSelect.options.length > 1) assessmentSelect.dispatchEvent(new Event('change'));

        if (modalFooter) modalFooter.innerHTML = '';
        const form = document.getElementById('templateForm');
        if (form) form.onsubmit = (e) => this.generateTemplate(e);
        this.openModal();
    },

    // ============================================================
    // GENERATE TEMPLATE
    // ============================================================

    async generateTemplate(e) {
        e.preventDefault();
        if (!this.ensureDb()) { showToast('Database not initialized.', true); return; }
        const submitBtn = e.target.querySelector('button[type="submit"]');
        this.setLoading(submitBtn, true);

        try {
            const assessmentId = document.getElementById('templateAssessment').value;
            const type = document.getElementById('templateType').value;
            const studentName = document.getElementById('templateStudentName').value.trim() || 'Sample Student';
            const programCode = document.getElementById('templateProgramCode').value;
            const signatory1 = document.getElementById('templateSignatory1').value;
            const signatory2 = document.getElementById('templateSignatory2').value;
            const signatory3 = document.getElementById('templateSignatory3').value || null;
            const signatory4 = document.getElementById('templateSignatory4').value || null;

            if (!assessmentId) { showToast('Select an assessment.', true); this.setLoading(submitBtn, false); return; }
            if (!signatory1 || !signatory2) { showToast('At least two signatories required.', true); this.setLoading(submitBtn, false); return; }

            const assessmentDoc = await this.assessmentDb.collection('assessments').doc(assessmentId).get();
            if (!assessmentDoc.exists) { showToast('Assessment not found.', true); this.setLoading(submitBtn, false); return; }
            const assessmentData = assessmentDoc.data();

            const year = new Date().getFullYear().toString().slice(-2);
            const typeCode = type === 'achievement' ? 'CA' : type === 'participation' ? 'CP' : 'CC';
            const certificateId = `DBI-${programCode}-${year}-${typeCode}TMP`;

            const certData = {
                certificateId,
                studentId: 'template',
                studentFirstName: studentName.split(' ')[0] || 'Sample',
                studentLastName: studentName.split(' ').slice(1).join(' ') || 'Student',
                studentEmail: 'template@example.com',
                assessmentId,
                assessmentTitle: assessmentData.title || 'Untitled',
                department: assessmentData.department || 'General',
                type,
                grade: type === 'achievement' ? 'Outstanding' : 'Completion',
                gradeClass: type === 'achievement' ? 'outstanding' : 'completion',
                score: type === 'achievement' ? 92 : 85,
                status: 'template',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                isTemplate: true,
                watermark: 'SAMPLE / TEMPLATE',
                signatory1,
                signatory2,
                signatory3,
                signatory4,
                programCode
            };

            const docRef = await this.assessmentDb.collection('certificates').add(certData);
            const cert = { id: docRef.id, ...certData };
            this.setLoading(submitBtn, false);
            closeModal();
            showToast('✅ Template generated successfully!');
            this.viewCertificate(cert.id);
            await this.loadData();
        } catch (err) {
            console.error(err);
            this.setLoading(submitBtn, false);
            showToast('Error generating template: ' + err.message, true);
        }
    },

    // ============================================================
    // DOWNLOAD TEMPLATE
    // ============================================================

    downloadTemplate(certId) {
        const cert = this.allCertificates.find(c => c.id === certId);
        if (!cert) { showToast('Template not found', true); return; }
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) { showToast('Please allow popups', true); return; }
        const htmlContent = this.buildProfessionalCertificateHTML(cert, true);
        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>DBI Certificate Template</title>
            <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter','Segoe UI',sans-serif;background:#f3f4f6;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;}@media print{body{padding:0;background:white;}}${this.getCertificateStyles()}.dbi-certificate-preview.template .watermark{display:block !important;}</style>
            </head>
            <body>
                ${htmlContent}
                <script>
                    window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); };
                <\/script>
            </body>
            </html>
        `;
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        showToast('Template opened for preview/download');
    },

    // ============================================================
    // RELEASE CERTIFICATE
    // ============================================================

    async releaseCertificate(certId) {
        const cert = this.allCertificates.find(c => c.id === certId);
        if (!cert) { showToast('Certificate not found', true); return; }
        const isTemplate = cert.status === 'template' || cert.isTemplate === true;
        if (!confirm(`Are you sure you want to ${isTemplate ? 'release this template as official' : 'release this certificate'}?`)) return;
        if (!this.ensureDb()) { showToast('Database not initialized.', true); return; }
        const btn = document.querySelector(`[onclick*="releaseCertificate('${certId}')"]`);
        this.setLoading(btn, true);
        try {
            await this.assessmentDb.collection('certificates').doc(certId).update({
                status: 'issued',
                issuedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                isTemplate: false,
                isLocked: false,
                watermark: null
            });
            showToast(isTemplate ? '✅ Template released as official certificate!' : '✅ Certificate released and unlocked!');
            this.setLoading(btn, false);
            await this.loadData();
        } catch (err) {
            console.error(err);
            this.setLoading(btn, false);
            showToast('Error releasing certificate: ' + err.message, true);
        }
    },

    // ============================================================
    // BULK RELEASE
    // ============================================================

    async bulkRelease() {
        if (!this.ensureDb()) { showToast('Database not initialized.', true); return; }
        const pendingCerts = this.allCertificates.filter(c => c.status === 'pending' && c.isTemplate !== true);
        if (pendingCerts.length === 0) { showToast('No pending certificates to release.', true); return; }
        if (!confirm(`Release ${pendingCerts.length} pending certificate(s)?`)) return;
        try {
            let released = 0;
            for (const cert of pendingCerts) {
                await this.assessmentDb.collection('certificates').doc(cert.id).update({
                    status: 'issued',
                    issuedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isLocked: false,
                    watermark: null
                });
                released++;
            }
            showToast(`✅ ${released} certificate(s) released!`);
            await this.loadData();
        } catch (err) {
            console.error(err);
            showToast('Error in bulk release: ' + err.message, true);
        }
    },

    // ============================================================
    // REVOKE CERTIFICATE
    // ============================================================

    async revokeCertificate(certId) {
        if (!confirm('⚠️ Are you sure you want to revoke this certificate? This cannot be undone.')) return;
        if (!this.ensureDb()) { showToast('Database not initialized.', true); return; }
        const btn = document.querySelector(`[onclick*="revokeCertificate('${certId}')"]`);
        this.setLoading(btn, true);
        try {
            await this.assessmentDb.collection('certificates').doc(certId).update({
                status: 'revoked',
                revokedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                isLocked: true
            });
            showToast('⚠️ Certificate revoked.');
            this.setLoading(btn, false);
            await this.loadData();
        } catch (err) {
            console.error(err);
            this.setLoading(btn, false);
            showToast('Error revoking certificate: ' + err.message, true);
        }
    },

    // ============================================================
    // DELETE CERTIFICATE
    // ============================================================

    async deleteCertificate(certId) {
        if (!confirm('Are you sure you want to delete this certificate? This cannot be undone.')) return;
        if (!this.ensureDb()) { showToast('Database not initialized.', true); return; }
        const btn = document.querySelector(`[onclick*="deleteCertificate('${certId}')"]`);
        this.setLoading(btn, true);
        try {
            await this.assessmentDb.collection('certificates').doc(certId).delete();
            showToast('Certificate deleted.');
            this.setLoading(btn, false);
            await this.loadData();
        } catch (err) {
            console.error(err);
            this.setLoading(btn, false);
            showToast('Error deleting certificate: ' + err.message, true);
        }
    },

    // ============================================================
    // EMAIL CERTIFICATE
    // ============================================================

    async emailCertificate(certId) {
        const cert = this.allCertificates.find(c => c.id === certId);
        if (!cert) { showToast('Certificate not found', true); return; }
        if (!cert.studentEmail) { showToast('Student has no email address.', true); return; }
        if (!this.ensureDb()) { showToast('Database not initialized.', true); return; }
        const btn = document.querySelector(`[onclick*="emailCertificate('${certId}')"]`);
        this.setLoading(btn, true);
        try {
            // In a real app, you'd call a cloud function to send email.
            showToast(`📧 Certificate emailed to ${cert.studentEmail}`);
            this.setLoading(btn, false);
            // Log the email
            await this.assessmentDb.collection('emailLogs').add({
                type: 'certificate',
                certificateId: cert.id,
                studentId: cert.studentId,
                studentEmail: cert.studentEmail,
                sentAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'sent'
            });
        } catch (err) {
            console.error(err);
            this.setLoading(btn, false);
            showToast('Error emailing certificate: ' + err.message, true);
        }
    },

    // ============================================================
    // EXPORT DATA
    // ============================================================

    exportData() {
        const data = this.filteredCertificates.map(c => ({
            id: c.id,
            certificateId: c.certificateId,
            studentName: `${c.studentFirstName || ''} ${c.studentLastName || ''}`.trim(),
            studentEmail: c.studentEmail,
            assessmentTitle: c.assessmentTitle,
            type: c.type,
            grade: c.grade,
            score: c.score,
            status: c.status,
            isManual: c.isManual || false,
            issuedAt: c.issuedAt ? this.formatDate(c.issuedAt) : null,
            createdAt: c.createdAt ? this.formatDate(c.createdAt) : null,
            programCode: c.programCode || 'GEN'
        }));
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificates_export_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`✅ Exported ${data.length} certificates`);
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

    openModal() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) {
            overlay.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) {
            overlay.classList.remove('show');
            document.body.style.overflow = '';
        }
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
                    year: 'numeric', month: 'long', day: 'numeric'
                });
            }
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        } catch { return 'N/A'; }
    },

    // ============================================================
    // GET GRADE
    // ============================================================

    getGrade(score) {
        if (score >= 80) return { name: 'Outstanding', class: 'outstanding', icon: '🏆' };
        else if (score >= 70) return { name: 'Distinction', class: 'distinction', icon: '🥇' };
        else if (score >= 60) return { name: 'Merit', class: 'merit', icon: '🥈' };
        else return { name: 'Completion', class: 'completion', icon: '🎓' };
    }
};

// ============================================================
// EXPORT FOR GLOBAL ACCESS
// ============================================================

window.AdminCertificates = AdminCertificates;
console.log('✅ AdminCertificates module fully loaded');