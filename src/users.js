/* eslint-disable max-lines */
/* eslint-disable complexity */
/* eslint-disable no-unreachable */
/* eslint-disable multiline-comment-style */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-extra-parens */


'use strict';

const {
  gsiItemsByCompanyIdIndexName,
  gsiUsersByEntityIdIndexName,
  consumerAuthTableName,
  customersTableName,
  settingsTableName,
  authSnsTopicArn,
  TALKJS_API_KEY,
} = process.env;

const _ = require('lodash');
const {
  UsersService, CompaniesService, jsonLogger,
  constants, teamsService, responseLib, dynamoDbUtils, snsLib, tagsService, utils, permisionConstants, SettingsService
} = require('stoke-app-common-api');

const userHelper = require('./helpers/userHelper');
const { createResponse } = require('./helpers/commonHelper');

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const { signUpExternalProviderToCompany, innerAddUserToEntity, extractSubFromAuthProvider } = require('./signupUserToCompanyUtil')

const addCompanyAdmin = async (item) => {
  jsonLogger.info({ type: 'TRACKING', function: 'users::addCompanyAdmin', item });
  const { companyId, userId, entityId } = item || {};
  if (companyId !== entityId || _.get(item, 'itemData.userRole') !== constants.user.role.admin) {
    jsonLogger.error({
      type: 'TRACKING', function: 'users::addCompanyAdmin',
      message: 'wrong parameters in attempt to add company admin', item
    });
    return false;
  }

  const { role, entitiesUser, entitiesAdmin } = await usersService.getCompanyUserAuthRole(userId, companyId);
  if (role === constants.user.role.unauthorised) {
    jsonLogger.error({
      type: 'TRACKING', function: 'users::addCompanyAdmin',
      message: 'attempt to add not existing user', item
    });
    return false;
  }

  const entitiesUserIds = entitiesUser.map((ent) => ent.entityId);
  const entitiesAdminIds = entitiesAdmin.map((ent) => ent.entityId);
  const entitiesAdminsByEntityId = _.groupBy(entitiesAdmin, 'entityId');
  const allDepartmentsInCompany = await companiesService.list(gsiItemsByCompanyIdIndexName, companyId, constants.prefix.entity);
  if (!allDepartmentsInCompany) {
    jsonLogger.error({ type: 'TRACKING', function: 'users::addCompanyAdmin', message: 'there are no departments defined ', item });
    return false;
  }

  const result = await innerAddUserToEntity(item);
  if (result) {
    const responses = [];
    for (const department of allDepartmentsInCompany) {
      const departmentId = department.itemId.substring(constants.prefix.entity.length);
      const isUserAdminInEntity = entitiesAdminIds.includes(departmentId);
      const userEntityAuthItemData = _.get(entitiesAdminsByEntityId, `${departmentId}[0].itemData`, {});
      const isRoleOrEditorPermissionsChanged = !_.isEqual(_.get(item, 'itemData.userRole'), _.get(userEntityAuthItemData, 'userRole')) || !_.isEqual(_.get(item, 'itemData.isEditor'), _.get(userEntityAuthItemData, 'isEditor'));
      if (!isUserAdminInEntity || isRoleOrEditorPermissionsChanged) {
        const userItem = {
          ...item,
          entityId: departmentId
        };

        const response = entitiesUserIds.includes(departmentId) || isUserAdminInEntity ? usersService.update(userItem) : innerAddUserToEntity(userItem);
        responses.push(response);
      }
    }
    await Promise.all(responses);
  }

  return result;
}

/**
 * addUserInEntity - adds a user to an entity, must be performed by Entity Admin (passed as the cognitoIdentityId)
 * @public
 * @param {object} event lambda event, event.body is the method data, data must contain entityId, companyId, userId
 * @param {object} context - lambda context
 * @returns {object} results
 */
