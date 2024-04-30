'use strict';

const mod = require('../src/setPlannedBudget');
const { UsersService, BudgetsService, constants, permisionConstants } = require('stoke-app-common-api');
const budgetsService = new BudgetsService(
    process.env.budgetsTableName,
    constants.projectionExpression.defaultAttributes,
    constants.attributeNames.defaultAttributes,
);
const usersService = new UsersService(
    process.env.consumerAuthTableName,
    constants.projectionExpression.defaultAttributes,
    constants.attributeNames.defaultAttributes,
);

const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const companyId = 'SET-PLANNED-BUDGET-JEST-TEST-COMPANY-ID-1';
const entityId = 'SET-PLANNED-BUDGET-JEST-TEST-ENTITY-ID-1';
const companyAdminId = 'SET-PLANNED-BUDGET-JEST-TEST-ADMIN-ID';
const userId = 'SET-PLANNED-BUDGET-JEST-TEST-USER-ID';
const departmentAdminId = 'SET-PLANNED-BUDGET-JEST-TEST-DEP-ADMIN-ID';

const companyAdmin = {
    userId: companyAdminId,
    entityId: companyId,
    companyId: companyId,
    createdBy: companyAdminId,
    modifiedBy: companyAdminId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        permissionsComponents: { [permisionConstants.permissionsComponentsKeys.budget]: {} }
    },
};

const entityAdmin = {
    userId: departmentAdminId,
    entityId: entityId,
    companyId: companyId,
    createdBy: companyAdminId,
    modifiedBy: companyAdminId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        permissionsComponents: { [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true } }
    },
};

const entityUser = {
    userId: userId,
    entityId: entityId,
    companyId: companyId,
    createdBy: departmentAdminId,
    modifiedBy: departmentAdminId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user,
        permissionsComponents: { [permisionConstants.permissionsComponentsKeys.budget]: {} }
    },
};

const entityBudget = {
    itemId: constants.prefix.entity + entityId,
    entityId: entityId,
    companyId: companyId,
    userId: entityAdmin.userId,
    itemData: {
        2021: {
            periods: 4,
            1: {
                total: 50,
                allocated: 20,
                approved: 10,
                pending: 5,
                committed: 2,
                planned: 10,
            },
            2: {
                total: 50,
                allocated: 20,
                approved: 2,
                pending: 5,
                committed: 2,
            },
            3: {
                total: 50,
                allocated: 20,
                approved: 0,
                pending: 0,
                committed: 0,
            },
            4: {
                total: 50,
                allocated: 20,
                approved: 0,
                pending: 0,
                committed: 0,
            },
        },
    },
};

const updatedEntityBudget = {
    ...entityBudget,
    itemData: {
        2021: {
            periods: 4,
            1: {
                total: 50,
                allocated: 20,
                approved: 10,
                pending: 5,
                committed: 2,
                planned: 100,
            },
            2: {
                total: 50,
                allocated: 20,
                approved: 2,
                pending: 5,
                committed: 2,
                planned: 0,
            },
            3: {
                total: 50,
                allocated: 20,
                approved: 0,
                pending: 0,
                committed: 0,
                planned: 0,
            },
            4: {
                total: 50,
                allocated: 20,
                approved: 0,
                pending: 0,
                committed: 0,
                planned: 100,
            },
        },
    },
};

const eventBody = JSON.stringify({
    companyId: companyId,
    entityId: entityId,
    year: 2021,
    periodsAmount: {
        1: 100,
        2: 0,
        3: 0,
        4: 100,
    },
});

const events = {
    admin: {
        body: eventBody,
        requestContext: {
            identity: {
                cognitoIdentityId: companyAdminId,
            },
        },
        queryStringParameters: {
            entityId,
        },
    },
    user: {
        body: eventBody,
        requestContext: {
            identity: {
                cognitoIdentityId: userId,
            },
        },
        queryStringParameters: {
            entityId,
        },
    },
    entityAdmin: {
        body: eventBody,
        requestContext: {
            identity: {
                cognitoIdentityId: departmentAdminId,
            },
        },
        queryStringParameters: {
            entityId,
        },
    },
    unauthorised: {
        body: eventBody,
        requestContext: {
            identity: {
                cognitoIdentityId: entityAdmin.userId + 'not user',
            },
        },
        queryStringParameters: {
            entityId,
        },
    },
};

describe('setPlannedBudget', () => {
    beforeAll(async () => {
        await usersService.create(companyAdmin);
        await usersService.create(entityAdmin);
        await usersService.create(entityUser);
    });
    afterAll(async () => {
        await Promise.all([
            usersService.delete(companyAdmin.userId, companyAdmin.companyId),
            usersService.delete(entityAdmin.userId, entityAdmin.entityId),
            usersService.delete(entityUser.userId, entityUser.entityId),
        ]);
    });

    beforeEach(async () => {
        await budgetsService.create(entityBudget);
    });
    afterEach(async () => {
        await budgetsService.delete(entityBudget.entityId, entityBudget.itemId);
    });

    it('sets the budget plan for the relevant period for a company admin', async () => {
        let response = await wrapped.run(events.admin);
        expect(response.statusCode).toBe(200);
        let updatedBudget = await budgetsService.get(entityId, constants.prefix.entity + entityId);
        expect(updatedBudget).toMatchObject(updatedEntityBudget);
    });

    it('sets the budget plan for the relevant period for a deaptment admin', async () => {
        let response = await wrapped.run(events.entityAdmin);
        expect(response.statusCode).toBe(200);
        let updatedBudget = await budgetsService.get(entityId, constants.prefix.entity + entityId);
        expect(updatedBudget).toMatchObject(updatedEntityBudget);
    });

    it('returns unauthorised resopose for department user', async () => {
        let response = await wrapped.run(events.user);
        expect(response.statusCode).toBe(403);
        let updatedBudget = await budgetsService.get(entityId, constants.prefix.entity + entityId);
        expect(updatedBudget).toMatchObject(entityBudget);
    });

    it('returns unauthorised resopose for unauthorised user', async () => {
        let response = await wrapped.run(events.unauthorised);
        expect(response.statusCode).toBe(403);
        let updatedBudget = await budgetsService.get(entityId, constants.prefix.entity + entityId);
        expect(updatedBudget).toMatchObject(entityBudget);
    });
});
