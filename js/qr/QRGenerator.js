/**
 * ============================================================
 * QR GENERATOR
 * ============================================================
 *
 * High-level controller for generating a standard QR Code.
 *
 * Generation pipeline:
 *
 *  1. Validate input
 *  2. Determine encoding mode
 *  3. Select the smallest suitable QR version
 *  4. Obtain version/error-correction information
 *  5. Encode the input data
 *  6. Split data into Reed-Solomon blocks
 *  7. Generate error-correction codewords
 *  8. Interleave data and EC codewords
 *  9. Add QR remainder bits
 * 10. Construct the QR matrix
 * 11. Place function patterns
 * 12. Place encoded data
 * 13. Test QR mask patterns
 * 14. Select the lowest-penalty mask
 * 15. Write format/version information
 * 16. Return the completed symbol
 *
 * This class deliberately contains very little low-level QR
 * logic. It coordinates the specialised QR classes.
 *
 * ============================================================
 */

class QRGenerator {


    /* ========================================================
       DEFAULT SETTINGS
       ======================================================== */

    static DEFAULT_ERROR_CORRECTION = "M";

    static MIN_VERSION = 1;

    static MAX_VERSION = 40;


    /* ========================================================
       GENERATE
       ======================================================== */

    /**
     * Generates a complete QR Code symbol.
     *
     * @param {string} data
     *        Text/data to encode.
     *
     * @param {object} options
     *        Generator configuration.
     *
     * @returns {object}
     *          Completed QR symbol.
     */
    static generate(
        data,
        options = {}
    ) {

        QRGenerator.validateData(
            data
        );


        const settings =
            QRGenerator.normaliseOptions(
                options
            );


        /*
         * ----------------------------------------------------
         * Determine the most efficient supported mode.
         * ----------------------------------------------------
         */

        const mode =
            settings.mode === null
                ? QRDataEncoder.detectMode(data)
                : settings.mode;


        /*
         * ----------------------------------------------------
         * Determine QR version.
         * ----------------------------------------------------
         *
         * If the caller specified a version, use it.
         *
         * Otherwise find the smallest QR version capable of
         * containing the supplied data.
         */

        const version =
            settings.version === null
                ? QRGenerator.findSmallestVersion(
                    data,
                    mode,
                    settings.errorCorrection
                )
                : settings.version;


        QRGenerator.validateVersion(
            version
        );


        /*
         * ----------------------------------------------------
         * Obtain version information.
         * ----------------------------------------------------
         */

        const versionInfo =
            QRGenerator.getVersionInfo(
                version,
                settings.errorCorrection
            );


        /*
         * ----------------------------------------------------
         * Encode input data.
         * ----------------------------------------------------
         */

        const encoded =
            QRDataEncoder.encode(
                data,
                version,
                versionInfo.dataCodewords * 8,
                mode
            );


        /*
         * The encoder should now have produced exactly the
         * required number of data codewords.
         */

        if (
            encoded.bytes.length !==
            versionInfo.dataCodewords
        ) {

            throw new Error(
                "QR data encoder produced " +
                encoded.bytes.length +
                " codewords, but version " +
                version +
                "-" +
                settings.errorCorrection +
                " requires " +
                versionInfo.dataCodewords +
                "."
            );

        }


        /*
         * ----------------------------------------------------
         * Reed-Solomon processing.
         * ----------------------------------------------------
         */

        const errorCorrection =
            QRErrorCorrection.process(
                encoded.bytes,
                versionInfo.blockSizes,
                versionInfo.ecCodewordsPerBlock
            );


        /*
         * ----------------------------------------------------
         * Convert final codewords into bits.
         * ----------------------------------------------------
         */

        const finalBits =
            QRErrorCorrection.codewordsToBits(
                errorCorrection.codewords
            );


        /*
         * ----------------------------------------------------
         * Add remainder bits.
         * ----------------------------------------------------
         */

        QRGenerator.appendRemainderBits(
            finalBits,
            versionInfo.remainderBits
        );


        /*
         * ----------------------------------------------------
         * Construct matrix.
         * ----------------------------------------------------
         */

        const matrix =
            QRGenerator.createMatrix(
                version
            );


        /*
         * ----------------------------------------------------
         * Place fixed QR function patterns.
         * ----------------------------------------------------
         */

        QRGenerator.placeFunctionPatterns(
            matrix,
            version
        );


        /*
         * ----------------------------------------------------
         * Place encoded data.
         * ----------------------------------------------------
         */

        QRGenerator.placeData(
            matrix,
            finalBits
        );


        /*
         * ----------------------------------------------------
         * Select and apply mask.
         * ----------------------------------------------------
         */

        const maskResult =
            QRGenerator.selectMask(
                matrix,
                settings.errorCorrection,
                version,
                settings.mask
            );


        /*
         * ----------------------------------------------------
         * Return symbol in the common format expected by
         * BarcodeRenderer and app.js.
         * ----------------------------------------------------
         */

        return QRGenerator.createSymbol({

            data:
                data,

            mode:
                mode,

            version:
                version,

            errorCorrection:
                settings.errorCorrection,

            mask:
                maskResult.mask,

            penalty:
                maskResult.penalty,

            matrix:
                maskResult.matrix,

            encoded:
                encoded,

            blocks:
                errorCorrection.blocks,

            codewords:
                errorCorrection.codewords,

            finalBits:
                finalBits,

            versionInfo:
                versionInfo

        });

    }


