/* eslint-disable max-lines */
/* eslint-disable complexity */
/* eslint-disable max-lines */
/* eslint-disable no-magic-numbers */

'use strict';

const _ = require('lodash');
const dayjs = require('dayjs');

const { constants, idConverterLib, jsonLogger, prefixLib } = require('stoke-app-common-api');
const { getCompanyUsersByUserId } = require('../helpers/csvReport/csvReportHelper');
const { getMainPOIdFromPOItemId } = require('stoke-app-common-api/lib/idConverterLib');
const { mandatoryHeaders, exportHeader, billingExportHeaders, ADDRESS_FIELDS, USAGE_TYPES, columnTypesByView, tableFieldNames, poFilters, PO_BREAKDOWN_ROW_TYPE, PO_STATUS, exportPoUsageHeader, mandatoryPoUsageHeaders } = require('./constants')
const { strings } = require('./strings');
const { hiringManagerFullName } = require('../helpers/csvReport/csvReportNormalizer');
const { getMilestoneAmountByVat } = require('stoke-app-common-api/helpers/billingHelper');
const { getCompanyWorkspacesNamesByKeyValue, isVatIncludedForCompany, getJobsAndTalentsForMilestones, getBillingNamesById, getTalentsNamesByKeyValue } = require('../helpers/purchaseOrderHelper');
const { getUserName } = require('../helpers/utils');

const isDebtPO = (poId) => poId === `${constants.prefix.po}DEBT`;

// eslint-disable-next-line consistent-return
const getPOTypesByUsage = (usageType) => {
    switch (usageType) {
        case USAGE_TYPES.fees:
            return constants.poTypes.feesAndAdjustments
        case USAGE_TYPES.talentService:
        case USAGE_TYPES.globalFees:
            return constants.poTypes[usageType];
        default:
            break;
    }
}

// eslint-disable-next-line consistent-return
const getPOUsageByPOType = (poTypes) => _.map(poTypes, poType => {
    switch (poType) {
        case constants.poTypes.feesAndAdjustments:
            return USAGE_TYPES.fees;
        case constants.poTypes.talentService:
        case constants.poTypes.globalFees:
            return USAGE_TYPES[poType];
        default:
            break;
    }
})

const calculateUnassignedAmount = (blanketItems) => _.sumBy(blanketItems, (item) => {
    const isBlanket = _.get(item, 'itemData.isBlanketPO')
    const totalAmount = _.get(item, 'itemData.totalAmount', 0)
    return isBlanket ? totalAmount : -totalAmount
})

const totalUsedByBlanketPO = (lineItems, usedByPo) => _.sumBy(lineItems, lineItem => _.get(usedByPo, [lineItem.itemId], 0));
const checkIsLineItem = (poItemId) => idConverterLib.getMainPOIdFromPOItemId(poItemId) !== poItemId;
const checkIsBlanketPO = (poItem) => _.get(poItem, 'itemData.isBlanketPO', false)

const getAvailableByPO = (pos, posGrouppedByMainPO) => {
    const posById = _.keyBy(pos, 'itemId');
    const availableByMainPO = _.mapValues(posGrouppedByMainPO, (po) => _.sumBy(po, 'available'));
    return _.mapValues(posById, (po) => {
        const { itemId } = po || {};
        return checkIsLineItem(itemId) ? _.get(po, 'available', 0) : _.get(availableByMainPO, [itemId], 0)
    })
}

const getDepartmentNames = (departmentIds, allDepartments, companyId) => {
    if (!_.size(departmentIds)) return [];
    const uniqDepartments = _.uniq(departmentIds);
    const isAll = uniqDepartments.includes(companyId);
    if (isAll) {
        return [strings.allWorkspaces]
    }
    return _.chain(uniqDepartments).
        map(id => _.get(allDepartments, [`${constants.prefix.entity}${id}`])).
        filter(Boolean).
        value();
}

const getTalentsNames = (talentsId, talentsNamesById) => {
    if (!_.size(talentsId)) return [];
    const uniqTalents = _.uniq(talentsId);
    return _.chain(uniqTalents).
        map(talentId => _.get(talentsNamesById, talentId)).
        filter(Boolean).
        value();
}

