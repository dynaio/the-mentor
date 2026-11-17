/**
 * THE MENTOR - Main Application
 * AI-Powered Brain MRI Analysis Web Application
 * 
 * @version 2.0.0
 * @author The Mentor Team
 */

import { fileHandler } from './utils/file-handler.js';
import { niftiParser } from './utils/nifti-parser.js';
import { tensorUtils } from './utils/tensor-utils.js';
import { niftiViewer } from './nifti-viewer.js';
import { modelLoader } from './model-loader.js';
import { brainAnalyzer } from './brain-analyzer.js';
import { uiController } from './ui-controller.js';

class TheMentorApp {
    constructor() {
        this.isInitialized = false;
        this.currentFileInfo = null;
        this.currentVolumeInfo = null;
        this.currentAnalysisResults = null;
        this.currentFileObject = null; // Store the actual File object
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('The Mentor - Initializing...');
        
        try {
            // Initialize UI Controller first
            uiController.init();
            uiController.updateLoadingState('Initializing interface...', 10);
            
            // Connect UI callbacks
            this.connectUICallbacks();
            
            // Initialize file handler
            uiController.updateLoadingState('Setting up file handler...', 20);
            this.initFileHandler();
            
            // Initialize TensorFlow.js and model
            uiController.updateLoadingState('Loading AI engine...', 40);
            await this.initAI();
            
            // Initialize 3D viewer
            uiController.updateLoadingState('Initializing 3D viewer...', 70);
            await this.initViewer();
            
            // Final setup
            uiController.updateLoadingState('Ready!', 100);
            
            // Hide loading after short delay
            setTimeout(() => {
                uiController.hideLoading();
                uiController.log('The Mentor initialized. Ready for analysis.', 'success');
            }, 500);
            
            this.isInitialized = true;
            console.log('The Mentor - Ready!');
            
        } catch (error) {
            console.error('Failed to initialize The Mentor:', error);
            uiController.updateLoadingState(`Error: ${error.message}`, 0);
            uiController.showToast('Initialization Error', error.message, 'error');
        }
    }

    /**
     * Initialize file handler
     */
    initFileHandler() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const openFileBtn = document.getElementById('open-file-btn');
        
        fileHandler.init(dropZone, fileInput, openFileBtn);
        
        // Handle file load
        fileHandler.onFileLoad = async (fileInfo) => {
            await this.handleFileLoad(fileInfo);
        };
        
        // Handle errors
        fileHandler.onError = (error) => {
            uiController.showToast('File Error', error, 'error');
            uiController.log(`File error: ${error}`, 'error');
        };
        
