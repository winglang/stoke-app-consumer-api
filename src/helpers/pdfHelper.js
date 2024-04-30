/* eslint-disable no-magic-numbers */
/* eslint-disable no-undefined */

'use strict'

const { jsonLogger, urlLib } = require('stoke-app-common-api');

const PDFDocument = require("pdfkit");
const fetch = require('node-fetch');
const { URL } = require("url");

const basePath = 'assets';
const defaultFont = `${basePath}/fonts/Montserrat-Regular.ttf`;
const boldFont = `${basePath}/fonts/Montserrat-Bold.ttf`;

const isUrl = (s) => {
    try {
        // eslint-disable-next-line no-new
        new URL(s);
        return true;
    } catch (err) {
        return false;
    }
  };


const fetchImage = async (src) => {
    if (src && !urlLib.validateImageURL(src)) {
        jsonLogger.error({ type: 'TRACKING', function: 'PDFDOC::fetchImage', error: 'Invalid image URL', src });
        return undefined;
    }

    try {
        const response = await fetch(src);
        if (response.status === 200) { 
            return await response.buffer();
        }
        jsonLogger.error({ type: 'TRACKING', function: 'PDFDOC::fetchImage', error: 'Image fetch error', status: response.status, src });
    } catch (error) {
        jsonLogger.error({ type: 'TRACKING', function: 'PDFDOC::fetchImage', error: error.message, src });
    }
    return undefined;
}

const defaultTextColor = '#463f5a'
const defaultFontSize = 20;


class PDFDOC {

    constructor (options) {
        this.doc = new PDFDocument(options);
    }

    // eslint-disable-next-line max-params
    label (text, x = 0, y = 0, size = undefined, color = undefined, bold = false, options = {}) {
        const fontSize = size || defaultFontSize;
        this.doc.fontSize(fontSize).
            font(bold ? boldFont : defaultFont).
            fillColor(color || defaultTextColor).
            text(text, x, y, options);
        // eslint-disable-next-line no-extra-parens
        return y + (fontSize * 1.2);
    }

    stringWidth (text, size = undefined, bold = false) {
        const fontSize = size || defaultFontSize;
        this.doc.fontSize(fontSize).
            font(bold ? boldFont : defaultFont);
        return this.doc.widthOfString(text);
    }

    stringHeight (text, size = undefined, bold = false) {
        const fontSize = size || defaultFontSize;
        this.doc.fontSize(fontSize).
            font(bold ? boldFont : defaultFont);
        return this.doc.heightOfString(text);
    }    

    // eslint-disable-next-line max-params
    async image (src, x = 0, y = 0, width = undefined, height = undefined, options = {}) {
        if (src) {
            let image = src;
            if (isUrl(src)) {
                image = await fetchImage(src);
            }
            if (image) {
                if (width) {
                    options.width = width;
                }
                if (height) {
                    options.height = height;
                }
                try {
                    this.doc.image(image, x, y, options)
                } catch (e) {
                    jsonLogger.error({ type: 'TRACKING', function: 'PDFDOC::fetchImage', message: `error adding image ${src} to PDF`, exception: e.message });
                }
            }
        }
    }

    doc () {
        return this.doc;
    }
}

module.exports = {
    PDFDOC
};