    /* ========================================================
       OPTIONS
       ======================================================== */

    static normaliseOptions(
        options
    ) {

        const settings = {

            errorCorrection:
                QRGenerator.DEFAULT_ERROR_CORRECTION,

            version:
                null,

            mode:
                null,

            mask:
                null

        };


        if (
            options &&
            typeof options === "object"
        ) {

            if (
                options.errorCorrection !==
                undefined
            ) {

                settings.errorCorrection =
                    String(
                        options.errorCorrection
                    )
                        .toUpperCase();

            }


            if (
                options.version !==
                undefined &&
                options.version !==
                null &&
                options.version !==
                "auto"
            ) {

                settings.version =
                    Number(
                        options.version
                    );

            }


            if (
                options.mode !==
                undefined &&
                options.mode !==
                null &&
                options.mode !==
                "auto"
            ) {

                settings.mode =
                    String(
                        options.mode
                    )
                        .toLowerCase();

            }


            if (
                options.mask !==
                undefined &&
                options.mask !==
                null &&
                options.mask !==
                "auto"
            ) {

                settings.mask =
                    Number(
                        options.mask
                    );

            }

        }


        QRGenerator.validateErrorCorrection(
            settings.errorCorrection
        );


        if (
            settings.version !==
            null
        ) {

            QRGenerator.validateVersion(
                settings.version
            );

        }


        if (
            settings.mask !== null
        ) {

            QRGenerator.validateMask(
                settings.mask
            );

        }


        return settings;

    }


    /* ========================================================
       FIND SMALLEST QR VERSION
       ======================================================== */

    static findSmallestVersion(
        data,
        mode,
        errorCorrection
    ) {

        for (
            let version =
                QRGenerator.MIN_VERSION;
            version <=
                QRGenerator.MAX_VERSION;
            version++
        ) {

            let versionInfo;


            try {

                versionInfo =
                    QRGenerator.getVersionInfo(
                        version,
                        errorCorrection
                    );

            }
            catch (error) {

                continue;

            }


            try {

                /*
                 * Attempt the encoding using this version's
                 * exact data capacity.
                 *
                 * QRDataEncoder throws if it does not fit.
                 */

                QRDataEncoder.encode(
                    data,
                    version,
                    versionInfo.dataCodewords * 8,
                    mode
                );


                return version;

            }
            catch (error) {

                /*
                 * Data does not fit.
                 *
                 * Continue with the next QR version.
                 */

            }

        }


        throw new Error(
            "The supplied data is too large for a standard QR Code."
        );

    }


    /* ========================================================
       VERSION INFORMATION
       ======================================================== */

    static getVersionInfo(
        version,
        errorCorrection
    ) {

        /*
         * QRVersion.js owns the large QR specification tables.
         *
         * Its public interface should return:
         *
         * {
         *     version: 1,
         *     errorCorrection: "L",
         *
         *     size: 21,
         *
         *     dataCodewords: 19,
         *
         *     ecCodewordsPerBlock: 7,
         *
         *     blockSizes: [19],
         *
         *     remainderBits: 0
         * }
         */

        if (
            typeof QRVersion ===
            "undefined"
        ) {

            throw new Error(
                "QRVersion is not available."
            );

        }


        let info;


        /*
         * Primary interface used by this project.
         */

        if (
            typeof QRVersion.getInfo ===
            "function"
        ) {

            info =
                QRVersion.getInfo(
                    version,
                    errorCorrection
                );

        }
        else if (
            typeof QRVersion.getVersionInfo ===
            "function"
        ) {

            /*
             * Allows the class to remain easy to adapt if we
             * use this method name when writing QRVersion.js.
             */

            info =
                QRVersion.getVersionInfo(
                    version,
                    errorCorrection
                );

        }
        else {

            throw new Error(
                "QRVersion must provide a getInfo() method."
            );

        }


        QRGenerator.validateVersionInfo(
            info,
            version,
            errorCorrection
        );


        return info;

    }


