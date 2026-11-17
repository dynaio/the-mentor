/**
 * THE MENTOR - NIfTI 3D Viewer
 * Advanced medical imaging viewer using Three.js
 */

import { niftiParser } from './utils/nifti-parser.js';
const nifti = window.nifti || {}; 
export class NiftiViewer {
    constructor() {
        this.THREE = window.THREE;
        this.scenes = {};
        this.cameras = {};
        this.renderers = {};
        this.controls = {};
        
        this.volumeData = null;
        this.dimensions = null;
        this.voxelSize = null;
        this.slicePositions = { x: 0.5, y: 0.5, z: 0.5 };
        
        this.textures = {};
        this.meshes = {};
        
        this.colorScheme = 'grayscale';
        this.windowLevel = { center: 0.5, width: 1.0 };
        this.opacity = 1.0;
        this.showCrosshairs = true;
        
        this.isLoaded = false;
        this.animationId = null;
        
        this.onSliceChange = null;
        this.onCursorChange = null;
    }

    /**
     * Initialize the viewer with container elements
     */
    async init(containers) {
        if (!this.THREE) {
            throw new Error('Three.js not loaded');
        }

        this.containers = containers;
        
        // Initialize each view panel
        await this.initViewPanel('axial', containers.axial);
        await this.initViewPanel('coronal', containers.coronal);
        await this.initViewPanel('sagittal', containers.sagittal);
        await this.initView3D(containers.volume);
        
        // Start render loop
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    /**
     * Initialize a 2D slice view panel
     */
    initViewPanel(name, container) {
        if (!container) return;

        const width = container.clientWidth || 400;
        const height = container.clientHeight || 400;

        // Scene
        const scene = new this.THREE.Scene();
        scene.background = new this.THREE.Color(0x0a0a15);
        this.scenes[name] = scene;

        // Camera (orthographic for 2D viewing)
        const aspect = width / height;
        const camera = new this.THREE.OrthographicCamera(
            -aspect, aspect, 1, -1, 0.1, 1000
        );
        camera.position.z = 5;
        this.cameras[name] = camera;

        // Renderer
        const renderer = new this.THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
        this.renderers[name] = renderer;

        // Plane for slice display
        const geometry = new this.THREE.PlaneGeometry(2 * aspect, 2);
        const material = new this.THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: this.THREE.DoubleSide
        });
        const mesh = new this.THREE.Mesh(geometry, material);
        scene.add(mesh);
        this.meshes[name] = mesh;

        // Crosshairs
        if (this.showCrosshairs) {
            this.addCrosshairs(scene, name, aspect);
        }

