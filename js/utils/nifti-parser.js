/**
 * THE MENTOR - NIfTI Parser Utility
 * Parses NIfTI-1 and NIfTI-2 format medical imaging files
 */

export class NiftiParser {
    constructor() {
        this.header = null;
        this.imageData = null;
        this.dimensions = null;
        this.voxelSize = null;
    }

    /**
     * Parse NIfTI file from ArrayBuffer
     */
    async parse(arrayBuffer) {
        try {
            let data = arrayBuffer;

            // Check if gzipped and decompress
            if (this.isGzipped(data)) {
                data = await this.decompress(data);
            }

            // Parse NIfTI header
            this.header = this.parseHeader(data);
            
            // Extract image data
            this.imageData = this.extractImageData(data);
            
            // Calculate dimensions and voxel size
            this.dimensions = this.getDimensions();
            this.voxelSize = this.getVoxelSize();

            return {
                header: this.header,
                imageData: this.imageData,
                dimensions: this.dimensions,
                voxelSize: this.voxelSize,
                dataType: this.getDataTypeName(),
                stats: this.calculateStats()
            };

        } catch (error) {
            throw new Error(`Failed to parse NIfTI file: ${error.message}`);
        }
    }

    /**
     * Check if data is gzipped
     */
    isGzipped(data) {
        const arr = new Uint8Array(data);
        return arr[0] === 0x1f && arr[1] === 0x8b;
    }

    /**
     * Decompress gzipped data using pako
     */
    async decompress(data) {
        if (typeof pako === 'undefined') {
            throw new Error('Pako library not loaded for decompression');
        }
        
        try {
            const compressed = new Uint8Array(data);
            const decompressed = pako.inflate(compressed);
            return decompressed.buffer;
        } catch (error) {
            throw new Error(`Decompression failed: ${error.message}`);
        }
    }

    /**
     * Parse NIfTI header (NIfTI-1 format)
     */
    parseHeader(data) {
        const view = new DataView(data);
        const header = {};

        // Header size check
        const sizeof_hdr = view.getInt32(0, true);
        header.sizeof_hdr = sizeof_hdr;
        
        // Determine if NIfTI-1 or NIfTI-2
        header.isNifti2 = sizeof_hdr === 540;
        
        if (header.isNifti2) {
            return this.parseNifti2Header(view);
        }

        // NIfTI-1 header parsing
        header.dim = [];
        for (let i = 0; i < 8; i++) {
            header.dim[i] = view.getInt16(40 + i * 2, true);
        }

        header.datatype = view.getInt16(70, true);
        header.bitpix = view.getInt16(72, true);
        header.slice_start = view.getInt16(74, true);

        header.pixdim = [];
        for (let i = 0; i < 8; i++) {
            header.pixdim[i] = view.getFloat32(76 + i * 4, true);
        }

        header.vox_offset = view.getFloat32(108, true);
        header.scl_slope = view.getFloat32(112, true);
        header.scl_inter = view.getFloat32(116, true);
        header.slice_end = view.getInt16(120, true);
        header.slice_code = view.getInt8(122);
        header.xyzt_units = view.getInt8(123);
        header.cal_max = view.getFloat32(124, true);
        header.cal_min = view.getFloat32(128, true);
        header.slice_duration = view.getFloat32(132, true);
        header.toffset = view.getFloat32(136, true);

        // Description string
        const descBytes = new Uint8Array(data, 148, 80);
        header.descrip = this.decodeString(descBytes);

        // Aux file
        const auxBytes = new Uint8Array(data, 228, 24);
        header.aux_file = this.decodeString(auxBytes);

        // Qform/Sform codes
        header.qform_code = view.getInt16(252, true);
        header.sform_code = view.getInt16(254, true);

        // Quaternion parameters
        header.quatern_b = view.getFloat32(256, true);
        header.quatern_c = view.getFloat32(260, true);
        header.quatern_d = view.getFloat32(264, true);
        header.qoffset_x = view.getFloat32(268, true);
        header.qoffset_y = view.getFloat32(272, true);
        header.qoffset_z = view.getFloat32(276, true);

        // Sform matrix
        header.srow_x = [];
        header.srow_y = [];
        header.srow_z = [];
        for (let i = 0; i < 4; i++) {
            header.srow_x[i] = view.getFloat32(280 + i * 4, true);
            header.srow_y[i] = view.getFloat32(296 + i * 4, true);
            header.srow_z[i] = view.getFloat32(312 + i * 4, true);
        }

        // Magic string
        const magicBytes = new Uint8Array(data, 344, 4);
        header.magic = this.decodeString(magicBytes);

        return header;
    }