const addUserInEntity = async (event, context) => {
  const data = JSON.parse(event.body);
  const adminUserId = event.requestContext.identity.cognitoIdentityId;
  const { entityId, companyId, userId, userRole, isEditor, tags, permissionsComponents } = data;

  jsonLogger.info({ type: 'TRACKING', function: 'users::addUserInEntity', functionName: context.functionName, awsRequestId: context.awsRequestId, adminUserId, entityId, tags, event });

  if (!entityId || !companyId) {
    return responseLib.failure({ message: 'missing params key in query string' });
  }

  if (!tagsService.validate(tags)) {
    return responseLib.failure({ message: 'tags are not valid' });
  }

  const authorised = await usersService.validateUserEntityWithComponents(adminUserId, entityId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true } });
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }

  if (companyId !== entityId) {
    const entity = await companiesService.get(`${constants.prefix.entity}${entityId}`);
    if (!entity || entity.itemStatus === constants.itemStatus.inactive) {
      jsonLogger.error({ type: "TRACKING", function: "users::addUserInEntity", error: `can't add user to an inactive entity` });
      return responseLib.failure({ message: `can't add user to an inactive entity` })
    }
  }

  if (_.isEqual(permissionsComponents, {})) {
    jsonLogger.error({ type: 'error', function: 'users::addUserInEntity', message: 'empty object in permissions components' });
  }

  const userItem = {
    userId: userId,
    entityId: entityId,
    companyId: companyId,
    createdBy: adminUserId,
    modifiedBy: adminUserId,
    itemStatus: constants.user.status.active,
    itemData: {
      userRole,
      isEditor,
      ...(_.isEmpty(permissionsComponents) ? {} : { permissionsComponents }),
    },
    tags,
  };

  let result = await usersService.get(userId, entityId);
  if (result) {
    jsonLogger.info({ type: "TRACKING", function: "users::addUserInEntity", message: 'this user already exist in entity - just update', entityId, companyId, userId });
    result = await usersService.update(userItem);
    return responseLib.success(_.get(result, 'Attributes'));
  }

  result = companyId === entityId ? await addCompanyAdmin(userItem) : await innerAddUserToEntity(userItem);
  return result ? responseLib.success(result) : responseLib.failure({ status: false });
}

// eslint-disable-next-line arrow-body-style
const resolveRoleByType = (existingUser, roleType, value) => {
  // eslint-disable-next-line no-undefined
  return value === undefined
    ? _.get(existingUser, [
      'itemData',
      roleType
    ], constants.additionalRoleTypesDefaults[roleType])
    : value;
}

const resolveOwnerOfTeams = (existingUser, userOwnerOfTeamsToUpdate, tags) => {
  // eslint-disable-next-line array-element-newline
  const userTeams = _.get(tags, [constants.tags.teams], teamsService.get(existingUser));
  return userOwnerOfTeamsToUpdate ? _.intersection(userOwnerOfTeamsToUpdate, userTeams) : _.get(existingUser, 'itemData.ownerOfTeams', []);
}

/**
 * updateUserInEntity - modifies a user role in an entity, must be performed by Entity Admin (passed as the cognitoIdentityId)
 * @public
 * @param {object} event lambda event, event.body is the method data, data must contain entityId, userRole
 * @param {object} context - lambda context
 * @returns {object} results
 */
