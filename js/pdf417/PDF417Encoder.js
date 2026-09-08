/**
 * ============================================================
 * PDF417Encoder.js
 * ============================================================
 *
 * High-level data encoder for PDF417.
 *
 * Responsibilities:
 *  - Accept input text
 *  - Select/use a compaction mode
 *  - Call PDF417Compaction
 *  - Determine error-correction level
 *  - Determine suitable rows and columns
 *  - Add the Symbol Length Descriptor
 *  - Add padding codewords
 *  - Produce the data-codeword sequence used by the ECC stage
 *
 * This class does NOT:
 *  - calculate Reed-Solomon ECC
 *  - convert codewords into bar/space patterns
 *  - construct the final matrix
 *
 * Pipeline:
 *
 * data
 *   -> PDF417Compaction
 *   -> PDF417Encoder
 *   -> PDF417ErrorCorrection
 *   -> PDF417Matrix
 *   -> PDF417Generator
 * ============================================================
 */

class PDF417Encoder {

    /* ========================================================
       CONSTANTS
       ======================================================== */

    static MIN_COLUMNS = 1;
    static MAX_COLUMNS = 30;

    static MIN_ROWS = 3;
    static MAX_ROWS = 90;

    static MAX_CODEWORDS = 928;

    static PAD_CODEWORD = 900;

    static DEFAULT_ERROR_CORRECTION_LEVEL = 2;

    static DEFAULT_ASPECT_RATIO = 3.0;


    /* ========================================================
       PUBLIC ENCODE
       ======================================================== */

    static encode(data, options = {}) {

        if (
            data === null ||
            data === undefined
        ) {
            throw new TypeError(
                "PDF417Encoder.encode() requires data."
            );
        }

        const text = String(data);

        if (text.length === 0) {
            throw new Error(
                "PDF417 data cannot be empty."
            );
        }


        /* ====================================================
           OPTIONS
           ==================================================== */

        const compactionMode =
            PDF417Encoder.normaliseCompactionMode(
                options.compaction ||
                options.mode ||
                "auto"
            );

        const errorCorrectionLevel =
            PDF417Encoder.resolveErrorCorrectionLevel(
                options.errorCorrection,
                text.length
            );


        /* ====================================================
           COMPACTION
           ==================================================== */

        const compacted =
            PDF417Compaction.compactDetailed(
                text,
                compactionMode
            );

        const payloadCodewords =
            compacted.codewords.slice();


        PDF417Encoder.validatePayloadCodewords(
            payloadCodewords
        );


        /* ====================================================
           ECC SIZE
           ==================================================== */

        const eccCount =
            PDF417Encoder.getErrorCorrectionCodewordCount(
                errorCorrectionLevel
            );


        /*
         * The data region contains:
         *
         *  1 × Symbol Length Descriptor
         *  N × compacted payload codewords
         *  P × padding codewords
         *
         * ECC codewords are added afterwards.
         */

        const minimumDataCodewords =
            1 +
            payloadCodewords.length;


        /* ====================================================
           DIMENSIONS
           ==================================================== */

        const dimensions =
            PDF417Encoder.determineDimensions(
                minimumDataCodewords,
                eccCount,
                options
            );


        const rows =
            dimensions.rows;

        const columns =
            dimensions.columns;

        const totalCapacity =
            rows * columns;


        /*
         * rows × columns is the number of codeword positions
         * available inside the symbol, excluding the row
         * indicators/start/stop patterns.
         */

        const dataCapacity =
            totalCapacity -
            eccCount;


        if (
            dataCapacity <
            minimumDataCodewords
        ) {
            throw new Error(
                "Selected PDF417 dimensions do not contain " +
                "enough room for the encoded data."
            );
        }


        /* ====================================================
           PADDING
           ==================================================== */

        const paddingCount =
            dataCapacity -
            minimumDataCodewords;


        /*
         * The Symbol Length Descriptor describes the number of
         * data-region codewords including itself and padding,
         * but excluding ECC.
         */

        const lengthDescriptor =
            minimumDataCodewords +
            paddingCount;


        if (
            lengthDescriptor < 1 ||
            lengthDescriptor > 928
        ) {
            throw new Error(
                "Invalid PDF417 Symbol Length Descriptor: " +
                lengthDescriptor
            );
        }


        const dataCodewords = [
            lengthDescriptor,
            ...payloadCodewords
        ];


        for (
            let index = 0;
            index < paddingCount;
            index++
        ) {
            dataCodewords.push(
                PDF417Encoder.PAD_CODEWORD
            );
        }


        /* ====================================================
           FINAL VALIDATION
           ==================================================== */

        if (
            dataCodewords.length !==
            dataCapacity
        ) {
            throw new Error(
                "Internal PDF417 capacity mismatch: expected " +
                dataCapacity +
                " data codewords but generated " +
                dataCodewords.length +
                "."
            );
        }


        return {

            format:
                "pdf417",

            data:
                text,

            compaction:
                compacted.detectedMode,

            requestedCompaction:
                compacted.requestedMode,

            rows:
                rows,

            columns:
                columns,

            errorCorrectionLevel:
                errorCorrectionLevel,

            errorCorrectionCodewordCount:
                eccCount,

            payloadCodewords:
                payloadCodewords,

            dataCodewords:
                dataCodewords,

            paddingCodewords:
                paddingCount,

            lengthDescriptor:
                lengthDescriptor,

            totalCodewordCapacity:
                totalCapacity,

            characterCount:
                compacted.characterCount,

            byteCount:
                compacted.byteCount
        };
    }