// eslint-disable-next-line consistent-return
const getPOTypeUIFormat = (poTypes) => _.map(poTypes, poType => {
    switch (poType) {
        case constants.poTypes.feesAndAdjustments:
            return strings.fees;
        case constants.poTypes.talentService:
            return strings.talentPayments;
        case constants.poTypes.globalFees:
            return strings.globalFees;
        default:
            break;
    }
})

const normalizeResponse = (companyId, rows, usedByPo) => {
    const posGrouppedByMainPO = _.groupBy(rows, row => idConverterLib.getMainPOIdFromPOItemId(_.get(row, 'itemId')));
    const result = _.map(rows, (row) => {
        const poScope = _.get(row, 'itemData.poScope')
        const mainPO = idConverterLib.getMainPOIdFromPOItemId(_.get(row, 'itemId'));
        const isBlanketPO = _.get(row, 'itemData.isBlanketPO');
        const used = isBlanketPO ? totalUsedByBlanketPO(posGrouppedByMainPO[mainPO], usedByPo) : _.get(usedByPo, [row.itemId], 0);
        const expirationDate = _.get(row, 'validTo');
        const isClosed = Boolean(expirationDate) && expirationDate < Date.now();
        return {
            available: row.available,
            createdAt: row.createdAt,
            createdBy: row.createdBy,
            itemId: row.itemId,
            poNumber: _.get(row, 'itemData.poNumber'),
            poStatus: isClosed ? 'Closed' : 'Active',
            description: _.get(row, 'itemData.description'),
            address: _.get(row, 'itemData.address'),
            expirationDate: _.get(row, 'validTo'),
            startDate: _.get(row, 'validFrom'),
            scopeIds: _.get(poScope, 'scopeIds', []),
            scopeType: _.get(poScope, 'scopeType', ''),
            usageType: getPOUsageByPOType(_.get(row, 'itemData.poScope.poTypes')),
            originalAmount: _.get(row, 'itemData.totalAmount'),
            companyId,
            mainPO,
            used,
            isBlanketPO,
            isEmptyBlanket: isBlanketPO && posGrouppedByMainPO[row.itemId].length === 1,
        }
    });

    return result;
};

const getUsage = (po, posGrouppedByMainPO) => {
    if (!checkIsBlanketPO(po)) {
        return getPOTypeUIFormat(_.get(po, 'itemData.poScope.poTypes'));
    }
    const lineItems = _.get(posGrouppedByMainPO, [po.itemId], []);
    const allUsageTypes = _.chain(lineItems).
        map(item => _.get(item, 'itemData.poScope.poTypes', [])).
        flatten().
        filter(Boolean).
        uniq().
        value();
    return getPOTypeUIFormat(allUsageTypes);
}

const getDepartments = (po, scopeType, posGrouppedByMainPO, workspaceNamesById) => {
    if (scopeType && scopeType === constants.poScopeTypes.talents) return []
    const { companyId } = po || {};
    if (!checkIsBlanketPO(po)) {
        return getDepartmentNames(_.get(po, 'itemData.poScope.scopeIds', []), workspaceNamesById, companyId);
    }
    const lineItems = _.get(posGrouppedByMainPO, [po.itemId], []);
    const allDepartments = _.chain(lineItems).
        filter(item => _.get(item, 'itemData.poScope.scopeType') === constants.poScopeTypes.departments).
        map(item => _.get(item, 'itemData.poScope.scopeIds', [])).
        flatten().
        filter(Boolean).
        uniq().
        value();
    return _.isEmpty(allDepartments) ? [] : getDepartmentNames(allDepartments, workspaceNamesById, companyId);
}

const getTalents = (po, scopeType, posGrouppedByMainPO, talentsNamesById) => {
    if (scopeType && scopeType !== constants.poScopeTypes.talents) return []
    if (!checkIsBlanketPO(po)) {
        return getTalentsNames(_.get(po, 'itemData.poScope.scopeIds', []), talentsNamesById);
    }
    const lineItems = _.get(posGrouppedByMainPO, [po.itemId], []);
    const allTalents = _.chain(lineItems).
        filter(item => _.get(item, 'itemData.poScope.scopeType') === constants.poScopeTypes.talents).
        map(item => _.get(item, 'itemData.poScope.scopeIds', [])).
        flatten().
        filter(Boolean).
        uniq().
        value();
    return _.isEmpty(allTalents) ? [] : getTalentsNames(allTalents, talentsNamesById);
}

