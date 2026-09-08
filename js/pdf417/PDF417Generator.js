/**
 * ============================================================
 * PDF417Generator.js
 * ============================================================
 *
 * High-level PDF417 symbol generator.
 *
 * Responsibilities:
 *  - Encode input data with PDF417Encoder
 *  - Generate Reed-Solomon error correction
 *  - Combine data and ECC codewords
 *  - Build the PDF417 matrix
 *  - Return a symbol compatible with BarcodeRenderer/app.js
 *
 * Pipeline:
 *
 * PDF417Compaction
 *        ↓
 * PDF417Encoder
 *        ↓
 * PDF417ErrorCorrection
 *        ↓
 * PDF417Matrix
 *        ↓
 * PDF417Generator
 *
 * ============================================================
 */

class PDF417Generator {

    /* ========================================================
       DEFAULT OPTIONS
       ======================================================== */

    static DEFAULT_OPTIONS = {

        compaction:
            "auto",

        errorCorrection:
            "M",

        rows:
            null,

        columns:
            null,

        aspectRatio:
            3.0
    };


    /* ========================================================
       PUBLIC GENERATE
       ======================================================== */

    static generate(
        data,
        options = {}
    ) {

        /* ----------------------------------------------------
           VALIDATE INPUT
           ---------------------------------------------------- */

        if (
            data === null ||
            data === undefined
        ) {

            throw new TypeError(
                "PDF417Generator.generate() requires data."
            );
        }


        const text =
            String(data);


        if (
            text.length === 0
        ) {

            throw new Error(
                "PDF417 data cannot be empty."
            );
        }


        /* ----------------------------------------------------
           NORMALISE OPTIONS
           ---------------------------------------------------- */

        const resolvedOptions =
            PDF417Generator.normaliseOptions(
                options
            );


        /* ====================================================
           1. ENCODE DATA
           ==================================================== */

        const encoded =
            PDF417Encoder.encode(
                text,
                resolvedOptions
            );


        if (
            !encoded ||
            !Array.isArray(
                encoded.dataCodewords
            )
        ) {

            throw new Error(
                "PDF417Encoder did not return a valid " +
                "data-codeword sequence."
            );
        }


        /* ====================================================
           2. GENERATE ERROR CORRECTION
           ==================================================== */

        const eccCodewords =
            PDF417ErrorCorrection.generate(
                encoded.dataCodewords,
                encoded.errorCorrectionLevel
            );


        /* ----------------------------------------------------
           VERIFY ECC LENGTH
           ---------------------------------------------------- */

        const expectedECCCount =
            PDF417ErrorCorrection
                .getCodewordCount(
                    encoded.errorCorrectionLevel
                );


        if (
            eccCodewords.length !==
            expectedECCCount
        ) {

            throw new Error(
                "PDF417 ECC length mismatch. Expected " +
                expectedECCCount +
                " codewords but received " +
                eccCodewords.length +
                "."
            );
        }


        /* ====================================================
           3. BUILD COMPLETE CODEWORD STREAM
           ==================================================== */

        const codewords =
            encoded.dataCodewords.concat(
                eccCodewords
            );


        const expectedCapacity =
            encoded.rows *
            encoded.columns;


        if (
            codewords.length !==
            expectedCapacity
        ) {

            throw new Error(
                "PDF417 codeword capacity mismatch. " +
                encoded.rows +
                " rows × " +
                encoded.columns +
                " columns provides " +
                expectedCapacity +
                " positions, but " +
                codewords.length +
                " codewords were generated."
            );
        }


        /* ====================================================
           4. BUILD MATRIX
           ==================================================== */

        const matrix =
            PDF417Generator.buildMatrix(
                codewords,
                encoded.rows,
                encoded.columns,
                encoded.errorCorrectionLevel
            );


        /* ====================================================
           5. VALIDATE MATRIX
           ==================================================== */

        PDF417Generator.validateMatrix(
            matrix
        );


        /* ====================================================
           6. DETERMINE DIMENSIONS
           ==================================================== */

        const matrixHeight =
            matrix.length;


        const matrixWidth =
            matrixHeight > 0
                ? matrix[0].length
                : 0;


        /* ====================================================
           7. RETURN RENDERABLE SYMBOL
           ==================================================== */

        return {

            format:
                "pdf417",

            type:
                "pdf417",

            data:
                text,

            matrix:
                matrix,

            width:
                matrixWidth,

            height:
                matrixHeight,

            rows:
                encoded.rows,

            columns:
                encoded.columns,

            compaction:
                encoded.compaction,

            requestedCompaction:
                encoded.requestedCompaction,

            errorCorrection:
                encoded.errorCorrectionLevel,

            errorCorrectionLevel:
                encoded.errorCorrectionLevel,

            errorCorrectionCodewordCount:
                eccCodewords.length,

            characterCount:
                encoded.characterCount,

            byteCount:
                encoded.byteCount,

            lengthDescriptor:
                encoded.lengthDescriptor,

            paddingCodewords:
                encoded.paddingCodewords,

            payloadCodewords:
                encoded.payloadCodewords.slice(),

            dataCodewords:
                encoded.dataCodewords.slice(),

            errorCorrectionCodewords:
                eccCodewords.slice(),

            codewords:
                codewords,

            quietZone:
                2,

            metadata: {

                format:
                    "PDF417",

                rows:
                    encoded.rows,

                columns:
                    encoded.columns,

                matrixWidth:
                    matrixWidth,

                matrixHeight:
                    matrixHeight,

                compaction:
                    encoded.compaction,

                errorCorrectionLevel:
                    encoded.errorCorrectionLevel,

                payloadCodewords:
                    encoded.payloadCodewords.length,

                dataCodewords:
                    encoded.dataCodewords.length,

                errorCorrectionCodewords:
                    eccCodewords.length,

                totalCodewords:
                    codewords.length,

                paddingCodewords:
                    encoded.paddingCodewords
            }
        };
    }


