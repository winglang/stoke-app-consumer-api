/* eslint-disable max-lines */
/* eslint-disable no-await-in-loop */
/* eslint-disable require-atomic-updates */
/* eslint-disable no-undefined */
/* eslint-disable max-lines-per-function */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-magic-numbers */

'use strict';

const _ = require('lodash');
const uuidv1 = require('uuid/v1');
const {
  UsersService, TalentsService, CompanyProvidersService, SettingsService, ProvidersService,
  jsonLogger, responseLib, constants, cognitoLib, formatterLib, SqsService, JobsService, taxFormsHelper, prefixLib, idConverterLib, legalDocsHelper, settingsGetterHelper, permisionConstants
} = require('stoke-app-common-api');
const jobHelper = require('./helpers/jobHelper');
const { getProviderEffectiveItemStatus } = require('./helpers/utils');
const complianceHelper = require('./helpers/complianceHelper');
const { updateCompanyProvider: updateOrCreateCompanyProvider } = require('./jobs');
const { PAYABLE_STATUS_FIELD } = require('stoke-app-common-api/config/constants');
const { getPayableStatusInfo } = require('stoke-app-common-api/helpers/payableStatusHelper');

const {
  PROVIDER_USER_POOL_ID,
  gsiItemsByExternalUserIdIndexName,
  jobsTableName,
  gsiItemsByCompanyIdAndItemIdIndexNameV2,
  consumerAuthTableName,
  providersTableName,
  companyProvidersTableName,
  talentsTableName,
  settingsTableName,
  gsiItemByUserIdIndexName,
} = process.env;

