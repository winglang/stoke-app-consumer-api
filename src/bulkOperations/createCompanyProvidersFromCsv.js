/* eslint-disable camelcase */
/* eslint-disable prefer-named-capture-group */
/* eslint-disable require-unicode-regexp */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */

"use strict";

const { consumerAuthTableName, jobsBucketName } = process.env;
const AWS = require("aws-sdk");
const s3 = new AWS.S3({ signatureVersion: "v4" });
const { jsonLogger, constants, UsersService, responseLib } = require("stoke-app-common-api");
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const { talentsColumns, talentsHeaders, commandOptions } = require("./constansts");
const { validateEmail, confiremColumn, addDataToRows, readFileAndValidate, getAllKeysIncludedCudtomeFields } = require("./utils");
const { createAndGetCompanyProviders, rowsProvidersValidation, getCompanyProviders } = require("./companyProvidersUtils");

const talentsHeadersValidator = {
    [talentsColumns.email]: validateEmail,
    [talentsColumns.providerEmail]: validateEmail,
    [talentsColumns.sendInvite]: confiremColumn,
    [talentsColumns.isHireByStoke]: confiremColumn,
}

const talentsHeadersRequired = (row) => {
    jsonLogger.info({ function: "createCompanyProvidersFromCsv::talentsHeadersRequired", row });
    const requiredFields = {
        [talentsColumns.talentFirstName]: true,
        [talentsColumns.talentLastName]: true
    };
    
    if (row && row[talentsColumns.providerEmail]) {
        requiredFields[talentsColumns.providerEmail] = true;
    } else {
        requiredFields[talentsColumns.email] = true;
    }

    jsonLogger.info({ function: "createCompanyProvidersFromCsv::talentsHeadersRequired", requiredFields });
    return requiredFields;
}

module.exports.handler = async (event, context) => {
    jsonLogger.info({ function: "createCompanyProvidersFromCsv::handler", functionName: context.functionName, awsRequestId: context.awsRequestId, event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body);
    const { companyId, key, command } = data;
    const { role } = await usersService.getCompanyUserAuthRole(userId, companyId, true);
    if (role === constants.user.role.unauthorised) {
        return responseLib.forbidden({ status: false });
    }

    if (!companyId || !key || !command) {
        const message = 'Missing parameters in body';
        jsonLogger.error({ function: "createCompanyProvidersFromCsv::handler", message, companyId, key, command });
        return responseLib.failure({ message });
    }

    const basePath = decodeURIComponent(key.replace(/\+/gu, " "))
    const path = `${companyId}/${companyId}/${basePath}`;
    const errorPath = `${basePath.substring(0, basePath.lastIndexOf('/'))}/errors/${basePath.substring(basePath.lastIndexOf('/'))}`;

    let s3Object = null

    try {
        s3Object = await s3.getObject({ Bucket: jobsBucketName, Key: path }).promise();
    } catch (e) {
        jsonLogger.info({ function: "createCompanyProvidersFromCsv::handler", message: 'Error to get file' });
        return responseLib.failure({ message: e.message });
    }

    const fileData = s3Object.Body.toString("utf-8");
    const { allKeys, customFieldsProvider } = await getAllKeysIncludedCudtomeFields(fileData, talentsHeaders, companyId);
    jsonLogger.info({ function: "createCompanyProvidersFromCsv::handler", allKeys, customFieldsProvider });
    let allProviderData = null;
    const csvRowsError = [];
    
    const resultValidation = readFileAndValidate(fileData, allKeys, talentsHeadersValidator, talentsHeadersRequired, talentsHeaders, csvRowsError)
    
    if (command === commandOptions.validation) {
        jsonLogger.info({ function: "createCompanyProvidersFromCsv::handler", message: 'Done validation', resultValidation });
        return responseLib.send(resultValidation);
    }

    let { rowsError, rowsWithoutError } = resultValidation;

    allProviderData = await getCompanyProviders(companyId, customFieldsProvider);
    rowsWithoutError = addDataToRows(rowsWithoutError, userId, companyId);
    ({ rowsError, rowsWithoutError } = await rowsProvidersValidation(rowsWithoutError, companyId, allProviderData, `${companyId}/${companyId}/${errorPath}`, talentsHeaders, true, customFieldsProvider));

    if (command === commandOptions.dataValidation) {
        jsonLogger.info({ function: "createCompanyProvidersFromCsv::handler", message: 'Done data validation', rowsError, rowsWithoutError });
        return responseLib.send({
            rowsError,
            rowsWithoutError,
            errorPath,
        });
    }

    const result = await createAndGetCompanyProviders(rowsWithoutError, allProviderData, customFieldsProvider);
    jsonLogger.info({ function: "createCompanyProvidersFromCsv::handler", message: 'Done execute', result });
    return result ? responseLib.success({ status: true, result }) : responseLib.failure({ status: false });
};
