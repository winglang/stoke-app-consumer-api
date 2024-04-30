'use strict';
// tests for getTalent

const mod = require('../src/talents');
const { TalentsService } = require('stoke-app-common-api');
const talentsService = new TalentsService(process.env.talentsTableName);

const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'getTalent' });

describe('getTalnet', () => {
    beforeAll(async () => {
        let result = await talentsService.create({ itemId: 'TALENT_1', itemData:{talentName: 'TALENT_NAME' }});
        expect(result.itemData).toMatchObject({talentName: 'TALENT_NAME' });
    });

    it('get talent, expect 200', async () => {
        const event = {
            body: {},
            requestContext: {
              identity: {
                cognitoIdentityId: 'USER-JEST-GETTALENT-SUB-1234'
              }
            },
            pathParameters: {
                id: 'TALENT_1'
            },
          }
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).itemId).toBe('TALENT_1');
        expect(JSON.parse(response.body).createdAt).toBeDefined();
        expect(JSON.parse(response.body).modifiedAt).toBeDefined();
    });

    afterAll(async () => {
        let result = await talentsService.delete('TALENT_1');
        expect(result).toBe(true);
    });
});


