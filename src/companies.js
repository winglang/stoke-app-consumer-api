/* eslint-disable max-lines */
/* eslint-disable newline-per-chained-call */
/* eslint-disable max-lines-per-function */
/* eslint-disable max-params */
/* eslint-disable no-magic-numbers */

'use strict';

const uuidv1 = require('uuid/v1');
const _ = require('lodash');

const entities = require('./entities')
const users = require('./users')
const { createResponse } = require('./helpers/commonHelper');
const userHelper = require('./helpers/userHelper');
const settingsHelper = require('./helpers/settingsHelper');

const {
  stage,
  IS_OFFLINE,
  USER_POOL_ID,
  idPublicPosting,
  consumerAuthTableName,
  settingsTableName,
  customersTableName,
  gsiItemsByCompanyIdIndexName,
  userActionsSnsTopicArn,
  asyncTasksQueueName,
} = process.env;

const { UsersService, SettingsService, CompaniesService, constants, responseLib, jsonLogger, formatterLib, dynamoDbUtils, snsLib, SqsService, permisionConstants, cognitoLib } = require('stoke-app-common-api');
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes)
const asyncTasksQueue = new SqsService(asyncTasksQueueName);

const {
  canAddToEntities,
  addUserToEntities,
  entityIdToEntitiesIds,
  createUserSettings,
} = require('./signupUserToCompanyUtil');
const { addCompanyToUsagePlan } = require('stoke-app-common-api/helpers/aiHelper');
const { stages } = require('stoke-app-common-api/config/constants');
const { isPermissionsComponentsValid } = require('stoke-app-common-api/helpers/permissonHelper');
const { permissionScope } = require('stoke-app-common-api/config/permisionConstants');


const USER_EXIST_ERR_CODE = {
   serverCode: 'UsernameExistsException',
   clientCode: 'addUserError'
  };

const createCompanySettings = async (companyId, userId, userEmail, companyName, accountType = constants.accountTypes.freemium) => {
  const legalEntityName = `${formatterLib.formatName(companyName)} ${constants.legalEntity.defaultLegalEntity.name}`;
  const legalEntityDisplayName = `${companyName} ${constants.legalEntity.defaultLegalEntity.name}`;
  if (!_.has(constants.accountTypes, accountType)) {
    jsonLogger.error({ type: "TRACKING", function: "companies::createCompanySettings", text: 'unknown account type specified - continuing as freemium' });
  }

  const companySettings = {
    itemId: constants.prefix.company + companyId,
    userId,
    companyId,
    entityId: companyId,
    itemStatus: constants.settings.status.active,
    itemData: {
      legalEntities: {
        [legalEntityName]: {
          legalDocs: {},
          displayName: legalEntityDisplayName,
          location: constants.legalEntity.defaultLegalEntity.location,
          isDefault: true
        }
      },
      limitedJobPostCount: 0,
      automaticPayments: true,
      sendJobNotification: true,
      sendLegalDocs: true,
      sendTalentAppLink: true,
      autoTalentInvoice: true,
      multipleCurrency: true,
      isFreemiumAccount: constants.accountTypes.fullAccess !== accountType,
      publicPosting: idPublicPosting === 'true',
      domains: [userEmail.substring(userEmail.indexOf('@') + 1)],
      autoApproveBudgetRequestThresholds: {
        userId,
        amount: constants.MAX_AUTO_APPROVE_BUDGET_REQUEST
      },
      budgetModuleActive: false,
      isChatFeatureActive: true,
      isTalentLakeEnabled: true,
      createChatRoomWithCandidate: true,
      payments: {
        advancePaymentLimit: 0,
        allowAccelerateBeyondPaymentLimit: false,
        advancePaymentLimitEnabled: true,
        disabledPaymentMethods: {}
      },
      taxDocumentsRestriction: {
        type: constants.multiLevelTypes.companyAdmin,
      },
      mockExamplesSetting: {
        enabled: true
      },
      modules: {
        [constants.companyModulesTypes.sourcingTalents]: true,
        [constants.companyModulesTypes.bringYourOwnTalents]: true,
        [constants.companyModulesTypes.talentsManagement]: true,
        [constants.companyModulesTypes.compliance]: true,
        [constants.companyModulesTypes.customsSettings]: true,
        [constants.companyModulesTypes.automations]: true,
        [constants.companyModulesTypes.budget]: false,
        [constants.companyModulesTypes.purchaseOrder]: false,
      }
    }
  };
  const result = await settingsService.create(companySettings);
  return result;
}

