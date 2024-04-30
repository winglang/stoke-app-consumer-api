/* eslint-disable prefer-destructuring */
/* eslint-disable no-undef */
/* eslint-disable max-lines-per-function */
"use strict";

const mod = require("../src/savedReports")
const _ = require('lodash');
const { SettingsService, UsersService, CompaniesService, constants, permisionConstants } = require("stoke-app-common-api");
const jestPlugin = require("serverless-jest-plugin");
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes,constants.attributeNames.defaultAttributes);
const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: "deleteSavedReport" });
const settingsService = new SettingsService(process.env.settingsTableName);
const usersService = new UsersService(process.env.consumerAuthTableName);
const userIdAdmin = 'JEST-deleteSavedReport-SUB-1234-Admin';
const userIdNotAdmin = 'JEST-deleteSavedReport-SUB-1234-Not-Admin';
const userIdViewer = 'JEST-deleteSavedReport-SUB-1234-Viewer';
const entityId = 'entity-deleteSavedReport-id-1';
const companyId = 'company-deleteSavedReport-id-1';
const savedReportId = 'JEST-deleteSavedReport'

const entityInCompany = {
    companyId,
    itemId: constants.prefix.entity + entityId,
    userId: userIdAdmin,
    itemData: {
        entityName: "legalEnitiyTest"
    }
};

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

const deleteReportDetailsEvent = {
    queryStringParameters: {
        companyId: companyId,
    },
};

describe("deleteSavedReport", () => {
    beforeAll(async () => {
        await usersService.create({
            userId: userIdAdmin,
            entityId: companyId,
            companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin, permissionsComponents: { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } }
            }
        });
        await usersService.create({
            userId: userIdNotAdmin,
            entityId: companyId,
            companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.user, permissionsComponents: { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } }
            }
        });
        await usersService.create({
            userId: userIdViewer,
            entityId: companyId,
            companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.user, permissionsComponents: { [permisionConstants.permissionsComponentsKeys.talents]: { } }
            }
        });

        await companiesService.create(entityInCompany);

        const item = {
            itemId: `${constants.prefix.savedReport}${savedReportId}`,
            userId: userIdAdmin,
            companyId,
            entityId: companyId,
            itemStatus: constants.settings.status.active,
            createdBy: userIdAdmin,
            createdAt: Date.now(),
            modifiedBy: userIdAdmin,
            itemData: {
                reportDetails: {
                    ...reportDetails,
                    isScheduler: false,
                },
            },
        };
    
        await settingsService.create(item);
    })

    it("delete SavedReport, user is Admin - expect 200", async () => {
        const event = {
            ...deleteReportDetailsEvent,
            requestContext: {
                identity: {
                    cognitoIdentityId: userIdAdmin,
                }
            },
            pathParameters: {
                id: savedReportId,
            }
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body)
    })

    it("delete SavedReport, user is member - expect 200", async () => {
        const event = {
            ...deleteReportDetailsEvent,
            requestContext: {
                identity: {
                    cognitoIdentityId: userIdNotAdmin,
                }
            },
            pathParameters: {
                id: savedReportId,
            }
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body)
    })

    it("delete SavedReport, user is viewer - expect 403", async () => {
        const event = {
            ...deleteReportDetailsEvent,
            requestContext: {
                identity: {
                    cognitoIdentityId: userIdViewer,
                }
            },
            pathParameters: {
                id: savedReportId,
            }
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(403);
        const body = JSON.parse(response.body)
    })

    afterAll(async () => {
        let result = await usersService.delete(userId, entityId);
        expect(result).toBe(true);
        await usersService.delete(userId, entityId);
        expect(result).toBe(true);
        await usersService.delete(userId, companyId);
        expect(result).toBe(true);
    });
});
