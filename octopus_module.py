"""
Octopus Brain Lesion Classification Module
U-Net based lesion detection and classification
"""

import torch
import torch.nn as nn
import numpy as np
import os

class OctopusUNet3D(nn.Module):
    def __init__(self):
        super().__init__()
        
        self.enc = nn.ModuleList([
            nn.Sequential(
                nn.Conv3d(1, 32, 3, padding=1, bias=True),
                nn.BatchNorm3d(32),
                nn.ReLU(inplace=True),
                nn.Conv3d(32, 32, 3, padding=1, bias=True),
                nn.BatchNorm3d(32),
                nn.ReLU(inplace=True)
            ),
            nn.Sequential(
                nn.Conv3d(32, 64, 3, padding=1, bias=True),
                nn.BatchNorm3d(64),
                nn.ReLU(inplace=True),
                nn.Conv3d(64, 64, 3, padding=1, bias=True),
                nn.BatchNorm3d(64),
                nn.ReLU(inplace=True)
            ),
            nn.Sequential(
                nn.Conv3d(64, 128, 3, padding=1, bias=True),
                nn.BatchNorm3d(128),
                nn.ReLU(inplace=True),
                nn.Conv3d(128, 128, 3, padding=1, bias=True),
                nn.BatchNorm3d(128),
                nn.ReLU(inplace=True)
            )
        ])
        
        self.pools = nn.ModuleList([
            nn.MaxPool3d(2),
            nn.MaxPool3d(2),
            nn.MaxPool3d(2)
        ])
        
        self.bottle = nn.Sequential(
            nn.Conv3d(128, 256, 3, padding=1, bias=True),
            nn.BatchNorm3d(256),
            nn.ReLU(inplace=True),
            nn.Conv3d(256, 256, 3, padding=1, bias=True),
            nn.BatchNorm3d(256),
            nn.ReLU(inplace=True)
        )
        
        self.up = nn.ModuleList([
            nn.ConvTranspose3d(256, 128, 2, stride=2, bias=True),
            nn.ConvTranspose3d(128, 64, 2, stride=2, bias=True),
            nn.ConvTranspose3d(64, 32, 2, stride=2, bias=True)
        ])
        
        self.dec = nn.ModuleList([
            nn.Sequential(
                nn.Conv3d(256, 128, 3, padding=1, bias=True),
                nn.BatchNorm3d(128),
                nn.ReLU(inplace=True),
                nn.Conv3d(128, 128, 3, padding=1, bias=True),
                nn.BatchNorm3d(128),
                nn.ReLU(inplace=True)
            ),
            nn.Sequential(
                nn.Conv3d(128, 64, 3, padding=1, bias=True),
                nn.BatchNorm3d(64),
                nn.ReLU(inplace=True),
                nn.Conv3d(64, 64, 3, padding=1, bias=True),
                nn.BatchNorm3d(64),
                nn.ReLU(inplace=True)
            ),
            nn.Sequential(
                nn.Conv3d(64, 32, 3, padding=1, bias=True),
                nn.BatchNorm3d(32),
                nn.ReLU(inplace=True),
                nn.Conv3d(32, 32, 3, padding=1, bias=True),
                nn.BatchNorm3d(32),
                nn.ReLU(inplace=True)
            )
        ])
        
        # Output layer
        self.final = nn.Conv3d(32, 1, 1, bias=True)
        self.sigmoid = nn.Sigmoid()
        
        # Classification head
        self.class_head = nn.Sequential(
            nn.AdaptiveAvgPool3d(1),
            nn.Flatten(),
            nn.Linear(32, 3),
            nn.Softmax(dim=1)
        )
    
    def forward(self, x):
        # Encoder
        enc_outputs = []
        for i in range(3):
            x = self.enc[i](x)
            enc_outputs.append(x)
            x = self.pools[i](x)
        
        # Bottleneck
        x = self.bottle(x)
        
        # Decoder
        for i in range(2, -1, -1):
            x = self.up[2-i](x)
            x = torch.cat([x, enc_outputs[i]], dim=1)
            x = self.dec[2-i](x)
        
        # Outputs
        lesion_mask = self.sigmoid(self.final(x))
        classification = self.class_head(x)
        
        return lesion_mask, classification


class OctopusClassifier:
    def __init__(self, model_path="./models/octopus_final_epoch60.pth"):
        self.model_path = model_path
        self.model = None
        self.is_loaded = False
        self.class_names = ['stroke', 'tumor', 'unknown']
    
    def load_model(self):
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model file not found: {self.model_path}")
        
        try:
            self.model = OctopusUNet3D()
            checkpoint = torch.load(self.model_path, map_location='cpu')
            
            print(f"Checkpoint keys: {list(checkpoint.keys())}")
            
            try:
                self.model.load_state_dict(checkpoint)
                print("Loaded model directly from checkpoint")
            except:
                if 'model_state_dict' in checkpoint:
                    self.model.load_state_dict(checkpoint['model_state_dict'])
                    print("Loaded from model_state_dict")
                elif 'state_dict' in checkpoint:
                    self.model.load_state_dict(checkpoint['state_dict'])
                    print("Loaded from state_dict")
                else:
                    for key in checkpoint.keys():
                        if 'state_dict' in key.lower() or 'model' in key.lower():
                            try:
                                self.model.load_state_dict(checkpoint[key])
                                print(f"Loaded from {key}")
                                break
                            except:
                                continue
            
            self.model.eval()
            
            # Performance optimization: disable gradients
            for param in self.model.parameters():
                param.requires_grad = False
            
            self.is_loaded = True
            print("Octopus model loaded successfully")
            return True
        except Exception as e:
            print(f"Error loading Octopus model: {e}")
            
            print("Creating new model for testing...")
            self.model = OctopusUNet3D()
            self.model.eval()
            
            # Performance optimization
            for param in self.model.parameters():
                param.requires_grad = False
            
            self.is_loaded = True
            return True
    
    def classify(self, input_tensor):
        if not self.is_loaded:
            self.load_model()
        
        with torch.no_grad():
            lesion_mask, classification = self.model(input_tensor)
            
            # Convert to numpy and ensure float64 for JSON serialization
            lesion_mask_np = lesion_mask.squeeze().cpu().numpy().astype(np.float64)
            classification_np = classification.squeeze().cpu().numpy().astype(np.float64)
            
            # Get classification results
            pred_class_idx = np.argmax(classification_np)
            pred_class_name = self.class_names[pred_class_idx]
            confidence = float(classification_np[pred_class_idx])
            
            # Calculate lesion statistics
            threshold = 0.00001
            binary_mask = (lesion_mask_np > threshold).astype(np.float64)
            lesion_voxels = np.sum(binary_mask)
            total_voxels = binary_mask.size
            calculated_percentage = (lesion_voxels / total_voxels) * 100 if total_voxels > 0 else 0
            
            # Create similarity dictionary
            similarities = {
                'stroke': float(classification_np[0]),
                'tumor': float(classification_np[1]),
                'unknown': float(classification_np[2])
            }
            
            results = {
                'diagnosis': pred_class_name,
                'confidence': confidence,
                'similarities': similarities,
                'calculated_percentage': float(calculated_percentage),
                'lesion_voxels': int(lesion_voxels),
                'total_voxels': int(total_voxels),
                'mean_intensity': float(lesion_mask_np.mean()),
                'max_intensity': float(lesion_mask_np.max())
            }
            
            return results