    /* ========================================================
       BUILD MATRIX
       ======================================================== */

    static buildMatrix(
        codewords,
        rows,
        columns,
        errorCorrectionLevel
    ) {

        /*
         * Support a few sensible method names so this class
         * remains tolerant of the exact public interface used
         * by PDF417Matrix.
         */

        if (
            typeof PDF417Matrix ===
            "undefined"
        ) {

            throw new Error(
                "PDF417Matrix is not loaded."
            );
        }


        /* ----------------------------------------------------
           Preferred interface
           ---------------------------------------------------- */

        if (
            typeof PDF417Matrix.build ===
            "function"
        ) {

            return PDF417Matrix.build(
                codewords,
                rows,
                columns,
                errorCorrectionLevel
            );
        }


        /* ----------------------------------------------------
           Alternative create() interface
           ---------------------------------------------------- */

        if (
            typeof PDF417Matrix.create ===
            "function"
        ) {

            return PDF417Matrix.create(
                codewords,
                rows,
                columns,
                errorCorrectionLevel
            );
        }


        /* ----------------------------------------------------
           Alternative generate() interface
           ---------------------------------------------------- */

        if (
            typeof PDF417Matrix.generate ===
            "function"
        ) {

            return PDF417Matrix.generate(
                codewords,
                rows,
                columns,
                errorCorrectionLevel
            );
        }


        throw new Error(
            "PDF417Matrix must expose build(), " +
            "create(), or generate()."
        );
    }


    /* ========================================================
       NORMALISE OPTIONS
       ======================================================== */

    static normaliseOptions(
        options = {}
    ) {

        if (
            options === null ||
            typeof options !== "object" ||
            Array.isArray(options)
        ) {

            throw new TypeError(
                "PDF417 options must be an object."
            );
        }


        const defaults =
            PDF417Generator.DEFAULT_OPTIONS;


        const result = {

            compaction:
                options.compaction ??
                options.mode ??
                defaults.compaction,

            errorCorrection:
                options.errorCorrection ??
                defaults.errorCorrection,

            rows:
                options.rows ??
                defaults.rows,

            columns:
                options.columns ??
                defaults.columns,

            aspectRatio:
                options.aspectRatio ??
                defaults.aspectRatio
        };


        /* ----------------------------------------------------
           Compaction
           ---------------------------------------------------- */

        result.compaction =
            String(
                result.compaction
            )
                .trim()
                .toLowerCase();


        if (
            result.compaction !== "auto" &&
            result.compaction !== "text" &&
            result.compaction !== "byte" &&
            result.compaction !== "numeric"
        ) {

            throw new Error(
                "Invalid PDF417 compaction mode: " +
                result.compaction
            );
        }


        /* ----------------------------------------------------
           Rows
           ---------------------------------------------------- */

        if (
            result.rows !== null &&
            result.rows !== undefined &&
            result.rows !== ""
        ) {

            result.rows =
                Number(
                    result.rows
                );


            if (
                !Number.isInteger(
                    result.rows
                ) ||
                result.rows < 3 ||
                result.rows > 90
            ) {

                throw new RangeError(
                    "PDF417 rows must be between 3 and 90."
                );
            }

        } else {

            result.rows =
                null;
        }


        /* ----------------------------------------------------
           Columns
           ---------------------------------------------------- */

        if (
            result.columns !== null &&
            result.columns !== undefined &&
            result.columns !== ""
        ) {

            result.columns =
                Number(
                    result.columns
                );


            if (
                !Number.isInteger(
                    result.columns
                ) ||
                result.columns < 1 ||
                result.columns > 30
            ) {

                throw new RangeError(
                    "PDF417 columns must be between 1 and 30."
                );
            }

        } else {

            result.columns =
                null;
        }


        /* ----------------------------------------------------
           Aspect ratio
           ---------------------------------------------------- */

        result.aspectRatio =
            Number(
                result.aspectRatio
            );


        if (
            !Number.isFinite(
                result.aspectRatio
            ) ||
            result.aspectRatio <= 0
        ) {

            result.aspectRatio =
                defaults.aspectRatio;
        }


        return result;
    }


