/* eslint-disable max-lines-per-function */
/* eslint-disable no-undef */
'use strict';

const _ = require('lodash');

const mod = require('../src/users');
const jestPlugin = require('serverless-jest-plugin');
const { UsersService, BudgetsService, CompaniesService, teamsService, constants, permisionConstants } = require('stoke-app-common-api');
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const addUserInEntity = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'addUserInEntity' });

const userId = "JEST-TEST-ADD-USER"
const userIdAdmin = "JEST-TEST-ADD-USER-ADMIN"
const entityId = "JEST-TEST-ADD-USER-ENTITY"
const entityId3 = "JEST-TEST-ADD-USER-ENTITY3"
const userName = "joe@stokeco.com"
const newUserName = "newJoe@stokeco.com"
const userEmail = "joe@stokeco.com"
const userEmailAdmin = "joeAdmin@stokeco.com"
const newUserEmail = "newJoe@stokeco.com"
const givenName = "joe"
const newGivenName = "newJoe"
const familyName = "newShmoe"
const newFamilyName = "Shmoe"
const entityName = "stoke"
const companyId = "JEST-TEST-ENT-ADD-USER-COMPANY-ID"
const newUserID = 'newUserID';
const newUserID2 = 'newUserID_2';


const userItemAdmin = {
    userId: userIdAdmin,
    userName: userName,
    companyId: companyId,
    userEmail: userEmailAdmin,
    givenName: givenName,
    familyName: familyName,
    entityId: entityId,
    createdBy: userIdAdmin,
    modifiedBy: userIdAdmin,
    entityName: entityName,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        permissionsComponents: {
            [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true },
        }
    }
};

const userItem = {
    userId: userId,
    userName: userEmail,
    userEmail: userEmail,
    companyId: companyId,
    givenName: givenName,
    familyName: familyName,
    entityId: entityId,
    createdBy: userId,
    modifiedBy: userId,
    entityName: entityName,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user, isEditor: true
    }
};

const newUserData = {
    userName: newUserName,
    userId: newUserID,
    userEmail: newUserEmail,
    givenName: newGivenName,
    companyId: companyId,
    familyName: newFamilyName,
    entityName: entityName,
    userRole: constants.user.role.user,
    entityId: entityId
};

const newUserDataWithEditorAttr = {
    ...newUserData,
    isEditor: false,
};

const event = (userId, data) => {
    return {
        body: JSON.stringify(data),
        requestContext: {
            identity: {
                cognitoIdentityId: userId
            }
        }
    }
};

const companyAdminUser = {
    userId: userIdAdmin,
    entityId: companyId,
    companyId,
    itemData: {
        userRole: constants.user.role.admin, isEditor: true
    },
    itemStatus: constants.user.status.active,
};

const companyItem = {
    itemId: `${constants.prefix.company}${companyId}`,
    companyId,
    userId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {}
};

const entityItem1 = {
    itemId: `${constants.prefix.entity}${companyId}`,
    companyId,
    userId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {}
};

const entityItem2 = {
    itemId: `${constants.prefix.entity}${entityId}`,
    companyId,
    userId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {}
};

const entityItem3 = {
    itemId: `${constants.prefix.entity}${entityId3}`,
    companyId,
    userId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {}
};

const entityUser = {
    userId: newUserID,
    entityId: entityId3,
    companyId,
    itemData: {
        userRole: constants.user.role.user, isEditor: true
    },
    itemStatus: constants.user.status.active,
};

const entityMember = {
    userId: newUserID2,
    entityId: entityId3,
    companyId,
    itemData: {
        userRole: constants.user.role.user, isEditor: true
    },
    itemStatus: constants.user.status.active,
}

