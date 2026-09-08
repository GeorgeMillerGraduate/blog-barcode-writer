/**
 * ============================================================
 * MicroQRMatrix.js
 * ============================================================
 *
 * Builds and manages the module matrix for Micro QR Codes.
 *
 * Responsibilities:
 *  - Create M1-M4 matrices
 *  - Place the finder pattern
 *  - Place the separator
 *  - Place timing patterns
 *  - Reserve format-information modules
 *  - Place encoded data in the matrix
 *  - Generate and place Micro QR format information
 *  - Maintain a reserved/function-module map
 *
 * Matrix values:
 *
 *      null  = unassigned
 *      false = light
 *      true  = dark
 *
 * Reserved map values:
 *
 *      false = data module
 *      true  = function/reserved module
 *
 * ============================================================
 */

class MicroQRMatrix {

    /* ========================================================
       VERSION SIZES
       ======================================================== */

    static VERSION_SIZES = {
        M1: 11,
        M2: 13,
        M3: 15,
        M4: 17
    };


    /* ========================================================
       FORMAT SYMBOL NUMBERS
       ======================================================== */

    static FORMAT_SYMBOL_NUMBER = {

        M1: {
            NONE: 0
        },

        M2: {
            L: 1,
            M: 2
        },

        M3: {
            L: 3,
            M: 4
        },

        M4: {
            L: 5,
            M: 6,
            Q: 7
        }

    };


    /* ========================================================
       FORMAT INFORMATION MASK
       ======================================================== */

    static FORMAT_MASK = 0x4445;


    /* ========================================================
       CREATE MATRIX
       ======================================================== */

    static create(version) {

        const normalisedVersion =
            MicroQRMatrix.normaliseVersion(
                version
            );

        const size =
            MicroQRMatrix.VERSION_SIZES[
                normalisedVersion
            ];


        const matrix =
            MicroQRMatrix.createEmptyMatrix(
                size
            );


        /*
         * Attach metadata without interfering with normal
         * Array behaviour.
         */

        Object.defineProperty(
            matrix,
            "_microQRVersion",
            {
                value: normalisedVersion,
                writable: true,
                enumerable: false
            }
        );


        Object.defineProperty(
            matrix,
            "_reserved",
            {
                value:
                    MicroQRMatrix.createReservedMap(
                        size
                    ),

                writable: true,
                enumerable: false
            }
        );


        MicroQRMatrix.placeFunctionPatterns(
            matrix,
            normalisedVersion
        );


        return matrix;
    }


    /* ========================================================
       CREATE MATRIX ALIAS
       ======================================================== */

    static createMatrix(version) {

        return MicroQRMatrix.create(
            version
        );
    }


    /* ========================================================
       EMPTY MATRIX
       ======================================================== */

    static createEmptyMatrix(size) {

        if (
            !Number.isInteger(size) ||
            size <= 0
        ) {

            throw new TypeError(
                "Micro QR matrix size must be a " +
                "positive integer."
            );
        }


        return Array.from(
            {
                length: size
            },
            () =>
                new Array(size).fill(null)
        );
    }


    /* ========================================================
       RESERVED MAP
       ======================================================== */

    static createReservedMap(size) {

        return Array.from(
            {
                length: size
            },
            () =>
                new Array(size).fill(false)
        );
    }


    /* ========================================================
       PLACE ALL FUNCTION PATTERNS
       ======================================================== */

    static placeFunctionPatterns(
        matrix,
        version = null
    ) {

        MicroQRMatrix.validateMatrix(
            matrix
        );


        const resolvedVersion =
            version
                ? MicroQRMatrix.normaliseVersion(version)
                : MicroQRMatrix.versionFromSize(
                    matrix.length
                );


        MicroQRMatrix.ensureMetadata(
            matrix,
            resolvedVersion
        );


        MicroQRMatrix.placeFinderPattern(
            matrix,
            0,
            0
        );


        MicroQRMatrix.placeSeparator(
            matrix
        );


        MicroQRMatrix.placeTimingPatterns(
            matrix
        );


        MicroQRMatrix.reserveFormatInformation(
            matrix
        );


        return matrix;
    }