    /**
     * Parse NIfTI-2 header
     */
    parseNifti2Header(view) {
        const header = { isNifti2: true };
        
        header.sizeof_hdr = 540;
        header.datatype = view.getInt16(12, true);
        header.bitpix = view.getInt16(14, true);

        header.dim = [];
        for (let i = 0; i < 8; i++) {
            header.dim[i] = Number(view.getBigInt64(16 + i * 8, true));
        }

        header.pixdim = [];
        for (let i = 0; i < 8; i++) {
            header.pixdim[i] = view.getFloat64(104 + i * 8, true);
        }

        header.vox_offset = Number(view.getBigInt64(168, true));
        header.scl_slope = view.getFloat64(176, true);
        header.scl_inter = view.getFloat64(184, true);

        return header;
    }

    /**
     * Decode byte array to string
     */
    decodeString(bytes) {
        let str = '';
        for (let i = 0; i < bytes.length && bytes[i] !== 0; i++) {
            str += String.fromCharCode(bytes[i]);
        }
        return str.trim();
    }

    /**
     * Extract image data from buffer
     */
    extractImageData(data) {
        const offset = Math.floor(this.header.vox_offset);
        const dataSlice = data.slice(offset);
        
        const numVoxels = this.header.dim.slice(1, this.header.dim[0] + 1)
            .reduce((a, b) => a * b, 1);

        let typedArray;
        
        switch (this.header.datatype) {
            case 2:  // UINT8
                typedArray = new Uint8Array(dataSlice, 0, numVoxels);
                break;
            case 4:  // INT16
                typedArray = new Int16Array(dataSlice, 0, numVoxels);
                break;
            case 8:  // INT32
                typedArray = new Int32Array(dataSlice, 0, numVoxels);
                break;
            case 16: // FLOAT32
                typedArray = new Float32Array(dataSlice, 0, numVoxels);
                break;
            case 64: // FLOAT64
                typedArray = new Float64Array(dataSlice, 0, numVoxels);
                break;
            case 256: // INT8
                typedArray = new Int8Array(dataSlice, 0, numVoxels);
                break;
            case 512: // UINT16
                typedArray = new Uint16Array(dataSlice, 0, numVoxels);
                break;
            case 768: // UINT32
                typedArray = new Uint32Array(dataSlice, 0, numVoxels);
                break;
            default:
                // Default to float32
                typedArray = new Float32Array(dataSlice, 0, numVoxels);
        }

        // Apply scaling if needed
        if (this.header.scl_slope !== 0 && this.header.scl_slope !== 1) {
            const scaled = new Float32Array(typedArray.length);
            for (let i = 0; i < typedArray.length; i++) {
                scaled[i] = typedArray[i] * this.header.scl_slope + this.header.scl_inter;
            }
            return scaled;
        }

        return typedArray;
    }

    /**
     * Get image dimensions
     */
    getDimensions() {
        const numDims = this.header.dim[0];
        return {
            numDimensions: numDims,
            x: this.header.dim[1] || 1,
            y: this.header.dim[2] || 1,
            z: this.header.dim[3] || 1,
            t: this.header.dim[4] || 1,
            total: this.header.dim.slice(1, numDims + 1).reduce((a, b) => a * b, 1)
        };
    }

    /**
     * Get voxel size in mm
     */
    getVoxelSize() {
        return {
            x: this.header.pixdim[1] || 1,
            y: this.header.pixdim[2] || 1,
            z: this.header.pixdim[3] || 1,
            t: this.header.pixdim[4] || 0
        };
    }

    /**
     * Get data type name
     */
    getDataTypeName() {
        const types = {
            0: 'UNKNOWN',
            1: 'BINARY',
            2: 'UINT8',
            4: 'INT16',
            8: 'INT32',
            16: 'FLOAT32',
            32: 'COMPLEX64',
            64: 'FLOAT64',
            128: 'RGB24',
            255: 'ALL',
            256: 'INT8',
            512: 'UINT16',
            768: 'UINT32',
            1024: 'INT64',
            1280: 'UINT64',
            1536: 'FLOAT128',
            1792: 'COMPLEX128',
            2048: 'COMPLEX256'
        };
        return types[this.header.datatype] || 'UNKNOWN';
    }

