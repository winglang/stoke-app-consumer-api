/* eslint-disable max-lines */


"use strict";

const _ = require('lodash');
const uuidv1 = require("uuid/v1");
const budgets = require("./budgets");
const users = require("./users");

const {
  constants, jsonLogger, responseLib, formatterLib, dynamoDbUtils,
  UsersService, CompaniesService, SettingsService, tagsService, teamsService, errorCodes, SqsService, permisionConstants
} = require("stoke-app-common-api");

const { createResponse } = require('./helpers/commonHelper');
const { validateActivateEntity, validateDeleteEntity, pullAvailableBudgetsToCompanyPool } = require('./helpers/entityHelper');

const { consumerAuthTableName, customersTableName, settingsTableName, gsiItemsByCompanyIdIndexName, gsiUsersByEntityIdIndexName, asyncTasksQueueName } = process.env;
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const asyncTasksQueue = new SqsService(asyncTasksQueueName);

// eslint-disable-next-line max-params
const createEntitySettings = async (entityId, userId, companyId, legalEntityName) => {
  const entitySettings = {
    itemId: constants.prefix.entity + entityId,
    userId,
    companyId,
    entityId,
    itemStatus: constants.settings.status.active,
    itemData: {}
  };
  let result = await settingsService.create(entitySettings);
  if (result) {
    result = await settingsService.setDepartmentLegalEntity(legalEntityName, entitySettings.itemId, userId, companyId);
  }
  return result;
}


/**
 * inner Create Entity
 * @param {Object} data - data of entity
 * @returns {object} results
 */
// eslint-disable-next-line max-lines-per-function
const innerCreateEntity = async (data, addCompanyAdmins = true, createCompanyPool) => {
  jsonLogger.info({ type: "TRACKING", function: "entities::innerCreateEntity", text: "Create new entity", data, addCompanyAdmins, createCompanyPool });
  const { entityId, companyId, itemData, userId, prefix } = data;
  const entityBudget = await budgets.createBaseBudget({
    companyId,
    userId,
    entityId,
    itemId: prefix + entityId
  }, createCompanyPool);
  jsonLogger.info({ type: "TRACKING", function: "entities::innerCreateEntity", entityBudget });

  if (!entityBudget) {
    return false;
  }

  const entityItem = {
    companyId,
    itemId: prefix + entityId,
    itemData: _.omit(itemData, 'legalEntityName'),
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active
  };

  const resultEntity = await companiesService.create(entityItem);

  const companyAdmins = await usersService.listEntityAdmins(
    gsiUsersByEntityIdIndexName,
    companyId
  );

  let createdSettings = null;
  if (entityId !== companyId) {
    createdSettings = await createEntitySettings(entityId, userId, companyId, itemData.legalEntityName);
    if (!createdSettings) {
      jsonLogger.info({ type: "error", function: "entities::innerCreateEntity", text: 'created entitySettings', createdSettings });
    }
  }

  if (addCompanyAdmins) {
    for (const companyAdmin of companyAdmins) {
      const { userId: adminUserId, itemData: adminItemData } = companyAdmin
      const adminUserItem = {
        userId: adminUserId,
        entityId,
        companyId,
        createdBy: userId,
        modifiedBy: userId,
        itemStatus: constants.user.status.active,
        itemData: {
          userRole: constants.user.role.admin,
          isEditor: adminItemData.isEditor,
          permissionsComponents: adminItemData.permissionsComponents,
        }
      };

      jsonLogger.info({ type: "TRACKING", function: "entities::innerCreateEntity", text: "Create new admin user for new entity ", adminUserItem });

      // eslint-disable-next-line no-await-in-loop
      const adminUser = await users.innerAddUserToEntity(adminUserItem, createCompanyPool);

      if (!adminUser) {
        jsonLogger.error({ type: "TRACKING", function: "entities::innerCreateEntity", text: "Failed to create new admin user", adminUserItem });
        return false;
      }
    }
  }

  return resultEntity;
};


