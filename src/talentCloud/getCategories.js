'use strict';

const commonApi = require('stoke-app-common-api');
const { jsonLogger, responseLib } = commonApi;
const { isAuthorizedUser, s3FileAsObject } = require('./utils')
const { TALENT_CLOUD_CATEGORIES_FILE } = require('./constants');
const { isTalentLakeEnabledForCompany } = require('./getCandidates');
const { getPreviewAndFiltersData } = require('./searchTalents');


const getCategoriesFromS3 = (categoriesFileData) => s3FileAsObject(categoriesFileData || TALENT_CLOUD_CATEGORIES_FILE);

/**
 * handler endpoint returns talentCloudGetCategories
 * @param {Object} event - event data
 * @param {Object} context - context data
 * @returns {Object} talentCloudGetCategories used
 */
const handler = async (event) => {
    jsonLogger.info({ type: 'TRACKING', function: 'talentCloudGetCategories::handler', event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { queryStringParameters, categoriesFileData } = event;
    const { companyId } = queryStringParameters || {};

    const { isAuthorized } = await isAuthorizedUser(userId, companyId);
    if (!isAuthorized) {
        jsonLogger.error({ type: 'TRACKING', function: 'talentCloudGetCategories::handler', messgage: 'unauthorized role', userId, companyId });
        return responseLib.forbidden({ status: false });
    }

    if (await isTalentLakeEnabledForCompany(companyId)) {
        const previewData = await getPreviewAndFiltersData();
        if (previewData) {
            return responseLib.success(previewData);
        }
        return responseLib.failure({ status: false });
    }

    const fileData = await getCategoriesFromS3(categoriesFileData);
    if (!fileData) {
        jsonLogger.info({ type: 'TRACKING', function: 'talentCloudGetCategories::handler', messgage: 'failed fetching data from file' });
        return responseLib.failure({ status: false });
    }

    jsonLogger.info({ type: 'TRACKING', function: 'talentCloudGetCategories::handler', messgage: 'succeeded fetching file. returning data' });
    
    return responseLib.send(fileData);
}

module.exports = {
    handler,
    getCategoriesFromS3
};
