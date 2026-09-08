/**
 * ============================================================
 * MicroQRErrorCorrection.js
 * ============================================================
 *
 * Reed-Solomon error correction for Micro QR Codes.
 *
 * Responsibilities:
 *  - Work in GF(256)
 *  - Generate Reed-Solomon generator polynomials
 *  - Calculate error-correction codewords
 *  - Append ECC codewords to data codewords
 *
 * Encoding, matrix placement and masking are handled by the
 * other Micro QR classes.
 *
 * GF(256):
 *      primitive polynomial = x^8 + x^4 + x^3 + x^2 + 1
 *                           = 0x11D
 * ============================================================
 */

class MicroQRErrorCorrection {

    /* ========================================================
       FIELD CONSTANTS
       ======================================================== */

    static PRIMITIVE_POLYNOMIAL = 0x11D;

    static FIELD_SIZE = 256;

    static EXP_TABLE = null;

    static LOG_TABLE = null;


    /* ========================================================
       INITIALISE GALOIS FIELD
       ======================================================== */

    static initialiseField() {

        if (
            MicroQRErrorCorrection.EXP_TABLE !== null &&
            MicroQRErrorCorrection.LOG_TABLE !== null
        ) {
            return;
        }

        const exp = new Array(512).fill(0);
        const log = new Array(256).fill(0);

        let value = 1;

        for (let index = 0; index < 255; index++) {

            exp[index] = value;
            log[value] = index;

            value <<= 1;

            if (value & 0x100) {
                value ^=
                    MicroQRErrorCorrection.PRIMITIVE_POLYNOMIAL;
            }
        }


        /*
         * Duplicate the exponent table so multiplication can
         * avoid an explicit modulo operation.
         */

        for (let index = 255; index < 512; index++) {
            exp[index] = exp[index - 255];
        }

        MicroQRErrorCorrection.EXP_TABLE = exp;
        MicroQRErrorCorrection.LOG_TABLE = log;
    }


    /* ========================================================
       PUBLIC ECC GENERATOR
       ======================================================== */

    static generate(dataCodewords, errorCorrectionCodewords) {

        MicroQRErrorCorrection.validateCodewords(
            dataCodewords
        );

        if (
            !Number.isInteger(errorCorrectionCodewords) ||
            errorCorrectionCodewords < 0
        ) {
            throw new TypeError(
                "Error-correction codeword count must be " +
                "a non-negative integer."
            );
        }


        if (errorCorrectionCodewords === 0) {
            return [];
        }


        MicroQRErrorCorrection.initialiseField();


        const generator =
            MicroQRErrorCorrection.createGeneratorPolynomial(
                errorCorrectionCodewords
            );


        /*
         * Polynomial long division.
         *
         * The data polynomial is multiplied by x^n by adding
         * n zero coefficients to the end.
         */

        const message =
            dataCodewords.slice();

        for (
            let index = 0;
            index < errorCorrectionCodewords;
            index++
        ) {
            message.push(0);
        }


        for (
            let index = 0;
            index < dataCodewords.length;
            index++
        ) {

            const coefficient = message[index];

            if (coefficient === 0) {
                continue;
            }

            const logCoefficient =
                MicroQRErrorCorrection.LOG_TABLE[
                    coefficient
                ];


            for (
                let generatorIndex = 0;
                generatorIndex < generator.length;
                generatorIndex++
            ) {

                const generatorCoefficient =
                    generator[generatorIndex];

                if (generatorCoefficient === 0) {
                    continue;
                }


                const product =
                    MicroQRErrorCorrection.EXP_TABLE[
                        logCoefficient +
                        MicroQRErrorCorrection.LOG_TABLE[
                            generatorCoefficient
                        ]
                    ];


                message[
                    index + generatorIndex
                ] ^= product;
            }
        }


        return message.slice(
            message.length - errorCorrectionCodewords
        );
    }


    /* ========================================================
       ALIAS
       ======================================================== */

    static calculate(dataCodewords, errorCorrectionCodewords) {

        return MicroQRErrorCorrection.generate(
            dataCodewords,
            errorCorrectionCodewords
        );
    }


    /* ========================================================
       GENERATE COMPLETE CODEWORD ARRAY
       ======================================================== */

    static append(dataCodewords, errorCorrectionCodewords) {

        const ecc =
            MicroQRErrorCorrection.generate(
                dataCodewords,
                errorCorrectionCodewords
            );

        return dataCodewords.concat(ecc);
    }


    /* ========================================================
       GENERATOR POLYNOMIAL
       ======================================================== */

    static createGeneratorPolynomial(degree) {

        if (
            !Number.isInteger(degree) ||
            degree < 1
        ) {
            throw new TypeError(
                "Generator polynomial degree must be " +
                "a positive integer."
            );
        }


        MicroQRErrorCorrection.initialiseField();


        /*
         * Start with polynomial 1.
         *
         * Then multiply successively by:
         *
         *     (x - α^0)
         *     (x - α^1)
         *     ...
         *     (x - α^(degree - 1))
         *
         * Addition and subtraction are identical in GF(256),
         * so subtraction becomes XOR.
         */

        let polynomial = [1];


        for (
            let exponent = 0;
            exponent < degree;
            exponent++
        ) {

            polynomial =
                MicroQRErrorCorrection.multiplyPolynomials(
                    polynomial,
                    [
                        1,
                        MicroQRErrorCorrection.EXP_TABLE[
                            exponent
                        ]
                    ]
                );
        }


        return polynomial;
    }


