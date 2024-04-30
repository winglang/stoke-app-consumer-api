/* eslint-disable max-lines */
/* eslint-disable multiline-comment-style */
/* eslint-disable complexity */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-confusing-arrow */
/* eslint-disable max-params */
/* eslint-disable no-undefined */
/* eslint-disable no-magic-numbers */
/* eslint-disable array-element-newline */


'use strict';

const {
    jobsTableName,
    talentsTableName,
    companyProvidersTableName,
    consumerAuthTableName,
    gsiItemsByCompanyIdAndItemIdIndexNameV2,
    gsiViewDataByCompanyIdAndItemId,
    PAGINATION_COMPANY_IDS,
    PAGINATION_TALENT_COMPANY_IDS,
    customersTableName,
    gsiItemsByCompanyIdIndexName,
} = process.env;

const _ = require('lodash');
const { constants, jsonLogger, responseLib, dynamoDbUtils, JobsService, UsersService, idConverterLib, CompanyProvidersService, companyDueDateService, taxFormsHelper, prefixLib, CompaniesService } = require('stoke-app-common-api');
const { queryProjectionExpression } = require('stoke-app-common-api/config/constants');
const { companyProviderFileds, jobListType, jobListFields } = require("./queryAttrs");
const { fetchJobsForMilestones, getTalentsWithOpenJobs, updateProviderStatusToActive, getActionMenuOptions, calculateTotalEarned, enrichApprovers } = require('../helpers/jobHelper');
const { getComplianceInfo } = require('../helpers/complianceHelper');


const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const { getMultiLevelContext, enrichMsWithApprovalOptions, getCompanySettings } = require('../helpers/multiLevelHelper');
const { getSettingsByDepartment } = require('../helpers/settingsHelper');
const { normalizeJobs, normalizeOnboardingData } = require('../helpers/normalizers');
const { buildDedicatedFilters, jobsFiltersData, msFiltersData } = require('../helpers/csvReport/filters');
const { getPayableStatusInfo } = require('stoke-app-common-api/helpers/payableStatusHelper');

const DYNAMIC_FILTERS_SIZE = 10;

const activeStatuses = [
    constants.job.status.active,
    constants.job.status.requested,
    constants.job.status.pendingApproval,
    constants.job.status.secondApproval,
    constants.job.status.budgetRequest,
    constants.job.status.overageBudgetRequest,
];

const createCustomFieldsFilterObject = (filters) => {
    const { customFields } = filters || {};
    const customFiltersObject = {};
    if (customFields) {
        for (const [filter, values] of Object.entries(customFields)) {
            const [contentType, type, key] = filter.split('_');
            const customFieldFilterValue = { value: values, expression: type === 'string' ? 'in' : 'contains', attributeNotExist: values.includes(null) };
            const customFieldKey = `tags.${key}`;
            _.set(customFiltersObject, [contentType, customFieldKey], customFieldFilterValue)
        }
    }
    return customFiltersObject;
}

const getActiveFilters = (filters = {}, dynamicFiltersKeys) => {
    const isListFilter = _.some(_.keys(filters), filter => filter === 'listId');
    const isTalentsFilter = (value) => value.key === dynamicFiltersKeys.talents.key
    const isProviderFilter = (value) => dynamicFiltersKeys.providers && value.key === dynamicFiltersKeys.providers.key
    const dynamicFilters = {}
    if (_.size(dynamicFiltersKeys)) {
        _.forEach(dynamicFiltersKeys, (value) => {
            const filterValues = _.get(filters, value.key);
            if (_.size(filterValues) > DYNAMIC_FILTERS_SIZE || isListFilter || isTalentsFilter(value) || isProviderFilter(value)) {
                dynamicFilters[value.filterKey] = filterValues;
                delete filters[value.key];
            }
        })
    }

    // general filter fields
    const { hiringManagers = [], talents = [], workspaces = [] } = filters || {};

    const hiringManagerFilter = hiringManagers.length > 0 ? { userId: hiringManagers } : {};
    const workspacesFilter = workspaces.length > 0 ? { entityId: workspaces } : {};
    const talentsFilter = talents.length > 0 ? { talentId: { value: talents, attributeNotExist: true } } : {};

    // dedicated filter fields
    const jobsDedicatedFilters = buildDedicatedFilters(jobsFiltersData, filters);
    const msDedicatedFilters = buildDedicatedFilters(msFiltersData, filters);

    const activeFilters = { ...hiringManagerFilter, ...workspacesFilter, ...talentsFilter };
    return _.size({ ...activeFilters, ...jobsDedicatedFilters, ...msDedicatedFilters, ...dynamicFilters }) ? { activeFilters, jobsDedicatedFilters, msDedicatedFilters, msDynamicFilters: dynamicFilters } : null;
}

