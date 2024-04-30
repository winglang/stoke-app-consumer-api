'use strict';

const mod = require('../src/job/jobUpdateTags');
const { UsersService, JobsService, constants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const companyId = 'JobUpdateTags-COMPANY-ID-1';
const entityId = 'JobUpdateTags-ENTITY-ID-1';
const entityId2 = 'JobUpdateTags-ENTITY-ID-2';

const userId1 = 'JobUpdateTags-USER-ID-1';
const user1 = {
    companyId: companyId,
    entityId: entityId,
    userId: userId1,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.user }
};

const userId2 = 'JobUpdateTags-USER-ID-2';
const user2 = {
    companyId: companyId,
    entityId: entityId,
    userId: userId2,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.user }
};

const userId3 = 'JobUpdateTags-USER-ID-3';
const user3 = {
    companyId: companyId,
    entityId: entityId,
    userId: userId3,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.admin }
};

//so user can see job idd in different workspace
const user4 = {
    companyId: companyId,
    entityId: entityId2,
    userId: userId1,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.user }
};


const job1 = {
    companyId: companyId,
    entityId: entityId,
    itemId: 'job_JobUpdateTags-JOB-ID-1',
    userId: userId1,
    itemData: {}
};

const job2 = {
    companyId: companyId,
    entityId: entityId2,
    itemId: 'job_JobUpdateTags-JOB-ID-2',
    userId: userId1,
    itemData: {}
};

const job3 = {
    companyId: companyId,
    entityId: entityId,
    itemId: 'job_JobUpdateTags-JOB-ID-3',
    userId: userId1,
    itemData: {}
};

const jobsIdentifiers = [
    {
        entityId: job1.entityId,
        itemId: job1.itemId,
    },
    {
        entityId: job2.entityId,
        itemId: job2.itemId,
    },
    {
        entityId: job3.entityId,
        itemId: job3.itemId,
    },
]

const event = (entityId, itemId, userId, tags, jobsIdentifiers, isOverrideTags, isTagsWithId) => {
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
            tags,
            jobsIdentifiers,
            isOverrideTags,
            isTagsWithId
        }),
    };
};

