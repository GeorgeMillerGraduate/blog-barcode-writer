/**
 * ============================================================
 * PDF417Codeword.js
 * ============================================================
 *
 * Utility class for PDF417 codewords.
 *
 * Responsibilities:
 *  - Validate codeword values
 *  - Define PDF417 control codewords
 *  - Convert values to/from base 900
 *  - Provide row indicator calculations
 *  - Provide symbol capacity helpers
 *  - Retrieve bar patterns from PDF417CodewordTable
 *
 * The actual 3 × 929 PDF417 symbol table is stored in:
 *
 *     PDF417CodewordTable.js
 *
 * ============================================================
 */

class PDF417Codeword {

    /* ========================================================
       CONSTANTS
       ======================================================== */

    static BASE = 900;

    static MIN_VALUE = 0;
    static MAX_VALUE = 928;

    static DATA_MAX_VALUE = 899;

    static CLUSTER_COUNT = 3;

    static START_PATTERN = 0x1FEA8;
    static STOP_PATTERN = 0x3FA29;

    static CODEWORD_WIDTH = 17;
    static START_WIDTH = 17;
    static STOP_WIDTH = 18;


    /* ========================================================
       CONTROL CODEWORDS
       ======================================================== */

    static TEXT_COMPACTION = 900;

    static BYTE_COMPACTION = 901;

    static NUMERIC_COMPACTION = 902;

    static BYTE_SHIFT = 913;

    static MACRO_PDF417_TERMINATOR = 922;

    static MACRO_PDF417_OPTIONAL_FIELD = 923;

    static BYTE_COMPACTION_6 = 924;

    static ECI_USER_DEFINED = 925;

    static ECI_GENERAL_PURPOSE = 926;

    static ECI_CHARSET = 927;

    static MACRO_PDF417_CONTROL_BLOCK = 928;


    /* ========================================================
       CREATE
       ======================================================== */

    static create(value) {

        PDF417Codeword.validate(value);

        return value;
    }


    /* ========================================================
       VALIDATE CODEWORD
       ======================================================== */

    static validate(value) {

        if (!Number.isInteger(value)) {

            throw new TypeError(
                "PDF417 codeword must be an integer."
            );
        }

        if (
            value < PDF417Codeword.MIN_VALUE ||
            value > PDF417Codeword.MAX_VALUE
        ) {

            throw new RangeError(
                "PDF417 codeword must be between 0 and 928. " +
                "Received: " +
                value
            );
        }

        return true;
    }


    /* ========================================================
       IS VALID
       ======================================================== */

    static isValid(value) {

        return (
            Number.isInteger(value) &&
            value >= PDF417Codeword.MIN_VALUE &&
            value <= PDF417Codeword.MAX_VALUE
        );
    }


    /* ========================================================
       VALIDATE DATA CODEWORD
       ======================================================== */

    static validateData(value) {

        if (!Number.isInteger(value)) {

            throw new TypeError(
                "PDF417 data codeword must be an integer."
            );
        }

        if (
            value < 0 ||
            value > PDF417Codeword.DATA_MAX_VALUE
        ) {

            throw new RangeError(
                "PDF417 data codeword must be between " +
                "0 and 899. Received: " +
                value
            );
        }

        return true;
    }


    /* ========================================================
       VALIDATE ARRAY
       ======================================================== */

    static validateArray(
        codewords,
        allowControl = true
    ) {

        if (!Array.isArray(codewords)) {

            throw new TypeError(
                "PDF417 codewords must be an array."
            );
        }

        for (
            let index = 0;
            index < codewords.length;
            index++
        ) {

            try {

                if (allowControl) {

                    PDF417Codeword.validate(
                        codewords[index]
                    );

                } else {

                    PDF417Codeword.validateData(
                        codewords[index]
                    );
                }

            } catch (error) {

                throw new Error(
                    "Invalid PDF417 codeword at index " +
                    index +
                    ": " +
                    error.message
                );
            }
        }

        return true;
    }


    /* ========================================================
       DATA / CONTROL TESTS
       ======================================================== */

    static isData(value) {

        return (
            Number.isInteger(value) &&
            value >= 0 &&
            value <= 899
        );
    }


    static isControl(value) {

        return (
            Number.isInteger(value) &&
            value >= 900 &&
            value <= 928
        );
    }


