/**
 * DataMatrixEncoder.js
 *
 * Encodes text into Data Matrix ECC 200 data codewords.
 *
 * Features:
 * - ASCII encoding.
 * - Compression of consecutive digit pairs.
 * - Upper Shift for bytes 128–255.
 * - Latin-1 and UTF-8 (ECI 26).
 * - Padding to a selected symbol's data capacity.
 *
 * Error correction, symbol selection and matrix placement
 * are handled by the other Data Matrix classes.
 *
 * Usage:
 *   const data = DataMatrixEncoder.encode("Hello 1234");
 *   const padded = DataMatrixEncoder.pad(data, dataCapacity);
 *
 * encode() returns an unpadded number[] unless options.capacity
 * is supplied. Capacity counts DATA codewords only.
 */
class DataMatrixEncoder {

    /**
     * Encode a string.
     *
     * @param {string} text
     * @param {Object} [options={}]
     * @param {"auto"|"latin1"|"utf8"} [options.encoding="auto"]
     * @param {number} [options.capacity]
     * @returns {number[]}
     */
    static encode(text, options = {}) {
        if (typeof text !== "string") {
            throw new TypeError(
                "DataMatrixEncoder: text must be a string."
            );
        }

        if (
            options === null ||
            typeof options !== "object" ||
            Array.isArray(options)
        ) {
            throw new TypeError(
                "DataMatrixEncoder: options must be an object."
            );
        }

        const encoding = options.encoding ?? "auto";

        if (!["auto", "latin1", "utf8"].includes(encoding)) {
            throw new RangeError(
                'DataMatrixEncoder: encoding must be "auto", ' +
                '"latin1" or "utf8".'
            );
        }

        // Reject malformed UTF-16 instead of silently replacing it.
        DataMatrixEncoder.validateText(text);

        const isLatin1 = Array.from(text).every(
            character => character.codePointAt(0) <= 255
        );

        if (encoding === "latin1" && !isLatin1) {
            throw new RangeError(
                "DataMatrixEncoder: text contains characters " +
                "outside Latin-1."
            );
        }

        const useUtf8 =
            encoding === "utf8" ||
            (encoding === "auto" && !isLatin1);

        let bytes;
        let codewords;

        if (useUtf8) {
            bytes = new TextEncoder().encode(text);

            // ECI latch 241; assignment 26 (UTF-8) is stored as 27.
            codewords = [241, 27];
        } else {
            bytes = Uint8Array.from(
                text,
                character => character.charCodeAt(0)
            );
            codewords = [];
        }

        codewords.push(
            ...DataMatrixEncoder.encodeBytes(bytes)
        );

        if (options.capacity !== undefined) {
            return DataMatrixEncoder.pad(
                codewords,
                options.capacity
            );
        }

        return codewords;
    }

    /**
     * Encode bytes using Data Matrix ASCII mode.
     *
     * This method does not add an ECI header or padding.
     * Raw bytes have the default Latin-1 interpretation.
     *
     * @param {number[]|Uint8Array} bytes
     * @returns {number[]}
     */
    static encodeBytes(bytes) {
        DataMatrixEncoder.validateBytes(bytes, "bytes");

        const codewords = [];

        for (let index = 0; index < bytes.length;) {
            const current = bytes[index];

            // Two decimal digits fit in one codeword: 130–229.
            if (
                DataMatrixEncoder.isDigit(current) &&
                index + 1 < bytes.length &&
                DataMatrixEncoder.isDigit(bytes[index + 1])
            ) {
                const value =
                    (current - 48) * 10 +
                    (bytes[index + 1] - 48);

                codewords.push(130 + value);
                index += 2;
                continue;
            }

            if (current <= 127) {
                codewords.push(current + 1);
            } else {
                // Upper Shift applies only to the following byte.
                codewords.push(235, current - 127);
            }

            index++;
        }

        return codewords;
    }

    /**
     * Pad ASCII-mode data codewords to the symbol's data capacity.
     *
     * The first padding codeword is 129. Subsequent padding uses
     * the ECC 200 position-dependent randomisation formula.
     *
     * Returns a new array; the input is never modified.
     *
     * @param {number[]|Uint8Array} codewords
     * @param {number} capacity Data capacity, excluding ECC.
     * @returns {number[]}
     */
    static pad(codewords, capacity) {
        DataMatrixEncoder.validateBytes(
            codewords,
            "codewords"
        );

        if (!Number.isSafeInteger(capacity) || capacity < 1) {
            throw new RangeError(
                "DataMatrixEncoder: capacity must be " +
                "a positive safe integer."
            );
        }

        if (codewords.length > capacity) {
            throw new RangeError(
                `DataMatrixEncoder: ${codewords.length} data ` +
                `codewords exceed capacity ${capacity}.`
            );
        }

        const result = Array.from(codewords);

        if (result.length === capacity) {
            return result;
        }

        result.push(129);

        while (result.length < capacity) {
            // Positions count from one, including any ECI header.
            const position = result.length + 1;
            const randomValue = ((149 * position) % 253) + 1;
            const value = 129 + randomValue;

            result.push(value <= 254 ? value : value - 254);
        }

        return result;
    }

    /**
     * @param {number} byte
     * @returns {boolean}
     */
    static isDigit(byte) {
        return byte >= 48 && byte <= 57;
    }

    /**
     * @param {number[]|Uint8Array} values
     * @param {string} name
     */
    static validateBytes(values, name) {
        if (
            !Array.isArray(values) &&
            !(values instanceof Uint8Array)
        ) {
            throw new TypeError(
                `DataMatrixEncoder: ${name} must be an array ` +
                "or Uint8Array."
            );
        }

        for (let index = 0; index < values.length; index++) {
            const value = values[index];

            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value > 255
            ) {
                throw new RangeError(
                    `DataMatrixEncoder: ${name}[${index}] ` +
                    "must be an integer from 0 to 255."
                );
            }
        }
    }

    /**
     * Reject isolated UTF-16 surrogate code units.
     *
     * @param {string} text
     */
    static validateText(text) {
        for (let index = 0; index < text.length; index++) {
            const unit = text.charCodeAt(index);

            if (unit >= 0xD800 && unit <= 0xDBFF) {
                const next = text.charCodeAt(index + 1);

                if (!(next >= 0xDC00 && next <= 0xDFFF)) {
                    throw new RangeError(
                        "DataMatrixEncoder: unpaired high " +
                        `surrogate at index ${index}.`
                    );
                }

                index++;
            } else if (unit >= 0xDC00 && unit <= 0xDFFF) {
                throw new RangeError(
                    "DataMatrixEncoder: unpaired low " +
                    `surrogate at index ${index}.`
                );
            }
        }
    }
}

// Browser: load before DataMatrixGenerator.js.
if (typeof window !== "undefined") {
    window.DataMatrixEncoder = DataMatrixEncoder;
}

// Optional Node.js support.
if (typeof module !== "undefined" && module.exports) {
    module.exports = DataMatrixEncoder;
}