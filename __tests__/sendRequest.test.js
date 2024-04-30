/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */

'use strict';

const mod = require('../src/sendRequest');
const { UsersService, constants, permisionConstants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);


const jestPlugin = require('serverless-jest-plugin');
const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const testName = 'SEND-REQUEST-JEST-TEST';
const companyId = `${testName}-COMPANY-ID-1`;
const entityId = `${testName}-ENTITY-ID-1`;
const userId1 = `${testName}-USER-ID-1`;
const userId2 = `${testName}-ADMIN-ID-2`;

const entity1User = {
  userId: userId1,
  entityId,
  companyId,
  createdBy: testName,
  modifiedBy: testName,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user,
    permissionsComponents: { [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true } }
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
    userRole: constants.user.role.admin,
    permissionsComponents: { [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true } }
  }
};

const body1 = {
  companyId,
  items: [{ itemId: `ms_job_${testName}}`, entityId }],
  sendToUserId: userId2,
}

const body2 = {
  ...body1,
  sendToUserId: 'wrongUser'
}

const body3 = {
  companyId,
  items: [{ itemId: `ms_job_${testName}}`, entityId: 'entityId' }],
  sendToUserId: userId2,
}

const createEvent = (eventBody, user) => ({
  body: JSON.stringify(eventBody),
  requestContext: {
    identity: {
      cognitoIdentityId: user
    }
  },
});


describe('createBudgetRequests', () => {
  beforeAll(async () => {
    let result = await usersService.create(entity1User);
    expect(result).toMatchObject(entity1User);
    result = await usersService.create(entity1Admin);
    expect(result).toMatchObject(entity1Admin);
  });

  it('Send request to admin, expect 200 ', async () => {
    const response = await wrapped.run(createEvent(body1, userId1));
    expect(response.statusCode).toBe(200);
  });

  it('Send request to unknown user, expect 500 ', async () => {
    const response = await wrapped.run(createEvent(body2, userId1));
    expect(response.statusCode).toBe(500)
  });

  it('Unauthorised user, expect 403 ', async () => {
    const response = await wrapped.run(createEvent(body2, 'unknownUser'));
    expect(response.statusCode).toBe(403)
  });

  it('Wrong department user, expect 403 ', async () => {
    const response = await wrapped.run(createEvent(body3, userId1));
    expect(response.statusCode).toBe(403)
  });


  afterAll(async () => {
    let result = await usersService.delete(entity1User.userId, entity1User.entityId);
    expect(result).toBe(true);
    result = await usersService.delete(entity1Admin.userId, entity1Admin.entityId);
    expect(result).toBe(true);
  });

});
