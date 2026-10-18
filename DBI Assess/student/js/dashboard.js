// ============================================================
// STUDENT DASHBOARD
// ============================================================

const Dashboard = {
    app: null,

    // ============================================================
    // RENDER DASHBOARD
    // ============================================================

    render(container, app) {
        this.app = app;
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-header">
                        <span class="stat-icon green"><i class="fas fa-file-alt"></i></span>
                    </div>
                    <div class="stat-number" id="statAssessments">0</div>
                    <div class="stat-label">Assessments Available</div>
                    <span class="stat-change up"><i class="fas fa-arrow-up"></i> Ready</span>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span class="stat-icon blue"><i class="fas fa-clock"></i></span>
                    </div>
                    <div class="stat-number" id="statPending">0</div>
                    <div class="stat-label">Pending Assessments</div>
                    <span class="stat-change up"><i class="fas fa-arrow-up"></i> In Progress</span>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span class="stat-icon orange"><i class="fas fa-check-circle"></i></span>
                    </div>
                    <div class="stat-number" id="statCompleted">0</div>
                    <div class="stat-label">Completed</div>
                    <span class="stat-change up"><i class="fas fa-arrow-up"></i> Done</span>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span class="stat-icon purple"><i class="fas fa-chart-line"></i></span>
                    </div>
                    <div class="stat-number" id="statAverage">0%</div>
                    <div class="stat-label">Average Score</div>
                    <span class="stat-change up"><i class="fas fa-arrow-up"></i> Performance</span>
                </div>
            </div>

            <div class="section-header">
                <h2>Your Recent Assessments</h2>
            </div>

            <div class="table-container">
                <div class="table-header">
                    <span>Recent Activity</span>
                </div>
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Assessment</th>
                                <th>Status</th>
                                <th>Score</th>
                                <th>Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="recentAssessmentsBody">
                            <tr>
                                <td colspan="5">
                                    <div class="empty-state">
                                        <i class="fas fa-file-alt"></i>
                                        <h3>No assessments yet</h3>
                                        <p>Check back later for new assessments</p>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.loadStats();
        this.loadRecentAssessments();
    },

    // ============================================================
    // LOAD STATS
    // ============================================================

    async loadStats() {
        try {
            const db = this.app.db;
            const studentId = this.app.currentUser.studentId;
            
            // Get results for this student
            const resultsSnap = await db.collection('studentResults')
                .where('studentId', '==', studentId)
                .get();
            
            let completed = 0;
            let totalScore = 0;
            
            resultsSnap.forEach(doc => {
                const data = doc.data();
                completed++;
                totalScore += data.score || 0;
            });

            // Get available assessments (for demo, we'll use placeholder)
            const totalAssessments = 5; // Placeholder
            const pending = totalAssessments - completed;
            
            document.getElementById('statAssessments').textContent = totalAssessments;
            document.getElementById('statPending').textContent = pending;
            document.getElementById('statCompleted').textContent = completed;
            document.getElementById('statAverage').textContent = completed > 0 ? 
                Math.round(totalScore / completed) + '%' : '0%';

        } catch (error) {
            console.error('Error loading stats:', error);
        }
    },

    // ============================================================
    // LOAD RECENT ASSESSMENTS
    // ============================================================

    async loadRecentAssessments() {
        try {
            const db = this.app.db;
            const studentId = this.app.currentUser.studentId;
            
            const resultsSnap = await db.collection('studentResults')
                .where('studentId', '==', studentId)
                .orderBy('submittedAt', 'desc')
                .limit(5)
                .get();

            const tbody = document.getElementById('recentAssessmentsBody');
            
            if (resultsSnap.empty) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5">
                            <div class="empty-state">
                                <i class="fas fa-file-alt"></i>
                                <h3>No assessments completed yet</h3>
                                <p>Start your learning journey today!</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            let html = '';
            resultsSnap.forEach(doc => {
                const data = doc.data();
                const statusClass = data.passed ? 'passed' : 'failed';
                const statusText = data.passed ? '✅ Passed' : '❌ Failed';
                const score = data.score || 0;
                
                html += `
                    <tr>
                        <td><strong>${this.app.escapeHtml(data.assessmentTitle || 'Untitled')}</strong></td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td><strong>${score}%</strong></td>
                        <td>${this.app.formatDate(data.submittedAt)}</td>
                        <td>
                            <button class="btn-primary btn-sm" onclick="showToast('Viewing details...')">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

        } catch (error) {
            console.error('Error loading recent assessments:', error);
        }
    }
};