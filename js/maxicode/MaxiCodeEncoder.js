/**
 * MaxiCodeEncoder.js
 *
 * Encodes MaxiCode data into six-bit codewords (0–63).
 *
 * Supports:
 * - Modes 2 and 3: structured carrier messages.
 * - Mode 4: general-purpose data.
 * - Mode 5: general-purpose data with enhanced secondary ECC.
 * - All Latin-1 characters.
 * - Character sets A–E.
 * - A/B latches and temporary character-set shifts.
 * - Nine-digit numeric compression.
 *
 * Not included:
 * - Unicode ECI encoding.
 * - Structured append.
 * - Mode 6 reader programming.
 *
 * Error correction and module placement belong to the
 * MaxiCodeErrorCorrection and MaxiCodeMatrix classes.
 *
 * Usage:
 *
 *   const result = MaxiCodeEncoder.encode("Hello 123456789");
 *
 *   const shipment = MaxiCodeEncoder.encode("Package details", {
 *       mode: 2,
 *       postcode: "123456789",
 *       countryCode: 840,
 *       serviceClass: 1
 *   });
 *
 * Return value:
 * {
 *     mode,
 *     primaryData,       // Exactly 10 codewords.
 *     secondaryData,     // 84 codewords, or 68 for mode 5.
 *     dataCodewords,     // Primary followed by secondary; no ECC.
 *     messageCodewords,  // Unpadded encoded message.
 *     messageCapacity,
 *     primaryErrorCount,
 *     secondaryErrorCount
 * }
 *
 * IMPORTANT:
 * dataCodewords is not the final physical codeword sequence.
 * Error correction must insert primary ECC between primaryData
 * and secondaryData, then append interleaved secondary ECC.
 */
class MaxiCodeEncoder {

    static #maps = MaxiCodeEncoder.#createCharacterMaps();

    /**
     * Encode text and construct primary/secondary data sections.
     *
     * @param {string} text
     * @param {Object} [options={}]
     * @param {2|3|4|5} [options.mode=4]
     * @param {string} [options.postcode]
     * @param {number} [options.countryCode]
     * @param {number} [options.serviceClass]
     * @returns {Object}
     */
    static encode(text, options = {}) {
        if (
            options === null ||
            typeof options !== "object" ||
            Array.isArray(options)
        ) {
            throw new TypeError(
                "MaxiCodeEncoder: options must be an object."
            );
        }

        const mode = options.mode ?? 4;

        if (![2, 3, 4, 5].includes(mode)) {
            throw new RangeError(
                "MaxiCodeEncoder: supported modes are 2, 3, 4 and 5."
            );
        }

        const messageCapacity =
            mode === 4 ? 93 :
            mode === 5 ? 77 : 84;

        const messageCodewords =
            MaxiCodeEncoder.encodeText(text);

        if (messageCodewords.length > messageCapacity) {
            throw new RangeError(
                `MaxiCodeEncoder: the message requires ` +
                `${messageCodewords.length} codewords, but mode ` +
                `${mode} allows ${messageCapacity}.`
            );
        }

        const paddedMessage = messageCodewords.slice();

        // Encoding always finishes in persistent set A or B.
        // Codeword 33 is PAD in both sets.
        while (paddedMessage.length < messageCapacity) {
            paddedMessage.push(33);
        }

        let primaryData;
        let secondaryData;

        if (mode === 2 || mode === 3) {
            primaryData = MaxiCodeEncoder.#encodePrimary(
                mode,
                options
            );

            secondaryData = paddedMessage;
        } else {
            // Modes 4/5 use the nine remaining primary data
            // positions for the beginning of the text stream.
            primaryData = [
                mode,
                ...paddedMessage.slice(0, 9)
            ];

            secondaryData = paddedMessage.slice(9);
        }

