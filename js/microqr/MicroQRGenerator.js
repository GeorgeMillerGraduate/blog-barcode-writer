/**
 * ============================================================
 * MicroQRGenerator.js
 * ============================================================
 *
 * Coordinates generation of a Micro QR symbol.
 *
 * Responsibilities:
 *  - Select M1-M4
 *  - Select a supported error-correction level
 *  - Encode the payload
 *  - Generate Reed-Solomon ECC
 *  - Build the final message bit stream
 *  - Construct the Micro QR matrix
 *  - Apply and evaluate the four Micro QR masks
 *  - Return a symbol understood by BarcodeRenderer
 *
 * Encoding is handled by MicroQRDataEncoder.
 * ECC is handled by MicroQRErrorCorrection.
 * Placement/format information is handled by MicroQRMatrix.
 * Masking is handled by MicroQRMask.
 * ============================================================
 */

class MicroQRGenerator {

    /* ========================================================
       SYMBOL DEFINITIONS
       ======================================================== */

    static VERSION_DEFINITIONS = {

        M1: {
            version: "M1",
            number: 1,
            size: 11,

            levels: {
                NONE: {
                    dataBits: 20,
                    eccCodewords: 2,
                    finalDataBits: 20
                }
            }
        },

        M2: {
            version: "M2",
            number: 2,
            size: 13,

            levels: {
                L: {
                    dataBits: 40,
                    eccCodewords: 5,
                    finalDataBits: 40
                },

                M: {
                    dataBits: 32,
                    eccCodewords: 6,
                    finalDataBits: 32
                }
            }
        },

        M3: {
            version: "M3",
            number: 3,
            size: 15,

            levels: {
                L: {
                    dataBits: 84,
                    eccCodewords: 6,
                    finalDataBits: 84
                },

                M: {
                    dataBits: 68,
                    eccCodewords: 8,
                    finalDataBits: 68
                }
            }
        },

        M4: {
            version: "M4",
            number: 4,
            size: 17,

            levels: {
                L: {
                    dataBits: 128,
                    eccCodewords: 8,
                    finalDataBits: 128
                },

                M: {
                    dataBits: 112,
                    eccCodewords: 10,
                    finalDataBits: 112
                },

                Q: {
                    dataBits: 80,
                    eccCodewords: 14,
                    finalDataBits: 80
                }
            }
        }
    };


    /* ========================================================
       PUBLIC GENERATOR
       ======================================================== */

