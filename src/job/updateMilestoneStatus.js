/* eslint-disable max-lines */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-await-in-loop */
/* eslint-disable max-lines-per-function */
/* eslint-disable array-element-newline */
/* eslint-disable max-params */


'use strict';

const _ = require('lodash');
const AWS = require('aws-sdk');
const {
    constants, jsonLogger, responseLib, UsersService, BudgetsService, SqsService, JobsService, jobHelper
} = require('stoke-app-common-api');
const {
    getNextApprovalRecord,
    getMultiLevelContext,
    getUpdatedLevels,
    enrichMsWithApprovalOptions,
    getCompanySettings,
} = require('./../helpers/multiLevelHelper');
const { getSettingsByDepartment } = require('./../helpers/settingsHelper');

const { getJobRequestLevels, getUpdatedJobRequestLevels, isJobRequestMilestone } = require('./../helpers/jobRequestHelper');
const dayjs = require("dayjs");

const {
    jobsTableName,
    consumerAuthTableName,
    budgetsTableName,
    asyncTasksQueueName,
} = process.env;

const sns = new AWS.SNS();
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAttributesAndExternalUserId, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const TALENT_COMPLETED_AT = 'talentCompletedAt';
const asyncTasksQueue = new SqsService(asyncTasksQueueName);

const { fetchJobsForMilestones } = require('../helpers/jobHelper')

const PENDING_APPROVAL_STATUSES = [
    constants.job.status.pendingApproval,
    constants.job.status.secondApproval,
    constants.job.status.requested,
];

// eslint-disable-next-line no-confusing-arrow
const getStatusByNextLevelAction = (actionStatus, ms, approversChainSetting) => actionStatus === constants.job.status.completed
    ? jobHelper.getApprovedMilestoneNextStatus(ms, approversChainSetting, ms.levelsToApprove)
    : jobHelper.getRejectedMilestoneNextStatus(ms, ms.levelsToApprove);

const updateJobInner = async (userId, entityId, itemId, itemData, itemStatus) => {
    const item = {
        entityId,
        itemId,
        itemStatus,
        itemData,
        modifiedBy: userId,
    };
    const result = await jobsService.update(item);
    return result;
}

const getBudgetRequest = (milestone, itemStatus) => {
    const { itemData, itemStatus: exsitingItemStatus, newItemData } = milestone;
    const { actualCost, cost } = itemData;
    if (itemStatus === constants.job.status.completed && ![constants.job.status.completed, constants.job.status.secondApproval].includes(exsitingItemStatus)) {
        const { actualCost: actualCostUpdated } = newItemData || {}
        const actualCostAfterApprove = actualCostUpdated || actualCost
        return actualCostAfterApprove - cost;
    } else if (itemStatus === constants.job.status.active && ![constants.job.status.active, constants.job.status.pendingApproval, constants.job.status.secondApproval].includes(exsitingItemStatus)) {
        return cost;
    }
    return 0;
}

const partitionByNewJobRequests = (milestones) => {
    const [newJobRequests, milestonesWithNoJobRequests] = _.partition(milestones, (milestone) => isJobRequestMilestone(milestone))
    const jobRequestsWithStatuses = newJobRequests.map((ms) => ({
        ...ms,
        newItemStatus: constants.job.status.jobRequest
    }))
    return [jobRequestsWithStatuses, milestonesWithNoJobRequests];
}

/**
 * inner update milstone status 
 * @param {object} milestones - the milestones 
 * @param {string} itemStatus - the item status to update
 * @param {object} approversChainSetting - settings
 * @param {string} approverUserId - userId from the event
 * @returns {object} results
 */