const addUserToEntity = async (userId, entityId, companyId, createdBy) => {
  jsonLogger.info({ type: "TRACKING", function: "entities::addUserToEntity", userId, entityId, companyId, createdBy });
  const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUsersData(userId, companyId);

  const isCompanyAdmin = role === constants.user.role.admin;
  const activeEntitiesAdmin = _.filter(entitiesAdmin, (entity) => entity.itemStatus !== constants.itemStatus.inactive);
  const isWorkspaceAdmin = !_.isEmpty(activeEntitiesAdmin) && !isCompanyAdmin;
  const isAdmin = isCompanyAdmin || isWorkspaceAdmin;
  if (!_.isEmpty(entitiesAdmin) || !_.isEmpty(entitiesUser)) {
    jsonLogger.info({ type: "TRACKING", function: "entities::addUserToEntity", 'message': 'User exists in entities. adding the user' });
    const userItem = {
      userId: userId,
      entityId: entityId,
      companyId: companyId,
      createdBy: createdBy,
      modifiedBy: createdBy,
      itemStatus: constants.user.status.active,
      itemData: {
        userRole: isAdmin ? constants.user.role.admin : constants.user.role.user,
        isEditor: isAdmin
      },
      tags: [],
    };      
    await users.innerAddUserToEntity(userItem);
  } else {
    jsonLogger.info({ type: "TRACKING", function: "entities::addUserToEntity", 'message': 'User dose not exists in entities. NOT adding the user' });
  }
}


const isNameAlreadyExistAsDepatmentInCompany = async (companyId, entityName, entityId) => {
  let companyEntities = await companiesService.list(process.env.gsiItemsByCompanyIdIndexName, companyId, constants.prefix.entity);
  companyEntities = entityId ? _.filter(companyEntities, entity => entity.itemId !== `${constants.prefix.entity}${entityId}`) : companyEntities;
  const entitiesNames = _.flatMap(companyEntities, 'itemData.entityName');
  return entitiesNames.includes(entityName)
}

/**
 * createEntity - create job
 * @param {Object} event - event
 * @param {Object} context - context
 * @returns {object} results
 */
// eslint-disable-next-line max-lines-per-function
const createEntity = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const data = JSON.parse(event.body);
  const companyId = event.pathParameters.id;
  jsonLogger.info({
    type: "TRACKING",
    function: "entities::createEntity",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId,
    companyId,
    data
  });

  if (!companyId) {
    return responseLib.failure({ message: "missing companyId in params" });
  }

  if (!data) {
    return responseLib.failure({ message: "missing data in body" });
  }

  const { role, entitiesAdmin } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: true } });
  const isCompanyAdmin = role === constants.user.role.admin;
  const activeEntitiesAdmin = _.filter(entitiesAdmin, (entity) => entity.itemStatus !== constants.itemStatus.inactive);
  const isWorkspaceAdmin = !_.isEmpty(activeEntitiesAdmin) && !isCompanyAdmin;
  if (!isCompanyAdmin && !isWorkspaceAdmin) return responseLib.forbidden({ status: false });

  if (await isNameAlreadyExistAsDepatmentInCompany(companyId, data.entityName)) {
    jsonLogger.error({ type: "TRACKING", function: "entities::createEntity", message: "Name already exists" });
    return responseLib.forbidden({ status: false });
  }

  if (isCompanyAdmin) {
    const entityId = data && data.entityName ? formatterLib.formatName(data.entityName) + uuidv1() : uuidv1();
    const entityItem = {
      entityId,
      userId,
      companyId,
      prefix: constants.prefix.entity,
      itemData: {
        ...data
      }
    };

    const result = await innerCreateEntity(entityItem);
    if (!result) {
      return responseLib.failure({ message: "entity creation failed" });
    }

    if (!_.isEmpty(data.addUserToWorkspace) && companyId !== entityId) {
      await addUserToEntity(data.addUserToWorkspace, entityId, companyId, userId);
    }

    return responseLib.success(result);
  }

  // case workspace admin, send email to company admin.
  try {
    const taskData = {
      companyId,
      workspaceAdminUserId: userId,
      workspaceData: {
        ...data,
        addUserToWorkspace: userId
      },
      worskpaceIds: activeEntitiesAdmin.map(entity => entity.entityId)
    };

    await asyncTasksQueue.sendMessage({ taskData, type: constants.sqsAsyncTasks.types.requestToCreateWorkspace });
    return responseLib.accepted({ status: true });
  } catch (e) {
    jsonLogger.error({ type: 'TRACKING', function: 'companies::addUserToCompany', text: `exception - ${e.message}`, e });
  }

  return responseLib.forbidden({ status: false, message: `can't add user to entity, lake permissions` })
};

