/* eslint-disable no-magic-numbers */
/* eslint-disable max-params */

'use strict';

const _ = require('lodash')
const dayjs = require('dayjs');
const { UsersService, CompanyProvidersService, SqsService, jsonLogger, responseLib, constants, legalDocsHelper } = require('stoke-app-common-api');
const {
  consumerAuthTableName,
  companyProvidersTableName,
  gsiItemByUserIdIndexName,
  callToActionQueueName,
} = process.env;

const callToActionQueue = new SqsService(callToActionQueueName);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const isLegalDocumentExpiringSoon = document => [
  constants.legalDocs.status.signed,
  constants.legalDocs.status.sent
].includes(document.status) &&
  document.expirationDate &&
  dayjs().diff(dayjs(document.expirationDate), 'month') >= 0

const isDeleted = ({ status }) => status === constants.legalDocs.status.deleted

const checkAndSendDocsExpirationCallToActionNotification = async (companyId, providerId, legalDocuments) => {
  const isProviderHasExpiredAndNotCoveredLegalDocs = _.some(legalDocuments, (legalDocument) => legalDocument.isExpired && !legalDocument.isExpiredCoverd);
  if (!isProviderHasExpiredAndNotCoveredLegalDocs) {
      await callToActionQueue.sendMessage({
          itemId: providerId,
          companyId,
          type: constants.callToActions.types.legalDocsExpired,
          action: constants.callToActions.actions.delete,
      })
  }
}

const isDocsSame = (doc1, doc2) => doc1.name === doc2.name && doc1.legalEntityName === doc2.legalEntityName

// eslint-disable-next-line max-lines-per-function
const providerInnerAddLegalDocs = async (itemId, userId, companyId, legalDocuments, isBulkAction) => {
  jsonLogger.info({ type: "TRACKING", function: "providerAddLegalDocs::providerInnerAddLegalDocs", itemId, userId, companyId, legalDocuments, isBulkAction });

  const companyProvider = await companyProvidersService.get(companyId, itemId);
  if (!companyProvider) {
    return { statusCode: constants.httpStatusCodes.INTERNAL_SERVER_ERROR, message: 'No such provider' }
  }

  const originalLegalDocuments = _.get(companyProvider, 'itemData.legalDocuments', []);
  
  const newDocumentsToAdd = isBulkAction ? _.filter(legalDocuments, doc => _.every(
    originalLegalDocuments,
    originalDoc => originalDoc.name !== doc.name || isDeleted(originalDoc) || isLegalDocumentExpiringSoon(originalDoc)
  )) : legalDocuments
  
  const newDocuments = _.map(newDocumentsToAdd, doc => {
    const lastSignedExpiredNotCoverdDocIndex = _.findLastIndex(originalLegalDocuments, originalDoc => isDocsSame(originalDoc, doc) && originalDoc.isExpired && !originalDoc.isExpiredCoverd);
    // eslint-disable-next-line no-undefined, init-declarations
    let resendDocOriginalId;
    let isResend = false;
    if (lastSignedExpiredNotCoverdDocIndex !== -1) {
      originalLegalDocuments[lastSignedExpiredNotCoverdDocIndex].isExpiredCoverd = true;
      resendDocOriginalId = originalLegalDocuments[lastSignedExpiredNotCoverdDocIndex].signature_request_id;
      isResend = true;
    }
    return {
      ..._.omit(doc, 'signature_request_id'),
    ...isResend && { resendData: { isResend: true, signatureRequestId: resendDocOriginalId, resendDate: Date.now() } },
      requestedByUserId: userId
    }
  });

  const updatedLegalDouments = [
    ...originalLegalDocuments,
    ...newDocuments
  ];

  await checkAndSendDocsExpirationCallToActionNotification(companyId, itemId, updatedLegalDouments);

  const companyProviderToUpdate = {
    ...companyProvider,
    itemData: {
      ...companyProvider.itemData,
      legalDocuments: updatedLegalDouments,
    },
    modifiedBy: userId,
  };

  const result = await companyProvidersService.update(companyProviderToUpdate);
  await legalDocsHelper.handler(gsiItemByUserIdIndexName, companyProviderToUpdate, companyProvider);

  jsonLogger.info({ function: "providerAddLegalDocs::providerInnerAddLegalDocs", result });
  result.isNewDocsAdded = !_.isEmpty(newDocuments)
  result.itemId = itemId
  return result
}

/**
 * add legal documents to provider
 * @param {object} event of request 
 * @param {object} context lambda context
 * @returns {object} updated item
 */
module.exports.handler = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const data = JSON.parse(event.body);
  const itemId = _.get(event, 'pathParameters.id');
  const { companyId, legalDocuments, ids } = data;
  const isBulkAction = _.size(ids) && !itemId
  const talentIds = isBulkAction ? ids : [itemId]
  jsonLogger.info({
    function: "addLegalDocs::handler",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    companyId, userId, itemId, legalDocuments, ids, talentIds, isBulkAction
  });

  if (!companyId || _.isEmpty(legalDocuments) || !_.size(talentIds)) {
    return responseLib.failure({ message: 'missing key params in event' });
  }

  const { role } = await usersService.getCompanyUserAuthRole(userId, companyId, true);
  if (role === constants.user.role.unauthorised) {
    return responseLib.forbidden({ status: false });
  }

  let results = []
  for (const talentId of talentIds) {
    results.push(providerInnerAddLegalDocs(talentId, userId, companyId, legalDocuments, isBulkAction))
  }
  results = await Promise.all(results)

  if (results.some(res => res && res.statusCode !== constants.httpStatusCodes.INTERNAL_SERVER_ERROR)) {
    return responseLib.success(isBulkAction ? results : _.first(results))
  }

  return responseLib.failure({ status: false })
}