// eslint-disable-next-line max-lines-per-function
const updateUserInEntity = async (event, context) => {
  const data = JSON.parse(event.body);
  const userIdToUpdate = event.pathParameters.id;
  const userId = event.requestContext.identity.cognitoIdentityId;
  const { entityId, itemStatus, userRole, isEditor, isBudgetOwner, isJobsApprover, ownerOfTeams, tags, permissionsComponents } = data;

  jsonLogger.info({ type: 'TRACKING', function: 'users::updateUserInEntity', functionName: context.functionName, awsRequestId: context.awsRequestId, userId, entityId, tags, event, permissionsComponents });

  if (!entityId) {
    return responseLib.failure({ message: 'missing entityId in body string' });
  }

  if (!tagsService.validate(tags)) {
    return responseLib.failure({ message: 'tags are not valid' });
  }

  const authorised = await usersService.validateUserEntity(userId, entityId, constants.user.role.admin, true);
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }

  const existingUser = await usersService.get(userIdToUpdate, entityId);
  if (!existingUser) {
    jsonLogger.info({ type: 'TRACKING', function: 'users::updateUserInEntity', exception: 'missing user', userId: userIdToUpdate, entityId: entityId });
    responseLib.failure({ status: false })
  }

  const isResolvedEditor = resolveRoleByType(existingUser, constants.additionalRoleTypes.isEditor, isEditor);
  const isResolvedEditorAdmin = isResolvedEditor && userRole === constants.user.role.admin;
  if (isBudgetOwner || isJobsApprover) {
    if (!isResolvedEditor) {
      jsonLogger.error({ type: 'TRACKING', function: 'users::updateUserInEntity', message: 'only editor can have additional roles', userIdToUpdate, isResolvedEditor, isBudgetOwner, isJobsApprover });
      return responseLib.failure({ status: false });
    }
  }
  const isResolvedBudgetOwner = isResolvedEditorAdmin && resolveRoleByType(existingUser, constants.additionalRoleTypes.isBudgetOwner, isBudgetOwner);
  const isResolvedJobApprover = isResolvedEditorAdmin && resolveRoleByType(existingUser, constants.additionalRoleTypes.isJobsApprover, isJobsApprover);
  const resolvedOwnerOfTeams = isResolvedEditorAdmin ? resolveOwnerOfTeams(existingUser, ownerOfTeams, tags) : [];

  const userItemUpdate = {
    userId: userIdToUpdate,
    entityId: entityId,
    modifiedBy: userId,
    itemStatus: itemStatus,
    itemData: {
      ..._.get(existingUser, 'itemData'),
      userRole: userRole,
      isEditor: isResolvedEditor,
      isBudgetOwner: isResolvedBudgetOwner,
      isJobsApprover: isResolvedJobApprover,
      ownerOfTeams: resolvedOwnerOfTeams,
      permissionsComponents: permissionsComponents,
    },
    tags,
  };

  const result = await usersService.update(userItemUpdate);
  return result ? responseLib.success(result) : responseLib.failure({ status: false });
}

/**
 * getUser - get item from auth table by userId (passed via cognitoIdentityId) and entityId (passed via queryStringParameters)
 * @public
 * @param {object} event lambda event
 * @param {object} context - lambda context
 * @returns {object} results
 */
const getUser = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const { queryStringParameters } = event;
  let entityId = null;
  if (queryStringParameters && queryStringParameters.entityId) {
    ({ entityId } = queryStringParameters);
  }

  jsonLogger.info({ type: 'TRACKING', function: 'users::getUser', functionName: context.functionName, awsRequestId: context.awsRequestId, userId: userId, entityId: entityId, event: event });

  const result = await usersService.get(userId, entityId);
  return result ? responseLib.success(result) : responseLib.failure({ status: false });
}

const getExternalProviderCompany = async (cognitoAuthProvider) => {
  const userSub = extractSubFromAuthProvider(cognitoAuthProvider)
  if (!userSub) {
    return null
  }

  const itemId = userHelper.buildExternalProviderUserPoolId(userSub)
  const userCompany = await companiesService.get(itemId)
  jsonLogger.info({ type: 'TRACKING', message: 'fetching user company by sub', function: 'users::getExternalProviderCompany', itemId })

  if (!userCompany) return null

  return userCompany
}

const updateUserIdOnItem = async (userId, itemId) => {
  const updatedItem = {
    itemId,
    userId,
    modifiedBy: userId
  }

  jsonLogger.info({ type: 'TRACKING', message: 'Adding User Id on the company item', function: 'users::addUserIdToProvider', itemId, userId })
  await companiesService.update(updatedItem)
}

/**
 * getUserData - gets a user data (including entities) by userId (passed via cognitoIdentityId)
 * @public
 * @param {object} event lambda event
 * @param {object} context - lambda context
 * @returns {object} results
 */
