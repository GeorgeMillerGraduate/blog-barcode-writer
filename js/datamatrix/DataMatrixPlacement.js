/**
 * DataMatrixPlacement.js
 *
 * Places Data Matrix ECC 200 codewords into a module matrix,
 * then adds the finder borders around each data region.
 *
 * Supports all standard square symbols and the six original
 * rectangular symbols. Extended DMRE symbols are not included.
 *
 * Compatible with:
 *   DataMatrixGenerator.generateDetailed()
 *
 * Usage:
 *   const matrix = DataMatrixPlacement.build(codewords, symbol);
 *
 * Required symbol properties:
 *   width          Full symbol width, including finder borders.
 *   height         Full symbol height, including finder borders.
 *   dataCapacity   Number of padded data codewords.
 *   errorCodewords Total number of error-correction codewords.
 *
 * Input codewords must include both padded data and interleaved
 * error correction, as returned by DataMatrixErrorCorrection.
 *
 * Output:
 *   matrix[y][x]
 *   0 = light
 *   1 = dark
 *
 * No quiet zone is included.
 */
class DataMatrixPlacement {

    /**
     * Build the complete symbol matrix.
     *
     * @param {number[]|Uint8Array} codewords
     * @param {Object} symbol
     * @returns {number[][]}
     */
    static build(codewords, symbol) {
        DataMatrixPlacement.#validateCodewords(codewords);

        if (
            symbol === null ||
            typeof symbol !== "object" ||
            Array.isArray(symbol)
        ) {
            throw new TypeError(
                "DataMatrixPlacement: symbol must be an object."
            );
        }

        const layout = DataMatrixPlacement.getLayout(
            symbol.width,
            symbol.height
        );

        const expectedCount = Math.floor(
            layout.dataWidth * layout.dataHeight / 8
        );

        if (
            !Number.isInteger(symbol.dataCapacity) ||
            symbol.dataCapacity < 1 ||
            !Number.isInteger(symbol.errorCodewords) ||
            symbol.errorCodewords < 1 ||
            symbol.dataCapacity + symbol.errorCodewords !== expectedCount
        ) {
            throw new RangeError(
                "DataMatrixPlacement: symbol capacities do not " +
                "match its dimensions."
            );
        }

        if (codewords.length !== expectedCount) {
            throw new RangeError(
                `DataMatrixPlacement: expected ${expectedCount} ` +
                `codewords but received ${codewords.length}.`
            );
        }

        const dataMatrix = DataMatrixPlacement.#placeData(
            codewords,
            layout.dataWidth,
            layout.dataHeight
        );

