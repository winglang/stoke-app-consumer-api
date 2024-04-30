'use strict';

const _ = require('lodash');

const {
  consumerAuthTableName,
  companyProvidersTableName,
  jobsTableName,
  gsiItemsByCompanyIdAndTalentId,
} = process.env;
const {
  UsersService,
  CompanyProvidersService,
  JobsService,
  jsonLogger,
  responseLib,
  constants,
  prefixLib,
  idConverterLib,
  permisionConstants,
} = require('stoke-app-common-api');
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsServiceTalentId = new JobsService(jobsTableName, [constants.attributeNames.defaultAttributes.companyId, constants.attributeNames.defaultAttributes.itemStatus, constants.attributeNames.defaultAttributes.entityId, constants.attributeNames.defaultAttributes.talentId]);

const ONE = 1;

const upgradeProviderDepartments = (providerDepartments, talentDepartments, companyId) => {
  const providerDepatmentsNormalized = providerDepartments.length > ONE && _.includes(providerDepartments, companyId)
    ? _.filter(providerDepartments, (department) => department !== companyId)
    : providerDepartments

  if (_.includes(talentDepartments, companyId) || _.includes(providerDepatmentsNormalized, companyId)) {
    return [companyId]
  }
  return _.union(talentDepartments, providerDepatmentsNormalized);
}

const reduceTalentDepartments = (providerDepartments, talentDepartments, companyId) => {
  const providerDepatmentsNormalized = providerDepartments.length > ONE && _.includes(providerDepartments, companyId)
    ? _.filter(providerDepartments, (department) => department !== companyId)
    : providerDepartments

  if (_.includes(providerDepatmentsNormalized, companyId)) {
    return talentDepartments
  }
  if (_.includes(talentDepartments, companyId)) {
    return providerDepatmentsNormalized
  }
  return _.intersection(talentDepartments, providerDepatmentsNormalized);
}

// eslint-disable-next-line max-params
const generateUpdateItems = (itemId, companyId, modifiedBy, entities, talent, companyProvider, providerEntities, providerTalentsEntities) => {
  const isTalent = prefixLib.isTalent(itemId);
  const isSelfEmployed = isTalent ? talent.itemData.isProviderSelfEmployedTalent : companyProvider.itemData.isProviderSelfEmployedTalent;

  let itemToUpdate = null
  if (isTalent) {
    itemToUpdate = isSelfEmployed
      ? { ...talent, itemData: { ...talent.itemData, departments: entities } }
      : {
        ...talent, itemData: {
          ...talent.itemData,
          departments: reduceTalentDepartments(
            _.get(providerEntities, idConverterLib.getProviderIdFromTalentId(itemId), [companyId]),
            _.get(providerTalentsEntities, itemId, [companyId]),
            companyId
          )
        }
      };
  } else {
    const updatedCompanyProvider = companyProvider
    updatedCompanyProvider.itemData.departments = isSelfEmployed
      ? entities
      : upgradeProviderDepartments(_.get(providerEntities, itemId, [companyId]), _.get(providerTalentsEntities, itemId, []), companyId);
    itemToUpdate = updatedCompanyProvider

  }
  return {
    companyId,
    modifiedBy,
    itemId: itemToUpdate.itemId,
    itemData: itemToUpdate.itemData,
  };
}

const providerDepartmentsUpdate = async ({
  itemId,
  companyId,
  userId,
  entities,
  isOverride = true,
  companyProvidersById,
  talentsById,
  providerEntities,
  providerTalentsEntities,
  jobsEntitiesByTalentId
}) => {
  jsonLogger.info({ function: "updateProviderDepartments::providerDepartmentsUpdate", itemId, entities, isOverride });

  const talent = _.get(talentsById, itemId);
  const companyProvider = _.get(companyProvidersById, itemId);
  const isTalent = prefixLib.isTalent(itemId);
  const notValidDepartments = _.difference(_.get(jobsEntitiesByTalentId, itemId), entities);

  if (!_.isEmpty(notValidDepartments) && isOverride && isTalent) {
    jsonLogger.info({ type: 'TRACKING', function: 'updateProviderDepartments::providerDepartmentsUpdate', message: 'Cant remove provider from department with active jobs', itemId, notValidDepartments, entities });
    return responseLib.failure({ status: false })
  }

  let entitesToUpdate = entities

  if (!isOverride) {
    const currentDepartments = isTalent ? _.get(talent, 'itemData.departments') : _.get(companyProvider, 'itemData.departments')
    entitesToUpdate = _.includes(currentDepartments, companyId) || !currentDepartments ? [companyId] : _.union(entities, currentDepartments)
  }

  const itemToUpdate = generateUpdateItems(itemId, companyId, userId, entitesToUpdate, talent, companyProvider, providerEntities, providerTalentsEntities);
  const result = await companyProvidersService.update(itemToUpdate);
  jsonLogger.info({ function: "updateProviderDepartments::providerDepartmentsUpdate", result });
  return result ? responseLib.success(_.first(result)) : responseLib.failure({ status: false });

}

