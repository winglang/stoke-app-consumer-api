'use strict';


/* eslint-disable no-magic-numbers */
/* eslint-disable prefer-destructuring */

const { UsersService, dynamoDbUtils, BillingService, constants, jsonLogger, responseLib, permisionConstants } = require('stoke-app-common-api');
const { s3lib } = require('stoke-s3lib');
const { innerGetRecordsByPeriod } = require('./ledger');
const _ = require('lodash');
const { jobListType } = require('./job/queryAttrs');
const { createCsv } = require('./helpers/csvReport/createCsv');
const INVOICES_ZIP_SIGNED_URL_EXPIRATION_TIME = process.env.INVOICES_ZIP_SIGNED_URL_EXPIRATION_TIME ? parseInt(process.env.INVOICES_ZIP_SIGNED_URL_EXPIRATION_TIME, 10) : 86400;
const { consumerAuthTableName, jobsTableName, jobsBucketName } = process.env;
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const billingService = new BillingService(process.env.jobsBucketName, process.env.billingFolderName, process.env.invoicesFolderName)

const DOWNLOAD_TYPES = {
    invoice: 'invoice',
    file: 'file',
    proForma: 'proForma'
}

const extractFileKeysFromMilestones = (milestones, companyId, type) => {
    jsonLogger.info({ type: "TRACKING", function: "invoices::extractFileKeysFromMilestones", milestones, companyId, mode: type });
    const milestonesWithNeededFiles = milestones.map((mlstn) => {
        const files = _.get(mlstn, 'itemData.files', []);
        if (type && Object.values(DOWNLOAD_TYPES).includes(type)) {
            const invoice = _.filter(files, (file) => file.isInvoice);
            const proForma = _.some(files, (file) => file.isProForma)
                ? _.filter(files, (file) => file.isProForma)
                : _.filter(files, (file) => file.autoTalentInvoice);
            const regularFiles = _.filter(files, (file) => !file.isProForma && !file.autoTalentInvoice && !file.isInvoice);
            if (type === DOWNLOAD_TYPES.invoice) {
                mlstn.itemData.files = invoice;
            } else if (type === DOWNLOAD_TYPES.proForma) {
                mlstn.itemData.files = proForma;
            } else {
                mlstn.itemData.files = regularFiles;
            }
        } else if (type) {
            jsonLogger.error({ type: "TRACKING", function: "invoices::extractFileKeysFromMilestones", message: "cannot extract files of not supported type", fileType: type });
            return null;
        }
        return mlstn.itemData.files && mlstn.itemData.files.length ? mlstn : null
    }).
        filter(Boolean);
    milestonesWithNeededFiles.forEach((mlstn) => {
        mlstn.itemData.filesKeys = mlstn.itemData.files.map((file) => `${companyId}/${mlstn.entityId}/${mlstn.userId}/${file.key}`);
        mlstn.itemData.filesNames = mlstn.itemData.files.map((file) => s3lib.extractNameFromKey(file.key));
    });
    return milestonesWithNeededFiles;
};

const extractMilestonesFromLedgerRecords = async (ledgerRecords) => {
    const milestonesKeys = _.uniqBy(ledgerRecords.map((rec) => ({ entityId: rec.entityId, itemId: rec.itemData.milestoneId })), "itemId");
    const milestones = await dynamoDbUtils.batchGetParallel(jobsTableName, milestonesKeys);
    return milestones;
}

const generateZipKey = (companyId, zipLocation, userId) => `${companyId}/${zipLocation}/${userId}/${`invoices_${new Date().getTime()}.zip`}`;

// eslint-disable-next-line max-params
const getRecordsForMilestoneIds = async (milestoneIds, userId, companyId, from, to, role, entitiesAdmin, entitiesUser) => {
    let ledgerRecords = await innerGetRecordsByPeriod(userId, { companyId, from, to }, role, entitiesAdmin, entitiesUser);
    if (!ledgerRecords) {
        jsonLogger.error({ type: "TRACKING", function: "invoices::getInvoices", message: "failed to get ledger records" });
    }
    ledgerRecords = (ledgerRecords || []).filter((rec) => rec.entityId && rec.itemData &&
        rec.itemData.milestoneId && rec.itemData.newStatus === constants.budgets.categories.approved);
    if (milestoneIds && milestoneIds.length) {
        ledgerRecords = ledgerRecords.filter((rec) => milestoneIds.includes(rec.itemData.milestoneId));
    }
    return ledgerRecords;
}