    static generate(data, options = {}) {

        if (
            data === null ||
            data === undefined ||
            String(data).length === 0
        ) {
            throw new Error(
                "Micro QR data cannot be empty."
            );
        }

        const text = String(data);

        const requestedLevel =
            MicroQRGenerator.normaliseErrorCorrection(
                options.errorCorrection
            );

        const selection =
            MicroQRGenerator.selectVersion(
                text,
                requestedLevel,
                options.version
            );

        const version =
            selection.version;

        const level =
            selection.errorCorrection;

        const definition =
            MicroQRGenerator.VERSION_DEFINITIONS[
                version
            ];

        const levelDefinition =
            definition.levels[level];


        /* ====================================================
           1. ENCODE PAYLOAD
           ==================================================== */

        const encoded =
            MicroQRDataEncoder.encode(
                text,
                version,
                levelDefinition.dataBits
            );


        /*
         * Preserve the exact number of data bits.
         *
         * Do NOT immediately turn the complete stream into
         * ordinary eight-bit codewords and later assume every
         * codeword contributes eight modules.
         */

        const dataBits =
            encoded.bits.substring(
                0,
                levelDefinition.finalDataBits
            );


        if (
            dataBits.length !==
            levelDefinition.finalDataBits
        ) {
            throw new Error(
                "Micro QR encoder produced " +
                dataBits.length +
                " data bits, but " +
                version +
                " " +
                level +
                " requires " +
                levelDefinition.finalDataBits +
                "."
            );
        }


        /* ====================================================
           2. PREPARE DATA FOR REED-SOLOMON
           ==================================================== */

        /*
         * Reed-Solomon operates on bytes.
         *
         * If the final data portion ends with a partial
         * codeword, it must be padded for the ECC calculation.
         * That padding is internal to the RS calculation and
         * is NOT automatically copied into the matrix.
         */

        const rsDataBits =
            MicroQRGenerator.padBitsToByteBoundary(
                dataBits
            );

        const dataCodewords =
            MicroQRErrorCorrection.bitsToCodewords(
                rsDataBits
            );


        /* ====================================================
           3. GENERATE ERROR CORRECTION
           ==================================================== */

        const eccCodewords =
            MicroQRErrorCorrection.generate(
                dataCodewords,
                levelDefinition.eccCodewords
            );

        const eccBits =
            MicroQRErrorCorrection.codewordsToBits(
                eccCodewords
            );


        /* ====================================================
           4. BUILD FINAL MESSAGE
           ==================================================== */

        /*
         * Important:
         *
         * Use the original exact data bit stream followed by
         * the ECC stream.
         *
         * Do not rebuild the data section from dataCodewords,
         * because doing so can restore artificial padding bits.
         */

        const messageBits =
            dataBits +
            eccBits;


        /* ====================================================
           5. CREATE MATRIX
           ==================================================== */

        const matrix =
            MicroQRMatrix.create(
                version
            );


        /*
         * MicroQRMatrix.create() already installs the function
         * patterns in the class we created previously.
         *
         * Calling placeFunctionPatterns() again is unnecessary
         * and can make matrix ownership harder to reason about.
         */


        /* ====================================================
           6. CHECK AVAILABLE DATA MODULES
           ==================================================== */

        const availableModules =
            MicroQRGenerator.countAvailableModules(
                matrix
            );


        if (
            messageBits.length >
            availableModules
        ) {

            throw new Error(
                "Micro QR " +
                version +
                " " +
                level +
                " produced " +
                messageBits.length +
                " message bits, but the matrix has only " +
                availableModules +
                " available data modules."
            );
        }


        /* ====================================================
           7. PLACE MESSAGE
           ==================================================== */

        MicroQRMatrix.placeData(
            matrix,
            messageBits
        );


        /* ====================================================
           8. SELECT MASK
           ==================================================== */

        const maskResult =
            MicroQRGenerator.selectBestMask(
                matrix,
                version,
                level
            );


        /* ====================================================
           9. BUILD RESULT
           ==================================================== */

        return {

            format:
                "microqr",

            type:
                "microqr",

            version:
                version,

            versionNumber:
                definition.number,

            errorCorrection:
                level,

            mode:
                encoded.mode,

            size:
                definition.size,

            width:
                definition.size,

            height:
                definition.size,

            mask:
                maskResult.mask,

            matrix:
                maskResult.matrix,

            data:
                text,

            characterCount:
                encoded.characterCount,

            dataBits:
                dataBits,

            messageBits:
                messageBits,

            dataCodewords:
                dataCodewords,

            errorCorrectionCodewords:
                eccCodewords,

            codewords:
                dataCodewords.concat(
                    eccCodewords
                ),

            quietZone:
                2,

            metadata: {
                format: "Micro QR",
                version: version,
                errorCorrection: level,
                mode: encoded.mode,
                mask: maskResult.mask,
                size: definition.size,
                dataBitCount: dataBits.length,
                eccBitCount: eccBits.length,
                messageBitCount: messageBits.length
            }
        };
    }


    /* ========================================================
       VERSION SELECTION
       ======================================================== */

    static selectVersion(
        data,
        requestedLevel,
        requestedVersion = null
    ) {

        if (
            requestedVersion !== null &&
            requestedVersion !== undefined &&
            requestedVersion !== ""
        ) {

            const version =
                MicroQRGenerator.normaliseVersion(
                    requestedVersion
                );

            const level =
                MicroQRGenerator.chooseLevelForVersion(
                    version,
                    requestedLevel
                );

            if (level === null) {
                throw new Error(
                    version +
                    " does not support error correction " +
                    requestedLevel +
                    "."
                );
            }

            if (
                !MicroQRGenerator.fits(
                    data,
                    version,
                    level
                )
            ) {
                throw new Error(
                    "The supplied data does not fit inside " +
                    version +
                    " using error correction " +
                    level +
                    "."
                );
            }

            return {
                version: version,
                errorCorrection: level
            };
        }


        const versions = [
            "M1",
            "M2",
            "M3",
            "M4"
        ];


        for (const version of versions) {

            const level =
                MicroQRGenerator.chooseLevelForVersion(
                    version,
                    requestedLevel
                );

            if (level === null) {
                continue;
            }

            if (
                MicroQRGenerator.fits(
                    data,
                    version,
                    level
                )
            ) {
                return {
                    version: version,
                    errorCorrection: level
                };
            }
        }


        throw new Error(
            "The supplied data is too large for a Micro QR Code."
        );
    }


