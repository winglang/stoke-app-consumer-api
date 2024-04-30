'use strict';

// tests for cognitoPreSignup
// Generated by serverless-jest-plugin

const companies = require('../src/companies');
const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrappedUsrResend = lambdaWrapper.wrap(companies, { handler: 'resendInvitation' });
const { CompaniesService, UsersService, constants, sqsLib, SettingsService, permisionConstants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const { buildExternalProviderUserPoolId } = require('../src/helpers/userHelper')
const externalDomainsList = ['firstExternal.com', 'secondExternal.com']

const asyncTasksQueueSpy = jest.spyOn(sqsLib, 'call');

const DUMMY_COMPANY_ID = '121'
const DUMMY_USER_ID = '111'
const EVENT_USER_ID = constants.prefix.userPoolId + DUMMY_USER_ID
const EXTERNAL_USER_EMAIL = `first@${externalDomainsList[0]}`

const basicCompanySettings = {
    itemId: `${constants.prefix.company}${DUMMY_COMPANY_ID}`,
    itemData: {
        jobRequestApproval: {
            enabled: true,
            jobRequestLevels: [],
        }
    }
};

describe('user Resend invite flow', () => {
    beforeAll((done) => {
        expect(process.env.PARAM_NAME_INVITATIONID_PASS).toBeTruthy();
        expect(process.env.PARAM_NAME_INVITATIONID_SALT).toBeTruthy();
        done();
    });

    describe('resendInvitation', () => {
        describe('ExternalProvider', () => {
            beforeEach(async () => {
                await usersService.create({
                    userId: EVENT_USER_ID,
                    entityId: DUMMY_COMPANY_ID,
                    companyId: DUMMY_COMPANY_ID,
                    itemStatus: constants.user.status.active,
                    itemData: {
                        userRole: constants.user.role.admin,
                        isEditor: true,
                        permissionsComponents: {
                            [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true },
                        }
                    }
                });

                await companiesService.create({
                    companyId: DUMMY_COMPANY_ID,
                    itemId: buildExternalProviderUserPoolId(EXTERNAL_USER_EMAIL),
                    userId: EVENT_USER_ID,
                    entityId: EVENT_USER_ID,
                    itemStatus: constants.user.status.invited,
                    itemData: {
                        userEmail: EXTERNAL_USER_EMAIL,
                        userRole: constants.user.role.admin
                    }
                })
            })

            beforeEach(async () => {
                basicCompanySettings.itemData.allowedExternalDomains = externalDomainsList
                await settingsService.create(basicCompanySettings)
            })

            it('should write to log and return', async () => {
                const eventBody = JSON.stringify({ email: EXTERNAL_USER_EMAIL, companyId: DUMMY_COMPANY_ID, entityId: DUMMY_COMPANY_ID })
                const requestContext = { identity: { cognitoIdentityId: EVENT_USER_ID } }
                const response = await wrappedUsrResend.run({ body: eventBody, requestContext })
                expect(response).toBeDefined();
                expect(asyncTasksQueueSpy).toHaveBeenCalled()
            })
        })
    });
});



