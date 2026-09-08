/**
 * AztecEncoder
 *
 * Converts text or raw bytes into an Aztec high-level bit stream.
 *
 * Supported:
 *   - Strings: UTF-8 with an ECI marker when needed.
 *   - Uint8Array: raw bytes without an ECI marker.
 *   - Short and extended binary-shift blocks.
 *
 * Returns:
 *   {
 *       bits: number[],       // Individual bits, each 0 or 1.
 *       bitLength: number,
 *       bytes: Uint8Array,
 *       byteLength: number,
 *       encoding: string,
 *       eci: number | null
 *   }
 *
 * This class does not perform:
 *   - Codeword bit stuffing.
 *   - Layer selection.
 *   - Reed-Solomon error correction.
 *   - Matrix placement.
 *
 * Those operations belong to the remaining Aztec classes.
 *
 * Usage:
 *   const encoded = AztecEncoder.encode("Hello world");
 *   const bits = encoded.bits;
 */
class AztecEncoder {

    /**
     * Encode text or raw bytes.
     *
     * @param {string|Uint8Array} data
     * @returns {{
     *   bits: number[],
     *   bitLength: number,
     *   bytes: Uint8Array,
     *   byteLength: number,
     *   encoding: string,
     *   eci: number|null
     * }}
     */
    static encode(data) {
        let bytes;
        let encoding;
        let eci = null;

        if (typeof data === "string") {
            if (data.length === 0) {
                throw new Error(
                    "Enter some data before generating an Aztec code."
                );
            }

            AztecEncoder.validateUnicode(data);

            bytes = new TextEncoder().encode(data);
            encoding = "UTF-8";

            /*
             * ASCII has the same byte representation in UTF-8
             * and the default Aztec character encoding.
             *
             * Non-ASCII text needs an explicit UTF-8 ECI marker.
             */
            if (bytes.some(byte => byte > 0x7F)) {
                eci = 26;
            }
        } else if (data instanceof Uint8Array) {
            if (data.length === 0) {
                throw new Error(
                    "Cannot encode an empty byte array."
                );
            }

            // Copy so changes to the caller's array cannot affect us.
            bytes = new Uint8Array(data);
            encoding = "binary";
        } else {
            throw new TypeError(
                "AztecEncoder.encode expects a string or Uint8Array."
            );
        }

        const bits = [];

        /*
         * Aztec begins in UPPER mode.
         * The ECI sequence temporarily shifts to PUNCT and
         * returns to UPPER before the binary data starts.
         */
        if (eci !== null) {
            AztecEncoder.appendECI(bits, eci);
        }

        /*
         * An extended binary block can contain at most 2078 bytes:
         * 31 + the maximum unsigned 11-bit value.
         *
         * This is a block limit, not a symbol capacity check.
         * The layer manager must reject data that cannot fit.
         */
        let offset = 0;

        while (offset < bytes.length) {
            const count = Math.min(
                2078,
                bytes.length - offset
            );

            AztecEncoder.appendBinaryBlock(
                bits,
                bytes,
                offset,
                count
            );

            offset += count;
        }

        return {
            bits,
            bitLength: bits.length,
            bytes,
            byteLength: bytes.length,
            encoding,
            eci
        };
    }

    /**
     * Append an ECI marker while the current mode is UPPER.
     *
     * Sequence:
     *   CTRL_PS : 5 bits, temporary shift to PUNCT
     *   FLG(n)  : 5 bits
     *   n       : 3 bits, number of decimal ECI digits
     *   digits  : 4 bits each, digit value + 2
     *
     * @param {number[]} bits
     * @param {number} assignment
     */
    static appendECI(bits, assignment) {
        if (
            !Number.isInteger(assignment) ||
            assignment < 0 ||
            assignment > 999999
        ) {
            throw new RangeError(
                "ECI assignment must be an integer from 0 to 999999."
            );
        }

        const digits = String(assignment);

        AztecEncoder.appendBits(bits, 0, 5); // UPPER: CTRL_PS
        AztecEncoder.appendBits(bits, 0, 5); // PUNCT: FLG(n)
        AztecEncoder.appendBits(bits, digits.length, 3);

        for (const digit of digits) {
            AztecEncoder.appendBits(
                bits,
                Number(digit) + 2,
                4
            );
        }
    }

