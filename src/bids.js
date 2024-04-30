/* eslint-disable max-lines */
/* eslint-disable complexity */
/* eslint-disable max-params */
/* eslint-disable consistent-return */

'use strict';


const _ = require('lodash');

const { asyncTasksQueueName, auditQueueName } = process.env;

const { jsonLogger, responseLib, constants, personalInfoLib, idConverterLib, SqsService, BidsService, JobsService, UsersService, SettingsService, CompaniesService } = require('stoke-app-common-api');

const bidsService = new BidsService(process.env.bidsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const asyncTasksQueue = new SqsService(asyncTasksQueueName);
const auditQueue = new SqsService(auditQueueName);

const { startConsumerCandidateChat, getTalentDetails } = require('./chat');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');
const { sendSNS } = require('./helpers/utils');

const SAVED_USIBILTY_TYPE = 'isSaved';
const HIDDEN_USIBILTY_TYPE = 'isHidden';
const VIEWED_USIBILTY_TYPE = 'isViewed';

const isStokeAdmin = async (userId) => {
  const keyConditionExpression = "userId = :userId";
  const expressionAttributeValues = { ":userId": userId };
  const userResult = await companiesService.query(process.env.gsiItemByUserIdIndexName, keyConditionExpression, expressionAttributeValues)
  return _.get(_.first(userResult), 'itemData.stokeAdmin', false)
}

/**
 * getBid - get bid by id
 * @param {object} event lambda event, event.queryStringParameters is the method data
 * @param {object} context - lambda context
 * @returns {object} bid
 */
module.exports.getBid = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const itemId = event.pathParameters.id;
  const { queryStringParameters } = event;
  let entityId = userId;

  if (queryStringParameters && queryStringParameters.entityId) {
    ({ entityId } = queryStringParameters);
  }

  jsonLogger.info({
    type: "TRACKING",
    function: "bids::getBid",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId, itemId, entityId, queryStringParameters
  });

  const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, null, { [permissionsComponentsKeys.jobs]: {} });
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }

  const result = await bidsService.get(entityId, itemId);
  return result ? responseLib.success(result) : responseLib.failure({ status: false });
};

/**
 * getBids - get bids by bid ids
 * @param {object} event lambda event, event.queryStringParameters is the method data
 * @param {object} context - lambda context
 * @returns {object} list of bids
 */
// eslint-disable-next-line max-lines-per-function
module.exports.getBids = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const { multiValueQueryStringParameters } = event;
  const { queryStringParameters } = event;
  const { entityId, getFavoriteBids, jobId } = queryStringParameters || {};
  jsonLogger.info({
    type: "TRACKING",
    function: "bids::getBids",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId, multiValueQueryStringParameters, queryStringParameters, entityId
  });

  const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, null, { [permissionsComponentsKeys.jobs]: {} });
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }

  if ((!multiValueQueryStringParameters || !multiValueQueryStringParameters.itemId) && !jobId) {
    return responseLib.failure({ message: 'missing itemId in query string' });
  }

  let ids = _.get(multiValueQueryStringParameters, 'itemId', []);
  if (jobId) {
    const job = await jobsService.get(entityId, jobId);
    if (!job) {
      jsonLogger.error({ type: "TRACKING", function: "bids::getBids", message: "job not exist", job });
      return responseLib.failure({ status: false });
    }
    const jobBids = _.get(job, 'itemData.bids', [])
    ids = Array.isArray(jobBids) ? jobBids : _.get(_(jobBids).value(), 'values')
  }

  const promises = ids.map((id) => bidsService.get(entityId, id));
  const result = await Promise.all(promises);

  try {
    if (getFavoriteBids) {
      const userSettings = await settingsService.get(`${constants.prefix.user}${userId}`)
      // eslint-disable-next-line no-extra-parens
      const { favorites } = (userSettings && userSettings.itemData) || {}
      const favoritesArray = favorites && Array.from(favorites.values || favorites)

      if (favoritesArray) {
        result.forEach((resultBid) => {
          if (favoritesArray.find((bid) => resultBid.itemId.endsWith(bid))) {
            resultBid.itemData.isFavorite = true;
          }
        })
      }
    }
  } catch (e) {
    jsonLogger.error({ type: "TRACKING", function: "bids::getBids", functionName: context.functionName, text: `exception - ${e.message}`, e });
  }

  return result ? responseLib.success(result) : responseLib.failure({ status: false });
};

