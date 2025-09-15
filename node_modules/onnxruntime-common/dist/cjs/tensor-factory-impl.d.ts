import { OptionsDimensions, OptionsFormat, OptionsNormalizationParameters, OptionsTensorFormat, OptionsTensorLayout, TensorFromImageBitmapOptions, TensorFromImageDataOptions, TensorFromImageElementOptions, TensorFromUrlOptions } from './tensor-factory.js';
import { TypedTensor } from './tensor.js';
interface BufferToTensorOptions extends OptionsDimensions, OptionsTensorLayout, OptionsNormalizationParameters, OptionsFormat, OptionsTensorFormat {
}
/**
 * Create a new tensor object from image object
 *
 * @param buffer - Extracted image buffer data - assuming RGBA format
 * @param imageFormat - input image configuration - required configurations height, width, format
 * @param tensorFormat - output tensor configuration - Default is RGB format
 */
export declare const bufferToTensor: (buffer: Uint8ClampedArray | undefined, options: BufferToTensorOptions) => TypedTensor<'float32'> | TypedTensor<'uint8'>;
/**
 * implementation of Tensor.fromImage().
 */
export declare const tensorFromImage: (image: ImageData | HTMLImageElement | ImageBitmap | string, options?: TensorFromImageDataOptions | TensorFromImageElementOptions | TensorFromImageBitmapOptions | TensorFromUrlOptions) => Promise<TypedTensor<'float32'> | TypedTensor<'uint8'>>;
export {};
//# sourceMappingURL=tensor-factory-impl.d.ts.map