    /* ========================================================
       FUNCTION PATTERN ALIAS
       ======================================================== */

    static addFunctionPatterns(
        matrix,
        version = null
    ) {

        return MicroQRMatrix.placeFunctionPatterns(
            matrix,
            version
        );
    }


    /* ========================================================
       FINDER PATTERN
       ======================================================== */

    static placeFinderPattern(
        matrix,
        startRow = 0,
        startColumn = 0
    ) {

        MicroQRMatrix.validateMatrix(
            matrix
        );


        /*
         * Standard 7 x 7 finder:
         *
         * 1111111
         * 1000001
         * 1011101
         * 1011101
         * 1011101
         * 1000001
         * 1111111
         */

        for (
            let row = 0;
            row < 7;
            row++
        ) {

            for (
                let column = 0;
                column < 7;
                column++
            ) {

                const targetRow =
                    startRow + row;

                const targetColumn =
                    startColumn + column;


                if (
                    targetRow >= matrix.length ||
                    targetColumn >= matrix.length
                ) {

                    continue;
                }


                const outer =
                    row === 0 ||
                    row === 6 ||
                    column === 0 ||
                    column === 6;


                const centre =
                    row >= 2 &&
                    row <= 4 &&
                    column >= 2 &&
                    column <= 4;


                MicroQRMatrix.setFunctionModule(
                    matrix,
                    targetRow,
                    targetColumn,
                    outer || centre
                );
            }
        }


        return matrix;
    }


    /* ========================================================
       SEPARATOR
       ======================================================== */

    static placeSeparator(matrix) {

        MicroQRMatrix.validateMatrix(
            matrix
        );


        const size =
            matrix.length;


        /*
         * Light separator below finder.
         */

        if (size > 7) {

            for (
                let column = 0;
                column <= 7 &&
                column < size;
                column++
            ) {

                MicroQRMatrix.setFunctionModule(
                    matrix,
                    7,
                    column,
                    false
                );
            }
        }


        /*
         * Light separator to the right of finder.
         */

        if (size > 7) {

            for (
                let row = 0;
                row <= 7 &&
                row < size;
                row++
            ) {

                MicroQRMatrix.setFunctionModule(
                    matrix,
                    row,
                    7,
                    false
                );
            }
        }


        return matrix;
    }


    /* ========================================================
       TIMING PATTERNS
       ======================================================== */

    static placeTimingPatterns(matrix) {

        MicroQRMatrix.validateMatrix(
            matrix
        );


        const size =
            matrix.length;


        /*
         * Micro QR has horizontal and vertical timing
         * patterns extending from the finder region.
         *
         * They occupy row 0 and column 0.
         */

        for (
            let position = 8;
            position < size;
            position++
        ) {

            const dark =
                position % 2 === 0;


            MicroQRMatrix.setFunctionModule(
                matrix,
                0,
                position,
                dark
            );


            MicroQRMatrix.setFunctionModule(
                matrix,
                position,
                0,
                dark
            );
        }


        return matrix;
    }


    /* ========================================================
       RESERVE FORMAT INFORMATION
       ======================================================== */

    static reserveFormatInformation(matrix) {

        MicroQRMatrix.validateMatrix(
            matrix
        );


        /*
         * 15 format-information modules surround the
         * lower/right side of the finder region.
         *
         * Horizontal:
         *
         *      (8, 1) ... (8, 8)
         *
         * Vertical:
         *
         *      (7, 8) ... (1, 8)
         *
         * 8 + 7 = 15 modules.
         */

        for (
            let column = 1;
            column <= 8;
            column++
        ) {

            MicroQRMatrix.reserveModule(
                matrix,
                8,
                column
            );
        }


        for (
            let row = 1;
            row <= 7;
            row++
        ) {

            MicroQRMatrix.reserveModule(
                matrix,
                row,
                8
            );
        }


        return matrix;
    }


    /* ========================================================
       PLACE DATA BITS
       ======================================================== */

