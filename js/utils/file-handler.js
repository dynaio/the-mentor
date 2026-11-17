/**
 * THE MENTOR - File Handler
 * Handles NIfTI file loading and management
 */

export class FileHandler {
    constructor() {
        this.recentFiles = [];
        this.maxRecentFiles = 5;
        this.onFileLoad = null;
        this.onError = null;
    }

    init(dropZone, fileInput, openFileBtn) {
        this.dropZone = dropZone;
        this.fileInput = fileInput;
        this.openFileBtn = openFileBtn;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Open file button
        this.openFileBtn?.addEventListener('click', () => {
            this.fileInput?.click();
        });

        // File input change
        this.fileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        // Drag and drop
        this.dropZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone?.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });

        this.dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });

        // Empty state open button
        const emptyOpenBtn = document.getElementById('empty-open-btn');
        emptyOpenBtn?.addEventListener('click', () => {
            this.fileInput?.click();
        });
    }

    async handleFile(file) {
        if (!this.isNiftiFile(file)) {
            this.onError?.('Please select a valid NIfTI file (.nii or .nii.gz)');
            return;
        }

        try {
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            
            const fileInfo = {
                name: file.name,
                size: this.formatFileSize(file.size),
                type: file.type,
                lastModified: new Date(file.lastModified),
                file: file, // Store the actual File object
                arrayBuffer: arrayBuffer
            };

            // Add to recent files
            this.addToRecentFiles(fileInfo);

            // Call the callback
            this.onFileLoad?.(fileInfo);

        } catch (error) {
            this.onError?.(`Error reading file: ${error.message}`);
        }
    }
    isNiftiFile(file) {
        const fileName = file.name.toLowerCase();
        return fileName.endsWith('.nii') || 
               fileName.endsWith('.nii.gz') || 
               fileName.endsWith('.nifti');
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('File reading failed'));
            reader.readAsArrayBuffer(file);
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    addToRecentFiles(fileInfo) {
        // Remove if already exists
        this.recentFiles = this.recentFiles.filter(f => f.name !== fileInfo.name);
        
        // Add to beginning
        this.recentFiles.unshift(fileInfo);
        
        // Keep only max recent files
        if (this.recentFiles.length > this.maxRecentFiles) {
            this.recentFiles = this.recentFiles.slice(0, this.maxRecentFiles);
        }
        
        // Save to localStorage
        this.saveRecentFiles();
    }

    getRecentFiles() {
        return [...this.recentFiles];
    }

    saveRecentFiles() {
        try {
            const simplified = this.recentFiles.map(f => ({
                name: f.name,
                size: f.size,
                lastModified: f.lastModified.getTime()
            }));
            localStorage.setItem('theMentor_recentFiles', JSON.stringify(simplified));
        } catch (error) {
            console.warn('Could not save recent files to localStorage:', error);
        }
    }

    loadRecentFiles() {
        try {
            const stored = localStorage.getItem('theMentor_recentFiles');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.recentFiles = parsed.map(f => ({
                    ...f,
                    lastModified: new Date(f.lastModified)
                }));
            }
        } catch (error) {
            console.warn('Could not load recent files from localStorage:', error);
        }
    }

    clearRecentFiles() {
        this.recentFiles = [];
        localStorage.removeItem('theMentor_recentFiles');
    }
}

// Export singleton
export const fileHandler = new FileHandler();
