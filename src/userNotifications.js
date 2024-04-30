'use strict';

const _ = require('lodash');
const { Buffer } = require('buffer');
const { UserNotificationsService, constants, jsonLogger, responseLib, UsersService, permisionConstants } = require('stoke-app-common-api');

const { gsiItemsByUserIdAndCreatedAtIndexName, userNotificationsTableName, consumerAuthTableName } = process.env;
const userNotificationsService = new UserNotificationsService(userNotificationsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const itemDataAllowedToEditAttributes = {
  isHidden: 'isHidden',
  lastSnooze: 'lastSnooze',
  isManuallyHidden: 'isManuallyHidden'
}
module.exports.itemDataAllowedToEditAttributes = itemDataAllowedToEditAttributes

/**
 * generateUserNotificationResponse - generate user notifications in the format the client accepts
 * @param {object} userNotification - userNotification
 * @returns {object} userNotification as the client expects to get
 */
const generateUserNotificationResponse = (userNotification) => ({
      user: userNotification.itemData.user,
      message: userNotification.itemData.message,
      action: userNotification.itemData.action,
      status: userNotification.itemStatus,
      source: userNotification.itemData.source,
      notificationId: userNotification.itemId,
});

const removeNotificationsByMaxDataSize = (notifications) => {
  const messageSize = Buffer.byteLength(JSON.stringify(notifications));
  jsonLogger.info({ type: 'TRACKING', function: 'notifications::listUserNotifications', messageSize });
  if (messageSize >= constants.maxWebsocketFrameSizeInBytes) {
    const numberReadNotificatiosToRemove = Math.round((messageSize - constants.maxWebsocketFrameSizeInBytes) / constants.averageSizeOfNotificationInBytes);
    jsonLogger.info({ type: 'TRACKING', function: 'notifications::listUserNotifications', text: "removing some earlier notifications", numberReadNotificatiosToRemove });
    notifications.earlier.splice(notifications.earlier.length - numberReadNotificatiosToRemove, numberReadNotificatiosToRemove);
  }
}

/**
 * listUserNotifications - list user's notification entries
 * @param {object} userId - user id
 * @returns {object} results
 */
module.exports.listUserNotifications = async (userId) => {

  jsonLogger.info({ type: 'TRACKING', function: 'notifications::listUserNotifications', userId: userId });

  if (!userId) {
    jsonLogger.error({ type: 'error', function: 'notifications::listUserNotifications', message: 'missing userId',
      userId: userId });
    return null;
  }

  const unreadNotifications = await userNotificationsService.listByUserId(
    gsiItemsByUserIdAndCreatedAtIndexName,
    userId,
    constants.userNotification.status.unread,
    false,
    constants.maxNewNotifications
  );
  // readNotifications: we want to retrieve all messages with status <> unread. Means: opened & read
  const readNotifications = await userNotificationsService.listByUserId(
    gsiItemsByUserIdAndCreatedAtIndexName,
    userId, constants.userNotification.status.unread,
    true,
    constants.maxReadNotifications
  );

  const [unreadUserCTANotifications, unreadUserNotifications] = _.partition(unreadNotifications, (notification) => notification.itemId.startsWith(constants.prefix.CTA))
  const [readUserCTANotifications, readUserNotifications] = _.partition(readNotifications, (notification) => notification.itemId.startsWith(constants.prefix.CTA))

  const notifications = { new: unreadUserNotifications.map((userNotification) => generateUserNotificationResponse(userNotification)),
    earlier: readUserNotifications.map((userNotification) => generateUserNotificationResponse(userNotification)) };

    const ctaNotificationsObject = { new: unreadUserCTANotifications, earlier: readUserCTANotifications };

  removeNotificationsByMaxDataSize(notifications)
  removeNotificationsByMaxDataSize(ctaNotificationsObject)

  const ctaNotifications = [...ctaNotificationsObject.new, ...ctaNotificationsObject.earlier];

  jsonLogger.info({ type: 'TRACKING', function: 'notifications::listUserNotifications', 
    numNew: notifications.new.length, numEarlier: notifications.earlier.length,
    ctaNumNew: ctaNotificationsObject.new.length, ctaNumEarlier: ctaNotificationsObject.earlier.length });

  return { notifications, ctaNotifications };
};

const updateSingleUserNotification = async (userId, itemId, itemStatus, itemData) => {
  jsonLogger.info({ type: 'TRACKING', function: 'notifications::updateSingleUserNotification', userId, itemId, itemStatus, itemData });
  const notification = { userId, itemId, itemStatus, itemData, modifiedBy: userId }
  const result = await userNotificationsService.update(notification);
  jsonLogger.info({ type: 'TRACKING', function: 'notifications::updateSingleUserNotification', itemId, result });
  return result
}

/**
 * updateUserNotification - update user notification's status or selected fields in itemData
 * @param {object} event lambda event, event.queryStringParameters is the method data
 * @param {object} context - lambda context
 * @returns {object} result
 */
module.exports.updateUserNotification = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const { data, itemStatus, companyId, itemIds } = JSON.parse(event.body);
  jsonLogger.info({ type: 'TRACKING', function: 'notifications::updateUserNotification', functionName: context.functionName, awsRequestId: context.awsRequestId, userId, event });

  if (_.isEmpty(itemIds) || !companyId || (_.isEmpty(data) && !itemStatus)) {
    jsonLogger.error({ type: 'error', function: 'notifications::updateUserNotification', message: 'missing mandatory parameters' })
    return responseLib.failure({ status: false });
  }

  const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.jobs]: { } });
  if (role === constants.user.role.unauthorised) {
      return responseLib.forbidden({ status: false });
  }

  if (_.isEmpty(data) && !itemStatus) {
    jsonLogger.error({ type: 'error', function: 'notifications::updateUserNotification', message: 'parameters not valid to edit' })
    return responseLib.failure({ status: false });
  }

  let results = []
  results = await Promise.all(_.map(itemIds, notificationId => updateSingleUserNotification(userId, notificationId, itemStatus, data)))

  if (results.some(res => res && !_.includes([constants.httpStatusCodes.INTERNAL_SERVER_ERROR], res))) {
    return responseLib.success(results)
  }
  return results.every(res => res === constants.httpStatusCodes.FORBIDDEN)
        ? responseLib.forbidden({ status: false })
        : responseLib.failure({ status: false })

};

module.exports.updateNotificationsStatus = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const { companyId } = JSON.parse(event.body);
  const { status } = event.pathParameters;

  const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.jobs]: { } });
  if (role === constants.user.role.unauthorised) {
      return responseLib.forbidden({ status: false });
  }

  if (!status || !constants.userNotification.status[status]) {
    return responseLib.failure({ message: 'wrong parameter' });
  }
  jsonLogger.info({ 
    type: 'TRACKING', function: 'notifications::updateNotificationsStatus', 
    functionName: context.functionName, 
    awsRequestId: context.awsRequestId, 
    userId: userId, 
    event: event 
  });
  const filterNotificationsFunc = (notification) => !notification.itemId.startsWith(constants.prefix.CTA)

  const result = await userNotificationsService.batchPut(gsiItemsByUserIdAndCreatedAtIndexName, userId, status, null, null, filterNotificationsFunc);
  return result ? responseLib.success({ status: true }) : responseLib.failure({ status: false });
};
