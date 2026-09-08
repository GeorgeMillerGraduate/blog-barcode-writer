/**
 * ============================================================
 * QR VERSION
 * ============================================================
 *
 * Contains QR Code version/capacity/block information for
 * standard QR Codes, Versions 1 through 40.
 *
 * Responsibilities:
 *
 *  - Validate QR versions
 *  - Validate error-correction levels
 *  - Calculate matrix dimensions
 *  - Calculate raw data-module capacity
 *  - Calculate total codewords
 *  - Determine Reed-Solomon block counts
 *  - Determine EC codewords per block
 *  - Determine total data codewords
 *  - Determine individual data-block sizes
 *  - Determine QR remainder-bit counts
 *  - Expose specification information to QRGenerator
 *
 * QRGenerator expects:
 *
 * {
 *     version: 1,
 *     errorCorrection: "L",
 *     size: 21,
 *     dataCodewords: 19,
 *     ecCodewordsPerBlock: 7,
 *     blockSizes: [19],
 *     remainderBits: 0
 * }
 *
 * ============================================================
 */

class QRVersion {


    /* ========================================================
       CONSTANTS
       ======================================================== */

    static MIN_VERSION = 1;

    static MAX_VERSION = 40;


    static ERROR_CORRECTION_LEVELS = [
        "L",
        "M",
        "Q",
        "H"
    ];


    /* ========================================================
       MAIN INFORMATION LOOKUP
       ======================================================== */

    /**
     * Returns all structural information required to generate
     * a QR Code for the supplied version and EC level.
     *
     * @param {number} version
     * @param {string} errorCorrection
     *
     * @returns {object}
     */
    static getInfo(
        version,
        errorCorrection
    ) {

        QRVersion.validateVersion(
            version
        );


        errorCorrection =
            QRVersion.normaliseErrorCorrection(
                errorCorrection
            );


        const size =
            QRVersion.getSize(
                version
            );


        const rawDataModules =
            QRVersion.getRawDataModules(
                version
            );


        /*
         * Eight modules form one complete codeword.
         *
         * Any remaining modules are the QR remainder bits.
         */

        const totalCodewords =
            Math.floor(
                rawDataModules / 8
            );


        const remainderBits =
            rawDataModules % 8;


        const ecCodewordsPerBlock =
            QRVersion
                .getErrorCorrectionCodewordsPerBlock(
                    version,
                    errorCorrection
                );


        const blockCount =
            QRVersion
                .getErrorCorrectionBlockCount(
                    version,
                    errorCorrection
                );


        const totalErrorCorrectionCodewords =
            ecCodewordsPerBlock *
            blockCount;


        const dataCodewords =
            totalCodewords -
            totalErrorCorrectionCodewords;


        if (
            dataCodewords <= 0
        ) {

            throw new Error(
                "Invalid QR block configuration for Version " +
                version +
                "-" +
                errorCorrection +
                "."
            );

        }


        const blockSizes =
            QRVersion.calculateBlockSizes(
                dataCodewords,
                blockCount
            );


        return {

            version:
                version,

            errorCorrection:
                errorCorrection,

            size:
                size,

            rawDataModules:
                rawDataModules,

            totalCodewords:
                totalCodewords,

            dataCodewords:
                dataCodewords,

            totalErrorCorrectionCodewords:
                totalErrorCorrectionCodewords,

            ecCodewordsPerBlock:
                ecCodewordsPerBlock,

            blockCount:
                blockCount,

            blockSizes:
                blockSizes,

            remainderBits:
                remainderBits

        };

    }


    /* ========================================================
       ALIAS USED BY QRGENERATOR
       ======================================================== */

    static getVersionInfo(
        version,
        errorCorrection
    ) {

        return QRVersion.getInfo(
            version,
            errorCorrection
        );

    }


    /* ========================================================
       MATRIX SIZE
       ======================================================== */

    /**
     * Returns the width/height of a QR matrix.
     *
     * Version 1  = 21
     * Version 2  = 25
     * ...
     * Version 40 = 177
     */
    static getSize(version) {

        QRVersion.validateVersion(
            version
        );


        return (
            17 +
            4 * version
        );

    }


