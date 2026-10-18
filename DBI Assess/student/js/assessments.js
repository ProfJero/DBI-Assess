// ============================================================
// STUDENT ASSESSMENTS - WITH ATTEMPTS SUPPORT
// ============================================================

const Assessments = {
    app: null,

    // ============================================================
    // RENDER ASSESSMENTS
    // ============================================================

    render(container, app) {
        this.app = app;
        
        container.innerHTML = `
            <div class="section-header">
                <div>
                    <h2>My Assessments</h2>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">View and take your assessments</p>
                </div>
            </div>

            <div class="table-container">
                <div class="table-header">
                    <span>Available Assessments</span>
                </div>
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Assessment</th>
                                <th>Questions</th>
                                <th>Duration</th>
                                <th>Attempts</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="assessmentsBody">
                            <tr>
                                <td colspan="6">
                                    <div class="empty-state">
                                        <i class="fas fa-spinner fa-spin"></i>
                                        <h3>Loading assessments...</h3>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.loadAssessments();
    },

    // ============================================================
    // LOAD ASSESSMENTS - FIXED WITH ATTEMPTS
    // ============================================================

    async loadAssessments() {
        try {
            const db = this.app.db;
            const studentId = this.app.currentUser.studentId;
            
            // Get published assessments
            const assessmentsSnap = await db.collection('assessments')
                .where('status', '==', 'published')
                .get();

            const tbody = document.getElementById('assessmentsBody');
            
            if (assessmentsSnap.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6">
                            <div class="empty-state">
                                <i class="fas fa-file-alt"></i>
                                <h3>No assessments available</h3>
                                <p>Check back later for new assessments</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            // Get ALL results for this student (not just completed)
            const resultsSnap = await db.collection('studentResults')
                .where('studentId', '==', studentId)
                .get();
            
            // Group results by assessmentId
            const resultsByAssessment = {};
            resultsSnap.forEach(doc => {
                const data = doc.data();
                const assessmentId = data.assessmentId;
                if (!resultsByAssessment[assessmentId]) {
                    resultsByAssessment[assessmentId] = [];
                }
                resultsByAssessment[assessmentId].push(data);
            });

            // Update count
            document.getElementById('assessmentCount').textContent = assessmentsSnap.size;

            let html = '';
            
            assessmentsSnap.forEach(doc => {
                const data = doc.data();
                const assessmentId = doc.id;
                
                // Get all attempts for this assessment
                const attempts = resultsByAssessment[assessmentId] || [];
                
                // Count completed/submitted attempts
                const completedAttempts = attempts.filter(r => 
                    r.status === 'submitted' || r.status === 'completed'
                );
                
                // Check for in-progress attempt
                const inProgressAttempt = attempts.find(r => r.status === 'in-progress');
                
                // Get max attempts from assessment data
                const maxAttempts = data.attempts || 1;
                const unlimitedAttempts = data.unlimitedAttempts || false;
                
                // Determine if student can start a new attempt
                let canStart = false;
                let statusText = '';
                let statusClass = '';
                let attemptsInfo = '';
                let buttonText = '<i class="fas fa-play"></i> Start';
                let buttonAction = '';
                
                if (inProgressAttempt) {
                    // There's an in-progress attempt - resume it
                    canStart = true;
                    statusText = '🔄 In Progress';
                    statusClass = 'pending';
                    attemptsInfo = `Attempt ${inProgressAttempt.attemptNumber || 1}`;
                    buttonText = '<i class="fas fa-play"></i> Resume';
                } else if (unlimitedAttempts) {
                    // Unlimited attempts - always can start
                    canStart = true;
                    statusText = '📝 Ready';
                    statusClass = 'pending';
                    attemptsInfo = `Unlimited attempts • ${completedAttempts.length} taken`;
                } else if (completedAttempts.length < maxAttempts) {
                    // Has remaining attempts
                    canStart = true;
                    const remaining = maxAttempts - completedAttempts.length;
                    statusText = '📝 Ready';
                    statusClass = 'pending';
                    attemptsInfo = `${completedAttempts.length} of ${maxAttempts} used • <span class="remaining">${remaining} remaining</span>`;
                } else {
                    // Max attempts reached
                    canStart = false;
                    statusText = '🔒 Max Attempts Reached';
                    statusClass = 'closed';
                    attemptsInfo = `<span class="maxed">${maxAttempts} of ${maxAttempts} attempts used</span>`;
                }
                
                const questions = data.totalQuestions || 0;
                const duration = data.duration || 30;
                
                buttonAction = canStart ? `onclick="window.startAssessment('${assessmentId}')"` : 
                    `onclick="window.showToast('Maximum attempts reached', true)"`;
                
                html += `
                    <tr>
                        <td><strong>${this.app.escapeHtml(data.title || 'Untitled')}</strong></td>
                        <td>${questions}</td>
                        <td>${duration} min</td>
                        <td>
                            <span class="attempts-info">${attemptsInfo}</span>
                        </td>
                        <td>
                            <span class="status-badge ${statusClass}">${statusText}</span>
                        </td>
                        <td>
                            <button class="btn-primary btn-sm" ${!canStart ? 'disabled' : ''} ${buttonAction}>
                                ${buttonText}
                            </button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

        } catch (error) {
            console.error('Error loading assessments:', error);
            const tbody = document.getElementById('assessmentsBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-circle" style="color: #dc2626;"></i>
                                <h3>Error Loading Assessments</h3>
                                <p>${this.app.escapeHtml(error.message)}</p>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    }
};

// ============================================================
// EXPORT FOR GLOBAL ACCESS
// ============================================================

window.Assessments = Assessments;