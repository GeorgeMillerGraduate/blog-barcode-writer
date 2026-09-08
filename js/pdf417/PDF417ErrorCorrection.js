/**
 * ============================================================
 * PDF417ErrorCorrection.js
 * ============================================================
 *
 * Reed-Solomon error correction for PDF417.
 *
 * PDF417 performs error correction over the prime field
 * modulo 929.
 *
 * Supported levels:
 *
 *   Level 0 ->   2 ECC codewords
 *   Level 1 ->   4 ECC codewords
 *   Level 2 ->   8 ECC codewords
 *   Level 3 ->  16 ECC codewords
 *   Level 4 ->  32 ECC codewords
 *   Level 5 ->  64 ECC codewords
 *   Level 6 -> 128 ECC codewords
 *   Level 7 -> 256 ECC codewords
 *   Level 8 -> 512 ECC codewords
 *
 * Pipeline:
 *
 * PDF417Compaction
 *      ↓
 * PDF417Encoder
 *      ↓
 * dataCodewords
 *      ↓
 * PDF417ErrorCorrection
 *      ↓
 * complete codeword sequence
 *      ↓
 * PDF417Matrix
 *
 * ============================================================
 */

class PDF417ErrorCorrection {

    /* ========================================================
       CONSTANTS
       ======================================================== */

    static MODULUS = 929;

    static GENERATOR_BASE = 3;

    static MIN_LEVEL = 0;

    static MAX_LEVEL = 8;


    /* ========================================================
       GENERATOR CACHE
       ======================================================== */

    static generatorCache = {};


    /* ========================================================
       PUBLIC GENERATE
       ======================================================== */

    static generate(
        dataCodewords,
        level = 2
    ) {

        PDF417ErrorCorrection.validateLevel(
            level
        );

        PDF417ErrorCorrection.validateCodewords(
            dataCodewords
        );


        const eccCount =
            PDF417ErrorCorrection
                .getCodewordCount(
                    level
                );


        const coefficients =
            PDF417ErrorCorrection
                .getGeneratorCoefficients(
                    level
                );


        const ecc =
            new Array(
                eccCount
            ).fill(0);


        /*
         * PDF417 error correction recurrence.
         *
         * All arithmetic is performed modulo 929.
         */

        for (
            let dataIndex = 0;
            dataIndex < dataCodewords.length;
            dataIndex++
        ) {

            const dataValue =
                dataCodewords[
                    dataIndex
                ];


            const t1 =
                (
                    dataValue +
                    ecc[
                        eccCount - 1
                    ]
                ) %
                PDF417ErrorCorrection.MODULUS;


            for (
                let index =
                    eccCount - 1;
                index >= 1;
                index--
            ) {

                const product =
                    (
                        t1 *
                        coefficients[index]
                    ) %
                    PDF417ErrorCorrection.MODULUS;


                const t2 =
                    PDF417ErrorCorrection.MODULUS -
                    product;


                ecc[index] =
                    (
                        ecc[index - 1] +
                        t2
                    ) %
                    PDF417ErrorCorrection.MODULUS;
            }


            const product =
                (
                    t1 *
                    coefficients[0]
                ) %
                PDF417ErrorCorrection.MODULUS;


            ecc[0] =
                (
                    PDF417ErrorCorrection.MODULUS -
                    product
                ) %
                PDF417ErrorCorrection.MODULUS;
        }


        /*
         * PDF417 complements non-zero ECC values.
         */

        for (
            let index = 0;
            index < ecc.length;
            index++
        ) {

            if (ecc[index] !== 0) {

                ecc[index] =
                    PDF417ErrorCorrection.MODULUS -
                    ecc[index];
            }
        }


        /*
         * ECC registers are emitted in reverse order.
         */

        ecc.reverse();


        return ecc;
    }


    /* ========================================================
       GENERATE AND APPEND
       ======================================================== */

    static append(
        dataCodewords,
        level = 2
    ) {

        const ecc =
            PDF417ErrorCorrection.generate(
                dataCodewords,
                level
            );


        return dataCodewords.concat(
            ecc
        );
    }


    /* ========================================================
       GENERATE DETAILED RESULT
       ======================================================== */

