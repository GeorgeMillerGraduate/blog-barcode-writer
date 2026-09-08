/**
 * ============================================================
 * MicroQRDataEncoder.js
 * ============================================================
 *
 * Encodes input data into the data bit stream used by a
 * Micro QR Code.
 *
 * Responsibilities:
 *  - Detect the most suitable encoding mode
 *  - Encode numeric data
 *  - Encode alphanumeric data
 *  - Encode byte data
 *  - Build mode / character-count information
 *  - Pad the data stream to the required capacity
 *
 * Error correction, masking and matrix placement are handled
 * by the other Micro QR classes.
 * ============================================================
 */

class MicroQRDataEncoder {

    /* ========================================================
       ENCODING MODES
       ======================================================== */

    static MODE_NUMERIC = "numeric";
    static MODE_ALPHANUMERIC = "alphanumeric";
    static MODE_BYTE = "byte";


    /* ========================================================
       ALPHANUMERIC CHARACTER SET
       ======================================================== */

    static ALPHANUMERIC_CHARACTERS =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";


    /* ========================================================
       VERSION DEFINITIONS

       Micro QR versions:

       M1 = 11 × 11
       M2 = 13 × 13
       M3 = 15 × 15
       M4 = 17 × 17

       The number of character-count bits varies according
       to both version and encoding mode.
       ======================================================== */

    static CHARACTER_COUNT_BITS = {

        M1: {
            numeric: 3
        },

        M2: {
            numeric: 4,
            alphanumeric: 3
        },

        M3: {
            numeric: 5,
            alphanumeric: 4,
            byte: 4
        },

        M4: {
            numeric: 6,
            alphanumeric: 5,
            byte: 5
        }

    };


    /* ========================================================
       MODE INDICATORS

       Micro QR uses version-dependent mode indicators.

       M1 has no explicit mode indicator because it supports
       numeric data only.
       ======================================================== */

    static MODE_INDICATORS = {

        M1: {
            numeric: ""
        },

        M2: {
            numeric: "0",
            alphanumeric: "1"
        },

        M3: {
            numeric: "00",
            alphanumeric: "01",
            byte: "10"
        },

        M4: {
            numeric: "000",
            alphanumeric: "001",
            byte: "010"
        }

    };


    /* ========================================================
       PUBLIC ENCODE METHOD
       ======================================================== */

    static encode(data, version, capacityBits = null) {

        if (data === null || data === undefined) {
            throw new TypeError(
                "MicroQRDataEncoder.encode() requires data."
            );
        }

        const text = String(data);

        if (text.length === 0) {
            throw new Error(
                "Micro QR data cannot be empty."
            );
        }

        const normalisedVersion =
            MicroQRDataEncoder.normaliseVersion(version);

        const mode =
            MicroQRDataEncoder.detectMode(text);

        MicroQRDataEncoder.validateModeForVersion(
            mode,
            normalisedVersion
        );

        let bits = "";

        bits +=
            MicroQRDataEncoder.getModeIndicator(
                mode,
                normalisedVersion
            );

        bits +=
            MicroQRDataEncoder.encodeCharacterCount(
                text,
                mode,
                normalisedVersion
            );

        bits +=
            MicroQRDataEncoder.encodePayload(
                text,
                mode
            );


        /*
         * If no capacity was supplied, return the raw encoded
         * data stream. The generator may then decide how much
         * padding is required.
         */

        if (capacityBits === null ||
            capacityBits === undefined) {

            return {
                version: normalisedVersion,
                mode: mode,
                characterCount: text.length,
                bits: bits,
                bitLength: bits.length
            };
        }


        const finalBits =
            MicroQRDataEncoder.padToCapacity(
                bits,
                capacityBits,
                normalisedVersion
            );

        return {
            version: normalisedVersion,
            mode: mode,
            characterCount: text.length,
            bits: finalBits,
            bitLength: finalBits.length
        };
    }


    /* ========================================================
       DETECT ENCODING MODE
       ======================================================== */

    static detectMode(data) {

        if (/^[0-9]+$/.test(data)) {
            return MicroQRDataEncoder.MODE_NUMERIC;
        }

        let alphanumeric = true;

        for (const character of data) {

            if (
                MicroQRDataEncoder.ALPHANUMERIC_CHARACTERS
                    .indexOf(character) === -1
            ) {
                alphanumeric = false;
                break;
            }
        }

        if (alphanumeric) {
            return MicroQRDataEncoder.MODE_ALPHANUMERIC;
        }

        return MicroQRDataEncoder.MODE_BYTE;
    }


    /* ========================================================
       PAYLOAD DISPATCHER
       ======================================================== */

    static encodePayload(data, mode) {

        switch (mode) {

            case MicroQRDataEncoder.MODE_NUMERIC:
                return MicroQRDataEncoder.encodeNumeric(data);

            case MicroQRDataEncoder.MODE_ALPHANUMERIC:
                return MicroQRDataEncoder.encodeAlphanumeric(data);

            case MicroQRDataEncoder.MODE_BYTE:
                return MicroQRDataEncoder.encodeBytes(data);

            default:
                throw new Error(
                    "Unsupported Micro QR encoding mode: " + mode
                );
        }
    }