const innerUpdateMilestoneStatusGetStatus = async (milestones, itemStatus) => {
    jsonLogger.info({ type: "TRACKING", function: "updateMilestoneStatus::innerUpdateMilestoneStatusGetStatus", message: 'get status to update', itemStatus });
    const allMilestones = milestones.map((ms) => ({ ...ms, newItemStatus: itemStatus }));
    // eslint-disable-next-line prefer-const
    let [milestoneToRejectBudget, milestoneNotRejectBudget] =
        _.partition(allMilestones, (ms) => itemStatus === constants.job.status.budgetDeclined && _.get(ms, 'itemStatus') === constants.job.status.overageBudgetRequest);
    milestoneToRejectBudget = milestoneToRejectBudget.map((ms) => ({ ...ms, newItemStatus: constants.job.status.pendingApproval }));
    const [nextLevelApprovals, milestonesWithOriginalStatuses] =
        _.partition(milestoneNotRejectBudget, (ms) => ms.itemStatus === constants.job.status.secondApproval);
    const [milestonesWithJobRequests, milestonesWithNoJobRequests] = partitionByNewJobRequests(milestonesWithOriginalStatuses);
    const [milestonesWithNoBudgetRequests, milestonesToValidateBudget] =
        // eslint-disable-next-line no-mixed-operators
        _.partition(milestonesWithNoJobRequests, (ms) => !_.get(ms, 'itemData.actualCost') && !_.get(ms, 'itemData.actualRequestCost') && _.get(ms, 'itemData.cost') === 0 || getBudgetRequest(ms, itemStatus) <= 0);
    const milestonesGroupedByQuerter = Object.values(_.groupBy(milestonesToValidateBudget, (ms) => {
        const date = _.get(ms, 'itemData.date');
        const currentDate = new Date(date);
        const year = currentDate.getFullYear();
        const period = Math.floor(currentDate.getMonth() / 12 * 4) + 1;
        return `${year}${period}${ms.userId}${ms.entityId}`;
    }));
    let result = [];

    for (const milestonesByQuerter of milestonesGroupedByQuerter) {
        let itemStatusToUpdate = itemStatus;
        const costToCheck = _.sumBy(milestonesByQuerter, (milestone) => getBudgetRequest(milestone, itemStatus))
        if (costToCheck > 0) {
            const [{ entityId, userId, itemData }] = milestonesByQuerter;
            const isUserBudgetAvailable = await budgetsService.isAvailableBudget(entityId, `${constants.prefix.user}${userId}`, new Date(itemData.date), costToCheck);
            if (!isUserBudgetAvailable) {
                itemStatusToUpdate = itemStatus === constants.job.status.active ? constants.job.status.budgetRequest : constants.job.status.overageBudgetRequest;
            }

            jsonLogger.info({ type: "TRACKING", function: "updateMilestoneStatus::innerUpdateMilestoneStatusGetStatus", message: 'Status depend on budget', userId, entityId, milestonesByQuerter, itemStatusToUpdate, costToCheck });
        }
        // eslint-disable-next-line no-loop-func
        result = [...result, ...milestonesByQuerter.map((ms) => ({ ...ms, newItemStatus: itemStatusToUpdate }))]
    }
    const [newNextLevelApprovals, notSecondApprovals] =
        _.partition([...result, ...milestonesWithNoBudgetRequests], (ms) => [constants.job.status.pendingApproval, constants.job.status.requested].includes(ms.itemStatus) && ms.newItemStatus === constants.job.status.completed)

    const milestonesWithApprovalLevels = [...nextLevelApprovals, ...newNextLevelApprovals].map((ms) => {
        const newItemStatus = _.isEmpty(_.get(ms, 'multiLevelContext'))
            ? itemStatus
            : getStatusByNextLevelAction(itemStatus, ms, ms.multiLevelContext);
        const updatedMilestone = { ...ms, newItemStatus };
        return updatedMilestone;
    });

    return [...milestoneToRejectBudget, ...notSecondApprovals, ...milestonesWithApprovalLevels, ...milestonesWithJobRequests];
}

const filterAutoInvoice = (files) => _.filter(files, (file) => !file.autoTalentInvoice);

