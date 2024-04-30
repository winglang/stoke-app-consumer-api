'use strict';

const {
    consumerAuthTableName,
    budgetsTableName,
} = process.env;
const { UsersService, BudgetsService, constants, jsonLogger, responseLib, permisionConstants } = require('stoke-app-common-api');
const _ = require('lodash');

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

module.exports.handler = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body);

    jsonLogger.info({ type: 'TRACKING', function: 'setPlannedBudget::handler', functionName: context.functionName, awsRequestId: context.awsRequestId, userId, data, event });
    const { companyId, entityId, year, periodsAmount } = data;

    if (!companyId || !entityId || !year || !periodsAmount || _.isEmpty(periodsAmount)) {
        jsonLogger.error({ type: 'TRACKING', function: 'setPlannedBudget::handler', message: 'missing mandatory parameters', companyId, entityId, year, periodsAmount });
        return responseLib.failure({ message: 'missing mandatory parameters' });
    }

    const isAuthorised = await usersService.validateUserEntityWithComponents(userId, entityId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true } }) || await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.budget]: {} });
    if (!isAuthorised) {
        jsonLogger.error({ type: 'TRACKING', function: 'setPlannedBudget::handler', message: 'This user is not authorized to submit a budget plan', userId, entityId, companyId });
        return responseLib.forbidden({ status: false });
    }

    const response = await budgetsService.setPlannedBudget({
        userId,
        modifiedBy: userId,
        entityId,
        companyId,
        year,
        periodsAmount
    })

    return responseLib.send(response)
}
