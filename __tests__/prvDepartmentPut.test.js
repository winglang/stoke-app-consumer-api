/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */
/* eslint-disable max-lines-per-function */

'use strict';

const mod = require('../src/updateProviderDepartments');
const jestPlugin = require('serverless-jest-plugin');
const { constants, UsersService, CompanyProvidersService, JobsService, permisionConstants } = require('stoke-app-common-api');
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const testName = 'UPDATE-PROVIDER-DEPARTMENTS-JEST-TEST';
const companyId = `${testName}-COMPANY-ID-1`;
const entityId1 = `${testName}-ENTITY-ID-1`;
const entityId2 = `${testName}-ENTITY-ID-2`;
const entityId3 = `${testName}-ENTITY-ID-3`;
const userId1 = `${testName}-USER-ID-1`;
const adminId1 = `${testName}-ADMIN-ID-1`;
const providerId1 = `${constants.prefix.provider}${testName}-PRV-ID-1`;
const providerId2 = `${constants.prefix.provider}${testName}-PRV-ID-2`;
const providerId3 = `${constants.prefix.provider}${testName}-PRV-ID-3`;
const providerId1talent = `${constants.prefix.talent}${providerId1}talent_ID-1`;
const providerId2talent1 = `${constants.prefix.talent}${providerId2}talent_ID-1`;
const providerId2talent2 = `${constants.prefix.talent}${providerId2}talent_ID-2`;
const providerId3talent = `${constants.prefix.talent}${providerId3}talent_ID-1`;
const jobId1 = `${constants.prefix.job}${testName}-JOB-ID-1`;
const jobId2 = `${constants.prefix.job}${testName}-JOB-ID-2`;

const userInEntity1 = {
    userId: userId1,
    entityId: entityId1,
    companyId,
    createdBy: testName,
    modifiedBy: testName,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user
    }
}

const adminInEntity1 = {
    userId: adminId1,
    entityId: entityId1,
    companyId,
    createdBy: testName,
    modifiedBy: testName,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        permissionsComponents: {
            [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true },
        }
    }
}

const adminInEntity2 = {
    userId: adminId1,
    entityId: entityId2,
    companyId,
    createdBy: testName,
    modifiedBy: testName,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        permissionsComponents: {
            [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true },
        }
    }
}

const adminInEntity3 = {
    userId: adminId1,
    entityId: entityId3,
    companyId,
    createdBy: testName,
    modifiedBy: testName,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        permissionsComponents: {
            [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true },
        }
    }
}

const selfEmployedProvider = {
    itemId: providerId1,
    companyId,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.companyProvider.status.active,
    itemData: {
        isProviderSelfEmployedTalent: true,
        departments: [entityId1],
    }
}

const selfEmployedTalent = {
    itemId: providerId1talent,
    companyId,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.companyProvider.status.active,
    itemData: {
        isProviderSelfEmployedTalent: true,
        departments: [entityId1],
    }
}

const selfEmployedProvider3 = {
    itemId: providerId3,
    companyId,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.companyProvider.status.active,
    itemData: {
        isProviderSelfEmployedTalent: true,
        departments: [entityId3],
    }
}

const selfEmployedTalent3 = {
    itemId: providerId3talent,
    companyId,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.companyProvider.status.active,
    itemData: {
        isProviderSelfEmployedTalent: true,
        departments: [entityId3],
    }
}

const companyProvider = {
    itemId: providerId2,
    companyId,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.companyProvider.status.active,
    itemData: {}
}

const talentInProvider1 = {
    itemId: providerId2talent1,
    companyId,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.companyProvider.status.active,
    itemData: {
        departments: [entityId1],
    }
}

const talentInProvider2 = {
    itemId: providerId2talent2,
    companyId,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.companyProvider.status.active,
    itemData: {}
}

const job1 = {
    companyId,
    itemId: jobId1,
    entityId: entityId1,
    itemData: {
        talentId: providerId2talent1,
    },
    itemStatus: constants.job.status.active,
    userId: userId1,
    talentId: providerId2talent1,
}