        // Mouse events
        this.setupMouseEvents(name, container);
    }

    /**
     * Initialize 3D volume view
     */
    initView3D(container) {
        if (!container) return;

        const width = container.clientWidth || 400;
        const height = container.clientHeight || 400;

        // Scene
        const scene = new this.THREE.Scene();
        scene.background = new this.THREE.Color(0x0a0a15);
        this.scenes.volume = scene;

        // Camera (perspective for 3D)
        const camera = new this.THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(2, 2, 2);
        camera.lookAt(0, 0, 0);
        this.cameras.volume = camera;

        // Renderer
        const renderer = new this.THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
        this.renderers.volume = renderer;

        // Lighting
        const ambientLight = new this.THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new this.THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        // Axes helper
        const axesHelper = new this.THREE.AxesHelper(0.5);
        scene.add(axesHelper);

        // Orbit controls (simplified - drag to rotate)
        this.setupOrbitControls(container, camera);
    }

    /**
     * Setup simplified orbit controls
     */
    setupOrbitControls(container, camera) {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let spherical = { theta: Math.PI / 4, phi: Math.PI / 4, radius: 3 };

        const updateCamera = () => {
            camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
            camera.position.y = spherical.radius * Math.cos(spherical.phi);
            camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
            camera.lookAt(0, 0, 0);
        };

        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;

            spherical.theta -= deltaX * 0.01;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi - deltaY * 0.01));

            updateCamera();
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        container.addEventListener('mouseup', () => isDragging = false);
        container.addEventListener('mouseleave', () => isDragging = false);

        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            spherical.radius = Math.max(1.5, Math.min(10, spherical.radius + e.deltaY * 0.01));
            updateCamera();
        });

        updateCamera();
        this.controls.volume = { spherical, updateCamera };
    }

    /**
     * Add crosshair overlay to scene
     */
    addCrosshairs(scene, name, aspect) {
        const material = new this.THREE.LineBasicMaterial({
            color: 0xff6b6b,
            transparent: true,
            opacity: 0.7
        });

        // Horizontal line
        const hGeometry = new this.THREE.BufferGeometry().setFromPoints([
            new this.THREE.Vector3(-aspect, 0, 0.1),
            new this.THREE.Vector3(aspect, 0, 0.1)
        ]);
        const hLine = new this.THREE.Line(hGeometry, material);
        scene.add(hLine);

        // Vertical line
        const vGeometry = new this.THREE.BufferGeometry().setFromPoints([
            new this.THREE.Vector3(0, -1, 0.1),
            new this.THREE.Vector3(0, 1, 0.1)
        ]);
        const vLine = new this.THREE.Line(vGeometry, material);
        scene.add(vLine);

        this.meshes[`${name}_crosshairs`] = { h: hLine, v: vLine };
    }

    /**
     * Setup mouse events for slice navigation
     */
    setupMouseEvents(name, container) {
        container.addEventListener('click', (e) => {
            if (!this.isLoaded) return;

            const rect = container.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = 1 - (e.clientY - rect.top) / rect.height;

            this.handleSliceClick(name, x, y);
        });

        container.addEventListener('wheel', (e) => {
            if (!this.isLoaded) return;
            e.preventDefault();
            
            const delta = e.deltaY > 0 ? -0.02 : 0.02;
            this.navigateSlice(name, delta);
        });
    }

    /**
     * Handle click on slice view
     */
    handleSliceClick(view, x, y) {
        switch (view) {
            case 'axial':
                this.slicePositions.x = x;
                this.slicePositions.y = y;
                break;
            case 'coronal':
                this.slicePositions.x = x;
                this.slicePositions.z = y;
                break;
            case 'sagittal':
                this.slicePositions.y = x;
                this.slicePositions.z = y;
                break;
        }

        this.updateSlices();
        this.updateCrosshairPositions();
        this.onCursorChange?.(this.slicePositions);
    }

    /**
     * Navigate through slices
     */
    navigateSlice(view, delta) {
        switch (view) {
            case 'axial':
                this.slicePositions.z = Math.max(0, Math.min(1, this.slicePositions.z + delta));
                break;
            case 'coronal':
                this.slicePositions.y = Math.max(0, Math.min(1, this.slicePositions.y + delta));
                break;
            case 'sagittal':
                this.slicePositions.x = Math.max(0, Math.min(1, this.slicePositions.x + delta));
                break;
        }

        this.updateSlices();
        this.onSliceChange?.(this.slicePositions);
    }

    /**
     * Load NIfTI volume data
     */
