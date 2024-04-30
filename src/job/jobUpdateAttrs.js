'use strict';

const { constants, jsonLogger, responseLib, JobsService } = require('stoke-app-common-api');
const { getJob } = require('../helpers/jobHelper');

const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

module.exports.handler = async (event) => {
    jsonLogger.info({ type: "TRACKING", function: "jobUpdateAttrs::handler", event });

    const userId = event.requestContext.identity.cognitoIdentityId;
    const itemId = event.pathParameters.id;
    const { entityId, itemData } = JSON.parse(event.body) || {};
    jsonLogger.info({ type: "TRACKING", function: "jobUpdateAttrs::handler", userId, itemId, entityId, itemData });

    const job = await getJob(userId, entityId, itemId, true);
    if (!job) {
        return responseLib.forbidden({ status: false });
    }

    const jobToUpdate = {        
        entityId: job.entityId,
        itemId: job.itemId,
        ...itemData,
        modifiedBy: userId,
    };
    
    const result = await jobsService.update(jobToUpdate);

    jsonLogger.info({ type: "TRACKING", function: "jobUpdateAttrs::handler", result });
    return responseLib.success(result);
};
