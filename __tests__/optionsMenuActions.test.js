'use strict';

const mod = require('../src/optionsMenuActions');
const jestPlugin = require('serverless-jest-plugin');
const wrapped = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'handler' });

const { ACTION_MENU_OPTIONS } = require('../src/helpers/jobHelper');
const { UsersService, CompanyProvidersService, SettingsService, constants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const testName = 'OPTIONS_MENU_ACTIONS_TEST';

const companyId = `${testName}-COMP-ID-1`;
const userId = `${testName}-USER-ID-1`;
const companyProviderId = `${constants.prefix.provider}${testName}-PROVIDER-ID-1`;
const talentId = `${constants.prefix.talent}${companyProviderId}${constants.prefix.talent}-TALENT-ID-1`;

const userAuth = {
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
    },
    companyId: companyId,
    entityId: companyId,
    userId: userId,
};

const companyProvider = {
    itemStatus: constants.companyProvider.status.registered,
    itemData: {
        "isPayable": true,
        "isProviderSelfEmployedTalent": true,
        "paymentMethod": "WireTransfer",
        "sequenceOfWork": {
            "activeEngagementLength": 3,
            "averageMonthlyHours": 15.59,
            "averageMonthlyPay": 281.3,
            "continuityValues": {
                "isNonCompliantBlocked": true,
                "resetContinuityValue": 0,
                "workContinuityHoursRed": 0,
                "workContinuityHoursYellow": 0,
                "workContinuityValueRed": 2,
                "workContinuityValueYellow": 1
            },
            "isHrComplianceRiskStatusRed": true,
            "isNonCompliantBlocked": true,
            "lastPeriodDate": 1709251200000,
            "score": "red",
            "totalEngagementMonths": 8
        },
        isTalentWorkforceComplianceIgnored: {
            value: false
        }
    },
    companyId: companyId,
    itemId: companyProviderId
}

const talent = {
    itemStatus: constants.companyProvider.status.registered,
    itemData: {},
    companyId: companyId,
    itemId: talentId
}

const settings = {
    itemId: `${constants.prefix.company}${companyId}`,
    companyId: companyId,
    entityId: companyId,
    itemData: {
        workforceContinuityPolicy: {
            "enabled": true,
            "values": {
                "isNonCompliantBlocked": true,
                "isResetContinuityMonthsActive": false,
                "notCompliant": {
                    "isHoursLimitActive": false,
                    "workContinuityHours": 11,
                    "workContinuityMonths": 2
                },
                "partiallyCompliant": {
                    "isHoursLimitActive": false,
                    "workContinuityHours": 2,
                    "workContinuityMonths": 1
                },
                "resetContinuityMonths": 5
            }
        }
    },
    itemStatus: constants.settings.status.active,
}

const eventBuilder = (companyId, talentId, userId, action) => ({
    body: {
        companyId,
        talentId,
        action
    },
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    }
});

describe('optionsMenuActions', () => {
    beforeAll(async () => {
        let result = await usersService.create(userAuth);
        expect(result).toEqual(userAuth);
        result = await companyProvidersService.create(companyProvider);
        expect(result).toEqual(companyProvider);
        result = await companyProvidersService.create(talent);
        expect(result).toEqual(talent);
        result = await settingsService.create(settings);
        expect(result).toEqual(settings);

    });

    it('toggleIgnoreWorkforceComplianceBlock, - toggle on & toggle off expect 200', async () => {
        const action = ACTION_MENU_OPTIONS.toggleIgnoreWorkforceComplianceBlock;
        const event = eventBuilder(companyId, talentId, userId, action);

        // toogle on
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        let { isTalentWorkforceComplianceIgnored, allowedActions, payableStatus } = JSON.parse(response.body);
        let { value, modifiedBy } = isTalentWorkforceComplianceIgnored;
        expect(value).toBe(true);
        expect(modifiedBy).toBe(userId);
        expect(allowedActions.startJob.value).toBe(true);
        expect(payableStatus.payableStatus).toBe('green');

        // toogle off
        response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        ({ isTalentWorkforceComplianceIgnored, allowedActions, payableStatus } = JSON.parse(response.body));
        ({ value, modifiedBy } = isTalentWorkforceComplianceIgnored);
        expect(value).toBe(false);
        expect(modifiedBy).toBe(undefined);
        expect(allowedActions.startJob.value).toBe(false);
        expect(payableStatus.payableStatus).toBe('yellow');
    });

    afterAll(async () => {
        await usersService.delete(userId, companyId);
        await companyProvidersService.delete(companyId, companyProviderId);
        await companyProvidersService.delete(companyId, talentId);
        await settingsService.delete(settings.itemId);
    });
});
