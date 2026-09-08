/**
 * ============================================================
 * QR MATRIX
 * ============================================================
 *
 * Builds the physical matrix for standard QR Codes
 * Versions 1-40.
 *
 * Responsibilities:
 *
 *  - Create the QR module grid
 *  - Track reserved/function modules
 *  - Place finder patterns and separators
 *  - Place timing patterns
 *  - Place alignment patterns
 *  - Reserve format information
 *  - Reserve Version 7+ information
 *  - Place the fixed dark module
 *  - Place encoded data using the QR zig-zag pattern
 *  - Support cloning for mask evaluation
 *
 * ============================================================
 */

class QRMatrix {

    constructor(version) {

        QRMatrix.validateVersion(version);

        this.version = version;

        this.size =
            17 + (4 * version);

        this.matrix =
            QRMatrix.create2DArray(
                this.size,
                null
            );

        this.reserved =
            QRMatrix.create2DArray(
                this.size,
                false
            );

        /*
         * Alias used by QRMask.
         */

        this.functionModules =
            this.reserved;

        this.functionPatternsPlaced =
            false;

        this.dataBitsPlaced =
            0;
    }


    /* ========================================================
       FACTORY
       ======================================================== */

    static create(version) {

        return new QRMatrix(version);
    }


    /* ========================================================
       STATIC FUNCTION-PATTERN INTERFACE
       ======================================================== */

    static placeFunctionPatterns(
        matrix,
        version = null
    ) {

        if (!(matrix instanceof QRMatrix)) {

            throw new TypeError(
                "QRMatrix.placeFunctionPatterns() requires a QRMatrix instance."
            );
        }

        matrix.placeFunctionPatterns();

        return matrix;
    }


    /* ========================================================
       PLACE ALL FUNCTION PATTERNS
       ======================================================== */

    placeFunctionPatterns() {

        if (this.functionPatternsPlaced) {

            return this;
        }


        /*
         * Three finder patterns.
         */

        this.placeFinderPattern(
            0,
            0
        );

        this.placeFinderPattern(
            0,
            this.size - 7
        );

        this.placeFinderPattern(
            this.size - 7,
            0
        );


        /*
         * Alignment patterns.
         */

        this.placeAlignmentPatterns();


        /*
         * Timing patterns.
         */

        this.placeTimingPatterns();


        /*
         * Format information areas.
         */

        this.reserveFormatInformation();


        /*
         * Version information for Versions 7-40.
         */

        if (this.version >= 7) {

            this.reserveVersionInformation();
        }


        /*
         * Fixed dark module.
         */

        this.placeDarkModule();


        this.functionPatternsPlaced =
            true;


        return this;
    }


    /* ========================================================
       FINDER PATTERN
       ======================================================== */

    placeFinderPattern(
        top,
        left
    ) {

        /*
         * Finder pattern:
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


                this.setFunctionModule(
                    top + row,
                    left + column,
                    outer || centre ? 1 : 0
                );
            }
        }


        /*
         * Finder separator.
         *
         * A one-module white border surrounds each finder
         * wherever that border lies inside the symbol.
         */

        for (
            let row = -1;
            row <= 7;
            row++
        ) {

            for (
                let column = -1;
                column <= 7;
                column++
            ) {

                const absoluteRow =
                    top + row;

                const absoluteColumn =
                    left + column;


                if (
                    !this.isInside(
                        absoluteRow,
                        absoluteColumn
                    )
                ) {

                    continue;
                }


                /*
                 * Skip the 7x7 finder itself.
                 */

                if (
                    row >= 0 &&
                    row <= 6 &&
                    column >= 0 &&
                    column <= 6
                ) {

                    continue;
                }


                this.setFunctionModule(
                    absoluteRow,
                    absoluteColumn,
                    0
                );
            }
        }
    }


    /* ========================================================
       TIMING PATTERNS
       ======================================================== */