    /* ========================================================
       MATRIX VALIDATION
       ======================================================== */

    static validateMatrix(
        matrix
    ) {

        if (
            !Array.isArray(matrix) ||
            matrix.length === 0
        ) {

            throw new Error(
                "PDF417Matrix returned an invalid matrix."
            );
        }


        if (
            !Array.isArray(
                matrix[0]
            ) ||
            matrix[0].length === 0
        ) {

            throw new Error(
                "PDF417 matrix rows cannot be empty."
            );
        }


        const width =
            matrix[0].length;


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
                    " is not an array."
                );
            }


            if (
                matrix[row].length !==
                width
            ) {

                throw new Error(
                    "PDF417 matrix rows must all have " +
                    "the same width."
                );
            }


            for (
                let column = 0;
                column < width;
                column++
            ) {

                const value =
                    matrix[row][column];


                if (
                    value !== true &&
                    value !== false &&
                    value !== 1 &&
                    value !== 0
                ) {

                    throw new Error(
                        "Invalid PDF417 matrix module at " +
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
       DETAILED GENERATION
       ======================================================== */

    static generateDetailed(
        data,
        options = {}
    ) {

        const symbol =
            PDF417Generator.generate(
                data,
                options
            );


        return {

            ...symbol,

            metadata: {

                ...symbol.metadata,

                characterCount:
                    symbol.characterCount,

                byteCount:
                    symbol.byteCount,

                lengthDescriptor:
                    symbol.lengthDescriptor
            }
        };
    }


    /* ========================================================
       GENERATE MATRIX ONLY
       ======================================================== */

    static generateMatrix(
        data,
        options = {}
    ) {

        return PDF417Generator
            .generate(
                data,
                options
            )
            .matrix;
    }


    /* ========================================================
       GENERATE CODEWORDS ONLY
       ======================================================== */

    static generateCodewords(
        data,
        options = {}
    ) {

        const text =
            String(data);


        const resolvedOptions =
            PDF417Generator
                .normaliseOptions(
                    options
                );


        const encoded =
            PDF417Encoder.encode(
                text,
                resolvedOptions
            );


        const ecc =
            PDF417ErrorCorrection.generate(
                encoded.dataCodewords,
                encoded.errorCorrectionLevel
            );


        return {

            dataCodewords:
                encoded.dataCodewords.slice(),

            errorCorrectionCodewords:
                ecc.slice(),

            codewords:
                encoded.dataCodewords.concat(
                    ecc
                ),

            rows:
                encoded.rows,

            columns:
                encoded.columns,

            errorCorrectionLevel:
                encoded.errorCorrectionLevel
        };
    }


    /* ========================================================
       CAPACITY INFORMATION
       ======================================================== */

    static getCapacity(
        rows,
        columns,
        errorCorrectionLevel
    ) {

        rows =
            Number(rows);

        columns =
            Number(columns);

        errorCorrectionLevel =
            Number(
                errorCorrectionLevel
            );


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


        const total =
            rows *
            columns;


        const ecc =
            PDF417ErrorCorrection
                .getCodewordCount(
                    errorCorrectionLevel
                );


        const data =
            total -
            ecc;


        return {

            rows:
                rows,

            columns:
                columns,

            totalCodewords:
                total,

            errorCorrectionCodewords:
                ecc,

            dataCodewords:
                data,

            /*
             * One data position is occupied by the Symbol
             * Length Descriptor.
             */

            maximumPayloadCodewords:
                Math.max(
                    0,
                    data - 1
                )
        };
    }


    /* ========================================================
       FORMAT NAME
       ======================================================== */

    static getFormatName() {

        return "PDF417";
    }


    /* ========================================================
       SUPPORT TEST
       ======================================================== */

    static isAvailable() {

        return (
            typeof PDF417Compaction !==
                "undefined" &&

            typeof PDF417Encoder !==
                "undefined" &&

            typeof PDF417ErrorCorrection !==
                "undefined" &&

            typeof PDF417Matrix !==
                "undefined"
        );
    }
}