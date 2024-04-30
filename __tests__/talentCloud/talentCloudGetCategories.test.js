'use strict';

const { _ } = require('lodash')
const { constants, CompaniesService, UsersService } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const mod = require('../../src/talentCloud/getCategories');
const jestPlugin = require('serverless-jest-plugin');
const handler = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'handler' });

const companyId = 'EXPLORE-PAGE-DATA-TEST-COMPANY-ID-1'
const entityId1 = 'EXPLORE-PAGE-DATA-TEST-ENTITY-ID-1';
const userId = 'EXPLORE-PAGE-DATA-TEST-USER-ID-1';

const eventExecute = {
    queryStringParameters: { 
        companyId 
    },
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    categoriesFileData: {
        name: '/categoriesTree.json',
        folder: '/talentCloudTests'
    }
};

const entity1 = {
    itemId: `${constants.prefix.entity}${entityId1}`,
    itemData: {
        entityName: 'entity1'
    },
    companyId,
    itemStatus: constants.job.status.active
}

const user1 = {
    itemId: `${constants.prefix.userPoolId}${userId}`,
    userId,
    itemData: {
        userEmail: 'test+he+1+createmilestone@stoketalent.com'
    },
    companyId,
    itemStatus: constants.job.status.active
}

const companyAdmin = {
    userId,
    entityId: companyId,
    companyId: companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin
    }
};

describe('explorePage static data', () => {
    beforeEach(async () => {
        let result = await usersService.create(companyAdmin);
        expect(result.userId).toBe(companyAdmin.userId);
        result = await companiesService.create(user1);
        expect(result.itemId).toBe(user1.itemId);
        result = await companiesService.create(entity1);
        expect(result.itemId).toBe(entity1.itemId);
    })
    it('should return 200 status code and json with data', async () => {
        const response = await handler.run(eventExecute)
        expect(response.statusCode).toBe(200);
    });
});
