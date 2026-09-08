/**
 * ============================================================
 * PDF417Compaction.js
 * ============================================================
 *
 * Implements PDF417 data compaction.
 *
 * Supported modes:
 *  - Text compaction
 *  - Byte compaction
 *  - Numeric compaction
 *  - Automatic mode selection
 *
 * Output consists of PDF417 codeword values.
 *
 * Error correction is NOT handled here.
 * Matrix construction is NOT handled here.
 * ============================================================
 */

class PDF417Compaction {

    /* ========================================================
       MODE CONSTANTS
       ======================================================== */

    static TEXT = "text";
    static BYTE = "byte";
    static NUMERIC = "numeric";
    static AUTO = "auto";

    static TEXT_LATCH = 900;
    static BYTE_LATCH = 901;
    static NUMERIC_LATCH = 902;
    static BYTE_SHIFT = 913;
    static BYTE_LATCH_6 = 924;


    /* ========================================================
       TEXT SUBMODES
       ======================================================== */

    static ALPHA = 0;
    static LOWER = 1;
    static MIXED = 2;
    static PUNCT = 3;


    /* ========================================================
       CHARACTER TABLES
       ======================================================== */

    static MIXED_CHARS = [
        "0", "1", "2", "3", "4",
        "5", "6", "7", "8", "9",
        "&", "\r", "\t", ",", ":",
        "#", "-", ".", "$", "/",
        "+", "%", "*", "=", "^"
    ];

    static PUNCT_CHARS = [
        ";", "<", ">", "@", "[",
        "\\", "]", "_", "`", "~",
        "!", "\r", "\t", ",", ":",
        "\n", "-", ".", "$", "/",
        "\"", "|", "*", "(", ")",
        "?", "{", "}", "'"
    ];


    /* ========================================================
       PUBLIC COMPACTION METHOD
       ======================================================== */

    static compact(data, mode = "auto") {

        if (
            data === null ||
            data === undefined
        ) {
            throw new TypeError(
                "PDF417Compaction.compact() requires data."
            );
        }

        const text = String(data);

        if (text.length === 0) {
            return [];
        }

        const selected =
            String(mode || "auto")
                .trim()
                .toLowerCase();

        switch (selected) {

            case PDF417Compaction.TEXT:
                return PDF417Compaction.compactText(
                    text,
                    true
                );

            case PDF417Compaction.BYTE:
                return PDF417Compaction.compactBytes(
                    PDF417Compaction.toUTF8(text),
                    true
                );

            case PDF417Compaction.NUMERIC:
                return PDF417Compaction.compactNumeric(
                    text,
                    true
                );

            case PDF417Compaction.AUTO:
                return PDF417Compaction.compactAuto(
                    text
                );

            default:
                throw new Error(
                    "Unknown PDF417 compaction mode: " +
                    mode
                );
        }
    }


    /* ========================================================
       AUTOMATIC COMPACTION
       ======================================================== */

