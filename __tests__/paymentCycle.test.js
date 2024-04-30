/* eslint-disable max-lines */
/* eslint-disable max-params */
/* eslint-disable no-magic-numbers */
/* eslint-disable array-bracket-newline */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-undef */
/* eslint-disable max-lines */

"use strict";

const mod = require('../src/paymentCycle');
const jestPlugin = require('serverless-jest-plugin');
const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const { constants, UsersService, JobsService, CompanyProvidersService, CompaniesService, SettingsService, ExchangeRatesService, LedgerService, permisionConstants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes)
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAndTagsAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const exchangeRatesService = new ExchangeRatesService(process.env.exchangeRatesTableName, constants.projectionExpression.providerAttributes, constants.attributeNames.providerAttributes, settingsService)
const date = new Date(new Date().setHours(0, 0, 0, 0))
const nextDayToRollTo = date.setDate(date.getDate() + 1)
const previouDateToRollTo = date.setDate(date.getDate() - 5)
const settindValidFrom = date.setDate(date.getDate() - 6)
const timeInPreviousMS = date.setDate(date.getDate() - 7)
const ledgerService = new LedgerService(process.env.ledgerTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const testName = 'PAYMENT-CYCLE-STATS';
const companyId = `${testName}-COMPANY-ID-1`;
const companyId2 = `${testName}-COMPANY-ID-2`;
const entityId = `${testName}-ENTITY-ID-1`;
const userId = `${testName}-USER-ID-1`;
const userId2 = `${testName}-USER-ID-2`;

const providerId = `${constants.prefix.provider}${companyId}PROVIDER-ID-1`
const talentId = `${constants.prefix.talent}${providerId}${constants.prefix.talent}TALENT-ID-1`;
const jobId1 = `${constants.prefix.job}${companyId}-JOB-ID-1`;

const job1 = {
    companyId,
    entityId,
    itemId: jobId1,
    userId,
    itemStatus: constants.job.status.completed,
    itemData: {
        talentId,
        jobTitle: `${testName}-JOB-TITLE-1`,
        jobStartDate: '2022-06-28',
    },
};

// eslint-disable-next-line no-shadow
const generateMilestoneItem = (itemId, itemStatus, actualCost, dueDate, paymentStatus, statusDate, billingId) => {
    const paymentDate = paymentStatus === 'PendingFunds'
        ? {}
        : { PendingDate: dueDate };
    return {
        itemId,
        itemStatus,
        itemData: {
            billingId,
            actualCost,
            // eslint-disable-next-line no-extra-parens
            ...(paymentStatus && {
                payment: {
                    ...paymentDate,
                    dueDate,
                    status: paymentStatus,
                    statusHistory: [{
                        status: "PendingFunds",
                        date: statusDate,
                    }]
                }
            }),
        },
        companyId,
        entityId,
        userId,
    }
}

const ms1 = generateMilestoneItem(`ms_${jobId1}_ms1`, constants.job.status.paid, 100, new Date().getTime(), constants.payment.status.paid)
const ms2 = generateMilestoneItem(`ms_${jobId1}_ms2`, constants.job.status.completed, 500, new Date().getTime(), constants.payment.status.pendingFunds)
const ms3 = generateMilestoneItem(`ms_${jobId1}_ms3`, constants.job.status.paid, 100, new Date(timeInPreviousMS).getTime(), constants.payment.status.paid)
const ms4 = generateMilestoneItem(`ms_${jobId1}_ms4`, constants.job.status.paid, 100, new Date(timeInPreviousMS).getTime(), constants.payment.status.paid, new Date(timeInPreviousMS).getTime(), 123)
const ms5 = generateMilestoneItem(`ms_${jobId1}_ms5`, constants.job.status.completed, 100, new Date().getTime(), constants.payment.status.pendingFunds, null, 1111)
const ms6 = generateMilestoneItem(`ms_${jobId1}_ms6`, constants.job.status.completed, 100, new Date('12-02-2021').getTime(), constants.payment.status.paid, null, 1111)

const generateLedgerItem = (itemId, jobId, milestoneId, itemStatus, actualCost, depositData) => ({
    itemId,
    jobId: milestoneId,
    itemStatus,
    itemData: {
        title: milestoneId,
        jobId,
        milestoneId,
        actualCost,
        payment: {
            depositData,
            status: itemStatus
        }
    },
    companyId,
    entityId,
    userId,
})

const ledger1 = generateLedgerItem(100000000, jobId1, `ms_${jobId1}_ms1`, constants.ledgerConstants.status.paid, 300, { depositIds: [1655078400000, 1655078400001], depositAmount: { '1655078400000': 200, '1655078400001': 100 } });
const ledger2 = generateLedgerItem(200000000, jobId1, `ms_${jobId1}_ms12`, constants.ledgerConstants.status.submitted, 300, { depositIds: [1655078400001], depositAmount: { '1655078400001': 200 } });
const ledger3 = generateLedgerItem(300000000, jobId1, `ms_${jobId1}_ms13`, constants.ledgerConstants.status.submitted, 300);

const activePaymentCycleEvent = {
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        isRequestSummary: true,
    }
}

