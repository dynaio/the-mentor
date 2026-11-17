"""
The Mentor Advanced API Server
Hybrid brain analysis with Mantis and Octopus models
"""

import os
import torch
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import tempfile
import time
import json

# Import modules
from mantis_module import MantisDetector
from octopus_module import OctopusClassifier
from anomaly_isolation import AnomalyIsolator
from utils import NiftiProcessor

# ==================== CONFIGURATION ====================
# Use absolute paths to ensure models are found
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MANTIS_MODEL_PATH = os.path.join(BASE_DIR, "models", "mantis_v2.pth")
OCTOPUS_MODEL_PATH = os.path.join(BASE_DIR, "models", "octopus_final_epoch60.pth")
TARGET_SHAPE = (256, 256, 128)

# Performance optimization settings
torch.set_num_threads(2)  # Limit CPU threads
torch.set_grad_enabled(False)  # Disable gradients for inference

app = Flask(__name__)
CORS(app, origins=["http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:5000"], supports_credentials=True)

# ==================== INITIALIZE MODULES ====================
print("Initializing The Mentor Hybrid Brain Analysis System...")
print(f"Base directory: {BASE_DIR}")
print(f"Mantis model path: {MANTIS_MODEL_PATH}")
print(f"Octopus model path: {OCTOPUS_MODEL_PATH}")
print(f"Mantis exists: {os.path.exists(MANTIS_MODEL_PATH)}")
print(f"Octopus exists: {os.path.exists(OCTOPUS_MODEL_PATH)}")

# Initialize processors
nifti_processor = NiftiProcessor(target_shape=TARGET_SHAPE)
anomaly_isolator = AnomalyIsolator(difference_threshold=0.001)

# Initialize models (lazy loading)
mantis_detector = None
octopus_classifier = None

def get_mantis_detector():
    global mantis_detector
    if mantis_detector is None:
        print("Loading Mantis detector...")
        mantis_detector = MantisDetector(MANTIS_MODEL_PATH)
        try:
            mantis_detector.load_model()
            print("Mantis model loaded successfully")
        except Exception as e:
            print(f"Error loading Mantis model: {e}")
            raise
    return mantis_detector

def get_octopus_classifier():
    global octopus_classifier
    if octopus_classifier is None:
        print("Loading Octopus classifier...")
        octopus_classifier = OctopusClassifier(OCTOPUS_MODEL_PATH)
        try:
            octopus_classifier.load_model()
            print("Octopus model loaded successfully")
        except Exception as e:
            print(f"Error loading Octopus model: {e}")
            raise
    return octopus_classifier

print("System initialized successfully!")

def compress_data_for_json(data, max_size=64):
    """Compress large arrays by sampling or reducing resolution"""
    if isinstance(data, np.ndarray):
        shape = data.shape
        # For 3D arrays, take a central slice for preview
        if len(shape) == 3:
            # Take central slices in each dimension
            if shape[0] > max_size:
                step_x = shape[0] // max_size
                data = data[::step_x, :, :]
            if shape[1] > max_size:
                step_y = shape[1] // max_size
                data = data[:, ::step_y, :]
            if shape[2] > max_size:
                step_z = shape[2] // max_size
                data = data[:, :, ::step_z]
        # Convert to list and reduce precision
        return data.tolist()
    return data

# ==================== FLASK API ROUTES ====================
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'message': 'The Mentor Hybrid System Ready',
        'models': {
            'mantis': os.path.exists(MANTIS_MODEL_PATH),
            'octopus': os.path.exists(OCTOPUS_MODEL_PATH)
        }
    })