/**
 * inner update milstone status 
 * @param {object} milestone - the milestone 
 * @param {string} originalUpdateStatus - the item status to client wants to update
 * @param {string} requestUserId - the user that initiated this action
 * @param {object} approversChain - multiLevel settinsg
 * @param {object} settings - all settings
 * @returns {object} results
 */
// eslint-disable-next-line complexity
const innerUpdateMilestoneStatus = async (milestone, originalUpdateStatus, requestUserId) => {
    jsonLogger.info({ type: 'TRACKING', function: 'jobs::innerUpdateMilestoneStatus', milestone, originalUpdateStatus, requestUserId });
    const { companyId, itemData, entityId, itemId, itemStatus, newItemStatus, newItemData, multiLevelContext, levelsToApprove, isEntityAdmin, isCompanyAdmin, jobRequestLevels, jobRequestLevelsToApprove } = milestone;
    const { actualCost, providerData, splittedMilestoneNumber, actualRequestCost } = itemData;
    let updateItemData = { ...itemData };
    if (constants.job.status.completed === originalUpdateStatus && itemStatus === constants.job.status.requested) {
        jsonLogger.info({ type: 'TRACKING', function: 'jobs::innerUpdateMilestoneStatus', milestone, originalUpdateStatus, requestUserId, 'message': 'Try to active request milestone' });
        let requestResult = await updateJobInner(requestUserId, entityId, itemId, updateItemData, constants.job.status.active);
        if (!requestResult) {
            jsonLogger.error({ type: 'TRACKING', function: 'updateMilestoneStatus::innerUpdateMilestoneStatus', milestone, originalUpdateStatus, requestUserId, 'message': 'Error when update reqest status to active' });
            return null;
        }
        requestResult = await updateJobInner(requestUserId, entityId, itemId, updateItemData, constants.job.status.pendingApproval);
        if (!requestResult) {
            jsonLogger.error({ type: 'TRACKING', function: 'updateMilestoneStatus::innerUpdateMilestoneStatus', milestone, originalUpdateStatus, requestUserId, 'message': 'Error when update reqest status to pending approval' });
            return null;
        }
    }
    const previousApprovals = [..._.get(itemData, 'approvals', [])];
    const newApprover = getNextApprovalRecord(previousApprovals, requestUserId);
    if (originalUpdateStatus === constants.job.status.completed && itemStatus !== constants.job.status.completed) {
        jsonLogger.info({
            type: 'TRACKING',
            function: 'updateMilestoneStatus::innerUpdateMilestoneStatus',
            message: 'complete milestone'
        });
        updateItemData.approvals = [...previousApprovals, newApprover];
        if (itemStatus === constants.job.status.secondApproval) {
            updateItemData = _.omit(updateItemData, ['secondApprovalSentEmail']);
        }
        if (newItemStatus === constants.job.status.overageBudgetRequest) {
            updateItemData.isProcessing = true;
        }
        if (!_.isEmpty(multiLevelContext)) {
            updateItemData.approversChain = getUpdatedLevels(milestone, multiLevelContext, levelsToApprove, requestUserId);
        }
        const isPartialApproval = _.get(newItemData, 'splittedMilestoneNumber', false) || splittedMilestoneNumber
        updateItemData = {
            ...updateItemData,
            actualRequestCost: isPartialApproval ? _.get(newItemData, actualRequestCost) : actualRequestCost,
            actualCost: isPartialApproval ? _.get(newItemData, 'actualCost', actualCost) : actualCost,
            providerData: isPartialApproval ? _.get(newItemData, 'providerData', providerData) : providerData,
            splittedMilestoneNumber: _.get(newItemData, 'splittedMilestoneNumber', splittedMilestoneNumber),
        };
    } else if (originalUpdateStatus === constants.job.status.active && itemStatus !== constants.job.status.active) {
        jsonLogger.info({ type: 'TRACKING', function: 'updateMilestoneStatus::innerUpdateMilestoneStatus', message: 'active milestone' });
        if (itemStatus === constants.job.status.pendingApproval) {
            jsonLogger.info({ type: 'TRACKING', function: 'updateMilestoneStatus::innerUpdateMilestoneStatus', message: 'reject pending milestone' });
            const files = filterAutoInvoice(_.get(itemData, 'files', []));
            updateItemData = {
                // eslint-disable-next-line array-element-newline
                ..._.omit(itemData, [TALENT_COMPLETED_AT, 'budgetRequestRejectedBy', 'pendingApprovalSentEmail', 'isRequestedByHm']),
                rejectDate: Date.now(),
                approvals: [...previousApprovals, { ...newApprover, action: 'reject' }],
                files
            };
            if (!_.isEmpty(updateItemData.approversChain)) {
                updateItemData.approversChain = getUpdatedLevels(milestone, multiLevelContext, levelsToApprove, requestUserId, true);
            }
            const notification = {
                Subject: `${companyId} - mileston request payment is rejected`,
                Message: JSON.stringify({ milestone, newItemData }),
                TopicArn: process.env.rejectRequestPaymentSnsTopicArn
            };
            try {
                const result = await sns.publish(notification).promise();
                jsonLogger.info({ type: 'TRACKING', function: 'updateMilestoneStatus::innerUpdateMilestoneStatus', text: 'send sns topic for reject milestone', milestone, result });
            } catch (e) {
                jsonLogger.error({ type: 'TRACKING', function: 'updateMilestoneStatus::innerUpdateMilestoneStatus', text: `exception - ${e.message}`, e });
            }
        } else if (itemStatus === constants.job.status.secondApproval) {
            updateItemData = {
                ..._.omit(updateItemData, ['secondApprovalSentEmail']),
                nextLevelRejectedBy: _.get(newItemData, 'nextLevelRejectedBy'),
                nextLevelRejectMessage: _.get(newItemData, 'nextLevelRejectMessage'),
                approvals: [...previousApprovals, { ...newApprover, action: 'reject' }],
            }
            updateItemData.approversChain = getUpdatedLevels(milestone, multiLevelContext, levelsToApprove, requestUserId, true);
            await asyncTasksQueue.sendMessage({ taskData: milestone, type: constants.sqsAsyncTasks.types.secondLevelRejectEmailNotification });
        } else if (newItemStatus === constants.job.status.budgetRequest) {
            updateItemData = {
                ...updateItemData,
                isProcessing: true,
                jobRequestLevels: _.isEmpty(jobRequestLevelsToApprove)
                    ? updateItemData.jobRequestLevels
                    : getUpdatedJobRequestLevels(_.get(milestone, 'itemData.jobRequestLevels', jobRequestLevels), jobRequestLevelsToApprove, requestUserId)
            }
        } else if ([constants.job.status.jobRequest, constants.job.status.active].includes(newItemStatus) && jobRequestLevels) {
            updateItemData = {
                ..._.omit(updateItemData, [constants.flags.emailSent.JOB_REQUEST_APPROVAL_EMAIL_SENT]),
                jobRequestLevels: getUpdatedJobRequestLevels(jobRequestLevels, jobRequestLevelsToApprove, requestUserId),
            }
        }
    } else if (originalUpdateStatus === constants.job.status.budgetDeclined && itemStatus === constants.job.status.overageBudgetRequest) {
        jsonLogger.info({ type: 'TRACKING', function: 'updateMilestoneStatus::innerUpdateMilestoneStatus', message: 'overageBudgetRequest milestone' });
        updateItemData = {
            ..._.omit(updateItemData, ['budgetRequestSentEmail']),
            budgetRequestRejectedBy: requestUserId,
            approvals: [...previousApprovals, { ...newApprover, action: 'reject' }],
        }
    } else if (originalUpdateStatus === constants.job.status.pendingApproval && itemStatus === constants.job.status.active && _.get(newItemData, 'isRequestedByHm')) {
        updateItemData = {
            ...updateItemData,
            ..._.pick(
                newItemData,
                'providerData',
                'files',
                'invoiceNumber',
                'invoiceDate',
                'timeReport',
                'proFormaInvoiceNumber',
                'proFormaInvoiceDate',
                'isRequestedByHm',
                'requestedData'
            ),
            paymentRequestedByUserId: requestUserId,
            actualRequestCost: _.get(newItemData, 'amount'),
            actualCost: _.get(newItemData, 'amount'),
            talentCompletedAt: Date.now(),
        }
        await asyncTasksQueue.sendMessage({ taskData: { milestone, companyId }, type: constants.sqsAsyncTasks.types.requestPaymentFromHmEmailNotification });
    } else if (originalUpdateStatus === constants.job.status.requested && itemStatus === constants.job.status.requested && _.get(newItemData, 'isRejected') && !_.get(itemData, 'isRejected')) {
        const files = filterAutoInvoice(_.get(itemData, 'files', []));
        updateItemData = {
            ...updateItemData,
            files
        }
    }

    const message = _.get(newItemData, 'message');
    const isRejected = _.get(newItemData, 'isRejected');

    updateItemData = {
        ...updateItemData,
        message,
        isRejected,
    };
    jsonLogger.info({ type: 'TRACKING', function: 'jobs::innerUpdateMilestoneStatus', updateItemData, newItemStatus });
    const msUpdates = await updateJobInner(requestUserId, entityId, itemId, updateItemData, newItemStatus);
    const updatedMilestone = {
        ..._.get(msUpdates, 'Attributes'),
        itemId,
        userId: milestone.userId
    }
    const enrichedMs = enrichMsWithApprovalOptions(updatedMilestone, multiLevelContext, requestUserId, isEntityAdmin, isCompanyAdmin);
    _.set(msUpdates, 'Attributes.approvalOptions', _.get(enrichedMs, 'approvalOptions', {}));
    _.set(msUpdates, 'Attributes.id', itemId);
    _.set(msUpdates, 'Attributes.entityId', entityId);
    _.set(msUpdates, 'Attributes.userId', milestone.userId);
    return msUpdates;
}