// eslint-disable-next-line max-lines-per-function
module.exports.signUp = async (event, context) => {
  const data = JSON.parse(event.body);
  const userId = event.requestContext.identity.cognitoIdentityId;
  const authProvider = event.requestContext.identity.cognitoAuthenticationProvider;
  const parts = authProvider.split(':');
  // eslint-disable-next-line no-magic-numbers
  const username = parts[parts.length - 1];
  const companyNamePrefix = data && data.entityName ? formatterLib.formatName(data.entityName) : '';
  const companyId = `${companyNamePrefix}${uuidv1()}`;
  const accountType = data && data.accountType;

  jsonLogger.info({
    type: "TRACKING",
    function: "users::signUp",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId, username, companyId, data, accountType
  });

  const userItemId = constants.prefix.userPoolId + username

  const existUser = await companiesService.get(userItemId)
  if (existUser) {
    jsonLogger.error({
      type: "TRACKING",
      function: "companies::signUp",
      functionName: context.functionName,
      awsRequestId: context.awsRequestId,
      text: 'Failed to signUp - user exist',
      existUser
    });
    return responseLib.failure({ status: false })
  }

  const { entityName, userEmail: originalUserEmail, givenName, familyName } = data
  const userEmail = originalUserEmail.trim()
  const entityCompanyItem = {
    entityId: companyId,
    companyId,
    itemData: {
      entityName
    },
    userId,
    prefix: constants.prefix.company,
  };

  let result = await entities.innerCreateEntity(entityCompanyItem, false, true);
  if (!result) {
    return responseLib.failure({ status: false })
  }

  result = await createCompanySettings(companyId, userId, userEmail, entityName, accountType);
  if (!result) {
    return responseLib.failure({ status: false })
  }

  if ([stages.prod, stages.demo].includes(stage)) {
    result = await addCompanyToUsagePlan(entityName, companyId, stage);
    jsonLogger.info({ type: "TRACKING", function: "companies::signUp", message: `added company to usage plan result: ${result}` });
  }

  const userCompanyItem = {
    companyId,
    itemId: userItemId,
    userId: userId,
    itemData: {
      userEmail,
      givenName,
      familyName,
    },
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active
  };
  const user = await companiesService.create(userCompanyItem);
  if (!user) {
    return responseLib.failure({ status: false })
  }

  const userAuthItem = {
    userId,
    entityId: companyId,
    companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
      userRole: constants.user.role.admin
    }
  };
  result = await users.innerAddUserToEntity(userAuthItem, true);
  if (!result) {
    return responseLib.failure({ status: false });
  }
  const companyNameEntityId = `${companyNamePrefix}${uuidv1()}`;
  const entityItem = {
    entityId: companyNameEntityId,
    companyId,
    itemData: {
      entityName: constants.defaultDepartment.entityName
    },
    userId,
    prefix: constants.prefix.entity,
  };

  result = await entities.innerCreateEntity(entityItem, false);
  if (!result) {
    return responseLib.failure({ status: false })
  }

  // adding the current user as admin to the new entity
  const userAuthItemForNewEntity = {
    userId,
    entityId: companyNameEntityId,
    companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
      userRole: constants.user.role.admin
    }
  };
  result = await users.innerAddUserToEntity(userAuthItemForNewEntity);
  if (!result) {
    return responseLib.failure({ status: false });
  }

  result = await createUserSettings(userId, companyId);

  return result ? responseLib.success(user) : responseLib.failure({ status: false });
}