    placeTimingPatterns() {

        /*
         * Timing patterns occupy row 6 and column 6 between
         * the finder regions.
         */

        for (
            let position = 8;
            position <= this.size - 9;
            position++
        ) {

            const value =
                position % 2 === 0
                    ? 1
                    : 0;


            if (
                !this.reserved[6][position]
            ) {

                this.setFunctionModule(
                    6,
                    position,
                    value
                );
            }


            if (
                !this.reserved[position][6]
            ) {

                this.setFunctionModule(
                    position,
                    6,
                    value
                );
            }
        }
    }


    /* ========================================================
       ALIGNMENT PATTERNS
       ======================================================== */

    placeAlignmentPatterns() {

        const positions =
            QRMatrix.getAlignmentPatternPositions(
                this.version
            );


        for (
            let rowIndex = 0;
            rowIndex < positions.length;
            rowIndex++
        ) {

            for (
                let columnIndex = 0;
                columnIndex < positions.length;
                columnIndex++
            ) {

                const row =
                    positions[rowIndex];

                const column =
                    positions[columnIndex];


                /*
                 * If the centre is already reserved, this
                 * alignment pattern overlaps a finder region.
                 */

                if (
                    this.reserved[row][column]
                ) {

                    continue;
                }


                this.placeAlignmentPattern(
                    row,
                    column
                );
            }
        }
    }


    /* ========================================================
       SINGLE ALIGNMENT PATTERN
       ======================================================== */

    placeAlignmentPattern(
        centreRow,
        centreColumn
    ) {

        /*
         * 11111
         * 10001
         * 10101
         * 10001
         * 11111
         */

        for (
            let rowOffset = -2;
            rowOffset <= 2;
            rowOffset++
        ) {

            for (
                let columnOffset = -2;
                columnOffset <= 2;
                columnOffset++
            ) {

                const distance =
                    Math.max(
                        Math.abs(rowOffset),
                        Math.abs(columnOffset)
                    );


                const dark =
                    distance === 2 ||
                    distance === 0;


                this.setFunctionModule(
                    centreRow + rowOffset,
                    centreColumn + columnOffset,
                    dark ? 1 : 0
                );
            }
        }
    }


    /* ========================================================
       ALIGNMENT POSITIONS
       ======================================================== */

    static getAlignmentPatternPositions(
        version
    ) {

        QRMatrix.validateVersion(version);

        return QRMatrix
            .ALIGNMENT_PATTERN_POSITIONS[
                version
            ]
            .slice();
    }


    /* ========================================================
       FORMAT INFORMATION RESERVATION
       ======================================================== */

    reserveFormatInformation() {

        /*
         * ====================================================
         * COPY 1 - AROUND TOP-LEFT FINDER
         * ====================================================
         *
         * 15 modules.
         */

        const firstCopy = [

            [8, 0],
            [8, 1],
            [8, 2],
            [8, 3],
            [8, 4],
            [8, 5],

            [8, 7],
            [8, 8],
            [7, 8],

            [5, 8],
            [4, 8],
            [3, 8],
            [2, 8],
            [1, 8],
            [0, 8]

        ];


        for (
            let i = 0;
            i < firstCopy.length;
            i++
        ) {

            this.reserveModule(
                firstCopy[i][0],
                firstCopy[i][1]
            );
        }


        /*
         * ====================================================
         * COPY 2 - BOTTOM-LEFT / TOP-RIGHT
         * ====================================================
         *
         * IMPORTANT:
         *
         * This is 7 vertical modules and 8 horizontal modules.
         *
         * The position:
         *
         *     (size - 8, 8)
         *
         * is NOT a format-information module.
         *
         * It is the QR fixed dark module.
         *
         * This distinction fixes the previous one-module
         * capacity error.
         */


        /*
         * Format bits 0-6.
         *
         * Seven vertical modules:
         *
         * (size-1, 8)
         * ...
         * (size-7, 8)
         */

        for (
            let i = 0;
            i < 7;
            i++
        ) {

            this.reserveModule(
                this.size - 1 - i,
                8
            );
        }


        /*
         * Format bits 7-14.
         *
         * Eight horizontal modules:
         *
         * (8, size-8)
         * ...
         * (8, size-1)
         */

        for (
            let i = 0;
            i < 8;
            i++
        ) {

            this.reserveModule(
                8,
                this.size - 8 + i
            );
        }
    }


