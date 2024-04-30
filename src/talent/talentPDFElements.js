/* eslint-disable no-magic-numbers */
/* eslint-disable max-params */
/* eslint-disable no-return-await */
/* eslint-disable no-extra-parens */
/* eslint-disable no-undefined */
/* eslint-disable multiline-comment-style */
/* eslint-disable newline-per-chained-call */
/* eslint-disable capitalized-comments */


'use strict'

const _ = require('lodash');
const constants = require('./pdfConsts');

const drawContentBox = (pdf, x, y, boxWidth, boxHeight) => {
    const radius = 18;
    pdf.doc.roundedRect(x, y, boxWidth, boxHeight, radius).fillAndStroke(constants.colorWhite, constants.colorGray5);
}


const renderTitleAndList = async (pdf, list, title, x = 0, y = 0, textOptions = {}) => {
    const titlePadding = 14;
    let nextY = y;
    if (list.length > 0) {
        nextY = titlePadding + pdf.label(title, x, y, constants.fontSizeN, undefined, true, textOptions);
        // eslint-disable-next-line array-element-newline
        for (const item of list) {
            const { name, icon, link } = item;
            let labelX = x;
            if (icon) {
                // eslint-disable-next-line no-await-in-loop
                await pdf.image(icon, x, nextY, undefined, undefined, { 
                        fit: [
                            18, 
                            18
                        ], align: 'center', valign: 'center' 
                    });

                labelX += 30;
            }
            if (link) {
                
                textOptions.link = link;
            }

            nextY = pdf.label(name, labelX, nextY, constants.fontSizeN, undefined, false, textOptions);
        }
        return nextY;
    }
    return 0;
}


const renderTags = (pdf, list, labelProp, x = 0, y = 0) => {
    const paddingY = 8;
    const paddingX = 12;
    const marginX = 12;
    const radius = 16;
    let nextX = x;
    
    for (const item of list) {
        
        const text = _.get(item, labelProp).trim();
        const stringWidth = pdf.stringWidth(text, constants.fontSizeN, false);
        const boxWidth = stringWidth + (paddingX * 2);
        pdf.doc.roundedRect(nextX, y, boxWidth, constants.fontSizeN + (paddingY * 2), radius).stroke(constants.colorPurpleLight);
        pdf.label(text, nextX + paddingX, paddingY + y - 2, constants.fontSizeN, constants.colorPurpleLight, false, { width: stringWidth });
        nextX = nextX + boxWidth + marginX;
    }    
}


const renderCheck = (pdf, enabled, x = 0, y = 0) => {
    const fill = enabled ? constants.colorPurpleCornflower : constants.colorGray20;
    const stroke = enabled ? constants.colorPurpleCornflower : constants.colorGray10;
    const lineStroke = enabled ? constants.colorWhite : constants.colorGray40;
    pdf.doc.circle(x + 10, y + 10, 10).fillAndStroke(fill, stroke);
    pdf.doc.lineWidth(2).lineCap('round');
    pdf.doc.moveTo(x + 6, y + 11).lineTo(x + 9, y + 13).stroke(lineStroke);
    pdf.doc.moveTo(x + 9, y + 13).lineTo(x + 14, y + 7).stroke(lineStroke);
}


const renderSkills = (pdf, skillsChecked, skillesNotChecked, x = 0, y = 0, totalWidth = 1000, skillsPerRow = 3) => {
    const skills = skillsChecked.concat(skillesNotChecked);
    const uncheckSkillsIndex = skillsChecked.length;
    const columnWidth = totalWidth / skillsPerRow;
    const lineGap = 15;
    let currentX = x;
    let currentY = y;
    // eslint-disable-next-line array-element-newline
    for (const [index, skill] of skills.entries()) { 
        renderCheck(pdf, index < uncheckSkillsIndex, currentX, currentY);
        pdf.label(skill, currentX + 33, currentY, constants.fontSizeN, constants.colorPurpleGray, false);
        if (index !== 0 && (index % (skillsPerRow - 1)) === 0) {
            currentX = x;
            currentY += constants.fontSizeN + lineGap;
        } else {
            currentX += columnWidth;
        }
    }
    return currentY + constants.fontSizeN + lineGap;
}

module.exports = {
    drawContentBox, 
    renderTitleAndList, 
    renderTags, 
    renderCheck, 
    renderSkills
};
