/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
/* eslint-disable max-params */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undefined */
/* eslint-disable array-element-newline */

'use strict';

const {
    jobsTableName,
    consumerAuthTableName,
    gsiItemsByCompanyIdAndItemIdIndexNameV2,
    gsiItemsByCompanyIdAndTalentId,
    gsiItemsByCompanyIdIndexName,
    gsiViewDataByCompanyIdAndItemId,
    bidsTableName,
    companyProvidersTableName,
} = process.env;

const _ = require('lodash');
const { constants, jsonLogger, JobsService, UsersService, BidsService, CandidatesService, dynamoDbUtils, idConverterLib, prefixLib, settingsGetterHelper } = require('stoke-app-common-api');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');

const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsServiceTalentId = new JobsService(jobsTableName, [constants.attributeNames.defaultAttributes.companyId, constants.attributeNames.defaultAttributes.itemStatus, constants.attributeNames.defaultAttributes.talentId]);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const bidsService = new BidsService(bidsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const candidatesService = new CandidatesService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const ACTION_MENU_OPTIONS = {
    cancelInvitation: 'cancelInvitation',
    removeTalent: 'removeTalent',
    deactivate: 'deactivate',
    startJob: 'startJob',
    requestPayment: 'requestPayment', // submit payment
    toggleIgnoreWorkforceComplianceBlock: 'toggleIgnoreWorkforceComplianceBlock',
};

const ACTION_WARNINGS = {
    notCompliantTalent: 'notCompliantTalent',
    ignoredNotCompliantTalent: 'ignoredNotCompliantTalent',
    legalNotCompliantTalent: 'legalNotCompliantTalent',
};

const ALLOWED_ACTIONS = 'allowedActions';

const getNonFinalizedJobs = (jobs) => _.filter(jobs, (job) => ![...constants.JOB_FINALIZED_STATUSES, constants.job.status.draft].includes(job.itemStatus));

const isNotAllowToEditJob = (role, userId, hiringManagerId) => role !== constants.user.role.admin && hiringManagerId !== userId;

// eslint-disable-next-line max-params
const getJob = async (userId, entityId, jobId, isEditor) => {
    jsonLogger.info({ type: "TRACKING", function: "jobHelper::getJob", userId, entityId, jobId, isEditor });

    if (!userId || !entityId || !jobId) {
        jsonLogger.error({ type: "TRACKING", function: "jobHelper::getJob", message: "missing mandatory params" });
        return false;
    }

    const authorised = await usersService.validateUserEntity(userId, entityId, null, isEditor);
    if (!authorised) {
        return false;
    }

    const job = await jobsService.get(entityId, jobId);
    if (!job) {
        jsonLogger.error({ type: "TRACKING", function: "jobHelper::getJob", message: "job not found", entityId, jobId });
        return false;
    }

    if (isEditor && isNotAllowToEditJob(authorised.itemData.userRole, userId, job.userId)) {
        jsonLogger.error({ type: "TRACKING", function: "jobHelper::getJob", message: "user is not allowed to edit job" });
        return false;
    }

    const teamsAuthorized = await usersService.validateJobByUserTeamsWithComponents(userId, job, { [permissionsComponentsKeys.jobs]: { isEditor } });
    if (!teamsAuthorized) {
        return false;
    }

    return job;
};

const getMilestone = async (userId, entityId, jobId, milestoneId, isWithJob) => {
    jsonLogger.info({ type: "TRACKING", function: "jobHelper::getMilestone", userId, entityId, milestoneId });

    const job = await getJob(userId, entityId, jobId, true)
    if (!job) {
        jsonLogger.error({ type: "TRACKING", function: "jobHelper::getMilestone", message: "the job was not found or the user doesn't have the proper permissions", entityId, jobId, milestoneId });
        return false;
    }

    const milestone = await jobsService.get(entityId, milestoneId);
    if (!milestone) {
        jsonLogger.error({ type: "TRACKING", function: "jobHelper::getMilestone", message: "milestone was not found", entityId, milestoneId });
        return false;
    }

    return isWithJob ? { milestone, job } : milestone;
};

const archiveAllDrafts = async (jobsList) => {
    const jobsToArchive = _.map(jobsList, ({ itemStatus, entityId, itemId }) => itemStatus === constants.job.status.draft && jobsService.archive(entityId, itemId, constants.admin.userId)).filter(Boolean);
    const archivedJobs = await Promise.all(jobsToArchive);
    jsonLogger.info({ type: "TRACKING", function: "jobHelper::archiveAllDrafts", message: 'Archive draft jobs', jobsToArchive: jobsToArchive.length, archivedJobs: archivedJobs.length });
}

const getJobsByHiringManager = async (companyId, entityId, userId) => {
    jsonLogger.info({ type: "TRACKING", function: "jobHelper::getJobsByHiringManager", companyId, entityId, userId });

    if (!companyId && !entityId) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobHelper::getJobsByHiringManager', message: 'Missing action scope' });
        return false;
    }

    if (!userId) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobHelper::getJobsByHiringManager', message: 'Missing mandatory params' });
        return false;
    }

    const jobs = entityId
        ? await jobsService.jobsPagingtion('list', undefined, [entityId, userId, constants.prefix.job, undefined])
        : await jobsService.jobsPagingtion('listByCompanyId', undefined, [gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, userId, constants.prefix.job, undefined]);

    jsonLogger.info({ type: "TRACKING", function: "jobHelper::getJobsByHiringManager", jobs });
    return jobs;
}

