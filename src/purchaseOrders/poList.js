/* eslint-disable no-magic-numbers */

'use strict';

const _ = require('lodash');
const {
    consumerAuthTableName,
    budgetsTableName,
    jobsBucketName,
    customersTableName,
    gsiItemsByCompanyIdAndItemIdIndexNameV2,
} = process.env;

const { UsersService, POService, BalanceService, constants, jsonLogger, responseLib, s3LiteLib, csvLib, poHelper, idConverterLib } = require('stoke-app-common-api');
const { normalizePOsForTable, posExportData, filterResponse, isDebtPO, normalizePOsBreakdownMsForTable, normalizePOsBreakdownBillingForTable, poUsageExportData } = require('./normalizer');
const { getBillingFilterOptions } = require('../helpers/billingHelper');
const { getCompanyWorkspacesNamesByKeyValue } = require('../helpers/purchaseOrderHelper');
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const poService = new POService(budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);
const balanceService = new BalanceService(customersTableName, null, constants.attributeNames.defaultAttributes);

const getDebtInfo = (debt, poUsage) => {
    if (!debt || debt.available >= 0) {
        return {};
    }
    const debtInContextOfRequest = _.get(poUsage, `${constants.prefix.po}DEBT`, 0);
    return {
        isWithDebt: debtInContextOfRequest > 0,
        debtAmount: debtInContextOfRequest,
    };
}

const getOnlyUsedPOs = (allPOs, debtPO, posUsageSummary) => {
    const [blanketPOs, nonBlanketItems] = _.partition(allPOs, po => _.get(po, 'itemData.isBlanketPO'))
    const usedItems = _.filter(nonBlanketItems, po => {
        const usage = _.get(posUsageSummary, [po.itemId]);
        // eslint-disable-next-line no-magic-numbers
        return usage > 0;
    })
    const usedGrouppedByMainPO = _.groupBy(usedItems, po => idConverterLib.getMainPOIdFromPOItemId(_.get(po, 'itemId')));
    const usedBlankets = _.filter(blanketPOs, po => !_.isEmpty(_.get(usedGrouppedByMainPO, [po.itemId])));
    let usedPOs = [...usedBlankets, ...usedItems];
    if (debtPO && _.get(posUsageSummary, [debtPO.itemId]) > 0) {
        usedPOs = [...usedPOs, debtPO];
    }
    return usedPOs;
}

const getPoUsageBreakdown = async (companyId, poItemId, poListById, activeFilters) => {
    const poUsage = await poHelper.poUsage(companyId, poItemId, activeFilters);
    const workspaceNamesById = await getCompanyWorkspacesNamesByKeyValue(companyId);
    const normalizedMilestones = await normalizePOsBreakdownMsForTable(companyId, poUsage.jobsByPOId, poListById, workspaceNamesById);
    const normalizedBilling = normalizePOsBreakdownBillingForTable(poUsage.billingByPO, poListById);
    const poUsageBreakdown = [...normalizedMilestones, ...normalizedBilling]
    const talentFilter = _.get(activeFilters, 'talentId', [])
    return _.size(talentFilter) ? _.filter(poUsageBreakdown, item => talentFilter.includes(item.talentId)) : poUsageBreakdown;
}

const getUrlExport = async (exportData) => {
    const posCsv = csvLib.arraysToCsvString(exportData.headers, exportData.rows)
    const key = `tmp/pos/${new Date().toISOString()}.csv`;
    const url = await s3LiteLib.putObjectAndSign(jobsBucketName, key, posCsv);
    jsonLogger.info({ type: "TRACKING", function: "getUrlExport::handler", key, url });

    return url
}

// eslint-disable-next-line max-lines-per-function
module.exports.handler = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId } = event.pathParameters;
    const { exportToCsv, exportColumns, billingId, activeFilters, poItemId } = JSON.parse(event.body || '{}');

    jsonLogger.info({ type: 'TRACKING', function: 'getPOs::handler', functionName: context.functionName, awsRequestId: context.awsRequestId, userId, companyId, event });
    if (!companyId) {
        return responseLib.failure({ message: 'missing companyId in query string' });
    }

    const authorised = await usersService.validateUserEntity(userId, companyId, constants.user.role.admin);
    if (!authorised) {
        jsonLogger.error({
            type: 'TRACKING', function: 'getPOs::handler', functionName: context.functionName,
            message: 'Only companyadmins can see all POs'
        });
        return responseLib.forbidden({ status: false });
    }
    const result = await poService.listPOsV2(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId);
    if (!result)
        return responseLib.failure({ status: false });

    const billingRows = await balanceService.getCompanyBalanceRows(companyId);
    const billingFilterOptions = getBillingFilterOptions(billingRows);

    if (poItemId) {
        const poListById = _.keyBy(result, 'itemId');
        const rows = await getPoUsageBreakdown(companyId, poItemId, poListById, activeFilters);
        if (!exportToCsv) return responseLib.success({ poData: poListById[poItemId], poUsageBreakdown: rows, billingFilterOptions });

        const exportData = poUsageExportData(rows, exportColumns);
        const url = await getUrlExport(exportData)
        return responseLib.send({ url, fileName: "poUsageExport" });
    }

    const allPOsNumbers = _.map(result, po => _.get(po, 'itemData.poNumber'));
    // eslint-disable-next-line no-undefined
    const posUsageSummary = await poHelper.sumupPOUsage(companyId, undefined, billingId);
    const [[debtPO], allPOs] = _.partition(result, po => isDebtPO(po.itemId));
    const relevantPOs = billingId ? getOnlyUsedPOs(allPOs, debtPO, posUsageSummary) : allPOs;
    let response = await normalizePOsForTable(companyId, relevantPOs, posUsageSummary, billingId);

    if (!_.isEmpty(activeFilters)) {
        response = filterResponse(activeFilters, response, companyId)
    }

    if (exportToCsv) {
        const rows = response;
        const exportData = posExportData(rows, exportColumns, billingId);
        const url = await getUrlExport(exportData);
        return responseLib.send({ url, fileName: "posExport" });
    }

    const paymentDebts = getDebtInfo(debtPO, posUsageSummary);
    return responseLib.success({ rows: response, billingFilterOptions, paymentDebts, allPOsNumbers });
};
