/**
 * MaxiCodeGenerator.js
 *
 * Coordinates MaxiCode generation:
 *
 * 1. Encode text and any structured carrier information.
 * 2. Generate primary and secondary error correction.
 * 3. Place the complete 144-codeword sequence into the matrix.
 *
 * Required script order:
 *   MaxiCodeEncoder.js
 *   MaxiCodeErrorCorrection.js
 *   MaxiCodeMatrix.js
 *   MaxiCodeGenerator.js
 *
 * Required matrix interface:
 *   MaxiCodeMatrix.build(codewords)
 *
 * The matrix builder must return a 33-row, 30-column array
 * containing the data modules and fixed orientation marks:
 *
 *   matrix[row][column]
 *   0 = light
 *   1 = dark
 *
 * Rendering:
 * - Modules are hexagonal and arranged in staggered rows.
 * - The central circular bull's-eye is drawn separately.
 * - A square-cell QR/Data Matrix renderer is not sufficient.
 * - No quiet zone is added by this generator.
 *
 * Basic usage:
 *   const matrix = MaxiCodeGenerator.generate("Hello 123456789");
 *
 * Detailed usage:
 *   const result = MaxiCodeGenerator.generateDetailed("Hello");
 *   // result.matrix
 *   // result.codewords
 *   // result.mode
 */
class MaxiCodeGenerator {

    /**
     * Create an instance with reusable default options.
     *
     * @param {Object} [options={}]
     * @param {2|3|4|5} [options.mode=4]
     * @param {string} [options.postcode]
     * @param {number} [options.countryCode]
     * @param {number} [options.serviceClass]
     */
    constructor(options = {}) {
        this.options = Object.freeze(
            MaxiCodeGenerator.normalizeOptions(options)
        );
    }

    /**
     * Generate a module matrix using this instance's defaults.
     *
     * @param {string} text
     * @param {Object} [options={}] Per-call overrides.
     * @returns {number[][]}
     */
    generate(text, options = {}) {
        return this.generateDetailed(text, options).matrix;
    }

    /**
     * Generate a matrix and its encoding details.
     *
     * @param {string} text
     * @param {Object} [options={}] Per-call overrides.
     * @returns {Object}
     */
    generateDetailed(text, options = {}) {
        MaxiCodeGenerator.validateOptionsObject(options);

        return MaxiCodeGenerator.generateDetailed(text, {
            ...this.options,
            ...options
        });
    }

    /**
     * Generate without creating an instance.
     *
     * @param {string} text
     * @param {Object} [options={}]
     * @returns {number[][]}
     */
    static generate(text, options = {}) {
        return MaxiCodeGenerator.generateDetailed(
            text,
            options
        ).matrix;
    }

    /**
     * Generate the complete symbol and encoding information.
     *
     * An empty message is permitted. Modes 2/3 still require
     * the structured carrier fields validated by the encoder.
     *
     * @param {string} text
     * @param {Object} [options={}]
     * @returns {{
     *   matrix: number[][],
     *   rows: number,
     *   columns: number,
     *   mode: number,
     *   primaryData: number[],
     *   secondaryData: number[],
     *   dataCodewords: number[],
     *   messageCodewords: number[],
     *   messageCapacity: number,
     *   primaryErrorCount: number,
     *   secondaryErrorCount: number,
     *   primaryErrorCodewords: number[],
     *   secondaryErrorCodewords: number[],
     *   codewords: number[]
     * }}
     */
    static generateDetailed(text, options = {}) {
        MaxiCodeGenerator.checkDependencies();

        if (typeof text !== "string") {
            throw new TypeError(
                "MaxiCodeGenerator: text must be a string."
            );
        }

        const settings =
            MaxiCodeGenerator.normalizeOptions(options);

        // Preserve whitespace and the original character case.
        const encoded = MaxiCodeEncoder.encode(text, settings);

        const codewords = MaxiCodeErrorCorrection.encode(encoded);

        if (codewords.length !== 144) {
            throw new Error(
                "MaxiCodeGenerator: error correction must " +
                "return exactly 144 codewords."
            );
        }

        // Pass a copy so placement cannot alter the encoding details.
        const matrix = MaxiCodeMatrix.build(codewords.slice());

        MaxiCodeGenerator.validateMatrix(matrix);

        const secondaryErrorStart =
            20 + encoded.secondaryData.length;

        return {
            matrix,
            rows: 33,
            columns: 30,
            mode: encoded.mode,

            primaryData: encoded.primaryData,
            secondaryData: encoded.secondaryData,
            dataCodewords: encoded.dataCodewords,
            messageCodewords: encoded.messageCodewords,
            messageCapacity: encoded.messageCapacity,

            primaryErrorCount: encoded.primaryErrorCount,
            secondaryErrorCount: encoded.secondaryErrorCount,

            primaryErrorCodewords: codewords.slice(10, 20),
            secondaryErrorCodewords: codewords.slice(
                secondaryErrorStart
            ),

            codewords
        };
    }

