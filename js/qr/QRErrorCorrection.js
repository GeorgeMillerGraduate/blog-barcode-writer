/**
 * ============================================================
 * QR ERROR CORRECTION
 * ============================================================
 *
 * Implements Reed-Solomon error correction for QR Codes.
 *
 * QR Codes use Reed-Solomon error correction over GF(256).
 *
 * The finite field uses the primitive polynomial:
 *
 *     x^8 + x^4 + x^3 + x^2 + 1
 *
 * represented as:
 *
 *     0x11D
 *
 * Responsibilities:
 *
 *  - Initialise QR GF(256) logarithm/exponent tables
 *  - Perform finite-field multiplication
 *  - Generate Reed-Solomon generator polynomials
 *  - Calculate error-correction codewords
 *  - Process multiple QR blocks
 *  - Interleave data codewords
 *  - Interleave error-correction codewords
 *
 * This class does NOT decide how many blocks a QR version
 * requires. QRVersion.js supplies that information.
 *
 * ============================================================
 */

class QRErrorCorrection {


    /* ========================================================
       QR GALOIS FIELD CONSTANTS
       ======================================================== */

    static FIELD_SIZE = 256;

    static PRIMITIVE_POLYNOMIAL = 0x11D;


    /* ========================================================
       LOOKUP TABLES
       ======================================================== */

    static EXP_TABLE = null;

    static LOG_TABLE = null;


    /* ========================================================
       GENERATOR CACHE
       ======================================================== */

    static GENERATOR_CACHE = {};


    /* ========================================================
       INITIALISE GALOIS FIELD
       ======================================================== */

    static initialise() {

        if (
            QRErrorCorrection.EXP_TABLE !== null &&
            QRErrorCorrection.LOG_TABLE !== null
        ) {

            return;

        }


        /*
         * EXP_TABLE is deliberately extended to 512 entries.
         *
         * This allows multiplication to use:
         *
         *     EXP_TABLE[log(a) + log(b)]
         *
         * without repeatedly performing modulo 255.
         */

        QRErrorCorrection.EXP_TABLE =
            new Array(512);


        QRErrorCorrection.LOG_TABLE =
            new Array(256)
                .fill(0);


        let value = 1;


        for (
            let i = 0;
            i < 255;
            i++
        ) {

            QRErrorCorrection.EXP_TABLE[i] =
                value;


            QRErrorCorrection.LOG_TABLE[value] =
                i;


            value <<= 1;


            /*
             * Reduce the polynomial whenever x^8 is reached.
             */

            if (
                value & 0x100
            ) {

                value ^=
                    QRErrorCorrection
                        .PRIMITIVE_POLYNOMIAL;

            }

        }


        /*
         * Repeat the exponent table.
         */

        for (
            let i = 255;
            i < 512;
            i++
        ) {

            QRErrorCorrection.EXP_TABLE[i] =
                QRErrorCorrection
                    .EXP_TABLE[i - 255];

        }

    }


    /* ========================================================
       GALOIS FIELD MULTIPLICATION
       ======================================================== */

    /**
     * Multiplies two numbers in GF(256).
     *
     * @param {number} a
     * @param {number} b
     *
     * @returns {number}
     */
    static multiply(
        a,
        b
    ) {

        QRErrorCorrection.initialise();


        if (
            a === 0 ||
            b === 0
        ) {

            return 0;

        }


        const logA =
            QRErrorCorrection
                .LOG_TABLE[a];


        const logB =
            QRErrorCorrection
                .LOG_TABLE[b];


        return QRErrorCorrection
            .EXP_TABLE[
                logA + logB
            ];

    }


    /* ========================================================
       GALOIS FIELD DIVISION
       ======================================================== */

    static divide(
        a,
        b
    ) {

        QRErrorCorrection.initialise();


        if (b === 0) {

            throw new Error(
                "Cannot divide by zero in GF(256)."
            );

        }


        if (a === 0) {

            return 0;

        }


        let exponent =
            QRErrorCorrection.LOG_TABLE[a] -
            QRErrorCorrection.LOG_TABLE[b];


        if (
            exponent < 0
        ) {

            exponent += 255;

        }


        return QRErrorCorrection
            .EXP_TABLE[exponent];

    }


    /* ========================================================
       GALOIS FIELD POWER
       ======================================================== */

