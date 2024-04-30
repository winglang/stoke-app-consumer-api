/* eslint-disable max-lines */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */

'use strict';

// tests for updateBudget

const mod = require('../src/budgets');
const { UsersService, BudgetsService, constants, permisionConstants } = require('stoke-app-common-api');
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const jestPlugin = require('serverless-jest-plugin');
const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'transferBudget' });

const entityId = 'PUT-BUDGET-JEST-TEST-ENTITY-ID-1';

const admin = {
    userId: 'PUT-BUDGET-JEST-TEST-ADMIN-ID-1',
    entityId: 'PUT-BUDGET-JEST-TEST-COMPANY-ID-1',
    companyId: 'PUT-BUDGET-JEST-TEST-COMPANY-ID-1',
    createdBy: 'PUT-BUDGET-JEST-TEST-ADMIN-ID-1',
    modifiedBy: 'PUT-BUDGET-JEST-TEST-ADMIN-ID-1',
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin, isEditor: true,
        permissionsComponents: {
            [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true },
        },
    }
};

const adminInEntity = {
    ...admin,
    entityId,
}

const targetUser = {
    userId: 'TRANSFER-BUDGET-JEST-TEST-USER-ID-2',
    entityId: admin.entityId,
    companyId: admin.companyId,
    createdBy: admin.createdBy,
    modifiedBy: admin.modifiedBy,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user, isEditor: true
    }
};

const targetUserInEntity = {
    ...targetUser,
    entityId,
};

const targetUser2 = {
    userId: 'TRANSFER-BUDGET-JEST-TEST-USER-ID-3',
    entityId: admin.entityId,
    companyId: admin.companyId,
    createdBy: admin.createdBy,
    modifiedBy: admin.modifiedBy,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user, isEditor: true
    }
};

const sourceUserBudget = {
    itemId: `${constants.prefix.user}TRANSFER-BUDGET-JEST-TEST-USER-ID-1`,
    entityId: admin.companyId,
    companyId: admin.companyId,
    userId: 'TRANSFER-BUDGET-JEST-TEST-USER-ID-1',
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 1000, approved: 50, pending: 20, committed: 10, available: 200 },
            2: { total: 1000, approved: 50, pending: 0, committed: 0, available: 500 },
            3: { total: 1000, approved: 0, pending: 0, committed: 0, available: 1000 },
            4: { total: 1000, approved: 0, pending: 0, committed: 0, available: 1000 },
        },
    },
    modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
}

const sourceUserInEntityBudget = {
    ...sourceUserBudget,
    itemId: constants.prefix.user + adminInEntity.userId,
    entityId,
    userId: adminInEntity.userId,
    itemData: {
        2021:
        {
            periods: 4,
            1: { total: 1000, approved: 50, pending: 20, committed: 10, available: 1000 },
            2: { total: 1000, approved: 50, pending: 0, committed: 0, available: 1000 },
            3: { total: 1000, approved: 0, pending: 0, committed: 0, available: 1000 },
            4: { total: 1000, approved: 0, pending: 0, committed: 0, available: 1000 },
        },
    },
}

const targetUserBudget = {
    itemId: constants.prefix.user + targetUser.userId,
    entityId: admin.companyId,
    companyId: admin.companyId,
    userId: targetUser.userId,
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 0, approved: 0, pending: 0, committed: 0, available: 5 },
            2: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            3: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            4: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
        },
    },
    modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
}

const targetUserBudgetOnEntity = {
    itemId: constants.prefix.user + targetUser.userId,
    entityId: entityId,
    companyId: admin.companyId,
    userId: targetUser.userId,
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 0, approved: 0, pending: 0, committed: 0, available: 5 },
            2: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            3: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            4: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
        },
    },
    modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
}

const targetEntityBudget = {
    itemId: constants.prefix.entity + entityId,
    entityId,
    companyId: admin.companyId,
    userId: targetUser.userId,
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 0, approved: 0, pending: 0, committed: 0, available: 5 },
            2: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            3: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            4: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
        },
    },
    modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
}

