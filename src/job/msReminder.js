'use strict';

const {
    asyncTasksQueueName,
} = process.env;

const { constants, jsonLogger, responseLib, idConverterLib, SqsService } = require('stoke-app-common-api');
const { getJob } = require('../helpers/jobHelper');

const asyncTasksQueue = new SqsService(asyncTasksQueueName);

module.exports.handler = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const milestoneId = event.pathParameters.id;
    const { entityId } = JSON.parse(event.body) || {};
    jsonLogger.info({ type: "TRACKING", function: "msReminder::handler", functionName: context.functionName, awsRequestId: context.awsRequestId, entityId, milestoneId, userId });

    const jobId = idConverterLib.getJobIdFromMilestoneId(milestoneId);
    const job = await getJob(userId, entityId, jobId);
    if (!job) {
        return responseLib.forbidden({ status: false });
    }

    const result = await asyncTasksQueue.sendMessage({
        type: constants.sqsAsyncTasks.types.budgetRequestReminderEmailNotification,
        taskData: {
            job,
        },
    });

    jsonLogger.info({ type: "TRACKING", function: "msReminder::handler", result });
    return responseLib.send(result);
};