// eslint-disable-next-line complexity
module.exports.signUpToCompany = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const authProvider = event.requestContext.identity.cognitoAuthenticationProvider;
  const parts = authProvider.split(':');
  // eslint-disable-next-line no-magic-numbers
  const username = parts[parts.length - 1];

  jsonLogger.info({ type: "TRACKING", function: "companies::signUpToCompany", userId, username, event, context });

  const itemId = constants.prefix.userPoolId + username
  const item = {
    itemId,
    userId: userId,
    itemStatus: constants.user.status.active,
    modifiedBy: userId
  };

  const result = await companiesService.update(item);
  if (!result) {
    jsonLogger.error({ type: "TRACKING", function: "companies::signUpToCompany", error: 'failed to update user', item });
    return responseLib.failure(result)
  }

  const user = await companiesService.get(itemId);
  if (!user) {
    jsonLogger.error({ type: "TRACKING", function: "companies::signUpToCompany", error: 'failed to find user', itemId });
    return responseLib.failure(user)
  }

  const { companyId, itemData, createdBy } = user;
  const { userCreationTimeEntityId: entityId, userEmail, isEditor, userCreationTimeTeams: teams, permissionsComponents } = itemData || {};
  const userCreationTimeEntityIds = entityIdToEntitiesIds(entityId);

  const { role } = itemData || {};
  let { isCompanyAdmin } = itemData || {};
  const userPermissionScope = role === constants.user.role.admin && isCompanyAdmin ? permissionScope.companyAdmin : permissionScope.workspaceAdmin
  if (!_.isEmpty(permissionsComponents) && !isPermissionsComponentsValid(permissionsComponents, userPermissionScope)) {
    jsonLogger.error({ type: 'TRACKING', function: 'companies::signUpToCompany', message: `not valid permissions components` });
    return responseLib.failure({ status: false });
  }

  
const { role: createdByRole, entitiesAdmin } = await usersService.getCompanyUsersData(createdBy, companyId);
  const isCreatedByCompAdmin = createdByRole === constants.user.role.admin;
  if (!canAddToEntities(isCreatedByCompAdmin, entitiesAdmin, userCreationTimeEntityIds)) {
    jsonLogger.error({ function: 'companies::signUpToCompany', error: 'insufficient previliges to add user to entities ', userCreationTimeEntityIds, 'isCompanyAdmin': isCompanyAdmin });
    return responseLib.failure({ status: false });
  }

  const isCreatedByStokeAdminApp = createdBy === constants.admin.userId;

  isCompanyAdmin = (isCreatedByStokeAdminApp || isCreatedByCompAdmin) && isCompanyAdmin;
  jsonLogger.info({ function: 'companies::signUpToCompany', isCreatedByCompAdmin, isCreatedByStokeAdminApp, isCompanyAdmin, role, entityId, companyId });
  const addUserToEntitiesRes = await addUserToEntities(userCreationTimeEntityIds, isCompanyAdmin, userId, companyId, role, isEditor, userCreationTimeEntityIds.length === 1 ? teams : [], permissionsComponents);
  if (!addUserToEntitiesRes) {
    jsonLogger.error({ function: 'companies::signUpToCompany', error: 'failed to add user to entites', userCreationTimeEntityIds });
    return responseLib.failure({ status: false });
  }

  const createdSettings = await createUserSettings(userId, companyId);
  jsonLogger.info({ function: 'companies::signUpToCompany', text: 'created userSettings', createdSettings });

  if (!IS_OFFLINE && userEmail) {
    try {
      const userPoolIdParts = parts[parts.length - 3].split('/');
      const userPoolId = userPoolIdParts[userPoolIdParts.length - 1];
      if (!userPoolId) {
        return responseLib.failure({ message: 'missing userPoolId in body string' });
      }
      await cognitoLib.adminUpdateUserAttributes(userPoolId, userEmail.toLowerCase(), [
        {
          Name: 'email_verified',
          Value: 'true'
        }
      ]);
    } catch (e) {
      jsonLogger.error({ function: 'companies::signUpToCompany', text: 'Failed to verified email', username });
    }
  }

  return user ? responseLib.success(user) : responseLib.failure({ status: false });
}