    static generateDetailed(
        dataCodewords,
        level = 2
    ) {

        const ecc =
            PDF417ErrorCorrection.generate(
                dataCodewords,
                level
            );


        return {

            level:
                level,

            errorCorrectionCodewordCount:
                ecc.length,

            dataCodewords:
                dataCodewords.slice(),

            errorCorrectionCodewords:
                ecc,

            codewords:
                dataCodewords.concat(
                    ecc
                )
        };
    }


    /* ========================================================
       NUMBER OF ECC CODEWORDS
       ======================================================== */

    static getCodewordCount(level) {

        PDF417ErrorCorrection.validateLevel(
            level
        );


        return (
            1 <<
            (level + 1)
        );
    }


    /* ========================================================
       ALIAS
       ======================================================== */

    static getErrorCorrectionCodewordCount(
        level
    ) {

        return PDF417ErrorCorrection
            .getCodewordCount(
                level
            );
    }


    /* ========================================================
       GENERATOR COEFFICIENTS
       ======================================================== */

    static getGeneratorCoefficients(
        level
    ) {

        PDF417ErrorCorrection.validateLevel(
            level
        );


        if (
            PDF417ErrorCorrection
                .generatorCache[level]
        ) {

            return PDF417ErrorCorrection
                .generatorCache[level]
                .slice();
        }


        const degree =
            PDF417ErrorCorrection
                .getCodewordCount(
                    level
                );


        /*
         * PDF417 generator polynomial:
         *
         * G(x) =
         *
         * (x - 3^1)
         * (x - 3^2)
         * ...
         * (x - 3^k)
         *
         * over GF(929), where k is the number of
         * error-correction codewords.
         */

        let polynomial = [1];


        for (
            let exponent = 1;
            exponent <= degree;
            exponent++
        ) {

            const root =
                PDF417ErrorCorrection.modPow(
                    PDF417ErrorCorrection
                        .GENERATOR_BASE,

                    exponent,

                    PDF417ErrorCorrection
                        .MODULUS
                );


            /*
             * Multiply current polynomial by:
             *
             *     (x - root)
             *
             * represented in ascending coefficient order as:
             *
             *     [-root, 1]
             */

            const factor = [
                PDF417ErrorCorrection.mod(
                    -root
                ),
                1
            ];


            polynomial =
                PDF417ErrorCorrection
                    .multiplyPolynomials(
                        polynomial,
                        factor
                    );
        }


        /*
         * The recurrence used by generate() needs the
         * coefficients below the leading x^k term.
         *
         * polynomial is stored:
         *
         *     [constant, x, x², ..., x^k]
         *
         * so remove the final leading coefficient (1).
         */

        const coefficients =
            polynomial.slice(
                0,
                degree
            );


        PDF417ErrorCorrection
            .generatorCache[level] =
                coefficients.slice();


        return coefficients;
    }


    /* ========================================================
       POLYNOMIAL MULTIPLICATION
       ======================================================== */

    static multiplyPolynomials(
        first,
        second
    ) {

        if (
            !Array.isArray(first) ||
            !Array.isArray(second)
        ) {

            throw new TypeError(
                "PDF417 polynomials must be arrays."
            );
        }


        const result =
            new Array(
                first.length +
                second.length -
                1
            ).fill(0);


        for (
            let firstIndex = 0;
            firstIndex < first.length;
            firstIndex++
        ) {

            for (
                let secondIndex = 0;
                secondIndex < second.length;
                secondIndex++
            ) {

                const targetIndex =
                    firstIndex +
                    secondIndex;


                const product =
                    first[firstIndex] *
                    second[secondIndex];


                result[targetIndex] =
                    PDF417ErrorCorrection.mod(
                        result[targetIndex] +
                        product
                    );
            }
        }


        return result;
    }


    /* ========================================================
       MODULAR EXPONENTIATION
       ======================================================== */

    static modPow(
        base,
        exponent,
        modulus =
            PDF417ErrorCorrection.MODULUS
    ) {

        if (
            !Number.isInteger(base) ||
            !Number.isInteger(exponent) ||
            exponent < 0
        ) {

            throw new TypeError(
                "Invalid modular exponentiation arguments."
            );
        }


        let result = 1;

        let value =
            PDF417ErrorCorrection.mod(
                base,
                modulus
            );

        let power =
            exponent;


        while (power > 0) {

            if (
                power % 2 === 1
            ) {

                result =
                    (
                        result *
                        value
                    ) %
                    modulus;
            }


            value =
                (
                    value *
                    value
                ) %
                modulus;


            power =
                Math.floor(
                    power / 2
                );
        }


        return result;
    }


