/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */

'use strict';

const { UsersService, BillingService, constants, jsonLogger, responseLib, permisionConstants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const { s3lib } = require('stoke-s3lib');
const INVOICES_ZIP_SIGNED_URL_EXPIRATION_TIME = process.env.INVOICES_ZIP_SIGNED_URL_EXPIRATION_TIME ? parseInt(process.env.INVOICES_ZIP_SIGNED_URL_EXPIRATION_TIME, 10) : 86400;
const billingService = new BillingService(process.env.jobsBucketName, process.env.billingFolderName, process.env.invoicesFolderName)

/**
 * get stoke invoices handler
 * @param {Object} event - input params including companyId and billing id
 * @param {Object} context  - lambda context.
 * @returns {Object} returns responseLib success/failure.
 */
module.exports.handler = async (event, context) => {
    jsonLogger.info({ type: 'TRACKING', function: 'stokeInvoices::handler', functionName: context.functionName, awsRequestId: context.awsRequestId, event: event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId, billingId } = event.queryStringParameters;
    if (!companyId || !billingId) {
        jsonLogger.error({
            type: "TRACKING", function: "stokeInvoices::handler", message: "missing required data", companyId, billingId
        });
        return responseLib.failure({ status: false });
    }
    const authorised = await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.jobs]: {} });
    if (!authorised) {
        return responseLib.forbidden({ status: false });
    }

    const zipKey = `${companyId}/${companyId}/${userId}/${`stokeInvoices_${new Date().getTime()}.zip`}`;
    let invoicesKeys = null;
    let url = null;
    try {

        invoicesKeys = await billingService.getPDFInvoicesKeys(companyId, billingId);
        await s3lib.zipObjects(process.env.jobsBucketName, invoicesKeys, zipKey);
        url = await s3lib.getS3().getSignedUrl("getObject", {
            Bucket: process.env.jobsBucketName,
            Key: zipKey,
            Expires: INVOICES_ZIP_SIGNED_URL_EXPIRATION_TIME
        });
    } catch (error) {
        jsonLogger.error({
            type: "TRACKING", function: "stokeInvoices::handler", message: "error get stoke invoices", error: error.message, companyId, billingId, zipKey, invoicesKeys
        });
    }


    return url ? responseLib.success({ url }) : responseLib.failure({ status: false });
}

