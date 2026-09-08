/**
 * ============================================================
 * PDF417Matrix.js
 * ============================================================
 *
 * Constructs the final module matrix for a PDF417 symbol.
 *
 * Each physical PDF417 row contains:
 *
 *   START
 *   LEFT ROW INDICATOR
 *   DATA CODEWORDS
 *   RIGHT ROW INDICATOR
 *   STOP
 *
 * A normal codeword occupies 17 modules.
 * The start pattern occupies 17 modules.
 * The stop pattern occupies 18 modules.
 *
 * IMPORTANT:
 *
 * PDF417Codeword.getPattern(value, cluster) must provide the
 * official 17-module PDF417 symbol pattern for the requested
 * codeword and cluster.
 *
 * ============================================================
 */

class PDF417Matrix {

    static START_PATTERN = 0x1FEA8;
    static STOP_PATTERN  = 0x3FA29;

    static START_WIDTH = 17;
    static STOP_WIDTH = 18;
    static CODEWORD_WIDTH = 17;

    static MIN_ROWS = 3;
    static MAX_ROWS = 90;

    static MIN_COLUMNS = 1;
    static MAX_COLUMNS = 30;


    /* ========================================================
       PUBLIC BUILD
       ======================================================== */

    static build(
        codewords,
        rows,
        columns,
        errorCorrectionLevel
    ) {

        PDF417Matrix.validateArguments(
            codewords,
            rows,
            columns,
            errorCorrectionLevel
        );

        const expected =
            rows * columns;

        if (codewords.length !== expected) {

            throw new Error(
                "PDF417 matrix expected " +
                expected +
                " codewords but received " +
                codewords.length +
                "."
            );
        }

        const matrix = [];

        let codewordIndex = 0;

        for (
            let row = 0;
            row < rows;
            row++
        ) {

            const rowCodewords =
                codewords.slice(
                    codewordIndex,
                    codewordIndex + columns
                );

            codewordIndex += columns;

            matrix.push(
                PDF417Matrix.buildRow(
                    row,
                    rows,
                    columns,
                    errorCorrectionLevel,
                    rowCodewords
                )
            );
        }

        PDF417Matrix.validateMatrix(
            matrix,
            rows,
            columns
        );

        return matrix;
    }


    /* ========================================================
       CREATE ALIAS
       ======================================================== */

    static create(
        codewords,
        rows,
        columns,
        errorCorrectionLevel
    ) {

        return PDF417Matrix.build(
            codewords,
            rows,
            columns,
            errorCorrectionLevel
        );
    }


    /* ========================================================
       GENERATE ALIAS
       ======================================================== */

    static generate(
        codewords,
        rows,
        columns,
        errorCorrectionLevel
    ) {

        return PDF417Matrix.build(
            codewords,
            rows,
            columns,
            errorCorrectionLevel
        );
    }


    /* ========================================================
       BUILD ONE PDF417 ROW
       ======================================================== */

    static buildRow(
        rowNumber,
        rowCount,
        columnCount,
        errorCorrectionLevel,
        dataCodewords
    ) {

        const cluster =
            rowNumber % 3;

        const modules = [];


        /* ----------------------------------------------------
           START PATTERN
           ---------------------------------------------------- */

        PDF417Matrix.appendPattern(
            modules,
            PDF417Matrix.START_PATTERN,
            PDF417Matrix.START_WIDTH
        );


        /* ----------------------------------------------------
           LEFT ROW INDICATOR
           ---------------------------------------------------- */

        const leftIndicator =
            PDF417Matrix.getLeftRowIndicator(
                rowNumber,
                rowCount,
                columnCount,
                errorCorrectionLevel
            );

        PDF417Matrix.appendCodeword(
            modules,
            leftIndicator,
            cluster
        );


        /* ----------------------------------------------------
           DATA / ECC CODEWORDS
           ---------------------------------------------------- */

        for (
            let index = 0;
            index < dataCodewords.length;
            index++
        ) {

            PDF417Matrix.appendCodeword(
                modules,
                dataCodewords[index],
                cluster
            );
        }


        /* ----------------------------------------------------
           RIGHT ROW INDICATOR
           ---------------------------------------------------- */

        const rightIndicator =
            PDF417Matrix.getRightRowIndicator(
                rowNumber,
                rowCount,
                columnCount,
                errorCorrectionLevel
            );

        PDF417Matrix.appendCodeword(
            modules,
            rightIndicator,
            cluster
        );


        /* ----------------------------------------------------
           STOP PATTERN
           ---------------------------------------------------- */

        PDF417Matrix.appendPattern(
            modules,
            PDF417Matrix.STOP_PATTERN,
            PDF417Matrix.STOP_WIDTH
        );


        return modules;
    }


