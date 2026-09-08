/**
 * AztecGenerator
 *
 * Coordinates:
 *   1. High-level data encoding.
 *   2. Layer selection and bit stuffing.
 *   3. Reed-Solomon error correction.
 *   4. Mode-message generation.
 *   5. Matrix construction.
 *
 * Public API:
 *   AztecGenerator.generate(data, options)
 *
 * Required layer-manager API:
 *
 *   AztecLayerManager.selectLayers(bits, {
 *       errorCorrectionPercent: number,
 *       layers: number,          // 0 = automatic
 *       compact: boolean|null   // null = automatic
 *   })
 *
 *   Returns:
 *   {
 *       compact: boolean,
 *       layers: number,
 *       wordSize: number,
 *       totalBits: number,
 *       stuffedBits: number[]
 *   }
 *
 * Required matrix API:
 *
 *   AztecMatrix.build({
 *       compact: boolean,
 *       layers: number,
 *       messageBits: number[],
 *       modeMessage: number[]
 *   })
 *
 *   Returns a square, row-major array:
 *       matrix[y][x] = 0 or 1, or false or true
 *
 * Rendering is handled separately by BarcodeRenderer.
 */
class AztecGenerator {

    /**
     * Generate an Aztec symbol.
     *
     * @param {string|Uint8Array} data
     * @param {Object} [options={}]
     * @param {number} [options.errorCorrectionPercent]
     * @param {string|number} [options.errorCorrection="M"]
     * @param {number} [options.layers=0]
     * @param {boolean|null} [options.compact=null]
     * @returns {Object}
     */
    static generate(data, options = {}) {
        AztecGenerator.checkDependencies();

        const settings = AztecGenerator.normaliseOptions(options);

        /* 1. Convert the input into high-level Aztec bits. */
        const encoded = AztecEncoder.encode(data);

        /*
         * 2. Select a suitable symbol.
         *
         * The layer manager must:
         *   - Try the permitted layer counts.
         *   - Select the corresponding word size.
         *   - Bit-stuff the high-level stream.
         *   - Pad its final data word.
         *   - Check payload and error-correction capacity.
         */
        const layout = AztecLayerManager.selectLayers(
            encoded.bits,
            settings
        );

        AztecGenerator.validateLayout(layout, settings);

        const dataWords =
            layout.stuffedBits.length / layout.wordSize;

        const totalWords =
            Math.floor(layout.totalBits / layout.wordSize);

        const errorCorrectionWords =
            totalWords - dataWords;

        /*
         * Require the requested parity budget, plus 11 bits.
         * Percentages describe overhead relative to the
         * high-level input bit count, not damage tolerance.
         */
        const requiredErrorBits = Math.floor(
            encoded.bitLength *
            settings.errorCorrectionPercent / 100
        ) + 11;

        if (
            errorCorrectionWords * layout.wordSize <
            requiredErrorBits
        ) {
            throw new Error(
                "The selected Aztec layers do not provide " +
                "enough error-correction capacity."
            );
        }

        /* 3. Append parity and any leading capacity padding. */
        const messageBits =
            AztecErrorCorrection.generateCheckWords(
                layout.stuffedBits,
                layout.totalBits,
                layout.wordSize
            );

        /* 4. Protect the layer and data-word information. */
        const modeMessage =
            AztecErrorCorrection.generateModeMessage(
                layout.compact,
                layout.layers,
                dataWords
            );

        /* 5. Place the message and structural patterns. */
        const matrix = AztecMatrix.build({
            compact: layout.compact,
            layers: layout.layers,
            messageBits,
            modeMessage
        });

        AztecGenerator.validateMatrix(
            matrix,
            layout.compact,
            layout.layers
        );

        /*
         * Return a plain symbol object.
         *
         * Width and height are module counts, not pixels.
         * Colours, module size and fancy rendering are applied
         * later by BarcodeRenderer.
         */
        return {
            format: "aztec",
            type: "aztec",

            matrix,
            width: matrix.length,
            height: matrix.length,

            compact: layout.compact,
            layers: layout.layers,
            wordSize: layout.wordSize,

            dataWords,
            errorCorrectionWords,
            totalWords,
            totalBits: layout.totalBits,

            errorCorrectionPercent:
                settings.errorCorrectionPercent,

            byteLength: encoded.byteLength,
            encoding: encoded.encoding,
            eci: encoded.eci
        };
    }