@app.route('/api/analyze', methods=['POST'])
def analyze_nifti():
    start_time = time.time()
    
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        print(f"Processing file: {file.filename}")
        
        # Save file temporarily
        file_extension = '.nii.gz' if file.filename.lower().endswith('.gz') else '.nii'
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
            file.save(tmp_file.name)
            
            try:
                # Load and preprocess NIfTI
                data, original_shape, affine, error = nifti_processor.load_nifti(tmp_file.name)
                if error:
                    return jsonify({'success': False, 'error': error}), 400
                
                # Store original data before processing
                original_data = data.copy()
                
                processed_data, _ = nifti_processor.preprocess(data)
                
                # Convert to tensor with correct shape: [1, 1, depth, height, width]
                input_tensor = torch.FloatTensor(processed_data).unsqueeze(0).unsqueeze(0)
                
                # Step 1: Mantis analysis
                print("Running Mantis analysis...")
                mantis = get_mantis_detector()
                mantis_results = mantis.analyze(input_tensor, original_data)
                
                # ENSURE ALL REQUIRED FIELDS ARE PRESENT
                mantis_results['mse'] = float(mantis_results.get('mse', 0.0))
                mantis_results['mae'] = float(mantis_results.get('mae', 0.0))
                mantis_results['psnr'] = float(mantis_results.get('psnr', 0.0))
                mantis_results['threshold'] = float(mantis_results.get('threshold', 0.0015))
                mantis_results['confidence'] = mantis_results.get('confidence', 'UNKNOWN')
                mantis_results['performance'] = mantis_results.get('performance', 'UNKNOWN')
                mantis_results['is_normal'] = bool(mantis_results.get('is_normal', True))
                mantis_results['anomaly_score'] = float(mantis_results.get('anomaly_score', 0.0))
                
                # Add compressed data for frontend
                if 'difference_map' in mantis_results:
                    difference_map = np.array(mantis_results['difference_map'])
                    # Take every 4th slice to reduce size
                    compressed_diff = difference_map[::4, ::4, ::4].tolist()
                    mantis_results['difference_map_compressed'] = compressed_diff
                    del mantis_results['difference_map']
                
                # Add sample of original data
                mantis_results['original_data_sample'] = original_data[::8, ::8, ::8].tolist()
                
                # Prepare response
                response = {
                    'success': True,
                    'analysis_type': 'mantis_only',
                    'mantis': mantis_results,
                    'shape': list(original_shape),
                    'processed_shape': list(processed_data.shape),
                    'file_name': file.filename,
                    'processing_time': time.time() - start_time,
                    'anomalies': []  # Initialize empty anomalies array
                }
                
                # If anomaly detected, run Octopus analysis
                if not mantis_results['is_normal']:
                    print("Anomaly detected, running Octopus analysis...")
                    
                    # Step 2: Isolate anomaly region
                    difference_map_full = mantis.get_difference_map(input_tensor)
                    
                    # IMPORTANT: Make sure difference_map has correct shape
                    if difference_map_full.shape != original_data.shape:
                        print(f"Reshaping difference map from {difference_map_full.shape} to {original_data.shape}")
                        from scipy.ndimage import zoom
                        zoom_factors = [
                            original_data.shape[0] / difference_map_full.shape[0],
                            original_data.shape[1] / difference_map_full.shape[1],
                            original_data.shape[2] / difference_map_full.shape[2]
                        ]
                        difference_map_full = zoom(difference_map_full, zoom_factors, order=1)
                    
                    isolated_anomaly, anomaly_mask, bounding_box = anomaly_isolator.isolate_anomaly_region(
                        original_data, difference_map_full
                    )
                    
                    if isolated_anomaly is not None:
                        # Step 3: Prepare for Octopus
                        octopus_input = anomaly_isolator.prepare_for_octopus(
                            isolated_anomaly, target_shape=(128, 128, 128)
                        )
                        
                        if octopus_input is not None:
                            # Step 4: Octopus classification
                            octopus = get_octopus_classifier()
                            
                            # Create tensor with correct shape
                            if octopus_input.ndim == 3:
                                octopus_input_tensor = torch.FloatTensor(octopus_input).unsqueeze(0).unsqueeze(0)
                            else:
                                # Handle other dimensions
                                octopus_input_tensor = torch.FloatTensor(octopus_input)
                                while octopus_input_tensor.dim() < 5:
                                    octopus_input_tensor = octopus_input_tensor.unsqueeze(0)
                            
                            print(f"Octopus tensor shape: {octopus_input_tensor.shape}")
                            
                            octopus_results = octopus.classify(octopus_input_tensor)
                            
                            # Update response
                            response['analysis_type'] = 'hybrid'
                            response['octopus'] = octopus_results
                            response['anomaly_isolation'] = {
                                'has_isolated_region': True,
                                'bounding_box': bounding_box,
                                'isolated_shape': list(isolated_anomaly.shape)
                            }
                            
                            # Add anomaly to anomalies array
                            response['anomalies'] = [{
                                'type': octopus_results.get('diagnosis', 'unknown'),
                                'confidence': float(octopus_results.get('confidence', 0)),
                                'severity': 'high' if float(octopus_results.get('calculated_percentage', 0)) > 5 else 'medium',
                                'location': bounding_box if bounding_box else [0, 0, 0, 0, 0, 0],
                                'percentage': float(octopus_results.get('calculated_percentage', 0))
                            }]
                        else:
                            response['anomaly_isolation'] = {
                                'has_isolated_region': False,
                                'message': 'Could not prepare anomaly region for Octopus'
                            }
                            response['anomalies'] = [{
                                'type': 'detected',
                                'confidence': float(mantis_results['anomaly_score']),
                                'severity': 'medium',
                                'location': [0, 0, 0, 0, 0, 0],
                                'percentage': 0.0
                            }]
                    else:
                        response['anomaly_isolation'] = {
                            'has_isolated_region': False,
                            'message': 'No significant anomaly region isolated'
                        }
                        response['anomalies'] = [{
                            'type': 'detected',
                            'confidence': float(mantis_results['anomaly_score']),
                            'severity': 'low',
                            'location': [0, 0, 0, 0, 0, 0],
                            'percentage': 0.0
                        }]
                else:
                    # Normal case - ensure anomalies is an empty array
                    response['anomalies'] = []
                
                # Clean up temporary file
                os.unlink(tmp_file.name)
                
                total_time = time.time() - start_time
                print(f"Analysis complete - Normal: {mantis_results['is_normal']}")
                print(f"Total processing time: {total_time:.2f} seconds")
                
                response['total_processing_time'] = total_time
                response['processing_time'] = total_time  # Add alias for compatibility
                
                return jsonify(response)
                
            except Exception as e:
                # Clean up temporary file in case of error
                if os.path.exists(tmp_file.name):
                    os.unlink(tmp_file.name)
                print(f"Error during analysis: {str(e)}")
                return jsonify({'success': False, 'error': str(e)}), 500
            
    except Exception as e:
        print(f"Analysis error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/analyze_detailed', methods=['POST'])
def analyze_detailed():
    """Direct Octopus analysis for pre-processed/cropped NIfTI files"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        # Save file temporarily
        file_extension = '.nii.gz' if file.filename.lower().endswith('.gz') else '.nii'
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
            file.save(tmp_file.name)
            
            try:
                # Load and preprocess for Octopus
                data, original_shape, affine, error = nifti_processor.load_nifti(tmp_file.name)
                if error:
                    return jsonify({'success': False, 'error': error}), 400
                
                # Ensure the data is approximately 128x128x128
                if data.shape != (128, 128, 128):
                    print(f"Resizing from {data.shape} to (128, 128, 128)")
                    from scipy.ndimage import zoom
                    zoom_factors = [128/data.shape[0], 128/data.shape[1], 128/data.shape[2]]
                    data = zoom(data, zoom_factors, order=1)
                
                # Create tensor with correct shape
                octopus_input_tensor = torch.FloatTensor(data).unsqueeze(0).unsqueeze(0)
                
                # Run Octopus classification
                octopus = get_octopus_classifier()
                octopus_results = octopus.classify(octopus_input_tensor)
                
                # Clean up
                os.unlink(tmp_file.name)
                
                return jsonify({
                    'success': True,
                    'analysis_type': 'octopus_only',
                    'octopus': octopus_results,
                    'input_shape': list(data.shape),
                    'anomalies': [{
                        'type': octopus_results.get('diagnosis', 'unknown'),
                        'confidence': float(octopus_results.get('confidence', 0)),
                        'severity': 'high',
                        'location': [0, 0, 0, 0, 0, 0],
                        'percentage': float(octopus_results.get('calculated_percentage', 0))
                    }]
                })
                
            except Exception as e:
                if os.path.exists(tmp_file.name):
                    os.unlink(tmp_file.name)
                return jsonify({'success': False, 'error': str(e)}), 500
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/')
def home():
    return jsonify({
        'message': 'The Mentor Hybrid Brain Analysis API Server', 
        'status': 'running',
        'models': {
            'mantis': os.path.exists(MANTIS_MODEL_PATH),
            'octopus': os.path.exists(OCTOPUS_MODEL_PATH)
        },
        'endpoints': {
            'GET /api/health': 'Check system status',
            'POST /api/analyze': 'Full hybrid analysis',
            'POST /api/analyze_detailed': 'Direct Octopus analysis'
        }
    })

if __name__ == '__main__':
    print("Starting The Mentor Hybrid Brain Analysis API Server...")
    print(f"Mantis model: {'Found' if os.path.exists(MANTIS_MODEL_PATH) else 'Not found'}")
    print(f"Octopus model: {'Found' if os.path.exists(OCTOPUS_MODEL_PATH) else 'Not found'}")
    
    # Performance hints
    print("Performance settings:")
    print(f"PyTorch threads: {torch.get_num_threads()}")
    print(f"PyTorch gradients disabled: {not torch.is_grad_enabled()}")
    
    print("Server running on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)