    static isModeLatch(value) {

        return (
            value === PDF417Codeword.TEXT_COMPACTION ||
            value === PDF417Codeword.BYTE_COMPACTION ||
            value === PDF417Codeword.NUMERIC_COMPACTION ||
            value === PDF417Codeword.BYTE_COMPACTION_6
        );
    }


    static isECI(value) {

        return (
            value === PDF417Codeword.ECI_USER_DEFINED ||
            value === PDF417Codeword.ECI_GENERAL_PURPOSE ||
            value === PDF417Codeword.ECI_CHARSET
        );
    }


    /* ========================================================
       CODEWORD TYPE
       ======================================================== */

    static getType(value) {

        PDF417Codeword.validate(value);

        if (value < 900) {
            return "data";
        }

        switch (value) {

            case 900:
                return "text-latch";

            case 901:
                return "byte-latch";

            case 902:
                return "numeric-latch";

            case 913:
                return "byte-shift";

            case 922:
                return "macro-terminator";

            case 923:
                return "macro-optional-field";

            case 924:
                return "byte-latch-6";

            case 925:
                return "eci-user-defined";

            case 926:
                return "eci-general-purpose";

            case 927:
                return "eci-charset";

            case 928:
                return "macro-control-block";

            default:
                return "control";
        }
    }


    /* ========================================================
       GET SYMBOL PATTERN
       ======================================================== */

    static getPattern(
        codeword,
        cluster
    ) {

        PDF417Codeword.validate(
            codeword
        );

        if (
            typeof PDF417CodewordTable ===
            "undefined"
        ) {

            throw new Error(
                "PDF417CodewordTable is not loaded. " +
                "Load PDF417CodewordTable.js before " +
                "PDF417Codeword.js."
            );
        }

        if (
            typeof PDF417CodewordTable.getPattern !==
            "function"
        ) {

            throw new Error(
                "PDF417CodewordTable.getPattern() " +
                "is not available."
            );
        }

        return PDF417CodewordTable.getPattern(
            codeword,
            cluster
        );
    }


    /* ========================================================
       GET CODEWORD BITS
       ======================================================== */

    static getBits(
        codeword,
        cluster
    ) {

        const pattern =
            PDF417Codeword.getPattern(
                codeword,
                cluster
            );

        return PDF417Codeword.patternToBits(
            pattern,
            PDF417Codeword.CODEWORD_WIDTH
        );
    }


    /* ========================================================
       PATTERN TO BITS
       ======================================================== */

    static patternToBits(
        pattern,
        width = 17
    ) {

        if (
            !Number.isInteger(pattern) ||
            pattern < 0
        ) {

            throw new TypeError(
                "PDF417 pattern must be a non-negative integer."
            );
        }

        if (
            !Number.isInteger(width) ||
            width < 1 ||
            width > 31
        ) {

            throw new RangeError(
                "PDF417 pattern width must be between 1 and 31."
            );
        }

        const bits = [];

        for (
            let bit = width - 1;
            bit >= 0;
            bit--
        ) {

            bits.push(
                (
                    pattern &
                    (1 << bit)
                ) !== 0
                    ? 1
                    : 0
            );
        }

        return bits;
    }


    /* ========================================================
       START / STOP PATTERNS
       ======================================================== */

    static getStartPattern() {

        return PDF417Codeword.START_PATTERN;
    }


    static getStopPattern() {

        return PDF417Codeword.STOP_PATTERN;
    }


    static getStartBits() {

        return PDF417Codeword.patternToBits(
            PDF417Codeword.START_PATTERN,
            PDF417Codeword.START_WIDTH
        );
    }


    static getStopBits() {

        return PDF417Codeword.patternToBits(
            PDF417Codeword.STOP_PATTERN,
            PDF417Codeword.STOP_WIDTH
        );
    }


    /* ========================================================
       BASE 900 ENCODING
       ======================================================== */

    static toBase900(value) {

        if (
            typeof value !== "bigint" &&
            (
                !Number.isSafeInteger(value) ||
                value < 0
            )
        ) {

            throw new TypeError(
                "Value must be a non-negative safe integer " +
                "or BigInt."
            );
        }

        let number =
            typeof value === "bigint"
                ? value
                : BigInt(value);

        if (number < 0n) {

            throw new RangeError(
                "Cannot convert a negative value to base 900."
            );
        }

        if (number === 0n) {
            return [0];
        }

        const result = [];

        while (number > 0n) {

            result.unshift(
                Number(
                    number % 900n
                )
            );

            number /= 900n;
        }

        return result;
    }


