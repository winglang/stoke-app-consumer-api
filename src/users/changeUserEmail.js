/* eslint-disable no-magic-numbers */
/* eslint-disable multiline-comment-style */
/* eslint-disable no-console */

'use strict';

const _ = require('lodash');
const { jsonLogger, constants, permisionConstants, cognitoLib, responseLib, ssmLib, personalInfoLib, CompaniesService, UsersService, logger } = require('stoke-app-common-api');
const { ChatService } = require('stoke-chat-api');
const { EmailService } = require("stoke-email");

const userHelper = require('../helpers/userHelper');

const { TALKJS_APP_ID, TALKJS_API_KEY, jobsBucketName, customersTableName, consumerAuthTableName, USER_POOL_ID, gsiItemByUserIdIndexName } = process.env;

const chatService = new ChatService(TALKJS_APP_ID, TALKJS_API_KEY);

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

let emailService = null;
const updateEmailServiceUserContact = async (oldEmail, newEmail) => {
    if (!emailService) {
        const [key] = await ssmLib.getParametersFromSSM('sendinblue/key');
        // eslint-disable-next-line require-atomic-updates
        emailService = new EmailService(key, jobsBucketName);
    }
    await emailService.updateUserContact(oldEmail, newEmail);
}

const updateConsumerEmail = (key, newEmail) => companiesService.updateGeneric(key, 'SET itemData.userEmail = :newEmail', { ':newEmail': newEmail });

const updateEmail = async (companyId, userItemId, newEmail, updateCognitoEmail) => {
    jsonLogger.info({ type: 'TRACKING', function: 'changeUserEmail::updateEmail', companyId, userItemId, newEmail, updateCognitoEmail });

    const consumer = await companiesService.get(userItemId);
    if (!consumer) {
        jsonLogger.error({ type: 'TRACKING', function: 'changeUserEmail::updateEmail', error: 'Consumer not found', companyId, userItemId });
        return { status: false, message: "User not found" };
    }
    jsonLogger.info({ type: 'TRACKING', function: 'changeUserEmail::updateEmail', consumer });

    const { email: oldEmailInput } = personalInfoLib.getConsumerPersonalInfo(consumer);
    const oldEmail = _.toLower(oldEmailInput).trim();
    if (!oldEmail) {
        jsonLogger.error({ type: 'TRACKING', function: 'changeUserEmail::updateEmail', error: 'Consumer email not found', companyId, userItemId, consumer });
        return { status: false, message: "User email is missing" };
    }

    if (updateCognitoEmail) {
        const cognitoUser = await cognitoLib.adminUpdateUserEmail(USER_POOL_ID, oldEmail, newEmail, true);
        if (!cognitoUser) {
            jsonLogger.error({ type: 'TRACKING', function: 'changeUserEmail::updateEmail', error: 'Cognito change email error', companyId, userItemId, consumer });
            return { status: false, message: "User email change error" };
        }
    }

    const updateConsumerResult = await updateConsumerEmail({ itemId: consumer.itemId }, newEmail);
    jsonLogger.info({ type: 'TRACKING', function: 'changeUserEmail::updateEmail', updateConsumerResult });

    await chatService.updateUser(consumer.userId, null, newEmail);
    await updateEmailServiceUserContact(oldEmail, newEmail);

    const isInvited = consumer.itemStatus === constants.user.status.invited;
    if (isInvited) {
        await userHelper.resendInvitationToUser(companyId, newEmail);
    }

    jsonLogger.info({ type: 'TRACKING', function: 'changeUserEmail::updateEmail', message: 'User email updated', status: true });
    return { status: true };
}

const validateAndGetCurrentUser = async (companyId, userId) => {
    const authorised = await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true } });
    if (!authorised) {
        return null;
    }

    const currentUsers = await companiesService.listByUserId(gsiItemByUserIdIndexName, userId, constants.prefix.userPoolId);
    if (_.isEmpty(currentUsers)) {
        logger.error({ type: 'TRACKING', function: 'changeUserEmail::validateAndGetCurrentUser', error: 'Current user not found', userId });
        return null;
    }
    if (_.size(currentUsers) > 1) {
        logger.error({ type: 'TRACKING', function: 'changeUserEmail::validateAndGetCurrentUser', error: 'More than one current user found', userId, currentUsers });
        return null;
    }
    const currentUser = _.head(currentUsers);
    if (!currentUser || !currentUser.itemId) {
        logger.error({ type: 'TRACKING', function: 'changeUserEmail::validateAndGetCurrentUser', error: 'Current user not found', userId, currentUser });
        return null;
    }
    return currentUser;
}

