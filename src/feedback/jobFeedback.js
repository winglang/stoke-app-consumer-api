'use strict';

const { jsonLogger, responseLib, constants, snsLib, UsersService } = require('stoke-app-common-api');

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

module.exports.handler = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const data = JSON.parse(event.body);
  const { companyId, entityId, jobId, feedback, operation } = data;

  if (!companyId || !entityId || !jobId || !userId) {
    responseLib.failure({ status: false })
  }

  jsonLogger.info({
    type: "TRACKING",
    function: "jobFeedback::handler",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId, companyId, entityId, jobId, feedback
  });

  const authorised = await usersService.validateUserEntity(userId, entityId);
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }

  await snsLib.publish(process.env.interactTalentSnsTopicArn, 'jobFeedback::handler', { userId, companyId, entityId, jobId, operation, message: feedback });

  return responseLib.success({ status: true })
};
