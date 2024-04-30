const entities = require('../../src/entities');
const jestPlugin = require('serverless-jest-plugin');
const updateEntityTags = jestPlugin.lambdaWrapper.wrap(entities, { handler: "updateEntityTags" });

const { constants, teamsService, permisionConstants } = require('stoke-app-common-api');

const users = require('stoke-app-common-api/__tests__/utils/users');
const customers = require('stoke-app-common-api/__tests__/utils/customers');

const event = (userId, entityId, tags) => {
    return {
        requestContext: {
            identity: {
                cognitoIdentityId: userId,
            }
        },
        pathParameters: {
            id: entityId,
        },
        body: JSON.stringify({ tags })
    };
};

const COMPANY_ID = 'updateEntityTagsCompany';
const ENTITY_ID = 'updateEntityTagsCompanyentity1';

describe('updateEntityTags Tests', () => {

    beforeEach(async () => {
        await customers.createEntity(COMPANY_ID, ENTITY_ID, 'Colors', 'user1', {});
        await users.create(COMPANY_ID, ENTITY_ID, 'user1');
        await users.createAdmin(COMPANY_ID, ENTITY_ID, 'entityAdmin1', null, null, null, {
            [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: true },
        });
        await users.createAdmin(COMPANY_ID, ENTITY_ID, 'entityAdmin2', null, true);
        await users.createAdmin(COMPANY_ID, ENTITY_ID, 'companyAdmin3', ['ASDF']);
        await users.createAdmin(COMPANY_ID, COMPANY_ID, 'companyAdmin3');
    });

    afterEach(async () => {
        await customers.deleteEntity(ENTITY_ID);
        await users.remove(ENTITY_ID, 'user1');
        await users.remove(ENTITY_ID, 'entityAdmin1');
        await users.remove(ENTITY_ID, 'entityAdmin2');
        await users.remove(ENTITY_ID, 'companyAdmin3');
        await users.remove(COMPANY_ID, 'companyAdmin3');
    });

    test('updateEntityTags - user is not entity admin - unauthorized', async () => {
        const result = await updateEntityTags.run(event('user1', ENTITY_ID, { color: ['red'] }));
        expect(result.statusCode).toBe(403);
    });

    test('updateEntityTags - update teams', async () => {
        const tags = {
            [constants.tags.teams]: [
                'Marketing',
                'Product',
                'Engineering',
            ],
        };

        const result = await updateEntityTags.run(event('entityAdmin1', ENTITY_ID, tags));
        expect(result.statusCode).toBe(200);
        const data = JSON.parse(result.body);
        expect(data.Attributes.tags).toMatchObject({
            [constants.tags.teams]: [
                'Marketing',
                'Product',
                'Engineering',
            ],
        });

        const entityAdmin1User = await users.get(ENTITY_ID, 'entityAdmin1');
        const teams1 = teamsService.get(entityAdmin1User);
        expect(teams1.length).toBe(3);

        const entityAdmin2User = await users.get(ENTITY_ID, 'entityAdmin2');
        const teams2 = teamsService.get(entityAdmin2User);
        expect(teams2.length).toBe(3);

        const companyAdmin3User = await users.get(ENTITY_ID, 'companyAdmin3');
        const teams3 = teamsService.get(companyAdmin3User);
        expect(teams3.length).toBe(3);
    });

});
