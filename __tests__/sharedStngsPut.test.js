/* eslint-disable prefer-destructuring */
/* eslint-disable no-undef */
/* eslint-disable max-lines-per-function */
"use strict";

const AWS = require('aws-sdk');
const mod = require("../src/sharedSettings")
const _ = require('lodash');

const { SettingsService, UsersService, CompaniesService, constants, formatterLib, permisionConstants } = require("stoke-app-common-api");
const jestPlugin = require("serverless-jest-plugin");

const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: "updateSharedSettings" });
const settingsService = new SettingsService(process.env.settingsTableName);
const usersService = new UsersService(process.env.consumerAuthTableName);
const companiesService = new CompaniesService(
    process.env.customersTableName,
    constants.projectionExpression.defaultAttributes,
    constants.attributeNames.defaultAttributes
);
const userId = 'JEST-updateSharedSettings-SUB-1234';
const entityId = 'entity-updateSharedSettings-id-1';
const companyId = 'company-updateSharedSettings-id-1';
const userAdminEntity = 'userAdminEntity';

const adminEntity = {
    userId: userAdminEntity,
    companyId,
    entityId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin, isEditor: true
    }
};

//////////////////////
// data for beforeAll
//////////////////////
const entityInCompany = {
    companyId,
    itemId: constants.prefix.entity + entityId,
    userId: userId,
    itemData: {
        entityName: "legalEnitiyTest"
    }
};

const sharedReportEventWithMissingParam = {
    body: JSON.stringify({
        companyId: companyId,
    }),
};

const sharedReportEvent = {
    body: JSON.stringify({
        data: {
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
                "department": true,
                "jobTitle": true,
                "jobType": true,
                "milestoneTitle": true,
                "date": true,
                "status": true,
                "amount": true,
                "hourlyRate": true,
                "plannedHours": true,
                "plannedLocal": true,
                "approved": true,
                "requestedHours": true,
                "localCurrencyTotal": true,
                "paymentStatus": true
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
        },
        companyId: companyId,
    }),
};

describe("updateSharedSettings", () => {
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
        await usersService.create(adminEntity);
        await companiesService.create(entityInCompany);
    })

    it("updateSharedSettings, expect 200", async () => {
        const event = {
            ...sharedReportEvent,
            requestContext: {
                identity: {
                    cognitoIdentityId: userId,
                }
            },
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body)
        expect(body.sharedReportId).not.toBeUndefined();
    })

    it("updateSharedSettings, when user is not authorised", async () => {
        const event = {
            ...sharedReportEvent,
            requestContext: {
                identity: {
                    cognitoIdentityId: 'userIdNotInSystem'
                }
            },
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(403);
    })

    it("updateSharedSettings, when missing required param", async () => {
        const event = {
            ...sharedReportEventWithMissingParam,
            requestContext: {
                identity: {
                    cognitoIdentityId: 'userId'
                }
            },
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    })

    afterAll(async () => {
        let result = await usersService.delete(userId, entityId);
        expect(result).toBe(true);
        result = await settingsService.delete(`user_${userId}`);
        expect(result).toBe(true);
        result = await usersService.delete(userAdminEntity, entityId);
        expect(result).toBe(true);
        await usersService.delete(userId, entityId);
        expect(result).toBe(true);
        await usersService.delete(userId, companyId);
        expect(result).toBe(true);
        await companiesService.delete(`entity_${entityId}`)
        expect(result).toBe(true);
    });
});