    /**
     * Append binary data while the current mode is UPPER.
     *
     * Binary shift returns to UPPER after its byte count expires.
     *
     * 1–31 bytes:
     *   CTRL_BS + 5-bit count + bytes
     *
     * 32–62 bytes:
     *   Two short blocks, saving one bit versus an extended block.
     *
     * 63–2078 bytes:
     *   CTRL_BS + zero count + 11-bit (count - 31) + bytes
     *
     * @param {number[]} bits
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {number} count
     */
    static appendBinaryBlock(bits, bytes, offset, count) {
        if (
            !(bytes instanceof Uint8Array) ||
            !Number.isInteger(offset) ||
            !Number.isInteger(count) ||
            offset < 0 ||
            count < 1 ||
            count > 2078 ||
            offset + count > bytes.length
        ) {
            throw new RangeError(
                "Invalid Aztec binary block."
            );
        }

        if (count <= 31) {
            AztecEncoder.appendBits(bits, 31, 5); // CTRL_BS
            AztecEncoder.appendBits(bits, count, 5);

            AztecEncoder.appendBytes(
                bits,
                bytes,
                offset,
                count
            );

            return;
        }

        if (count <= 62) {
            AztecEncoder.appendBinaryBlock(
                bits,
                bytes,
                offset,
                31
            );

            AztecEncoder.appendBinaryBlock(
                bits,
                bytes,
                offset + 31,
                count - 31
            );

            return;
        }

        AztecEncoder.appendBits(bits, 31, 5); // CTRL_BS
        AztecEncoder.appendBits(bits, 0, 5);  // Extended length
        AztecEncoder.appendBits(bits, count - 31, 11);

        AztecEncoder.appendBytes(
            bits,
            bytes,
            offset,
            count
        );
    }

    /**
     * Append bytes most-significant bit first.
     *
     * @param {number[]} bits
     * @param {Uint8Array} bytes
     * @param {number} offset
     * @param {number} count
     */
    static appendBytes(bits, bytes, offset, count) {
        const end = offset + count;

        for (let index = offset; index < end; index++) {
            AztecEncoder.appendBits(
                bits,
                bytes[index],
                8
            );
        }
    }

    /**
     * Append an unsigned integer most-significant bit first.
     *
     * @param {number[]} bits
     * @param {number} value
     * @param {number} width
     */
    static appendBits(bits, value, width) {
        if (!Array.isArray(bits)) {
            throw new TypeError(
                "The bit stream must be an array."
            );
        }

        if (
            !Number.isInteger(width) ||
            width < 1 ||
            width > 31
        ) {
            throw new RangeError(
                "Bit width must be an integer from 1 to 31."
            );
        }

        if (
            !Number.isInteger(value) ||
            value < 0 ||
            value >= 2 ** width
        ) {
            throw new RangeError(
                `Value ${value} does not fit in ${width} bits.`
            );
        }

        for (let shift = width - 1; shift >= 0; shift--) {
            bits.push((value >>> shift) & 1);
        }
    }

    /**
     * Reject unpaired UTF-16 surrogates instead of silently
     * replacing them during UTF-8 conversion.
     *
     * @param {string} text
     */
    static validateUnicode(text) {
        for (let index = 0; index < text.length; index++) {
            const code = text.charCodeAt(index);

            if (code >= 0xD800 && code <= 0xDBFF) {
                const next = text.charCodeAt(index + 1);

                if (!(next >= 0xDC00 && next <= 0xDFFF)) {
                    throw new Error(
                        "Text contains an unpaired Unicode surrogate."
                    );
                }

                index++;
            } else if (code >= 0xDC00 && code <= 0xDFFF) {
                throw new Error(
                    "Text contains an unpaired Unicode surrogate."
                );
            }
        }
    }
}