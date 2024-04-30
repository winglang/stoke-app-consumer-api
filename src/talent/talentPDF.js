/* eslint-disable no-magic-numbers */
/* eslint-disable max-params */
/* eslint-disable no-return-await */
/* eslint-disable no-extra-parens */
/* eslint-disable no-undefined */
/* eslint-disable multiline-comment-style */
/* eslint-disable newline-per-chained-call */
/* eslint-disable capitalized-comments */

'use strict'

const AWS = require('aws-sdk');
const s3 = new AWS.S3({});

const { PDFDOC } = require('../helpers/pdfHelper')
const _ = require('lodash');
const path = require('path');

const { drawContentBox, renderTitleAndList, renderTags, renderSkills } = require('./talentPDFElements.js')

const width = 1920;
const height = 1254;
const assetsPath = path.join(__dirname, '..', '..', 'assets');

const constants = require('./pdfConsts');

const generateAvailability = async (pdf, talentData, x, y, contentWidth) => {
    const availability = _.get(talentData, 'itemData.availability');
    const availabilityText = typeof availability === 'number' ? `Available in ${availability} days` : availability;
    const data = [{ name: availabilityText }];
    return await renderTitleAndList(pdf, data, 'Availability', x, y, { width: contentWidth })
}

const generateQuoteForProject = (pdf, talentData, x, y, contentWidth) => {
    const currencySign = _.get(talentData, 'itemData.candidate.currency.sign', '');
    const amount = _.get(talentData, 'itemData.amount', 0);
    
    const rectHeight = 34;
    pdf.doc.roundedRect(x, y, contentWidth, rectHeight, 17).fillAndStroke(constants.colorGray50, constants.colorGray50)
    
    const labelPaddingY = (rectHeight - constants.fontSizeS) / 2;
    return labelPaddingY + pdf.label(`Quote for your project: ${currencySign}${amount}`, x, y + labelPaddingY, constants.fontSizeS, constants.colorPurpleLight, true, { width: contentWidth, align: 'center' });
}

const generateStandartRate = async (pdf, talentData, x, y, contentWidth) => {
    const currencySign = _.get(talentData, 'itemData.candidate.currency.sign');
    const rate = _.get(talentData, 'itemData.candidate.hourly_rate.max', 0);
    const data = [{ name: `${currencySign}${rate}` }];
    return await renderTitleAndList(pdf, data, 'Standard rate', x, y, { width: contentWidth })
}


const generateProfile = async (pdf, talentData, x = 0, y = 0, contentWidth = 100) => {
    const imageSize = 96;
    const textOptions = { width: contentWidth, align: 'center' };
    let nextY = y + imageSize + 10;
    nextY = 2 + pdf.label(_.get(talentData, 'itemData.candidate.name'), x, nextY, constants.fontSizeN, undefined, true, textOptions);
    nextY = 7 + pdf.label(_.get(talentData, 'itemData.candidate.title'), x, nextY, constants.fontSizeN, undefined, false, textOptions);      
    nextY = pdf.label(_.get(talentData, 'itemData.candidate.country'), x, nextY, constants.fontSizeN, undefined, false, textOptions);

    const imgX = x + ((contentWidth - imageSize) / 2);
    pdf.doc.save().roundedRect(imgX, y, imageSize, imageSize, 39).clip();
    await pdf.image(_.get(talentData, 'itemData.candidate.img'), imgX, y, imageSize, imageSize).catch();
    pdf.doc.restore();

    return nextY;
}

const generateContactDetails = async (pdf, talentData, x = 0, y = 0, contentWidth = 100) => {
    const email = _.get(talentData, 'itemData.candidate.email');
    if (email) {
        const textOptions = { width: contentWidth };
        return await renderTitleAndList(pdf, [{ name: email, icon: path.join(assetsPath, 'contact_icon@1x.png') }], 'Contact details', x, y, textOptions)
    }
    return y;

}

const generatePortfolios = async (pdf, talentData, x = 0, y = 0) => {
    let portfolios = _.get(talentData, 'itemData.candidate.portfolios', []);
    if (typeof portfolios === 'object' && !Array.isArray(portfolios)) {
        portfolios = [portfolios];
    }
    const portfoliosList = [];
    for (const item of portfolios) {
        let icon = path.join(assetsPath, 'website.png')
        const url = _.get(item, "url", '')
        if (url.includes('linkedin.com')) {
            icon = path.join(assetsPath, 'linkedin.png');
        } else if (url.includes('medium.com')) {
            icon = path.join(assetsPath, 'medium_logo.png');
        } else if (url.includes('instagram.com')) {
            icon = path.join(assetsPath, 'insta.png');
        }
        portfoliosList.push({ name: _.get(item, 'title', ''), icon: icon, link: url })
    }    
    return await renderTitleAndList(pdf, portfoliosList, 'Portfolios', x, y)
}

