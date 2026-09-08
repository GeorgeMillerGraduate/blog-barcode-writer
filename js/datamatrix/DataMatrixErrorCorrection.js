/**
 * DataMatrixErrorCorrection.js
 *
 * Reed–Solomon error correction for standard Data Matrix ECC 200.
 *
 * Supports:
 * - Standard square and rectangular symbols.
 * - GF(256) using primitive polynomial 0x12D.
 * - Generator roots beginning at alpha^1.
 * - Interleaved error-correction blocks.
 * - Unequal data blocks in the 144 × 144 symbol.
 *
 * Input must already be padded to the selected symbol's
 * DATA capacity using DataMatrixEncoder.pad().
 *
 * Usage:
 *   const data = DataMatrixEncoder.encode("Hello");
 *   const padded = DataMatrixEncoder.pad(data, 5);
 *   const complete = DataMatrixErrorCorrection.encode(padded);
 *
 * encode() returns:
 *   [padded data codewords, interleaved error-correction codewords]
 *
 * The returned array is ready for DataMatrixPlacement.
 */
class DataMatrixErrorCorrection {

    /**
     * Standard ECC 200 configurations.
     *
     * Each entry:
     * [data capacity, total ECC codewords, number of RS blocks]
     *
     * Includes the six original rectangular configurations.
     * Extended DMRE configurations are not included.
     */
    static CONFIGURATIONS = Object.freeze([
        [3,     5,   1],
        [5,     7,   1],
        [8,    10,   1],
        [10,   11,   1],
        [12,   12,   1],
        [16,   14,   1],
        [18,   14,   1],
        [22,   18,   1],
        [30,   20,   1],
        [32,   24,   1],
        [36,   24,   1],
        [44,   28,   1],
        [49,   28,   1],
        [62,   36,   1],
        [86,   42,   1],
        [114,  48,   1],
        [144,  56,   1],
        [174,  68,   1],
        [204,  84,   2],
        [280, 112,   2],
        [368, 144,   4],
        [456, 192,   4],
        [576, 224,   4],
        [696, 272,   4],
        [816, 336,   6],
        [1050, 408,  6],
        [1304, 496,  8],
        [1558, 620, 10]
    ].map(configuration => Object.freeze(configuration)));

    static #exp = null;
    static #log = null;
    static #generators = new Map();

    /**
     * Append error correction to padded data.
     *
     * Configuration is determined from the padded data length.
     * Optional symbol metadata is checked for consistency.
     *
     * @param {number[]|Uint8Array} dataCodewords
     * @param {Object} [symbol]
     * @param {number} [symbol.dataCapacity]
     * @param {number} [symbol.errorCodewords]
     * @param {number} [symbol.blockCount]
     * @returns {number[]}
     */
    static encode(dataCodewords, symbol) {
        DataMatrixErrorCorrection.validateCodewords(dataCodewords);

        const configuration =
            DataMatrixErrorCorrection.getConfiguration(
                dataCodewords.length
            );

        if (symbol !== undefined) {
            DataMatrixErrorCorrection.validateSymbol(
                symbol,
                configuration
            );
        }

        const {
            dataCapacity,
            errorCodewords,
            blockCount,
            errorCodewordsPerBlock
        } = configuration;

        const result = Array.from(dataCodewords);
        result.length = dataCapacity + errorCodewords;

        for (let block = 0; block < blockCount; block++) {
            const blockData = [];

            // Data is distributed cyclically between RS blocks.
            //
            // For 144 × 144:
            // blocks 0–7 receive 156 data codewords each;
            // blocks 8–9 receive 155 data codewords each.
            for (
                let index = block;
                index < dataCapacity;
                index += blockCount
            ) {
                blockData.push(dataCodewords[index]);
            }

            const parity = DataMatrixErrorCorrection.generate(
                blockData,
                errorCodewordsPerBlock
            );

            // Interleave parity after the complete data section.
            for (let index = 0; index < parity.length; index++) {
                result[
                    dataCapacity + index * blockCount + block
                ] = parity[index];
            }
        }

        return result;
    }

    /**
     * Generate parity for one Reed–Solomon block.
     *
     * Returns only the error-correction codewords.
     *
     * @param {number[]|Uint8Array} dataCodewords
     * @param {number} errorCount
     * @returns {number[]}
     */
    static generate(dataCodewords, errorCount) {
        DataMatrixErrorCorrection.validateCodewords(dataCodewords);

        if (
            !Number.isInteger(errorCount) ||
            errorCount < 1 ||
            errorCount > 254
        ) {
            throw new RangeError(
                "DataMatrixErrorCorrection: errorCount must " +
                "be an integer from 1 to 254."
            );
        }

        if (dataCodewords.length + errorCount > 255) {
            throw new RangeError(
                "DataMatrixErrorCorrection: a single RS block " +
                "cannot exceed 255 total codewords."
            );
        }

        DataMatrixErrorCorrection.#initializeField();

        const generator =
            DataMatrixErrorCorrection.#getGenerator(errorCount);

        // Multiply the data polynomial by x^errorCount,
        // then divide by the generator polynomial.
        const remainder = [
            ...dataCodewords,
            ...new Array(errorCount).fill(0)
        ];

        for (
            let index = 0;
            index < dataCodewords.length;
            index++
        ) {
            const coefficient = remainder[index];

            if (coefficient === 0) {
                continue;
            }

            // Generator is monic, so its leading term cancels.
            remainder[index] = 0;

            for (
                let offset = 1;
                offset < generator.length;
                offset++
            ) {
                remainder[index + offset] ^=
                    DataMatrixErrorCorrection.#multiply(
                        coefficient,
                        generator[offset]
                    );
            }
        }