    /* ========================================================
       CAPACITY TEST
       ======================================================== */

    static fits(
        data,
        version,
        level
    ) {

        const definition =
            MicroQRGenerator.VERSION_DEFINITIONS[
                version
            ];

        if (!definition) {
            return false;
        }

        const levelDefinition =
            definition.levels[level];

        if (!levelDefinition) {
            return false;
        }


        try {

            const encoded =
                MicroQRDataEncoder.encode(
                    data,
                    version
                );

            return (
                encoded.bitLength <=
                levelDefinition.dataBits
            );

        } catch (error) {

            return false;
        }
    }


    /* ========================================================
       ERROR CORRECTION NORMALISATION
       ======================================================== */

    static normaliseErrorCorrection(level) {

        const value =
            String(level || "M")
                .trim()
                .toUpperCase();


        if (
            value === "L" ||
            value === "M" ||
            value === "Q"
        ) {
            return value;
        }


        /*
         * Ordinary QR supports H; Micro QR does not.
         *
         * Treat H as a request for the strongest Micro QR
         * option available through this UI.
         */

        if (value === "H") {
            return "Q";
        }


        return "M";
    }


    /* ========================================================
       LEVEL FOR VERSION
       ======================================================== */

    static chooseLevelForVersion(
        version,
        requestedLevel
    ) {

        const definition =
            MicroQRGenerator.VERSION_DEFINITIONS[
                version
            ];

        if (!definition) {
            return null;
        }


        /*
         * M1 is special and has no selectable L/M/Q level.
         */

        if (version === "M1") {
            return "NONE";
        }


        if (
            definition.levels[
                requestedLevel
            ]
        ) {
            return requestedLevel;
        }


        /*
         * Do not silently turn Q into M/L while searching
         * smaller versions.
         */

        if (requestedLevel === "Q") {

            return definition.levels.Q
                ? "Q"
                : null;
        }


        if (requestedLevel === "M") {

            return definition.levels.M
                ? "M"
                : null;
        }


        if (requestedLevel === "L") {

            return definition.levels.L
                ? "L"
                : null;
        }


        return null;
    }


    /* ========================================================
       VERSION NORMALISATION
       ======================================================== */

    static normaliseVersion(version) {

        if (typeof version === "number") {
            version =
                "M" + version;
        }


        const value =
            String(version || "")
                .trim()
                .toUpperCase();


        if (
            value !== "M1" &&
            value !== "M2" &&
            value !== "M3" &&
            value !== "M4"
        ) {
            throw new Error(
                "Invalid Micro QR version: " +
                version
            );
        }


        return value;
    }


    /* ========================================================
       BYTE-ALIGN FOR REED-SOLOMON
       ======================================================== */

    static padBitsToByteBoundary(bits) {

        if (typeof bits !== "string") {
            throw new TypeError(
                "Micro QR bits must be a string."
            );
        }


        if (!/^[01]*$/.test(bits)) {
            throw new Error(
                "Micro QR bit string may contain only 0 and 1."
            );
        }


        const remainder =
            bits.length % 8;


        if (remainder === 0) {
            return bits;
        }


        return (
            bits +
            "0".repeat(
                8 - remainder
            )
        );
    }


    /* ========================================================
       COUNT AVAILABLE MATRIX MODULES
       ======================================================== */

    static countAvailableModules(matrix) {

        let count = 0;


        for (
            let row = 0;
            row < matrix.length;
            row++
        ) {

            for (
                let column = 0;
                column < matrix[row].length;
                column++
            ) {

                /*
                 * Reserved modules are finder, separator,
                 * timing and format-information modules.
                 */

                if (
                    typeof MicroQRMatrix.isReserved ===
                        "function" &&
                    MicroQRMatrix.isReserved(
                        matrix,
                        row,
                        column
                    )
                ) {
                    continue;
                }


                if (
                    matrix[row][column] === null ||
                    matrix[row][column] === undefined
                ) {
                    count++;
                }
            }
        }


        return count;
    }


    /* ========================================================
       MASK SELECTION
       ======================================================== */

