/**
 * THE MENTOR - Tensor Utilities
 * TensorFlow.js utilities for brain scan preprocessing and analysis
 */

export class TensorUtils {
    constructor() {
        this.tf = null;
        this.isReady = false;
    }

    /**
     * Initialize TensorFlow.js
     */
    async init() {
        if (typeof tf === 'undefined') {
            throw new Error('TensorFlow.js not loaded');
        }
        
        this.tf = tf;
        
        // Set backend (prefer WebGL for GPU acceleration)
        try {
            await this.tf.setBackend('webgl');
            await this.tf.ready();
        } catch {
            console.warn('WebGL not available, falling back to CPU');
            await this.tf.setBackend('cpu');
            await this.tf.ready();
        }
        
        this.isReady = true;
        
        return {
            backend: this.tf.getBackend(),
            memory: this.tf.memory()
        };
    }

    /**
     * Get backend info
     */
    getBackendInfo() {
        if (!this.tf) return null;
        
        return {
            backend: this.tf.getBackend(),
            memory: this.tf.memory(),
            flags: this.tf.env().flags
        };
    }

    /**
     * Preprocess NIfTI volume for model input
     * Resizes to target shape and normalizes values
     */
    preprocessVolume(imageData, dimensions, targetShape = [128, 128, 128]) {
        return this.tf.tidy(() => {
            // Create 3D tensor from image data
            const volumeTensor = this.tf.tensor3d(
                Array.from(imageData),
                [dimensions.z, dimensions.y, dimensions.x]
            );

            // Normalize to 0-1 range
            const normalized = this.normalizeMinMax(volumeTensor);

            // Resize to target shape if needed
            let resized = normalized;
            if (dimensions.x !== targetShape[0] || 
                dimensions.y !== targetShape[1] || 
                dimensions.z !== targetShape[2]) {
                resized = this.resize3D(normalized, targetShape);
            }

            // Add batch and channel dimensions [batch, depth, height, width, channels]
            const batched = resized.expandDims(0).expandDims(-1);

            return batched;
        });
    }

    /**
     * Normalize tensor to 0-1 range using min-max
     */
    normalizeMinMax(tensor) {
        return this.tf.tidy(() => {
            const min = tensor.min();
            const max = tensor.max();
            const range = max.sub(min).add(1e-8); // Avoid division by zero
            return tensor.sub(min).div(range);
        });
    }

    /**
     * Normalize tensor using z-score
     */
    normalizeZScore(tensor) {
        return this.tf.tidy(() => {
            const mean = tensor.mean();
            const variance = tensor.sub(mean).square().mean();
            const std = variance.sqrt().add(1e-8);
            return tensor.sub(mean).div(std);
        });
    }

    /**
     * Resize 3D volume using trilinear interpolation
     */
    resize3D(tensor, targetShape) {
        return this.tf.tidy(() => {
            const [depth, height, width] = targetShape;
            const [oldDepth, oldHeight, oldWidth] = tensor.shape;

            // Resize slice by slice for each axis
            // First resize in XY plane
            let resized = tensor.reshape([oldDepth, oldHeight, oldWidth, 1]);
            resized = this.tf.image.resizeBilinear(resized, [height, width]);
            resized = resized.squeeze(-1);

            // Transpose and resize in Z direction
            resized = resized.transpose([1, 2, 0]); // [height, width, depth]
            resized = resized.expandDims(-1);
            resized = this.tf.image.resizeBilinear(resized, [width, depth]);
            resized = resized.squeeze(-1);
            resized = resized.transpose([2, 0, 1]); // Back to [depth, height, width]

            return resized;
        });
    }

    /**
     * Extract patches from volume for patch-based analysis
     */
    extractPatches(tensor, patchSize = 32, stride = 16) {
        return this.tf.tidy(() => {
            const [depth, height, width] = tensor.shape;
            const patches = [];

            for (let z = 0; z <= depth - patchSize; z += stride) {
                for (let y = 0; y <= height - patchSize; y += stride) {
                    for (let x = 0; x <= width - patchSize; x += stride) {
                        const patch = tensor.slice(
                            [z, y, x],
                            [patchSize, patchSize, patchSize]
                        );
                        patches.push({
                            tensor: patch,
                            position: [z, y, x]
                        });
                    }
                }
            }

            return patches;
        });
    }