        // Update recent files
        uiController.updateRecentFiles(fileHandler.getRecentFiles());
    }

    /**
     * Initialize AI components
     */
    async initAI() {
        try {
            // Initialize TensorFlow.js
            const tfInfo = await tensorUtils.init();
            uiController.updateGPUStatus(tfInfo.backend === 'webgl' ? 'Enabled (WebGL)' : tfInfo.backend);
            uiController.log(`TensorFlow.js backend: ${tfInfo.backend}`, 'info');
            
            // Setup model loader callbacks
            modelLoader.onProgress = ({ status, progress, message }) => {
                uiController.updateModelStatus(status, message);
                if (progress > 0) {
                    uiController.updateLoadingState(message, 40 + progress * 0.3);
                }
            };
            
            modelLoader.onReady = () => {
                uiController.updateModelStatus('ready', 'AI Model Ready');
            };
            
            modelLoader.onError = (error) => {
                uiController.showToast('AI Error', error.message, 'error');
                uiController.log(`AI Error: ${error.message}`, 'error');
            };
            
            // Initialize model loader
            const modelInfo = await modelLoader.init();
            
            if (modelInfo.modelLoaded) {
                uiController.log('MANTIS model loaded successfully', 'success');
            } else {
                uiController.log('Using statistical analysis mode', 'warning');
                uiController.updateModelStatus('ready', 'Statistical Analysis Mode');
            }
            
            // Update memory info periodically
            setInterval(() => {
                const memInfo = tensorUtils.getMemoryInfo();
                if (memInfo) {
                    uiController.updateMemoryUsage(memInfo);
                }
            }, 5000);
            
        } catch (error) {
            console.warn('AI initialization warning:', error);
            uiController.log(`AI initialization: ${error.message}`, 'warning');
            uiController.updateModelStatus('ready', 'Statistical Analysis Mode');
        }
    }

    /**
     * Initialize 3D viewer
     */
    async initViewer() {
        const containers = {
            axial: document.getElementById('axial-view'),
            coronal: document.getElementById('coronal-view'),
            sagittal: document.getElementById('sagittal-view'),
            volume: document.getElementById('volume-view')
        };
        
        await niftiViewer.init(containers);
        
        // Connect viewer callbacks
        niftiViewer.onSliceChange = (positions) => {
            this.updateSliceSliders(positions);
        };
        
        niftiViewer.onCursorChange = (positions) => {
            uiController.updateCursorPosition(positions);
        };
        
        uiController.log('3D viewer initialized', 'info');
    }

    /**
     * Connect UI callbacks
     */
    connectUICallbacks() {
        // File operations
        uiController.onExport = (format) => this.exportReport(format);
        
        // View controls
        uiController.onPresetViewChange = (view) => {
            niftiViewer.setViewPreset(view);
        };
        
        uiController.onResetView = () => {
            niftiViewer.resetView();
            uiController.log('View reset', 'info');
        };
        
        uiController.onZoomChange = (value) => {
            // Zoom implementation through viewer
        };
        
        // Slice controls
        uiController.onSliceChange = (axis, value) => {
            const axisMap = { axial: 'z', coronal: 'y', sagittal: 'x' };
            niftiViewer.setSlicePosition(axisMap[axis], value);
        };
        
        // Visualization
        uiController.onWindowLevelChange = () => {
            const window = parseInt(document.getElementById('window-slider').value);
            const level = parseInt(document.getElementById('level-slider').value);
            niftiViewer.setWindowLevel(level / 4096, window / 4096);
        };
        
        uiController.onOpacityChange = (value) => {
            niftiViewer.setOpacity(value);
        };
        
        uiController.onColorSchemeChange = (scheme) => {
            niftiViewer.setColorScheme(scheme);
            uiController.log(`Color scheme: ${scheme}`, 'info');
        };
        
        uiController.onCrosshairsToggle = (visible) => {
            niftiViewer.toggleCrosshairs(visible);
        };
        
        // AI Analysis
        uiController.onThresholdChange = (value) => {
            brainAnalyzer.setConfidenceThreshold(value);
        };
        
        // Tools
        uiController.onScreenshot = () => {
            this.takeScreenshot();
        };
        
        // Analyze button
        const analyzeBtn = document.getElementById('analyze-btn');
        analyzeBtn?.addEventListener('click', () => this.runAnalysis());
    }

    /**
     * Handle file load
     */
    async handleFileLoad(fileInfo) {
        try {
            uiController.log(`Loading: ${fileInfo.name}`, 'info');
            uiController.showToast('Loading File', 'Processing NIfTI scan...', 'info');
            
            // Clear previous analysis results
            this.currentAnalysisResults = null;
            niftiViewer.clearAnomalyMap();
            
            // Store the actual File object for analysis - FIXED
            this.currentFileObject = fileInfo.file;
            
            // Load volume into viewer
            const volumeInfo = await niftiViewer.loadVolume(fileInfo.arrayBuffer);
            
            this.currentFileInfo = fileInfo;
            this.currentVolumeInfo = volumeInfo;
            
            // Enable analyze button - IMPORTANT FIX
            const analyzeBtn = document.getElementById('analyze-btn');
            if (analyzeBtn) {
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = '<i class="fas fa-microscope"></i><span>Analyze Brain Scan</span>';
            }
            
            // Update UI
            uiController.updateFileInfo(fileInfo, volumeInfo);
            uiController.updateRecentFiles(fileHandler.getRecentFiles());
            
            uiController.log(`Loaded: ${volumeInfo.dimensions.x}x${volumeInfo.dimensions.y}x${volumeInfo.dimensions.z}`, 'success');
            uiController.showToast('File Loaded', 'NIfTI scan loaded successfully', 'success');
            
        } catch (error) {
            console.error('Error loading file:', error);
            uiController.log(`Load failed: ${error.message}`, 'error');
            uiController.showToast('Load Error', error.message, 'error');
        }
    }
    /**
     * Run AI analysis
     */
    async runAnalysis() {
        if (!niftiViewer.isLoaded) {
            uiController.showToast('No Scan Loaded', 'Please load a NIfTI file first', 'warning');
            return;
        }
        
        if (!this.currentFileObject) {
            uiController.showToast('No File Selected', 'Please select a NIfTI file', 'warning');
            return;
        }
        
        try {
            uiController.log('Starting AI analysis...', 'info');
            uiController.updateAnalysisProgress(10, 'Initializing analysis...');
            
            // Setup progress callback
            modelLoader.onProgress = ({ status, progress, message }) => {
                uiController.updateAnalysisProgress(30 + progress * 0.6, message);
                uiController.log(message, 'info');
            };
            
            // Run real AI analysis using the actual File object
            const analysisInput = {
                file: this.currentFileObject  // This is the actual File object
            };
            
            const results = await modelLoader.predict(analysisInput);
            
            // Handle real AI results
            this.handleRealAnalysisResults(results);
            
        } catch (error) {
            console.error('Analysis error:', error);
            uiController.log(`Analysis failed: ${error.message}`, 'error');
            uiController.updateAnalysisProgress(0, 'Analysis failed');
            uiController.showToast('Analysis Error', error.message, 'error');
        }
    }

    /**
     * Handle real AI analysis results
     */
    handleRealAnalysisResults(results) {
        console.log('Handling REAL AI results:', results);
        this.currentAnalysisResults = results;
        
        // Format numbers to 4 decimal places
        const formatNum = (num) => {
            if (num === null || num === undefined || isNaN(num)) return '0.0000';
            return parseFloat(num).toFixed(4);
        };
        
        // Ensure anomalyScore exists and is a number
        const anomalyScore = parseFloat(results.anomalyScore || 0);
        const confidence = parseFloat(results.confidence || 0.7);
        const processingTime = parseFloat(results.metrics?.processing_time || results.processingTime || 0);
        
        // Display basic results
        if (results.isNormal) {
            uiController.displayResults({
                overall_status: 'NORMAL',
                confidence: confidence,
                metrics: {
                    mse: parseFloat(results.metrics?.mse || 0),
                    anomaly_score: anomalyScore,
                    processing_time: processingTime
                },
                recommendations: ['No significant anomalies detected']
            });
            
            uiController.showToast(
                'Analysis Complete',
                `Brain scan appears normal (Score: ${formatNum(anomalyScore)})`,
                'success'
            );
            
            // Clear any previous anomaly maps
            niftiViewer.clearAnomalyMap();
            
        } else {
            uiController.displayResults({
                overall_status: 'ANOMALY',
                confidence: confidence,
                metrics: {
                    mse: parseFloat(results.metrics?.mse || 0),
                    anomaly_score: anomalyScore,
                    processing_time: processingTime,
                    severity: results.metrics?.severity || 'medium',
                    volume_affected: results.metrics?.volume_affected || '0.00%'
                },
                recommendations: results.recommendations || ['Clinical correlation recommended'],
                anomalies: results.anomalies || []  // Ensure anomalies is always an array
            });
            
            uiController.showToast(
                'Analysis Complete',
                `Potential anomaly detected (Score: ${formatNum(anomalyScore)})`,
                'warning'
            );
            
            // Display anomaly map on the viewer
            if (results.differenceMap && results.shape) {
                niftiViewer.showAnomalyMap(results.differenceMap, results.shape);
            }
        }
        
        // Update detailed results UI
        this.updateDetailedResultsUI(results);
        
        uiController.updateAnalysisProgress(100, 'Analysis complete');
        uiController.log(`Analysis complete: ${results.isNormal ? 'NORMAL' : 'ANOMALY'}`, 
            results.isNormal ? 'success' : 'warning');
    }

    /**
     * Update detailed results UI with real AI data
     */
    updateDetailedResultsUI(results) {
        const resultsContainer = document.getElementById('detailed-results');
        if (!resultsContainer) return;
        
        // Format numbers to 4 decimal places
        const formatNum = (num) => {
            if (num === null || num === undefined || isNaN(num)) return '0.0000';
            return parseFloat(num).toFixed(4);
        };
        
        // Ensure all required values exist
        const anomalyScore = parseFloat(results.anomalyScore || 0);
        const confidence = parseFloat(results.confidence || 0.7);
        const mse = parseFloat(results.metrics?.mse || 0);
        const processingTime = parseFloat(results.metrics?.processing_time || results.processingTime || 0);
        
        let html = `
            <div class="results-section">
                <h3>AI Analysis Results</h3>
                <div class="result-status ${results.isNormal ? 'normal' : 'anomaly'}">
                    ${results.isNormal ? 'NORMAL BRAIN' : 'ANOMALY DETECTED'}
                </div>
                
                <div class="metrics-grid">
                    <div class="metric">
                        <label>Anomaly Score</label>
                        <span class="value">${formatNum(anomalyScore)}</span>
                    </div>
                    <div class="metric">
                        <label>Confidence</label>
                        <span class="value">${(confidence * 100).toFixed(2)}%</span>
                    </div>
                    <div class="metric">
                        <label>MSE</label>
                        <span class="value">${formatNum(mse)}</span>
                    </div>
                    <div class="metric">
                        <label>Processing Time</label>
                        <span class="value">${formatNum(processingTime)}s</span>
                    </div>
                </div>
                
                <div class="analysis-info">
                    <h4>Analysis Information</h4>
                    <p><strong>Model:</strong> Mantis Brain Autoencoder</p>
                    <p><strong>Method:</strong> Reconstruction-based Anomaly Detection</p>
                    <p><strong>Input Shape:</strong> ${results.shape ? results.shape.join(' × ') : 'N/A'}</p>
                </div>
        `;
        
        if (!results.isNormal && results.octopusResults) {
            const octopus = results.octopusResults;
            const octopusConfidence = parseFloat(octopus.confidence || 0);
            const octopusPercentage = parseFloat(octopus.calculated_percentage || 0);
            
            html += `
                <div class="octopus-results">
                    <h4>Lesion Classification</h4>
                    <div class="classification-grid">
                        <div class="classification">
                            <label>Diagnosis</label>
                            <span class="value diagnosis-${octopus.diagnosis}">${octopus.diagnosis || 'Unknown'}</span>
                        </div>
                        <div class="classification">
                            <label>Confidence</label>
                            <span class="value">${(octopusConfidence * 100).toFixed(2)}%</span>
                        </div>
                        <div class="classification">
                            <label>Lesion Volume</label>
                            <span class="value">${formatNum(octopusPercentage)}%</span>
                        </div>
                    </div>
                    
                    <div class="similarities">
                        <h5>Similarity Scores</h5>
                        <div class="similarity-grid">
                            <div class="similarity">
                                <label>Stroke</label>
                                <div class="similarity-bar">
                                    <div class="similarity-fill" style="width: ${(octopus.similarities?.stroke || 0) * 100}%"></div>
                                    <span>${((octopus.similarities?.stroke || 0) * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                            <div class="similarity">
                                <label>Tumor</label>
                                <div class="similarity-bar">
                                    <div class="similarity-fill" style="width: ${(octopus.similarities?.tumor || 0) * 100}%"></div>
                                    <span>${((octopus.similarities?.tumor || 0) * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                            <div class="similarity">
                                <label>Unknown</label>
                                <div class="similarity-bar">
                                    <div class="similarity-fill" style="width: ${(octopus.similarities?.unknown || 0) * 100}%"></div>
                                    <span>${((octopus.similarities?.unknown || 0) * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (!results.isNormal) {
            html += `
                <div class="anomaly-details">
                    <h4>Anomaly Details</h4>
                    <p>Reconstruction error indicates potential abnormalities in brain structure.</p>
                    <p>Difference map highlights regions with significant reconstruction errors.</p>
                </div>
            `;
        }
        
        html += `</div>`;
        
        resultsContainer.innerHTML = html;
    }

    /**
     * Update slice sliders from viewer
     */
    updateSliceSliders(positions) {
        const axialSlider = document.getElementById('axial-slider');
        const coronalSlider = document.getElementById('coronal-slider');
        const sagittalSlider = document.getElementById('sagittal-slider');
        
        if (axialSlider) {
            axialSlider.value = Math.round(positions.z * parseInt(axialSlider.max));
            document.getElementById('axial-value').textContent = axialSlider.value;
        }
        if (coronalSlider) {
            coronalSlider.value = Math.round(positions.y * parseInt(coronalSlider.max));
            document.getElementById('coronal-value').textContent = coronalSlider.value;
        }
        if (sagittalSlider) {
            sagittalSlider.value = Math.round(positions.x * parseInt(sagittalSlider.max));
            document.getElementById('sagittal-value').textContent = sagittalSlider.value;
        }
    }

    /**
     * Take screenshot
     */
    takeScreenshot() {
        const screenshots = niftiViewer.takeScreenshot('all');
        
        // Create download for main 3D view
        if (screenshots.volume) {
            const link = document.createElement('a');
            link.download = `the-mentor-screenshot-${Date.now()}.png`;
            link.href = screenshots.volume;
            link.click();
            
            uiController.log('Screenshot saved', 'success');
            uiController.showToast('Screenshot', 'Image saved to downloads', 'success');
        }
    }

    /**
     * Export analysis report
     */
    exportReport(format) {
        try {
            if (!this.currentAnalysisResults) {
                uiController.showToast('Export Error', 'No analysis results to export', 'warning');
                return;
            }
            
            const results = this.currentAnalysisResults;
            let reportContent;
            
            if (format === 'json') {
                reportContent = JSON.stringify({
                    analysis: {
                        status: results.isNormal ? 'NORMAL' : 'ANOMALY',
                        anomaly_score: results.anomalyScore,
                        confidence: results.confidence,
                        timestamp: new Date().toISOString(),
                        file_name: this.currentFileInfo?.name || 'Unknown'
                    },
                    metrics: results.metrics,
                    model_info: {
                        type: results.modelType,
                        analysis_mode: results.analysisMode
                    }
                }, null, 2);
            } else {
                reportContent = `
THE MENTOR - BRAIN ANALYSIS REPORT
===================================

Analysis Results:
----------------
Status: ${results.isNormal ? 'NORMAL' : 'ANOMALY DETECTED'}
Anomaly Score: ${results.anomalyScore.toFixed(4)}
Confidence: ${(results.confidence * 100).toFixed(2)}%
Processing Time: ${results.metrics.processing_time.toFixed(2)}s

Technical Metrics:
-----------------
MSE: ${results.metrics.mse.toFixed(4)}
MAE: ${results.metrics.mae?.toFixed(4) || 'N/A'}
PSNR: ${results.metrics.psnr?.toFixed(2) || 'N/A'} dB

File Information:
----------------
File: ${this.currentFileInfo?.name || 'Unknown'}
Dimensions: ${results.shape ? results.shape.join(' × ') : 'N/A'}
Analysis Date: ${new Date().toLocaleString()}

${!results.isNormal ? `
CLINICAL RECOMMENDATIONS:
------------------------
${results.recommendations ? results.recommendations.map(r => '- ' + r).join('\n') : '- Clinical correlation recommended'}
` : ''}
                `.trim();
            }
            
            const blob = new Blob([reportContent], { 
                type: format === 'json' ? 'application/json' : 'text/plain' 
            });
            
            const link = document.createElement('a');
            link.download = `the-mentor-report-${Date.now()}.${format === 'json' ? 'json' : 'txt'}`;
            link.href = URL.createObjectURL(blob);
            link.click();
            
            URL.revokeObjectURL(link.href);
            
            uiController.log(`Report exported as ${format.toUpperCase()}`, 'success');
            uiController.showToast('Export Complete', `Report saved as ${format.toUpperCase()}`, 'success');
            
        } catch (error) {
            uiController.showToast('Export Error', error.message, 'error');
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new TheMentorApp();
    app.init();
    
    // Make app globally accessible for debugging
    window.theMentor = app;
});

// Export for module use
export default TheMentorApp;