        return {
            mode,
            primaryData,
            secondaryData,
            dataCodewords: [
                ...primaryData,
                ...secondaryData
            ],
            messageCodewords,
            messageCapacity,
            primaryErrorCount: 10,
            secondaryErrorCount: mode === 5 ? 56 : 40
        };
    }

    /**
     * Encode a Latin-1 message without padding or a mode header.
     *
     * Dynamic programming selects the shortest sequence among
     * direct A/B encoding, A/B latches, temporary shifts and
     * nine-digit numeric compression.
     *
     * Sets C/D/E are accessed using single-character shifts.
     * Persistent C/D/E locking is not implemented, so long runs
     * of extended characters may consume additional capacity.
     *
     * @param {string} text
     * @returns {number[]}
     */
    static encodeText(text) {
        if (typeof text !== "string") {
            throw new TypeError(
                "MaxiCodeEncoder: text must be a string."
            );
        }

        // Even numeric compression cannot fit more than
        // 138 input characters in the supported message capacities.
        if (text.length > 138) {
            throw new RangeError(
                "MaxiCodeEncoder: the input exceeds the maximum " +
                "message length for the supported modes."
            );
        }

        for (let index = 0; index < text.length; index++) {
            if (text.charCodeAt(index) > 255) {
                throw new RangeError(
                    "MaxiCodeEncoder: only Latin-1 text is supported; " +
                    `unsupported character at index ${index}.`
                );
            }
        }

        // Each position stores the best path ending in set A or B.
        // Temporary shifts return to that persistent set.
        const paths = Array.from(
            { length: text.length + 1 },
            () => [null, null]
        );

        paths[0][0] = [];

        const offer = (position, set, prefix, suffix) => {
            const candidate = [...prefix, ...suffix];
            const previous = paths[position][set];

            if (
                previous === null ||
                candidate.length < previous.length
            ) {
                paths[position][set] = candidate;
            }
        };

        for (let index = 0; index < text.length; index++) {
            const character = text[index];

            for (let set = 0; set < 2; set++) {
                const path = paths[index][set];

                if (path === null) {
                    continue;
                }

                // Numeric shift: nine digits become a marker
                // followed by five six-bit values.
                const digits = text.slice(index, index + 9);

                if (/^[0-9]{9}$/.test(digits)) {
                    const value = Number(digits);

                    offer(index + 9, set, path, [
                        31,
                        (value >>> 24) & 63,
                        (value >>> 18) & 63,
                        (value >>> 12) & 63,
                        (value >>> 6) & 63,
                        value & 63
                    ]);
                }

                const direct =
                    MaxiCodeEncoder.#maps[set].get(character);

                if (direct !== undefined) {
                    offer(index + 1, set, path, [direct]);
                }

                const otherSet = 1 - set;
                const other =
                    MaxiCodeEncoder.#maps[otherSet].get(character);

                if (other !== undefined) {
                    // 59 shifts A -> B or B -> A for one character.
                    offer(index + 1, set, path, [59, other]);

                    // 63 latches A -> B or B -> A.
                    offer(index + 1, otherSet, path, [63, other]);
                }

                // From set B, temporarily shift to A for two
                // or three characters using a single marker.
                if (set === 1) {
                    for (const count of [2, 3]) {
                        if (index + count > text.length) {
                            continue;
                        }

                        const values = [];
                        let valid = true;

                        for (let offset = 0; offset < count; offset++) {
                            const value = MaxiCodeEncoder.#maps[0].get(
                                text[index + offset]
                            );

                            if (value === undefined) {
                                valid = false;
                                break;
                            }

                            values.push(value);
                        }

                        if (valid) {
                            offer(
                                index + count,
                                set,
                                path,
                                [count === 2 ? 56 : 57, ...values]
                            );
                        }
                    }
                }

                // Codes 60, 61 and 62 temporarily select C, D and E.
                for (let target = 2; target < 5; target++) {
                    const value =
                        MaxiCodeEncoder.#maps[target].get(character);

                    if (value !== undefined) {
                        offer(
                            index + 1,
                            set,
                            path,
                            [58 + target, value]
                        );
                    }
                }
            }
        }

        const [pathA, pathB] = paths[text.length];

        if (pathA === null && pathB === null) {
            throw new Error(
                "MaxiCodeEncoder: no encoding path was found."
            );
        }

        if (
            pathB === null ||
            (pathA !== null && pathA.length <= pathB.length)
        ) {
            return pathA.slice();
        }

        return pathB.slice();
    }

    /**
     * Encode the structured primary message for mode 2 or 3.
     */
    static #encodePrimary(mode, options) {
        const {
            postcode,
            countryCode,
            serviceClass
        } = options;

        if (typeof postcode !== "string") {
            throw new TypeError(
                "MaxiCodeEncoder: postcode must be a string " +
                "so leading zeroes are preserved."
            );
        }

        for (const [name, value] of [
            ["countryCode", countryCode],
            ["serviceClass", serviceClass]
        ]) {
            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value > 999
            ) {
                throw new RangeError(
                    `MaxiCodeEncoder: ${name} must be an integer ` +
                    "from 0 to 999."
                );
            }
        }

        const primary = new Array(10).fill(0);
        primary[0] = mode;

        // Bit positions are one-based across ten six-bit codewords.
        // Each list runs from the field's most significant bit
        // to its least significant bit.
        const writeField = (value, positions) => {
            for (let index = 0; index < positions.length; index++) {
                const bit =
                    (value >>> (positions.length - index - 1)) & 1;

                const position = positions[index] - 1;
                const word = Math.floor(position / 6);
                const offset = 5 - position % 6;

                primary[word] |= bit << offset;
            }
        };

        if (mode === 2) {
            if (!/^[0-9]{1,9}$/.test(postcode)) {
                throw new RangeError(
                    "MaxiCodeEncoder: mode 2 requires " +
                    "a postcode containing 1–9 digits."
                );
            }

            writeField(Number(postcode), [
                33, 34, 35, 36,
                25, 26, 27, 28, 29, 30,
                19, 20, 21, 22, 23, 24,
                13, 14, 15, 16, 17, 18,
                7, 8, 9, 10, 11, 12,
                1, 2
            ]);

            writeField(postcode.length, [
                39, 40, 41, 42, 31, 32
            ]);
        } else {
            if (
                !/^[A-Z0-9 ]{1,6}$/.test(postcode) ||
                postcode.trim().length === 0
            ) {
                throw new RangeError(
                    "MaxiCodeEncoder: mode 3 requires 1–6 " +
                    "uppercase letters, digits or spaces."
                );
            }

            const positions = [
                [39, 40, 41, 42, 31, 32],
                [33, 34, 35, 36, 25, 26],
                [27, 28, 29, 30, 19, 20],
                [21, 22, 23, 24, 13, 14],
                [15, 16, 17, 18, 7, 8],
                [9, 10, 11, 12, 1, 2]
            ];

            const paddedPostcode = postcode.padEnd(6, " ");

            for (let index = 0; index < 6; index++) {
                writeField(
                    MaxiCodeEncoder.#maps[0].get(paddedPostcode[index]),
                    positions[index]
                );
            }
        }

        writeField(countryCode, [
            53, 54, 43, 44, 45, 46, 47, 48, 37, 38
        ]);

        writeField(serviceClass, [
            55, 56, 57, 58, 59, 60, 49, 50, 51, 52
        ]);

        return primary;
    }

    /**
     * Build character-to-codeword mappings.
     *
     * Control code positions are deliberately excluded.
     * Each map contains only literal characters.
     */
    static #createCharacterMaps() {
        const maps = Array.from({ length: 5 }, () => new Map());

        const add = (set, start, characters) => {
            for (let index = 0; index < characters.length; index++) {
                const character = characters[index];

                if (!maps[set].has(character)) {
                    maps[set].set(character, start + index);
                }
            }
        };

        const range = (first, last) => {
            let result = "";

            for (let value = first; value <= last; value++) {
                result += String.fromCharCode(value);
            }

            return result;
        };

        // Set A.
        add(0, 0, "\rABCDEFGHIJKLMNOPQRSTUVWXYZ");
        add(0, 28, "\x1C\x1D\x1E");
        add(0, 32, " ");
        add(0, 34, "\"#$%&'()*+,-./0123456789:");

        // Set B.
        add(1, 0, "`abcdefghijklmnopqrstuvwxyz");
        add(1, 28, "\x1C\x1D\x1E");
        add(1, 32, "{");
        add(1, 34, "}~\x7F;<=>?[\\]^_ ,./:@!|");

        // Set C.
        add(2, 0, range(0xC0, 0xDA));
        add(2, 28, "\x1C\x1D\x1E");
        add(
            2,
            32,
            range(0xDB, 0xDF) +
            "\xAA\xAC\xB1\xB2\xB3\xB5\xB9\xBA\xBC\xBD\xBE" +
            range(0x80, 0x89)
        );
        add(2, 59, " ");

        // Set D.
        add(3, 0, range(0xE0, 0xFA));
        add(3, 28, "\x1C\x1D\x1E");
        add(
            3,
            32,
            range(0xFB, 0xFF) +
            "\xA1\xA8\xAB\xAF\xB0\xB4\xB7\xB8\xBB\xBF" +
            range(0x8A, 0x94)
        );
        add(3, 59, " ");

        // Set E.
        add(4, 0, range(0x00, 0x1A));
        add(4, 30, "\x1B");
        add(
            4,
            32,
            "\x1C\x1D\x1E\x1F\x9F\xA0" +
            "\xA2\xA3\xA4\xA5\xA6\xA7\xA9\xAD\xAE\xB6" +
            range(0x95, 0x9E)
        );
        add(4, 59, " ");

        return maps;
    }
}

if (typeof window !== "undefined") {
    window.MaxiCodeEncoder = MaxiCodeEncoder;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = MaxiCodeEncoder;
}