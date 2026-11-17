"""
Anomaly Region Isolation Module
Extract suspicious regions from difference maps
"""

import numpy as np
from scipy import ndimage
import torch

class AnomalyIsolator:
    def __init__(self, difference_threshold=0.0005):
        self.difference_threshold = difference_threshold
        self.min_lesion_size = 5  # Minimum voxels to consider a lesion
    
    def create_binary_mask(self, difference_map):
        binary_mask = (difference_map > self.difference_threshold).astype(np.float32)
        
        # Remove small noise
        labeled_mask, num_features = ndimage.label(binary_mask)
        for i in range(1, num_features + 1):
            if np.sum(labeled_mask == i) < self.min_lesion_size:
                binary_mask[labeled_mask == i] = 0
        
        return binary_mask
    
    def isolate_anomaly_region(self, original_data, difference_map):
        binary_mask = self.create_binary_mask(difference_map)
        
        # If no anomaly detected
        if np.sum(binary_mask) == 0:
            return None, None, None
        
        # Get bounding box of anomaly region
        coords = np.where(binary_mask > 0)
        
        if len(coords[0]) == 0:
            return None, None, None
        
        min_z, max_z = np.min(coords[0]), np.max(coords[0])
        min_y, max_y = np.min(coords[1]), np.max(coords[1])
        min_x, max_x = np.min(coords[2]), np.max(coords[2])
        
        # Add padding around the region
        padding = 5
        min_z = max(0, min_z - padding)
        max_z = min(original_data.shape[0] - 1, max_z + padding)
        min_y = max(0, min_y - padding)
        max_y = min(original_data.shape[1] - 1, max_y + padding)
        min_x = max(0, min_x - padding)
        max_x = min(original_data.shape[2] - 1, max_x + padding)
        
        # Crop the region
        cropped_region = original_data[min_z:max_z+1, min_y:max_y+1, min_x:max_x+1]
        cropped_mask = binary_mask[min_z:max_z+1, min_y:max_y+1, min_x:max_x+1]
        
        # Apply mask to get isolated anomaly
        isolated_anomaly = cropped_region * cropped_mask
        
        bounding_box = {
            'min_z': int(min_z),
            'max_z': int(max_z),
            'min_y': int(min_y),
            'max_y': int(max_y),
            'min_x': int(min_x),
            'max_x': int(max_x),
            'shape': cropped_region.shape
        }
        
        return isolated_anomaly, cropped_mask, bounding_box
    
    def prepare_for_octopus(self, isolated_anomaly, target_shape=(128, 128, 128)):
        if isolated_anomaly is None:
            return None
        
        # Normalize to 0-1
        if isolated_anomaly.max() > isolated_anomaly.min():
            normalized = (isolated_anomaly - isolated_anomaly.min()) / (isolated_anomaly.max() - isolated_anomaly.min() + 1e-8)
        else:
            normalized = isolated_anomaly
        
        # Resize to target shape if needed
        if normalized.shape != target_shape:
            zoom_factors = [
                target_shape[0] / normalized.shape[0],
                target_shape[1] / normalized.shape[1],
                target_shape[2] / normalized.shape[2]
            ]
            
            # Use order=1 for linear interpolation
            from scipy.ndimage import zoom
            resized = zoom(normalized, zoom_factors, order=1)
        else:
            resized = normalized
        
        # Convert to tensor
        tensor = torch.FloatTensor(resized).unsqueeze(0).unsqueeze(0)
        
        return tensor