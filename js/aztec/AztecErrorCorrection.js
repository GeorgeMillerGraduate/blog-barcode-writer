/**
 * AztecErrorCorrection
 *
 * Generates Reed-Solomon error-correction codewords for Aztec.
 *
 * Supported word sizes:
 *   4 bits  — mode message
 *   6 bits  — symbol data
 *   8 bits  — symbol data
 *   10 bits — symbol data
 *   12 bits — symbol data
 *
 * Uses its own finite-field implementation, so it does not
 * depend on the existing QR GaloisField or Polynomial classes.
 *
 * Important:
 * Symbol data must be bit-stuffed and aligned to the chosen
 * word size BEFORE calling generateCheckWords().
 *
 * The mode message does not require bit stuffing.
 */
class AztecErrorCorrection {

    /**
     * Generate parity words.
     *
     * Input and output words are integers, not individual bits.
     * The original input is not modified.
     *
     * @param {number[]|Uint8Array|Uint16Array} dataWords
     * @param {number} errorWordCount
     * @param {number} wordSize
     * @returns {number[]} Parity words only.
     */
    static generate(dataWords, errorWordCount, wordSize) {
        const field = AztecErrorCorrection.createField(wordSize);

        if (
            !Array.isArray(dataWords) &&
            !(dataWords instanceof Uint8Array) &&
            !(dataWords instanceof Uint16Array)
        ) {
            throw new TypeError(
                "Data words must be an array of integers."
            );
        }

        const data = Array.from(dataWords);

        if (data.length === 0) {
            throw new Error(
                "At least one data word is required."
            );
        }

        if (
            !Number.isInteger(errorWordCount) ||
            errorWordCount < 1
        ) {
            throw new RangeError(
                "Error-correction word count must be a positive integer."
            );
        }

        if (
            data.length + errorWordCount >
            field.size - 1
        ) {
            throw new RangeError(
                "Too many codewords for the selected finite field."
            );
        }

        for (const word of data) {
            if (
                !Number.isInteger(word) ||
                word < 0 ||
                word >= field.size
            ) {
                throw new RangeError(
                    `Each data word must fit in ${wordSize} bits.`
                );
            }
        }

        /*
         * Generator polynomial:
         *
         * g(x) = (x + α¹)(x + α²)...(x + α^r)
         *
         * Aztec uses generator base 1.
         * Coefficients are stored highest degree first.
         */
        let generator = [1];

        for (let power = 1; power <= errorWordCount; power++) {
            const root = field.exp[power];
            const next = new Array(generator.length + 1).fill(0);

            for (let index = 0; index < generator.length; index++) {
                next[index] ^= generator[index];

                next[index + 1] ^= AztecErrorCorrection.multiply(
                    generator[index],
                    root,
                    field
                );
            }

            generator = next;
        }

        /*
         * Multiply the message polynomial by x^r, then divide
         * by the generator polynomial.
         *
         * In characteristic two, subtraction is XOR.
         * The final r coefficients contain the remainder.
         */
        const work = data.concat(
            new Array(errorWordCount).fill(0)
        );

        for (let index = 0; index < data.length; index++) {
            const coefficient = work[index];

            if (coefficient === 0) {
                continue;
            }

            for (
                let generatorIndex = 0;
                generatorIndex < generator.length;
                generatorIndex++
            ) {
                work[index + generatorIndex] ^=
                    AztecErrorCorrection.multiply(
                        coefficient,
                        generator[generatorIndex],
                        field
                    );
            }
        }

        return work.slice(data.length);
    }

    /**
     * Return data words followed by their parity words.
     *
     * @param {number[]|Uint8Array|Uint16Array} dataWords
     * @param {number} errorWordCount
     * @param {number} wordSize
     * @returns {number[]}
     */
    static encode(dataWords, errorWordCount, wordSize) {
        const parity = AztecErrorCorrection.generate(
            dataWords,
            errorWordCount,
            wordSize
        );

        return Array.from(dataWords).concat(parity);
    }

    /**
     * Convert aligned data bits into a complete protected bit stream.
     *
     * Symbol payload:
     *   Pass bit-stuffed data bits and the selected layer capacity.
     *
     * Mode message:
     *   Pass the raw 8-bit or 16-bit message, with wordSize = 4.
     *
     * Any capacity remainder smaller than one word becomes
     * leading zero bits, before the data and parity words.
     *
     * @param {number[]|Uint8Array} dataBits
     * @param {number} totalBits Total available bit capacity.
     * @param {number} wordSize
     * @returns {number[]} Exactly totalBits bits.
     */
    static generateCheckWords(dataBits, totalBits, wordSize) {
        AztecErrorCorrection.validateWordSize(wordSize);
        AztecErrorCorrection.validateBits(dataBits);

        if (
            !Number.isSafeInteger(totalBits) ||
            totalBits < 1
        ) {
            throw new RangeError(
                "Total bit capacity must be a positive integer."
            );
        }

        if (dataBits.length === 0) {
            throw new Error(
                "Cannot add error correction to an empty bit stream."
            );
        }

        if (dataBits.length % wordSize !== 0) {
            throw new Error(
                "Data bits must be aligned to the selected word size. " +
                "Apply Aztec bit stuffing before error correction."
            );
        }

        const dataWordCount = dataBits.length / wordSize;
        const totalWordCount = Math.floor(totalBits / wordSize);
        const errorWordCount = totalWordCount - dataWordCount;

        if (errorWordCount < 1) {
            throw new RangeError(
                "The selected capacity leaves no room for error correction."
            );
        }

        const dataWords = [];

        for (
            let offset = 0;
            offset < dataBits.length;
            offset += wordSize
        ) {
            let word = 0;

            for (let bit = 0; bit < wordSize; bit++) {
                word = (word << 1) | dataBits[offset + bit];
            }

            dataWords.push(word);
        }

        const protectedWords = AztecErrorCorrection.encode(
            dataWords,
            errorWordCount,
            wordSize
        );

        const leadingPadding = totalBits % wordSize;
        const result = new Array(leadingPadding).fill(0);

        for (const word of protectedWords) {
            AztecErrorCorrection.appendBits(
                result,
                word,
                wordSize
            );
        }

        return result;
    }

