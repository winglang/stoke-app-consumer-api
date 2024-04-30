/* eslint-disable no-case-declarations */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */

'use strict';

const {
    budgetsTableName,
    gsiItemsByCompanyIdAndItemIdIndexNameV2,
} = process.env;

const _ = require('lodash');
const dayjs = require('dayjs');
const { getCompanyWorkspaces, getCompanyWorkspacesKeyValuePairs, getCompanyUsersByUserId } = require('../csvReport/csvReportHelper');
const { ADDRESS_FIELDS } = require('../../purchaseOrders/constants')
const { POService, constants, idConverterLib, prefixLib } = require('stoke-app-common-api');
const { getTalentsNamesByKeyValue } = require('../purchaseOrderHelper');
const { strings } = require('../../purchaseOrders/strings');
const poService = new POService(budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);

const i18nPO = {
    fiverrEnterprise: 'Fiverr Enterprise',
    blanketPO: 'Blanket PO:',
    lineItem: 'Item:',
    standartPO: 'Standart PO:',
    usageType: 'usage type: ',
    companyScope: 'scope: entire company',
    workspacesScope: 'workspaces: ',
    talentsScope: 'talents: ',
    scopeType: 'scope type: ',
    description: 'description: ',
    address: 'address: ',
    validFrom: 'validFrom: ',
    validTo: 'validTo: ',
    usd: '$',
    feesAndAdjustments: 'Fees',
    talentService: 'Talent payments',
    globalFees: 'Additional services',
    actionNames: {
        create: "New PO",
        subtract: "Deduct amount",
        add: "Add amount",
        updateDetails: "Update details",
        close: "Closed PO",
        reopen: "PO reopened",
        amountAssigned: "Milestone amount assigned",
        amountWithdrawn: "Milestone amount withdrawn",
    },
    headers: {
        date: 'Date',
        poNumber: 'Po number',
        action: 'Action',
        change: 'Change',
        user: 'Changed by'
    }
}

const PO_EDITABLE_FIELDS = {
    poTypes: 'poTypes',
    departments: 'departments',
    scopeType: 'scopeType',
    scopeIds: 'scopeIds',
    description: 'description',
    address: 'address',
    validFrom: 'validFrom',
    validTo: 'validTo'
};

const PathByActionType = {
    [constants.poActionTypes.updateDetails]: {
        [PO_EDITABLE_FIELDS.poTypes]: `${PO_EDITABLE_FIELDS.poTypes}`,
        [PO_EDITABLE_FIELDS.departments]: `${PO_EDITABLE_FIELDS.departments}`,
        [PO_EDITABLE_FIELDS.scopeIds]: `${PO_EDITABLE_FIELDS.scopeIds}`,
        [PO_EDITABLE_FIELDS.scopeType]: `${PO_EDITABLE_FIELDS.scopeType}`,

    },
    [constants.poActionTypes.create]: {
        [PO_EDITABLE_FIELDS.poTypes]: `poScope.${PO_EDITABLE_FIELDS.poTypes}`,
        [PO_EDITABLE_FIELDS.departments]: `poScope.${PO_EDITABLE_FIELDS.departments}`,
        [PO_EDITABLE_FIELDS.scopeIds]: `poScope.${PO_EDITABLE_FIELDS.scopeIds}`,
        [PO_EDITABLE_FIELDS.scopeType]: `poScope.${PO_EDITABLE_FIELDS.scopeType}`,
    }
}

const resolveUserName = (user) => {
    if (_.get(user, 'itemData.stokeAdmin')) {
        return i18nPO.fiverrEnterprise
    }
    return `${_.get(user, 'itemData.givenName', '')} ${_.get(user, 'itemData.familyName', '')}`;
}

const getUsageString = (poUsages) => {
    const usageTypes = _.pick(i18nPO, poUsages);
    return Object.values(usageTypes).join(', ');
}

const getDepartmentsString = (departmentNamesById, poDepartments) => {
    const names = _.map(poDepartments, (departmentId) => _.get(departmentNamesById, [`${constants.prefix.entity}${departmentId}`], ''));
    return Object.values(names).join(', ');
}