const paymentTypes = {
    tipalti: 'Tipalti',
    payoneer: 'Payoneer'
};

const extractTalentIdFromBidId = (bidId) => bidId && bidId.split(/job_[^_]+_/u).slice(-1)[0];

const fetchBatchCompanyProviders = async (jobs, type) => {
    jsonLogger.info({ type: "TRACKING", function: "jobListAttrs::fetcBatchCompanyProviders", message: "fetching company providers", jobsCount: _.size(jobs) });
    if (_.isEmpty(jobs)) return [];
    const companyId = _.get(jobs, '[0].companyId');
    const talentKeys = _.uniq(jobs.map((job) => job && job.itemData && job.itemData.talentId).filter(Boolean)).map((itemId) => ({ companyId, itemId }));
    const companyProviderKeys = _.chain(talentKeys).
        map((talent) => idConverterLib.getProviderIdFromTalentId(talent.itemId)).
        filter(Boolean).
        map((itemId) => ({ companyId, itemId })).
        value();
    const companyProviders = await dynamoDbUtils.batchGetParallel(companyProvidersTableName, _.unionBy([...talentKeys, ...companyProviderKeys], 'itemId'), type ? companyProviderFileds[type] : undefined);
    jsonLogger.info({ type: "TRACKING", function: "jobListAttrs::fetchBatchCompanyProvidersData", companyProvidersCount: _.size(companyProviders) });
    return companyProviders;
}

const fetchTalentData = async (jobs, type) => {
    jsonLogger.info({ type: "TRACKING", function: "jobListAttrs::fetchTalentData", message: "fetching talents for jobs", jobsCount: _.size(jobs) });
    if (_.isEmpty(jobs)) return [];
    const companyProviders = await fetchBatchCompanyProviders(jobs, type);
    let [providers, talents] = _.partition(companyProviders, (item) => item.itemId.startsWith(constants.prefix.provider))
    providers = _.keyBy(providers, 'itemId');
    talents = talents.map((talent) => ({ ...talent, itemData: { ..._.get(talent, 'itemData'), providerName: _.get(_.get(providers, idConverterLib.getProviderIdFromTalentId(talent.itemId), {}), 'itemData.providerName') } }))
    return talents;
}


const fetchBidsData = async (jobs) => {
    jsonLogger.info({ type: "TRACKING", function: "jobListAttrs::fetchBidsData", message: "fetching bids for jobs", jobsCount: _.size(jobs) });
    const bidIds = _.uniq(_.flatten(jobs.
        filter((job) => job.itemStatus === constants.job.status.pending && job.itemData && job.itemData.bids && Array.isArray(job.itemData.bids.values)).
        map((job) => job.itemData.bids.values)));
    let talentKeys = bidIds.
        map((bidId) => extractTalentIdFromBidId(bidId)).
        map((talentId) => ({ itemId: talentId }));
    talentKeys = _.uniqBy(talentKeys, "itemId");
    const bids = await dynamoDbUtils.batchGetParallel(talentsTableName, talentKeys, [
        constants.attributeNames.defaultAttributes.itemId,
        `${constants.attributeNames.defaultAttributes.itemData}.${queryProjectionExpression.bid.img}`,
        `${constants.attributeNames.defaultAttributes.itemData}.${queryProjectionExpression.bid.name}`,
        `${constants.attributeNames.defaultAttributes.itemData}.${queryProjectionExpression.bid.firstName}`,
        `${constants.attributeNames.defaultAttributes.itemData}.${queryProjectionExpression.bid.lastName}`
    ]);
    jsonLogger.info({ type: "TRACKING", function: "jobListAttrs::fetchBidsData", message: "fetched bids", bidsCount: bids.length });
    return bids;
}

