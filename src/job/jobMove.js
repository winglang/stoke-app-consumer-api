/* eslint-disable max-lines */
/* eslint-disable no-extra-parens */
/* eslint-disable complexity */
/* eslint-disable no-magic-numbers */


'use strict';

const {
    jobsTableName,
    consumerAuthTableName,
    customersTableName,
    asyncTasksQueueName,
} = process.env;

const _ = require("lodash");
const { constants, jsonLogger, responseLib, UsersService, JobsService, CompaniesService, teamsService, SqsService } = require('stoke-app-common-api');
const jobs = require("../jobs");
const { createNewBidsAndUpdateJob, isJobOffer } = require("../helpers/jobHelper");
const { moveJobFiles } = require('../helpers/filesHelper');
const { createItemId } = require('../helpers/commonHelper');

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const asyncTasksQueue = new SqsService(asyncTasksQueueName);

const errorMessagesKeyToMessage = {
    failedToFindJob: 'failed to find job',
    notAuthorized: 'authorization failed',
    nothingToMove: 'nothing to move - source and target values are the same',
    entityCantBeCompany: 'entity id cannot be company id',
    validateTargetTeamsExist: 'validateTargetTeamsExist failed',
    pendingApprovalMilestoneStatuses: 'there are pending approval or payment request milestones',
    milestoneArchiveFail: 'failed to archive milestones',
    failedToCreateJob: 'failed to create job',
    failedToSignJob: 'failed to sign job',
    failedToUpdateOriginalJobStatus: 'failed to update original job status to completed',
    JobIdsArrayButNotSrcEntities: 'jobIds is array but srcEntityId is not',
    SrcEntitiesArrayButNotJobIds: 'srcEntityId is array but jobIds is not',
}

const cloneableMilestoneStatuses = [
    constants.job.status.initial,
    constants.job.status.draft,
    constants.job.status.autoDraft,
    constants.job.status.pending,
    constants.job.status.budgetRequest,
    constants.job.status.budgetDeclined,
    constants.job.status.active,
    constants.job.status.requested,
];

const jobStatusesWithoutMilestones = [
    constants.job.status.initial,
    constants.job.status.draft,
    constants.job.status.autoDraft,
    constants.job.status.pending,
];

const pendingApprovalMilestoneStatuses = [
    constants.job.status.pendingApproval,
    constants.job.status.overageBudgetRequest,
    constants.job.status.requested
];

// eslint-disable-next-line max-params
const authorize = async (userId, companyId, srcUserId, srcEntityId, targetUserId, targetEntityId) => {
    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(userId, companyId, true);
    const entityIdsAdmin = entitiesAdmin.map((ent) => ent.entityId);
    const entityIdsUser = entitiesUser.map((ent) => ent.entityId);
    jsonLogger.info({
        type: 'TRACKING', function: 'jobMove::authorize', role, entitiesAdmin, entitiesUser
    });
    let authorised = false;
    const targetUserIdAuthorised = await usersService.validateUserEntity(targetUserId, targetEntityId, null, true);
    if (targetUserIdAuthorised) {
        switch (role) {
            case constants.user.role.admin:
                authorised = true;
                break;
            case constants.user.role.user:
                if ((entityIdsAdmin.includes(srcEntityId) || (entityIdsUser.includes(srcEntityId) && userId === srcUserId)) &&
                    (entityIdsAdmin.includes(targetEntityId) || (entityIdsUser.includes(targetEntityId) && userId === targetUserId))) {
                    authorised = true;
                }
                break;
            default:
                break;
        }
    }
    return authorised;
}

const archiveMilestones = async (milestones, modifiedBy) => {
    const archivedMilestones = milestones.map((mlstn) => ({
        entityId: mlstn.entityId,
        itemId: mlstn.itemId,
        itemStatus: constants.job.status.archived,
        modifiedBy,
    }));
    const result = await jobsService.transactUpdate(archivedMilestones);
    return result;
}