// eslint-disable-next-line max-lines-per-function, complexity
const handler = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const data = JSON.parse(event.body);
  const { companyId, entities, itemsIds, isOverride = true } = data;
  jsonLogger.info({
    function: "updateProviderDepartments::handler",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    companyId, userId, itemsIds, entities, event,
  });

  if (!companyId || !itemsIds || !entities || !_.isArray(entities)) {
    return responseLib.failure({ message: 'missing key params in event' });
  }

  const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } });
  if (role === constants.user.role.unauthorised) {
    jsonLogger.error({ type: 'TRACKING', function: 'updateProviderDepartments::handler', message: 'Not authorised user', userId });
    return responseLib.forbidden({ status: false });
  }

  const authorisedEntities = _.uniq(_.map([
    ...entitiesUser,
    ...entitiesAdmin
  ], (entity) => entity.entityId));
  const notAuthorisedEntities = _.difference(entities, authorisedEntities);

  if (!_.isEmpty(notAuthorisedEntities)) {
    jsonLogger.error({ type: 'TRACKING', function: 'updateProviderDepartments::handler', message: 'User is not authorised to add talents to departments', userId, notAuthorisedEntities });
    responseLib.forbidden({ status: false });
  }

  const isBulkAction = Array.isArray(itemsIds);

  const itemIdsArray = isBulkAction ? itemsIds : [itemsIds];
  const talentsById = {}
  const companyProvidersById = {}
  const providerEntities = {}
  const providerTalentsEntities = {}
  const jobsEntitiesByTalentId = {}
  let affectedIdsToUpdate = []
  const talentIdsToUpdate = []
  const providerIdsToUpdate = []

  const [providers, talents] = _.partition(itemIdsArray, prefixLib.isProvider);

  _.forEach(talents, itemId => {

    affectedIdsToUpdate.push(itemId)

    const providerId = idConverterLib.getProviderIdFromTalentId(itemId)
  
    affectedIdsToUpdate.push(providerId)

  })

  affectedIdsToUpdate = _.uniq(affectedIdsToUpdate)

  const talentsItems = await Promise.all(_.map(affectedIdsToUpdate, (talentId) => companyProvidersService.get(companyId, talentId)))

  const providersItems = await Promise.all(_.map(providers, (providerId) => companyProvidersService.get(companyId, providerId)))

  const providersTalentsItems = await Promise.all(_.map(providers, (providerId) => companyProvidersService.listCompany(companyId, `${constants.prefix.talent}${providerId}`)))

  const itemsArray = _.concat(talentsItems, providersItems, ...providersTalentsItems)

  for (const item of itemsArray) {
    const isTalent = prefixLib.isTalent(item.itemId);

    if (isTalent) {
      const talentId = _.get(item, 'itemId')
      talentIdsToUpdate.push(talentId)
      const companyProviderId = idConverterLib.getProviderIdFromTalentId(talentId)
      const currentTalentDepartments = _.get(item, 'itemData.departments', [companyId])

      // eslint-disable-next-line no-await-in-loop
      const talentJobs = await jobsServiceTalentId.getOpenJobs(gsiItemsByCompanyIdAndTalentId, companyId, talentId)

      talentsById[talentId] = item

      providerTalentsEntities[companyProviderId] = isOverride
        ? entities
        : _.union(currentTalentDepartments, _.get(providerTalentsEntities, companyProviderId, []))

      // eslint-disable-next-line no-nested-ternary
      providerTalentsEntities[talentId] = isOverride && isTalent && _.includes(itemIdsArray, talentId)
        ? entities
        : isTalent && _.includes(itemIdsArray, talentId)
          ? _.union(currentTalentDepartments, entities)
          : _.uniq(currentTalentDepartments, entities)

      jobsEntitiesByTalentId[talentId] = _.map(talentJobs, (job) => job.entityId)
      jobsEntitiesByTalentId[companyProviderId] = _.union(jobsEntitiesByTalentId[companyProviderId] || [], _.map(talentJobs, (job) => job.entityId))
    } else {
      const companyProviderId = _.get(item, 'itemId')
      providerIdsToUpdate.push(companyProviderId)
      const providerDepartments = _.get(item, 'itemData.departments', [companyId])

      companyProvidersById[companyProviderId] = item
      if (isOverride && _.includes(itemIdsArray, companyProviderId)) {
        providerEntities[companyProviderId] = entities
      } else {
        providerEntities[companyProviderId] = _.includes(providerDepartments, companyId)
          ? [companyId]
          : _.union(providerDepartments, entities)
      }
    }

  }

  let providerResults = []

  for (const id of providerIdsToUpdate) {
    providerResults.push(providerDepartmentsUpdate({
      itemId: id,
      companyId,
      userId,
      entities,
      isOverride,
      companyProvidersById,
      talentsById,
      providerEntities,
      providerTalentsEntities,
      jobsEntitiesByTalentId
    }))
  }

  providerResults = await Promise.all(providerResults)
  jsonLogger.info({ function: "updateProviderDepartments::handler", providerResults });

  let talentResults = []

  for (const id of talentIdsToUpdate) {
    talentResults.push(providerDepartmentsUpdate({
      itemId: id,
      companyId,
      userId,
      entities,
      isOverride,
      companyProvidersById,
      talentsById,
      providerEntities,
      providerTalentsEntities,
      jobsEntitiesByTalentId
    }))
  }

  talentResults = await Promise.all(talentResults)
  jsonLogger.info({ function: "updateProviderDepartments::handler", talentResults });

  if ([...talentResults, ...providerResults].some(res => res && !_.includes([constants.httpStatusCodes.FORBIDDEN, constants.httpStatusCodes.INTERNAL_SERVER_ERROR], res))) {
    return responseLib.success(isBulkAction ? talentResults : _.first(talentResults))
  }
  return [...talentResults, ...providerResults].every(res => res === constants.httpStatusCodes.FORBIDDEN)
    ? responseLib.forbidden({ status: false })
    : responseLib.failure({ status: false })
}

module.exports = {
  handler,
  upgradeProviderDepartments,
}
