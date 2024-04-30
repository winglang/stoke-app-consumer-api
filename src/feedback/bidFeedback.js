'use strict';

const { jsonLogger, responseLib, constants, snsLib, UsersService } = require('stoke-app-common-api');

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

module.exports.handler = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const data = JSON.parse(event.body);
  const { companyId, entityId, bidId, feedback } = data;

  if (!companyId || !entityId || !bidId || !userId) {
    responseLib.failure({ status: false })
  }

  jsonLogger.info({
    type: "TRACKING",
    function: "bidFeedback::handler",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId, companyId, entityId, bidId, feedback
  });

  const authorised = await usersService.validateUserEntity(userId, entityId);
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }

  await snsLib.publish(
    process.env.bidsSnsTopicArn,
    constants.bid.operation.feedback,
    { userId, companyId, entityId, itemId: bidId, message: feedback }
  );

  return responseLib.success({ status: true })
};
