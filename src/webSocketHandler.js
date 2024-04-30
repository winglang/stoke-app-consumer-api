/* eslint-disable max-lines */

'use strict';

const AWS = require('aws-sdk');
const userNotifications = require("./userNotifications");
const { constants, WSConnectionsService, jsonLogger, responseLib, apigatewayLib, iamLib } = require('stoke-app-common-api');
const _ = require('lodash');
const { wsConnectionsTableName, messagesTableName, userNotificationsTableName, stage, consumerUrlDomain } = process.env;
const wsConnectionsService = new WSConnectionsService(wsConnectionsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const auth = require("./auth");
const uuidv1 = require("uuid/v1");

const PROTOCOL_HEADER_VALUE = 'Authorization';

/**
 * getToken - creates and returns token for user
 * @returns {object} response
 */
// eslint-disable-next-line no-unused-vars
module.exports.getToken = async (event, context) => {
  jsonLogger.info({ type: 'TRACKING', function: 'webSocketHandler::getToken' });
  const userId = event.requestContext.identity.cognitoIdentityId;

  const id = uuidv1();
  const tokenInput = `${id}_${userId}`;
  const token = await auth.cipherInput(tokenInput);
  return responseLib.success({ token: token });
};

/**
 * deleteConnection - deletes web socket connection
 * @param {string} connectionId connectionId
 * @returns {object} response success/failure
 */
const deleteConnection = async (connectionId) => {
  jsonLogger.info({
    type: 'TRACKING', function: 'webSocketHandler::deleteConnection', connectionId
  });
  const key = {
    itemId: connectionId
  };
  try {
    const result = await wsConnectionsService.delete(key);
    return responseLib.success(result);
  } catch (e) {
    jsonLogger.error({
      type: 'error', function: 'webSocketHandler::deleteConnection', connectionId, e: e.message
    });
    return responseLib.failure({ status: false });
  }
};

// eslint-disable-next-line max-params
const postMessageToWebSocket = async (apiId, userId, connectionId, message) => {
  jsonLogger.info({
    type: 'TRACKING', function: 'webSocketHandler::postMessageToWebSocket', apiId, userId, connectionId, messageKeys: Object.keys(message)
  });
  try {
    // eslint-disable-next-line no-await-in-loop
    const callbackUrlForWS = `https://${apiId}.execute-api.${process.env.awsRegion}.amazonaws.com/${process.env.stage}`;
    // eslint-disable-next-line no-await-in-loop
    await apigatewayLib.sendMessageToWebsocketClient(callbackUrlForWS, connectionId, message);
  } catch (e) {
    const CONNECTION_UNAVAILABLE = 410;
    // eslint-disable-next-line max-depth
    if (e.statusCode === CONNECTION_UNAVAILABLE) {
      // eslint-disable-next-line no-await-in-loop
      try {
        await deleteConnection(connectionId);
      } catch (ex) {
        jsonLogger.error({
          type: 'error', function: 'webSocketHandler::postMessageToWebSocket', text: 'failed to delete connection',
          apiId, userId, connectionId, message, e: ex.message
        });
      }

    } else {
      jsonLogger.error({
        type: 'error', function: 'webSocketHandler::postMessageToWebSocket', apiId, userId, connectionId, message, e: e.message
      });
    }
  }
};

/**
 * sendMessageToConnection - sends message to web socket connection
 * @param {string} apiId apiId
 * @param {string} connectionId connectionId
 * @param {string} userId userId
 * @returns {none} none
 */
const sendMessageToConnection = async (apiId, connectionId, userId) => {
  jsonLogger.info({
    type: 'TRACKING', function: 'webSocketHandler::sendMessageToConnection', connectionId, userId
  });

  let userNotificationsObj = {};
  try {
    userNotificationsObj = await userNotifications.listUserNotifications(userId);
    const { notifications, ctaNotifications } = userNotificationsObj;
    await postMessageToWebSocket(apiId, userId, connectionId, { notifications });
    await postMessageToWebSocket(apiId, userId, connectionId, { ctaNotifications });
  } catch (e) {
    jsonLogger.error({
      type: 'error', function: 'webSocketHandler::sendMessageToConnection', userId, message: userNotificationsObj, e: e.message
    });
  }
};

/**
 * sendMessageToUser - sends message to all user's web socket connections
 * @param {string} userId userId
 * @param {object} message message
 * @returns {none} none
 */
const sendMessageToUser = async (userId, message) => {
  if (!userId || !message) {
    jsonLogger.error({
      type: 'TRACKING', function: 'webSocketHandler::sendMessageToUser', text: 'missing userId or message params'
    });
    return;
  }

  jsonLogger.info({
    type: 'TRACKING', function: 'webSocketHandler::sendMessageToUser', userId, messageKeys: Object.keys(message)
  });
  const INDEX_NAME = process.env.gsiItemsByUserIdAndCreatedAtIndexName;

  try {
    let connections = null;
    try {
      connections = await wsConnectionsService.listByUserId(INDEX_NAME, userId);
    } catch (e) {
      jsonLogger.error({
        type: 'error', function: 'webSocketHandler::sendMessageToUser', userId, messageKeys: Object.keys(message), e: e.message
      });
      return;
    }
    // eslint-disable-next-line no-magic-numbers
    if (connections && connections.length > 0) {
      for (const connection of connections) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await postMessageToWebSocket(connection.itemData.apiId, userId, connection.itemId, message);
          // eslint-disable-next-line no-await-in-loop
        } catch (e) {
          jsonLogger.error({
            type: 'error', function: 'webSocketHandler::sendMessageToUser', userId, messageKeys: Object.keys(message), e: e.message
          });
        }
      }
    } else {
      jsonLogger.info({
        type: 'TRACKING', function: 'webSocketHandler::sendMessageToUser', userId, text: 'no connections returned'
      });
    }
  } catch (e) {
    jsonLogger.error({
      type: 'error', function: 'webSocketHandler::sendMessageToUser', userId, messageKeys: Object.keys(message), e: e.message
    });
  }
};

