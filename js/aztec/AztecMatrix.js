/**
 * AztecMatrix
 *
 * Builds the final Aztec module matrix, including:
 *   - Encoded data and error-correction bits.
 *   - Central bull's-eye.
 *   - Orientation marks.
 *   - Protected mode message.
 *   - Reference grid for full symbols.
 *
 * Compatible with the previously written AztecGenerator.
 *
 * Input bits must already include error correction.
 *
 * Returns:
 *   matrix[y][x]
 *
 * Each module is:
 *   0 = light
 *   1 = dark
 *
 * No additional quiet zone is included in this matrix.
 */
class AztecMatrix {

    /**
     * Construct an Aztec symbol matrix.
     *
     * @param {Object} options
     * @param {boolean} options.compact
     * @param {number} options.layers
     * @param {number[]|Uint8Array} options.messageBits
     * @param {number[]|Uint8Array} options.modeMessage
     * @returns {number[][]}
     */
    static build(options) {
        AztecMatrix.validateOptions(options);

        const {
            compact,
            layers,
            messageBits,
            modeMessage
        } = options;

        /*
         * Base size excludes the extra reference-grid lines
         * present in full symbols.
         */
        const baseSize =
            (compact ? 11 : 14) + layers * 4;

        const matrixSize = compact
            ? baseSize
            : baseSize + 1 +
                2 * Math.floor((baseSize / 2 - 1) / 15);

        const matrix = Array.from(
            { length: matrixSize },
            () => new Array(matrixSize).fill(0)
        );

        /*
         * Map logical layer coordinates to actual matrix
         * coordinates, skipping full-symbol reference lines.
         */
        const alignmentMap = AztecMatrix.createAlignmentMap(
            compact,
            baseSize,
            matrixSize
        );

        AztecMatrix.placeMessage(
            matrix,
            messageBits,
            alignmentMap,
            compact,
            layers,
            baseSize
        );

        const center = Math.floor(matrixSize / 2);

        AztecMatrix.drawModeMessage(
            matrix,
            modeMessage,
            compact,
            center
        );

        AztecMatrix.drawBullsEye(
            matrix,
            center,
            compact ? 5 : 7
        );

        if (!compact) {
            AztecMatrix.drawReferenceGrid(
                matrix,
                baseSize,
                center
            );
        }

        return matrix;
    }

    /**
     * Map logical coordinates to physical coordinates.
     *
     * Compact symbols use an identity mapping.
     *
     * Full symbols reserve:
     *   - The central reference row and column.
     *   - Another reference line after every 15 data coordinates
     *     in each direction.
     *
     * @param {boolean} compact
     * @param {number} baseSize
     * @param {number} matrixSize
     * @returns {number[]}
     */
    static createAlignmentMap(compact, baseSize, matrixSize) {
        const map = new Array(baseSize);

        if (compact) {
            for (let index = 0; index < baseSize; index++) {
                map[index] = index;
            }

            return map;
        }

        const logicalCenter = baseSize / 2;
        const physicalCenter = Math.floor(matrixSize / 2);

        for (let index = 0; index < logicalCenter; index++) {
            const offset =
                index + Math.floor(index / 15);

            map[logicalCenter - index - 1] =
                physicalCenter - offset - 1;

            map[logicalCenter + index] =
                physicalCenter + offset + 1;
        }

        return map;
    }

