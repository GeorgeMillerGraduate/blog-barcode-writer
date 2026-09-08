/**
 * BarcodeRenderer.js
 *
 * Shared Canvas and SVG renderer for completed barcode matrices.
 *
 * Supports:
 * - Standard square modules
 * - Rounded, dots, diamond, organic and liquid styles
 * - MaxiCode hexagons and circular finder
 *
 * Encoding is handled by the separate generator classes.
 */
class BarcodeRenderer {

    /* ========================================================
       DEFAULT OPTIONS
       ======================================================== */

    static DEFAULT_OPTIONS = {
        moduleSize: 6,
        foreground: "#0b1930",
        background: "#ffffff",
        quietZone: true,
        quietZoneModules: null,
        fancy: false,
        fancyStyle: "organic",
        fancyIntensity: "medium",
        preservePatterns: true
    };

    /* ========================================================
       MAIN CANVAS RENDERER
       ======================================================== */

    static renderCanvas(symbol, canvas, options = {}) {
        BarcodeRenderer.validateSymbol(symbol);

        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new TypeError(
                "BarcodeRenderer.renderCanvas() requires a canvas element."
            );
        }

        const settings = BarcodeRenderer.normaliseOptions(symbol, options);
        const format = BarcodeRenderer.normaliseFormat(symbol.format);

        if (format === "maxicode") {
            return BarcodeRenderer.renderMaxiCodeCanvas(
                symbol,
                canvas,
                settings
            );
        }