const asyncTasksQueue = new SqsService(process.env.asyncTasksQueueName);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const minimalDataProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.providerMinimalAttributes);
const talentsService = new TalentsService(talentsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const providersService = new ProvidersService(providersTableName, [
  'externalUserId',
  ...constants.projectionExpression.providerAttributes
], { externalUserId: 'externalUserId', ...constants.attributeNames.providerAttributes });

const PROVIDER_FIELDS = {
  providerContactFirstName: 'providerContactFirstName',
  providerContactLastName: 'providerContactLastName',
  providerName: 'providerName',
  providerEmail: 'providerEmail',
  providerPhoneNumber: 'providerPhoneNumber',
  isProviderSelfEmployedTalent: 'isProviderSelfEmployedTalent',
  defaultLegalTemplates: 'defaultLegalTemplates',
  legalDocuments: 'legalDocuments',
  departments: 'departments',
  isHireByStoke: 'isHireByStoke',
  enrollData: 'enrollData',
}

const PROVIDER_TALENT_FIELDS = {
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  providerId: 'providerId',
  isProviderSelfEmployedTalent: 'isProviderSelfEmployedTalent',
  defaultLegalTemplates: 'defaultLegalTemplates',
  legalDocuments: 'legalDocuments',
  departments: 'departments',
  isHireByStoke: 'isHireByStoke',
}

const forbidden = 'FORBIDDEN';

const enrichProvidersForStartJob = (companyProviders, settings, isCompanyAdmin) => {
  const { isWorkforceNonCompliantBlocked, isNonLegalCompliantBlocked } = settingsGetterHelper.getNonCompliantBlockedSetting(settings);
  let providersToEnrich = companyProviders;

  if (isWorkforceNonCompliantBlocked || isNonLegalCompliantBlocked) {
    const providersByItemId = _.keyBy(companyProviders, 'itemId');
    providersToEnrich = _.map(companyProviders, provider => {
      const complianceSource =
        provider.itemData.isProviderSelfEmployedTalent && !prefixLib.isProvider(provider.itemId)
          ? _.get(providersByItemId, [idConverterLib.getProviderIdFromTalentId(provider.itemId)])
          : provider

      const isTalentUnderCompany = !provider.itemData.isProviderSelfEmployedTalent && prefixLib.isTalent(provider.itemId);
      const additionalSource = isTalentUnderCompany && _.get(providersByItemId, [idConverterLib.getProviderIdFromTalentId(provider.itemId)]);
      return {
        ...provider,
        [jobHelper.ALLOWED_ACTIONS]: jobHelper.getAllowedActionsByType(provider, [jobHelper.ACTION_MENU_OPTIONS.startJob, jobHelper.ACTION_MENU_OPTIONS.requestPayment], undefined, provider.itemId, settings, complianceSource, isCompanyAdmin, additionalSource)
      }
    })
  }
  return providersToEnrich;
}

const excludedAttrs = (companyProviders) => {
  _.each(companyProviders, (provider) => {
    _.set(provider, 'itemData', _.omit(provider.itemData, ['workforceCompliance']))
  })
}

const getCompanyProviders = async (event, context) => {
  jsonLogger.info({ type: "TRACKING", function: "companyProviders::getCompanyProviders", event, context });
  const userId = event.requestContext.identity.cognitoIdentityId;
  const { queryStringParameters } = event;
  const { companyId, filter, itemId, isFetchCompanyTalentData } = queryStringParameters;
  const isFetchMinimalData = queryStringParameters.isFetchMinimalData && JSON.parse(queryStringParameters.isFetchMinimalData);
  jsonLogger.info({
    function: "companyProviders::getCompanyProviders",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId, companyId, filter, isFetchMinimalData
  });
  if (!companyId) {
    return responseLib.failure({ message: 'missing companyId in query string' });
  }

  const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { } });
  if (role === constants.user.role.unauthorised) {
    return responseLib.forbidden({ status: false });
  }
  const isCompanyAdmin = constants.user.role.admin === role;
  const result = { companyProviders: [] };
  const settings = await settingsService.get(`${constants.prefix.company}${companyId}`);
  if (itemId) {
    let companyProvider = await companyProvidersService.get(companyId, itemId);
    if (prefixLib.isProvider(itemId)) {
      const hasUpToDateTaxForm = _.get(taxFormsHelper.isThisProviderHaveAnExemptTaxFile(companyProvider, true), 'taxFormStatus', false);
      companyProvider = _.set(companyProvider, 'itemData.hasUpToDateTaxForm', hasUpToDateTaxForm);
    }
    const talentsWithJobs = await jobHelper.getTalentsWithOpenJobs(companyId, itemId)

    companyProvider = _.set(companyProvider, 'itemStatus', jobHelper.updateProviderStatusToActive(talentsWithJobs, _.get(companyProvider, 'itemStatus'), itemId))

    const itemForComplianceScore =
      companyProvider.itemData.isProviderSelfEmployedTalent && !prefixLib.isProvider(companyProvider.itemId)
        ? await companyProvidersService.get(companyId, idConverterLib.getProviderIdFromTalentId(companyProvider.itemId))
        : companyProvider

    const isTalentUnderCompany = !companyProvider.itemData.isProviderSelfEmployedTalent && prefixLib.isTalent(companyProvider.itemId);
    const additionalSource = isTalentUnderCompany && await companyProvidersService.get(companyId, idConverterLib.getProviderIdFromTalentId(companyProvider.itemId));
    const isProviderSelfEmployedTalent = companyProvider.itemData.isProviderSelfEmployedTalent && prefixLib.isTalent(companyProvider.itemId);
    const talentsProvider = isProviderSelfEmployedTalent && await companyProvidersService.get(companyId, idConverterLib.getProviderIdFromTalentId(companyProvider.itemId));
    const providerSource = additionalSource ? additionalSource : talentsProvider;
    companyProvider[jobHelper.ALLOWED_ACTIONS] = jobHelper.getActionMenuOptions(companyProvider, talentsWithJobs, itemId, settings, itemForComplianceScore, isCompanyAdmin, additionalSource);
    companyProvider[PAYABLE_STATUS_FIELD] = getPayableStatusInfo(providerSource ? providerSource : companyProvider, settings);

    if (isFetchCompanyTalentData) {
      const companyTalents = await companyProvidersService.listCompany(companyId, `${constants.prefix.talent}${itemId}`);
      _.forEach(companyTalents, talent => {
        talent[complianceHelper.COMPLIANCE_INFO] = complianceHelper.getComplianceInfo(talent)
      })
      companyProvider[complianceHelper.COMPLIANCE_INFO] = complianceHelper.getComplianceInfo(itemForComplianceScore, companyTalents)
      result.companyProviders = [companyProvider];
      result.companyProviders = result.companyProviders.concat(companyTalents);
    } else {
      companyProvider[complianceHelper.COMPLIANCE_INFO] = complianceHelper.getComplianceInfo(itemForComplianceScore);
      result.companyProviders = [companyProvider];
    }
  } else {
    const providerServiceToUse = isFetchMinimalData ? minimalDataProvidersService : companyProvidersService;
    const ExpressionAttributeNames = isFetchMinimalData ? { [`#${constants.queryProjectionExpression.companyProvider.name}`]: `${constants.queryProjectionExpression.companyProvider.name}` } : undefined;
    const companyProviders = await providerServiceToUse.companyProvidersPagination('listCompany', [
      companyId,
      filter,
      undefined,
      ExpressionAttributeNames
    ]);

    excludedAttrs(companyProviders);
    result.companyProviders = enrichProvidersForStartJob(companyProviders, settings, isCompanyAdmin);
  }

  return result.companyProviders ? responseLib.success(result) : responseLib.failure({ status: false });
}

