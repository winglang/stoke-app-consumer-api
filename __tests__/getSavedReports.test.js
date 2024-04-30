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
const wrapped = lambdaWrapper.wrap(mod, { handler: "getSavedReports" });
const settingsService = new SettingsService(process.env.settingsTableName);
const usersService = new UsersService(process.env.consumerAuthTableName);
const userId = 'JEST-getSharedSettings-SUB-1234';
const entityId = 'entity-getSharedSettings-id-1';
const companyId = 'company-getSharedSettings-id-1';
const savedReportId = 'JEST-updateSavedReport';

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

const getSavedReportsByUserEvent = {
    queryStringParameters: {
        companyId: companyId,
    },
};

describe("getSavedReport", () => {
    beforeAll(async () => {
        await usersService.create({
            userId,
            entityId: companyId,
            companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin, userRole: constants.user.role.admin, permissionsComponents: { [permisionConstants.permissionsComponentsKeys.talents]: {} }
            }
        });
        await usersService.create({
            userId,
            entityId,
            companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin, userRole: constants.user.role.admin, permissionsComponents: { [permisionConstants.permissionsComponentsKeys.talents]: {} }
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
                }
            },
        };

        const res = await settingsService.create(item);
    })

    it("getSavedReports, expect 200", async () => {
        const event = {
            ...getSavedReportsByUserEvent,
            requestContext: {
                identity: {
                    cognitoIdentityId: userId,
                }
            },
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
    })

    it("getSavedReports, expect not returning archived items", async () => {
        await settingsService.archive(`${constants.prefix.savedReport}${savedReportId}`, userId)
        const event = {
            ...getSavedReportsByUserEvent,
            requestContext: {
                identity: {
                    cognitoIdentityId: userId,
                }
            },
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        expect(response.body).toBe(JSON.stringify({}));
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
    });
});
