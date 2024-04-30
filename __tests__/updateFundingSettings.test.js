/* eslint-disable no-magic-numbers */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-undef */

"use strict";

const mod = require("../src/updateFundingSettings");
const { SettingsService, UsersService, constants } = require("stoke-app-common-api");
const jestPlugin = require("serverless-jest-plugin");
const { permissionsComponentsKeys } = require("stoke-app-common-api/config/permisionConstants");

const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: "handler" });
const settingsService = new SettingsService(process.env.settingsTableName);
const usersService = new UsersService(process.env.consumerAuthTableName);
const testName = 'JEST-FUNDING-SETTINGS-TEST';
const userId = `${testName}-admin-user-1`;
const notAdminId = `${testName}-admin-user-2`;
const companyAdminId_1 = `${testName}-company-admin-user-1`;
const companyAdminId_2 = `${testName}-company-admin-user-2`;
const customRoleId_1 = `${testName}-company-custom-role-1`;
const customRoleId_2 = `${testName}-company-custom-role-2`;
const companyId = `${testName}-comp-1`;

const companySettings = {
    itemId: `${constants.prefix.company}${companyId}`,
    userId,
    companyId,
    entityId: companyId,
    itemStatus: constants.settings.status.active,
    itemData: {
        otherSettings: "other Settings"
    }
};

const notAdmin = {
    userId: notAdminId,
    companyId,
    entityId: companyId,
    createdBy: testName,
    modifiedBy: testName,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user, isEditor: false
    }
};

const companyAdminBuilder = (userId) => {
    return {
        userId,
        companyId,
        entityId: companyId,
        createdBy: testName,
        modifiedBy: testName,
        itemStatus: constants.user.status.active,
        itemData: { userRole: constants.user.role.admin },
    }
};

const customRoleBuilder = (userId, isEditor) => (
    {
        userId,
        companyId,
        entityId: companyId,
        createdBy: testName,
        modifiedBy: testName,
        itemStatus: constants.user.status.active,
        itemData: { userRole: constants.user.role.admin,
            isEditor: true,
            permissionsComponents: {
            [permissionsComponentsKeys.funding]: { isEditor },
          } },
    }
)

const companyAdmin = companyAdminBuilder(userId);
const companyAdmin_1 = companyAdminBuilder(companyAdminId_1);
const companyAdmin_2 = companyAdminBuilder(companyAdminId_2);
const authorisedCustomCompanyRole = customRoleBuilder(customRoleId_1, true);
const notauthorisedCustomCompanyRole = customRoleBuilder(customRoleId_2, false);


const getEvent = (data, cognitoIdentityId) => ({
    body: JSON.stringify({
        data,
        companyId,
    }),
    requestContext: {
        identity: {
            cognitoIdentityId,
        }
    },
})

const fundingMethodAch = {
    paymentSchedule: [5],
    fundingSettings: {
        method: constants.FUNDING_METHODS.ach,
        contactEmail: "test@test.com",
        companyAdminIds: [companyAdminId_1, companyAdminId_2],
        fillerData : {
            fullName: 'Test test',
            email: 'filler@test.com',
        }    
    }
};

const fundingMethodWire = {
    paymentSchedule: [5],
    fundingSettings: {
        method: constants.FUNDING_METHODS.wireTransfer,
        companyAdminIds: [companyAdminId_1, companyAdminId_2],  
        contactEmail: 'test@test.com',
    }
};

const achWithMissingContactEmail = {
    paymentSchedule: [5],
    fundingSettings: {
        method: constants.FUNDING_METHODS.ach,
        companyAdminIds: [companyAdminId_1, companyAdminId_2],  
    }
};

const wireWithNotValidCompanyAdminIds = {
    paymentSchedule: [5],
    fundingSettings: {
        method: constants.FUNDING_METHODS.wireTransfer,
        companyAdminIds: [notAdminId, companyAdminId_2],
        contactEmail: 'test@test.com',  
    }
};