const getAddress = po => {
    const address = _.get(po, 'itemData.address', {});
    const addressElements = _.pick(address, ADDRESS_FIELDS)
    return _.join(Object.values(addressElements), ', ');
}

// eslint-disable-next-line max-params, max-lines-per-function
const valueGetter = (collumns, row, availableByPO, workspaceNamesById, talentsNamesById, usedByPo, posGrouppedByMainPO, posById, usersByUserId) => {
    const { itemId } = row || {};
    const used = checkIsBlanketPO(row) ? totalUsedByBlanketPO(posGrouppedByMainPO[itemId], usedByPo) : _.get(usedByPo, [row.itemId], 0);
    const mainPO = getMainPOIdFromPOItemId(itemId);
    const scopeType = _.get(row, 'itemData.poScope.scopeType');
    const expirationDate = _.get(row, 'validTo');
    const isClosed = Boolean(expirationDate) && expirationDate < Date.now();
    const startDate = _.get(row, 'validFrom');
    const tableValues = {};
    // eslint-disable-next-line max-lines-per-function
    _.forEach(collumns, (columnType) => {
        switch (columnType) {
            case tableFieldNames.mainPONumber:
                tableValues[columnType] = _.get(_.get(posById, [mainPO]), 'itemData.poNumber');
                break;
            case tableFieldNames.poNumber:
                tableValues[columnType] = _.get(row, 'itemData.poNumber');
                break;
            case tableFieldNames.poStatus:
                tableValues[columnType] = isClosed ? PO_STATUS.closed : PO_STATUS.active;
                break;
            case tableFieldNames.closedBy:
                // eslint-disable-next-line no-undefined
                tableValues[columnType] = isClosed ? getUserName(_.get(row, 'itemData.closedBy'), usersByUserId) : undefined;
                break;
            case tableFieldNames.scopeType:
                tableValues[columnType] = strings.scopeTypeValues[_.get(row, 'itemData.poScope.scopeType')];
                break;
            case tableFieldNames.talents:
                tableValues[columnType] = getTalents(row, scopeType, posGrouppedByMainPO, talentsNamesById);
                break;
            case tableFieldNames.workspaces:
                tableValues[columnType] = getDepartments(row, scopeType, posGrouppedByMainPO, workspaceNamesById);
                break;
            case tableFieldNames.usage:
                // eslint-disable-next-line no-undefined
                tableValues[columnType] = isDebtPO(itemId) ? [] : getUsage(row, posGrouppedByMainPO);
                break;
            case tableFieldNames.available:
                tableValues[columnType] = _.round(_.get(availableByPO, [itemId], 0), 2);
                break;
            case tableFieldNames.used:
                tableValues[columnType] = _.round(used, 2);
                break;
            case tableFieldNames.total:
                tableValues[columnType] = _.round(_.get(row, 'itemData.totalAmount'), 2);
                break;
            case tableFieldNames.expirationDate:
                tableValues[columnType] = expirationDate && dayjs(expirationDate).format('DD-MM-YYYY');
                break;
            case tableFieldNames.startDate:
                tableValues[columnType] = startDate && dayjs(startDate).format('DD-MM-YYYY');
                break;
            case tableFieldNames.creationDate:
                tableValues[columnType] = dayjs(row.createdAt).format('DD-MM-YYYY');
                break;
            case tableFieldNames.description:
                tableValues[columnType] = _.get(row, 'itemData.description');
                break;
            case tableFieldNames.address:
                tableValues[columnType] = getAddress(_.get(posById, [mainPO], {}));
                break;
            default:
                break;
        }
    })
    return tableValues;
}

