'use strict';

/* eslint-disable no-underscore-dangle */

const _get = require('lodash/get');
const { constants, jsonLogger, responseLib, tagsService, JobsService, idConverterLib } = require('stoke-app-common-api');
const { getMilestone } = require('../helpers/jobHelper');

const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

module.exports.handler = async (event) => {
    jsonLogger.info({ type: "TRACKING", function: "milestoneUpdateTags::handler", event });
    const itemId = _get(event, 'pathParameters.id');
    const { entityId, tags } = JSON.parse(event.body) || {};
    if (!itemId || !entityId || !tags) {
        return responseLib.failure({ message: 'missing mandatory params in body' });
    }

    if (!tagsService.validate(tags)) {
        return responseLib.failure({ status: false, message: "tags are not valid" });
    }

    const jobId = idConverterLib.getJobIdFromMilestoneId(itemId);
    const userId = event.requestContext.identity.cognitoIdentityId;

    const milestone = await getMilestone(userId, entityId, jobId, itemId);
    if (!milestone) {
        return responseLib.forbidden({ status: false });
    }
    
    const milestoneToUpdate = {        
        entityId: milestone.entityId,
        itemId: milestone.itemId,
        tags,
        modifiedBy: userId,
    };

    const result = await jobsService.update(milestoneToUpdate);

    jsonLogger.info({ type: "TRACKING", function: "milestoneUpdateTags::handler", result });
    return responseLib.success(result);
};