    /* ========================================================
       APPEND CODEWORD
       ======================================================== */

    static appendCodeword(
        row,
        value,
        cluster
    ) {

        if (
            !Number.isInteger(value) ||
            value < 0 ||
            value > 928
        ) {

            throw new RangeError(
                "Invalid PDF417 codeword: " +
                value
            );
        }


        if (
            !Number.isInteger(cluster) ||
            cluster < 0 ||
            cluster > 2
        ) {

            throw new RangeError(
                "PDF417 cluster must be 0, 1 or 2."
            );
        }


        if (
            typeof PDF417Codeword ===
            "undefined"
        ) {

            throw new Error(
                "PDF417Codeword is not loaded."
            );
        }


        if (
            typeof PDF417Codeword.getPattern !==
            "function"
        ) {

            throw new Error(
                "PDF417Codeword.getPattern() is required. " +
                "It must contain the official PDF417 " +
                "three-cluster symbol table."
            );
        }


        const pattern =
            PDF417Codeword.getPattern(
                value,
                cluster
            );


        PDF417Matrix.appendPattern(
            row,
            pattern,
            PDF417Matrix.CODEWORD_WIDTH
        );
    }


    /* ========================================================
       APPEND BIT PATTERN
       ======================================================== */

    static appendPattern(
        target,
        pattern,
        width
    ) {

        if (!Array.isArray(target)) {

            throw new TypeError(
                "PDF417 matrix target must be an array."
            );
        }


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
            width < 1
        ) {

            throw new TypeError(
                "PDF417 pattern width must be positive."
            );
        }


