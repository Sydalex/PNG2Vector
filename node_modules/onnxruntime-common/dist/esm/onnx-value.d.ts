import { Tensor } from './tensor.js';
type NonTensorType = never;
/**
 * Type OnnxValue Represents both tensors and non-tensors value for model's inputs/outputs.
 *
 * NOTE: currently not support non-tensor
 */
export type OnnxValue = Tensor | NonTensorType;
export {};
//# sourceMappingURL=onnx-value.d.ts.map