    /* ========================================================
       BASE 900 DECODING
       ======================================================== */

    static fromBase900(codewords) {

        PDF417Codeword.validateArray(
            codewords,
            false
        );

        let result = 0n;

        for (const codeword of codewords) {

            result =
                result * 900n +
                BigInt(codeword);
        }

        return result;
    }


    static base900ToString(codewords) {

        return PDF417Codeword
            .fromBase900(codewords)
            .toString();
    }


    /* ========================================================
       PADDING
       ======================================================== */

    static pad(
        codewords,
        targetLength,
        padCodeword = 900
    ) {

        PDF417Codeword.validateArray(
            codewords
        );

        PDF417Codeword.validate(
            padCodeword
        );

        if (
            !Number.isInteger(targetLength) ||
            targetLength < 0
        ) {

            throw new TypeError(
                "Target length must be a non-negative integer."
            );
        }

        if (
            codewords.length >
            targetLength
        ) {

            throw new Error(
                "PDF417 codeword array exceeds target length."
            );
        }

        const result =
            codewords.slice();

        while (
            result.length <
            targetLength
        ) {

            result.push(
                padCodeword
            );
        }

        return result;
    }


    /* ========================================================
       ROW CLUSTER
       ======================================================== */

    static getCluster(row) {

        if (
            !Number.isInteger(row) ||
            row < 0
        ) {

            throw new TypeError(
                "PDF417 row must be a non-negative integer."
            );
        }

        return (
            row %
            PDF417Codeword.CLUSTER_COUNT
        );
    }


    /* ========================================================
       SPECIFICATION CLUSTER
       ======================================================== */

    static getSpecificationCluster(row) {

        return (
            PDF417Codeword.getCluster(row) *
            3
        );
    }


    /* ========================================================
       LEFT ROW INDICATOR
       ======================================================== */

    static getLeftRowIndicator(
        row,
        rowCount,
        columnCount,
        errorCorrectionLevel
    ) {

        PDF417Codeword.validateDimensions(
            row,
            rowCount,
            columnCount,
            errorCorrectionLevel
        );

        const cluster =
            row % 3;

        const rowGroup =
            Math.floor(
                row / 3
            );

        let value;

        switch (cluster) {

            case 0:

                value =
                    30 * rowGroup +
                    Math.floor(
                        (rowCount - 1) / 3
                    );

                break;


            case 1:

                value =
                    30 * rowGroup +
                    (
                        errorCorrectionLevel * 3
                    ) +
                    (
                        (rowCount - 1) % 3
                    );

                break;


            case 2:

                value =
                    30 * rowGroup +
                    (
                        columnCount - 1
                    );

                break;


            default:

                throw new Error(
                    "Invalid PDF417 row cluster."
                );
        }

        PDF417Codeword.validate(
            value
        );

        return value;
    }


    /* ========================================================
       RIGHT ROW INDICATOR
       ======================================================== */

    static getRightRowIndicator(
        row,
        rowCount,
        columnCount,
        errorCorrectionLevel
    ) {

        PDF417Codeword.validateDimensions(
            row,
            rowCount,
            columnCount,
            errorCorrectionLevel
        );

        const cluster =
            row % 3;

        const rowGroup =
            Math.floor(
                row / 3
            );

        let value;

        switch (cluster) {

            case 0:

                value =
                    30 * rowGroup +
                    (
                        columnCount - 1
                    );

                break;


            case 1:

                value =
                    30 * rowGroup +
                    Math.floor(
                        (rowCount - 1) / 3
                    );

                break;


            case 2:

                value =
                    30 * rowGroup +
                    (
                        errorCorrectionLevel * 3
                    ) +
                    (
                        (rowCount - 1) % 3
                    );

                break;


            default:

                throw new Error(
                    "Invalid PDF417 row cluster."
                );
        }

        PDF417Codeword.validate(
            value
        );

        return value;
    }


    /* ========================================================
       DIMENSION VALIDATION
       ======================================================== */

