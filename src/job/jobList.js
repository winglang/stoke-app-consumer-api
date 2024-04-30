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
    gsiUsersByEntityIdIndexName,
} = process.env;

const _ = require('lodash');
const { constants, jsonLogger, responseLib, dynamoDbUtils, JobsService, UsersService, idConverterLib } = require('stoke-app-common-api');

const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsServiceWithPos = new JobsService(jobsTableName, [...constants.projectionExpression.defaultAndTagsAttributes, 'poItemId'], constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const { isStatusForApproval, getCompanySettings, enrichMsWithApprovalOptions, getMultiLevelContext } = require('../helpers/multiLevelHelper');
const { enrichMilestonesWithPOitemNumber } = require('../helpers/purchaseOrderHelper');
const { getSettingsByDepartment } = require('../helpers/settingsHelper');

const extractTalentIdFromBidId = (bidId) => bidId && bidId.split(/job_[^_]+_/u).slice(-1)[0];

const fetchCompanyProvidersData = async (companyId, talentKeys) => {
    const companyProviderKeys = _.chain(talentKeys).
        map((talent) => idConverterLib.getProviderIdFromTalentId(talent.itemId)).
        filter(Boolean).
        uniq().
        map((itemId) => ({ companyId, itemId })).
        value();
    const companyProviders = await dynamoDbUtils.batchGetParallel(companyProvidersTableName, companyProviderKeys);
    jsonLogger.info({ type: "TRACKING", function: "jobList::fetchCompanyProvidersData", companyProvidersCount: _.size(companyProviders) });
    return companyProviders;
}

const assignProviderNameToTalents = (talents, companyProviders) => {
    const companyProvidersMap = _.keyBy(companyProviders, 'itemId');
    for (const talent of talents) {
        const companyProvider = companyProvidersMap[idConverterLib.getProviderIdFromTalentId(talent.itemId)];
        const isProviderSelfEmployedTalent = _.get(companyProvider, 'itemData.isProviderSelfEmployedTalent');
        if (companyProvider && !isProviderSelfEmployedTalent) {
            talent.itemData.providerName = companyProvider.itemData.providerName;
        }
    }
};

const fetchTalentData = async (jobs) => {
    jsonLogger.info({ type: "TRACKING", function: "jobs::fetchTalentData", message: "fetching talents for jobs", jobsCount: _.size(jobs) });
    if (_.isEmpty(jobs)) return [];

    const talentKeys = _.uniq(jobs.map((job) => job.itemData && job.itemData.talentId).filter(Boolean)).map((itemId) => ({ itemId }));
    const talents = await dynamoDbUtils.batchGetParallel(talentsTableName, talentKeys);
    jsonLogger.info({ type: "TRACKING", function: "jobs::fetchTalentData", message: "fetched talents", talentsCount: talents.length });

    const companyId = _.get(jobs, '[0].companyId');
    const companyProviders = await fetchCompanyProvidersData(companyId, talentKeys);
    assignProviderNameToTalents(talents, companyProviders);

    return talents.map((talent) => _.pick(talent, [
        'itemId',
        'itemData.img',
        'itemData.name',
        'itemData.firstName',
        'itemData.lastName',
        'itemData.providerName',
    ]));
}

const fetchBidsData = async (jobs, entityId) => {
    jsonLogger.info({ type: "TRACKING", function: "jobs::fetchBidsData", message: "fetching bids for jobs", jobsCount: _.size(jobs), entityId });
    const bidIds = _.uniq(_.flatten(jobs.
        filter((job) => job.itemStatus === constants.job.status.pending && job.itemData && job.itemData.bids && Array.isArray(job.itemData.bids.values)).
        map((job) => job.itemData.bids.values)));
    let talentKeys = bidIds.
        map((bidId) => extractTalentIdFromBidId(bidId)).
        map((talentId) => ({ itemId: talentId }));
    talentKeys = _.uniqBy(talentKeys, "itemId");
    const bids = await dynamoDbUtils.batchGetParallel(talentsTableName, talentKeys);
    jsonLogger.info({ type: "TRACKING", function: "jobs::fetchBidsData", message: "fetched bids", bidsCount: bids.length });
    return bids.map((bid) => _.pick(bid, [
        'itemId',
        'itemData.img'
    ]));
}

const fetchJobsForMilestones = async (milestones) => {
    let jobKeys = milestones.filter((mlstn) => mlstn.itemData && mlstn.itemData.jobId).map((mlstn) => ({
        itemId: mlstn.itemData.jobId,
        entityId: mlstn.entityId
    }));
    jobKeys = _.uniqBy(jobKeys, "itemId");
    jsonLogger.info({ type: "TRACKING", function: "jobs::fetchJobsByIds", message: "fetching jobs by ids" });
    const jobs = await dynamoDbUtils.batchGetParallel(jobsTableName, jobKeys, constants.projectionExpression.defaultAndTagsAttributes);
    jsonLogger.info({ type: "TRACKING", function: "jobs::fetchJobsByIds", message: "fetched jobs", jobsCount: jobs.length });
    return jobs;
}

const addApprovalOptionsToMSs = async (items, userId, isEntityAdmin, entityId) => {
    const companyId = _.get(items, [0, 'companyId']);
    const companySettings = await getCompanySettings(companyId);
    const settingsByEntity = await getSettingsByDepartment(companyId);
    const roleInCompany = await usersService.getUserAuthRole(userId, companyId);
    const isCompanyAdmin = roleInCompany === constants.user.role.admin;
    // eslint-disable-next-line no-confusing-arrow
    const itemsWithApproveOptions = _.map(items, (item) => enrichMsWithApprovalOptions(
        item,
        getMultiLevelContext(item, companySettings, settingsByEntity[`${constants.prefix.entity}${entityId}`]),
        userId,
        isEntityAdmin,
        isCompanyAdmin,
        [constants.MULTI_LEVEL_SETTINGS.multiLevelApproval, constants.MULTI_LEVEL_SETTINGS.jobRequestApproval]
    ));
    return itemsWithApproveOptions;
}

const getCompanyJobs = async (userId, companyId, prefix, itemStatus) => {
    jsonLogger.info({ type: "TRACKING", function: "jobList::getCompanyJobs", userId, companyId, prefix, itemStatus });
    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(userId, companyId);
    if (role === constants.user.role.unauthorised) {
        return null;
    }

    const isCompanyAdmin = role === constants.user.role.admin;
    const items = isCompanyAdmin
        ? await jobsService.jobsPagingtion('listByCompanyId', undefined, [gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, null, prefix, itemStatus])
        : await jobsService.jobsPagingtion('listGlobal', undefined, [gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, entitiesAdmin, entitiesUser, userId, prefix, itemStatus]);

    jsonLogger.info({ type: "TRACKING", function: "jobList::getCompanyJobs", size: _.size(items) });
    return items;
};

const getEntityJobs = async (userId, entityId, prefix, itemStatus, jobId) => {
    jsonLogger.info({ type: "TRACKING", function: "jobList::getEntityJobs", userId, entityId, prefix, itemStatus, jobId });
    const roleEntity = await usersService.getUserAuthRole(userId, entityId);
    if (roleEntity === constants.user.role.unauthorised) {
        return null;
    }

    const isEntityAdmin = roleEntity === constants.user.role.admin;
    const userIdFilter = isEntityAdmin ? null : userId;
    const prefixFilter = jobId ? `${constants.prefix.milestone}${jobId}` : prefix;
    jsonLogger.info({ type: "TRACKING", function: "jobList::getEntityJobs", entityId, userIdFilter, prefixFilter });
    let items = await jobsServiceWithPos.jobsPagingtion('list', undefined, [entityId, userIdFilter, prefixFilter, itemStatus]);
    items = await enrichMilestonesWithPOitemNumber(items, gsiItemsByCompanyIdAndItemIdIndexNameV2);

    const isMilestonesToApprove = _.some(items, (item) => isStatusForApproval(item.itemStatus))
    let response = items;
    if (isMilestonesToApprove) {
        response = await addApprovalOptionsToMSs(items, userId, isEntityAdmin, entityId);
    }

    jsonLogger.info({ type: "TRACKING", function: "jobList::getEntityJobs", size: _.size(response) });
    return response;
};

const calculateJobtotalCost = async (jobs) => {
    for (const job of jobs) {
        // eslint-disable-next-line no-await-in-loop
        const milestones = await jobsService.list(job.entityId, null, `${constants.prefix.milestone}${job.itemId}`);
        const totalBudget = _.reduce(
            milestones,
            (acc, milestone) => acc + _.get(milestone, 'itemData.actualCost', _.get(milestone, 'itemData.cost', 0)),
            0
        );
        job.itemData.totalBudget = totalBudget;
    }
    return jobs;
}

const fetchApprovers = async (jobs, companyId) => {
    const departmentIds = _.uniq(_.map(jobs, 'entityId'));
    jsonLogger.info({ type: "TRACKING", function: "jobList::fetchApprovers", companyId, departmentIds });
    const approvers = {};
    for (const departmentId of departmentIds) {
        // eslint-disable-next-line no-await-in-loop
        approvers[departmentId] = await usersService.listApprovers(gsiUsersByEntityIdIndexName, companyId, departmentId);
    }
    return approvers;
}

// eslint-disable-next-line max-lines-per-function
const handler = async (event) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { queryStringParameters, multiValueQueryStringParameters } = event;
    const { companyId, entityId, jobId, prefix, isFetchTalentData, isFetchBidsData, isAppendJobs, isCalculateTotalBudget, isFetchApprovers, talentId } = queryStringParameters || {};
    const { itemStatus } = multiValueQueryStringParameters || {};
    jsonLogger.info({ type: "TRACKING", function: "jobList::handler", userId, entityId, companyId, jobId, itemStatus, prefix, isFetchTalentData, isFetchBidsData, isFetchApprovers, event });

    const items = companyId
        ? await getCompanyJobs(userId, companyId, prefix, itemStatus)
        : await getEntityJobs(userId, entityId, prefix, itemStatus, jobId);
    
    if (!items) {
        return responseLib.forbidden({ status: false });
    }

    const isMilestonePrefix = prefix && prefix.startsWith(constants.prefix.milestone);
    const jobs = await fetchJobsForMilestones(items);

    const jobsFiltered = await usersService.filterJobsByUserTeams(userId, items, jobs);
    if (!jobsFiltered) {
        return responseLib.failure({ status: false });
    }
    if (talentId) {
        jobsFiltered.jobs = _.filter(jobsFiltered.jobs, (job) => _.get(job, 'itemData.talentId') === talentId)
        const jobKeys = _.keyBy(jobsFiltered.jobs, 'itemId')
        jobsFiltered.items = _.filter(jobsFiltered.items, (ms) => _.get(jobKeys, idConverterLib.getJobIdFromMilestoneId(_.get(ms, 'itemId'), _.get(ms, 'itemData.jobId'))))
    }

    if (isCalculateTotalBudget) {
        // eslint-disable-next-line require-atomic-updates
        jobsFiltered.jobs = await calculateJobtotalCost(jobsFiltered.jobs);
    }

    const result = {};
    // eslint-disable-next-line no-mixed-operators
    result.jobs = isAppendJobs && isMilestonePrefix || talentId
        ? _.concat(jobsFiltered.items, jobsFiltered.jobs)
        : jobsFiltered.items;

    if (isFetchTalentData) {
        result.talents = await fetchTalentData(result.jobs);
    }

    if (isFetchBidsData) {
        result.bids = await fetchBidsData(result.jobs, entityId);
    }

    if (isFetchApprovers && companyId) {
        result.approvers = await fetchApprovers(result.jobs, companyId);
    }

    return responseLib.success(result);
};

module.exports = {
    handler,
}
