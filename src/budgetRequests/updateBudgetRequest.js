'use strict';

const { UsersService, BudgetsService, constants, jsonLogger, responseLib, SqsService } = require('stoke-app-common-api');

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const asyncTasksQueue = new SqsService(process.env.asyncTasksQueueName);


const generateNotificationItem = (companyId, entityId, userId) => ({
    companyId,
    entityId,
    userId,
})

module.exports.handler = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body);

    jsonLogger.info({ type: 'TRACKING', function: 'resetBudgetRequest::handler', functionName: context.functionName, awsRequestId: context.awsRequestId, userId, data, event });
    const { requestor, companyId, entityId, year, period, comment } = data;

    if (!requestor || !companyId || !entityId || !year || !period) {
        jsonLogger.error({ 
            type: 'TRACKING', function: 'resetBudgetRequest::handler', 
            message: 'missing mandatory parameters', requestor, companyId, entityId, year, period
        });
        return responseLib.failure({ message: 'missing mandatory parameters' });
    }
    // eslint-disable-next-line no-magic-numbers
    
    const isAuthorised = userId === requestor 
        ? await usersService.validateUserEntity(userId, entityId, null, true)
        : await usersService.validateUserEntity(userId, entityId, constants.user.role.admin, true);
    if (!isAuthorised) {
        jsonLogger.error({ type: 'TRACKING', function: 'resetBudgetRequest::handler', message: 'This user is not authorized to reset a budgetRequest', userId, requestor, entityId, companyId });
        return responseLib.forbidden({ status: false });
    }

    const budgetRequest = {
        entityId,
        companyId,
        userId: requestor,
        modifiedBy: userId,
        year,
        period,
    }

    if (userId !== requestor) {
        const adminItem = generateNotificationItem(companyId, entityId, userId);
        const hiringManagerItem = generateNotificationItem(companyId, entityId, requestor);
        await asyncTasksQueue.sendMessage({ taskData: { adminItem, hiringManagerItem, comment }, type: constants.sqsAsyncTasks.types.rejectAdditionalBudgetRequestEmailNotification });        
    }
    
    const result = await budgetsService.resetBudgetRequest(budgetRequest);

    return responseLib.send(result);
}
