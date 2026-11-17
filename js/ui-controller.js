/**
 * THE MENTOR - UI Controller
 * Manages all user interface interactions and updates
 */

export class UIController {
    constructor() {
        this.elements = {};
        this.state = {
            theme: 'dark',
            sidebarCollapsed: false,
            resultsCollapsed: false,
            activeViewMode: 'quad',
            activeTool: 'rotate',
            isFileLoaded: false,
            isAnalyzing: false
        };
        
        this.consoleMessages = [];
        this.chart = null;
    }

    /**
     * Initialize UI controller
     */
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.loadSettings();
        this.updateTime();
        this.initSidebarToggle(); 
        // Start time updater
        setInterval(() => this.updateTime(), 1000);
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements = {
            // Loading
            loadingOverlay: document.getElementById('loading-overlay'),
            loadingStatus: document.getElementById('loading-status'),
            loadingProgress: document.getElementById('loading-progress'),
            
            // Header
            themeToggle: document.getElementById('theme-toggle'),
            fullscreenBtn: document.getElementById('fullscreen-btn'),
            settingsBtn: document.getElementById('settings-btn'),
            helpBtn: document.getElementById('help-btn'),
            patientInfo: document.getElementById('patient-info'),
            
            // Sidebar
            sidebar: document.getElementById('sidebar'),
            sidebarToggle: document.getElementById('sidebar-toggle'),
            dropZone: document.getElementById('drop-zone'),
            fileInput: document.getElementById('file-input'),
            openFileBtn: document.getElementById('open-file-btn'),
            fileInfo: document.getElementById('file-info'),
            fileName: document.getElementById('file-name'),
            fileSize: document.getElementById('file-size'),
            fileDimensions: document.getElementById('file-dimensions'),
            voxelSize: document.getElementById('voxel-size'),
            recentFilesList: document.getElementById('recent-files-list'),
            
            // View controls
            presetBtns: document.querySelectorAll('.preset-btn'),
            zoomSlider: document.getElementById('zoom-slider'),
            zoomIn: document.getElementById('zoom-in'),
            zoomOut: document.getElementById('zoom-out'),
            resetViewBtn: document.getElementById('reset-view'),
            
            // Slice controls
            axialSlider: document.getElementById('axial-slider'),
            coronalSlider: document.getElementById('coronal-slider'),
            sagittalSlider: document.getElementById('sagittal-slider'),
            axialValue: document.getElementById('axial-value'),
            coronalValue: document.getElementById('coronal-value'),
            sagittalValue: document.getElementById('sagittal-value'),
            crosshairToggle: document.getElementById('crosshair-toggle'),
            syncSlices: document.getElementById('sync-slices'),
            
            // Visualization
            windowSlider: document.getElementById('window-slider'),
            levelSlider: document.getElementById('level-slider'),
            windowValue: document.getElementById('window-value'),
            levelValue: document.getElementById('level-value'),
            opacitySlider: document.getElementById('opacity-slider'),
            colorScheme: document.getElementById('color-scheme'),
            anomalyHighlight: document.getElementById('anomaly-highlight'),
            
            // AI Analysis
            modelStatus: document.getElementById('model-status'),
            modelSelect: document.getElementById('model-select'),
            confidenceThreshold: document.getElementById('confidence-threshold'),
            thresholdValue: document.getElementById('threshold-value'),
            analyzeBtn: document.getElementById('analyze-btn'),
            analysisProgress: document.getElementById('analysis-progress'),
            analysisProgressFill: document.getElementById('analysis-progress-fill'),
            analysisStatus: document.getElementById('analysis-status'),
            
            // Tools
            toolBtns: document.querySelectorAll('.tool-btn'),
            measurementItems: document.getElementById('measurement-items'),
            
            // Viewer
            viewerContainer: document.getElementById('viewer-container'),
            viewerGrid: document.getElementById('viewer-grid'),
            viewerEmpty: document.getElementById('viewer-empty'),
            viewerToolbar: document.getElementById('viewer-toolbar'),
            viewTabs: document.querySelectorAll('.view-tab'),
            toolbarBtns: document.querySelectorAll('.toolbar-btn'),
            emptyOpenBtn: document.getElementById('empty-open-btn'),
            
            // Results
            resultsPanel: document.getElementById('results-panel'),
            toggleResults: document.getElementById('toggle-results'),
            statusCard: document.getElementById('status-card'),
            quickStats: document.getElementById('quick-stats'),
            statConfidence: document.getElementById('stat-confidence'),
            statAnomaly: document.getElementById('stat-anomaly'),
            statTime: document.getElementById('stat-time'),
            resultsDetails: document.getElementById('results-details'),
            anomaliesList: document.getElementById('anomalies-list'),
            metricsSection: document.getElementById('metrics-section'),
            metricsChart: document.getElementById('metrics-chart'),
            metricsDetails: document.getElementById('metrics-details'),
            recommendationsSection: document.getElementById('recommendations-section'),
            recommendationsList: document.getElementById('recommendations-list'),
            consoleOutput: document.getElementById('console-output'),
            clearConsole: document.getElementById('clear-console'),
            exportPdf: document.getElementById('export-pdf'),
            exportJson: document.getElementById('export-json'),
            
            // Footer
            memoryUsage: document.getElementById('memory-usage'),
            gpuStatus: document.getElementById('gpu-status'),
            cursorPosition: document.getElementById('cursor-position'),
            
            // Modals
            settingsModal: document.getElementById('settings-modal'),
            closeSettings: document.getElementById('close-settings'),
            helpModal: document.getElementById('help-modal'),
            closeHelp: document.getElementById('close-help'),
            helpTabs: document.querySelectorAll('.help-tab'),
            
            // Toast
            toastContainer: document.getElementById('toast-container')
        };
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Theme toggle
        this.elements.themeToggle?.addEventListener('click', () => this.toggleTheme());
        