const getUserData = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const authProvider = event.requestContext.identity.cognitoAuthenticationProvider;

  jsonLogger.info({ type: 'TRACKING', function: 'users::getUserData', functionName: context.functionName, awsRequestId: context.awsRequestId, userId: userId, event: event });

  const keyConditionExpression = "userId = :userId";
  const expressionAttributeValues = { ":userId": userId };
  let result = await companiesService.query(process.env.gsiItemByUserIdIndexName, keyConditionExpression, expressionAttributeValues)

  if (result && result.length > 1) {
    jsonLogger.error({ type: 'TRACKING', message: 'expected exectly 1 item per user', function: 'users::getUserData', functionName: context.functionName, awsRequestId: context.awsRequestId, result: result });
    return responseLib.failure({ status: false });
  }

  if (!result || (result && result.length === 0)) {
    const externalProviderCompany = await getExternalProviderCompany(authProvider)

    // this part of the flow is relevant only to sso registration
    if (externalProviderCompany) {
      const externalItemId = externalProviderCompany.itemId
      await updateUserIdOnItem(userId, externalItemId)
      const addToCompanyResults = await signUpExternalProviderToCompany(externalItemId, userId, authProvider)
      if (!addToCompanyResults) {
        jsonLogger.error({ type: 'TRACKING', message: 'failed adding external user to company', function: 'users::getUserData', userId, externalItemId })
        return responseLib.failure({ status: false });
      }

      result = [addToCompanyResults] // from this point, flow continues as usual

      jsonLogger.info({ type: 'TRACKING', message: 'external user was added to company successfully. Continuing flow', function: 'users::getUserData', userId, externalItemId })
    } else {
      jsonLogger.info({ type: 'TRACKING', message: 'No company found, and not external provider company found', function: 'users::getUserData', functionName: context.functionName, awsRequestId: context.awsRequestId, result: result });
      return responseLib.failure({ status: false });
    }
  }

  const [userData] = result;
  if ([constants.itemStatus.inactive, constants.itemStatus.archived].includes(userData.itemStatus)) {
    jsonLogger.error({ type: 'TRACKING', message: 'this user is inactive or archived', function: 'users::getUserData', userData });
    return responseLib.success({ entities: [], userData: {} });
  }

  await snsLib.publish(authSnsTopicArn, 'getUserData', userData);

  const entitiesAuth = await usersService.listEntities(userId, null, true) || [];
  const companySettings = await settingsService.get(`${constants.prefix.company}${userData.companyId}`);


  if (entitiesAuth && entitiesAuth.length > 0) {
    const companyItem = await companiesService.get(constants.prefix.company + userData.companyId);
    if (userData) {
      userData.companyName = _.get(companyItem, 'itemData.entityName');
      userData.companyModules = _.get(companySettings, 'itemData.modules');
    }
    const entities = await companiesService.list(gsiItemsByCompanyIdIndexName, userData.companyId, constants.prefix.entity);
    for (const row of entitiesAuth) {
      let entityCompanyItem = null
      if (row.entityId === row.companyId) {
        entityCompanyItem = companyItem
      } else {
        entityCompanyItem = entities.find((entity) => entity.itemId === constants.prefix.entity + row.entityId)
      }
      row.userRole = _.get(row, 'itemData.userRole');
      row.isEditor = _.get(row, 'itemData.isEditor');
      row.isBudgetOwner = _.get(row, 'itemData.isBudgetOwner', false);
      row.isJobsApprover = _.get(row, 'itemData.isJobsApprover', false);
      row.ownerOfTeams = _.get(row, 'itemData.ownerOfTeams', []);
      row.permissionsComponents = _.get(row, 'itemData.permissionsComponents');
      if (entityCompanyItem) {
        row.itemData = { ...row.itemData, ...entityCompanyItem.itemData }
        row.itemId = entityCompanyItem.itemId;
        row.isArchived = entityCompanyItem.itemStatus === constants.itemStatus.inactive;
      }
    }
  } else {
    jsonLogger.error({ type: 'TRACKING', function: 'users::addCompanyAdmin', message: 'user has no auth objects', entitiesAuth });
    return responseLib.success({ entities: entitiesAuth, userData });
  }

  if (userData) {
    userData.chatSignature = utils.signUserId(userData.userId, TALKJS_API_KEY);
  }

  return entitiesAuth && userData ? responseLib.success({ entities: entitiesAuth, userData }) : responseLib.failure({ status: false });
}