/**
 * generateUserCompanyItemId - generates the relavant item id for the new user incompany
 * @private
 * @param {boolean} isSsoRegistrationFlow - if this is an sso registration user or regular
 * @param {string} itemId - the ragular itemId, not containing prefix
 * @param {string} userEmail - email of the registered user
 * @returns {string} string containing the final item Id - with special
 */
const generateUserCompanyItemId = (isSsoRegistrationFlow, itemId, userEmail) => {
  if (isSsoRegistrationFlow) {
    const downcasedEmail = userEmail.toLowerCase()
    return `${constants.prefix.userPoolId}${constants.prefix.external}${downcasedEmail}`
  }

  return constants.prefix.userPoolId + itemId
}

// eslint-disable-next-line max-lines-per-function, complexity
module.exports.addUserToCompany = async (event, context) => {
  const data = JSON.parse(event.body);
  const userId = event.requestContext.identity.cognitoIdentityId;
  const { companyId, userCreationTimeEntityId, role, permissionsComponents, userEmail: userEmailInput } = data;
  const userCreationTimeEntityIds = entityIdToEntitiesIds(userCreationTimeEntityId);
  const userEmail = _.toLower(userEmailInput).trim();
  jsonLogger.info({ type: "TRACKING", function: "users::addUserToCompany", functionName: context.functionName, awsRequestId: context.awsRequestId, userId, companyId, data, role, permissionsComponents });
  if (!companyId || !userCreationTimeEntityIds || userCreationTimeEntityIds.length === 0) {
    return responseLib.failure({ message: 'missing companyId/userCreationTimeEntityId in body' });
  }

  const isCompanyAdminIncluded = userCreationTimeEntityIds.includes(companyId);
  const invitorUserWorkspaces = await usersService.listEntities(userId);
  const isInvitingCustomRoleUser = !_.isEmpty(permissionsComponents);

  if (_.isEmpty(invitorUserWorkspaces)) {
    jsonLogger.error({ type: 'TRACKING', function: 'companies::addUserToCompany', message: `user which is not part of entities trying to add another user` });
    return responseLib.failure({ status: false });
  }

  const invitorUserPermissionsComponents = _.get(invitorUserWorkspaces, '[0].itemData.permissionsComponents', {});
  const isInvitorWithCustomRole = !_.isEmpty(invitorUserPermissionsComponents);
  const userPermissionScope = role === constants.user.role.admin && isCompanyAdminIncluded ? permissionScope.companyAdmin : permissionScope.workspaceAdmin;

  if (isInvitingCustomRoleUser && !isPermissionsComponentsValid(permissionsComponents, userPermissionScope)) {
    jsonLogger.error({ type: 'TRACKING', function: 'companies::addUserToCompany', message: `not valid permissions components` });
    return responseLib.failure({ status: false });
  }

  if (isInvitingCustomRoleUser && isInvitorWithCustomRole) {
    jsonLogger.error({ type: 'TRACKING', function: 'companies::addUserToCompany', message: `user with custom role can't invite custom role` });
    return responseLib.failure({ status: false });
  }

  const ssoRegistrationFlow = await settingsHelper.isSSoRegistration(companyId, userEmail)
  const { role: createdByRole, entitiesAdmin } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true } });
  const isCreatedByCompAdmin = createdByRole === constants.user.role.admin;
  const allValidateEntities = await Promise.all(userCreationTimeEntityIds.map((userCTimeEntityId) => companiesService.get(`${constants.prefix.entity}${userCTimeEntityId}`)));
  if (!isCompanyAdminIncluded) {
    for (const validateEntity of allValidateEntities) {
      if (!validateEntity || validateEntity.itemStatus === constants.itemStatus.inactive) {
        jsonLogger.error({ type: "TRACKING", function: "companies::addUserToCompany", error: `can't add user to an inactive entity` });
        return responseLib.forbidden({ status: false, message: `can't add user to an inactive entity` })
      }
    }
  }
  if (canAddToEntities(isCreatedByCompAdmin, entitiesAdmin, userCreationTimeEntityIds) && !isInvitorWithCustomRole) {
    let itemId = data.givenName + data.familyName;
    if (!IS_OFFLINE) {
      try {
        if (ssoRegistrationFlow) {
          jsonLogger.info({ type: "TRACKING", function: "users::addUserToCompany", message: "external user registration - send email via asyncTasksQueue" });
          await asyncTasksQueue.sendMessage({ taskData: { userEmail, companyId }, type: constants.sqsAsyncTasks.types.addSsoUserToCompany })
        } else {
          const cognitoUser = await userHelper.createCognitoUser(USER_POOL_ID, data);
          itemId = cognitoUser.User.Username;
        }
      } catch (e) {
        jsonLogger.error({ type: "TRACKING", function: "users::addUserToCompany", message: "failed to create user", error: e.message });
        return e.code === USER_EXIST_ERR_CODE.serverCode ? responseLib.success({ status: true }) : responseLib.failure({ status: false });
      }
    }

    jsonLogger.info({ type: "TRACKING", function: "users::addUserToCompany", functionName: context.functionName, message: 'CAN ADD ENTITIES' });
    const userItem = {
      companyId,
      itemId: generateUserCompanyItemId(ssoRegistrationFlow, itemId, userEmail),
      itemData: {
        ...data,
        userEmail: userEmail,
        isCompanyAdmin: isCompanyAdminIncluded
      },
      createdBy: userId,
      modifiedBy: userId,
      itemStatus: constants.user.status.invited
    };
    const result = await companiesService.create(userItem);

    await snsLib.publish(userActionsSnsTopicArn, 'users::addUserToCompany', userItem);

    return result ? responseLib.success(result) : responseLib.failure({ status: false });
  }

  // case user don't have permissions
  try {
    const taskData = {
      companyId,
      invitingUserId: userId,
      invitedUserData: data,
    };
    await asyncTasksQueue.sendMessage({ taskData, type: constants.sqsAsyncTasks.types.requestToAddNewUserToWorkspace });
    return responseLib.accepted({ status: true });
  } catch (e) {
    jsonLogger.error({ type: 'TRACKING', function: 'companies::addUserToCompany', text: `exception - ${e.message}`, e });
  }

  return responseLib.forbidden({ status: false, message: `can't add user to entity, lake permissions` })
}