    static compactAuto(text) {

        const codewords = [];

        let index = 0;
        let currentMode = null;

        while (index < text.length) {

            /*
             * PDF417 commonly uses numeric compaction for runs
             * of 13 or more consecutive digits.
             */

            const numericCount =
                PDF417Compaction.countNumeric(
                    text,
                    index
                );

            if (numericCount >= 13) {

                if (
                    currentMode !==
                    PDF417Compaction.NUMERIC
                ) {
                    codewords.push(
                        PDF417Compaction.NUMERIC_LATCH
                    );

                    currentMode =
                        PDF417Compaction.NUMERIC;
                }

                const segment =
                    text.substring(
                        index,
                        index + numericCount
                    );

                codewords.push(
                    ...PDF417Compaction.compactNumeric(
                        segment,
                        false
                    )
                );

                index += numericCount;

                continue;
            }


            /*
             * Prefer text compaction for a useful run of
             * characters supported by the text tables.
             */

            const textCount =
                PDF417Compaction.countText(
                    text,
                    index
                );

            if (
                textCount >= 5 ||
                numericCount === text.length - index
            ) {

                if (
                    currentMode !==
                    PDF417Compaction.TEXT
                ) {
                    codewords.push(
                        PDF417Compaction.TEXT_LATCH
                    );

                    currentMode =
                        PDF417Compaction.TEXT;
                }

                const segment =
                    text.substring(
                        index,
                        index + textCount
                    );

                codewords.push(
                    ...PDF417Compaction.compactText(
                        segment,
                        false
                    )
                );

                index += textCount;

                continue;
            }


            /*
             * Otherwise collect a byte segment.
             */

            let end = index + 1;

            while (end < text.length) {

                const nextNumeric =
                    PDF417Compaction.countNumeric(
                        text,
                        end
                    );

                if (nextNumeric >= 13) {
                    break;
                }

                const nextText =
                    PDF417Compaction.countText(
                        text,
                        end
                    );

                if (nextText >= 5) {
                    break;
                }

                end++;
            }

            const segment =
                text.substring(
                    index,
                    end
                );

            const bytes =
                PDF417Compaction.toUTF8(
                    segment
                );


            /*
             * A single byte can use 913 when already operating
             * in text mode.
             */

            if (
                bytes.length === 1 &&
                currentMode ===
                    PDF417Compaction.TEXT
            ) {

                codewords.push(
                    PDF417Compaction.BYTE_SHIFT
                );

                codewords.push(
                    bytes[0]
                );

            } else {

                const use924 =
                    bytes.length >= 6 &&
                    bytes.length % 6 === 0;

                codewords.push(
                    use924
                        ? PDF417Compaction.BYTE_LATCH_6
                        : PDF417Compaction.BYTE_LATCH
                );

                codewords.push(
                    ...PDF417Compaction.encodeByteData(
                        bytes
                    )
                );

                currentMode =
                    PDF417Compaction.BYTE;
            }

            index = end;
        }

        return codewords;
    }


    /* ========================================================
       TEXT COMPACTION
       ======================================================== */

    static compactText(
        text,
        includeLatch = false
    ) {

        const values =
            PDF417Compaction.encodeTextValues(
                text
            );

        const codewords = [];

        if (includeLatch) {
            codewords.push(
                PDF417Compaction.TEXT_LATCH
            );
        }


        /*
         * Two base-30 values are packed into one base-900
         * codeword:
         *
         *     first * 30 + second
         */

        for (
            let index = 0;
            index < values.length;
            index += 2
        ) {

            const first =
                values[index];

            const second =
                index + 1 < values.length
                    ? values[index + 1]
                    : 29;

            codewords.push(
                first * 30 + second
            );
        }

        return codewords;
    }


    /* ========================================================
       TEXT -> BASE-30 VALUES
       ======================================================== */