    static power(
        value,
        exponent
    ) {

        QRErrorCorrection.initialise();


        if (
            exponent === 0
        ) {

            return 1;

        }


        if (
            value === 0
        ) {

            return 0;

        }


        let resultExponent =
            (
                QRErrorCorrection.LOG_TABLE[value] *
                exponent
            ) % 255;


        if (
            resultExponent < 0
        ) {

            resultExponent += 255;

        }


        return QRErrorCorrection
            .EXP_TABLE[resultExponent];

    }


    /* ========================================================
       GENERATOR POLYNOMIAL
       ======================================================== */

    /**
     * Creates the Reed-Solomon generator polynomial for the
     * requested number of error-correction codewords.
     *
     * Generator:
     *
     *     (x - a^0)
     *     (x - a^1)
     *     ...
     *     (x - a^(n-1))
     *
     * In GF(2^8), subtraction and addition are both XOR.
     *
     * @param {number} degree
     *
     * @returns {number[]}
     */
    static createGeneratorPolynomial(
        degree
    ) {

        QRErrorCorrection.initialise();


        if (
            !Number.isInteger(degree) ||
            degree <= 0
        ) {

            throw new RangeError(
                "Reed-Solomon generator degree must be a positive integer."
            );

        }


        /*
         * Return cached generator if we have already
         * calculated this degree.
         */

        if (
            QRErrorCorrection
                .GENERATOR_CACHE[degree]
        ) {

            return QRErrorCorrection
                .GENERATOR_CACHE[degree]
                .slice();

        }


        /*
         * Start with polynomial:
         *
         *     1
         */

        let generator = [1];


        for (
            let i = 0;
            i < degree;
            i++
        ) {

            /*
             * Multiply by:
             *
             *     (x + a^i)
             *
             * Addition and subtraction are identical in GF(256).
             */

            const factor = [

                1,

                QRErrorCorrection
                    .EXP_TABLE[i]

            ];


            generator =
                QRErrorCorrection
                    .multiplyPolynomials(
                        generator,
                        factor
                    );

        }


        QRErrorCorrection
            .GENERATOR_CACHE[degree] =
                generator.slice();


        return generator;

    }


    /* ========================================================
       POLYNOMIAL MULTIPLICATION
       ======================================================== */

    /**
     * Multiplies two polynomials whose coefficients are
     * elements of GF(256).
     */
    static multiplyPolynomials(
        first,
        second
    ) {

        const result =
            new Array(
                first.length +
                second.length -
                1
            )
                .fill(0);


        for (
            let i = 0;
            i < first.length;
            i++
        ) {

            for (
                let j = 0;
                j < second.length;
                j++
            ) {

                result[i + j] ^=
                    QRErrorCorrection.multiply(
                        first[i],
                        second[j]
                    );

            }

        }


        return result;

    }


    /* ========================================================
       CALCULATE ERROR CORRECTION
       ======================================================== */

    /**
     * Calculates Reed-Solomon error-correction codewords for
     * one QR data block.
     *
     * @param {number[]} dataCodewords
     *        Data bytes belonging to one QR block.
     *
     * @param {number} errorCorrectionCodewordCount
     *        Number of EC codewords required.
     *
     * @returns {number[]}
     *          Reed-Solomon remainder.
     */
    static calculate(
        dataCodewords,
        errorCorrectionCodewordCount
    ) {

        QRErrorCorrection.validateCodewords(
            dataCodewords
        );


        if (
            !Number.isInteger(
                errorCorrectionCodewordCount
            ) ||
            errorCorrectionCodewordCount <= 0
        ) {

            throw new RangeError(
                "Error-correction codeword count must be a positive integer."
            );

        }


        const generator =
            QRErrorCorrection
                .createGeneratorPolynomial(
                    errorCorrectionCodewordCount
                );


        /*
         * Working message:
         *
         * Append n zero codewords to the data.
         *
         * This is equivalent to multiplying the message
         * polynomial by x^n.
         */

        const message =
            dataCodewords.slice();


        for (
            let i = 0;
            i < errorCorrectionCodewordCount;
            i++
        ) {

            message.push(0);

        }


        /*
         * Polynomial long division.
         */

        for (
            let i = 0;
            i < dataCodewords.length;
            i++
        ) {

            const coefficient =
                message[i];


            if (
                coefficient === 0
            ) {

                continue;

            }


            for (
                let j = 0;
                j < generator.length;
                j++
            ) {

                message[i + j] ^=
                    QRErrorCorrection.multiply(
                        generator[j],
                        coefficient
                    );

            }

        }


        /*
         * The remainder is the final n codewords.
         */

        return message.slice(
            message.length -
            errorCorrectionCodewordCount
        );

    }


