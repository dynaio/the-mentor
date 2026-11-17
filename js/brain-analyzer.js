/**
 * THE MENTOR - Brain Analyzer
 * Core AI analysis engine for brain MRI anomaly detection
 */

import { tensorUtils } from './utils/tensor-utils.js';
import { modelLoader } from './model-loader.js';
import { niftiParser } from './utils/nifti-parser.js';

export class BrainAnalyzer {
    constructor() {
        this.isAnalyzing = false;
        this.lastResult = null;
        this.confidenceThreshold = 0.75;
        
        this.anomalyTypes = {
            tumor: { name: 'Tumor', severity: 'high', color: '#ff4757' },
            alzheimer: { name: "Alzheimer's Markers", severity: 'moderate', color: '#ffa502' },
            ms_lesion: { name: 'MS Lesion', severity: 'moderate', color: '#ff6b81' },
            stroke: { name: 'Stroke Indicator', severity: 'high', color: '#ff4757' },
            atrophy: { name: 'Brain Atrophy', severity: 'low', color: '#ffc107' },
            unknown: { name: 'Unknown Anomaly', severity: 'unknown', color: '#a55eea' }
        };

        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
    }

    /**
     * Main analysis function - runs complete brain scan analysis
     */
    async analyzeBrainScan(volumeData, dimensions, options = {}) {
        if (this.isAnalyzing) {
            throw new Error('Analysis already in progress');
        }

        this.isAnalyzing = true;
        const startTime = performance.now();
        
        try {
            this.onProgress?.({ stage: 'preprocessing', progress: 0, message: 'Preprocessing volume data...' });

            // Step 1: Preprocess the volume
            const preprocessed = await this.preprocessVolume(volumeData, dimensions);
            this.onProgress?.({ stage: 'preprocessing', progress: 30, message: 'Volume preprocessed' });

            // Step 2: Run model inference or statistical analysis
            this.onProgress?.({ stage: 'analysis', progress: 40, message: 'Running AI analysis...' });
            const inferenceResult = await this.runInference(preprocessed);
            this.onProgress?.({ stage: 'analysis', progress: 70, message: 'Analysis complete' });

            // Step 3: Post-process and interpret results
            this.onProgress?.({ stage: 'interpretation', progress: 80, message: 'Interpreting results...' });
            const interpretation = await this.interpretResults(inferenceResult, volumeData, dimensions);

            // Step 4: Generate recommendations
            this.onProgress?.({ stage: 'recommendations', progress: 90, message: 'Generating recommendations...' });
            const recommendations = this.generateRecommendations(interpretation);

            const endTime = performance.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);

            // Compile final result
            const result = {
                overall_status: interpretation.hasAnomaly ? 'ANOMALY' : 'NORMAL',
                confidence: interpretation.confidence,
                anomaly_score: interpretation.anomalyScore,
                anomalies: interpretation.anomalies,
                metrics: {
                    mse: interpretation.mse,
                    mae: interpretation.mae,
                    ssim: interpretation.ssim,
                    volume_affected: interpretation.volumeAffected,
                    severity: interpretation.severity,
                    processing_time: `${processingTime}s`
                },
                recommendations: recommendations,
                heatmap: interpretation.heatmap,
                timestamp: new Date().toISOString()
            };

            this.lastResult = result;
            this.onProgress?.({ stage: 'complete', progress: 100, message: 'Analysis complete' });
            this.onComplete?.(result);

            // Cleanup tensors
            tensorUtils.dispose(preprocessed);

            return result;

        } catch (error) {
            this.onError?.(error.message);
            throw error;
        } finally {
            this.isAnalyzing = false;
        }
    }

    /**
     * Preprocess volume for analysis
     */
    async preprocessVolume(volumeData, dimensions) {
        return tf.tidy(() => {
            // Create tensor from volume data
            const volume = tf.tensor3d(
                Array.from(volumeData),
                [dimensions.z, dimensions.y, dimensions.x]
            );

            // Normalize to 0-1
            const min = volume.min();
            const max = volume.max();
            const normalized = volume.sub(min).div(max.sub(min).add(1e-8));

            // Apply brain mask (simple threshold-based)
            const masked = tensorUtils.applyBrainMask(normalized, 0.05);

            // Resize to model input size
            const targetSize = [128, 128, 128];
            const resized = this.resizeVolume(masked, targetSize);

            // Add batch and channel dimensions
            return resized.expandDims(0).expandDims(-1);
        });
    }

    /**
     * Resize 3D volume
     */
    resizeVolume(tensor, targetShape) {
        return tf.tidy(() => {
            const [depth, height, width] = targetShape;
            const [oldDepth, oldHeight, oldWidth] = tensor.shape;

            // Simple slice-based resizing
            const scaleZ = oldDepth / depth;
            const scaleY = oldHeight / height;
            const scaleX = oldWidth / width;

            const slices = [];
            for (let z = 0; z < depth; z++) {
                const srcZ = Math.min(Math.floor(z * scaleZ), oldDepth - 1);
                let slice = tensor.slice([srcZ, 0, 0], [1, oldHeight, oldWidth]);
                slice = slice.squeeze([0]).expandDims(-1);
                slice = tf.image.resizeBilinear(slice, [height, width]);
                slices.push(slice.squeeze(-1));
            }

            return tf.stack(slices);
        });
    }

    /**
     * Run model inference
     */
    async runInference(preprocessed) {
        const prediction = await modelLoader.predict(preprocessed);
        
        if (prediction.modelType === 'autoencoder') {
            // For autoencoder, calculate reconstruction error
            const errorMetrics = tensorUtils.calculateReconstructionError(
                preprocessed,
                prediction.output
            );
            
            return {
                type: 'autoencoder',
                reconstruction: prediction.output,
                ...errorMetrics
            };
        } else if (prediction.modelType === 'statistical') {
            // Statistical analysis fallback
            return {
                type: 'statistical',
                stats: prediction.stats,
                mse: prediction.stats.std * 0.1,
                mae: prediction.stats.std * 0.05,
                ssim: 0.95 - prediction.stats.anomalyRatio * 0.5
            };
        } else {
            // Classification model
            return {
                type: 'classification',
                predictions: prediction.output.dataSync()
            };
        }
    }

    /**
     * Interpret model results
     */
    async interpretResults(inferenceResult, volumeData, dimensions) {
        const result = {
            hasAnomaly: false,
            confidence: 0,
            anomalyScore: 0,
            anomalies: [],
            mse: 0,
            mae: 0,
            ssim: 1,
            volumeAffected: '0%',
            severity: 'none',
            heatmap: null
        };

        if (inferenceResult.type === 'autoencoder' || inferenceResult.type === 'statistical') {
            result.mse = inferenceResult.mse;
            result.mae = inferenceResult.mae || inferenceResult.mse * 0.5;
            result.ssim = inferenceResult.ssim || 1 - inferenceResult.mse;

            // Determine anomaly based on reconstruction error
            const mseThreshold = 0.01; // Adjust based on model training
            result.anomalyScore = Math.min(result.mse / mseThreshold, 1);
            result.hasAnomaly = result.anomalyScore > (1 - this.confidenceThreshold);
            result.confidence = result.hasAnomaly ? 
                0.5 + result.anomalyScore * 0.5 : 
                0.5 + (1 - result.anomalyScore) * 0.5;

            if (result.hasAnomaly) {
                // Analyze specific anomalies
                const anomalies = await this.detectSpecificAnomalies(
                    volumeData, 
                    dimensions,
                    result.anomalyScore
                );
                result.anomalies = anomalies;
                
                // Calculate volume affected
                const affectedRatio = anomalies.reduce((sum, a) => 
                    sum + parseFloat(a.volume) / 100, 0);
                result.volumeAffected = `${Math.min(affectedRatio * 100, 100).toFixed(1)}%`;
                
                // Determine severity
                result.severity = this.determineSeverity(result.anomalyScore, anomalies);
            }

        } else if (inferenceResult.type === 'classification') {
            // Handle classification results
            const predictions = inferenceResult.predictions;
            const maxIdx = predictions.indexOf(Math.max(...predictions));
            const maxProb = predictions[maxIdx];
            
            result.hasAnomaly = maxIdx > 0 && maxProb > this.confidenceThreshold;
            result.confidence = maxProb;
            result.anomalyScore = result.hasAnomaly ? maxProb : 0;

            if (result.hasAnomaly) {
                result.anomalies = [{
                    type: this.getAnomalyTypeFromIndex(maxIdx),
                    confidence: maxProb,
                    location: [64, 64, 64], // Center by default
                    volume: `${(maxProb * 15).toFixed(1)}%`,
                    description: this.getAnomalyDescription(this.getAnomalyTypeFromIndex(maxIdx))
                }];
                result.severity = this.determineSeverity(result.anomalyScore, result.anomalies);
            }
        }

        return result;
    }

    /**
     * Detect specific anomalies in the volume
     */
    async detectSpecificAnomalies(volumeData, dimensions, anomalyScore) {
        const anomalies = [];
        
        return tf.tidy(() => {
            const volume = tf.tensor3d(
                Array.from(volumeData),
                [dimensions.z, dimensions.y, dimensions.x]
            );

            // Calculate statistics
            const mean = volume.mean().dataSync()[0];
            const std = volume.sub(mean).square().mean().sqrt().dataSync()[0];

            // Find high-intensity regions (potential tumors)
            const highThreshold = mean + 2.5 * std;
            const highMask = volume.greater(highThreshold);
            const highRatio = highMask.mean().dataSync()[0];

            if (highRatio > 0.001 && anomalyScore > 0.3) {
                anomalies.push({
                    type: 'Potential Mass',
                    confidence: Math.min(0.6 + anomalyScore * 0.4, 0.95),
                    location: this.findAnomalyCenter(highMask, dimensions),
                    volume: `${(highRatio * 100).toFixed(2)}%`,
                    description: 'High-intensity region detected that may warrant further investigation.'
                });
            }

            // Find low-intensity regions (potential atrophy)
            const lowThreshold = mean - 1.5 * std;
            const lowMask = volume.less(lowThreshold).mul(volume.greater(0));
            const lowRatio = lowMask.mean().dataSync()[0];

            if (lowRatio > 0.05 && anomalyScore > 0.2) {
                anomalies.push({
                    type: 'Reduced Density',
                    confidence: Math.min(0.5 + anomalyScore * 0.3, 0.85),
                    location: this.findAnomalyCenter(lowMask, dimensions),
                    volume: `${(lowRatio * 100).toFixed(2)}%`,
                    description: 'Areas of reduced tissue density detected.'
                });
            }

            // Asymmetry analysis (simplified)
            const asymmetry = this.calculateAsymmetry(volume, dimensions);
            if (asymmetry > 0.15 && anomalyScore > 0.25) {
                anomalies.push({
                    type: 'Asymmetry Detected',
                    confidence: Math.min(0.5 + asymmetry, 0.9),
                    location: [dimensions.x / 2, dimensions.y / 2, dimensions.z / 2],
                    volume: `${(asymmetry * 100).toFixed(2)}%`,
                    description: 'Significant asymmetry detected between brain hemispheres.'
                });
            }

            return anomalies;
        });
    }

    /**
     * Find center of anomaly region
     */
    findAnomalyCenter(mask, dimensions) {
        // Simplified - return approximate center
        // In production, would calculate centroid of masked region
        return [
            Math.floor(dimensions.x / 2),
            Math.floor(dimensions.y / 2),
            Math.floor(dimensions.z / 2)
        ];
    }

    /**
     * Calculate brain asymmetry
     */
    calculateAsymmetry(volume, dimensions) {
        return tf.tidy(() => {
            const midX = Math.floor(dimensions.x / 2);
            
            // Left hemisphere
            const left = volume.slice([0, 0, 0], [dimensions.z, dimensions.y, midX]);
            const leftMean = left.mean().dataSync()[0];
            
            // Right hemisphere (flipped for comparison)
            const right = volume.slice([0, 0, midX], [dimensions.z, dimensions.y, dimensions.x - midX]);
            const rightMean = right.mean().dataSync()[0];
            
            // Calculate asymmetry ratio
            const maxVal = Math.max(leftMean, rightMean);
            const minVal = Math.min(leftMean, rightMean);
            
            return maxVal > 0 ? (maxVal - minVal) / maxVal : 0;
        });
    }

    /**
     * Determine severity level
     */
    determineSeverity(anomalyScore, anomalies) {
        if (anomalyScore > 0.7 || anomalies.some(a => a.confidence > 0.85)) {
            return 'severe';
        } else if (anomalyScore > 0.4 || anomalies.some(a => a.confidence > 0.7)) {
            return 'moderate';
        } else if (anomalyScore > 0.2 || anomalies.length > 0) {
            return 'mild';
        }
        return 'none';
    }

    /**
     * Generate clinical recommendations
     */
    generateRecommendations(interpretation) {
        const recommendations = [];

        if (!interpretation.hasAnomaly) {
            recommendations.push('No significant anomalies detected in this scan.');
            recommendations.push('Continue with routine follow-up as clinically indicated.');
            return recommendations;
        }

        // General recommendations based on severity
        switch (interpretation.severity) {
            case 'severe':
                recommendations.push('URGENT: Immediate clinical correlation recommended.');
                recommendations.push('Consider expedited specialist consultation.');
                recommendations.push('Additional imaging modalities may be warranted.');
                break;
            case 'moderate':
                recommendations.push('Clinical correlation with patient symptoms advised.');
                recommendations.push('Consider follow-up imaging in 3-6 months.');
                recommendations.push('Specialist consultation may be beneficial.');
                break;
            case 'mild':
                recommendations.push('Minor findings noted - clinical correlation suggested.');
                recommendations.push('Consider follow-up imaging in 6-12 months.');
                break;
        }

        // Specific recommendations based on anomaly types
        interpretation.anomalies.forEach(anomaly => {
            if (anomaly.type.toLowerCase().includes('mass') || 
                anomaly.type.toLowerCase().includes('tumor')) {
                recommendations.push('Contrast-enhanced MRI may provide additional characterization.');
            }
            if (anomaly.type.toLowerCase().includes('atrophy') || 
                anomaly.type.toLowerCase().includes('density')) {
                recommendations.push('Neuropsychological evaluation may be considered.');
            }
            if (anomaly.type.toLowerCase().includes('asymmetry')) {
                recommendations.push('Comparison with prior studies recommended if available.');
            }
        });

        // Disclaimer
        recommendations.push('NOTE: AI analysis is for research purposes only. Clinical decisions should be made by qualified healthcare professionals.');

        return recommendations;
    }

    /**
     * Get anomaly type from classification index
     */
    getAnomalyTypeFromIndex(index) {
        const types = ['normal', 'tumor', 'alzheimer', 'ms_lesion', 'stroke', 'atrophy'];
        return types[index] || 'unknown';
    }

    /**
     * Get description for anomaly type
     */
    getAnomalyDescription(type) {
        const descriptions = {
            tumor: 'Potential neoplastic growth detected. Further characterization recommended.',
            alzheimer: 'Patterns consistent with neurodegenerative changes observed.',
            ms_lesion: 'White matter lesions detected that may be consistent with demyelinating disease.',
            stroke: 'Findings suggestive of ischemic or hemorrhagic changes.',
            atrophy: 'Generalized or focal volume loss detected.',
            unknown: 'Atypical findings that require further investigation.'
        };
        return descriptions[type] || descriptions.unknown;
    }

    /**
     * Set confidence threshold
     */
    setConfidenceThreshold(threshold) {
        this.confidenceThreshold = Math.max(0.5, Math.min(0.99, threshold));
    }

    /**
     * Get last analysis result
     */
    getLastResult() {
        return this.lastResult;
    }

    /**
     * Export analysis report
     */
    exportReport(format = 'json') {
        if (!this.lastResult) {
            throw new Error('No analysis result available');
        }

        if (format === 'json') {
            return JSON.stringify(this.lastResult, null, 2);
        }

        // Generate text report
        const result = this.lastResult;
        let report = `
THE MENTOR - Brain MRI Analysis Report
Generated: ${result.timestamp}
=========================================

OVERALL STATUS: ${result.overall_status}
Confidence: ${(result.confidence * 100).toFixed(1)}%
Anomaly Score: ${(result.anomaly_score * 100).toFixed(2)}%

METRICS:
- Mean Squared Error: ${result.metrics.mse.toFixed(6)}
- Structural Similarity: ${(result.metrics.ssim * 100).toFixed(2)}%
- Volume Affected: ${result.metrics.volume_affected}
- Severity: ${result.metrics.severity}
- Processing Time: ${result.metrics.processing_time}

DETECTED ANOMALIES:
${result.anomalies.length === 0 ? '- None detected' : 
  result.anomalies.map((a, i) => `
  ${i + 1}. ${a.type}
     Confidence: ${(a.confidence * 100).toFixed(1)}%
     Volume: ${a.volume}
     Description: ${a.description}
`).join('')}

RECOMMENDATIONS:
${result.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

=========================================
DISCLAIMER: This analysis is for research and educational purposes only.
It should not be used as the sole basis for medical decisions.
Always consult qualified healthcare professionals.
`;

        return report;
    }
}

// Export singleton
export const brainAnalyzer = new BrainAnalyzer();