    /* ========================================================
       VERSION INFORMATION RESERVATION
       ======================================================== */

    reserveVersionInformation() {

        /*
         * Versions 7-40 contain two copies of an 18-bit
         * version-information field.
         */

        for (
            let i = 0;
            i < 18;
            i++
        ) {

            const row =
                Math.floor(
                    i / 3
                );


            const column =
                this.size -
                11 +
                (i % 3);


            /*
             * Top-right.
             */

            this.reserveModule(
                row,
                column
            );


            /*
             * Bottom-left.
             */

            this.reserveModule(
                column,
                row
            );
        }
    }


    /* ========================================================
       FIXED DARK MODULE
       ======================================================== */

    placeDarkModule() {

        /*
         * Fixed QR dark module:
         *
         * row = 4 * version + 9
         * col = 8
         *
         * Equivalent to:
         *
         * row = size - 8
         */

        this.setFunctionModule(
            this.size - 8,
            8,
            1
        );
    }


    /* ========================================================
       STATIC DATA PLACEMENT
       ======================================================== */

    static placeData(
        matrix,
        bits
    ) {

        if (!(matrix instanceof QRMatrix)) {

            throw new TypeError(
                "QRMatrix.placeData() requires a QRMatrix instance."
            );
        }


        matrix.placeData(bits);

        return matrix;
    }


    /* ========================================================
       PLACE DATA
       ======================================================== */

    placeData(bits) {

        if (!Array.isArray(bits)) {

            throw new TypeError(
                "QR data bits must be supplied as an array."
            );
        }


        QRMatrix.validateBits(bits);


        if (
            !this.functionPatternsPlaced
        ) {

            this.placeFunctionPatterns();
        }


        /*
         * Before placing anything, verify that the matrix
         * geometry agrees with the generated QR stream.
         */

        const availableModules =
            this.countDataModules();


        if (
            bits.length !== availableModules
        ) {

            throw new Error(
                "QR matrix/data size mismatch. " +
                "Matrix has " +
                availableModules +
                " data modules but the QR stream contains " +
                bits.length +
                " bits."
            );
        }


        let bitIndex = 0;

        let movingUp = true;


        /*
         * QR data begins at the bottom-right.
         *
         * Work leftwards in two-column stripes.
         */

        let rightColumn =
            this.size - 1;


        while (
            rightColumn > 0
        ) {

            /*
             * Never use timing column 6 as part of a stripe.
             *
             * When we reach it, shift the pair left so the
             * next pair is columns 5 and 4.
             */

            if (
                rightColumn === 6
            ) {

                rightColumn = 5;
            }


            for (
                let verticalIndex = 0;
                verticalIndex < this.size;
                verticalIndex++
            ) {

                const row =
                    movingUp
                        ? this.size - 1 - verticalIndex
                        : verticalIndex;


                /*
                 * Right module first, then left module.
                 */

                for (
                    let offset = 0;
                    offset < 2;
                    offset++
                ) {

                    const column =
                        rightColumn - offset;


                    if (
                        column < 0
                    ) {

                        continue;
                    }


                    if (
                        this.reserved[
                            row
                        ][
                            column
                        ]
                    ) {

                        continue;
                    }


                    if (
                        bitIndex >= bits.length
                    ) {

                        throw new Error(
                            "QR matrix attempted to place more data modules than supplied bits."
                        );
                    }


                    this.setDataModule(
                        row,
                        column,
                        bits[bitIndex]
                    );


                    bitIndex++;
                }
            }


            movingUp =
                !movingUp;


            rightColumn -= 2;
        }


        if (
            bitIndex !== bits.length
        ) {

            throw new Error(
                "QR data placement failed. Placed " +
                bitIndex +
                " of " +
                bits.length +
                " bits."
            );
        }


        this.dataBitsPlaced =
            bitIndex;


        return this;
    }


