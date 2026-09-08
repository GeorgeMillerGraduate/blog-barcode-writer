/**
 * AztecLayerManager
 *
 * Selects an Aztec layout with enough capacity for:
 *   - Encoded data after bit stuffing.
 *   - Error-correction codewords.
 *
 * Supports:
 *   - Compact symbols: 1–4 layers.
 *   - Full symbols: 1–32 layers.
 *   - Automatic or explicit layer selection.
 *   - Automatic, compact-only or full-only selection.
 *
 * Compatible with the previously written AztecGenerator.
 *
 * Usage:
 *
 *   const encoded = AztecEncoder.encode("Hello world");
 *
 *   const layout = AztecLayerManager.selectLayers(
 *       encoded.bits,
 *       {
 *           errorCorrectionPercent: 33,
 *           layers: 0,
 *           compact: null
 *       }
 *   );
 */
class AztecLayerManager {

    /**
     * Select the smallest permitted matrix that fits the data.
     *
     * For equal matrix sizes, compact layouts are tried first.
     *
     * @param {number[]|Uint8Array} bits High-level, unstuffed bits.
     * @param {Object} [options={}]
     * @param {number} [options.errorCorrectionPercent=33]
     * @param {number} [options.layers=0] Zero means automatic.
     * @param {boolean|null} [options.compact=null]
     * @returns {{
     *   compact: boolean,
     *   layers: number,
     *   wordSize: number,
     *   totalBits: number,
     *   stuffedBits: number[],
     *   matrixSize: number,
     *   dataWords: number,
     *   totalWords: number,
     *   errorCorrectionWords: number
     * }}
     */
    static selectLayers(bits, options = {}) {
        AztecLayerManager.validateBits(bits);

        if (bits.length === 0) {
            throw new Error(
                "Cannot select Aztec layers for an empty bit stream."
            );
        }

        const settings =
            AztecLayerManager.normaliseOptions(options);

        const candidates =
            AztecLayerManager.createCandidates(settings);

        /*
         * Match the error-correction budget used by AztecGenerator.
         *
         * This percentage describes parity overhead relative
         * to the original high-level bit count.
         */
        const requiredErrorBits = Math.floor(
            bits.length *
            settings.errorCorrectionPercent / 100
        ) + 11;

        /*
         * Stuffing depends on word size, not layer count.
         * Cache each result locally to avoid repeated work.
         */
        const stuffedCache = new Map();

        for (const candidate of candidates) {
            const {
                compact,
                layers,
                matrixSize
            } = candidate;

            const wordSize =
                AztecLayerManager.getWordSize(layers);

            const totalBits =
                AztecLayerManager.getTotalBits(compact, layers);

            const totalWords =
                Math.floor(totalBits / wordSize);

            const usableBits =
                totalWords * wordSize;

            /*
             * Stuffing cannot shorten the input.
             * Skip obviously insufficient layouts before stuffing.
             */
            if (bits.length + requiredErrorBits > usableBits) {
                continue;
            }

            if (!stuffedCache.has(wordSize)) {
                stuffedCache.set(
                    wordSize,
                    AztecLayerManager.stuffBits(bits, wordSize)
                );
            }

            const stuffedBits = stuffedCache.get(wordSize);
            const dataWords = stuffedBits.length / wordSize;

            /*
             * The compact mode message has only six bits
             * for dataWords - 1.
             */
            if (compact && dataWords > 64) {
                continue;
            }

            const errorCorrectionWords =
                totalWords - dataWords;

            if (errorCorrectionWords < 1) {
                continue;
            }

            if (
                errorCorrectionWords * wordSize <
                requiredErrorBits
            ) {
                continue;
            }

            /*
             * A Reed-Solomon block over GF(2^wordSize)
             * cannot exceed 2^wordSize - 1 codewords.
             */
            if (totalWords > (1 << wordSize) - 1) {
                continue;
            }

            return {
                compact,
                layers,
                wordSize,
                totalBits,
                stuffedBits,
                matrixSize,
                dataWords,
                totalWords,
                errorCorrectionWords
            };
        }

        if (settings.layers !== 0) {
            throw new Error(
                `The data does not fit in ${settings.layers} ` +
                "Aztec layer(s) with the requested settings. " +
                "Use more layers, automatic selection or less data."
            );
        }

        const modeName =
            settings.compact === true ? "compact Aztec" :
            settings.compact === false ? "full Aztec" :
            "Aztec";

        throw new Error(
            `The data is too large for the available ${modeName} ` +
            "layouts with the requested error correction."
        );
    }