/**
 * generate company provider - can be talent in provider or provider
 * @param {string} prefix of item in table
 * @param {string} itemId of item in table
 * @param {string} userId of item in table
 * @param {string} companyId of item in table
 * @param {object} itemData of item in table. provider email provider name
 * @returns {object} new item
 */
// eslint-disable-next-line max-params
const generateCompanyProvider = (prefix, itemId, userId, hiringManagerId, companyId, itemData, itemStatus = constants.companyProvider.status.inactive, externalUserId, tags) => {
  const uuid = itemData && itemData[PROVIDER_FIELDS.providerName] ? formatterLib.formatName(itemData[PROVIDER_FIELDS.providerName]) + uuidv1() : uuidv1();
  let key = {
    companyId,
    itemId: `${prefix}${itemId || uuid}`,
    itemStatus,
    itemData: itemData,
    createdBy: hiringManagerId || userId,
    modifiedBy: hiringManagerId || userId,
    tags
  };
  key = externalUserId ? { ...key, externalUserId } : key;
  jsonLogger.log('info', { type: 'TRACKING', function: 'companyProviders::generateCompanyProvider', key });
  return key;
}

/**
 * generate talent in talent table for talent in provider
 * @param {*} providerId - parent of talent
 * @param {*} userId create the item
 * @param {*} itemData of talent - name, email etc.
 * @returns {object} new item
 */
const generateTalent = (providerId, userId, itemData) => {
  const itemId = `${constants.prefix.talent}${providerId}${constants.prefix.talent}${uuidv1()}`;
  const key = {
    itemId,
    itemData,
    createdBy: userId,
    modifiedBy: userId,
  };
  jsonLogger.log('info', { type: 'TRACKING', function: 'companyProviders::generateTalent', key });
  return key;
}

const TALENT_FIELDS = {
  firstName: 'firstName',
  lastName: 'lastName',
}

const isValidTalentItemData = (talentItemData) => talentItemData[TALENT_FIELDS.firstName] && talentItemData[TALENT_FIELDS.lastName];
const shouldTalentBeCreated = (talentItemData) => _.get(talentItemData, 'isProviderSelfEmployedTalent') || !talentItemData.isProvider;

const appendCompanyToProvider = (existingProvider, companyId, compProviderId) => ({
  ...existingProvider,
  itemData: {
    ...existingProvider.itemData,
    companyList: [
      ...existingProvider.itemData.companyList,
      {
        companyId,
        itemId: compProviderId.startsWith(constants.prefix.provider)
          ? compProviderId.substring(constants.prefix.provider.length)
          : compProviderId
      }
    ]
  }
});

