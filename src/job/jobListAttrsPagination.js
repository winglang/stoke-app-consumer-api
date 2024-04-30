/* eslint-disable prefer-destructuring */
/* eslint-disable no-confusing-arrow */
/* eslint-disable camelcase */
/* eslint-disable no-undefined */
/* eslint-disable no-case-declarations */

'use strict';

const {
    consumerAuthTableName,
    gsiItemsByCompanyIdAndItemIdIndexNameV2,
    jobsTableName,
    settingsTableName,
    companyProvidersTableName,
} = process.env;

const _ = require('lodash');
const { constants, jsonLogger, responseLib, UsersService, JobsService, SettingsService, companyDueDateService, CompanyProvidersService } = require('stoke-app-common-api');
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const { createCsv } = require('../helpers/csvReport/createCsv');
const { fetchTalentData, fetchBatchCompanyProviders } = require('./jobListAttrs');
const { jobListType, companyProviderFileds } = require('./queryAttrs');

const queryTypes = {
    filterData: 'filterData',
    rowData: 'rowData',
    exprotData: 'exprotData'
}

// eslint-disable-next-line max-params
const getJobsItems = async (type, companyId, userId, filterKey, role, entitiesAdmin, entitiesUser) => {
    let itemStatuses = [];
    switch (type) {
        case jobListType.paymentsPage:
            itemStatuses = [constants.job.status.active, constants.job.status.completed];
            break;
        case jobListType.jobsPage:
            itemStatuses = filterKey === constants.jobsFilters.active.key ? [constants.job.status.active] : [];
            break;
        default:
            break;
    }
    jobsService.setProjectionExpression([constants.attributeNames.defaultAttributes.companyId, constants.attributeNames.defaultAttributes.tags, `${constants.attributeNames.defaultAttributes.itemData}.${constants.queryProjectionExpression.job.talentId}`]);
    const items = await jobsService.jobsPagingtion('listByCompanyIdWithFilter', undefined, [gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, userId, constants.prefix.job, itemStatuses, [], role, entitiesAdmin, entitiesUser]);
    return items;
}

// eslint-disable-next-line max-lines-per-function
const handler = async (event) => {
    jsonLogger.info({ type: "TRACKING", function: "jobListAttrsPagination::handler", event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { queryStringParameters } = event;
    const { companyId, type, filterKey, queryType } = queryStringParameters || {};
    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(userId, companyId);
    if (role === constants.user.role.unauthorised) {
        jsonLogger.error({ type: "TRACKING", function: "jobListAttrsPagination::handler", event, message: 'Unauthorised' });
        return responseLib.forbidden()
    }
    let result = null;

    switch (queryType) {
        case queryTypes.filterData:

            let talents = []
            let paymentCycles = null;
            let items = []

            switch (type) {
                case jobListType.paymentsPage:
                    items = await getJobsItems(type, companyId, userId, filterKey, role, entitiesAdmin, entitiesUser)
                    talents = await fetchBatchCompanyProviders(items, type);
                    const setting = await settingsService.get(`${constants.prefix.company}${companyId}`);
                    paymentCycles = companyDueDateService.getPaymentCyclesByVersion(setting);
                    break;
                case jobListType.jobsPage:
                    items = await getJobsItems(type, companyId, userId, filterKey, role, entitiesAdmin, entitiesUser)
                    talents = await fetchTalentData(items, type);
                    break;
                case jobListType.talentDirectoryPage:
                    companyProvidersService.setProjectionExpression(companyProviderFileds[type]);
                    talents = await companyProvidersService.companyProvidersPagination('listCompany', [companyId, undefined, undefined, undefined]);
                    items = talents;
                    break;
                default:
                    break;
            }
            const tags = _.map(items, (row) => row.tags ? _.pick(row, 'tags') : null).filter(Boolean);
            result = { talents, tags, paymentCycles };
            break;

        case queryTypes.rowData:
            const { paginationParams = {} } = JSON.parse(event.body || '{}');
            const { activeFilters, filtersStrategies } = paginationParams;
            const data = { companyId, type, filterKey, tableRequestedFields: [], filters: activeFilters, strategies: filtersStrategies };
            _.set(paginationParams, 'sortModel', _.map(_.get(paginationParams, 'sortModel'), (sort) => ({ ...sort, colId: sort.colId.replace(`customField-`, '') })));
            result = await createCsv(userId, data, type === jobListType.jobsPage, true, paginationParams);
            break
        default:
            break;
    }
    return responseLib.send(result);
};

module.exports = {
    handler,
}


