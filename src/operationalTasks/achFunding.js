'use strict';

const _ = require('lodash');
const { jsonLogger, responseLib, constants, snsLib, UsersService, CompaniesService, SettingsService, personalInfoLib } = require('stoke-app-common-api');
const { OperationalTasks } = require('stoke-app-common-api/config/constants');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');
const { getBody } = require('../helpers/utils');

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

module.exports.handler = async (event, context) => {
  jsonLogger.info({ type: "TRACKING", function: "achFunding::handler", event, context });
  const userId = event.requestContext.identity.cognitoIdentityId;
  const data = getBody(event);
  const { companyId, amount, date, comment } = data;

  if (!companyId || !userId || !amount || !date) {
    jsonLogger.error({ type: 'error', function: 'achFunding::handler', companyId, userId, amount, date, comment, message: 'missing params' });
    return responseLib.failure({ status: false })
  }

  jsonLogger.info({ type: "TRACKING", function: "achFunding::handler", functionName: context.functionName, awsRequestId: context.awsRequestId, userId, companyId });
  const role = await usersService.getUserAuthRoleWithComponents(userId, companyId, { [permissionsComponentsKeys.funding]: { isEditor: true } });
  if (!role || role === constants.user.role.unauthorised) {
    jsonLogger.error({ type: 'error', function: 'achFunding::handler', userId, message: 'user is unauthorised' });
    return responseLib.forbidden({ status: false });
  }

  const companySettings = await settingsService.get(`${constants.prefix.company}${companyId}`);
  const achAuthourisedUsers = _.get(companySettings, 'itemData.fundingSettings.companyAdminIds') || [];
  const isUserAuthourisedToRequestAch = achAuthourisedUsers.includes(userId);
  if (!isUserAuthourisedToRequestAch) {
    jsonLogger.error({ type: 'error', function: 'achFunding::handler', userId, message: 'user is unauthorised to request ACH' });
    return responseLib.forbidden({ status: false });
  }

  const company = await companiesService.get(`${constants.prefix.company}${companyId}`);
  const companyName = _.get(company, 'itemData.entityName');
  if (!companyName) {
    jsonLogger.error({ type: "TRACKING", function: "achFunding::handler", message: 'Failed to retrieve the company data for the companyName', companyId });
    return responseLib.forbidden({ status: false });
  }

  const [userConsumer] = await companiesService.listByUserId(process.env.gsiItemByUserIdIndexName, userId, constants.prefix.userPoolId);
  const { fullName, email } = personalInfoLib.getConsumerPersonalInfo(userConsumer);

  const messageObject = {
    userId, fullName, email, companyId, companyName, amount, date, message: comment,
  }

  await snsLib.publish(process.env.userActionsSnsTopicArn, OperationalTasks.ACH_FUNDING, messageObject);

  jsonLogger.info({ type: "TRACKING", function: "achFunding::handler", messageObject, msg: 'user ask to ACH funds' });

  return responseLib.success({ status: true })
};
