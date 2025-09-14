# filename: models/README.md

# ONNX Models Directory

This directory contains ONNX models for AI-assisted preprocessing in the PNG2Vector pipeline.

## Required Models

### HED (Holistically-Nested Edge Detection)
- **File**: `hed.onnx`
- **Purpose**: Edge detection for crisp 1-pixel boundaries
- **Input**: RGB image tensor [1, 3, H, W], normalized 0-1
- **Output**: Edge probability map [1, 1, H, W], range 0-1
- **Size**: ~56MB (typical)

### Optional Models

#### MobileSAM (Mobile Segment Anything Model)
- **File**: `mobilesam.onnx` (optional)
- **Purpose**: Foreground/background segmentation
- **Input**: RGB image tensor [1, 3, H, W]
- **Output**: Segmentation mask [1, 1, H, W]

#### U²-Net (U-squared Net)
- **File**: `u2net.onnx` (optional)
- **Purpose**: Salient object detection and segmentation
- **Input**: RGB image tensor [1, 3, H, W]
- **Output**: Saliency map [1, 1, H, W]

## Model Sources

### HED Model
The HED model can be obtained from:
1. **Official PyTorch Hub**: `torch.hub.load('pytorch/vision', 'hed')`
2. **ONNX Model Zoo**: https://github.com/onnx/models/tree/main/vision/object_detection_segmentation/hed
3. **Convert from PyTorch**: Use `torch.onnx.export()` to convert a trained HED model

### Converting PyTorch to ONNX

```python
import torch
import torch.onnx

# Load pre-trained HED model
model = torch.hub.load('pytorch/vision', 'hed', pretrained=True)
model.eval()

# Create dummy input
dummy_input = torch.randn(1, 3, 224, 224)

# Export to ONNX
torch.onnx.export(
    model,
    dummy_input,
    "hed.onnx",
    export_params=True,
    opset_version=11,
    do_constant_folding=True,
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={
        'input': {0: 'batch_size', 2: 'height', 3: 'width'},
        'output': {0: 'batch_size', 2: 'height', 3: 'width'}
    }
)
```

## Model Requirements

### Performance Considerations
- **CPU Optimization**: Models should be optimized for CPU inference
- **Memory Usage**: Keep models under 100MB when possible
- **Inference Speed**: Target <2 seconds for 1024x1024 images on modern CPUs

### Input/Output Specifications
- **Input Format**: RGB images, normalized to [0, 1] range
- **Input Shape**: [batch_size, channels, height, width]
- **Output Format**: Probability maps or binary masks
- **Coordinate System**: Standard image coordinates (top-left origin)

## Fallback Behavior

If ONNX models are not available:
- The system will automatically fall back to deterministic processing
- A warning will be logged indicating AI preprocessing is disabled
- All functionality remains available without AI enhancement
- Users can still adjust fidelity and other parameters normally

## Installation Instructions

1. **Download Models**: Obtain ONNX models from the sources above
2. **Place Files**: Copy model files to this `models/` directory
3. **Verify**: Ensure files are named correctly (e.g., `hed.onnx`)
4. **Test**: Upload a PNG file and enable "AI Preprocessing" to test

## Model Validation

The system performs automatic validation:
- **File Existence**: Checks if model files are present
- **Format Validation**: Verifies ONNX format compatibility
- **Input/Output Shapes**: Validates tensor dimensions
- **Runtime Testing**: Performs inference test on startup

## Licensing

**Important**: Ensure you comply with the licensing terms of any models you use:

- **HED**: Typically BSD or MIT license (check specific model source)
- **MobileSAM**: Apache 2.0 license
- **U²-Net**: Apache 2.0 license

**Note**: This project uses only server-side AI processing, so GPL models can be used if needed, but document licensing requirements clearly.

## Troubleshooting

### Common Issues

1. **Model Not Found**
   - Ensure file is in correct directory
   - Check filename matches exactly (case-sensitive)
   - Verify file is not corrupted

2. **ONNX Runtime Errors**
   - Check ONNX model version compatibility
   - Ensure model was exported with compatible opset version
   - Verify input tensor shapes match model requirements

3. **Memory Issues**
   - Large images may require model optimization
   - Consider using quantized models for better performance
   - Monitor memory usage during inference

4. **Performance Issues**
   - Use CPU-optimized models when possible
   - Consider model quantization (INT8) for faster inference
   - Implement image resizing for very large inputs

### Debug Mode

Set environment variable `DEBUG_AI=true` to enable detailed logging:
```bash
DEBUG_AI=true npm start
```

This will log:
- Model loading status
- Input/output tensor shapes
- Inference timing
- Error details

## Model Updates

To update models:
1. Replace the ONNX file in this directory
2. Restart the server
3. Test with a sample image to verify functionality

The system will automatically detect and load new models on restart.