        // Fullscreen
        this.elements.fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen());
        
        // Sidebar toggle
        this.elements.sidebarToggle?.addEventListener('click', () => this.toggleSidebar());
        
        // Results panel toggle
        this.elements.toggleResults?.addEventListener('click', () => this.toggleResults());
        
        // Collapsible sections
        document.querySelectorAll('.section-header.collapsible').forEach(header => {
            header.addEventListener('click', () => this.toggleSection(header));
        });
        
        // View tabs
        this.elements.viewTabs?.forEach(tab => {
            tab.addEventListener('click', () => this.setViewMode(tab.dataset.mode));
        });
        
        // Preset view buttons
        this.elements.presetBtns?.forEach(btn => {
            btn.addEventListener('click', () => this.setPresetView(btn.dataset.view));
        });
        
        // Toolbar buttons
        this.elements.toolbarBtns?.forEach(btn => {
            btn.addEventListener('click', () => this.setActiveTool(btn.id.replace('tb-', '')));
        });
        
        // Tool buttons
        this.elements.toolBtns?.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.id.replace('tool-', '');
                this.handleToolAction(tool);
            });
        });
        
        // Zoom controls
        this.elements.zoomIn?.addEventListener('click', () => this.adjustZoom(0.1));
        this.elements.zoomOut?.addEventListener('click', () => this.adjustZoom(-0.1));
        this.elements.zoomSlider?.addEventListener('input', (e) => {
            this.onZoomChange?.(parseFloat(e.target.value));
        });
        
        // Slice sliders
        ['axial', 'coronal', 'sagittal'].forEach(axis => {
            const slider = this.elements[`${axis}Slider`];
            slider?.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.elements[`${axis}Value`].textContent = value;
                this.onSliceChange?.(axis, value / 100);
            });
        });
        
        // Window/Level
        this.elements.windowSlider?.addEventListener('input', (e) => {
            this.elements.windowValue.textContent = e.target.value;
            this.onWindowLevelChange?.();
        });
        this.elements.levelSlider?.addEventListener('input', (e) => {
            this.elements.levelValue.textContent = e.target.value;
            this.onWindowLevelChange?.();
        });
        
        // Opacity
        this.elements.opacitySlider?.addEventListener('input', (e) => {
            this.onOpacityChange?.(parseFloat(e.target.value));
        });
        
        // Color scheme
        this.elements.colorScheme?.addEventListener('change', (e) => {
            this.onColorSchemeChange?.(e.target.value);
        });
        
        // Crosshairs
        this.elements.crosshairToggle?.addEventListener('change', (e) => {
            this.onCrosshairsToggle?.(e.target.checked);
        });
        
        // Confidence threshold
        this.elements.confidenceThreshold?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.elements.thresholdValue.textContent = `${Math.round(value * 100)}%`;
            this.onThresholdChange?.(value);
        });
        
        // Empty state open button
        this.elements.emptyOpenBtn?.addEventListener('click', () => {
            this.elements.fileInput?.click();
        });
        
        // Console clear
        this.elements.clearConsole?.addEventListener('click', () => this.clearConsole());
        
        // Export buttons
        this.elements.exportPdf?.addEventListener('click', () => this.onExport?.('pdf'));
        this.elements.exportJson?.addEventListener('click', () => this.onExport?.('json'));
        
        // Settings modal
        this.elements.settingsBtn?.addEventListener('click', () => this.showModal('settings'));
        this.elements.closeSettings?.addEventListener('click', () => this.hideModal('settings'));
        
        // Help modal
        this.elements.helpBtn?.addEventListener('click', () => this.showModal('help'));
        this.elements.closeHelp?.addEventListener('click', () => this.hideModal('help'));
        
        // Help tabs
        this.elements.helpTabs?.forEach(tab => {
            tab.addEventListener('click', () => this.switchHelpTab(tab.dataset.tab));
        });
        
        // Modal overlays
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', () => {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    /**
     * Load saved settings
     */
    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('thementor_settings') || '{}');
            
            if (settings.theme) {
                this.setTheme(settings.theme);
            }
        } catch (e) {
            console.warn('Could not load settings:', e);
        }
    }

    /**
     * Save settings
     */
    saveSettings() {
        try {
            localStorage.setItem('thementor_settings', JSON.stringify({
                theme: this.state.theme
            }));
        } catch (e) {
            console.warn('Could not save settings:', e);
        }
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        const newTheme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    /**
     * Set theme
     */
    setTheme(theme) {
        document.body.classList.remove('theme-dark', 'theme-light');
        document.body.classList.add(`theme-${theme}`);
        this.state.theme = theme;
        
        const icon = this.elements.themeToggle?.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        }
        
        this.saveSettings();
    }

    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            this.elements.fullscreenBtn.querySelector('i').className = 'fas fa-compress';
        } else {
            document.exitFullscreen();
            this.elements.fullscreenBtn.querySelector('i').className = 'fas fa-expand';
        }
    }

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
        this.elements.sidebar?.classList.toggle('collapsed', this.state.sidebarCollapsed);
    }

    /**
     * Toggle results panel
     */
    toggleResults() {
        this.state.resultsCollapsed = !this.state.resultsCollapsed;
        this.elements.resultsPanel?.classList.toggle('collapsed', this.state.resultsCollapsed);
        
        const icon = this.elements.toggleResults?.querySelector('i');
        if (icon) {
            icon.className = this.state.resultsCollapsed ? 'fas fa-chevron-left' : 'fas fa-chevron-right';
        }
    }

    /**
     * Toggle collapsible section
     */
    toggleSection(header) {
        const targetId = header.dataset.target;
        const body = document.getElementById(targetId);
        
        if (body) {
            header.classList.toggle('collapsed');
            body.classList.toggle('collapsed');
        }
    }

    /**
     * Set view mode
     */
    setViewMode(mode) {
        this.state.activeViewMode = mode;
        
        this.elements.viewTabs?.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });
        
        this.elements.viewerGrid?.classList.toggle('single-view', mode === 'single');
        
        this.onViewModeChange?.(mode);
    }

    /**
     * Set preset view
     */
    setPresetView(view) {
        this.elements.presetBtns?.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        this.onPresetViewChange?.(view);
    }

    /**
     * Set active tool
     */
    setActiveTool(tool) {
        this.state.activeTool = tool;
        
        this.elements.toolbarBtns?.forEach(btn => {
            btn.classList.toggle('active', btn.id === `tb-${tool}`);
        });
        
        this.onToolChange?.(tool);
    }

    /**
     * Handle tool action
     */
    handleToolAction(tool) {
        switch (tool) {
            case 'screenshot':
                this.onScreenshot?.();
                break;
            case 'distance':
            case 'area':
            case 'annotate':
                this.elements.toolBtns?.forEach(btn => {
                    btn.classList.toggle('active', btn.id === `tool-${tool}`);
                });
                this.onToolChange?.(tool);
                break;
        }
    }

    /**
     * Adjust zoom
     */
    adjustZoom(delta) {
        const slider = this.elements.zoomSlider;
        if (slider) {
            const newValue = Math.max(0.5, Math.min(3, parseFloat(slider.value) + delta));
            slider.value = newValue;
            this.onZoomChange?.(newValue);
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(e) {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch (e.key.toLowerCase()) {
            case 'r':
                this.onResetView?.();
                break;
            case 'c':
                this.elements.crosshairToggle.checked = !this.elements.crosshairToggle.checked;
                this.onCrosshairsToggle?.(this.elements.crosshairToggle.checked);
                break;
            case 'f':
                this.toggleFullscreen();
                break;
            case '1':
                this.setPresetView('axial');
                break;
            case '2':
                this.setPresetView('coronal');
                break;
            case '3':
                this.setPresetView('sagittal');
                break;
            case '4':
                this.setPresetView('3d');
                break;
            case 'arrowup':
                if (e.ctrlKey) this.onSliceNavigate?.('up');
                break;
            case 'arrowdown':
                if (e.ctrlKey) this.onSliceNavigate?.('down');
                break;
        }
    }

    /**
     * Show modal
     */
    showModal(name) {
        const modal = this.elements[`${name}Modal`];
        if (modal) {
            modal.classList.add('active');
        }
    }

    /**
     * Hide modal
     */
    hideModal(name) {
        const modal = this.elements[`${name}Modal`];
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Switch help tab
     */
    switchHelpTab(tab) {
        this.elements.helpTabs?.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        
        document.querySelectorAll('.help-content').forEach(content => {
            content.style.display = content.id === `help-${tab}` ? 'block' : 'none';
        });
    }

    /**
     * Update loading state
     */
    updateLoadingState(status, progress = 0) {
        if (this.elements.loadingStatus) {
            this.elements.loadingStatus.textContent = status;
        }
        if (this.elements.loadingProgress) {
            this.elements.loadingProgress.style.width = `${progress}%`;
            this.elements.loadingProgress.style.animation = progress < 100 ? '' : 'none';
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        this.elements.loadingOverlay?.classList.add('hidden');
    }

    /**
     * Update file info display
     */
    updateFileInfo(fileInfo, volumeInfo) {
        this.state.isFileLoaded = true;
        
        // Update file info section
        this.elements.fileInfo.style.display = 'block';
        this.elements.fileName.textContent = fileInfo.name;
        this.elements.fileSize.textContent = fileInfo.formattedSize;
        
        if (volumeInfo) {
            this.elements.fileDimensions.textContent = 
                `${volumeInfo.dimensions.x} × ${volumeInfo.dimensions.y} × ${volumeInfo.dimensions.z}`;
            this.elements.voxelSize.textContent = 
                `${volumeInfo.voxelSize.x.toFixed(2)} × ${volumeInfo.voxelSize.y.toFixed(2)} × ${volumeInfo.voxelSize.z.toFixed(2)} mm`;
        }
        
        // Update patient info
        this.elements.patientInfo.innerHTML = `
            <span class="patient-label">${fileInfo.name}</span>
        `;
        
        // Hide empty state, show viewer
        this.elements.viewerEmpty?.classList.add('hidden');
        this.elements.viewerToolbar?.classList.remove('hidden');
        
        // Enable analyze button
        if (this.elements.analyzeBtn) {
            this.elements.analyzeBtn.disabled = false;
        }
        
        // Update slice sliders
        if (volumeInfo) {
            this.elements.axialSlider.max = volumeInfo.dimensions.z - 1;
            this.elements.coronalSlider.max = volumeInfo.dimensions.y - 1;
            this.elements.sagittalSlider.max = volumeInfo.dimensions.x - 1;
            
            this.elements.axialSlider.value = Math.floor(volumeInfo.dimensions.z / 2);
            this.elements.coronalSlider.value = Math.floor(volumeInfo.dimensions.y / 2);
            this.elements.sagittalSlider.value = Math.floor(volumeInfo.dimensions.x / 2);
            
            this.elements.axialValue.textContent = Math.floor(volumeInfo.dimensions.z / 2);
            this.elements.coronalValue.textContent = Math.floor(volumeInfo.dimensions.y / 2);
            this.elements.sagittalValue.textContent = Math.floor(volumeInfo.dimensions.x / 2);
        }
    }

    /**
     * Update recent files list
     */
    updateRecentFiles(files) {
        const list = this.elements.recentFilesList;
        if (!list) return;
        
        if (files.length === 0) {
            list.innerHTML = '<li class="empty-state">No recent files</li>';
            return;
        }
        
        list.innerHTML = files.map(file => `
            <li data-name="${file.name}">
                <i class="fas fa-file-medical"></i>
                <span>${file.name}</span>
            </li>
        `).join('');
    }

    /**
     * Update model status
     */
    updateModelStatus(status, message) {
        const indicator = this.elements.modelStatus?.querySelector('.status-indicator');
        const text = this.elements.modelStatus?.querySelector('span');
        
        if (indicator) {
            indicator.className = `status-indicator ${status}`;
        }
        if (text) {
            text.textContent = message;
        }
    }

    /**
     * Update analysis progress
     */
    updateAnalysisProgress(progress, message) {
        if (this.elements.analysisProgress) {
            this.elements.analysisProgress.style.display = progress > 0 && progress < 100 ? 'block' : 'none';
        }
        if (this.elements.analysisProgressFill) {
            this.elements.analysisProgressFill.style.width = `${progress}%`;
        }
        if (this.elements.analysisStatus) {
            this.elements.analysisStatus.textContent = message;
        }
        
        // Update button state
        if (this.elements.analyzeBtn) {
            this.elements.analyzeBtn.disabled = progress > 0 && progress < 100;
            this.elements.analyzeBtn.querySelector('span').textContent = 
                progress > 0 && progress < 100 ? 'Analyzing...' : 'Analyze Brain Scan';
        }
    }

    /**
     * Display analysis results
     */
    displayResults(results) {
        console.log('Displaying results:', results);
        
        // Update status card
        const statusCard = this.elements.statusCard;
        const statusIcon = statusCard?.querySelector('.status-icon');
        const statusText = statusCard?.querySelector('.status-text');
        
        if (results.overall_status === 'NORMAL') {
            statusCard.className = 'result-card status-card normal';
            statusIcon.className = 'status-icon normal';
            statusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
            statusText.textContent = 'Normal - No anomalies detected';
        } else {
            statusCard.className = 'result-card status-card anomaly';
            statusIcon.className = 'status-icon anomaly';
            statusIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            statusText.textContent = `Anomaly Detected - ${results.metrics.severity || 'unknown'} severity`;
        }
        
        // Update quick stats - WITH PROPER NUMBER FORMATTING
        this.elements.quickStats.style.display = 'grid';
        
        // Confidence - convert to percentage and format
        const confidencePercent = parseFloat(results.confidence || 0) * 100;
        this.elements.statConfidence.textContent = `${confidencePercent.toFixed(2)}%`;
        
        // Anomaly Score - convert to percentage and format
        const anomalyScore = parseFloat(results.metrics.anomaly_score || 0);
        const anomalyPercent = anomalyScore * 100;
        this.elements.statAnomaly.textContent = `${anomalyPercent.toFixed(2)}%`;
        
        // Processing Time - format to 2 decimal places
        const processingTime = parseFloat(results.metrics.processing_time || 0);
        this.elements.statTime.textContent = `${processingTime.toFixed(2)}s`;
        
        // Update anomalies list
        this.elements.resultsDetails.style.display = 'block';
        this.displayAnomalies(results.anomalies);
        
        // Update metrics
        this.elements.metricsSection.style.display = 'block';
        this.displayMetrics(results.metrics);
        
        // Update recommendations
        this.elements.recommendationsSection.style.display = 'block';
        this.displayRecommendations(results.recommendations);
        
        // Update the chart with proper data
        this.updateMetricsChart(results.metrics);
    }
    /**
     * Display anomalies list
     */
    displayAnomalies(anomalies) {
        const list = this.elements.anomaliesList;
        if (!list) return;
        
        // Safely handle anomalies - ensure it's an array
        const anomaliesArray = Array.isArray(anomalies) ? anomalies : [];
        
        if (anomaliesArray.length === 0) {
            list.innerHTML = `
                <div class="normal-result">
                    <i class="fas fa-check-circle"></i>
                    <p>No significant anomalies detected in this scan.</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = anomaliesArray.map((anomaly, index) => `
            <div class="anomaly-item">
                <div class="anomaly-header">
                    <div class="anomaly-type">
                        <span class="anomaly-badge severity-${anomaly.severity || 'medium'}"></span>
                        <span class="anomaly-name">${anomaly.type || 'Unknown Anomaly'}</span>
                    </div>
                    <span class="anomaly-confidence">${((anomaly.confidence || 0) * 100).toFixed(1)}%</span>
                </div>
                <div class="anomaly-details">
                    <div class="anomaly-detail">
                        <span class="anomaly-detail-label">Confidence</span>
                        <span class="anomaly-detail-value">${((anomaly.confidence || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div class="anomaly-detail">
                        <span class="anomaly-detail-label">Severity</span>
                        <span class="anomaly-detail-value">${anomaly.severity || 'medium'}</span>
                    </div>
                    ${anomaly.percentage ? `
                    <div class="anomaly-detail">
                        <span class="anomaly-detail-label">Volume Affected</span>
                        <span class="anomaly-detail-value">${parseFloat(anomaly.percentage).toFixed(2)}%</span>
                    </div>
                    ` : ''}
                </div>
                <p class="anomaly-description">${anomaly.description || 'Anomaly detected in brain structure. Clinical correlation recommended.'}</p>
            </div>
        `).join('');
    }

    /**
     * Display metrics chart
     */
    displayMetrics(metrics) {
        // Update metrics details with proper formatting
        this.elements.metricsDetails.innerHTML = `
            <div class="metric-row">
                <span class="metric-label">Mean Squared Error</span>
                <span class="metric-value">${parseFloat(metrics.mse || 0).toFixed(6)}</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Anomaly Score</span>
                <span class="metric-value">${parseFloat(metrics.anomaly_score || 0).toFixed(6)}</span>
            </div>
            <div class="metric-row">
                <span class="metric-label">Processing Time</span>
                <span class="metric-value">${parseFloat(metrics.processing_time || 0).toFixed(2)}s</span>
            </div>
            ${metrics.volume_affected ? `
            <div class="metric-row">
                <span class="metric-label">Volume Affected</span>
                <span class="metric-value">${metrics.volume_affected}</span>
            </div>
            ` : ''}
            ${metrics.severity ? `
            <div class="metric-row">
                <span class="metric-label">Severity</span>
                <span class="metric-value">${metrics.severity}</span>
            </div>
            ` : ''}
        `;
        
        // Create/update chart with proper data
        this.updateMetricsChart(metrics);
    }

    /**
     * Update metrics chart
     */
    updateMetricsChart(metrics) {
        const ctx = this.elements.metricsChart?.getContext('2d');
        if (!ctx) return;
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        // Calculate chart data - use volume_affected if available, otherwise use anomaly score
        let normalPercent, anomalyPercent;
        
        if (metrics.volume_affected && typeof metrics.volume_affected === 'string') {
            // Extract percentage from string like "8.50%"
            anomalyPercent = parseFloat(metrics.volume_affected.replace('%', '')) || 0;
            normalPercent = 100 - anomalyPercent;
        } else {
            // Fallback to anomaly score
            anomalyPercent = parseFloat(metrics.anomaly_score || 0) * 100;
            normalPercent = 100 - anomalyPercent;
        }
        
        // Ensure values are within 0-100 range
        normalPercent = Math.max(0, Math.min(100, normalPercent));
        anomalyPercent = Math.max(0, Math.min(100, anomalyPercent));
        
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Normal', 'Anomaly'],
                datasets: [{
                    data: [normalPercent, anomalyPercent],
                    backgroundColor: [
                        'rgba(0, 210, 106, 0.8)',
                        'rgba(255, 71, 87, 0.8)'
                    ],
                    borderColor: [
                        'rgba(0, 210, 106, 1)',
                        'rgba(255, 71, 87, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: getComputedStyle(document.body).getPropertyValue('--text-secondary')
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Display recommendations
     */
    displayRecommendations(recommendations) {
        const list = this.elements.recommendationsList;
        if (!list) return;
        
        list.innerHTML = recommendations.map((rec, index) => `
            <li class="recommendation-item">
                <div class="recommendation-icon">
                    <i class="fas fa-${index === recommendations.length - 1 ? 'info-circle' : 'clipboard-check'}"></i>
                </div>
                <span class="recommendation-text">${rec}</span>
            </li>
        `).join('');
    }

    /**
     * Log to console
     */
    log(message, type = 'info') {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        const logEntry = { time, message, type };
        this.consoleMessages.push(logEntry);
        
        // Keep only last 100 messages
        if (this.consoleMessages.length > 100) {
            this.consoleMessages.shift();
        }
        
        this.updateConsole();
    }

    /**
     * Update console display
     */
    updateConsole() {
        const output = this.elements.consoleOutput;
        if (!output) return;
        
        output.innerHTML = this.consoleMessages.map(entry => `
            <div class="console-line ${entry.type}">
                <span class="console-time">[${entry.time}]</span>
                <span class="console-msg">${entry.message}</span>
            </div>
        `).join('');
        
        output.scrollTop = output.scrollHeight;
    }

    /**
     * Clear console
     */
    clearConsole() {
        this.consoleMessages = [];
        this.updateConsole();
    }

    /**
     * Update time display
     */
    updateTime() {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        // Could update a time display element if needed
    }

    /**
     * Update memory usage display
     */
    updateMemoryUsage(memoryInfo) {
        if (this.elements.memoryUsage && memoryInfo) {
            this.elements.memoryUsage.textContent = `Memory: ${memoryInfo.numBytesFormatted}`;
        }
    }

    /**
     * Update GPU status
     */
    updateGPUStatus(status) {
        if (this.elements.gpuStatus) {
            this.elements.gpuStatus.textContent = `GPU: ${status}`;
        }
    }

    /**
     * Update cursor position
     */
    updateCursorPosition(position) {
        if (this.elements.cursorPosition) {
            this.elements.cursorPosition.textContent = 
                `Position: [${Math.round(position.x * 100)}%, ${Math.round(position.y * 100)}%, ${Math.round(position.z * 100)}%]`;
        }
    }

    /**
     * Show toast notification
     */
    showToast(title, message, type = 'info') {
        const container = this.elements.toastContainer;
        if (!container) return;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="toast-icon fas ${icons[type]}"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        });
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('toast-out');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }
/**
 * Initialize sidebar toggle functionality
 */
initSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle && sidebar) {
        // Make sure toggle button is always visible
        sidebarToggle.style.position = 'absolute';
        sidebarToggle.style.right = '-25px';
        sidebarToggle.style.top = '50%';
        sidebarToggle.style.zIndex = '1000';
        sidebarToggle.style.background = '#3498db';
        sidebarToggle.style.color = 'white';
        sidebarToggle.style.borderRadius = '50%';
        sidebarToggle.style.width = '30px';
        sidebarToggle.style.height = '30px';
        sidebarToggle.style.display = 'flex';
        sidebarToggle.style.alignItems = 'center';
        sidebarToggle.style.justifyContent = 'center';
        
        sidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('collapsed');
            
            // Update toggle icon
            const icon = sidebarToggle.querySelector('i');
            if (sidebar.classList.contains('collapsed')) {
                icon.className = 'fas fa-chevron-right';
            } else {
                icon.className = 'fas fa-chevron-left';
            }
        });
    }
    
    // Results panel toggle
    const resultsToggle = document.getElementById('toggle-results');
    const resultsPanel = document.getElementById('results-panel');
    
    if (resultsToggle && resultsPanel) {
        // Style results toggle button
        resultsToggle.style.background = '#3498db';
        resultsToggle.style.color = 'white';
        resultsToggle.style.borderRadius = '4px';
        resultsToggle.style.padding = '5px';
        
        resultsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            resultsPanel.classList.toggle('collapsed');
            
            // Update toggle icon
            const icon = resultsToggle.querySelector('i');
            if (resultsPanel.classList.contains('collapsed')) {
                icon.className = 'fas fa-chevron-left';
            } else {
                icon.className = 'fas fa-chevron-right';
            }
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // 'a' key toggles sidebar
        if (e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            if (sidebarToggle) sidebarToggle.click();
        }
        
        // 's' key toggles results panel
        if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            if (resultsToggle) resultsToggle.click();
        }
        
        // 'f' key for fullscreen
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            const fullscreenBtn = document.getElementById('fullscreen-btn');
            if (fullscreenBtn) fullscreenBtn.click();
        }
    });
}
}

// Export singleton
export const uiController = new UIController();