    /* ========================================================
       DETAILED ENCODE
       ======================================================== */

    static encodeDetailed(
        data,
        options = {}
    ) {

        const result =
            PDF417Encoder.encode(
                data,
                options
            );


        return {
            ...result,

            metadata: {

                format:
                    "PDF417",

                rows:
                    result.rows,

                columns:
                    result.columns,

                compaction:
                    result.compaction,

                errorCorrectionLevel:
                    result.errorCorrectionLevel,

                errorCorrectionCodewords:
                    result.errorCorrectionCodewordCount,

                payloadCodewords:
                    result.payloadCodewords.length,

                paddingCodewords:
                    result.paddingCodewords,

                dataCodewords:
                    result.dataCodewords.length,

                totalCapacity:
                    result.totalCodewordCapacity
            }
        };
    }


    /* ========================================================
       DETERMINE DIMENSIONS
       ======================================================== */

    static determineDimensions(
        minimumDataCodewords,
        eccCount,
        options = {}
    ) {

        if (
            !Number.isInteger(minimumDataCodewords) ||
            minimumDataCodewords < 1
        ) {
            throw new TypeError(
                "PDF417 data codeword count must be positive."
            );
        }


        if (
            !Number.isInteger(eccCount) ||
            eccCount < 2
        ) {
            throw new TypeError(
                "Invalid PDF417 ECC codeword count."
            );
        }


        const required =
            minimumDataCodewords +
            eccCount;


        if (
            required >
            PDF417Encoder.MAX_CODEWORDS
        ) {
            throw new Error(
                "Encoded data exceeds the maximum PDF417 " +
                "symbol capacity."
            );
        }


        const requestedRows =
            PDF417Encoder.normaliseOptionalInteger(
                options.rows,
                PDF417Encoder.MIN_ROWS,
                PDF417Encoder.MAX_ROWS,
                "rows"
            );


        const requestedColumns =
            PDF417Encoder.normaliseOptionalInteger(
                options.columns,
                PDF417Encoder.MIN_COLUMNS,
                PDF417Encoder.MAX_COLUMNS,
                "columns"
            );


        /* ====================================================
           BOTH EXPLICIT
           ==================================================== */

        if (
            requestedRows !== null &&
            requestedColumns !== null
        ) {

            const capacity =
                requestedRows *
                requestedColumns;


            if (capacity < required) {
                throw new Error(
                    "Requested PDF417 dimensions " +
                    requestedColumns +
                    " × " +
                    requestedRows +
                    " are too small."
                );
            }


            if (
                capacity >
                PDF417Encoder.MAX_CODEWORDS
            ) {
                throw new Error(
                    "Requested PDF417 dimensions exceed " +
                    "the maximum codeword capacity."
                );
            }


            return {
                rows: requestedRows,
                columns: requestedColumns
            };
        }


        /* ====================================================
           COLUMNS EXPLICIT
           ==================================================== */

        if (
            requestedColumns !== null
        ) {

            const rows =
                Math.ceil(
                    required /
                    requestedColumns
                );


            if (
                rows <
                PDF417Encoder.MIN_ROWS ||
                rows >
                PDF417Encoder.MAX_ROWS
            ) {
                throw new Error(
                    "Unable to fit PDF417 data into " +
                    requestedColumns +
                    " columns."
                );
            }


            return {
                rows: rows,
                columns: requestedColumns
            };
        }


        /* ====================================================
           ROWS EXPLICIT
           ==================================================== */

        if (
            requestedRows !== null
        ) {

            const columns =
                Math.ceil(
                    required /
                    requestedRows
                );


            if (
                columns <
                PDF417Encoder.MIN_COLUMNS ||
                columns >
                PDF417Encoder.MAX_COLUMNS
            ) {
                throw new Error(
                    "Unable to fit PDF417 data into " +
                    requestedRows +
                    " rows."
                );
            }


            return {
                rows: requestedRows,
                columns: columns
            };
        }


        /* ====================================================
           AUTOMATIC DIMENSIONS
           ==================================================== */

        return PDF417Encoder.findBestDimensions(
            required,
            options.aspectRatio
        );
    }