    /* ========================================================
       NUMERIC ENCODING
       ======================================================== */

    static encodeNumeric(data) {

        if (!/^[0-9]+$/.test(data)) {
            throw new Error(
                "Numeric encoding received non-numeric data."
            );
        }

        let bits = "";

        for (let index = 0; index < data.length; index += 3) {

            const group =
                data.substring(
                    index,
                    index + 3
                );

            const value =
                parseInt(group, 10);

            switch (group.length) {

                case 3:
                    bits +=
                        MicroQRDataEncoder.toBinary(
                            value,
                            10
                        );
                    break;

                case 2:
                    bits +=
                        MicroQRDataEncoder.toBinary(
                            value,
                            7
                        );
                    break;

                case 1:
                    bits +=
                        MicroQRDataEncoder.toBinary(
                            value,
                            4
                        );
                    break;

                default:
                    break;
            }
        }

        return bits;
    }


    /* ========================================================
       ALPHANUMERIC ENCODING
       ======================================================== */

    static encodeAlphanumeric(data) {

        let bits = "";

        let index = 0;

        while (index + 1 < data.length) {

            const first =
                MicroQRDataEncoder.getAlphanumericValue(
                    data[index]
                );

            const second =
                MicroQRDataEncoder.getAlphanumericValue(
                    data[index + 1]
                );

            const value =
                first * 45 + second;

            bits +=
                MicroQRDataEncoder.toBinary(
                    value,
                    11
                );

            index += 2;
        }


        /*
         * A remaining single character is represented
         * using six bits.
         */

        if (index < data.length) {

            const value =
                MicroQRDataEncoder.getAlphanumericValue(
                    data[index]
                );

            bits +=
                MicroQRDataEncoder.toBinary(
                    value,
                    6
                );
        }

        return bits;
    }


    /* ========================================================
       BYTE ENCODING
       ======================================================== */

    static encodeBytes(data) {

        const bytes =
            MicroQRDataEncoder.utf8Encode(data);

        let bits = "";

        for (const byte of bytes) {

            bits +=
                MicroQRDataEncoder.toBinary(
                    byte,
                    8
                );
        }

        return bits;
    }


    /* ========================================================
       UTF-8 ENCODING
       ======================================================== */

    static utf8Encode(data) {

        if (typeof TextEncoder !== "undefined") {

            return Array.from(
                new TextEncoder().encode(data)
            );
        }


        /*
         * Browser fallback for environments without
         * TextEncoder.
         */

        const bytes = [];

        for (const character of data) {

            const codePoint =
                character.codePointAt(0);

            if (codePoint <= 0x7F) {

                bytes.push(codePoint);

            } else if (codePoint <= 0x7FF) {

                bytes.push(
                    0xC0 | (codePoint >> 6),
                    0x80 | (codePoint & 0x3F)
                );

            } else if (codePoint <= 0xFFFF) {

                bytes.push(
                    0xE0 | (codePoint >> 12),
                    0x80 | ((codePoint >> 6) & 0x3F),
                    0x80 | (codePoint & 0x3F)
                );

            } else {

                bytes.push(
                    0xF0 | (codePoint >> 18),
                    0x80 | ((codePoint >> 12) & 0x3F),
                    0x80 | ((codePoint >> 6) & 0x3F),
                    0x80 | (codePoint & 0x3F)
                );
            }
        }

        return bytes;
    }


    /* ========================================================
       CHARACTER COUNT
       ======================================================== */

    static encodeCharacterCount(
        data,
        mode,
        version
    ) {

        const definition =
            MicroQRDataEncoder.CHARACTER_COUNT_BITS[
                version
            ];

        if (!definition ||
            definition[mode] === undefined) {

            throw new Error(
                mode +
                " mode is not supported by Micro QR " +
                version +
                "."
            );
        }

        const bitCount =
            definition[mode];

        let count;

        if (mode === MicroQRDataEncoder.MODE_BYTE) {

            count =
                MicroQRDataEncoder
                    .utf8Encode(data)
                    .length;

        } else {

            count = data.length;
        }


        const maximum =
            (1 << bitCount) - 1;

        if (count > maximum) {

            throw new Error(
                "The data contains too many characters for " +
                version +
                " " +
                mode +
                " mode."
            );
        }

        return MicroQRDataEncoder.toBinary(
            count,
            bitCount
        );
    }


    /* ========================================================
       MODE INDICATOR
       ======================================================== */

    static getModeIndicator(mode, version) {

        const indicators =
            MicroQRDataEncoder.MODE_INDICATORS[
                version
            ];

        if (!indicators ||
            indicators[mode] === undefined) {

            throw new Error(
                mode +
                " mode is unavailable in Micro QR " +
                version +
                "."
            );
        }

        return indicators[mode];
    }


    /* ========================================================
       MODE / VERSION VALIDATION
       ======================================================== */