/**
 * sendMessageToUsers - sends all messages to all user's web socket connections
 * @param {number} index index
 * @param {string[]} userIds userIds
 * @returns {none} none
 */
const sendMessageToUsers = async (index, userIds) => {
  if (index === userIds.length) {
    return;
  }
  jsonLogger.info({
    type: 'TRACKING', function: 'webSocketHandler::sendMessageToUsers', userIds, index
  });
  const userId = userIds[index];
  const { notifications, ctaNotifications } = await userNotifications.listUserNotifications(userId);
  await sendMessageToUser(userId, { notifications });
  await sendMessageToUser(userId, { ctaNotifications });
  // eslint-disable-next-line no-magic-numbers
  await sendMessageToUsers(index + 1, userIds);
};

/**
 * sendMessageToConnections - sends all messages to all connections
 * @param {number} index index
 * @param {string[]} newConnections newConnections
 * @returns {none} none
 */
const sendMessageToConnections = async (index, newConnections) => {
  if (index === newConnections.length) {
    return;
  }
  jsonLogger.info({
    type: 'TRACKING', function: 'webSocketHandler::sendMessageToConnections', newConnections, index
  });
  const connection = newConnections[index];
  await sendMessageToConnection(connection.itemData.M.apiId.S, connection.itemId.S, connection.userId.S);
  // eslint-disable-next-line no-magic-numbers
  await sendMessageToConnections(index + 1, newConnections);
};

/**
 * defaultMessageHandler - only logs
 * @param {object} event event
 * @param {object} context context
 * @returns {none} none
 */
// eslint-disable-next-line require-await
module.exports.defaultMessageHandler = async (event, context) => {
  jsonLogger.info({
    type: 'TRACKING', function: 'webSocketHandler::defaultMessageHandler', functionName: context.functionName, awsRequestId: context.awsRequestId, event,
    context
  });
  return responseLib.success({ status: true });
};

