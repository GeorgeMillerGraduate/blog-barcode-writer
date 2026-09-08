/**
 * ============================================================
 * QR DATA ENCODER
 * ============================================================
 *
 * Converts input data into the data bit stream used by a
 * standard QR Code.
 *
 * Responsibilities:
 *
 *  - Detect the most appropriate encoding mode
 *  - Encode Numeric mode
 *  - Encode Alphanumeric mode
 *  - Encode Byte mode
 *  - Write the QR mode indicator
 *  - Write the character-count indicator
 *  - Add terminator bits
 *  - Align data to an 8-bit boundary
 *  - Add alternating QR padding bytes
 *
 * This class does NOT:
 *
 *  - Generate Reed-Solomon error correction
 *  - Interleave QR blocks
 *  - Place modules into the QR matrix
 *  - Apply masks
 *  - Render the QR code
 *
 * Those responsibilities belong to the other QR classes.
 * ============================================================
 */

class QRDataEncoder {


    /* ========================================================
       QR ENCODING MODES
       ======================================================== */

    static MODE_NUMERIC = "numeric";

    static MODE_ALPHANUMERIC = "alphanumeric";

    static MODE_BYTE = "byte";


    /* ========================================================
       QR MODE INDICATORS
       ======================================================== */

    static MODE_INDICATORS = {

        numeric: 0b0001,

        alphanumeric: 0b0010,

        byte: 0b0100

    };


    /* ========================================================
       ALPHANUMERIC CHARACTER SET
       ======================================================== */

    static ALPHANUMERIC_CHARACTERS =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";


    /* ========================================================
       QR PAD BYTES
       ======================================================== */

    static PAD_BYTE_ONE = 0xEC;

    static PAD_BYTE_TWO = 0x11;


    /* ========================================================
       MAIN ENCODE METHOD
       ======================================================== */

    /**
     * Encodes data into a QR data bit stream.
     *
     * @param {string} data
     *        Data to encode.
     *
     * @param {number} version
     *        QR version from 1 to 40.
     *
     * @param {number|null} capacityBits
     *        Maximum number of data bits available.
     *
     *        If supplied, terminator and padding bits are added
     *        until the bit stream reaches this capacity.
     *
     * @param {string|null} forcedMode
     *        Optional encoding mode.
     *
     * @returns {object}
     *          Encoded QR data information.
     */
    static encode(
        data,
        version = 1,
        capacityBits = null,
        forcedMode = null
    ) {

        QRDataEncoder.validateInput(
            data,
            version,
            capacityBits
        );


        const mode =
            forcedMode === null
                ? QRDataEncoder.detectMode(data)
                : forcedMode;


        QRDataEncoder.validateMode(
            mode
        );


        QRDataEncoder.validateDataForMode(
            data,
            mode
        );


        const bits = [];


        /*
         * ----------------------------------------------------
         * Mode indicator
         * ----------------------------------------------------
         */

        QRDataEncoder.appendBits(
            bits,
            QRDataEncoder.MODE_INDICATORS[mode],
            4
        );


        /*
         * ----------------------------------------------------
         * Encode actual data first.
         *
         * This also gives us the UTF-8 byte count when Byte
         * mode is being used.
         * ----------------------------------------------------
         */

        const encodedData =
            QRDataEncoder.encodePayload(
                data,
                mode
            );


        /*
         * ----------------------------------------------------
         * Character count
         * ----------------------------------------------------
         *
         * Numeric and alphanumeric modes count characters.
         *
         * Byte mode counts encoded bytes.
         */

        const characterCount =
            mode === QRDataEncoder.MODE_BYTE
                ? encodedData.byteLength
                : data.length;


        const characterCountBits =
            QRDataEncoder.getCharacterCountBitLength(
                mode,
                version
            );


        const maximumCharacterCount =
            Math.pow(
                2,
                characterCountBits
            ) - 1;


        if (
            characterCount >
            maximumCharacterCount
        ) {

            throw new Error(
                "The data length cannot be represented by the " +
                "character-count field for QR version " +
                version +
                "."
            );

        }


        QRDataEncoder.appendBits(
            bits,
            characterCount,
            characterCountBits
        );


        /*
         * ----------------------------------------------------
         * Payload
         * ----------------------------------------------------
         */

        QRDataEncoder.appendBitArray(
            bits,
            encodedData.bits
        );


        const rawBitLength =
            bits.length;


        /*
         * ----------------------------------------------------
         * Complete the QR data stream if a capacity was given.
         * ----------------------------------------------------
         */

        if (capacityBits !== null) {

            QRDataEncoder.finaliseBitStream(
                bits,
                capacityBits
            );

        }


        return {

            mode: mode,

            version: version,

            characterCount:
                characterCount,

            byteLength:
                encodedData.byteLength,

            rawBitLength:
                rawBitLength,

            bitLength:
                bits.length,

            bits:
                bits,

            bytes:
                QRDataEncoder.bitsToBytes(
                    bits
                )

        };

    }