const fetchJobsForMilestones = async (milestones, jobsByKey = {}) => {
    let jobKeys = milestones.filter((mlstn) => mlstn.itemId.startsWith(constants.prefix.milestone) && !jobsByKey[idConverterLib.getJobIdFromMilestoneId(mlstn.itemId)]).map((mlstn) => ({
        itemId: idConverterLib.getJobIdFromMilestoneId(mlstn.itemId),
        entityId: mlstn.entityId
    }));
    if (!_.size(jobKeys)) {
        return [];
    }
    jobKeys = _.chain(jobKeys).
        filter((key) => key.itemId && key.entityId).
        uniqBy("itemId").
        value();

    jsonLogger.info({ type: "TRACKING", function: "jobListAttrs::fetchJobsForMilestones", message: "fetching jobs by ids" });
    const jobs = await dynamoDbUtils.batchGetParallel(jobsTableName, jobKeys, constants.projectionExpression.defaultAndTagsAttributes);
    jsonLogger.info({ type: "TRACKING", function: "jobListAttrs::fetchJobsForMilestones", message: "fetched jobs", jobsCount: jobs.length });
    return jobs;
}

const getTalentsForJobs = async (jobs, companyId) => {
    if (!jobs || !Array.isArray(jobs)) {
        jsonLogger.info({ type: "TRACKING", function: "jobListAttrs::getTalentsForJobs", message: "jobs is not defined or not from array type" });
        return [];
    }
    const talentKeys = _.uniq(jobs.map((job) => job.itemData && job.itemData.talentId).filter(Boolean)).map((itemId) => ({ companyId, itemId }));
    const talents = await dynamoDbUtils.batchGetParallel(companyProvidersTableName, talentKeys);
    return talents;
}

const getIsMilestoneAutoBudget = (thresholds, milestone) => {
    jsonLogger.info({ type: "TRACKING", function: "jobHelper::getIsMilestoneAutoBudget", thresholds, milestone });
    const { amount, percent } = thresholds || {};
    if (!amount && !percent) {
        jsonLogger.info({ type: "TRACKING", function: "jobHelper::getIsMilestoneAutoBudget", message: 'Thresholds values not configured' });
        return false;
    }

    const { itemStatus, itemData } = milestone;
    const { actualCost, cost } = itemData;
    const missingAmount = constants.job.status.overageBudgetRequest === itemStatus ? actualCost - cost : cost;

    if (!missingAmount || !_.isFinite(missingAmount) || missingAmount <= 0) {
        jsonLogger.error({ type: "TRACKING", function: "jobHelper::getIsMilestoneAutoBudget", message: "Missing amount is not valid" });
        return false;
    }

    const missingPercent = missingAmount / cost * 100;
    jsonLogger.info({ type: "TRACKING", function: "jobHelper::getIsMilestoneAutoBudget", missingPercent });

    const isLowerThanAmountThreshold = amount && _.isFinite(amount) && missingAmount <= amount;
    const isLowerThanPercentThreshold = percent && _.isFinite(percent) && missingPercent <= percent;
    jsonLogger.info({ type: "TRACKING", function: "jobHelper::getIsMilestoneAutoBudget", isLowerThanAmountThreshold, isLowerThanPercentThreshold });

    return isLowerThanAmountThreshold || isLowerThanPercentThreshold;
}