// eslint-disable-next-line max-params
const createCompanyProvider = async (companyId, data, itemStatus, userId, hiringManagerId, tags) => {
  jsonLogger.info({ function: "companyProviders::createCompanyProvider", companyId, data, itemStatus, userId, hiringManagerId, tags });
  const { providerEmail } = data;
  let effectiveItemStatus = itemStatus;
  // eslint-disable-next-line no-await-in-loop
  const cognitoUser = await cognitoLib.getUser(PROVIDER_USER_POOL_ID, providerEmail);
  // eslint-disable-next-line no-await-in-loop
  const existingProvider = cognitoUser && await providersService.getByExternalUserId(gsiItemsByExternalUserIdIndexName, providerEmail);
  if (existingProvider) {
    const existingCompanyList = _.get(existingProvider, 'itemData.companyList', []);
    jsonLogger.info({ function: "companyProviders::createCompanyProviders", providerEmail, existingProvider: Boolean(existingProvider), existingCompanyList, provider: existingProvider });
    if (existingCompanyList.length) {
      effectiveItemStatus = constants.companyProvider.status.registered;
    }
  }
  const providerItemData = { ..._.pick(data, Object.values(PROVIDER_FIELDS)), [PROVIDER_FIELDS.providerEmail]: _.get(data, PROVIDER_FIELDS.providerEmail, '').toLowerCase() };
  providerItemData.isPayable = _.get(existingProvider, 'itemData.isPayable');
  providerItemData.img = _.get(existingProvider, 'itemData.img', null);

  const provider = generateCompanyProvider(constants.prefix.provider, null, userId, hiringManagerId, companyId, providerItemData, effectiveItemStatus, null, tags);
  if (effectiveItemStatus === constants.companyProvider.status.registered) {
    const updatedExistingProvider = appendCompanyToProvider(existingProvider, companyId, provider.itemId);
    jsonLogger.info({ function: "companyProviders::createCompanyProviders", message: 'updating existing provider', updatedExistingProvider });
    // eslint-disable-next-line no-await-in-loop
    await providersService.update(updatedExistingProvider);
  }
  return provider
}

// eslint-disable-next-line max-params
const createCompanyProviderTalent = async (companyId, providerId, data, itemStatus, userId, hiringManagerId) => {
  jsonLogger.info({ function: "companyProviders::createCompanyProviderTalent", companyId, providerId, data, itemStatus, userId, hiringManagerId });
  const talentItemData = _.omit(data, Object.values(PROVIDER_FIELDS));
  const talent = generateTalent(providerId, userId, talentItemData);
  data.providerId = providerId;
  const itemDataProviderTalent = { ..._.pick(data, Object.values(PROVIDER_TALENT_FIELDS)), [PROVIDER_TALENT_FIELDS.email]: _.get(data, PROVIDER_TALENT_FIELDS.email, '').toLowerCase() };
  itemDataProviderTalent.img = _.get(talent, 'itemData.img', null);
  const companyTalent = generateCompanyProvider('', talent.itemId, userId, hiringManagerId, companyId, itemDataProviderTalent, itemStatus);
  await legalDocsHelper.handler(gsiItemByUserIdIndexName, companyTalent);
  return { talent, companyTalent };
}

const isEmailExists = async (companyId, email) => {
  if (!email) {
    return false;
  }
  const companyProviders = await companyProvidersService.getByEmail(companyId, email, 'providerEmail', constants.prefix.provider);
  return !_.isEmpty(companyProviders);
}

const getLegalDocsToSend = (providerData, talentItemData) => {
  const isSelfEmployed = _.get(talentItemData, 'isProviderSelfEmployedTalent')
  const talentLegalDocs = _.get(talentItemData, 'legalDocuments', [])

  const providerEmaill = _.get(providerData, 'providerEmail')
  const talentEmail = _.get(talentItemData, 'providerEmail')
  const isSameEmail = talentEmail && providerEmaill && providerEmaill.toLowerCase() === talentEmail.toLowerCase()

  if (!isSelfEmployed && isSameEmail) {
    const providerLegalDocsNames = _.map(_.get(providerData, 'legalDocuments', []), (doc) => doc.name)
    const legalDocsNotSentByProvider = _.filter(talentLegalDocs, (doc) => !providerLegalDocsNames.includes(doc.name))
    return legalDocsNotSentByProvider
  }
  
  return talentLegalDocs
}

/**
 * create Company Providers - list of talent in provider with name of their provider
 * @param {object} event request
 * @param {object} context lambda context
 * @returns {object} new itemm 
 */