// eslint-disable-next-line max-params
const getTableValues = (row, availableByPO, workspaceNamesById, talentsNamesById, usedByPo, posGrouppedByMainPO, posById, isByBillingView, usersByUserId) => {
    const { itemId } = row || {};
    const availableColumns = isByBillingView ? columnTypesByView.byBillingView : columnTypesByView.fullView;
    const tableValues = valueGetter(availableColumns, row, availableByPO, workspaceNamesById, talentsNamesById, usedByPo, posGrouppedByMainPO, posById, usersByUserId);
    if (checkIsLineItem(itemId)) {
        tableValues[tableFieldNames.lineItemNumber] = _.get(row, 'itemData.poNumber');
    }
    return tableValues;
}

const normalizePOsForTable = async (companyId, rows, usedByPo, isByBillingView) => {
    const normalizedForUIActions = _.keyBy(normalizeResponse(companyId, rows, usedByPo), 'itemId');

    const posGrouppedByMainPO = _.groupBy(rows, row => idConverterLib.getMainPOIdFromPOItemId(_.get(row, 'itemId')));
    const posById = _.keyBy(rows, 'itemId');
    const availableByPO = getAvailableByPO(rows, posGrouppedByMainPO);
    const workspaceNamesById = await getCompanyWorkspacesNamesByKeyValue(companyId);
    const usersByUserId = await getCompanyUsersByUserId(companyId);
    const talentsNamesById = await getTalentsNamesByKeyValue(companyId);
    const normalizedForTable = _.map(rows, (row) => ({
        ..._.get(normalizedForUIActions, [row.itemId], {}),
        tableValues: getTableValues(row, availableByPO, workspaceNamesById, talentsNamesById, usedByPo, posGrouppedByMainPO, posById, isByBillingView, usersByUserId),
    }));
    return normalizedForTable;
}

const normalizePOsBreakdownMsForTable = async (companyId, milestones, poListById, workspaceNamesById) => {
    const usersByUserId = await getCompanyUsersByUserId(companyId);
    const { jobsByItemId, talentsByItemId } = await getJobsAndTalentsForMilestones(milestones, companyId);
    const { isVatIncluded, isStokeUmbrella } = await isVatIncludedForCompany(companyId);
    const billingNameById = await getBillingNamesById(companyId);

    return _.map(milestones, (ms) => {
        const po = poListById[ms.poItemId]
        const jobId = idConverterLib.getJobIdFromMilestoneId(ms.itemId);
        const currentJob = jobsByItemId[jobId];
        const talentId = _.get(currentJob, 'itemData.talentId');
        const billingId = _.get(ms, 'itemData.billingId');

        return {
            milestoneName: _.get(ms, 'itemData.title', ''),
            jobTitle: _.get(currentJob, 'itemData.jobTitle', ''),
            itemNumber: checkIsLineItem(ms.poItemId) ? _.get(po, 'itemData.poNumber') : null,
            talentId,
            talent: _.get(talentsByItemId, talentId, ''),
            hiringManager: hiringManagerFullName(ms, usersByUserId),
            workspaces: workspaceNamesById[`${constants.prefix.entity}${ms.entityId}`] || '',
            amount: getMilestoneAmountByVat(ms, isVatIncluded, isStokeUmbrella),
            billing: billingId && billingNameById[`billing_${billingId}`],
            rowType: PO_BREAKDOWN_ROW_TYPE.milestone,
            milestoneId: ms.itemId,
            entityId: ms.entityId,
            poItemId: ms.poItemId,
        }
    });
}

const normalizePOsBreakdownBillingForTable = (billings, poListById) => _.map(billings, (billing) => {
        const po = poListById[billing.poItemId];
        const itemNumber = checkIsLineItem(billing.poItemId) ? _.get(po, 'itemData.poNumber') : null;
        return {
            itemNumber,
            amount: billing.amount,
            billing: billing.billingName,
            milestoneName: billing.billingName,
            rowType: PO_BREAKDOWN_ROW_TYPE.billing,
        }
    });

const posExportData = (pos, exportColumns, isByBillingView) => {
    const baseHeaders = isByBillingView ? billingExportHeaders : exportHeader;
    const columnsToExport = _.isEmpty(exportColumns) ? baseHeaders : _.pick(baseHeaders, exportColumns);
    const headers = Object.values({ ...mandatoryHeaders, ...columnsToExport });
    const rows = _.map(pos, (po) => _.map(headers, (header) => {
        const value = _.get(po, ['tableValues', header]);
        return _.isArray(value)
            ? _.join(value, ', ')
            : value;
    })).filter(Boolean);
    const headerTitles = _.map(headers, header => _.get(strings.headerNames, [header]));
    return { rows, headers: headerTitles };
}

