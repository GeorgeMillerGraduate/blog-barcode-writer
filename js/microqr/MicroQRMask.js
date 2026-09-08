/**
 * ============================================================
 * MicroQRMask.js
 * ============================================================
 *
 * Handles Micro QR masking and mask evaluation.
 *
 * Responsibilities:
 *  - Apply one of the four Micro QR mask patterns
 *  - Leave reserved/function modules unchanged
 *  - Evaluate completed masked matrices
 *  - Select the best mask
 *
 * Micro QR uses four mask patterns: 0-3.
 *
 * The matrix may contain:
 *
 *      true  = dark module
 *      false = light module
 *      null  = unset/reserved module
 *
 * ============================================================
 */

class MicroQRMask {

    /* ========================================================
       CONSTANTS
       ======================================================== */

    static MASK_COUNT = 4;


    /* ========================================================
       APPLY MASK
       ======================================================== */

    static apply(matrix, mask, reserved = null) {

        MicroQRMask.validateMatrix(matrix);
        MicroQRMask.validateMask(mask);

        const result =
            MicroQRMask.cloneMatrix(matrix);

        const size =
            result.length;


        for (
            let row = 0;
            row < size;
            row++
        ) {

            for (
                let column = 0;
                column < size;
                column++
            ) {

                /*
                 * Do not mask structural/reserved modules.
                 */

                if (
                    MicroQRMask.isReserved(
                        row,
                        column,
                        size,
                        reserved
                    )
                ) {
                    continue;
                }


                /*
                 * Null modules have not been assigned data and
                 * therefore must not be toggled.
                 */

                if (
                    result[row][column] === null ||
                    result[row][column] === undefined
                ) {
                    continue;
                }


                if (
                    MicroQRMask.condition(
                        mask,
                        row,
                        column
                    )
                ) {

                    result[row][column] =
                        !MicroQRMask.isDark(
                            result[row][column]
                        );
                }
            }
        }


        return result;
    }


    /* ========================================================
       ALIAS USED BY GENERATOR
       ======================================================== */

    static applyMask(
        matrix,
        mask,
        reserved = null
    ) {

        return MicroQRMask.apply(
            matrix,
            mask,
            reserved
        );
    }


    /* ========================================================
       MASK CONDITION
       ======================================================== */

    static condition(mask, row, column) {

        MicroQRMask.validateMask(mask);


        /*
         * Micro QR uses four masks derived from the QR mask
         * family.
         */

        switch (mask) {

            /*
             * QR mask pattern 1:
             *
             *     row mod 2 == 0
             */

            case 0:

                return (
                    row % 2 === 0
                );


            /*
             * QR mask pattern 4:
             *
             * floor(row / 2) +
             * floor(column / 3)
             *
             * is even.
             */

            case 1:

                return (
                    (
                        Math.floor(row / 2) +
                        Math.floor(column / 3)
                    ) % 2 === 0
                );


            /*
             * QR mask pattern 6:
             *
             * ((row * column) mod 2 +
             *  (row * column) mod 3) mod 2 == 0
             */

            case 2: {

                const product =
                    row * column;

                return (
                    (
                        (product % 2) +
                        (product % 3)
                    ) % 2 === 0
                );
            }


            /*
             * QR mask pattern 7:
             *
             * ((row + column) mod 2 +
             *  (row * column) mod 3) mod 2 == 0
             */

            case 3:

                return (
                    (
                        ((row + column) % 2) +
                        ((row * column) % 3)
                    ) % 2 === 0
                );


            default:

                throw new Error(
                    "Invalid Micro QR mask pattern: " +
                    mask
                );
        }
    }


    /* ========================================================
       MASK ALIAS
       ======================================================== */

    static maskCondition(
        mask,
        row,
        column
    ) {

        return MicroQRMask.condition(
            mask,
            row,
            column
        );
    }


    /* ========================================================
       RESERVED MODULE TEST
       ======================================================== */