    /* ========================================================
       POLYNOMIAL MULTIPLICATION
       ======================================================== */

    static multiplyPolynomials(first, second) {

        if (
            !Array.isArray(first) ||
            !Array.isArray(second)
        ) {
            throw new TypeError(
                "Polynomial coefficients must be arrays."
            );
        }


        const result =
            new Array(
                first.length +
                second.length -
                1
            )
            .fill(0);


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

                const product =
                    MicroQRErrorCorrection.multiply(
                        first[firstIndex],
                        second[secondIndex]
                    );


                result[
                    firstIndex + secondIndex
                ] ^= product;
            }
        }


        return result;
    }


    /* ========================================================
       GALOIS FIELD MULTIPLICATION
       ======================================================== */

    static multiply(first, second) {

        MicroQRErrorCorrection.initialiseField();


        MicroQRErrorCorrection.validateFieldValue(first);
        MicroQRErrorCorrection.validateFieldValue(second);


        if (
            first === 0 ||
            second === 0
        ) {
            return 0;
        }


        return MicroQRErrorCorrection.EXP_TABLE[
            MicroQRErrorCorrection.LOG_TABLE[first] +
            MicroQRErrorCorrection.LOG_TABLE[second]
        ];
    }


    /* ========================================================
       GALOIS FIELD DIVISION
       ======================================================== */

    static divide(first, second) {

        MicroQRErrorCorrection.initialiseField();


        MicroQRErrorCorrection.validateFieldValue(first);
        MicroQRErrorCorrection.validateFieldValue(second);


        if (second === 0) {
            throw new Error(
                "Division by zero in GF(256)."
            );
        }


        if (first === 0) {
            return 0;
        }


        let exponent =
            MicroQRErrorCorrection.LOG_TABLE[first] -
            MicroQRErrorCorrection.LOG_TABLE[second];


        if (exponent < 0) {
            exponent += 255;
        }


        return MicroQRErrorCorrection.EXP_TABLE[
            exponent
        ];
    }


    /* ========================================================
       GALOIS FIELD POWER
       ======================================================== */

    static power(exponent) {

        MicroQRErrorCorrection.initialiseField();


        if (!Number.isInteger(exponent)) {
            throw new TypeError(
                "GF exponent must be an integer."
            );
        }


        let normalised =
            exponent % 255;


        if (normalised < 0) {
            normalised += 255;
        }


        return MicroQRErrorCorrection.EXP_TABLE[
            normalised
        ];
    }


    /* ========================================================
       BYTE VALIDATION
       ======================================================== */

    static validateFieldValue(value) {

        if (
            !Number.isInteger(value) ||
            value < 0 ||
            value > 255
        ) {
            throw new RangeError(
                "GF(256) value must be an integer " +
                "between 0 and 255."
            );
        }
    }


    /* ========================================================
       CODEWORD VALIDATION
       ======================================================== */

    static validateCodewords(codewords) {

        if (
            !Array.isArray(codewords) &&
            !(codewords instanceof Uint8Array)
        ) {
            throw new TypeError(
                "Micro QR data codewords must be an array."
            );
        }


        for (const codeword of codewords) {

            MicroQRErrorCorrection.validateFieldValue(
                codeword
            );
        }
    }


    /* ========================================================
       BIT STRING -> CODEWORDS
       ======================================================== */

    static bitsToCodewords(bits) {

        if (typeof bits !== "string") {
            throw new TypeError(
                "bitsToCodewords() requires a bit string."
            );
        }


        if (!/^[01]*$/.test(bits)) {
            throw new Error(
                "Bit string may contain only 0 and 1."
            );
        }


        const codewords = [];


        for (
            let index = 0;
            index < bits.length;
            index += 8
        ) {

            const chunk =
                bits
                    .substring(index, index + 8)
                    .padEnd(8, "0");


            codewords.push(
                parseInt(chunk, 2)
            );
        }


        return codewords;
    }


    /* ========================================================
       CODEWORDS -> BIT STRING
       ======================================================== */

    static codewordsToBits(codewords) {

        MicroQRErrorCorrection.validateCodewords(
            codewords
        );


        let result = "";


        for (const codeword of codewords) {

            result +=
                codeword
                    .toString(2)
                    .padStart(8, "0");
        }


        return result;
    }


    /* ========================================================
       COMPLETE BIT-STREAM HELPER
       ======================================================== */

    static generateBits(
        dataBits,
        errorCorrectionCodewords
    ) {

        const dataCodewords =
            MicroQRErrorCorrection.bitsToCodewords(
                dataBits
            );


        const ecc =
            MicroQRErrorCorrection.generate(
                dataCodewords,
                errorCorrectionCodewords
            );


        return {
            dataCodewords: dataCodewords,
            errorCorrectionCodewords: ecc,

            codewords:
                dataCodewords.concat(ecc),

            bits:
                MicroQRErrorCorrection.codewordsToBits(
                    dataCodewords.concat(ecc)
                )
        };
    }


    /* ========================================================
       DEBUG / VERIFICATION HELPER
       ======================================================== */

    static getGeneratorPolynomial(degree) {

        return MicroQRErrorCorrection
            .createGeneratorPolynomial(degree)
            .slice();
    }
}