    static placeData(
        matrix,
        bits
    ) {

        MicroQRMatrix.validateMatrix(
            matrix
        );


        if (typeof bits !== "string") {

            throw new TypeError(
                "Micro QR data must be supplied " +
                "as a bit string."
            );
        }


        if (!/^[01]*$/.test(bits)) {

            throw new Error(
                "Micro QR data bit string may contain " +
                "only 0 and 1."
            );
        }


        let bitIndex = 0;

        const size =
            matrix.length;

        let upwards = true;


        /*
         * Data is placed in two-column stripes beginning at
         * the bottom-right of the matrix.
         */

        for (
            let rightColumn = size - 1;
            rightColumn > 0;
            rightColumn -= 2
        ) {

            for (
                let offset = 0;
                offset < size;
                offset++
            ) {

                const row =
                    upwards
                        ? size - 1 - offset
                        : offset;


                for (
                    let columnOffset = 0;
                    columnOffset < 2;
                    columnOffset++
                ) {

                    const column =
                        rightColumn -
                        columnOffset;


                    if (column < 0) {
                        continue;
                    }


                    if (
                        MicroQRMatrix.isReserved(
                            matrix,
                            row,
                            column
                        )
                    ) {

                        continue;
                    }


                    if (
                        matrix[row][column] !== null &&
                        matrix[row][column] !== undefined
                    ) {

                        continue;
                    }


                    if (
                        bitIndex < bits.length
                    ) {

                        matrix[row][column] =
                            bits[bitIndex] === "1";

                        bitIndex++;

                    } else {

                        /*
                         * Remaining data positions are light.
                         */

                        matrix[row][column] =
                            false;
                    }
                }
            }


            upwards =
                !upwards;
        }


        if (
            bitIndex < bits.length
        ) {

            throw new Error(
                "The Micro QR matrix contains insufficient " +
                "data modules. " +
                (bits.length - bitIndex) +
                " bits could not be placed."
            );
        }


        return matrix;
    }


    /* ========================================================
       DATA PLACEMENT ALIAS
       ======================================================== */

    static placeDataBits(
        matrix,
        bits
    ) {

        return MicroQRMatrix.placeData(
            matrix,
            bits
        );
    }


    /* ========================================================
       PLACE FORMAT INFORMATION
       ======================================================== */

    static placeFormatInformation(
        matrix,
        version,
        errorCorrection,
        mask
    ) {

        MicroQRMatrix.validateMatrix(
            matrix
        );


        const normalisedVersion =
            MicroQRMatrix.normaliseVersion(
                version
            );


        const level =
            MicroQRMatrix.normaliseErrorCorrection(
                normalisedVersion,
                errorCorrection
            );


        if (
            !Number.isInteger(mask) ||
            mask < 0 ||
            mask > 3
        ) {

            throw new RangeError(
                "Micro QR mask must be between 0 and 3."
            );
        }


        const formatBits =
            MicroQRMatrix.generateFormatInformation(
                normalisedVersion,
                level,
                mask
            );


        /*
         * Place the 15 format bits.
         *
         * Eight horizontal modules.
         */

        let index = 0;


        for (
            let column = 1;
            column <= 8;
            column++
        ) {

            MicroQRMatrix.setFunctionModule(
                matrix,
                8,
                column,
                formatBits[index] === "1"
            );

            index++;
        }


        /*
         * Seven vertical modules.
         */

        for (
            let row = 7;
            row >= 1;
            row--
        ) {

            MicroQRMatrix.setFunctionModule(
                matrix,
                row,
                8,
                formatBits[index] === "1"
            );

            index++;
        }


        return matrix;
    }


    /* ========================================================
       FORMAT ALIAS
       ======================================================== */

    static addFormatInformation(
        matrix,
        version,
        errorCorrection,
        mask
    ) {

        return MicroQRMatrix.placeFormatInformation(
            matrix,
            version,
            errorCorrection,
            mask
        );
    }


    /* ========================================================
       GENERATE FORMAT INFORMATION
       ======================================================== */