describe('addUser', () => {
    beforeAll(async () => {
        let response = await usersService.create(userItemAdmin);
        expect(response.userId).toBe(userIdAdmin);
        response = await usersService.create(userItem);
        expect(response.userId).toBe(userId);
        response = await usersService.create(companyAdminUser);
        expect(response.userId).toBe(companyAdminUser.userId);
        response = await usersService.create(entityUser);
        expect(response.userId).toBe(entityUser.userId);
        response = await usersService.create(entityMember);
        expect(response.userId).toBe(entityMember.userId);
        response = await companiesService.create(companyItem);
        expect(response).toBeTruthy();
        response = await companiesService.create(entityItem1);
        expect(response).toBeTruthy();
        response = await companiesService.create(entityItem2);
        expect(response).toBeTruthy();
        response = await companiesService.create(entityItem3);
        expect(response).toBeTruthy();
    });

    it('add users, expect 200, and test data', async () => {
        let response = await addUserInEntity.run(event(userIdAdmin, newUserData));
        expect(response.statusCode).toBe(200);
        response = await usersService.get(newUserID, entityId);
        expect(response).toMatchObject({
            userId: newUserID,
            entityId: entityId,
            itemData: { userRole: constants.user.role.user }
        });
        response = await addUserInEntity.run(event(userIdAdmin, newUserDataWithEditorAttr))
        expect(response.statusCode).toBe(200);
        response = await usersService.get(newUserID, entityId);
        expect(response).toMatchObject({
            userId: newUserID,
            entityId: entityId,
            itemData: { userRole: constants.user.role.user, isEditor: false }
        });
        await usersService.update({
            userId: userItemAdmin.userId, entityId: userItemAdmin.entityId, modifiedBy: userItemAdmin.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: false
            }
        })
        response = await addUserInEntity.run(event(userIdAdmin, newUserData))
        expect(response.statusCode).toBe(403);
        await usersService.update({
            userId: userItemAdmin.userId, entityId: userItemAdmin.entityId, modifiedBy: userItemAdmin.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        })
    });

    it('add user under company, expect 500', async () => {
        const event = {
            body: JSON.stringify({
                userName: newUserName,
                userId: newUserID,
                userEmail: newUserEmail,
                givenName: newGivenName,
                companyId,
                familyName: newFamilyName,
                entityName,
                userRole: constants.user.role.user,
                entityId: companyId
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userIdAdmin
                }
            }
        };
        const response = await addUserInEntity.run(event);
        expect(response.statusCode).toBe(500);
    });

    it('add another company admin, expect success, 200', async () => {
        const event = {
            body: JSON.stringify({
                userName: newUserName,
                userId: newUserID,
                userEmail: newUserEmail,
                givenName: newGivenName,
                companyId,
                familyName: newFamilyName,
                entityName,
                userRole: constants.user.role.admin,
                entityId: companyId
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userIdAdmin
                }
            }
        };
        const response = await addUserInEntity.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).userId).toBe(newUserID);
        const { entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(newUserID, companyId);
        expect(entitiesUser.length).toBe(0);
        const entitiesAdminIds = entitiesAdmin.map((ent) => ent.entityId);
        expect(entitiesAdminIds.includes(companyId) && entitiesAdminIds.includes(entityId3) && entitiesAdminIds.includes(entityId)).toBeTruthy();
    });

    it('User not admin add user, expect 403', async () => {
        const response = await addUserInEntity.run(event(userId, newUserData));
        expect(response.statusCode).toBe(403);
    });

    it('Add user with teams', async () => {
        const newUserDataWithTeams = _.clone(newUserData);
        teamsService.set(newUserDataWithTeams, ['Product', 'Marketing']);
        const response = await addUserInEntity.run(event(userIdAdmin, newUserDataWithTeams));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        const teams = teamsService.get(data);
        expect(teams).toEqual(['Product', 'Marketing']);
    });

    it('Add user - change scope from member to company scope - company viewer', async () => {
        const { entitiesUser } = await usersService.getCompanyUserAuthRole(newUserID2, companyId);
        _.forEach(entitiesUser, (entity) => {
            expect(entity.itemData.userRole).toBe('user');
            expect(entity.itemData.isEditor).toBe(true);
        })     
        const response = await addUserInEntity.run(event(userIdAdmin, {
            entityId: companyId, companyId, userId: newUserID2, userRole: 'admin', isEditor: false
        } ));
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).userId).toBe(newUserID2);
        expect(JSON.parse(response.body).itemData.userRole).toBe('admin');
        expect(JSON.parse(response.body).itemData.isEditor).toBe(false);
        const { entitiesAdmin: newEntitesAdmin, entitiesUser: newEntitesUser } = await usersService.getCompanyUserAuthRole(newUserID2, companyId);
        expect(newEntitesUser.length).toBe(0);

        _.forEach(newEntitesAdmin, (entity) => {
            expect(entity.itemData.userRole).toBe('admin');
            expect(entity.itemData.isEditor).toBe(false);
        })     
    });


    afterAll(async () => {
        await usersService.delete(userIdAdmin, entityId);
        await usersService.delete(userIdAdmin, companyId);
        await usersService.delete(userId, entityId);
        await usersService.delete(newUserID, entityId);
        await usersService.delete(newUserID, companyId);
        await usersService.delete(newUserID2, companyId);
        await usersService.delete(userId, entityId3);
        await usersService.delete(userId, companyId);
        await budgetsService.delete(entityId, `${constants.prefix.user}${newUserID}`);
        await companiesService.delete(companyItem.itemId);
        await companiesService.delete(entityItem1.itemId);
        await companiesService.delete(entityItem2.itemId);
        await companiesService.delete(entityItem3.itemId);
    });
});