    /**
     * Apply generator defaults.
     *
     * Carrier fields are validated by MaxiCodeEncoder when
     * generating a mode 2 or mode 3 symbol.
     */
    static normalizeOptions(options) {
        MaxiCodeGenerator.validateOptionsObject(options);

        const mode = options.mode ?? 4;

        if (![2, 3, 4, 5].includes(mode)) {
            throw new RangeError(
                "MaxiCodeGenerator: supported modes " +
                "are 2, 3, 4 and 5."
            );
        }

        return {
            mode,
            postcode: options.postcode,
            countryCode: options.countryCode,
            serviceClass: options.serviceClass
        };
    }

    static validateOptionsObject(options) {
        if (
            options === null ||
            typeof options !== "object" ||
            Array.isArray(options)
        ) {
            throw new TypeError(
                "MaxiCodeGenerator: options must be an object."
            );
        }
    }

    /**
     * Check the matrix builder's output contract.
     */
    static validateMatrix(matrix) {
        if (!Array.isArray(matrix) || matrix.length !== 33) {
            throw new Error(
                "MaxiCodeGenerator: the matrix must have 33 rows."
            );
        }

        for (let row = 0; row < 33; row++) {
            const values = matrix[row];

            if (
                (!Array.isArray(values) &&
                    !(values instanceof Uint8Array)) ||
                values.length !== 30
            ) {
                throw new Error(
                    `MaxiCodeGenerator: matrix row ${row} ` +
                    "must have 30 columns."
                );
            }

            for (let column = 0; column < 30; column++) {
                if (values[column] !== 0 && values[column] !== 1) {
                    throw new Error(
                        `MaxiCodeGenerator: matrix[${row}]` +
                        `[${column}] must be 0 or 1.`
                    );
                }
            }
        }
    }

    /**
     * Report missing classes or required static methods.
     */
    static checkDependencies() {
        const dependencies = [
            [
                "MaxiCodeEncoder",
                typeof MaxiCodeEncoder !== "undefined"
                    ? MaxiCodeEncoder
                    : null,
                "encode"
            ],
            [
                "MaxiCodeErrorCorrection",
                typeof MaxiCodeErrorCorrection !== "undefined"
                    ? MaxiCodeErrorCorrection
                    : null,
                "encode"
            ],
            [
                "MaxiCodeMatrix",
                typeof MaxiCodeMatrix !== "undefined"
                    ? MaxiCodeMatrix
                    : null,
                "build"
            ]
        ];

        for (const [name, dependency, method] of dependencies) {
            if (!dependency) {
                throw new Error(
                    `MaxiCodeGenerator: load ${name}.js ` +
                    "before generating a symbol."
                );
            }

            if (typeof dependency[method] !== "function") {
                throw new Error(
                    `MaxiCodeGenerator: ${name}.${method}() ` +
                    "is required."
                );
            }
        }
    }
}

if (typeof window !== "undefined") {
    window.MaxiCodeGenerator = MaxiCodeGenerator;
}