    /**
     * Convert UI options into Aztec generation settings.
     *
     * The existing UI uses QR-style labels L/M/Q/H.
     * Their mapping below is an application convention,
     * not a set of official Aztec correction levels.
     *
     * An explicit errorCorrectionPercent takes precedence.
     *
     * @param {Object} options
     * @returns {{
     *   errorCorrectionPercent: number,
     *   layers: number,
     *   compact: boolean|null
     * }}
     */
    static normaliseOptions(options) {
        if (
            options === null ||
            typeof options !== "object" ||
            Array.isArray(options)
        ) {
            throw new TypeError(
                "Aztec options must be an object."
            );
        }

        const presets = {
            L: 23,
            M: 33,
            Q: 50,
            H: 65
        };

        let errorCorrectionPercent;

        if (options.errorCorrectionPercent !== undefined) {
            errorCorrectionPercent =
                options.errorCorrectionPercent;
        } else if (typeof options.errorCorrection === "number") {
            errorCorrectionPercent =
                options.errorCorrection;
        } else {
            const level = String(
                options.errorCorrection ?? "M"
            ).trim().toUpperCase();

            if (
                !Object.prototype.hasOwnProperty.call(
                    presets,
                    level
                )
            ) {
                throw new RangeError(
                    "Unknown error-correction setting. " +
                    "Use L, M, Q, H or a numeric percentage."
                );
            }

            errorCorrectionPercent = presets[level];
        }

        if (
            typeof errorCorrectionPercent !== "number" ||
            !Number.isFinite(errorCorrectionPercent) ||
            errorCorrectionPercent < 0 ||
            errorCorrectionPercent > 100
        ) {
            throw new RangeError(
                "Error-correction percentage must be " +
                "a number from 0 to 100."
            );
        }

        const layers = options.layers ?? 0;
        const compact = options.compact ?? null;

        if (
            !Number.isInteger(layers) ||
            layers < 0 ||
            layers > 32
        ) {
            throw new RangeError(
                "Layers must be 0 for automatic selection, " +
                "or an integer from 1 to 32."
            );
        }

        if (
            compact !== null &&
            typeof compact !== "boolean"
        ) {
            throw new TypeError(
                "Compact must be true, false or null."
            );
        }

        if (compact === true && layers > 4) {
            throw new RangeError(
                "Compact Aztec symbols support at most 4 layers."
            );
        }

        return {
            errorCorrectionPercent,
            layers,
            compact
        };
    }

