/**
 * ============================================================
 * 2D CODE MAKER
 * Application Controller
 * ============================================================
 *
 * Handles:
 *  - jQuery UI events
 *  - Format selection
 *  - Input validation
 *  - Generator selection
 *  - Standard / fancy rendering
 *  - Fancy style controls
 *  - Preview information
 *  - PNG download
 *  - SVG download
 *  - Colour controls
 *  - Clearing/resetting the interface
 *
 * Encoding is handled by the individual generator classes.
 * Rendering is handled by BarcodeRenderer.
 * ============================================================
 */

$(document).ready(function () {

    "use strict";


    /* ========================================================
     DOM REFERENCES
     ======================================================== */

    const $format =
            $("#format");

    const $dataInput =
            $("#dataInput");

    const $characterCount =
            $("#characterCount");

    const $errorCorrection =
            $("#errorCorrection");

    const $moduleSize =
            $("#moduleSize");

    const $foregroundColor =
            $("#foregroundColor");

    const $backgroundColor =
            $("#backgroundColor");

    const $includeQuietZone =
            $("#includeQuietZone");


    /* --------------------------------------------------------
     Fancy Code
     -------------------------------------------------------- */

    const $fancyCode =
            $("#fancyCode");

    const $fancyOptions =
            $("#fancyOptions");

    const $fancyStyle =
            $("#fancyStyle");

    const $fancyIntensity =
            $("#fancyIntensity");

    const $preservePatterns =
            $("#preservePatterns");

    const $fancyBadge =
            $("#fancyBadge");


    /* --------------------------------------------------------
     Buttons
     -------------------------------------------------------- */

    const $generateButton =
            $("#generateButton");

    const $clearButton =
            $("#clearButton");

    const $downloadPngButton =
            $("#downloadPngButton");

    const $downloadSvgButton =
            $("#downloadSvgButton");


    /* --------------------------------------------------------
     Preview
     -------------------------------------------------------- */

    const $canvas =
            $("#barcodeCanvas");

    const $svgOutput =
            $("#svgOutput");

    const $emptyState =
            $("#emptyState");

    const $previewStatus =
            $("#previewStatus");

    const $formatBadge =
            $("#formatBadge");

    const $detailFormat =
            $("#detailFormat");

    const $detailDimensions =
            $("#detailDimensions");

    const $detailDataSize =
            $("#detailDataSize");

    const $detailStatus =
            $("#detailStatus");


    /* ========================================================
     APPLICATION STATE
     ======================================================== */

    let currentSymbol = null;

    let currentFormat = "qr";

    let currentSvg = null;


    /* ========================================================
     FORMAT DEFINITIONS
     ======================================================== */

    const formatDefinitions = {

        qr: {

            name:
                    "QR Code",

            badge:
                    "QR CODE",

            generator:
                    function (data, options) {

                        return QRGenerator.generate(
                                data,
                                options
                                );
                    }
        },

        microqr: {

            name:
                    "Micro QR",

            badge:
                    "MICRO QR",

            generator:
                    function (data, options) {

                        return MicroQRGenerator.generate(
                                data,
                                options
                                );
                    }
        },

        datamatrix: {

            name:
                    "Data Matrix",

            badge:
                    "DATA MATRIX",

            generator:
                    function (data, options) {

                        return DataMatrixGenerator.generate(
                                data,
                                options
                                );
                    }
        },

        aztec: {

            name:
                    "Aztec Code",

            badge:
                    "AZTEC",

            generator:
                    function (data, options) {

                        return AztecGenerator.generate(
                                data,
                                options
                                );
                    }
        },

        pdf417: {

            name:
                    "PDF417",

            badge:
                    "PDF417",

            generator:
                    function (data, options) {

                        return PDF417Generator.generate(
                                data,
                                options
                                );
                    }
        },

        maxicode: {
            name: "MaxiCode",
            badge: "MAXICODE",

            generator: function (data, options) {
                return {
                    ...MaxiCodeGenerator.generateDetailed(data, options),
                    format: "maxicode"
                };
            }
        }

    };


    /* ========================================================
     INITIALISE
     ======================================================== */

    initialise();


    function initialise() {

        updateCharacterCount();

        updateFormatInterface();

        updateColourLabels();

        updateFancyInterface();

        resetPreview();
    }


    /* ========================================================
     EVENT HANDLERS
     ======================================================== */


    /* --------------------------------------------------------
     Data input
     -------------------------------------------------------- */

    $dataInput.on(
            "input",
            function () {

                updateCharacterCount();

                updateDataSize();
            }
    );


    /* --------------------------------------------------------
     Format
     -------------------------------------------------------- */

    $format.on(
            "change",
            function () {

                currentFormat =
                        $(this).val();

                updateFormatInterface();

                invalidateCurrentCode();
            }
    );


    /* --------------------------------------------------------
     Error correction
     -------------------------------------------------------- */

    $errorCorrection.on(
            "change",
            function () {

                /*
                 * Error correction affects the encoded matrix,
                 * therefore the symbol must be generated again.
                 */

                invalidateCurrentCode();
            }
    );


    /* --------------------------------------------------------
     Foreground colour
     -------------------------------------------------------- */

    $foregroundColor.on(
            "input change",
            function () {

                updateColourLabels();

                rerenderIfAvailable();
            }
    );


    /* --------------------------------------------------------
     Background colour
     -------------------------------------------------------- */

    $backgroundColor.on(
            "input change",
            function () {

                updateColourLabels();

                rerenderIfAvailable();
            }
    );


    /* --------------------------------------------------------
     Module size
     -------------------------------------------------------- */

    $moduleSize.on(
            "change",
            function () {

                rerenderIfAvailable();
            }
    );


    /* --------------------------------------------------------
     Quiet zone
     -------------------------------------------------------- */

    $includeQuietZone.on(
            "change",
            function () {

                rerenderIfAvailable();
            }
    );


    /* --------------------------------------------------------
     Fancy Code ON / OFF
     -------------------------------------------------------- */

    $fancyCode.on(
            "change",
            function () {

                updateFancyInterface();

                rerenderIfAvailable();
            }
    );


    /* --------------------------------------------------------
     Fancy style
     -------------------------------------------------------- */

    $fancyStyle.on(
            "change",
            function () {

                rerenderIfAvailable();
            }
    );


    /* --------------------------------------------------------
     Fancy intensity
     -------------------------------------------------------- */

    $fancyIntensity.on(
            "change",
            function () {

                rerenderIfAvailable();
            }
    );


    /* --------------------------------------------------------
     Preserve critical patterns
     -------------------------------------------------------- */

    $preservePatterns.on(
            "change",
            function () {

                rerenderIfAvailable();
            }
    );


    /* --------------------------------------------------------
     Generate
     -------------------------------------------------------- */

    $generateButton.on(
            "click",
            function () {

                generateCode();
            }
    );


    /* --------------------------------------------------------
     CTRL + ENTER shortcut
     -------------------------------------------------------- */

    $dataInput.on(
            "keydown",
            function (event) {

                if (
                        event.ctrlKey &&
                        event.key === "Enter"
                        ) {

                    event.preventDefault();

                    generateCode();
                }
            }
    );


    /* --------------------------------------------------------
     Clear
     -------------------------------------------------------- */

    $clearButton.on(
            "click",
            function () {

                clearApplication();
            }
    );


    /* --------------------------------------------------------
     PNG download
     -------------------------------------------------------- */

    $downloadPngButton.on(
            "click",
            function () {

                downloadPNG();
            }
    );


    /* --------------------------------------------------------
     SVG download
     -------------------------------------------------------- */

    $downloadSvgButton.on(
            "click",
            function () {

                downloadSVG();
            }
    );


    /* ========================================================
     GENERATE CODE
     ======================================================== */

    function generateCode() {

        const data =
                $dataInput.val();

        const format =
                $format.val();


        clearError();


        if (
                data === null ||
                data.length === 0
                ) {

            showError(
                    "Enter some data before generating a code."
                    );

            $dataInput.trigger(
                    "focus"
                    );

            return;
        }


        const definition =
                formatDefinitions[format];


        if (!definition) {

            showError(
                    "The selected code format is not available."
                    );

            return;
        }


        const options =
                buildGeneratorOptions();


        setGeneratingState();


        try {

            currentSymbol =
                    definition.generator(
                            data,
                            options
                            );


            if (!currentSymbol) {

                throw new Error(
                        "The generator returned no symbol."
                        );
            }


            currentFormat =
                    format;


            /*
             * Render using the current visual settings,
             * including Fancy Code.
             */

            renderCurrentSymbol();


            setSuccessState();

        } catch (error) {

            console.error(
                    "2D Code generation failed:",
                    error
                    );


            currentSymbol = null;

            currentSvg = null;


            showError(
                    error.message ||
                    "The code could not be generated."
                    );
        }
    }


    /* ========================================================
     GENERATOR OPTIONS
     ======================================================== */

    function buildGeneratorOptions() {

        /*
         * These settings affect generation.
         *
         * Fancy settings are deliberately NOT required by the
         * barcode generators. Fancy Code changes rendering only.
         */

        return {

            errorCorrection:
                    $errorCorrection.val(),

            moduleSize:
                    getModuleSize(),

            foreground:
                    $foregroundColor.val(),

            background:
                    $backgroundColor.val(),

            quietZone:
                    $includeQuietZone.is(
                            ":checked"
                            )

        };
    }


    /* ========================================================
     RENDER OPTIONS
     ======================================================== */

    function buildRenderOptions() {

        /*
         * This is the central place where UI rendering settings
         * are converted into BarcodeRenderer options.
         *
         * IMPORTANT:
         * Fancy Code must be passed here or BarcodeRenderer will
         * fall back to its default:
         *
         *      fancy: false
         */

        return {

            moduleSize:
                    getModuleSize(),

            foreground:
                    $foregroundColor.val(),

            background:
                    $backgroundColor.val(),

            quietZone:
                    $includeQuietZone.is(
                            ":checked"
                            ),

            fancy:
                    $fancyCode.is(
                            ":checked"
                            ),

            fancyStyle:
                    getFancyStyle(),

            fancyIntensity:
                    getFancyIntensity(),

            preservePatterns:
                    $preservePatterns.is(
                            ":checked"
                            )

        };
    }


    /* ========================================================
     RENDER CURRENT SYMBOL
     ======================================================== */

    function renderCurrentSymbol() {

        if (!currentSymbol) {

            return;
        }


        const canvas =
                $canvas.get(0);


        if (!canvas) {

            throw new Error(
                    "Barcode preview canvas was not found."
                    );
        }


        const renderOptions =
                buildRenderOptions();


        /*
         * Useful while developing.
         *
         * You can inspect this in DevTools and verify:
         *
         * fancy: true
         * fancyStyle: "dots" / "rounded" / etc.
         */

        console.debug(
                "Barcode render options:",
                renderOptions
                );


        /*
         * Render Canvas.
         */

        BarcodeRenderer.renderCanvas(
                currentSymbol,
                canvas,
                renderOptions
                );


        /*
         * Render equivalent SVG using exactly the same visual
         * settings. This keeps PNG and SVG exports consistent.
         */

        currentSvg =
                BarcodeRenderer.renderSVG(
                        currentSymbol,
                        renderOptions
                        );


        /*
         * Show Canvas.
         */

        $emptyState.attr(
                "hidden",
                true
                );


        $svgOutput.attr(
                "hidden",
                true
                );


        $canvas.attr(
                "hidden",
                false
                );


        updateSymbolDetails();

        updateFancyBadge();

        enableDownloads();
    }


    /* ========================================================
     RE-RENDER EXISTING SYMBOL
     ======================================================== */

    function rerenderIfAvailable() {

        if (currentSymbol !== null) {

            try {

                renderCurrentSymbol();
            } catch (error) {

                console.error(
                        "2D Code rendering failed:",
                        error
                        );

                showError(
                        error.message ||
                        "The code could not be rendered."
                        );
            }
        }
    }


    /* ========================================================
     MODULE SIZE
     ======================================================== */

    function getModuleSize() {

        const value =
                parseInt(
                        $moduleSize.val(),
                        10
                        );


        if (
                Number.isInteger(value) &&
                value > 0
                ) {

            return value;
        }


        return 6;
    }


    /* ========================================================
     FANCY STYLE
     ======================================================== */

    function getFancyStyle() {

        const value =
                String(
                        $fancyStyle.val() ||
                        "organic"
                        )
                .toLowerCase()
                .trim();


        const validStyles = [

            "rounded",
            "dots",
            "diamond",
            "organic",
            "liquid"

        ];


        if (
                validStyles.includes(
                        value
                        )
                ) {

            return value;
        }


        return "organic";
    }


    /* ========================================================
     FANCY INTENSITY
     ======================================================== */

    function getFancyIntensity() {

        const value =
                String(
                        $fancyIntensity.val() ||
                        "medium"
                        )
                .toLowerCase()
                .trim();


        const validIntensities = [

            "subtle",
            "medium",
            "strong"

        ];


        if (
                validIntensities.includes(
                        value
                        )
                ) {

            return value;
        }


        return "medium";
    }


    /* ========================================================
     FANCY CODE INTERFACE
     ======================================================== */

    function updateFancyInterface() {

        const enabled =
                $fancyCode.is(
                        ":checked"
                        );


        /*
         * Enable / disable Fancy controls.
         */

        $fancyStyle.prop(
                "disabled",
                !enabled
                );


        $fancyIntensity.prop(
                "disabled",
                !enabled
                );


        $preservePatterns.prop(
                "disabled",
                !enabled
                );


        /*
         * Apply visual active state to Fancy panel.
         */

        $fancyOptions.toggleClass(
                "active",
                enabled
                );


        updateFancyBadge();
    }


    /* ========================================================
     FANCY BADGE
     ======================================================== */

    function updateFancyBadge() {

        const enabled =
                $fancyCode.is(
                        ":checked"
                        );


        if ($fancyBadge.length === 0) {

            return;
        }


        $fancyBadge.attr(
                "hidden",
                !enabled
                );


        if (enabled) {

            const style =
                    getFancyStyle();


            $fancyBadge.text(
                    "FANCY · " +
                    style.toUpperCase()
                    );
        }
    }


    /* ========================================================
     UPDATE SYMBOL DETAILS
     ======================================================== */

    function updateSymbolDetails() {

        const definition =
                formatDefinitions[
                        currentFormat
                ];


        if (!definition) {

            return;
        }


        $detailFormat.text(
                definition.name
                );


        const width =
                getSymbolWidth(
                        currentSymbol
                        );


        const height =
                getSymbolHeight(
                        currentSymbol
                        );


        if (
                width !== null &&
                height !== null
                ) {

            $detailDimensions.text(
                    width +
                    " × " +
                    height +
                    " modules"
                    );
        } else {

            $detailDimensions.text(
                    "Generated"
                    );
        }


        updateDataSize();


        $detailStatus.text(
                "Ready"
                );


        if (
                $fancyCode.is(
                        ":checked"
                        )
                ) {

            $previewStatus.text(
                    definition.name +
                    " generated with " +
                    getFancyStyle() +
                    " rendering."
                    );
        } else {

            $previewStatus.text(
                    definition.name +
                    " generated successfully."
                    );
        }
    }


    /* ========================================================
     SYMBOL DIMENSIONS
     ======================================================== */

    function getSymbolWidth(symbol) {

        if (!symbol) {

            return null;
        }


        if (
                typeof symbol.width ===
                "number"
                ) {

            return symbol.width;
        }


        if (
                Array.isArray(
                        symbol.matrix
                        ) &&
                symbol.matrix.length > 0 &&
                Array.isArray(
                        symbol.matrix[0]
                        )
                ) {

            return symbol.matrix[0].length;
        }


        if (
                symbol.matrix &&
                typeof symbol.matrix.getMatrix ===
                "function"
                ) {

            const matrix =
                    symbol.matrix.getMatrix();


            if (
                    Array.isArray(matrix) &&
                    matrix.length > 0 &&
                    Array.isArray(matrix[0])
                    ) {

                return matrix[0].length;
            }
        }


        if (
                Array.isArray(symbol) &&
                symbol.length > 0 &&
                Array.isArray(symbol[0])
                ) {

            return symbol[0].length;
        }


        return null;
    }


    function getSymbolHeight(symbol) {

        if (!symbol) {

            return null;
        }


        if (
                typeof symbol.height ===
                "number"
                ) {

            return symbol.height;
        }


        if (
                Array.isArray(
                        symbol.matrix
                        )
                ) {

            return symbol.matrix.length;
        }


        if (
                symbol.matrix &&
                typeof symbol.matrix.getMatrix ===
                "function"
                ) {

            const matrix =
                    symbol.matrix.getMatrix();


            if (Array.isArray(matrix)) {

                return matrix.length;
            }
        }


        if (
                Array.isArray(symbol)
                ) {

            return symbol.length;
        }


        return null;
    }


    /* ========================================================
     CHARACTER COUNT
     ======================================================== */

    function updateCharacterCount() {

        const value =
                $dataInput.val() || "";


        const length =
                value.length;


        let text =
                length +
                " character";


        if (length !== 1) {

            text += "s";
        }


        $characterCount.text(
                text
                );
    }


    /* ========================================================
     DATA SIZE
     ======================================================== */

    function updateDataSize() {

        const data =
                $dataInput.val() || "";


        let byteCount = 0;


        /*
         * TextEncoder is supported by modern browsers.
         */

        if (
                typeof TextEncoder !==
                "undefined"
                ) {

            byteCount =
                    new TextEncoder()
                    .encode(data)
                    .length;
        } else {

            /*
             * Fallback for older browsers.
             */

            byteCount =
                    unescape(
                            encodeURIComponent(data)
                            )
                    .length;
        }


        $detailDataSize.text(
                formatByteCount(
                        byteCount
                        )
                );
    }


    function formatByteCount(bytes) {

        if (bytes < 1024) {

            return (
                    bytes +
                    (
                            bytes === 1
                            ? " byte"
                            : " bytes"
                            )
                    );
        }


        const kilobytes =
                bytes / 1024;


        return (
                kilobytes.toFixed(2) +
                " KB"
                );
    }


    /* ========================================================
     FORMAT INTERFACE
     ======================================================== */

    function updateFormatInterface() {

        const format =
                $format.val();


        const definition =
                formatDefinitions[format];


        if (!definition) {

            return;
        }


        currentFormat =
                format;


        $formatBadge.text(
                definition.badge
                );


        $detailFormat.text(
                definition.name
                );


        updateErrorCorrectionInterface(
                format
                );


        /*
         * MaxiCode already uses specialised hexagonal geometry.
         *
         * We leave Fancy Code available in the interface so the
         * renderer can decide how to handle each format.
         */

        updateFancyInterface();
    }


    /* ========================================================
     ERROR CORRECTION OPTIONS
     ======================================================== */

    function updateErrorCorrectionInterface(
            format
            ) {

        const qrFamily =
                (
                        format === "qr" ||
                        format === "microqr"
                        );


        /*
         * Currently all generator implementations receive the
         * selected correction value.
         *
         * Keeping this logic here makes it easy to specialise
         * the UI later.
         */

        if (qrFamily) {

            $errorCorrection.prop(
                    "disabled",
                    false
                    );
        } else {

            $errorCorrection.prop(
                    "disabled",
                    false
                    );
        }
    }


    /* ========================================================
     COLOUR LABELS
     ======================================================== */

    function updateColourLabels() {

        const foreground =
                String(
                        $foregroundColor.val() ||
                        ""
                        )
                .toUpperCase();


        const background =
                String(
                        $backgroundColor.val() ||
                        ""
                        )
                .toUpperCase();


        $foregroundColor
                .siblings("span")
                .text(
                        foreground
                        );


        $backgroundColor
                .siblings("span")
                .text(
                        background
                        );
    }


    /* ========================================================
     GENERATING STATE
     ======================================================== */

    function setGeneratingState() {

        $generateButton.prop(
                "disabled",
                true
                );


        $generateButton
                .find("span")
                .text(
                        "Generating..."
                        );


        $previewStatus.text(
                "Generating symbol..."
                );


        $detailStatus.text(
                "Working"
                );


        disableDownloads();
    }


    /* ========================================================
     SUCCESS STATE
     ======================================================== */

    function setSuccessState() {

        $generateButton.prop(
                "disabled",
                false
                );


        $generateButton
                .find("span")
                .text(
                        "Generate Code"
                        );


        $detailStatus.text(
                "Ready"
                );
    }


    /* ========================================================
     ERROR STATE
     ======================================================== */

    function showError(message) {

        $generateButton.prop(
                "disabled",
                false
                );


        $generateButton
                .find("span")
                .text(
                        "Generate Code"
                        );


        $previewStatus.text(
                message
                );


        $detailStatus.text(
                "Error"
                );


        $detailDimensions.text(
                "—"
                );


        disableDownloads();
    }


    function clearError() {

        $detailStatus.text(
                "Waiting"
                );
    }


    /* ========================================================
     INVALIDATE CURRENT CODE
     ======================================================== */

    function invalidateCurrentCode() {

        currentSymbol = null;

        currentSvg = null;


        $canvas.attr(
                "hidden",
                true
                );


        $svgOutput.attr(
                "hidden",
                true
                );


        $emptyState.attr(
                "hidden",
                false
                );


        $detailDimensions.text(
                "—"
                );


        $detailStatus.text(
                "Waiting"
                );


        $previewStatus.text(
                "Generate the code to apply these settings."
                );


        disableDownloads();
    }


    /* ========================================================
     DOWNLOAD BUTTONS
     ======================================================== */

    function enableDownloads() {

        $downloadPngButton.prop(
                "disabled",
                false
                );


        $downloadSvgButton.prop(
                "disabled",
                false
                );
    }


    function disableDownloads() {

        $downloadPngButton.prop(
                "disabled",
                true
                );


        $downloadSvgButton.prop(
                "disabled",
                true
                );
    }


    /* ========================================================
     PNG DOWNLOAD
     ======================================================== */

    function downloadPNG() {

        if (!currentSymbol) {

            return;
        }


        const canvas =
                $canvas.get(0);


        if (!canvas) {

            return;
        }


        const filename =
                createFilename(
                        "png"
                        );


        canvas.toBlob(
                function (blob) {

                    if (!blob) {

                        showError(
                                "PNG export failed."
                                );

                        return;
                    }


                    downloadBlob(
                            blob,
                            filename
                            );
                },
                "image/png"
                );
    }


    /* ========================================================
     SVG DOWNLOAD
     ======================================================== */

    function downloadSVG() {

        if (
                !currentSymbol ||
                !currentSvg
                ) {

            return;
        }


        let svgText =
                currentSvg;


        /*
         * BarcodeRenderer may return either a string or an
         * SVG DOM element.
         */

        if (
                typeof SVGElement !==
                "undefined" &&
                currentSvg instanceof
                SVGElement
                ) {

            svgText =
                    new XMLSerializer()
                    .serializeToString(
                            currentSvg
                            );
        }


        if (
                typeof svgText !==
                "string"
                ) {

            showError(
                    "SVG export failed."
                    );

            return;
        }


        const blob =
                new Blob(
                        [svgText],
                        {
                            type:
                                    "image/svg+xml;charset=utf-8"
                        }
                );


        downloadBlob(
                blob,
                createFilename(
                        "svg"
                        )
                );
    }


    /* ========================================================
     FILE DOWNLOAD
     ======================================================== */

    function downloadBlob(
            blob,
            filename
            ) {

        const url =
                URL.createObjectURL(
                        blob
                        );


        const $link =
                $("<a>")
                .attr(
                        "href",
                        url
                        )
                .attr(
                        "download",
                        filename
                        )
                .css(
                        "display",
                        "none"
                        );


        $("body").append(
                $link
                );


        const link =
                $link.get(0);


        if (link) {

            link.click();
        }


        $link.remove();


        setTimeout(
                function () {

                    URL.revokeObjectURL(
                            url
                            );
                },
                1000
                );
    }


    /* ========================================================
     DOWNLOAD FILE NAME
     ======================================================== */

    function createFilename(extension) {

        const format =
                String(
                        currentFormat ||
                        "barcode"
                        )
                .toLowerCase()
                .replace(
                        /[^a-z0-9]+/g,
                        "-"
                        )
                .replace(
                        /^-+|-+$/g,
                        ""
                        );


        const fancySuffix =
                $fancyCode.is(
                        ":checked"
                        )
                ? "-" + getFancyStyle()
                : "";


        return (
                format +
                fancySuffix +
                "-code." +
                extension
                );
    }


    /* ========================================================
     CLEAR APPLICATION
     ======================================================== */

    function clearApplication() {

        $dataInput.val(
                ""
                );


        currentSymbol = null;

        currentSvg = null;


        updateCharacterCount();

        updateDataSize();

        updateFancyInterface();

        resetPreview();


        $dataInput.trigger(
                "focus"
                );
    }


    /* ========================================================
     RESET PREVIEW
     ======================================================== */

    function resetPreview() {

        $canvas.attr(
                "hidden",
                true
                );


        $svgOutput.attr(
                "hidden",
                true
                );


        $emptyState.attr(
                "hidden",
                false
                );


        $previewStatus.text(
                "Enter some data and generate a code."
                );


        $detailDimensions.text(
                "—"
                );


        $detailStatus.text(
                "Waiting"
                );


        updateFancyBadge();

        updateDataSize();

        disableDownloads();
    }

});