/* eslint-disable prefer-destructuring */
/* eslint-disable no-undef */
/* eslint-disable max-lines-per-function */
"use strict";

const AWS = require('aws-sdk');
const mod = require("../src/savedReports")
const _ = require('lodash');
const { gsiItemsByCompanyIdAndUserIdIndexName } = process.env;
const { SettingsService, UsersService, constants, permisionConstants } = require("stoke-app-common-api");
const jestPlugin = require("serverless-jest-plugin");

const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: "updateSavedReport" });
const settingsService = new SettingsService(process.env.settingsTableName);
const usersService = new UsersService(process.env.consumerAuthTableName);
const userId = 'JEST-updateSavedReport-SUB-1234';
const companyAdminId = 'JEST-updateSavedReport-SUB-Company-admin'
const entityId = 'entity-updateSavedReport-id-1';
const companyId = 'company-updateSavedReport-id-1';
const savedReportId = 'JEST-updateSavedReport'

const reportDetails = {
    "filters": {
        "hiringManagerId": [
            "us-east-1:77ed546c-3115-4eb8-94c9-82f9f547b0e0"
        ],
        "legalEntity": [
            "Benesh Org"
        ]
    },
    "groupBy": "providerId",
    "selectedColumns": {
        "providerName": true,
    },
    "periodPicker": {
        "year": 2023,
        "month": "1",
        "quarter": "1",
        "customPeriod": {
            "from": "",
            "to": ""
        },
        "isYearlyForced": false,
        "isMonthlyForced": false,
        "isCustomPeriodForced": false,
        "isRelativeForced": false,
        "relativePeriod": "Month",
        "relativeType": "current"
    },
    "dateFilterType": "milestoneDeliveryDate",
    "name": "check"
}

const reportDetailsForEvent = {
    "filters": {
        "hiringManagerId": [
            "us-east-1:77ed546c-3115-4eb8-94c9-82f9f547b0e0"
        ],
        "legalEntity": [
            "Benesh Org"
        ]
    },
    "groupBy": "providerId",
    "selectedColumns": {
        "providerName": true,
        "hiringManager": true,
    },
    "periodPicker": {
        "year": 2023,
        "month": "1",
        "quarter": "1",
        "customPeriod": {
            "from": "",
            "to": ""
        },
        "isYearlyForced": false,
        "isMonthlyForced": false,
        "isCustomPeriodForced": false,
        "isRelativeForced": false,
        "relativePeriod": "Month",
        "relativeType": "current"
    },
    "dateFilterType": "milestoneDeliveryDate",
    "name": "check2",
    "isScheduler": true,
    "schedulerData": { recipients: { usersIds: [companyAdminId] }, scheduleSending: '12 * * * *' }
}

const updateReportDetailsEvent = {
    body: JSON.stringify({
        companyId: companyId,
        reportDetails: reportDetailsForEvent,
    }),
};

const notValidRecepientsEvent = {
    body: JSON.stringify({
        companyId: companyId,
        reportDetails: {
            ...reportDetailsForEvent,
            "schedulerData": { recipients: { usersIds: [companyAdminId, userId] }, scheduleSending: '12 * * * *' }
        },
    }),
}

describe("updateSavedReport", () => {
    beforeAll(async () => {
        await usersService.create({
            userId,
            entityId: companyId,
            companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                permissionsComponents: { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } }
            }
        });
        await usersService.create({
            userId,
            entityId,
            companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin, permissionsComponents: { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } }
            }
        });

        await usersService.create({
            userId: companyAdminId,
            entityId: companyId,
            companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin, isEditor: true,
            }
        });

       

        const item = {
            itemId: `${constants.prefix.savedReport}${savedReportId}`,
            userId,
            companyId,
            entityId: companyId,
            itemStatus: constants.settings.status.active,
            createdBy: userId,
            createdAt: Date.now(),
            modifiedBy: userId,
            itemData: {
                reportDetails: {
                    ...reportDetails,
                    isScheduler: false,
                },
            },
            index: gsiItemsByCompanyIdAndUserIdIndexName
        };

        const res = await settingsService.create(item);
    })

    it("updateSavedReport - reportDetails, expect 200", async () => {
        const event = {
            ...updateReportDetailsEvent,
            requestContext: {
                identity: {
                    cognitoIdentityId: userId,
                }
            },
            pathParameters: {
                id: savedReportId,
            }
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body)
        expect(body.isScheduler).toBe(true)
        expect(JSON.stringify(body.schedulerData)).toBe(JSON.stringify({ scheduleSending: '12 * * * *', recipients: { usersIds: [companyAdminId] } }))
    })

    it("updateSavedReport - reportDetails, expect 403 because of not valid recepient (he is with custom role)", async () => {
        const event = {
            ...notValidRecepientsEvent,
            requestContext: {
                identity: {
                    cognitoIdentityId: userId,
                }
            },
            pathParameters: {
                id: savedReportId,
            }
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(403);
    })

    afterAll(async () => {
        let result = await usersService.delete(userId, entityId);
        expect(result).toBe(true);
        result = await settingsService.delete(`${constants.prefix.savedReport}${savedReportId}`);
        expect(result).toBe(true);
        await usersService.delete(userId, entityId);
        expect(result).toBe(true);
        await usersService.delete(userId, companyId);
        expect(result).toBe(true);
        await usersService.delete(companyAdminId, companyId);
        expect(result).toBe(true);
    });
});