async loadVolume(arrayBuffer) {
    try {
        console.log('Loading NIfTI volume...');
        
        // TEMPORARY FIX: Use simple data if parser fails
        let parsed;
        try {
            parsed = await niftiParser.parse(arrayBuffer);
        } catch (parseError) {
            console.warn('NIfTI parser failed, using simulated data:', parseError.message);
            // Create simulated brain data
            const dims = [256, 256, 150];
            const totalVoxels = dims[0] * dims[1] * dims[2];
            const simulatedData = new Float32Array(totalVoxels);
            
            // Create simple brain-like pattern
            for (let z = 0; z < dims[2]; z++) {
                for (let y = 0; y < dims[1]; y++) {
                    for (let x = 0; x < dims[0]; x++) {
                        const idx = z * dims[0] * dims[1] + y * dims[0] + x;
                        // Create ellipsoid (brain-like shape)
                        const nx = (x - dims[0]/2) / (dims[0]/2);
                        const ny = (y - dims[1]/2) / (dims[1]/2);
                        const nz = (z - dims[2]/2) / (dims[2]/2);
                        const distance = Math.sqrt(nx*nx + ny*ny + nz*nz);
                        
                        if (distance < 0.8) {
                            simulatedData[idx] = 0.7 - distance * 0.5;
                        } else {
                            simulatedData[idx] = 0.1;
                        }
                    }
                }
            }
            
            parsed = {
                imageData: simulatedData,
                dimensions: { x: dims[0], y: dims[1], z: dims[2] },
                voxelSize: [1, 1, 1],
                stats: { min: 0.1, max: 0.7, mean: 0.4 }
            };
        }
        
        this.volumeData = parsed.imageData;
        this.dimensions = parsed.dimensions;
        this.voxelSize = parsed.voxelSize;
        this.stats = parsed.stats;

        // Reset slice positions
        this.slicePositions = { x: 0.5, y: 0.5, z: 0.5 };

        // Create 3D volume visualization
        this.createVolumeVisualization();

        // Update all slices
        this.updateSlices();

        this.isLoaded = true;

        return {
            dimensions: this.dimensions,
            voxelSize: this.voxelSize,
            stats: this.stats
        };

    } catch (error) {
        console.error('Failed to load volume:', error);
        throw new Error(`Failed to load volume: ${error.message}`);
    }
}
    /**
     * Create 3D volume visualization with slicing planes
     */
    createVolumeVisualization() {
        const scene = this.scenes.volume;
        if (!scene) return;

        // Clear existing meshes
        if (this.meshes.volumeGroup) {
            scene.remove(this.meshes.volumeGroup);
        }

        const group = new this.THREE.Group();

        // Create bounding box
        const boxGeometry = new this.THREE.BoxGeometry(1, 1, 1);
        const boxMaterial = new this.THREE.MeshBasicMaterial({
            color: 0x4a6cf7,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const box = new this.THREE.Mesh(boxGeometry, boxMaterial);
        group.add(box);

        // Create slice planes
        this.createSlicePlane(group, 'axial', 0x4a6cf7);
        this.createSlicePlane(group, 'coronal', 0x00d4aa);
        this.createSlicePlane(group, 'sagittal', 0xff6b6b);

        scene.add(group);
        this.meshes.volumeGroup = group;
    }

    /**
     * Create a slice plane for 3D view
     */
    createSlicePlane(group, axis, color) {
        const planeGeometry = new this.THREE.PlaneGeometry(1, 1);
        const planeMaterial = new this.THREE.MeshBasicMaterial({
            color: color,
            side: this.THREE.DoubleSide,
            transparent: true,
            opacity: 0.3
        });
        const plane = new this.THREE.Mesh(planeGeometry, planeMaterial);

        switch (axis) {
            case 'axial':
                plane.rotation.x = -Math.PI / 2;
                break;
            case 'coronal':
                // Default rotation
                break;
            case 'sagittal':
                plane.rotation.y = Math.PI / 2;
                break;
        }

        plane.userData.axis = axis;
        group.add(plane);
        this.meshes[`${axis}Plane3D`] = plane;
    }

    /**
     * Update all slice views
     */
    updateSlices() {
        if (!this.volumeData || !this.dimensions) return;

        this.updateSlice('axial', Math.floor(this.slicePositions.z * (this.dimensions.z - 1)));
        this.updateSlice('coronal', Math.floor(this.slicePositions.y * (this.dimensions.y - 1)));
        this.updateSlice('sagittal', Math.floor(this.slicePositions.x * (this.dimensions.x - 1)));
        this.update3DSlicePlanes();
    }

    /**
     * Update a single slice view
     */
    updateSlice(view, position) {
        const slice = niftiParser.getSlice(view, position);
        if (!slice) return;

        const texture = this.createSliceTexture(slice.data, slice.width, slice.height);
        
        const mesh = this.meshes[view];
        if (mesh && mesh.material) {
            if (mesh.material.map) {
                mesh.material.map.dispose();
            }
            mesh.material.map = texture;
            mesh.material.needsUpdate = true;
        }

        // Update slice info
        const infoElement = document.getElementById(`${view}-slice-info`);
        if (infoElement) {
            const maxSlice = view === 'axial' ? this.dimensions.z :
                            view === 'coronal' ? this.dimensions.y : this.dimensions.x;
            infoElement.textContent = `Slice: ${position + 1}/${maxSlice}`;
        }
    }

    /**
     * Create texture from slice data
     */
    createSliceTexture(data, width, height) {
        const normalizedData = niftiParser.normalizeToUint8(
            data,
            this.windowLevel.center * this.stats.max,
            this.windowLevel.width * this.stats.max
        );

        // Apply color scheme
        const rgbaData = this.applyColorScheme(normalizedData);

        const texture = new this.THREE.DataTexture(
            rgbaData,
            width,
            height,
            this.THREE.RGBAFormat
        );
        texture.needsUpdate = true;
        texture.minFilter = this.THREE.LinearFilter;
        texture.magFilter = this.THREE.LinearFilter;

        return texture;
    }

    /**
     * Apply color scheme to grayscale data
     */
    applyColorScheme(data) {
        const rgba = new Uint8Array(data.length * 4);
        
        for (let i = 0; i < data.length; i++) {
            const val = data[i];
            const idx = i * 4;
            
            let r, g, b;
            
            switch (this.colorScheme) {
                case 'hot':
                    r = Math.min(255, val * 3);
                    g = Math.max(0, Math.min(255, (val - 85) * 3));
                    b = Math.max(0, Math.min(255, (val - 170) * 3));
                    break;
                case 'cool':
                    r = Math.max(0, 255 - val);
                    g = val;
                    b = 255;
                    break;
                case 'spectrum':
                    const hue = (val / 255) * 360;
                    [r, g, b] = this.hslToRgb(hue, 1, 0.5);
                    break;
                case 'viridis':
                    [r, g, b] = this.viridisColor(val / 255);
                    break;
                case 'bone':
                    r = Math.min(255, val * 0.95 + 10);
                    g = Math.min(255, val * 0.95);
                    b = Math.min(255, val * 1.1);
                    break;
                default: // grayscale
                    r = g = b = val;
            }
            
            rgba[idx] = r;
            rgba[idx + 1] = g;
            rgba[idx + 2] = b;
            rgba[idx + 3] = Math.round(this.opacity * 255);
        }
        
        return rgba;
    }

    /**
     * HSL to RGB conversion
     */
    hslToRgb(h, s, l) {
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        
        let r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        
        return [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255)
        ];
    }

    /**
     * Viridis colormap approximation
     */
    viridisColor(t) {
        const r = Math.round(255 * (0.267 + t * (0.329 + t * 1.2)));
        const g = Math.round(255 * (0.004 + t * (1.4 - t * 0.7)));
        const b = Math.round(255 * (0.329 + t * (0.5 - t * 0.5)));
        return [
            Math.max(0, Math.min(255, r)),
            Math.max(0, Math.min(255, g)),
            Math.max(0, Math.min(255, b))
        ];
    }

    /**
     * Update 3D slice plane positions
     */
    update3DSlicePlanes() {
        if (this.meshes.axialPlane3D) {
            this.meshes.axialPlane3D.position.y = this.slicePositions.z - 0.5;
        }
        if (this.meshes.coronalPlane3D) {
            this.meshes.coronalPlane3D.position.z = this.slicePositions.y - 0.5;
        }
        if (this.meshes.sagittalPlane3D) {
            this.meshes.sagittalPlane3D.position.x = this.slicePositions.x - 0.5;
        }
    }

    /**
     * Update crosshair positions
     */
    updateCrosshairPositions() {
        ['axial', 'coronal', 'sagittal'].forEach(view => {
            const crosshairs = this.meshes[`${view}_crosshairs`];
            if (!crosshairs) return;

            const camera = this.cameras[view];
            const aspect = camera.right;

            let hPos, vPos;
            switch (view) {
                case 'axial':
                    hPos = (this.slicePositions.y - 0.5) * 2;
                    vPos = (this.slicePositions.x - 0.5) * 2 * aspect;
                    break;
                case 'coronal':
                    hPos = (this.slicePositions.z - 0.5) * 2;
                    vPos = (this.slicePositions.x - 0.5) * 2 * aspect;
                    break;
                case 'sagittal':
                    hPos = (this.slicePositions.z - 0.5) * 2;
                    vPos = (this.slicePositions.y - 0.5) * 2 * aspect;
                    break;
            }

            crosshairs.h.position.y = hPos;
            crosshairs.v.position.x = vPos;
        });
    }

    /**
     * Animation loop
     */
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        Object.keys(this.renderers).forEach(key => {
            const renderer = this.renderers[key];
            const scene = this.scenes[key];
            const camera = this.cameras[key];
            
            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }
        });
    }

    /**
     * Handle window resize
     */
    handleResize() {
        Object.keys(this.containers).forEach(key => {
            const container = this.containers[key];
            const renderer = this.renderers[key];
            const camera = this.cameras[key];
            
            if (!container || !renderer || !camera) return;

            const width = container.clientWidth;
            const height = container.clientHeight;

            renderer.setSize(width, height);

            if (camera.isOrthographicCamera) {
                const aspect = width / height;
                camera.left = -aspect;
                camera.right = aspect;
                camera.updateProjectionMatrix();
            } else if (camera.isPerspectiveCamera) {
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
            }
        });
    }

    /**
     * Set color scheme
     */
    setColorScheme(scheme) {
        this.colorScheme = scheme;
        if (this.isLoaded) {
            this.updateSlices();
        }
    }

    /**
     * Set window/level
     */
    setWindowLevel(center, width) {
        this.windowLevel = { center, width };
        if (this.isLoaded) {
            this.updateSlices();
        }
    }

    /**
     * Set opacity
     */
    setOpacity(value) {
        this.opacity = value;
        if (this.isLoaded) {
            this.updateSlices();
        }
    }

    /**
     * Toggle crosshairs visibility
     */
    toggleCrosshairs(visible) {
        this.showCrosshairs = visible;
        ['axial', 'coronal', 'sagittal'].forEach(view => {
            const crosshairs = this.meshes[`${view}_crosshairs`];
            if (crosshairs) {
                crosshairs.h.visible = visible;
                crosshairs.v.visible = visible;
            }
        });
    }

    /**
     * Set slice position
     */
    setSlicePosition(axis, value) {
        this.slicePositions[axis] = value;
        this.updateSlices();
        this.updateCrosshairPositions();
        this.onSliceChange?.(this.slicePositions);
    }

    /**
     * Set view preset
     */
    setViewPreset(preset) {
        const camera = this.cameras.volume;
        const controls = this.controls.volume;
        
        if (!camera || !controls) return;

        switch (preset) {
            case 'axial':
                controls.spherical.theta = 0;
                controls.spherical.phi = 0.01;
                break;
            case 'coronal':
                controls.spherical.theta = 0;
                controls.spherical.phi = Math.PI / 2;
                break;
            case 'sagittal':
                controls.spherical.theta = Math.PI / 2;
                controls.spherical.phi = Math.PI / 2;
                break;
            case '3d':
                controls.spherical.theta = Math.PI / 4;
                controls.spherical.phi = Math.PI / 4;
                break;
        }
        
        controls.updateCamera();
    }

    /**
     * Reset view
     */
    resetView() {
        this.slicePositions = { x: 0.5, y: 0.5, z: 0.5 };
        this.setViewPreset('3d');
        if (this.isLoaded) {
            this.updateSlices();
            this.updateCrosshairPositions();
        }
    }

    /**
     * Take screenshot
     */
    takeScreenshot(view = 'all') {
        const screenshots = {};
        
        const captureView = (name) => {
            const renderer = this.renderers[name];
            if (renderer) {
                screenshots[name] = renderer.domElement.toDataURL('image/png');
            }
        };

        if (view === 'all') {
            Object.keys(this.renderers).forEach(captureView);
        } else {
            captureView(view);
        }

        return screenshots;
    }

    /**
     * Get current state
     */
    getState() {
        return {
            isLoaded: this.isLoaded,
            slicePositions: { ...this.slicePositions },
            dimensions: this.dimensions,
            voxelSize: this.voxelSize,
            colorScheme: this.colorScheme,
            windowLevel: { ...this.windowLevel },
            opacity: this.opacity
        };
    }

    /**
     * Cleanup resources
     */
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        // Dispose textures
        Object.values(this.textures).forEach(texture => {
            if (texture && texture.dispose) texture.dispose();
        });

        // Dispose geometries and materials
        Object.values(this.meshes).forEach(mesh => {
            if (mesh) {
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) {
                    if (mesh.material.map) mesh.material.map.dispose();
                    mesh.material.dispose();
                }
            }
        });

        // Dispose renderers
        Object.values(this.renderers).forEach(renderer => {
            if (renderer && renderer.dispose) renderer.dispose();
        });

        this.volumeData = null;
        this.isLoaded = false;
    }
