/* eslint-disable max-params */

'use strict';

const _ = require('lodash');
const AWS = require('aws-sdk');

const {
    constants, jsonLogger, budgetHelper, cognitoLib,
    UsersService, BudgetsService, CompaniesService, teamsService, SettingsService, SqsService,
} = require('stoke-app-common-api');

const auth = require('../auth');
const jobHelper = require('./jobHelper');
const settingsHelper = require('./settingsHelper');
const { createResult, createArray } = require('./commonHelper');

const {
    consumerAuthTableName,
    budgetsTableName,
    customersTableName,
    gsiItemsByCompanyIdAndItemIdIndexName,
    USER_POOL_ID,
    asyncTasksQueueName,
    settingsTableName,
} = process.env;

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const asyncTasksQueue = new SqsService(asyncTasksQueueName);

const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
const MessageAction = {
    RESEND: 'RESEND',
    SUPPRESS: 'SUPPRESS'
}
  
const getBudgetsByUserId = async (companyId, entityId, userId) => {
    jsonLogger.info({ type: 'TRACKING', function: 'userHelper::getBudgetsByUserId', companyId, entityId, userId });

    const itemId = `${constants.prefix.user}${userId}`;
    const budgets = entityId
        ? createArray(await budgetsService.get(entityId, itemId))
        : await budgetsService.listCompany(gsiItemsByCompanyIdAndItemIdIndexName, companyId, itemId, userId);

    jsonLogger.info({ type: 'TRACKING', function: 'userHelper::getBudgetsByUserId', budgets });
    return budgets;
}

const getFutureBudgets = async (companyId, entityId, userId) => {
    jsonLogger.info({ type: 'TRACKING', function: 'userHelper::getFutureBudgets', companyId, entityId, userId });
    const budgets = await getBudgetsByUserId(companyId, entityId, userId);
    return budgetHelper.getFutureAvailableBudgets(budgets);
}

const validateDeleteUser = async (companyId, entityId, userId, teamName, archiveDrafts) => {
    jsonLogger.info({ type: 'TRACKING', function: 'userHelper::validateDeleteUser', companyId, entityId, userId, teamName });

    if (!companyId && !entityId) {
        jsonLogger.error({ type: 'TRACKING', function: 'userHelper::validateDeleteUser', message: 'Missing action scope' });
        return createResult(false, "MISSING_PARAMS");
    }
    if (!entityId && teamName) {
        jsonLogger.error({ type: 'TRACKING', function: 'userHelper::validateDeleteUser', message: 'Missing entityId for team scope action' });
        return createResult(false, "MISSING_PARAMS");
    }
    if (!userId) {
        jsonLogger.error({ type: 'TRACKING', function: 'userHelper::validateDeleteUser', message: 'Missing mandatory params' });
        return createResult(false, "MISSING_PARAMS");
    }

    const jobs = await jobHelper.getJobsByHiringManager(companyId, entityId, userId);
    if (archiveDrafts) {
        await jobHelper.archiveAllDrafts(jobs);
    }
    let notFinalizedJobs = jobHelper.getNonFinalizedJobs(jobs);
    if (teamName) {
        notFinalizedJobs = _.filter(notFinalizedJobs, (job) => _.includes(teamsService.get(job), teamName));
    }

    if (!_.isEmpty(notFinalizedJobs)) {
        jsonLogger.info({ type: 'TRACKING', function: 'userHelper::validateDeleteUser', message: 'User has jobs that are not finalized', notFinalizedJobs });
        return createResult(false, "USER_HAS_NON_FINALIZED_JOBS");
    }

    if (!teamName) {
        const companySetting = await settingsService.get(`${constants.prefix.company}${companyId}`);
        const isBudgetModuleActive = _.get(companySetting, 'itemData.budgetModuleActive', true);
        if (!isBudgetModuleActive) { 
            jsonLogger.info({ type: 'TRACKING', function: 'userHelper::validateDeleteUser', message: 'Budget module not active' });
            return createResult(true, "COMPANY_BUDGET_MODULE_NOT_ACTIVE");
        }

        const budgets = await getFutureBudgets(companyId, entityId, userId);
        if (!_.isEmpty(budgets)) {
            const isCompanyPoolOnUser = _.find(budgets, budget => budget.entityId === companyId)
            jsonLogger.info({ type: 'TRACKING', function: 'userHelper::validateDeleteUser', message: 'User has future budgets' });
            return createResult(false, isCompanyPoolOnUser ? "USER_HAS_COMPANY_POOL" : "USER_HAS_FUTURE_BUDGETS");
        }
    }

    jsonLogger.info({ type: 'TRACKING', function: 'userHelper::validateDeleteUser', status: true });
    return createResult(true);
};

const updateUserStatusInEntities = async (userIdToReactivate, entityIds = [], modifiedByUserId, updateStatus) => {
    jsonLogger.info({ type: 'TRACKING', function: 'userHelper::updateUserStatusInEntities', userIdToDelete: userIdToReactivate, entityIds, modifiedByUserId });
    const promises = _.map(entityIds, (entityId) => usersService.setItemStatus(
        {
          userId: userIdToReactivate,
          entityId,
        },
        updateStatus,
        modifiedByUserId,
      ));
  
      const results = await Promise.all(promises);
      const result = !results.includes(null);
      jsonLogger.info({ type: 'TRACKING', function: 'companies::updateUserStatusInEntities', result, results });
      return result;
};

