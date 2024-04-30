/* eslint-disable no-magic-numbers */

'use strict';

const _ = require("lodash");
const { constants, jsonLogger, responseLib, tagsService, JobsService, teamsService } = require('stoke-app-common-api');
const { getJob } = require('../helpers/jobHelper');

const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const resolveUpdatedTags = ({ tags, isBulkAction, isOverrideTags, jobTags, isTagsWithId }) => {
  if (isBulkAction && isOverrideTags) {
    return { ...jobTags, ...tags }

  } else if (isBulkAction && !isOverrideTags) {
    // eslint-disable-next-line consistent-return
    return _.mergeWith(jobTags, tags, (arr1, arr2) => {
        if (_.isArray(arr1)) {
            const mergedArray = _.concat(arr1, arr2);
          return isTagsWithId ? _.uniqBy(mergedArray, 'id') : _.uniq(mergedArray);
        }
      });

  }
  return tags
}

// eslint-disable-next-line max-params
const updateJobTag = async ({ userId, entityId, itemId, tags, isBulkAction, isOverrideTags, isTagsWithId }) => {

    const job = await getJob(userId, entityId, itemId, true);
    if (!job) {
        return constants.httpStatusCodes.FORBIDDEN;
    }

    const updatedTags = resolveUpdatedTags({ tags, isBulkAction, isOverrideTags, jobTags: _.get(job, 'tags'), isTagsWithId })

    const jobToUpdate = {        
        entityId: job.entityId,
        itemId: job.itemId,
        tags: updatedTags,
        modifiedBy: userId,
    };

    const teams = teamsService.get(job);
    if (!_.isEmpty(teams)) {
        teamsService.set(jobToUpdate, teams);
    }


    const result = await jobsService.update(jobToUpdate);

    jsonLogger.info({ type: "TRACKING", function: "jobUpdateTags::updateJobTag", result });
    return _.isEmpty(result) ? constants.httpStatusCodes.INTERNAL_SERVER_ERROR : result

}

module.exports.handler = async (event) => {
    jsonLogger.info({ type: "TRACKING", function: "jobUpdateTags::handler", event });

    const userId = event.requestContext.identity.cognitoIdentityId;
    const itemId = event.pathParameters.id;
    const { entityId, tags, jobsIdentifiers, isOverrideTags, isTagsWithId } = JSON.parse(event.body) || {};
    jsonLogger.info({ type: "TRACKING", function: "jobUpdateTags::handler", userId, itemId, entityId, tags, jobsIdentifiers });

    const isBulkAction = Array.isArray(jobsIdentifiers) && !_.isEmpty(jobsIdentifiers);

    if (!tagsService.validate(tags)) {
        return responseLib.failure({ status: false, message: "tags are not valid" });
    }

    const jobsIdentifiersArray = isBulkAction ? jobsIdentifiers : [{ entityId, itemId: itemId }];

    let results = []
    results = await Promise.all(_.map(jobsIdentifiersArray, currentIdentifier => updateJobTag({ 
          userId,
          entityId: _.get(currentIdentifier, 'entityId'),
          itemId: _.get(currentIdentifier, 'itemId'),
          tags,
          isBulkAction,
          isOverrideTags,
          isTagsWithId
        })));
    if (results.some(res => res && !_.includes([constants.httpStatusCodes.INTERNAL_SERVER_ERROR, constants.httpStatusCodes.FORBIDDEN], res))) {
        return responseLib.success(isBulkAction ? results : results[0])
    }
  
    return results.every(res => res === constants.httpStatusCodes.FORBIDDEN)
    ? responseLib.forbidden({ status: false })
    : responseLib.failure({ status: false })
};