        return DataMatrixPlacement.#addBorders(dataMatrix, layout);
    }

    /**
     * Determine the data-region layout from full symbol dimensions.
     *
     * Rectangular symbols use their standard landscape orientation.
     * Rotate the completed matrix if portrait output is required.
     *
     * @param {number} width
     * @param {number} height
     * @returns {Object}
     */
    static getLayout(width, height) {
        if (
            !Number.isInteger(width) ||
            !Number.isInteger(height)
        ) {
            throw new TypeError(
                "DataMatrixPlacement: width and height " +
                "must be integers."
            );
        }

        let regionColumns;
        let regionRows;

        if (width === height) {
            const squareSizes = [
                10, 12, 14, 16, 18, 20, 22, 24, 26,
                32, 36, 40, 44, 48, 52,
                64, 72, 80, 88, 96, 104,
                120, 132, 144
            ];

            if (!squareSizes.includes(width)) {
                throw new RangeError(
                    `DataMatrixPlacement: unsupported square size ${width}.`
                );
            }

            if (width <= 26) {
                regionColumns = 1;
            } else if (width <= 52) {
                regionColumns = 2;
            } else if (width <= 104) {
                regionColumns = 4;
            } else {
                regionColumns = 6;
            }

            regionRows = regionColumns;
        } else {
            const rectangles = {
                "18x8":  [1, 1],
                "32x8":  [2, 1],
                "26x12": [1, 1],
                "36x12": [2, 1],
                "36x16": [2, 1],
                "48x16": [2, 1]
            };

            const regions = rectangles[`${width}x${height}`];

            if (!regions) {
                throw new RangeError(
                    "DataMatrixPlacement: unsupported rectangular " +
                    `size ${width} × ${height}.`
                );
            }

            [regionColumns, regionRows] = regions;
        }

        const regionDataWidth = width / regionColumns - 2;
        const regionDataHeight = height / regionRows - 2;

        return {
            width,
            height,
            regionColumns,
            regionRows,
            regionDataWidth,
            regionDataHeight,
            dataWidth: regionColumns * regionDataWidth,
            dataHeight: regionRows * regionDataHeight
        };
    }

    /**
     * Place codewords into the borderless data area.
     *
     * Ordinary codewords use the eight-module Utah pattern.
     * Four special patterns handle the boundary cases.
     */
    static #placeData(codewords, columns, rows) {
        const matrix = Array.from(
            { length: rows },
            () => new Array(columns).fill(-1)
        );

        let position = 0;

        /**
         * Place one complete codeword, most significant bit first.
         * Negative coordinates wrap according to ECC 200 rules.
         */
        const placeWord = coordinates => {
            if (position >= codewords.length) {
                throw new Error(
                    "DataMatrixPlacement: exhausted codewords " +
                    "before placement finished."
                );
            }

            const value = codewords[position++];

            for (let bit = 0; bit < 8; bit++) {
                let [row, column] = coordinates[bit];

                if (row < 0) {
                    row += rows;
                    column += 4 - ((rows + 4) % 8);
                }

                if (column < 0) {
                    column += columns;
                    row += 4 - ((columns + 4) % 8);
                }

                if (
                    row < 0 || row >= rows ||
                    column < 0 || column >= columns
                ) {
                    throw new Error(
                        "DataMatrixPlacement: invalid module coordinate."
                    );
                }

                if (matrix[row][column] !== -1) {
                    throw new Error(
                        "DataMatrixPlacement: overlapping module placement."
                    );
                }

                matrix[row][column] = (value >>> (7 - bit)) & 1;
            }
        };

        const utah = (row, column) => {
            placeWord([
                [row - 2, column - 2],
                [row - 2, column - 1],
                [row - 1, column - 2],
                [row - 1, column - 1],
                [row - 1, column],
                [row,     column - 2],
                [row,     column - 1],
                [row,     column]
            ]);
        };

        const corner1 = () => {
            placeWord([
                [rows - 1, 0],
                [rows - 1, 1],
                [rows - 1, 2],
                [0, columns - 2],
                [0, columns - 1],
                [1, columns - 1],
                [2, columns - 1],
                [3, columns - 1]
            ]);
        };

        const corner2 = () => {
            placeWord([
                [rows - 3, 0],
                [rows - 2, 0],
                [rows - 1, 0],
                [0, columns - 4],
                [0, columns - 3],
                [0, columns - 2],
                [0, columns - 1],
                [1, columns - 1]
            ]);
        };

        const corner3 = () => {
            placeWord([
                [rows - 3, 0],
                [rows - 2, 0],
                [rows - 1, 0],
                [0, columns - 2],
                [0, columns - 1],
                [1, columns - 1],
                [2, columns - 1],
                [3, columns - 1]
            ]);
        };

        const corner4 = () => {
            placeWord([
                [rows - 1, 0],
                [rows - 1, columns - 1],
                [0, columns - 3],
                [0, columns - 2],
                [0, columns - 1],
                [1, columns - 3],
                [1, columns - 2],
                [1, columns - 1]
            ]);
        };

        let row = 4;
        let column = 0;

        do {
            if (row === rows && column === 0) {
                corner1();
            }

            if (
                row === rows - 2 &&
                column === 0 &&
                columns % 4 !== 0
            ) {
                corner2();
            }

            if (
                row === rows - 2 &&
                column === 0 &&
                columns % 8 === 4
            ) {
                corner3();
            }

            if (
                row === rows + 4 &&
                column === 2 &&
                columns % 8 === 0
            ) {
                corner4();
            }

            // Sweep diagonally upwards and to the right.
            do {
                if (
                    row >= 0 && row < rows &&
                    column >= 0 && column < columns &&
                    matrix[row][column] === -1
                ) {
                    utah(row, column);
                }

                row -= 2;
                column += 2;
            } while (row >= 0 && column < columns);

            row += 1;
            column += 3;

            // Sweep diagonally downwards and to the left.
            do {
                if (
                    row >= 0 && row < rows &&
                    column >= 0 && column < columns &&
                    matrix[row][column] === -1
                ) {
                    utah(row, column);
                }

                row += 2;
                column -= 2;
            } while (row < rows && column >= 0);

            row += 3;
            column += 1;
        } while (row < rows || column < columns);

        if (position !== codewords.length) {
            throw new Error(
                "DataMatrixPlacement: not all codewords were placed."
            );
        }

        // Some symbol sizes leave a fixed 2 × 2 pattern:
        // dark on the main diagonal, light on the other diagonal.
        if (matrix[rows - 1][columns - 1] === -1) {
            matrix[rows - 2][columns - 2] = 1;
            matrix[rows - 2][columns - 1] = 0;
            matrix[rows - 1][columns - 2] = 0;
            matrix[rows - 1][columns - 1] = 1;
        }

        for (const dataRow of matrix) {
            if (dataRow.includes(-1)) {
                throw new Error(
                    "DataMatrixPlacement: unfilled data modules remain."
                );
            }
        }

        return matrix;
    }

    /**
     * Add finder borders around each data region.
     *
     * Left and bottom borders are solid.
     * Top and right borders alternate between dark and light.
     */
    static #addBorders(dataMatrix, layout) {
        const {
            width,
            height,
            regionColumns,
            regionRows,
            regionDataWidth,
            regionDataHeight
        } = layout;

        const matrix = Array.from(
            { length: height },
            () => new Array(width).fill(0)
        );

        for (let regionY = 0; regionY < regionRows; regionY++) {
            for (
                let regionX = 0;
                regionX < regionColumns;
                regionX++
            ) {
                const left = regionX * (regionDataWidth + 2);
                const top = regionY * (regionDataHeight + 2);
                const right = left + regionDataWidth + 1;
                const bottom = top + regionDataHeight + 1;

                // Top timing border and solid bottom border.
                for (let x = 0; x < regionDataWidth + 2; x++) {
                    matrix[top][left + x] = x % 2 === 0 ? 1 : 0;
                    matrix[bottom][left + x] = 1;
                }

                for (let y = 0; y < regionDataHeight; y++) {
                    const outputY = top + y + 1;
                    const sourceY = regionY * regionDataHeight + y;

                    matrix[outputY][left] = 1;
                    matrix[outputY][right] = y % 2 === 0 ? 1 : 0;

                    for (let x = 0; x < regionDataWidth; x++) {
                        const sourceX =
                            regionX * regionDataWidth + x;

                        matrix[outputY][left + x + 1] =
                            dataMatrix[sourceY][sourceX];
                    }
                }
            }
        }

        return matrix;
    }

    /**
     * Validate the complete data-plus-ECC codeword sequence.
     */
    static #validateCodewords(codewords) {
        if (
            !Array.isArray(codewords) &&
            !(codewords instanceof Uint8Array)
        ) {
            throw new TypeError(
                "DataMatrixPlacement: codewords must be " +
                "an array or Uint8Array."
            );
        }

        for (let index = 0; index < codewords.length; index++) {
            const value = codewords[index];

            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value > 255
            ) {
                throw new RangeError(
                    `DataMatrixPlacement: codeword ${index} ` +
                    "must be an integer from 0 to 255."
                );
            }
        }
    }
}

if (typeof window !== "undefined") {
    window.DataMatrixPlacement = DataMatrixPlacement;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = DataMatrixPlacement;
}