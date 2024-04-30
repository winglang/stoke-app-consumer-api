const entities = require('../../src/entities');
const jestPlugin = require('serverless-jest-plugin');
const updateEntity = jestPlugin.lambdaWrapper.wrap(entities, { handler: "updateEntity" });

const users = require('stoke-app-common-api/__tests__/utils/users');
const customers = require('stoke-app-common-api/__tests__/utils/customers');
const { permisionConstants } = require('stoke-app-common-api');

const companyId = 'updateEntityCompany';
const event = (userId, entityId, entityName, costCenter, color) => {
    return {
        requestContext: {
            identity: {
                cognitoIdentityId: userId,
            }
        },
        pathParameters: {
            id: entityId,
        },
        body: JSON.stringify({ companyId, entityName, costCenter, color })
    };
};

describe('updateEntity Tests', () => {

    beforeEach(async () => {
        await customers.createEntity(companyId, 'entity1', 'Colors', 'user1', {});
        await users.create(companyId, 'entity1', 'user1');
        await users.createAdmin(companyId, 'entity1', 'admin1', null, null, null, {
            [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: true },
        });
    });

    afterEach(async () => {
        await customers.deleteEntity('entity1');
        await users.remove('entity1', 'user1');
        await users.remove('entity1', 'admin1');
    });

    test('user is regular user - unauthorized', async () => {
        const result = await updateEntity.run(event('user1', 'entity1', 'new_name', 123));
        expect(result.statusCode).toBe(403);
    });

    test('user is department admin - success', async () => {
        const result = await updateEntity.run(event('admin1', 'entity1', 'new_name', 123, 'black'));
        expect(result.statusCode).toBe(200);
        const data = JSON.parse(result.body);
        expect(data.Attributes).toMatchObject({
            itemData: {
                entityName: 'new_name',
                costCenter: 123,
                color: 'black',
            },
            modifiedBy: 'admin1',
        });
    });

    test('department name already exits', async () => {
        const result = await updateEntity.run(event('user1', 'entity1', 'Colors', 123));
        expect(result.statusCode).toBe(403);
    })

});
