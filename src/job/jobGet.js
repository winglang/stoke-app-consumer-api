'use strict';

const {
    consumerAuthTableName,
    gsiUsersByEntityIdIndexName,
} = process.env;

const { constants, jsonLogger, responseLib, UsersService, prefixLib } = require('stoke-app-common-api');
const { getJob } = require('../helpers/jobHelper');

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const JOB_STATUSES_WITHOUT_CHAT = [constants.job.status.budgetRequest, constants.job.status.jobRequest];

module.exports.handler = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const itemId = event.pathParameters.id;
    const { entityId } = event.queryStringParameters || {};

    jsonLogger.info({ type: "TRACKING", function: "jobGet::handler", functionName: context.functionName, awsRequestId: context.awsRequestId, userId, itemId, entityId });

    const job = await getJob(userId, entityId, itemId);
    if (!job) {
        return responseLib.forbidden({ status: false });
    }

    let result = {}
    if (prefixLib.isTemplate(itemId)) {
        result = job
    } else {
        const { companyId } = job;
        const approvers = await usersService.listApprovers(gsiUsersByEntityIdIndexName, companyId, entityId);
        const isChatAvailable = !JOB_STATUSES_WITHOUT_CHAT.includes(job.itemStatus);
        result = {
            job: { ...job, isChatAvailable },
            approvers,
        };
    }

    jsonLogger.info({ type: "TRACKING", function: "jobGet::handler", result });
    return responseLib.success(result);
};