const enrichMilestonesApprovalOptions = async (items, userId, entitiesAdmin, companyId, settingTypes = [constants.MULTI_LEVEL_SETTINGS.multiLevelApproval]) => {
    const companySettings = await getCompanySettings(companyId);
    const settingsByEntity = await getSettingsByDepartment(companyId);
    const isCompanyAdmin = _.find(entitiesAdmin, (entity) => entity.entityId === companyId);
    const isMultiLevelContextRequired = settingTypes.includes(constants.MULTI_LEVEL_SETTINGS.multiLevelApproval)
    return _.map(items, (item) => enrichMsWithApprovalOptions(
        item,
        isMultiLevelContextRequired && getMultiLevelContext(item, companySettings, settingsByEntity[`${constants.prefix.entity}${item.entityId}`]),
        userId,
        _.find(entitiesAdmin, (entity) => entity.entityId === item.entityId),
        isCompanyAdmin,
        settingTypes,
    ));
}

const getPaymentCycle = (milestone, currentPaymentCycle) => {
    const { itemStatus, itemData } = milestone || {};
    const paymentStatus = _.get(itemData, 'payment.status');

    if (activeStatuses.includes(itemStatus) || paymentStatus === constants.payment.status.pendingPO) {
        return {};
    }
    const pendingDate = _.get(itemData, 'payment.PendingDate');
    const dueDate = _.get(itemData, 'payment.dueDate');
    const endOfToday = new Date().setUTCHours(23, 59, 59, 999);
    if (paymentStatus === constants.payment.status.pendingFunds) {
        return { paymentCycle: currentPaymentCycle };
    } else if (pendingDate > dueDate) {
        // if milestone payment was delayed we don't want to generate additional filter option, and milestone will be filtered according to the pending date.
        return { paymentCycle: pendingDate };
    } else if (dueDate > endOfToday) {
        // if dueDate is in the future the milestone is part of currectPayment cycle
        return { paymentCycle: currentPaymentCycle };
    }
    return { paymentCycle: Math.min(dueDate, currentPaymentCycle) };
}

const enrichMilestonesPaymentCycles = async (milestones, companyId) => {
    const settings = await getCompanySettings(companyId);
    const paymentCycles = companyDueDateService.getPaymentCyclesByVersion(settings);
    const enrichedMilestones = _.map(milestones, ms => {
        const { paymentCycle } = getPaymentCycle(ms, _.last(paymentCycles));
        return {
            ...ms,
            paymentCycle,
        };
    });

    return { paymentCycles, enrichedMilestones };
}