    /* ========================================================
       PROCESS QR BLOCKS
       ======================================================== */

    /**
     * Calculates EC codewords for a collection of QR blocks.
     *
     * Input:
     *
     * [
     *     [data block 1],
     *     [data block 2],
     *     ...
     * ]
     *
     * Output:
     *
     * [
     *     {
     *         data: [...],
     *         errorCorrection: [...]
     *     },
     *     ...
     * ]
     *
     * @param {number[][]} dataBlocks
     * @param {number} ecCodewordsPerBlock
     *
     * @returns {object[]}
     */
    static calculateBlocks(
        dataBlocks,
        ecCodewordsPerBlock
    ) {

        if (
            !Array.isArray(
                dataBlocks
            ) ||
            dataBlocks.length === 0
        ) {

            throw new Error(
                "At least one QR data block is required."
            );

        }


        const result = [];


        for (
            let i = 0;
            i < dataBlocks.length;
            i++
        ) {

            const data =
                dataBlocks[i];


            QRErrorCorrection
                .validateCodewords(
                    data
                );


            const errorCorrection =
                QRErrorCorrection
                    .calculate(
                        data,
                        ecCodewordsPerBlock
                    );


            result.push({

                data:
                    data.slice(),

                errorCorrection:
                    errorCorrection

            });

        }


        return result;

    }


    /* ========================================================
       INTERLEAVE DATA CODEWORDS
       ======================================================== */

    /**
     * Interleaves data codewords from multiple QR blocks.
     *
     * Blocks are not always the same length.
     *
     * Example:
     *
     * Block A: A1 A2 A3
     * Block B: B1 B2 B3 B4
     *
     * Result:
     *
     * A1 B1 A2 B2 A3 B3 B4
     */
    static interleaveData(
        blocks
    ) {

        QRErrorCorrection
            .validateBlocks(
                blocks
            );


        const result = [];


        let maximumLength = 0;


        for (
            let i = 0;
            i < blocks.length;
            i++
        ) {

            maximumLength =
                Math.max(
                    maximumLength,
                    blocks[i].data.length
                );

        }


        for (
            let index = 0;
            index < maximumLength;
            index++
        ) {

            for (
                let block = 0;
                block < blocks.length;
                block++
            ) {

                if (
                    index <
                    blocks[block].data.length
                ) {

                    result.push(
                        blocks[block]
                            .data[index]
                    );

                }

            }

        }


        return result;

    }


    /* ========================================================
       INTERLEAVE ERROR-CORRECTION CODEWORDS
       ======================================================== */

    static interleaveErrorCorrection(
        blocks
    ) {

        QRErrorCorrection
            .validateBlocks(
                blocks
            );


        const result = [];


        let maximumLength = 0;


        for (
            let i = 0;
            i < blocks.length;
            i++
        ) {

            maximumLength =
                Math.max(
                    maximumLength,
                    blocks[i]
                        .errorCorrection
                        .length
                );

        }


        for (
            let index = 0;
            index < maximumLength;
            index++
        ) {

            for (
                let block = 0;
                block < blocks.length;
                block++
            ) {

                if (
                    index <
                    blocks[block]
                        .errorCorrection
                        .length
                ) {

                    result.push(
                        blocks[block]
                            .errorCorrection[index]
                    );

                }

            }

        }


        return result;

    }


    /* ========================================================
       CREATE FINAL INTERLEAVED CODEWORDS
       ======================================================== */

    /**
     * Combines interleaved data codewords followed by
     * interleaved error-correction codewords.
     *
     * @param {object[]} blocks
     *
     * @returns {number[]}
     */
    static interleave(
        blocks
    ) {

        const data =
            QRErrorCorrection
                .interleaveData(
                    blocks
                );


        const errorCorrection =
            QRErrorCorrection
                .interleaveErrorCorrection(
                    blocks
                );


        return data.concat(
            errorCorrection
        );

    }


    /* ========================================================
       SPLIT DATA INTO BLOCKS
       ======================================================== */

