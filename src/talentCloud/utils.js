'use strict';

const { consumerAuthTableName, jobsBucketName } = process.env;
const commonApi = require('stoke-app-common-api');
const { UsersService, jsonLogger } = commonApi;
const AWS = require("aws-sdk");
const s3 = new AWS.S3({ signatureVersion: "v4" });
const { constants } = commonApi;
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const { TALENT_CLOUD_CANDIDATES_FILE } = require('./constants')

/**
 * checking for the user's permissions
 * @param {string} userId - current user id
 * @param {string} companyId - the company Id of the user
 * @param {boolean} isAdmin - allow only admins
 * @returns {boolean} indicating if user allow to perform the action
 */
const isAuthorizedUser = async (userId, companyId, isAdmin) => {
    jsonLogger.info({ type: 'TRACKING', function: 'talentCloud::utils::handler', message: 'getCompanyUserAuthRole', userId, companyId });
    const { role } = await usersService.getCompanyUserAuthRole(userId, companyId, true);
    jsonLogger.info({ type: 'TRACKING', function: 'talentCloud::utils::handler', role });
    
    if (role === constants.user.role.unauthorised) {
        jsonLogger.error({ type: 'TRACKING', function: 'talentCloud::utils::handler', messgage: 'unauthorized role', role });
        return { isAuthorized: false, role }
    }

    if (isAdmin && role !== constants.user.role.admin) {
        jsonLogger.error({ type: 'TRACKING', function: 'talentCloud::utils::handler', messgage: 'unauthorized role', role });
        return { isAuthorized: false, role }
    }

    return { isAuthorized: true, role }
}

/**
 * handler reading from s3
 * @param {Object} fileInfo - folder and file names. should be { folder: x, name: y }
 * @returns {string} string represting the data from the file
 */
const s3FileAsObject = async (fileInfo) => {
    jsonLogger.info({ function: "talentCloud::utils::s3FileAsObject", fileInfo });
    // const basePath = decodeURIComponent(fileInfo.folder.replace(/\+/gu, " "))
    const basePath = fileInfo.folder
    const path = `${basePath}${fileInfo.name}`

    let s3Object = null
    let fileData = {}

    try {
        jsonLogger.info({ function: "talentCloud::utils::s3FileAsObject", message: 'trying to fetch file', path, jobsBucketName });
        s3Object = await s3.getObject({ Bucket: jobsBucketName, Key: path }).promise();
        fileData = s3Object.Body.toString('utf-8')
    } catch (error) {
        jsonLogger.error({ function: "talentCloud::utils::s3FileAsObject", message: 'Error getting s3 file', error });
        return fileData
    }

    return JSON.parse(fileData)
}

const getExternalCandidateDetails = async (candidateId) => {
    jsonLogger.info({ type: "TRACKING", function: "talentCloud::utils::::getExternalCandidateDetails", candidateId });
    const candidatesAsJson = await s3FileAsObject(TALENT_CLOUD_CANDIDATES_FILE)
    
    const externalTalentDetails = candidatesAsJson.find((candidate) => candidate.id && candidate.id.toString() === candidateId)
    if (!externalTalentDetails) {
        return {}
    }
        
    return { 
        talentUserId: candidateId, 
        talentFullName: externalTalentDetails.name, 
        talentEmail: externalTalentDetails.email
    }
}

module.exports = {
    getExternalCandidateDetails,
    isAuthorizedUser,
    s3FileAsObject,
};