    /* ========================================================
       AUTOMATIC DIMENSION SEARCH
       ======================================================== */

    static findBestDimensions(
        requiredCodewords,
        requestedAspectRatio = null
    ) {

        const targetAspect =
            PDF417Encoder.normaliseAspectRatio(
                requestedAspectRatio
            );


        let best = null;


        /*
         * PDF417 codewords are 17 modules wide.
         *
         * A rendered row also contains:
         *
         * start pattern
         * left row indicator
         * data columns
         * right row indicator
         * stop pattern
         *
         * Rows are normally several modules high.
         *
         * We therefore estimate physical width/height rather
         * than comparing raw column and row counts.
         */

        for (
            let columns =
                PDF417Encoder.MIN_COLUMNS;
            columns <=
                PDF417Encoder.MAX_COLUMNS;
            columns++
        ) {

            const rows =
                Math.ceil(
                    requiredCodewords /
                    columns
                );


            if (
                rows <
                PDF417Encoder.MIN_ROWS ||
                rows >
                PDF417Encoder.MAX_ROWS
            ) {
                continue;
            }


            const capacity =
                rows * columns;


            if (
                capacity >
                PDF417Encoder.MAX_CODEWORDS
            ) {
                continue;
            }


            /*
             * Approximate symbol dimensions in modules.
             */

            const width =
                17 +
                17 +
                columns * 17 +
                17 +
                18;


            /*
             * A common PDF417 row-height ratio is roughly
             * three modules.
             */

            const height =
                rows * 3;


            const aspect =
                width / height;


            const aspectDifference =
                Math.abs(
                    aspect -
                    targetAspect
                );


            const unused =
                capacity -
                requiredCodewords;


            /*
             * Strongly favour aspect ratio, then minimise
             * unused codeword positions.
             */

            const score =
                aspectDifference * 100 +
                unused;


            if (
                best === null ||
                score < best.score
            ) {

                best = {
                    rows: rows,
                    columns: columns,
                    capacity: capacity,
                    aspectRatio: aspect,
                    score: score
                };
            }
        }


        if (best === null) {
            throw new Error(
                "Unable to determine valid PDF417 dimensions."
            );
        }


        return {
            rows: best.rows,
            columns: best.columns
        };
    }


    /* ========================================================
       ERROR CORRECTION LEVEL
       ======================================================== */

    static resolveErrorCorrectionLevel(
        requested,
        dataLength
    ) {

        /*
         * Your shared application uses L/M/Q/H because QR
         * exposes those values.
         *
         * Translate them into sensible PDF417 levels.
         */

        if (
            typeof requested === "string"
        ) {

            const value =
                requested
                    .trim()
                    .toUpperCase();


            switch (value) {

                case "L":
                    return 1;

                case "M":
                    return 2;

                case "Q":
                    return 3;

                case "H":
                    return 4;
            }


            if (/^[0-8]$/.test(value)) {

                return Number(value);
            }
        }


        if (
            Number.isInteger(requested)
        ) {

            if (
                requested < 0 ||
                requested > 8
            ) {
                throw new RangeError(
                    "PDF417 error-correction level must " +
                    "be between 0 and 8."
                );
            }


            return requested;
        }


        /*
         * Automatic recommendation based roughly on the
         * amount of input data.
         */

        if (dataLength <= 40) {
            return 2;
        }

        if (dataLength <= 160) {
            return 3;
        }

        if (dataLength <= 320) {
            return 4;
        }

        return 5;
    }