    /* ========================================================
       MODE DETECTION
       ======================================================== */

    /**
     * Finds the most efficient supported QR encoding mode.
     *
     * @param {string} data
     * @returns {string}
     */
    static detectMode(data) {

        if (
            QRDataEncoder.isNumeric(data)
        ) {

            return QRDataEncoder.MODE_NUMERIC;

        }


        if (
            QRDataEncoder.isAlphanumeric(data)
        ) {

            return QRDataEncoder.MODE_ALPHANUMERIC;

        }


        return QRDataEncoder.MODE_BYTE;

    }


    /* ========================================================
       NUMERIC TEST
       ======================================================== */

    static isNumeric(data) {

        return /^[0-9]+$/.test(
            data
        );

    }


    /* ========================================================
       ALPHANUMERIC TEST
       ======================================================== */

    static isAlphanumeric(data) {

        if (data.length === 0) {

            return false;

        }


        for (
            let i = 0;
            i < data.length;
            i++
        ) {

            if (
                QRDataEncoder
                    .ALPHANUMERIC_CHARACTERS
                    .indexOf(data[i]) === -1
            ) {

                return false;

            }

        }


        return true;

    }


    /* ========================================================
       PAYLOAD ENCODING
       ======================================================== */

    static encodePayload(
        data,
        mode
    ) {

        switch (mode) {

            case QRDataEncoder.MODE_NUMERIC:

                return {
                    bits:
                        QRDataEncoder
                            .encodeNumeric(data),

                    byteLength:
                        QRDataEncoder
                            .utf8Encode(data)
                            .length
                };


            case QRDataEncoder.MODE_ALPHANUMERIC:

                return {
                    bits:
                        QRDataEncoder
                            .encodeAlphanumeric(data),

                    byteLength:
                        QRDataEncoder
                            .utf8Encode(data)
                            .length
                };


            case QRDataEncoder.MODE_BYTE:

                return QRDataEncoder
                    .encodeByte(data);


            default:

                throw new Error(
                    "Unsupported QR encoding mode: " +
                    mode
                );

        }

    }


    /* ========================================================
       NUMERIC ENCODING
       ======================================================== */

    /**
     * QR Numeric mode:
     *
     * 3 digits -> 10 bits
     * 2 digits -> 7 bits
     * 1 digit  -> 4 bits
     */
    static encodeNumeric(data) {

        const bits = [];


        for (
            let i = 0;
            i < data.length;
            i += 3
        ) {

            const group =
                data.substring(
                    i,
                    i + 3
                );


            const value =
                parseInt(
                    group,
                    10
                );


            let bitLength;


            if (group.length === 3) {

                bitLength = 10;

            }
            else if (
                group.length === 2
            ) {

                bitLength = 7;

            }
            else {

                bitLength = 4;

            }


            QRDataEncoder.appendBits(
                bits,
                value,
                bitLength
            );

        }


        return bits;

    }


    /* ========================================================
       ALPHANUMERIC ENCODING
       ======================================================== */

    /**
     * QR Alphanumeric mode:
     *
     * Two characters:
     *
     *     firstValue * 45 + secondValue
     *
     * encoded using 11 bits.
     *
     * A remaining single character uses 6 bits.
     */
    static encodeAlphanumeric(data) {

        const bits = [];


        let index = 0;


        while (
            index + 1 <
            data.length
        ) {

            const firstValue =
                QRDataEncoder
                    .ALPHANUMERIC_CHARACTERS
                    .indexOf(
                        data[index]
                    );


            const secondValue =
                QRDataEncoder
                    .ALPHANUMERIC_CHARACTERS
                    .indexOf(
                        data[index + 1]
                    );


            const value =
                firstValue * 45 +
                secondValue;


            QRDataEncoder.appendBits(
                bits,
                value,
                11
            );


            index += 2;

        }


        /*
         * One character left over.
         */

        if (
            index <
            data.length
        ) {

            const value =
                QRDataEncoder
                    .ALPHANUMERIC_CHARACTERS
                    .indexOf(
                        data[index]
                    );


            QRDataEncoder.appendBits(
                bits,
                value,
                6
            );

        }


        return bits;

    }


