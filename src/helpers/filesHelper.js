/* eslint-disable newline-per-chained-call */
/* eslint-disable max-params */
/* eslint-disable no-magic-numbers */

'use strict'

const _ = require("lodash");
const { jsonLogger } = require('stoke-app-common-api');

const AWS = require('aws-sdk');
const s3 = new AWS.S3({});

const copyFile = async (params) => {
    try {
        const result = await s3.copyObject(params).promise();
        jsonLogger.info({ type: 'TRACKING', function: 'filesHelper::copyFile', params, result });
    } catch (error) {
        jsonLogger.error({ type: 'TRACKING', function: 'filesHelper::copyFile', message: 'Error copying file', params, error: error.message });
        return false;
    }
    return true;
}

const copyJobFiles = async (sourcesFiles, oldBasicPath, newBasicPath, newJobId, sourceFilesKeys = []) => {
    jsonLogger.info({ type: "TRACKING", function: "filesHelper::copyJobFiles", sourcesFiles, oldBasicPath, newBasicPath, newJobId, sourceFilesKeys });
    const result = await Promise.all(sourcesFiles.map(async (file, index) => {
        const keyFromSourceFiles = sourceFilesKeys[index];
        const keyWitoutOldJobId = keyFromSourceFiles
            ? `fileUploads/${keyFromSourceFiles}`
            : `${file.key}`.split('/').slice(1).join('/');
        const newKey = `${newJobId}/${keyWitoutOldJobId}`
        const params = {
            Bucket: process.env.jobsBucketName,
            Key: `${newBasicPath}/${newKey}`,
            CopySource: encodeURI(`${process.env.jobsBucketName}/${oldBasicPath}/${keyFromSourceFiles ? keyFromSourceFiles : file.key}`)
        };
        const copySucceeded = await copyFile(params);
        if (copySucceeded) {
            return {
                name: file.name,
                key: newKey
            }
        }
        return null;
    }))
    const filteredResult = result.filter(Boolean);
    return filteredResult;
};

const moveJobFiles = async (
    jobFiles,
    companyId,
    targetEntityId,
    targetUserId,
    srcEntityId,
    srcUserId,
    newItemId,
    oldPath,
) => {
    const newBasicPath = `${companyId}/${targetEntityId}/${targetUserId}`;
    const oldBasicPath = oldPath || `${companyId}/${srcEntityId}/${srcUserId}`;
    const sourceFilesKeys = jobFiles.map((file) => `${file.key}`.split('/').slice(2).join('/'));
    const newFilesArray = await copyJobFiles(jobFiles, oldBasicPath, newBasicPath, newItemId, sourceFilesKeys);

    if (!newFilesArray || _.size(jobFiles) !== _.size(newFilesArray)) {
        jsonLogger.error({ type: 'TRACKING', function: 'filesHelper::moveJobFiles', message: 'failed to copy job files, returning empty array', jobFiles, newFilesArray });
        return [];
    }
    return newFilesArray;
}

module.exports = {
    moveJobFiles,
    copyJobFiles,
};