/**
 * updateBid - update bid suitability
 * @param {object} event lambda event, event.queryStringParameters is the method data
 * @param {object} context - lambda context
 * @returns {object} list of bids
 */
// eslint-disable-next-line max-lines-per-function
module.exports.updateBid = async (event, context) => {
  const data = JSON.parse(event.body);
  const userId = event.requestContext.identity.cognitoIdentityId;
  const itemId = event.pathParameters.id;
  const { entityId, suitabilityType, suitabilityValue, ids, itemStatus } = data;
  const isSingleUpdate = !_.size(ids)
  const bidsIds = isSingleUpdate ? [itemId] : ids

  jsonLogger.info({
    type: "TRACKING",
    function: "bids::updateBid",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId, bidsIds, entityId, suitabilityType, suitabilityValue, itemStatus,
  });
  if (!_.size(bidsIds) || !entityId || ((!suitabilityType || !constants.candidateSuitabilityTypes[suitabilityType]) && !itemStatus)) {
    jsonLogger.error({
      type: "TRACKING",
      function: "bids::updateBid",
      functionName: context.functionName,
      awsRequestId: context.awsRequestId,
      message: 'missing or wrong input parameters',
      userId, bidsIds, entityId, suitabilityType, suitabilityValue
    });
    return responseLib.failure({ status: false });
  }

  const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, null, { [permissionsComponentsKeys.jobs]: { isEditor: true } });
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }

  const stokeAdmin = await isStokeAdmin(userId)

  // eslint-disable-next-line max-lines-per-function
  let results = _.map(bidsIds, async (bidId) => {
    const jobId = idConverterLib.getJobIdFromBidItemId(bidId)
    const job = await jobsService.get(entityId, jobId);
    if (
      !job || ![
        constants.job.status.pending,
        constants.job.status.posted
      ].includes(job.itemStatus)
    ) {
      jsonLogger.error({ type: "TRACKING", function: "bids::updateBid", message: "job not exist or on wrong status", job });
      return responseLib.failure({ status: false });
    }

    const bid = await bidsService.get(entityId, bidId);
    if (!bid) {
      jsonLogger.error({
        type: "TRACKING",
        function: "bids::updateBid",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        message: 'bid does not exist',
        bidId, entityId, bid
      });
      return responseLib.failure({ status: false });
    }
    jsonLogger.info({
      type: "TRACKING",
      function: "bids::updateBid",
      functionName: context.functionName,
      awsRequestId: context.awsRequestId,
      bid
    });

    const isOfferJob = _.get(job, 'itemData.jobFlow') === constants.jobFlow.offer;

    const { itemData } = bid;
    if (itemStatus) {
      const currentBidStatus = _.get(bid, 'itemStatus', constants.bidItemStatus.new);

      if (!_.includes(constants.bidItemStatusToAllowedStatuses[currentBidStatus], itemStatus)) {
        jsonLogger.error({ type: 'TRACKING', function: 'bids::updateBid', message: 'invalid status change', currentBidStatus, newStatus: itemStatus });
        return responseLib.failure({ status: false });
      }
    } else {
      let suitabilityValues = itemData[constants.candidateSuitabilityTypes[suitabilityType]] || [];
      let actionType = null;
      if (suitabilityValue &&
        (suitabilityType === HIDDEN_USIBILTY_TYPE || suitabilityType === SAVED_USIBILTY_TYPE)) {
        const suitabilityTypeToRemove = suitabilityType === HIDDEN_USIBILTY_TYPE ? constants.candidateSuitabilityTypes.isSaved : constants.candidateSuitabilityTypes.isHidden;
        _.set(itemData, `${suitabilityTypeToRemove}`, []);

        actionType = suitabilityType === HIDDEN_USIBILTY_TYPE ? constants.talentHistoryActionTypes.bidHidden : constants.talentHistoryActionTypes.bidSaved
      } else if (suitabilityValue && suitabilityType === VIEWED_USIBILTY_TYPE) {
        if (!_.includes(itemData[constants.candidateSuitabilityTypes.isViewed], userId)) {
          actionType = constants.talentHistoryActionTypes.bidViewed
        }

      }
      suitabilityValues = suitabilityValue ? suitabilityValues.concat([userId]) : suitabilityValues.filter((id) => id !== userId);
      _.set(itemData, `${constants.candidateSuitabilityTypes[suitabilityType]}`, suitabilityValues);

      if (!isOfferJob && actionType && !stokeAdmin) {
        await auditQueue.sendMessage({
          type: constants.audit.types.talentHistory, timestamp: Date.now(), companyId: job.companyId, itemData: {
            bidItemData: _.get(bid, 'itemData', {}),
            itemId: idConverterLib.getTalentIdFromBidId(bidId),
            jobId,
            actionType,
            userId,
          }
        })
      }
    }

    const updatedBidItem = {
      entityId,
      itemId: bidId,
      modifiedBy: userId,
      ...itemStatus ? { itemStatus } : { itemData },
    };

    return bidsService.update(updatedBidItem);
  })

  results = await Promise.allSettled(results)

  return results ? responseLib.success(isSingleUpdate ? _.first(results) : results) : responseLib.failure({ status: false });
};

