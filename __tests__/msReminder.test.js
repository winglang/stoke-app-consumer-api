'use strict';

const mod = require('../src/job/msReminder');
const { UsersService, JobsService, constants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const companyId = 'MS-REMINDER-JEST-TEST-COMPANY-ID-1';
const entityId = 'MS-REMINDER-JEST-TEST-ENTITY-ID-1';
const userId = 'MS-REMINDER-JEST-TEST-USER-ID-1';
const jobId = 'job_JEST-TEST-JOB-ID-1';
const milestoneId = `ms_${jobId}_1111`;
const jobItem = {
    companyId,
    entityId,
    itemId: jobId,
    userId,
    itemData: {
        jobTitle: 'MS Budget Request Reminder',
    },
};

const user1 = {
    companyId,
    entityId,
    userId,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.admin }
};

const event = (entityId, itemId, userId) => {
    return {
        body: JSON.stringify({ entityId }),
        requestContext: {
            identity: {
                cognitoIdentityId: userId
            }
        },
        pathParameters: {
            id: itemId
        },
    };
};

describe('getJob', () => {
    beforeAll(async () => {
        await usersService.create(user1);
        await jobsService.create(jobItem);

    });

    afterAll(async () => {
        await jobsService.delete(jobItem.entityId, jobItem.itemId);
        await usersService.delete(user1.userId, user1.entityId);
    });

    it('msReminder, expect not found', async () => {
        const response = await wrapped.run(event(entityId, 'ms_job_NOTFOUND_1111', userId));
        expect(response.statusCode).toBe(403);
    });

    it('msReminder - success', async () => {
        const response = await wrapped.run(event(entityId, milestoneId, userId));
        expect(response.statusCode).toBe(200);
    });

});
