/**
 * MaxiCodeMode.js
 *
 * Mode definitions and option validation for MaxiCode modes 2–5.
 *
 * Matches the modes supported by MaxiCodeEncoder.
 *
 * Mode 2:
 *   Structured carrier message with a numeric postcode.
 *
 * Mode 3:
 *   Structured carrier message with an alphanumeric postcode.
 *
 * Mode 4:
 *   General-purpose message with standard secondary ECC.
 *
 * Mode 5:
 *   General-purpose message with enhanced secondary ECC.
 *
 * Usage:
 *   const mode = MaxiCodeMode.get(4);
 *
 *   const options = MaxiCodeMode.validate({
 *       mode: 2,
 *       postcode: "123456789",
 *       countryCode: 840,
 *       serviceClass: 1
 *   });
 *
 *   const encoded = MaxiCodeEncoder.encode("Package", options);
 *
 * The previously written generator already validates its options.
 * This class can also supply mode information to the user interface.
 */
class MaxiCodeMode {

    static get NUMERIC_CARRIER() {
        return 2;
    }

    static get ALPHANUMERIC_CARRIER() {
        return 3;
    }

    static get STANDARD() {
        return 4;
    }

    static get ENHANCED() {
        return 5;
    }

    static #definitions = Object.freeze([
        Object.freeze({
            mode: 2,
            name: "Numeric carrier message",
            description:
                "Structured carrier information with a numeric postcode.",
            requiresCarrier: true,
            postcodeType: "numeric",
            postcodeMaxLength: 9,
            messageCapacity: 84,
            primaryDataCount: 10,
            primaryMessageCount: 0,
            primaryErrorCount: 10,
            secondaryDataCount: 84,
            secondaryErrorCount: 40,
            secondaryBlockCount: 2,
            secondaryDataPerBlock: 42,
            secondaryErrorsPerBlock: 20,
            totalDataCount: 94,
            totalErrorCount: 50,
            totalCodewords: 144
        }),

        Object.freeze({
            mode: 3,
            name: "Alphanumeric carrier message",
            description:
                "Structured carrier information with an alphanumeric postcode.",
            requiresCarrier: true,
            postcodeType: "alphanumeric",
            postcodeMaxLength: 6,
            messageCapacity: 84,
            primaryDataCount: 10,
            primaryMessageCount: 0,
            primaryErrorCount: 10,
            secondaryDataCount: 84,
            secondaryErrorCount: 40,
            secondaryBlockCount: 2,
            secondaryDataPerBlock: 42,
            secondaryErrorsPerBlock: 20,
            totalDataCount: 94,
            totalErrorCount: 50,
            totalCodewords: 144
        }),

        Object.freeze({
            mode: 4,
            name: "Standard message",
            description:
                "General-purpose text with standard secondary error correction.",
            requiresCarrier: false,
            postcodeType: null,
            postcodeMaxLength: 0,
            messageCapacity: 93,
            primaryDataCount: 10,
            primaryMessageCount: 9,
            primaryErrorCount: 10,
            secondaryDataCount: 84,
            secondaryErrorCount: 40,
            secondaryBlockCount: 2,
            secondaryDataPerBlock: 42,
            secondaryErrorsPerBlock: 20,
            totalDataCount: 94,
            totalErrorCount: 50,
            totalCodewords: 144
        }),