// eslint-disable-next-line max-lines-per-function
module.exports.resendInvitation = async (event, context) => {
  const data = JSON.parse(event.body);

  const userId = event.requestContext.identity.cognitoIdentityId;
  const { companyId, email, entityId } = data;

  jsonLogger.info({
    type: "TRACKING",
    function: "users::resendInvitation",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId, data
  });

  if (!companyId || !email || !entityId) {
    return responseLib.failure({ message: 'missing required parameters in body' });
  }
  const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true } });
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }

  const result = await userHelper.resendInvitationToUser(companyId, email);
  return result ? responseLib.success({ status: true }) : responseLib.failure({ status: false });
}

module.exports.getCompanyUsers = async (event, context) => {
  jsonLogger.info({ type: "TRACKING", function: "companies::getCompanyUsers", event });
  const userId = event.requestContext.identity.cognitoIdentityId;
  const companyId = event.pathParameters.id;

  if (!companyId) {
    return responseLib.failure({ message: 'missing companyId in query string' });
  }

  jsonLogger.info({
    type: "TRACKING",
    function: "users::getUsersOfCompany",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId, companyId
  });

  const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.users]: { } })
  if (role === constants.user.role.unauthorised) {
    return responseLib.forbidden({ status: false });
  }

  let filterExpression = " attribute_exists(userId) ";

  const { queryStringParameters } = event
  if (queryStringParameters && queryStringParameters.all) {
    filterExpression = null;
  }

  let result = await companiesService.list(gsiItemsByCompanyIdIndexName, companyId, constants.prefix.userPoolId, {}, filterExpression, {}, true);
  if (queryStringParameters && queryStringParameters.withEntities) {
    let expressionAttributeValues = {};
    filterExpression = null;
    if (!role === constants.user.role.user) {
      const relevantEntites = _.concat(entitiesAdmin, entitiesUser).map((item) => item.entityId);
      ({ expressionAttributeValues, filterExpression } = dynamoDbUtils.generateExepressionForList(relevantEntites, `entityId`));
    }
    const keyConditionExpression = "companyId = :companyId";
    expressionAttributeValues[":companyId"] = companyId

    const authUsers = await usersService.list(gsiItemsByCompanyIdIndexName, keyConditionExpression, expressionAttributeValues, filterExpression);
    const authUsersByUserId = _.groupBy(authUsers, user => _.get(user, 'userId'));
    const usersPermissions = {}
    const authUsersReduced = authUsers.reduce((acc, cur) => {
      acc[cur.userId] = acc[cur.userId] || []
      acc[cur.userId].push(cur.entityId)
      usersPermissions[cur.userId] = {
        ...usersPermissions[cur.userId],
        [cur.entityId]: { isEditor: _.get(cur, 'itemData.isEditor', true) }
      }
      return acc;
    }, {});
    result = result.map((user) => {
      user.itemData.departmentIds = authUsersReduced[user.userId]
      user.itemData.userPermissions = usersPermissions[user.userId]
      user.itemData.permissionsComponents = _.get(authUsersByUserId[user.userId], '[0].itemData.permissionsComponents')
      return user
    })
  }

  return result ? responseLib.success(result) : responseLib.failure({ status: false });
}