    /* ========================================================
       SET DATA MODULE
       ======================================================== */

    setDataModule(
        row,
        column,
        value
    ) {

        if (
            !this.isInside(
                row,
                column
            )
        ) {

            throw new RangeError(
                "QR data module is outside the matrix."
            );
        }


        if (
            this.reserved[
                row
            ][
                column
            ]
        ) {

            throw new Error(
                "Cannot write data to reserved QR module (" +
                row +
                ", " +
                column +
                ")."
            );
        }


        this.matrix[
            row
        ][
            column
        ] =
            value ? 1 : 0;
    }


    /* ========================================================
       SET FUNCTION MODULE
       ======================================================== */

    setFunctionModule(
        row,
        column,
        value
    ) {

        if (
            !this.isInside(
                row,
                column
            )
        ) {

            throw new RangeError(
                "QR function module is outside the matrix."
            );
        }


        this.matrix[
            row
        ][
            column
        ] =
            value ? 1 : 0;


        this.reserved[
            row
        ][
            column
        ] =
            true;
    }


    /* ========================================================
       RESERVE MODULE
       ======================================================== */

    reserveModule(
        row,
        column
    ) {

        if (
            !this.isInside(
                row,
                column
            )
        ) {

            throw new RangeError(
                "QR reserved module is outside the matrix."
            );
        }


        this.reserved[
            row
        ][
            column
        ] =
            true;


        /*
         * Give reserved-but-not-yet-written modules a temporary
         * light value.
         */

        if (
            this.matrix[
                row
            ][
                column
            ] === null
        ) {

            this.matrix[
                row
            ][
                column
            ] = 0;
        }
    }


    /* ========================================================
       DATA/FUNCTION TESTS
       ======================================================== */

    isDataModule(
        row,
        column
    ) {

        if (
            !this.isInside(
                row,
                column
            )
        ) {

            return false;
        }


        return !this.reserved[
            row
        ][
            column
        ];
    }


    isFunctionModule(
        row,
        column
    ) {

        if (
            !this.isInside(
                row,
                column
            )
        ) {

            return false;
        }


        return this.reserved[
            row
        ][
            column
        ];
    }


    /* ========================================================
       MODULE ACCESS
       ======================================================== */

    getModule(
        row,
        column
    ) {

        if (
            !this.isInside(
                row,
                column
            )
        ) {

            throw new RangeError(
                "QR module is outside the matrix."
            );
        }


        return this.matrix[
            row
        ][
            column
        ];
    }


    getMatrix() {

        return this.matrix;
    }


    getWidth() {

        return this.size;
    }


    getHeight() {

        return this.size;
    }


    /* ========================================================
       COORDINATE TEST
       ======================================================== */

    isInside(
        row,
        column
    ) {

        return (
            row >= 0 &&
            row < this.size &&
            column >= 0 &&
            column < this.size
        );
    }


    /* ========================================================
       CLONE
       ======================================================== */

    clone() {

        const clone =
            Object.create(
                QRMatrix.prototype
            );


        clone.version =
            this.version;

        clone.size =
            this.size;


        clone.matrix =
            this.matrix.map(
                function (row) {

                    return row.slice();
                }
            );


        clone.reserved =
            this.reserved.map(
                function (row) {

                    return row.slice();
                }
            );


        clone.functionModules =
            clone.reserved;


        clone.functionPatternsPlaced =
            this.functionPatternsPlaced;


        clone.dataBitsPlaced =
            this.dataBitsPlaced;


        return clone;
    }


    /* ========================================================
       COUNT DATA MODULES
       ======================================================== */