/**
 * newConnectionHandler - sends all messages to new connection
 * @param {object} event event
 * @param {object} context context
 * @returns {none} none
 */
module.exports.newConnectionHandler = async (event, context) => {
  try {
    jsonLogger.info({
      type: 'TRACKING', function: 'webSocketHandler::newConnectionHandler', functionName: context.functionName, awsRequestId: context.awsRequestId, event,
      context
    });
    const newConnections = event.Records.filter((record) => record.eventName === "INSERT").map((record) => record.dynamodb.NewImage);
    // eslint-disable-next-line no-magic-numbers
    await sendMessageToConnections(0, newConnections);
  } catch (e) {
    jsonLogger.error({
      type: 'error', function: 'webSocketHandler::newConnectionHandler', functionName: context.functionName, awsRequestId: context.awsRequestId, event,
      context, e: e.message
    });
  }
  return responseLib.success({ status: true });
};

/**
 * sendChatMessagesToUsers - sends all websocket messages related to chat messages, to all user's web socket connections
 * @param {object} chatMessagesRecords  chat messages related records
 * @returns {none} none
 */
const sendChatMessagesToUsers = async (chatMessagesRecords) => {
  jsonLogger.info({ type: 'TRACKING', function: 'webSocketHandler::sendChatMessagesToUsers', chatMessagesRecords });
  const usrsToMsgs = chatMessagesRecords.
    map((record) => AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage)).
    filter((msg) => msg.userId).
    reduce((usrsToMsgsAcc, msg) => {
      if (!usrsToMsgsAcc[msg.userId]) {
        usrsToMsgsAcc[msg.userId] = [];
      }
      usrsToMsgsAcc[msg.userId].push(msg);
      return usrsToMsgsAcc;
    }, {});
  jsonLogger.info({ type: 'TRACKING', function: 'webSocketHandler::sendChatMessagesToUsers', usrsToMsgs });
  // eslint-disable-next-line no-magic-numbers
  await Promise.all(Object.entries(usrsToMsgs).map((usrToMsgs) => sendMessageToUser(usrToMsgs[0], { chatMessages: usrToMsgs[1] })));
}

/**
 * sendNotificationsToUsers - sends all notifications related messages to all user's web socket connections
 * @param {object} notificationsRecords  notifications related records
 * @returns {none} none
 */
const sendNotificationsToUsers = async (notificationsRecords) => {
  jsonLogger.info({ type: 'TRACKING', function: 'webSocketHandler::sendNotificationsToUsers', notificationsRecords });
  const uniqueUserIds = [...new Set(notificationsRecords.map((record) => record.dynamodb.NewImage.userId.S))];
  // eslint-disable-next-line no-magic-numbers
  await sendMessageToUsers(0, uniqueUserIds);
}

/**
 * messagesHandler - sends all messages to all user's web socket connections
 * @param {object} event event
 * @param {object} context context
 * @returns {none} none
 */
module.exports.messagesHandler = async (event, context) => {
  try {
    jsonLogger.info({
      type: 'TRACKING', function: 'webSocketHandler::messagesHandler', functionName: context.functionName, awsRequestId: context.awsRequestId, event,
      context
    });
    // eslint-disable-next-line no-magic-numbers
    const eventSourceARN = event && event.Records && event.Records[0] && event.Records[0].eventSourceARN;
    if (eventSourceARN.includes(messagesTableName)) {
      await sendChatMessagesToUsers(event.Records);
    } else if (eventSourceARN.includes(userNotificationsTableName)) {
      await sendNotificationsToUsers(event.Records);
    }
  } catch (e) {
    jsonLogger.error({
      type: 'error', function: 'webSocketHandler::messagesHandler', functionName: context.functionName, awsRequestId: context.awsRequestId, event,
      context, e: e.message
    });
  }
  return responseLib.success({ status: true });
};