    /**
     * Calculate reconstruction error (for autoencoder-based detection)
     */
    calculateReconstructionError(original, reconstructed) {
        return this.tf.tidy(() => {
            // Mean Squared Error
            const mse = original.sub(reconstructed).square().mean();
            
            // Mean Absolute Error
            const mae = original.sub(reconstructed).abs().mean();
            
            // Structural Similarity Index (simplified)
            const meanOrig = original.mean();
            const meanRecon = reconstructed.mean();
            const varOrig = original.sub(meanOrig).square().mean();
            const varRecon = reconstructed.sub(meanRecon).square().mean();
            const covar = original.sub(meanOrig).mul(reconstructed.sub(meanRecon)).mean();
            
            const c1 = 0.01 ** 2;
            const c2 = 0.03 ** 2;
            
            const ssimNum = meanOrig.mul(meanRecon).mul(2).add(c1)
                .mul(covar.mul(2).add(c2));
            const ssimDen = meanOrig.square().add(meanRecon.square()).add(c1)
                .mul(varOrig.add(varRecon).add(c2));
            const ssim = ssimNum.div(ssimDen);

            return {
                mse: mse.dataSync()[0],
                mae: mae.dataSync()[0],
                ssim: ssim.dataSync()[0]
            };
        });
    }

    /**
     * Generate anomaly heatmap from reconstruction error
     */
    generateAnomalyHeatmap(original, reconstructed, threshold = 2.0) {
        return this.tf.tidy(() => {
            const error = original.sub(reconstructed).abs();
            const mean = error.mean();
            const std = error.sub(mean).square().mean().sqrt();
            
            // Z-score based thresholding
            const zScores = error.sub(mean).div(std.add(1e-8));
            const mask = zScores.greater(threshold);
            
            return {
                heatmap: error,
                mask: mask,
                threshold: threshold
            };
        });
    }

    /**
     * Calculate volume statistics
     */
    calculateVolumeStats(tensor) {
        return this.tf.tidy(() => {
            const flat = tensor.flatten();
            const sorted = flat.topk(flat.size).values;
            
            return {
                mean: tensor.mean().dataSync()[0],
                std: tensor.sub(tensor.mean()).square().mean().sqrt().dataSync()[0],
                min: tensor.min().dataSync()[0],
                max: tensor.max().dataSync()[0],
                median: sorted.slice([Math.floor(sorted.size / 2)], [1]).dataSync()[0],
                percentile5: sorted.slice([Math.floor(sorted.size * 0.95)], [1]).dataSync()[0],
                percentile95: sorted.slice([Math.floor(sorted.size * 0.05)], [1]).dataSync()[0]
            };
        });
    }

    /**
     * Apply brain mask
     */
    applyBrainMask(tensor, threshold = 0.1) {
        return this.tf.tidy(() => {
            const normalized = this.normalizeMinMax(tensor);
            const mask = normalized.greater(threshold);
            return tensor.mul(mask.cast('float32'));
        });
    }

    /**
     * Create slice from volume
     */
    getSliceTensor(tensor, axis, position) {
        return this.tf.tidy(() => {
            const shape = tensor.shape;
            let slice;

            switch (axis) {
                case 'axial':
                case 0:
                    slice = tensor.slice([position, 0, 0], [1, shape[1], shape[2]]);
                    return slice.squeeze([0]);
                case 'coronal':
                case 1:
                    slice = tensor.slice([0, position, 0], [shape[0], 1, shape[2]]);
                    return slice.squeeze([1]);
                case 'sagittal':
                case 2:
                    slice = tensor.slice([0, 0, position], [shape[0], shape[1], 1]);
                    return slice.squeeze([2]);
                default:
                    return null;
            }
        });
    }

    /**
     * Convert tensor slice to image data for canvas
     */
    sliceToImageData(tensor, windowCenter = 0.5, windowWidth = 1.0) {
        const data = tensor.dataSync();
        const [height, width] = tensor.shape;
        const imageData = new ImageData(width, height);
        
        const min = windowCenter - windowWidth / 2;
        const max = windowCenter + windowWidth / 2;
        const range = max - min || 1;

        for (let i = 0; i < data.length; i++) {
            const val = (data[i] - min) / range;
            const pixel = Math.max(0, Math.min(255, Math.round(val * 255)));
            
            const idx = i * 4;
            imageData.data[idx] = pixel;     // R
            imageData.data[idx + 1] = pixel; // G
            imageData.data[idx + 2] = pixel; // B
            imageData.data[idx + 3] = 255;   // A
        }

        return imageData;
    }

    /**
     * Clean up tensors
     */
    dispose(tensors) {
        if (Array.isArray(tensors)) {
            tensors.forEach(t => {
                if (t && t.dispose) t.dispose();
            });
        } else if (tensors && tensors.dispose) {
            tensors.dispose();
        }
    }

    /**
     * Get memory info
     */
    getMemoryInfo() {
        if (!this.tf) return null;
        
        const mem = this.tf.memory();
        return {
            numTensors: mem.numTensors,
            numBytes: mem.numBytes,
            numBytesFormatted: this.formatBytes(mem.numBytes),
            unreliable: mem.unreliable
        };
    }

    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Export singleton
export const tensorUtils = new TensorUtils();


