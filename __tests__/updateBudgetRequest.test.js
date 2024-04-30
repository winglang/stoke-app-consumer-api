/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */

'use strict';

const mod = require('../src/budgetRequests/updateBudgetRequest');
const { UsersService, BudgetsService, constants } = require('stoke-app-common-api');
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);


const jestPlugin = require('serverless-jest-plugin');
const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const companyId = 'UPDATE-BUDGET-REQUEST-JEST-TEST-COMPANY-ID-1';
const entityId = 'UPDATE-BUDGET-REQUEST-JEST-TEST-ENTITY-ID-1';
const userId1 = 'UPDATE-BUDGET-REQUEST-JEST-TEST-USER-ID-1';
const userId2 = 'UPDATE-BUDGET-REQUEST-JEST-TEST-ADMIN-ID-2';

const entityAdmin = {
    userId: userId2,
    entityId: entityId,
    companyId: companyId,
    createdBy: userId2,
    modifiedBy: userId2,
    itemStatus: constants.user.status.active,
    itemData: {
      userRole: constants.user.role.admin
    }
};

const entityUser = {
    userId: userId1,
    entityId: entityId,
    companyId: companyId,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.user.status.active,
    itemData: {
      userRole: constants.user.role.user
    }
};

const user1BudgetRequests = {
    itemId: `${constants.prefix.request}${constants.prefix.user}${userId1}`,
    entityId,
    companyId,
    userId: userId1,
    itemData: {
        2021:
        {
            periods: 4,
            1: { requested: 1000, requestedFrom: userId2, message: 'requesting more budget' },
            2: { requested: 0 },
            3: { requested: 0 },
            4: { requested: 0 },
        },
    },
    modifiedBy: userId2
}

const budgetRequestData = {
    requestor: userId1,
    companyId,
    entityId,
    year: 2021,
    period: 1,
};


const resetBudgetRequestEvent = {
    body: JSON.stringify(budgetRequestData),
    requestContext: {
        identity: {
          cognitoIdentityId: userId1
        }
    },
};

const rejectBudgetRequestEvent = {
    body: JSON.stringify(budgetRequestData),
    requestContext: {
        identity: {
          cognitoIdentityId: userId2
        }
    },
};

const unAuthorizedEvent = {
    body: JSON.stringify(budgetRequestData),
    requestContext: {
        identity: {
          cognitoIdentityId: 'userId3'
        }
    },
};

describe('createBudgetRequests', () => {
    beforeAll(async () => {
        // create an admin users in company and entity
        let result = await usersService.create(entityAdmin);
        expect(result.userId).toBe(entityAdmin.userId);
        result = await usersService.create(entityUser);
        expect(result.userId).toBe(entityUser.userId);
        result = await budgetsService.create(user1BudgetRequests);
    });

    it('resetBudgetRequest - cancel request, expect 200 ', async () => {
        const response = await wrapped.run(resetBudgetRequestEvent);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.Attributes.itemData[budgetRequestData.year][budgetRequestData.period]).toMatchObject({
                requested: 0
            });
        
    });

    it('rejectBudgetRequest - admin rejects request, expect 200 ', async () => {
        const response = await wrapped.run(rejectBudgetRequestEvent);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.Attributes.itemData[budgetRequestData.year][budgetRequestData.period]).toMatchObject({
                requested: 0
            });
    });

    it('unAuthorized createBudgetRequest on behalf of user, expect 200 ', async () => {
        const response = await wrapped.run(unAuthorizedEvent);
        expect(response.statusCode).toBe(403);
    });

    afterAll(async () => {
        let result = await usersService.delete(entityAdmin.userId, entityAdmin.entityId);
        expect(result).toBe(true);
        result = await usersService.delete(entityUser.userId, entityUser.entityId);
        expect(result).toBe(true);
        result = await budgetsService.delete(entityId, `${constants.prefix.request}${constants.prefix.user}${userId1}`)
      });

});