    /**
     * Splits sequential QR data codewords according to an array
     * describing the number of data codewords in each block.
     *
     * Example:
     *
     *     blockSizes = [15, 15, 16, 16]
     *
     * creates four blocks.
     *
     * @param {number[]} dataCodewords
     * @param {number[]} blockSizes
     *
     * @returns {number[][]}
     */
    static splitIntoBlocks(
        dataCodewords,
        blockSizes
    ) {

        QRErrorCorrection
            .validateCodewords(
                dataCodewords
            );


        if (
            !Array.isArray(
                blockSizes
            ) ||
            blockSizes.length === 0
        ) {

            throw new Error(
                "QR block sizes are required."
            );

        }


        let requiredCodewords = 0;


        for (
            let i = 0;
            i < blockSizes.length;
            i++
        ) {

            const size =
                blockSizes[i];


            if (
                !Number.isInteger(size) ||
                size <= 0
            ) {

                throw new Error(
                    "Every QR block size must be a positive integer."
                );

            }


            requiredCodewords +=
                size;

        }


        if (
            requiredCodewords !==
            dataCodewords.length
        ) {

            throw new Error(
                "QR block sizes require " +
                requiredCodewords +
                " data codewords, but " +
                dataCodewords.length +
                " were supplied."
            );

        }


        const blocks = [];


        let offset = 0;


        for (
            let i = 0;
            i < blockSizes.length;
            i++
        ) {

            const size =
                blockSizes[i];


            blocks.push(
                dataCodewords.slice(
                    offset,
                    offset + size
                )
            );


            offset +=
                size;

        }


        return blocks;

    }


    /* ========================================================
       COMPLETE BLOCK PROCESSING
       ======================================================== */

    /**
     * Convenience method.
     *
     * Takes all QR data codewords, splits them into the
     * required blocks, generates error correction and returns
     * both the block information and final interleaved stream.
     *
     * @param {number[]} dataCodewords
     * @param {number[]} blockSizes
     * @param {number} ecCodewordsPerBlock
     *
     * @returns {object}
     */
    static process(
        dataCodewords,
        blockSizes,
        ecCodewordsPerBlock
    ) {

        const dataBlocks =
            QRErrorCorrection
                .splitIntoBlocks(
                    dataCodewords,
                    blockSizes
                );


        const blocks =
            QRErrorCorrection
                .calculateBlocks(
                    dataBlocks,
                    ecCodewordsPerBlock
                );


        const interleavedData =
            QRErrorCorrection
                .interleaveData(
                    blocks
                );


        const interleavedErrorCorrection =
            QRErrorCorrection
                .interleaveErrorCorrection(
                    blocks
                );


        const codewords =
            interleavedData.concat(
                interleavedErrorCorrection
            );


        return {

            blocks:
                blocks,

            interleavedData:
                interleavedData,

            interleavedErrorCorrection:
                interleavedErrorCorrection,

            codewords:
                codewords

        };

    }


    /* ========================================================
       CODEWORDS TO BITS
       ======================================================== */

    /**
     * Converts complete QR codewords into a flat bit array.
     */
    static codewordsToBits(
        codewords
    ) {

        QRErrorCorrection
            .validateCodewords(
                codewords
            );


        const bits = [];


        for (
            let i = 0;
            i < codewords.length;
            i++
        ) {

            const value =
                codewords[i];


            for (
                let bit = 7;
                bit >= 0;
                bit--
            ) {

                bits.push(
                    Math.floor(
                        value /
                        Math.pow(
                            2,
                            bit
                        )
                    ) % 2
                );

            }

        }


        return bits;

    }


    /* ========================================================
       VALIDATE CODEWORDS
       ======================================================== */

    static validateCodewords(
        codewords
    ) {

        if (
            !Array.isArray(
                codewords
            )
        ) {

            throw new TypeError(
                "QR codewords must be supplied as an array."
            );

        }


        for (
            let i = 0;
            i < codewords.length;
            i++
        ) {

            const value =
                codewords[i];


            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value > 255
            ) {

                throw new RangeError(
                    "Invalid QR codeword at index " +
                    i +
                    ". Codewords must be integers from 0 to 255."
                );

            }

        }

    }


    /* ========================================================
       VALIDATE PROCESSED BLOCKS
       ======================================================== */

    static validateBlocks(
        blocks
    ) {

        if (
            !Array.isArray(blocks) ||
            blocks.length === 0
        ) {

            throw new Error(
                "At least one processed QR block is required."
            );

        }


        for (
            let i = 0;
            i < blocks.length;
            i++
        ) {

            const block =
                blocks[i];


            if (
                !block ||
                !Array.isArray(
                    block.data
                ) ||
                !Array.isArray(
                    block.errorCorrection
                )
            ) {

                throw new Error(
                    "Invalid processed QR block at index " +
                    i +
                    "."
                );

            }


            QRErrorCorrection
                .validateCodewords(
                    block.data
                );


            QRErrorCorrection
                .validateCodewords(
                    block.errorCorrection
                );

        }

    }

}