    static generateFormatInformation(
        version,
        errorCorrection,
        mask
    ) {

        const symbolNumber =
            MicroQRMatrix.getFormatSymbolNumber(
                version,
                errorCorrection
            );


        /*
         * Format payload:
         *
         *      symbol number : 3 bits
         *      mask number   : 2 bits
         *
         * Five information bits in total.
         */

        const data =
            (symbolNumber << 2) |
            mask;


        /*
         * BCH(15,5)
         *
         * Generator:
         *
         *      x^10 + x^8 + x^5 + x^4 +
         *      x^2 + x + 1
         *
         * Binary:
         *
         *      10100110111
         */

        const generator =
            0x537;


        let remainder =
            data << 10;


        while (
            MicroQRMatrix.bitLength(
                remainder
            ) >= 11
        ) {

            const shift =
                MicroQRMatrix.bitLength(
                    remainder
                ) - 11;


            remainder ^=
                generator << shift;
        }


        /*
         * Combine information bits and BCH remainder.
         */

        let format =
            (data << 10) |
            remainder;


        /*
         * Apply Micro QR format mask.
         */

        format ^=
            MicroQRMatrix.FORMAT_MASK;


        return format
            .toString(2)
            .padStart(15, "0");
    }


    /* ========================================================
       FORMAT SYMBOL NUMBER
       ======================================================== */

    static getFormatSymbolNumber(
        version,
        errorCorrection
    ) {

        const normalisedVersion =
            MicroQRMatrix.normaliseVersion(
                version
            );


        const level =
            MicroQRMatrix.normaliseErrorCorrection(
                normalisedVersion,
                errorCorrection
            );


        const definition =
            MicroQRMatrix.FORMAT_SYMBOL_NUMBER[
                normalisedVersion
            ];


        if (
            !definition ||
            definition[level] === undefined
        ) {

            throw new Error(
                "Unsupported Micro QR version / " +
                "error-correction combination: " +
                normalisedVersion +
                " " +
                level
            );
        }


        return definition[level];
    }


    /* ========================================================
       BIT LENGTH
       ======================================================== */

    static bitLength(value) {

        if (value === 0) {
            return 0;
        }


        return Math.floor(
            Math.log2(value)
        ) + 1;
    }


    /* ========================================================
       SET FUNCTION MODULE
       ======================================================== */

    static setFunctionModule(
        matrix,
        row,
        column,
        dark
    ) {

        if (
            !MicroQRMatrix.inBounds(
                matrix,
                row,
                column
            )
        ) {

            return;
        }


        MicroQRMatrix.ensureReservedMap(
            matrix
        );


        matrix[row][column] =
            Boolean(dark);


        matrix._reserved[row][column] =
            true;
    }


    /* ========================================================
       RESERVE MODULE
       ======================================================== */

    static reserveModule(
        matrix,
        row,
        column
    ) {

        if (
            !MicroQRMatrix.inBounds(
                matrix,
                row,
                column
            )
        ) {

            return;
        }


        MicroQRMatrix.ensureReservedMap(
            matrix
        );


        matrix._reserved[row][column] =
            true;


        /*
         * Keep the location explicitly unassigned until the
         * actual format information is known.
         */

        if (
            matrix[row][column] === undefined
        ) {

            matrix[row][column] =
                null;
        }
    }


    /* ========================================================
       RESERVED TEST
       ======================================================== */

    static isReserved(
        matrix,
        row,
        column
    ) {

        if (
            !MicroQRMatrix.inBounds(
                matrix,
                row,
                column
            )
        ) {

            return true;
        }


        if (
            matrix._reserved &&
            Array.isArray(
                matrix._reserved[row]
            )
        ) {

            return Boolean(
                matrix._reserved[row][column]
            );
        }


        /*
         * Structural fallback.
         */

        if (
            row <= 7 &&
            column <= 7
        ) {

            return true;
        }


        if (
            row === 0 ||
            column === 0
        ) {

            return true;
        }


        if (
            row === 8 &&
            column >= 1 &&
            column <= 8
        ) {

            return true;
        }


        if (
            column === 8 &&
            row >= 1 &&
            row <= 7
        ) {

            return true;
        }


        return false;
    }


    /* ========================================================
       GET RESERVED MAP
       ======================================================== */

    static getReservedMap(matrix) {

        MicroQRMatrix.validateMatrix(
            matrix
        );


        MicroQRMatrix.ensureReservedMap(
            matrix
        );


        return matrix._reserved.map(
            row =>
                row.slice()
        );
    }