const buildUpdatedBid = (bid, job) => ({
    entityId: job.entityId,
    itemId: `${job.itemId}_${bid.itemData.candidate.itemId}`,
    companyId: job.companyId,
    itemData: bid.itemData,
    userId: job.userId,
    createdBy: job.userId,
    modifiedBy: job.userId,
    itemStatus: _.get(bid, 'itemStatus', constants.bidItemStatus.new),
})

// eslint-disable-next-line max-params
const createNewBidsAndUpdateJob = async (jobBids, entityId, createdJob, userId, isUpdate, returnBidsWOUpdate) => {
    let newJobBids = Array.isArray(jobBids) ? jobBids : _.get(_(jobBids).value(), 'values')
    const bidsKeys = _.map(newJobBids, (bidId) => ({ itemId: bidId, entityId }))
    const bidsResult = await dynamoDbUtils.batchGetParallel(bidsTableName, bidsKeys);

    const bidsToCreate = _.map(bidsResult, (item) => buildUpdatedBid(item, createdJob))
    newJobBids = await bidsService.batchCreate(bidsToCreate);

    if (returnBidsWOUpdate) {
        return newJobBids;
    }
    const updateBidsItem = { entityId: createdJob.entityId, itemId: createdJob.itemId, modifiedBy: userId, bids: newJobBids };

    if (isUpdate) {
        await candidatesService.update(updateBidsItem);
    } else {
        await candidatesService.add(updateBidsItem);
    }

    const updatedCreatedJob = await jobsService.get(createdJob.entityId, createdJob.itemId, true)
    return updatedCreatedJob
}

const getTalentsWithOpenJobs = async (companyId, talentId) => {
    const isTalentProvider = prefixLib.isProvider(talentId);
    const existingJobs = talentId
        ? await jobsServiceTalentId.getOpenJobs(gsiItemsByCompanyIdAndTalentId, companyId, talentId)
        : await jobsServiceTalentId.listByCompanyIdWithFilter(gsiViewDataByCompanyIdAndItemId, companyId, null, constants.prefix.job, [constants.job.status.active, constants.job.status.jobRequest, constants.job.status.budgetRequest], undefined, undefined, undefined, undefined, false, undefined, undefined, true)

    const jobsByTalentsAndProviders = _.reduce(
        existingJobs,
        (acc, job) => {
            const jobTalentId = _.get(job, 'talentId')
            const jobProviderId = idConverterLib.getProviderIdFromTalentId(jobTalentId)

            acc[jobTalentId] = job
            acc[jobProviderId] = job

            return acc
        },
        {},
    )

    const talentsWithJobs = {};
    _.forEach(_.keys(jobsByTalentsAndProviders), (talent) => {
        talentsWithJobs[talent] = true;
    })

    if (isTalentProvider && !_.isEmpty(existingJobs)) {
        talentsWithJobs[talentId] = true;
    }

    return talentsWithJobs
}
const updateProviderStatusToActive = (talentsWithJobs, currentstatus, itemId) => {
    if (
        [constants.companyProvider.status.registered, constants.companyProvider.status.active].includes(currentstatus) &&
        !_.isEmpty(talentsWithJobs)
    ) {
        return _.get(talentsWithJobs, itemId) ? constants.companyProvider.status.active : currentstatus
    }
    return currentstatus
}

const warningCodes = {
    workforceComplianceBlock: ACTION_WARNINGS.notCompliantTalent,
    legalComplianceBlock: ACTION_WARNINGS.legalNotCompliantTalent,
}