const DepositEvent = {
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        depositId: 1655078400000,
        dataType: 'depositData'
    }
}

const DepositNegativeEvent = {
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        depositId: -1,
        dataType: 'depositData'
    }
}

const summaryEvent = {
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        isRequestSummary: true,
        requestedPaymentCycle: new Date(previouDateToRollTo).getTime()
    }
}

const historicalEvent = {
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        isRequestSummary: true,
        requestedPaymentCycle: new Date('10-01-2022').getTime(),
        previousPaymentCycle: new Date('10-02-2021').getTime()
    }
}

const companySettings = {
    itemId: `${constants.prefix.company}${companyId}`,
    itemData: {
        paymentSchedule: {
            dayOfMonthToRollInto: [new Date(previouDateToRollTo).getDate(), new Date(nextDayToRollTo).getDate()],
            daysToAdvance: 0,
            monthsToAdvance: 0
        },
        paymentScheduleVersions: [
            {
                activeFrom: settindValidFrom,
                paymentSchedule: {
                    dayOfMonthToRollInto: [new Date(previouDateToRollTo).getDate(), new Date(nextDayToRollTo).getDate()],
                    daysToAdvance: 0,
                    monthsToAdvance: 0
                },
            }
        ],
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
};
const company2Settings = {
    itemId: `${constants.prefix.company}${companyId2}`,
    itemData: {
        paymentSchedule: {
            dayOfMonthToRollInto: [new Date(previouDateToRollTo).getDate(), new Date(nextDayToRollTo).getDate()],
            daysToAdvance: 0,
            monthsToAdvance: 0
        },
        paymentScheduleVersions: [
            {
                activeFrom: settindValidFrom,
                paymentSchedule: {
                    dayOfMonthToRollInto: [new Date(previouDateToRollTo).getDate(), new Date(nextDayToRollTo).getDate()],
                    daysToAdvance: 0,
                    monthsToAdvance: 0
                },
            }
        ],
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
              },
              "min": {
                "amount": "1000"
               },
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
};

const userCompanyAdmin = {
    userId,
    entityId: companyId,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        permissionsComponents: { [permisionConstants.permissionsComponentsKeys.funding]: { } }
    }
};

const userCompany2Admin = {
    userId: userId2,
    entityId: companyId2,
    companyId: companyId2,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        permissionsComponents: { [permisionConstants.permissionsComponentsKeys.funding]: { } }
    }
};

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
                        amount: 500,
                        balance: 500,
                        dateTime: 1655078400000,
                        dateTimeString: "2022-06-13T00:00:00.000Z",
                        description: "Deposit",
                        externalId: null
                    },
                    {
                        allFees: 10,
                        amount: 0,
                        balance: 0,
                        depositFeeData: {
                            depositIds: [1655078400000],
                            depositAmount: { 1655078400000: 5 }
                        },
                        dateTime: Date.now(),
                        dateTimeString: "2022-06-13T00:00:00.000Z",
                        description: "Billing - test",
                        externalId: 'billing_1'
                    },
                    {
                        allFees: 5,
                        amount: 0,
                        balance: 0,
                        dateTime: new Date(previouDateToRollTo).getTime(),
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
    createdBy: userId,
    modifiedBy: userId,
}

const company2Balance = {
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
                    }
                ]
            },
        ]
    },
    itemStatus: constants.user.status.active,
    createdBy: userId2,
    modifiedBy: userId2,
}

const negativeBalance = {
    ...companyBalance,
    itemPrivateData: {
        balances: [
            {
                currency: 'USD',
                rows: [
                    {
                        amount: -100,
                        balance: -100,
                        dateTime: 1655078400000,
                        dateTimeString: "2022-06-13T00:00:00.000Z",
                        description: "Deposit",
                        externalId: null
                    },
                ]
            },
        ]
    }
};

const companyProvider = {
    itemId: providerId,
    companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        name: 'test'
    },
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