const expenseMilestoneHandler = async (companyId, ms, milestone) => {
    const msItemData = _.get(ms, 'itemData');
    const additionalRow = _.get(msItemData, 'providerData.additionalRows[0]');
 
    if (additionalRow) {
        const { invoiceNumber, invoiceDate, proFormaInvoiceNumber, proFormaInvoiceDate, amount, files, providerData, resultValidation, requestedData } = msItemData || {}
        const dollarAmount = await jobHelper.getDollarAmount(amount, providerData, companyId);
        const externalUserId = _.get(milestone, 'externalUserId');

        const milestonItemData = {
            invoiceNumber,
            invoiceDate,
            proFormaInvoiceNumber,
            proFormaInvoiceDate,
            files,
            actualRequestCost: dollarAmount,
            providerData,
            actualCost: dollarAmount,
            talentCompletedAt: Date.now(),
            resultValidation,
            requestedData
        }

       await jobHelper.createExpenseMilestoneIfNeeded(companyId, externalUserId, milestone, msItemData, milestonItemData)

    }
}

const fetchItemsFromMail = async (companyId, code) => {
    jsonLogger.info({ type: "TRACKING", function: "updateMilestoneStatus::fetchMailMS", message: 'Fetching items (MS) from mail code', companyId, code });
    const item = await jobsService.get(companyId, code)
    
    return _.get(item, 'itemData', [])
}