const companyUserBudget = {
    itemId: constants.prefix.user + targetUser.companyId,
    entityId: admin.companyId,
    companyId: admin.companyId,
    userId: targetUser.userId,
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 10000, approved: 0, pending: 0, committed: 0, available: 10000 },
            2: { total: 10000, approved: 0, pending: 0, committed: 0, available: 10000 },
            3: { total: 10000, approved: 0, pending: 0, committed: 0, available: 10000 },
            5: { total: 10000, approved: 0, pending: 0, committed: 0, available: 10000 },
        },
    },
    modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
}

const companyBudget = {
    itemId: targetUser.companyId,
    entityId: admin.companyId,
    companyId: admin.companyId,
    userId: targetUser.userId,
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 10000, approved: 0, pending: 0, committed: 0, available: 10000 },
            2: { total: 10000, approved: 0, pending: 0, committed: 0, available: 10000 },
            3: { total: 10000, approved: 0, pending: 0, committed: 0, available: 10000 },
            5: { total: 10000, approved: 0, pending: 0, committed: 0, available: 10000 },
        },
    },
    modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
}

const targetUserBudgetNoYear = {
    itemId: constants.prefix.user + targetUser2.userId,
    entityId: admin.companyId,
    companyId: admin.companyId,
    userId: targetUser2.userId,
    itemData: {},
    modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
}

const eventBody = {
    sourceItemId: sourceUserBudget.itemId,
    sourceEntityId: sourceUserBudget.entityId,
    targetItemId: targetUserBudget.itemId,
    targetEntityId: targetUserBudget.entityId,
    year: '2019',
    period: '1',
    amount: 10
};

const event = {
    body: JSON.stringify(eventBody),
    requestContext: {
        identity: {
            cognitoIdentityId: admin.userId,
        }
    }
};

const eventBodyNoTargetYear = {
    sourceItemId: sourceUserBudget.itemId,
    sourceEntityId: sourceUserBudget.entityId,
    targetItemId: targetUserBudgetNoYear.itemId,
    targetEntityId: targetUserBudgetNoYear.entityId,
    year: '2019',
    period: '1',
    amount: 5
};

const eventNoYear = {
    body: JSON.stringify(eventBodyNoTargetYear),
    requestContext: {
        identity: {
            cognitoIdentityId: admin.userId,
        }
    }
};

const targetUserInEntityBudget = {
    ...targetUserBudget,
    itemData: {
        2021:
        {
            periods: 4,
            1: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            2: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            3: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            4: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
        },
    },
    entityId,
}

const targetUserInEntityRequest = {
    itemId: constants.prefix.request + constants.prefix.user + targetUser.userId,
    entityId,
    companyId: admin.companyId,
    userId: targetUser.userId,
    itemData: {
        2021:
        {
            periods: 4,
            1: { requested: 100, requestedFrom: admin.userId },
            2: { requested: 200, requestedFrom: admin.userId },
            3: { requested: 400, requestedFrom: admin.userId },
            4: { requested: 0 },
        }
    },
    modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
}

const approveRequestEventBody = {
    sourceItemId: sourceUserInEntityBudget.itemId,
    sourceEntityId: sourceUserInEntityBudget.entityId,
    targetItemId: targetUserInEntityBudget.itemId,
    targetEntityId: targetUserInEntityBudget.entityId,
    year: '2021',
    period: '2',
    amount: 10,
    isApproveRequest: true,
};

const approveRequestEventBody2 = {
    sourceItemId: sourceUserInEntityBudget.itemId,
    sourceEntityId: sourceUserInEntityBudget.entityId,
    targetItemId: targetUserInEntityBudget.itemId,
    targetEntityId: targetUserInEntityBudget.entityId,
    year: '2021',
    period: '3',
    amount: 10,
    isApproveRequest: true,
};

const eventApproveRequest = {
    body: JSON.stringify(approveRequestEventBody),
    requestContext: {
        identity: {
            cognitoIdentityId: adminInEntity.userId,
        }
    }
}