const listEntities = async (event) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const companyId = event.pathParameters.id;
  jsonLogger.info({ type: "TRACKING", function: "entities::listEntities", userId, companyId });

  if (!companyId) {
    return responseLib.failure({ message: "missing companyId in params" });
  }

  const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.workspaces]: {} });
  if (role === constants.user.role.unauthorised) {
    return responseLib.forbidden({ status: false });
  }
  let expressionAttributeValues = {}
  let filterExpression = null

  const userEntites = _.concat(entitiesAdmin, entitiesUser)
  switch (role) {
    case constants.user.role.admin:
      break;
    default:
      // user permission, filter only his entites
      if (userEntites.length) {
        const relevantEntites = userEntites.map((item) => constants.prefix.entity + item.entityId);
        ({ expressionAttributeValues, filterExpression } = dynamoDbUtils.generateExepressionForList(relevantEntites, `itemId`));
      } else {
        return responseLib.forbidden({ status: false });
      }
      break;
  }

  const entities = await companiesService.list(gsiItemsByCompanyIdIndexName, companyId, constants.prefix.entity, expressionAttributeValues, filterExpression);

  if (!entities) {
    return responseLib.failure({ status: false });
  }
  if (role !== constants.user.role.admin) {
    teamsService.filterEntityTeams(entities, userEntites);
  }

  // eslint-disable-next-line array-element-newline
  const entitiesSorted = _.sortBy(entities, ['itemStatus', 'itemData.entityName']);
  const admins = await usersService.listUsersWithAdminRole(gsiItemsByCompanyIdIndexName, companyId);
  const result = teamsService.addTeamAdmins(entitiesSorted, admins);
  jsonLogger.info({ type: "TRACKING", function: "entities::listEntities", result });
  return responseLib.success(result)
};

const updateEntity = async (event) => {
  const entityId = event.pathParameters.id;
  const userId = event.requestContext.identity.cognitoIdentityId;
  const data = JSON.parse(event.body);
  jsonLogger.info({ type: "TRACKING", function: "entities::updateEntity", userId, entityId, data });

  const { companyId, entityName, costCenter, legalEntityName, spaces, color } = data;
  if (!companyId || !entityName) {
    jsonLogger.error({ type: "TRACKING", function: "entities::updateEntity", message: "Missing mandatory parameters" });
    return responseLib.failure({ status: false });
  }

  const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: true } });
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }


  if (await isNameAlreadyExistAsDepatmentInCompany(companyId, entityName, entityId)) {
    jsonLogger.error({ type: "TRACKING", function: "entities::updateEntity", message: "Name already exists" });
    return responseLib.forbidden({ status: false });
  }

  const itemId = constants.prefix.entity + entityId;
  const entity = {
    itemId,
    itemData: {
      entityName,
      spaces,
      costCenter,
      color,
    },
    modifiedBy: userId,
  };

  const result = await companiesService.update(entity);
  if (result && legalEntityName) {
    await settingsService.setDepartmentLegalEntity(legalEntityName, itemId, userId, companyId);
  }

  jsonLogger.info({ type: "TRACKING", function: "entities::updateEntity", result });
  return responseLib.send(result);
}

const updateTeamsForAdmins = async (entityId, modifiedBy, currentUpdatedTeams) => {
  jsonLogger.info({ type: "TRACKING", function: "entities::updateTeamsForAdmins", entityId, modifiedBy });
  if (!entityId) {
    jsonLogger.error({ type: "TRACKING", function: "entities::updateTeamsForAdmins", message: "Missing mandatory param - entityId" });
    return false;
  }

  const itemId = constants.prefix.entity + entityId;
  const entity = await companiesService.get(itemId);
  if (!entity) {
    jsonLogger.error({ type: "TRACKING", function: "entities::updateTeamsForAdmins", message: "Entity not found", itemId });
    return false;
  }

  const { companyId } = entity;
  const companyAdmins = await usersService.listEntityAdmins(gsiUsersByEntityIdIndexName, companyId);
  const companyAdminsUserId = _.map(companyAdmins, 'userId') || [];

  const entityTeams = teamsService.get(entity);
  const entityAdmins = await usersService.listEntityAdmins(gsiUsersByEntityIdIndexName, entityId);
  for (const entityAdmin of entityAdmins) {
    const isEntityManager = _.get(entityAdmin, 'itemData.isEntityManager', false);
    const isCompanyAdmin = companyAdminsUserId.includes(entityAdmin.userId);
    const isUpdatedByWorkspaceAdmin = entityAdmin.userId === modifiedBy && !isCompanyAdmin
    if (isEntityManager || isCompanyAdmin || isUpdatedByWorkspaceAdmin) {
      teamsService.set(entityAdmin, isUpdatedByWorkspaceAdmin ? currentUpdatedTeams : entityTeams);
      entityAdmin.modifiedBy = modifiedBy;
      // eslint-disable-next-line no-await-in-loop
      const updateResult = await usersService.update(entityAdmin);
      jsonLogger.info({ type: "TRACKING", function: "entities::updateTeamsForAdmins", entityAdmin, updateResult });
    }
  }
  return true;
}