    static encodeTextValues(text) {

        const values = [];

        let submode =
            PDF417Compaction.ALPHA;

        for (
            let index = 0;
            index < text.length;
            index++
        ) {

            const character =
                text[index];


            /* ------------------------------------------------
               ALPHA
               ------------------------------------------------ */

            if (
                submode ===
                PDF417Compaction.ALPHA
            ) {

                if (
                    character >= "A" &&
                    character <= "Z"
                ) {

                    values.push(
                        character.charCodeAt(0) -
                        65
                    );

                    continue;
                }

                if (character === " ") {
                    values.push(26);
                    continue;
                }

                if (
                    character >= "a" &&
                    character <= "z"
                ) {

                    /*
                     * Latch to LOWER.
                     */

                    values.push(27);

                    submode =
                        PDF417Compaction.LOWER;

                    index--;
                    continue;
                }

                if (
                    PDF417Compaction.isMixed(
                        character
                    )
                ) {

                    /*
                     * Latch to MIXED.
                     */

                    values.push(28);

                    submode =
                        PDF417Compaction.MIXED;

                    index--;
                    continue;
                }


                /*
                 * Shift to punctuation for one character.
                 */

                if (
                    PDF417Compaction.isPunctuation(
                        character
                    )
                ) {

                    values.push(29);

                    values.push(
                        PDF417Compaction
                            .punctuationValue(
                                character
                            )
                    );

                    continue;
                }


                throw new Error(
                    "Character cannot be encoded using " +
                    "PDF417 text compaction: " +
                    character
                );
            }


            /* ------------------------------------------------
               LOWER
               ------------------------------------------------ */

            if (
                submode ===
                PDF417Compaction.LOWER
            ) {

                if (
                    character >= "a" &&
                    character <= "z"
                ) {

                    values.push(
                        character.charCodeAt(0) -
                        97
                    );

                    continue;
                }

                if (character === " ") {
                    values.push(26);
                    continue;
                }


                /*
                 * Shift to ALPHA for one uppercase character.
                 */

                if (
                    character >= "A" &&
                    character <= "Z"
                ) {

                    values.push(27);

                    values.push(
                        character.charCodeAt(0) -
                        65
                    );

                    continue;
                }


                if (
                    PDF417Compaction.isMixed(
                        character
                    )
                ) {

                    values.push(28);

                    submode =
                        PDF417Compaction.MIXED;

                    index--;
                    continue;
                }


                if (
                    PDF417Compaction.isPunctuation(
                        character
                    )
                ) {

                    values.push(29);

                    values.push(
                        PDF417Compaction
                            .punctuationValue(
                                character
                            )
                    );

                    continue;
                }


                throw new Error(
                    "Character cannot be encoded using " +
                    "PDF417 text compaction: " +
                    character
                );
            }


            /* ------------------------------------------------
               MIXED
               ------------------------------------------------ */

            if (
                submode ===
                PDF417Compaction.MIXED
            ) {

                if (
                    PDF417Compaction.isMixed(
                        character
                    )
                ) {

                    values.push(
                        PDF417Compaction.mixedValue(
                            character
                        )
                    );

                    continue;
                }

                if (character === " ") {
                    values.push(26);
                    continue;
                }

                if (
                    character >= "a" &&
                    character <= "z"
                ) {

                    values.push(27);

                    submode =
                        PDF417Compaction.LOWER;

                    index--;
                    continue;
                }

                if (
                    character >= "A" &&
                    character <= "Z"
                ) {

                    values.push(28);

                    submode =
                        PDF417Compaction.ALPHA;

                    index--;
                    continue;
                }


                /*
                 * If the next character is also punctuation,
                 * latching to punctuation can be worthwhile.
                 */

                if (
                    PDF417Compaction.isPunctuation(
                        character
                    )
                ) {

                    const nextIsPunctuation =
                        index + 1 < text.length &&
                        PDF417Compaction.isPunctuation(
                            text[index + 1]
                        );

                    if (nextIsPunctuation) {

                        values.push(25);

                        submode =
                            PDF417Compaction.PUNCT;

                        index--;

                    } else {

                        values.push(29);

                        values.push(
                            PDF417Compaction
                                .punctuationValue(
                                    character
                                )
                        );
                    }

                    continue;
                }


                throw new Error(
                    "Character cannot be encoded using " +
                    "PDF417 text compaction: " +
                    character
                );
            }


            /* ------------------------------------------------
               PUNCT
               ------------------------------------------------ */

            if (
                submode ===
                PDF417Compaction.PUNCT
            ) {

                if (
                    PDF417Compaction.isPunctuation(
                        character
                    )
                ) {

                    values.push(
                        PDF417Compaction
                            .punctuationValue(
                                character
                            )
                    );

                    continue;
                }


                /*
                 * Punctuation submode uses 29 to return
                 * to ALPHA.
                 */

                values.push(29);

                submode =
                    PDF417Compaction.ALPHA;

                index--;
            }
        }


        return values;
    }


    /* ========================================================
       BYTE COMPACTION
       ======================================================== */

    static compactBytes(
        bytes,
        includeLatch = true
    ) {

        if (
            typeof bytes === "string"
        ) {

            bytes =
                PDF417Compaction.toUTF8(
                    bytes
                );
        }


        PDF417Compaction.validateBytes(
            bytes
        );


        const result = [];


        if (includeLatch) {

            result.push(
                bytes.length > 0 &&
                bytes.length % 6 === 0

                    ? PDF417Compaction.BYTE_LATCH_6

                    : PDF417Compaction.BYTE_LATCH
            );
        }


        result.push(
            ...PDF417Compaction.encodeByteData(
                bytes
            )
        );


        return result;
    }


    /* ========================================================
       BYTE DATA ENCODING
       ======================================================== */

