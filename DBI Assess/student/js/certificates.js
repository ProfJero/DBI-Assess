// ============================================================
// STUDENT CERTIFICATES - PROFESSIONAL DBI DESIGN
// ============================================================

const StudentCertificates = {
    db: null,
    currentUser: null,
    certificatesData: [],
    currentCertificate: null,

    // DBI Brand Colors
    colors: {
        primary: '#1e88e5',
        secondary: '#00c853',
        dark: '#00335f',
        gold: '#fbbf24',
        silver: '#94a3b8',
        bronze: '#cd7f32',
        platinum: '#6b7280',
        lightBg: '#f8fafc'
    },

    // Signatories (updated to match admin)
    signatories: {
        executiveDirector: {
            name: 'Benjamin Amoako',
            title: 'Executive Director',
            signature: '../images/signatures/executive-director.png'
        },
        departmentHead: {
            name: 'Abel Eduah',  // default; overridden by department-specific head
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

    // Department Heads mapping (same as admin)
    departmentHeads: {
        'Software Development': { name: 'Benjamin Amoako', title: 'Head of Software Development', dept: 'DigitalCore' },
        'Graphics & Multimedia': { name: 'Abel Eduah', title: 'Head of Graphics & Multimedia', dept: 'Creative Impact' },
        'Data Analysis': { name: 'Godsway Arhin', title: 'Head of Data Analysis', dept: 'Next Gen DATA-LAB' },
        'Digital Marketing': { name: 'Emmanuel Mensah', title: 'Head of Digital Marketing', dept: 'DigitalBridge Academy' },
        'Cybersecurity': { name: 'Michael Asare', title: 'Head of Cybersecurity', dept: 'DigitalBridge Academy' },
        'Network & Cloud': { name: 'David Osei', title: 'Head of Network & Cloud', dept: 'DigitalBridge Academy' },
        'Digital Skills': { name: 'Sarah Appiah', title: 'Head of Digital Skills', dept: 'DigitalBridge Academy' }
    },

    // ============================================================
    // INIT - Initialize the module
    // ============================================================

    init(db, currentUser) {
        this.db = db;
        this.currentUser = currentUser;
        console.log('✅ StudentCertificates initialized');
        console.log('👤 Current user:', this.currentUser);
        console.log('🆔 Student ID:', this.currentUser.studentId);
        this.loadCertificates();
    },

    // ============================================================
    // LOAD CERTIFICATES
    // ============================================================

    async loadCertificates() {
        try {
            const studentId = this.currentUser.studentId;
            
            console.log('📜 Loading certificates for student:', studentId);
            
            // Method 1: Query using the studentId field (custom ID)
            let certSnap = await this.db.collection('certificates')
                .where('studentId', '==', studentId)
                .get();

            console.log('📜 Method 1 - Certificates found with studentId:', certSnap.size);

            let allCerts = [];
            certSnap.forEach(doc => {
                const data = doc.data();
                if (data.status !== 'template' && data.isTemplate !== true) {
                    allCerts.push({ id: doc.id, ...data });
                }
            });

            // Method 2: If no certificates found, try using studentDocId
            if (allCerts.length === 0) {
                console.log('🔍 Method 1 found no certificates. Trying studentDocId...');
                certSnap = await this.db.collection('certificates')
                    .where('studentDocId', '==', studentId)
                    .get();

                console.log('📜 Method 2 - Certificates found with studentDocId:', certSnap.size);

                certSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.status !== 'template' && data.isTemplate !== true) {
                        allCerts.push({ id: doc.id, ...data });
                    }
                });
            }

            // Method 3: If still no certificates, try searching by student email
            if (allCerts.length === 0 && this.currentUser.email) {
                console.log('🔍 Method 2 found no certificates. Trying student email...');
                certSnap = await this.db.collection('certificates')
                    .where('studentEmail', '==', this.currentUser.email)
                    .get();

                console.log('📜 Method 3 - Certificates found with studentEmail:', certSnap.size);

                certSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.status !== 'template' && data.isTemplate !== true) {
                        allCerts.push({ id: doc.id, ...data });
                    }
                });
            }

            // Method 4: Check if any certificate has the student ID in the document ID
            if (allCerts.length === 0) {
                console.log('🔍 Method 3 found no certificates. Checking document IDs...');
                
                const allCertSnap = await this.db.collection('certificates')
                    .get();
                
                console.log('📊 Total certificates in database:', allCertSnap.size);
                
                allCertSnap.forEach(doc => {
                    const data = doc.data();
                    if (doc.id === studentId || doc.id.includes(studentId)) {
                        console.log('   - Found certificate with matching document ID:', doc.id);
                        if (data.status !== 'template' && data.isTemplate !== true) {
                            allCerts.push({ id: doc.id, ...data });
                        }
                    }
                });
            }

            // Method 5: Last resort - check if studentId is stored in any field
            if (allCerts.length === 0) {
                console.log('🔍 Method 4 found no certificates. Checking all fields for student ID...');
                
                const allCertSnap = await this.db.collection('certificates')
                    .get();
                
                allCertSnap.forEach(doc => {
                    const data = doc.data();
                    const dataString = JSON.stringify(data);
                    if (dataString.includes(studentId)) {
                        console.log('   - Found certificate containing student ID in data:', doc.id);
                        if (data.status !== 'template' && data.isTemplate !== true) {
                            let isMatch = false;
                            for (const key in data) {
                                if (data[key] === studentId) {
                                    isMatch = true;
                                    break;
                                }
                            }
                            if (isMatch) {
                                allCerts.push({ id: doc.id, ...data });
                            }
                        }
                    }
                });
            }

            this.certificatesData = allCerts;
            console.log('📜 Final certificates loaded:', this.certificatesData.length);

            if (this.certificatesData.length > 0) {
                console.log('📜 Certificate details:');
                this.certificatesData.forEach((cert, index) => {
                    console.log(`   ${index + 1}. ID: ${cert.id}, Student ID: ${cert.studentId}, Status: ${cert.status}, Title: ${cert.assessmentTitle}`);
                });
            } else {
                console.log('⚠️ No certificates found.');
            }

            this.updateStats();
            this.renderCertificates();

        } catch (error) {
            console.error('Error loading certificates:', error);
            if (typeof showToast !== 'undefined') {
                showToast('Error loading certificates: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // UPDATE STATS
    // ============================================================

    updateStats() {
        const total = this.certificatesData.length;
        const issued = this.certificatesData.filter(c => c.status === 'issued').length;
        const pending = this.certificatesData.filter(c => c.status === 'pending').length;
        const achievement = this.certificatesData.filter(c => c.type === 'achievement').length;

        const statTotal = document.getElementById('statTotal');
        const statIssued = document.getElementById('statIssued');
        const statPending = document.getElementById('statPending');
        const statAchievement = document.getElementById('statAchievement');
        const certificateCount = document.getElementById('certificateCount');

        if (statTotal) statTotal.textContent = total;
        if (statIssued) statIssued.textContent = issued;
        if (statPending) statPending.textContent = pending;
        if (statAchievement) statAchievement.textContent = achievement;
        if (certificateCount) certificateCount.textContent = total;
    },

    // ============================================================
    // RENDER CERTIFICATES
    // ============================================================

    renderCertificates() {
        const tbody = document.getElementById('certificatesBody');
        
        if (!tbody) {
            console.error('Certificates body not found');
            return;
        }
        
        if (this.certificatesData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            <i class="fas fa-certificate"></i>
                            <h3>No certificates yet</h3>
                            <p>Complete assessments to earn certificates. Check back later!</p>
                            <p style="font-size: 12px; color: #9ca3af; margin-top: 8px;">
                                <i class="fas fa-info-circle"></i> Student ID: ${this.currentUser.studentId}
                            </p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        this.certificatesData.forEach(cert => {
            const statusLabels = {
                issued: 'Issued',
                pending: 'Pending Release',
                revoked: 'Revoked'
            };
            const statusClasses = {
                issued: 'issued',
                pending: 'pending',
                revoked: 'revoked'
            };
            const statusIcons = {
                issued: 'fa-check-circle',
                pending: 'fa-clock',
                revoked: 'fa-times-circle'
            };

            const typeLabels = {
                completion: 'Completion',
                achievement: 'Achievement',
                participation: 'Participation'
            };
            const typeIcons = {
                completion: 'fa-award',
                achievement: 'fa-trophy',
                participation: 'fa-hand-peace'
            };

            const gradeLabels = {
                outstanding: 'Outstanding',
                distinction: 'Distinction',
                merit: 'Merit',
                completion: 'Completion'
            };

            const isLocked = cert.status === 'pending';
            const isIssued = cert.status === 'issued';
            const isRevoked = cert.status === 'revoked';

            const studentName = `${cert.studentFirstName || ''} ${cert.studentLastName || ''}`.trim() || 'Student';
            const displayTitle = cert.type === 'achievement' ? 'Certificate of Achievement' : 
                                cert.type === 'participation' ? 'Certificate of Participation' : 
                                'Certificate of Completion';
            const certDate = cert.issuedAt || cert.createdAt;

            html += `
                <tr>
                    <td>
                        <strong>${this.escapeHtml(displayTitle)}</strong>
                        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">
                            ${this.escapeHtml(cert.assessmentTitle || 'Program')}
                        </div>
                        <div style="font-size: 10px; color: #9ca3af; font-family: monospace; margin-top: 2px;">
                            ${cert.certificateId || cert.id.substring(0, 8)}
                        </div>
                    </td>
                    <td>
                        <span class="type-badge">
                            <i class="fas ${typeIcons[cert.type] || 'fa-award'}"></i>
                            ${typeLabels[cert.type] || cert.type || 'Completion'}
                        </span>
                    </td>
                    <td>
                        ${cert.grade ? `<span class="grade-badge ${cert.gradeClass || 'completion'}">${gradeLabels[cert.gradeClass] || cert.grade}</span>` : '—'}
                    </td>
                    <td>
                        <span class="status-badge ${statusClasses[cert.status] || 'pending'}">
                            <i class="fas ${statusIcons[cert.status] || 'fa-circle'}"></i>
                            ${statusLabels[cert.status] || cert.status || 'Pending'}
                            ${isLocked ? ' 🔒' : ''}
                            ${isRevoked ? ' ⚠️' : ''}
                        </span>
                    </td>
                    <td>
                        ${this.formatDate(certDate)}
                    </td>
                    <td>
                        ${isRevoked ? `
                            <button class="btn-secondary btn-sm" disabled style="opacity: 0.6; cursor: not-allowed;">
                                <i class="fas fa-ban"></i> Revoked
                            </button>
                        ` : isLocked ? `
                            <button class="btn-secondary btn-sm" onclick="StudentCertificates.viewCertificate('${cert.id}')">
                                <i class="fas fa-eye"></i> Preview
                            </button>
                        ` : isIssued ? `
                            <button class="btn-primary btn-sm" onclick="StudentCertificates.viewCertificate('${cert.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button class="btn-secondary btn-sm" onclick="StudentCertificates.downloadCertificate('${cert.id}')">
                                <i class="fas fa-download"></i>
                            </button>
                        ` : `
                            <button class="btn-secondary btn-sm" onclick="StudentCertificates.viewCertificate('${cert.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                        `}
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    // ============================================================
    // GET SIGNATORY (updated with department override)
    // ============================================================

    getSignatory(role, department) {
        // If role is 'departmentHead' and we have a department, use department-specific head
        if (role === 'departmentHead' && department) {
            const deptHead = this.departmentHeads[department];
            if (deptHead) {
                const sigName = deptHead.name.toLowerCase().replace(/ /g, '-');
                return {
                    name: deptHead.name,
                    title: deptHead.title,
                    signature: `../images/signatures/${sigName}.png`
                };
            }
        }
        // Otherwise, return from the static signatories
        const signatory = this.signatories[role];
        return signatory || this.signatories.executiveDirector;
    },

    // ============================================================
    // GET GRADE
    // ============================================================

    getGrade(score) {
        if (score >= 80) {
            return { name: 'Outstanding', class: 'outstanding', icon: '🏆' };
        } else if (score >= 70) {
            return { name: 'Distinction', class: 'distinction', icon: '🥇' };
        } else if (score >= 60) {
            return { name: 'Merit', class: 'merit', icon: '🥈' };
        } else {
            return { name: 'Completion', class: 'completion', icon: '🎓' };
        }
    },

    // ============================================================
    // GET DEPARTMENT HEAD (kept for reference)
    // ============================================================

    getDepartmentHead(department) {
        return this.departmentHeads[department] || this.departmentHeads['Digital Skills'];
    },

    // ============================================================
    // BUILD PROFESSIONAL CERTIFICATE HTML (FIXED DUPLICATE SIGNATORIES)
    // ============================================================

    buildProfessionalCertificateHTML(cert, isTemplate = false, isLocked = false) {
        const studentName = `${cert.studentFirstName || ''} ${cert.studentLastName || ''}`.trim() || 'Student Name';
        const grade = this.getGrade(cert.score || 85);
        const issueDate = cert.issuedAt || cert.createdAt || new Date();
        const formattedDate = this.formatDate(issueDate);
        
        const isAchievement = cert.type === 'achievement';
        const isParticipation = cert.type === 'participation';
        const isCompletion = cert.type === 'completion' || !cert.type;
        
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
        
        const statusBadge = isTemplate ? 'template-badge' : (isLocked ? 'pending-badge' : 'issued-badge');
        const statusText = isTemplate ? '📄 TEMPLATE' : (isLocked ? '🔒 PENDING RELEASE' : '✅ OFFICIAL');
        const lockIcon = isLocked ? '<div class="lock-icon"><i class="fas fa-lock"></i></div>' : '';
        const templateClass = isTemplate ? 'template' : '';
        const watermark = isTemplate ? '<div class="watermark">SAMPLE</div>' : '';

        // --- Get all signatories (with department override) ---
        const rawSignatory1 = this.getSignatory(cert.signatory1 || 'executiveDirector', cert.department);
        const rawSignatory2 = this.getSignatory(cert.signatory2 || 'departmentHead', cert.department);
        const rawSignatory3 = cert.signatory3 ? this.getSignatory(cert.signatory3, cert.department) : null;
        const rawSignatory4 = cert.signatory4 ? this.getSignatory(cert.signatory4, cert.department) : null;

        // --- Collect unique signatories by name (keep first occurrence) ---
        const uniqueSignatories = [];
        const seenNames = new Set();
        [rawSignatory1, rawSignatory2, rawSignatory3, rawSignatory4].forEach(sig => {
            if (sig && sig.name && !seenNames.has(sig.name)) {
                seenNames.add(sig.name);
                uniqueSignatories.push(sig);
            }
        });

        // --- Build the signatures HTML with flexible layout ---
        // Split the unique signatories into two halves (left and right of QR)
        const half = Math.ceil(uniqueSignatories.length / 2);
        const leftSigs = uniqueSignatories.slice(0, half);
        const rightSigs = uniqueSignatories.slice(half);

        let leftHtml = leftSigs.map(sig => `
            <div style="text-align: center; flex: 1 1 120px; min-width: 100px;">
                <img src="${sig.signature}" alt="${sig.name} Signature" style="height: 40px; width: auto; margin: 0 auto; object-fit: contain;" onerror="this.style.display='none'">
                <div style="width: 100px; height: 1px; background: #6b7280; margin: 4px auto;"></div>
                <div style="color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: 1px;">Digitally Signed</div>
                <p style="font-weight: 700; color: #00335f; font-size: 12px; margin: 0;">${sig.name}</p>
                <p style="color: #1e88e5; font-size: 10px; margin: 0;">${sig.title}</p>
            </div>
        `).join('');

        let rightHtml = rightSigs.map(sig => `
            <div style="text-align: center; flex: 1 1 120px; min-width: 100px;">
                <img src="${sig.signature}" alt="${sig.name} Signature" style="height: 40px; width: auto; margin: 0 auto; object-fit: contain;" onerror="this.style.display='none'">
                <div style="width: 100px; height: 1px; background: #6b7280; margin: 4px auto;"></div>
                <div style="color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: 1px;">Digitally Signed</div>
                <p style="font-weight: 700; color: #00335f; font-size: 12px; margin: 0;">${sig.name}</p>
                <p style="color: #1e88e5; font-size: 10px; margin: 0;">${sig.title}</p>
            </div>
        `).join('');

        const signaturesHtml = `
            <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-end; margin-top: 25px; gap: 15px 30px; padding: 0 10px;">
                ${leftHtml}
                <div style="text-align: center; flex: 0 0 auto;">
                    <div class="qr-container" id="${qrContainerId}" style="width: 75px; height: 75px; margin: 0 auto; background: white; border-radius: 8px; border: 1px solid #1e88e5; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                        <div style="font-size: 10px; color: #6b7280;">QR Code</div>
                    </div>
                    <div style="color: #6b7280; font-size: 8px; margin-top: 4px; font-weight: 600; letter-spacing: 0.5px;">SCAN TO VERIFY</div>
                    <div style="color: #6b7280; font-size: 8px; font-family: monospace; margin: 0;">${(cert.certificateId || cert.id).slice(0, 20)}</div>
                </div>
                ${rightHtml}
            </div>
        `;

        return `
            <div class="dbi-certificate-preview ${templateClass}" style="max-width: 100%; margin: 0 auto; font-family: 'Inter', 'Segoe UI', sans-serif;">
                <div class="cert-border" style="position: relative; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); padding: 35px 30px 30px 30px; border: 2px solid #1e88e5; border-radius: 12px;">
                    ${watermark}
                    ${lockIcon}
                    <div class="preview-badge ${statusBadge}" style="position: absolute; top: 10px; right: 10px; padding: 4px 16px; border-radius: 20px; font-size: 11px; font-weight: 600; z-index: 5; ${isTemplate ? 'background: #f59e0b; color: white;' : isLocked ? 'background: #f59e0b; color: white;' : 'background: #16a34a; color: white;'}">
                        ${statusText}
                    </div>
                    <div class="cert-inner-border" style="border: 1px solid #00c853; border-radius: 8px; padding: 25px 20px 20px 20px; position: relative;">
                        <div class="corner tl" style="position: absolute; width: 30px; height: 30px; top: 20px; left: 20px; border-top: 3px solid #1e88e5; border-left: 3px solid #1e88e5;"></div>
                        <div class="corner tr" style="position: absolute; width: 30px; height: 30px; top: 20px; right: 20px; border-top: 3px solid #00c853; border-right: 3px solid #00c853;"></div>
                        <div class="corner bl" style="position: absolute; width: 30px; height: 30px; bottom: 20px; left: 20px; border-bottom: 3px solid #00c853; border-left: 3px solid #00c853;"></div>
                        <div class="corner br" style="position: absolute; width: 30px; height: 30px; bottom: 20px; right: 20px; border-bottom: 3px solid #1e88e5; border-right: 3px solid #1e88e5;"></div>
                        
                        <!-- Logo -->
                        <div style="text-align: center; margin-bottom: 15px;">
                            <img src="../images/DBI-Official-Logo.png" alt="DBI Logo" style="height: 55px; width: auto; margin: 0 auto;" onerror="this.style.display='none'">
                            <div style="color: #6b7280; font-size: 11px; margin-top: 4px; letter-spacing: 2px; font-weight: 500;">Shaping Tomorrow's Tech Leaders Today</div>
                            <div style="width: 80px; height: 2px; background: linear-gradient(90deg, #1e88e5, #00c853); margin: 6px auto 0;"></div>
                        </div>
                        
                        <!-- Title -->
                        <div style="text-align: center; margin: 10px 0 8px;">
                            <div style="color: #6b7280; font-size: 18px; font-weight: 400; letter-spacing: 1px;">${certTitle}</div>
                            <div style="color: #00335f; font-size: 32px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase;">${isAchievement ? 'ACHIEVEMENT' : isParticipation ? 'PARTICIPATION' : 'COMPLETION'}</div>
                        </div>
                        
                        ${specialText}
                        
                        <!-- Recipient -->
                        <div style="text-align: center; margin: 15px 0 12px;">
                            <div style="color: #6b7280; font-size: 14px; font-weight: 500;">This certificate is proudly presented to</div>
                            <div style="color: #00335f; font-size: 26px; font-weight: 700; border-bottom: 2px solid #00c853; display: inline-block; padding-bottom: 4px;">${this.escapeHtml(studentName)}</div>
                        </div>
                        
                        <!-- Course Info -->
                        <div style="text-align: center; margin: 12px 0;">
                            <div style="color: #6b7280; font-size: 14px;">${certSubtitle}</div>
                            <div style="color: #1e88e5; font-size: 20px; font-weight: 600; margin: 4px 0 6px;">${this.escapeHtml(cert.assessmentTitle || cert.courseTitle || 'Program')}</div>
                            <div style="display: inline-block; padding: 2px 16px; background: #f3f4f6; border-radius: 20px; color: #00335f; font-size: 12px; font-weight: 500;">${this.escapeHtml(cert.department || 'General')} Track</div>
                        </div>
                        
                        ${signaturesHtml}
                        
                        <!-- Footer -->
                        <div style="text-align: center; margin-top: 18px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                            <div style="display: inline-flex; align-items: center; gap: 12px;">
                                <i class="fas fa-certificate" style="color: #1e88e5; font-size: 12px;"></i>
                                <span style="color: #6b7280; font-size: 9px; font-weight: 500; letter-spacing: 0.5px;">Digitally Verified Certificate</span>
                                <i class="fas fa-shield-alt" style="color: #00c853; font-size: 12px;"></i>
                            </div>
                            <div style="color: #d1d5db; font-size: 8px; margin-top: 6px; letter-spacing: 0.5px;">
                                Issued: ${formattedDate} • ID: ${cert.certificateId || cert.id}
                            </div>
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
                container.innerHTML = `
                    <div style="font-size: 10px; color: #6b7280; text-align: center;">
                        <i class="fas fa-qrcode" style="font-size: 24px; display: block;"></i>
                        <span>QR</span>
                    </div>
                `;
            }
        } catch (error) {
            console.error('QR generation error:', error);
        }
    },

    // ============================================================
    // VIEW CERTIFICATE
    // ============================================================

    viewCertificate(certId) {
        const cert = this.certificatesData.find(c => c.id === certId);
        if (!cert) {
            if (typeof showToast !== 'undefined') {
                showToast('Certificate not found', true);
            }
            return;
        }

        this.currentCertificate = cert;

        const modalBody = document.getElementById('modalBody');
        const modalTitle = document.getElementById('modalTitle');
        const modalActionBtn = document.getElementById('modalActionBtn');

        if (!modalBody || !modalTitle) {
            console.error('Modal elements not found');
            return;
        }

        const isTemplate = cert.status === 'template' || cert.isTemplate === true;
        const isLocked = cert.status === 'pending';
        const isIssued = cert.status === 'issued';
        const isRevoked = cert.status === 'revoked';

        modalTitle.textContent = isLocked ? 'Certificate Preview (Locked)' : 'DBI Certificate';

        // Generate professional certificate preview
        const htmlContent = this.buildProfessionalCertificateHTML(cert, isTemplate, isLocked);
        
        modalBody.innerHTML = `
            <div style="padding: 22px; background: #f3f4f6;">
                ${htmlContent}
                
                ${isLocked ? `
                    <div style="text-align: center; margin-top: 16px; padding: 12px 20px; background: #fef3c7; border-radius: 8px; border: 1px solid #f59e0b;">
                        <i class="fas fa-lock" style="color: #d97706;"></i>
                        <span style="color: #92400e; font-size: 14px; font-weight: 500;"> This certificate is pending release. You will be able to view and download it once it is officially released.</span>
                    </div>
                ` : isRevoked ? `
                    <div style="text-align: center; margin-top: 16px; padding: 12px 20px; background: #fee2e2; border-radius: 8px; border: 1px solid #fca5a5;">
                        <i class="fas fa-exclamation-triangle" style="color: #dc2626;"></i>
                        <span style="color: #991b1b; font-size: 14px; font-weight: 500;"> This certificate has been revoked and is no longer valid.</span>
                    </div>
                ` : isIssued ? `
                    <div style="text-align: center; margin-top: 16px; padding: 12px 20px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
                        <i class="fas fa-check-circle" style="color: #16a34a;"></i>
                        <span style="color: #166534; font-size: 14px; font-weight: 500;"> This is your official DBI certificate. You can download it anytime.</span>
                    </div>
                ` : ''}
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <div><strong>Certificate ID:</strong> <span style="font-family: monospace;">${cert.certificateId || cert.id.substring(0, 8)}</span></div>
                    <div><strong>Type:</strong> ${cert.type === 'achievement' ? 'Achievement' : cert.type === 'participation' ? 'Participation' : 'Completion'}</div>
                    <div><strong>Grade:</strong> ${cert.grade || 'N/A'}</div>
                    <div><strong>Status:</strong> ${cert.status || 'Pending'} ${isLocked ? '🔒' : isIssued ? '✅' : ''}</div>
                    <div><strong>Issued:</strong> ${this.formatDate(cert.issuedAt || cert.createdAt)}</div>
                    ${cert.score ? `<div><strong>Score:</strong> ${cert.score}%</div>` : ''}
                </div>
            </div>
        `;

        // Set footer buttons
        if (modalActionBtn) {
            if (isRevoked) {
                modalActionBtn.style.display = 'none';
            } else if (isLocked) {
                modalActionBtn.textContent = '🔒 Locked';
                modalActionBtn.style.background = '#6b7280';
                modalActionBtn.disabled = true;
                modalActionBtn.style.display = 'flex';
            } else if (isIssued) {
                modalActionBtn.textContent = '⬇ Download Certificate';
                modalActionBtn.style.background = '';
                modalActionBtn.disabled = false;
                modalActionBtn.style.display = 'flex';
                modalActionBtn.onclick = function() {
                    StudentCertificates.downloadCertificate(cert.id);
                };
            }
        }

        // Open modal using the global function
        if (typeof openModal === 'function') {
            openModal();
        } else {
            const overlay = document.getElementById('modalOverlay');
            if (overlay) {
                overlay.classList.add('show');
                document.body.style.overflow = 'hidden';
            }
        }

        // Generate QR code after modal is opened
        setTimeout(() => {
            const qrContainer = document.getElementById('modalBody').querySelector('.qr-container');
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
        const cert = this.certificatesData.find(c => c.id === certId);
        if (!cert) {
            if (typeof showToast !== 'undefined') {
                showToast('Certificate not found', true);
            }
            return;
        }

        if (cert.status === 'pending') {
            if (typeof showToast !== 'undefined') {
                showToast('This certificate is locked and cannot be downloaded yet.', true);
            }
            return;
        }

        if (cert.status === 'revoked') {
            if (typeof showToast !== 'undefined') {
                showToast('This certificate has been revoked and cannot be downloaded.', true);
            }
            return;
        }

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            if (typeof showToast !== 'undefined') {
                showToast('Please allow popups to download certificates', true);
            }
            return;
        }

        const isTemplate = false;
        const isLocked = false;
        const htmlContent = this.buildProfessionalCertificateHTML(cert, isTemplate, isLocked);
        
        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>DBI Certificate - ${cert.certificateId || cert.id}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Inter', 'Segoe UI', sans-serif;
                        background: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        padding: 20px;
                    }
                    @media print {
                        body { padding: 0; }
                    }
                    .dbi-certificate-preview {
                        background: white;
                        border-radius: 12px;
                        padding: 30px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                        margin: 0 auto;
                        max-width: 800px;
                        width: 100%;
                        font-family: 'Inter', 'Segoe UI', sans-serif;
                    }
                    .dbi-certificate-preview .cert-border {
                        position: relative;
                        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
                        padding: 35px 30px 30px 30px;
                        border: 2px solid #1e88e5;
                        border-radius: 12px;
                    }
                    .dbi-certificate-preview .cert-inner-border {
                        border: 1px solid #00c853;
                        border-radius: 8px;
                        padding: 25px 20px 20px 20px;
                        position: relative;
                    }
                    .dbi-certificate-preview .corner {
                        position: absolute;
                        width: 30px;
                        height: 30px;
                    }
                    .dbi-certificate-preview .corner.tl { top: 20px; left: 20px; border-top: 3px solid #1e88e5; border-left: 3px solid #1e88e5; }
                    .dbi-certificate-preview .corner.tr { top: 20px; right: 20px; border-top: 3px solid #00c853; border-right: 3px solid #00c853; }
                    .dbi-certificate-preview .corner.bl { bottom: 20px; left: 20px; border-bottom: 3px solid #00c853; border-left: 3px solid #00c853; }
                    .dbi-certificate-preview .corner.br { bottom: 20px; right: 20px; border-bottom: 3px solid #1e88e5; border-right: 3px solid #1e88e5; }
                    .dbi-certificate-preview .logo-section {
                        text-align: center;
                        margin-bottom: 15px;
                    }
                    .dbi-certificate-preview .logo-section img {
                        height: 55px;
                        width: auto;
                        margin: 0 auto;
                    }
                    .dbi-certificate-preview .logo-section .tagline {
                        color: #6b7280;
                        font-size: 11px;
                        margin-top: 4px;
                        letter-spacing: 2px;
                        font-weight: 500;
                    }
                    .dbi-certificate-preview .logo-section .divider {
                        width: 80px;
                        height: 2px;
                        background: linear-gradient(90deg, #1e88e5, #00c853);
                        margin: 6px auto 0;
                    }
                    .dbi-certificate-preview .cert-title {
                        text-align: center;
                        margin: 10px 0 8px;
                    }
                    .dbi-certificate-preview .cert-title .sub {
                        color: #6b7280;
                        font-size: 18px;
                        font-weight: 400;
                        letter-spacing: 1px;
                    }
                    .dbi-certificate-preview .cert-title .main {
                        color: #00335f;
                        font-size: 32px;
                        font-weight: 800;
                        letter-spacing: 3px;
                        text-transform: uppercase;
                    }
                    .dbi-certificate-preview .grade-badge {
                        display: inline-block;
                        padding: 4px 20px;
                        border-radius: 30px;
                        font-size: 14px;
                        font-weight: 700;
                        color: white;
                        margin: 6px auto;
                    }
                    .dbi-certificate-preview .grade-badge.outstanding { background: linear-gradient(135deg, #6b7280, #4b5563); }
                    .dbi-certificate-preview .grade-badge.distinction { background: linear-gradient(135deg, #fbbf24, #d97706); }
                    .dbi-certificate-preview .grade-badge.merit { background: linear-gradient(135deg, #94a3b8, #64748b); }
                    .dbi-certificate-preview .grade-badge.completion { background: linear-gradient(135deg, #1e88e5, #00c853); }
                    .dbi-certificate-preview .recipient {
                        text-align: center;
                        margin: 15px 0 12px;
                    }
                    .dbi-certificate-preview .recipient .label {
                        color: #6b7280;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    .dbi-certificate-preview .recipient .name {
                        color: #00335f;
                        font-size: 26px;
                        font-weight: 700;
                        border-bottom: 2px solid #00c853;
                        display: inline-block;
                        padding-bottom: 4px;
                    }
                    .dbi-certificate-preview .course-info {
                        text-align: center;
                        margin: 12px 0;
                    }
                    .dbi-certificate-preview .course-info .label {
                        color: #6b7280;
                        font-size: 14px;
                    }
                    .dbi-certificate-preview .course-info .title {
                        color: #1e88e5;
                        font-size: 20px;
                        font-weight: 600;
                        margin: 4px 0 6px;
                    }
                    .dbi-certificate-preview .course-info .dept {
                        display: inline-block;
                        padding: 2px 16px;
                        background: #f3f4f6;
                        border-radius: 20px;
                        color: #00335f;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .dbi-certificate-preview .signatures {
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: center;
                        align-items: flex-end;
                        margin-top: 25px;
                        gap: 15px 30px;
                        padding: 0 10px;
                    }
                    .dbi-certificate-preview .signatures .sig-group {
                        text-align: center;
                        flex: 1 1 120px;
                        min-width: 100px;
                    }
                    .dbi-certificate-preview .signatures .sig-group .sig-image {
                        height: 40px;
                        width: auto;
                        margin: 0 auto;
                        object-fit: contain;
                    }
                    .dbi-certificate-preview .signatures .sig-group .sig-line {
                        width: 100px;
                        height: 1px;
                        background: #6b7280;
                        margin: 4px auto;
                    }
                    .dbi-certificate-preview .signatures .sig-group .sig-label {
                        color: #6b7280;
                        font-size: 9px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    .dbi-certificate-preview .signatures .sig-group .sig-name {
                        font-weight: 700;
                        color: #00335f;
                        font-size: 12px;
                        margin: 0;
                    }
                    .dbi-certificate-preview .signatures .sig-group .sig-title {
                        color: #1e88e5;
                        font-size: 10px;
                        margin: 0;
                    }
                    .dbi-certificate-preview .qr-section {
                        text-align: center;
                        flex: 0 0 auto;
                    }
                    .dbi-certificate-preview .qr-section .qr-container {
                        width: 75px;
                        height: 75px;
                        margin: 0 auto;
                        background: white;
                        border-radius: 8px;
                        border: 1px solid #1e88e5;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .dbi-certificate-preview .qr-section .qr-label {
                        color: #6b7280;
                        font-size: 8px;
                        margin-top: 4px;
                        font-weight: 600;
                        letter-spacing: 0.5px;
                    }
                    .dbi-certificate-preview .qr-section .qr-id {
                        color: #6b7280;
                        font-size: 8px;
                        font-family: monospace;
                        margin: 0;
                    }
                    .dbi-certificate-preview .footer {
                        text-align: center;
                        margin-top: 18px;
                        padding-top: 12px;
                        border-top: 1px solid #e5e7eb;
                    }
                    .dbi-certificate-preview .footer .badges {
                        display: inline-flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .dbi-certificate-preview .footer .badges span {
                        color: #6b7280;
                        font-size: 9px;
                        font-weight: 500;
                        letter-spacing: 0.5px;
                    }
                    .dbi-certificate-preview .footer .badges .icon-blue { color: #1e88e5; }
                    .dbi-certificate-preview .footer .badges .icon-green { color: #00c853; }
                    .dbi-certificate-preview .footer .date {
                        color: #d1d5db;
                        font-size: 8px;
                        margin-top: 6px;
                        letter-spacing: 0.5px;
                    }
                    .dbi-certificate-preview .preview-badge {
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        padding: 4px 16px;
                        border-radius: 20px;
                        font-size: 11px;
                        font-weight: 600;
                        z-index: 5;
                    }
                    .dbi-certificate-preview .preview-badge.issued-badge {
                        background: #16a34a;
                        color: white;
                    }
                    .dbi-certificate-preview .preview-badge.pending-badge {
                        background: #f59e0b;
                        color: white;
                    }
                    .dbi-certificate-preview .lock-icon {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        font-size: 64px;
                        color: rgba(0,0,0,0.06);
                        pointer-events: none;
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 1000);
                    }
                <\/script>
            </body>
            </html>
        `;

        printWindow.document.write(fullHtml);
        printWindow.document.close();
        
        if (typeof showToast !== 'undefined') {
            showToast('Certificate opened for printing/download');
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
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
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

window.StudentCertificates = StudentCertificates;
console.log('✅ StudentCertificates module loaded successfully');