const deactivateUserFromCompany = async (userPoolUserIdToDelete, modifiedByUserId, isUndo, changeStatusInCognito = true) => {
    jsonLogger.info({ type: 'TRACKING', function: 'userHelper::deactivateUserFromCompany', userPoolUserIdToDelete, modifiedByUserId, isUndo, changeStatusInCognito });

    // eslint-disable-next-line array-element-newline
    const [prefix, userName] = userPoolUserIdToDelete.split('_');
    if (!prefix || !userName) {
        jsonLogger.error({ type: 'TRACKING', function: 'userHelper::deactivateUserFromCompany', message: 'Invalid user pool user id', userPoolUserIdToDelete });
        return false;
    }

    jsonLogger.info({ type: 'TRACKING', function: 'userHelper::deactivateUserFromCompany', prefix, userName });
    
    if (changeStatusInCognito) {
        const disableUserResult = isUndo ? await cognitoLib.enableUser(USER_POOL_ID, userName) : await cognitoLib.disableUser(USER_POOL_ID, userName);
        if (!disableUserResult) {
            jsonLogger.error({ type: 'TRACKING', function: 'userHelper::deactivateUserFromCompany', message: 'Failed to disable cognito user' });
            return false;
        }
    }

    const updatedUser = {
        itemId: userPoolUserIdToDelete,
        itemStatus: isUndo ? constants.user.status.active : constants.user.status.inactive,
        modifiedBy: modifiedByUserId,
    };

    const updateResult = await companiesService.update(updatedUser)
    if (!updateResult) {
        jsonLogger.error({ type: 'TRACKING', function: 'userHelper::deactivateUserFromCompany', message: 'Failed to update user status' });
        return false;
    }

    jsonLogger.info({ type: 'TRACKING', function: 'userHelper::deactivateUserFromCompany', message: `${isUndo ? "enabled" : "disabled"} successfully` });
    return true;
};


// eslint-disable-next-line max-params
const removeUserFromTeam = async (userIdToDelete, entityId, teamName, modifiedByUserId) => {
    jsonLogger.info({ type: 'TRACKING', function: 'userHelper::removeUserFromTeam', userIdToDelete, entityId, teamName, modifiedByUserId });

    const user = await usersService.get(userIdToDelete, entityId);
    if (!user) {
        jsonLogger.error({ type: 'TRACKING', function: 'userHelper::removeUserFromTeam', error: "user not found", userIdToDelete, entityId });
        return false;
    }

    const userToUpdate = teamsService.remove(user, [teamName]);
    userToUpdate.modifiedBy = modifiedByUserId;
    const result = await usersService.update(userToUpdate);
    if (!result) {
        jsonLogger.error({ type: 'TRACKING', function: 'userHelper::removeUserFromTeam', error: "Failed to update user" });
        return false;
    }

    jsonLogger.info({ type: 'TRACKING', function: 'userHelper::removeUserFromTeam', result });
    return result;
};

const buildExternalProviderUserPoolId = (userId) => `${constants.prefix.userPoolId}${constants.prefix.external}${userId}`;
const isSsoItemId = (itemId) => itemId.includes(constants.prefix.external)

const createCognitoUser = async (userPoolId, data, messageAction) => {
    // eslint-disable-next-line prefer-const
    let { userEmail, familyName, givenName } = data
    userEmail = userEmail.trim().toLowerCase()
    const encrypted = await auth.cipherInput(userEmail)
    const params = {
      DesiredDeliveryMediums: ["EMAIL"],
      UserPoolId: userPoolId,
      MessageAction: messageAction,
      Username: userEmail,
      UserAttributes: messageAction ? [] : [
        {
          Name: 'email',
          Value: userEmail
        },
        {
          Name: 'family_name',
          Value: familyName
        },
        {
          Name: 'given_name',
          Value: givenName
        },
  
      ],
      ValidationData: [
        {
          Name: 'invitationId',
          Value: encrypted
        }
      ]
    };
    return new Promise((resolve, reject) => {
      cognitoidentityserviceprovider.adminCreateUser(params, (err, cognitoUser) => {
        if (err) {
          jsonLogger.error({ type: "TRACKING", function: "users::createCognitoUser", text: "exception from cognitoidentityserviceprovider.adminCreateUser ", err, params });
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(err);
        } else {
          jsonLogger.info({ type: "TRACKING", function: "users::createCognitoUser", text: "cognitoidentityserviceprovider.adminCreateUser returned", cognitoUser });
          resolve(cognitoUser);
        }
      });
    })
}

const resendInvitationToUser = async (companyId, email) => {
    jsonLogger.info({ type: "TRACKING", function: 'users::resendInvitation', companyId, email });
  
    const isSSoRegistrationFlow = await settingsHelper.isSSoRegistration(companyId, email);
    if (isSSoRegistrationFlow) {
      await asyncTasksQueue.sendMessage({ taskData: { userEmail: email, companyId }, type: constants.sqsAsyncTasks.types.addSsoUserToCompany });
      return true;
    }
  
    const cognitoUser = await createCognitoUser(USER_POOL_ID, { userEmail: email }, MessageAction.RESEND);
    jsonLogger.info({ type: "TRACKING", function: 'users::resendInvitation', cognitoUser });
    return cognitoUser;
}

module.exports = {
    validateDeleteUser,
    updateUserStatusInEntities,
    deactivateUserFromCompany,
    removeUserFromTeam,
    buildExternalProviderUserPoolId,
    isSsoItemId,
    createCognitoUser,
    resendInvitationToUser,
}