const rate = {
    itemId: 'USD',
    itemData: {
        ILS: 3.4444,
        EUR: 0.8888,
    },
    createdAt: Date.now(),
};

describe('paymentCycleStats', () => {
    beforeEach(async () => {
        await usersService.create(userCompanyAdmin);
        await exchangeRatesService.create(rate);
        await companiesService.create(companyBalance);
        await settingsService.create(companySettings);
        await companyProvidersService.create(companyProvider);
        await companyProvidersService.create(talentInCompany);
        await jobsService.create(job1);
        await ledgerService.create(ledger1);
        await ledgerService.create(ledger2);
        await ledgerService.create(ledger3);
        await usersService.create(userCompany2Admin);
        await companiesService.create(company2Balance);
        await settingsService.create(company2Settings);
    })

    /**
     *      balance: 500
     *      Total: 100
     *      Missing: 0
     *      Available: 400
     *      Allocated: 100
     *      notAllocated: 0    
     */
    it('fully covered cycle, expect 200, data', async () => {
        await jobsService.create(ms1);
        const response = await wrapped.run(activePaymentCycleEvent);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.summary.allocated).toBe(110)
        expect(result.summary.missing).toBe(0)
        expect(result.summary.available).toBe(400)
        expect(result.summary.notAllocated).toBe(0);
        expect(result.summary.estimatedTotalPayment).toBe(110)
        expect(result.paymentCycles.length).toBe(2);

    });

    /*
    *      Negative balance
    *      balance: -100
    *      Total: 100
    *      Missing: 200
    *      Available: 0
    *      Allocated: 100
    **/
    it('Negative balance, expect 200, data', async () => {
        await jobsService.create(ms1)
        await jobsService.create(ms5)
        await companiesService.create(negativeBalance);
        const response = await wrapped.run(activePaymentCycleEvent);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.rows.length).toBe(2)
        expect(result.summary.estimatedTotalPayment).toBe(200);
        expect(result.summary.missing).toBe(200);
        expect(result.summary.allocated).toBe(100);
        expect(result.summary.notAllocated).toBe(100);
        expect(result.summary.available).toBe(-200);
        expect(result.calculator.stokeFees).toBe(3.5)
        expect(result.calculator.transactionAndExchangeFees).toBe(0)
        expect(result.calculator.notAllocated).toBe(100)
        expect(result.calculator.available).toBe(-200)
        await companiesService.create(companyBalance);
    });


    /**
     *      not clear how to display ms2 (it is in pending funds wheres only 100 out of 400 are missing)
     *      balance: 500
     *      total previous cycle: 100
     *      Total coming cycle: 100
     *      Missing: 0
     *      Available: 300
     *      Allocated: 100
     */
    it('Second cycle after billing, expect 200, data', async () => {
        await jobsService.create(ms1)
        await jobsService.create(ms3);
        const response = await wrapped.run(activePaymentCycleEvent);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.summary.allocated).toBe(110)
        expect(result.summary.missing).toBe(0)
        expect(result.summary.available).toBe(300)
        expect(result.summary.estimatedTotalPayment).toBe(110)
        expect(result.summary.notAllocated).toBe(0);

    });


    /**
     *      not clear how to display ms2 (it is in pending funds wheres only 100 out of 400 are missing)
     *      balance: 500
     *      Total: 600
     *      Missing: 200
     *      Available: 300
     *      Allocated: 100
     */
    it('patrially covered milestone, expect 200, data', async () => {
        await jobsService.create(ms1)
        await jobsService.create(ms2);
        await jobsService.create(ms3);
        const response = await wrapped.run(activePaymentCycleEvent);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.summary.allocated).toBe(110)
        expect(result.summary.missing).toBe(200)
        expect(result.summary.available).toBe(300)
        expect(result.summary.notAllocated).toBe(500);
        expect(result.summary.estimatedTotalPayment).toBe(610)

    });

    it('previous payment cycle, expect 200, data', async () => {
        await jobsService.create(ms1)
        await jobsService.create(ms2);
        await jobsService.create(ms3);
        const response = await wrapped.run(summaryEvent);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.rows.length).toBe(2);
        expect(result.summary.estimatedTotalPayment).toBe(105);
        expect(result.summary.allocated).toBe(105);
    });

    it('billed paymentCycleStats, expect 200, data', async () => {
        await jobsService.create(ms1)
        await jobsService.create(ms2);
        await jobsService.create(ms3);
        await jobsService.create(ms4);
        const response = await wrapped.run(summaryEvent);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.rows.length).toBe(3)
        expect(result.summary.estimatedTotalPayment).toBe(205);
        expect(result.summary.allocated).toBe(205);
        expect(result.summary.notAllocated).toBe(0);
    });

    it('Deposit data, expect 200, data', async () => {
        await jobsService.create(ms1);
        await jobsService.create(ms3);
        const response = await wrapped.run(DepositEvent);
        expect(response.statusCode).toBe(200);
        let result = JSON.parse(response.body);
        expect(result.rows.length).toBe(3);
        expect(result.rows[0].depositAmount).toBe(200);
        expect(result.rows[0].paymentStatus).toBe('Paid');
        expect(result.rows[0].partialPaymentInfo).toMatchObject([ 1655078400001 ]);
        expect(result.rows[1].depositAmount).toBe(5);
        expect(result.rows[1].paymentStatus).toBe('Paid');
        expect(result.rows[1].title).toBe('test 2');
        expect(result.rows[1].partialPaymentInfo).toBeNull();
        expect(result.rows[2].paymentStatus).toBe('Paid');
        expect(result.rows[2].depositAmount).toBe(5);
        expect(result.rows[2].title).toBe('test');
        expect(result.rows[2].partialPaymentInfo).toMatchObject([ 'negative' ]);
        expect(result.summary).toMatchObject({ allocated: 210, notAllocated: 290, available: 300, missing: 0, estimatedTotalPayment: 500 });
    });
    
    it('Deposit negative data, expect 200, data', async () => {
        await jobsService.create(ms1);
        await jobsService.create(ms3);
        const response = await wrapped.run(DepositNegativeEvent);
        expect(response.statusCode).toBe(200);
        let result = JSON.parse(response.body);
        expect(result.rows.length).toBe(3);
        expect(result.rows[0].depositAmount).toBe(100);
        expect(result.rows[0].paymentStatus).toBe('Submitted');
        expect(result.rows[0].partialPaymentInfo).toMatchObject([ 1655078400001 ]);
        expect(result.rows[1].depositAmount).toBe(300);
        expect(result.rows[1].paymentStatus).toBe('Submitted');
        expect(result.rows[1].title).toBe('ms_job_PAYMENT-CYCLE-STATS-COMPANY-ID-1-JOB-ID-1_ms13');
        expect(result.rows[1].partialPaymentInfo).toBeNull();
        expect(result.rows[2].paymentStatus).toBe('Paid');
        expect(result.rows[2].depositAmount).toBe(5);
        expect(result.rows[2].title).toBe('test');
        expect(result.rows[2].partialPaymentInfo).toMatchObject([ 1655078400000 ]);
        expect(result.summary).toMatchObject({ allocated: 405, notAllocated: 0, available: 300, missing: 0, estimatedTotalPayment: 0 });
    });

    it('Historical payment cycle, expect 200, data', async () => {
        await jobsService.create(ms1)
        await jobsService.create(ms6);
        const response = await wrapped.run(historicalEvent);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);

        expect(result.rows.length).toBe(1)
        expect(result.rows[0].itemId).toBe(ms6.itemId)
      

    });

    it('Minimal fee when empty cycle', async () => {
        const event = {
            requestContext: {
                identity: {
                    cognitoIdentityId: userId2
                }
            },
            queryStringParameters: {
                companyId: companyId2,
                isRequestSummary: true,
            }
        }
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.calculator.stokeFees).toBe(1000);
    });

    afterEach(async () => {
        await usersService.delete(userCompanyAdmin.userId, companyId);
        await companiesService.delete(companyBalance.itemId);
        await settingsService.delete(companySettings.itemId);
        await companyProvidersService.delete(companyId, companyProvider.itemId);
        await companyProvidersService.delete(companyId, talentInCompany.itemId);
        await jobsService.delete(entityId, job1.itemId);

        await jobsService.delete(entityId, ms1.itemId);
        await jobsService.delete(entityId, ms2.itemId);
        await jobsService.delete(entityId, ms3.itemId);
        await jobsService.delete(entityId, ms4.itemId);
        await jobsService.delete(entityId, ms5.itemId);
        await jobsService.delete(entityId, ms6.itemId);
        await ledgerService.delete(entityId, ledger1.itemId);
        await ledgerService.delete(entityId, ledger2.itemId);
        await ledgerService.delete(entityId, ledger3.itemId);

        await usersService.delete(userCompany2Admin.userId, companyId2);
        await companiesService.delete(company2Balance.itemId);
        await settingsService.delete(company2Settings.itemId);
    });
})
