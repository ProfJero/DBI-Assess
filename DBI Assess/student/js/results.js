// ============================================================
// STUDENT RESULTS
// ============================================================

const Results = {
    app: null,

    // ============================================================
    // RENDER RESULTS
    // ============================================================

    render(container, app) {
        this.app = app;
        
        container.innerHTML = `
            <!-- Stats Summary -->
            <div class="results-summary">
                <div class="summary-card">
                    <span class="label"><i class="fas fa-file-alt" style="margin-right: 6px;"></i>Total Taken</span>
                    <div class="value" id="totalTaken">0</div>
                </div>
                <div class="summary-card">
                    <span class="label"><i class="fas fa-check-circle" style="margin-right: 6px; color: #16a34a;"></i>Passed</span>
                    <div class="value green" id="totalPassed">0</div>
                </div>
                <div class="summary-card">
                    <span class="label"><i class="fas fa-chart-line" style="margin-right: 6px; color: #d97706;"></i>Average Score</span>
                    <div class="value orange" id="avgScore">0%</div>
                </div>
                <div class="summary-card">
                    <span class="label"><i class="fas fa-trophy" style="margin-right: 6px; color: #7c3aed;"></i>Best Score</span>
                    <div class="value purple" id="bestScore">0%</div>
                </div>
            </div>

            <!-- Results Table -->
            <div class="section-header">
                <h2>All Results</h2>
            </div>

            <div class="table-container">
                <div class="table-header">
                    <span>Your Assessment History</span>
                    <button class="btn-primary btn-sm" onclick="Results.loadResults()" style="padding: 6px 14px; font-size: 13px;">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Assessment</th>
                                <th>Score</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="resultsBody">
                            <tr>
                                <td colspan="5">
                                    <div class="empty-state">
                                        <i class="fas fa-chart-bar"></i>
                                        <h3>Loading results...</h3>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.loadResults();
    },

    // ============================================================
    // LOAD RESULTS
    // ============================================================

    async loadResults() {
        try {
            const db = this.app.db;
            const studentId = this.app.currentUser.studentId;
            
            // Get all results for this student
            const resultsSnap = await db.collection('studentResults')
                .where('studentId', '==', studentId)
                .orderBy('submittedAt', 'desc')
                .get();

            const tbody = document.getElementById('resultsBody');
            
            // Calculate stats
            let total = 0;
            let passed = 0;
            let totalScore = 0;
            let bestScore = 0;
            const results = [];

            resultsSnap.forEach(doc => {
                const data = doc.data();
                const score = data.score || 0;
                total++;
                if (data.passed) passed++;
                totalScore += score;
                if (score > bestScore) bestScore = score;
                results.push({
                    id: doc.id,
                    ...data,
                    score: score
                });
            });

            // Update summary cards
            document.getElementById('totalTaken').textContent = total;
            document.getElementById('totalPassed').textContent = passed;
            document.getElementById('avgScore').textContent = total > 0 ? Math.round(totalScore / total) + '%' : '0%';
            document.getElementById('bestScore').textContent = total > 0 ? Math.round(bestScore) + '%' : '0%';

            // Get assessment count for sidebar badge
            const assessmentsSnap = await db.collection('assessments')
                .where('status', '==', 'published')
                .get();
            document.getElementById('assessmentCount').textContent = assessmentsSnap.size;

            if (results.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5">
                            <div class="empty-state">
                                <i class="fas fa-chart-bar"></i>
                                <h3>No results yet</h3>
                                <p>Complete an assessment to see your results here.</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            let html = '';
            results.forEach(item => {
                const statusClass = item.passed ? 'passed' : 'failed';
                const statusText = item.passed ? '✅ Passed' : '❌ Failed';
                const score = item.score || 0;
                
                html += `
                    <tr>
                        <td><strong>${this.app.escapeHtml(item.assessmentTitle || 'Untitled')}</strong></td>
                        <td><strong class="${item.passed ? 'score-pass' : 'score-fail'}">${Math.round(score)}%</strong></td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>${this.app.formatDate(item.submittedAt)}</td>
                        <td>
                            <button class="btn-primary btn-sm" onclick="Results.viewResult('${item.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

        } catch (error) {
            console.error('Error loading results:', error);
            const tbody = document.getElementById('resultsBody');
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-circle" style="color: #dc2626;"></i>
                            <h3>Error Loading Results</h3>
                            <p>${this.app.escapeHtml(error.message)}</p>
                            <button class="btn-primary btn-sm" onclick="Results.loadResults()" style="margin-top: 12px;">
                                <i class="fas fa-redo"></i> Retry
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            this.app.showToast('Error loading results', true);
        }
    },

    // ============================================================
    // VIEW RESULT DETAIL
    // ============================================================

    viewResult(resultId) {
        // Navigate to result detail page
        window.location.href = `result-detail.html?id=${resultId}`;
    }
};