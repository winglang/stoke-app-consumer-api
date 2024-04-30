/* eslint-disable max-lines */
/* eslint-disable newline-per-chained-call */
/* eslint-disable max-lines-per-function */
/* eslint-disable max-params */
/* eslint-disable no-magic-numbers */

'use strict';

const {
    customersTableName,
    consumerAuthTableName,
	gsiItemsByCompanyIdIndexName,
	settingsTableName,
} = process.env;

const _ = require('lodash');
const budgets = require('./budgets');
const { constants, CompaniesService, UsersService, jsonLogger, SettingsService } = require('stoke-app-common-api');
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAndTagsAttributes)
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes); 

const defaultLists = {
	talentDirectory: {
		'__stoke__favoriteTalents': {
			displayName: "Favorite",
			listData: {}
		}
	}
}

const extractSubFromAuthProvider = (cognitoAuthProvider) => {
	let cognitoSub = ''
	
	try {
		const parts = cognitoAuthProvider.split(':');
		cognitoSub = parts[parts.length - 1];
	} catch (error) {
		jsonLogger.error({ type: 'TRACKING', 
			function: 'signupUserToCompanyUtil::getUserData', 
			functionName: 'isExternalProviderInvited',
			text: `extractSubFromAuthProvider failure. error is ${error}` });
	}

	return cognitoSub;
}

const innerAddUserToEntity = async (item, createCompanyPool) => {
	jsonLogger.info({ type: 'TRACKING', function: 'signupUserToCompanyUtil::innerAddUserToEntity', item, createCompanyPool });
	const { companyId, userId, entityId } = item || {};
	let result = await budgets.createBaseBudget({ companyId, userId, entityId, itemId: constants.prefix.user + userId }, createCompanyPool);
	if (!result) {
		jsonLogger.error({ type: 'TRACKING', function: 'signupUserToCompanyUtil::innerAddUserToEntity', message: "Failed to create based budget for the user in department", item });
		return false;
	}
	result = await usersService.create(item);
	return result;
}

const getCompanyEntityIds = async (companyId) => {
	jsonLogger.info({ type: "TRACKING", function: "signupUserToCompanyUtil::getCompanyEntityIds", companyId });
  
	const companyItems = await companiesService.list(gsiItemsByCompanyIdIndexName, companyId);
	if (!companyItems) {
		jsonLogger.error({ type: "TRACKING", function: "signupUserToCompanyUtil::getCompanyEntityIds", error: 'failed to get available entities' });
		return null;
	}
  
	const entityIds = companyItems.
		filter((item) => item).
		filter((item) => item.itemId.startsWith(constants.prefix.company) || item.itemId.startsWith(constants.prefix.entity)).
		map((item) => item.itemId.replace(constants.prefix.company, '').replace(constants.prefix.entity, ''));
  
	jsonLogger.info({ type: "TRACKING", function: "signupUserToCompanyUtil::getCompanyEntityIds", entityIds });
	return entityIds;
  };

const createUserSettings = async (userId, companyId) => {
	const userSettings = {
		itemId: constants.prefix.user + userId,
		userId,
		companyId,
		entityId: companyId,
		itemStatus: constants.settings.status.active,
		itemData: {
			[constants.USER_SETTINGS_TYPE.getStarted]: {},
			list: defaultLists,
		}
	};
	const result = await settingsService.create(userSettings);
	return result;
  }

const entityIdToEntitiesIds = (entityId) => {
    if (entityId) {
      return _.isArray(entityId) ? entityId : [entityId];
    }
    return []
}

const addUserToEntities = async (entityId, isCompanyAdmin, userId, companyId, requestedRole, isEditor, teams, permissionsComponents) => {
	jsonLogger.info({ type: "TRACKING", function: "signupUserToCompanyUtil::addUserToEntities", entityId, isCompanyAdmin, userId, companyId, requestedRole, teams, isEditor });
  
	if (!entityId && !isCompanyAdmin) {
		jsonLogger.error({ type: "TRACKING", function: "signupUserToCompanyUtil::addUserToEntities", error: 'missing entityId' });
		return null;
	}
  
	let userRole = requestedRole || constants.user.role.user;
	let entityIds = entityIdToEntitiesIds(entityId);
	let tags = null;
	let entityToTeams = {};
	if (!isCompanyAdmin && entityIds.length > 0) {
		entityIds = entityIdToEntitiesIds(entityId);
		if (teams) {
			tags = {
				[constants.tags.teams]: teams,
			};
		}
	} else if (isCompanyAdmin) {
		userRole = constants.user.role.admin;
		entityIds = await getCompanyEntityIds(companyId);
		const entites = await companiesService.list(gsiItemsByCompanyIdIndexName, companyId, constants.prefix.entity);
		entityToTeams = _.keyBy(entites, 'itemId')
	}
  
	jsonLogger.info({ type: "TRACKING", function: "signupUserToCompanyUtil::addUserToEntities", entityIds });
	const userAuthItems = entityIds.map((entId) => ({
		userId,
		entityId: entId,
		companyId,
		createdBy: userId,
		modifiedBy: userId,
		itemStatus: constants.user.status.active,
		itemData: {
			userRole,
			isEditor,
			permissionsComponents,
		},
		tags: isCompanyAdmin ? _.get(entityToTeams, `${constants.prefix.entity}${entId}.tags`, {}) : tags,
	}));
	await Promise.all(userAuthItems.map((item) => innerAddUserToEntity(item)));
	return true;
  }