module.exports.updateUserEmailHandler = async (event, context) => {
    jsonLogger.info({ type: 'TRACKING', function: 'changeUserEmail::updateUserEmailHandler', event, context });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const userItemIdToUpdate = event.pathParameters.id;
    const data = JSON.parse(event.body);
    const { companyId, newEmail: newEmailInput } = data;
    const newEmail = _.toLower(newEmailInput).trim();
    jsonLogger.info({ type: 'TRACKING', function: 'changeUserEmail::updateUserEmailHandler', userItemIdToUpdate, companyId, newEmail });
  
    if (!userItemIdToUpdate || !companyId || !newEmail) {
      return responseLib.failure({ status: false, message: 'Missing params' });
    }
  
    const currentUser = await validateAndGetCurrentUser(companyId, userId)
    if (!currentUser) {
      return responseLib.forbidden({ status: false });
    }

    const isSameUser = currentUser.itemId === userItemIdToUpdate;
    jsonLogger.info({ type: 'TRACKING', function: 'changeUserEmail::updateUserEmailHandler', isSameUser, currentUser });
    if (isSameUser) {
        const isVerified = await cognitoLib.isUserEmailVerified(USER_POOL_ID, event, newEmail);
        if (!isVerified) {
            jsonLogger.error({ type: 'TRACKING', function: 'changeUserEmail::updateUserEmailHandler', error: 'email is not verified', userItemIdToUpdate, companyId, newEmail });
            return responseLib.failure({ status: false, message: "email is not verified" });
        }
    }

    const response = await updateEmail(companyId, userItemIdToUpdate, newEmail, !isSameUser);
    return response && response.status ? responseLib.success(response) : responseLib.failure(response);
}

module.exports.updateUserVerifyEmailHandler = async (event, context) => {
    jsonLogger.info({ type: 'TRACKING', function: 'changeUserEmail::updateUserVerifyEmailHandler', event, context });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body);
    jsonLogger.info({ type: 'TRACKING', function: 'changeUserEmail::updateUserVerifyEmailHandler', userId, data });

    const { companyId, newEmail: newEmailInput } = data;
    const newEmail = _.toLower(newEmailInput).trim();
    if (!companyId || !newEmail) {
        jsonLogger.error({ type: 'TRACKING', function: 'changeUserEmail::updateUserVerifyEmailHandler', error: 'missing params', companyId, newEmail });
        return responseLib.failure({ status: false });
    }

    const currentUser = await validateAndGetCurrentUser(companyId, userId)
    if (!currentUser) {
      return responseLib.forbidden({ status: false });
    }

    const existingEmail = await cognitoLib.getUser(USER_POOL_ID, newEmail);
    if (existingEmail) {
        jsonLogger.error({ type: 'TRACKING', function: 'changeUserEmail::updateUserVerifyEmailHandler', error: 'email already exists', companyId, newEmail });
        return responseLib.failure({ status: false, message: "email already exists" });
    }

    const { email: oldEmailInput } = personalInfoLib.getConsumerPersonalInfo(currentUser);
    const oldEmail = _.toLower(oldEmailInput).trim();
    if (!oldEmail) {
        jsonLogger.error({ type: 'TRACKING', function: 'changeUserEmail::updateEmail', error: 'Consumer email not found', companyId, userId, currentUser });
        return { status: false, message: "User email is missing" };
    }

    const status = await cognitoLib.adminUpdateUserEmail(USER_POOL_ID, oldEmail, newEmail, false);
    jsonLogger.info({ type: 'TRACKING', function: 'changeUserEmail::updateUserVerifyEmailHandler', status });

    return status ? responseLib.success({ status: true }) : responseLib.failure({ status: false });
}
