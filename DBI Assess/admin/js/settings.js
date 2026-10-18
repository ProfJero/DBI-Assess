// ============================================================
// ADMIN SETTINGS - COMPLETE SETTINGS MODULE
// ============================================================

const Settings = {
    app: null,
    db: null,
    currentTab: 'general',
    settings: {},

    // ============================================================
    // RENDER - Main entry point
    // ============================================================

    render(container, app) {
        this.app = app;
        this.db = app.db || app;
        
        container.innerHTML = this.getHTML();
        this.addStyles();
        
        setTimeout(() => {
            this.loadSettings();
            this.switchTab('general');
        }, 100);
    },

    // ============================================================
    // GET HTML
    // ============================================================

    getHTML() {
        return `
            <div class="settings-layout">
                <!-- Settings Sidebar -->
                <div class="settings-sidebar">
                    <div class="settings-nav">
                        <button class="active" data-tab="general" onclick="Settings.switchTab('general')">
                            <i class="fas fa-cog"></i> General
                        </button>
                        <button data-tab="assessment" onclick="Settings.switchTab('assessment')">
                            <i class="fas fa-file-alt"></i> Assessment
                        </button>
                        <button data-tab="security" onclick="Settings.switchTab('security')">
                            <i class="fas fa-shield-alt"></i> Security
                        </button>
                        <button data-tab="email" onclick="Settings.switchTab('email')">
                            <i class="fas fa-envelope"></i> Email
                        </button>
                        <button data-tab="appearance" onclick="Settings.switchTab('appearance')">
                            <i class="fas fa-palette"></i> Appearance
                        </button>
                        <button data-tab="integrations" onclick="Settings.switchTab('integrations')">
                            <i class="fas fa-plug"></i> Integrations
                        </button>
                        <button data-tab="advanced" onclick="Settings.switchTab('advanced')">
                            <i class="fas fa-code"></i> Advanced
                        </button>
                    </div>
                </div>

                <!-- Settings Content -->
                <div class="settings-content">
                    <!-- General Settings -->
                    <div class="settings-panel active" id="panel-general">
                        <div class="settings-card">
                            <div class="card-title">General Settings</div>
                            <div class="card-subtitle">Basic platform configuration</div>

                            <div class="form-group">
                                <label>Platform Name</label>
                                <input type="text" id="platformName" placeholder="DBI Assess" value="DBI Assess">
                                <div class="help-text"><i class="fas fa-info-circle"></i> This name appears throughout the platform</div>
                            </div>

                            <div class="form-group">
                                <label>Platform URL</label>
                                <input type="url" id="platformUrl" placeholder="https://dbi-assess.com">
                                <div class="help-text"><i class="fas fa-info-circle"></i> Your platform's base URL</div>
                            </div>

                            <div class="form-group">
                                <label>Default Language</label>
                                <select id="defaultLanguage">
                                    <option value="en">English</option>
                                    <option value="fr">French</option>
                                    <option value="es">Spanish</option>
                                    <option value="pt">Portuguese</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label>Default Timezone</label>
                                <select id="defaultTimezone">
                                    <option value="UTC">UTC</option>
                                    <option value="Africa/Accra">Africa/Accra (GMT)</option>
                                    <option value="America/New_York">America/New York (EST)</option>
                                    <option value="Europe/London">Europe/London (GMT)</option>
                                </select>
                            </div>

                            <button class="btn-primary" onclick="Settings.saveGeneral()">
                                <i class="fas fa-save"></i> Save General Settings
                            </button>
                        </div>
                    </div>

                    <!-- Assessment Settings -->
                    <div class="settings-panel" id="panel-assessment">
                        <div class="settings-card">
                            <div class="card-title">Assessment Settings</div>
                            <div class="card-subtitle">Configure assessment defaults and behavior</div>

                            <div class="form-group">
                                <label>Default Passing Score (%)</label>
                                <input type="number" id="defaultPassingScore" min="0" max="100" value="60">
                            </div>

                            <div class="form-group">
                                <label>Default Time Limit (minutes)</label>
                                <input type="number" id="defaultTimeLimit" min="0" value="30">
                                <div class="help-text"><i class="fas fa-info-circle"></i> 0 = No time limit</div>
                            </div>

                            <div class="form-group">
                                <label>Default Number of Attempts</label>
                                <input type="number" id="defaultAttempts" min="1" value="1">
                                <div class="help-text"><i class="fas fa-info-circle"></i> 0 = Unlimited</div>
                            </div>

                            <div class="checkbox-group">
                                <label><input type="checkbox" id="allowRetakes" checked> Allow Retakes</label>
                                <label><input type="checkbox" id="showCorrectAnswers" checked> Show Correct Answers</label>
                                <label><input type="checkbox" id="showFeedback" checked> Show Feedback</label>
                                <label><input type="checkbox" id="autoPublish"> Auto-Publish Assessments</label>
                            </div>

                            <button class="btn-primary" onclick="Settings.saveAssessment()">
                                <i class="fas fa-save"></i> Save Assessment Settings
                            </button>
                        </div>

                        <div class="settings-card">
                            <div class="card-title">Question Bank Settings</div>
                            <div class="card-subtitle">Configure question bank defaults</div>

                            <div class="form-group">
                                <label>Default Points per Question</label>
                                <input type="number" id="defaultQuestionPoints" min="1" value="1">
                            </div>

                            <div class="form-group">
                                <label>Default Question Difficulty</label>
                                <select id="defaultDifficulty">
                                    <option value="easy">Easy</option>
                                    <option value="medium" selected>Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>

                            <button class="btn-primary" onclick="Settings.saveQuestionBank()">
                                <i class="fas fa-save"></i> Save Question Bank Settings
                            </button>
                        </div>
                    </div>

                    <!-- Security Settings -->
                    <div class="settings-panel" id="panel-security">
                        <div class="settings-card">
                            <div class="card-title">Security Settings</div>
                            <div class="card-subtitle">Configure platform security</div>

                            <div class="checkbox-group">
                                <label><input type="checkbox" id="requireStrongPassword" checked> Require Strong Password</label>
                                <label><input type="checkbox" id="enableTwoFactor"> Enable Two-Factor Authentication</label>
                                <label><input type="checkbox" id="sessionTimeout" checked> Session Timeout (30 min)</label>
                                <label><input type="checkbox" id="ipRestriction"> IP Restriction</label>
                            </div>

                            <div class="form-group">
                                <label>Session Timeout (minutes)</label>
                                <input type="number" id="sessionTimeoutMinutes" min="5" max="120" value="30">
                            </div>

                            <div class="form-group">
                                <label>Max Login Attempts</label>
                                <input type="number" id="maxLoginAttempts" min="3" max="10" value="5">
                            </div>

                            <button class="btn-primary" onclick="Settings.saveSecurity()">
                                <i class="fas fa-save"></i> Save Security Settings
                            </button>
                        </div>

                        <div class="settings-card">
                            <div class="card-title">Anti-Cheating Defaults</div>
                            <div class="card-subtitle">Default anti-cheating settings for assessments</div>

                            <div class="checkbox-group">
                                <label><input type="checkbox" id="defaultDisableCopy" checked> Disable Copy</label>
                                <label><input type="checkbox" id="defaultDisablePaste" checked> Disable Paste</label>
                                <label><input type="checkbox" id="defaultDisableRightClick" checked> Disable Right Click</label>
                                <label><input type="checkbox" id="defaultDisableSelection" checked> Disable Text Selection</label>
                                <label><input type="checkbox" id="defaultMonitorTabs"> Monitor Tab Switching</label>
                                <label><input type="checkbox" id="defaultFullScreen"> Force Full Screen</label>
                            </div>

                            <div class="form-group">
                                <label>Default Warnings Before Submit</label>
                                <input type="number" id="defaultWarnings" min="1" max="5" value="3">
                            </div>

                            <button class="btn-primary" onclick="Settings.saveAntiCheat()">
                                <i class="fas fa-save"></i> Save Anti-Cheating Settings
                            </button>
                        </div>
                    </div>

                    <!-- Email Settings -->
                    <div class="settings-panel" id="panel-email">
                        <div class="settings-card">
                            <div class="card-title">Email Settings</div>
                            <div class="card-subtitle">Configure email notifications</div>

                            <div class="form-group">
                                <label>SMTP Host</label>
                                <input type="text" id="smtpHost" placeholder="smtp.gmail.com">
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label>SMTP Port</label>
                                    <input type="number" id="smtpPort" placeholder="587">
                                </div>
                                <div class="form-group">
                                    <label>SMTP Encryption</label>
                                    <select id="smtpEncryption">
                                        <option value="tls">TLS</option>
                                        <option value="ssl">SSL</option>
                                        <option value="none">None</option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>SMTP Username</label>
                                <input type="text" id="smtpUsername" placeholder="your-email@gmail.com">
                            </div>

                            <div class="form-group">
                                <label>SMTP Password</label>
                                <input type="password" id="smtpPassword" placeholder="••••••••">
                            </div>

                            <div class="form-group">
                                <label>From Email</label>
                                <input type="email" id="fromEmail" placeholder="noreply@dbi-assess.com">
                            </div>

                            <div class="form-group">
                                <label>From Name</label>
                                <input type="text" id="fromName" placeholder="DBI Assess">
                            </div>

                            <div class="checkbox-group">
                                <label><input type="checkbox" id="sendWelcomeEmail" checked> Send Welcome Email</label>
                                <label><input type="checkbox" id="sendResultEmail" checked> Send Result Notification</label>
                                <label><input type="checkbox" id="sendReminderEmail"> Send Assessment Reminders</label>
                            </div>

                            <button class="btn-primary" onclick="Settings.saveEmail()">
                                <i class="fas fa-save"></i> Save Email Settings
                            </button>
                        </div>
                    </div>

                    <!-- Appearance Settings -->
                    <div class="settings-panel" id="panel-appearance">
                        <div class="settings-card">
                            <div class="card-title">Appearance Settings</div>
                            <div class="card-subtitle">Customize the platform look and feel</div>

                            <div class="form-group">
                                <label>Primary Color</label>
                                <div style="display: flex; gap: 10px; align-items: center;">
                                    <input type="color" id="primaryColor" value="#166534">
                                    <input type="text" id="primaryColorHex" value="#166534" style="flex: 1; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-family: monospace;">
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Secondary Color</label>
                                <div style="display: flex; gap: 10px; align-items: center;">
                                    <input type="color" id="secondaryColor" value="#22c55e">
                                    <input type="text" id="secondaryColorHex" value="#22c55e" style="flex: 1; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-family: monospace;">
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Logo URL</label>
                                <input type="url" id="logoUrl" placeholder="https://example.com/logo.png">
                            </div>

                            <div class="form-group">
                                <label>Favicon URL</label>
                                <input type="url" id="faviconUrl" placeholder="https://example.com/favicon.ico">
                            </div>

                            <div class="checkbox-group">
                                <label><input type="checkbox" id="darkMode"> Dark Mode</label>
                                <label><input type="checkbox" id="compactMode"> Compact Mode</label>
                                <label><input type="checkbox" id="animations" checked> Animations</label>
                            </div>

                            <button class="btn-primary" onclick="Settings.saveAppearance()">
                                <i class="fas fa-save"></i> Save Appearance Settings
                            </button>
                        </div>
                    </div>

                    <!-- Integrations Settings -->
                    <div class="settings-panel" id="panel-integrations">
                        <div class="settings-card">
                            <div class="card-title">Integrations</div>
                            <div class="card-subtitle">Connect with external services</div>

                            <div class="form-group">
                                <label>Google Analytics ID</label>
                                <input type="text" id="gaId" placeholder="UA-XXXXXXXXX-X">
                                <div class="help-text"><i class="fas fa-info-circle"></i> Your Google Analytics tracking ID</div>
                            </div>

                            <div class="form-group">
                                <label>Facebook Pixel ID</label>
                                <input type="text" id="fbPixelId" placeholder="XXXXXXXXX">
                            </div>

                            <div class="form-group">
                                <label>Zapier Webhook URL</label>
                                <input type="url" id="zapierWebhook" placeholder="https://hooks.zapier.com/...">
                            </div>

                            <div class="form-group">
                                <label>Discord Webhook URL</label>
                                <input type="url" id="discordWebhook" placeholder="https://discord.com/api/webhooks/...">
                            </div>

                            <button class="btn-primary" onclick="Settings.saveIntegrations()">
                                <i class="fas fa-save"></i> Save Integrations
                            </button>
                        </div>
                    </div>

                    <!-- Advanced Settings -->
                    <div class="settings-panel" id="panel-advanced">
                        <div class="settings-card">
                            <div class="card-title">Advanced Settings</div>
                            <div class="card-subtitle">System-level configurations</div>

                            <div class="form-group">
                                <label>API Rate Limit (requests per minute)</label>
                                <input type="number" id="rateLimit" min="10" max="1000" value="60">
                            </div>

                            <div class="form-group">
                                <label>Max File Upload Size (MB)</label>
                                <input type="number" id="maxFileSize" min="1" max="100" value="10">
                            </div>

                            <div class="form-group">
                                <label>Cache Duration (minutes)</label>
                                <input type="number" id="cacheDuration" min="1" max="1440" value="60">
                            </div>

                            <div class="checkbox-group">
                                <label><input type="checkbox" id="debugMode"> Enable Debug Mode</label>
                                <label><input type="checkbox" id="maintenanceMode"> Maintenance Mode</label>
                                <label><input type="checkbox" id="logRequests"> Log API Requests</label>
                            </div>

                            <button class="btn-primary" onclick="Settings.saveAdvanced()">
                                <i class="fas fa-save"></i> Save Advanced Settings
                            </button>
                        </div>

                        <div class="settings-card">
                            <div class="card-title">Danger Zone</div>
                            <div class="card-subtitle">Irreversible actions</div>

                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <button class="btn-danger" onclick="Settings.clearCache()">
                                    <i class="fas fa-trash"></i> Clear Cache
                                </button>
                                <button class="btn-danger" onclick="Settings.resetAllSettings()">
                                    <i class="fas fa-undo"></i> Reset All Settings
                                </button>
                                <button class="btn-danger" onclick="Settings.exportAllData()">
                                    <i class="fas fa-download"></i> Export All Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // ============================================================
    // ADD STYLES
    // ============================================================

    addStyles() {
        if (document.getElementById('settingsStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'settingsStyles';
        style.textContent = `
            .settings-panel {
                display: none;
                animation: fadeIn 0.3s ease;
            }
            .settings-panel.active {
                display: block;
            }
            .settings-sidebar .settings-nav button {
                transition: all 0.2s ease;
            }
            .settings-sidebar .settings-nav button i {
                transition: color 0.2s ease;
            }
        `;
        document.head.appendChild(style);
    },

    // ============================================================
    // SWITCH TAB
    // ============================================================

    switchTab(tab) {
        this.currentTab = tab;
        
        // Update sidebar buttons
        document.querySelectorAll('.settings-nav button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        // Update panels
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${tab}`);
        });
    },

    // ============================================================
    // LOAD SETTINGS
    // ============================================================

    async loadSettings() {
        try {
            const doc = await this.db.collection('settings').doc('platformSettings').get();
            
            if (doc.exists) {
                this.settings = doc.data();
                this.populateSettings();
                console.log('✅ Settings loaded successfully');
            } else {
                console.log('📝 No settings found, using defaults');
                this.settings = {};
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    },

    // ============================================================
    // POPULATE SETTINGS
    // ============================================================

    populateSettings() {
        const settings = this.settings;
        
        // General
        if (settings.platformName) document.getElementById('platformName').value = settings.platformName;
        if (settings.platformUrl) document.getElementById('platformUrl').value = settings.platformUrl;
        if (settings.defaultLanguage) document.getElementById('defaultLanguage').value = settings.defaultLanguage;
        if (settings.defaultTimezone) document.getElementById('defaultTimezone').value = settings.defaultTimezone;
        
        // Assessment
        if (settings.defaultPassingScore) document.getElementById('defaultPassingScore').value = settings.defaultPassingScore;
        if (settings.defaultTimeLimit) document.getElementById('defaultTimeLimit').value = settings.defaultTimeLimit;
        if (settings.defaultAttempts) document.getElementById('defaultAttempts').value = settings.defaultAttempts;
        if (settings.allowRetakes !== undefined) document.getElementById('allowRetakes').checked = settings.allowRetakes;
        if (settings.showCorrectAnswers !== undefined) document.getElementById('showCorrectAnswers').checked = settings.showCorrectAnswers;
        if (settings.showFeedback !== undefined) document.getElementById('showFeedback').checked = settings.showFeedback;
        if (settings.autoPublish !== undefined) document.getElementById('autoPublish').checked = settings.autoPublish;
        
        // Question Bank
        if (settings.defaultQuestionPoints) document.getElementById('defaultQuestionPoints').value = settings.defaultQuestionPoints;
        if (settings.defaultDifficulty) document.getElementById('defaultDifficulty').value = settings.defaultDifficulty;
        
        // Security
        if (settings.requireStrongPassword !== undefined) document.getElementById('requireStrongPassword').checked = settings.requireStrongPassword;
        if (settings.enableTwoFactor !== undefined) document.getElementById('enableTwoFactor').checked = settings.enableTwoFactor;
        if (settings.sessionTimeout !== undefined) document.getElementById('sessionTimeout').checked = settings.sessionTimeout;
        if (settings.ipRestriction !== undefined) document.getElementById('ipRestriction').checked = settings.ipRestriction;
        if (settings.sessionTimeoutMinutes) document.getElementById('sessionTimeoutMinutes').value = settings.sessionTimeoutMinutes;
        if (settings.maxLoginAttempts) document.getElementById('maxLoginAttempts').value = settings.maxLoginAttempts;
        
        // Anti-Cheat
        if (settings.defaultDisableCopy !== undefined) document.getElementById('defaultDisableCopy').checked = settings.defaultDisableCopy;
        if (settings.defaultDisablePaste !== undefined) document.getElementById('defaultDisablePaste').checked = settings.defaultDisablePaste;
        if (settings.defaultDisableRightClick !== undefined) document.getElementById('defaultDisableRightClick').checked = settings.defaultDisableRightClick;
        if (settings.defaultDisableSelection !== undefined) document.getElementById('defaultDisableSelection').checked = settings.defaultDisableSelection;
        if (settings.defaultMonitorTabs !== undefined) document.getElementById('defaultMonitorTabs').checked = settings.defaultMonitorTabs;
        if (settings.defaultFullScreen !== undefined) document.getElementById('defaultFullScreen').checked = settings.defaultFullScreen;
        if (settings.defaultWarnings) document.getElementById('defaultWarnings').value = settings.defaultWarnings;
        
        // Email
        if (settings.smtpHost) document.getElementById('smtpHost').value = settings.smtpHost;
        if (settings.smtpPort) document.getElementById('smtpPort').value = settings.smtpPort;
        if (settings.smtpEncryption) document.getElementById('smtpEncryption').value = settings.smtpEncryption;
        if (settings.smtpUsername) document.getElementById('smtpUsername').value = settings.smtpUsername;
        if (settings.fromEmail) document.getElementById('fromEmail').value = settings.fromEmail;
        if (settings.fromName) document.getElementById('fromName').value = settings.fromName;
        if (settings.sendWelcomeEmail !== undefined) document.getElementById('sendWelcomeEmail').checked = settings.sendWelcomeEmail;
        if (settings.sendResultEmail !== undefined) document.getElementById('sendResultEmail').checked = settings.sendResultEmail;
        if (settings.sendReminderEmail !== undefined) document.getElementById('sendReminderEmail').checked = settings.sendReminderEmail;
        
        // Appearance
        if (settings.primaryColor) {
            document.getElementById('primaryColor').value = settings.primaryColor;
            document.getElementById('primaryColorHex').value = settings.primaryColor;
        }
        if (settings.secondaryColor) {
            document.getElementById('secondaryColor').value = settings.secondaryColor;
            document.getElementById('secondaryColorHex').value = settings.secondaryColor;
        }
        if (settings.logoUrl) document.getElementById('logoUrl').value = settings.logoUrl;
        if (settings.faviconUrl) document.getElementById('faviconUrl').value = settings.faviconUrl;
        if (settings.darkMode !== undefined) document.getElementById('darkMode').checked = settings.darkMode;
        if (settings.compactMode !== undefined) document.getElementById('compactMode').checked = settings.compactMode;
        if (settings.animations !== undefined) document.getElementById('animations').checked = settings.animations;
        
        // Integrations
        if (settings.gaId) document.getElementById('gaId').value = settings.gaId;
        if (settings.fbPixelId) document.getElementById('fbPixelId').value = settings.fbPixelId;
        if (settings.zapierWebhook) document.getElementById('zapierWebhook').value = settings.zapierWebhook;
        if (settings.discordWebhook) document.getElementById('discordWebhook').value = settings.discordWebhook;
        
        // Advanced
        if (settings.rateLimit) document.getElementById('rateLimit').value = settings.rateLimit;
        if (settings.maxFileSize) document.getElementById('maxFileSize').value = settings.maxFileSize;
        if (settings.cacheDuration) document.getElementById('cacheDuration').value = settings.cacheDuration;
        if (settings.debugMode !== undefined) document.getElementById('debugMode').checked = settings.debugMode;
        if (settings.maintenanceMode !== undefined) document.getElementById('maintenanceMode').checked = settings.maintenanceMode;
        if (settings.logRequests !== undefined) document.getElementById('logRequests').checked = settings.logRequests;
    },

    // ============================================================
    // SAVE GENERAL SETTINGS
    // ============================================================

    async saveGeneral() {
        try {
            const data = {
                platformName: document.getElementById('platformName').value.trim(),
                platformUrl: document.getElementById('platformUrl').value.trim(),
                defaultLanguage: document.getElementById('defaultLanguage').value,
                defaultTimezone: document.getElementById('defaultTimezone').value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('settings').doc('platformSettings').set(data, { merge: true });
            this.settings = { ...this.settings, ...data };
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('General settings saved successfully!');
            }
        } catch (error) {
            console.error('Error saving general settings:', error);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error saving general settings: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // SAVE ASSESSMENT SETTINGS
    // ============================================================

    async saveAssessment() {
        try {
            const data = {
                defaultPassingScore: parseInt(document.getElementById('defaultPassingScore').value) || 60,
                defaultTimeLimit: parseInt(document.getElementById('defaultTimeLimit').value) || 30,
                defaultAttempts: parseInt(document.getElementById('defaultAttempts').value) || 1,
                allowRetakes: document.getElementById('allowRetakes').checked,
                showCorrectAnswers: document.getElementById('showCorrectAnswers').checked,
                showFeedback: document.getElementById('showFeedback').checked,
                autoPublish: document.getElementById('autoPublish').checked,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('settings').doc('platformSettings').set(data, { merge: true });
            this.settings = { ...this.settings, ...data };
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Assessment settings saved successfully!');
            }
        } catch (error) {
            console.error('Error saving assessment settings:', error);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error saving assessment settings: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // SAVE QUESTION BANK SETTINGS
    // ============================================================

    async saveQuestionBank() {
        try {
            const data = {
                defaultQuestionPoints: parseInt(document.getElementById('defaultQuestionPoints').value) || 1,
                defaultDifficulty: document.getElementById('defaultDifficulty').value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('settings').doc('platformSettings').set(data, { merge: true });
            this.settings = { ...this.settings, ...data };
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Question bank settings saved successfully!');
            }
        } catch (error) {
            console.error('Error saving question bank settings:', error);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error saving question bank settings: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // SAVE SECURITY SETTINGS
    // ============================================================

    async saveSecurity() {
        try {
            const data = {
                requireStrongPassword: document.getElementById('requireStrongPassword').checked,
                enableTwoFactor: document.getElementById('enableTwoFactor').checked,
                sessionTimeout: document.getElementById('sessionTimeout').checked,
                ipRestriction: document.getElementById('ipRestriction').checked,
                sessionTimeoutMinutes: parseInt(document.getElementById('sessionTimeoutMinutes').value) || 30,
                maxLoginAttempts: parseInt(document.getElementById('maxLoginAttempts').value) || 5,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('settings').doc('platformSettings').set(data, { merge: true });
            this.settings = { ...this.settings, ...data };
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Security settings saved successfully!');
            }
        } catch (error) {
            console.error('Error saving security settings:', error);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error saving security settings: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // SAVE ANTI-CHEAT SETTINGS
    // ============================================================

    async saveAntiCheat() {
        try {
            const data = {
                defaultDisableCopy: document.getElementById('defaultDisableCopy').checked,
                defaultDisablePaste: document.getElementById('defaultDisablePaste').checked,
                defaultDisableRightClick: document.getElementById('defaultDisableRightClick').checked,
                defaultDisableSelection: document.getElementById('defaultDisableSelection').checked,
                defaultMonitorTabs: document.getElementById('defaultMonitorTabs').checked,
                defaultFullScreen: document.getElementById('defaultFullScreen').checked,
                defaultWarnings: parseInt(document.getElementById('defaultWarnings').value) || 3,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('settings').doc('platformSettings').set(data, { merge: true });
            this.settings = { ...this.settings, ...data };
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Anti-cheating settings saved successfully!');
            }
        } catch (error) {
            console.error('Error saving anti-cheating settings:', error);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error saving anti-cheating settings: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // SAVE EMAIL SETTINGS
    // ============================================================

    async saveEmail() {
        try {
            const data = {
                smtpHost: document.getElementById('smtpHost').value.trim(),
                smtpPort: parseInt(document.getElementById('smtpPort').value) || 587,
                smtpEncryption: document.getElementById('smtpEncryption').value,
                smtpUsername: document.getElementById('smtpUsername').value.trim(),
                smtpPassword: document.getElementById('smtpPassword').value.trim(),
                fromEmail: document.getElementById('fromEmail').value.trim(),
                fromName: document.getElementById('fromName').value.trim(),
                sendWelcomeEmail: document.getElementById('sendWelcomeEmail').checked,
                sendResultEmail: document.getElementById('sendResultEmail').checked,
                sendReminderEmail: document.getElementById('sendReminderEmail').checked,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('settings').doc('platformSettings').set(data, { merge: true });
            this.settings = { ...this.settings, ...data };
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Email settings saved successfully!');
            }
        } catch (error) {
            console.error('Error saving email settings:', error);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error saving email settings: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // SAVE APPEARANCE SETTINGS
    // ============================================================

    async saveAppearance() {
        try {
            const data = {
                primaryColor: document.getElementById('primaryColor').value,
                secondaryColor: document.getElementById('secondaryColor').value,
                logoUrl: document.getElementById('logoUrl').value.trim(),
                faviconUrl: document.getElementById('faviconUrl').value.trim(),
                darkMode: document.getElementById('darkMode').checked,
                compactMode: document.getElementById('compactMode').checked,
                animations: document.getElementById('animations').checked,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('settings').doc('platformSettings').set(data, { merge: true });
            this.settings = { ...this.settings, ...data };
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Appearance settings saved successfully!');
            }
        } catch (error) {
            console.error('Error saving appearance settings:', error);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error saving appearance settings: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // SAVE INTEGRATIONS SETTINGS
    // ============================================================

    async saveIntegrations() {
        try {
            const data = {
                gaId: document.getElementById('gaId').value.trim(),
                fbPixelId: document.getElementById('fbPixelId').value.trim(),
                zapierWebhook: document.getElementById('zapierWebhook').value.trim(),
                discordWebhook: document.getElementById('discordWebhook').value.trim(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('settings').doc('platformSettings').set(data, { merge: true });
            this.settings = { ...this.settings, ...data };
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Integrations settings saved successfully!');
            }
        } catch (error) {
            console.error('Error saving integrations settings:', error);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error saving integrations settings: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // SAVE ADVANCED SETTINGS
    // ============================================================

    async saveAdvanced() {
        try {
            const data = {
                rateLimit: parseInt(document.getElementById('rateLimit').value) || 60,
                maxFileSize: parseInt(document.getElementById('maxFileSize').value) || 10,
                cacheDuration: parseInt(document.getElementById('cacheDuration').value) || 60,
                debugMode: document.getElementById('debugMode').checked,
                maintenanceMode: document.getElementById('maintenanceMode').checked,
                logRequests: document.getElementById('logRequests').checked,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('settings').doc('platformSettings').set(data, { merge: true });
            this.settings = { ...this.settings, ...data };
            
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Advanced settings saved successfully!');
            }
        } catch (error) {
            console.error('Error saving advanced settings:', error);
            if (typeof window !== 'undefined' && window.showToast) {
                window.showToast('Error saving advanced settings: ' + error.message, true);
            }
        }
    },

    // ============================================================
    // DANGER ZONE ACTIONS
    // ============================================================

    clearCache() {
        if (!confirm('Are you sure you want to clear all cache? This may affect performance temporarily.')) return;
        
        // Clear localStorage cache
        localStorage.clear();
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        if (typeof window !== 'undefined' && window.showToast) {
            window.showToast('Cache cleared successfully!');
        }
    },

    resetAllSettings() {
        if (!confirm('⚠️ Are you sure you want to reset ALL settings to default? This action cannot be undone.')) return;
        if (!confirm('Really? All your custom settings will be lost.')) return;
        
        // Reset settings document
        this.db.collection('settings').doc('platformSettings').delete()
            .then(() => {
                if (typeof window !== 'undefined' && window.showToast) {
                    window.showToast('All settings have been reset to default.');
                }
                // Reload page to reflect changes
                setTimeout(() => location.reload(), 1500);
            })
            .catch(error => {
                console.error('Error resetting settings:', error);
                if (typeof window !== 'undefined' && window.showToast) {
                    window.showToast('Error resetting settings: ' + error.message, true);
                }
            });
    },

    exportAllData() {
        if (!confirm('Export all platform data? This will create a backup file.')) return;
        
        // Collect all collections
        const collections = ['assessments', 'questions', 'users', 'studentResults', 'settings'];
        const exportData = {};
        let completed = 0;
        
        collections.forEach(collection => {
            this.db.collection(collection).get()
                .then(snapshot => {
                    exportData[collection] = [];
                    snapshot.forEach(doc => {
                        exportData[collection].push({ id: doc.id, ...doc.data() });
                    });
                    completed++;
                    
                    if (completed === collections.length) {
                        // All collections loaded, create download
                        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `dbi_assess_backup_${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        
                        if (typeof window !== 'undefined' && window.showToast) {
                            window.showToast('Data exported successfully!');
                        }
                    }
                })
                .catch(error => {
                    console.error(`Error exporting ${collection}:`, error);
                    completed++;
                    if (completed === collections.length && typeof window !== 'undefined' && window.showToast) {
                        window.showToast('Some data could not be exported. Check console for details.', true);
                    }
                });
        });
    }
};

// ============================================================
// EXPORT FOR GLOBAL ACCESS
// ============================================================

window.Settings = Settings;