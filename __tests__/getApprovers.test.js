/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */

'use strict';

const _ = require('lodash');
const mod = require('../src/approvers');
const { UsersService, constants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);


const jestPlugin = require('serverless-jest-plugin');
const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const testName = 'GET-APPROVERS-JEST-TEST';
const companyId = `${testName}-COMPANY-ID-1`;
const entityId = `${testName}-ENTITY-ID-1`;
const entityId2 = `${testName}-ENTITY-ID-2`;
const userId1 = `${testName}-USER-ID-1`;
const userId2 = `${testName}-ADMIN-ID-2`;
const userId3 = `${testName}-COMPANY-ADMIN-ID-3`;

const entity1User = {
  userId: userId1,
  entityId,
  companyId,
  createdBy: testName,
  modifiedBy: testName,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user
  }
};

const entity1Admin = {
  userId: userId2,
  entityId,
  companyId,
  createdBy: testName,
  modifiedBy: testName,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin, isBudgetOwner: true, isJobsApprover: true,
    permissionsComponents: {
      jobs: { isEditor: false },
    },
  }
};

const companyAdminInCompany = {
  userId: userId3,
  entityId: companyId,
  companyId,
  createdBy: testName,
  modifiedBy: testName,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin, isBudgetOwner: true, isJobsApprover: true,
  }
};

const companyAdminInEntity1 = {
  userId: userId3,
  entityId,
  companyId,
  createdBy: testName,
  modifiedBy: testName,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const companyAdminInEntity2 = {
  userId: userId3,
  entityId: entityId2,
  companyId,
  createdBy: testName,
  modifiedBy: testName,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin, isBudgetOwner: true, isJobsApprover: true,
  }
};

// eslint-disable-next-line no-shadow
const createEvent = (userId, companyId, departmentIds) => ({
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  queryStringParameters: {
    companyId,
  },
  // eslint-disable-next-line no-extra-parens
  ...(departmentIds
    ? { multiValueQueryStringParameters: { entities: departmentIds } }
    : {}
  ),
})

describe('getApprovers tests', () => {
  beforeAll(async () => {
    let result = await usersService.create(entity1User);
    expect(result).toMatchObject(entity1User);
    result = await usersService.create(entity1Admin);
    expect(result).toMatchObject(entity1Admin);
    result = await usersService.create(companyAdminInCompany);
    expect(result).toMatchObject(companyAdminInCompany);
    result = await usersService.create(companyAdminInEntity1);
    expect(result).toMatchObject(companyAdminInEntity1);
    result = await usersService.create(companyAdminInEntity2);
    expect(result).toMatchObject(companyAdminInEntity2);
  });

  it('Get approvers for user, expect 200 ', async () => {
    const response = await wrapped.run(createEvent(userId1, companyId));
    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body);
    expect(result.isBudgetOwner).toMatchObject({ [entityId]: [userId3] });
    expect(_.size(result.isBudgetOwner)).toBe(1);
    expect(result.isJobsApprover).toMatchObject({ [entityId]: [userId2] });
    expect(_.size(result.isJobsApprover)).toBe(1);
  });

  it('Get approvers for entityAdmin, expect 200 ', async () => {
    const response = await wrapped.run(createEvent(userId2, companyId));
    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body);
    expect(result.isBudgetOwner).toMatchObject({ [entityId]: [userId3], [companyId]: [userId3] });
    expect(_.size(result.isBudgetOwner)).toBe(2);
    expect(result.isJobsApprover).toMatchObject({ [entityId]: [userId2], [companyId]: [userId3] });
    expect(_.size(result.isJobsApprover)).toBe(2);

  });

  it('Get approvers for companyAdmin, expect 200 ', async () => {
    const response = await wrapped.run(createEvent(userId3, companyId));
    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body);
    expect(result.isBudgetOwner).toMatchObject({
      [entityId]: [userId3], [entityId2]: [userId3], [companyId]: [userId3]
    });
    expect(_.size(result.isBudgetOwner)).toBe(3);
    expect(result.isJobsApprover).toMatchObject({
      [entityId]: [userId2], [entityId2]: [userId3], [companyId]: [userId3]
    });
    expect(_.size(result.isJobsApprover)).toBe(3);

  });

  it('Get approvers for specific entities, expect 200 ', async () => {
    let response = await wrapped.run(createEvent(userId1, companyId, [companyId, entityId]));
    expect(response.statusCode).toBe(200);
    let result = JSON.parse(response.body);
    expect(result.isBudgetOwner).toMatchObject({ [entityId]: [userId3] });

    response = await wrapped.run(createEvent(userId3, companyId, [companyId]));
    expect(response.statusCode).toBe(200);
    result = JSON.parse(response.body);
    expect(result.isBudgetOwner).toMatchObject({
      [companyId]: [userId3]
    });

    response = await wrapped.run(createEvent(userId2, companyId, [companyId]));
    expect(response.statusCode).toBe(200);
    result = JSON.parse(response.body);
    expect(result.isBudgetOwner).toMatchObject({
      [companyId]: [userId3]
    });
    response = await wrapped.run(createEvent(userId3, companyId, ['not-existing']));
    expect(response.statusCode).toBe(200);
    result = JSON.parse(response.body);
    expect(result.isBudgetOwner).toEqual({});
  });


  afterAll(async () => {
    let result = await usersService.delete(entity1User.userId, entity1User.entityId);
    expect(result).toBe(true);
    result = await usersService.delete(entity1Admin.userId, entity1Admin.entityId);
    expect(result).toBe(true);
    result = await usersService.delete(companyAdminInCompany.userId, companyAdminInCompany.entityId);
    expect(result).toBe(true);
    result = await usersService.delete(companyAdminInEntity1.userId, companyAdminInEntity1.entityId);
    expect(result).toBe(true);
    result = await usersService.delete(companyAdminInEntity2.userId, companyAdminInEntity2.entityId);
    expect(result).toBe(true);
  });

});