const createCompanyProviders = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const data = JSON.parse(event.body);
  const { companyId, itemStatus, items } = data;
  jsonLogger.info({ function: "companyProviders::createCompanyProviders", companyId, userId, data, event, context });
  if (!companyId) {
    return responseLib.failure({ message: 'missing companyId in path parameters' });
  }
  const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } });
  if (role === constants.user.role.unauthorised) {
    return responseLib.forbidden({ status: false });
  }

  const compProviders = [];
  const talents = [];

  const providersDataLists = _.groupBy(items, (item) => `${item[PROVIDER_FIELDS.providerName]} ${item.providerId}`);
  for (const key of Object.keys(providersDataLists)) {
    let newProvider = null;
    let companyProviderData = null;
    const providerDataList = providersDataLists[key];
    // eslint-disable-next-line prefer-const
    let { providerId, hiringManagerId, providerEmail } = providerDataList[0];
    const isMarketPlace = Object.values(constants.marketplaces).some((mrkt) => providerId && providerId.includes(mrkt.provider));
    // eslint-disable-next-line no-await-in-loop
    let effectiveItemStatus = await getProviderEffectiveItemStatus(companyId, itemStatus, isMarketPlace);
    if (providerId) {
      // eslint-disable-next-line no-await-in-loop
      const provider = await companyProvidersService.get(companyId, providerId);
      if (!provider) {
        jsonLogger.error({ type: 'TRACKING', function: 'companyProviders::processCompanyProviders', exception: 'Try to add talent to provider is not exists', providerId, providerDataList });
        return responseLib.failure({ status: false });
      }
      effectiveItemStatus = provider.itemStatus;
      companyProviderData = provider.itemData;
    } else {
      // eslint-disable-next-line no-await-in-loop
      if (await isEmailExists(companyId, providerEmail)) {
        jsonLogger.info({ type: 'TRACKING', function: 'companyProviders::processCompanyProviders', message: 'Email address is already used by another provider', providerEmail, providerDataList });
        return responseLib.failure({ status: false, message: "Email address is already used by another provider" });
      }
      const providerItem = _.find(providerDataList, (item) => item.isProvider) || providerDataList[0];
      const providerItemData = _.pick(providerItem, Object.values(PROVIDER_FIELDS));
      // eslint-disable-next-line no-await-in-loop
      newProvider = await createCompanyProvider(companyId, providerItemData, effectiveItemStatus, userId, hiringManagerId, providerItem.providerTags)
      providerId = newProvider.itemId;
      compProviders.push(newProvider);
      companyProviderData = newProvider.itemData;
    }

    for (const providerData of providerDataList) {
      if (isValidTalentItemData(providerData) && shouldTalentBeCreated(providerData)) {  
        providerData.legalDocuments = getLegalDocsToSend(companyProviderData, providerData)
        const { talent, companyTalent } = await createCompanyProviderTalent(companyId, providerId, providerData, effectiveItemStatus, userId, hiringManagerId);
        talents.push(talent);
        compProviders.push(companyTalent);
      }
    }

    if (newProvider) {
      await legalDocsHelper.handler(gsiItemByUserIdIndexName, newProvider);
    }
  }
  const providersResult = await companyProvidersService.batchCreate(compProviders);
  const talentsResult = await talentsService.batchCreate(talents);
  return talentsResult !== null && providersResult ? responseLib.success({ providersResult, talentsResult }) : responseLib.failure({ status: false });
};

// eslint-disable-next-line newline-per-chained-call
const assignAttribute = (source, name, value) => _.chain(source).get(name).assign(value).value();

// remove signature_request_id and status (except for "deleted")
const omitReadOnlyAttributes = (doc) => _.omitBy(doc, (value, key) => key === "signature_request_id" || (key === "status" && value !== "deleted"))

const isSameDocument = (doc1, doc2) => {
  const isSameName = doc1.name === doc2.name && doc1.legalEntityName === doc2.legalEntityName;
  const isSameDocuSignId = !doc1.signature_request_id || !doc2.signature_request_id || doc1.signature_request_id === doc2.signature_request_id;
  return isSameName && isSameDocuSignId;
}

