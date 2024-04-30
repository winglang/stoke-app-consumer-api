'use strict';

const mod = require('../src/job/jobGet');
const { UsersService, JobsService, CandidatesService, constants, teamsService } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const candidatesService = new CandidatesService(process.env.jobsTableName);

const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const companyId = 'JobGetV2-COMPANY-ID-1';
const entityId = 'JobGetV2-ENTITY-ID-1';

const userId1 = 'UserGetV2-USER-ID-1';
const jobItem = {
    companyId: companyId,
    entityId: entityId,
    itemId: 'job_UserGetV2-JOB-ID-1',
    userId: userId1,
    itemData: {}
};

const user1 = {
    companyId: companyId,
    entityId: entityId,
    userId: jobItem.userId,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.admin }
};
const user1CompanyAdmin = {
    companyId: companyId,
    entityId: companyId,
    userId: jobItem.userId,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.admin }
};

const userId2 = 'JobGetV2-USER-ID-2';
const job2 = {
    entityId: userId2,
    itemId: 'job_JobGetV2-JOB-ID-2',
    userId: userId2,
    companyId: companyId,
    itemData: {}
};
teamsService.set(job2, ['MyTeam']);

const user2WithoutTeam = {
    userId: job2.userId,
    entityId: job2.userId,
    companyId: companyId,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.admin }
};

const userId3 = 'JobGetV2-USER-ID-3';
const job3 = {
    entityId: userId3,
    itemId: 'job_JobGetV2-JOB-ID-3',
    userId: userId3,
    companyId: companyId,
    itemData: {}
};
teamsService.set(job3, ['MyTeam']);

const job4 = {
    entityId: userId3,
    itemId: 'job_JobGetV2-JOB-ID-4',
    userId: userId3,
    companyId: companyId,
    itemStatus: constants.job.status.budgetRequest,
    itemData: {}
};

const template1 = {
    entityId: userId3,
    itemId: 'template_JobGetV2-JOB-ID-4',
    userId: userId3,
    companyId: companyId,
    itemStatus: constants.job.status.active,
    itemData: {}
};

const user3WithTeam = {
    userId: job3.userId,
    entityId: job3.userId,
    companyId: companyId,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.admin }
};
teamsService.set(user3WithTeam, ['MyTeam']);

const candidatesItem = {
    itemId: jobItem.itemId,
    entityId: jobItem.entityId,
    modifiedBy: 'JobGetV2-USER-ID-2',
    candidates: ['TALENT_1', 'TALENT_2'],
    bids: [1, 2]
};

const event = (entityId, itemId, userId) => {
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
        queryStringParameters: {
            entityId: entityId
        }
    };
};

describe('getJob', () => {
    beforeAll(async () => {
        await usersService.create(user1);
        await usersService.create(user1CompanyAdmin);
        await usersService.create(user2WithoutTeam);
        await usersService.create(user3WithTeam);

        // create test jobs
        await jobsService.create(jobItem);
        await jobsService.create(job2);
        await jobsService.create(job3);
        await jobsService.create(job4);
        
        // create candidates for test job
        await candidatesService.update(candidatesItem);
        
        // create test template
        await jobsService.create(template1);
    });

    afterAll(async () => {
        await jobsService.delete(jobItem.entityId, jobItem.itemId);
        await jobsService.delete(job2.entityId, job2.itemId);
        await jobsService.delete(job3.entityId, job3.itemId);
        await jobsService.delete(job4.entityId, job4.itemId);
        await jobsService.delete(template1.entityId, template1.itemId);
        await usersService.delete(user1.userId, user1.entityId);
        await usersService.delete(user1CompanyAdmin.userId, user1CompanyAdmin.entityId);
        await usersService.delete(user2WithoutTeam.userId, user2WithoutTeam.userId);
        await usersService.delete(user3WithTeam.userId, user3WithTeam.userId);
    });

    it('getJob, expect not found', async () => {
        const response = await wrapped.run(event(jobItem.entityId, 'NOT_FOUND', jobItem.userId));
        expect(response.statusCode).toBe(403);
    });

    it('getJob, expect 200, data', async () => {
        const response = await wrapped.run(event(jobItem.entityId, jobItem.itemId, jobItem.userId));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        const { job, approvers, isChatAvailable } = data;
        expect(job.itemId).toBe(jobItem.itemId);
        expect(job.itemData.bids).toEqual(candidatesItem.bids);
        expect(approvers).toEqual([userId1]);
    });

    it('getJob, isChatAvailable is false', async () => {
        const response = await wrapped.run(event(job4.entityId, job4.itemId, job4.userId));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.job.isChatAvailable).toBeFalsy();
    });


    it('user2WithoutTeam - should get forbidden', async () => {
        const response = await wrapped.run(event(job2.entityId, job2.itemId, user2WithoutTeam.userId));
        expect(response.statusCode).toBe(403);
    });

    it('user3WithTeam - success', async () => {
        const response = await wrapped.run(event(job3.entityId, job3.itemId, user3WithTeam.userId));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body)
        const { job } = data;
        expect(job.itemId).toBe(job3.itemId);
    });

    it('getJob, template item', async () => {
        const response = await wrapped.run(event(job3.entityId, template1.itemId, template1.userId));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.itemId).toBe(template1.itemId);
    });
});
