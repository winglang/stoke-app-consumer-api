/* eslint-disable max-lines */
/* eslint-disable max-params */
/* eslint-disable no-magic-numbers */
/* eslint-disable array-bracket-newline */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-undef */
/* eslint-disable max-lines */

"use strict";

const _ = require('lodash')
const mod = require('../src/fundPerPaymentCycle');
const jestPlugin = require('serverless-jest-plugin');
const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const { constants, UsersService, JobsService, CompaniesService, SettingsService, permisionConstants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes)
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAndTagsAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const date = new Date(new Date().setUTCHours(0, 0, 0, 0))
const nextCycleDate = date.setDate(date.getDate() + 1)
const previousCycleDate = date.setDate(date.getDate() - 5)
const closedCycleDate = date.setDate(date.getDate() - 10)
const settindValidFrom = date.setDate(date.getDate() - 11)

const testName = 'FUND-PER-PAYMENT-CYCLE-STATS';
const companyId = `${testName}-COMPANY-ID-1`;
const companyId2 = `${testName}-COMPANY-ID-2`;
const companyId3 = `${testName}-COMPANY-ID-3`;
const entityId = `${testName}-ENTITY-ID-1`;
const entityId2 = `${testName}-ENTITY-ID-2`;
const entityId3 = `${testName}-ENTITY-ID-3`;
const userId = `${testName}-USER-ID-1`;
const userId2 = `${testName}-USER-ID-2`;
const userId3 = `${testName}-USER-ID-3`;

const providerId = `${constants.prefix.provider}${companyId}PROVIDER-ID-1`
const talentId = `${constants.prefix.talent}${providerId}${constants.prefix.talent}TALENT-ID-1`;
const jobId1 = `${constants.prefix.job}${testName}-JOB-ID-1`;
const jobId2 = `${constants.prefix.job}${testName}-JOB-ID-2`;
const jobId3 = `${constants.prefix.job}${testName}-JOB-ID-3`;

const job1BaseProps = {
    companyId,
    entityId,
    userId,
}

const job2BaseProps = {
    companyId: companyId2,
    entityId: entityId2,
    userId: userId2,
}

const job3BaseProps = {
    companyId: companyId3,
    entityId: entityId3,
    userId: userId3,
}

const generateJob = (baseProps, itemId) => ({
    ...baseProps,
    itemId,
    itemStatus: constants.job.status.completed,
    itemData: {
        talentId,
        jobTitle: `${testName}-JOB-TITLE-1`,
        jobStartDate: '2022-06-28',
    },
})

const job1 = generateJob(job1BaseProps, jobId1)
const job2 = generateJob(job2BaseProps, jobId2)
const job3 = generateJob(job3BaseProps, jobId3)

// eslint-disable-next-line no-shadow
const generateMilestoneItem = (baseProps, itemId, itemStatus, dueDate, paymentStatus, statusDate, billingId, isCoveredByDeposite) => {
    const paymentDate = paymentStatus === 'PendingFunds'
        ? {}
        : { PendingDate: dueDate };
    return {
        ...baseProps,
        itemId,
        itemStatus,
        itemData: {
            billingId,
            actualCost: 100,
            isCoveredByDeposite,
            // eslint-disable-next-line no-extra-parens
            ...(paymentStatus && {
                payment: {
                    ...paymentDate,
                    dueDate,
                    status: paymentStatus,
                    statusHistory: [{
                        status: paymentStatus,
                        date: statusDate,
                    }]
                }
            }),
        }
    }
}