const canAddToEntities = (isCreatedByCompAdmin, entitiesAdmin, userCreationTimeEntityIds) => {
    if (isCreatedByCompAdmin) { 
      return true; 
    }
    const entitiesCanAdd = _.filter(userCreationTimeEntityIds, (userCTimeEntityId) => _.find(entitiesAdmin, (entity) => entity.entityId === userCTimeEntityId && entity.itemStatus !== constants.itemStatus.inactive))
    return entitiesCanAdd.length === userCreationTimeEntityIds.length;
}

const signUpExternalProviderToCompany = async (itemId, userId, authProvider) => {
	jsonLogger.info({ type: "TRACKING", function: "signupUserToCompanyUtil::signUpExternalProviderToCompany", itemId, userId, authProvider });
	
	const item = {
		itemId, 
		userId: userId, 
		itemStatus: constants.user.status.active, 
		modifiedBy: userId
	};
    
	const result = await companiesService.update(item);
	if (!result) {
		jsonLogger.error({ type: "TRACKING", function: "signupUserToCompanyUtil::signUpExternalProviderToCompany", error: 'failed to update user', item });
		return false
	}

	const user = await companiesService.get(itemId);
	if (!user) {
		jsonLogger.error({ type: "TRACKING", function: "signupUserToCompanyUtil::signUpExternalProviderToCompany", error: 'failed to find user', itemId });
		return false
	}

	const { companyId, itemData, createdBy } = user;
	const { userCreationTimeEntityId: entityId, isEditor, userCreationTimeTeams: teams, permissionsComponents } = itemData || {};
	const userCreationTimeEntityIds = entityIdToEntitiesIds(entityId);

	const { role } = itemData || {};
	let { isCompanyAdmin } = itemData || {};

	const { role: createdByRole, entitiesAdmin } = await usersService.getCompanyUsersData(createdBy, companyId);
	const isCreatedByCompAdmin = createdByRole === constants.user.role.admin;
	if (!canAddToEntities(isCreatedByCompAdmin, entitiesAdmin, userCreationTimeEntityIds)) {
		jsonLogger.error({ function: 'signupUserToCompanyUtil::signUpExternalProviderToCompany', error: 'insufficient previliges to add user to entities ', userCreationTimeEntityIds, 'isCompanyAdmin': isCompanyAdmin });
		return false
	}

	const isCreatedByStokeAdminApp = createdBy === constants.admin.userId;

	isCompanyAdmin = (isCreatedByStokeAdminApp || isCreatedByCompAdmin) && isCompanyAdmin;
	jsonLogger.info({ function: 'signupUserToCompanyUtil::signUpToCompany', isCreatedByCompAdmin, isCreatedByStokeAdminApp, isCompanyAdmin, role, entityId, companyId });
	const addUserToEntitiesRes = await addUserToEntities(userCreationTimeEntityIds, isCompanyAdmin, userId, companyId, role, isEditor, userCreationTimeEntityIds.length === 1 ? teams : [], permissionsComponents);
	if (!addUserToEntitiesRes) {
		jsonLogger.error({ function: 'signupUserToCompanyUtil::signUpExternalProviderToCompany', error: 'failed to add user to entites', userCreationTimeEntityIds });
		return false
	}

	jsonLogger.info({ function: 'signupUserToCompanyUtil::signUpExternalProviderToCompany', text: 'about to create userSettings' });
	const createdSettings = await createUserSettings(userId, companyId);
	jsonLogger.info({ function: 'signupUserToCompanyUtil::signUpExternalProviderToCompany', text: 'created userSettings', createdSettings });

	return user
}

module.exports = {
	signUpExternalProviderToCompany,
	canAddToEntities,
	addUserToEntities,
	entityIdToEntitiesIds,
	createUserSettings,
	getCompanyEntityIds,
	innerAddUserToEntity,
	extractSubFromAuthProvider
}