    /* ========================================================
       ECC CODEWORD COUNT
       ======================================================== */

    static getErrorCorrectionCodewordCount(
        level
    ) {

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


        /*
         * PDF417:
         *
         * level 0 ->   2
         * level 1 ->   4
         * level 2 ->   8
         * ...
         * level 8 -> 512
         */

        return (
            1 <<
            (level + 1)
        );
    }


    /* ========================================================
       COMPACTION MODE NORMALISATION
       ======================================================== */

    static normaliseCompactionMode(
        mode
    ) {

        const value =
            String(mode || "auto")
                .trim()
                .toLowerCase();


        if (
            value !== "auto" &&
            value !== "text" &&
            value !== "byte" &&
            value !== "numeric"
        ) {
            throw new Error(
                "Invalid PDF417 compaction mode: " +
                mode
            );
        }


        return value;
    }


    /* ========================================================
       OPTIONAL INTEGER
       ======================================================== */

    static normaliseOptionalInteger(
        value,
        minimum,
        maximum,
        name
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }


        const number =
            Number(value);


        if (
            !Number.isInteger(number) ||
            number < minimum ||
            number > maximum
        ) {
            throw new RangeError(
                "PDF417 " +
                name +
                " must be between " +
                minimum +
                " and " +
                maximum +
                "."
            );
        }


        return number;
    }


    /* ========================================================
       ASPECT RATIO
       ======================================================== */

    static normaliseAspectRatio(
        value
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return (
                PDF417Encoder.DEFAULT_ASPECT_RATIO
            );
        }


        const number =
            Number(value);


        if (
            !Number.isFinite(number) ||
            number <= 0
        ) {
            throw new RangeError(
                "PDF417 aspect ratio must be positive."
            );
        }


        return number;
    }


    /* ========================================================
       PAYLOAD VALIDATION
       ======================================================== */

    static validatePayloadCodewords(
        codewords
    ) {

        if (!Array.isArray(codewords)) {
            throw new TypeError(
                "PDF417 payload codewords must be an array."
            );
        }


        for (
            let index = 0;
            index < codewords.length;
            index++
        ) {

            const value =
                codewords[index];


            /*
             * Compaction output may contain ordinary values
             * and control/latch values through 928.
             */

            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value > 928
            ) {
                throw new Error(
                    "Invalid PDF417 payload codeword at " +
                    "index " +
                    index +
                    ": " +
                    value
                );
            }
        }


        return true;
    }


    /* ========================================================
       CHECK WHETHER DIMENSIONS FIT
       ======================================================== */

    static fits(
        payloadCodewordCount,
        rows,
        columns,
        errorCorrectionLevel
    ) {

        if (
            !Number.isInteger(
                payloadCodewordCount
            ) ||
            payloadCodewordCount < 0
        ) {
            return false;
        }


        if (
            !Number.isInteger(rows) ||
            rows <
                PDF417Encoder.MIN_ROWS ||
            rows >
                PDF417Encoder.MAX_ROWS
        ) {
            return false;
        }


        if (
            !Number.isInteger(columns) ||
            columns <
                PDF417Encoder.MIN_COLUMNS ||
            columns >
                PDF417Encoder.MAX_COLUMNS
        ) {
            return false;
        }


        if (
            !Number.isInteger(
                errorCorrectionLevel
            ) ||
            errorCorrectionLevel < 0 ||
            errorCorrectionLevel > 8
        ) {
            return false;
        }


        const eccCount =
            PDF417Encoder
                .getErrorCorrectionCodewordCount(
                    errorCorrectionLevel
                );


        const required =
            1 +
            payloadCodewordCount +
            eccCount;


        return (
            rows * columns >= required &&
            rows * columns <=
                PDF417Encoder.MAX_CODEWORDS
        );
    }


    /* ========================================================
       SIMPLE ENCODE HELPER
       ======================================================== */

    static encodeCodewords(
        data,
        options = {}
    ) {

        return PDF417Encoder
            .encode(
                data,
                options
            )
            .dataCodewords;
    }
}