const fetchJobs = async (role, companyId, entitiesAdmin, entitiesUser, userId, prefix, type, filters, isPagination, exclusiveStartKey, addJobs, filterKey, itemStatuses, indexName) => {
    const projectionExpression = _.cloneDeep(jobListFields[type]);
    if (indexName === gsiViewDataByCompanyIdAndItemId) {
        projectionExpression.push(constants.queryProjectionExpression.job.viewData)
        projectionExpression.push(constants.attributeNames.purchaseOrderAttributes.poItemId)
    }
    if (type) {
        jobsService.setProjectionExpression(projectionExpression);
    }
    // eslint-disable-next-line prefer-const
    let { lastEvaluatedKey, items } = await jobsService.jobsPagingtion('listByCompanyIdWithFilter', undefined, [indexName || gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, prefixLib.isTemplate(prefix) ? null : userId, prefix, itemStatuses, filters, role, entitiesAdmin, entitiesUser], exclusiveStartKey ? JSON.parse(exclusiveStartKey) : null, (index, numberOfItems) => !isPagination || index < 2 || numberOfItems < 200);

    if (!items) {
        jsonLogger.error({ type: "TRACKING", function: "jobListAttrs::fetchJobs", message: 'error to get jobs' });
        return null;
    }
    let jobs = [];
    if (addJobs) {
        jobs = await fetchJobsForMilestones(items);
    } else if (!prefixLib.isJob(prefix)) {
        [jobs, items] = _.partition(items, (item) => item.itemId.startsWith(constants.prefix.job));
        if (isPagination && role !== constants.user.role.admin) {
            const jobsByKey = _.keyBy(jobs, 'itemId')
            const missingJobs = await fetchJobsForMilestones(items, jobsByKey);
            jobs = [...jobs, ...missingJobs]
        }
    }

    if (_.size(items)) {
        if (prefixLib.isJob(prefix)) {
            ({ jobs } = await usersService.filterJobsByUserTeams(userId, jobs, jobs));
        } else {
            ({ items, jobs } = await usersService.filterJobsByUserTeams(userId, items, jobs));
        }
    }

    let paymentCycles = {};
    if (filterKey === constants.jobsFilters.pendingApproval.key) {
        items = await enrichMilestonesApprovalOptions(items, userId, entitiesAdmin, companyId, [constants.MULTI_LEVEL_SETTINGS.multiLevelApproval]);
        items = await enrichApprovers(items, companyId)
    } else if (filterKey === constants.jobsFilters.jobRequests.key) {
        items = await enrichMilestonesApprovalOptions(items, userId, entitiesAdmin, companyId, [constants.MULTI_LEVEL_SETTINGS.jobRequestApproval]);
    } else if ([jobListType.paymentsPage, jobListType.fundingPage].includes(filterKey)) {
        const milestonesWithPaymentInfo = await enrichMilestonesPaymentCycles(items, companyId);
        items = milestonesWithPaymentInfo.enrichedMilestones;
        // eslint-disable-next-line prefer-destructuring
        paymentCycles = milestonesWithPaymentInfo.paymentCycles;
    } else if (filterKey === constants.jobsFilters.budgetRequests.key) {
        items = await enrichApprovers(items, companyId)
    }
    items = [...jobs, ...items];
    if (!items) {
        jsonLogger.error({ type: "TRACKING", function: "jobListAttrs::fetchJobs", message: 'error to get jobs' });
        return null;
    }

    return { items, lastEvaluatedKey, paymentCycles };

}

const getPaymentMethod = (talentEarnedMilestones) => _.chain(talentEarnedMilestones).
    map((milestone) => {
        const paymentMethod = _.get(milestone, 'itemData.payment.name')
        return paymentMethod === paymentTypes.tipalti
            ? _.get(milestone, 'itemData.payment.feeData.transactionFee.type')
            : paymentMethod
    }).
    filter(Boolean).
    uniq().
    value()

