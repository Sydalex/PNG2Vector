// filename: apps/web/src/App.tsx
import React, { useState, useCallback, useRef } from 'react';
import { useDebouncedCallback } from './lib/debounce';
import type { TraceRequest, TraceResponse, ErrorResponse } from '@shared/types';

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
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>PNG2Vector</h1>
        <p style={styles.subtitle}>AI-Assisted PNG to SVG/DXF Converter</p>
      </header>

      <main style={styles.main}>
        {/* File Upload Section */}
        <section style={styles.uploadSection}>
          <div
            ref={dropZoneRef}
            style={styles.dropZone}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload PNG file"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              onChange={handleFileInputChange}
              style={styles.hiddenInput}
              aria-label="Select PNG file"
            />
            
            {state.selectedFile ? (
              <div style={styles.fileInfo}>
                <div style={styles.fileName}>{state.selectedFile.name}</div>
                <div style={styles.fileSize}>
                  {(state.selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            ) : (
              <div style={styles.uploadPrompt}>
                <div style={styles.uploadIcon}>📁</div>
                <div>Drop PNG file here or click to select</div>
                <div style={styles.uploadHint}>Maximum file size: 50MB</div>
              </div>
            )}
          </div>
        </section>

        {/* Controls Section */}
        {state.selectedFile && (
          <section style={styles.controlsSection}>
            <div style={styles.controlGroup}>
              <label htmlFor="fidelity-slider" style={styles.label}>
                Fidelity: {state.fidelity}%
              </label>
              <input
                id="fidelity-slider"
                type="range"
                min="0"
                max="100"
                value={state.fidelity}
                onChange={handleFidelityChange}
                style={styles.slider}
                aria-describedby="fidelity-description"
              />
              <div id="fidelity-description" style={styles.description}>
                Higher values preserve more detail but increase file size
              </div>
            </div>

            <div style={styles.controlGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={state.whiteFill}
                  onChange={handleWhiteFillChange}
                  style={styles.checkbox}
                />
                White Fill
              </label>
              <div style={styles.description}>
                Add white fill to shapes (VW_CLASS_Fill layer)
              </div>
            </div>

            <div style={styles.controlGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={state.useAI}
                  onChange={handleUseAIChange}
                  style={styles.checkbox}
                />
                AI Preprocessing
              </label>
              <div style={styles.description}>
                Use AI edge detection for cleaner results (requires ONNX models)
              </div>
            </div>
          </section>
        )}

        {/* Results Section */}
        {(state.svgPreview || state.isProcessing || state.error) && (
          <section style={styles.resultsSection}>
            <div style={styles.resultsGrid}>
              {/* SVG Preview */}
              <div style={styles.previewPanel}>
                <h3 style={styles.panelTitle}>SVG Preview</h3>
                <div style={styles.previewContainer}>
                  {state.isProcessing ? (
                    <div style={styles.loading}>
                      <div style={styles.spinner}></div>
                      <div>Processing...</div>
                    </div>
                  ) : state.error ? (
                    <div style={styles.error}>
                      <div style={styles.errorIcon}>⚠️</div>
                      <div>{state.error}</div>
                    </div>
                  ) : state.svgPreview ? (
                    <div
                      style={styles.svgContainer}
                      dangerouslySetInnerHTML={{ __html: state.svgPreview }}
                    />
                  ) : null}
                </div>
              </div>

              {/* Metrics and Downloads */}
              {state.result && (
                <div style={styles.metricsPanel}>
                  <h3 style={styles.panelTitle}>Results</h3>
                  
                  <div style={styles.metrics}>
                    <div style={styles.metric}>
                      <span style={styles.metricLabel}>Polygons:</span>
                      <span style={styles.metricValue}>{state.result.metrics.polygonCount}</span>
                    </div>
                    <div style={styles.metric}>
                      <span style={styles.metricLabel}>Nodes:</span>
                      <span style={styles.metricValue}>{state.result.metrics.nodeCount}</span>
                    </div>
                    <div style={styles.metric}>
                      <span style={styles.metricLabel}>Processing:</span>
                      <span style={styles.metricValue}>{state.result.metrics.timings.total}ms</span>
                    </div>
                  </div>

                  <div style={styles.downloadButtons}>
                    <button
                      onClick={handleDownloadSVG}
                      style={styles.downloadButton}
                      aria-label="Download SVG file"
                    >
                      📄 Download SVG
                    </button>
                    <button
                      onClick={handleDownloadDXF}
                      style={styles.downloadButton}
                      aria-label="Download DXF file"
                    >
                      📐 Download DXF
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer style={styles.footer}>
        <p>
          Compatible with VectorWorks, ArchiCAD, and other CAD applications.
          Uses deterministic vectorization with optional AI preprocessing.
        </p>
      </footer>
    </div>
  );
};

// Styles object
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#f8fafc',
  },
  header: {
    textAlign: 'center' as const,
    padding: '2rem 1rem',
    backgroundColor: 'white',
    borderBottom: '1px solid #e2e8f0',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '1.125rem',
    color: '#64748b',
  },
  main: {
    flex: 1,
    padding: '2rem 1rem',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  uploadSection: {
    marginBottom: '2rem',
  },
  dropZone: {
    border: '2px dashed #cbd5e1',
    borderRadius: '0.5rem',
    padding: '3rem 2rem',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: 'white',
  },
  hiddenInput: {
    display: 'none',
  },
  fileInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem',
  },
  fileName: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#1e293b',
  },
  fileSize: {
    fontSize: '0.875rem',
    color: '#64748b',
  },
  uploadPrompt: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
    color: '#64748b',
  },
  uploadIcon: {
    fontSize: '3rem',
  },
  uploadHint: {
    fontSize: '0.875rem',
    color: '#94a3b8',
  },
  controlsSection: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    marginBottom: '2rem',
    border: '1px solid #e2e8f0',
  },
  controlGroup: {
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.5rem',
  },
  slider: {
    width: '100%',
    height: '0.5rem',
    borderRadius: '0.25rem',
    background: '#e2e8f0',
    outline: 'none',
    marginBottom: '0.5rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#374151',
    cursor: 'pointer',
    marginBottom: '0.5rem',
  },
  checkbox: {
    width: '1rem',
    height: '1rem',
  },
  description: {
    fontSize: '0.875rem',
    color: '#64748b',
  },
  resultsSection: {
    marginBottom: '2rem',
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '2rem',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
  previewPanel: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0',
  },
  panelTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '1rem',
  },
  previewContainer: {
    minHeight: '300px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #e2e8f0',
    borderRadius: '0.25rem',
    backgroundColor: '#f8fafc',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
    color: '#64748b',
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '2px solid #e2e8f0',
    borderTop: '2px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem',
    color: '#dc2626',
    textAlign: 'center' as const,
  },
  errorIcon: {
    fontSize: '2rem',
  },
  svgContainer: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsPanel: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0',
    height: 'fit-content',
  },
  metrics: {
    marginBottom: '1.5rem',
  },
  metric: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0',
    borderBottom: '1px solid #f1f5f9',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: '0.875rem',
  },
  metricValue: {
    color: '#1e293b',
    fontWeight: '600',
  },
  downloadButtons: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  downloadButton: {
    padding: '0.75rem 1rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  footer: {
    textAlign: 'center' as const,
    padding: '2rem 1rem',
    backgroundColor: 'white',
    borderTop: '1px solid #e2e8f0',
    color: '#64748b',
    fontSize: '0.875rem',
  },
};

export default App;