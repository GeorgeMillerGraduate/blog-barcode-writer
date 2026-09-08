/**
 * DataMatrixSymbol.js
 *
 * Symbol sizes and capacity selection for Data Matrix ECC 200.
 *
 * Compatible with:
 *   DataMatrixEncoder
 *   DataMatrixErrorCorrection
 *   DataMatrixGenerator
 *   DataMatrixPlacement
 *
 * Supports:
 * - 24 standard square sizes.
 * - 6 standard rectangular sizes.
 *
 * Extended DMRE symbols are not included.
 *
 * Usage:
 *   const symbol = DataMatrixSymbol.select(data.length);
 *
 *   const rectangle = DataMatrixSymbol.select(data.length, {
 *       shape: "rectangle"
 *   });
 *
 * Dimensions include finder borders but exclude the quiet zone.
 * Capacities count codewords, not characters.
 */
class DataMatrixSymbol {

    /**
     * Standard symbol definitions.
     *
     * Columns:
     * width, height, data capacity, ECC codewords,
     * region columns, region rows, RS block count.
     */
    static #symbols = Object.freeze([
        // Square symbols.
        [10,  10,     3,   5, 1, 1,  1],
        [12,  12,     5,   7, 1, 1,  1],
        [14,  14,     8,  10, 1, 1,  1],
        [16,  16,    12,  12, 1, 1,  1],
        [18,  18,    18,  14, 1, 1,  1],
        [20,  20,    22,  18, 1, 1,  1],
        [22,  22,    30,  20, 1, 1,  1],
        [24,  24,    36,  24, 1, 1,  1],
        [26,  26,    44,  28, 1, 1,  1],
        [32,  32,    62,  36, 2, 2,  1],
        [36,  36,    86,  42, 2, 2,  1],
        [40,  40,   114,  48, 2, 2,  1],
        [44,  44,   144,  56, 2, 2,  1],
        [48,  48,   174,  68, 2, 2,  1],
        [52,  52,   204,  84, 2, 2,  2],
        [64,  64,   280, 112, 4, 4,  2],
        [72,  72,   368, 144, 4, 4,  4],
        [80,  80,   456, 192, 4, 4,  4],
        [88,  88,   576, 224, 4, 4,  4],
        [96,  96,   696, 272, 4, 4,  4],
        [104, 104,  816, 336, 4, 4,  6],
        [120, 120, 1050, 408, 6, 6,  6],
        [132, 132, 1304, 496, 6, 6,  8],
        [144, 144, 1558, 620, 6, 6, 10],

        // Rectangular symbols, in landscape orientation.
        [18,   8,    5,   7, 1, 1, 1],
        [32,   8,   10,  11, 2, 1, 1],
        [26,  12,   16,  14, 1, 1, 1],
        [36,  12,   22,  18, 2, 1, 1],
        [36,  16,   32,  24, 2, 1, 1],
        [48,  16,   49,  28, 2, 1, 1]
    ].map(([
        width,
        height,
        dataCapacity,
        errorCodewords,
        regionColumns,
        regionRows,
        blockCount
    ]) => {
        const regionDataWidth = width / regionColumns - 2;
        const regionDataHeight = height / regionRows - 2;

        // Cyclic distribution gives the first blocks any remainder.
        // For 144 × 144 this produces eight blocks of 156 data
        // codewords followed by two blocks of 155.
        const baseBlockLength = Math.floor(dataCapacity / blockCount);
        const longerBlockCount = dataCapacity % blockCount;

        const dataCodewordsPerBlock = Array.from(
            { length: blockCount },
            (_, index) => baseBlockLength + (
                index < longerBlockCount ? 1 : 0
            )
        );

        return Object.freeze({
            width,
            height,
            shape: width === height ? "square" : "rectangle",
            rectangular: width !== height,

            dataCapacity,
            errorCodewords,
            totalCodewords: dataCapacity + errorCodewords,

            regionColumns,
            regionRows,
            regionCount: regionColumns * regionRows,
            regionDataWidth,
            regionDataHeight,
            dataWidth: regionColumns * regionDataWidth,
            dataHeight: regionRows * regionDataHeight,

            blockCount,
            errorCodewordsPerBlock: errorCodewords / blockCount,
            dataCodewordsPerBlock: Object.freeze(dataCodewordsPerBlock)
        });
    }).sort((left, right) => {
        // Prefer the smallest physical area.
        const areaDifference =
            left.width * left.height - right.width * right.height;

        if (areaDifference !== 0) {
            return areaDifference;
        }

        // Prefer square symbols when areas are equal.
        const shapeDifference =
            Number(left.rectangular) - Number(right.rectangular);

        return shapeDifference ||
            left.dataCapacity - right.dataCapacity;
    }));

    /**
     * Select the smallest permitted symbol that fits the data.
     *
     * Returns null when no supported symbol is large enough.
     *
     * @param {number} dataLength Unpadded encoded codeword count.
     * @param {Object} [options={}]
     * @param {"auto"|"square"|"rectangle"} [options.shape="square"]
     * @returns {Object|null}
     */
    static select(dataLength, options = {}) {
        if (!Number.isSafeInteger(dataLength) || dataLength < 0) {
            throw new RangeError(
                "DataMatrixSymbol: dataLength must be " +
                "a non-negative safe integer."
            );
        }

        const shape = DataMatrixSymbol.#readShape(options);

        return DataMatrixSymbol.#symbols.find(symbol =>
            symbol.dataCapacity >= dataLength &&
            (shape === "auto" || symbol.shape === shape)
        ) ?? null;
    }

    /**
     * Look up a symbol by its full dimensions.
     *
     * Example:
     *   const symbol = DataMatrixSymbol.get(32, 32);
     *
     * Returns null for unsupported dimensions.
     *
     * @param {number} width
     * @param {number} height
     * @returns {Object|null}
     */
    static get(width, height) {
        if (
            !Number.isSafeInteger(width) ||
            !Number.isSafeInteger(height) ||
            width < 1 ||
            height < 1
        ) {
            throw new RangeError(
                "DataMatrixSymbol: width and height must " +
                "be positive safe integers."
            );
        }

        return DataMatrixSymbol.#symbols.find(symbol =>
            symbol.width === width &&
            symbol.height === height
        ) ?? null;
    }

    /**
     * List supported symbols, sorted by physical area.
     *
     * The returned array is a new array.
     * Individual symbol definitions are immutable.
     *
     * @param {Object} [options={}]
     * @param {"auto"|"square"|"rectangle"} [options.shape="auto"]
     * @returns {Object[]}
     */
    static list(options = {}) {
        const shape = DataMatrixSymbol.#readShape(options, "auto");

        return DataMatrixSymbol.#symbols.filter(symbol =>
            shape === "auto" || symbol.shape === shape
        );
    }

    /**
     * Validate options and return the requested shape.
     */
    static #readShape(options, defaultShape = "square") {
        if (
            options === null ||
            typeof options !== "object" ||
            Array.isArray(options)
        ) {
            throw new TypeError(
                "DataMatrixSymbol: options must be an object."
            );
        }

        const shape = options.shape ?? defaultShape;

        if (!["auto", "square", "rectangle"].includes(shape)) {
            throw new RangeError(
                'DataMatrixSymbol: shape must be "auto", ' +
                '"square" or "rectangle".'
            );
        }

        return shape;
    }
}

if (typeof window !== "undefined") {
    window.DataMatrixSymbol = DataMatrixSymbol;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = DataMatrixSymbol;
}