const generateLanguages = async (pdf, talentData, x = 0, y = 0, contentWidth = 100) => await renderTitleAndList(pdf, _.get(talentData, 'itemData.candidate.languages', []), 'Languages', x, y, { width: contentWidth })

// eslint-disable-next-line require-await
const generateHeader = async (pdf) => {
    pdf.doc.rect(0, 0, 1720, 200).fill(constants.colorPurple)
    pdf.doc.circle(1720, 0, 200).fill(constants.colorPurple)
    pdf.image(path.join(assetsPath, 'logo-light.png'), 22, 22)
    pdf.label('| Talent profile', 142, 26, constants.fontSizeXL, constants.colorPurpleLight)
}

const generateProfileBox = async (pdf, talentData) => {
    const sectionPadding = 48;
    const x = 112;
    const y = 88;
    const boxWidth = 437;
    const padding = 42;
    const contentY = padding + y;
    const contentX = x + padding;
    const contentWidth = boxWidth - (padding * 2);
    const contentWidthHalf = contentWidth / 2;

    drawContentBox(pdf, x, y, boxWidth, 1124);
    await pdf.image(path.join(assetsPath, 'profile_bg.png'), x, y);

    let top = 23 + await generateProfile(pdf, talentData, contentX, contentY, contentWidth);
    let nextTop = await generatePortfolios(pdf, talentData, contentX, top, contentWidth)
    top = sectionPadding + (nextTop ? nextTop : top)
    nextTop = await generateLanguages(pdf, talentData, contentX, top, contentWidth);
    top = sectionPadding + (nextTop ? nextTop : top)
    nextTop = await generateContactDetails(pdf, talentData, contentX, top, contentWidth);
    top = sectionPadding + (nextTop ? nextTop : top)

    const top1 = await generateStandartRate(pdf, talentData, contentX, top, contentWidthHalf - 7);
    const top2 = await generateAvailability(pdf, talentData, contentX + contentWidthHalf + 2, top, contentWidthHalf - 7);
    const maxTop = Math.max(top1, top2);
    const lineX = contentX + contentWidthHalf - 14;
    pdf.doc.lineWidth(1).lineCap('round').moveTo(lineX, top).lineTo(lineX, maxTop).stroke(constants.colorGray10);
    top = sectionPadding + maxTop;
    
    generateQuoteForProject(pdf, talentData, contentX, 1125, contentWidth);
}

const renderBoxTitle = (pdf, title, x = 0, y = 0, contentWidth = 300) => {
    const nextY = pdf.label(title, x, y, constants.fontSizeXL, undefined, false, { width: contentWidth });
    return nextY + 13;
}

const generateAboutBox = (pdf, talentData, x = 0, y = 0, boxWidth = 1000, padding = 44) => {
    const contentWidth = boxWidth - (padding * 2);
    const nextY = renderBoxTitle(pdf, 'About', x, y, contentWidth);
    const contentX = x + padding;
    const contentY = padding + nextY;

    const about = _.get(talentData, 'itemData.candidate.description');
    const contentHeight = pdf.stringHeight(about, constants.fontSizeN) + (padding * 2);

    drawContentBox(pdf, x, nextY, boxWidth, contentHeight);
    pdf.label(about, contentX, contentY, constants.fontSizeN, undefined, false, { width: contentWidth });
    return nextY + contentHeight;
}