const assignItemData = (companyProvider, requestItemData) => {
  const legalDocuments = _.get(companyProvider, 'itemData.legalDocuments', []);
  const legalDocumentsRequest = _.get(requestItemData, 'legalDocuments', []);

  const legalDocumentsUpdated = _.isEmpty(legalDocumentsRequest)
    ? legalDocuments
    : _.map(legalDocumentsRequest, (docRequest) => {
      const existingDoc = _.find(legalDocuments, (doc) => isSameDocument(doc, docRequest));
      return existingDoc
        ? { ...existingDoc, ...omitReadOnlyAttributes(docRequest) }
        : docRequest;
    });

  const itemDataResult = assignAttribute(companyProvider, 'itemData', requestItemData);
  itemDataResult.legalDocuments = legalDocumentsUpdated;
  return itemDataResult;
}

const resolveUpdatedTags = ({ tags, isBulkAction, isOverrideTags, providerTags, isTagsWithId }) => {
  if (isBulkAction && isOverrideTags) {
    return { ...providerTags, ...tags }

  } else if (isBulkAction && !isOverrideTags) {
    // eslint-disable-next-line consistent-return
    return _.mergeWith(providerTags, tags, (arr1, arr2) => {
        if (_.isArray(arr1)) {
            const mergedArray = _.concat(arr1, arr2);
          return isTagsWithId ? _.uniqBy(mergedArray, 'id') : _.uniq(mergedArray);
        }
      });

  }
  return tags
}

const updateCompanyProviderData = async ({ companyId, itemId, userId, data, requestItemData, requestTags, isOverrideTags, isTagsWithId, isBulkAction }) => {
  const companyProviderPrevious = await companyProvidersService.get(companyId, itemId);
  const companyProvider = _.cloneDeep(companyProviderPrevious)
  
  const companyProviderUpdated = {
    companyId,
    itemId: itemId,
    entityId: data.entityId,
    itemStatus: data.itemStatus,
    itemData: assignItemData(companyProvider, requestItemData),
    modifiedBy: userId,
    createdBy: _.get(companyProviderPrevious, 'createdBy'),
    tags: isBulkAction ? resolveUpdatedTags({
      tags: requestTags,
      isBulkAction,
      isOverrideTags,
      isTagsWithId,
      providerTags: _.get(companyProvider, 'tags'),
    }) : assignAttribute(companyProvider, 'tags', requestTags),
  };

  let result = await companyProvidersService.update(companyProviderUpdated);
  await legalDocsHelper.handler(gsiItemByUserIdIndexName, companyProviderUpdated, companyProviderPrevious);
  await legalDocsHelper.reflectLegalDocsChanges(companyProviderUpdated, companyProviderPrevious);

  if (result && 
      data.itemStatus === constants.companyProvider.status.registered && 
      itemId.startsWith(constants.prefix.talent) && 
      _.get(companyProvider, 'itemData.isProviderSelfEmployedTalent') && 
      _.get(companyProvider, 'itemStatus') === constants.companyProvider.status.inactive) {
    jsonLogger.info({ function: "companyProviders::updateCompanyProvider", message: 'talent status was updated to registered, updating the parent provider status to the same' });
    const providerId = idConverterLib.getProviderIdFromTalentId(itemId);
    result = await companyProvidersService.update({
      companyId,
      itemId: providerId,
      itemStatus: data.itemStatus,
      modifiedBy: userId,
    });
  }

  jsonLogger.info({ function: "companyProviders::updateCompanyProvider", result });
  return result ? result : constants.httpStatusCodes.INTERNAL_SERVER_ERROR;
}

/**
 * update company provider
 * @param {object} event of request 
 * @param {object} context lambda context
 * @returns {object} updated item
 */
const updateCompanyProvider = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const data = JSON.parse(event.body);
  const itemId = event.pathParameters.id;
  const { companyId, itemData: requestItemData, tags: requestTags, ids, isOverrideTags, isTagsWithId } = data;
  jsonLogger.info({
    function: "companyProviders::updateCompanyProvider",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    companyId, userId, itemId, data, isOverrideTags, isTagsWithId 
  });

  if (!companyId || !itemId) {
    return responseLib.failure({ message: 'missing key params in event' });
  }
  const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } });
  if (role === constants.user.role.unauthorised) {
    return responseLib.forbidden({ status: false });
  }

  const isBulkAction = _.size(ids) && Array.isArray(ids);
  const providerIds = isBulkAction ? ids : [itemId];

  jsonLogger.info({ function: "companyProviders::updateCompanyProvider", providerIds });

  let results = []
  results = await Promise.all(_.map(providerIds, id => updateCompanyProviderData({
    companyId, itemId: id, userId, data, requestItemData, requestTags, isOverrideTags, isTagsWithId, isBulkAction
  })));

  if (results.some(res => res && !_.includes([constants.httpStatusCodes.INTERNAL_SERVER_ERROR, constants.httpStatusCodes.FORBIDDEN], res))) {
    return responseLib.success(isBulkAction ? results : results[0])
  }