        Object.freeze({
            mode: 5,
            name: "Enhanced error correction",
            description:
                "General-purpose text with additional secondary error correction.",
            requiresCarrier: false,
            postcodeType: null,
            postcodeMaxLength: 0,
            messageCapacity: 77,
            primaryDataCount: 10,
            primaryMessageCount: 9,
            primaryErrorCount: 10,
            secondaryDataCount: 68,
            secondaryErrorCount: 56,
            secondaryBlockCount: 2,
            secondaryDataPerBlock: 34,
            secondaryErrorsPerBlock: 28,
            totalDataCount: 78,
            totalErrorCount: 66,
            totalCodewords: 144
        })
    ]);

    /**
     * Return an immutable mode definition.
     *
     * Capacities count six-bit codewords, not characters.
     * Character shifts consume capacity; numeric compression
     * can encode multiple characters in fewer codewords.
     *
     * @param {2|3|4|5} [mode=4]
     * @returns {Object}
     */
    static get(mode = 4) {
        const definition = MaxiCodeMode.#definitions.find(
            entry => entry.mode === mode
        );

        if (!definition) {
            throw new RangeError(
                "MaxiCodeMode: supported modes are 2, 3, 4 and 5."
            );
        }

        return definition;
    }

    /**
     * Return a new array containing all supported mode definitions.
     *
     * @returns {Object[]}
     */
    static list() {
        return MaxiCodeMode.#definitions.slice();
    }

    /**
     * Check whether a numeric mode is supported.
     *
     * @param {number} mode
     * @returns {boolean}
     */
    static isSupported(mode) {
        return MaxiCodeMode.#definitions.some(
            entry => entry.mode === mode
        );
    }

    /**
     * Check whether a mode requires structured carrier fields.
     *
     * @param {2|3|4|5} mode
     * @returns {boolean}
     */
    static requiresCarrier(mode) {
        return MaxiCodeMode.get(mode).requiresCarrier;
    }

    /**
     * Validate encoding options and return a new options object.
     *
     * Postcodes remain strings to preserve leading zeroes.
     * Text and numeric values are not silently coerced.
     *
     * Modes 4/5 do not include carrier fields in the result.
     *
     * @param {Object} [options={}]
     * @param {2|3|4|5} [options.mode=4]
     * @param {string} [options.postcode]
     * @param {number} [options.countryCode]
     * @param {number} [options.serviceClass]
     * @returns {Object}
     */
    static validate(options = {}) {
        if (
            options === null ||
            typeof options !== "object" ||
            Array.isArray(options)
        ) {
            throw new TypeError(
                "MaxiCodeMode: options must be an object."
            );
        }

        const mode = options.mode ?? 4;
        const definition = MaxiCodeMode.get(mode);

        if (!definition.requiresCarrier) {
            return { mode };
        }

        const {
            postcode,
            countryCode,
            serviceClass
        } = options;

        if (typeof postcode !== "string") {
            throw new TypeError(
                "MaxiCodeMode: postcode must be a string."
            );
        }

        if (mode === 2) {
            if (!/^[0-9]{1,9}$/.test(postcode)) {
                throw new RangeError(
                    "MaxiCodeMode: mode 2 requires " +
                    "a postcode containing 1–9 digits."
                );
            }
        } else {
            if (
                !/^[A-Z0-9 ]{1,6}$/.test(postcode) ||
                postcode.trim().length === 0
            ) {
                throw new RangeError(
                    "MaxiCodeMode: mode 3 requires 1–6 " +
                    "uppercase letters, digits or spaces."
                );
            }
        }

        MaxiCodeMode.#validateCarrierNumber(
            countryCode,
            "countryCode"
        );

        MaxiCodeMode.#validateCarrierNumber(
            serviceClass,
            "serviceClass"
        );

        return {
            mode,
            postcode,
            countryCode,
            serviceClass
        };
    }

    /**
     * Check whether an encoded message length fits a mode.
     *
     * Pass MaxiCodeEncoder.encodeText(text).length, not text.length.
     *
     * @param {number} codewordCount
     * @param {2|3|4|5} [mode=4]
     * @returns {boolean}
     */
    static fits(codewordCount, mode = 4) {
        if (
            !Number.isSafeInteger(codewordCount) ||
            codewordCount < 0
        ) {
            throw new RangeError(
                "MaxiCodeMode: codewordCount must be " +
                "a non-negative safe integer."
            );
        }

        return codewordCount <= MaxiCodeMode.get(mode).messageCapacity;
    }

    /**
     * Validate the numeric representation of a three-digit field.
     * This checks the range, not whether a code has been assigned.
     */
    static #validateCarrierNumber(value, name) {
        if (
            !Number.isInteger(value) ||
            value < 0 ||
            value > 999
        ) {
            throw new RangeError(
                `MaxiCodeMode: ${name} must be an integer ` +
                "from 0 to 999."
            );
        }
    }
}

if (typeof window !== "undefined") {
    window.MaxiCodeMode = MaxiCodeMode;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = MaxiCodeMode;
}