    static encodeByteData(bytes) {

        PDF417Compaction.validateBytes(
            bytes
        );


        const codewords = [];

        let index = 0;


        /*
         * Six bytes represent a 48-bit integer.
         *
         * That value is converted into five base-900
         * codewords.
         */

        while (
            index + 6 <= bytes.length
        ) {

            let value = 0n;


            for (
                let offset = 0;
                offset < 6;
                offset++
            ) {

                value =
                    (value << 8n) |
                    BigInt(
                        bytes[
                            index + offset
                        ]
                    );
            }


            const temporary =
                new Array(5);


            for (
                let position = 4;
                position >= 0;
                position--
            ) {

                temporary[position] =
                    Number(
                        value % 900n
                    );

                value /=
                    900n;
            }


            codewords.push(
                ...temporary
            );


            index += 6;
        }


        /*
         * Remaining bytes are represented directly as
         * codeword values.
         */

        while (
            index < bytes.length
        ) {

            codewords.push(
                bytes[index]
            );

            index++;
        }


        return codewords;
    }


    /* ========================================================
       NUMERIC COMPACTION
       ======================================================== */

    static compactNumeric(
        digits,
        includeLatch = false
    ) {

        if (
            typeof digits !== "string"
        ) {

            digits =
                String(digits);
        }


        if (!/^[0-9]+$/.test(digits)) {

            throw new Error(
                "PDF417 numeric compaction accepts " +
                "decimal digits only."
            );
        }


        const codewords = [];


        if (includeLatch) {

            codewords.push(
                PDF417Compaction.NUMERIC_LATCH
            );
        }


        /*
         * PDF417 numeric compaction processes at most
         * 44 decimal digits at a time.
         */

        for (
            let index = 0;
            index < digits.length;
            index += 44
        ) {

            const group =
                digits.substring(
                    index,
                    index + 44
                );


            /*
             * Prefix with decimal '1' so leading zeroes are
             * retained by the base conversion.
             */

            let value =
                BigInt(
                    "1" + group
                );


            const temporary = [];


            while (value > 0n) {

                temporary.push(
                    Number(
                        value % 900n
                    )
                );

                value /=
                    900n;
            }


            temporary.reverse();


            codewords.push(
                ...temporary
            );
        }


        return codewords;
    }


    /* ========================================================
       COUNT NUMERIC RUN
       ======================================================== */

    static countNumeric(
        text,
        start
    ) {

        let count = 0;


        while (
            start + count < text.length
        ) {

            const character =
                text[
                    start + count
                ];


            if (
                character < "0" ||
                character > "9"
            ) {
                break;
            }


            count++;
        }


        return count;
    }


    /* ========================================================
       COUNT TEXT RUN
       ======================================================== */

    static countText(
        text,
        start
    ) {

        let count = 0;


        while (
            start + count < text.length
        ) {

            /*
             * Stop before a long numeric sequence because
             * numeric compaction is substantially better.
             */

            if (
                PDF417Compaction.countNumeric(
                    text,
                    start + count
                ) >= 13
            ) {
                break;
            }


            const character =
                text[
                    start + count
                ];


            if (
                !PDF417Compaction.canEncodeText(
                    character
                )
            ) {
                break;
            }


            count++;
        }


        return count;
    }


    /* ========================================================
       CAN ENCODE AS TEXT
       ======================================================== */

    static canEncodeText(character) {

        if (
            character === " "
        ) {
            return true;
        }


        if (
            character >= "A" &&
            character <= "Z"
        ) {
            return true;
        }


        if (
            character >= "a" &&
            character <= "z"
        ) {
            return true;
        }


        if (
            PDF417Compaction.isMixed(
                character
            )
        ) {
            return true;
        }


        if (
            PDF417Compaction.isPunctuation(
                character
            )
        ) {
            return true;
        }


        return false;
    }


    /* ========================================================
       MIXED CHARACTER HELPERS
       ======================================================== */

    static isMixed(character) {

        return (
            PDF417Compaction
                .MIXED_CHARS
                .indexOf(character) !== -1
        );
    }


    static mixedValue(character) {

        const index =
            PDF417Compaction
                .MIXED_CHARS
                .indexOf(character);


        if (index === -1) {

            throw new Error(
                "Character is not in the PDF417 " +
                "mixed submode: " +
                character
            );
        }


        return index;
    }


