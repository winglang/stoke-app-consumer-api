'use strict';


const { jsonLogger, responseLib, constants, TalentsService } = require('stoke-app-common-api');
const talentsService = new TalentsService(process.env.talentsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes)

module.exports.getTalent = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const itemId = event.pathParameters.id;

  jsonLogger.info({ type: 'TRACKING', function: 'talents::getTalent', userId, itemId, event, context });

  const result = await talentsService.get(itemId);
  return result ? responseLib.success(result) : responseLib.failure({ status: false });
};

module.exports.getTalents = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const { multiValueQueryStringParameters } = event;

  jsonLogger.info({ type: 'TRACKING', function: 'talents::getTalents', userId, multiValueQueryStringParameters, event, context });

  if (!multiValueQueryStringParameters || !multiValueQueryStringParameters.itemId) {
    return responseLib.failure({ message: 'missing itemId in query string' });
  }

  const ids = multiValueQueryStringParameters.itemId;
  const promises = ids.map((id) => talentsService.get(id));
  const result = await Promise.all(promises);
  return result ? responseLib.success(result) : responseLib.failure({ status: false });
};
