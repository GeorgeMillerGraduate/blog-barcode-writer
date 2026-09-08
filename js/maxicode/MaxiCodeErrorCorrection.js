/**
 * MaxiCodeErrorCorrection.js
 *
 * Reed–Solomon error correction for MaxiCode modes 2–5.
 *
 * Uses GF(64):
 *   Primitive polynomial: x^6 + x + 1 (0x43)
 *   Generator roots: alpha^1 through alpha^errorCount
 *
 * Primary message:
 *   10 data codewords + 10 error-correction codewords.
 *
 * Secondary message:
 *   Modes 2/3/4: two blocks of 42 data + 20 ECC.
 *   Mode 5:     two blocks of 34 data + 28 ECC.
 *
 * All codewords are six-bit integers from 0 to 63.
 *
 * Usage:
 *   const encoded = MaxiCodeEncoder.encode("Hello 123456789");
 *   const codewords = MaxiCodeErrorCorrection.encode(encoded);
 *
 * Returns exactly 144 codewords in placement order:
 *   primary data
 *   primary ECC
 *   secondary data
 *   interleaved secondary ECC
 *
 * Input arrays are never modified.
 */
class MaxiCodeErrorCorrection {

    static #exp = null;
    static #log = null;
    static #generators = new Map();

    /**
     * Add error correction to a MaxiCodeEncoder result.
     *
     * @param {Object} encoded
     * @param {2|3|4|5} encoded.mode
     * @param {number[]|Uint8Array} encoded.primaryData
     * @param {number[]|Uint8Array} encoded.secondaryData
     * @returns {number[]} Complete 144-codeword sequence.
     */
    static encode(encoded) {
        if (
            encoded === null ||
            typeof encoded !== "object" ||
            Array.isArray(encoded)
        ) {
            throw new TypeError(
                "MaxiCodeErrorCorrection: expected a " +
                "MaxiCodeEncoder result object."
            );
        }

        const {
            mode,
            primaryData,
            secondaryData
        } = encoded;

        if (![2, 3, 4, 5].includes(mode)) {
            throw new RangeError(
                "MaxiCodeErrorCorrection: supported modes " +
                "are 2, 3, 4 and 5."
            );
        }

        MaxiCodeErrorCorrection.#validateCodewords(
            primaryData,
            "primaryData"
        );

