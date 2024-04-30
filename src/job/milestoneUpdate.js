'use strict';

const _ = require('lodash');
const { constants, jsonLogger, responseLib, JobsService, idConverterLib } = require('stoke-app-common-api');
const { getMilestone } = require('../helpers/jobHelper');

const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

module.exports.handler = async (event) => {
    jsonLogger.info({ type: "TRACKING", function: "milestoneUpdate::handler", event });
    const itemId = _.get(event, 'pathParameters.id');
    const { entityId, title, description, lineItems, timeReport } = JSON.parse(event.body) || {};
    if (!itemId || !entityId || (!title && !description && !lineItems && !timeReport)) {
        return responseLib.failure({ message: 'missing mandatory params in body' });
    }

    const jobId = idConverterLib.getJobIdFromMilestoneId(itemId);
    const userId = event.requestContext.identity.cognitoIdentityId;

    const milestone = await getMilestone(userId, entityId, jobId, itemId);
    if (!milestone) {
        return responseLib.forbidden({ status: false });
    }

    // we inserting the attributes directly to updateObject because we want jobService.generateUpdateItem to update only allowed itemData fields
    const milestoneToUpdate = {
        entityId: milestone.entityId,
        itemId: milestone.itemId,
        title,
        description,
        lineItems,
        timeReport,
        modifiedBy: userId,
    };

    const result = await jobsService.update(milestoneToUpdate);

    jsonLogger.info({ type: "TRACKING", function: "milestoneUpdate::handler", result });
    return responseLib.success(result);
};