describe('getJob', () => {
    beforeAll(async () => {
        await usersService.create(user1);
        await usersService.create(user2);
        await usersService.create(user3);
        await usersService.create(user4);
        await jobsService.create(job1);
        await jobsService.create(job2);
        await jobsService.create(job3);
    });

    afterAll(async () => {
        await jobsService.delete(job1.entityId, job1.itemId);
        await jobsService.delete(job2.entityId, job2.itemId);
        await jobsService.delete(job3.entityId, job3.itemId);
        await usersService.delete(user1.userId, user1.entityId);
        await usersService.delete(user2.userId, user2.entityId);
        await usersService.delete(user3.userId, user3.entityId);
        await usersService.delete(user4.userId, user4.entityId);
    });

    it('JobUpdateTags - basic flow', async () => {
        const response = await wrapped.run(event(job1.entityId, job1.itemId, job1.userId, {
            "Language": ["English", "Hebrew"],
        }));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.Attributes.tags).toMatchObject({
            "Language": ["English", "Hebrew"],
        });
    });

    it('JobUpdateTags - basic flow - bulk', async () => {
        const response = await wrapped.run(event(job1.entityId, job1.itemId, userId1, {
            "Language": ["English", "Hebrew"],
        }, jobsIdentifiers));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data[0].Attributes.tags).toMatchObject({
            "Language": ["English", "Hebrew"],
        });
        expect(data[1].Attributes.tags).toMatchObject({
            "Language": ["English", "Hebrew"],
        });
        expect(data[2].Attributes.tags).toMatchObject({
            "Language": ["English", "Hebrew"],
        });
    });

    it('JobUpdateTags - basic flow - bulk ( no entityId and no job id )', async () => {
        const response = await wrapped.run(event(null, null, userId1, {
            "Language": ["English", "Hebrew"],
        }, jobsIdentifiers));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data[0].Attributes.tags).toMatchObject({
            "Language": ["English", "Hebrew"],
        });
        expect(data[1].Attributes.tags).toMatchObject({
            "Language": ["English", "Hebrew"],
        });
        expect(data[2].Attributes.tags).toMatchObject({
            "Language": ["English", "Hebrew"],
        });
    });

    it('JobUpdateTags - basic flow - bulk - one of the jobs is forbidden', async () => {
        const response = await wrapped.run(event(job1.entityId, job1.itemId, userId1, {
            "Language": ["English", "Hebrew"],
        }, [...jobsIdentifiers,   {
            entityId: job1.entityId,
            itemId: 'NOT_FOUND',
        }]));
        expect(response.statusCode).toBe(200);
    });

    it('JobUpdateTags - basic flow with override tags - bulk', async () => {
        let response = await wrapped.run(event(job1.entityId, job1.itemId, userId1, {
            "Language": ["English", "Hebrew"],
        }, jobsIdentifiers));
        expect(response.statusCode).toBe(200);
        let data = JSON.parse(response.body);
        expect(data[0].Attributes.tags).toMatchObject({
            "Language": ["English", "Hebrew"],
        });
        expect(data[1].Attributes.tags).toMatchObject({
            "Language": ["English", "Hebrew"],
        });
        expect(data[2].Attributes.tags).toMatchObject({
            "Language": ["English", "Hebrew"],
        });

        response = await wrapped.run(event(job1.entityId, job1.itemId, userId1, {
            "Language": ["Hebrew"],
        }, jobsIdentifiers, true));

        expect(response.statusCode).toBe(200);
        data = JSON.parse(response.body);
        expect(data[0].Attributes.tags).toMatchObject({
            "Language": ["Hebrew"],
        });
        expect(data[1].Attributes.tags).toMatchObject({
            "Language": ["Hebrew"],
        });
        expect(data[2].Attributes.tags).toMatchObject({
            "Language": ["Hebrew"],
        });
    });

    it('JobUpdateTags - basic flow with id tags and no override (duplicates handle) - bulk', async () => {
        let response = await wrapped.run(event(job1.entityId, job1.itemId, userId1, {
            "Language": [{ "id" :"English" }, { "id":"Hebrew" }],
        }, jobsIdentifiers, true));
        expect(response.statusCode).toBe(200);
        let data = JSON.parse(response.body);
        expect(data[0].Attributes.tags).toMatchObject({
            "Language": [{ "id" :"English" }, { "id":"Hebrew" }],
        });
        expect(data[1].Attributes.tags).toMatchObject({
            "Language": [{ "id" :"English" }, { "id":"Hebrew" }],
        });
        expect(data[2].Attributes.tags).toMatchObject({
            "Language": [{ "id" :"English" }, { "id":"Hebrew" }],
        });

        response = await wrapped.run(event(job1.entityId, job1.itemId, userId1, {
            "Language": [{ "id" :"English" }, { "id":"Hebrew" }, { "id":"Arabic" }],
        }, jobsIdentifiers, false, true));

        expect(response.statusCode).toBe(200);
        data = JSON.parse(response.body);
        expect(data[0].Attributes.tags).toMatchObject({
            "Language": [{ "id" :"English" }, { "id":"Hebrew" }, { "id":"Arabic" }],
        });
        expect(data[1].Attributes.tags).toMatchObject({
            "Language": [{ "id" :"English" }, { "id":"Hebrew" }, { "id":"Arabic" }],
        });
        expect(data[2].Attributes.tags).toMatchObject({
            "Language": [{ "id" :"English" }, { "id":"Hebrew" }, { "id":"Arabic" }],
        });
    });

    it('JobUpdateTags - job not found', async () => {
        const response = await wrapped.run(event(job1.entityId, 'NOT_FOUND', job1.userId));
        expect(response.statusCode).toBe(403);
    });

    it('JobUpdateTags - unauthorized user', async () => {
        const response = await wrapped.run(event(job1.entityId, job1.itemId, userId2, {
            "Language": ["English", "Hebrew"],
        }));
        expect(response.statusCode).toBe(403);
    });

    it('JobUpdateTags - admin is authorized', async () => {
        const response = await wrapped.run(event(job1.entityId, job1.itemId, userId3, {
            "Language": ["English", "Hebrew"],
        }));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.Attributes.tags).toMatchObject({
            "Language": ["English", "Hebrew"],
        });
    });

});