    static selectBestMask(
        baseMatrix,
        version,
        level
    ) {

        let bestMatrix = null;
        let bestMask = null;
        let bestScore = -Infinity;


        for (
            let mask = 0;
            mask < 4;
            mask++
        ) {

            /*
             * Preserve the reservation map as well as the
             * visible modules.
             */

            const candidate =
                typeof MicroQRMatrix.clone === "function"
                    ? MicroQRMatrix.clone(
                        baseMatrix
                    )
                    : MicroQRGenerator.cloneMatrix(
                        baseMatrix
                    );


            const reserved =
                typeof MicroQRMatrix.getReservedMap ===
                    "function"
                    ? MicroQRMatrix.getReservedMap(
                        candidate
                    )
                    : null;


            const masked =
                MicroQRMask.apply(
                    candidate,
                    mask,
                    reserved
                );


            /*
             * MicroQRMask returns a cloned matrix. Reattach the
             * reservation metadata where required.
             */

            MicroQRGenerator.attachReservedMap(
                masked,
                reserved,
                version
            );


            MicroQRMatrix.placeFormatInformation(
                masked,
                version,
                level,
                mask
            );


            const score =
                MicroQRMask.evaluate(
                    masked
                );


            if (
                bestMatrix === null ||
                score > bestScore
            ) {

                bestMatrix =
                    masked;

                bestMask =
                    mask;

                bestScore =
                    score;
            }
        }


        if (bestMatrix === null) {
            throw new Error(
                "Unable to select a Micro QR mask."
            );
        }


        return {
            matrix: bestMatrix,
            mask: bestMask,
            score: bestScore
        };
    }


    /* ========================================================
       RESTORE MATRIX METADATA
       ======================================================== */

    static attachReservedMap(
        matrix,
        reserved,
        version
    ) {

        if (
            reserved &&
            !matrix._reserved
        ) {

            Object.defineProperty(
                matrix,
                "_reserved",
                {
                    value:
                        reserved.map(
                            row => row.slice()
                        ),

                    writable: true,
                    enumerable: false
                }
            );
        }


        if (
            version &&
            !matrix._microQRVersion
        ) {

            Object.defineProperty(
                matrix,
                "_microQRVersion",
                {
                    value: version,
                    writable: true,
                    enumerable: false
                }
            );
        }


        return matrix;
    }


    /* ========================================================
       MATRIX CLONE FALLBACK
       ======================================================== */

    static cloneMatrix(matrix) {

        const clone =
            matrix.map(
                row =>
                    row.slice()
            );


        if (matrix._reserved) {

            Object.defineProperty(
                clone,
                "_reserved",
                {
                    value:
                        matrix._reserved.map(
                            row => row.slice()
                        ),

                    writable: true,
                    enumerable: false
                }
            );
        }


        if (matrix._microQRVersion) {

            Object.defineProperty(
                clone,
                "_microQRVersion",
                {
                    value:
                        matrix._microQRVersion,

                    writable: true,
                    enumerable: false
                }
            );
        }


        return clone;
    }


    /* ========================================================
       MATRIX VALIDATION
       ======================================================== */

    static validateMatrix(matrix) {

        if (
            !Array.isArray(matrix) ||
            matrix.length === 0
        ) {
            throw new Error(
                "Invalid Micro QR matrix."
            );
        }


        const size =
            matrix.length;


        if (
            size !== 11 &&
            size !== 13 &&
            size !== 15 &&
            size !== 17
        ) {
            throw new Error(
                "Micro QR matrix must be 11, 13, " +
                "15 or 17 modules square."
            );
        }


        for (const row of matrix) {

            if (
                !Array.isArray(row) ||
                row.length !== size
            ) {
                throw new Error(
                    "Micro QR matrix must be square."
                );
            }
        }


        return true;
    }


    /* ========================================================
       DETAILED GENERATOR
       ======================================================== */

    static generateDetailed(
        data,
        options = {}
    ) {

        const symbol =
            MicroQRGenerator.generate(
                data,
                options
            );


        return {
            ...symbol,

            metadata: {
                ...symbol.metadata,

                dataCodewords:
                    symbol.dataCodewords.length,

                errorCorrectionCodewords:
                    symbol
                        .errorCorrectionCodewords
                        .length,

                totalCodewords:
                    symbol.codewords.length
            }
        };
    }
}