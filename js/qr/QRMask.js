/**
 * ============================================================
 * QR MASK
 * ============================================================
 *
 * Handles masking for standard QR Codes.
 *
 * Responsibilities:
 *
 *  - Implement all 8 QR mask patterns
 *  - Apply masks only to data modules
 *  - Generate 15-bit format information
 *  - Write both format-information copies
 *  - Generate Version 7+ information
 *  - Write both version-information copies
 *  - Calculate QR mask penalty Rules 1-4
 *  - Select the lowest-penalty mask
 *
 * ============================================================
 */

class QRMask {

    /* ========================================================
     ERROR-CORRECTION FORMAT BITS
     ======================================================== */

    /*
     * QR format-information EC values:
     *
     * L = 01
     * M = 00
     * Q = 11
     * H = 10
     */

    static ERROR_CORRECTION_BITS = {

        L: 0b01,
        M: 0b00,
        Q: 0b11,
        H: 0b10

    };

    /* ========================================================
     BCH CONSTANTS
     ======================================================== */

    /*
     * BCH(15,5) format-information generator.
     */

    static FORMAT_GENERATOR =
            0x537;

    /*
     * Mandatory format-information XOR mask.
     */

    static FORMAT_MASK =
            0x5412;

    /*
     * BCH(18,6) version-information generator.
     */

    static VERSION_GENERATOR =
            0x1F25;

    /* ========================================================
     SELECT BEST MASK
     ======================================================== */

    static selectBestMask(
            matrix,
            errorCorrection,
            version
            ) {

        QRMask.validateErrorCorrection(
                errorCorrection
                );

        QRMask.validateVersion(
                version
                );


        let bestMatrix = null;

        let bestMask = 0;

        let bestPenalty =
                Number.POSITIVE_INFINITY;


        for (
                let mask = 0;
                mask < 8;
                mask++
                ) {

            const candidate =
                    QRMask.applyMask(
                            matrix,
                            mask,
                            errorCorrection,
                            version
                            );


            const penalty =
                    QRMask.calculatePenalty(
                            candidate
                            );


            if (
                    penalty < bestPenalty
                    ) {

                bestPenalty =
                        penalty;

                bestMask =
                        mask;

                bestMatrix =
                        candidate;
            }
        }


        return {

            mask:
                    bestMask,

            penalty:
                    bestPenalty,

            matrix:
                    bestMatrix

        };
    }

    /* ========================================================
     APPLY MASK
     ======================================================== */