// eslint-disable-next-line max-lines-per-function
const generateSkillsBox = (pdf, talentData, jobData, x = 0, y = 0, boxWidth = 1000, padding = 44) => {

    /*
        Each candidate comes with two arrays 
        1. top_skills
        2. job_skills
        3. all_skills

        compared_skills = job_skills intersact_with (all_skills + top_skills)
        other_skills = (all_skills + top_skills) - job_skills 
    */
    const topSkills = _.map(_.get(talentData, 'itemData.candidate.top_skills', []), (item) => (item.name))
    const jobSkills = _.map(_.get(jobData, 'itemData.requiredSkills'), (item) => (item.title))
    const allSkills = _.map(_.get(talentData, 'itemData.candidate.skills', []), (item) => (item.name))
    
    const allAndTopSkills = _.union(topSkills, allSkills);
    const talentJobSkill = _.partition(jobSkills, (skill) => (allAndTopSkills.includes(skill)))
    const [
        jobSkillInTalent,
        jobSkillNotInTalent
    ] = talentJobSkill;
    const otherSkills = _.filter(allAndTopSkills, (skill) => (!jobSkills.includes(skill)))

    const contentWidth = boxWidth - (padding * 2);
    let nextY = renderBoxTitle(pdf, 'Skills', x, y, contentWidth);

    const contentX = x + padding;
    const contentY = padding + nextY;
    const lineGap = 25;

    const nextBoxY = drawContentBox(pdf, x, nextY, boxWidth, 1214 - nextY);
    nextY = pdf.label(`HOW ${_.get(talentData, 'itemData.candidate.name', '')} MATCHES YOUR JOB POST PREFERENCES`, contentX, contentY, constants.fontSizeS, constants.colorPurpleGray, true, { width: contentWidth });
    nextY += 6;

    const title1 = `${jobSkillInTalent.length} out of the ${jobSkillNotInTalent.length}`;
    const title1Width = pdf.stringWidth(title1, constants.fontSizeS, undefined, true);
    pdf.label(title1, contentX, nextY, constants.fontSizeS, constants.colorGray90, true);
    nextY = pdf.label('preferred skills', (contentX + title1Width + 10), nextY, constants.fontSizeS, constants.colorGray90, false);
    nextY += lineGap;
    nextY = renderSkills(pdf, jobSkillInTalent, jobSkillNotInTalent, contentX, nextY, contentWidth, 3);
    nextY += lineGap;
    pdf.doc.lineWidth(1).lineCap('round').moveTo(contentX, nextY).lineTo(contentX + contentWidth, nextY).stroke(constants.colorGray10);
    nextY += lineGap;
    nextY = pdf.label('Other skills', contentX, nextY, constants.fontSizeXL, constants.colorGray90, false);
    nextY += lineGap;
    nextY = renderSkills(pdf, otherSkills, [], contentX, nextY, contentWidth, 3);
    return nextBoxY;
}

// eslint-disable-next-line require-await
const generateMostlyHiredBox = async (pdf, talentData, x = 0, y = 0, boxWidth = 1000, padding = 44) => {
    const contentWidth = boxWidth - (padding * 2);
    const contentX = x + padding;
    const contentY = padding + y;

    drawContentBox(pdf, x, y, boxWidth, 149);
    await pdf.image(path.join(assetsPath, 'start-icon.png'), contentX, contentY - 15)

    const textX = contentX + 58;
    let nextY = pdf.label('MOSTLY HIRED FOR', textX, contentY, constants.fontSizeS, constants.colorPurpleGray, true, { width: contentWidth });
    nextY += 18;
    renderTags(pdf, _.get(talentData, 'itemData.candidate.top_skills', []), "name", textX, nextY);
    
    return y + 149;
}

const generateTalentPDF = async (talentData, jobData) => {
    const pdf = new PDFDOC({ 
        size: [
            width, 
            height
        ],
        margins: { 
            top: 0, bottom: 0, left: 0, right: 0 
        }, 
        bufferPages: true 
    });
    // eslint-disable-next-line no-unused-vars
    
    await generateHeader(pdf);
    await generateProfileBox(pdf, talentData);

    let top = 88;
    const left = 591;
    const rightBoxwidth = 1217;
    const rightBoxPadding = 44;
    const boxPaddingBottom = 42;
    top = boxPaddingBottom + await generateMostlyHiredBox(pdf, talentData, left, top, rightBoxwidth, rightBoxPadding)
    top = boxPaddingBottom + generateAboutBox(pdf, talentData, left, top, rightBoxwidth, rightBoxPadding);
    generateSkillsBox(pdf, talentData, jobData, left, top, rightBoxwidth, rightBoxPadding);
    
    pdf.doc.end();
    const fileName = encodeURIComponent(_.get(talentData, 'itemData.candidate.name', 'talent'));
    const params = {
        Key: `Output/profiles/${fileName}.pdf`,
        Body: pdf.doc,
        Bucket: process.env.jobsBucketName,
        ContentType: 'application/pdf'
    }
    await s3.upload(params).promise();    
    const url = await s3.getSignedUrl("getObject", _.omit(params, 'Body', 'ContentType'));
    return url;
}

module.exports = { generateTalentPDF }