    /* ========================================================
       RAW DATA MODULE COUNT
       ======================================================== */

    /**
     * Returns the number of modules available for the complete
     * interleaved codeword stream plus remainder bits.
     *
     * This is derived from the QR geometry rather than storing
     * another large lookup table.
     *
     * The calculation removes:
     *
     *  - Finder patterns
     *  - Separators
     *  - Timing patterns
     *  - Format information
     *  - Dark module
     *  - Alignment patterns
     *  - Version information where applicable
     *
     * @param {number} version
     *
     * @returns {number}
     */
    static getRawDataModules(version) {

        QRVersion.validateVersion(
            version
        );


        /*
         * Standard QR raw-module formula.
         */

        let result =
            (
                16 *
                version +
                128
            ) *
            version +
            64;


        /*
         * Version 2+ contains alignment patterns.
         */

        if (
            version >= 2
        ) {

            const alignmentPatternCount =
                Math.floor(
                    version / 7
                ) + 2;


            result -=
                (
                    25 *
                    alignmentPatternCount -
                    10
                ) *
                alignmentPatternCount -
                55;

        }


        /*
         * Version 7+ contains two copies of the 18-bit
         * version-information field.
         */

        if (
            version >= 7
        ) {

            result -= 36;

        }


        return result;

    }


    /* ========================================================
       TOTAL CODEWORDS
       ======================================================== */

    static getTotalCodewords(version) {

        return Math.floor(
            QRVersion.getRawDataModules(
                version
            ) / 8
        );

    }


    /* ========================================================
       REMAINDER BITS
       ======================================================== */

    static getRemainderBits(version) {

        return (
            QRVersion.getRawDataModules(
                version
            ) % 8
        );

    }


    /* ========================================================
       DATA CODEWORDS
       ======================================================== */

    static getDataCodewords(
        version,
        errorCorrection
    ) {

        return QRVersion
            .getInfo(
                version,
                errorCorrection
            )
            .dataCodewords;

    }


    /* ========================================================
       DATA CAPACITY IN BITS
       ======================================================== */

    static getDataCapacityBits(
        version,
        errorCorrection
    ) {

        return (
            QRVersion.getDataCodewords(
                version,
                errorCorrection
            ) * 8
        );

    }


    /* ========================================================
       EC CODEWORDS PER BLOCK
       ======================================================== */

    static getErrorCorrectionCodewordsPerBlock(
        version,
        errorCorrection
    ) {

        QRVersion.validateVersion(
            version
        );


        errorCorrection =
            QRVersion.normaliseErrorCorrection(
                errorCorrection
            );


        return QRVersion
            .EC_CODEWORDS_PER_BLOCK[
                errorCorrection
            ][
                version
            ];

    }


    /* ========================================================
       NUMBER OF EC BLOCKS
       ======================================================== */

    static getErrorCorrectionBlockCount(
        version,
        errorCorrection
    ) {

        QRVersion.validateVersion(
            version
        );


        errorCorrection =
            QRVersion.normaliseErrorCorrection(
                errorCorrection
            );


        return QRVersion
            .EC_BLOCK_COUNT[
                errorCorrection
            ][
                version
            ];

    }


    /* ========================================================
       BLOCK SIZE CALCULATION
       ======================================================== */