    static applyMask(
            matrix,
            mask,
            errorCorrection,
            version
            ) {

        QRMask.validateMask(
                mask
                );

        QRMask.validateErrorCorrection(
                errorCorrection
                );

        QRMask.validateVersion(
                version
                );


        const candidate =
                QRMask.cloneMatrix(
                        matrix
                        );


        const modules =
                QRMask.getModules(
                        candidate
                        );


        QRMask.validateModuleMatrix(
                modules
                );


        const size =
                modules.length;


        /*
         * Apply the selected mask ONLY to data modules.
         *
         * Finder patterns, timing patterns, alignment patterns,
         * format information, version information and the dark
         * module must never be toggled.
         */

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

                if (
                        !QRMask.isDataModule(
                                candidate,
                                row,
                                column
                                )
                        ) {

                    continue;
                }


                if (
                        QRMask.shouldMask(
                                mask,
                                row,
                                column
                                )
                        ) {

                    QRMask.toggleModule(
                            candidate,
                            row,
                            column
                            );
                }
            }
        }


        /*
         * Format information depends upon both:
         *
         *  - error correction level
         *  - selected mask
         */

        QRMask.writeFormatInformation(
                candidate,
                errorCorrection,
                mask
                );


        /*
         * Versions 7-40 also contain version information.
         */

        if (
                version >= 7
                ) {

            QRMask.writeVersionInformation(
                    candidate,
                    version
                    );
        }


        return candidate;
    }

    /* ========================================================
     MASK FORMULAS
     ======================================================== */

    static shouldMask(
            mask,
            row,
            column
            ) {

        QRMask.validateMask(
                mask
                );


        switch (mask) {

            /*
             * Mask 0
             *
             * (row + column) mod 2 = 0
             */

            case 0:

                return (
                        (row + column) % 2 === 0
                        );


                /*
                 * Mask 1
                 *
                 * row mod 2 = 0
                 */

            case 1:

                return (
                        row % 2 === 0
                        );


                /*
                 * Mask 2
                 *
                 * column mod 3 = 0
                 */

            case 2:

                return (
                        column % 3 === 0
                        );


                /*
                 * Mask 3
                 *
                 * (row + column) mod 3 = 0
                 */

            case 3:

                return (
                        (row + column) % 3 === 0
                        );


                /*
                 * Mask 4
                 *
                 * (
                 *     floor(row / 2) +
                 *     floor(column / 3)
                 * ) mod 2 = 0
                 */

            case 4:

                return (
                        (
                                Math.floor(
                                        row / 2
                                        ) +
                                Math.floor(
                                        column / 3
                                        )
                                ) % 2 === 0
                        );


                /*
                 * Mask 5
                 *
                 * (
                 *     (row * column) mod 2
                 * ) +
                 * (
                 *     (row * column) mod 3
                 * )
                 * = 0
                 */

            case 5:
            {

                const product =
                        row * column;


                return (
                        (
                                product % 2
                                ) +
                        (
                                product % 3
                                ) === 0
                        );
            }


            /*
             * Mask 6
             *
             * (
             *     ((row * column) mod 2) +
             *     ((row * column) mod 3)
             * ) mod 2 = 0
             */

            case 6:
            {

                const product =
                        row * column;


                return (
                        (
                                (
                                        product % 2
                                        ) +
                                (
                                        product % 3
                                        )
                                ) % 2 === 0
                        );
            }


            /*
             * Mask 7
             *
             * (
             *     ((row + column) mod 2) +
             *     ((row * column) mod 3)
             * ) mod 2 = 0
             */

            case 7:

                return (
                        (
                                (
                                        row + column
                                        ) % 2 +
                                (
                                        row * column
                                        ) % 3
                                ) % 2 === 0
                        );


            default:

                throw new RangeError(
                        "QR mask must be between 0 and 7."
                        );
        }
    }

    /* ========================================================
     CREATE FORMAT INFORMATION
     ======================================================== */

    static createFormatInformation(
            errorCorrection,
            mask
            ) {

        QRMask.validateErrorCorrection(
                errorCorrection
                );

        QRMask.validateMask(
                mask
                );


        const ecBits =
                QRMask.ERROR_CORRECTION_BITS[
                        errorCorrection
                ];


        /*
         * Five input bits:
         *
         * EC EC MASK MASK MASK
         */

        const data =
                (ecBits << 3) |
                mask;


        /*
         * Multiply by x^10.
         */

        let remainder =
                data << 10;


        /*
         * Polynomial division using BCH generator 0x537.
         */

        while (
                QRMask.getBitLength(
                        remainder
                        ) >= 11
                ) {

            const shift =
                    QRMask.getBitLength(
                            remainder
                            ) - 11;


            remainder ^=
                    QRMask.FORMAT_GENERATOR <<
                    shift;
        }


        /*
         * Combine original five bits and ten BCH bits.
         */

        const format =
                (data << 10) |
                remainder;


        /*
         * Apply mandatory QR format mask.
         */

        return (
                format ^
                QRMask.FORMAT_MASK
                );
    }

    /* ========================================================
     WRITE FORMAT INFORMATION
     ======================================================== */

    static writeFormatInformation(
            matrix,
            errorCorrection,
            mask
            ) {

        const modules =
                QRMask.getModules(matrix);

        QRMask.validateModuleMatrix(
                modules
                );

        const size =
                modules.length;

        const format =
                QRMask.createFormatInformation(
                        errorCorrection,
                        mask
                        );


        /*
         * First copy around the top-left finder.
         */

        for (
                let i = 0;
                i <= 5;
                i++
                ) {

            QRMask.setFunctionModule(
                    matrix,
                    i,
                    8,
                    QRMask.getBit(format, i)
                    );
        }


        QRMask.setFunctionModule(
                matrix,
                7,
                8,
                QRMask.getBit(format, 6)
                );


        QRMask.setFunctionModule(
                matrix,
                8,
                8,
                QRMask.getBit(format, 7)
                );


        QRMask.setFunctionModule(
                matrix,
                8,
                7,
                QRMask.getBit(format, 8)
                );


        for (
                let i = 9;
                i < 15;
                i++
                ) {

            QRMask.setFunctionModule(
                    matrix,
                    8,
                    14 - i,
                    QRMask.getBit(format, i)
                    );
        }


        /*
         * Second copy:
         * bits 0-7 across the top-right;
         * bits 8-14 down the bottom-left.
         */

        for (
                let i = 0;
                i < 8;
                i++
                ) {

            QRMask.setFunctionModule(
                    matrix,
                    8,
                    size - 1 - i,
                    QRMask.getBit(format, i)
                    );
        }


        for (
                let i = 8;
                i < 15;
                i++
                ) {

            QRMask.setFunctionModule(
                    matrix,
                    size - 15 + i,
                    8,
                    QRMask.getBit(format, i)
                    );
        }


        /*
         * Mandatory fixed dark module.
         */

        QRMask.setFunctionModule(
                matrix,
                size - 8,
                8,
                1
                );
    }

    /* ========================================================
     CREATE VERSION INFORMATION
     ======================================================== */

    static createVersionInformation(
            version
            ) {

        QRMask.validateVersion(
                version
                );


        if (
                version < 7
                ) {

            throw new Error(
                    "QR version information only exists for Versions 7-40."
                    );
        }


        /*
         * Six version bits followed by 12 BCH bits.
         */

        let remainder =
                version << 12;


        while (
                QRMask.getBitLength(
                        remainder
                        ) >= 13
                ) {

            const shift =
                    QRMask.getBitLength(
                            remainder
                            ) - 13;


            remainder ^=
                    QRMask.VERSION_GENERATOR <<
                    shift;
        }


        return (
                (version << 12) |
                remainder
                );
    }

    /* ========================================================
     WRITE VERSION INFORMATION
     ======================================================== */

    static writeVersionInformation(
            matrix,
            version
            ) {

        QRMask.validateVersion(
                version
                );


        if (
                version < 7
                ) {

            return;
        }


        const modules =
                QRMask.getModules(
                        matrix
                        );


        QRMask.validateModuleMatrix(
                modules
                );


        const size =
                modules.length;


        const information =
                QRMask.createVersionInformation(
                        version
                        );


        /*
         * 18 version-information bits are written twice.
         */

        for (
                let i = 0;
                i < 18;
                i++
                ) {

            const bit =
                    QRMask.getBit(
                            information,
                            i
                            );


            const row =
                    Math.floor(
                            i / 3
                            );


            const column =
                    size -
                    11 +
                    (i % 3);


            /*
             * Top-right copy.
             */

            QRMask.setFunctionModule(
                    matrix,
                    row,
                    column,
                    bit
                    );


            /*
             * Bottom-left copy.
             */

            QRMask.setFunctionModule(
                    matrix,
                    column,
                    row,
                    bit
                    );
        }
    }

    /* ========================================================
     TOTAL PENALTY
     ======================================================== */

    static calculatePenalty(
            matrix
            ) {

        const modules =
                QRMask.getModules(
                        matrix
                        );


        QRMask.validateModuleMatrix(
                modules
                );


        return (
                QRMask.calculateRule1(
                        modules
                        ) +
                QRMask.calculateRule2(
                        modules
                        ) +
                QRMask.calculateRule3(
                        modules
                        ) +
                QRMask.calculateRule4(
                        modules
                        )
                );
    }

    /* ========================================================
     PENALTY RULE 1
     ======================================================== */

    /*
     * Five consecutive modules of the same colour:
     *
     * +3
     *
     * Each additional module:
     *
     * +1
     */

    static calculateRule1(
            modules
            ) {

        const size =
                modules.length;


        let penalty = 0;


        /*
         * Rows.
         */

        for (
                let row = 0;
                row < size;
                row++
                ) {

            let colour =
                    QRMask.moduleValue(
                            modules[row][0]
                            );


            let runLength = 1;


            for (
                    let column = 1;
                    column < size;
                    column++
                    ) {

                const current =
                        QRMask.moduleValue(
                                modules[row][column]
                                );


                if (
                        current === colour
                        ) {

                    runLength++;
                } else {

                    penalty +=
                            QRMask.calculateRunPenalty(
                                    runLength
                                    );


                    colour =
                            current;

                    runLength =
                            1;
                }
            }


            penalty +=
                    QRMask.calculateRunPenalty(
                            runLength
                            );
        }


        /*
         * Columns.
         */

        for (
                let column = 0;
                column < size;
                column++
                ) {

            let colour =
                    QRMask.moduleValue(
                            modules[0][column]
                            );


            let runLength = 1;


            for (
                    let row = 1;
                    row < size;
                    row++
                    ) {

                const current =
                        QRMask.moduleValue(
                                modules[row][column]
                                );


                if (
                        current === colour
                        ) {

                    runLength++;
                } else {

                    penalty +=
                            QRMask.calculateRunPenalty(
                                    runLength
                                    );


                    colour =
                            current;

                    runLength =
                            1;
                }
            }


            penalty +=
                    QRMask.calculateRunPenalty(
                            runLength
                            );
        }


        return penalty;
    }

    static calculateRunPenalty(
            runLength
            ) {

        if (
                runLength < 5
                ) {

            return 0;
        }


        return (
                3 +
                (
                        runLength - 5
                        )
                );
    }

    /* ========================================================
     PENALTY RULE 2
     ======================================================== */

    /*
     * Every 2x2 block containing modules of the same colour
     * adds three penalty points.
     */

    static calculateRule2(
            modules
            ) {

        const size =
                modules.length;


        let penalty = 0;


        for (
                let row = 0;
                row < size - 1;
                row++
                ) {

            for (
                    let column = 0;
                    column < size - 1;
                    column++
                    ) {

                const value =
                        QRMask.moduleValue(
                                modules[row][column]
                                );


                if (
                        QRMask.moduleValue(
                                modules[row][column + 1]
                                ) === value &&
                        QRMask.moduleValue(
                                modules[row + 1][column]
                                ) === value &&
                        QRMask.moduleValue(
                                modules[row + 1][column + 1]
                                ) === value
                        ) {

                    penalty += 3;
                }
            }
        }


        return penalty;
    }

    /* ========================================================
     PENALTY RULE 3
     ======================================================== */

    /*
     * Finder-like patterns:
     *
     * 10111010000
     *
     * or
     *
     * 00001011101
     *
     * add 40 penalty points.
     */

    static calculateRule3(
            modules
            ) {

        const size =
                modules.length;


        let penalty = 0;


        const patternA = [

            1, 0, 1, 1, 1, 0, 1,
            0, 0, 0, 0

        ];


        const patternB = [

            0, 0, 0, 0,
            1, 0, 1, 1, 1, 0, 1

        ];


        /*
         * Rows.
         */

        for (
                let row = 0;
                row < size;
                row++
                ) {

            const values = [];


            for (
                    let column = 0;
                    column < size;
                    column++
                    ) {

                values.push(
                        QRMask.moduleValue(
                                modules[row][column]
                                )
                        );
            }


            penalty +=
                    QRMask.countPatternMatches(
                            values,
                            patternA
                            ) * 40;


            penalty +=
                    QRMask.countPatternMatches(
                            values,
                            patternB
                            ) * 40;
        }


        /*
         * Columns.
         */

        for (
                let column = 0;
                column < size;
                column++
                ) {

            const values = [];


            for (
                    let row = 0;
                    row < size;
                    row++
                    ) {

                values.push(
                        QRMask.moduleValue(
                                modules[row][column]
                                )
                        );
            }


            penalty +=
                    QRMask.countPatternMatches(
                            values,
                            patternA
                            ) * 40;


            penalty +=
                    QRMask.countPatternMatches(
                            values,
                            patternB
                            ) * 40;
        }


        return penalty;
    }

    /* ========================================================
     PATTERN MATCHING
     ======================================================== */

    static countPatternMatches(
            values,
            pattern
            ) {

        let count = 0;


        for (
                let start = 0;
                start <=
                values.length -
                pattern.length;
                start++
                ) {

            let matches =
                    true;


            for (
                    let i = 0;
                    i < pattern.length;
                    i++
                    ) {

                if (
                        values[
                                start + i
                        ] !== pattern[i]
                        ) {

                    matches =
                            false;

                    break;
                }
            }


            if (
                    matches
                    ) {

                count++;
            }
        }


        return count;
    }

    /* ========================================================
     PENALTY RULE 4
     ======================================================== */

    /*
     * For every complete 5% deviation from 50% dark modules,
     * add 10 penalty points.
     */

    static calculateRule4(
            modules
            ) {

        const size =
                modules.length;


        const total =
                size * size;


        let dark =
                0;


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

                if (
                        QRMask.moduleValue(
                                modules[row][column]
                                ) === 1
                        ) {

                    dark++;
                }
            }
        }


        const percentage =
                (dark * 100) /
                total;


        const deviation =
                Math.abs(
                        percentage - 50
                        );


        return (
                Math.floor(
                        deviation / 5
                        ) * 10
                );
    }

    /* ========================================================
     DATA MODULE DETECTION
     ======================================================== */

    static isDataModule(
            matrix,
            row,
            column
            ) {

        /*
         * Preferred QRMatrix API.
         */

        if (
                matrix &&
                typeof matrix.isDataModule ===
                "function"
                ) {

            return matrix.isDataModule(
                    row,
                    column
                    );
        }


        /*
         * Reserved-map representation.
         */

        if (
                matrix &&
                Array.isArray(
                        matrix.reserved
                        )
                ) {

            return (
                    !matrix.reserved[
                            row
                    ][
                    column
            ]
                    );
        }


        /*
         * Function-module map.
         */

        if (
                matrix &&
                Array.isArray(
                        matrix.functionModules
                        )
                ) {

            return (
                    !matrix.functionModules[
                            row
                    ][
                    column
            ]
                    );
        }


        /*
         * Typed module representation.
         */

        const modules =
                QRMask.getModules(
                        matrix
                        );


        const module =
                modules[
                        row
                ][
                column
        ];


        if (
                module &&
                typeof module ===
                "object"
                ) {

            if (
                    module.type !== undefined
                    ) {

                return (
                        module.type ===
                        "data"
                        );
            }


            if (
                    module.reserved !== undefined
                    ) {

                return (
                        !module.reserved
                        );
            }


            if (
                    module.function !== undefined
                    ) {

                return (
                        !module.function
                        );
            }
        }


        throw new Error(
                "QRMask cannot determine whether a module contains data."
                );
    }

    /* ========================================================
     TOGGLE MODULE
     ======================================================== */

    static toggleModule(
            matrix,
            row,
            column
            ) {

        const modules =
                QRMask.getModules(
                        matrix
                        );


        const module =
                modules[
                        row
                ][
                column
        ];


        /*
         * Object representation.
         */

        if (
                module &&
                typeof module ===
                "object"
                ) {

            if (
                    module.value !== undefined
                    ) {

                module.value =
                        QRMask.moduleValue(
                                module
                                ) === 1
                        ? 0
                        : 1;


                return;
            }


            if (
                    module.dark !== undefined
                    ) {

                module.dark =
                        !module.dark;


                return;
            }
        }


        /*
         * Primitive representation.
         */

        modules[
                row
        ][
                column
        ] =
                QRMask.moduleValue(
                        module
                        ) === 1
                ? 0
                : 1;
    }

    /* ========================================================
     SET FUNCTION MODULE
     ======================================================== */

    static setFunctionModule(
            matrix,
            row,
            column,
            value
            ) {

        /*
         * Let QRMatrix update its own reservation metadata.
         */

        if (
                matrix &&
                typeof matrix.setFunctionModule ===
                "function"
                ) {

            matrix.setFunctionModule(
                    row,
                    column,
                    value
                    );


            return;
        }


        const modules =
                QRMask.getModules(
                        matrix
                        );


        const module =
                modules[
                        row
                ][
                column
        ];


        if (
                module &&
                typeof module ===
                "object"
                ) {

            if (
                    module.value !== undefined
                    ) {

                module.value =
                        value ? 1 : 0;
            } else if (
                    module.dark !== undefined
                    ) {

                module.dark =
                        Boolean(value);
            } else {

                module.value =
                        value ? 1 : 0;
            }


            module.type =
                    "function";

            module.reserved =
                    true;


            return;
        }


        modules[
                row
        ][
                column
        ] =
                value ? 1 : 0;


        if (
                matrix &&
                Array.isArray(
                        matrix.reserved
                        )
                ) {

            matrix.reserved[
                    row
            ][
                    column
            ] =
                    true;
        }


        if (
                matrix &&
                Array.isArray(
                        matrix.functionModules
                        )
                ) {

            matrix.functionModules[
                    row
            ][
                    column
            ] =
                    true;
        }
    }

    /* ========================================================
     CLONE MATRIX
     ======================================================== */

    static cloneMatrix(
            matrix
            ) {

        /*
         * Preferred QRMatrix clone.
         */

        if (
                matrix &&
                typeof matrix.clone ===
                "function"
                ) {

            return matrix.clone();
        }


        /*
         * Plain 2D array.
         */

        if (
                Array.isArray(
                        matrix
                        )
                ) {

            return matrix.map(
                    function (row) {

                        return row.map(
                                function (module) {

                                    return QRMask.cloneModule(
                                            module
                                            );
                                }
                        );
                    }
            );
        }


        /*
         * QRMatrix-like object.
         */

        if (
                matrix &&
                Array.isArray(
                        matrix.matrix
                        )
                ) {

            const clone =
                    Object.create(
                            Object.getPrototypeOf(
                                    matrix
                                    )
                            );


            Object.assign(
                    clone,
                    matrix
                    );


            clone.matrix =
                    matrix.matrix.map(
                            function (row) {

                                return row.map(
                                        function (module) {

                                            return QRMask.cloneModule(
                                                    module
                                                    );
                                        }
                                );
                            }
                    );


            if (
                    Array.isArray(
                            matrix.reserved
                            )
                    ) {

                clone.reserved =
                        matrix.reserved.map(
                                function (row) {

                                    return row.slice();
                                }
                        );
            }


            /*
             * Preserve alias relationship where appropriate.
             */

            if (
                    clone.reserved
                    ) {

                clone.functionModules =
                        clone.reserved;
            } else if (
                    Array.isArray(
                            matrix.functionModules
                            )
                    ) {

                clone.functionModules =
                        matrix.functionModules.map(
                                function (row) {

                                    return row.slice();
                                }
                        );
            }


            return clone;
        }


        throw new Error(
                "Unable to clone QR matrix."
                );
    }

    static cloneModule(
            module
            ) {

        if (
                module &&
                typeof module ===
                "object"
                ) {

            return Object.assign(
                    {},
                    module
                    );
        }


        return module;
    }

    /* ========================================================
     GET MODULE MATRIX
     ======================================================== */

    static getModules(
            matrix
            ) {

        if (
                Array.isArray(
                        matrix
                        )
                ) {

            return matrix;
        }


        if (
                matrix &&
                Array.isArray(
                        matrix.matrix
                        )
                ) {

            return matrix.matrix;
        }


        if (
                matrix &&
                typeof matrix.getMatrix ===
                "function"
                ) {

            return matrix.getMatrix();
        }


        throw new Error(
                "Invalid QR matrix."
                );
    }

    /* ========================================================
     NORMALISE MODULE VALUE
     ======================================================== */

    static moduleValue(
            module
            ) {

        if (
                module === true ||
                module === 1
                ) {

            return 1;
        }


        if (
                module === false ||
                module === 0 ||
                module === null ||
                module === undefined
                ) {

            return 0;
        }


        if (
                typeof module ===
                "object"
                ) {

            if (
                    module.value !== undefined
                    ) {

                return module.value
                        ? 1
                        : 0;
            }


            if (
                    module.dark !== undefined
                    ) {

                return module.dark
                        ? 1
                        : 0;
            }
        }


        return module
                ? 1
                : 0;
    }

    /* ========================================================
     GET BIT
     ======================================================== */

    static getBit(
            value,
            index
            ) {

        return (
                Math.floor(
                        value /
                        Math.pow(
                                2,
                                index
                                )
                        ) % 2
                );
    }

    /* ========================================================
     INTEGER BIT LENGTH
     ======================================================== */

    static getBitLength(
            value
            ) {

        if (
                value === 0
                ) {

            return 0;
        }


        return (
                Math.floor(
                        Math.log2(
                                value
                                )
                        ) + 1
                );
    }

    /* ========================================================
     MATRIX VALIDATION
     ======================================================== */

    static validateModuleMatrix(
            modules
            ) {

        if (
                !Array.isArray(
                        modules
                        ) ||
                modules.length === 0
                ) {

            throw new Error(
                    "QR matrix cannot be empty."
                    );
        }


        const size =
                modules.length;


        for (
                let row = 0;
                row < size;
                row++
                ) {

            if (
                    !Array.isArray(
                            modules[row]
                            ) ||
                    modules[row].length !== size
                    ) {

                throw new Error(
                        "QR matrix must be square."
                        );
            }
        }
    }

    /* ========================================================
     VALIDATE MASK
     ======================================================== */

    static validateMask(
            mask
            ) {

        if (
                !Number.isInteger(
                        mask
                        ) ||
                mask < 0 ||
                mask > 7
                ) {

            throw new RangeError(
                    "QR mask must be an integer from 0 to 7."
                    );
        }
    }

    /* ========================================================
     VALIDATE ERROR CORRECTION
     ======================================================== */

    static validateErrorCorrection(
            level
            ) {

        if (
                !Object.prototype
                .hasOwnProperty.call(
                        QRMask.ERROR_CORRECTION_BITS,
                        level
                        )
                ) {

            throw new Error(
                    "QR error-correction level must be L, M, Q or H."
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
                !Number.isInteger(
                        version
                        ) ||
                version < 1 ||
                version > 40
                ) {

            throw new RangeError(
                    "QR version must be an integer from 1 to 40."
                    );
        }
    }
}