const getContactActionDetails = async (candidate, job, userId, isOfferJob) => {

  let { email: talentEmail, name: talentFullName } = candidate;
  let talentUserId = null;
  if (isOfferJob) {
    const talentId = _.get(candidate, 'itemId');
    const companyId = _.get(job, 'companyId');
    ({ talentUserId, talentFullName, talentEmail } = await getTalentDetails(companyId, talentId));
  }

  const hiringManagerUserId = _.get(job, 'userId')
  const notHiringManager = userId !== hiringManagerUserId;
  const jobTitle = _.get(job, 'itemData.jobTitle')

  const companyDetails = await companiesService.get(`${constants.prefix.company}${job.companyId}`);
  jsonLogger.info({ type: "TRACKING", function: "bids::getContactActionDetails", companyDetails });
  const { entityName: companyName } = companyDetails.itemData;

  const [userConsumer] = await companiesService.listByUserId(process.env.gsiItemByUserIdIndexName, notHiringManager ? userId : hiringManagerUserId, constants.prefix.userPoolId);
  const { firstName: hiringManagerFirstName, fullName: hiringManagerFullName, email: hiringManagerUserEmail } = personalInfoLib.getConsumerPersonalInfo(userConsumer);

  return [{ hiringManagerUserId: notHiringManager ? userId : hiringManagerUserId, hiringManagerFirstName, hiringManagerFullName, talentUserId, talentFullName, talentEmail, hiringManagerUserEmail, companyName, jobTitle }, notHiringManager];
}

const isCreateChatRoomWithCandidateIsOn = async (companyId) => {
  const setting = await settingsService.get(`${constants.prefix.company}${companyId}`);
  const isChatFeatureActive = _.get(setting, "itemData.isChatFeatureActive", true);
  const createChatRoomWithCandidate = _.get(setting, "itemData.createChatRoomWithCandidate", false);
  jsonLogger.info({ type: "TRACKING", function: "bids::isCreateChatRoomWithCandidateIsOn", createChatRoomWithCandidate, isChatFeatureActive });
  return isChatFeatureActive && createChatRoomWithCandidate;
}

/**
 * updateBidOnContactCandidate - update bid suitability
 * @param {object} event lambda event, event.queryStringParameters is the method data
 * @param {object} context - lambda context
 * @returns {object} list of bids
 */