const ms1 = generateMilestoneItem(job1BaseProps, `ms_${jobId1}_ms1`, constants.job.status.paid, new Date(closedCycleDate).getTime(), constants.payment.status.paid, new Date(closedCycleDate).getTime(), 123, true)
const ms2 = generateMilestoneItem(job2BaseProps, `ms_${jobId2}_ms2`, constants.job.status.completed, new Date(previousCycleDate).getTime(), constants.payment.status.pending, new Date(previousCycleDate).getTime())
const ms3 = generateMilestoneItem(job3BaseProps, `ms_${jobId3}_ms3`, constants.job.status.completed, new Date(previousCycleDate).getTime(), constants.payment.status.paid, new Date(previousCycleDate).getTime(), 123, true)
const ms4 = generateMilestoneItem(job1BaseProps, `ms_${jobId1}_ms4`, constants.job.status.completed, new Date(nextCycleDate).getTime(), constants.payment.status.pendingFunds, new Date(nextCycleDate).getTime())
const ms5 = generateMilestoneItem(job2BaseProps, `ms_${jobId2}_ms5`, constants.job.status.completed, new Date(nextCycleDate).getTime(), constants.payment.status.pendingFunds, new Date(nextCycleDate).getTime())
const ms6 = generateMilestoneItem(job3BaseProps, `ms_${jobId3}_ms6`, constants.job.status.completed, new Date(nextCycleDate).getTime(), constants.payment.status.pendingFunds, new Date(nextCycleDate).getTime(), 123)
const ms7 = generateMilestoneItem(job3BaseProps, `ms_${jobId3}_ms7`, constants.job.status.completed, new Date(nextCycleDate).getTime(), constants.payment.status.pending, new Date(nextCycleDate).getTime(), 123)

const closedPaymentCycleEvent = {
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        requestedPaymentCycle: new Date(closedCycleDate).getTime()
    }
}

// eslint-disable-next-line no-shadow
const notCoveredPaymentCycleEvent = (companyId, userId) => ({
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        requestedPaymentCycle: new Date(previousCycleDate).getTime()
    }
})

// eslint-disable-next-line no-shadow
const activePaymentCycleEvent = (companyId, userId) => ({
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        requestedPaymentCycle: new Date(nextCycleDate).getTime()
    }
})

// eslint-disable-next-line no-shadow
const generateCompanySettings = (companyId) => ({
    itemId: `${constants.prefix.company}${companyId}`,
    itemData: {
        paymentSchedule: {
            dayOfMonthToRollInto: [new Date(closedCycleDate).getDate(), new Date(previousCycleDate).getDate(), new Date(nextCycleDate).getDate()],
            daysToAdvance: 0,
            monthsToAdvance: 0
        },
        paymentScheduleVersions: [
            {
                activeFrom: settindValidFrom,
                paymentSchedule: {
                    dayOfMonthToRollInto: [new Date(closedCycleDate).getDate(), new Date(previousCycleDate).getDate(), new Date(previousCycleDate).getDate()],
                    daysToAdvance: 0,
                    monthsToAdvance: 0
                },
            }
        ],
        payments: {
            fundingRequirementType: constants.fundingRequirementTypes.fundPerCycle,
        },
        billing: {
            range: [5],
            "fees": {
             "ACCELERATE": {
              "amount": 0,
              "freeNumber": 30,
              "type": "percentage"
             },
             "AUDIT": {
              "amount": 45,
              "type": "fixed"
             },
             "COMPLIANCE_INSURANCE_ONGING": {
              "amount": 0.5,
              "type": "percentage"
             },
             "Stoke": {
              "MARKETPLACE": {
               "amount": 10,
               "type": "percentage"
              },
              "NON_MARKETPLACE": {
               "amount": "3.5",
               "spendLevel": {
                "from": 0,
                "to": 200000
               },
               "type": "percentage"
              },
              "NON_MARKETPLACE_2": {
               "amount": "3.1",
               "key": "NON_MARKETPLACE_2",
               "spendLevel": {
                "from": 200001,
                "to": 400000
               },
               "type": "percentage"
              },
              "NON_MARKETPLACE_3": {
               "amount": "2.8",
               "key": "NON_MARKETPLACE_3",
               "spendLevel": {
                "from": 400001,
                "to": 1000000
               },
               "type": "percentage"
              }
             },
             "Tipalti_ACH": {
              "amount": 6,
              "txFeeByPayment": true
             },
             "Tipalti_Check": {
              "amount": 6,
              "txFeeByPayment": true
             },
             "Tipalti_eCheck": {
              "amount": 6,
              "txFeeByPayment": true
             },
             "Tipalti_PayPal": {
              "amount": 2.5,
              "base": 3,
              "max": 22,
              "txFeeByPayment": true,
              "type": "percentage"
             },
             "Tipalti_WireTransfer": {
              "amount": 25,
              "txFeeByPayment": true
             }
            },
        }
    }
});