return results.every(res => res === constants.httpStatusCodes.FORBIDDEN)
? responseLib.forbidden({ status: false })
: responseLib.failure({ status: false })
 
}

const innerArchiveCompanyProvider = async (itemId, companyId, userId) => {
  const companyProvider = await companyProvidersService.get(companyId, itemId);
  if (!companyProvider) {
    jsonLogger.error({ type: 'TRACKING', function: 'companyProviders::innerArchiveCompanyProvider', message: 'missing companyProvider', companyId, itemId });
    return false;
  }

  let newItemStatus = null;
  const { itemStatus } = companyProvider;
  const isCanBeArchived = [
    constants.companyProvider.status.invited,
    constants.companyProvider.status.notInvited,
    constants.companyProvider.status.enrolled
  ].includes(itemStatus)
  if (isCanBeArchived) {
    newItemStatus = constants.itemStatus.archived;
  } else if (itemStatus === constants.companyProvider.status.registered) {
    newItemStatus = constants.companyProvider.status.inactive;
  } else {
    const message = 'Company provider current status is not supported for delete'
    jsonLogger.error({ type: 'TRACKING', function: 'companyProviders::innerArchiveCompanyProvider', message, companyProvider });
    return false;
  }

  let talentsIds = [];
  let archivedItems = [
    {
      companyId,
      itemId,
      itemStatus: newItemStatus,
      modifiedBy: userId,
    }
  ];

  if (itemId.startsWith(constants.prefix.provider)) {
    const prefix = `${constants.prefix.talent}${itemId}`;
    const allTalents = await companyProvidersService.listCompany(companyId, prefix);
    talentsIds = allTalents.map((talent) => talent.itemId);
    archivedItems = [
      ...archivedItems,
      ...allTalents.map((talent) => ({
        companyId,
        itemId: talent.itemId,
        itemStatus: newItemStatus,
        modifiedBy: userId
      }))
    ];
  } else {
    talentsIds.push(itemId);
  }

  if (talentsIds && talentsIds.length) {
    const jobs = await jobsService.listByTalentsIds(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, null, constants.prefix.job, talentsIds);
    const nonFinalizedJobs = jobHelper.getNonFinalizedJobs(jobs);
    if (!_.isEmpty(nonFinalizedJobs)) {
      jsonLogger.error({ type: 'TRACKING', function: 'companyProviders::innerArchiveCompanyProvider', message: 'cant remove companyProvider with active jobs', companyProvider, nonFinalizedJobs });
      return forbidden;
    }
  }

  const result = await companyProvidersService.transactUpdate(archivedItems);
  return result || false;
}

const archiveCompanyProvider = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const itemId = _.get(event, 'pathParameters.id');
  const data = JSON.parse(event.body);

  const { companyId, ids } = data;
  const isBulkAction = _.size(ids) && !itemId
  
  jsonLogger.info({
    function: "companyProviders::archiveCompanyProvider",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    companyId, userId, itemId, ids, data
  });

  if (!companyId || (!itemId && !_.size(ids))) {
    return responseLib.failure({ message: 'missing key params in event' });
  }

  const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } });
  if (role === constants.user.role.unauthorised) {
    return responseLib.forbidden({ status: false });
  }

  let results = _.map(ids || [itemId], id => innerArchiveCompanyProvider(id, companyId, userId))
  results = await Promise.all(results)

  if (results.some(res => res && res !== forbidden)) {
    return responseLib.success(isBulkAction ? results : results[0])
  }
  return results.every(res => res === forbidden)
    ? responseLib.forbidden({ status: false })
    : responseLib.failure({ status: false })
}

