/**
 * DataMatrixGenerator.js
 *
 * Coordinates Data Matrix ECC 200 generation:
 *
 * 1. Encode the input text.
 * 2. Select a symbol with enough data capacity.
 * 3. Pad the data to that capacity.
 * 4. Generate Reed–Solomon error correction.
 * 5. Build the final module matrix.
 *
 * Required script order:
 *   DataMatrixEncoder.js
 *   DataMatrixErrorCorrection.js
 *   DataMatrixSymbol.js
 *   DataMatrixPlacement.js
 *   DataMatrixGenerator.js
 *
 * Required interfaces for the remaining classes:
 *
 *   DataMatrixSymbol.select(dataLength, { shape })
 *     Returns an object containing:
 *       dataCapacity
 *       errorCodewords
 *       blockCount
 *       width
 *       height
 *     Plus any region information needed by placement.
 *
 *   DataMatrixPlacement.build(codewords, symbol)
 *     Returns the complete matrix, including finder borders.
 *
 * Matrix format:
 *   matrix[y][x]
 *   0 = light
 *   1 = dark
 *
 * No quiet zone is included. The renderer should provide
 * a margin of at least one module around the symbol.
 */
class DataMatrixGenerator {

    /**
     * Create a generator with reusable default options.
     *
     * @param {Object} [options={}]
     * @param {"auto"|"latin1"|"utf8"} [options.encoding="auto"]
     * @param {"auto"|"square"|"rectangle"} [options.shape="square"]
     */
    constructor(options = {}) {
        this.options = Object.freeze(
            DataMatrixGenerator.normalizeOptions(options)
        );
    }

    /**
     * Generate a matrix using this instance's defaults.
     *
     * @param {string} text
     * @param {Object} [options={}] Per-call overrides.
     * @returns {number[][]}
     */
    generate(text, options = {}) {
        return this.generateDetailed(text, options).matrix;
    }

    /**
     * Generate a matrix and its associated encoding information.
     *
     * @param {string} text
     * @param {Object} [options={}] Per-call overrides.
     * @returns {Object}
     */
    generateDetailed(text, options = {}) {
        DataMatrixGenerator.validateOptionsObject(options);

        return DataMatrixGenerator.generateDetailed(text, {
            ...this.options,
            ...options
        });
    }

    /**
     * Generate a matrix without creating a generator instance.
     *
     * Example:
     *   const matrix = DataMatrixGenerator.generate("Hello 1234");
     *
     * @param {string} text
     * @param {Object} [options={}]
     * @returns {number[][]}
     */
    static generate(text, options = {}) {
        return DataMatrixGenerator.generateDetailed(
            text,
            options
        ).matrix;
    }

    /**
     * Generate the complete symbol and encoding details.
     *
     * The encoder receives no capacity option here because
     * symbol selection must happen before padding.
     *
     * @param {string} text
     * @param {Object} [options={}]
     * @returns {{
     *   matrix: number[][],
     *   width: number,
     *   height: number,
     *   symbol: Object,
     *   encodedCodewords: number[],
     *   dataCodewords: number[],
     *   errorCodewords: number[],
     *   codewords: number[]
     * }}
     */
    static generateDetailed(text, options = {}) {
        DataMatrixGenerator.checkDependencies();

        if (typeof text !== "string") {
            throw new TypeError(
                "DataMatrixGenerator: text must be a string."
            );
        }

        if (text.length === 0) {
            throw new RangeError(
                "DataMatrixGenerator: enter some text to encode."
            );
        }

        const settings =
            DataMatrixGenerator.normalizeOptions(options);

        // Preserve the original text, including whitespace.
        const encodedCodewords = DataMatrixEncoder.encode(text, {
            encoding: settings.encoding
        });

        const symbol = DataMatrixSymbol.select(
            encodedCodewords.length,
            { shape: settings.shape }
        );

        if (!symbol) {
            throw new RangeError(
                "DataMatrixGenerator: the encoded text does not " +
                "fit a supported symbol with the requested shape."
            );
        }

        const dataCodewords = DataMatrixEncoder.pad(
            encodedCodewords,
            symbol.dataCapacity
        );

        const codewords = DataMatrixErrorCorrection.encode(
            dataCodewords,
            symbol
        );

        const matrix = DataMatrixPlacement.build(
            codewords,
            symbol
        );

        return {
            matrix,
            width: symbol.width,
            height: symbol.height,
            symbol,
            encodedCodewords,
            dataCodewords,
            errorCodewords: codewords.slice(dataCodewords.length),
            codewords
        };
    }

    /**
     * Validate and apply supported defaults.
     *
     * @param {Object} options
     * @returns {{encoding: string, shape: string}}
     */
    static normalizeOptions(options) {
        DataMatrixGenerator.validateOptionsObject(options);

        const encoding = options.encoding ?? "auto";
        const shape = options.shape ?? "square";

        if (!["auto", "latin1", "utf8"].includes(encoding)) {
            throw new RangeError(
                'DataMatrixGenerator: encoding must be "auto", ' +
                '"latin1" or "utf8".'
            );
        }

        if (!["auto", "square", "rectangle"].includes(shape)) {
            throw new RangeError(
                'DataMatrixGenerator: shape must be "auto", ' +
                '"square" or "rectangle".'
            );
        }

        return { encoding, shape };
    }

    /**
     * @param {Object} options
     */
    static validateOptionsObject(options) {
        if (
            options === null ||
            typeof options !== "object" ||
            Array.isArray(options)
        ) {
            throw new TypeError(
                "DataMatrixGenerator: options must be an object."
            );
        }
    }

    /**
     * Report missing scripts or incompatible class interfaces.
     */
    static checkDependencies() {
        const dependencies = [
            [
                "DataMatrixEncoder",
                typeof DataMatrixEncoder !== "undefined"
                    ? DataMatrixEncoder
                    : null,
                ["encode", "pad"]
            ],
            [
                "DataMatrixErrorCorrection",
                typeof DataMatrixErrorCorrection !== "undefined"
                    ? DataMatrixErrorCorrection
                    : null,
                ["encode"]
            ],
            [
                "DataMatrixSymbol",
                typeof DataMatrixSymbol !== "undefined"
                    ? DataMatrixSymbol
                    : null,
                ["select"]
            ],
            [
                "DataMatrixPlacement",
                typeof DataMatrixPlacement !== "undefined"
                    ? DataMatrixPlacement
                    : null,
                ["build"]
            ]
        ];

        for (const [name, dependency, methods] of dependencies) {
            if (!dependency) {
                throw new Error(
                    `DataMatrixGenerator: load ${name}.js ` +
                    "before generating a symbol."
                );
            }

            for (const method of methods) {
                if (typeof dependency[method] !== "function") {
                    throw new Error(
                        `DataMatrixGenerator: ${name}.${method}() ` +
                        "is required."
                    );
                }
            }
        }
    }
}

if (typeof window !== "undefined") {
    window.DataMatrixGenerator = DataMatrixGenerator;
}