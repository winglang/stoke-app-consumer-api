'use strict';
// tests for generatePublicPDF

const mod = require('../src/generatePublicPDF');
const { UsersService, BidsService, JobsService, constants, permisionConstants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const bidsService = new BidsService(process.env.bidsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAndTagsAttributes);

const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const companyId = 'TELENT-PDF-COMPANY-JEST-TEST-BID-JOB-ID-1';
const jobId = 'TELENT-PDF-JEST-TEST-BID-JOB-ID-1';
const entityId = 'TELENT-PDF-JEST-TEST-USER-ID-1';
const userId = 'TELENT-PDF-USERGETBID-JEST-TEST-USER-ID-1';
const bidItemId = 'TELENT-PDF_JOB_ID_USERGETBID-JEST-TEST-BID-ID-1';

const jobItem = {
  companyId,
  entityId,
  itemId: jobId,
  userId,
  itemStatus: constants.job.status.active,
  itemData: {
  },
  tags: {
      address: 'address',
  }
};

const bidItem = {
  entityId: entityId,
  itemId: bidItemId,
  userId: userId,
  
  itemData: {period: 1},
};

const body = {
  entityId: entityId, 
  talentId: bidItem.itemId,
  jobId: jobId
}

const event = {
  body: JSON.stringify(body),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  pathParameters: {
    id: bidItem.itemId
  },
  queryStringParameters: {
  }
};

describe('getBid', () => {
  beforeAll(async () => {
    const user = {
        userId: userId,
        entityId: entityId,
        companyId: companyId,
        itemStatus: constants.user.status.active,
        itemData : { userRole: constants.user.role.admin,
          permissionsComponents: { [permisionConstants.permissionsComponentsKeys.talents]: {} }
         }
    };
    let result = await usersService.create(user);
    expect(result).toEqual(user);
    result = await jobsService.create(jobItem);
    expect(result).toEqual(jobItem);
    result = await bidsService.create(bidItem);
    expect(result.itemId).toBe(bidItem.itemId);

  });

  it('getBid public PDF, expect 200, data', () => {
    return wrapped.run(event).then((response) => {
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).url).not.toBe(undefined);
    });
  });

  afterAll(async () => {
    //cleanup
    let result = await bidsService.delete(bidItem.entityId, bidItem.itemId);
    expect(result).toBe(true);
    result = await usersService.delete(bidItem.userId, bidItem.userId);
    expect(result).toBeTruthy();
    result = await jobsService.delete(entityId, job1.itemId);
    expect(result).toBeTruthy();
  });

});