module.exports.updateUserInCompany = async (event, context) => {
  const data = JSON.parse(event.body);
  const itemId = event.pathParameters.id;
  const userId = event.requestContext.identity.cognitoIdentityId;
  const { companyId } = data;

  jsonLogger.info({
    type: "TRACKING",
    function: "users::updateUserInCompany",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId, companyId, data, itemId,
  });

  if (!companyId) {
    return responseLib.failure({ message: 'missing companyId in body string' });
  }
  const authorised = await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true } });
  if (!authorised) {
    jsonLogger.error({ type: 'error', function: 'companies::updateUserInCompany', message: 'Updater user is not authorised' });
    return responseLib.forbidden({ status: false });
  }

  const userItemUpdate = {
    companyId,
    itemId,
    modifiedBy: userId,
    itemData: {
      userEmail: data.userEmail,
      givenName: data.givenName,
      familyName: data.familyName,
    }
  };

  const result = await companiesService.update(userItemUpdate);
  return responseLib.send(result);
}

// eslint-disable-next-line valid-jsdoc
/**
 * deleteUserInCompany - delete OR deactivate OR reactivate 
 * @param {object} event - event
 * event.pathParameters.id: contain `userPoolId` or `userId`
 *    - userPoolId: in case of `deactivate` or `delete` user actions
 *    - userId: in case `reactivate` deactivated user
 * event.body: 
 *    - isValidation: `true` to validate the operetion is possible 
 *                    `false` to perform the this entry.
 *    - isUndo: `false`/`undefined` when  we like to `delete` or `deactivate` the user
 *              `true` when we like to reactivate the user 
 *    - undoCompanyId: set and needed only when `isUndo` set to `true`
 *  @return undefined
 */