const updateJobTeams = async (job, targetTeams, userId) => {
    const jobToUpdate = {
        entityId: job.entityId,
        itemId: job.itemId,
        modifiedBy: userId,
    };
    teamsService.set(jobToUpdate, targetTeams);

    jsonLogger.info({ type: 'TRACKING', function: 'jobMove::updateJobTeams', jobToUpdate });
    const result = await jobsService.update(jobToUpdate);
    if (!result) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobMove::updateJobTeams', message: 'failed to update job teams', targetTeams, job });
        return responseLib.failure({ status: false });
    }

    return responseLib.success({ result: job });
}

const validateTargetTeamsExist = async (targetEntityId, targetTeams) => {
    if (_.isEmpty(targetTeams)) {
        return true;
    }

    const entity = await companiesService.get(constants.prefix.entity + targetEntityId);
    if (!entity) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobMove::validateTargetTeamsExist', message: 'entity not found', targetEntityId });
        return false;
    }

    return teamsService.validateItemTeamsIncludes(entity, targetTeams);
};

const isRequestedRejected = (milestone) => milestone.itemStatus === constants.job.status.requested && _.get(milestone, 'itemData.isRejected', false);

// eslint-disable-next-line max-lines-per-function, max-params
const moveJob = async (userId, targetEntityId, targetUserId, targetTeams, srcEntityId, jobId, isKeepOriginalJobOpen, idToRemoveFromBids) => {

    jsonLogger.info({ type: 'TRACKING', function: 'jobMove::moveJob', userId, targetEntityId, targetUserId, targetTeams, srcEntityId, jobId, isKeepOriginalJobOpen, idToRemoveFromBids });

    let job = await jobsService.get(srcEntityId, jobId);
    if (!job) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobMove::moveJob', message: errorMessagesKeyToMessage.failedToFindJob, srcEntityId, jobId });
        return constants.httpStatusCodes.INTERNAL_SERVER_ERROR;
    }

    const { companyId, userId: srcUserId } = job;

    const authorized = await authorize(userId, companyId, srcUserId, srcEntityId, targetUserId, targetEntityId);
    if (!authorized) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobMove::moveJob', message: errorMessagesKeyToMessage.notAuthorized, userId, companyId, srcUserId, srcEntityId, targetUserId, targetEntityId });
        return constants.httpStatusCodes.FORBIDDEN;
    }

    const srcTeams = teamsService.get(job);
    if (srcUserId === targetUserId && srcEntityId === targetEntityId && teamsService.isEqual(srcTeams, targetTeams)) {
        jsonLogger.info({ type: 'TRACKING', function: 'jobMove::moveJob', message: errorMessagesKeyToMessage.nothingToMove, srcUserId, targetUserId, srcEntityId, targetEntityId, srcTeams, targetTeams });
        return constants.httpStatusCodes.INTERNAL_SERVER_ERROR;
    }
    if (srcEntityId === companyId || targetEntityId === companyId) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobMove::moveJob', message: errorMessagesKeyToMessage.entityCantBeCompany, srcEntityId, targetEntityId, companyId });
        return constants.httpStatusCodes.INTERNAL_SERVER_ERROR;
    }

    const validTeams = await validateTargetTeamsExist(targetEntityId, targetTeams);
    if (!validTeams) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobMove::moveJob', message: errorMessagesKeyToMessage.validateTargetTeamsExist, targetEntityId, targetTeams });
        return constants.httpStatusCodes.INTERNAL_SERVER_ERROR;
    }

    // if only need to move teams
    if (srcUserId === targetUserId && srcEntityId === targetEntityId) {
        return updateJobTeams(job, targetTeams, userId);
    }

    let cloneableMiletones = []
    let srcJobStatus = isKeepOriginalJobOpen ? _.get(job, 'itemStatus') : constants.job.status.archived
    const isJobWithMilestones = !jobStatusesWithoutMilestones.includes(job.itemStatus)
    if (isJobWithMilestones) {
        const milestones = await jobsService.list(srcEntityId, srcUserId, `${constants.prefix.milestone}${jobId}_`);
        const pendingApprovalMiletones = (milestones || []).filter((mlstn) => pendingApprovalMilestoneStatuses.includes(mlstn.itemStatus) && !isRequestedRejected(mlstn));
        if (pendingApprovalMiletones.length) {
            jsonLogger.error({ type: 'TRACKING', function: 'jobMove::moveJob', message: errorMessagesKeyToMessage.pendingApprovalMilestoneStatuses, milestones });
            return constants.httpStatusCodes.INTERNAL_SERVER_ERROR;
        }

        cloneableMiletones = (milestones || []).filter((mlstn) => cloneableMilestoneStatuses.includes(mlstn.itemStatus) && !isRequestedRejected(mlstn));
        if (cloneableMiletones.length && !isKeepOriginalJobOpen) {
            const archiveResult = await archiveMilestones(cloneableMiletones, userId);
            if (!archiveResult) {
                jsonLogger.error({ type: 'TRACKING', function: 'jobMove::moveJob', message: errorMessagesKeyToMessage.milestoneArchiveFail });
                return constants.httpStatusCodes.INTERNAL_SERVER_ERROR;
            }
        }

        const isArchiveOriginalJob = cloneableMiletones.length === milestones.length && !isKeepOriginalJobOpen;
        srcJobStatus = isArchiveOriginalJob ? srcJobStatus : constants.job.status.completed;
    }

    const newItemId = createItemId(constants.prefix.job);
    const jobFiles = _.get(job, 'itemData.files', []);
    const newFilesArray = _.size(jobFiles)
        ? await moveJobFiles(
            jobFiles,
            companyId,
            targetEntityId,
            targetUserId,
            srcEntityId,
            srcUserId,
            newItemId
        )
        : [];

    const newJobItemData = {
        ..._.omit(job.itemData, 'bids', 'entityId', 'companyId'),
        totalBudget: 0,
        jobMovedData: { srcUserId, srcEntityId, srcJobId: jobId, srcJobStatus },
        files: newFilesArray
    };
    const newJobStatus = isJobWithMilestones ? constants.job.status.autoDraft : job.itemStatus;
    const teams = teamsService.create(targetTeams);
    const oldJobTags = _.get(job, 'tags', {});
    const newTags = { ...oldJobTags, ...teams }
    let createdJob = await jobs.innerCreateJob(companyId, targetEntityId, targetUserId, userId, newJobItemData, newJobStatus, newTags, newItemId);
    if (!createdJob) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobMove::moveJob', message: errorMessagesKeyToMessage.failedToCreateJob });
        return constants.httpStatusCodes.INTERNAL_SERVER_ERROR;
    }


    const clonedMilestones = cloneableMiletones.
        map((mlstn) => _.pick(mlstn, ['itemData', 'tags'])).
        map((mlstn) => ({ ...mlstn, itemStatus: constants.job.status.pending }));

    let jobBids = _.get(job, 'itemData.bids');

    if (isKeepOriginalJobOpen && idToRemoveFromBids) {
        jobBids = Array.isArray(jobBids) ? jobBids : _.get(_(jobBids).value(), 'values')
        const originalJobUpdatedBids = _.filter(jobBids, bid => !_.includes(bid, idToRemoveFromBids))
        if (_.size(originalJobUpdatedBids)) {
            job = await createNewBidsAndUpdateJob(originalJobUpdatedBids, job.entityId, job, userId, true);
        }
    }
    const talentId = _.get(job, 'itemData.talentId');
    if (!isJobWithMilestones && _.size(jobBids)) {
        createdJob = await createNewBidsAndUpdateJob(jobBids, job.entityId, createdJob, userId);
    } else if (talentId) {
        const signResult = await jobs.innerSign(companyId, targetEntityId, newJobItemData, createdJob.itemId, targetUserId, userId, talentId, clonedMilestones);
        if (!signResult) {
            jsonLogger.error({ type: 'TRACKING', function: 'jobMove::moveJob', message: errorMessagesKeyToMessage.failedToSignJob, job: createdJob });
            return constants.httpStatusCodes.INTERNAL_SERVER_ERROR;
        }
    }

    if (isJobOffer(job)) {
        const taskData = {
            oldEntityId: job.entityId,
            oldItemId: job.itemId,
            oldUserId: job.userId,
            newEntityId: createdJob.entityId,
            newItemId: createdJob.itemId,
            newUserId: createdJob.userId,
            type: constants.offerTalentActionTypes.moveJob
        };
        if (isKeepOriginalJobOpen) {
            taskData.idToRemoveFromBids = idToRemoveFromBids;
        }
        await asyncTasksQueue.sendMessage({ taskData, type: constants.sqsAsyncTasks.types.offerTalentUpdate });
    }

    const updatedCompletedJob = {
        entityId: job.entityId,
        itemId: job.itemId,
        modifiedBy: userId,
        itemStatus: srcJobStatus,
        itemData: {
            ...job.itemData,
            newJobId: createdJob.itemId,
            newEntityId: createdJob.entityId
        }
    };
    const completeJobResult = await jobsService.update(updatedCompletedJob);
    if (!completeJobResult) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobMove::moveJob', message: errorMessagesKeyToMessage.failedToUpdateOriginalJobStatus });
        return constants.httpStatusCodes.INTERNAL_SERVER_ERROR;
    }

    if (srcUserId !== targetUserId && job.itemStatus === constants.job.status.pending) {
        await asyncTasksQueue.sendMessage({ taskData: { job: { entityId: createdJob.entityId, itemId: createdJob.itemId, companyId } }, type: constants.sqsAsyncTasks.types.jobPostedMovedToHmNotification })
    }


    return createdJob;
}