    /**
     * Verify the layer manager's result before generating parity.
     *
     * @param {Object} layout
     * @param {Object} settings
     */
    static validateLayout(layout, settings) {
        if (!layout || typeof layout !== "object") {
            throw new Error(
                "AztecLayerManager returned no layout."
            );
        }

        const {
            compact,
            layers,
            wordSize,
            totalBits,
            stuffedBits
        } = layout;

        if (typeof compact !== "boolean") {
            throw new Error(
                "The selected layout must specify compact mode."
            );
        }

        const maxLayers = compact ? 4 : 32;

        if (
            !Number.isInteger(layers) ||
            layers < 1 ||
            layers > maxLayers
        ) {
            throw new Error(
                "The layer manager returned an invalid layer count."
            );
        }

        if (
            settings.layers !== 0 &&
            layers !== settings.layers
        ) {
            throw new Error(
                "The selected layout does not match the requested layers."
            );
        }

        if (
            settings.compact !== null &&
            compact !== settings.compact
        ) {
            throw new Error(
                "The selected layout does not match the requested mode."
            );
        }

        const expectedWordSize =
            layers <= 2 ? 6 :
            layers <= 8 ? 8 :
            layers <= 22 ? 10 :
            12;

        if (wordSize !== expectedWordSize) {
            throw new Error(
                "The selected word size is incorrect for these layers."
            );
        }

        const expectedTotalBits =
            ((compact ? 88 : 112) + 16 * layers) * layers;

        if (totalBits !== expectedTotalBits) {
            throw new Error(
                "The selected layout has an incorrect bit capacity."
            );
        }

        AztecErrorCorrection.validateBits(stuffedBits);

        if (
            stuffedBits.length === 0 ||
            stuffedBits.length % wordSize !== 0
        ) {
            throw new Error(
                "Stuffed data must contain complete, non-empty words."
            );
        }

        const dataWords = stuffedBits.length / wordSize;
        const totalWords = Math.floor(totalBits / wordSize);

        if (dataWords >= totalWords) {
            throw new Error(
                "The selected layout has no space for parity words."
            );
        }

        if (compact && dataWords > 64) {
            throw new Error(
                "Compact Aztec symbols support at most 64 data words."
            );
        }

        /*
         * Bit stuffing must prevent payload words that are
         * entirely zero or entirely one.
         *
         * This restriction does not apply to parity words.
         */
        const allOnes = (1 << wordSize) - 1;

        for (
            let offset = 0;
            offset < stuffedBits.length;
            offset += wordSize
        ) {
            let word = 0;

            for (let bit = 0; bit < wordSize; bit++) {
                word = (word << 1) | stuffedBits[offset + bit];
            }

            if (word === 0 || word === allOnes) {
                throw new Error(
                    "Invalid stuffed data: a payload word " +
                    "contains only zeros or only ones."
                );
            }
        }
    }

    /**
     * Check the matrix dimensions and module values.
     *
     * This checks structure, not scanner readability.
     *
     * @param {Array<Array<number|boolean>>} matrix
     * @param {boolean} compact
     * @param {number} layers
     */
    static validateMatrix(matrix, compact, layers) {
        const baseSize =
            (compact ? 11 : 14) + layers * 4;

        const expectedSize = compact
            ? baseSize
            : baseSize + 1 +
                2 * Math.floor((baseSize / 2 - 1) / 15);

        if (
            !Array.isArray(matrix) ||
            matrix.length !== expectedSize
        ) {
            throw new Error(
                "AztecMatrix returned an incorrect matrix size."
            );
        }

        for (const row of matrix) {
            if (
                !Array.isArray(row) ||
                row.length !== expectedSize
            ) {
                throw new Error(
                    "AztecMatrix must return a square row-major array."
                );
            }

            for (const module of row) {
                if (
                    module !== 0 &&
                    module !== 1 &&
                    module !== false &&
                    module !== true
                ) {
                    throw new Error(
                        "Matrix modules must be 0, 1, false or true."
                    );
                }
            }
        }
    }

    /**
     * Report missing classes clearly.
     *
     * Dependencies only need to be loaded before generate()
     * is called, not before this class is declared.
     */
    static checkDependencies() {
        if (
            typeof AztecEncoder === "undefined" ||
            typeof AztecEncoder.encode !== "function"
        ) {
            throw new Error(
                "Load AztecEncoder.js before generating an Aztec code."
            );
        }

        if (
            typeof AztecErrorCorrection === "undefined" ||
            typeof AztecErrorCorrection.generateCheckWords !== "function" ||
            typeof AztecErrorCorrection.generateModeMessage !== "function" ||
            typeof AztecErrorCorrection.validateBits !== "function"
        ) {
            throw new Error(
                "Load the complete AztecErrorCorrection.js class."
            );
        }

        if (
            typeof AztecLayerManager === "undefined" ||
            typeof AztecLayerManager.selectLayers !== "function"
        ) {
            throw new Error(
                "AztecLayerManager.selectLayers() has not been implemented."
            );
        }

        if (
            typeof AztecMatrix === "undefined" ||
            typeof AztecMatrix.build !== "function"
        ) {
            throw new Error(
                "AztecMatrix.build() has not been implemented."
            );
        }
    }
}