const getUserInEntityData = (authUser, companiesUsers, companyAdminsUserId = []) => {
  const userInCompany = companiesUsers.find((user) => user.userId === authUser.userId);
  if (!userInCompany) {
    return null;
  }

  const { itemId, userId, itemData } = userInCompany;
  const result = {
    itemId,
    userId,
    entityId: authUser.entityId,
    companyId: authUser.companyId,
    itemStatus: authUser.itemStatus,
    itemData: {
      ...itemData,
      role: _.get(authUser, 'itemData.userRole'),
      isEditor: _.get(authUser, 'itemData.isEditor', true),
      isBudgetOwner: _.get(authUser, 'itemData.isBudgetOwner', false),
      isJobsApprover: _.get(authUser, 'itemData.isJobsApprover', false),
      ownerOfTeams: _.get(authUser, 'itemData.ownerOfTeams', []),
      permissionsComponents: _.get(authUser, 'itemData.permissionsComponents'),
      isCompanyAdmin: companyAdminsUserId.includes(userId)
    },
    tags: authUser.tags,
  };
  return result;
}

/**
 * getUsersInEntity - gets all users in an entity (passed via queryStringParameters), must be performed by Entity Admin (passed as the cognitoIdentityId)
 * @public
 * @param {object} event lambda event
 * @param {object} context - lambda context
 * @returns {object} results
 */
// eslint-disable-next-line max-lines-per-function
const getUsersInEntity = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const { queryStringParameters } = event;
  const { entityId, companyId } = queryStringParameters ? queryStringParameters : {};
  const scope = companyId || entityId
  if (!scope) {
    return responseLib.failure({ message: 'missing entityId or companyId in query string' });
  }

  jsonLogger.info({ type: 'TRACKING', function: 'users::getUsersInEntity', functionName: context.functionName, awsRequestId: context.awsRequestId, userId, entityId, companyId, event: event });

  let filterExpression = null
  let expressionAttributeValues = {}
  let keyConditionExpression = '';
  let isCompanyAdmin = false;
  let realCompanyId = companyId;
  if (companyId) {
    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(userId, companyId)
    switch (role) {
      case constants.user.role.admin:
        isCompanyAdmin = true;
        break
      case constants.user.role.user:
        // eslint-disable-next-line no-case-declarations
        const relevantEntites = _.concat(entitiesAdmin, entitiesUser).map((item) => item.entityId);
        ({ expressionAttributeValues, filterExpression } = dynamoDbUtils.generateExepressionForList(relevantEntites, `entityId`));
        break
      default:
        return responseLib.forbidden({ status: false });
    }
    keyConditionExpression = "companyId = :companyId";
    expressionAttributeValues[":companyId"] = companyId
  } else {
    const authorised = await usersService.validateUserEntity(userId, entityId);
    realCompanyId = authorised.companyId;
    const role = _.get(authorised, 'itemData.userRole', constants.user.role.unauthorised);
    if (role === constants.user.role.unauthorised) {
      return responseLib.forbidden({ status: false });
    }
    keyConditionExpression = "entityId = :entityId";
    expressionAttributeValues = { ":entityId": entityId };
  }

  const indexName = companyId ? gsiItemsByCompanyIdIndexName : gsiUsersByEntityIdIndexName;
  jsonLogger.info({ type: "TRACKING", function: "users::getUsersInEntity", indexName, keyConditionExpression, expressionAttributeValues, filterExpression });
  let authUsers = await usersService.queryAll(indexName, keyConditionExpression, expressionAttributeValues, filterExpression);
  filterExpression = null;
  expressionAttributeValues = {}

  const companyAdmins = await usersService.listEntityAdmins(gsiUsersByEntityIdIndexName, companyId);
  const companyAdminsUserId = _.map(companyAdmins, 'userId') || [];

  if (!isCompanyAdmin) {
    ({ expressionAttributeValues, filterExpression } = dynamoDbUtils.generateExepressionForList(authUsers.map((item) => item.userId), `userId`));
  }
  const companiesUsers = await companiesService.list(gsiItemsByCompanyIdIndexName, realCompanyId, constants.prefix.userPoolId, expressionAttributeValues, filterExpression, {}, true)
  authUsers = authUsers.map((authUser) => getUserInEntityData(authUser, companiesUsers, companyAdminsUserId)).filter(Boolean);

  return authUsers ? responseLib.success(authUsers) : responseLib.failure({ status: false });
}

