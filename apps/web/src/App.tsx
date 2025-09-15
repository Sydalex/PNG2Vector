import React, { useState, useCallback, useRef } from 'react';
import { useDebouncedCallback } from './lib/debounce';
import type { TraceRequest, TraceResponse, ErrorResponse } from '../../../shared/types';
import './App.css';

interface AppState {
  selectedFile: File | null;
  fidelity: number;
  whiteFill: boolean;
  useAI: boolean;
  isProcessing: boolean;
  result: TraceResponse | null;
  error: string | null;
  svgPreview: string | null;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    selectedFile: null,
    fidelity: 50,
    whiteFill: false,
    useAI: false,
    isProcessing: false,
    result: null,
    error: null,
    svgPreview: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Debounced trace function for live updates
  const debouncedTrace = useDebouncedCallback(
    async (file: File, fidelity: number, whiteFill: boolean, useAI: boolean) => {
      if (!file) return;

      setState(prev => ({ ...prev, isProcessing: true, error: null }));

      try {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('fidelity', fidelity.toString());
        formData.append('whiteFill', whiteFill.toString());
        formData.append('useAI', useAI.toString());

        const response = await fetch('/api/trace', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData: ErrorResponse = await response.json();
          throw new Error(errorData.error || 'Processing failed');
        }

        const result: TraceResponse = await response.json();
        
        setState(prev => ({
          ...prev,
          result,
          svgPreview: result.svg,
          isProcessing: false,
          error: null,
        }));

      } catch (error) {
        console.error('Trace processing error:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          isProcessing: false,
        }));
      }
    },
    500, // 500ms debounce
    [state.selectedFile, state.fidelity, state.whiteFill, state.useAI]
  );

  // File selection handlers
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/png')) {
      setState(prev => ({ ...prev, error: 'Please select a PNG file' }));
      return;
    }

    setState(prev => ({
      ...prev,
      selectedFile: file,
      error: null,
      result: null,
      svgPreview: null,
    }));

    // Trigger initial trace
    debouncedTrace(file, state.fidelity, state.whiteFill, state.useAI);
  }, [state.fidelity, state.whiteFill, state.useAI, debouncedTrace]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Drag and drop handlers
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add('drag-over');
    }
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (dropZoneRef.current && !dropZoneRef.current.contains(event.relatedTarget as Node)) {
      dropZoneRef.current.classList.remove('drag-over');
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('drag-over');
    }

    const files = Array.from(event.dataTransfer.files);
    const pngFile = files.find(file => file.type === 'image/png');
    
    if (pngFile) {
      handleFileSelect(pngFile);
    } else {
      setState(prev => ({ ...prev, error: 'Please drop a PNG file' }));
    }
  }, [handleFileSelect]);

  // Parameter change handlers
  const handleFidelityChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const fidelity = parseInt(event.target.value, 10);
    setState(prev => ({ ...prev, fidelity }));
    
    if (state.selectedFile) {
      debouncedTrace(state.selectedFile, fidelity, state.whiteFill, state.useAI);
    }
  }, [state.selectedFile, state.whiteFill, state.useAI, debouncedTrace]);

  const handleWhiteFillChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const whiteFill = event.target.checked;
    setState(prev => ({ ...prev, whiteFill }));
    
    if (state.selectedFile) {
      debouncedTrace(state.selectedFile, state.fidelity, whiteFill, state.useAI);
    }
  }, [state.selectedFile, state.fidelity, state.useAI, debouncedTrace]);

  const handleUseAIChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const useAI = event.target.checked;
    setState(prev => ({ ...prev, useAI }));
    
    if (state.selectedFile) {
      debouncedTrace(state.selectedFile, state.fidelity, state.whiteFill, useAI);
    }
  }, [state.selectedFile, state.fidelity, state.whiteFill, debouncedTrace]);

  // Download handlers
  const handleDownloadSVG = useCallback(() => {
    if (!state.result) return;

    const blob = new Blob([state.result.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.selectedFile?.name.replace('.png', '') || 'vectorized'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state.result, state.selectedFile]);

  const handleDownloadDXF = useCallback(() => {
    if (!state.result) return;

    // Decode base64 DXF content
    const dxfContent = atob(state.result.dxf);
    const blob = new Blob([dxfContent], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.selectedFile?.name.replace('.png', '') || 'vectorized'}.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state.result, state.selectedFile]);

  return (
    <div className="app">
      <div className="header">
        <h1>PNG2Vector</h1>
        <p>AI-Assisted CAD Vectorizer for Vectorworks & ArchiCAD</p>
      </div>

      <div className="main-content">
        <div className="upload-section">
          <div
            ref={dropZoneRef}
            className="drop-zone"
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Click to select PNG file or drag and drop"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="file-input"
              accept="image/png"
              onChange={handleFileInputChange}
              aria-label="PNG file input"
            />
            {state.selectedFile ? (
              <div>
                <p><strong>{state.selectedFile.name}</strong></p>
                <p>Click to select a different file</p>
              </div>
            ) : (
              <div>
                <p>Drag & drop a PNG file here</p>
                <p>or click to select</p>
              </div>
            )}
          </div>

          <div className="controls">
            <div className="control-group">
              <label htmlFor="fidelity-slider">
                Fidelity: {state.fidelity}%
              </label>
              <input
                id="fidelity-slider"
                type="range"
                min="0"
                max="100"
                value={state.fidelity}
                onChange={handleFidelityChange}
                className="slider"
                aria-label="Fidelity level from 0 to 100 percent"
              />
              <small>Higher values preserve more detail but increase file size</small>
            </div>

            <div className="checkbox-group">
              <input
                id="white-fill-checkbox"
                type="checkbox"
                checked={state.whiteFill}
                onChange={handleWhiteFillChange}
                className="checkbox"
                aria-label="Enable white fill for shapes"
              />
              <label htmlFor="white-fill-checkbox">White Fill</label>
            </div>

            <div className="checkbox-group">
              <input
                id="use-ai-checkbox"
                type="checkbox"
                checked={state.useAI}
                onChange={handleUseAIChange}
                className="checkbox"
                aria-label="Enable AI-assisted preprocessing"
              />
              <label htmlFor="use-ai-checkbox">AI Enhancement</label>
            </div>
          </div>

          {state.error && (
            <div className="error" role="alert">
              {state.error}
            </div>
          )}
        </div>

        <div className="preview-section">
          <h3>Preview</h3>
          
          <div className="preview-container">
            {state.isProcessing ? (
              <div className="processing">
                <p>Processing...</p>
              </div>
            ) : state.svgPreview ? (
              <div
                dangerouslySetInnerHTML={{ __html: state.svgPreview }}
                className="preview-svg"
              />
            ) : (
              <div className="processing">
                <p>Select a PNG file to see preview</p>
              </div>
            )}
          </div>

          <div className="download-buttons">
            <button
              className="btn btn-primary"
              onClick={handleDownloadSVG}
              disabled={!state.result || state.isProcessing}
              aria-label="Download SVG file"
            >
              Download SVG
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleDownloadDXF}
              disabled={!state.result || state.isProcessing}
              aria-label="Download DXF file"
            >
              Download DXF
            </button>
          </div>

          {state.result && (
            <div className="metrics">
              <h4>Processing Metrics</h4>
              <div className="metrics-grid">
                <div className="metric">
                  <span>Polygons:</span>
                  <span>{state.result.metrics.polygonCount}</span>
                </div>
                <div className="metric">
                  <span>Nodes:</span>
                  <span>{state.result.metrics.nodeCount}</span>
                </div>
                <div className="metric">
                  <span>Simplification:</span>
                  <span>{state.result.metrics.simplification.toFixed(2)}</span>
                </div>
                <div className="metric">
                  <span>Total Time:</span>
                  <span>{state.result.metrics.timings.total}ms</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export default App;