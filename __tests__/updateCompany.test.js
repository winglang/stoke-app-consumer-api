const companies = require('../src/companies');
const jestPlugin = require('serverless-jest-plugin');
const updateCompany = jestPlugin.lambdaWrapper.wrap(companies, { handler: "updateCompany" });

const users = require('stoke-app-common-api/__tests__/utils/users');
const customers = require('stoke-app-common-api/__tests__/utils/customers');
const { permisionConstants } = require('stoke-app-common-api');

const companyId = 'UPDATE-COMPANY-Company1';
const event = (userId, companyId, invoiceName, country) => {
    return {
        requestContext: {
            identity: {
                cognitoIdentityId: userId,
            }
        },
        pathParameters: {
            companyId,
        },
        body: JSON.stringify({ invoiceName, country })
    };
};

describe('updateEntity Tests', () => {

    beforeEach(async () => {
        await customers.createCompany(companyId, 'Update Company', 'user1');
        await users.create(companyId, companyId, 'user1', undefined, undefined, undefined, undefined, {
            [permisionConstants.permissionsComponentsKeys.users]: { isEditor: false },
        });
        await users.createAdmin(companyId, companyId, 'admin1', undefined, undefined, undefined, {
            [permisionConstants.permissionsComponentsKeys.billing]: { isEditor: true },
        });
    });

    afterEach(async () => {
        await customers.deleteCompany(companyId);
        await users.remove(companyId, 'user1');
        await users.remove(companyId, 'admin1');
    });

    test('user is regular user - unauthorized', async () => {
        const result = await updateCompany.run(event('user1', companyId, 'Invoice 1 2 3', 'Israel'));
        expect(result.statusCode).toBe(403);
    });

    test('user is department admin - success', async () => {
        const result = await updateCompany.run(event('admin1', companyId, 'Invoice 1 2 3', 'Israel'));
        expect(result.statusCode).toBe(200);
        const data = JSON.parse(result.body);
        expect(data.Attributes).toMatchObject({
            itemData: {
                entityName: 'Update Company',
                invoiceName: 'Invoice 1 2 3',
                country: 'Israel',
            },
            modifiedBy: 'admin1',
        });
    });

});