    /**
     * Place the protected message, outer layer first.
     *
     * Each layer has four sides, each two modules thick.
     * Bits are placed in pairs along each side.
     *
     * @param {number[][]} matrix
     * @param {number[]|Uint8Array} bits
     * @param {number[]} map
     * @param {boolean} compact
     * @param {number} layers
     * @param {number} baseSize
     */
    static placeMessage(
        matrix,
        bits,
        map,
        compact,
        layers,
        baseSize
    ) {
        let bitOffset = 0;

        for (let layer = 0; layer < layers; layer++) {
            const sideLength =
                (layers - layer) * 4 +
                (compact ? 9 : 12);

            const low = layer * 2;
            const high = baseSize - 1 - low;
            const sideBitCount = sideLength * 2;

            for (
                let position = 0;
                position < sideLength;
                position++
            ) {
                const pairOffset = position * 2;

                for (let thickness = 0; thickness < 2; thickness++) {
                    const index =
                        bitOffset + pairOffset + thickness;

                    // Left side: top to bottom.
                    AztecMatrix.setModule(
                        matrix,
                        map[low + thickness],
                        map[low + position],
                        bits[index]
                    );

                    // Bottom side: left to right.
                    AztecMatrix.setModule(
                        matrix,
                        map[low + position],
                        map[high - thickness],
                        bits[index + sideBitCount]
                    );

                    // Right side: bottom to top.
                    AztecMatrix.setModule(
                        matrix,
                        map[high - thickness],
                        map[high - position],
                        bits[index + sideBitCount * 2]
                    );

                    // Top side: right to left.
                    AztecMatrix.setModule(
                        matrix,
                        map[high - position],
                        map[low + thickness],
                        bits[index + sideBitCount * 3]
                    );
                }
            }

            bitOffset += sideLength * 8;
        }

        if (bitOffset !== bits.length) {
            throw new Error(
                "Aztec message length does not match layer capacity."
            );
        }
    }

    /**
     * Place the protected mode message around the bull's-eye.
     *
     * Compact symbols use 7 bits per side.
     * Full symbols use 10 bits per side and skip the central
     * reference row or column.
     *
     * @param {number[][]} matrix
     * @param {number[]|Uint8Array} bits
     * @param {boolean} compact
     * @param {number} center
     */
    static drawModeMessage(matrix, bits, compact, center) {
        if (compact) {
            for (let index = 0; index < 7; index++) {
                const coordinate = center - 3 + index;

                // Top.
                AztecMatrix.setModule(
                    matrix,
                    coordinate,
                    center - 5,
                    bits[index]
                );

                // Right.
                AztecMatrix.setModule(
                    matrix,
                    center + 5,
                    coordinate,
                    bits[index + 7]
                );

                // Bottom.
                AztecMatrix.setModule(
                    matrix,
                    coordinate,
                    center + 5,
                    bits[20 - index]
                );

                // Left.
                AztecMatrix.setModule(
                    matrix,
                    center - 5,
                    coordinate,
                    bits[27 - index]
                );
            }

            return;
        }

        for (let index = 0; index < 10; index++) {
            const coordinate =
                center - 5 + index + Math.floor(index / 5);

            // Top.
            AztecMatrix.setModule(
                matrix,
                coordinate,
                center - 7,
                bits[index]
            );

            // Right.
            AztecMatrix.setModule(
                matrix,
                center + 7,
                coordinate,
                bits[index + 10]
            );

            // Bottom.
            AztecMatrix.setModule(
                matrix,
                coordinate,
                center + 7,
                bits[29 - index]
            );

            // Left.
            AztecMatrix.setModule(
                matrix,
                center - 7,
                coordinate,
                bits[39 - index]
            );
        }
    }

    /**
     * Draw alternating square rings and orientation marks.
     *
     * The initially white matrix supplies the light rings.
     *
     * @param {number[][]} matrix
     * @param {number} center
     * @param {number} size 5 for compact, 7 for full.
     */
    static drawBullsEye(matrix, center, size) {
        for (let radius = 0; radius < size; radius += 2) {
            const low = center - radius;
            const high = center + radius;

            for (let coordinate = low; coordinate <= high; coordinate++) {
                AztecMatrix.setModule(matrix, coordinate, low, 1);
                AztecMatrix.setModule(matrix, coordinate, high, 1);
                AztecMatrix.setModule(matrix, low, coordinate, 1);
                AztecMatrix.setModule(matrix, high, coordinate, 1);
            }
        }

        /*
         * Asymmetric corner marks identify orientation.
         * They lie on the outer mode-message perimeter.
         */
        const low = center - size;
        const high = center + size;

        AztecMatrix.setModule(matrix, low, low, 1);
        AztecMatrix.setModule(matrix, low + 1, low, 1);
        AztecMatrix.setModule(matrix, low, low + 1, 1);

        AztecMatrix.setModule(matrix, high, low, 1);
        AztecMatrix.setModule(matrix, high, low + 1, 1);

        AztecMatrix.setModule(matrix, high, high - 1, 1);
    }

