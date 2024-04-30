'use strict';
// tests for getBid

const mod = require('../src/bids');
const { UsersService, BidsService, CandidatesService, constants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const bidsService = new BidsService(process.env.bidsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const jestPlugin = require('serverless-jest-plugin');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'getBid' });

const bidItem = {
  entityId: 'USERGETBID-JEST-TEST-USER-ID-1',
  itemId: 'JOB_ID_USERGETBID-JEST-TEST-BID-ID-1',
  userId: 'USERGETBID-JEST-TEST-USER-ID-1',
  itemData: {period: 1}
};

const event = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: bidItem.userId
    }
  },
  pathParameters: {
    id: bidItem.itemId
  },
  queryStringParameters: {
    entityId: bidItem.entityId
  }
};

describe('getBid', () => {
  beforeAll(async () => {
    const user = {
        userId: bidItem.userId,
        entityId: bidItem.userId,
        companyId: bidItem.userId,
        itemStatus: constants.user.status.active,
        itemData : { userRole: constants.user.role.admin, 
          permissionsComponents: {
            [permissionsComponentsKeys.jobs]: { isEditor: false },
          }
        }
    };
    let result = await usersService.create(user);
    expect(result).toEqual(user);
    // create test bid
    result = await bidsService.create(bidItem);
    expect(result.itemId).toBe(bidItem.itemId);

  });

  it('getBid, expect 200, data', () => {
    return wrapped.run(event).then((response) => {
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).itemId).toBe(bidItem.itemId);
      expect(JSON.parse(response.body).itemData.period).toBe(bidItem.itemData.period);
    });
  });

  afterAll(async () => {
    //cleanup
    let result = await bidsService.delete(bidItem.entityId, bidItem.itemId);
    expect(result).toBe(true);
    result = await usersService.delete(bidItem.userId, bidItem.userId);
    expect(result).toBeTruthy();
  });

});