    /* ========================================================
       PUNCTUATION HELPERS
       ======================================================== */

    static isPunctuation(character) {

        return (
            PDF417Compaction
                .PUNCT_CHARS
                .indexOf(character) !== -1
        );
    }


    static punctuationValue(
        character
    ) {

        const index =
            PDF417Compaction
                .PUNCT_CHARS
                .indexOf(character);


        if (index === -1) {

            throw new Error(
                "Character is not in the PDF417 " +
                "punctuation submode: " +
                character
            );
        }


        return index;
    }


    /* ========================================================
       UTF-8 CONVERSION
       ======================================================== */

    static toUTF8(text) {

        if (
            typeof TextEncoder !==
            "undefined"
        ) {

            return Array.from(
                new TextEncoder().encode(
                    text
                )
            );
        }


        /*
         * Browser fallback.
         */

        const bytes = [];


        for (const character of text) {

            const codePoint =
                character.codePointAt(0);


            if (
                codePoint <= 0x7F
            ) {

                bytes.push(
                    codePoint
                );

            } else if (
                codePoint <= 0x7FF
            ) {

                bytes.push(
                    0xC0 |
                    (codePoint >> 6)
                );

                bytes.push(
                    0x80 |
                    (codePoint & 0x3F)
                );

            } else if (
                codePoint <= 0xFFFF
            ) {

                bytes.push(
                    0xE0 |
                    (codePoint >> 12)
                );

                bytes.push(
                    0x80 |
                    (
                        (codePoint >> 6) &
                        0x3F
                    )
                );

                bytes.push(
                    0x80 |
                    (codePoint & 0x3F)
                );

            } else {

                bytes.push(
                    0xF0 |
                    (codePoint >> 18)
                );

                bytes.push(
                    0x80 |
                    (
                        (codePoint >> 12) &
                        0x3F
                    )
                );

                bytes.push(
                    0x80 |
                    (
                        (codePoint >> 6) &
                        0x3F
                    )
                );

                bytes.push(
                    0x80 |
                    (codePoint & 0x3F)
                );
            }
        }


        return bytes;
    }


    /* ========================================================
       BYTE VALIDATION
       ======================================================== */

    static validateBytes(bytes) {

        if (
            !Array.isArray(bytes) &&
            !(bytes instanceof Uint8Array)
        ) {

            throw new TypeError(
                "PDF417 byte data must be an array " +
                "or Uint8Array."
            );
        }


        for (
            let index = 0;
            index < bytes.length;
            index++
        ) {

            const value =
                bytes[index];


            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value > 255
            ) {

                throw new RangeError(
                    "Invalid PDF417 byte at index " +
                    index +
                    ": " +
                    value
                );
            }
        }


        return true;
    }


    /* ========================================================
       DETECT SIMPLE MODE
       ======================================================== */

    static detectMode(data) {

        const text =
            String(data);


        if (/^[0-9]+$/.test(text)) {

            /*
             * Short numeric strings are often more compact in
             * text mode. Use numeric for a substantial run.
             */

            if (text.length >= 13) {
                return PDF417Compaction.NUMERIC;
            }
        }


        let textCompatible = true;


        for (const character of text) {

            if (
                !PDF417Compaction.canEncodeText(
                    character
                )
            ) {

                textCompatible = false;
                break;
            }
        }


        if (textCompatible) {
            return PDF417Compaction.TEXT;
        }


        return PDF417Compaction.BYTE;
    }


    /* ========================================================
       COMPACT WITH METADATA
       ======================================================== */

    static compactDetailed(
        data,
        mode = "auto"
    ) {

        const text =
            String(data);


        const requestedMode =
            String(mode || "auto")
                .toLowerCase();


        const detectedMode =
            requestedMode === "auto"
                ? PDF417Compaction.detectMode(
                    text
                )
                : requestedMode;


        const codewords =
            PDF417Compaction.compact(
                text,
                requestedMode
            );


        return {

            data:
                text,

            requestedMode:
                requestedMode,

            detectedMode:
                detectedMode,

            characterCount:
                text.length,

            byteCount:
                PDF417Compaction
                    .toUTF8(text)
                    .length,

            codewords:
                codewords,

            codewordCount:
                codewords.length
        };
    }
}