// eslint-disable-next-line max-lines-per-function
const getAllowedActionsByType = (companyProvider, actionTypes = [], talentsWithJobs, itemId, settings, complianceSource, isCompanyAdmin, additionalSource) => {
    const isProvider = prefixLib.isProvider(itemId);
    const isProviderSelfEmployedTalent = _.get(companyProvider, 'itemData.isProviderSelfEmployedTalent', false)
    const isTalentUnderCompany = !isProvider && !isProviderSelfEmployedTalent;
    const talentsStatus = _.get(companyProvider, 'itemStatus')
    const isInvited = talentsStatus === constants.companyProvider.status.invited
    const isNotInvited = talentsStatus === constants.companyProvider.status.notInvited
    const isTalentActivated = ![
        constants.companyProvider.status.invited,
        constants.companyProvider.status.notInvited,
        constants.companyProvider.status.inactive,
    ].includes(talentsStatus)

    const isActiveJobs = () => _.get(talentsWithJobs, itemId, false);
    const isWorkforceValid = () => !_.get(complianceSource, 'itemData.sequenceOfWork.isNonCompliantBlocked');
    const isTalentWorkforceComplianceIgnored = () => _.get(complianceSource, 'itemData.isTalentWorkforceComplianceIgnored.value', false);
    const isNonCompliantBlockedSettingOn = () => _.get(settingsGetterHelper.getNonCompliantBlockedSetting(settings), 'isWorkforceNonCompliantBlocked');
    const isLegalComplianceScoreRed = () => _.get(complianceSource, 'itemData.legalCompliance.score') === constants.LEGAL_COMPLIANCE_SCORE.red;
    const isAdditionalLegalComplianceScoreRed = () => _.get(additionalSource, 'itemData.legalCompliance.score') === constants.LEGAL_COMPLIANCE_SCORE.red;
    const isNonLegalCompliantBlocked = () => _.get(settingsGetterHelper.getNonCompliantBlockedSetting(settings), 'isNonLegalCompliantBlocked') &&
        (isLegalComplianceScoreRed() ||
            isAdditionalLegalComplianceScoreRed());


    const validateAction = type => {
        switch (type) {
            case ACTION_MENU_OPTIONS.deactivate:
                return {
                    value: !isActiveJobs() && isTalentActivated
                };
            case ACTION_MENU_OPTIONS.cancelInvitation:
                return {
                    value: isInvited && !isActiveJobs() && (isProvider || isProviderSelfEmployedTalent)
                };
            case ACTION_MENU_OPTIONS.removeTalent:
                return {
                    value: !isActiveJobs() && (isNotInvited || (isInvited && isTalentUnderCompany))
                };
            case ACTION_MENU_OPTIONS.startJob: {
                const isNonLegalCompliantBlockedValue = isNonLegalCompliantBlocked();
                const isNonCompliantBlockedSettingOnValue = isNonCompliantBlockedSettingOn();
                const isWorkforceValidValue = isWorkforceValid();
                const isTalentWorkforceComplianceIgnoredValue = isTalentWorkforceComplianceIgnored();
                return {
                    value: !isNonLegalCompliantBlockedValue && (!isNonCompliantBlockedSettingOnValue || isWorkforceValidValue || isTalentWorkforceComplianceIgnoredValue),
                    warning: isNonLegalCompliantBlockedValue || (isNonCompliantBlockedSettingOnValue && !isWorkforceValidValue && !isTalentWorkforceComplianceIgnoredValue),
                };
            }
            case ACTION_MENU_OPTIONS.toggleIgnoreWorkforceComplianceBlock: {
                const isNonCompliantBlockedSettingOnValue = isNonCompliantBlockedSettingOn();
                const isWorkforceValidValue = isWorkforceValid();
                const isTalentWorkforceComplianceIgnoredValue = isTalentWorkforceComplianceIgnored();
                return {
                    value: isNonCompliantBlockedSettingOnValue && isCompanyAdmin,
                    warning: isNonCompliantBlockedSettingOnValue && !isWorkforceValidValue && isTalentWorkforceComplianceIgnoredValue ? ACTION_WARNINGS.ignoredNotCompliantTalent : null,
                };
            }
            case ACTION_MENU_OPTIONS.requestPayment: {
                const isNonLegalCompliantBlockedValue = isNonLegalCompliantBlocked();
                const isNonCompliantBlockedSettingOnValue = isNonCompliantBlockedSettingOn();
                const isWorkforceValidValue = isWorkforceValid();
                const isTalentWorkforceComplianceIgnoredValue = isTalentWorkforceComplianceIgnored();
                const isWorkForceBlocked = isNonCompliantBlockedSettingOnValue && !(isWorkforceValidValue || isTalentWorkforceComplianceIgnoredValue);
                const warnings = [];
                if (isWorkForceBlocked) {
                    warnings.push(warningCodes.workforceComplianceBlock)
                }
                if (isNonLegalCompliantBlockedValue) {
                    warnings.push(warningCodes.legalComplianceBlock)
                }
                return {
                    value: (!isNonLegalCompliantBlockedValue && !isWorkForceBlocked) || isCompanyAdmin,
                    warning: isWorkForceBlocked || isNonLegalCompliantBlockedValue,
                    warningList: warnings
                };
            }
            default:
                break;
        }
        return null;
    }
    return _.reduce(actionTypes, (acc, action) => ({
        ...acc,
        [ACTION_MENU_OPTIONS[action]]: validateAction(action)
    }), {})
}

