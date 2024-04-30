
'use strict';

const _ = require('lodash');
const { webhookQueueName } = process.env;
const { jsonLogger, SqsService, responseLib } = require('stoke-app-common-api');
const webhookQueue = new SqsService(webhookQueueName);

module.exports.handler = async (event, context) => {
    try {
        jsonLogger.info({ type: 'TRACKING', function: 'webhook::handler', functionName: context.functionName, awsRequestId: context.awsRequestId, event });
        const data = _.pick(event, ['queryStringParameters']);
        await webhookQueue.sendMessage({ ...data });
        return responseLib.success();
    } catch (error) {
        jsonLogger.error({ type: 'TRACKING', function: 'webhook::handler', message: "error to handle webhook" });
    }
    return responseLib.failure();
}