const enrichResponse = (items, milestonesPerItem, talentsWithJobs, talentsPerProviderEnriched, settings, companyProviders, isCompanyAdmin) => _.map(items, (item) => {
    const { itemId } = item;
    const earnedMilestones = _.filter(milestonesPerItem[itemId], (ms) => [constants.job.status.completed, constants.job.status.paid].includes(ms.itemStatus));
    const totalEarned = calculateTotalEarned(earnedMilestones);
    const activeMilestonesCount = _.size(_.filter(milestonesPerItem[itemId], (ms) => activeStatuses.includes(ms.itemStatus)));
    const lastPaidMilestone = _.maxBy(
        earnedMilestones,
        (milestone) => _.get(milestone, 'itemData.payment.dueDate', 0)
    );
    const lastPaymentDate = _.get(lastPaidMilestone, 'itemData.payment.dueDate', 0);
    const paymentMethod = getPaymentMethod(earnedMilestones);

    item[constants.attributeNames.defaultAttributes.itemStatus] = updateProviderStatusToActive(talentsWithJobs, _.get(item, 'itemStatus'), itemId)

    // eslint-disable-next-line no-undef-init
    let allowedActions = undefined
    // eslint-disable-next-line no-undef-init
    let complianceInfo = undefined
    // eslint-disable-next-line no-undef-init
    let payableStatus = undefined
    if (talentsWithJobs) {
        const itemForComplianceScore =
            _.get(item, 'itemData.isProviderSelfEmployedTalent') && !prefixLib.isProvider(_.get(item, 'itemId', ''))
                ? _.find(items, (currentItem) => currentItem.itemId === idConverterLib.getProviderIdFromTalentId(item.itemId))
                : item

        const isTalentUnderCompany = !_.get(item, 'itemData.isProviderSelfEmployedTalent') && prefixLib.isTalent(itemId);
        const additionalSource = isTalentUnderCompany && _.find(companyProviders ? companyProviders : items, (currentItem) => currentItem.itemId === idConverterLib.getProviderIdFromTalentId(itemId));
        const talentsUnderCurrentProviderEnriched = _.get(talentsPerProviderEnriched, itemId, [])
        const talentsProvider = _.get(item, 'itemData.isProviderSelfEmployedTalent') && prefixLib.isTalent(itemId) && _.find(items, (currentItem) => currentItem.itemId === idConverterLib.getProviderIdFromTalentId(itemId));
        const providerSource = additionalSource ? additionalSource : talentsProvider;
        complianceInfo = getComplianceInfo(itemForComplianceScore, talentsUnderCurrentProviderEnriched)
        allowedActions = getActionMenuOptions(item, talentsWithJobs, itemId, settings, itemForComplianceScore, isCompanyAdmin, additionalSource);
        payableStatus = getPayableStatusInfo(providerSource ? providerSource : item, settings);
    }

    return {
        ...item,
        totalEarned,
        paymentMethod,
        activeMilestonesCount,
        allowedActions,
        complianceInfo,
        payableStatus,
        // eslint-disable-next-line no-extra-parens
        ...(lastPaymentDate > 0 ? { lastPaymentDate } : {}),
    };
});

const normalizeTalentsTags = (talents) => {
    _.forEach(talents, (talent) => {
        _.forEach(_.get(talent, 'tags'), (tag, key) => {
            if (typeof tag === 'string') {
                const value = tag.replace(/\n/gu, " ");
                talent.tags[key] = value;
            }
        })
    })
    return talents;
}

const enrichTalentsDetails = async (talents, allJobItems, companyId, enrichOnlyTalents = false, isCompanyAdmin) => {
    const [allJobs, allMilestones] = _.partition(allJobItems, (item) => item.itemId.startsWith(constants.prefix.job));
    const jobs = _.filter(allJobs, (job) => _.get(job, 'itemData.talentId'));
    const jobsPerTalent = _.chain(jobs).
        groupBy('itemData.talentId').
        mapValues((talentJobs) => _.map(talentJobs, 'itemId')).
        value();
    const jobToTalentMap = _.chain(jobs).
        keyBy('itemId').
        mapValues('itemData.talentId').
        value();

    const talentToMilestonesMap = _.reduce(allMilestones, (acc, milestone) => {
        const talent = jobToTalentMap[idConverterLib.getJobIdFromMilestoneId(milestone.itemId)];
        if (acc[talent]) {
            acc[talent] = [
                ...acc[talent],
                milestone
            ];
        } else {
            acc[talent] = [milestone];
        }
        return acc;
    }, {});

    const talentsWithJobs = await getTalentsWithOpenJobs(companyId)
    jsonLogger.info({ type: "TRACKING", function: "jobListAttrs::enrichTalentsDetails", jobsPerTalent });
    const [companyProviders, talentsUnderProvider] = _.partition(
        talents,
        talent => !_.get(talent, 'itemData.isProviderSelfEmployedTalent') && prefixLib.isProvider(_.get(talent, 'itemId'))
    )
    const settings = await getCompanySettings(companyId);
    const talentsUnderProviderEnriched = enrichResponse(talentsUnderProvider, talentToMilestonesMap, talentsWithJobs, undefined, settings, companyProviders, isCompanyAdmin);
    if (enrichOnlyTalents) {
        return talentsUnderProviderEnriched
    }
    const talentsPerProviderEnrichedFiltered = _.groupBy(
        _.filter(talentsUnderProviderEnriched, talent => idConverterLib.getProviderIdFromTalentId(talent.itemId)),
        talent => idConverterLib.getProviderIdFromTalentId(talent.itemId)
    )
    const companyProvidersEnriched = enrichResponse(companyProviders, talentToMilestonesMap, talentsWithJobs, talentsPerProviderEnrichedFiltered, settings, undefined, isCompanyAdmin);
    return _.concat(talentsUnderProviderEnriched, companyProvidersEnriched);
}

