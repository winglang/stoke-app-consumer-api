'use strict';

const { generateTalentPDF } = require('./talent/talentPDF')
const { jsonLogger, responseLib, constants, BidsService, UsersService, JobsService, permisionConstants } = require('stoke-app-common-api');

const bidsService = new BidsService(process.env.bidsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

module.exports.handler = async (event, context) => {
  jsonLogger.info({ type: 'TRACKING', function: 'talents::generatePublicPDF', event, context });

  const data = JSON.parse(event.body);
  const { entityId, talentId, jobId } = data;
  if (!entityId || !talentId || !jobId) {
    jsonLogger.error({ type: 'TRACKING', function: 'talents::generatePublicPDF', message: 'params entityId, talentId and jobId are mandatory' });
    return responseLib.failure({ message: 'params entityId, talentId and jobId are mandatory' });
  }

  const userId = event.requestContext.identity.cognitoIdentityId;
  const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, null, { [permisionConstants.permissionsComponentsKeys.talents]: {} });
  if (!authorised) {
    jsonLogger.error({ type: 'TRACKING', function: 'talents::generatePublicPDF', message: 'user is not authorised' });
    return responseLib.forbidden({ status: false });
  }

  const bid = await bidsService.get(entityId, talentId);
  if (!bid) {
    jsonLogger.error({ type: 'TRACKING', function: 'talents::generatePublicPDF', message: `talent not found for. entityId: ${entityId}, talentId: ${talentId}` });
    return responseLib.failure({ message: `talent not found for. entityId: ${entityId}, talentId: ${talentId}` });
  }

  const job = await jobsService.get(entityId, jobId);
  if (!job) {
    jsonLogger.error({ type: 'TRACKING', function: 'talents::generatePublicPDF', message: `job not found for. entityId: ${entityId}, jobId: ${jobId}` });
    return responseLib.failure({ message: `job not found for. entityId: ${entityId}, jobId: ${jobId}` });
  }

  try {
    const pdfUrl = await generateTalentPDF(bid, job);
    jsonLogger.info({ type: 'TRACKING', function: 'talents::generatePublicPDF', message: `generated public url: ${pdfUrl}` });
    return pdfUrl ? responseLib.success({ 'url': pdfUrl }) : responseLib.failure({ status: false });
  } catch (e) {
    jsonLogger.error({ type: 'TRACKING', function: 'talents::generatePublicPDF', message: `Error on generatePublicPDF. userId: ${userId}, entityId: ${entityId}, jobId: ${jobId}, talentId: ${talentId}`, exception: e.message });
    return responseLib.failure({ status: false });
  }

};
