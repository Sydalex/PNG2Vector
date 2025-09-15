import { TensorToDataUrlOptions, TensorToImageDataOptions } from './tensor-conversion.js';
import { TensorFromImageBitmapOptions, TensorFromImageDataOptions, TensorFromImageElementOptions, TensorFromUrlOptions } from './tensor-factory.js';
import { Tensor as TensorInterface } from './tensor.js';
type TensorType = TensorInterface.Type;
type TensorDataType = TensorInterface.DataType;
export declare class Tensor implements TensorInterface {
    constructor(type: TensorType, data: TensorDataType | readonly number[] | readonly boolean[], dims?: readonly number[]);
    constructor(data: TensorDataType | readonly boolean[], dims?: readonly number[]);
    static fromImage(imageData: ImageData, options?: TensorFromImageDataOptions): Promise<Tensor>;
    static fromImage(imageElement: HTMLImageElement, options?: TensorFromImageElementOptions): Promise<Tensor>;
    static fromImage(bitmap: ImageBitmap, options: TensorFromImageBitmapOptions): Promise<Tensor>;
    static fromImage(urlSource: string, options?: TensorFromUrlOptions): Promise<Tensor>;
    toDataURL(options?: TensorToDataUrlOptions): string;
    toImageData(options?: TensorToImageDataOptions): ImageData;
    readonly dims: readonly number[];
    readonly type: TensorType;
    readonly data: TensorDataType;
    readonly size: number;
    reshape(dims: readonly number[]): Tensor;
}
export {};
//# sourceMappingURL=tensor-impl.d.ts.map