        for (
            let bit = width - 1;
            bit >= 0;
            bit--
        ) {

            target.push(
                (
                    pattern &
                    (1 << bit)
                ) !== 0
                    ? 1
                    : 0
            );
        }
    }


    /* ========================================================
       LEFT ROW INDICATOR
       ======================================================== */

    static getLeftRowIndicator(
        row,
        rows,
        columns,
        errorCorrectionLevel
    ) {

        const cluster =
            row % 3;

        const rowGroup =
            Math.floor(
                row / 3
            );


        switch (cluster) {

            case 0:

                return (
                    30 * rowGroup +
                    Math.floor(
                        (rows - 1) / 3
                    )
                );


            case 1:

                return (
                    30 * rowGroup +
                    (
                        errorCorrectionLevel * 3
                    ) +
                    (
                        (rows - 1) % 3
                    )
                );


            case 2:

                return (
                    30 * rowGroup +
                    (
                        columns - 1
                    )
                );


            default:

                throw new Error(
                    "Invalid PDF417 cluster."
                );
        }
    }


    /* ========================================================
       RIGHT ROW INDICATOR
       ======================================================== */

    static getRightRowIndicator(
        row,
        rows,
        columns,
        errorCorrectionLevel
    ) {

        const cluster =
            row % 3;

        const rowGroup =
            Math.floor(
                row / 3
            );


        switch (cluster) {

            case 0:

                return (
                    30 * rowGroup +
                    (
                        columns - 1
                    )
                );


            case 1:

                return (
                    30 * rowGroup +
                    Math.floor(
                        (rows - 1) / 3
                    )
                );


            case 2:

                return (
                    30 * rowGroup +
                    (
                        errorCorrectionLevel * 3
                    ) +
                    (
                        (rows - 1) % 3
                    )
                );


            default:

                throw new Error(
                    "Invalid PDF417 cluster."
                );
        }
    }


    /* ========================================================
       EXPECTED PHYSICAL WIDTH
       ======================================================== */

    static getExpectedWidth(
        columns
    ) {

        /*
         * Start                17
         * Left indicator       17
         * Data              C × 17
         * Right indicator      17
         * Stop                 18
         */

        return (
            PDF417Matrix.START_WIDTH +
            PDF417Matrix.CODEWORD_WIDTH +
            (
                columns *
                PDF417Matrix.CODEWORD_WIDTH
            ) +
            PDF417Matrix.CODEWORD_WIDTH +
            PDF417Matrix.STOP_WIDTH
        );
    }


    /* ========================================================
       ARGUMENT VALIDATION
       ======================================================== */

    static validateArguments(
        codewords,
        rows,
        columns,
        errorCorrectionLevel
    ) {

        if (!Array.isArray(codewords)) {

            throw new TypeError(
                "PDF417 codewords must be an array."
            );
        }


        if (
            !Number.isInteger(rows) ||
            rows < PDF417Matrix.MIN_ROWS ||
            rows > PDF417Matrix.MAX_ROWS
        ) {

            throw new RangeError(
                "PDF417 rows must be between 3 and 90."
            );
        }


        if (
            !Number.isInteger(columns) ||
            columns < PDF417Matrix.MIN_COLUMNS ||
            columns > PDF417Matrix.MAX_COLUMNS
        ) {

            throw new RangeError(
                "PDF417 columns must be between 1 and 30."
            );
        }


        if (
            !Number.isInteger(
                errorCorrectionLevel
            ) ||
            errorCorrectionLevel < 0 ||
            errorCorrectionLevel > 8
        ) {

            throw new RangeError(
                "PDF417 error-correction level must " +
                "be between 0 and 8."
            );
        }


        for (
            let index = 0;
            index < codewords.length;
            index++
        ) {

            const value =
                codewords[index];


            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value > 928
            ) {

                throw new RangeError(
                    "Invalid PDF417 codeword at index " +
                    index +
                    ": " +
                    value
                );
            }
        }


        return true;
    }


    /* ========================================================
       MATRIX VALIDATION
       ======================================================== */

    static validateMatrix(
        matrix,
        rows,
        columns
    ) {

        if (
            !Array.isArray(matrix) ||
            matrix.length !== rows
        ) {

            throw new Error(
                "Invalid PDF417 matrix height."
            );
        }


        const expectedWidth =
            PDF417Matrix.getExpectedWidth(
                columns
            );


        for (
            let row = 0;
            row < matrix.length;
            row++
        ) {

            if (
                !Array.isArray(
                    matrix[row]
                )
            ) {

                throw new Error(
                    "PDF417 matrix row " +
                    row +
                    " is invalid."
                );
            }


            if (
                matrix[row].length !==
                expectedWidth
            ) {

                throw new Error(
                    "PDF417 matrix row " +
                    row +
                    " has width " +
                    matrix[row].length +
                    "; expected " +
                    expectedWidth +
                    "."
                );
            }


            for (
                let column = 0;
                column < expectedWidth;
                column++
            ) {

                const module =
                    matrix[row][column];


                if (
                    module !== 0 &&
                    module !== 1 &&
                    module !== false &&
                    module !== true
                ) {

                    throw new Error(
                        "Invalid PDF417 module at " +
                        row +
                        "," +
                        column +
                        "."
                    );
                }
            }
        }


        return true;
    }


    /* ========================================================
       MATRIX WIDTH
       ======================================================== */

    static getWidth(
        matrix
    ) {

        if (
            !Array.isArray(matrix) ||
            matrix.length === 0
        ) {

            return 0;
        }


        return matrix[0].length;
    }


    /* ========================================================
       MATRIX HEIGHT
       ======================================================== */

    static getHeight(
        matrix
    ) {

        if (!Array.isArray(matrix)) {
            return 0;
        }


        return matrix.length;
    }


    /* ========================================================
       BOOLEAN MATRIX
       ======================================================== */

    static toBooleanMatrix(
        matrix
    ) {

        return matrix.map(
            row =>
                row.map(
                    value =>
                        Boolean(value)
                )
        );
    }


    /* ========================================================
       DEBUG STRING
       ======================================================== */

    static toString(
        matrix,
        dark = "██",
        light = "  "
    ) {

        if (!Array.isArray(matrix)) {
            return "";
        }


        return matrix
            .map(
                row =>
                    row
                        .map(
                            module =>
                                module
                                    ? dark
                                    : light
                        )
                        .join("")
            )
            .join("\n");
    }
}