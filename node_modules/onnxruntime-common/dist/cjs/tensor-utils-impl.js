"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.tensorReshape = exports.calculateSize = void 0;
const tensor_js_1 = require("./tensor.js");
/**
 * calculate size from dims.
 *
 * @param dims the dims array. May be an illegal input.
 */
const calculateSize = (dims) => {
    let size = 1;
    for (let i = 0; i < dims.length; i++) {
        const dim = dims[i];
        if (typeof dim !== 'number' || !Number.isSafeInteger(dim)) {
            throw new TypeError(`dims[${i}] must be an integer, got: ${dim}`);
        }
        if (dim < 0) {
            throw new RangeError(`dims[${i}] must be a non-negative integer, got: ${dim}`);
        }
        size *= dim;
    }
    return size;
};
exports.calculateSize = calculateSize;
/**
 * implementation of Tensor.reshape()
 */
const tensorReshape = (tensor, dims) => new tensor_js_1.Tensor(tensor.type, tensor.data, dims);
exports.tensorReshape = tensorReshape;
//# sourceMappingURL=tensor-utils-impl.js.map