// eslint-disable-next-line no-shadow
const generateUserCompanyAdmin = (userId, companyId) => ({
    userId,
    entityId: companyId,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        permissionsComponents: { [permisionConstants.permissionsComponentsKeys.funding]: { } }
    }
});

const companyBalance = {
    itemId: `${constants.prefix.company}${companyId}`,
    companyId,
    itemData: {},
    itemPrivateData: {
        balances: [
            {
                currency: 'USD',
                rows: [
                    {
                        amount: 102,
                        balance: 102,
                        dateTime: 1655078400000,
                        dateTimeString: "2022-06-13T00:00:00.000Z",
                        description: "Deposit",
                        externalId: null
                    },
                    {
                        allFees: 5,
                        amount: -155,
                        balance: 0,
                        dateTime: previousCycleDate,
                        depositFeeData: {
                            depositIds: [1655078400000],
                            depositAmount: { 1655078400000: 2 }
                        },
                        dateTimeString: "2022-06-13T00:00:00.000Z",
                        description: "Billing - test 2",
                        externalId: 'vat_2'
                    },
                ]
            },
        ]
    },
    itemStatus: constants.user.status.active,
    createdBy: userId,
    modifiedBy: userId,
};

const companyBalance2 = {
    itemId: `${constants.prefix.company}${companyId2}`,
    companyId: companyId2,
    itemData: {},
    itemPrivateData: {
        balances: [
            {
                currency: 'USD',
                rows: [
                    {
                        amount: 500,
                        balance: 500,
                        dateTime: 1655078400000,
                        dateTimeString: "2022-06-13T00:00:00.000Z",
                        description: "Deposit",
                        externalId: null
                    },
                    {
                        allFees: 5,
                        amount: -500,
                        balance: 0,
                        dateTime: new Date(previousCycleDate).getTime(),
                        depositFeeData: {
                            depositIds: [1655078400000],
                            depositAmount: { 1655078400000: 5 }
                        },
                        dateTimeString: "2022-06-13T00:00:00.000Z",
                        description: "Billing - test 2",
                        externalId: 'vat_2'
                    }
                ]
            },
        ]
    },
    itemStatus: constants.user.status.active,
    createdBy: userId2,
    modifiedBy: userId2,
};
const companyBalance3 = {
    itemId: `${constants.prefix.company}${companyId3}`,
    companyId: companyId3,
    itemData: {},
    itemPrivateData: {
        balances: [
            {
                currency: 'USD',
                rows: [
                    {
                        amount: 500,
                        balance: 500,
                        dateTime: 1655078400000,
                        dateTimeString: "2022-06-13T00:00:00.000Z",
                        description: "Deposit",
                        externalId: null
                    },
                    {
                        allFees: 5,
                        amount: 0,
                        balance: 0,
                        dateTime: new Date(previousCycleDate).getTime(),
                        depositFeeData: {
                            depositIds: [1655078400000],
                            depositAmount: { 1655078400000: 5 }
                        },
                        dateTimeString: "2022-06-13T00:00:00.000Z",
                        description: "Billing - test 2",
                        externalId: 'vat_2'
                    }
                ]
            },
        ]
    },
    itemStatus: constants.user.status.active,
    createdBy: userId3,
    modifiedBy: userId3,
};