    /* ========================================================
       CREATE QR MATRIX
       ======================================================== */

    static createMatrix(
        version
    ) {

        if (
            typeof QRMatrix ===
            "undefined"
        ) {

            throw new Error(
                "QRMatrix is not available."
            );

        }


        /*
         * Preferred interface:
         *
         *     QRMatrix.create(version)
         */

        if (
            typeof QRMatrix.create ===
            "function"
        ) {

            return QRMatrix.create(
                version
            );

        }


        /*
         * Alternative object-oriented interface.
         */

        return new QRMatrix(
            version
        );

    }


    /* ========================================================
       PLACE FUNCTION PATTERNS
       ======================================================== */

    static placeFunctionPatterns(
        matrix,
        version
    ) {

        /*
         * Preferred design:
         *
         * QRMatrix handles finder patterns, separators,
         * alignment patterns, timing patterns, dark module and
         * reservation of format/version information areas.
         */

        if (
            typeof QRMatrix.placeFunctionPatterns ===
            "function"
        ) {

            QRMatrix.placeFunctionPatterns(
                matrix,
                version
            );

            return;

        }


        if (
            matrix &&
            typeof matrix.placeFunctionPatterns ===
            "function"
        ) {

            matrix.placeFunctionPatterns();

            return;

        }


        throw new Error(
            "QRMatrix does not provide function-pattern placement."
        );

    }


    /* ========================================================
       PLACE DATA BITS
       ======================================================== */

    static placeData(
        matrix,
        bits
    ) {

        if (
            typeof QRMatrix.placeData ===
            "function"
        ) {

            QRMatrix.placeData(
                matrix,
                bits
            );

            return;

        }


        if (
            matrix &&
            typeof matrix.placeData ===
            "function"
        ) {

            matrix.placeData(
                bits
            );

            return;

        }


        throw new Error(
            "QRMatrix does not provide data placement."
        );

    }


    /* ========================================================
       MASK SELECTION
       ======================================================== */

    static selectMask(
        matrix,
        errorCorrection,
        version,
        forcedMask
    ) {

        if (
            typeof QRMask ===
            "undefined"
        ) {

            throw new Error(
                "QRMask is not available."
            );

        }


        /*
         * ----------------------------------------------------
         * Automatic mask selection.
         * ----------------------------------------------------
         */

        if (
            forcedMask === null
        ) {

            if (
                typeof QRMask.selectBestMask ===
                "function"
            ) {

                return QRMask.selectBestMask(
                    matrix,
                    errorCorrection,
                    version
                );

            }


            throw new Error(
                "QRMask does not provide automatic mask selection."
            );

        }


        /*
         * ----------------------------------------------------
         * Forced mask.
         * ----------------------------------------------------
         */

        if (
            typeof QRMask.applyMask !==
            "function"
        ) {

            throw new Error(
                "QRMask does not provide mask application."
            );

        }


        const maskedMatrix =
            QRMask.applyMask(
                matrix,
                forcedMask,
                errorCorrection,
                version
            );


        let penalty = null;


        if (
            typeof QRMask.calculatePenalty ===
            "function"
        ) {

            penalty =
                QRMask.calculatePenalty(
                    maskedMatrix
                );

        }


        return {

            mask:
                forcedMask,

            penalty:
                penalty,

            matrix:
                maskedMatrix

        };

    }


    /* ========================================================
       REMAINDER BITS
       ======================================================== */

    static appendRemainderBits(
        bits,
        count
    ) {

        if (
            !Number.isInteger(count) ||
            count < 0
        ) {

            throw new Error(
                "QR remainder-bit count must be a non-negative integer."
            );

        }


        for (
            let i = 0;
            i < count;
            i++
        ) {

            bits.push(0);

        }

    }


    /* ========================================================
       CREATE COMMON SYMBOL OBJECT
       ======================================================== */

    static createSymbol(
        information
    ) {

        const matrix =
            QRGenerator.extractMatrix(
                information.matrix
            );


        if (
            !Array.isArray(matrix) ||
            matrix.length === 0
        ) {

            throw new Error(
                "QR generation produced an invalid matrix."
            );

        }


        const height =
            matrix.length;


        const width =
            Array.isArray(matrix[0])
                ? matrix[0].length
                : 0;


        if (
            width === 0
        ) {

            throw new Error(
                "QR generation produced an empty matrix."
            );

        }


        return {

            type:
                "qr",

            format:
                "QR Code",

            data:
                information.data,

            mode:
                information.mode,

            version:
                information.version,

            errorCorrection:
                information.errorCorrection,

            mask:
                information.mask,

            penalty:
                information.penalty,

            width:
                width,

            height:
                height,

            matrix:
                matrix,

            metadata: {

                version:
                    information.version,

                mode:
                    information.mode,

                errorCorrection:
                    information.errorCorrection,

                mask:
                    information.mask,

                penalty:
                    information.penalty,

                dataCodewords:
                    information
                        .versionInfo
                        .dataCodewords,

                errorCorrectionCodewords:
                    QRGenerator
                        .countErrorCorrectionCodewords(
                            information.blocks
                        ),

                totalCodewords:
                    information
                        .codewords
                        .length,

                remainderBits:
                    information
                        .versionInfo
                        .remainderBits

            }

        };

    }