    countDataModules() {

        let count = 0;


        for (
            let row = 0;
            row < this.size;
            row++
        ) {

            for (
                let column = 0;
                column < this.size;
                column++
            ) {

                if (
                    !this.reserved[
                        row
                    ][
                        column
                    ]
                ) {

                    count++;
                }
            }
        }


        return count;
    }


    /* ========================================================
       COUNT FUNCTION MODULES
       ======================================================== */

    countFunctionModules() {

        let count = 0;


        for (
            let row = 0;
            row < this.size;
            row++
        ) {

            for (
                let column = 0;
                column < this.size;
                column++
            ) {

                if (
                    this.reserved[
                        row
                    ][
                        column
                    ]
                ) {

                    count++;
                }
            }
        }


        return count;
    }


    /* ========================================================
       COMPLETE MATRIX TEST
       ======================================================== */

    isComplete() {

        for (
            let row = 0;
            row < this.size;
            row++
        ) {

            for (
                let column = 0;
                column < this.size;
                column++
            ) {

                if (
                    this.matrix[
                        row
                    ][
                        column
                    ] === null
                ) {

                    return false;
                }
            }
        }


        return true;
    }


    /* ========================================================
       CREATE 2D ARRAY
       ======================================================== */

    static create2DArray(
        size,
        defaultValue
    ) {

        const array =
            new Array(size);


        for (
            let row = 0;
            row < size;
            row++
        ) {

            array[row] =
                new Array(size);


            for (
                let column = 0;
                column < size;
                column++
            ) {

                array[row][column] =
                    defaultValue;
            }
        }


        return array;
    }


    /* ========================================================
       VALIDATION
       ======================================================== */

    static validateVersion(
        version
    ) {

        if (
            !Number.isInteger(version) ||
            version < 1 ||
            version > 40
        ) {

            throw new RangeError(
                "QR version must be an integer from 1 to 40."
            );
        }
    }


    static validateBits(bits) {

        for (
            let i = 0;
            i < bits.length;
            i++
        ) {

            if (
                bits[i] !== 0 &&
                bits[i] !== 1 &&
                bits[i] !== false &&
                bits[i] !== true
            ) {

                throw new Error(
                    "Invalid QR bit at index " +
                    i +
                    ". Bits must contain only 0 or 1."
                );
            }
        }
    }


    /* ========================================================
       ALIGNMENT PATTERN POSITIONS
       ======================================================== */

    static ALIGNMENT_PATTERN_POSITIONS = [

        null,

        [],

        [6, 18],

        [6, 22],

        [6, 26],

        [6, 30],

        [6, 34],

        [6, 22, 38],

        [6, 24, 42],

        [6, 26, 46],

        [6, 28, 50],

        [6, 30, 54],

        [6, 32, 58],

        [6, 34, 62],

        [6, 26, 46, 66],

        [6, 26, 48, 70],

        [6, 26, 50, 74],

        [6, 30, 54, 78],

        [6, 30, 56, 82],

        [6, 30, 58, 86],

        [6, 34, 62, 90],

        [6, 28, 50, 72, 94],

        [6, 26, 50, 74, 98],

        [6, 30, 54, 78, 102],

        [6, 28, 54, 80, 106],

        [6, 32, 58, 84, 110],

        [6, 30, 58, 86, 114],

        [6, 34, 62, 90, 118],

        [6, 26, 50, 74, 98, 122],

        [6, 30, 54, 78, 102, 126],

        [6, 26, 52, 78, 104, 130],

        [6, 30, 56, 82, 108, 134],

        [6, 34, 60, 86, 112, 138],

        [6, 30, 58, 86, 114, 142],

        [6, 34, 62, 90, 118, 146],

        [6, 30, 54, 78, 102, 126, 150],

        [6, 24, 50, 76, 102, 128, 154],

        [6, 28, 54, 80, 106, 132, 158],

        [6, 32, 58, 84, 110, 136, 162],

        [6, 26, 54, 82, 110, 138, 166],

        [6, 30, 58, 86, 114, 142, 170]

    ];
}