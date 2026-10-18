// ============================================================
// STUDENT TAKE ASSESSMENT - PROFESSIONAL SOCRATIVE-STYLE
// ============================================================

const TakeAssessment = {
    app: null,
    db: null,
    currentUser: null,
    assessmentId: null,
    assessmentData: null,
    questions: [],
    answers: {},
    submittedAnswers: {},
    currentQuestionIndex: 0,
    reviewQuestions: new Set(),
    flaggedQuestions: new Set(),
    timerInterval: null,
    timeRemaining: 0,
    totalDuration: 0,
    hasStarted: false,
    isSubmitting: false,
    autoSaveInterval: null,
    codeEditors: {},
    shuffledQuestions: [],
    isRandomQuestions: false,
    isRandomOptions: false,
    showTimer: true,
    showProgress: true,
    onePerPage: false,
    allowBack: true,
    answerDisplay: 'per-question',
    showImmediately: false,
    showCorrectAnswers: false,
    showScore: true,
    showFeedback: false,
    showEndScore: true,
    showEndCorrect: false,
    showEndFeedback: false,
    attempts: 1,
    unlimitedAttempts: false,
    questionStatus: {},
    currentAttempt: 0,
    allAttempts: [],
    feedbackDisplayed: {},
    isAnswerSubmitted: {},

    // ============================================================
    // RENDER - Main entry point
    // ============================================================

    render(container, app) {
        this.app = app;
        this.db = app.db;
        this.currentUser = app.currentUser;
        this.assessmentId = app.assessmentId;
        
        console.log('📝 TakeAssessment render called with ID:', this.assessmentId);
        
        if (!this.assessmentId) {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #dc2626;"></i>
                    <h3>No Assessment ID Provided</h3>
                    <p style="color: #6b7280;">Please select an assessment from the assessments page.</p>
                    <button onclick="window.location.href='assessments.html'" class="btn-primary">
                        <i class="fas fa-arrow-left"></i> Go Back
                    </button>
                </div>
            `;
            return;
        }

        if (!this.currentUser || !this.currentUser.studentId) {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #dc2626;"></i>
                    <h3>Not Logged In</h3>
                    <p style="color: #6b7280;">Please log in to access this assessment.</p>
                    <button onclick="window.location.href='../index.html'" class="btn-primary">
                        <i class="fas fa-arrow-left"></i> Go to Login
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <h3>Loading Assessment...</h3>
                <p style="color: #6b7280;">Please wait while we prepare your assessment</p>
            </div>
        `;

        this.loadAssessment();
    },

    // ============================================================
    // GET STUDENT ID
    // ============================================================

    getStudentId() {
        if (this.currentUser && this.currentUser.studentId) {
            return this.currentUser.studentId;
        }
        console.warn('⚠️ No student ID found in current user');
        return null;
    },

    // ============================================================
    // LOAD ASSESSMENT
    // ============================================================

    async loadAssessment() {
        try {
            console.log('📥 Loading assessment with ID:', this.assessmentId);
            
            const studentId = this.getStudentId();
            if (!studentId) {
                this.showError('Student ID not found. Please log in again.');
                setTimeout(() => window.location.href = '../index.html', 2000);
                return;
            }
            
            console.log('👤 Using student ID:', studentId);
            
            const assessmentDoc = await this.db.collection('assessments').doc(this.assessmentId).get();
            
            if (!assessmentDoc.exists) {
                console.error('❌ Assessment not found:', this.assessmentId);
                this.showError('Assessment not found. Please check the link and try again.');
                return;
            }

            this.assessmentData = assessmentDoc.data();
            this.assessmentData.id = assessmentDoc.id;
            console.log('✅ Assessment loaded:', this.assessmentData.title);

            this.applySettings();

            const questionsSnap = await this.db.collection('questions')
                .where('assessmentId', '==', this.assessmentId)
                .get();

            this.questions = [];
            questionsSnap.forEach(doc => {
                this.questions.push({ id: doc.id, ...doc.data() });
            });

            console.log('📚 Questions loaded:', this.questions.length);

            if (this.questions.length === 0) {
                this.showError('No questions found for this assessment. Please contact your instructor.');
                return;
            }

            if (this.isRandomQuestions) {
                this.shuffledQuestions = this.shuffleArray([...this.questions]);
            } else {
                this.shuffledQuestions = [...this.questions];
            }

            if (this.isRandomOptions) {
                this.shuffledQuestions = this.shuffledQuestions.map(q => {
                    if (q.options && q.options.length > 0) {
                        const shuffledOptions = this.shuffleArray([...q.options]);
                        return { ...q, options: shuffledOptions };
                    }
                    return q;
                });
            }

            // Initialize status tracking
            this.shuffledQuestions.forEach((_, index) => {
                this.questionStatus[index] = {
                    answered: false,
                    submitted: false,
                    reviewed: false,
                    flagged: false
                };
                this.isAnswerSubmitted[index] = false;
                this.feedbackDisplayed[index] = false;
            });

            // Get attempts
            const allResults = await this.db.collection('studentResults')
                .where('assessmentId', '==', this.assessmentId)
                .where('studentId', '==', studentId)
                .orderBy('attemptNumber', 'desc')
                .get();

            this.allAttempts = [];
            allResults.forEach(doc => {
                this.allAttempts.push({ id: doc.id, ...doc.data() });
            });

            const completedAttempts = this.allAttempts.filter(r => 
                r.status === 'submitted' || r.status === 'completed'
            );

            const inProgressAttempt = this.allAttempts.find(r => 
                r.status === 'in-progress'
            );

            console.log('📊 Attempts:', {
                total: this.allAttempts.length,
                completed: completedAttempts.length,
                inProgress: inProgressAttempt ? 'Yes' : 'No',
                maxAttempts: this.attempts,
                unlimited: this.unlimitedAttempts
            });

            if (!this.unlimitedAttempts && completedAttempts.length >= this.attempts) {
                this.showError(`You have reached the maximum number of attempts (${this.attempts}).`);
                setTimeout(() => window.location.href = 'results.html', 2000);
                return;
            }

            if (inProgressAttempt) {
                console.log('📋 Found in-progress attempt:', inProgressAttempt.id);
                this.currentAttempt = inProgressAttempt.attemptNumber || 1;
                this.answers = inProgressAttempt.answers || {};
                this.submittedAnswers = inProgressAttempt.submittedAnswers || {};
                this.reviewQuestions = new Set(inProgressAttempt.reviewQuestions || []);
                this.flaggedQuestions = new Set(inProgressAttempt.flaggedQuestions || []);
                
                Object.keys(this.answers).forEach(key => {
                    const idx = parseInt(key);
                    if (!isNaN(idx)) {
                        this.questionStatus[idx] = {
                            ...this.questionStatus[idx],
                            answered: true
                        };
                        if (this.submittedAnswers[key]) {
                            this.questionStatus[idx].submitted = true;
                            this.isAnswerSubmitted[idx] = true;
                        }
                    }
                });
                
                this.reviewQuestions.forEach(idx => {
                    if (this.questionStatus[idx]) {
                        this.questionStatus[idx].reviewed = true;
                    }
                });
                
                this.flaggedQuestions.forEach(idx => {
                    if (this.questionStatus[idx]) {
                        this.questionStatus[idx].flagged = true;
                    }
                });
                
                const startedAt = inProgressAttempt.startedAt?.toDate?.() || new Date();
                const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
                this.totalDuration = this.assessmentData.duration || 30;
                this.timeRemaining = Math.max(0, (this.totalDuration * 60) - elapsed);
                
                if (this.timeRemaining <= 0) {
                    this.showError('Time has expired for this assessment attempt.');
                    return;
                }
                
                console.log('⏱️ Resuming assessment, time remaining:', this.timeRemaining);
                
                this.hasStarted = true;
                this.renderAssessment();
                this.startTimer();
                this.startAutoSave();
                return;
            }

            this.currentAttempt = completedAttempts.length + 1;
            console.log(`🔄 Starting attempt ${this.currentAttempt} of ${this.unlimitedAttempts ? 'Unlimited' : this.attempts}`);

            this.totalDuration = this.assessmentData.duration || 30;
            this.timeRemaining = this.totalDuration * 60;

            this.renderInstructions();

        } catch (error) {
            console.error('❌ Error loading assessment:', error);
            this.showError('Error loading assessment: ' + error.message);
        }
    },

    // ============================================================
    // APPLY SETTINGS
    // ============================================================

    applySettings() {
        const settings = this.assessmentData;
        
        this.isRandomQuestions = settings.randomQuestions || false;
        this.isRandomOptions = settings.randomOptions || false;
        this.showTimer = settings.showTimer !== false;
        this.showProgress = settings.showProgress !== false;
        this.onePerPage = settings.onePerPage || false;
        this.allowBack = settings.allowBack !== false;
        
        this.answerDisplay = settings.answerDisplay || 'per-question';
        this.showImmediately = settings.showImmediately || false;
        this.showCorrectAnswers = settings.showCorrectAnswers || false;
        this.showScore = settings.showScore !== false;
        this.showFeedback = settings.showFeedback || false;
        this.showEndScore = settings.showEndScore !== false;
        this.showEndCorrect = settings.showEndCorrect || false;
        this.showEndFeedback = settings.showEndFeedback || false;
        
        this.attempts = settings.attempts || 1;
        this.unlimitedAttempts = settings.unlimitedAttempts || false;
        
        if (this.answerDisplay === 'per-question') {
            this.onePerPage = true;
            this.allowBack = false;
        }
        
        console.log('⚙️ Settings applied:', {
            onePerPage: this.onePerPage,
            allowBack: this.allowBack,
            answerDisplay: this.answerDisplay,
            attempts: this.attempts,
            unlimitedAttempts: this.unlimitedAttempts
        });
    },

    // ============================================================
    // SHUFFLE ARRAY
    // ============================================================

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    // ============================================================
    // SHOW ERROR
    // ============================================================

    showError(message) {
        const container = document.getElementById('assessmentBody');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #dc2626;"></i>
                    <h3>Error</h3>
                    <p style="color: #6b7280;">${this.app.escapeHtml(message)}</p>
                    <button onclick="window.location.href='assessments.html'" class="btn-primary">
                        <i class="fas fa-arrow-left"></i> Go Back to Assessments
                    </button>
                </div>
            `;
        }
    },

    // ============================================================
    // RENDER INSTRUCTIONS
    // ============================================================

    renderInstructions() {
        const container = document.getElementById('assessmentBody');
        
        const typeLabels = {
            quiz: 'Quiz',
            assignment: 'Assignment',
            practical: 'Practical',
            coding: 'Coding Challenge',
            survey: 'Survey',
            final: 'Final Examination'
        };

        const duration = this.assessmentData.duration || 30;
        const questionCount = this.shuffledQuestions.length;
        const passingScore = this.assessmentData.passingScore || 60;
        const attemptInfo = this.unlimitedAttempts ? 'Unlimited' : `${this.currentAttempt} of ${this.attempts}`;

        container.innerHTML = `
            <div class="instructions-page">
                <div class="inst-header">
                    <div class="inst-icon"><i class="fas fa-file-alt"></i></div>
                    <h2>${this.app.escapeHtml(this.assessmentData.title || 'Assessment')}</h2>
                    <p>${this.app.escapeHtml(this.assessmentData.description || 'Please read the instructions carefully before starting.')}</p>
                </div>

                <div class="inst-section">
                    <h4><i class="fas fa-info-circle"></i> Assessment Information</h4>
                    <ul>
                        <li><i class="fas fa-tag"></i> <strong>Type:</strong> ${typeLabels[this.assessmentData.type] || this.assessmentData.type || 'Quiz'}</li>
                        <li><i class="fas fa-question-circle"></i> <strong>Questions:</strong> ${questionCount} questions</li>
                        <li><i class="fas fa-clock"></i> <strong>Duration:</strong> ${duration} minutes</li>
                        <li><i class="fas fa-check-circle"></i> <strong>Passing Score:</strong> ${passingScore}%</li>
                        <li><i class="fas fa-star"></i> <strong>Total Marks:</strong> ${this.assessmentData.totalMarks || questionCount}</li>
                        <li><i class="fas fa-redo"></i> <strong>Attempt:</strong> ${attemptInfo}</li>
                        <li><i class="fas fa-comment"></i> <strong>Feedback:</strong> ${this.showFeedback ? 'Immediate feedback per question' : 'Feedback after submission'}</li>
                    </ul>
                </div>

                <div class="inst-section">
                    <h4><i class="fas fa-list-check"></i> How It Works</h4>
                    <ul>
                        <li><i class="fas fa-circle-check"></i> Read each question carefully</li>
                        <li><i class="fas fa-circle-check"></i> Select your answer</li>
                        ${this.showFeedback ? `
                            <li><i class="fas fa-circle-check"></i> Click <strong>"Submit Answer"</strong> to confirm and see feedback</li>
                            <li><i class="fas fa-circle-check"></i> After submitting, you'll see if you were correct and get feedback</li>
                            <li><i class="fas fa-circle-check"></i> Then automatically move to the next question</li>
                        ` : `
                            <li><i class="fas fa-circle-check"></i> Click <strong>"Next"</strong> to save and move on</li>
                            <li><i class="fas fa-circle-check"></i> You can review and change your answers before final submission</li>
                            <li><i class="fas fa-circle-check"></i> Click <strong>"Submit All"</strong> when you're done</li>
                        `}
                        <li><i class="fas fa-circle-check"></i> Mark questions for review or flag them if needed</li>
                        <li><i class="fas fa-circle-check"></i> Your progress is automatically saved</li>
                    </ul>
                </div>

                <div class="inst-footer">
                    <button class="btn-start" onclick="TakeAssessment.startAssessment()" id="startBtn">
                        <span class="btn-text"><i class="fas fa-play"></i> Start Attempt ${this.currentAttempt}</span>
                        <span class="spinner"></span>
                    </button>
                </div>
            </div>
        `;

        const titleEl = document.getElementById('assessmentTitle');
        const subtitleEl = document.getElementById('assessmentSubtitle');
        if (titleEl) titleEl.textContent = this.assessmentData.title || 'Assessment';
        if (subtitleEl) subtitleEl.textContent = `Course: ${this.assessmentData.course || 'N/A'} • ${this.assessmentData.department || 'N/A'}`;
        
        const exitBtn = document.querySelector('.exit-btn');
        if (exitBtn) exitBtn.style.display = 'none';
    },

    // ============================================================
    // START ASSESSMENT
    // ============================================================

    async startAssessment() {
        const btn = document.getElementById('startBtn');
        if (btn) {
            btn.classList.add('loading');
            btn.disabled = true;
        }

        try {
            const studentId = this.getStudentId();
            if (!studentId) {
                this.app.showToast('Please log in again.', true);
                if (btn) {
                    btn.classList.remove('loading');
                    btn.disabled = false;
                }
                setTimeout(() => window.location.href = '../index.html', 2000);
                return;
            }

            const existingResult = await this.db.collection('studentResults')
                .where('assessmentId', '==', this.assessmentId)
                .where('studentId', '==', studentId)
                .where('status', '==', 'in-progress')
                .get();

            if (!existingResult.empty) {
                console.log('✅ Using existing in-progress attempt');
                const doc = existingResult.docs[0];
                this.currentAttempt = doc.data().attemptNumber || 1;
            } else {
                const resultData = {
                    assessmentId: this.assessmentData.id,
                    assessmentTitle: this.assessmentData.title || 'Untitled',
                    studentId: studentId,
                    studentName: this.currentUser?.firstName + ' ' + (this.currentUser?.lastName || '') || 'Student',
                    studentFirstName: this.currentUser?.firstName || 'Student',
                    studentLastName: this.currentUser?.lastName || '',
                    studentEmail: this.currentUser?.email || '',
                    status: 'in-progress',
                    attemptNumber: this.currentAttempt,
                    startedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    answers: {},
                    submittedAnswers: {},
                    score: 0,
                    passed: false,
                    reviewQuestions: [],
                    flaggedQuestions: [],
                    duration: this.totalDuration
                };
                
                console.log('📝 Creating new attempt record:', resultData);
                await this.db.collection('studentResults').add(resultData);
                console.log('✅ Created new attempt record');
            }

            this.hasStarted = true;
            this.renderAssessment();
            this.startTimer();
            this.startAutoSave();
            
            this.app.showToast(`Attempt ${this.currentAttempt} started! Good luck!`);

        } catch (error) {
            console.error('Error starting assessment:', error);
            this.app.showToast('Error starting assessment: ' + error.message, true);
            if (btn) {
                btn.classList.remove('loading');
                btn.disabled = false;
            }
        }
    },

    // ============================================================
    // RENDER ASSESSMENT
    // ============================================================

    renderAssessment() {
        const container = document.getElementById('assessmentBody');
        const totalQuestions = this.shuffledQuestions.length;
        const hasFeedback = this.showFeedback;
        
        container.innerHTML = `
            <div class="question-area">
                <div class="question-header">
                    <div class="q-number">
                        Question <span id="currentQNum">1</span> of <span id="totalQNum">${totalQuestions}</span>
                        <span id="qCategory" style="font-weight:400;font-size:12px;color:#6b7280;margin-left:8px;"></span>
                        <span id="qPoints" style="font-weight:400;font-size:12px;color:#166534;margin-left:8px;"></span>
                        <span id="qStatus" style="font-weight:400;font-size:12px;margin-left:8px;"></span>
                        <span id="attemptInfo" style="font-weight:400;font-size:12px;color:#6b7280;margin-left:8px;">Attempt ${this.currentAttempt}</span>
                    </div>
                    <div class="q-actions">
                        <button class="mark-review" onclick="TakeAssessment.toggleReview()" id="reviewBtn">
                            <i class="fas fa-bookmark"></i> Review
                        </button>
                        <button class="flag-question" onclick="TakeAssessment.toggleFlag()" id="flagBtn">
                            <i class="fas fa-flag"></i> Flag
                        </button>
                        <button class="clear-answer" onclick="TakeAssessment.clearAnswer()" id="clearBtn" title="Clear Answer">
                            <i class="fas fa-times-circle"></i> Clear
                        </button>
                    </div>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" id="progressBar"></div>
                </div>
                <div class="question-content" id="questionContent">
                </div>
                <div class="question-footer">
                    <div class="footer-left">
                        ${this.allowBack ? `
                            <button class="btn-prev" onclick="TakeAssessment.navigateQuestion(-1)" id="prevBtn">
                                <i class="fas fa-chevron-left"></i> Previous
                            </button>
                        ` : ''}
                        <button class="btn-clear" onclick="TakeAssessment.clearAnswer()" id="clearBtnFooter">
                            <i class="fas fa-eraser"></i> Clear
                        </button>
                    </div>
                    <div class="footer-right">
                        ${hasFeedback ? `
                            <button class="btn-submit-answer" onclick="TakeAssessment.submitCurrentAnswer()" id="submitAnswerBtn">
                                <i class="fas fa-check"></i> Submit Answer
                            </button>
                        ` : `
                            <button class="btn-next" onclick="TakeAssessment.navigateQuestion(1)" id="nextBtn">
                                Next <i class="fas fa-chevron-right"></i>
                            </button>
                            <button class="btn-final-submit" onclick="TakeAssessment.confirmSubmit()" id="submitAllBtn">
                                <i class="fas fa-check-circle"></i> Submit All
                            </button>
                        `}
                    </div>
                </div>
            </div>

            <div class="question-navigator">
                <div class="nav-title">
                    <span>Question Navigator</span>
                    <div class="status-legend">
                        <span class="legend-item"><span class="legend-dot current"></span> Current</span>
                        <span class="legend-item"><span class="legend-dot submitted"></span> Submitted</span>
                        <span class="legend-item"><span class="legend-dot answered"></span> Answered</span>
                        <span class="legend-item"><span class="legend-dot review"></span> Review</span>
                        <span class="legend-item"><span class="legend-dot flagged"></span> Flagged</span>
                        <span class="legend-item"><span class="legend-dot unanswered"></span> Unanswered</span>
                    </div>
                </div>
                <div class="nav-grid" id="navGrid">
                    ${this.shuffledQuestions.map((_, index) => `
                        <div class="nav-item" data-index="${index}" onclick="TakeAssessment.goToQuestion(${index})">
                            ${index + 1}
                            ${this.flaggedQuestions.has(index) ? '<span class="nav-badge flag-badge">!</span>' : ''}
                            ${this.reviewQuestions.has(index) ? '<span class="nav-badge review-badge">R</span>' : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="nav-stats">
                    <div class="stat-item"><span>Submitted</span><span class="stat-value green" id="submittedCount">0</span></div>
                    <div class="stat-item"><span>Answered</span><span class="stat-value orange" id="answeredCount">0</span></div>
                    <div class="stat-item"><span>Review</span><span class="stat-value blue" id="reviewCount">0</span></div>
                    <div class="stat-item"><span>Flagged</span><span class="stat-value red" id="flaggedCount">0</span></div>
                </div>
            </div>
        `;

        const titleEl = document.getElementById('assessmentTitle');
        const subtitleEl = document.getElementById('assessmentSubtitle');
        if (titleEl) titleEl.textContent = this.assessmentData.title || 'Assessment';
        if (subtitleEl) subtitleEl.textContent = `Course: ${this.assessmentData.course || 'N/A'} • ${this.assessmentData.department || 'N/A'}`;
        
        const totalQNum = document.getElementById('totalQNum');
        if (totalQNum) totalQNum.textContent = totalQuestions;
        
        const progressInfo = document.getElementById('progressInfo');
        if (progressInfo) progressInfo.textContent = `Question 1 of ${totalQuestions}`;
        
        const exitBtn = document.querySelector('.exit-btn');
        if (exitBtn) exitBtn.style.display = 'none';

        this.renderQuestion(0);
        this.updateNavigator();
        this.updateProgress();
    },

    // ============================================================
    // RENDER QUESTION
    // ============================================================

    renderQuestion(index) {
        const container = document.getElementById('questionContent');
        if (!container) return;
        
        const question = this.shuffledQuestions[index];
        if (!question) return;

        const hasFeedback = this.showFeedback;
        const isSubmitted = this.isAnswerSubmitted[index] || false;
        const isAnswered = this.answers[index] !== undefined && this.answers[index] !== null && 
            (Array.isArray(this.answers[index]) ? this.answers[index].length > 0 : true);

        // Update header elements - check if they exist first
        const currentQNum = document.getElementById('currentQNum');
        const qCategory = document.getElementById('qCategory');
        const qPoints = document.getElementById('qPoints');
        const progressInfo = document.getElementById('progressInfo');
        const qStatus = document.getElementById('qStatus');

        if (currentQNum) currentQNum.textContent = index + 1;
        if (qCategory) qCategory.textContent = question.category || '';
        if (qPoints) qPoints.textContent = question.points ? `${question.points} pts` : '';
        if (progressInfo) progressInfo.textContent = `Question ${index + 1} of ${this.shuffledQuestions.length}`;

        if (qStatus) {
            if (isSubmitted) {
                qStatus.textContent = '✅ Submitted';
                qStatus.style.color = '#16a34a';
            } else if (isAnswered) {
                qStatus.textContent = '📝 Answered';
                qStatus.style.color = '#f59e0b';
            } else {
                qStatus.textContent = '';
            }
        }

        // Update buttons
        const reviewBtn = document.getElementById('reviewBtn');
        const flagBtn = document.getElementById('flagBtn');
        const clearBtn = document.getElementById('clearBtn');
        const clearBtnFooter = document.getElementById('clearBtnFooter');
        const submitBtn = document.getElementById('submitAnswerBtn');
        
        if (reviewBtn) {
            reviewBtn.classList.toggle('active', this.reviewQuestions.has(index));
            reviewBtn.innerHTML = `<i class="fas fa-bookmark"></i> ${this.reviewQuestions.has(index) ? 'Remove Review' : 'Review'}`;
        }
        
        if (flagBtn) {
            flagBtn.classList.toggle('active', this.flaggedQuestions.has(index));
            flagBtn.innerHTML = `<i class="fas fa-flag"></i> ${this.flaggedQuestions.has(index) ? 'Unflag' : 'Flag'}`;
        }
        
        const showClear = (isAnswered && !isSubmitted);
        if (clearBtn) clearBtn.style.display = showClear ? 'flex' : 'none';
        if (clearBtnFooter) clearBtnFooter.style.display = showClear ? 'flex' : 'none';
        
        if (submitBtn) {
            submitBtn.disabled = isSubmitted || !isAnswered;
            submitBtn.innerHTML = isSubmitted ? '✅ Submitted' : 'Submit Answer';
            submitBtn.className = isSubmitted ? 'btn-submit-answer submitted' : 'btn-submit-answer';
        }

        let optionsHtml = '';
        let answerHtml = '';
        let feedbackHtml = '';

        const currentAnswer = this.answers[index] || null;
        const isDisabled = isSubmitted;

        // Get correct answer for feedback
        const correctAnswer = this.getCorrectAnswer(question);
        const isCorrect = this.isAnswerCorrect(question, currentAnswer);

        // Build options based on question type
        switch (question.type) {
            case 'multiple-choice':
            case 'multiple-select':
                const isMultiple = question.type === 'multiple-select';
                const options = question.options || [];
                
                optionsHtml = `
                    <div class="options-list ${isMultiple ? 'multiple-select' : ''}">
                        ${options.map((opt, optIndex) => {
                            const isSelected = isMultiple ? 
                                (Array.isArray(currentAnswer) && currentAnswer.includes(opt)) :
                                currentAnswer === opt;
                            
                            let extraClass = '';
                            let statusHtml = '';
                            
                            if (isSubmitted) {
                                const isCorrectOption = correctAnswer.includes(opt);
                                if (isSelected && isCorrectOption) {
                                    extraClass = 'correct';
                                    statusHtml = '<span class="option-status correct-text">✓ Correct</span>';
                                } else if (isSelected && !isCorrectOption) {
                                    extraClass = 'wrong';
                                    statusHtml = '<span class="option-status wrong-text">✗ Wrong</span>';
                                } else if (isCorrectOption) {
                                    extraClass = 'correct';
                                    statusHtml = '<span class="option-status correct-text">✓ Correct Answer</span>';
                                }
                            } else if (isSelected) {
                                extraClass = 'selected';
                            }
                            
                            const label = String.fromCharCode(65 + optIndex);
                            const disabledAttr = isDisabled ? 'class="disabled"' : '';
                            const onclickAttr = isDisabled ? '' : `onclick="${isMultiple ? `TakeAssessment.toggleMultipleOption(${index}, ${optIndex})` : `TakeAssessment.selectOption(${index}, ${optIndex})`}"`;
                            
                            return `
                                <div class="option-item ${extraClass}" ${onclickAttr} ${disabledAttr}>
                                    <span class="option-marker">${isMultiple ? (isSelected ? '✓' : label) : (isSelected ? '●' : label)}</span>
                                    <span class="option-text">${this.app.escapeHtml(opt)}</span>
                                    ${statusHtml}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
                break;

            case 'true-false':
                optionsHtml = `
                    <div class="options-list">
                        ${['True', 'False'].map((opt, optIndex) => {
                            const isSelected = currentAnswer === opt;
                            let extraClass = '';
                            let statusHtml = '';
                            
                            if (isSubmitted) {
                                const isCorrectOption = correctAnswer.includes(opt);
                                if (isSelected && isCorrectOption) {
                                    extraClass = 'correct';
                                    statusHtml = '<span class="option-status correct-text">✓ Correct</span>';
                                } else if (isSelected && !isCorrectOption) {
                                    extraClass = 'wrong';
                                    statusHtml = '<span class="option-status wrong-text">✗ Wrong</span>';
                                } else if (isCorrectOption) {
                                    extraClass = 'correct';
                                    statusHtml = '<span class="option-status correct-text">✓ Correct Answer</span>';
                                }
                            } else if (isSelected) {
                                extraClass = 'selected';
                            }
                            
                            const disabledAttr = isDisabled ? 'class="disabled"' : '';
                            const onclickAttr = isDisabled ? '' : `onclick="TakeAssessment.selectTrueFalse(${index}, '${opt}')"`;
                            
                            return `
                                <div class="option-item ${extraClass}" ${onclickAttr} ${disabledAttr}>
                                    <span class="option-marker">${isSelected ? '●' : String.fromCharCode(65 + optIndex)}</span>
                                    <span class="option-text">${opt}</span>
                                    ${statusHtml}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
                break;

            case 'fill-blank':
                const fillValue = currentAnswer || '';
                answerHtml = `
                    <input type="text" class="fill-blank-input" id="fillBlankInput" 
                           placeholder="Type your answer here..." 
                           value="${this.app.escapeHtml(fillValue)}"
                           ${isDisabled ? 'disabled' : ''}
                           oninput="TakeAssessment.saveFillBlank(${index}, this.value)">
                `;
                break;

            case 'short-answer':
            case 'essay':
                const maxWords = question.maxWordCount || 0;
                const currentText = currentAnswer || '';
                const wordCount = currentText.trim() ? currentText.trim().split(/\s+/).length : 0;
                
                answerHtml = `
                    <textarea class="essay-input" id="essayInput" 
                              placeholder="Type your ${question.type === 'essay' ? 'essay' : 'short answer'} here..."
                              ${isDisabled ? 'disabled' : ''}
                              oninput="TakeAssessment.saveEssay(${index}, this.value)">${this.app.escapeHtml(currentText)}</textarea>
                    ${maxWords > 0 ? `<div class="word-count">${wordCount} / ${maxWords} words</div>` : ''}
                `;
                break;

            case 'code':
                const lang = question.language || 'javascript';
                const codeContent = currentAnswer || question.starterCode || '';
                
                answerHtml = `
                    <div class="code-editor-wrapper">
                        <div class="editor-header">
                            <span>Code Editor</span>
                            <span class="lang-badge">${lang.toUpperCase()}</span>
                        </div>
                        <textarea id="codeEditor_${index}" style="display:none;">${this.app.escapeHtml(codeContent)}</textarea>
                        <div id="codeMirror_${index}"></div>
                    </div>
                `;
                
                setTimeout(() => {
                    this.initCodeEditor(index, lang, codeContent, isDisabled);
                }, 100);
                break;

            case 'file-upload':
                answerHtml = `
                    <div class="file-upload-area" onclick="${isDisabled ? '' : "document.getElementById('fileInput').click()"}">
                        <div class="file-icon"><i class="fas fa-cloud-upload-alt"></i></div>
                        <div class="file-text">${isDisabled ? 'File submitted' : 'Click to upload or drag and drop'}</div>
                        <div class="file-name" id="fileName">${currentAnswer ? this.app.escapeHtml(currentAnswer) : (isDisabled ? 'Submitted' : 'No file selected')}</div>
                        <input type="file" id="fileInput" ${isDisabled ? 'disabled' : ''} onchange="TakeAssessment.uploadFile(${index}, this)" 
                               ${question.fileTypes === 'images' ? 'accept="image/*"' : 
                                 question.fileTypes === 'documents' ? 'accept=".pdf,.doc,.docx"' :
                                 question.fileTypes === 'code' ? 'accept=".js,.py,.html,.css"' : ''}>
                    </div>
                    <div style="font-size:12px;color:#6b7280;margin-top:8px;">
                        Max file size: ${question.maxFileSize || 5} MB
                        ${question.fileTypes && question.fileTypes !== 'all' ? `• Allowed: ${question.fileTypes}` : ''}
                    </div>
                `;
                break;

            default:
                optionsHtml = `<p style="color:#6b7280;">Unsupported question type: ${question.type}</p>`;
        }

        // Build feedback if submitted
        if (isSubmitted && hasFeedback) {
            const points = question.points || 1;
            const earnedPoints = isCorrect ? points : 0;
            const feedbackText = question.feedback?.[0] || question.rubric || '';
            
            feedbackHtml = `
                <div class="feedback-box ${isCorrect ? 'correct-feedback' : 'incorrect-feedback'}">
                    <div class="feedback-header ${isCorrect ? 'correct-color' : 'incorrect-color'}">
                        <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                        ${isCorrect ? 'Correct!' : 'Incorrect'}
                    </div>
                    ${this.showScore ? `
                        <div class="points-earned">
                            Score: ${earnedPoints} / ${points} pts
                        </div>
                    ` : ''}
                    ${this.showCorrectAnswers && correctAnswer.length > 0 ? `
                        <div class="correct-answer-display">
                            <i class="fas fa-lightbulb"></i> Correct Answer: ${correctAnswer.join(', ')}
                        </div>
                    ` : ''}
                    ${this.showFeedback && feedbackText ? `
                        <div class="feedback-text">
                            <strong>Feedback:</strong> ${this.app.escapeHtml(feedbackText)}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Build the question display with clear separation
        container.innerHTML = `
            <div class="question-header-display">
                <div class="question-meta">
                    <span class="question-number-badge">Question ${index + 1}</span>
                    <span class="question-points-badge">${question.points || 1} pts</span>
                    ${question.category ? `<span class="question-category-badge">${this.app.escapeHtml(question.category)}</span>` : ''}
                    ${this.reviewQuestions.has(index) ? '<span class="question-review-badge">📌 Review</span>' : ''}
                    ${this.flaggedQuestions.has(index) ? '<span class="question-flag-badge">⚑ Flagged</span>' : ''}
                    ${isSubmitted ? '<span class="question-submitted-badge">✅ Submitted</span>' : ''}
                    ${isAnswered && !isSubmitted ? '<span class="question-answered-badge">📝 Answered</span>' : ''}
                </div>
                <div class="question-text-display">
                    ${this.app.escapeHtml(question.text)}
                </div>
            </div>
            ${question.type === 'code' ? answerHtml : optionsHtml}
            ${answerHtml && question.type !== 'code' ? answerHtml : ''}
            ${feedbackHtml}
        `;

        // Update navigation buttons
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        if (prevBtn) prevBtn.disabled = index === 0 || !this.allowBack;
        
        if (nextBtn && !hasFeedback) {
            nextBtn.disabled = index === this.shuffledQuestions.length - 1;
        }

        if (hasFeedback) {
            const nextBtnEl = document.getElementById('nextBtn');
            if (nextBtnEl) nextBtnEl.style.display = 'none';
        }

        this.updateNavigator();
        this.updateProgress();
    },

    // ============================================================
    // GET CORRECT ANSWER
    // ============================================================

    getCorrectAnswer(question) {
        if (!question) return [];
        
        let correct = question.correctAnswer;
        
        if (correct === undefined || correct === null) {
            if (question.correctAnswers !== undefined && question.correctAnswers !== null) {
                correct = question.correctAnswers;
            }
            else if (question.correct !== undefined && question.correct !== null) {
                correct = question.correct;
            }
            else if (question.answer !== undefined && question.answer !== null) {
                correct = question.answer;
            }
            else if (question.type === 'true-false') {
                correct = question.correct === 'true' ? 'True' : 'False';
            }
            else {
                return [];
            }
        }
        
        if (typeof correct === 'string') {
            return [correct];
        } else if (Array.isArray(correct)) {
            return correct;
        } else if (typeof correct === 'boolean') {
            return [correct ? 'True' : 'False'];
        }
        
        return [];
    },

    // ============================================================
    // IS ANSWER CORRECT
    // ============================================================

    isAnswerCorrect(question, userAnswer) {
        if (!userAnswer) return false;
        
        const correctAnswers = this.getCorrectAnswer(question);
        if (correctAnswers.length === 0) return true;
        
        if (question.type === 'multiple-choice' || question.type === 'true-false') {
            return userAnswer === correctAnswers[0];
        } else if (question.type === 'multiple-select') {
            const userArr = Array.isArray(userAnswer) ? userAnswer : [];
            const sortedCorrect = [...correctAnswers].sort();
            const sortedUser = [...userArr].sort();
            return JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser);
        } else if (question.type === 'fill-blank') {
            return correctAnswers.some(a => a.toLowerCase() === userAnswer.toLowerCase());
        }
        return true;
    },

    // ============================================================
    // INIT CODE EDITOR
    // ============================================================

    initCodeEditor(index, lang, content, isDisabled) {
        const modeMap = {
            javascript: 'javascript',
            python: 'python',
            html: 'xml',
            css: 'css',
            sql: 'sql',
            java: 'text/x-java'
        };
        
        const editor = CodeMirror(document.getElementById(`codeMirror_${index}`), {
            value: content,
            mode: modeMap[lang] || 'javascript',
            theme: 'dracula',
            lineNumbers: true,
            lineWrapping: true,
            indentUnit: 2,
            tabSize: 2,
            readOnly: isDisabled,
            extraKeys: {
                "Ctrl-S": function() { 
                    if (!isDisabled) TakeAssessment.saveCurrentAnswer(); 
                }
            }
        });
        
        if (!isDisabled) {
            editor.on('change', function() {
                const value = editor.getValue();
                TakeAssessment.answers[index] = value;
                TakeAssessment.updateNavigator();
                TakeAssessment.updateQuestionStatus(index);
            });
        }
        
        this.codeEditors[index] = editor;
    },

    // ============================================================
    // ANSWER HANDLERS
    // ============================================================

    selectOption(questionIndex, optionIndex) {
        const question = this.shuffledQuestions[questionIndex];
        const option = question.options[optionIndex];
        this.answers[questionIndex] = option;
        this.updateQuestionStatus(questionIndex);
        this.renderQuestion(questionIndex);
        this.updateNavigator();
        this.autoSave();
    },

    toggleMultipleOption(questionIndex, optionIndex) {
        const question = this.shuffledQuestions[questionIndex];
        const option = question.options[optionIndex];
        
        if (!Array.isArray(this.answers[questionIndex])) {
            this.answers[questionIndex] = [];
        }
        
        const idx = this.answers[questionIndex].indexOf(option);
        if (idx > -1) {
            this.answers[questionIndex].splice(idx, 1);
        } else {
            this.answers[questionIndex].push(option);
        }
        
        if (this.answers[questionIndex].length === 0) {
            delete this.answers[questionIndex];
        }
        
        this.updateQuestionStatus(questionIndex);
        this.renderQuestion(questionIndex);
        this.updateNavigator();
        this.autoSave();
    },

    selectTrueFalse(questionIndex, value) {
        this.answers[questionIndex] = value;
        this.updateQuestionStatus(questionIndex);
        this.renderQuestion(questionIndex);
        this.updateNavigator();
        this.autoSave();
    },

    saveFillBlank(questionIndex, value) {
        if (value && value.trim()) {
            this.answers[questionIndex] = value.trim();
        } else {
            delete this.answers[questionIndex];
        }
        this.updateQuestionStatus(questionIndex);
        this.updateNavigator();
        this.autoSave();
    },

    saveEssay(questionIndex, value) {
        if (value && value.trim()) {
            this.answers[questionIndex] = value.trim();
        } else {
            delete this.answers[questionIndex];
        }
        this.updateQuestionStatus(questionIndex);
        this.updateNavigator();
        this.autoSave();
    },

    // ============================================================
    // SUBMIT CURRENT ANSWER (Immediate Feedback Mode)
    // ============================================================

    submitCurrentAnswer() {
        const index = this.currentQuestionIndex;
        
        if (this.isAnswerSubmitted[index]) {
            this.app.showToast('Answer already submitted.', true);
            return;
        }
        
        if (this.answers[index] === undefined || this.answers[index] === null || 
            (Array.isArray(this.answers[index]) && this.answers[index].length === 0)) {
            this.app.showToast('Please select an answer first.', true);
            return;
        }
        
        // Save the submitted answer
        this.submittedAnswers[index] = this.answers[index];
        this.isAnswerSubmitted[index] = true;
        this.questionStatus[index].submitted = true;
        
        // Render the question with feedback
        this.renderQuestion(index);
        this.updateNavigator();
        this.autoSave();
        
        this.app.showToast('Answer submitted!');
        
        // Auto-advance to next question after delay
        if (index < this.shuffledQuestions.length - 1) {
            setTimeout(() => {
                this.navigateQuestion(1);
            }, 2000);
        } else {
            // Last question - show completion
            setTimeout(() => {
                this.showCompletion();
            }, 2000);
        }
    },

    // ============================================================
    // CLEAR ANSWER
    // ============================================================

    clearAnswer() {
        const index = this.currentQuestionIndex;
        
        if (this.isAnswerSubmitted[index]) {
            this.app.showToast('Cannot clear a submitted answer.', true);
            return;
        }
        
        if (this.answers[index] !== undefined) {
            delete this.answers[index];
            this.updateQuestionStatus(index);
            this.renderQuestion(index);
            this.updateNavigator();
            this.autoSave();
            this.app.showToast('Answer cleared.');
        }
    },

    saveCurrentAnswer() {
        const question = this.shuffledQuestions[this.currentQuestionIndex];
        if (question.type === 'code' && this.codeEditors[this.currentQuestionIndex]) {
            this.answers[this.currentQuestionIndex] = this.codeEditors[this.currentQuestionIndex].getValue();
            this.updateQuestionStatus(this.currentQuestionIndex);
        }
        this.autoSave();
        this.app.showToast('Answer saved!');
    },

    updateQuestionStatus(index) {
        const isAnswered = this.answers[index] !== undefined && this.answers[index] !== null && 
            (Array.isArray(this.answers[index]) ? this.answers[index].length > 0 : true);
        
        if (this.questionStatus[index]) {
            this.questionStatus[index].answered = isAnswered;
        }
    },

    // ============================================================
    // NAVIGATION
    // ============================================================

    navigateQuestion(direction) {
        const newIndex = this.currentQuestionIndex + direction;
        if (newIndex >= 0 && newIndex < this.shuffledQuestions.length) {
            const question = this.shuffledQuestions[this.currentQuestionIndex];
            if (question.type === 'code' && this.codeEditors[this.currentQuestionIndex]) {
                this.answers[this.currentQuestionIndex] = this.codeEditors[this.currentQuestionIndex].getValue();
                this.updateQuestionStatus(this.currentQuestionIndex);
            }
            this.currentQuestionIndex = newIndex;
            this.renderQuestion(this.currentQuestionIndex);
            this.updateNavigator();
            
            const content = document.getElementById('questionContent');
            if (content) content.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    goToQuestion(index) {
        if (index >= 0 && index < this.shuffledQuestions.length) {
            const question = this.shuffledQuestions[this.currentQuestionIndex];
            if (question.type === 'code' && this.codeEditors[this.currentQuestionIndex]) {
                this.answers[this.currentQuestionIndex] = this.codeEditors[this.currentQuestionIndex].getValue();
                this.updateQuestionStatus(this.currentQuestionIndex);
            }
            this.currentQuestionIndex = index;
            this.renderQuestion(this.currentQuestionIndex);
            this.updateNavigator();
            
            const content = document.getElementById('questionContent');
            if (content) content.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    // ============================================================
    // REVIEW & FLAG
    // ============================================================

    toggleReview() {
        const index = this.currentQuestionIndex;
        if (this.reviewQuestions.has(index)) {
            this.reviewQuestions.delete(index);
            if (this.questionStatus[index]) {
                this.questionStatus[index].reviewed = false;
            }
        } else {
            this.reviewQuestions.add(index);
            if (this.questionStatus[index]) {
                this.questionStatus[index].reviewed = true;
            }
        }
        this.renderQuestion(index);
        this.updateNavigator();
        this.autoSave();
    },

    toggleFlag() {
        const index = this.currentQuestionIndex;
        if (this.flaggedQuestions.has(index)) {
            this.flaggedQuestions.delete(index);
            if (this.questionStatus[index]) {
                this.questionStatus[index].flagged = false;
            }
        } else {
            this.flaggedQuestions.add(index);
            if (this.questionStatus[index]) {
                this.questionStatus[index].flagged = true;
            }
        }
        this.renderQuestion(index);
        this.updateNavigator();
        this.autoSave();
    },

    // ============================================================
    // NAVIGATOR UPDATE
    // ============================================================

    updateNavigator() {
        const navItems = document.querySelectorAll('.nav-item');
        let answered = 0;
        let submitted = 0;
        let reviewed = 0;
        let flagged = 0;

        navItems.forEach((item, index) => {
            item.className = 'nav-item';
            
            if (index === this.currentQuestionIndex) {
                item.classList.add('current');
            }
            
            if (this.isAnswerSubmitted[index]) {
                item.classList.add('submitted');
                submitted++;
            } else if (this.answers[index] !== undefined && this.answers[index] !== null && 
                (Array.isArray(this.answers[index]) ? this.answers[index].length > 0 : true)) {
                item.classList.add('answered');
                answered++;
            }
            
            if (this.reviewQuestions.has(index)) {
                item.classList.add('review');
                reviewed++;
            }
            
            if (this.flaggedQuestions.has(index)) {
                item.classList.add('flagged');
                flagged++;
            }
        });

        const submittedCount = document.getElementById('submittedCount');
        const answeredCount = document.getElementById('answeredCount');
        const reviewCount = document.getElementById('reviewCount');
        const flaggedCount = document.getElementById('flaggedCount');
        
        if (submittedCount) submittedCount.textContent = submitted;
        if (answeredCount) answeredCount.textContent = answered;
        if (reviewCount) reviewCount.textContent = reviewed;
        if (flaggedCount) flaggedCount.textContent = flagged;
    },

    updateProgress() {
        const total = this.shuffledQuestions.length;
        const answered = Object.keys(this.answers).filter(k => 
            this.answers[k] !== undefined && this.answers[k] !== null &&
            (Array.isArray(this.answers[k]) ? this.answers[k].length > 0 : true)
        ).length;
        
        const progress = total > 0 ? (answered / total) * 100 : 0;
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = `${Math.min(progress, 100)}%`;
        }
    },

    // ============================================================
    // TIMER
    // ============================================================

    startTimer() {
        if (!this.showTimer) {
            const timerSection = document.getElementById('timerSection');
            if (timerSection) timerSection.style.display = 'none';
            return;
        }
        
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining <= 0) {
                clearInterval(this.timerInterval);
                this.autoSubmit();
            }
        }, 1000);
    },

    updateTimerDisplay() {
        const mins = Math.floor(this.timeRemaining / 60);
        const secs = this.timeRemaining % 60;
        const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        
        const timerEl = document.getElementById('timerDisplay');
        const sectionEl = document.getElementById('timerSection');
        
        if (timerEl) timerEl.textContent = display;
        
        if (sectionEl) {
            sectionEl.className = 'timer-section';
            
            if (this.timeRemaining <= 60) {
                sectionEl.classList.add('red');
            } else if (this.timeRemaining <= 300) {
                sectionEl.classList.add('orange');
            } else {
                sectionEl.classList.add('green');
            }
        }
    },

    // ============================================================
    // AUTO-SAVE
    // ============================================================

    startAutoSave() {
        this.autoSaveInterval = setInterval(() => this.autoSave(), 30000);
    },

    async autoSave() {
        if (!this.hasStarted || this.isSubmitting) return;
        
        try {
            const studentId = this.getStudentId();
            if (!studentId) return;
            
            const answerData = {};
            Object.keys(this.answers).forEach(key => {
                answerData[key] = this.answers[key];
            });
            
            const submittedData = {};
            Object.keys(this.submittedAnswers).forEach(key => {
                submittedData[key] = this.submittedAnswers[key];
            });
            
            const snapshot = await this.db.collection('studentResults')
                .where('assessmentId', '==', this.assessmentId)
                .where('studentId', '==', studentId)
                .where('status', '==', 'in-progress')
                .get();
            
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const reviewArray = Array.from(this.reviewQuestions);
                const flaggedArray = Array.from(this.flaggedQuestions);
                
                await doc.ref.update({
                    answers: answerData,
                    submittedAnswers: submittedData,
                    reviewQuestions: reviewArray,
                    flaggedQuestions: flaggedArray,
                    lastSavedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    timeRemaining: this.timeRemaining
                });
            }
        } catch (error) {
            console.warn('Auto-save error:', error);
        }
    },

    // ============================================================
    // SHOW COMPLETION
    // ============================================================

    showCompletion() {
        const container = document.getElementById('assessmentBody');
        const total = this.shuffledQuestions.length;
        const submitted = Object.keys(this.submittedAnswers).length;
        const answered = Object.keys(this.answers).filter(k => 
            this.answers[k] !== undefined && this.answers[k] !== null &&
            (Array.isArray(this.answers[k]) ? this.answers[k].length > 0 : true)
        ).length;
        
        const remaining = total - submitted;
        const isComplete = remaining === 0;

        container.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:400px;">
                <div style="background:white;border-radius:16px;padding:40px;max-width:500px;width:100%;text-align:center;border:1px solid #e5e7eb;">
                    <div style="font-size:48px;color:${isComplete ? '#16a34a' : '#f59e0b'};margin-bottom:16px;">
                        <i class="fas ${isComplete ? 'fa-check-circle' : 'fa-clock'}"></i>
                    </div>
                    <h2 style="font-size:24px;font-weight:700;color:#1a1f2c;margin-bottom:8px;">
                        ${isComplete ? 'All Done!' : 'Almost There!'}
                    </h2>
                    <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">
                        ${isComplete ? 'You\'ve completed all questions. Ready to submit?' : `${remaining} question(s) remaining`}
                    </p>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:16px 0;">
                        <div style="background:#f8fafc;padding:12px;border-radius:10px;">
                            <div style="font-size:20px;font-weight:700;color:#16a34a;">${submitted}</div>
                            <div style="font-size:12px;color:#6b7280;">Submitted</div>
                        </div>
                        <div style="background:#f8fafc;padding:12px;border-radius:10px;">
                            <div style="font-size:20px;font-weight:700;color:#f59e0b;">${answered}</div>
                            <div style="font-size:12px;color:#6b7280;">Answered</div>
                        </div>
                        <div style="background:#f8fafc;padding:12px;border-radius:10px;">
                            <div style="font-size:20px;font-weight:700;color:#dc2626;">${total}</div>
                            <div style="font-size:12px;color:#6b7280;">Total</div>
                        </div>
                    </div>
                    ${!isComplete ? `
                        <button class="btn-primary" onclick="TakeAssessment.goToNextUnanswered()" style="margin:8px;">
                            <i class="fas fa-arrow-right"></i> Go to Next Unanswered
                        </button>
                    ` : ''}
                    <button class="btn-final-submit" onclick="TakeAssessment.confirmSubmit()" style="margin:8px;padding:12px 32px;border:none;border-radius:10px;font-weight:700;font-size:16px;cursor:pointer;background:#dc2626;color:white;">
                        <i class="fas fa-check-circle"></i> Submit All
                    </button>
                    <button class="btn-secondary" onclick="TakeAssessment.goToQuestion(0)" style="margin:8px;padding:12px 32px;border:1px solid #e5e7eb;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer;background:#f3f4f6;color:#1a1f2c;">
                        <i class="fas fa-arrow-left"></i> Review All
                    </button>
                </div>
            </div>
        `;
    },

    goToNextUnanswered() {
        for (let i = 0; i < this.shuffledQuestions.length; i++) {
            if (!this.isAnswerSubmitted[i]) {
                this.goToQuestion(i);
                return;
            }
        }
        this.app.showToast('All questions are submitted!');
    },

    // ============================================================
    // CONFIRM SUBMIT (Final Submission) - WITH STYLED MODAL
    // ============================================================

    confirmSubmit() {
        const total = this.shuffledQuestions.length;
        const submitted = Object.keys(this.submittedAnswers).length;
        const unanswered = total - submitted;
        const reviewed = this.reviewQuestions.size;
        const flagged = this.flaggedQuestions.size;
        
        const modalBody = document.getElementById('modalBody');
        const modalFooter = document.getElementById('modalFooter');
        const modalTitle = document.getElementById('modalTitle');
        
        if (modalTitle) modalTitle.textContent = 'Submit Assessment';
        
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="text-align:center;margin-bottom:20px;">
                    <i class="fas fa-check-circle" style="font-size:48px;color:#166534;"></i>
                    <h3 style="margin-top:12px;font-size:18px;font-weight:700;">Ready to Submit?</h3>
                    <p style="color:#6b7280;font-size:14px;">Review your progress before submitting</p>
                    <p style="color:#6b7280;font-size:13px;margin-top:4px;">Attempt ${this.currentAttempt} ${this.unlimitedAttempts ? '(Unlimited attempts)' : `of ${this.attempts}`}</p>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
                    <div style="background:#f8fafc;padding:16px;border-radius:10px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#16a34a;">${submitted}</div>
                        <div style="font-size:12px;color:#6b7280;">Submitted</div>
                    </div>
                    <div style="background:#f8fafc;padding:16px;border-radius:10px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#dc2626;">${unanswered}</div>
                        <div style="font-size:12px;color:#6b7280;">Not Submitted</div>
                    </div>
                    <div style="background:#f8fafc;padding:16px;border-radius:10px;text-align:center;">
                        <div style="font-size:28px;font-weight:700;color:#f59e0b;">${reviewed}</div>
                        <div style="font-size:12px;color:#6b7280;">For Review</div>
                    </div>
                </div>
                ${flagged > 0 ? `
                    <div style="margin-top:12px;padding:12px;background:#fef2f2;border-radius:8px;border:1px solid #fca5a5;">
                        <i class="fas fa-flag" style="color:#dc2626;"></i>
                        <span style="color:#dc2626;font-weight:500;">${flagged} question(s) flagged</span>
                        <span style="color:#6b7280;font-size:13px;display:block;margin-top:4px;">You have flagged these questions for review. Please check them before submitting.</span>
                    </div>
                ` : ''}
                ${unanswered > 0 ? `
                    <div style="margin-top:12px;padding:12px;background:#fef3c7;border-radius:8px;border:1px solid #fdba74;">
                        <i class="fas fa-exclamation-triangle" style="color:#d97706;"></i>
                        <span style="color:#b45309;font-weight:500;">${unanswered} question(s) not submitted</span>
                        <span style="color:#6b7280;font-size:13px;display:block;margin-top:4px;">You haven't submitted answers for all questions. Consider reviewing them before submitting.</span>
                    </div>
                ` : ''}
            `;
        }
        
        if (modalFooter) {
            modalFooter.innerHTML = `
                <button class="btn-secondary" onclick="TakeAssessment.closeModal()" style="padding:10px 24px;min-height:44px;font-weight:600;border:1px solid #e5e7eb;background:#f3f4f6;color:#1a1f2c;border-radius:10px;cursor:pointer;transition:all 0.2s ease;">
                    Cancel
                </button>
                <button class="btn-primary" onclick="TakeAssessment.submitAssessment()" style="padding:10px 28px;min-height:44px;font-weight:600;background:#dc2626;color:white;border:none;border-radius:10px;cursor:pointer;transition:all 0.2s ease;box-shadow:0 2px 8px rgba(220,38,38,0.3);">
                    <i class="fas fa-check-circle"></i> Submit Assessment
                </button>
            `;
        }
        
        this.openModal();
    },

    // ============================================================
    // SUBMIT ASSESSMENT (Final) - WITH CERTIFICATE GENERATION
    // ============================================================

    async submitAssessment() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    
    this.closeModal();
    this.app.showToast('Submitting assessment...');
    
    try {
        const studentId = this.getStudentId();
        if (!studentId) {
            this.app.showToast('Please log in again.', true);
            this.isSubmitting = false;
            return;
        }
        
        // Calculate score
        const total = this.shuffledQuestions.length;
        let correct = 0;
        let totalPoints = 0;
        let earnedPoints = 0;
        let questionResults = [];
        
        this.shuffledQuestions.forEach((q, index) => {
            const userAnswer = this.submittedAnswers[index] || this.answers[index];
            const points = q.points || 1;
            totalPoints += points;
            let isCorrect = false;
            
            if (!userAnswer) {
                questionResults.push({ index, correct: false, points: 0 });
                return;
            }
            
            if (q.type === 'multiple-choice') {
                const correctAnswers = this.getCorrectAnswer(q);
                isCorrect = correctAnswers.length > 0 && userAnswer === correctAnswers[0];
                if (isCorrect) { correct++; earnedPoints += points; }
            } else if (q.type === 'multiple-select') {
                const correctAnswers = this.getCorrectAnswer(q);
                const userAnswers = Array.isArray(userAnswer) ? userAnswer : [];
                const sortedCorrect = [...correctAnswers].sort();
                const sortedUser = [...userAnswers].sort();
                isCorrect = JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser);
                if (isCorrect) { correct++; earnedPoints += points; }
            } else if (q.type === 'true-false') {
                const correctAnswers = this.getCorrectAnswer(q);
                isCorrect = correctAnswers.length > 0 && userAnswer === correctAnswers[0];
                if (isCorrect) { correct++; earnedPoints += points; }
            } else if (q.type === 'fill-blank') {
                const correctAnswers = this.getCorrectAnswer(q);
                isCorrect = correctAnswers.some(a => a.toLowerCase() === userAnswer.toLowerCase());
                if (isCorrect) { correct++; earnedPoints += points; }
            } else {
                if (userAnswer && userAnswer.trim()) {
                    isCorrect = true;
                    correct++;
                    earnedPoints += points;
                }
            }
            
            questionResults.push({ index, correct: isCorrect, points: isCorrect ? points : 0 });
        });
        
        const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
        const passed = score >= (this.assessmentData.passingScore || 60);
        
        // Update or create result document
        const snapshot = await this.db.collection('studentResults')
            .where('assessmentId', '==', this.assessmentId)
            .where('studentId', '==', studentId)
            .where('status', '==', 'in-progress')
            .get();
        
        let resultDocId = null;
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            resultDocId = doc.id;
            await doc.ref.update({
                status: 'submitted',
                submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                answers: this.answers,
                submittedAnswers: this.submittedAnswers,
                score: score,
                passed: passed,
                correctCount: correct,
                totalQuestions: total,
                earnedPoints: earnedPoints,
                totalPoints: totalPoints,
                questionResults: questionResults,
                reviewQuestions: Array.from(this.reviewQuestions),
                flaggedQuestions: Array.from(this.flaggedQuestions),
                timeTaken: this.totalDuration * 60 - this.timeRemaining,
                attemptNumber: this.currentAttempt
            });
            console.log(`✅ Attempt ${this.currentAttempt} submitted successfully`);
        } else {
            // Fallback: create new result
            const newResultRef = await this.db.collection('studentResults').add({
                assessmentId: this.assessmentId,
                studentId: studentId,
                status: 'submitted',
                submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                answers: this.answers,
                submittedAnswers: this.submittedAnswers,
                score: score,
                passed: passed,
                correctCount: correct,
                totalQuestions: total,
                earnedPoints: earnedPoints,
                totalPoints: totalPoints,
                questionResults: questionResults,
                reviewQuestions: Array.from(this.reviewQuestions),
                flaggedQuestions: Array.from(this.flaggedQuestions),
                timeTaken: this.totalDuration * 60 - this.timeRemaining,
                attemptNumber: this.currentAttempt
            });
            resultDocId = newResultRef.id;
            console.log(`⚠️ Created new result document (fallback): ${resultDocId}`);
        }
        
        clearInterval(this.timerInterval);
        clearInterval(this.autoSaveInterval);
        
        // Generate certificate
        try {
            await this.generateCertificateIfEligible(studentId, score, passed, resultDocId);
        } catch (certError) {
            console.error('Certificate generation error:', certError);
            // Don't stop the submission flow; just log it
        }
        
        const remainingAttempts = this.unlimitedAttempts ? 'Unlimited' : (this.attempts - this.currentAttempt);
        const message = remainingAttempts > 0 ? 
            `Attempt ${this.currentAttempt} submitted! You have ${remainingAttempts} attempt(s) remaining.` :
            'Assessment submitted successfully!';
        
        this.app.showToast(message);
        
        setTimeout(() => {
            window.location.href = `result-detail.html?id=${resultDocId}`;
        }, 1500);
        
    } catch (error) {
        console.error('Error submitting assessment:', error);
        this.app.showToast('Error submitting assessment: ' + error.message, true);
        this.isSubmitting = false;
    }
},

    // ============================================================
    // GENERATE CERTIFICATE IF ELIGIBLE
    // ============================================================

    async generateCertificateIfEligible(studentId, score, passed, resultDocId) {
    try {
        // Check if certificate is enabled for this assessment
        const certSettings = this.assessmentData.certificate;
        if (!certSettings || !certSettings.enabled) {
            console.log('ℹ️ Certificate not enabled for this assessment.');
            return;
        }

        // Check if student meets minimum score
        const minScore = certSettings.minScore || 70;
        if (score < minScore) {
            console.log(`ℹ️ Student scored ${score}%, below minimum ${minScore}%. Certificate not generated.`);
            return;
        }

        console.log(`📜 Generating certificate for student ${studentId} (score: ${score}%)`);

        // Determine certificate type
        let certType = 'completion';
        if (this.assessmentData.type === 'quiz' || this.assessmentData.type === 'assignment') {
            certType = 'completion';
        } else if (this.assessmentData.type === 'final') {
            certType = 'achievement';
        } else {
            certType = 'completion';
        }

        // Determine grade based on score
        let grade = 'Completion';
        let gradeClass = 'completion';
        if (score >= 80) {
            grade = 'Outstanding';
            gradeClass = 'outstanding';
        } else if (score >= 70) {
            grade = 'Distinction';
            gradeClass = 'distinction';
        } else if (score >= 60) {
            grade = 'Merit';
            gradeClass = 'merit';
        } else {
            grade = 'Completion';
            gradeClass = 'completion';
        }

        // Program code
        const department = this.assessmentData.department || 'General';
        const programCode = this.getProgramCode(department);

        // Generate certificate ID: DBI-XX-YY-CC001
        const year = new Date().getFullYear().toString().slice(-2);
        const typeCode = certType === 'achievement' ? 'CA' : certType === 'participation' ? 'CP' : 'CC';
        
        // Count existing certificates with same prefix
        const existingCerts = await this.db.collection('certificates')
            .where('certificateId', '>=', `DBI-${programCode}-${year}-${typeCode}`)
            .where('certificateId', '<', `DBI-${programCode}-${year}-${typeCode}Z`)
            .get();
        const seq = existingCerts.size + 1;
        const certificateId = `DBI-${programCode}-${year}-${typeCode}${String(seq).padStart(3, '0')}`;

        // Student details
        const studentFirstName = this.currentUser.firstName || '';
        const studentLastName = this.currentUser.lastName || '';
        const studentEmail = this.currentUser.email || '';

        // Status based on lockOnGenerate
        const lockOnGenerate = certSettings.lockOnGenerate || false;
        const status = lockOnGenerate ? 'pending' : 'issued';
        const issuedAt = status === 'issued' ? firebase.firestore.FieldValue.serverTimestamp() : null;

        // Signatories (defaults)
        const signatory1 = 'executiveDirector';
        const signatory2 = 'departmentHead';
        const signatory3 = 'secretary';

        // Build certificate data
        const certData = {
            certificateId: certificateId,
            studentId: studentId,
            studentFirstName: studentFirstName,
            studentLastName: studentLastName,
            studentEmail: studentEmail,
            assessmentId: this.assessmentId,
            assessmentTitle: this.assessmentData.title || 'Untitled Assessment',
            department: department,
            type: certType,
            grade: grade,
            gradeClass: gradeClass,
            score: score,
            hasResult: true,
            status: status,
            issuedAt: issuedAt,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            template: certSettings.template || 'default',
            isTemplate: false,
            isManual: false,
            watermark: status === 'pending' ? 'PENDING' : null,
            isLocked: status === 'pending',
            signatory1: signatory1,
            signatory2: signatory2,
            signatory3: signatory3,
            programCode: programCode,
            resultDocId: resultDocId || null
        };

        // Save to Firestore
        await this.db.collection('certificates').add(certData);
        console.log(`✅ Certificate generated: ${certificateId} (${status})`);

        // Toast
        if (status === 'issued') {
            this.app.showToast(`🎉 Certificate earned! ID: ${certificateId}`, false);
        } else {
            this.app.showToast(`📜 Certificate generated (pending release). ID: ${certificateId}`, false);
        }

    } catch (error) {
        console.error('❌ Error in generateCertificateIfEligible:', error);
        throw error; // Re-throw so the caller can handle it
    }
},

    // ============================================================
    // GET PROGRAM CODE FROM DEPARTMENT
    // ============================================================

    getProgramCode(department) {
        const codes = {
            'Software Development': 'SD',
            'Graphics & Multimedia': 'GM',
            'Data Analysis': 'DA',
            'Digital Marketing': 'DM',
            'Cybersecurity': 'CS',
            'Network & Cloud': 'NC',
            'Digital Skills': 'DS',
            'General': 'GEN'
        };
        return codes[department] || 'GEN';
    },

    // ============================================================
    // AUTO SUBMIT
    // ============================================================

    async autoSubmit() {
        this.app.showToast('Time is up! Auto-submitting...', false, true);
        await this.submitAssessment();
    },

    // ============================================================
    // FILE UPLOAD
    // ============================================================

    uploadFile(questionIndex, input) {
        const file = input.files[0];
        if (!file) return;
        
        const maxSize = (this.shuffledQuestions[questionIndex].maxFileSize || 5) * 1024 * 1024;
        if (file.size > maxSize) {
            this.app.showToast(`File too large. Maximum ${this.shuffledQuestions[questionIndex].maxFileSize || 5} MB.`, true);
            input.value = '';
            return;
        }
        
        const fileName = file.name;
        this.answers[questionIndex] = fileName;
        this.updateQuestionStatus(questionIndex);
        
        const fileNameEl = document.getElementById('fileName');
        if (fileNameEl) fileNameEl.textContent = fileName;
        this.updateNavigator();
        this.autoSave();
        
        this.app.showToast(`File "${fileName}" uploaded successfully!`);
    },

    // ============================================================
    // EXIT CONFIRMATION
    // ============================================================

    confirmExit() {
        const modalBody = document.getElementById('modalBody');
        const modalFooter = document.getElementById('modalFooter');
        const modalTitle = document.getElementById('modalTitle');
        
        if (modalTitle) modalTitle.textContent = 'Exit Assessment';
        
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="text-align:center;padding:12px 0;">
                    <i class="fas fa-exclamation-triangle" style="font-size:48px;color:#d97706;"></i>
                    <h3 style="margin-top:12px;font-size:18px;font-weight:700;">Are you sure you want to exit?</h3>
                    <p style="color:#6b7280;font-size:14px;margin-top:4px;">
                        Your progress will be saved. You can resume later.
                    </p>
                    <p style="color:#6b7280;font-size:13px;margin-top:8px;">
                        <i class="fas fa-info-circle"></i> Attempt ${this.currentAttempt} will remain in progress
                    </p>
                </div>
            `;
        }
        
        if (modalFooter) {
            modalFooter.innerHTML = `
                <button class="btn-secondary" onclick="TakeAssessment.closeModal()" style="padding:10px 24px;min-height:44px;font-weight:600;border:1px solid #e5e7eb;background:#f3f4f6;color:#1a1f2c;border-radius:10px;cursor:pointer;transition:all 0.2s ease;">
                    Continue Assessment
                </button>
                <button class="btn-primary" onclick="TakeAssessment.exitAssessment()" style="padding:10px 28px;min-height:44px;font-weight:600;background:#dc2626;color:white;border:none;border-radius:10px;cursor:pointer;transition:all 0.2s ease;">
                    <i class="fas fa-sign-out-alt"></i> Exit
                </button>
            `;
        }
        
        this.openModal();
    },

    exitAssessment() {
        this.closeModal();
        this.autoSave();
        setTimeout(() => {
            window.location.href = 'assessments.html';
        }, 500);
    },

    // ============================================================
    // MODAL
    // ============================================================

    openModal() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    closeModal() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.remove('show');
        document.body.style.overflow = '';
    }
};

// ============================================================
// EXPORT FOR GLOBAL ACCESS
// ============================================================

window.TakeAssessment = TakeAssessment;