/* eslint-disable max-lines */
/* eslint-disable complexity */
/* eslint-disable camelcase */
/* eslint-disable max-params */
/* eslint-disable no-undefined */
/* eslint-disable no-return-assign */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */

'use strict';

const _ = require('lodash');
const { jobsBucketName, consumerAuthTableName, gsiViewDataByCompanyIdAndItemId, settingsTableName } = process.env;
const { constants, jsonLogger, UsersService, csvLib, s3LiteLib, idConverterLib, prefixLib, ListService } = require('stoke-app-common-api');
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const listService = new ListService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes)

const { jobsByfilterKey, getActiveFilters, createCustomFieldsFilterObject, enrichTalentsDetails, fetchJobs } = require('../../job/jobListAttrs');
const { objectsToArrayOfValues, orederObjectForCsvRow, getExistedRequestedFields, getExistedRequestedCustomFields,
    getCustomFieldsKeyNamePairs, basicFieldsKeyNamePairs, getMandatoryFields, getCompanyUsersByUserId, getCompaniesTalentsNames,
    getCompanyWorkspacesKeyValuePairs, getCompanyLegalEntitiesByDepartment, getCompanyWorkspacesByEntityId, getCompanyProvidersKeyValuePairs,
    getCompanyTalentsByTalentId, getCompanyTalents, getCompanyWorkspaces, getCompanyCustomFields, getCompanyLegalEntitiesAndDepartment,
    getEntitiesCustomFields, getCompanyDepartmentsByLegalEntities, getCompanySettings, createJobForFreelancer, queryTalents, createActiveJobForFreelancer, basicFieldsNames, getTalentProfileCustomFieldsKeyItemPairs, getPOsNumberByItemId } = require('../csvReport/csvReportHelper');
const { jobListType } = require("../../job/queryAttrs");
const { getNormlizedMilestonesForJobsPage, getNormlizedMilestonesForPaymentsPage, getNormlizedTalentsForTalentDirectory, getNormlizedMilestonesForInvoices, getNormlizedProvidersForTalentDirectory } = require('../csvReport/csvReportNormalizer');
const { basicFieldsForPaymentPage, basicFieldsForTalentDirectoryPage, paginationFieldsForTalentDirectoryPage } = require('../csvReport/csvFieldsLists');
const { normalizeFilters, isValidWorkspaceFilter, getTalentActiveFilters, dynamicFiltersKeysByType, createDynamicCustomFieldsFilter, createCustomFieldsColumnMapper } = require('../csvReport/filters');
const { normalizeJobs } = require('../normalizers');
const { queryImdb } = require('../../services/imdbService');
const { sqlAggType } = require('./constants');

const dynamicFiltersFields = (type) => _.reduce(dynamicFiltersKeysByType[type], (all, value) => ({
    ...all, [value.filterKey]: value.buildFilterSqlExp ? {
        sqlExp: value.filterKey,
        sqlExpAgg: value.sqlExpAgg,
        buildFilterSqlExp: value.buildFilterSqlExp
    } : value.filterKey
}), {})

const getNormlizedFilterStrategies = (strategies, type) => _.reduce(strategies, (acc, value, key) => {
    const filterKeyByType = ['customFields', 'talentProfileFields'].includes(key) ? key : _.get(dynamicFiltersKeysByType, [jobListType[type], key, 'filterKey'])
    if (filterKeyByType) {
        acc[filterKeyByType] = value
    }
    return acc
}, {})

