'use strict';

const mod = require('../src/job/jobUpdateAttrs');
const { UsersService, JobsService, constants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const companyId = 'jobUpdateAttrs-COMPANY-ID-1';
const entityId = 'jobUpdateAttrs-ENTITY-ID-1';

const userId1 = 'jobUpdateAttrs-USER-ID-1';
const user1 = {
    companyId: companyId,
    entityId: entityId,
    userId: userId1,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.user }
};

const userId2 = 'jobUpdateAttrs-USER-ID-2';
const user2 = {
    companyId: companyId,
    entityId: entityId,
    userId: userId2,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.user }
};

const userId3 = 'jobUpdateAttrs-USER-ID-3';
const user3 = {
    companyId: companyId,
    entityId: entityId,
    userId: userId3,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.admin }
};

const job1 = {
    companyId: companyId,
    entityId: entityId,
    itemId: 'job_jobUpdateAttrs-JOB-ID-1',
    userId: userId1,
    itemData: {}
};

const event = (entityId, itemId, userId, itemData) => {
    return {
        body: "{}",
        requestContext: {
            identity: {
                cognitoIdentityId: userId
            }
        },
        pathParameters: {
            id: itemId
        },
        body: JSON.stringify({
            entityId,
            itemData,
        }),
    };
};

describe('getJob', () => {
    beforeAll(async () => {
        await usersService.create(user1);
        await usersService.create(user2);
        await usersService.create(user3);
        await jobsService.create(job1);
    });

    afterAll(async () => {
        await jobsService.delete(job1.entityId, job1.itemId);
        await usersService.delete(user1.userId, user1.entityId);
        await usersService.delete(user2.userId, user2.entityId);
        await usersService.delete(user3.userId, user3.entityId);
    });

    it('jobUpdateAttrs - basic flow', async () => {
        const response = await wrapped.run(event(job1.entityId, job1.itemId, job1.userId, {
            title: 'title'
        }));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.Attributes.itemData).toMatchObject({
            title: 'title'
        });
    });

    it('jobUpdateAttrs - unauthorized user', async () => {
        const response = await wrapped.run(event(job1.entityId, job1.itemId, userId2, {
            title: 'title'
        }));
        expect(response.statusCode).toBe(403);
    });

    it('jobUpdateAttrs - admin is authorized', async () => {
        const response = await wrapped.run(event(job1.entityId, job1.itemId, userId3, {
            title: 'title'
        }));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.Attributes.itemData).toMatchObject({
            title: 'title'
        });
    });

});
