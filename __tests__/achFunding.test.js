'use strict';


const { UsersService, CompaniesService, SettingsService, constants, snsLib } = require('stoke-app-common-api');

const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const mod = require('../src/operationalTasks/achFunding');
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const TEST_NAME = 'achFunding';

const userId1 = `us-east-1:${TEST_NAME}-1`;
const userId2 = `us-east-1:${TEST_NAME}-2`;

const companyId1 = `BENESHf81f1020-${TEST_NAME}-1`;

const dateInEpoch = 1565993299379;


const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const companySettings = {
    "itemId": `comp_${companyId1}`,
    "companyId": companyId1,
    "createdAt": 1622550981336,
    "entityId": companyId1,
    "itemData": {
        "fundingSettings": {
            "companyAdminIds": [
                userId1
            ],
            "contactEmail": "ariel@stoketalent.com",
            "emails": [
            ],
            "lastUpdateTime": 1694681201936,
            "method": "ach",
            "updatedBy": userId1
        }
    },
    "itemStatus": "Active",
    "modifiedAt": 1694681201936,
    "modifiedBy": userId1,
    "userId": userId1
}

const customerCompany = {
    "itemId": `comp_${companyId1}`,
    "companyId": companyId1,
    "createdAt": 1622550981288,
    "createdBy": userId1,
    "itemData": {
        "achNumber": "IKOBRANDS3120c6",
        "entityName": "Benesh",
    },
    "itemStatus": "active",
    "modifiedAt": 1695040111601,
    "modifiedBy": userId1
}

const customerUser = {
    "itemId": `userpoolid_${userId1}`,
    "companyId": companyId1,
    "createdAt": 1622550981359,
    "createdBy": userId1,
    "itemData": {
        "familyName": "Benesh",
        "givenName": "Ariel",
        "userEmail": "ariel@stoketalent.com"
    },
    "itemStatus": "active",
    "modifiedAt": 1674515220454,
    "modifiedBy": userId1,
    "userId": userId1
}

// unauthorised user
const customerUser2 = {
    "itemId": `userpoolid_${userId2}`,
    "companyId": companyId1,
    "createdAt": 1622550981359,
    "createdBy": userId2,
    "itemData": {
        "familyName": "Benesh",
        "givenName": "Ariel",
        "userEmail": "ariel@stoketalent.com"
    },
    "itemStatus": "active",
    "modifiedAt": 1674515220454,
    "modifiedBy": userId2,
    "userId": userId2
}

const authorisedUser = {
    "userId": userId1,
    "entityId": companyId1,
    "companyId": companyId1,
    "createdAt": 1622550981396,
    "createdBy": userId1,
    "itemData": {
     "isBudgetOwner": false,
     "isEditor": true,
     "isJobsApprover": false,
     "ownerOfTeams": [
     ],
     "userRole": "admin"
    },
    "itemStatus": "active",
    "modifiedAt": 1691693223318,
    "modifiedBy": userId1,
    "tags": {
     "__stoke__teams": [
     ]
    }
   }

const eventBuilder = (userId, companyId, amount, dateInEpoch) => {
    return {
        "requestContext": {
            "identity": {
                "cognitoIdentityId": userId
            }
        },
        "body": {
            "companyId": companyId,
            "amount": amount,
            "date": dateInEpoch,
            "comment": "test1111",
        }
    }
};

describe('achFunding', () => {
    beforeAll(async () => {
        await companiesService.create(customerCompany);
        await companiesService.create(customerUser);
        await companiesService.create(customerUser2);
        await usersService.create(authorisedUser);
        await settingsService.create(companySettings);
        snsLib.publish = jest.fn(() => {
            return Promise.resolve(true);
        });
    });

    it('achFunding, user authorized to request ACH expect 200', async () => {
        const response = await wrapped.run(eventBuilder(userId1, companyId1, 100, dateInEpoch));
        expect(response.statusCode).toBe(200);
    });

    it('achFunding, user unauthorized to request ACH expect 403', async () => {
        const response = await wrapped.run(eventBuilder(userId2, companyId1, 100, dateInEpoch));
        expect(response.statusCode).toBe(403);
    });



    afterAll(async () => {
        await companiesService.delete(customerCompany.itemId);
        await companiesService.delete(customerUser.itemId);
        await companiesService.delete(customerUser2.itemId);
        await usersService.delete(authorisedUser.userId, authorisedUser.entityId);
        await settingsService.delete(companySettings.itemId);
    });
});