    /* ========================================================
       BYTE ENCODING
       ======================================================== */

    /**
     * Encodes text as UTF-8 bytes.
     */
    static encodeByte(data) {

        const bytes =
            QRDataEncoder
                .utf8Encode(data);


        const bits = [];


        for (
            let i = 0;
            i < bytes.length;
            i++
        ) {

            QRDataEncoder.appendBits(
                bits,
                bytes[i],
                8
            );

        }


        return {

            bits:
                bits,

            byteLength:
                bytes.length

        };

    }


    /* ========================================================
       UTF-8 ENCODING
       ======================================================== */

    static utf8Encode(data) {

        /*
         * TextEncoder is supported by modern browsers and
         * returns the UTF-8 representation of the string.
         */

        if (
            typeof TextEncoder !==
            "undefined"
        ) {

            return Array.from(
                new TextEncoder()
                    .encode(data)
            );

        }


        /*
         * Browser fallback.
         */

        const encoded =
            unescape(
                encodeURIComponent(
                    data
                )
            );


        const bytes = [];


        for (
            let i = 0;
            i < encoded.length;
            i++
        ) {

            bytes.push(
                encoded.charCodeAt(i)
            );

        }


        return bytes;

    }


    /* ========================================================
       CHARACTER COUNT FIELD LENGTH
       ======================================================== */

    /**
     * Returns the number of bits used for the QR character
     * count indicator.
     *
     * Versions:
     *
     *      1 - 9
     *     10 - 26
     *     27 - 40
     */
    static getCharacterCountBitLength(
        mode,
        version
    ) {

        if (
            version >= 1 &&
            version <= 9
        ) {

            switch (mode) {

                case QRDataEncoder.MODE_NUMERIC:
                    return 10;

                case QRDataEncoder.MODE_ALPHANUMERIC:
                    return 9;

                case QRDataEncoder.MODE_BYTE:
                    return 8;

            }

        }


        if (
            version >= 10 &&
            version <= 26
        ) {

            switch (mode) {

                case QRDataEncoder.MODE_NUMERIC:
                    return 12;

                case QRDataEncoder.MODE_ALPHANUMERIC:
                    return 11;

                case QRDataEncoder.MODE_BYTE:
                    return 16;

            }

        }


        if (
            version >= 27 &&
            version <= 40
        ) {

            switch (mode) {

                case QRDataEncoder.MODE_NUMERIC:
                    return 14;

                case QRDataEncoder.MODE_ALPHANUMERIC:
                    return 13;

                case QRDataEncoder.MODE_BYTE:
                    return 16;

            }

        }


        throw new Error(
            "Invalid QR version: " +
            version
        );

    }


    /* ========================================================
       FINALISE DATA STREAM
       ======================================================== */

    static finaliseBitStream(
        bits,
        capacityBits
    ) {

        if (
            bits.length >
            capacityBits
        ) {

            throw new Error(
                "The encoded data requires " +
                bits.length +
                " bits, but the selected QR symbol only has " +
                capacityBits +
                " data bits available."
            );

        }


        /*
         * ----------------------------------------------------
         * Terminator
         * ----------------------------------------------------
         *
         * Add up to four zero bits, without exceeding the
         * available capacity.
         */

        const remaining =
            capacityBits -
            bits.length;


        const terminatorLength =
            Math.min(
                4,
                remaining
            );


        for (
            let i = 0;
            i < terminatorLength;
            i++
        ) {

            bits.push(0);

        }


        /*
         * ----------------------------------------------------
         * Byte alignment
         * ----------------------------------------------------
         */

        while (
            bits.length % 8 !== 0 &&
            bits.length < capacityBits
        ) {

            bits.push(0);

        }


        /*
         * ----------------------------------------------------
         * Padding bytes
         * ----------------------------------------------------
         *
         * QR alternates:
         *
         *     11101100 = EC
         *     00010001 = 11
         */

        let useFirstPadByte =
            true;


        while (
            bits.length + 8 <=
            capacityBits
        ) {

            const padByte =
                useFirstPadByte
                    ? QRDataEncoder.PAD_BYTE_ONE
                    : QRDataEncoder.PAD_BYTE_TWO;


            QRDataEncoder.appendBits(
                bits,
                padByte,
                8
            );


            useFirstPadByte =
                !useFirstPadByte;

        }


        /*
         * A valid QR data capacity should be byte aligned.
         *
         * This final loop keeps the method robust if it is
         * passed a custom bit capacity during testing.
         */

        while (
            bits.length <
            capacityBits
        ) {

            bits.push(0);

        }

    }