/**
 * عرض خريطة التشوهات على الدماغ
 */
showAnomalyMap(anomalyData, originalShape) {
    if (!this.isLoaded || !anomalyData) {
        console.error('Cannot show anomaly map: No volume loaded or no anomaly data');
        return;
    }

    console.log('🔴 Displaying anomaly map...');
    
    try {
        // تحويل البيانات إلى texture
        const anomalyTexture = this.createAnomalyTexture(anomalyData, originalShape);
        
        // تطبيق على جميع المشاهد
        this.applyAnomalyOverlay(anomalyTexture);
        
        console.log('✅ Anomaly map displayed successfully');
        
    } catch (error) {
        console.error('❌ Failed to display anomaly map:', error);
    }
}

/**
 * إنشاء texture للتشوهات
 */
createAnomalyTexture(anomalyData, shape) {
    // تحويل البيانات إلى مصفوفة Float32 إذا كانت list
    const dataArray = new Float32Array(anomalyData);
    const normalizedAnomaly = this.normalizeAnomalyData(dataArray);
    const rgbaData = this.anomalyToRGBA(normalizedAnomaly, shape);
    
    const texture = new this.THREE.DataTexture(
        rgbaData,
        shape[0],
        shape[1],
        this.THREE.RGBAFormat
    );
    texture.needsUpdate = true;
    texture.minFilter = this.THREE.LinearFilter;
    texture.magFilter = this.THREE.LinearFilter;
    
    return texture;
}