    /**
     * Draw alternating reference lines for a full symbol.
     *
     * Lines are spaced 16 physical modules apart.
     * Their dark modules align with the center's parity.
     *
     * @param {number[][]} matrix
     * @param {number} baseSize
     * @param {number} center
     */
    static drawReferenceGrid(matrix, baseSize, center) {
        const matrixSize = matrix.length;

        for (
            let logicalOffset = 0, physicalOffset = 0;
            logicalOffset < baseSize / 2 - 1;
            logicalOffset += 15, physicalOffset += 16
        ) {
            const low = center - physicalOffset;
            const high = center + physicalOffset;

            for (
                let coordinate = center & 1;
                coordinate < matrixSize;
                coordinate += 2
            ) {
                AztecMatrix.setModule(matrix, low, coordinate, 1);
                AztecMatrix.setModule(matrix, high, coordinate, 1);

                AztecMatrix.setModule(matrix, coordinate, low, 1);
                AztecMatrix.setModule(matrix, coordinate, high, 1);
            }
        }
    }

    /**
     * Write a module using x/y coordinates.
     *
     * Matrix storage is row-major: matrix[y][x].
     *
     * @param {number[][]} matrix
     * @param {number} x
     * @param {number} y
     * @param {number} value
     */
    static setModule(matrix, x, y, value) {
        if (
            !Number.isInteger(x) ||
            !Number.isInteger(y) ||
            x < 0 ||
            y < 0 ||
            y >= matrix.length ||
            x >= matrix[y].length
        ) {
            throw new RangeError(
                `Aztec module coordinate is outside the matrix: ${x}, ${y}.`
            );
        }

        if (value !== 0 && value !== 1) {
            throw new TypeError(
                "Aztec module value must be 0 or 1."
            );
        }

        matrix[y][x] = value;
    }

    /**
     * Validate the input contract used by AztecGenerator.
     *
     * @param {Object} options
     */
    static validateOptions(options) {
        if (
            options === null ||
            typeof options !== "object" ||
            Array.isArray(options)
        ) {
            throw new TypeError(
                "AztecMatrix.build expects an options object."
            );
        }

        const {
            compact,
            layers,
            messageBits,
            modeMessage
        } = options;

        if (typeof compact !== "boolean") {
            throw new TypeError(
                "Compact mode must be a boolean."
            );
        }

        const maxLayers = compact ? 4 : 32;

        if (
            !Number.isInteger(layers) ||
            layers < 1 ||
            layers > maxLayers
        ) {
            throw new RangeError(
                `Layer count must be between 1 and ${maxLayers}.`
            );
        }

        AztecMatrix.validateBits(messageBits, "Message");
        AztecMatrix.validateBits(modeMessage, "Mode message");

        const expectedMessageLength =
            ((compact ? 88 : 112) + 16 * layers) * layers;

        if (messageBits.length !== expectedMessageLength) {
            throw new Error(
                `Expected ${expectedMessageLength} protected message bits, ` +
                `received ${messageBits.length}.`
            );
        }

        const expectedModeLength = compact ? 28 : 40;

        if (modeMessage.length !== expectedModeLength) {
            throw new Error(
                `Expected ${expectedModeLength} mode-message bits, ` +
                `received ${modeMessage.length}.`
            );
        }
    }

    /**
     * @param {number[]|Uint8Array} bits
     * @param {string} name
     */
    static validateBits(bits, name) {
        if (
            !Array.isArray(bits) &&
            !(bits instanceof Uint8Array)
        ) {
            throw new TypeError(
                `${name} bits must be an array or Uint8Array.`
            );
        }

        for (const bit of bits) {
            if (bit !== 0 && bit !== 1) {
                throw new TypeError(
                    `${name} bits must contain only numeric 0 and 1.`
                );
            }
        }
    }
}