        return BarcodeRenderer.renderMatrixCanvas(
            symbol,
            canvas,
            settings
        );
    }

    /* ========================================================
       MAIN SVG RENDERER
       ======================================================== */

    static renderSVG(symbol, options = {}) {
        BarcodeRenderer.validateSymbol(symbol);

        const settings = BarcodeRenderer.normaliseOptions(symbol, options);
        const format = BarcodeRenderer.normaliseFormat(symbol.format);

        if (format === "maxicode") {
            return BarcodeRenderer.renderMaxiCodeSVG(symbol, settings);
        }

        return BarcodeRenderer.renderMatrixSVG(symbol, settings);
    }

    /* ========================================================
       MATRIX CANVAS RENDERER
       ======================================================== */

    static renderMatrixCanvas(symbol, canvas, settings) {
        const matrix = BarcodeRenderer.getMatrix(symbol);
        const rows = matrix.length;
        const columns = matrix[0].length;
        const quietZone = BarcodeRenderer.getQuietZone(symbol, settings);
        const moduleSize = settings.moduleSize;

        const width = (columns + quietZone * 2) * moduleSize;
        const height = (rows + quietZone * 2) * moduleSize;

        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Unable to obtain 2D canvas context.");
        }

        context.imageSmoothingEnabled = Boolean(settings.fancy);

        context.fillStyle = settings.background;
        context.fillRect(0, 0, width, height);
        context.fillStyle = settings.foreground;

        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                if (!BarcodeRenderer.isDarkModule(matrix[row][column])) {
                    continue;
                }

                const x = (column + quietZone) * moduleSize;
                const y = (row + quietZone) * moduleSize;

                BarcodeRenderer.drawModuleCanvas(
                    context,
                    matrix,
                    row,
                    column,
                    x,
                    y,
                    moduleSize,
                    symbol,
                    settings
                );
            }
        }

        return canvas;
    }

    /* ========================================================
       MODULE DISPATCHER — CANVAS
       ======================================================== */

    static drawModuleCanvas(
        context,
        matrix,
        row,
        column,
        x,
        y,
        size,
        symbol,
        settings
    ) {
        if (!settings.fancy) {
            BarcodeRenderer.drawSquareCanvas(context, x, y, size);
            return;
        }

        if (
            settings.preservePatterns &&
            BarcodeRenderer.isProtectedModule(symbol, matrix, row, column)
        ) {
            BarcodeRenderer.drawSquareCanvas(context, x, y, size);
            return;
        }

        switch (settings.fancyStyle) {
            case "rounded":
                BarcodeRenderer.drawRoundedCanvas(
                    context, x, y, size, settings
                );
                break;

            case "dots":
                BarcodeRenderer.drawDotCanvas(
                    context, x, y, size, settings
                );
                break;

            case "diamond":
                BarcodeRenderer.drawDiamondCanvas(
                    context, x, y, size, settings
                );
                break;

            case "liquid":
                BarcodeRenderer.drawLiquidCanvas(
                    context, matrix, row, column, x, y, size, settings
                );
                break;

            case "organic":
            default:
                BarcodeRenderer.drawOrganicCanvas(
                    context, matrix, row, column, x, y, size, settings
                );
                break;
        }
    }

    /* ========================================================
       STANDARD SQUARE
       ======================================================== */

    static drawSquareCanvas(context, x, y, size) {
        context.fillRect(x, y, size, size);
    }

    /* ========================================================
       ROUNDED MODULE
       ======================================================== */

    static drawRoundedCanvas(context, x, y, size, settings) {
        const factor = BarcodeRenderer.getIntensityFactor(settings);
        const inset = size * (0.04 + factor * 0.06);
        const drawSize = size - inset * 2;
        const radius = drawSize * (0.15 + factor * 0.25);

        BarcodeRenderer.roundedRectPath(
            context,
            x + inset,
            y + inset,
            drawSize,
            drawSize,
            radius
        );

        context.fill();
    }

    /* ========================================================
       DOT MODULE
       ======================================================== */

    static drawDotCanvas(context, x, y, size, settings) {
        const factor = BarcodeRenderer.getIntensityFactor(settings);
        const radius = size * (0.47 - factor * 0.055);

        context.beginPath();
        context.arc(
            x + size / 2,
            y + size / 2,
            radius,
            0,
            Math.PI * 2
        );
        context.fill();
    }

    /* ========================================================
       DIAMOND MODULE
       ======================================================== */

    static drawDiamondCanvas(context, x, y, size, settings) {
        const factor = BarcodeRenderer.getIntensityFactor(settings);
        const inset = size * (0.02 + factor * 0.04);

        const left = x + inset;
        const right = x + size - inset;
        const top = y + inset;
        const bottom = y + size - inset;
        const centreX = x + size / 2;
        const centreY = y + size / 2;

        context.beginPath();
        context.moveTo(centreX, top);
        context.lineTo(right, centreY);
        context.lineTo(centreX, bottom);
        context.lineTo(left, centreY);
        context.closePath();
        context.fill();
    }

    /* ========================================================
       ORGANIC MODULE
       ======================================================== */

    static drawOrganicCanvas(
        context,
        matrix,
        row,
        column,
        x,
        y,
        size,
        settings
    ) {
        const neighbours = BarcodeRenderer.getNeighbours(
            matrix, row, column
        );

        const factor = BarcodeRenderer.getIntensityFactor(settings);
        const inset = size * (0.08 + factor * 0.035);
        const radius = size * (0.22 + factor * 0.12);

        BarcodeRenderer.roundedRectPath(
            context,
            x + inset,
            y + inset,
            size - inset * 2,
            size - inset * 2,
            radius
        );

        context.fill();

        const bridge = size / 2 - inset;

        if (neighbours.left) {
            context.fillRect(
                x,
                y + inset,
                size / 2,
                size - inset * 2
            );
        }

        if (neighbours.right) {
            context.fillRect(
                x + size / 2,
                y + inset,
                size / 2,
                size - inset * 2
            );
        }

        if (neighbours.top) {
            context.fillRect(
                x + inset,
                y,
                size - inset * 2,
                size / 2
            );
        }

        if (neighbours.bottom) {
            context.fillRect(
                x + inset,
                y + size / 2,
                size - inset * 2,
                size / 2
            );
        }

        // Remove small antialiasing seams through the centre.
        context.fillRect(
            x + size / 2 - bridge / 2,
            y + size / 2 - bridge / 2,
            bridge,
            bridge
        );
    }

    /* ========================================================
       LIQUID MODULE
       ======================================================== */

    static drawLiquidCanvas(
        context,
        matrix,
        row,
        column,
        x,
        y,
        size,
        settings
    ) {
        const neighbours = BarcodeRenderer.getNeighbours(
            matrix, row, column
        );

        const factor = BarcodeRenderer.getIntensityFactor(settings);
        const centreX = x + size / 2;
        const centreY = y + size / 2;
        const radius = size * (0.43 - factor * 0.025);

        context.beginPath();
        context.arc(centreX, centreY, radius, 0, Math.PI * 2);
        context.fill();

        const thickness = radius * (1.25 + factor * 0.25);

        if (neighbours.left) {
            context.fillRect(
                x,
                centreY - thickness / 2,
                size / 2,
                thickness
            );
        }

        if (neighbours.right) {
            context.fillRect(
                centreX,
                centreY - thickness / 2,
                size / 2,
                thickness
            );
        }

        if (neighbours.top) {
            context.fillRect(
                centreX - thickness / 2,
                y,
                thickness,
                size / 2
            );
        }

        if (neighbours.bottom) {
            context.fillRect(
                centreX - thickness / 2,
                centreY,
                thickness,
                size / 2
            );
        }

        const cornerRadius = size * 0.18;

        if (
            neighbours.left &&
            neighbours.top &&
            neighbours.topLeft
        ) {
            BarcodeRenderer.drawCircleCanvas(
                context, x, y, cornerRadius
            );
        }

        if (
            neighbours.right &&
            neighbours.top &&
            neighbours.topRight
        ) {
            BarcodeRenderer.drawCircleCanvas(
                context, x + size, y, cornerRadius
            );
        }

        if (
            neighbours.left &&
            neighbours.bottom &&
            neighbours.bottomLeft
        ) {
            BarcodeRenderer.drawCircleCanvas(
                context, x, y + size, cornerRadius
            );
        }

        if (
            neighbours.right &&
            neighbours.bottom &&
            neighbours.bottomRight
        ) {
            BarcodeRenderer.drawCircleCanvas(
                context, x + size, y + size, cornerRadius
            );
        }
    }

    /* ========================================================
       CIRCLE HELPER
       ======================================================== */

    static drawCircleCanvas(context, x, y, radius) {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }

    /* ========================================================
       ROUNDED RECTANGLE PATH
       ======================================================== */

    static roundedRectPath(context, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);

        context.beginPath();
        context.moveTo(x + r, y);
        context.lineTo(x + width - r, y);
        context.quadraticCurveTo(
            x + width, y,
            x + width, y + r
        );
        context.lineTo(x + width, y + height - r);
        context.quadraticCurveTo(
            x + width, y + height,
            x + width - r, y + height
        );
        context.lineTo(x + r, y + height);
        context.quadraticCurveTo(
            x, y + height,
            x, y + height - r
        );
        context.lineTo(x, y + r);
        context.quadraticCurveTo(x, y, x + r, y);
        context.closePath();
    }

    /* ========================================================
       NEIGHBOUR LOOKUP
       ======================================================== */

    static getNeighbours(matrix, row, column) {
        return {
            top: BarcodeRenderer.moduleAt(matrix, row - 1, column),
            bottom: BarcodeRenderer.moduleAt(matrix, row + 1, column),
            left: BarcodeRenderer.moduleAt(matrix, row, column - 1),
            right: BarcodeRenderer.moduleAt(matrix, row, column + 1),

            topLeft: BarcodeRenderer.moduleAt(
                matrix, row - 1, column - 1
            ),

            topRight: BarcodeRenderer.moduleAt(
                matrix, row - 1, column + 1
            ),

            bottomLeft: BarcodeRenderer.moduleAt(
                matrix, row + 1, column - 1
            ),

            bottomRight: BarcodeRenderer.moduleAt(
                matrix, row + 1, column + 1
            )
        };
    }

    /* ========================================================
       SAFE MATRIX LOOKUP
       ======================================================== */

    static moduleAt(matrix, row, column) {
        if (
            row < 0 ||
            column < 0 ||
            row >= matrix.length ||
            column >= matrix[0].length
        ) {
            return false;
        }

        return BarcodeRenderer.isDarkModule(matrix[row][column]);
    }

    /* ========================================================
       PROTECTED MODULE TEST
       ======================================================== */

    static isProtectedModule(symbol, matrix, row, column) {
        const format = BarcodeRenderer.normaliseFormat(symbol.format);
        const rows = matrix.length;
        const columns = matrix[0].length;

        if (format === "qr") {
            // Finder patterns and surrounding separators.
            if (BarcodeRenderer.inRectangle(row, column, 0, 0, 8, 8)) {
                return true;
            }

            if (
                BarcodeRenderer.inRectangle(
                    row, column, 0, columns - 8, 8, 8
                )
            ) {
                return true;
            }

            if (
                BarcodeRenderer.inRectangle(
                    row, column, rows - 8, 0, 8, 8
                )
            ) {
                return true;
            }

            // Timing patterns.
            if (row === 6 || column === 6) {
                return true;
            }

            return false;
        }

        if (format === "microqr") {
            return BarcodeRenderer.inRectangle(
                row, column, 0, 0, 8, 8
            );
        }

        if (format === "datamatrix") {
            return (
                row === 0 ||
                column === 0 ||
                row === rows - 1 ||
                column === columns - 1
            );
        }

        if (format === "aztec") {
            const centreRow = Math.floor(rows / 2);
            const centreColumn = Math.floor(columns / 2);
            const distanceRow = Math.abs(row - centreRow);
            const distanceColumn = Math.abs(column - centreColumn);

            return distanceRow <= 5 && distanceColumn <= 5;
        }

        if (format === "pdf417") {
            return column < 4 || column >= columns - 4;
        }

        return false;
    }

    /* ========================================================
       RECTANGLE TEST
       ======================================================== */

    static inRectangle(row, column, top, left, height, width) {
        return (
            row >= top &&
            row < top + height &&
            column >= left &&
            column < left + width
        );
    }

    /* ========================================================
       INTENSITY
       ======================================================== */

    static getIntensityFactor(settings) {
        switch (settings.fancyIntensity) {
            case "subtle":
                return 0.25;

            case "strong":
                return 1.0;

            case "medium":
            default:
                return 0.6;
        }
    }

    /* ========================================================
       SVG MATRIX RENDERER
       ======================================================== */

    static renderMatrixSVG(symbol, settings) {
        const matrix = BarcodeRenderer.getMatrix(symbol);
        const rows = matrix.length;
        const columns = matrix[0].length;
        const quietZone = BarcodeRenderer.getQuietZone(symbol, settings);
        const size = settings.moduleSize;

        const svgWidth = (columns + quietZone * 2) * size;
        const svgHeight = (rows + quietZone * 2) * size;

        const parts = [];

        parts.push('<?xml version="1.0" encoding="UTF-8"?>');

        parts.push(
            '<svg ' +
            'xmlns="http://www.w3.org/2000/svg" ' +
            'width="' + svgWidth + '" ' +
            'height="' + svgHeight + '" ' +
            'viewBox="0 0 ' + svgWidth + " " + svgHeight + '">'
        );

        parts.push(
            '<rect ' +
            'x="0" ' +
            'y="0" ' +
            'width="' + svgWidth + '" ' +
            'height="' + svgHeight + '" ' +
            'fill="' +
            BarcodeRenderer.escapeXML(settings.background) +
            '"/>'
        );

        parts.push(
            '<g fill="' +
            BarcodeRenderer.escapeXML(settings.foreground) +
            '">'
        );

        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                if (!BarcodeRenderer.isDarkModule(matrix[row][column])) {
                    continue;
                }

                const x = (column + quietZone) * size;
                const y = (row + quietZone) * size;

                parts.push(
                    BarcodeRenderer.getModuleSVG(
                        symbol,
                        matrix,
                        row,
                        column,
                        x,
                        y,
                        size,
                        settings
                    )
                );
            }
        }

        parts.push("</g>");
        parts.push("</svg>");

        return parts.join("");
    }

    /* ========================================================
       SVG MODULE DISPATCHER
       ======================================================== */

    static getModuleSVG(
        symbol,
        matrix,
        row,
        column,
        x,
        y,
        size,
        settings
    ) {
        if (
            !settings.fancy ||
            (
                settings.preservePatterns &&
                BarcodeRenderer.isProtectedModule(
                    symbol, matrix, row, column
                )
            )
        ) {
            return BarcodeRenderer.svgRect(x, y, size, size);
        }

        switch (settings.fancyStyle) {
            case "rounded":
                return BarcodeRenderer.svgRounded(x, y, size, settings);

            case "dots":
                return BarcodeRenderer.svgDot(x, y, size, settings);

            case "diamond":
                return BarcodeRenderer.svgDiamond(x, y, size, settings);

            case "liquid":
                return BarcodeRenderer.svgLiquid(
                    matrix, row, column, x, y, size, settings
                );

            case "organic":
            default:
                return BarcodeRenderer.svgOrganic(
                    matrix, row, column, x, y, size, settings
                );
        }
    }

    /* ========================================================
       SVG RECTANGLE
       ======================================================== */

    static svgRect(x, y, width, height, radius = 0) {
        let output =
            '<rect ' +
            'x="' + x + '" ' +
            'y="' + y + '" ' +
            'width="' + width + '" ' +
            'height="' + height + '"';

        if (radius > 0) {
            output +=
                ' rx="' + radius + '"' +
                ' ry="' + radius + '"';
        }

        output += '/>';

        return output;
    }

    /* ========================================================
       SVG ROUNDED
       ======================================================== */

    static svgRounded(x, y, size, settings) {
        const factor = BarcodeRenderer.getIntensityFactor(settings);
        const inset = size * (0.04 + factor * 0.06);
        const drawSize = size - inset * 2;
        const radius = drawSize * (0.15 + factor * 0.25);

        return BarcodeRenderer.svgRect(
            x + inset,
            y + inset,
            drawSize,
            drawSize,
            radius
        );
    }

    /* ========================================================
       SVG DOT
       ======================================================== */

    static svgDot(x, y, size, settings) {
        const factor = BarcodeRenderer.getIntensityFactor(settings);
        const radius = size * (0.47 - factor * 0.055);

        return (
            '<circle ' +
            'cx="' + (x + size / 2) + '" ' +
            'cy="' + (y + size / 2) + '" ' +
            'r="' + radius + '"' +
            '/>'
        );
    }

    /* ========================================================
       SVG DIAMOND
       ======================================================== */

    static svgDiamond(x, y, size, settings) {
        const factor = BarcodeRenderer.getIntensityFactor(settings);
        const inset = size * (0.02 + factor * 0.04);
        const cx = x + size / 2;
        const cy = y + size / 2;

        return (
            '<polygon points="' +
            cx + "," + (y + inset) + " " +
            (x + size - inset) + "," + cy + " " +
            cx + "," + (y + size - inset) + " " +
            (x + inset) + "," + cy +
            '"/>'
        );
    }

    /* ========================================================
       SVG ORGANIC
       ======================================================== */

    static svgOrganic(matrix, row, column, x, y, size, settings) {
        const neighbours = BarcodeRenderer.getNeighbours(
            matrix, row, column
        );

        const factor = BarcodeRenderer.getIntensityFactor(settings);
        const inset = size * (0.08 + factor * 0.035);
        const radius = size * (0.22 + factor * 0.12);
        const parts = [];

        parts.push(
            BarcodeRenderer.svgRect(
                x + inset,
                y + inset,
                size - inset * 2,
                size - inset * 2,
                radius
            )
        );

        if (neighbours.left) {
            parts.push(
                BarcodeRenderer.svgRect(
                    x,
                    y + inset,
                    size / 2,
                    size - inset * 2
                )
            );
        }

        if (neighbours.right) {
            parts.push(
                BarcodeRenderer.svgRect(
                    x + size / 2,
                    y + inset,
                    size / 2,
                    size - inset * 2
                )
            );
        }

        if (neighbours.top) {
            parts.push(
                BarcodeRenderer.svgRect(
                    x + inset,
                    y,
                    size - inset * 2,
                    size / 2
                )
            );
        }

        if (neighbours.bottom) {
            parts.push(
                BarcodeRenderer.svgRect(
                    x + inset,
                    y + size / 2,
                    size - inset * 2,
                    size / 2
                )
            );
        }

        return parts.join("");
    }

    /* ========================================================
       SVG LIQUID
       ======================================================== */

    static svgLiquid(matrix, row, column, x, y, size, settings) {
        const neighbours = BarcodeRenderer.getNeighbours(
            matrix, row, column
        );

        const factor = BarcodeRenderer.getIntensityFactor(settings);
        const cx = x + size / 2;
        const cy = y + size / 2;
        const radius = size * (0.43 - factor * 0.025);
        const thickness = radius * (1.25 + factor * 0.25);
        const parts = [];

        parts.push(
            '<circle ' +
            'cx="' + cx + '" ' +
            'cy="' + cy + '" ' +
            'r="' + radius + '"' +
            '/>'
        );

        if (neighbours.left) {
            parts.push(
                BarcodeRenderer.svgRect(
                    x,
                    cy - thickness / 2,
                    size / 2,
                    thickness
                )
            );
        }

        if (neighbours.right) {
            parts.push(
                BarcodeRenderer.svgRect(
                    cx,
                    cy - thickness / 2,
                    size / 2,
                    thickness
                )
            );
        }

        if (neighbours.top) {
            parts.push(
                BarcodeRenderer.svgRect(
                    cx - thickness / 2,
                    y,
                    thickness,
                    size / 2
                )
            );
        }

        if (neighbours.bottom) {
            parts.push(
                BarcodeRenderer.svgRect(
                    cx - thickness / 2,
                    cy,
                    thickness,
                    size / 2
                )
            );
        }

        return parts.join("");
    }

    /* ========================================================
       MAXICODE GEOMETRY
       ======================================================== */

    /**
     * Shared geometry for Canvas and SVG.
     *
     * moduleSize retains the original meaning:
     * the hexagon's centre-to-vertex radius.
     *
     * X is the flat-to-flat hexagon width.
     *
     * Geometry reference:
     * https://github.com/zint/zint/blob/master/backend/vector.c
     *
     * ISO/IEC 16023:2000 Figure 8 and sections 4.2.1.1, 4.11.4.
     */
    static getMaxiCodeGeometry(symbol, settings) {
        const matrix = BarcodeRenderer.getMatrix(symbol);

        if (matrix.length !== 33 || matrix[0].length !== 30) {
            throw new RangeError(
                "MaxiCode requires a 33-row, 30-column matrix."
            );
        }

        const radius = settings.moduleSize;
        const pitchX = Math.sqrt(3) * radius;
        const pitchY = 1.5 * radius;

        const padding =
            BarcodeRenderer.getQuietZone(symbol, settings) * pitchX;

        const width = 30 * pitchX + 2 * padding;
        const height = 32 * pitchY + 2 * radius + 2 * padding;

        return {
            matrix,
            radius,
            pitchX,
            pitchY,
            padding,
            width,
            height,

            centre: {
                x: padding + 14.5 * pitchX,
                y: padding + radius + 16 * pitchY
            }
        };
    }

    static getMaxiCodeModuleCentre(geometry, row, column) {
        return {
            x:
                geometry.padding +
                (column + (row % 2 ? 1 : 0.5)) * geometry.pitchX,

            y:
                geometry.padding +
                geometry.radius +
                row * geometry.pitchY
        };
    }

    /**
     * Six boundaries, outermost first:
     * dark, light, dark, light, dark, light.
     *
     * This creates three dark rings with a light centre.
     */
    static getMaxiCodeBullseyeRadii(moduleSize) {
        const shortDiameter = Math.sqrt(3) * moduleSize;
        const innerDiameter = 2 * moduleSize;
        const increment = (9 * shortDiameter - innerDiameter) / 5;

        return Array.from(
            { length: 6 },
            (_, i) => (innerDiameter + (5 - i) * increment) / 2
        );
    }

    /* ========================================================
       MAXICODE CANVAS
       ======================================================== */

    static renderMaxiCodeCanvas(symbol, canvas, settings) {
        const geometry = BarcodeRenderer.getMaxiCodeGeometry(
            symbol, settings
        );

        canvas.width = Math.ceil(geometry.width);
        canvas.height = Math.ceil(geometry.height);
        canvas.style.width = canvas.width + "px";
        canvas.style.height = canvas.height + "px";

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Unable to obtain 2D canvas context.");
        }

        context.fillStyle = settings.background;
        context.fillRect(0, 0, canvas.width, canvas.height);

        for (let row = 0; row < 33; row++) {
            // Odd rows have 29 physical positions.
            // Their column 29 entry is an unused placeholder.
            for (let column = 0; column < 30 - (row % 2); column++) {
                if (
                    !BarcodeRenderer.isDarkModule(
                        geometry.matrix[row][column]
                    )
                ) {
                    continue;
                }

                const point = BarcodeRenderer.getMaxiCodeModuleCentre(
                    geometry, row, column
                );

                BarcodeRenderer.drawHexagonCanvas(
                    context,
                    point.x,
                    point.y,
                    geometry.radius,
                    settings.foreground
                );
            }
        }

        const centre = BarcodeRenderer.getMaxiCodeCentre(
            symbol,
            geometry.width,
            geometry.height,
            geometry
        );

        BarcodeRenderer.drawMaxiCodeBullseyeCanvas(
            context,
            centre.x,
            centre.y,
            geometry.radius,
            settings
        );

        return canvas;
    }

    /* ========================================================
       HEXAGON GEOMETRY
       ======================================================== */

    static getHexagonVertices(centreX, centreY, radius) {
        return Array.from({ length: 6 }, (_, side) => {
            const angle = Math.PI / 3 * side - Math.PI / 6;

            return {
                x: centreX + radius * Math.cos(angle),
                y: centreY + radius * Math.sin(angle)
            };
        });
    }

    /* ========================================================
       HEXAGON CANVAS
       ======================================================== */

    static drawHexagonCanvas(
        context,
        centreX,
        centreY,
        radius,
        colour
    ) {
        context.beginPath();

        BarcodeRenderer.getHexagonVertices(
            centreX, centreY, radius
        ).forEach((point, index) => {
            if (index === 0) {
                context.moveTo(point.x, point.y);
            } else {
                context.lineTo(point.x, point.y);
            }
        });

        context.closePath();
        context.fillStyle = colour;
        context.fill();
    }

    /* ========================================================
       MAXICODE BULLSEYE CANVAS
       ======================================================== */

    static drawMaxiCodeBullseyeCanvas(
        context,
        centreX,
        centreY,
        moduleSize,
        settings
    ) {
        BarcodeRenderer.getMaxiCodeBullseyeRadii(
            moduleSize
        ).forEach((radius, index) => {
            context.beginPath();
            context.arc(
                centreX,
                centreY,
                radius,
                0,
                2 * Math.PI
            );

            context.fillStyle = index % 2
                ? settings.background
                : settings.foreground;

            context.fill();
        });
    }

    /* ========================================================
       MAXICODE SVG
       ======================================================== */

    static renderMaxiCodeSVG(symbol, settings) {
        const geometry = BarcodeRenderer.getMaxiCodeGeometry(
            symbol, settings
        );

        const width = Math.ceil(geometry.width);
        const height = Math.ceil(geometry.height);

        const foreground = BarcodeRenderer.escapeXML(
            settings.foreground
        );

        const background = BarcodeRenderer.escapeXML(
            settings.background
        );

        const parts = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
            `<rect width="${width}" height="${height}" fill="${background}"/>`,
            `<g fill="${foreground}">`
        ];

        for (let row = 0; row < 33; row++) {
            for (let column = 0; column < 30 - (row % 2); column++) {
                if (
                    !BarcodeRenderer.isDarkModule(
                        geometry.matrix[row][column]
                    )
                ) {
                    continue;
                }

                const point = BarcodeRenderer.getMaxiCodeModuleCentre(
                    geometry, row, column
                );

                const points = BarcodeRenderer.getHexagonPoints(
                    point.x,
                    point.y,
                    geometry.radius
                );

                parts.push(`<polygon points="${points}"/>`);
            }
        }

        parts.push("</g>");

        const centre = BarcodeRenderer.getMaxiCodeCentre(
            symbol,
            geometry.width,
            geometry.height,
            geometry
        );

        BarcodeRenderer.getMaxiCodeBullseyeRadii(
            geometry.radius
        ).forEach((radius, index) => {
            const colour = index % 2 ? background : foreground;

            parts.push(
                `<circle cx="${centre.x}" cy="${centre.y}" r="${radius}" fill="${colour}"/>`
            );
        });

        parts.push("</svg>");

        return parts.join("");
    }

    /* ========================================================
       HEXAGON SVG POINTS
       ======================================================== */

    static getHexagonPoints(centreX, centreY, radius) {
        return BarcodeRenderer.getHexagonVertices(
            centreX, centreY, radius
        )
            .map(point => `${point.x.toFixed(6)},${point.y.toFixed(6)}`)
            .join(" ");
    }

    /* ========================================================
       MAXICODE CENTRE
       ======================================================== */

    static getMaxiCodeCentre(symbol, width, height, geometry) {
        // Preserve explicit pixel-coordinate overrides.
        if (
            symbol.bullseye &&
            Number.isFinite(symbol.bullseye.x) &&
            Number.isFinite(symbol.bullseye.y)
        ) {
            return {
                x: symbol.bullseye.x,
                y: symbol.bullseye.y
            };
        }

        if (geometry) {
            return { ...geometry.centre };
        }

        // Compatibility for three-argument callers.
        // Recover X assuming symmetric padding and unrounded dimensions.
        const heightInX =
            32 * Math.sqrt(3) / 2 +
            2 / Math.sqrt(3);

        const pitchX = (width - height) / (30 - heightInX);

        return {
            x: width / 2 - pitchX / 2,
            y: height / 2
        };
    }

    /* ========================================================
       GET MATRIX
       ======================================================== */

    static getMatrix(symbol) {
        let matrix = null;

        if (Array.isArray(symbol.matrix)) {
            matrix = symbol.matrix;
        } else if (
            symbol.matrix &&
            typeof symbol.matrix.getMatrix === "function"
        ) {
            matrix = symbol.matrix.getMatrix();
        } else if (Array.isArray(symbol.modules)) {
            matrix = symbol.modules;
        } else if (Array.isArray(symbol)) {
            matrix = symbol;
        }

        if (!Array.isArray(matrix) || matrix.length === 0) {
            throw new Error(
                "Barcode symbol does not contain a valid matrix."
            );
        }

        if (!Array.isArray(matrix[0]) || matrix[0].length === 0) {
            throw new Error(
                "Barcode matrix must contain nonempty array rows."
            );
        }

        const width = matrix[0].length;

        if (width === 0) {
            throw new Error("Barcode matrix cannot contain empty rows.");
        }

        for (let row = 0; row < matrix.length; row++) {
            if (
                !Array.isArray(matrix[row]) ||
                matrix[row].length !== width
            ) {
                throw new Error(
                    "Barcode matrix rows must all have the same width."
                );
            }
        }

        return matrix;
    }

    /* ========================================================
       DARK MODULE TEST
       ======================================================== */

    static isDarkModule(module) {
        if (module === true || module === 1) {
            return true;
        }

        if (
            module === false ||
            module === 0 ||
            module === null ||
            module === undefined
        ) {
            return false;
        }

        if (typeof module === "object") {
            if (module.value !== undefined) {
                return Boolean(module.value);
            }

            if (module.dark !== undefined) {
                return Boolean(module.dark);
            }

            if (module.filled !== undefined) {
                return Boolean(module.filled);
            }
        }

        return Boolean(module);
    }

    /* ========================================================
       QUIET ZONE
       ======================================================== */

    static getQuietZone(symbol, settings) {
        if (!settings.quietZone) {
            return 0;
        }

        if (
            Number.isInteger(settings.quietZoneModules) &&
            settings.quietZoneModules >= 0
        ) {
            return settings.quietZoneModules;
        }

        if (
            Number.isInteger(symbol.quietZone) &&
            symbol.quietZone >= 0
        ) {
            return symbol.quietZone;
        }

        switch (BarcodeRenderer.normaliseFormat(symbol.format)) {
            case "qr":
                return 4;

            case "microqr":
                return 2;

            case "maxicode":
            case "datamatrix":
                return 1;

            case "aztec":
                return 2;

            case "pdf417":
                return 2;

            default:
                return 4;
        }
    }

    /* ========================================================
       NORMALISE OPTIONS
       ======================================================== */

    static normaliseOptions(symbol, options) {
        options = options || {};

        const settings = Object.assign(
            {},
            BarcodeRenderer.DEFAULT_OPTIONS,
            options
        );

        settings.moduleSize = Number.parseInt(
            settings.moduleSize,
            10
        );

        if (
            !Number.isInteger(settings.moduleSize) ||
            settings.moduleSize < 1
        ) {
            settings.moduleSize =
                BarcodeRenderer.DEFAULT_OPTIONS.moduleSize;
        }

        // Existing app property aliases.
        if (options.foregroundColor && !options.foreground) {
            settings.foreground = options.foregroundColor;
        }

        if (options.backgroundColor && !options.background) {
            settings.background = options.backgroundColor;
        }

        if (
            options.includeQuietZone !== undefined &&
            options.quietZone === undefined
        ) {
            settings.quietZone = Boolean(options.includeQuietZone);
        }

        if (
            options.fancyCode !== undefined &&
            options.fancy === undefined
        ) {
            settings.fancy = Boolean(options.fancyCode);
        }

        settings.foreground = BarcodeRenderer.validateColour(
            settings.foreground,
            "#000000"
        );

        settings.background = BarcodeRenderer.validateColour(
            settings.background,
            "#ffffff"
        );

        settings.quietZone = Boolean(settings.quietZone);
        settings.fancy = Boolean(settings.fancy);
        settings.preservePatterns = settings.preservePatterns !== false;

        const styles = [
            "organic",
            "rounded",
            "dots",
            "diamond",
            "liquid"
        ];

        if (!styles.includes(settings.fancyStyle)) {
            settings.fancyStyle = "organic";
        }

        const intensities = [
            "subtle",
            "medium",
            "strong"
        ];

        if (!intensities.includes(settings.fancyIntensity)) {
            settings.fancyIntensity = "medium";
        }

        return settings;
    }

    /* ========================================================
       COLOUR VALIDATION
       ======================================================== */

    static validateColour(colour, fallback) {
        if (typeof colour !== "string") {
            return fallback;
        }

        const trimmed = colour.trim();

        if (
            typeof CSS !== "undefined" &&
            typeof CSS.supports === "function"
        ) {
            if (CSS.supports("color", trimmed)) {
                return trimmed;
            }

            return fallback;
        }

        if (
            /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(
                trimmed
            )
        ) {
            return trimmed;
        }

        return fallback;
    }

    /* ========================================================
       FORMAT NORMALISATION
       ======================================================== */

    static normaliseFormat(format) {
        if (typeof format !== "string") {
            return "";
        }

        return format
            .toLowerCase()
            .replace(/[\s_-]/g, "");
    }

    /* ========================================================
       SYMBOL VALIDATION
       ======================================================== */

    static validateSymbol(symbol) {
        if (!symbol) {
            throw new Error(
                "BarcodeRenderer requires a generated symbol."
            );
        }

        BarcodeRenderer.getMatrix(symbol);
    }

    /* ========================================================
       XML ESCAPING
       ======================================================== */

    static escapeXML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }
}

if (typeof window !== "undefined") {
    window.BarcodeRenderer = BarcodeRenderer;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = BarcodeRenderer;
}