const updateProviderStatus = async (provider, userId, status) => {
  const { itemId, companyId, itemData } = provider;
  if (status === constants.user.status.invited) {
    itemData.invitationDate = Date.now();
  }
  let updatedItems = [
    {
      companyId,
      itemId,
      itemStatus: status,
      itemData,
      modifiedBy: userId,
    }
  ];

  if (itemId.startsWith(constants.prefix.provider)) {
    const prefix = `${constants.prefix.talent}${itemId}`;
    const allTalents = await companyProvidersService.listCompany(companyId, prefix);
    updatedItems = [
      ...updatedItems,
      ...allTalents.map((talent) => ({
        companyId,
        itemId: talent.itemId,
        itemStatus: status,
        modifiedBy: userId
      }))
    ];
  }

  const result = await companyProvidersService.transactUpdate(updatedItems);
  return result;
}

const resendOneInvitation = async (userId, companyId, providerId) => {
  const companyProvider = await companyProvidersService.get(companyId, providerId);
  if (!companyProvider) {
    jsonLogger.error({
      type: "TRACKING",
      function: "companyProviders::resendInvitation",
      exception: 'missing companyProvider', providerId, companyId
    });

    return false
  }
  let result = null;
  const isSendInvite = [
    constants.companyProvider.status.invited,
    constants.companyProvider.status.notInvited,
    constants.companyProvider.status.enrolled,
  ].includes(companyProvider.itemStatus);
  if (isSendInvite && companyProvider.itemId.startsWith(constants.prefix.provider)) {
    const promises = [];
    promises.push(asyncTasksQueue.sendMessage({ taskData: { provider: companyProvider }, type: constants.sqsAsyncTasks.types.inviteTalentEmailNotifiction }));
    promises.push(updateProviderStatus(companyProvider, userId, constants.companyProvider.status.invited));
    await Promise.all(promises);
    result = true
  }
  return result;
}

const resendInvitation = async (event, context) => {
  const data = JSON.parse(event.body);
  const userId = event.requestContext.identity.cognitoIdentityId;
  jsonLogger.info({ type: "TRACKING", function: "companyProviders::resendInvitation", functionName: context.functionName, awsRequestId: context.awsRequestId, userId, data });
  // eslint-disable-next-line no-extra-parens
  if (!data.companyId || (!data.providerId && !_.size(data.providerIds))) {
    return responseLib.failure({ message: 'missing required parameters in body' });

  }
  const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, data.companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } });
  if (role === constants.user.role.unauthorised) {
    return responseLib.forbidden({ status: false });
  }

  const items = _.size(data.providerIds)
    ? data.providerIds
    : [data.providerId]
  const promises = items.map((providerId) => resendOneInvitation(userId, data.companyId, providerId))
  const result = await Promise.all(promises)

  return result.some(Boolean)
    ? responseLib.success({ status: true })
    : responseLib.failure({ status: false })
}

const updateOrCreateCompanyProviderByTalent = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const data = JSON.parse(event.body);

  const { companyId, itemStatus, items, enrollData } = data;
  
  jsonLogger.info({
    function: "companyProviders::archiveCompanyProvider",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    companyId, itemStatus, items, enrollData, userId
  });

  if (!companyId || !_.size(items)) {
    return responseLib.failure({ message: 'missing key params in event' });
  }

  const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } });
  if (role === constants.user.role.unauthorised) {
    return responseLib.forbidden({ status: false });
  }

  let results = _.map(items, (item = {}) => updateOrCreateCompanyProvider(
    companyId, 
    item.entityId, 
    item.talentId, 
    userId, 
    undefined,
    undefined,
    item.email || item.providerEmail, 
    true,
    _.keyBy(item.legalDocuments, 'name'),
    itemStatus,
    enrollData
  ))
  results = await Promise.all(results)

  if (results.some(res => res && res !== forbidden)) {
    return responseLib.success(results)
  }
  return results.every(res => res === forbidden)
    ? responseLib.forbidden({ status: false })
    : responseLib.failure({ status: false })
}

module.exports = {
  getCompanyProviders,
  createCompanyProviders,
  updateCompanyProvider,
  archiveCompanyProvider,
  resendInvitation,
  createCompanyProvider,
  createCompanyProviderTalent,
  updateOrCreateCompanyProviderByTalent,
  PROVIDER_FIELDS,
  PROVIDER_TALENT_FIELDS
}

