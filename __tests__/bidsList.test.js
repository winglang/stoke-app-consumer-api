'use strict';
// tests for getBids
const AWS = require('aws-sdk');
const mod = require('../src/bids');
const { SettingsService, BidsService, UsersService, JobsService, constants } = require('stoke-app-common-api');
const bidsService = new BidsService(process.env.bidsTableName);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName);
const documentClient = new AWS.DynamoDB.DocumentClient();

const jestPlugin = require('serverless-jest-plugin');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'getBids' });
const userId = 'USER-JEST-GETBIDS-SUB-1234';
const userId2 = 'USER-JEST-GETBIDS-SUB-5678';
const entityId = 'ENT_1';
const bid = { entityId, itemId: 'BID_1', itemData: { period: 1 } };
const bid2 = { entityId, itemId: 'BID_2', itemData: { period: 2 } };
const bid3 = { entityId, itemId: 'BID_3', itemData: { period: 3 } };
const jobId = 'job_BIDS_JOB_TEST';
const job = {
  entityId,
  itemStatus: 'Pending',
  itemData: {
    bids: [bid.itemId, bid2.itemId, bid3.itemId]
  },
  itemId: jobId
}
const favorites = documentClient.createSet(['BID_2', 'BID_1', 'talent-id-3'])
const user = {
  entityId: 'ENT_1', userId: userId, companyId: 'COMP_1', itemStatus: constants.user.status.active,
  itemData: { userRole: constants.user.role.admin,
    permissionsComponents: {
      [permissionsComponentsKeys.jobs]: { isEditor: false },
    }
  }
};
const user2 = {
  entityId: 'ENT_1', userId: userId2, companyId: 'COMP_1', itemStatus: constants.user.status.active,
  itemData: { userRole: constants.user.role.admin }
};
const userSetting = {
  itemId: "user_USER-JEST-GETBIDS-SUB-1234", userId: userId, entityId: 'ENT_1', companyId: 'COMP_1',
  itemData: { favorites: favorites }
};

const event = {
  body: {},
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  multiValueQueryStringParameters: {
    itemId: [
      bid.itemId,
      bid2.itemId
    ]
  },
  queryStringParameters: {
    entityId:
      bid.entityId,
  }

};

const event2 = {
  body: {},
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  multiValueQueryStringParameters: {
    itemId: [
      bid.itemId,
      bid2.itemId,
      bid3.itemId
    ]
  },
  queryStringParameters: {
    entityId: bid.entityId,
    getFavoriteBids: true
  }

};

const event3 = {
  body: {},
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  multiValueQueryStringParameters: {
    itemId: [
      bid.itemId,
      bid2.itemId,
    ]
  },
  queryStringParameters: {
    entityId: bid.entityId,
    userSettingsId: userId
  }

};

const event4 = {
  body: {},
  requestContext: {
    identity: {
      cognitoIdentityId: userId2
    }
  },
  multiValueQueryStringParameters: {
    itemId: [
      bid.itemId,
      bid2.itemId,
    ]
  },
  queryStringParameters: {
    entityId: bid.entityId,
    getFavoriteBids: true
  }

};

const event5 = {
  body: {},
  requestContext: {
    identity: {
      cognitoIdentityId: userId2
    }
  },
  queryStringParameters: {
    jobId,
    entityId: bid.entityId,
    getFavoriteBids: true
  }
};

const failedEvent = {
  body: {},
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  }
};

const failedEventWithNotWExistJob = {
  body: {},
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  queryStringParameters: {
    jobId: 'job_NOT_EXIST_JOB_TEST',
  }
};

describe('getBids', () => {
  beforeAll(async () => {
    let result = await bidsService.create(bid);
    expect(result.itemData).toMatchObject({ period: 1 });
    result = await bidsService.create(bid2);
    expect(result.itemData).toMatchObject({ period: 2 });
    result = await bidsService.create(bid3);
    expect(result.itemData).toMatchObject({ period: 3 });
    result = await jobsService.create(job);
    expect(result).toEqual(job);
    result = await usersService.create(user);
    expect(result.entityId).toBe(bid.entityId);
    result = await usersService.create(user2);
    expect(result.entityId).toBe(bid.entityId);
    result = await settingsService.create(userSetting);
    expect(result.itemData).toMatchObject({ favorites: favorites });
  });

  it('get bids, expect 200', async () => {
    const response = await wrapped.run(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)[0].itemId).toBe(bid.itemId);
    expect(JSON.parse(response.body)[0].createdAt).toBeDefined();
    expect(JSON.parse(response.body)[0].modifiedAt).toBeDefined();
    expect(JSON.parse(response.body)[1].itemId).toBe(bid2.itemId);
    expect(JSON.parse(response.body)[1].createdAt).toBeDefined();
    expect(JSON.parse(response.body)[1].modifiedAt).toBeDefined();
  });

  it('get bids with suitability, expect 200', async () => {
    const response = await wrapped.run(event2);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)[0].itemId).toBe(bid.itemId);
    expect(JSON.parse(response.body)[0].itemData).toMatchObject({ "period": 1, "isFavorite": true });
    expect(JSON.parse(response.body)[1].itemId).toBe(bid2.itemId);
    expect(JSON.parse(response.body)[1].itemData).toMatchObject({ "period": 2, "isFavorite": true });
    expect(JSON.parse(response.body)[2].itemId).toBe(bid3.itemId);
    expect(JSON.parse(response.body)[2].itemData).toMatchObject({ "period": 3 });
  });

  it('get bids with unknown parameter, expect 200', async () => {
    const response = await wrapped.run(event3);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)[0].itemId).toBe(bid.itemId);
    expect(JSON.parse(response.body)[0].createdAt).toBeDefined();
    expect(JSON.parse(response.body)[0].modifiedAt).toBeDefined();
    expect(JSON.parse(response.body)[1].itemId).toBe(bid2.itemId);
    expect(JSON.parse(response.body)[1].createdAt).toBeDefined();
    expect(JSON.parse(response.body)[1].modifiedAt).toBeDefined();
  });

  it('get bids for user with no settings, expect 200', async () => {
    const response = await wrapped.run(event4);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)[0].itemId).toBe(bid.itemId);
    expect(JSON.parse(response.body)[0].createdAt).toBeDefined();
    expect(JSON.parse(response.body)[0].modifiedAt).toBeDefined();
    expect(JSON.parse(response.body)[1].itemId).toBe(bid2.itemId);
    expect(JSON.parse(response.body)[1].createdAt).toBeDefined();
    expect(JSON.parse(response.body)[1].modifiedAt).toBeDefined();
  });

  it('get bids for user with job id, expect 200', async () => {
    const response = await wrapped.run(event5);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)[0].itemId).toBe(bid.itemId);
    expect(JSON.parse(response.body)[1].itemId).toBe(bid2.itemId);
    expect(JSON.parse(response.body)[2].itemId).toBe(bid3.itemId);
  });

  it('get bids with missing id, expect failure', async () => {
    const response = await wrapped.run(failedEvent);
    expect(response.statusCode).toBe(403);
  });

  it('get bids with missing id, expect failure', async () => {
    const response = await wrapped.run(failedEventWithNotWExistJob);
    expect(response.statusCode).toBe(403);
  });

  afterAll(async () => {
    let result = await bidsService.delete(bid.entityId, bid.itemId);
    expect(result).toBe(true);
    result = await usersService.delete(user.userId, user.entityId);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, jobId);
    expect(result).toBe(true);
  });
});