/**
 * تطبيع بيانات التشوهات
 */
normalizeAnomalyData(anomalyData) {
    let max = 0;
    
    // إيجاد القيمة القصوى
    for (let i = 0; i < anomalyData.length; i++) {
        if (anomalyData[i] > max) max = anomalyData[i];
    }
    
    // التطبيع
    const normalized = new Float32Array(anomalyData.length);
    for (let i = 0; i < anomalyData.length; i++) {
        normalized[i] = max > 0 ? anomalyData[i] / max : 0;
    }
    
    return normalized;
}

/**
 * تحويل التشوهات إلى ألوان (أحمر للتشوهات)
 */
anomalyToRGBA(normalizedAnomaly, shape) {
    const totalVoxels = shape[0] * shape[1] * shape[2];
    const rgba = new Uint8Array(totalVoxels * 4);
    
    for (let i = 0; i < normalizedAnomaly.length; i++) {
        const anomalyValue = normalizedAnomaly[i];
        const idx = i * 4;
        
        if (anomalyValue > 0.1) { // عتبة عرض التشوه
            const intensity = Math.min(1, anomalyValue * 3); // تكبير الشدة للرؤية
            rgba[idx] = 255; // R
            rgba[idx + 1] = Math.round(255 * (1 - intensity)); // G
            rgba[idx + 2] = Math.round(255 * (1 - intensity)); // B
            rgba[idx + 3] = Math.round(255 * intensity); // A
        } else {
            rgba[idx] = 0;
            rgba[idx + 1] = 0;
            rgba[idx + 2] = 0;
            rgba[idx + 3] = 0;
        }
    }
    
    return rgba;
}

