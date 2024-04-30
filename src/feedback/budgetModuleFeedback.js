'use strict';

const { jsonLogger, responseLib, constants, snsLib, UsersService } = require('stoke-app-common-api');

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

module.exports.handler = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const data = JSON.parse(event.body);
  const { companyId } = data;

  if (!companyId || !userId) {
    jsonLogger.error({ type: 'error', function: 'budgetModuleFeedback::handler', companyId, userId, message: 'missing params' });
    responseLib.failure({ status: false })
  }

  jsonLogger.info({ type: "TRACKING", function: "budgetModuleFeedback::handler", functionName: context.functionName, awsRequestId: context.awsRequestId, userId, companyId });
  const { role } = await usersService.getCompanyUserAuthRole(userId, companyId);
  if (!role || role === constants.user.role.unauthorised) {
    return responseLib.forbidden({ status: false });
  }
  await snsLib.publish(
    process.env.userActionsSnsTopicArn,
    constants.budget.operation.feedback.action,
    {
      userId, companyId, message: constants.budget.operation.feedback.message
    }
  );

  return responseLib.success({ status: true })
};