    /**
     * Calculate image statistics
     */
    calculateStats() {
        if (!this.imageData || this.imageData.length === 0) {
            return null;
        }

        let min = Infinity;
        let max = -Infinity;
        let sum = 0;
        let validCount = 0;

        for (let i = 0; i < this.imageData.length; i++) {
            const val = this.imageData[i];
            if (isFinite(val)) {
                min = Math.min(min, val);
                max = Math.max(max, val);
                sum += val;
                validCount++;
            }
        }

        const mean = validCount > 0 ? sum / validCount : 0;

        // Calculate standard deviation
        let sumSq = 0;
        for (let i = 0; i < this.imageData.length; i++) {
            const val = this.imageData[i];
            if (isFinite(val)) {
                sumSq += (val - mean) ** 2;
            }
        }
        const std = validCount > 0 ? Math.sqrt(sumSq / validCount) : 0;

        return {
            min: min === Infinity ? 0 : min,
            max: max === -Infinity ? 0 : max,
            mean,
            std,
            validVoxels: validCount,
            totalVoxels: this.imageData.length
        };
    }

    /**
     * Get slice at specific position
     */
    getSlice(axis, position) {
        if (!this.imageData || !this.dimensions) return null;

        const { x, y, z } = this.dimensions;
        let slice;

        switch (axis) {
            case 'axial':
            case 'z':
                // XY plane at position Z
                slice = new Float32Array(x * y);
                const zPos = Math.min(Math.max(0, position), z - 1);
                for (let j = 0; j < y; j++) {
                    for (let i = 0; i < x; i++) {
                        slice[j * x + i] = this.imageData[zPos * x * y + j * x + i];
                    }
                }
                return { data: slice, width: x, height: y };

            case 'coronal':
            case 'y':
                // XZ plane at position Y
                slice = new Float32Array(x * z);
                const yPos = Math.min(Math.max(0, position), y - 1);
                for (let k = 0; k < z; k++) {
                    for (let i = 0; i < x; i++) {
                        slice[k * x + i] = this.imageData[k * x * y + yPos * x + i];
                    }
                }
                return { data: slice, width: x, height: z };

            case 'sagittal':
            case 'x':
                // YZ plane at position X
                slice = new Float32Array(y * z);
                const xPos = Math.min(Math.max(0, position), x - 1);
                for (let k = 0; k < z; k++) {
                    for (let j = 0; j < y; j++) {
                        slice[k * y + j] = this.imageData[k * x * y + j * x + xPos];
                    }
                }
                return { data: slice, width: y, height: z };

            default:
                return null;
        }
    }

    /**
     * Normalize image data to 0-255 range
     */
    normalizeToUint8(data, windowCenter = null, windowWidth = null) {
        const stats = this.calculateStats();
        
        let min, max;
        if (windowCenter !== null && windowWidth !== null) {
            min = windowCenter - windowWidth / 2;
            max = windowCenter + windowWidth / 2;
        } else {
            min = stats.min;
            max = stats.max;
        }

        const range = max - min || 1;
        const normalized = new Uint8Array(data.length);

        for (let i = 0; i < data.length; i++) {
            const val = (data[i] - min) / range;
            normalized[i] = Math.max(0, Math.min(255, Math.round(val * 255)));
        }

        return normalized;
    }

    /**
     * Get affine transformation matrix
     */
    getAffineMatrix() {
        if (!this.header) return null;

        if (this.header.sform_code > 0) {
            // Use sform matrix
            return [
                [...this.header.srow_x],
                [...this.header.srow_y],
                [...this.header.srow_z],
                [0, 0, 0, 1]
            ];
        } else if (this.header.qform_code > 0) {
            // Calculate from quaternion
            const b = this.header.quatern_b;
            const c = this.header.quatern_c;
            const d = this.header.quatern_d;
            const a = Math.sqrt(1 - b*b - c*c - d*d);

            return [
                [a*a+b*b-c*c-d*d, 2*(b*c-a*d), 2*(b*d+a*c), this.header.qoffset_x],
                [2*(b*c+a*d), a*a+c*c-b*b-d*d, 2*(c*d-a*b), this.header.qoffset_y],
                [2*(b*d-a*c), 2*(c*d+a*b), a*a+d*d-b*b-c*c, this.header.qoffset_z],
                [0, 0, 0, 1]
            ];
        }

        // Default identity with voxel scaling
        return [
            [this.voxelSize.x, 0, 0, 0],
            [0, this.voxelSize.y, 0, 0],
            [0, 0, this.voxelSize.z, 0],
            [0, 0, 0, 1]
        ];
    }
}

// Export singleton
export const niftiParser = new NiftiParser();