const deleteUserInEntity = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const userIdToDelete = event.pathParameters.id;
  const { entityId } = event.queryStringParameters;
  const isValidation = event.queryStringParameters.isValidation === 'true';
  jsonLogger.info({ type: 'TRACKING', function: 'users::deleteUserInEntity', functionName: context.functionName, awsRequestId: context.awsRequestId, userIdToDelete, entityId, event });

  if (!entityId || !userIdToDelete) {
    return responseLib.failure({ message: 'missing key params in query string' });
  }
  const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true } });
  if (!authorised) {
    jsonLogger.error({ type: 'error', function: 'users::deleteUserInEntity', message: 'User is not authorised to do delete user in entity' });
    return responseLib.forbidden({ status: false });
  }

  const companyId = _.get(authorised, 'companyId')
  const userToDeleteInCompanyScopeAuthorised = await usersService.getUserAuth(userIdToDelete, companyId);
  if (userToDeleteInCompanyScopeAuthorised) {
    jsonLogger.error({ type: 'error', function: 'users::deleteUserInEntity', message: 'User is not authorised to be deletet user, user is in company scope' });
    return responseLib.forbidden({ status: false });
  }

  const { status, reason } = await userHelper.validateDeleteUser(companyId, entityId, userIdToDelete);
  jsonLogger.info({ type: 'TRACKING', function: 'users::deleteUserInEntity', status, reason });

  if (isValidation || !status) {
    return createResponse(status, reason);
  }

  const result = await userHelper.updateUserStatusInEntities(userIdToDelete, [entityId], userId, constants.user.status.inactive);
  jsonLogger.info({ type: 'TRACKING', function: 'userHelper::deleteUserInEntity', result });
  return createResponse(result);
}

const deleteUserInTeam = async (event) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const userIdToDelete = event.pathParameters.id;
  const { entityId, teamName } = event.queryStringParameters;
  const isValidation = event.queryStringParameters.isValidation === 'true';
  jsonLogger.info({ type: 'TRACKING', function: 'users::deleteUserInTeam', userIdToDelete, entityId, teamName, isValidation, event });

  if (!entityId || !teamName || !userIdToDelete) {
    return responseLib.failure({ message: 'missing key params in query string' });
  }
  const authorised = await usersService.validateUserEntity(userId, entityId, constants.user.role.admin, true);
  if (!authorised)
    return responseLib.forbidden({ status: false });

  const { status, reason } = await userHelper.validateDeleteUser(null, entityId, userIdToDelete, teamName);
  jsonLogger.info({ type: 'TRACKING', function: 'users::deleteUserInTeam', status, reason });

  if (isValidation || !status) {
    return createResponse(status, reason);
  }

  const result = await userHelper.removeUserFromTeam(userIdToDelete, entityId, teamName, userId);
  return createResponse(result);
}

module.exports = {
  addUserInEntity,
  updateUserInEntity,
  getUser,
  getUserData,
  getUsersInEntity,
  deleteUserInEntity,
  innerAddUserToEntity,
  deleteUserInTeam,
  getExternalProviderCompany
}