    static validateModeForVersion(mode, version) {

        const modes =
            MicroQRDataEncoder.MODE_INDICATORS[
                version
            ];

        if (!modes ||
            modes[mode] === undefined) {

            throw new Error(
                "Micro QR " +
                version +
                " does not support " +
                mode +
                " encoding."
            );
        }
    }


    /* ========================================================
       VERSION NORMALISATION
       ======================================================== */

    static normaliseVersion(version) {

        if (typeof version === "number") {

            version = "M" + version;
        }

        const result =
            String(version || "")
                .trim()
                .toUpperCase();

        if (
            result !== "M1" &&
            result !== "M2" &&
            result !== "M3" &&
            result !== "M4"
        ) {

            throw new Error(
                "Invalid Micro QR version: " +
                version
            );
        }

        return result;
    }


    /* ========================================================
       ALPHANUMERIC LOOKUP
       ======================================================== */

    static getAlphanumericValue(character) {

        const value =
            MicroQRDataEncoder
                .ALPHANUMERIC_CHARACTERS
                .indexOf(character);

        if (value === -1) {

            throw new Error(
                "Character cannot be encoded in " +
                "Micro QR alphanumeric mode: " +
                character
            );
        }

        return value;
    }


    /* ========================================================
       TERMINATOR LENGTH
       ======================================================== */

    static getTerminatorLength(version) {

        switch (version) {

            case "M1":
                return 3;

            case "M2":
                return 5;

            case "M3":
                return 7;

            case "M4":
                return 9;

            default:
                throw new Error(
                    "Unknown Micro QR version."
                );
        }
    }


    /* ========================================================
       PAD TO CAPACITY
       ======================================================== */

    static padToCapacity(
        bits,
        capacityBits,
        version
    ) {

        if (
            !Number.isInteger(capacityBits) ||
            capacityBits < 0
        ) {

            throw new TypeError(
                "Micro QR capacity must be a non-negative integer."
            );
        }


        if (bits.length > capacityBits) {

            throw new Error(
                "Encoded data exceeds the capacity of " +
                version +
                "."
            );
        }


        let result = bits;


        /*
         * Add terminator bits without exceeding capacity.
         */

        const terminatorLength =
            MicroQRDataEncoder.getTerminatorLength(
                version
            );

        const remaining =
            capacityBits - result.length;

        result +=
            "0".repeat(
                Math.min(
                    terminatorLength,
                    remaining
                )
            );


        /*
         * Align to the next byte boundary where possible.
         */

        while (
            result.length < capacityBits &&
            result.length % 8 !== 0
        ) {

            result += "0";
        }


        /*
         * Standard alternating QR padding bytes.
         */

        const padBytes = [
            0xEC,
            0x11
        ];

        let padIndex = 0;

        while (
            result.length + 8 <= capacityBits
        ) {

            result +=
                MicroQRDataEncoder.toBinary(
                    padBytes[padIndex],
                    8
                );

            padIndex =
                (padIndex + 1) %
                padBytes.length;
        }


        /*
         * Some Micro QR capacities do not necessarily finish
         * on an ordinary eight-bit boundary.
         */

        while (result.length < capacityBits) {
            result += "0";
        }


        return result.substring(
            0,
            capacityBits
        );
    }


    /* ========================================================
       BINARY HELPER
       ======================================================== */

    static toBinary(value, length) {

        if (
            !Number.isInteger(value) ||
            value < 0
        ) {

            throw new TypeError(
                "Binary value must be a non-negative integer."
            );
        }

        const binary =
            value.toString(2);

        if (binary.length > length) {

            throw new Error(
                "Value " +
                value +
                " cannot fit inside " +
                length +
                " bits."
            );
        }

        return binary.padStart(
            length,
            "0"
        );
    }


    /* ========================================================
       BIT STRING -> BYTE ARRAY
       ======================================================== */

    static bitsToBytes(bits) {

        if (typeof bits !== "string") {

            throw new TypeError(
                "bitsToBytes() requires a bit string."
            );
        }

        const bytes = [];

        for (
            let index = 0;
            index < bits.length;
            index += 8
        ) {

            const chunk =
                bits.substring(
                    index,
                    index + 8
                )
                .padEnd(8, "0");

            bytes.push(
                parseInt(chunk, 2)
            );
        }

        return bytes;
    }


    /* ========================================================
       BYTE ARRAY -> BIT STRING
       ======================================================== */

    static bytesToBits(bytes) {

        if (!Array.isArray(bytes) &&
            !(bytes instanceof Uint8Array)) {

            throw new TypeError(
                "bytesToBits() requires a byte array."
            );
        }

        let bits = "";

        for (const byte of bytes) {

            if (
                !Number.isInteger(byte) ||
                byte < 0 ||
                byte > 255
            ) {

                throw new Error(
                    "Invalid byte value: " +
                    byte
                );
            }

            bits +=
                MicroQRDataEncoder.toBinary(
                    byte,
                    8
                );
        }

        return bits;
    }
}