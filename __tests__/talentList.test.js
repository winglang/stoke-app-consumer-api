'use strict';
// tests for getTalents

const mod = require('../src/talents');
const { TalentsService } = require('stoke-app-common-api');
const talentsService = new TalentsService(process.env.talentsTableName);

const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'getTalents' });

const talent = { itemId: 'JETS-GETTALENTS-TALENT_1', itemData:{talentName: 'TALENT_NAME'} }
const event = {
  body: {},
  requestContext: {
    identity: {
      cognitoIdentityId: 'USER-JEST-GETTALENTS-SUB-1234'
    }
  },
  multiValueQueryStringParameters: {
    itemId: [
      talent.itemId,
      talent.itemId,
    ]
  }

}

const failedEvent = {
  body: {},
  requestContext: {
    identity: {
      cognitoIdentityId: 'USER-JEST-GETTALENTS-SUB-1234'
    }
  }
}

describe('getTalnets', () => {
  beforeAll(async () => {
    let result = await talentsService.create(talent);
    expect(result.itemData).toMatchObject({talentName: 'TALENT_NAME' });
  });

  it('get talents, expect 200', async () => {
    const response = await wrapped.run(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)[0].itemId).toBe(talent.itemId);
    expect(JSON.parse(response.body)[0].createdAt).toBeDefined();
    expect(JSON.parse(response.body)[0].modifiedAt).toBeDefined();
    expect(JSON.parse(response.body)[1].itemId).toBe(talent.itemId);
    expect(JSON.parse(response.body)[1].createdAt).toBeDefined();
    expect(JSON.parse(response.body)[1].modifiedAt).toBeDefined();
  });


  it('get talents with missing id, expect failure', async () => {
    const response = await wrapped.run(failedEvent);
    expect(response.statusCode).toBe(500);
  });

  afterAll(async () => {
    let result = await talentsService.delete(talent.itemId);
    expect(result).toBe(true);
  });
});