// eslint-disable-next-line max-lines-per-function
module.exports.updateBidOnContactCandidate = async (event, context) => {
  const data = JSON.parse(event.body);
  const userId = event.requestContext.identity.cognitoIdentityId;
  const itemId = event.pathParameters.id;
  const { entityId, suitabilityType, suitabilityValue, companyId, talentId } = data;

  jsonLogger.info({
    type: "TRACKING",
    function: "bids::updateBidOnContactCandidate",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId, itemId, entityId, suitabilityType, suitabilityValue, companyId, talentId
  });
  if (!itemId || !entityId || !suitabilityType || !constants.candidateSuitabilityTypes[suitabilityType]) {
    jsonLogger.error({
      type: "TRACKING",
      function: "bids::updateBidOnContactCandidate",
      functionName: context.functionName,
      awsRequestId: context.awsRequestId,
      message: 'missing or wrong input parameters',
      userId, itemId, entityId, suitabilityType, suitabilityValue
    });
    return responseLib.failure({ status: false });
  }

  if (!companyId || !talentId) {
    jsonLogger.error({ type: "TRACKING", function: "bids::updateBidOnContactCandidate", companyId, talentId, message: `one of the needed params for the chat room creation (companyId, talentId) is missing` });
    responseLib.failure({ status: false });
  }

  const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, null, { [permissionsComponentsKeys.jobs]: { isEditor: true } });
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }

  const jobId = idConverterLib.getJobIdFromBidItemId(itemId)
  const job = await jobsService.get(entityId, jobId);
  if (
    !job || ![
      constants.job.status.pending,
      constants.job.status.posted
    ].includes(job.itemStatus)
  ) {
    jsonLogger.error({ type: "TRACKING", function: "bids::updateBidOnContactCandidate", message: "job not exist or on wrong status", job });
    return responseLib.failure({ status: false });
  }

  const bid = await bidsService.get(entityId, itemId);

  if (!bid) {
    jsonLogger.error({
      type: "TRACKING",
      function: "bids::updateBidOnContactCandidate",
      functionName: context.functionName,
      awsRequestId: context.awsRequestId,
      message: 'bid does not exist',
      itemId, entityId, bid
    });
    return responseLib.failure({ status: false });
  }
  const isOfferJob = _.get(job, 'itemData.jobFlow') === constants.jobFlow.offer;

  const { email: talentEmail } = _.get(bid, 'itemData.candidate');

  jsonLogger.info({
    type: "TRACKING",
    function: "bids::updateBidOnContactCandidate",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    bid
  });

  if (!talentEmail && !isOfferJob) {
    jsonLogger.info({
      type: "TRACKING",
      function: "bids::updateBidOnContactCandidate",
      functionName: context.functionName,
      awsRequestId: context.awsRequestId,
      message: 'talentEmail does not exist',
      talentEmail
    });
    await sendSNS(companyId, entityId, jobId, talentId, userId, 'candidate is missing his talentEmail attribute');
  }

  const { itemData } = bid;
  let suitabilityValues = itemData[constants.candidateSuitabilityTypes[suitabilityType]] || [];
  suitabilityValues = suitabilityValue ? suitabilityValues.concat([userId]) : suitabilityValues.filter((id) => id !== userId);
  _.set(itemData, `${constants.candidateSuitabilityTypes[suitabilityType]}`, suitabilityValues);

  const updatedBidItem = {
    entityId,
    itemId,
    modifiedBy: userId,
    itemData
  };

  const result = await bidsService.update(updatedBidItem);

  jsonLogger.info({ type: "TRACKING", function: "bids::updateBidOnContactCandidate", talentEmail, isOfferJob, result });

  if (result && (talentEmail || isOfferJob)) {
    const candidate = _.get(result, 'Attributes.itemData.candidate', {});

    const [contactActionDetails, notHiringManager] = await getContactActionDetails(candidate, job, userId, isOfferJob);
    if (isOfferJob) {
      const { conversationId } = await startConsumerCandidateChat(job, talentId, contactActionDetails, notHiringManager, isOfferJob);
      jsonLogger.info({ type: "TRACKING", function: "bids::updateBidOnContactCandidate", conversationId });
      result.Attributes.conversationId = conversationId;
    } else {
      const isTalkJSChat = await isCreateChatRoomWithCandidateIsOn(companyId);
      if (isTalkJSChat) {
        const { conversationId, conversationExist, snsMessageInfo } = await startConsumerCandidateChat(job, talentId, contactActionDetails, notHiringManager);
        jsonLogger.info({ type: "TRACKING", function: "bids::updateBidOnContactCandidate", conversationId });
        if (!conversationExist) {
          await sendSNS(companyId, entityId, jobId, talentId, userId, snsMessageInfo);
        }
        result.Attributes.conversationId = conversationId;
      } else {
        const taskData = {
          companyId,
          entityId,
          jobId,
          talentId,
          userId,
          contactActionDetails
        }
        try {
          await asyncTasksQueue.sendMessage({ taskData, type: constants.sqsAsyncTasks.types.contactEmailNotification });
        } catch (e) {
          jsonLogger.error({ type: 'TRACKING', function: 'bids::updateBidOnContactCandidate', text: `exception - ${e.message}`, e });
        }
      }
    }

    if (!isOfferJob) {
      await auditQueue.sendMessage({
        type: constants.audit.types.talentHistory, timestamp: Date.now(), companyId: job.companyId, itemData: {
          bidItemData: _.get(bid, 'itemData', {}),
          itemId: talentId,
          jobId,
          actionType: constants.talentHistoryActionTypes.bidContacted,
          userId,
        }
      })
    }

    return responseLib.success(result)
  }
  responseLib.failure({ status: false });
};