const handleVerificationMode = async (milestonesWithNewStatus, rawMilestonesFromMail) => {
    jsonLogger.info({ type: "TRACKING", function: "updateMilestoneStatus::handleVerificationMode", milestonesWithNewStatus });
    const relevantForApproval = _.filter(milestonesWithNewStatus, ms => PENDING_APPROVAL_STATUSES.includes(ms.itemStatus) && !_.get(ms, 'itemData.isRejected'))
    jsonLogger.info({ type: "TRACKING", function: "updateMilestoneStatus::handleVerificationMode", relevantForApproval });
    
    const finalApproval = _.every(relevantForApproval, (ms) => ms.newItemStatus === constants.job.status.completed)
    const msSum = _.sumBy(relevantForApproval, (ms) => _.get(ms, 'newItemData.actualCost'))
    const msCount = _.size(relevantForApproval)
    const mailSum = _.sumBy(rawMilestonesFromMail, (ms) => _.get(ms, 'itemData.actualCost'))
    const hasChanged = !_.isEqual(mailSum, msSum)
    const jobs = await fetchJobsForMilestones(relevantForApproval)
    const jobsById = _.keyBy(jobs, 'itemId')
    jsonLogger.info({ type: "TRACKING", function: "updateMilestoneStatus::handleVerificationMode", jobs, jobsById });
    const msToApprove = _.map(relevantForApproval, milestone => {
        const amount = _.get(milestone, 'itemData.providerData.taxInfo.total', _.get(milestone, 'itemData.actualCost', _.get(milestone, 'itemData.cost', -1)));  
        const diff = dayjs().diff(milestone.itemData.talentCompletedAt || _.get(milestone, `itemData.${constants.flags.emailSent.BUDGET_REQUEST_EMAIL_SENT}`), 'day');
        const jobId = _.get(milestone, 'itemData.jobId')
        const title = _.get(milestone, 'itemData.title')
        const currency = _.get(milestone, 'itemData.providerData.taxInfo.paymentCurrency', constants.currencyTypes.default);
        const job = jobsById[jobId]
        
        const jobTitle = _.get(job, 'itemData.jobTitle')
        const talentName = _.get(job, 'itemData.talentData.name')

        return { 
            itemId: milestone.itemId, 
            entityId: milestone.entityId,
            amount,
            diff,
            title,
            jobTitle,
            currency,
            talentName
        }
    })
    

    jsonLogger.info({ type: "TRACKING", function: "updateMilestoneStatus::handleVerificationMode", finalApproval, msSum, msCount, hasChanged, mailSum, msToApprove });

    return { hasChanged, finalApproval, msCount, msSum, msToApprove }
}

