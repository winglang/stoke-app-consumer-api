/* eslint-disable no-undef */
/* eslint-disable no-shadow */
/* eslint-disable strict */
const companyBalance = require('../src/companyBalance');
const jestPlugin = require('serverless-jest-plugin');
const handler = jestPlugin.lambdaWrapper.wrap(companyBalance, { handler: "handler" });

const { CompaniesService, JobsService, CompanyProvidersService, ProvidersService, ExchangeRatesService, SettingsService, constants, permisionConstants } = require('stoke-app-common-api');
const { users } = require('stoke-app-common-api/__tests__/utils');
const { companyId, companyItem } = require('./mock/companyBalanceData');

const companiesService = new CompaniesService(process.env.customersTableName);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAndTagsAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const providersService = new ProvidersService(process.env.providersTableName, constants.projectionExpression.providerAttributes, constants.attributeNames.providerAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const exchangeRatesService = new ExchangeRatesService(process.env.exchangeRatesTableName, constants.projectionExpression.providerAttributes, constants.attributeNames.providerAttributes, settingsService)

const testName = 'COMPANY-BALANCE-TEST';
const userId = `${testName}U1`;
const entityId = `${testName}-ENTITY-ID-1`;
const companyProviderId = `${constants.prefix.provider}${companyId}PROVIDER-ID-1`
const talentId = `${constants.prefix.talent}${companyProviderId}${constants.prefix.talent}TALENT-ID-1`;
const jobId1 = `${constants.prefix.job}${companyId}-JOB-ID-1`;
const providerId = `${testName}-prov-ID-1`
const extrProviderId = `${constants.prefix.extProviderUserId}${providerId}`

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
    providerId,
    itemId: providerId,
    externalUserId: providerId,
    companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        country: 'US',
        paymentSystem: "Tipalti",
        paymentCurrency: "USD",
        paymentMethod: "NoPM",
    },
    userId: providerId
};
const talentInCompany = {
    itemId: talentId,
    companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        name: 'test'
    },
};

const job1 = {
    companyId,
    entityId,
    itemId: jobId1,
    userId,
    itemStatus: constants.job.status.active,
    itemData: {
      talentId,
      jobTitle: `${testName}-JOB-TITLE-1`,
      jobStartDate: '2022-06-28',
    },
    externalUserId: extrProviderId
};

const generateMilestoneItem = (itemId, itemStatus, actualCost, paymentStatus) => ({
    itemId,
    itemStatus,
    itemData: {
        actualCost,
        cost: 100,
        // eslint-disable-next-line no-extra-parens
        ...(paymentStatus && {
            payment: {
                status: paymentStatus,
                statusHistory: [{
                    status: "PendingFunds",
                }],
                dueDate: new Date().getTime()
            }
        }),
    },
    companyId,
    entityId,
    userId,
})

const ms1 = generateMilestoneItem(`ms_${jobId1}_ms1`, constants.job.status.completed, 300, constants.payment.status.paid)
const ms2 = generateMilestoneItem(`ms_${jobId1}_ms2`, constants.job.status.paid, 400, constants.payment.status.paid)

const rate = {
    itemId: 'USD',
    itemData: {
        ILS: 3.4444,
        EUR: 0.8888,
    },
    createdAt: Date.now(),
};

const event = (userId, companyId) => {
    return {
        requestContext: {
            identity: {
                cognitoIdentityId: userId,
            }
        },
        pathParameters: {
            companyId,
        },
        body: JSON.stringify({})
    };
};

const companySettings = {
    itemId: `${constants.prefix.company}${companyId}`,
    itemData: {
        billing: {
            range: [5]
        }
    }
};

describe('companyBalance Tests', () => {

    beforeEach(async () => {
        await companiesService.create(companyItem);
        await providersService.create(provider);
        await exchangeRatesService.create(rate);
        await users.createAdmin(companyId, companyId, userId, [], true, true, { [permisionConstants.permissionsComponentsKeys.billing]: { } });
        await companyProvidersService.create(companyProvider);
        await companyProvidersService.create(talentInCompany);
        await jobsService.create(job1);
        await jobsService.create(ms1);
        await jobsService.create(ms2);
        await settingsService.create(companySettings);
    });

    afterEach(async () => {
        await companiesService.delete(companyItem.itemId);
        await users.remove(companyId, userId);
        await providersService.delete(provider.providerId, provider.itemId);
        await exchangeRatesService.delete(rate.itemId, rate.createdAt);
        await companyProvidersService.delete(companyId, companyProvider.itemId)
        await companyProvidersService.delete(companyId, talentInCompany.itemId);
        await jobsService.delete(job1.entityId, job1.itemId);
        await jobsService.delete(ms1.entityId, ms1.itemId);
        await jobsService.delete(ms2.entityId, ms2.itemId);
        await settingsService.delete(companySettings.itemId);
    });

    test('basic flow', async () => {
        const response = await handler.run(event(userId, companyId));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.balances.milestonesWithoutBillingCost).toBe(700);
    });

    test('unauthorized', async () => {
        const response = await handler.run(event('NOT_FOUND', companyId));
        expect(response.statusCode).toBe(403);
    });

});
