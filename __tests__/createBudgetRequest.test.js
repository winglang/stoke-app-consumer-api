/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */

'use strict';

const mod = require('../src/budgetRequests/createBudgetRequest');
const { UsersService, BudgetsService, constants } = require('stoke-app-common-api');
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);


const jestPlugin = require('serverless-jest-plugin');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');
const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const companyId = 'CREATE-BUDGET-REQUEST-JEST-TEST-COMPANY-ID-1';
const entityId = 'CREATE-BUDGET-REQUEST-JEST-TEST-ENTITY-ID-1';
const userId1 = 'CREATE-BUDGET-REQUEST-JEST-TEST-USER-ID-1';
const userId2 = 'CREATE-BUDGET-REQUEST-JEST-TEST-ADMIN-ID-2';
const userId3 = 'CREATE-BUDGET-REQUEST-JEST-TEST-ADMIN-ID-3';
const userId4 = 'CREATE-BUDGET-REQUEST-JEST-TEST-ADMIN-ID-4';


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

const entityAdminWithAuthorisedBudgetCustomRole = {
    userId: userId3,
    entityId: entityId,
    companyId: companyId,
    createdBy: userId2,
    modifiedBy: userId2,
    itemStatus: constants.user.status.active,
    itemData: {
      userRole: constants.user.role.admin,
      permissionsComponents: {
        [permissionsComponentsKeys.budget]: { isEditor: true },
      }
    }
};

const entityAdminNotAuthorisedBudgetCustomRole = {
    userId: userId4,
    entityId: entityId,
    companyId: companyId,
    createdBy: userId2,
    modifiedBy: userId2,
    itemStatus: constants.user.status.active,
    itemData: {
      userRole: constants.user.role.admin,
      permissionsComponents: {
        [permissionsComponentsKeys.budget]: { isEditor: false },
      }
    }
};

const budgetRequestData = {
    requestor: entityUser.userId,
    companyId,
    entityId,
    year: 2021,
    period: 1,
    amount: 1000,
    requestedFrom: userId2,
};

const budgetRequestData2 = {
    requestor: entityUser.userId,
    companyId,
    entityId,
    year: 2021,
    period: 2,
    amount: 2000,
    requestedFrom: userId2,
};

const budgetRequestData3 = {
    requestor: entityUser.userId,
    companyId,
    entityId,
    year: 2021,
    period: 2,
    amount: 2000,
    requestedFrom: userId3,
};

const budgetRequestData4 = {
    requestor: entityUser.userId,
    companyId,
    entityId,
    year: 2021,
    period: 2,
    amount: 2000,
    requestedFrom: userId4,
};

const createBudgetRequestEvent = {
    body: JSON.stringify(budgetRequestData),
    requestContext: {
        identity: {
          cognitoIdentityId: entityUser.userId
        }
    },
};

const entityAdminOnBehalfOfUser = {
    body: 
        JSON.stringify(budgetRequestData2),    
    requestContext: {
        identity: {
          cognitoIdentityId: entityAdmin.userId
        }
    },
};

const requestFromAuthorisedCustomRole = {
    body: 
        JSON.stringify(budgetRequestData3),    
    requestContext: {
        identity: {
          cognitoIdentityId: entityAdmin.userId
        }
    },
};

const requestFromNotAuthorisedCustomRole = {
    body: 
        JSON.stringify(budgetRequestData4),    
    requestContext: {
        identity: {
          cognitoIdentityId: entityAdmin.userId
        }
    },
};

const unAuthorizedEvent = {
    body: JSON.stringify({
        ...budgetRequestData,
        requestor: entityAdmin.userId
    }),
    requestContext: {
        identity: {
          cognitoIdentityId: entityUser.userId
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
        result = await usersService.create(entityAdminWithAuthorisedBudgetCustomRole);
        expect(result.userId).toBe(entityAdminWithAuthorisedBudgetCustomRole.userId);
        result = await usersService.create(entityAdminNotAuthorisedBudgetCustomRole);
        expect(result.userId).toBe(entityAdminNotAuthorisedBudgetCustomRole.userId);

    });

    it('user createBudgetRequest, expect 200 ', async () => {
        const response = await wrapped.run(createBudgetRequestEvent);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.Attributes.itemData[budgetRequestData.year][budgetRequestData.period]).toMatchObject({
                requestedFrom: budgetRequestData.requestedFrom,
                requested: budgetRequestData.amount
            });
        
    });

    it('user createBudgetRequest request from authorised custom role, expect 200 ', async () => {
        const response = await wrapped.run(requestFromAuthorisedCustomRole);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.Attributes.itemData[budgetRequestData3.year][budgetRequestData3.period]).toMatchObject({
                requestedFrom: budgetRequestData3.requestedFrom,
                requested: budgetRequestData3.amount
            });
        
    });

    it('entityAdmin createBudgetRequest on behalf of user, expect 200 ', async () => {
        const response = await wrapped.run(entityAdminOnBehalfOfUser);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.Attributes.itemData[budgetRequestData2.year][budgetRequestData2.period]).toMatchObject({
                requestedFrom: budgetRequestData2.requestedFrom,
                requested: budgetRequestData2.amount
            });
    });

    it('unAuthorized createBudgetRequest on behalf of user, expect 200 ', async () => {
        const response = await wrapped.run(unAuthorizedEvent);
        expect(response.statusCode).toBe(403);
    });

    it('unAuthorized request from not authorised custom role user ', async () => {
        const response = await wrapped.run(requestFromNotAuthorisedCustomRole);
        expect(response.statusCode).toBe(403);
    });
    
    afterAll(async () => {
        let result = await usersService.delete(entityAdmin.userId, entityAdmin.entityId);
        expect(result).toBe(true);
        result = await usersService.delete(entityUser.userId, entityUser.entityId);
        expect(result).toBe(true);
        result = await budgetsService.delete(entityId, `${constants.prefix.request}${constants.prefix.user}${userId1}`)
        result = await usersService.delete(entityAdminWithAuthorisedBudgetCustomRole.userId, entityAdminWithAuthorisedBudgetCustomRole.entityId);
        expect(result).toBe(true);
        result = await usersService.delete(entityAdminNotAuthorisedBudgetCustomRole.userId, entityAdminNotAuthorisedBudgetCustomRole.entityId);
        expect(result).toBe(true);
      });

});