        MaxiCodeErrorCorrection.#validateCodewords(
            secondaryData,
            "secondaryData"
        );

        if (primaryData.length !== 10) {
            throw new RangeError(
                "MaxiCodeErrorCorrection: primaryData must " +
                "contain exactly 10 codewords."
            );
        }

        // The low four bits identify the mode.
        // In modes 2/3 the upper two bits contain postcode data.
        if ((primaryData[0] & 0x0F) !== mode) {
            throw new RangeError(
                "MaxiCodeErrorCorrection: the primary mode " +
                "bits do not match encoded.mode."
            );
        }

        const secondaryLength = mode === 5 ? 68 : 84;
        const errorsPerBlock = mode === 5 ? 28 : 20;

        if (secondaryData.length !== secondaryLength) {
            throw new RangeError(
                `MaxiCodeErrorCorrection: mode ${mode} requires ` +
                `${secondaryLength} padded secondary codewords.`
            );
        }

        const primaryECC = MaxiCodeErrorCorrection.generate(
            primaryData,
            10
        );

        const evenData = [];
        const oddData = [];

        for (let index = 0; index < secondaryLength; index++) {
            if (index % 2 === 0) {
                evenData.push(secondaryData[index]);
            } else {
                oddData.push(secondaryData[index]);
            }
        }

        const evenECC = MaxiCodeErrorCorrection.generate(
            evenData,
            errorsPerBlock
        );

        const oddECC = MaxiCodeErrorCorrection.generate(
            oddData,
            errorsPerBlock
        );

        const result = [
            ...primaryData,
            ...primaryECC,
            ...secondaryData
        ];

        for (let index = 0; index < errorsPerBlock; index++) {
            result.push(evenECC[index], oddECC[index]);
        }

        return result;
    }

    /**
     * Generate parity for one Reed–Solomon block.
     *
     * Returns only ECC codewords, in transmission order.
     * Do not reverse the returned array.
     *
     * @param {number[]|Uint8Array} dataCodewords
     * @param {number} errorCount
     * @returns {number[]}
     */
    static generate(dataCodewords, errorCount) {
        MaxiCodeErrorCorrection.#validateCodewords(
            dataCodewords,
            "dataCodewords"
        );

        if (dataCodewords.length === 0) {
            throw new RangeError(
                "MaxiCodeErrorCorrection: an RS block must " +
                "contain at least one data codeword."
            );
        }

        if (
            !Number.isInteger(errorCount) ||
            errorCount < 1 ||
            errorCount > 62
        ) {
            throw new RangeError(
                "MaxiCodeErrorCorrection: errorCount must " +
                "be an integer from 1 to 62."
            );
        }

        if (dataCodewords.length + errorCount > 63) {
            throw new RangeError(
                "MaxiCodeErrorCorrection: a GF(64) RS block " +
                "cannot exceed 63 total codewords."
            );
        }

        MaxiCodeErrorCorrection.#initializeField();

        const generator =
            MaxiCodeErrorCorrection.#getGenerator(errorCount);

        // Multiply the data polynomial by x^errorCount.
        const remainder = [
            ...dataCodewords,
            ...new Array(errorCount).fill(0)
        ];

        // Divide by the monic generator polynomial.
        // In characteristic two, subtraction is XOR.
        for (
            let index = 0;
            index < dataCodewords.length;
            index++
        ) {
            const coefficient = remainder[index];

            if (coefficient === 0) {
                continue;
            }

            remainder[index] = 0;

            for (
                let offset = 1;
                offset < generator.length;
                offset++
            ) {
                remainder[index + offset] ^=
                    MaxiCodeErrorCorrection.#multiply(
                        coefficient,
                        generator[offset]
                    );
            }
        }

        return remainder.slice(dataCodewords.length);
    }

    /**
     * Build exponent and logarithm tables for GF(64).
     */
    static #initializeField() {
        if (MaxiCodeErrorCorrection.#exp !== null) {
            return;
        }

        const exp = new Uint8Array(126);
        const log = new Uint8Array(64);

        let value = 1;

        for (let index = 0; index < 63; index++) {
            exp[index] = value;
            log[value] = index;

            value <<= 1;

            if (value & 0x40) {
                value ^= 0x43;
            }
        }

        // Repeat the exponent cycle so multiplication can
        // add logarithms without an explicit modulo operation.
        for (let index = 63; index < exp.length; index++) {
            exp[index] = exp[index - 63];
        }

        MaxiCodeErrorCorrection.#exp = exp;
        MaxiCodeErrorCorrection.#log = log;
    }

    /**
     * Multiply two six-bit field elements.
     */
    static #multiply(left, right) {
        if (left === 0 || right === 0) {
            return 0;
        }

        return MaxiCodeErrorCorrection.#exp[
            MaxiCodeErrorCorrection.#log[left] +
            MaxiCodeErrorCorrection.#log[right]
        ];
    }

    /**
     * Build and cache the generator polynomial:
     *
     *   g(x) = (x + alpha^1) ... (x + alpha^degree)
     *
     * Coefficients are stored highest degree first.
     */
    static #getGenerator(degree) {
        const cached =
            MaxiCodeErrorCorrection.#generators.get(degree);

        if (cached !== undefined) {
            return cached;
        }

        let polynomial = [1];

        for (let power = 1; power <= degree; power++) {
            const root = MaxiCodeErrorCorrection.#exp[power];

            const next = new Array(
                polynomial.length + 1
            ).fill(0);

            for (
                let index = 0;
                index < polynomial.length;
                index++
            ) {
                next[index] ^= polynomial[index];

                next[index + 1] ^=
                    MaxiCodeErrorCorrection.#multiply(
                        polynomial[index],
                        root
                    );
            }

            polynomial = next;
        }

        Object.freeze(polynomial);

        MaxiCodeErrorCorrection.#generators.set(
            degree,
            polynomial
        );

        return polynomial;
    }

    /**
     * Validate six-bit codewords without coercing input values.
     */
    static #validateCodewords(codewords, name) {
        if (
            !Array.isArray(codewords) &&
            !(codewords instanceof Uint8Array)
        ) {
            throw new TypeError(
                `MaxiCodeErrorCorrection: ${name} must be ` +
                "an array or Uint8Array."
            );
        }

        for (let index = 0; index < codewords.length; index++) {
            const value = codewords[index];

            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value > 63
            ) {
                throw new RangeError(
                    `MaxiCodeErrorCorrection: ${name}[${index}] ` +
                    "must be an integer from 0 to 63."
                );
            }
        }
    }
}

if (typeof window !== "undefined") {
    window.MaxiCodeErrorCorrection = MaxiCodeErrorCorrection;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = MaxiCodeErrorCorrection;
}