        return remainder.slice(dataCodewords.length);
    }

    /**
     * Return the standard configuration for a padded data length.
     *
     * @param {number} dataCapacity
     * @returns {{
     *   dataCapacity: number,
     *   errorCodewords: number,
     *   blockCount: number,
     *   errorCodewordsPerBlock: number
     * }}
     */
    static getConfiguration(dataCapacity) {
        const entry =
            DataMatrixErrorCorrection.CONFIGURATIONS.find(
                configuration => configuration[0] === dataCapacity
            );

        if (!entry) {
            throw new RangeError(
                "DataMatrixErrorCorrection: unsupported data " +
                `capacity ${dataCapacity}. Pad the data to a ` +
                "standard ECC 200 symbol capacity first."
            );
        }

        const [, errorCodewords, blockCount] = entry;

        return {
            dataCapacity,
            errorCodewords,
            blockCount,
            errorCodewordsPerBlock: errorCodewords / blockCount
        };
    }

    /**
     * Build logarithm and exponent tables for GF(256).
     *
     * Primitive polynomial:
     * x^8 + x^5 + x^3 + x^2 + 1 = 0x12D
     */
    static #initializeField() {
        if (DataMatrixErrorCorrection.#exp !== null) {
            return;
        }

        const exp = new Uint8Array(510);
        const log = new Uint8Array(256);

        let value = 1;

        for (let index = 0; index < 255; index++) {
            exp[index] = value;
            log[value] = index;

            value <<= 1;

            if (value & 0x100) {
                value ^= 0x12D;
            }
        }

        // Repeat the exponent cycle to avoid modulus in multiply().
        for (let index = 255; index < exp.length; index++) {
            exp[index] = exp[index - 255];
        }

        DataMatrixErrorCorrection.#exp = exp;
        DataMatrixErrorCorrection.#log = log;
    }

    /**
     * Multiply two field elements.
     *
     * @param {number} left
     * @param {number} right
     * @returns {number}
     */
    static #multiply(left, right) {
        if (left === 0 || right === 0) {
            return 0;
        }

        return DataMatrixErrorCorrection.#exp[
            DataMatrixErrorCorrection.#log[left] +
            DataMatrixErrorCorrection.#log[right]
        ];
    }

    /**
     * Construct:
     * g(x) = (x + alpha^1) ... (x + alpha^degree)
     *
     * Coefficients are stored highest degree first.
     *
     * @param {number} degree
     * @returns {number[]}
     */
    static #getGenerator(degree) {
        const cached =
            DataMatrixErrorCorrection.#generators.get(degree);

        if (cached) {
            return cached;
        }

        let polynomial = [1];

        for (let power = 1; power <= degree; power++) {
            const root = DataMatrixErrorCorrection.#exp[power];
            const next = new Array(polynomial.length + 1).fill(0);

            for (
                let index = 0;
                index < polynomial.length;
                index++
            ) {
                next[index] ^= polynomial[index];

                next[index + 1] ^=
                    DataMatrixErrorCorrection.#multiply(
                        polynomial[index],
                        root
                    );
            }

            polynomial = next;
        }

        Object.freeze(polynomial);
        DataMatrixErrorCorrection.#generators.set(
            degree,
            polynomial
        );

        return polynomial;
    }

    /**
     * @param {number[]|Uint8Array} codewords
     */
    static validateCodewords(codewords) {
        if (
            !Array.isArray(codewords) &&
            !(codewords instanceof Uint8Array)
        ) {
            throw new TypeError(
                "DataMatrixErrorCorrection: codewords must " +
                "be an array or Uint8Array."
            );
        }

        if (codewords.length === 0) {
            throw new RangeError(
                "DataMatrixErrorCorrection: codewords " +
                "must not be empty."
            );
        }

        for (let index = 0; index < codewords.length; index++) {
            const value = codewords[index];

            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value > 255
            ) {
                throw new RangeError(
                    `DataMatrixErrorCorrection: codeword ${index} ` +
                    "must be an integer from 0 to 255."
                );
            }
        }
    }

    /**
     * Check optional metadata against the standard configuration.
     *
     * @param {Object} symbol
     * @param {Object} configuration
     */
    static validateSymbol(symbol, configuration) {
        if (
            symbol === null ||
            typeof symbol !== "object" ||
            Array.isArray(symbol)
        ) {
            throw new TypeError(
                "DataMatrixErrorCorrection: symbol must be an object."
            );
        }

        for (const key of [
            "dataCapacity",
            "errorCodewords",
            "blockCount"
        ]) {
            if (
                symbol[key] !== undefined &&
                symbol[key] !== configuration[key]
            ) {
                throw new RangeError(
                    `DataMatrixErrorCorrection: symbol.${key} ` +
                    `must be ${configuration[key]} for this capacity.`
                );
            }
        }
    }
}

if (typeof window !== "undefined") {
    window.DataMatrixErrorCorrection = DataMatrixErrorCorrection;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = DataMatrixErrorCorrection;
}