    /* ========================================================
       EXTRACT MATRIX
       ======================================================== */

    static extractMatrix(
        matrix
    ) {

        /*
         * QRMatrix may itself simply be a 2D array.
         */

        if (
            Array.isArray(matrix)
        ) {

            return matrix;

        }


        /*
         * Or QRMatrix may be an object containing the array.
         */

        if (
            matrix &&
            Array.isArray(
                matrix.matrix
            )
        ) {

            return matrix.matrix;

        }


        /*
         * Or expose a getter.
         */

        if (
            matrix &&
            typeof matrix.getMatrix ===
            "function"
        ) {

            return matrix.getMatrix();

        }


        return null;

    }


    /* ========================================================
       COUNT ERROR-CORRECTION CODEWORDS
       ======================================================== */

    static countErrorCorrectionCodewords(
        blocks
    ) {

        let total = 0;


        for (
            let i = 0;
            i < blocks.length;
            i++
        ) {

            total +=
                blocks[i]
                    .errorCorrection
                    .length;

        }


        return total;

    }


    /* ========================================================
       VALIDATE DATA
       ======================================================== */

    static validateData(
        data
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

    }


    /* ========================================================
       VALIDATE VERSION
       ======================================================== */

    static validateVersion(
        version
    ) {

        if (
            !Number.isInteger(version) ||
            version <
                QRGenerator.MIN_VERSION ||
            version >
                QRGenerator.MAX_VERSION
        ) {

            throw new RangeError(
                "QR version must be an integer from 1 to 40."
            );

        }

    }


    /* ========================================================
       VALIDATE ERROR CORRECTION
       ======================================================== */

    static validateErrorCorrection(
        level
    ) {

        const levels = [
            "L",
            "M",
            "Q",
            "H"
        ];


        if (
            !levels.includes(level)
        ) {

            throw new Error(
                "QR error-correction level must be L, M, Q or H."
            );

        }

    }


    /* ========================================================
       VALIDATE MASK
       ======================================================== */

    static validateMask(
        mask
    ) {

        if (
            !Number.isInteger(mask) ||
            mask < 0 ||
            mask > 7
        ) {

            throw new RangeError(
                "QR mask must be an integer from 0 to 7."
            );

        }

    }


    /* ========================================================
       VALIDATE VERSION INFORMATION
       ======================================================== */

    static validateVersionInfo(
        info,
        version,
        errorCorrection
    ) {

        if (
            !info ||
            typeof info !==
            "object"
        ) {

            throw new Error(
                "No QR specification information exists for version " +
                version +
                "-" +
                errorCorrection +
                "."
            );

        }


        if (
            !Number.isInteger(
                info.dataCodewords
            ) ||
            info.dataCodewords <= 0
        ) {

            throw new Error(
                "QRVersion returned an invalid data-codeword count."
            );

        }


        if (
            !Number.isInteger(
                info.ecCodewordsPerBlock
            ) ||
            info.ecCodewordsPerBlock <= 0
        ) {

            throw new Error(
                "QRVersion returned an invalid error-correction block size."
            );

        }


        if (
            !Array.isArray(
                info.blockSizes
            ) ||
            info.blockSizes.length === 0
        ) {

            throw new Error(
                "QRVersion returned no Reed-Solomon block structure."
            );

        }


        let dataCodewordTotal = 0;


        for (
            let i = 0;
            i < info.blockSizes.length;
            i++
        ) {

            const blockSize =
                info.blockSizes[i];


            if (
                !Number.isInteger(
                    blockSize
                ) ||
                blockSize <= 0
            ) {

                throw new Error(
                    "QRVersion returned an invalid block size."
                );

            }


            dataCodewordTotal +=
                blockSize;

        }


        if (
            dataCodewordTotal !==
            info.dataCodewords
        ) {

            throw new Error(
                "QRVersion block sizes total " +
                dataCodewordTotal +
                " data codewords, but the version specifies " +
                info.dataCodewords +
                "."
            );

        }


        if (
            !Number.isInteger(
                info.remainderBits
            ) ||
            info.remainderBits < 0
        ) {

            throw new Error(
                "QRVersion returned an invalid remainder-bit count."
            );

        }

    }

}