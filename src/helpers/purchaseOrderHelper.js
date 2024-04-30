/* eslint-disable no-magic-numbers */
/* eslint-disable no-undefined */
/* eslint-disable newline-per-chained-call */

'use strict';

const _ = require('lodash');

const { settingsTableName, customersTableName, budgetsTableName } = process.env;
const { constants, SettingsService, BalanceService, idConverterLib, POService } = require('stoke-app-common-api');
const { getCompaniesTalentsNames, getCompanyWorkspaces, getCompanyWorkspacesKeyValuePairs, getCompanyTalents } = require('./csvReport/csvReportHelper');
const { fetchJobsForMilestones, getTalentsForJobs } = require('./jobHelper');
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const balanceService = new BalanceService(customersTableName, null, constants.attributeNames.defaultAttributes);
const poService = new POService(budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);
const PO_NUMBER_PATH = 'itemData.poNumber'

const getJobsAndTalentsForMilestones = async (milestones, companyId) => {
    const jobs = await fetchJobsForMilestones(milestones);
    const talents = await getTalentsForJobs(jobs, companyId);
    return { 
        jobsByItemId: _.keyBy(jobs, 'itemId'),
        talentsByItemId: getCompaniesTalentsNames(talents) 
    }
}

const getCompanyWorkspacesNamesByKeyValue = async (companyId) => {
    const companyWorkspaces = await getCompanyWorkspaces(companyId);
    return getCompanyWorkspacesKeyValuePairs(companyWorkspaces);
}

const getTalentsNamesByKeyValue = async (companyId) => {
    const talents = await getCompanyTalents(companyId);
    return getCompaniesTalentsNames(talents) 
}

const isVatIncludedForCompany = async (companyId) => {
    const settings = await settingsService.get(`${constants.prefix.company}${companyId}`);
    return { isVatIncluded: _.get(settings, 'itemData.isVatIncluded'), isStokeUmbrella: _.get(settings, 'itemData.stokeUmbrella') };
}

const getBillingNamesById = async (companyId) => {
    const billingRows = await balanceService.getCompanyBalanceRows(companyId);
    return _.reduce(billingRows, (acc, billing) => {
        if (!billing.externalId) return acc

        acc[billing.externalId] = _.get(billing, 'description')
        return acc
    }, {})
}

const enrichMilestonesWithPOitemNumber = async (items, index) => {
    if (_.isEmpty(items)) return []
    const companyId = _.get(items[0], 'companyId')
    const allPOs = await poService.listPOsV2(index, companyId);
    const posByItemId = _.keyBy(allPOs, 'itemId')

    return _.map(items, item => {
        const poItemId = _.get(item, 'poItemId')
        if (!poItemId) return item
        const poNumber = _.get(posByItemId[poItemId], PO_NUMBER_PATH)
        const mainPOId = idConverterLib.getMainPOIdFromPOItemId(poItemId);
        const isLineItem = mainPOId !== poItemId;
        const fullPOnumber = isLineItem ? `${_.get(posByItemId[mainPOId], PO_NUMBER_PATH)}-${poNumber}` : poNumber
        return { ...item, poNumber: fullPOnumber }
    })
}

module.exports = {
    getJobsAndTalentsForMilestones,
    isVatIncludedForCompany,
    getCompanyWorkspacesNamesByKeyValue,
    getBillingNamesById,
    getTalentsNamesByKeyValue,
    enrichMilestonesWithPOitemNumber,
};