/**
 * connectHandler - creates web socket connection
 * @param {object} event event
 * @param {object} context context
 * @returns {object} response success/failure
 */
module.exports.connectHandler = async (event, context) => {
  jsonLogger.info({ type: 'TRACKING', function: 'webSocketHandler::connectHandler', functionName: context.functionName, awsRequestId: context.awsRequestId, event, context });
  try {
    context.callbackWaitsForEmptyEventLoop = false;
    const { headers, queryStringParameters, requestContext } = event;
    const { "Sec-WebSocket-Protocol": secWebSocketProtocol } = headers || {};
    const { token: qsToken, userId } = queryStringParameters || {};
    const { connectionId, apiId } = requestContext || {};

    let headerToken = null;
    if (!_.isEmpty(secWebSocketProtocol)) {
      const [protocol, value] = secWebSocketProtocol.split(", ");
      if (protocol === PROTOCOL_HEADER_VALUE) {
        headerToken = value;
      }
    }

    const token = headerToken || qsToken;
    const decryptedToken = await auth.decrypt(token);
    const decryptedArr = decryptedToken.split("_");
    let result = null;
    // eslint-disable-next-line no-magic-numbers
    if (decryptedArr[1] === userId) {
      const item = {
        itemId: connectionId,
        userId: userId,
        itemData: { apiId: apiId },
        itemStatus: constants.itemStatus.active
      };
      result = await wsConnectionsService.create(item);
    }
    if (result) {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
          // eslint-disable-next-line no-extra-parens
          ...(headerToken ? { "Sec-WebSocket-Protocol": PROTOCOL_HEADER_VALUE } : {}),
        },
        body: JSON.stringify({ status: true })
      };
    }
  } catch (e) {
    jsonLogger.error({ type: 'error', function: 'webSocketHandler::connectHandler', functionName: context.functionName, awsRequestId: context.awsRequestId, event, context, e: e.message });
  }
  return responseLib.failure({ status: false });
};

/**
 * connectHandlerAuth - auth before creates web socket connection
 * @param {object} event event
 * @param {object} context context
 * @param {function} callback context
 * @returns {object} response success/failure
 */
module.exports.connectHandlerAuth = (event, context, callback) => {
  jsonLogger.info({
    type: 'TRACKING', function: 'webSocketHandler::connectHandlerAuth', functionName: context.functionName, awsRequestId: context.awsRequestId, event, context
  });
  const origin = _.get(event, 'headers.Origin');
  const originAllow = [consumerUrlDomain];

  switch (stage) {
    case 'dev':
      originAllow.push('https://qa.stoketalent.com')
      originAllow.push('http://localhost:8080')
      originAllow.push('https://dev.stoketalent.com')
      originAllow.push('https://dev.fiverr-enterprise.com')
      break;
    case 'demo':
      originAllow.push('https://demo.stoketalent.com')
      originAllow.push('https://demo.fiverr-enterprise.com')
      break;
    default:
      originAllow.push('https://app.stoketalent.com')
      originAllow.push('https://app.fiverr-enterprise.com')
  }

  const status = originAllow.includes(origin) ? 'Allow' : 'Deny';
  jsonLogger.info({ function: "webSocketHandler::connectHandlerAuth", status, consumerUrlDomain, originAllow });
  callback(null, iamLib.generatePolicy('paymentSystem', status, event.methodArn));
};

/**
 * disconnectHandler - disconnects web socket connection
 * @param {object} event event
 * @param {object} context context
 * @returns {object} response success/failure
 */
module.exports.disconnectHandler = async (event, context) => {
  jsonLogger.info({
    type: 'TRACKING', function: 'webSocketHandler::disconnectHandler', functionName: context.functionName, awsRequestId: context.awsRequestId, event,
    context
  });
  const { connectionId } = event.requestContext;

  await deleteConnection(connectionId);
  return responseLib.success({ status: true });
};