/**
 * update milstone status 
 * @param {Object} event - event
 * @param {Object} context - context
 * @returns {object} results
 */
// eslint-disable-next-line complexity
const handler = async (event, context) => {
    const data = JSON.parse(event.body);
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId, itemStatus, emailCode, returnByCode } = data;
    
    let { milestones } = data
    let rawMilestonesFromMail = []
    const emailFlow = !_.isEmpty(emailCode)

    jsonLogger.info({
        type: "TRACKING",
        function: "updateMilestoneStatus::handler",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        userId, companyId, itemStatus, milestones, emailCode
    });

    if (emailFlow) {
        jsonLogger.info({ type: 'TRACKING', function: 'updateMilestoneStatus::handler', message: 'running lambda in email code mode' });
        milestones = await fetchItemsFromMail(companyId, emailCode)

        if (returnByCode) {
            return responseLib.success({ milestones });
        }        
        rawMilestonesFromMail = _.clone(milestones)
    }

    if (!companyId || (!emailFlow && !itemStatus) || !milestones || !milestones.length) {
        return responseLib.failure({ message: 'missing mandatory params in body' });
    }
    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(userId, companyId, true);
    if (role === constants.user.role.unauthorised) {
        jsonLogger.error({ type: 'TRACKING', function: 'updateMilestoneStatus::handler', message: 'Not allow for this user', userId });
        return responseLib.forbidden({ status: false });
    }
    const isCompanyAdmin = entitiesAdmin.find((entity) => entity.entityId === companyId);
    const settings = await getCompanySettings(companyId);
    const settingsByEntity = await getSettingsByDepartment(companyId);

    let milestonesWithNewStatus = [];
    const allMilstones = [];
    for (const ms of milestones) {
        const isEntityAdmin = entitiesAdmin.find((entity) => entity.entityId === ms.entityId);
        const isEntityUser = entitiesUser.find((entity) => entity.entityId === ms.entityId);
        if (!isEntityAdmin && !isEntityUser) {
            jsonLogger.error({ type: 'TRACKING', function: 'updateMilestoneStatus::handler', message: 'Not allow for this user', userId });
            return responseLib.forbidden({ status: false });
        }
        const milestone = await jobsService.get(ms.entityId, ms.itemId);
        if (!isEntityAdmin && milestone.userId !== userId) {
            jsonLogger.error({ type: 'TRACKING', function: 'updateMilestoneStatus::handler', message: 'Not allow for this user in entity id', userId, ms });
            return responseLib.forbidden({ status: false });
        }
        const isInvalidApproval = itemStatus === constants.job.status.completed && [constants.job.status.archived, constants.job.status.active].includes(milestone.itemStatus);
        const isCompletedMilestone = !emailFlow && [constants.job.status.completed, constants.job.status.paid].includes(milestone.itemStatus);
        if (isInvalidApproval || isCompletedMilestone) {
            jsonLogger.error({ type: 'TRACKING', function: 'updateMilestoneStatus::handler', message: 'Not allow to change status of approved or archived milestone', userId, ms });
            return responseLib.forbidden({ status: false });
        }
        const multiLevelContext = getMultiLevelContext(milestone, settings, settingsByEntity[`${constants.prefix.entity}${ms.entityId}`]);
        const approvedLevelsInfo = multiLevelContext && jobHelper.validateLevelsToApprove(milestone, multiLevelContext, userId, isEntityAdmin, isCompanyAdmin, ms.approvedLevels);
        if (itemStatus === constants.job.status.completed && multiLevelContext && !approvedLevelsInfo.isAuthorised) {
            jsonLogger.error({ type: 'TRACKING', function: 'updateMilestoneStatus::handler', message: 'This user is not authorised to approve this milestone', userId, ms });
            return responseLib.forbidden({ status: false });
        }
        const jobRequestLevels = getJobRequestLevels(milestone, settings, settingsByEntity[`${constants.prefix.entity}${ms.entityId}`]);
        const jobRequestInfo = !_.isEmpty(jobRequestLevels) && jobHelper.validateLevelsToApprove(milestone, jobRequestLevels, userId, isEntityAdmin, isCompanyAdmin, [], constants.MULTI_LEVEL_SETTINGS.jobRequestApproval);
        if (milestone.itemStatus === constants.job.status.jobRequest && !jobRequestInfo.isAuthorised && itemStatus !== constants.job.status.archived) {
            jsonLogger.error({ type: 'TRACKING', function: 'updateMilestoneStatus::handler', message: 'This user is not authorised to approve this job request', userId, ms });
            return responseLib.forbidden({ status: false });
        }

        allMilstones.push({
            ...milestone,
            newItemData: ms.itemData,
            levelsToApprove: _.get(approvedLevelsInfo, 'levelsToApprove', []),
            multiLevelContext,
            isEntityAdmin,
            isCompanyAdmin,
            jobRequestLevels,
            jobRequestLevelsToApprove: jobRequestInfo.levelsToApprove,
        });

        await expenseMilestoneHandler(companyId, ms, milestone);

    }
    milestonesWithNewStatus = await innerUpdateMilestoneStatusGetStatus(allMilstones, itemStatus);
    jsonLogger.info({ type: 'TRACKING', function: 'updateMilestoneStatus::handler', message: 'Try to update status', itemStatus });
    
    if (emailFlow) {
        const verificationData = await handleVerificationMode(milestonesWithNewStatus, rawMilestonesFromMail)
        return responseLib.success({ verificationData });
    } 
    
    const result = await Promise.all(milestonesWithNewStatus.map((milestone) => innerUpdateMilestoneStatus(milestone, itemStatus, userId)));
    
    return result ? responseLib.success(result) : responseLib.failure({ status: false });
}

module.exports = {
    innerUpdateMilestoneStatusGetStatus,
    innerUpdateMilestoneStatus,
    handler,
}