    /* ========================================================
       MODULO
       ======================================================== */

    static mod(
        value,
        modulus =
            PDF417ErrorCorrection.MODULUS
    ) {

        return (
            (
                value % modulus
            ) +
            modulus
        ) % modulus;
    }


    /* ========================================================
       VALIDATE LEVEL
       ======================================================== */

    static validateLevel(level) {

        if (
            !Number.isInteger(level) ||
            level <
                PDF417ErrorCorrection.MIN_LEVEL ||
            level >
                PDF417ErrorCorrection.MAX_LEVEL
        ) {

            throw new RangeError(
                "PDF417 error-correction level must be " +
                "an integer between 0 and 8."
            );
        }


        return true;
    }


    /* ========================================================
       VALIDATE DATA CODEWORDS
       ======================================================== */

    static validateCodewords(
        codewords
    ) {

        if (
            !Array.isArray(codewords)
        ) {

            throw new TypeError(
                "PDF417 data codewords must be an array."
            );
        }


        if (
            codewords.length === 0
        ) {

            throw new Error(
                "PDF417 data codeword array cannot be empty."
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
             * At this stage the data sequence contains actual
             * base-929 field elements. All values therefore
             * have to be in the range 0..928.
             */

            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value >=
                    PDF417ErrorCorrection.MODULUS
            ) {

                throw new RangeError(
                    "Invalid PDF417 codeword at index " +
                    index +
                    ": " +
                    value +
                    ". Expected 0..928."
                );
            }
        }


        return true;
    }


    /* ========================================================
       VALIDATE ECC ARRAY
       ======================================================== */

    static validateErrorCorrection(
        codewords,
        level
    ) {

        PDF417ErrorCorrection.validateLevel(
            level
        );


        if (
            !Array.isArray(codewords)
        ) {

            return false;
        }


        const expected =
            PDF417ErrorCorrection
                .getCodewordCount(
                    level
                );


        if (
            codewords.length !==
            expected
        ) {

            return false;
        }


        for (const value of codewords) {

            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value >=
                    PDF417ErrorCorrection.MODULUS
            ) {

                return false;
            }
        }


        return true;
    }


    /* ========================================================
       CLEAR GENERATOR CACHE
       ======================================================== */

    static clearCache() {

        PDF417ErrorCorrection
            .generatorCache = {};
    }


    /* ========================================================
       GET GENERATOR POLYNOMIAL
       ======================================================== */

    static getGeneratorPolynomial(
        level
    ) {

        PDF417ErrorCorrection.validateLevel(
            level
        );


        const degree =
            PDF417ErrorCorrection
                .getCodewordCount(
                    level
                );


        let polynomial = [1];


        for (
            let exponent = 1;
            exponent <= degree;
            exponent++
        ) {

            const root =
                PDF417ErrorCorrection.modPow(
                    PDF417ErrorCorrection
                        .GENERATOR_BASE,
                    exponent
                );


            polynomial =
                PDF417ErrorCorrection
                    .multiplyPolynomials(
                        polynomial,
                        [
                            PDF417ErrorCorrection.mod(
                                -root
                            ),
                            1
                        ]
                    );
        }


        return polynomial;
    }


    /* ========================================================
       DEBUG INFORMATION
       ======================================================== */

    static describe(level) {

        PDF417ErrorCorrection.validateLevel(
            level
        );


        const count =
            PDF417ErrorCorrection
                .getCodewordCount(
                    level
                );


        return {

            level:
                level,

            modulus:
                PDF417ErrorCorrection.MODULUS,

            generatorBase:
                PDF417ErrorCorrection.GENERATOR_BASE,

            errorCorrectionCodewords:
                count,

            generatorDegree:
                count,

            generatorCoefficients:
                PDF417ErrorCorrection
                    .getGeneratorCoefficients(
                        level
                    )
        };
    }
}