/**
 * getInvoices - get archive of invoice files
 * @param {Object} event - event
 * @param {Object} context - context
 * @returns {object} results
 */
// eslint-disable-next-line max-lines-per-function
const getInvoices = async (event, context) => {

    const userId = event.requestContext.identity.cognitoIdentityId;
    const { from, to, companyId, type, billingId } = event.queryStringParameters || {};
    const { milestoneId: milestoneIds } = event.multiValueQueryStringParameters || {};
    let { milestoneKeys } = JSON.parse(event.body || '{}');
    const { filters, isPagination } = JSON.parse(event.body || '{}');

    jsonLogger.info({ function: "invoices::getInvoices", companyId, from, to, milestoneIds, userId, billingId, isPagination, filters, event, context });
    if (!companyId) {
        return responseLib.failure({ status: false, message: "missing required params" });
    }

    if (billingId) {
        const billing = await billingService.readBilling(companyId, billingId);
        if (!billing) {
            jsonLogger.error({ type: "TRACKING", function: "invoices::getInvoices", message: "no billing found", companyId, from, to, milestoneIds, userId, billingId });
            return responseLib.success('no invoices');
        }

        milestoneKeys = _.get(billing, 'body', []).map((item) => ({ itemId: item.milestoneId, entityId: item.entityId }));
    }

    if (isPagination) {
        const data = { companyId, type: jobListType.paymentsPageInvoicesData, filterKey: null, tableRequestedFields: [], filters };
        const filteredMilestones = await createCsv(userId, data, false, true, {});
        milestoneKeys = _.map(_.get(filteredMilestones, 'rows', []), ms => ({ entityId: ms.entityId, itemId: ms.itemId }))
    }

    const hasTimeframe = from && to;
    const hasMiletoneKeys = milestoneKeys && milestoneKeys.length;
    if (!hasTimeframe && !hasMiletoneKeys) {
        return responseLib.failure({ status: false, message: "missing required params" })
    }

    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.jobs]: {} });
    if (role === constants.user.role.unauthorised) {
        return responseLib.forbidden({ status: false });
    }

    let milestones = null;
    if (hasMiletoneKeys) {
        milestones = await dynamoDbUtils.batchGetParallel(jobsTableName, milestoneKeys)
    } else {
        const ledgerRecords = await getRecordsForMilestoneIds(milestoneIds, userId, companyId, from, to, role, entitiesAdmin, entitiesUser);
        milestones = await extractMilestonesFromLedgerRecords(ledgerRecords);
    }
    const authEntities = entitiesAdmin.map((ent) => ent.entityId);
    milestones = milestones.filter((mlstn) => authEntities.includes(mlstn.entityId) || userId === mlstn.userId);
    jsonLogger.info({ type: "TRACKING", function: "invoices::getInvoices", milestones });
    const milestonesWithInvoicesKeys = extractFileKeysFromMilestones(milestones, companyId, type);
    jsonLogger.info({ type: "TRACKING", function: "invoices::getInvoices", milestonesWithInvoicesKeys });
    if (!milestonesWithInvoicesKeys || !milestonesWithInvoicesKeys.length) {
        jsonLogger.error({ type: "TRACKING", function: "invoices::getInvoices", message: "no invoices found", milestones, milestonesWithInvoicesKeys });
        return responseLib.success('no invoices');
    }
    const invoicesZipKey = generateZipKey(companyId, companyId, userId);
    const invoicesS3ObjectKeys = _.flatten(milestonesWithInvoicesKeys.map((mlstn) => mlstn.itemData.filesKeys));
    const result = {
        filenames: milestonesWithInvoicesKeys.reduce((filenames, mlstn) => ({
            ...filenames, [mlstn.itemId]: mlstn.itemData.filesNames
        }), {})
    };
    await s3lib.zipObjects(jobsBucketName, invoicesS3ObjectKeys, invoicesZipKey);
    result.url = await s3lib.getS3().getSignedUrl("getObject", {
        Bucket: jobsBucketName,
        Key: invoicesZipKey,
        Expires: INVOICES_ZIP_SIGNED_URL_EXPIRATION_TIME
    });
    return result.url ? responseLib.success(result) : responseLib.failure({ status: false });
}

module.exports = {
    getInvoices
};
