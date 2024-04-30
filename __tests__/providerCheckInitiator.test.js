'use strict';

const { user } = require('stoke-app-common-api/config/constants');
const mod = require('../src/providerCheckInitiator');
const { companyId } = require('./mock/companyBalanceData');
const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });
const { constants, idConverterLib, CompanyProvidersService, snsLib, UsersService, permisionConstants, CompaniesService } = require('stoke-app-common-api');
const {
    companyProvidersTableName,
    customersTableName,
    authSnsTopicArn
} = process.env

const snsLibSpy = jest.spyOn(snsLib, 'publish');

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companyProviderId = `${constants.prefix.talent}${constants.prefix.provider}${companyId}PROVIDER-ID-1`
const testName = 'COMPANY-PROVIDER-TEST';
const userId = `${testName}U1`;

const event = {
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    body: JSON.stringify({ providerIds: [companyProviderId], companyId, })
}


const auditCheckEvent = {
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    body: JSON.stringify({ providerIds: [companyProviderId], companyId, type: 'audit' })
}

const companyProvider = {
    itemId: companyProviderId,
    companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        country: 'US',
        name: 'test',
    },
};

const provider = {
    itemId: idConverterLib.getProviderIdFromTalentId(companyProviderId),
    companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        country: 'US',
        name: 'test',
    },
};


const userInCompany = {
    companyId,
    itemId: constants.prefix.userPoolId + userId,
    userId,
    itemStatus: constants.user.status.active,
    itemData: {
      userEmail: 'test1@test.com',
      givenName: 'user',
      familyName: 'test'
    }
}

describe('create provider check', () => { 
    const user = {
        userId: userId,
        entityId: `${companyId}-ENT-1`,
        companyId: companyId,
        itemStatus: constants.user.status.active,
        itemData: { userRole: constants.user.role.admin, permissionsComponents: { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } } },
    };

    beforeEach(async () => {
        await usersService.create(user);
        await companyProvidersService.create(companyProvider);
        await companyProvidersService.create(provider);
        await companiesService.create(userInCompany);
        snsLibSpy.mockImplementation(async (topicArn, subject, messageObject) => {
            console.log("SENDING SNS MESSAGE, PARAMS:::", topicArn, subject, messageObject)
        });
    })

    afterEach(async () => {
        await companyProvidersService.delete(companyId, companyProvider.itemId)
        await companyProvidersService.delete(companyId, provider.itemId);
        await usersService.delete(user.userId, user.entityId)
        await companiesService.delete(userInCompany.itemId)
    })

    describe('background check', () => {
        it('should call to sns', async () => {
            const result = await wrapped.run(event)
            expect(result.statusCode).toBe(200);
            expect(snsLibSpy).toHaveBeenCalledWith(authSnsTopicArn, 'Background check for user', { userDetails: initiatedUserId, companyId, talentId: user.itemId })
        })
    });
    
    describe('audit check', () => {
        it('should call to sns', async () => {
            const result = await wrapped.run(auditCheckEvent)
            expect(result.statusCode).toBe(200);
            expect(snsLibSpy).toHaveBeenCalledWith(authSnsTopicArn, 'Audit check for talent', { userDetails: initiatedUserId, companyId, talentId: user.itemId })
        })

        it.only('should update workforceAudits', async () => {
            const result = await wrapped.run(auditCheckEvent)
            expect(result.statusCode).toBe(200);

            const dbResults = await companyProvidersService.get(companyId, provider.itemId)
            expect(dbResults.itemData.workforceAudits.length).not.toBeNull()
            expect(dbResults.itemData.workforceAudits.length).not.toBeUndefined()
        })
    })
})