    /**
     * Apply Aztec bit stuffing and final-word padding.
     *
     * For a word containing w bits:
     *
     *   - If its first w-1 bits are all zero, append a one.
     *   - If its first w-1 bits are all one, append a zero.
     *   - Otherwise consume all w input bits unchanged.
     *
     * A stuffed word consumes only w-1 input bits, so the
     * next original bit is processed in the following word.
     *
     * Missing bits in the last word are treated as ones.
     *
     * @param {number[]|Uint8Array} bits
     * @param {number} wordSize
     * @returns {number[]} A word-aligned numeric bit array.
     */
    static stuffBits(bits, wordSize) {
        AztecLayerManager.validateBits(bits);

        if (![6, 8, 10, 12].includes(wordSize)) {
            throw new RangeError(
                "Aztec payload word size must be 6, 8, 10 or 12."
            );
        }

        const result = [];

        /*
         * All word bits except the least-significant bit:
         * for w = 6, mask = 111110.
         */
        const prefixMask = (1 << wordSize) - 2;

        let offset = 0;

        while (offset < bits.length) {
            let word = 0;

            for (let bit = 0; bit < wordSize; bit++) {
                const position = offset + bit;

                const value = position < bits.length
                    ? bits[position]
                    : 1;

                word = (word << 1) | value;
            }

            const prefix = word & prefixMask;
            let consumedBits;

            if (prefix === 0) {
                // All-zero prefix: force the final bit to one.
                word |= 1;
                consumedBits = wordSize - 1;
            } else if (prefix === prefixMask) {
                // All-one prefix: force the final bit to zero.
                word &= prefixMask;
                consumedBits = wordSize - 1;
            } else {
                consumedBits = wordSize;
            }

            for (let shift = wordSize - 1; shift >= 0; shift--) {
                result.push((word >>> shift) & 1);
            }

            offset += consumedBits;
        }

        return result;
    }

    /**
     * Return the payload codeword size for a layer count.
     *
     * @param {number} layers
     * @returns {number}
     */
    static getWordSize(layers) {
        AztecLayerManager.validateLayers(false, layers);

        if (layers <= 2) {
            return 6;
        }

        if (layers <= 8) {
            return 8;
        }

        if (layers <= 22) {
            return 10;
        }

        return 12;
    }

    /**
     * Return the number of message bits available in the layers.
     *
     * Includes capacity for payload and parity.
     * Excludes finder patterns, mode message and reference grid.
     *
     * @param {boolean} compact
     * @param {number} layers
     * @returns {number}
     */
    static getTotalBits(compact, layers) {
        AztecLayerManager.validateLayers(compact, layers);

        return (
            (compact ? 88 : 112) + 16 * layers
        ) * layers;
    }

    /**
     * Return the matrix width/height in modules.
     *
     * Full symbols include additional reference-grid lines.
     *
     * @param {boolean} compact
     * @param {number} layers
     * @returns {number}
     */
    static getMatrixSize(compact, layers) {
        AztecLayerManager.validateLayers(compact, layers);

        const baseSize =
            (compact ? 11 : 14) + 4 * layers;

        if (compact) {
            return baseSize;
        }

        const extraGridPairs = Math.floor(
            (baseSize / 2 - 1) / 15
        );

        return baseSize + 1 + 2 * extraGridPairs;
    }

    /**
     * Build all permitted candidates, ordered by matrix size.
     *
     * @param {{
     *   layers: number,
     *   compact: boolean|null
     * }} settings
     * @returns {Object[]}
     */
    static createCandidates(settings) {
        const candidates = [];

        const modes = settings.compact === null
            ? [true, false]
            : [settings.compact];

        for (const compact of modes) {
            const maxLayers = compact ? 4 : 32;

            const firstLayer = settings.layers === 0
                ? 1
                : settings.layers;

            const lastLayer = settings.layers === 0
                ? maxLayers
                : settings.layers;

            if (firstLayer > maxLayers) {
                continue;
            }

            for (
                let layers = firstLayer;
                layers <= lastLayer;
                layers++
            ) {
                candidates.push({
                    compact,
                    layers,
                    matrixSize:
                        AztecLayerManager.getMatrixSize(
                            compact,
                            layers
                        )
                });
            }
        }

        candidates.sort((left, right) => {
            if (left.matrixSize !== right.matrixSize) {
                return left.matrixSize - right.matrixSize;
            }

            if (left.compact !== right.compact) {
                return left.compact ? -1 : 1;
            }

            return left.layers - right.layers;
        });

        return candidates;
    }

    /**
     * Accept the normalised settings passed by AztecGenerator.
     *
     * QR-style L/M/Q/H conversion belongs to AztecGenerator,
     * so this class takes a numeric percentage only.
     *
     * @param {Object} options
     * @returns {Object}
     */
    static normaliseOptions(options) {
        if (
            options === null ||
            typeof options !== "object" ||
            Array.isArray(options)
        ) {
            throw new TypeError(
                "Layer-selection options must be an object."
            );
        }

        const errorCorrectionPercent =
            options.errorCorrectionPercent === undefined
                ? 33
                : options.errorCorrectionPercent;

        const layers = options.layers ?? 0;
        const compact = options.compact ?? null;

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
                "Compact Aztec supports at most 4 layers."
            );
        }

        return {
            errorCorrectionPercent,
            layers,
            compact
        };
    }

    /**
     * Validate an explicit symbol mode and layer count.
     *
     * @param {boolean} compact
     * @param {number} layers
     */
    static validateLayers(compact, layers) {
        if (typeof compact !== "boolean") {
            throw new TypeError(
                "Compact mode must be a boolean."
            );
        }

        const maximum = compact ? 4 : 32;

        if (
            !Number.isInteger(layers) ||
            layers < 1 ||
            layers > maximum
        ) {
            throw new RangeError(
                `Layer count must be between 1 and ${maximum}.`
            );
        }
    }

    /**
     * @param {number[]|Uint8Array} bits
     */
    static validateBits(bits) {
        if (
            !Array.isArray(bits) &&
            !(bits instanceof Uint8Array)
        ) {
            throw new TypeError(
                "Bits must be an array or Uint8Array."
            );
        }

        for (const bit of bits) {
            if (bit !== 0 && bit !== 1) {
                throw new TypeError(
                    "Each bit must be the number 0 or 1."
                );
            }
        }
    }
}