const enrichJobDetails = (allItems, isCompanyAdmin) => {
    const [allJobs, allMilestones] = _.partition(allItems, (item) => item.itemId.startsWith(constants.prefix.job));
    const milestonesPerJob = _.groupBy(allMilestones, (milestone) => idConverterLib.getJobIdFromMilestoneId(milestone.itemId))
    return enrichResponse(allJobs, milestonesPerJob, undefined, undefined, undefined, undefined, isCompanyAdmin);
}

const filterActiveJobs = (jobsResult) => {
    const { items, lastEvaluatedKey } = jobsResult;
    const [jobs, milestones] = _.partition(items, (item) => item.itemId.startsWith(constants.prefix.job));

    const jobsByItemId = _.keyBy(jobs, 'itemId');
    const filteredMilestones = _.filter(milestones, (ms) => {
        const job = _.get(jobsByItemId, idConverterLib.getJobIdFromMilestoneId(ms.itemId));
        return !job || job.itemStatus === constants.job.status.active
    })
    return { items: [..._.filter(jobs, (job) => job.itemStatus === constants.job.status.active), ...filteredMilestones], lastEvaluatedKey }
}

const jobsByfilterKey = async (filterKey, role, companyId, entitiesAdmin, entitiesUser, userId, type, filters = {}, customFieldsFilterType, isPagination, lastEvaluatedKey, paginate, addJobsFlag, indexName) => {
    const activeFilters = _.isEmpty(filters) ? null : filters;
    jsonLogger.info({ type: "TRACKING", function: "jobListAttrs::jobsByfilterKey", filterKey, companyId, activeFilters });
    let jobsResult = {};
    switch (filterKey) {
        case constants.jobsFilters.pendingApproval.key:
            jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, constants.prefix.milestone, type, { itemStatus: constants.jobsFilters[filterKey].options, ...filters }, isPagination, lastEvaluatedKey, true, filterKey, undefined, indexName);
            break;
        case constants.jobsFilters.jobRequests.key:
        case constants.jobsFilters.budgetRequests.key:
            jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, null, type, { itemStatus: constants.jobsFilters[filterKey].options, ...filters }, isPagination, lastEvaluatedKey, true, filterKey, undefined, indexName);
            break;
        case constants.jobsFilters.posted.key:
        case constants.jobsFilters.drafts.key:
            jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, null, type, { itemStatus: constants.jobsFilters[filterKey].options, ...filters }, isPagination, lastEvaluatedKey, undefined, undefined, undefined, indexName);
            break;
        case constants.jobsFilters.templates.key:
            {
                if (type) {
                    jobsService.setProjectionExpression(jobListFields[type]);
                }
                jobsResult.items = await jobsService.listByCompanyIdWithFilter(gsiItemsByCompanyIdAndItemIdIndexNameV2, constants.jobsTemplateIds.companyId, null, constants.prefix.template, null, activeFilters);
                break;
            }
        case constants.jobsFilters.active.key:
            {
                if (paginate) {
                    jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, constants.prefix.job, type, activeFilters, isPagination, lastEvaluatedKey, undefined, undefined, [constants.job.status.active], gsiViewDataByCompanyIdAndItemId);
                } else if (customFieldsFilterType) {
                    jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, customFieldsFilterType, type, activeFilters, isPagination, lastEvaluatedKey, undefined, undefined, undefined, indexName);
                } else {
                    jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, null, type, activeFilters, isPagination, lastEvaluatedKey, undefined, undefined, undefined, indexName);
                    jobsResult = filterActiveJobs(jobsResult);
                }
                break;
            }
        default:
            {
                jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, customFieldsFilterType, type, activeFilters, isPagination, lastEvaluatedKey, addJobsFlag, filterKey, undefined, indexName);
                break;
            }
    }
    return jobsResult;
}