    static isReserved(
        row,
        column,
        size,
        reserved = null
    ) {

        /*
         * If MicroQRMatrix supplies a reservation map, that is
         * authoritative.
         */

        if (
            Array.isArray(reserved) &&
            Array.isArray(reserved[row])
        ) {

            return Boolean(
                reserved[row][column]
            );
        }


        /*
         * Finder pattern + separator.
         *
         * The finder occupies 0..6 and the separator extends
         * the protected region through row/column 7.
         */

        if (
            row <= 7 &&
            column <= 7
        ) {

            return true;
        }


        /*
         * Timing patterns extend from the finder along the
         * top row and left column.
         */

        if (
            row === 0 ||
            column === 0
        ) {

            return true;
        }


        /*
         * Format information is located around the finder
         * region.
         *
         * These positions must not be changed by the data
         * masking operation.
         */

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
       EVALUATE MATRIX
       ======================================================== */

    static evaluate(matrix) {

        MicroQRMask.validateMatrix(matrix);

        const size =
            matrix.length;


        /*
         * Micro QR mask evaluation examines the number of
         * dark modules in the bottom row and right column.
         */

        let bottomDark = 0;
        let rightDark = 0;


        for (
            let position = 0;
            position < size;
            position++
        ) {

            if (
                MicroQRMask.isDark(
                    matrix[
                        size - 1
                    ][position]
                )
            ) {

                bottomDark++;
            }


            if (
                MicroQRMask.isDark(
                    matrix[
                        position
                    ][
                        size - 1
                    ]
                )
            ) {

                rightDark++;
            }
        }


        /*
         * Micro QR uses the smaller count as the high-order
         * component and the larger count as the low-order
         * component.
         *
         * Higher scores are preferred.
         */

        const smaller =
            Math.min(
                bottomDark,
                rightDark
            );


        const larger =
            Math.max(
                bottomDark,
                rightDark
            );


        return (
            smaller * 16 +
            larger
        );
    }


    /* ========================================================
       SCORE ALIAS
       ======================================================== */

    static score(matrix) {

        return MicroQRMask.evaluate(
            matrix
        );
    }


    /* ========================================================
       DETAILED EVALUATION
       ======================================================== */

    static evaluateDetailed(matrix) {

        MicroQRMask.validateMatrix(matrix);

        const size =
            matrix.length;

        let bottomDark = 0;
        let rightDark = 0;


        for (
            let position = 0;
            position < size;
            position++
        ) {

            if (
                MicroQRMask.isDark(
                    matrix[
                        size - 1
                    ][position]
                )
            ) {

                bottomDark++;
            }


            if (
                MicroQRMask.isDark(
                    matrix[
                        position
                    ][
                        size - 1
                    ]
                )
            ) {

                rightDark++;
            }
        }


        const smaller =
            Math.min(
                bottomDark,
                rightDark
            );


        const larger =
            Math.max(
                bottomDark,
                rightDark
            );


        return {

            bottomDark:
                bottomDark,

            rightDark:
                rightDark,

            smaller:
                smaller,

            larger:
                larger,

            score:
                smaller * 16 + larger
        };
    }


    /* ========================================================
       SELECT BEST MASK
       ======================================================== */

    static selectBest(
        matrix,
        reserved = null,
        formatCallback = null
    ) {

        MicroQRMask.validateMatrix(matrix);


        let bestMask = null;

        let bestMatrix = null;

        let bestScore =
            -Infinity;


        const evaluations = [];


        for (
            let mask = 0;
            mask < MicroQRMask.MASK_COUNT;
            mask++
        ) {

            let candidate =
                MicroQRMask.apply(
                    matrix,
                    mask,
                    reserved
                );


            /*
             * Format information contains the selected mask.
             *
             * The generator/matrix class can supply a callback
             * so format bits are installed before evaluation.
             */

            if (
                typeof formatCallback ===
                "function"
            ) {

                const formatted =
                    formatCallback(
                        candidate,
                        mask
                    );


                if (
                    Array.isArray(formatted)
                ) {

                    candidate =
                        formatted;
                }
            }


            const details =
                MicroQRMask.evaluateDetailed(
                    candidate
                );


            evaluations.push({

                mask:
                    mask,

                score:
                    details.score,

                bottomDark:
                    details.bottomDark,

                rightDark:
                    details.rightDark
            });


            if (
                bestMask === null ||
                details.score > bestScore
            ) {

                bestMask =
                    mask;

                bestScore =
                    details.score;

                bestMatrix =
                    candidate;
            }
        }


        return {

            mask:
                bestMask,

            score:
                bestScore,

            matrix:
                bestMatrix,

            evaluations:
                evaluations
        };
    }


    /* ========================================================
       GET ALL MASKED MATRICES
       ======================================================== */

    static generateCandidates(
        matrix,
        reserved = null
    ) {

        MicroQRMask.validateMatrix(matrix);


        const candidates = [];


        for (
            let mask = 0;
            mask < MicroQRMask.MASK_COUNT;
            mask++
        ) {

            const candidate =
                MicroQRMask.apply(
                    matrix,
                    mask,
                    reserved
                );


            candidates.push({

                mask:
                    mask,

                matrix:
                    candidate,

                score:
                    MicroQRMask.evaluate(
                        candidate
                    )
            });
        }


        return candidates;
    }


    /* ========================================================
       DARK MODULE TEST
       ======================================================== */

    static isDark(value) {

        return (
            value === true ||
            value === 1 ||
            value === "1"
        );
    }


    /* ========================================================
       CLONE MATRIX
       ======================================================== */

    static cloneMatrix(matrix) {

        MicroQRMask.validateMatrix(
            matrix
        );


        return matrix.map(
            row =>
                row.slice()
        );
    }


    /* ========================================================
       COPY MATRIX
       ======================================================== */

    static copyMatrix(
        source,
        destination
    ) {

        MicroQRMask.validateMatrix(
            source
        );

        MicroQRMask.validateMatrix(
            destination
        );


        if (
            source.length !==
            destination.length
        ) {

            throw new Error(
                "Micro QR matrices must have equal dimensions."
            );
        }


        for (
            let row = 0;
            row < source.length;
            row++
        ) {

            for (
                let column = 0;
                column < source[row].length;
                column++
            ) {

                destination[row][column] =
                    source[row][column];
            }
        }


        return destination;
    }


    /* ========================================================
       VALIDATE MASK
       ======================================================== */

    static validateMask(mask) {

        if (
            !Number.isInteger(mask) ||
            mask < 0 ||
            mask >= MicroQRMask.MASK_COUNT
        ) {

            throw new RangeError(
                "Micro QR mask must be an integer " +
                "between 0 and 3."
            );
        }
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
                "Micro QR matrix must be a non-empty array."
            );
        }


        const size =
            matrix.length;


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
       DEBUG DESCRIPTION
       ======================================================== */

    static describeMask(mask) {

        MicroQRMask.validateMask(
            mask
        );


        switch (mask) {

            case 0:
                return "Even rows";

            case 1:
                return "Row/column groups";

            case 2:
                return "Product modulo";

            case 3:
                return "Coordinate/product modulo";

            default:
                return "";
        }
    }
}