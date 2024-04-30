/* eslint-disable no-magic-numbers */
/* eslint-disable no-await-in-loop */
/* eslint-disable max-lines-per-function */
/* eslint-disable max-params */


'use strict';

const _ = require('lodash');
const {
    constants, jsonLogger, responseLib, UsersService, BudgetsService,
    JobsService, SqsService, jobHelper
} = require('stoke-app-common-api');
const {
    jobsTableName,
    consumerAuthTableName,
    budgetsTableName,
} = process.env;

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const TALENT_COMPLETED_AT = 'talentCompletedAt';
const asyncTasksQueue = new SqsService(process.env.asyncTasksQueueName);

const isMilestoneCompletedByTalent = (milestone) => _.get(milestone, `itemData.${TALENT_COMPLETED_AT}`);

const updateJobInner = async (userId, entityId, itemId, itemData, itemStatus) => {
    const item = {
        entityId,
        itemId,
        itemStatus,
        itemData,
        modifiedBy: userId,
    };
    jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::updateJobInner", item });
    const response = await jobsService.update(item);
    jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::updateJobInner", response });
    return response;
}

const fetchItemsFromMail = async (companyId, code) => {
    jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::fetchMailMS", message: 'Fetching items (MS) from mail code', companyId, code });
    const item = await jobsService.get(companyId, code)
    
    return _.get(item, 'itemData', [])
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
    const { entityId, sourceEntityId, emailCode, companyId } = data;
    let { items = [] } = data
    
    jsonLogger.info({
        type: "TRACKING",
        function: "approveMilestoneBudgetRequest::handler",
        message: "initial data",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        userId,
        entityId,
        items,
        sourceEntityId,
        emailCode,
        companyId
    });

    const singleReturnValue = !_.isEmpty(sourceEntityId)

    if (singleReturnValue) {
        jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'source ID provided, working with single return value configuration' });    
    }
    
    if (!companyId || (!items && !emailCode)) {
        return responseLib.forbidden({ message: "missing required data", entityId, emailCode });
    }

    if (!_.isEmpty(emailCode)) {
        items = await fetchItemsFromMail(companyId, emailCode)
        if (!_.isEmpty(items)) {
            jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'found items from email code', items });    
        }
    }

    if (_.isEmpty(items)) {
        return responseLib.forbidden({ message: "no items found", emailCode });
    }
    
    jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'checking getCompanyUserAuthRole', userId, companyId, isEditor: true });
    const { entitiesAdmin, role } = await usersService.getCompanyUserAuthRole(userId, companyId, true);
    const entitiesAdminIds = _.map(entitiesAdmin, 'entityId')
    const isCompanyAdmin = constants.user.role.admin === role;

    if (constants.user.role.unauthorised === role) {
        jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'insufficient permissions for role', role });
        return responseLib.forbidden({ message: 'insufficient permissions for role', role });
    }
    
    jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'items to transfer', items });

    const permissionsSucceededResult = [];
    const permissionFailedResult = [];
    for (const item of items) {
        const sourceId = sourceEntityId ? sourceEntityId : item.entityId
        const msEntityId = entityId ? entityId : item.entityId
        jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: `working on sourceId: ${sourceId}, entityId: ${msEntityId}`, entitiesAdminIds });
        const isSourceEntityAdmin = _.includes(entitiesAdminIds, sourceId)
        
        if (!isSourceEntityAdmin) {
            jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'insufficient permissions sourceId', entitiesAdminIds, sourceId });
            permissionFailedResult.push(responseLib.forbidden({ milestone: item }))
        }

        const { itemId } = item
        const milestone = await jobsService.get(msEntityId, itemId)
        const { itemStatus } = milestone
        let result = null
        if (itemStatus === constants.job.status.budgetRequest || itemStatus === constants.job.status.overageBudgetRequest) {
            result = await budgetsService.transferToMilestone(sourceId, userId, milestone, true);
            jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: `transferToMilestone result: ${result}`, isCompanyAdmin });
            if (!_.get(result, 'isAllocatedAll') && isCompanyAdmin) {
                if (singleReturnValue) {
                    jsonLogger.error({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", exception: 'Failed to update job', message: 'singleReturnValue configuration, aborting' });
                    return responseLib.failure({ status: false })
                }
                jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'trying to transfer as company admin', id: itemId });
                result = await budgetsService.transferToMilestoneIfAdmin(companyId, userId, milestone) // trying again with companyId as admin
                
                if (result) {
                    jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'succeeded transfering budget from company pool', id: itemId })
                } else {
                    jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'failed transfering budget from company pool', id: itemId })
                }
            }
        }

        if (_.get(result, 'isAllocatedAll')) {
            const date = _.get(milestone, 'itemData.date');
            const currentDate = new Date(date);
            const year = currentDate.getFullYear();
            const period = Math.floor(currentDate.getMonth() / 12 * 4) + 1;
            permissionsSucceededResult.push({ milestone, savedBudget: _.get(result, 'savedBudget'), year, period, msEntityId });
            jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'Succeeded updating ms', id: itemId });
        } else {
            jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'Failed updating ms', id: itemId });
            permissionFailedResult.push({ milestone })
        }
    }

    const allResults = []
    const allMilestonesTransferred = []
    const failedTransferredMilestone = []
    for (const row of permissionsSucceededResult) {
        const { milestone, savedBudget } = row;
        const msEntityId = entityId ? entityId : milestone.entityId
        const sourceId = sourceEntityId ? sourceEntityId : milestone.entityId
        const isSourceEntityAdmin = _.includes(entitiesAdminIds, sourceId)

        const { itemStatus, itemData, itemId } = milestone
        const updateItemData = _.omit(itemData, 'budgetRequestSentEmail');
        updateItemData.savedBudget = savedBudget;
        let itemStatusToUpdate = constants.job.status.active;
        let isNextLevelApprover = false;
        let approvalOptions = {};
        if (itemStatus === constants.job.status.overageBudgetRequest) {
            const isMultiLevelNeeded = !_.isEmpty(_.get(milestone, 'itemData.approversChain'));
            jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", isSourceEntityAdmin, isCompanyAdmin, message: 'checking overageBudgetRequest' });

            approvalOptions = jobHelper.getApproveOptions(milestone, {}, userId, isSourceEntityAdmin, isCompanyAdmin);            
            // eslint-disable-next-line no-undefined
            itemStatusToUpdate = jobHelper.getApprovedMilestoneNextStatus(milestone, undefined, undefined, constants.job.status.completed);
            isNextLevelApprover = isMultiLevelNeeded && _.some(approvalOptions, approvals => !_.isEmpty(approvals));
        } else if (isMilestoneCompletedByTalent(milestone)) {
            await updateJobInner(userId, msEntityId, itemId, null, constants.job.status.active);
            await updateJobInner(userId, msEntityId, itemId, null, constants.job.status.pendingApproval);
            itemStatusToUpdate = constants.job.status.completed;
        }
        const result = await updateJobInner(userId, msEntityId, itemId, updateItemData, itemStatusToUpdate);
        if (isNextLevelApprover && result) {
            _.set(result, 'Attributes.itemData.isNextLevelApprover', true);
            _.set(result, 'Attributes.approvalOptions', approvalOptions);
        }
        _.set(result, 'Attributes.itemId', itemId);
        _.set(result, 'Attributes.entityId', msEntityId);

        allResults.push(result)
        if (result) {
            allMilestonesTransferred.push({ milestone, result })
        } else {
            jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'Failed to update job', result });
            failedTransferredMilestone.push({ milestone })
        }
    }

    await asyncTasksQueue.sendMessage({ taskData: { items: allMilestonesTransferred, userId }, type: constants.sqsAsyncTasks.types.approveBudgetRequestNotifiction });

    if (singleReturnValue) {
        jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", message: 'single return value configuration, returning allResults', allResults });    
        return responseLib.success(allResults);
    }

    jsonLogger.info({ type: "TRACKING", function: "approveMilestoneBudgetRequest::handler", permissionsSucceededResult, permissionFailedResult, allMilestonesTransferred, failedTransferredMilestone });
    return responseLib.success({ permissionsSucceededResult, permissionFailedResult, allMilestonesTransferred, failedTransferredMilestone })
}

module.exports = {
    handler,
}