const enrichTalentDetailsWithHasUpToDateTaxFormAttribute = (talents) => talents.map((talent) => {
    const hasUpToDateTaxForm = _.get(taxFormsHelper.isThisProviderHaveAnExemptTaxFile(talent, true), 'taxFormStatus', false);
    return _.set(talent, 'itemData.hasUpToDateTaxForm', hasUpToDateTaxForm)
});

// eslint-disable-next-line max-lines-per-function
const handler = async (event) => {
    jsonLogger.info({ type: "TRACKING", function: "jobListAttrs::handler", event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { queryStringParameters } = event;
    const { companyId, type, filters, lastEvaluatedKey, filterKey, paginate } = queryStringParameters || {};
    const paginationCompanyList = PAGINATION_COMPANY_IDS ? PAGINATION_COMPANY_IDS.split(',').map((item) => item.trim()) : [];
    const paginationCompanyTalentList = PAGINATION_TALENT_COMPANY_IDS ? PAGINATION_TALENT_COMPANY_IDS.split(',').map((item) => item.trim()) : [];
    const isPagination = paginationCompanyList.includes(companyId);
    const isPaginationTalent = paginationCompanyTalentList.includes(companyId);
    jsonLogger.info({ type: "TRACKING", function: "jobListAttrs::handler", filters, lastEvaluatedKey, isPagination, filterKey });
    if (!companyId || !jobListType[type]) {
        const message = "missing required params";
        jsonLogger.error({ type: "TRACKING", function: "jobListAttrs::handler", message });
        return responseLib.failure({ status: false, message });
    }

    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(userId, companyId);
    if (role === constants.user.role.unauthorised) {
        return responseLib.forbidden();
    }
    const isCompanyAdmin = constants.user.role.admin === role;
    const settings = await getCompanySettings(companyId);
    const isActiveTalentNoJobsMode = _.get(settings, 'itemData.isActiveTalentNoJobsMode');
    const result = {};
    let jobsResult = null;
    companyProvidersService.setProjectionExpression(companyProviderFileds[type]);
    const { activeFilters: generalFilters, jobsDedicatedFilters: jobsSpecificFilters, msDedicatedFilters: msSpecificFilters } = getActiveFilters(filters) || {};
    let activeFilters = { ...generalFilters, ...jobsSpecificFilters, ...msSpecificFilters };
    activeFilters = _.size(activeFilters) ? activeFilters : null;

    switch (type) {
        case jobListType.jobsPage:
            if (filterKey) {
                jobsResult = await jobsByfilterKey(filterKey, role, companyId, entitiesAdmin, entitiesUser, userId, type, activeFilters, null, isPagination, lastEvaluatedKey, paginate)
            } else {
                jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, null, type, activeFilters, isPagination, lastEvaluatedKey);
            }

            result.jobs = _.get(jobsResult, 'items');
            result.lastEvaluatedKey = _.get(jobsResult, 'lastEvaluatedKey');
            if (!result.jobs) {
                return responseLib.failure({ status: false });
            }
            result.talents = await fetchTalentData(result.jobs, type);
            result.bids = await fetchBidsData(result.jobs);

            if (paginate) {
                const talentIdsNamesKeyValuePairs = _.mapValues(_.keyBy(result.talents, 'itemId'), (talent) => _.get(talent, 'itemData.name') || `${_.get(talent, 'itemData.firstName')} ${_.get(talent, 'itemData.lastName')}`.trim());
                result.jobs = normalizeJobs(result.jobs, userId, talentIdsNamesKeyValuePairs, filterKey);
            }

            break;
        case jobListType.templatePage:
            if (filterKey) {
                jobsResult = await jobsByfilterKey(filterKey, role, companyId, entitiesAdmin, entitiesUser, userId, type, activeFilters, {}, isPagination, lastEvaluatedKey)
            }

            result.jobs = _.get(jobsResult, 'items');
            if (!result.jobs) {
                return responseLib.failure({ status: false });
            }
            break;
        case jobListType.templateCenter:
            jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, constants.prefix.template, type);
            result.jobs = _.get(jobsResult, 'items');
            if (!result.jobs) {
                return responseLib.failure({ status: false });
            }
            break;
        case jobListType.paymentsPage:
            jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, null, type, activeFilters, isPagination, lastEvaluatedKey, undefined, jobListType.paymentsPage);
            result.jobs = _.get(jobsResult, 'items');
            result.lastEvaluatedKey = _.get(jobsResult, 'lastEvaluatedKey');
            result.paymentCycles = _.get(jobsResult, 'paymentCycles')
            if (!result.jobs) {
                return responseLib.failure({ status: false });
            }
            result.talents = await fetchBatchCompanyProviders(result.jobs, type)
            if (!result.talents) {
                return responseLib.failure({ status: false });
            }
            break;
        case jobListType.fundingPage:
            jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, null, type, activeFilters, false, lastEvaluatedKey, undefined, jobListType.fundingPage);
            result.paymentCycles = _.get(jobsResult, 'paymentCycles')
            break;
        case jobListType.talentsPage:
            // eslint-disable-next-line no-case-declarations
            const talentResult = await companyProvidersService.companyProvidersPagination('listCompany', [companyId, undefined, undefined, undefined], lastEvaluatedKey ? JSON.parse(lastEvaluatedKey) : null, (index, numberOfItems) => !isPaginationTalent || index < 2 || numberOfItems < 200);
            // eslint-disable-next-line no-case-declarations
            let talents = _.get(talentResult, 'items');
            result.lastEvaluatedKey = _.get(talentResult, 'lastEvaluatedKey');

            if (!talents) {
                return responseLib.failure({ status: false });
            }

            talents = normalizeTalentsTags(talents);
            talents = enrichTalentDetailsWithHasUpToDateTaxFormAttribute(talents);
            jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, null, type, null);
            // eslint-disable-next-line no-case-declarations
            const jobs = _.get(jobsResult, 'items');
            if (!jobs) {
                return responseLib.failure({ status: false });
            }
            result.jobs = isActiveTalentNoJobsMode ? [] : enrichJobDetails(jobs, isCompanyAdmin);
            result.talents = await enrichTalentsDetails(talents, jobs, companyId, undefined, isCompanyAdmin);
            break;
        case jobListType.budgetPage:
            jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, constants.prefix.milestone, type, { itemStatus: [constants.job.status.budgetRequest, constants.job.status.overageBudgetRequest] }, false, null, true);

            result.jobs = _.get(jobsResult, 'items');
            if (!result.jobs) {
                return responseLib.failure({ status: false });
            }

            break;
        case jobListType.onboardingPage:
            // eslint-disable-next-line no-case-declarations
            let companyTalents = await companyProvidersService.companyProvidersPagination('listCompany', [companyId, undefined, undefined, undefined]);
            if (!companyTalents) {
                return responseLib.failure({ status: false });
            }
            companyTalents = await enrichTalentsDetails(companyTalents, [], companyId, undefined, isCompanyAdmin);
            // eslint-disable-next-line no-case-declarations
            const users = await companiesService.list(gsiItemsByCompanyIdIndexName, companyId, constants.prefix.userPoolId, {}, undefined, {});
            result.onboardingSummary = await normalizeOnboardingData(companyTalents, companyId, users, userId)

            break;


        default:
            return responseLib.failure({ status: false });
    }

    return responseLib.success(result);
};

module.exports = {
    handler,
    fetchJobs,
    fetchBidsData,
    fetchTalentData,
    enrichTalentDetailsWithHasUpToDateTaxFormAttribute,
    jobsByfilterKey,
    getActiveFilters,
    createCustomFieldsFilterObject,
    fetchBatchCompanyProviders,
    enrichTalentsDetails,
}