const companyAdminIdsWithAuthorisedCustomRole = {
    paymentSchedule: [5],
    fundingSettings: {
        method: constants.FUNDING_METHODS.wireTransfer,
        companyAdminIds: [companyAdminId_1, customRoleId_1],  
        contactEmail: 'test@test.com',
    }
};

const companyAdminIdsWithNotAuthorisedCustomRole = {
    paymentSchedule: [5],
    fundingSettings: {
        method: constants.FUNDING_METHODS.wireTransfer,
        companyAdminIds: [companyAdminId_1, customRoleId_2],  
        contactEmail: 'test@test.com',
    }
};

describe("updateFundingSettings", () => {
    beforeAll(async () => {
        await settingsService.create(companySettings);
        await usersService.create(companyAdmin);
        await usersService.create(notAdmin);
        await usersService.create(companyAdmin_1);
        await usersService.create(companyAdmin_2);
        await usersService.create(authorisedCustomCompanyRole);
        await usersService.create(notauthorisedCustomCompanyRole);
    })

    it("updateFundingSettings, ACH", async () => {
        const event = getEvent(fundingMethodAch, userId);
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        response = JSON.parse(response.body)
        response = response.Attributes.itemData;
        expect(response.otherSettings).toBe(companySettings.itemData.otherSettings);
        expect(response.paymentSchedule.dayOfMonthToRollInto).toEqual(fundingMethodAch.paymentSchedule);
        expect(response.paymentSchedule.updatedBy).toBe(userId);
        expect(response.fundingSettings.updatedBy).toBe(userId);
        expect(response.fundingSettings.method).toBe(fundingMethodAch.fundingSettings.method);
        expect(response.fundingSettings.achFormStatus).toBe(undefined);
    });

    it("updateFundingSettings, Wire transfer", async () => {
        const event = getEvent(fundingMethodWire, userId);
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        response = JSON.parse(response.body)
        response = response.Attributes.itemData;
        expect(response.otherSettings).toBe(companySettings.itemData.otherSettings);
        expect(response.paymentSchedule.dayOfMonthToRollInto).toEqual(fundingMethodWire.paymentSchedule);
        expect(response.paymentSchedule.updatedBy).toBe(userId);
        expect(response.fundingSettings.updatedBy).toBe(userId);
        expect(response.fundingSettings.method).toBe(fundingMethodWire.fundingSettings.method);
    });

    it("validations for ach, missing contact email", async () => {
        const event = getEvent(achWithMissingContactEmail, userId);
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    });

    it("validations for Wire transfer, user in the list is not admin", async () => {
        const event = getEvent(wireWithNotValidCompanyAdminIds, userId);
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    });

    it("updateFundingSettings, companyIds with authorised custom role", async () => {
        const event = getEvent(companyAdminIdsWithAuthorisedCustomRole, userId);
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        response = JSON.parse(response.body)
        response = response.Attributes.itemData;
        expect(response.otherSettings).toBe(companySettings.itemData.otherSettings);
        expect(response.paymentSchedule.dayOfMonthToRollInto).toEqual(fundingMethodWire.paymentSchedule);
        expect(response.paymentSchedule.updatedBy).toBe(userId);
        expect(response.fundingSettings.updatedBy).toBe(userId);
        expect(response.fundingSettings.method).toBe(fundingMethodWire.fundingSettings.method);
        expect(response.fundingSettings.companyAdminIds[0]).toBe(companyAdminId_1);
        expect(response.fundingSettings.companyAdminIds[1]).toBe(customRoleId_1);

    });

    it("validations for companyAdminIds, user in the list is not admin, custom role with no funding editor permissions", async () => {
        const event = getEvent(companyAdminIdsWithNotAuthorisedCustomRole, userId);
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    });

    afterAll(async () => {
        await usersService.delete(userId, companyId);
        await usersService.delete(notAdminId, companyId);
        await usersService.delete(companyAdmin_1);
        await usersService.delete(companyAdmin_2);
        await usersService.delete(authorisedCustomCompanyRole);
        await usersService.delete(notauthorisedCustomCompanyRole);
        await settingsService.delete(companySettings.itemId);
    });

});
