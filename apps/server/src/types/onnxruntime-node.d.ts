// Type declarations for onnxruntime-node
declare module 'onnxruntime-node' {
  export interface Tensor {
    readonly data: Float32Array | Uint8Array | Int32Array;
    readonly dims: readonly number[];
    readonly type: string;
  }

  export class Tensor {
    constructor(type: string, data: Float32Array | Uint8Array | Int32Array, dims?: readonly number[]);
  }

  export interface InferenceSessionOptions {
    executionProviders?: string[];
    logSeverityLevel?: number;
    graphOptimizationLevel?: string;
  }

  export interface RunOptions {
    [name: string]: Tensor;
  }

  export interface RunResult {
    [name: string]: Tensor;
  }

  export class InferenceSession {
    static create(path: string, options?: InferenceSessionOptions): Promise<InferenceSession>;
    static create(buffer: Uint8Array, options?: InferenceSessionOptions): Promise<InferenceSession>;
    
    run(feeds: RunOptions, options?: any): Promise<RunResult>;
    release(): void;
  }
}