const job2 = {
    companyId,
    itemId: jobId2,
    entityId: entityId1,
    itemData: {
        talentId: providerId2talent1,
    },
    itemStatus: constants.job.status.completed,
    userId: userId1,
    talentId: providerId2talent1,
}

const createEvent = (userId, entities, id, isOverride) => ({
    body: JSON.stringify({ companyId, entities, itemsIds: id, isOverride }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
})

describe('updateProvoderDepartments tests', () => {
    beforeEach(async () => {
        let result = await usersService.create(userInEntity1);
        expect(result).toMatchObject(userInEntity1);
        result = await usersService.create(adminInEntity1);
        expect(result).toMatchObject(adminInEntity1);
        result = await usersService.create(adminInEntity2);
        expect(result).toMatchObject(adminInEntity2);
        result = await usersService.create(adminInEntity3);
        expect(result).toMatchObject(adminInEntity3);
        result = await companyProvidersService.create(selfEmployedProvider);
        expect(result).toMatchObject(selfEmployedProvider);
        result = await companyProvidersService.create(selfEmployedTalent);
        expect(result).toMatchObject(selfEmployedTalent);
        result = await companyProvidersService.create(selfEmployedProvider3);
        expect(result).toMatchObject(selfEmployedProvider3);
        result = await companyProvidersService.create(selfEmployedTalent3);
        expect(result).toMatchObject(selfEmployedTalent3);
        result = await companyProvidersService.create(companyProvider);
        expect(result).toMatchObject(companyProvider);
        result = await companyProvidersService.create(talentInProvider1);
        expect(result).toMatchObject(talentInProvider1);
        result = await companyProvidersService.create(talentInProvider2);
        expect(result).toMatchObject(talentInProvider2);
        result = await jobsService.create(job1);
        expect(result).toMatchObject(job1);
        result = await jobsService.create(job2);
        expect(result).toMatchObject(job2);
    });

    it('Add department to selfEmployeed provider, expect 200 ', async () => {
        const response = await wrapped.run(createEvent(adminId1, [entityId2], providerId1));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body)
        expect(responseBody.statusCode).toBe(200);
        let result = await companyProvidersService.get(companyId, providerId1)
        expect(result.itemData.departments).toMatchObject([entityId2])
        result = await companyProvidersService.get(companyId, providerId1talent)
        expect(result.itemData.departments).toMatchObject([entityId2])
    });

    it('Add department to selfEmployeed talent, expect 200 ', async () => {
        const response = await wrapped.run(createEvent(adminId1, [entityId1], providerId1talent));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body)
        expect(responseBody.statusCode).toBe(200);
        let result = await companyProvidersService.get(companyId, providerId1)
        expect(result.itemData.departments).toMatchObject([entityId1])
        result = await companyProvidersService.get(companyId, providerId1talent)
        expect(result.itemData.departments).toMatchObject([entityId1])
    });

    it('Remove departments from provider, expect 200 ', async () => {
        const response = await wrapped.run(createEvent(adminId1, [], providerId1));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body)
        expect(responseBody.statusCode).toBe(200);
        let result = await companyProvidersService.get(companyId, providerId1)
        expect(result.itemData.departments).toMatchObject([])
        result = await companyProvidersService.get(companyId, providerId1talent)
        expect(result.itemData.departments).toMatchObject([])
    });

    it('remove all departments from provider with default configuration', async () => {
        const response = await wrapped.run(createEvent(adminId1, [entityId1], providerId2));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body)
        expect(responseBody.statusCode).toBe(200);
        let result = await companyProvidersService.get(companyId, providerId2)
        expect(result.itemData.departments).toMatchObject([entityId1])
        result = await companyProvidersService.get(companyId, providerId2talent2)
        expect(result.itemData.departments).toMatchObject([entityId1])
    });

    it('Add departments to companyProvider, expect 200 ', async () => {
        const response = await wrapped.run(createEvent(adminId1, [entityId1, entityId2], providerId2));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body)
        expect(responseBody.statusCode).toBe(200);
        let result = await companyProvidersService.get(companyId, providerId2)
        expect(result.itemData.departments).toMatchObject([entityId1, entityId2])
        result = await companyProvidersService.get(companyId, providerId2talent1)
        expect(result.itemData.departments).toMatchObject(talentInProvider1.itemData.departments)
    });

    it('Add departments to talent in company, expect 200 ', async () => {
        let response = await wrapped.run(createEvent(adminId1, [entityId1, entityId2], providerId2talent1));
        expect(response.statusCode).toBe(200);
        let responseBody = JSON.parse(response.body)
        expect(responseBody.statusCode).toBe(200);
        let result = await companyProvidersService.get(companyId, providerId2talent1)
        expect(result.itemData.departments).toMatchObject([entityId1, entityId2])
        response = await wrapped.run(createEvent(adminId1, [entityId3, entityId1], providerId2talent2));
        expect(response.statusCode).toBe(200);
        responseBody = JSON.parse(response.body)
        expect(responseBody.statusCode).toBe(200);
        result = await companyProvidersService.get(companyId, providerId2talent2);
        expect(result.itemData.departments).toMatchObject([entityId3, entityId1]);
        result = await companyProvidersService.get(companyId, providerId2);
        expect(result.itemData.departments).toMatchObject([companyId]);
    });

    it('Remove active department from talent in company, expect 500 ', async () => {
        const response = await wrapped.run(createEvent(adminId1, [entityId2], providerId2talent1));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body)
        expect(responseBody.statusCode).toBe(500);
        expect(JSON.parse(responseBody.body)).toMatchObject({ status: false });

    });

    it('Add departments to companyProvider bulk no override, expect 200 ', async () => {
        const response = await wrapped.run(createEvent(adminId1, [entityId1, entityId2], [providerId1, providerId2], false));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body)
        expect(responseBody[0].statusCode).toBe(200);
        expect(responseBody[1].statusCode).toBe(200);
        let result = await companyProvidersService.get(companyId, providerId1)
        expect(result.itemData.departments).toMatchObject([entityId1, entityId2])
        result = await companyProvidersService.get(companyId, providerId1talent)
        expect(result.itemData.departments).toMatchObject([entityId1, entityId2])
        result = await companyProvidersService.get(companyId, providerId2)
        expect(result.itemData.departments).toMatchObject([companyId])
        result = await companyProvidersService.get(companyId, providerId2talent1)
        expect(result.itemData.departments).toMatchObject(talentInProvider1.itemData.departments)
    });

    it('Add departments to companyProvider bulk with override, expect 200 ', async () => {
        const response = await wrapped.run(createEvent(adminId1, [entityId1, entityId2], [providerId3, providerId2], true));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body)
        expect(responseBody[0].statusCode).toBe(200);
        let result = await companyProvidersService.get(companyId, providerId3)
        expect(result.itemData.departments).toMatchObject([entityId1, entityId2])
        result = await companyProvidersService.get(companyId, providerId1talent)
        expect(result.itemData.departments).toMatchObject([entityId1])
        result = await companyProvidersService.get(companyId, providerId2)
        expect(result.itemData.departments).toMatchObject([entityId1, entityId2])
    });

    afterEach(async () => {
        await usersService.delete(userInEntity1.userId, userInEntity1.entityId);
        await usersService.delete(adminInEntity1.userId, adminInEntity1.entityId);
        await usersService.delete(adminInEntity2.userId, adminInEntity2.entityId);
        await usersService.delete(adminInEntity3.userId, adminInEntity3.entityId);
        await companyProvidersService.delete(companyId, selfEmployedProvider.itemId);
        await companyProvidersService.delete(companyId, selfEmployedTalent.itemId);
        await companyProvidersService.delete(companyId, selfEmployedProvider3.itemId);
        await companyProvidersService.delete(companyId, selfEmployedTalent3.itemId);
        await companyProvidersService.delete(companyId, companyProvider.itemId);
        await companyProvidersService.delete(companyId, talentInProvider1.itemId);
        await companyProvidersService.delete(companyId, talentInProvider2.itemId);
        await jobsService.delete(job1.entityId, job1.itemId);
        await jobsService.delete(job2.entityId, job2.itemId);
    });

});