    /**
     * Build and protect the mode message.
     *
     * Compact:
     *   2 bits: layer count minus one
     *   6 bits: data word count minus one
     *   20 parity bits
     *   Total: 28 bits
     *
     * Full:
     *   5 bits: layer count minus one
     *   11 bits: data word count minus one
     *   24 parity bits
     *   Total: 40 bits
     *
     * dataWordCount means stuffed payload words, excluding parity.
     *
     * @param {boolean} compact
     * @param {number} layers
     * @param {number} dataWordCount
     * @returns {number[]}
     */
    static generateModeMessage(compact, layers, dataWordCount) {
        if (typeof compact !== "boolean") {
            throw new TypeError(
                "Compact mode must be a boolean."
            );
        }

        const maxLayers = compact ? 4 : 32;
        const maxDataWords = compact ? 64 : 2048;

        if (
            !Number.isInteger(layers) ||
            layers < 1 ||
            layers > maxLayers
        ) {
            throw new RangeError(
                `Layer count must be between 1 and ${maxLayers}.`
            );
        }

        if (
            !Number.isInteger(dataWordCount) ||
            dataWordCount < 1 ||
            dataWordCount > maxDataWords
        ) {
            throw new RangeError(
                `Data word count must be between 1 and ${maxDataWords}.`
            );
        }

        const bits = [];

        AztecErrorCorrection.appendBits(
            bits,
            layers - 1,
            compact ? 2 : 5
        );

        AztecErrorCorrection.appendBits(
            bits,
            dataWordCount - 1,
            compact ? 6 : 11
        );

        return AztecErrorCorrection.generateCheckWords(
            bits,
            compact ? 28 : 40,
            4
        );
    }

    /**
     * Create the finite field for an Aztec word size.
     *
     * The primitive element is α = 2.
     *
     * @param {number} wordSize
     * @returns {{
     *   size: number,
     *   exp: Int32Array,
     *   log: Int32Array
     * }}
     */
    static createField(wordSize) {
        AztecErrorCorrection.validateWordSize(wordSize);

        const primitivePolynomials = {
            4: 0x13,
            6: 0x43,
            8: 0x12D,
            10: 0x409,
            12: 0x1069
        };

        const size = 1 << wordSize;
        const primitive = primitivePolynomials[wordSize];
        const exp = new Int32Array(size);
        const log = new Int32Array(size);

        let value = 1;

        for (let index = 0; index < size - 1; index++) {
            exp[index] = value;
            log[value] = index;

            value <<= 1;

            if (value >= size) {
                value ^= primitive;
            }
        }

        // α^(size - 1) = 1.
        exp[size - 1] = 1;

        return {
            size,
            exp,
            log
        };
    }

    /**
     * Multiply two field elements.
     *
     * @param {number} left
     * @param {number} right
     * @param {{size: number, exp: Int32Array, log: Int32Array}} field
     * @returns {number}
     */
    static multiply(left, right, field) {
        if (left === 0 || right === 0) {
            return 0;
        }

        const exponent = (
            field.log[left] + field.log[right]
        ) % (field.size - 1);

        return field.exp[exponent];
    }

    /**
     * Append an integer most-significant bit first.
     *
     * Internal helper; callers supply validated values.
     *
     * @param {number[]} bits
     * @param {number} value
     * @param {number} width
     */
    static appendBits(bits, value, width) {
        for (let shift = width - 1; shift >= 0; shift--) {
            bits.push((value >>> shift) & 1);
        }
    }

    /**
     * @param {number} wordSize
     */
    static validateWordSize(wordSize) {
        if (![4, 6, 8, 10, 12].includes(wordSize)) {
            throw new RangeError(
                "Aztec word size must be 4, 6, 8, 10 or 12 bits."
            );
        }
    }

    /**
     * Accept the numeric bit-array format returned by AztecEncoder.
     *
     * @param {number[]|Uint8Array} bits
     */
    static validateBits(bits) {
        if (
            !Array.isArray(bits) &&
            !(bits instanceof Uint8Array)
        ) {
            throw new TypeError(
                "Bits must be an array or Uint8Array containing 0 and 1."
            );
        }

        for (const bit of bits) {
            if (bit !== 0 && bit !== 1) {
                throw new TypeError(
                    "Each bit must be the number 0 or 1."
                );
            }
        }
    }
}