    /* ========================================================
       ENSURE RESERVED MAP
       ======================================================== */

    static ensureReservedMap(matrix) {

        if (
            matrix._reserved &&
            Array.isArray(matrix._reserved)
        ) {

            return;
        }


        Object.defineProperty(
            matrix,
            "_reserved",
            {
                value:
                    MicroQRMatrix.createReservedMap(
                        matrix.length
                    ),

                writable: true,
                enumerable: false
            }
        );
    }


    /* ========================================================
       ENSURE METADATA
       ======================================================== */

    static ensureMetadata(
        matrix,
        version
    ) {

        MicroQRMatrix.ensureReservedMap(
            matrix
        );


        if (
            !Object.prototype.hasOwnProperty.call(
                matrix,
                "_microQRVersion"
            )
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

        } else {

            matrix._microQRVersion =
                version;
        }
    }


    /* ========================================================
       GET MATRIX
       ======================================================== */

    static getMatrix(matrix) {

        MicroQRMatrix.validateMatrix(
            matrix
        );


        return matrix.map(
            row =>
                row.slice()
        );
    }


    /* ========================================================
       CLONE MATRIX
       ======================================================== */

    static clone(matrix) {

        MicroQRMatrix.validateMatrix(
            matrix
        );


        const clone =
            matrix.map(
                row =>
                    row.slice()
            );


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


        if (matrix._reserved) {

            Object.defineProperty(
                clone,
                "_reserved",
                {
                    value:
                        matrix._reserved.map(
                            row =>
                                row.slice()
                        ),

                    writable: true,
                    enumerable: false
                }
            );
        }


        return clone;
    }


    /* ========================================================
       IN BOUNDS
       ======================================================== */

    static inBounds(
        matrix,
        row,
        column
    ) {

        return (
            row >= 0 &&
            column >= 0 &&
            row < matrix.length &&
            column < matrix.length
        );
    }


    /* ========================================================
       VERSION FROM MATRIX SIZE
       ======================================================== */

    static versionFromSize(size) {

        switch (size) {

            case 11:
                return "M1";

            case 13:
                return "M2";

            case 15:
                return "M3";

            case 17:
                return "M4";

            default:

                throw new Error(
                    "Invalid Micro QR matrix size: " +
                    size
                );
        }
    }


    /* ========================================================
       NORMALISE VERSION
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
       NORMALISE ERROR CORRECTION
       ======================================================== */

    static normaliseErrorCorrection(
        version,
        level
    ) {

        const normalisedVersion =
            MicroQRMatrix.normaliseVersion(
                version
            );


        if (normalisedVersion === "M1") {

            return "NONE";
        }


        const value =
            String(level || "M")
            .trim()
            .toUpperCase();


        const definition =
            MicroQRMatrix.FORMAT_SYMBOL_NUMBER[
                normalisedVersion
            ];


        if (
            !definition ||
            definition[value] === undefined
        ) {

            throw new Error(
                normalisedVersion +
                " does not support Micro QR error " +
                "correction level " +
                value +
                "."
            );
        }


        return value;
    }


    /* ========================================================
       VALIDATE MATRIX
       ======================================================== */

    static validateMatrix(matrix) {

        if (
            !Array.isArray(matrix) ||
            matrix.length === 0
        ) {

            throw new TypeError(
                "Micro QR matrix must be a " +
                "non-empty array."
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


        for (
            let row = 0;
            row < size;
            row++
        ) {

            if (
                !Array.isArray(matrix[row]) ||
                matrix[row].length !== size
            ) {

                throw new Error(
                    "Micro QR matrix must be square."
                );
            }
        }


        return true;
    }


    /* ========================================================
       DEBUG MATRIX STRING
       ======================================================== */

    static toString(matrix) {

        MicroQRMatrix.validateMatrix(
            matrix
        );


        return matrix
            .map(
                row =>
                    row
                        .map(
                            value => {

                                if (value === true) {
                                    return "██";
                                }

                                if (value === false) {
                                    return "  ";
                                }

                                return "··";
                            }
                        )
                        .join("")
            )
            .join("\n");
    }
}