// eslint-disable-next-line max-params
const poChangeFormatter = (changedFields, departmentNamesById, actionType, companyId, talentNamesById) => {
    const changes = [];
    let poDepartments = [];
    _.forEach(Object.values(PO_EDITABLE_FIELDS), (field) => {
        switch (field) {
            case PO_EDITABLE_FIELDS.poTypes:
                const poTypes = _.get(changedFields, PathByActionType[actionType][PO_EDITABLE_FIELDS.poTypes]);
                if (!_.isEmpty(poTypes)) {
                    changes.push(`${i18nPO.usageType}${getUsageString(poTypes)}`);
                }
                break;
            case PO_EDITABLE_FIELDS.departments:
                poDepartments = _.get(changedFields, PathByActionType[actionType][PO_EDITABLE_FIELDS.departments], []);
                if (!_.isEmpty(poDepartments)) {
                    const isCompanyLevel = poDepartments.includes(companyId);
                    const scopeString = isCompanyLevel ? i18nPO.companyScope : `${i18nPO.workspacesScope}${getDepartmentsString(departmentNamesById, poDepartments)}`;
                    changes.push(scopeString);
                }
                break;
            case PO_EDITABLE_FIELDS.scopeIds:
                const scopeIds = _.get(changedFields, PathByActionType[actionType][PO_EDITABLE_FIELDS.scopeIds], []);
                const isCompanyLevel = scopeIds.includes(companyId);
                if (!_.isEmpty(scopeIds) && !isCompanyLevel) {
                    const isTalentUpdated = prefixLib.isTalent(scopeIds[0]);
                    const scopeIdsString = isTalentUpdated 
                    ? `${i18nPO.talentsScope}${talentNamesById[scopeIds[0]]}` 
                    : `${i18nPO.workspacesScope}${getDepartmentsString(departmentNamesById, scopeIds)}`
                    changes.push(scopeIdsString);
                }
                break;
            case PO_EDITABLE_FIELDS.scopeType:
                const scopeType = _.get(changedFields, PathByActionType[actionType][PO_EDITABLE_FIELDS.scopeType]);
                if (scopeType) {
                    const scopeTypeString = `${i18nPO.scopeType}${strings.scopeTypeValues[scopeType]}`;
                    changes.push(scopeTypeString);
                }
                break;
            case PO_EDITABLE_FIELDS.description:
                const description = _.get(changedFields, [field], '');
                if (!_.isEmpty(description)) {
                    changes.push(`${i18nPO[field]}${description}`);
                }
                break;
            case PO_EDITABLE_FIELDS.address:
                const address = Object.values(_.pick(_.get(changedFields, field, {}), ADDRESS_FIELDS)).join(', ');
                if (!_.isEmpty(address)) {
                    changes.push(`${i18nPO.address}${address}`);
                }
                break;
            case PO_EDITABLE_FIELDS.validFrom:
            case PO_EDITABLE_FIELDS.validTo:
                if (changedFields[field]) {
                    changes.push(`${i18nPO[field]}${dayjs(changedFields[field]).format('DD-MM-YYYY')}`);
                }
                break
            default:
                break;
        }
    })
    return changes.join('\n');
}

const formatCreateDetails = (item, departmentNamesById, talentNamesById) => {
    const { itemData = {}, companyId } = item;
    const { itemId: poItemId, validFrom, validTo, poItemData: createdPOData } = itemData;
    const mainPOId = idConverterLib.getMainPOIdFromPOItemId(poItemId);
    const isLineItem = mainPOId !== poItemId;
    const isBlanketPO = _.get(createdPOData, 'isBlanketPO')
    const amount = _.get(createdPOData, 'totalAmount');
    let change = "";
    if (isBlanketPO) {
        change = `${i18nPO.blanketPO} $${amount}`;
    } else {
        change = isLineItem ? `${i18nPO.lineItem} $${amount}` : `${i18nPO.standartPO} $${amount}`;
    }

    const creationDetails = poChangeFormatter({ ...createdPOData, validFrom, validTo }, departmentNamesById, constants.poActionTypes.create, companyId, talentNamesById);
    change += _.isEmpty(creationDetails) ? '' : `\n${creationDetails}`
    return change;
}

const formatUpdateDetails = (item, departmentNamesById, talentNamesById) => {
    const { itemData = {}, companyId } = item;
    const { newValues } = itemData;
    return poChangeFormatter(newValues, departmentNamesById, constants.poActionTypes.updateDetails, companyId, talentNamesById);
}