const columnMapper = {
    [jobListType.jobsPage]: {
        jobId_1: 'title',
        description: 'description',
        engagementType: 'engagementType',
        status: 'status',
        hiringManager: 'hiringManager',
        department: 'department',
        comment: 'comment',
        jobStartDate: 'startDate',
        team: 'team',
        talentData: 'talentName',
        plannedLocal: 'plannedLocal',
        requested: 'requested',
        ...dynamicFiltersFields(jobListType.jobsPage),
    },
    [jobListType.paymentsPage]: _.reduce(
        basicFieldsForPaymentPage,
        (all, value) => ({ [_.get(value, 'field')]: { sqlExp: _.get(value, 'field'), sqlExpAgg: _.get(value, 'sqlExpAgg') }, ...all }),
        {
            ...dynamicFiltersFields(jobListType.paymentsPage),
            providerId: {
                sqlExpAgg: sqlAggType.none,
                sqlExp: 'providerId'
            },
            talentId: {
                sqlExpAgg: sqlAggType.count,
                sqlExp: 'talentId'
            },
            jobId: {
                sqlExpAgg: sqlAggType.count,
                sqlExp: 'jobId'
            },
            departmentId: {
                sqlExp: 'departmentId'
            },
            itemId: {
                sqlExpAgg: sqlAggType.count,
                sqlExp: 'itemId'
            },
            hiringManagerId: {
                sqlExpAgg: sqlAggType.count,
                sqlExp: 'hiringManagerId'
            },
            lineItems: {
                sqlExpAgg: sqlAggType.concat,
                sqlExp: 'lineItems'
            },
        },
    ),
    [jobListType.paymentsPageInvoicesData]: _.reduce(
        basicFieldsForPaymentPage,
        (all, value) => ({ [_.get(value, 'field')]: { sqlExp: _.get(value, 'field'), sqlExpAgg: _.get(value, 'sqlExpAgg') }, ...all }),
        {
            ...dynamicFiltersFields(jobListType.paymentsPage),
            providerId: {
                sqlExpAgg: sqlAggType.none,
                sqlExp: 'providerId'
            }
        },
    ),
    [jobListType.talentDirectoryPage]: _.reduce(
        [...basicFieldsForTalentDirectoryPage, ...paginationFieldsForTalentDirectoryPage],
        (all, value) => ({ [_.get(value, 'field')]: { sqlExp: _.get(value, 'sqlExp') || _.get(value, 'field'), sqlExpAgg: _.get(value, 'sqlExpAgg') }, ...all }),
        {   
            ...dynamicFiltersFields(jobListType.talentDirectoryPage),
            talentId: {
                sqlExpAgg: sqlAggType.concat,
                sqlExp: 'talentId'
            },
            paymentMethod: {
                sqlExpAgg: sqlAggType.none,
                sqlExp: 'paymentMethod'
            },
            score: {
                sqlExpAgg: sqlAggType.concat,
                sqlExp: 'score'
            },
            isPayable: {
                sqlExpAgg: sqlAggType.none,
                sqlExp: 'isPayable'
            },
            backgroundCheck: {
                sqlExpAgg: sqlAggType.concat,
                sqlExp: 'backgroundCheck'
            },
            certifications: {
                sqlExpAgg: sqlAggType.none,
                sqlExp: 'certifications'
            },
            experience: {
                sqlExpAgg: sqlAggType.none,
                sqlExp: 'experience'
            }
        },
    ),
};

const freeTextColumnMapper = {
    [jobListType.jobsPage]: ['title', 'job'],
    [jobListType.paymentsPage]: ['milestoneTitle', 'talentName', 'jobTitle', 'providerName'],
    [jobListType.paymentsPageInvoicesData]: ['milestoneTitle', 'talentName', 'jobTitle', 'providerName'],
    [jobListType.talentDirectoryPage]: ['name', 'email'],
};

const buildCsvToDownload = async (fieldsHeaders, normlizedMilestones, columnsOrder) => {
    const csvHeaders = orederObjectForCsvRow(fieldsHeaders, columnsOrder)
    const csvRows = objectsToArrayOfValues(normlizedMilestones, columnsOrder)
    const jobsCsv = csvLib.arraysToCsvString(csvHeaders, csvRows);
    const key = `tmp/JobsExport-${new Date().toISOString()}.csv`
    const url = await s3LiteLib.putObjectAndSign(jobsBucketName, key, jobsCsv);
    jsonLogger.info({ type: "TRACKING", function: "createCsvReport::buildCsvToDownload", url });
    return { url, key };
}

