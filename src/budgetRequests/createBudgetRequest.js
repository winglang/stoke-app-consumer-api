'use strict';


const {
    consumerAuthTableName,
    budgetsTableName,
    asyncTasksQueueName,
    userActionsSnsTopicArn
} = process.env;
const { UsersService, BudgetsService, constants, jsonLogger, responseLib, SqsService, snsLib } = require('stoke-app-common-api');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const asyncTasksQueue = new SqsService(asyncTasksQueueName);

const generateNotificationItem = (companyId, entityId, userId) => ({
    companyId,
    entityId,
    userId,
})

// eslint-disable-next-line max-lines-per-function
module.exports.handler = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body);
    jsonLogger.info({ type: 'TRACKING', function: 'budgetRequests::handler', functionName: context.functionName, awsRequestId: context.awsRequestId, userId, data, event });
    const { requestor, companyId, entityId, year, period, amount, requestedFrom, comment } = data;

    if (!requestor || !companyId || !entityId || !year || !period || !requestedFrom) {
        jsonLogger.error({ 
            type: 'TRACKING', function: 'budgetRequests::handler', 
            message: 'missing mandatory parameters', requestor, companyId, entityId, year, period, amount, requestedFrom
        });
        return responseLib.failure({ message: 'missing mandatory parameters' });
    }
    // eslint-disable-next-line no-magic-numbers
    if (!amount || amount < 0) {
        jsonLogger.error({ 
            type: 'TRACKING', function: 'budgetRequests::handler', 
            message: 'can not create budget request for received amount', amount
        });
        return responseLib.failure({ message: 'can not create budget request for received amount' });
    }
    const isAuthorised = userId === requestor 
        ? await usersService.validateUserEntity(userId, entityId, null, true)
        : await usersService.validateUserEntity(userId, entityId, constants.user.role.admin, true);
    if (!isAuthorised) {
        jsonLogger.error({ type: 'TRACKING', function: 'budgetRequests::handler', message: 'This user is not authorized to submit a budgetRequest', userId, requestor, entityId, companyId });
        return responseLib.forbidden({ status: false });
    }

    const isRequestedFromAuthorised = await usersService.validateUserEntityWithComponents(requestedFrom, entityId, constants.user.role.admin, { [permissionsComponentsKeys.budget]: { isEditor: true } })

    if (!isRequestedFromAuthorised) {
        jsonLogger.error({ type: 'TRACKING', function: 'budgetRequests::handler', message: 'This user is not authorized to get a budgetRequest', userId, requestor, entityId, companyId });
        return responseLib.forbidden({ status: false });
    }

    const budgetRequest = {
        userId: requestor, 
        modifiedBy: userId, 
        entityId, 
        companyId, 
        year, 
        period, 
        amount, 
        requestedFrom,
        comment,
    };

    const notificationToItem = generateNotificationItem(companyId, entityId, requestedFrom);
    const requestorItem = generateNotificationItem(companyId, entityId, requestor);
    
    await asyncTasksQueue.sendMessage({ taskData: { notificationToItem, requestorItem, amount, comment, quarter: period }, type: constants.sqsAsyncTasks.types.requestedAdditionalBudgetEmailNotification });        
    const result = await budgetsService.createBudgetRequest(budgetRequest);
    await snsLib.publish(userActionsSnsTopicArn, 'budgetRequests::handler', budgetRequest);

    return responseLib.send(result);
}
