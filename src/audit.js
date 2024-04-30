/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-case-declarations */

'use strict';

const _ = require('lodash');
const { UsersService, AuditService, constants, jsonLogger, responseLib, s3LiteLib, csvLib } = require('stoke-app-common-api');
const { queryImdb } = require('./services/imdbService');
const { auditTableName, consumerAuthTableName, jobsBucketName } = process.env;
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const auditService = new AuditService(auditTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const { normalizeWorkflowLogs, dataExportWorkflowLogs, columnMapperWorkflowLogs } = require('./helpers/normalizers/normalizerWorkflowsLogs');
const { normalizePOLogs, dataExportPOAuditLogs, columnMapperPOLogs } = require('./helpers/normalizers/normalizerPOsLogs');
const { columnMapperBidHistoryLogs, normalizeTalentHistoryLogs, dataExportTalentHistoryLogs } = require('./helpers/normalizers/normalizerTalentHistorysLogs');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');

const defaultSortModel = (type) => {
    switch (type) {
        case constants.audit.types.poConfiguration:
            return [{ sort: "desc", colId: "date" }];
        default:
            return [];
    }
};

const freeTextColumnMapper = (type) => {
    switch (type) {
        case constants.audit.types.poConfiguration:
            return ['poNumber', 'change']
        default:
            break;
    }
    return [];
}

const normalizeByType = async (type, rows, companyId, userId) => {
    let normalizedRows = rows
    switch (type) {
        case constants.audit.types.workflows:
            return normalizeWorkflowLogs(rows)
        case constants.audit.types.poConfiguration:
            normalizedRows = await normalizePOLogs(companyId, rows);
            return normalizedRows
        case constants.audit.types.talentHistory:
            normalizedRows = await normalizeTalentHistoryLogs(companyId, rows, userId);
            return normalizedRows
        default:
            break;
    }
    return rows
}

const dataExportByType = (type, rows) => {
    switch (type) {
        case constants.audit.types.workflows:
            return dataExportWorkflowLogs(rows)
        case constants.audit.types.poConfiguration:
            return dataExportPOAuditLogs(rows)
        case constants.audit.types.talentHistory:
            return dataExportTalentHistoryLogs(rows)
        default:
            break;
    }
    return { rows }
}

const columnMapperByType = (type, rows) => {
    switch (type) {
        case constants.audit.types.workflows:
            return columnMapperWorkflowLogs(rows)
        case constants.audit.types.poConfiguration:
            return columnMapperPOLogs(rows)
        case constants.audit.types.talentHistory:
            return columnMapperBidHistoryLogs(rows)
        default:
            break;
    }
    return { rows }
}

const getQueryParams = (paginationParams, type) => ({
    ...paginationParams,
    sortModel: _.isEmpty(paginationParams.sortModel) ? defaultSortModel(type) : paginationParams.sortModel,
    freeTextColumnMapper: _.isEmpty(paginationParams.freeTextColumnMapper) ? freeTextColumnMapper(type) : paginationParams.freeTextColumnMapper,
})

/**
 * handler - get audit by type
 * @param {Object} event - event
 * @param {Object} context - context
 * @returns {object} results
 */
const handler = async (event, context) => {
    jsonLogger.info({ function: "audit::handler", event, context });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { paginationParams } = JSON.parse(event.body || '{}');
    const { companyId, type } = event.queryStringParameters || {};
    if (!companyId || !type || !Object.values(constants.audit.types).includes(type)) {
        return responseLib.failure({ status: false, message: "missing required params" });
    }

    const role = await usersService.getUserAuthRoleWithComponents(userId, companyId, { [permissionsComponentsKeys.workflows]: {}, [permissionsComponentsKeys.po]: {} });
    if (role === constants.user.role.unauthorised) {
        return responseLib.forbidden({ status: false });
    }

    let result = await auditService.list(companyId, type);
    jsonLogger.info({ function: "audit::handler", companyId, type });
    if (!result) {
        jsonLogger.info({ function: "audit::handler", message: 'Error to get audit rows' });
    }
    if (paginationParams) {
        const columnMapper = columnMapperByType(type);
        const normalizeResult = await normalizeByType(type, result, companyId, userId)
        const queryParams = getQueryParams(paginationParams, type);
        result = queryImdb([normalizeResult], queryParams, columnMapper);

        if (paginationParams.exportToCsv) {
            const { rows } = result;
            const exportData = dataExportByType(type, rows)
            const jobsCsv = csvLib.arraysToCsvString(exportData.headers, exportData.rows)
            const key = `tmp/audit/${new Date().toISOString()}.csv`;
            const url = await s3LiteLib.putObjectAndSign(jobsBucketName, key, jobsCsv);
            jsonLogger.info({ type: "TRACKING", function: "createCsvReport::buildCsvToDownload", url });
            return responseLib.send({ url, });
        }
    }
    return responseLib.send(result);
}

module.exports = {
    handler
};