const getUpdatedTeams = async (entityId, tagsToUpdate) => {
  const currentEntity = await companiesService.get(`${constants.prefix.entity}${entityId}`);
  const savedTeams = teamsService.get(currentEntity);
  const updatedTeams = _.union(_.get(tagsToUpdate, constants.tags.teams), savedTeams);
  jsonLogger.info({ type: "TRACKING", function: "entities::getUpdatedTeams", updatedTeams });
  return updatedTeams
}

const updateEntityTags = async (event) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const entityId = event.pathParameters.id;

  jsonLogger.info({ type: "TRACKING", function: "entities::updateEntityTags", userId, entityId });

  const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: true } });
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }

  const { tags } = JSON.parse(event.body);
  const tagsToUpdate = _.omit(tags, constants.tags.teamsAdmins);
  jsonLogger.info({ type: "TRACKING", function: "entities::updateEntityTags", tagsToUpdate });

  if (!tagsService.validate(tagsToUpdate)) {
    return responseLib.failure({ status: false });
  }

  const updatedTeams = await getUpdatedTeams(entityId, tagsToUpdate)

  const entity = {
    itemId: constants.prefix.entity + entityId,
    tags: {
      ...tagsToUpdate,
      [constants.tags.teams]: updatedTeams
    },
    modifiedBy: userId,
  };

  const result = await companiesService.update(entity);
  jsonLogger.info({ type: "TRACKING", function: "entities::updateEntityTags", entity, result });
  if (result) {
    await updateTeamsForAdmins(entityId, userId, _.get(tagsToUpdate, constants.tags.teams));
  }

  return responseLib.send(result);
};

const handleFutureBudgets = async (companyId, entityId, modifiedByUserId) => {
  jsonLogger.info({ type: "TRACKING", function: "entities::handleFutureBudgets", companyId, entityId, modifiedByUserId });
  const budgetOwnerUserId = await usersService.getCompanyBudgetOwnerUserId(gsiUsersByEntityIdIndexName, companyId);
  if (budgetOwnerUserId) {
    await pullAvailableBudgetsToCompanyPool(companyId, entityId, budgetOwnerUserId, modifiedByUserId);
  }
}

const updateEntityStatus = async (event) => {
  jsonLogger.info({ type: "TRACKING", function: "entities::updateEntityStatus", event });

  const userId = event.requestContext.identity.cognitoIdentityId;
  const entityId = event.pathParameters.id;
  const { itemStatus, isValidation } = JSON.parse(event.body) || {};
  jsonLogger.info({ type: "TRACKING", function: "entities::updateEntityStatus", entityId, itemStatus, isValidation });

  if (!entityId || !itemStatus) {
    return responseLib.failure({ message: 'Missing mandatory params' });
  }
  const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: true } });
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }

  const itemId = constants.prefix.entity + entityId;
  const entity = await companiesService.get(itemId);
  if (!entity) {
    jsonLogger.error({ type: "TRACKING", function: "entities::updateEntityStatus", message: "Entity not found", itemId });
    return responseLib.forbidden({ status: false });
  }

  const { status, reason } = itemStatus === constants.itemStatus.inactive
    ? await validateDeleteEntity(entityId)
    : validateActivateEntity(entity, itemStatus);

  jsonLogger.info({ type: 'TRACKING', function: "entities::updateEntityStatus", status, reason });
  if (isValidation || !status) {
    return createResponse(status, reason);
  }

  if (reason === errorCodes.deleteErrors.FUTURE_BUDGETS) {
    await handleFutureBudgets(entity.companyId, entityId, userId);
  }

  const entityToUpdate = {
    itemId,
    itemStatus,
    modifiedBy: userId,
  };

  const result = await companiesService.update(entityToUpdate);
  jsonLogger.info({ type: "TRACKING", function: "entities::updateEntityStatus", entityToUpdate, result });
  return createResponse(true);

}


module.exports = {
  innerCreateEntity,
  createEntity,
  listEntities,
  updateEntityTags,
  updateEntity,
  updateEntityStatus,
};