const getActionMenuOptions = (companyProvider, talentsWithJobs, itemId, settings, complianceSource, isCompanyAdmin, additionalSource) => getAllowedActionsByType(companyProvider, Object.values(ACTION_MENU_OPTIONS), talentsWithJobs, itemId, settings, complianceSource, isCompanyAdmin, additionalSource)

const calculateTotalEarned = (talentEarnedMilestones) => talentEarnedMilestones.reduce(
    // eslint-disable-next-line consistent-return
    (sum, milestone) => {
        const currency = _.get(milestone, 'itemData.providerData.taxInfo.paymentCurrency', constants.currencyTypes.default);
        const defaultCost = _.get(milestone, 'itemData.actualCost', _.get(milestone, 'itemData.cost'));
        const amount = _.get(milestone, 'itemData.providerData.taxInfo.total', defaultCost);
        const summary = {
            ...sum,
            [currency]: _.get(sum, [currency], 0) + Number(amount),
        }
        return summary;
    },
    {},
);

const getSecondApprover = (item, approversByType, companyId) => {

    const approversChain = _.sortBy(
        _.filter(_.get(item, 'itemData.approversChain', []), approver => !_.get(approver, 'approvedBy')),
        'level'
    );

    const nextApprover = _.first(approversChain);
    const type = _.get(nextApprover, 'type');
    let approversIds = []

    switch (type) {
        case constants.multiLevelTypes.anyone:
            approversIds = _.get(item, 'userId');
            break;
        case constants.multiLevelTypes.departmentAdmin:
            approversIds = _.get(approversByType, [_.get(item, 'entityId')]);
            break;
        case constants.multiLevelTypes.companyAdmin:
            approversIds = _.get(approversByType, companyId);
            break;
        case constants.multiLevelTypes.namedUser:
            approversIds = _.get(nextApprover, 'userIds');
            break;
        case constants.multiLevelTypes.external:
            approversIds = [constants.multiLevelTypes.external];
            break;
        default:
            approversIds = [];
            break;
    }
    return approversIds
}

const enrichApprovers = async (items, companyId) => {
    if (!_.size(items)) {
        return items
    }

    let approversByType = []
    let itemsReturn = items
    const isExistsPendingApprovalMS = _.some(items, item => _.includes(
        [
            constants.job.status.pendingApproval,
            constants.job.status.requested,
            constants.job.status.secondApproval,
            constants.job.status.budgetRequest,
            constants.job.status.overageBudgetRequest,
        ],
        _.get(item, 'itemStatus')
    ))

    if (isExistsPendingApprovalMS) {
        approversByType = await usersService.listCompanyApproversByType(gsiItemsByCompanyIdIndexName, companyId);
    }

    itemsReturn = _.map(items, (item) => {
        const itemStatus = _.get(item, 'itemStatus');

        switch (itemStatus) {
            case constants.job.status.pendingApproval:
            case constants.job.status.requested:
                return {
                    ...item,
                    approvers: [_.get(item, 'userId')]
                };
            case constants.job.status.secondApproval:
                return {
                    ...item,
                    approvers: getSecondApprover(item, _.get(approversByType, 'isJobsApprover', []), companyId)
                };
            case constants.job.status.budgetRequest:
            case constants.job.status.overageBudgetRequest:
                return {
                    ...item,
                    approvers: _.get(approversByType, ['isBudgetOwner', _.get(item, 'entityId')])
                };
            default:
                return item;
        }
    })

    return itemsReturn
}

const isJobOffer = (job) => job &&
    prefixLib.isJob(job.itemId) &&
    job.itemStatus === constants.job.status.pending &&
    _.get(job, 'itemData.jobFlow') === constants.jobFlow.offer &&
    (Array.isArray(_.get(job, 'itemData.bids', [])) ? _.get(job, 'itemData.bids', []) : _.get(_.get(job, 'itemData.bids', []), 'values', [])).length

module.exports = {
    ACTION_MENU_OPTIONS,
    ALLOWED_ACTIONS,
    getNonFinalizedJobs,
    isNotAllowToEditJob,
    getJob,
    getMilestone,
    getJobsByHiringManager,
    getIsMilestoneAutoBudget,
    createNewBidsAndUpdateJob,
    archiveAllDrafts,
    fetchJobsForMilestones,
    getTalentsWithOpenJobs,
    updateProviderStatusToActive,
    getActionMenuOptions,
    calculateTotalEarned,
    getAllowedActionsByType,
    enrichApprovers,
    isJobOffer,
    getTalentsForJobs,
};
