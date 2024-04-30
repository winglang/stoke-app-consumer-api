

'use strict';

const _ = require('lodash');

const { constants, jsonLogger, responseLib, UsersService, SqsService, permisionConstants } = require('stoke-app-common-api');
const { consumerAuthTableName } = process.env;

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const asyncTasksQueue = new SqsService(process.env.asyncTasksQueueName);

const isSameDepartment = (a, b) => a === b.entityId;

/**
 * update milstone status 
 * @param {Object} event - event
 * @param {Object} context - context
 * @returns {object} status
 */
const handler = async (event, context) => {
    const data = JSON.parse(event.body);
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId, items, sendToUserId } = data;

    jsonLogger.info({
        type: "TRACKING",
        function: "sendRequest::handler",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        userId,
        companyId,
        items,
        sendToUserId
    });

    if (!companyId || !items || !sendToUserId) {
        return responseLib.failure({ message: "missing required data", companyId, items, sendToUserId });
    }

    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true } });
    if (role === constants.user.role.unauthorised) {
        return responseLib.forbidden({ status: false });
    }

    const areItemsValid = _.every(items, (item) => item.itemId && item.entityId);

    if (!areItemsValid) {
        return responseLib.failure({ message: "wrong items format", items });
    }

    const requestedDepartments = _.map(items, (item) => item.entityId);
    // eslint-disable-next-line array-element-newline
    const notAuthorized = _.differenceWith(requestedDepartments, [...entitiesAdmin, ...entitiesUser], isSameDepartment);
    if (!_.isEmpty(notAuthorized)) {
        return responseLib.forbidden({ status: false });
    }

    const { role: forwardToRole, entitiesAdmin: forwardToEntitiesAdmin } = await usersService.getCompanyUserAuthRoleWithComponents(sendToUserId, companyId, { [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true } });
    const notAdminDepartments = _.differenceWith(requestedDepartments, forwardToEntitiesAdmin, isSameDepartment);
    
    if (forwardToRole === constants.user.role.unauthorised || !_.isEmpty(notAdminDepartments)) {
        jsonLogger.error({ type: 'TRACKING', function: 'sendRequest::handler', message: 'Request can be forwarded only to department admins', sendToUserId });
        return responseLib.failure({ status: false });
    }

    await asyncTasksQueue.sendMessage({ taskData: { items, userId, sendToUserId, companyId }, type: constants.sqsAsyncTasks.types.forwardBudgetRequestEmail });
    return responseLib.success();
}

module.exports = {
    handler
}