const poUsageExportData = (poUsage, exportColumns) => {
    const columnsToExport = _.pick(exportPoUsageHeader, exportColumns);
    const headers = Object.values({ ...columnsToExport, ...mandatoryPoUsageHeaders });
    const rows = _.map(poUsage, (item) => _.map(headers, (header) => _.get(item, header)));
    const headerTitles = _.map(headers, header => _.get(strings.poUsageHeaderNames, [header]));
    return { rows, headers: headerTitles };
}

const checkIsValidPOScopeType = (scopeType, scopeIds, companyId) => {
    if (scopeType === constants.poScopeTypes.company && !_.isEqual(scopeIds, [companyId])) {
        jsonLogger.error({
            type: 'TRACKING', function: 'normalizer::checkIsValidPOScopeType',
            message: 'scopeIds of PO with company scopeType must to include companyId', scopeIds,
        });
        return false;
    }
    if (scopeType === constants.poScopeTypes.talents && !scopeIds.every(id => prefixLib.isTalent(id))) {
        jsonLogger.error({
            type: 'TRACKING', function: 'normalizer::checkIsValidPOScopeType',
            message: 'scopeIds of PO with talents scopeType must to include only talents', scopeIds,
        });
        return false;
    }
    return true;
}

const checkIsValidPOScope = (data, companyId) => {
    const { scopeIds, scopeType, usageType } = data;
    if (_.isEmpty(scopeIds) || _.isEmpty(usageType)) {
        jsonLogger.error({
            type: 'TRACKING', function: 'normalizer::checkIsValidPOScope',
            message: 'PO scope requires scopeIds and poTypes to be defined', scopeIds, scopeType, usageType, companyId,
        });
        return false;
    }
    if (_.includes(usageType, constants.poTypes.globalFees) && !_.isEqual(scopeIds, [companyId])) {
        jsonLogger.error({
            type: 'TRACKING', function: 'normalizer::checkIsValidPOScope',
            message: 'PO that covers globalPOFees has wrong scope', scopeIds, usageType, companyId,
        });
        return false;
    }
    if (scopeType && !checkIsValidPOScopeType(scopeType, scopeIds, companyId)) {
        return false;
    }
    return true;
}

const filterResponse = (activeFilters, response, companyId) => {
    const selectedScopeIds = _.get(activeFilters, [poFilters.scopeIds]);
    const selectedScopeType = _.get(activeFilters, [poFilters.poScopeType]);
    const selectedStatus = _.get(activeFilters, [poFilters.poStatus]);
    if (_.isEmpty(selectedScopeIds) && _.isEmpty(selectedScopeType) && _.isEmpty(selectedStatus)) {
        return response;
    }

    const filterCondition = (po) => {
        const scopeIdsFilter = _.isEmpty(selectedScopeIds) || !_.isEmpty(_.intersection(po.scopeIds, selectedScopeIds)) || _.includes(po.scopeIds, companyId);
        const scopeTypeFilter = _.isEmpty(selectedScopeType) || _.includes(selectedScopeType, po.scopeType);
        const poStatusFilter = _.isEmpty(selectedStatus) || _.includes(selectedStatus, po.poStatus);
        return scopeIdsFilter && scopeTypeFilter && poStatusFilter;
    }

    const relatedMainPOs = _.chain(response).
        filter(po => filterCondition(po)).
        filter(Boolean).
        map(po => idConverterLib.getMainPOIdFromPOItemId(po.itemId)).
        value();
    return _.filter(response, po => relatedMainPOs.includes(idConverterLib.getMainPOIdFromPOItemId(po.itemId)))
}

module.exports = {
    normalizeResponse,
    getPOTypesByUsage,
    calculateUnassignedAmount,
    normalizePOsForTable,
    normalizePOsBreakdownMsForTable,
    normalizePOsBreakdownBillingForTable,
    posExportData,
    checkIsValidPOScope,
    filterResponse,
    isDebtPO,
    checkIsValidPOScopeType,
    poUsageExportData,
};