module.exports.deleteUserInCompany = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const userToDeleteId = event.pathParameters.id;
  const { undoCompanyId } = event.queryStringParameters;
  const isValidation = event.queryStringParameters.isValidation === 'true';
  const isUndo = event.queryStringParameters.isUndo === 'true';

  jsonLogger.info({
    type: "TRACKING", function: "companies::deleteUserInCompany", functionName: context.functionName, awsRequestId: context.awsRequestId,
    userId, userPoolUserIdToDelete: userToDeleteId, isValidation
  });

  if (!userToDeleteId) {
    return responseLib.failure({ message: 'missing key params in query string' });
  }

  const userToDelete = isUndo ? _.get(await companiesService.listByCompanyIdAndUserId(gsiItemsByCompanyIdIndexName, undoCompanyId, [userToDeleteId]), '[0]') : await companiesService.get(userToDeleteId);
  if (!userToDelete) {
    jsonLogger.error({ type: 'TRACKING', function: 'companies::deleteUserInCompany', error: "user not found", userPoolUserIdToDelete: userToDeleteId });
    return responseLib.forbidden({ status: false });
  }

  const { companyId } = userToDelete;
  const authorised = await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true } });
  if (!authorised) return responseLib.forbidden({ status: false });

  const { userId: userIdToDelete } = userToDelete;
  jsonLogger.info({ type: 'TRACKING', function: 'companies::deleteUserInCompany', userIdToDelete, userToDelete });
  
  if (userId === userIdToDelete) {
      jsonLogger.error({ type: 'TRACKING', function: 'companies::deleteUserInCompany', message: 'user was trying to delete itself, aborting' });
      return responseLib.forbidden({ status: false });
  }

  const { status, reason } = userIdToDelete
    ? await userHelper.validateDeleteUser(companyId, null, userIdToDelete, null, !isValidation)
    : { status: true };
  jsonLogger.info({ type: 'TRACKING', function: 'companies::deleteUserInCompany', status, reason });

  if (isValidation || !status) {
    return createResponse(status, reason);
  }

  if (isUndo) {
    const userEntities = await usersService.listEntities(userIdToDelete, companyId);
    const entityIds = _.map(userEntities, 'entityId');
    await userHelper.updateUserStatusInEntities(userIdToDelete, entityIds, userId, constants.user.status.active);
    const userPoolIdToReactivate = _.get(userToDelete, 'itemId')
    
    
    const reactivateResult = await userHelper.deactivateUserFromCompany(userPoolIdToReactivate, userId, isUndo, !userHelper.isSsoItemId(userPoolIdToReactivate));
    jsonLogger.info({ type: 'TRACKING', function: 'reactivateUserInCompany::handler', reactivateResult });
    return createResponse(reactivateResult);
  }

  if (userIdToDelete) {
    const { entitiesAdmin, entitiesUser } = await usersService.getCompanyUsersData(userIdToDelete, companyId);
    const userEntities = [...entitiesAdmin, ...entitiesUser];
    const entityIds = _.map(userEntities, 'entityId');
    
    await userHelper.updateUserStatusInEntities(userIdToDelete, entityIds, userId, constants.user.status.inactive);
  }

  const deactivateResult = await userHelper.deactivateUserFromCompany(userToDeleteId, userId, null, !userHelper.isSsoItemId(userToDeleteId));
  jsonLogger.info({ type: 'TRACKING', function: 'companies::deleteUserInCompany', deactivateResult });
  return createResponse(deactivateResult);

}


// eslint-disable-next-line array-element-newline
const UPDATE_COMPANY_FIELDS = ["invoiceName", "companyTaxId", "country", "city", "address", "postalCode", "state"];
module.exports.updateCompany = async (event, context) => {
  jsonLogger.info({ function: "companies::updateCompany", event, context });

  const userId = event.requestContext.identity.cognitoIdentityId;
  const { companyId } = event.pathParameters || {};
  const data = JSON.parse(event.body);

  if (!companyId) {
    return responseLib.failure();
  }

  const isCompanyAdmin = await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.billing]: { isEditor: true } });
  if (!isCompanyAdmin) {
    return responseLib.forbidden({ status: false });
  }

  const itemId = `${constants.prefix.company}${companyId}`;
  const company = await companiesService.get(itemId);
  if (!company) {
    jsonLogger.error({ function: "companies::updateCompany", error: "Company not found", companyId });
    return responseLib.forbidden({ status: false });
  }

  const companyToUpdate = {
    itemId,
    modifiedBy: userId,
    itemData: {
      ...company.itemData,
      ..._.pick(data, UPDATE_COMPANY_FIELDS),
    }
  };

  const result = await companiesService.update(companyToUpdate);
  jsonLogger.info({ function: "companies::updateCompany", result });
  return responseLib.send(result);
}