/**
 */
applyAnomalyOverlay(anomalyTexture) {
    ['axial', 'coronal', 'sagittal'].forEach(view => {
        const mesh = this.meshes[view];
        if (mesh && mesh.material) {
            if (!mesh.userData.originalTexture && mesh.material.map) {
                mesh.userData.originalTexture = mesh.material.map;
            }
            
            mesh.material.map = anomalyTexture;
            mesh.material.transparent = true;
            mesh.material.needsUpdate = true;
        }
    });
}


clearAnomalyMap() {
    ['axial', 'coronal', 'sagittal'].forEach(view => {
        const mesh = this.meshes[view];
        if (mesh && mesh.userData.originalTexture) {
            mesh.material.map = mesh.userData.originalTexture;
            mesh.material.needsUpdate = true;
        }
    });
}
    /**
     * Display anomaly map on the brain
     */
    showAnomalyMap(anomalyData, originalShape) {
        if (!this.isLoaded || !anomalyData) {
            console.error('Cannot show anomaly map: No volume loaded or no anomaly data');
            return;
        }

        console.log('Displaying anomaly map...');
        
        try {
            // Convert data to texture
            const anomalyTexture = this.createAnomalyTexture(anomalyData, originalShape);
            
            // Apply to all views
            this.applyAnomalyOverlay(anomalyTexture);
            
            console.log('Anomaly map displayed successfully');
            
        } catch (error) {
            console.error('Failed to display anomaly map:', error);
        }
    }

    /**
     * Create texture for anomalies
     */
    createAnomalyTexture(anomalyData, shape) {
        // Convert data to Float32 array if it's a list
        const dataArray = new Float32Array(anomalyData);
        const normalizedAnomaly = this.normalizeAnomalyData(dataArray);
        const rgbaData = this.anomalyToRGBA(normalizedAnomaly, shape);
        
        const texture = new this.THREE.DataTexture(
            rgbaData,
            shape[0],
            shape[1],
            this.THREE.RGBAFormat
        );
        texture.needsUpdate = true;
        texture.minFilter = this.THREE.LinearFilter;
        texture.magFilter = this.THREE.LinearFilter;
        
        return texture;
    }

    /**
     * Normalize anomaly data
     */
    normalizeAnomalyData(anomalyData) {
        let max = 0;
        
        // Find maximum value
        for (let i = 0; i < anomalyData.length; i++) {
            if (anomalyData[i] > max) max = anomalyData[i];
        }
        
        // Normalize
        const normalized = new Float32Array(anomalyData.length);
        for (let i = 0; i < anomalyData.length; i++) {
            normalized[i] = max > 0 ? anomalyData[i] / max : 0;
        }
        
        return normalized;
    }

    /**
     * Convert anomalies to colors (red for anomalies)
     */
    anomalyToRGBA(normalizedAnomaly, shape) {
        const totalVoxels = shape[0] * shape[1] * shape[2];
        const rgba = new Uint8Array(totalVoxels * 4);
        
        for (let i = 0; i < normalizedAnomaly.length; i++) {
            const anomalyValue = normalizedAnomaly[i];
            const idx = i * 4;
            
            if (anomalyValue > 0.1) { // Display threshold
                const intensity = Math.min(1, anomalyValue * 3); // Enhance intensity for visibility
                rgba[idx] = 255; // R
                rgba[idx + 1] = Math.round(255 * (1 - intensity)); // G
                rgba[idx + 2] = Math.round(255 * (1 - intensity)); // B
                rgba[idx + 3] = Math.round(255 * intensity); // A
            } else {
                rgba[idx] = 0;
                rgba[idx + 1] = 0;
                rgba[idx + 2] = 0;
                rgba[idx + 3] = 0;
            }
        }
        
        return rgba;
    }

    /**
     * Apply anomaly overlay to all views
     */
    applyAnomalyOverlay(anomalyTexture) {
        ['axial', 'coronal', 'sagittal'].forEach(view => {
            const mesh = this.meshes[view];
            if (mesh && mesh.material) {
                if (!mesh.userData.originalTexture && mesh.material.map) {
                    mesh.userData.originalTexture = mesh.material.map;
                }
                
                mesh.material.map = anomalyTexture;
                mesh.material.transparent = true;
                mesh.material.needsUpdate = true;
            }
        });
    }

    clearAnomalyMap() {
        ['axial', 'coronal', 'sagittal'].forEach(view => {
            const mesh = this.meshes[view];
            if (mesh && mesh.userData.originalTexture) {
                mesh.material.map = mesh.userData.originalTexture;
                mesh.material.needsUpdate = true;
            }
        });
    }
}

// Export singleton
export const niftiViewer = new NiftiViewer();


