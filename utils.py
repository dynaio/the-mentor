"""
Shared utilities for brain analysis
"""

import nibabel as nib
import numpy as np
from scipy.ndimage import zoom
import gzip
import shutil
import tempfile
import os

class NiftiProcessor:
    def __init__(self, target_shape=(256, 256, 128)):
        self.target_shape = target_shape
    
    @staticmethod
    def decompress_gzip(input_path, output_path):
        with gzip.open(input_path, 'rb') as f_in:
            with open(output_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
    
    def load_nifti(self, file_path):
        try:
            is_gzipped = file_path.lower().endswith('.gz')
            
            if is_gzipped:
                temp_nii_path = file_path.replace('.gz', '')
                self.decompress_gzip(file_path, temp_nii_path)
                processing_file = temp_nii_path
            else:
                processing_file = file_path
            
            img = nib.load(processing_file)
            data = img.get_fdata()
            affine = img.affine
            
            if is_gzipped and os.path.exists(temp_nii_path):
                os.unlink(temp_nii_path)
            
            original_shape = data.shape
            
            return data, original_shape, affine, None
            
        except Exception as e:
            return None, None, None, f"Error loading NIfTI: {e}"
    
    def preprocess(self, data):
        original_shape = data.shape
        
        # Resize if necessary
        if data.shape != self.target_shape:
            zoom_factors = [
                self.target_shape[0] / data.shape[0],
                self.target_shape[1] / data.shape[1], 
                self.target_shape[2] / data.shape[2]
            ]
            data_resized = zoom(data, zoom_factors, order=1)
        else:
            data_resized = data
        
        # Normalize data
        data_normalized = (data_resized - data_resized.min()) / (data_resized.max() - data_resized.min() + 1e-8)
        
        return data_normalized, original_shape
    
    def save_temp_nifti(self, data, affine=None):
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.nii')
        img = nib.Nifti1Image(data, affine if affine is not None else np.eye(4))
        nib.save(img, temp_file.name)
        return temp_file.name