const formatAmountChange = (item) => {
    const { itemData = {} } = item;
    const { amount } = itemData;
    return `${i18nPO.usd}${Math.abs(amount)}`;
}

const formatClosePO = (item, userNamesById) => {
    const closedByUserId = _.get(item, 'itemData.newValues.closedBy')
    const user = userNamesById[closedByUserId]
    return `PO was closed by ${resolveUserName(user)}`;
}

const formatReopenPO = (item, userNamesById) => {
    const reopenedByUserId = _.get(item, 'itemData.newValues.reopenedBy')
    const user = userNamesById[reopenedByUserId]
    return `PO was re-opened by ${resolveUserName(user)}`;
}

const formatAmountAssigned = (item) => {
    const { poNumber, milestoneName, amount } = item.itemData || {};
    return `Milestone ${milestoneName} in the amount of ${Math.abs(amount)} was assigned to PO ${poNumber}`;
}

const formatAmountWithdrawn = (item) => {
    const { poNumber, milestoneName, amount } = item.itemData || {};
    return `Milestone ${milestoneName} in the amount of ${Math.abs(amount)} was withdrawn from PO ${poNumber}`;
}

// eslint-disable-next-line max-params
const getChangeDetailsByType = (item, actionType, departmentNamesById, talentNamesById, userNamesById) => {
    switch (actionType) {
        case constants.poActionTypes.create:
            return formatCreateDetails(item, departmentNamesById, talentNamesById);
        case constants.poActionTypes.add:
        case constants.poActionTypes.subtract:
            return formatAmountChange(item);
        case constants.poActionTypes.updateDetails:
            return formatUpdateDetails(item, departmentNamesById, talentNamesById);
        case constants.poActionTypes.close:
            return formatClosePO(item, userNamesById);
        case constants.poActionTypes.reopen:
            return formatReopenPO(item, userNamesById);
        case constants.poActionTypes.amountAssigned:
            return formatAmountAssigned(item);
        case constants.poActionTypes.amountWithdrawn:
            return formatAmountWithdrawn(item);
        default:
            return '';
    }
}

module.exports.normalizePOLogs = async (companyId, logs) => {
    const companyWorkspaces = await getCompanyWorkspaces(companyId);
    const departmentNamesById = getCompanyWorkspacesKeyValuePairs(companyWorkspaces);
    const talentNamesById = await getTalentsNamesByKeyValue(companyId);
    const userNamesById = await getCompanyUsersByUserId(companyId);
    const allPOs = await poService.listPOsV2(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId);
    const posById = _.keyBy(allPOs, 'itemId');
    return _.map(logs, (item) => {
        const { itemData = {}, createdAt, itemId } = item;
        const { itemId: poItemId, userId, actionType } = itemData;
        const poItem = _.get(posById, poItemId);
        const mainPOId = idConverterLib.getMainPOIdFromPOItemId(poItemId);
        const isLineItem = mainPOId !== poItemId;
        const mainPOItem = isLineItem ? _.get(posById, mainPOId) : poItem;
        const poNumber = `${_.get(mainPOItem, 'itemData.poNumber')}${isLineItem ? ` - ${_.get(poItem, 'itemData.poNumber')}` : ''}`;
        const user = _.get(userNamesById, userId);
        const change = getChangeDetailsByType(item, actionType, departmentNamesById, talentNamesById, userNamesById);
        return {
            itemId,
            poItemId,
            createdAt,
            user: resolveUserName(user),
            poNumber,
            action: _.get(i18nPO.actionNames, actionType),
            change,
            date: dayjs(createdAt).format('DD MMM YYYY, HH:mm:ss'),
            actionType,
            hiringManagers: userId
        }
    })
}

module.exports.dataExportPOAuditLogs = (logs) => {
    const headers = ['date', 'poNumber', 'user', 'action', 'change'];
    const rows = _.map(logs, (item) => _.map(headers, (header) => _.get(item, header) || '')).filter(Boolean)
    return { rows, headers: _.map(headers, header => i18nPO.headers[header]) }
}

module.exports.columnMapperPOLogs = () => ({ poItemId: 'poItemId', date: 'createdAt', poNumber: 'poNumber', action: 'action', actionType: 'actionType', change: 'change', user: 'user', hiringManagers: 'hiringManagers' })