describe('paymentCycleStats', () => {
    beforeEach(async () => {
        await usersService.create(generateUserCompanyAdmin(userId, companyId));
        await usersService.create(generateUserCompanyAdmin(userId2, companyId2));
        await usersService.create(generateUserCompanyAdmin(userId3, companyId3));
        await companiesService.create(companyBalance);
        await companiesService.create(companyBalance2);
        await companiesService.create(companyBalance3);
        await settingsService.create(generateCompanySettings(companyId));
        await settingsService.create(generateCompanySettings(companyId2));
        await settingsService.create(generateCompanySettings(companyId3));
        await jobsService.create(job1);
        await jobsService.create(ms1);
        await jobsService.create(job2);
        await jobsService.create(ms2);
        await jobsService.create(job3);
        await jobsService.create(ms3);
        await jobsService.create(ms4);
        await jobsService.create(ms5);
        await jobsService.create(ms6);
        await jobsService.create(ms7);
    })

    it('Closed cycle, expect 200, data', async () => {
        const response = await wrapped.run(closedPaymentCycleEvent);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        const { rows } = result;
        expect(_.pick(rows[0], ['itemId'])).toMatchObject({ itemId: ms1.itemId });
        expect(rows.length).toBe(1);
        expect(result.milestonesTotal).toBe(100);
        expect(result.feesTotal).toBe(0);
    });


    it('Not covered cycle due to fees, expect 200, data', async () => {
        const response = await wrapped.run(notCoveredPaymentCycleEvent(companyId, userId));
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        const { rows } = result;
        expect(_.pick(rows[0], ['stokeBill', 'cost', 'title'])).toMatchObject({ stokeBill: true, cost: 5, title: 'test 2' });
        expect(result.rows.length).toBe(1);
        expect(result.milestonesTotal).toBe(0);
        expect(result.feesTotal).toBe(5);
    });

    it('Not covered cycle due to milestone, expect 200, data', async () => {
        const response = await wrapped.run(notCoveredPaymentCycleEvent(companyId2, userId2));
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        const { rows } = result;
        expect(_.pick(rows[0], ['itemId'])).toMatchObject({ itemId: ms2.itemId });
        expect(_.pick(rows[1], ['stokeBill', 'cost', 'title'])).toMatchObject({ stokeBill: true, cost: 5, title: 'test 2' });
        expect(rows.length).toBe(2);
        expect(result.milestonesTotal).toBe(100);
        expect(result.feesTotal).toBe(5);
    });

    it('Blocked due to fees, expect 200, data', async () => {
        const response = await wrapped.run(activePaymentCycleEvent(companyId, userId));
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        const { rows } = result;
        expect(_.pick(rows[0], ['itemId'])).toMatchObject({ itemId: ms4.itemId });
        expect(rows.length).toBe(1);
        expect(result.milestonesTotal).toBe(100);
        expect(result.feesTotal).toBe(0);
    });

    it('Blocked due to ms, expect 200, data', async () => {
        const response = await wrapped.run(activePaymentCycleEvent(companyId2, userId2));
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        const { rows } = result;
        expect(_.pick(rows[0], ['itemId'])).toMatchObject({ itemId: ms5.itemId });
        expect(rows.length).toBe(1);
        expect(result.openCycleType).toBe('BLOCKED');
        expect(result.milestonesTotal).toBe(100);
        expect(result.feesTotal).toBe(0);
        expect(result.notCoveredInPreviousCycles).toBe(100);
    });

    it('Open payment cycle, expect 200, data', async () => {
        const response = await wrapped.run(activePaymentCycleEvent(companyId3, userId3));
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        const { rows } = result;
        expect(_.pick(rows[0], ['itemId'])).toMatchObject({ itemId: ms6.itemId });
        expect(_.pick(rows[1], ['itemId'])).toMatchObject({ itemId: ms7.itemId });
        expect(rows.length).toBe(2);
        expect(result.openCycleType).toBe('OPEN');
        expect(result.milestonesTotal).toBe(200);
        expect(result.feesTotal).toBe(0);
        expect(result.notCoveredInPreviousCycles).toBe(0);
    });

    afterEach(async () => {
        await usersService.delete(userId, companyId);
        await usersService.delete(userId2, companyId2);
        await usersService.delete(userId3, companyId3);
        await companiesService.delete(`comp_${companyId}`);
        await companiesService.delete(`comp_${companyId2}`);
        await companiesService.delete(`comp_${companyId3}`);
        await settingsService.delete(`comp_${companyId}`);
        await settingsService.delete(`comp_${companyId2}`);
        await settingsService.delete(`comp_${companyId3}`);
        await jobsService.delete(entityId, job1.itemId);
        await jobsService.delete(entityId2, job2.itemId);
        await jobsService.delete(entityId3, job3.itemId);
        await jobsService.delete(entityId, ms1.itemId);
        await jobsService.delete(entityId2, ms2.itemId);
        await jobsService.delete(entityId3, ms3.itemId);
        await jobsService.delete(entityId, ms4.itemId);
        await jobsService.delete(ms5.entityId, ms5.itemId);
        await jobsService.delete(ms6.entityId, ms6.itemId);
        await jobsService.delete(ms7.entityId, ms7.itemId);
    });
})
