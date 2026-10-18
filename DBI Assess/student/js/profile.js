// ============================================================
// STUDENT PROFILE
// ============================================================

const Profile = {
    app: null,
    isEditing: false,

    // ============================================================
    // RENDER PROFILE
    // ============================================================

    render(container, app) {
        this.app = app;
        
        container.innerHTML = `
            <div class="profile-container">
                <!-- Profile Sidebar -->
                <div class="profile-sidebar">
                    <div class="profile-avatar-large" id="profileAvatarLarge">${this.app.currentUser.firstName?.charAt(0) || 'S'}</div>
                    <div class="profile-name-large" id="profileNameLarge">${this.app.escapeHtml(this.app.currentUser.firstName || 'Student')}</div>
                    <div class="profile-id-large" id="profileIdLarge">${this.app.currentUser.studentId || 'N/A'}</div>
                    <div class="profile-role-badge">🎓 Student</div>
                    
                    <hr class="profile-divider">
                    
                    <div class="profile-stat-item">
                        <span class="profile-stat-label"><i class="fas fa-file-alt" style="margin-right: 8px;"></i>Assessments</span>
                        <span class="profile-stat-value" id="profileAssessments">0</span>
                    </div>
                    <div class="profile-stat-item">
                        <span class="profile-stat-label"><i class="fas fa-check-circle" style="margin-right: 8px; color: #16a34a;"></i>Completed</span>
                        <span class="profile-stat-value" id="profileCompleted">0</span>
                    </div>
                    <div class="profile-stat-item">
                        <span class="profile-stat-label"><i class="fas fa-chart-line" style="margin-right: 8px; color: #d97706;"></i>Average Score</span>
                        <span class="profile-stat-value" id="profileAvgScore">0%</span>
                    </div>
                    <div class="profile-stat-item">
                        <span class="profile-stat-label"><i class="fas fa-calendar-alt" style="margin-right: 8px;"></i>Member Since</span>
                        <span class="profile-stat-value" id="profileMemberSince">N/A</span>
                    </div>
                </div>
                
                <!-- Profile Main Content -->
                <div class="profile-main">
                    <!-- Personal Information -->
                    <div class="profile-card">
                        <div class="profile-card-title">
                            <i class="fas fa-user"></i>
                            Personal Information
                        </div>
                        
                        <div class="form-group">
                            <label>Student ID</label>
                            <div class="form-value" id="displayStudentId">${this.app.currentUser.studentId || 'N/A'}</div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>First Name</label>
                                <input type="text" class="form-input" id="inputFirstName" value="${this.app.escapeHtml(this.app.currentUser.firstName || '')}" disabled>
                            </div>
                            <div class="form-group">
                                <label>Last Name</label>
                                <input type="text" class="form-input" id="inputLastName" value="${this.app.escapeHtml(this.app.currentUser.lastName || '')}" disabled>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" class="form-input" id="inputEmail" value="${this.app.escapeHtml(this.app.currentUser.email || '')}" disabled>
                        </div>
                        
                        <div class="form-group" id="editActions" style="display: none;">
                            <div class="profile-actions">
                                <button class="btn-save" onclick="Profile.saveProfile()">
                                    <i class="fas fa-save"></i> Save Changes
                                </button>
                                <button class="btn-cancel" onclick="Profile.cancelEdit()">
                                    <i class="fas fa-times"></i> Cancel
                                </button>
                            </div>
                        </div>
                        
                        <div class="form-group" id="viewActions">
                            <button class="btn-edit" onclick="Profile.enableEdit()">
                                <i class="fas fa-edit"></i> Edit Profile
                            </button>
                        </div>
                    </div>
                    
                    <!-- Account Actions -->
                    <div class="profile-card">
                        <div class="profile-card-title" style="color: #dc2626;">
                            <i class="fas fa-shield-alt"></i>
                            Account Actions
                        </div>
                        <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">
                            Manage your account settings and security.
                        </p>
                        <button class="btn-danger" onclick="Profile.changePassword()">
                            <i class="fas fa-key"></i> Change Password
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.loadProfileStats();
    },

    // ============================================================
    // LOAD PROFILE STATS
    // ============================================================

    async loadProfileStats() {
        try {
            const db = this.app.db;
            const studentId = this.app.currentUser.studentId;
            
            // Get results for stats
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
            
            // Get available assessments
            const assessmentsSnap = await db.collection('assessments')
                .where('status', '==', 'published')
                .get();
            
            document.getElementById('profileAssessments').textContent = assessmentsSnap.size;
            document.getElementById('profileCompleted').textContent = completed;
            document.getElementById('profileAvgScore').textContent = completed > 0 ? 
                Math.round(totalScore / completed) + '%' : '0%';
            
            // Get member since (using createdAt from user data)
            const memberSince = this.app.currentUser.createdAt;
            document.getElementById('profileMemberSince').textContent = this.app.formatDate(memberSince);

        } catch (error) {
            console.error('Error loading profile stats:', error);
        }
    },

    // ============================================================
    // EDIT PROFILE
    // ============================================================

    enableEdit() {
        this.isEditing = true;
        
        // Enable form inputs
        document.getElementById('inputFirstName').disabled = false;
        document.getElementById('inputLastName').disabled = false;
        document.getElementById('inputEmail').disabled = false;
        
        // Show/hide action buttons
        document.getElementById('viewActions').style.display = 'none';
        document.getElementById('editActions').style.display = 'block';
        
        // Focus on first name
        document.getElementById('inputFirstName').focus();
    },

    cancelEdit() {
        this.isEditing = false;
        
        // Reset form values
        const user = this.app.currentUser;
        document.getElementById('inputFirstName').value = user.firstName || '';
        document.getElementById('inputLastName').value = user.lastName || '';
        document.getElementById('inputEmail').value = user.email || '';
        
        // Disable form inputs
        document.getElementById('inputFirstName').disabled = true;
        document.getElementById('inputLastName').disabled = true;
        document.getElementById('inputEmail').disabled = true;
        
        // Show/hide action buttons
        document.getElementById('viewActions').style.display = 'block';
        document.getElementById('editActions').style.display = 'none';
    },

    async saveProfile() {
        try {
            const firstName = document.getElementById('inputFirstName').value.trim();
            const lastName = document.getElementById('inputLastName').value.trim();
            const email = document.getElementById('inputEmail').value.trim();
            
            // Validate
            if (!firstName) {
                this.app.showToast('First name is required', true);
                return;
            }
            
            if (!email || !email.includes('@')) {
                this.app.showToast('Please enter a valid email address', true);
                return;
            }
            
            // Update user data in Firestore
            const db = this.app.db;
            const studentId = this.app.currentUser.studentId;
            
            await db.collection('students').doc(studentId).update({
                firstName: firstName,
                lastName: lastName,
                email: email,
                updatedAt: new Date()
            });
            
            // Update session data
            const userData = sessionStorage.getItem('dbi_assess_user');
            if (userData) {
                const user = JSON.parse(userData);
                user.firstName = firstName;
                user.lastName = lastName;
                user.email = email;
                sessionStorage.setItem('dbi_assess_user', JSON.stringify(user));
                this.app.currentUser = user;
            }
            
            // Update UI
            document.getElementById('studentName').textContent = firstName;
            document.getElementById('studentAvatar').textContent = firstName.charAt(0).toUpperCase();
            document.getElementById('profileAvatarLarge').textContent = firstName.charAt(0).toUpperCase();
            document.getElementById('profileNameLarge').textContent = firstName;
            
            // Disable editing
            this.cancelEdit();
            
            this.app.showToast('Profile updated successfully!');
            
        } catch (error) {
            console.error('Error saving profile:', error);
            this.app.showToast('Error saving profile: ' + error.message, true);
        }
    },

    // ============================================================
    // CHANGE PASSWORD
    // ============================================================

    changePassword() {
        // In a real implementation, you would show a password change modal
        // or redirect to a password reset page
        this.app.showToast('Password change functionality coming soon!');
        console.log('Change password clicked');
        
        // You could redirect to a password reset page:
        // window.location.href = 'change-password.html';
    }
};