    /**
     * QR Reed-Solomon blocks can have two different data
     * lengths.
     *
     * When the data codeword count does not divide evenly by
     * the number of blocks, the longer blocks contain exactly
     * one additional data codeword.
     *
     * Example:
     *
     *     62 data codewords
     *     4 blocks
     *
     * becomes:
     *
     *     15, 15, 16, 16
     *
     * @param {number} dataCodewords
     * @param {number} blockCount
     *
     * @returns {number[]}
     */
    static calculateBlockSizes(
        dataCodewords,
        blockCount
    ) {

        if (
            !Number.isInteger(
                dataCodewords
            ) ||
            dataCodewords <= 0
        ) {

            throw new RangeError(
                "QR data-codeword count must be a positive integer."
            );

        }


        if (
            !Number.isInteger(
                blockCount
            ) ||
            blockCount <= 0
        ) {

            throw new RangeError(
                "QR block count must be a positive integer."
            );

        }


        if (
            blockCount >
            dataCodewords
        ) {

            throw new Error(
                "QR block count cannot exceed the number of data codewords."
            );

        }


        const shortBlockSize =
            Math.floor(
                dataCodewords /
                blockCount
            );


        const longBlockCount =
            dataCodewords %
            blockCount;


        const shortBlockCount =
            blockCount -
            longBlockCount;


        const blockSizes = [];


        /*
         * QR stores the shorter block group first.
         */

        for (
            let i = 0;
            i < shortBlockCount;
            i++
        ) {

            blockSizes.push(
                shortBlockSize
            );

        }


        for (
            let i = 0;
            i < longBlockCount;
            i++
        ) {

            blockSizes.push(
                shortBlockSize + 1
            );

        }


        return blockSizes;

    }


    /* ========================================================
       BLOCK GROUP INFORMATION
       ======================================================== */

    /**
     * Returns a more descriptive representation of the two
     * possible QR block groups.
     *
     * Useful for debugging and displaying QR internals.
     */
    static getBlockGroups(
        version,
        errorCorrection
    ) {

        const info =
            QRVersion.getInfo(
                version,
                errorCorrection
            );


        const groups = [];


        for (
            let i = 0;
            i < info.blockSizes.length;
            i++
        ) {

            const dataSize =
                info.blockSizes[i];


            let existingGroup =
                null;


            for (
                let j = 0;
                j < groups.length;
                j++
            ) {

                if (
                    groups[j]
                        .dataCodewordsPerBlock ===
                    dataSize
                ) {

                    existingGroup =
                        groups[j];

                    break;

                }

            }


            if (
                existingGroup
            ) {

                existingGroup.blockCount++;

            }
            else {

                groups.push({

                    blockCount:
                        1,

                    dataCodewordsPerBlock:
                        dataSize,

                    errorCorrectionCodewordsPerBlock:
                        info.ecCodewordsPerBlock,

                    totalCodewordsPerBlock:
                        dataSize +
                        info.ecCodewordsPerBlock

                });

            }

        }


        return groups;

    }


    /* ========================================================
       CHECK IF DATA FITS
       ======================================================== */

    /**
     * Attempts to encode the supplied data using the selected
     * QR configuration.
     *
     * @returns {boolean}
     */
    static canFit(
        data,
        version,
        errorCorrection,
        mode = null
    ) {

        const info =
            QRVersion.getInfo(
                version,
                errorCorrection
            );


        try {

            QRDataEncoder.encode(
                data,
                version,
                info.dataCodewords * 8,
                mode
            );


            return true;

        }
        catch (error) {

            return false;

        }

    }


    /* ========================================================
       FIND SMALLEST VERSION
       ======================================================== */

    static findSmallestVersion(
        data,
        errorCorrection = "M",
        mode = null
    ) {

        errorCorrection =
            QRVersion.normaliseErrorCorrection(
                errorCorrection
            );


        for (
            let version =
                QRVersion.MIN_VERSION;

            version <=
                QRVersion.MAX_VERSION;

            version++
        ) {

            if (
                QRVersion.canFit(
                    data,
                    version,
                    errorCorrection,
                    mode
                )
            ) {

                return version;

            }

        }


        throw new Error(
            "The supplied data cannot fit inside a standard QR Code."
        );

    }


    /* ========================================================
       NORMALISE EC LEVEL
       ======================================================== */

    static normaliseErrorCorrection(
        errorCorrection
    ) {

        if (
            typeof errorCorrection !==
            "string"
        ) {

            throw new TypeError(
                "QR error-correction level must be a string."
            );

        }


        const level =
            errorCorrection
                .trim()
                .toUpperCase();


        QRVersion.validateErrorCorrection(
            level
        );


        return level;

    }


