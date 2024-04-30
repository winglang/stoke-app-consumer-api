/* eslint-disable max-lines-per-function */
/* eslint-disable no-undef */

'use strict';

const mod = require('../src/companies');
const jestPlugin = require('serverless-jest-plugin');
const { UsersService, CompaniesService, constants, permisionConstants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const wrapperUpdateUser = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'updateUserInCompany' });

const userId = "JEST-TEST-UPDATE-USER-TO-COMPANY"
const userIdAdmin = "JEST-TEST-UPDATE-USER-TO-COMPANY-ADMIN"

const entityId = "JEST-TEST-UPDATE-USER-TO-COMPANY-ENTITY"
const userName = "userpoolid_joe@stokeco.com"
const userEmail = "joe@stokeco.com"
const userEmailAdmin = "joeAdmin@stokeco.com"
const newUserEmail = "newJoe@stokeco.com"
const givenName = "joe"
const newGivenName = "newJoe"
const familyName = "newShmoe"
const newFamilyName = "Shmoe"
const entityName = "stoke"
const companyId = "JEST-TEST-UPDATE-USER-TO-COMPANY-COMPANY-ID"

const userItemAdmin = {
    userId: userIdAdmin,
    entityId: companyId,
    companyId: companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin, isEditor: true,
        permissionsComponents: {
            [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true },
        }
    }
};

const userItemEntityAdmin = {
    userId: userIdAdmin,
    entityId: entityId,
    companyId: companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin, isEditor: true
    }
};

const userItem = {
    companyId,
    itemId: userName,
    userId: userId,
    itemData: {
        userEmail: userEmail,
        givenName: givenName,
        familyName: familyName,
    },
    createdBy: userId,
    modifiedBy: userId,
    entityName: entityName,
    itemStatus: constants.user.status.invited
};

const entityItem = {
    companyId,
    itemId: `entity_${entityId}`,
    userId,
    itemData: {
        entityName: 'OLD-ENTITY-NAME',
        costCenter: 'OLD-COST-CENTER',
    },
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active
};

const updateUserEvent = {
    pathParameters: {
        id: userName
    },
    body: JSON.stringify({
        userEmail: newUserEmail,
        givenName: newGivenName,
        familyName: newFamilyName,
        companyId: companyId
    }),
    requestContext: {
        identity: {
            cognitoIdentityId: userIdAdmin
        }
    }
}

const updateAdminUserEvent = {
    pathParameters: {
        id: userEmailAdmin
    },
    body: JSON.stringify({
        userEmail: newUserEmail,
        givenName: newGivenName,
        familyName: newFamilyName,
        itemData: {
            userRole: 'fake',
            isEditor: true
        },
        entityId: entityId,
        companyId: companyId
    }),
    requestContext: {
        identity: {
            cognitoAuthenticationProvider: 'a:a',
            cognitoIdentityId: userId
        }
    }
}

describe('updateUser', () => {
    beforeAll(async () => {
        let response = await usersService.create(userItemAdmin);
        expect(response.userId).toBe(userIdAdmin);
        response = await companiesService.create(userItem);
        expect(response.userId).toBe(userId);
        response = await companiesService.create(entityItem);
        expect(response.itemData.entityName).toBe(entityItem.itemData.entityName);
        response = await usersService.create(userItemEntityAdmin);
        expect(response.userId).toBe(userIdAdmin);
    });

    it('update user, expect 200, and test data', async () => {
        let response = await wrapperUpdateUser.run(updateUserEvent)
        // eslint-disable-next-line no-magic-numbers
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.Attributes).toMatchObject({
            modifiedBy: userIdAdmin,
            itemData: {
                userEmail: newUserEmail,
                givenName: newGivenName,
                familyName: newFamilyName
            }
        });
        await usersService.update({
            userId: userItemAdmin.userId, entityId: userItemAdmin.entityId, modifiedBy: userItemAdmin.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: false
            }
        })
        response = await wrapperUpdateUser.run(updateUserEvent)
        // eslint-disable-next-line no-magic-numbers
        expect(response.statusCode).toBe(403);
        await usersService.update({
            userId: userItemAdmin.userId, entityId: userItemAdmin.entityId, modifiedBy: userItemAdmin.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        })
    });

    it('update user, expect 403', async () => {
        const response = await wrapperUpdateUser.run(updateAdminUserEvent)
        // eslint-disable-next-line no-magic-numbers
        expect(response.statusCode).toBe(403);
    });

    afterAll(async () => {
        await usersService.delete(userIdAdmin, companyId);
        await usersService.delete(userIdAdmin, entityId);
        await companiesService.delete(userName);
        await companiesService.delete(entityItem.itemId);
    });
});

