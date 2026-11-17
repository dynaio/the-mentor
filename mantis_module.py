"""
Mantis Brain Anomaly Detection Module
Autoencoder-based anomaly detection
"""

import torch
import torch.nn as nn
import numpy as np
import os

class BrainAutoencoder3D(nn.Module):
    def __init__(self):
        super(BrainAutoencoder3D, self).__init__()
        
        self.encoder = nn.Sequential(
            nn.Conv3d(1, 32, kernel_size=3, stride=2, padding=1),
            nn.ReLU(),
            nn.BatchNorm3d(32),
            
            nn.Conv3d(32, 64, kernel_size=3, stride=2, padding=1),
            nn.ReLU(),
            nn.BatchNorm3d(64),
            
            nn.Conv3d(64, 128, kernel_size=3, stride=2, padding=1),
            nn.ReLU(),
            nn.BatchNorm3d(128),
        )
        
        self.decoder = nn.Sequential(
            nn.ConvTranspose3d(128, 64, kernel_size=3, stride=2, padding=1, output_padding=1),
            nn.ReLU(),
            nn.BatchNorm3d(64),
            
            nn.ConvTranspose3d(64, 32, kernel_size=3, stride=2, padding=1, output_padding=1),
            nn.ReLU(),
            nn.BatchNorm3d(32),
            
            nn.ConvTranspose3d(32, 1, kernel_size=3, stride=2, padding=1, output_padding=1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded


class MantisDetector:
    def __init__(self, model_path):
        self.model_path = model_path
        self.model = None
        self.anomaly_threshold = 0.0005
        self.is_loaded = False
    
    def load_model(self):
        print(f"Looking for Mantis model at: {self.model_path}")
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model file not found: {self.model_path}")
        
        try:
            self.model = BrainAutoencoder3D()
            checkpoint = torch.load(self.model_path, map_location='cpu')
            self.model.load_state_dict(checkpoint['model_state_dict'])
            self.model.eval()
            
            # Performance optimization: disable gradients
            for param in self.model.parameters():
                param.requires_grad = False
            
            self.is_loaded = True
            return True
        except Exception as e:
            raise RuntimeError(f"Error loading Mantis model: {e}")
    
    def analyze(self, input_tensor, original_data):
        if not self.is_loaded:
            self.load_model()
        
        with torch.no_grad():
            # Model prediction
            reconstructed = self.model(input_tensor)
            
            # Convert to numpy and ensure float64
            input_np = input_tensor.squeeze().cpu().numpy().astype(np.float64)
            reconstructed_np = reconstructed.squeeze().cpu().numpy().astype(np.float64)
            
            # Calculate difference map
            difference_map = np.abs(input_np - reconstructed_np)
            
            # Calculate metrics
            mse = np.mean(np.square(input_np - reconstructed_np))
            mae = np.mean(np.abs(input_np - reconstructed_np))
            anomaly_score = np.mean(difference_map)
            
            # Calculate PSNR
            psnr = 20 * np.log10(1.0 / np.sqrt(mse + 1e-8))
            
            # Determine if normal or abnormal
            is_normal = anomaly_score <= self.anomaly_threshold
            
            # Evaluate confidence
            if mse <= 0.002:
                confidence = "VERY HIGH"
                performance = "EXCELLENT"
            elif mse <= 0.005:
                confidence = "HIGH" 
                performance = "VERY GOOD"
            elif mse <= 0.01:
                confidence = "MEDIUM"
                performance = "GOOD"
            else:
                confidence = "LOW"
                performance = "NEEDS REVIEW"
            
            results = {
                'mse': float(mse),
                'mae': float(mae),
                'psnr': float(psnr),
                'anomaly_score': float(anomaly_score),
                'is_normal': bool(is_normal),
                'confidence': confidence,
                'performance': performance,
                'threshold': float(self.anomaly_threshold),
                'difference_map': difference_map.tolist()
            }
            
            return results
    
    def get_difference_map(self, input_tensor):
        if not self.is_loaded:
            self.load_model()
        
        with torch.no_grad():
            reconstructed = self.model(input_tensor)
            input_np = input_tensor.squeeze().cpu().numpy()
            reconstructed_np = reconstructed.squeeze().cpu().numpy()
            difference_map = np.abs(input_np - reconstructed_np)
            return difference_map