    /* ========================================================
       APPEND INTEGER AS BITS
       ======================================================== */

    static appendBits(
        target,
        value,
        length
    ) {

        if (
            !Number.isInteger(value) ||
            value < 0
        ) {

            throw new Error(
                "Bit value must be a non-negative integer."
            );

        }


        if (
            !Number.isInteger(length) ||
            length < 0
        ) {

            throw new Error(
                "Bit length must be a non-negative integer."
            );

        }


        /*
         * Avoid JavaScript's 32-bit bitwise operators here.
         *
         * Arithmetic extraction works safely for the relatively
         * small integer values used by QR encoding.
         */

        for (
            let bit = length - 1;
            bit >= 0;
            bit--
        ) {

            const divisor =
                Math.pow(
                    2,
                    bit
                );


            const bitValue =
                Math.floor(
                    value /
                    divisor
                ) % 2;


            target.push(
                bitValue
            );

        }

    }


    /* ========================================================
       APPEND BIT ARRAY
       ======================================================== */

    static appendBitArray(
        target,
        source
    ) {

        for (
            let i = 0;
            i < source.length;
            i++
        ) {

            target.push(
                source[i]
            );

        }

    }


    /* ========================================================
       BITS TO BYTES
       ======================================================== */

    static bitsToBytes(bits) {

        const bytes = [];


        for (
            let i = 0;
            i < bits.length;
            i += 8
        ) {

            let value = 0;


            const remaining =
                Math.min(
                    8,
                    bits.length - i
                );


            for (
                let j = 0;
                j < remaining;
                j++
            ) {

                value =
                    value * 2 +
                    bits[i + j];

            }


            /*
             * If the final byte is incomplete, shift its bits
             * into the most significant positions.
             */

            if (
                remaining < 8
            ) {

                value *=
                    Math.pow(
                        2,
                        8 - remaining
                    );

            }


            bytes.push(
                value
            );

        }


        return bytes;

    }


    /* ========================================================
       VALIDATION
       ======================================================== */

    static validateInput(
        data,
        version,
        capacityBits
    ) {

        if (
            typeof data !==
            "string"
        ) {

            throw new TypeError(
                "QR data must be a string."
            );

        }


        if (
            data.length === 0
        ) {

            throw new Error(
                "QR data cannot be empty."
            );

        }


        if (
            !Number.isInteger(version) ||
            version < 1 ||
            version > 40
        ) {

            throw new RangeError(
                "QR version must be an integer from 1 to 40."
            );

        }


        if (
            capacityBits !== null &&
            (
                !Number.isInteger(
                    capacityBits
                ) ||
                capacityBits < 0
            )
        ) {

            throw new RangeError(
                "QR data capacity must be a non-negative integer."
            );

        }

    }


    static validateMode(mode) {

        const validModes = [

            QRDataEncoder.MODE_NUMERIC,

            QRDataEncoder.MODE_ALPHANUMERIC,

            QRDataEncoder.MODE_BYTE

        ];


        if (
            !validModes.includes(mode)
        ) {

            throw new Error(
                "Unsupported QR encoding mode: " +
                mode
            );

        }

    }


    static validateDataForMode(
        data,
        mode
    ) {

        if (
            mode ===
                QRDataEncoder.MODE_NUMERIC &&
            !QRDataEncoder.isNumeric(data)
        ) {

            throw new Error(
                "Numeric QR mode can only encode digits 0-9."
            );

        }


        if (
            mode ===
                QRDataEncoder.MODE_ALPHANUMERIC &&
            !QRDataEncoder.isAlphanumeric(data)
        ) {

            throw new Error(
                "The supplied data contains characters that " +
                "cannot be represented in QR Alphanumeric mode."
            );

        }

    }

}