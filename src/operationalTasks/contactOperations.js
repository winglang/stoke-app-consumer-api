'use strict';

const _ = require('lodash');
const { jsonLogger, responseLib, constants, snsLib, UsersService, CompaniesService, personalInfoLib } = require('stoke-app-common-api');
const { OperationalTasks } = require('stoke-app-common-api/config/constants');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');
const { getBody } = require('../helpers/utils');

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

module.exports.handler = async (event, context) => {
  jsonLogger.info({ type: "TRACKING", function: "contactOperations::handler", event, context });
  const userId = event.requestContext.identity.cognitoIdentityId;
  const data = getBody(event);
  const { companyId, operationType, date, infoObject } = data;

  if (!companyId || !userId || !operationType || !date) {
    jsonLogger.error({ type: 'error', function: 'contactOperations::handler', companyId, userId, operationType, date, message: 'missing params' });
    return responseLib.failure({ status: false })
  }

  jsonLogger.info({ type: "TRACKING", function: "contactOperations::handler", functionName: context.functionName, awsRequestId: context.awsRequestId, userId, companyId, infoObject });
  // eslint-disable-next-line no-undefined
  const permissionType = operationType === OperationalTasks.CTA_RED_WORKFORCE_COMPLIANCE ? { [permissionsComponentsKeys.talents]: { } } : undefined;
  const role = await usersService.getUserAuthRoleWithComponents(userId, companyId, permissionType);
  if (!role || role === constants.user.role.unauthorised) {
    jsonLogger.error({ type: 'error', function: 'contactOperations::handler', userId, message: 'user is unauthorised' });
    return responseLib.forbidden({ status: false });
  }

  const company = await companiesService.get(`${constants.prefix.company}${companyId}`);
  const companyName = _.get(company, 'itemData.entityName');
  if (!companyName) {
    jsonLogger.error({ type: "TRACKING", function: "contactOperations::handler", message: 'Failed to retrieve the company data for the companyName', companyId });
    return responseLib.forbidden({ status: false });
  }

  const [userConsumer] = await companiesService.listByUserId(process.env.gsiItemByUserIdIndexName, userId, constants.prefix.userPoolId);
  const { fullName, email } = personalInfoLib.getConsumerPersonalInfo(userConsumer);

  const messageObject = {
    userId, fullName, email, companyId, companyName, date, infoObject,
  }

  await snsLib.publish(process.env.userActionsSnsTopicArn, operationType, messageObject);

  jsonLogger.info({ type: "TRACKING", function: "contactOperations::handler", messageObject });

  return responseLib.success({ status: true })
};