const emptyCsvBuilder = async (type, existedRequestedFields) => {
    const fieldsHeaders = basicFieldsKeyNamePairs(type);
    const columnsOrder = [...existedRequestedFields];
    const res = await buildCsvToDownload(fieldsHeaders, [], columnsOrder);
    return res;
}

const emptyRows = {
    "rows": [],
    "total": {
        "allDataCount": 0
    },
    "summary": null
};

const createCsv = async (userId, data, paginateJobs, returnData, queryImdbParams = {}) => {
    const userIdWithoutPrefixArray = _.split(userId, '_');
    const [userIdWithoutPrefix] = userIdWithoutPrefixArray;
    const { companyId, type, filterKey, tableRequestedFields, filters, strategies } = data || {};
    jsonLogger.info({ type: "TRACKING", function: "createCsvReport::handler", params: { companyId, type, tableRequestedFields, filters, strategies } });

    if (!companyId || !jobListType[type]) {
        const message = "missing required params";
        jsonLogger.error({ type: "TRACKING", function: "createCsvReport::handler", message });
        throw new Error(message)
    }

    let requestedFields = tableRequestedFields;
    if (!tableRequestedFields || !tableRequestedFields.length) {
        jsonLogger.info({ type: "TRACKING", function: "createCsvReport::handler", message: 'requestedFields is missing' });
        requestedFields = basicFieldsNames(type);
    }

    if (type === jobListType.jobsPage && !filterKey) {
        const message = "filterKey is missing";
        jsonLogger.error({ type: "TRACKING", function: "createCsvReport::handler", message });
        throw new Error(message)
    }

    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(userId, companyId);
    if (role === constants.user.role.unauthorised) {
        const authenticationError = new Error('Authentication failed');
        authenticationError.statusCode = 403;
        throw authenticationError

    }
    const isCompanyAdmin = role === constants.user.role.admin;
    const lineItemsExist = requestedFields.includes('lineItems');
    const timeReportExist = requestedFields.includes('timeReport');
    const fieldsFlag = [];
    if (lineItemsExist) {
        fieldsFlag.push('lineItems')
    }
    if (timeReportExist) {
        fieldsFlag.push('timeReport')
    }

    const mandatoryFields = getMandatoryFields(type, filterKey, fieldsFlag);
    const existedRequestedFields = getExistedRequestedFields(requestedFields, mandatoryFields, type);
    if (existedRequestedFields.length < 1) {
        const message = "Requested fields not exists";
        jsonLogger.error({ type: "TRACKING", function: "createCsvReport::handler", message });
        throw new Error(message)
    }

    const legalEntitiesAndDepartments = await getCompanyLegalEntitiesAndDepartment(companyId);
    const departmentBylegalEntities = getCompanyDepartmentsByLegalEntities(legalEntitiesAndDepartments);
    const companySettings = await getCompanySettings(companyId);
    const lists = await listService.get('user', userIdWithoutPrefix, 'talentDirectory');
    const normalizedFilters = normalizeFilters(filters, departmentBylegalEntities, companySettings, type, lists, userId);

    const { isValid, validFilter } = isValidWorkspaceFilter(normalizedFilters);
    if (!isValid) {
        jsonLogger.info({ type: "TRACKING", function: "createCsvReport::handler", message: `empty rows were returned because of filters conflicts, filters: ${filters}` });
        if (returnData) {
            return emptyRows;
        }
        const emptyCsv = await emptyCsvBuilder(type, existedRequestedFields);
        return emptyCsv;
    }
    normalizedFilters.workspaces = validFilter

    const companyTalents = await getCompanyTalents(companyId);
    const talentIdsNamesKeyValuePairs = getCompaniesTalentsNames(companyTalents);
    const talentsbyTalentId = getCompanyTalentsByTalentId(companyTalents);

    const companyWorkspaces = await getCompanyWorkspaces(companyId)
    const companyWorkspacesKeyValuePairs = getCompanyWorkspacesKeyValuePairs(companyWorkspaces);
    const entitiesByEntityId = getCompanyWorkspacesByEntityId(companyWorkspaces);

    const usersByUserId = await getCompanyUsersByUserId(companyId);
    const entitiesCustomFields = await getEntitiesCustomFields(normalizedFilters, companyWorkspacesKeyValuePairs);

    const { customFields, customFieldsTypes } = getCompanyCustomFields(companySettings, entitiesCustomFields);
    const customFieldsColumnMapper = createCustomFieldsColumnMapper(customFields, returnData, type)
    let requestedFieldsForCustomFields = requestedFields;
    const talentProfileCustomFields = _.get(companySettings, 'itemData.talentProfileCustomFields.fields', []);
    const talentProfileFieldsColumnMapper = createCustomFieldsColumnMapper(talentProfileCustomFields, false, type);

    if (returnData && (!tableRequestedFields || !tableRequestedFields.length)) {
        jsonLogger.info({ type: "TRACKING", function: "createCsvReport::handler", message: 'requestedFields is missing add custome fields' });
        requestedFieldsForCustomFields = [..._.map(customFields, 'id'), ..._.map(talentProfileCustomFields, 'id')];
    }
    const existedRequestedCustomFields = getExistedRequestedCustomFields(customFields, requestedFieldsForCustomFields);
    const customFieldsKeyNamePairs = getCustomFieldsKeyNamePairs(customFields, customFieldsTypes);
    const customFieldsNames = _.map(customFields, 'id')

    const existedRequestedTalentProfileCustomFields = getExistedRequestedCustomFields(talentProfileCustomFields, requestedFieldsForCustomFields);
    const talentProfileCustomFieldsKeyNamePairs = getTalentProfileCustomFieldsKeyItemPairs(talentProfileCustomFields, 'name');
    const talentProfileCustomFieldsTypes = getTalentProfileCustomFieldsKeyItemPairs(talentProfileCustomFields, 'type');
    const fieldsHeaders = _.assign(basicFieldsKeyNamePairs(type), customFieldsKeyNamePairs, talentProfileCustomFieldsKeyNamePairs);
    const columnsOrder = [...existedRequestedFields, ...existedRequestedTalentProfileCustomFields, ...existedRequestedCustomFields];
    const providersByProviderId = await getCompanyProvidersKeyValuePairs(companyId);
    const legalEntitiesByDepartment = getCompanyLegalEntitiesByDepartment(legalEntitiesAndDepartments);
    const posByItemId = await getPOsNumberByItemId(companyId, companySettings);
    const { activeFilters, jobsDedicatedFilters, msDedicatedFilters, msDynamicFilters } = getActiveFilters({ ...normalizedFilters }, dynamicFiltersKeysByType[type]) || {};
    const customFieldFilters = createCustomFieldsFilterObject(normalizedFilters);
    const isSeparateQueries = _.size({ ...jobsDedicatedFilters, ...msDedicatedFilters, ...customFieldFilters }) !== 0;
    const { quickFilterText } = filters 

    const getJobsByItemIdAndMatchingMilestones = (jobs, nonFilteredMilestones) => {
        const jobsByItemId = _.keyBy(jobs, 'itemId')

        const milestones = nonFilteredMilestones.filter(ms => jobsByItemId[idConverterLib.getJobIdFromMilestoneId(ms.itemId)] && !(ms.itemStatus === constants.job.status.requested && ms.itemData.isRejected));
        jsonLogger.info({ type: "TRACKING", function: "createCsvReport::getJobsByItemIdAndMatchingMilestones", filteredMilestones: milestones });
        return [jobsByItemId, milestones]
    }

    // eslint-disable-next-line no-shadow, max-params
    const queryJobsAndMilestones = async (filterKey, role, companyId, entitiesAdmin, entitiesUser, userId, type, activeFilters, isSeparateQueries, jobsDedicatedFilters, msDedicatedFilters, customFieldFilters) => {
        jsonLogger.info({ type: "TRACKING", function: "createCsvReport::queryJobsAndMilestones", params: { isSeparateQueries, activeFilters, jobsDedicatedFilters, msDedicatedFilters, customFieldFilters } });
        if (!paginateJobs && isSeparateQueries) {
            const { items: jobs } = await jobsByfilterKey(filterKey, role, companyId, entitiesAdmin, entitiesUser, userId, type, { ...activeFilters, ..._.get(customFieldFilters, 'job', {}), ...jobsDedicatedFilters }, constants.prefix.job, undefined, undefined, undefined, undefined, gsiViewDataByCompanyIdAndItemId);
            const { items: nonFilteredMilestones } = await jobsByfilterKey(filterKey, role, companyId, entitiesAdmin, entitiesUser, userId, type, { ...activeFilters, ..._.get(customFieldFilters, 'ms', {}), ...msDedicatedFilters }, constants.prefix.milestone, null, null, null, role !== constants.user.role.admin, gsiViewDataByCompanyIdAndItemId);
            jsonLogger.info({ type: "TRACKING", function: "createCsvReport::queryJobsAndMilestones", params: { jobsSize: _.size(jobs), milestonesSize: _.size(nonFilteredMilestones) } });
            jsonLogger.info({ type: "TRACKING", function: "createCsvReport::queryJobsAndMilestones", nonFilteredMilestones });
            return getJobsByItemIdAndMatchingMilestones(jobs, nonFilteredMilestones);
        }
        const filtersToQuery = paginateJobs ? { ...activeFilters, ..._.get(customFieldFilters, 'job', {}), ...jobsDedicatedFilters } : activeFilters;
        const { items } = await jobsByfilterKey(filterKey, role, companyId, entitiesAdmin, entitiesUser, userId, type, filtersToQuery, paginateJobs ? constants.prefix.job : undefined, undefined, undefined, paginateJobs, undefined, gsiViewDataByCompanyIdAndItemId);
        const [jobs, nonFilteredMilestones] = _.partition(items, (item) => prefixLib.isJob(item.itemId));
        return getJobsByItemIdAndMatchingMilestones(jobs, nonFilteredMilestones);
    }

    let normlizedItems = [];
    let dynamicFilters = {};
    switch (type) {
        case jobListType.jobsPage:
            {
                const [jobsByItemId, milestones] = await queryJobsAndMilestones(filterKey, role, companyId, entitiesAdmin, entitiesUser, userId, type, activeFilters, isSeparateQueries, jobsDedicatedFilters, msDedicatedFilters, customFieldFilters);
                dynamicFilters = msDynamicFilters;
                if (paginateJobs) {
                    normlizedItems = normalizeJobs(Object.values(jobsByItemId), userId, talentIdsNamesKeyValuePairs, filterKey, companyWorkspacesKeyValuePairs, usersByUserId);
                    break;
                }
                normlizedItems = getNormlizedMilestonesForJobsPage(milestones, jobsByItemId, usersByUserId, talentsbyTalentId, customFieldsNames, companyWorkspacesKeyValuePairs, talentIdsNamesKeyValuePairs, lineItemsExist, customFieldsTypes);
                break;
            }
        case jobListType.paymentsPage:
            {
                const [jobsByItemId, milestones] = await queryJobsAndMilestones(filterKey, role, companyId, entitiesAdmin, entitiesUser, userId, type, activeFilters, isSeparateQueries, jobsDedicatedFilters, msDedicatedFilters, customFieldFilters);
                normlizedItems = getNormlizedMilestonesForPaymentsPage(milestones, jobsByItemId, usersByUserId, providersByProviderId, entitiesByEntityId, talentsbyTalentId, legalEntitiesByDepartment, existedRequestedCustomFields, companyWorkspacesKeyValuePairs, talentIdsNamesKeyValuePairs, posByItemId, lineItemsExist, timeReportExist, customFieldsTypes, returnData);
                const customFieldsActiveFilters = createDynamicCustomFieldsFilter(normalizedFilters, returnData);
                dynamicFilters = { ...msDynamicFilters, ...customFieldsActiveFilters };
                break;
            }
        case jobListType.paymentsPageInvoicesData:
            {
                const [jobsByItemId, milestones] = await queryJobsAndMilestones(filterKey, role, companyId, entitiesAdmin, entitiesUser, userId, jobListType.paymentsPage, activeFilters, isSeparateQueries, jobsDedicatedFilters, msDedicatedFilters, customFieldFilters);
                normlizedItems = getNormlizedMilestonesForInvoices(milestones, jobsByItemId, talentsbyTalentId, providersByProviderId, talentIdsNamesKeyValuePairs);
                dynamicFilters = msDynamicFilters;
                break;
            }
        case jobListType.talentDirectoryPage:
            {
                const { talentActiveFilters, talentDynamicFilters } = getTalentActiveFilters(normalizedFilters, dynamicFiltersKeysByType[type]);
                const providers = await queryTalents(companyId, talentActiveFilters);
                const jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, null, jobListType.talentsPage, null);
                const jobs = _.get(jobsResult, 'items');
                if (!jobs) {
                    throw new Error('failed to fetch jobs')
                }
                const enrichedProviders = await enrichTalentsDetails(providers, jobs, companyId, undefined, isCompanyAdmin);
                const [companyProviders, talents] = _.partition(enrichedProviders, talent => prefixLib.isProvider(_.get(talent, 'itemId')))
                const companyProvidersById = _.keyBy(companyProviders, 'itemId');
                const talentsByProviderId = _.groupBy(talents, 'itemData.providerId');
                const providersWithoutTalents = _.filter(companyProviders, provider => !talentsByProviderId[provider.itemId])
                const jobByTalentId = createJobForFreelancer(jobs);
                const activeJobByTalentId = createActiveJobForFreelancer(jobs);
                const normalizedProviders = getNormlizedProvidersForTalentDirectory(companyId, providersWithoutTalents, entitiesByEntityId, providersByProviderId, talentsByProviderId, existedRequestedCustomFields, usersByUserId, customFieldsTypes, returnData);
                const normalizedTalents = getNormlizedTalentsForTalentDirectory(companyId, talents, entitiesByEntityId, jobByTalentId, activeJobByTalentId, companyProvidersById, talentsByProviderId, _.map(customFields, 'id'), usersByUserId, customFieldsTypes, returnData, _.map(talentProfileCustomFields, 'id'), talentProfileCustomFieldsTypes);
                normlizedItems = [...normalizedTalents, ...normalizedProviders];
                const customFieldsActiveFilters = createDynamicCustomFieldsFilter(normalizedFilters, returnData)
                const talentProfileFields = _.get(normalizedFilters, 'talentProfileFields', {});
                dynamicFilters = { ...talentDynamicFilters, ...customFieldsActiveFilters, ...talentProfileFields };
                break;
            }
        default:
            throw new Error('type is not defined')
    }

    jsonLogger.info({ type: "TRACKING", function: "createCsvReport::handler", normlizedItemsSize: normlizedItems.length });
    if (_.size(dynamicFilters) || returnData || quickFilterText) {
        _.set(queryImdbParams, 'activeFilters', dynamicFilters)
        if (_.size(quickFilterText)) {
            _.set(queryImdbParams, 'quickFilterText', quickFilterText)
        }
        const filterStrategies = getNormlizedFilterStrategies(strategies, type)  
        const result = queryImdb([normlizedItems], { ...queryImdbParams, freeTextColumnMapper: freeTextColumnMapper[type], filterStrategies }, { ...columnMapper[type], ...talentProfileFieldsColumnMapper, ...customFieldsColumnMapper });
        if (returnData) {
            return result;
        }
        normlizedItems = _.get(result, 'rows')
    }
    const res = await buildCsvToDownload(fieldsHeaders, normlizedItems, columnsOrder);
    return res;
};

module.exports = {
    createCsv
}