/**
 * moveJob - move job to other userId and/or other entityId. in actuallity, the job and its active
 * milestones are cloned, and the job budget is optionally moved to the new userId and/or entityId
 * @param {Object} event - event
 * @param {Object} context - context
 * @returns {object} results
 */
// eslint-disable-next-line max-lines-per-function
module.exports.handler = async (event, context) => {

    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body);
    jsonLogger.info({ type: 'TRACKING', function: 'jobs::moveJob', userId, data, event, context });

    const { srcEntityIds, targetEntityId, targetUserId, targetTeams, moveBudget, jobIds, isKeepOriginalJobOpen, idToRemoveFromBids } = data;
    jsonLogger.info({ type: 'TRACKING', function: 'jobs::moveJob', jobIds, srcEntityIds, targetEntityId, targetUserId, targetTeams, moveBudget, isKeepOriginalJobOpen, idToRemoveFromBids });
    if (!jobIds || !srcEntityIds || !targetEntityId || !targetUserId) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobs::moveJob', message: 'missing params', jobIds, srcEntityIds, targetEntityId, targetUserId });
        return responseLib.failure({ status: false });
    }
    if (moveBudget) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobs::moveJob', message: 'move budget is not supported yet' });
        return responseLib.failure({ message: 'move budget is not supported yet' });
    }

    const isBulkAction = Array.isArray(jobIds)

    if (!isBulkAction && Array.isArray(srcEntityIds)) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobs::moveJob', message: errorMessagesKeyToMessage.SrcEntitiesArrayButNotJobIds });
        return responseLib.failure({ message: errorMessagesKeyToMessage.SrcEntitiesArrayButNotJobIds });
    }

    if (isBulkAction && !Array.isArray(srcEntityIds)) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobs::moveJob', message: errorMessagesKeyToMessage.JobIdsArrayButNotSrcEntities });
        return responseLib.failure({ message: errorMessagesKeyToMessage.JobIdsArrayButNotSrcEntities });
    }

    const jobsArray = isBulkAction ? jobIds : [jobIds]
    const srcEntityIdsArray = isBulkAction ? srcEntityIds : [srcEntityIds]

    let results = []
    results = await Promise.all(_.map(jobsArray, (jobIdToMove, index) => moveJob(userId, targetEntityId, targetUserId, targetTeams, srcEntityIdsArray[index], jobIdToMove, isKeepOriginalJobOpen, idToRemoveFromBids)))

    if (results.some(res => res && !_.includes([constants.httpStatusCodes.FORBIDDEN, constants.httpStatusCodes.INTERNAL_SERVER_ERROR], res))) {
        return responseLib.success(isBulkAction ? results : results[0])
    }
    return results.every(res => res === constants.httpStatusCodes.FORBIDDEN)
        ? responseLib.forbidden({ status: false })
        : responseLib.success({ status: false })

}