const eventApproveRequest2 = {
    body: JSON.stringify(approveRequestEventBody2),
    requestContext: {
        identity: {
            cognitoIdentityId: admin.userId,
        }
    }
}


// eslint-disable-next-line max-lines-per-function
describe('transferBudget', () => {
    beforeAll(async () => {
        let result = await usersService.create(admin);
        expect(result).toEqual(admin);
        result = await usersService.create(adminInEntity);
        expect(result).toEqual(adminInEntity);
        result = await usersService.create(targetUser);
        expect(result).toEqual(targetUser);
        result = await usersService.create(targetUserInEntity);
        expect(result).toEqual(targetUserInEntity);
        result = await usersService.create(targetUser2);
        expect(result).toEqual(targetUser2);
        result = await budgetsService.create(sourceUserBudget);
        expect(result).toEqual(sourceUserBudget);
        result = await budgetsService.create(sourceUserInEntityBudget);
        expect(result).toEqual(sourceUserInEntityBudget);
        result = await budgetsService.create(targetUserBudget);
        expect(result).toEqual(targetUserBudget);
        result = await budgetsService.create(targetUserBudgetOnEntity);
        expect(result).toEqual(targetUserBudgetOnEntity);
        result = await budgetsService.create(targetEntityBudget);
        expect(result).toEqual(targetEntityBudget);
        result = await budgetsService.create(companyUserBudget);
        expect(result).toEqual(companyUserBudget);
        result = await budgetsService.create(companyBudget);
        expect(result).toEqual(companyBudget);
        result = await budgetsService.create(targetUserInEntityBudget);
        expect(result).toEqual(targetUserInEntityBudget);
        result = await budgetsService.create(targetUserBudgetNoYear);
        expect(result).toEqual(targetUserBudgetNoYear);
        result = await budgetsService.create(targetUserInEntityRequest);
        expect(result).toEqual(targetUserInEntityRequest);
    });

    it('transfer budget, expect 200', async () => {
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        const modifiedsourceUserBudget = await budgetsService.get(sourceUserBudget.entityId, sourceUserBudget.itemId);
        const modifiedtargetUserBudget = await budgetsService.get(targetUserBudget.entityId, targetUserBudget.itemId);
        expect(modifiedsourceUserBudget.itemData['2019']['1'].available).toBe(sourceUserBudget.itemData['2019']['1'].available - eventBody.amount);
        expect(modifiedsourceUserBudget.itemData['2019']['1'].total).toBe(sourceUserBudget.itemData['2019']['1'].total - eventBody.amount);
        expect(modifiedtargetUserBudget.itemData['2019']['1'].available).toBe(targetUserBudget.itemData['2019']['1'].available + eventBody.amount);
        expect(modifiedtargetUserBudget.itemData['2019']['1'].total).toBe(targetUserBudget.itemData['2019']['1'].total + eventBody.amount);
        await usersService.update({
            userId: admin.userId, entityId: admin.companyId, modifiedBy: admin.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: false
            }
        })
        response = await wrapped.run(event);
        expect(response.statusCode).toBe(403);
        await usersService.update({
            userId: admin.userId, entityId: admin.companyId, modifiedBy: admin.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        })
        response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        await usersService.update({
            userId: targetUser.userId, entityId: targetUser.entityId, modifiedBy: targetUser.userId, itemData: {
                userRole: constants.user.role.user,
                isEditor: false
            }
        })
        response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        await usersService.update({
            userId: targetUser.userId, entityId: targetUser.entityId, modifiedBy: targetUser.userId, itemData: {
                userRole: constants.user.role.user,
                isEditor: true,
                permissionsComponents: {
                    [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true },
                }
            }
        })
        response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        await usersService.update({
            userId: targetUser.userId, entityId: targetUser.entityId, modifiedBy: targetUser.userId, itemData: {
                userRole: constants.user.role.user,
                isEditor: true,
                permissionsComponents: {
                    [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: false },
                }
            }
        })
        response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        await usersService.update({
            userId: targetUser.userId, entityId: targetUser.entityId, modifiedBy: targetUser.userId, itemData: {
                userRole: constants.user.role.user,
                isEditor: true
            }
        })
    });

    it('transfer budget to a user with empty itemData, expect 200', async () => {
        const response = await wrapped.run(eventNoYear);
        expect(response.statusCode).toBe(200);
        const modifiedtargetUserBudget = await budgetsService.get(targetUserBudgetNoYear.entityId, targetUserBudgetNoYear.itemId);
        expect(modifiedtargetUserBudget.itemData['2019']['1'].available).toBe(eventBodyNoTargetYear.amount);
        expect(modifiedtargetUserBudget.itemData['2019']['1'].total).toBe(eventBodyNoTargetYear.amount);
    });

    it('transfer budget over available, expect 500', async () => {
        const budgetPreTransfer = await budgetsService.get(sourceUserBudget.entityId, sourceUserBudget.itemId);
        eventBody.amount = 1000;
        const event = {
            body: JSON.stringify(eventBody),
            requestContext: {
                identity: {
                    cognitoIdentityId: admin.userId,
                }
            }
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
        const budgetAfterTransfer = await budgetsService.get(sourceUserBudget.entityId, sourceUserBudget.itemId);
        expect(budgetPreTransfer).toMatchObject(budgetAfterTransfer);

    });

    it('transfer budget with wrong user, expect 403', async () => {
        eventBody.amount = 1;
        const event = {
            body: JSON.stringify(eventBody),
            requestContext: {
                identity: {
                    cognitoIdentityId: 'no_such_admin',
                }
            }
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(403);
    });

    it('transfer and approve budget request', async () => {
        let response = await wrapped.run(eventApproveRequest);
        expect(response.statusCode).toBe(200);
        response = await budgetsService.get(targetUserInEntityRequest.entityId, `${constants.prefix.request}${approveRequestEventBody.targetItemId}`);
        expect(response.itemData['2021']['2'].requested).toBe(0);
        response = await budgetsService.get(targetUserInEntityRequest.entityId, `${approveRequestEventBody.targetItemId}`);
        expect(response.itemData['2021']['2'].available).toBe(10);
        response = await wrapped.run(eventApproveRequest2);
        expect(response.statusCode).toBe(200);
        response = await budgetsService.get(targetUserInEntityRequest.entityId, `${constants.prefix.request}${approveRequestEventBody2.targetItemId}`);
        expect(response.itemData['2021']['3'].requested).toBe(0);
        response = await budgetsService.get(targetUserInEntityRequest.entityId, `${approveRequestEventBody.targetItemId}`);
        expect(response.itemData['2021']['3'].available).toBe(10);
    });

    afterAll(async () => {
        // cleanup
        let result = await budgetsService.delete(sourceUserBudget.entityId, sourceUserBudget.itemId);
        expect(result).toBe(true);
        result = await budgetsService.delete(targetUserBudget.entityId, targetUserBudget.itemId);
        expect(result).toBe(true);
        result = await budgetsService.delete(targetUserBudgetNoYear.entityId, targetUserBudgetNoYear.itemId);
        expect(result).toBe(true);
        result = await usersService.delete(admin.userId, admin.entityId);
        expect(result).toBe(true);
        const allBudgets = await budgetsService.listCompany(process.env.gsiItemsByCompanyIdAndItemIdIndexName, admin.companyId);
        if (allBudgets) {
            for (let curBudget of allBudgets) {
                await budgetsService.delete(curBudget.entityId, curBudget.itemId);
            }
        }
        await usersService.delete(adminInEntity.userId, adminInEntity.entityId);
        await usersService.delete(targetUserInEntity.userId, targetUserInEntity.entityId);
        await usersService.delete(targetUser2.userId, targetUser2.entityId);
        await usersService.delete(targetUser.userId, targetUser.entityId);
    });

});