    /* ========================================================
       VALIDATE VERSION
       ======================================================== */

    static validateVersion(version) {

        if (
            !Number.isInteger(
                version
            ) ||
            version <
                QRVersion.MIN_VERSION ||
            version >
                QRVersion.MAX_VERSION
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
        errorCorrection
    ) {

        if (
            !QRVersion
                .ERROR_CORRECTION_LEVELS
                .includes(
                    errorCorrection
                )
        ) {

            throw new Error(
                "QR error-correction level must be L, M, Q or H."
            );

        }

    }


    /* ========================================================
       EC CODEWORDS PER BLOCK TABLE
       ========================================================
       
       Index 0 is unused so that the array index directly
       corresponds to QR Version 1-40.
       ======================================================== */

    static EC_CODEWORDS_PER_BLOCK = {

        L: [
            null,
            7, 10, 15, 20, 26,
            18, 20, 24, 30, 18,
            20, 24, 26, 30, 22,
            24, 28, 30, 28, 28,
            28, 28, 30, 30, 26,
            28, 30, 30, 30, 30,
            30, 30, 30, 30, 30,
            30, 30, 30, 30, 30
        ],

        M: [
            null,
            10, 16, 26, 18, 24,
            16, 18, 22, 22, 26,
            30, 22, 22, 24, 24,
            28, 28, 26, 26, 26,
            26, 28, 28, 28, 28,
            28, 28, 28, 28, 28,
            28, 28, 28, 28, 28,
            28, 28, 28, 28, 28
        ],

        Q: [
            null,
            13, 22, 18, 26, 18,
            24, 18, 22, 20, 24,
            28, 26, 24, 20, 30,
            24, 28, 28, 26, 30,
            28, 30, 30, 30, 30,
            28, 30, 30, 30, 30,
            30, 30, 30, 30, 30,
            30, 30, 30, 30, 30
        ],

        H: [
            null,
            17, 28, 22, 16, 22,
            28, 26, 26, 24, 28,
            24, 28, 22, 24, 24,
            30, 28, 28, 26, 28,
            30, 24, 30, 30, 30,
            30, 30, 30, 30, 30,
            30, 30, 30, 30, 30,
            30, 30, 30, 30, 30
        ]

    };


    /* ========================================================
       ERROR-CORRECTION BLOCK COUNT TABLE
       ========================================================
       
       Number of Reed-Solomon blocks for each QR Version and
       error-correction level.
       
       Index 0 is unused.
       ======================================================== */

    static EC_BLOCK_COUNT = {

        L: [
            null,
            1, 1, 1, 1, 1,
            2, 2, 2, 2, 4,
            4, 4, 4, 4, 6,
            6, 6, 7, 8, 8,
            8, 9, 9, 10, 12,
            12, 12, 13, 14, 15,
            16, 17, 18, 19, 19,
            20, 21, 22, 24, 25
        ],

        M: [
            null,
            1, 1, 1, 2, 2,
            4, 4, 4, 5, 5,
            5, 8, 9, 9, 10,
            10, 11, 13, 14, 16,
            17, 17, 18, 20, 21,
            23, 25, 26, 28, 29,
            31, 33, 35, 37, 38,
            40, 43, 45, 47, 49
        ],

        Q: [
            null,
            1, 1, 2, 2, 4,
            4, 6, 6, 8, 8,
            8, 10, 12, 16, 12,
            17, 16, 18, 21, 20,
            23, 23, 25, 27, 29,
            34, 34, 35, 38, 40,
            43, 45, 48, 51, 53,
            56, 59, 62, 65, 68
        ],

        H: [
            null,
            1, 1, 2, 4, 4,
            4, 5, 6, 8, 8,
            11, 11, 16, 16, 18,
            16, 19, 21, 25, 25,
            25, 34, 30, 32, 35,
            37, 40, 42, 45, 48,
            51, 54, 57, 60, 63,
            66, 70, 74, 77, 81
        ]

    };

}