    static validateDimensions(
        row,
        rowCount,
        columnCount,
        errorCorrectionLevel
    ) {

        if (
            !Number.isInteger(rowCount) ||
            rowCount < 3 ||
            rowCount > 90
        ) {

            throw new RangeError(
                "PDF417 row count must be between 3 and 90."
            );
        }

        if (
            !Number.isInteger(columnCount) ||
            columnCount < 1 ||
            columnCount > 30
        ) {

            throw new RangeError(
                "PDF417 column count must be between 1 and 30."
            );
        }

        if (
            !Number.isInteger(row) ||
            row < 0 ||
            row >= rowCount
        ) {

            throw new RangeError(
                "PDF417 row index is outside the symbol."
            );
        }

        if (
            !Number.isInteger(errorCorrectionLevel) ||
            errorCorrectionLevel < 0 ||
            errorCorrectionLevel > 8
        ) {

            throw new RangeError(
                "PDF417 error-correction level must be " +
                "between 0 and 8."
            );
        }

        return true;
    }


    /* ========================================================
       ECC CODEWORD COUNT
       ======================================================== */

    static getErrorCorrectionCodewordCount(level) {

        if (
            !Number.isInteger(level) ||
            level < 0 ||
            level > 8
        ) {

            throw new RangeError(
                "PDF417 error-correction level must be " +
                "between 0 and 8."
            );
        }

        return (
            1 <<
            (level + 1)
        );
    }


    /* ========================================================
       SYMBOL CAPACITY
       ======================================================== */

    static getSymbolCapacity(
        rows,
        columns
    ) {

        if (
            !Number.isInteger(rows) ||
            rows < 3 ||
            rows > 90
        ) {

            throw new RangeError(
                "PDF417 rows must be between 3 and 90."
            );
        }

        if (
            !Number.isInteger(columns) ||
            columns < 1 ||
            columns > 30
        ) {

            throw new RangeError(
                "PDF417 columns must be between 1 and 30."
            );
        }

        return (
            rows *
            columns
        );
    }


    /* ========================================================
       DATA CAPACITY
       ======================================================== */

    static getDataCapacity(
        rows,
        columns,
        errorCorrectionLevel
    ) {

        const total =
            PDF417Codeword.getSymbolCapacity(
                rows,
                columns
            );

        const ecc =
            PDF417Codeword
                .getErrorCorrectionCodewordCount(
                    errorCorrectionLevel
                );

        /*
         * Excludes:
         *
         *  - ECC codewords
         *  - Symbol Length Descriptor
         */

        return (
            total -
            ecc -
            1
        );
    }


    /* ========================================================
       LENGTH DESCRIPTOR
       ======================================================== */

    static createLengthDescriptor(
        dataCodewordCount,
        paddingCodewordCount = 0
    ) {

        if (
            !Number.isInteger(dataCodewordCount) ||
            dataCodewordCount < 0
        ) {

            throw new TypeError(
                "Data codeword count must be a " +
                "non-negative integer."
            );
        }

        if (
            !Number.isInteger(paddingCodewordCount) ||
            paddingCodewordCount < 0
        ) {

            throw new TypeError(
                "Padding codeword count must be a " +
                "non-negative integer."
            );
        }

        const descriptor =
            1 +
            dataCodewordCount +
            paddingCodewordCount;

        if (
            descriptor < 1 ||
            descriptor > 928
        ) {

            throw new RangeError(
                "PDF417 Symbol Length Descriptor " +
                "must be between 1 and 928."
            );
        }

        return descriptor;
    }


    /* ========================================================
       CLONE
       ======================================================== */

    static clone(codewords) {

        PDF417Codeword.validateArray(
            codewords
        );

        return codewords.slice();
    }


    /* ========================================================
       VALIDATE SYMBOL TABLE
       ======================================================== */

    static validateSymbolTable() {

        if (
            typeof PDF417CodewordTable ===
            "undefined"
        ) {

            throw new Error(
                "PDF417CodewordTable is not loaded."
            );
        }

        if (
            typeof PDF417CodewordTable.validate ===
            "function"
        ) {

            return PDF417CodewordTable.validate();
        }

        throw new Error(
            "PDF417CodewordTable.validate() is unavailable."
        );
    }


    /* ========================================================
       DEBUG DESCRIPTION
       ======================================================== */

    static describe(value) {

        PDF417Codeword.validate(
            value
        );

        return {

            value:
                value,

            type:
                PDF417Codeword.getType(
                    value
                ),

            dataCodeword:
                PDF417Codeword.isData(
                    value
                ),

            controlCodeword:
                PDF417Codeword.isControl(
                    value
                )
        };
    }
}