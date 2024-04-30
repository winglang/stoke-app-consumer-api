/* eslint-disable max-lines */
/* eslint-disable no-magic-numbers */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-undef */
/* eslint-disable array-element-newline */
/* eslint-disable array-bracket-spacing */

'use strict';

const mod = require('../src/job/jobListAttrsPagination');
const jestPlugin = require('serverless-jest-plugin');
const handler = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'handler' });
const { UsersService, JobsService, constants, CompanyProvidersService } = require('stoke-app-common-api');

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);


const createId = (prefix, item, num) => `${prefix}JEST-ATTRS-PAGINATION${item}-ID-${num}`
const companyId1 = createId('', 'com', 1);
const entityId1 = createId('', 'entity', 1);
const entityId2 = createId('', 'entity', 2);
const userId1 = createId('', 'user', 1);
const userId2 = createId('', 'user', 2);
const jobId1 = createId('job_', 'job', 1);
const jobId2 = createId('job_', 'job', 2);
const jobId3 = createId('job_', 'job', 3);
const jobId4 = createId('job_', 'job', 4);
const ms1 = createId(`ms_${jobId1}_`, 'ms', 1)
const ms2 = createId(`ms_${jobId2}_`, 'ms', 2)
const ms3 = createId(`ms_${jobId3}_`, 'ms', 3)
const ms4 = createId(`ms_${jobId4}_`, 'ms', 4)
const providerId1 = createId('provider_', 'provider', 1);
const providerId2 = createId('provider_', 'provider', 2);
const talentId1 = `talent_${providerId1}talent_1`;
const talentId2 = `talent_${providerId1}talent_2`;
const talentId3 = `talent_${providerId2}talent_3`;

const event = (userId, companyId, filterKey, type, queryType, pageSize = 1, startRow = 0, sortModel = [], quickFilterText = '', activeFilters = {}, groupBy = [], groupKeys= []) => ({
    body: JSON.stringify({
        paginationParams: {
            sortModel,
            groupKeys,
            quickFilterText,
            activeFilters,
            page: { pageSize, startRow },
            groupBy
        },
    }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId,
        },
    },
    queryStringParameters: {
        companyId,
        type,
        filterKey,
        queryType,
    },
});

const companyProvider1 = {
    itemId: providerId1,
    companyId: companyId1,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.user.status.active,
    itemData: {
        providerMame: 'provider',
    },
};

const companyProvider2 = {
    itemId: providerId2,
    companyId: companyId1,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.user.status.active,
    itemData: {
        providerMame: 'provider',
    },
};


const companyProviderTalent1 = {
    itemId: talentId1,
    companyId: companyId1,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.user.status.active,
    itemData: {
        name: 'talent',
    },
};

const companyProviderTalent2 = {
    itemId: talentId2,
    companyId: companyId1,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.user.status.active,
    itemData: {
        name: 'talent',
    },
};

const companyProviderTalent3 = {
    itemId: talentId3,
    companyId: companyId1,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.user.status.active,
    itemData: {
        name: 'talent',
    },
};

const userComapnyAdmin = {
    userId: userId1,
    entityId: companyId1,
    companyId: companyId1,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
    }
};

const job1 = {
    companyId: companyId1,
    entityId: entityId1,
    itemId: jobId1,
    userId: userId1,
    itemStatus: constants.job.status.active,
    itemData: {
        talentId: talentId1,
        currency: 'USD',
        jobTitle: "New external approver job",
    },
    viewData: {
        milestonesData: {
            plannedBudget: 100,
            nonArchivedMilestones: {
                [ms1]: {
                    itemStatus: constants.job.status.pendingApproval
                }
            }
        },

    },
    tags: { a: 'b' }
};

const job2 = {
    companyId: companyId1,
    entityId: entityId1,
    itemId: jobId2,
    userId: userId1,
    itemStatus: constants.job.status.active,
    itemData: {
        talentId: talentId2,
        currency: 'ILS',
        jobTitle: "Old external approver job",
    },
    viewData: {
        milestonesData: {
            nonArchivedMilestones: {
                [ms2]: {
                    itemStatus: constants.job.status.pendingApproval
                }
            }
        },

    }
};

const job3 = {
    companyId: companyId1,
    entityId: entityId2,
    itemId: jobId3,
    userId: userId1,
    itemStatus: constants.job.status.active,
    itemData: {
        talentId: talentId3,
        currency: 'EUR',
        jobTitle: "external approver job",
    },
    viewData: {
        milestonesData: {
            nonArchivedMilestones: {
                [ms3]: {
                    itemStatus: constants.job.status.pendingApproval
                }
            }
        },

    },
    tags: { c: 'qaaa' }
};

const job4 = {
    companyId: companyId1,
    entityId: entityId2,
    itemId: jobId4,
    userId: userId1,
    itemStatus: constants.job.status.completed,
    itemData: {
        jobTitle: "external approver job",
    },
    viewData: {
        milestonesData: {
            nonArchivedMilestones: {
                [ms4]: {
                    itemStatus: constants.job.status.pendingApproval
                }
            }
        },

    },
    tags: { d: 'qaaa' }
};

const milestones1 = {
    companyId: companyId1,
    entityId: entityId1,
    itemId: ms1,
    userId: userId1,
    itemStatus: constants.job.status.pendingApproval,
    itemData: {
        costLocal: 10,
        providerData: {
            taxInfo: {
                total: 20,
                subTotal: 10,
                paymentCurrency: 'ILS'
            }
        },
        payment: {
            billingAmount: 10,
            feeData: {
                transactionFee: { cost: 1 },
                accelerateFee: { cost: 1 },
                fee: { cost: 1 }
            }
        },
        title: "1external approver job",
    }
};


const milestones2 = {
    companyId: companyId1,
    entityId: entityId1,
    itemId: ms2,
    userId: userId1,
    itemStatus: constants.job.status.pendingApproval,
    itemData: {
        costLocal: 10,
        requestedData: {
            hourlyValue: 2,
        },
        providerData: {
            taxInfo: {
                total: 20,
                subTotal: 10,
                paymentCurrency: 'ILS'
            }
        },
        payment: {
            billingAmount: 10,
            feeData: {
                transactionFee: { cost: 1 },
                accelerateFee: { cost: 1 },
                fee: { cost: 1 }
            }
        },
        title: "2external approver job",
    }
};

const milestones3 = {
    companyId: companyId1,
    entityId: entityId2,
    itemId: ms3,
    userId: userId1,
    itemStatus: constants.job.status.completed,
    itemData: {
        costLocal: 10,
        requestedData: {
            hourlyValue: 2,
        },
        providerData: {
            taxInfo: {
                total: 20,
                subTotal: 10,
                paymentCurrency: 'ILS'
            }
        },
        payment: {
            billingAmount: 10,
            feeData: {
                transactionFee: { cost: 1 },
                accelerateFee: { cost: 1 },
                fee: { cost: 1 }
            }
        },
        title: "3external approver job",
    }
};

const milestones4 = {
    companyId: companyId1,
    entityId: entityId2,
    itemId: ms4,
    userId: userId1,
    itemStatus: constants.job.status.requested,
    itemData: {
        title: "4external approver job",
    }
};



describe('listJobs', () => {
    beforeAll(async () => {
        await jobsService.create(job1);
        await jobsService.create(job2);
        await jobsService.create(job3);
        await jobsService.create(job4);
        await jobsService.create(milestones1);
        await jobsService.create(milestones2);
        await jobsService.create(milestones3);
        await jobsService.create(milestones4);
        await usersService.create(userComapnyAdmin);
        await companyProvidersService.create(companyProvider1);
        await companyProvidersService.create(companyProvider2);
        await companyProvidersService.create(companyProviderTalent1);
        await companyProvidersService.create(companyProviderTalent2);
        await companyProvidersService.create(companyProviderTalent3);
    });

    it('listJobs jobs page expect 200, data page 1', async () => {
        const response = await handler.run(event(userId1, companyId1, 'active', 'jobsPage', 'rowData'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].jobId).toBe(jobId1);
        expect(data.total.allDataCount).toBe(3);
    });
    it('listJobs jobs page expect 200, verify row data', async () => {
        const response = await handler.run(event(userId1, companyId1, 'active', 'jobsPage', 'rowData'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].plannedBudget).toBe(100);
    });

    it('listJobs jobs page expect 200, data page 2', async () => {
        const response = await handler.run(event(userId1, companyId1, 'active', 'jobsPage', 'rowData', 1, 1));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].jobId).toBe(jobId2);
        expect(data.total.allDataCount).toBe(3);
    });

    it('listJobs jobs page expect 200, data page 1 sort by title', async () => {
        const response = await handler.run(event(userId1, companyId1, 'active', 'jobsPage', 'rowData', 1, 0, [{ sort: "desc", colId: "jobId_1" }]));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].jobId).toBe(jobId3);
        expect(data.total.allDataCount).toBe(3);
    });

    it('listJobs jobs page expect 200, data page 1 filter by text', async () => {
        const response = await handler.run(event(userId1, companyId1, 'active', 'jobsPage', 'rowData', 1, 0, [], 'new'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].jobId).toBe(jobId1);
        expect(data.total.allDataCount).toBe(1);
    });

    it('listJobs jobs page expect 200, data page 1 filter by workspace', async () => {
        const response = await handler.run(event(userId1, companyId1, 'active', 'jobsPage', 'rowData', 1, 0, [], '', { workspaces: [entityId2] }));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].jobId).toBe(jobId3);
        expect(data.total.allDataCount).toBe(1);
    });

    it('listJobs jobs page expect 200, data page 1 filter by workspace  with more then 10', async () => {
        const response = await handler.run(
            event(userId1, companyId1, 'active', 'jobsPage', 'rowData', 1, 0, [], '', {
                workspaces: [
                    entityId2,
                    'entityId21',
                    'entityId22',
                    'entityId23',
                    'entityId24',
                    'entityId25',
                    'entityId26',
                    'entityId27',
                    'entityId28',
                    'entityId29',
                    'entityId220',
                    'entityId211',
                ],
            }),
        );
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].jobId).toBe(jobId3);
        expect(data.total.allDataCount).toBe(1);
    });

    it('listJobs payment page expect 200, data page 1', async () => {
        const response = await handler.run(event(userId1, companyId1, null, 'paymentsPage', 'rowData'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].jobId).toBe(jobId1);
        expect(data.rows[0].itemId).toBe(ms1);
        expect(data.total.allDataCount).toBe(3);
        expect(data.summary).toMatchObject({
            stokeFee: 3,
            transactionFee: 6,
            localCurrencyTotalUSD: 0,
            localCurrencyTotalILS: 60,
            localCurrencyTotalEUR: 0,
            localCurrencyTotalGBP: 0,
            localCurrencyTotalNZD: 0,
            localCurrencyTotalINR: 0,
            localCurrencyTotalCAD: 0,
            localCurrencyTotalAUD: 0,
            localCurrencyTotalSGD: 0,
            localCurrencySubTotalUSD: 0,
            localCurrencySubTotalILS: 30,
            localCurrencySubTotalEUR: 0,
            localCurrencySubTotalGBP: 0,
            localCurrencySubTotalNZD: 0,
            localCurrencySubTotalINR: 0,
            localCurrencySubTotalCAD: 0,
            localCurrencySubTotalAUD: 0,
            localCurrencySubTotalSGD: 0,
            requestedHours: 4,
            plannedLocalUSD: 10,
            plannedLocalILS: 10,
            plannedLocalEUR: 10,
            plannedLocalGBP: 0,
            plannedLocalNZD: 0,
            plannedLocalINR: 0,
            plannedLocalCAD: 0,
            plannedLocalAUD: 0,
            plannedLocalSGD: 0,
            approvedUSD: 0,
            approvedILS: 20,
            approvedEUR: 0,
            approvedGBP: 0,
            approvedNZD: 0,
            approvedINR: 0,
            approvedCAD: 0,
            approvedAUD: 0,
            approvedSGD: 0,
            plannedHours: null,
            amount: 30,
            milestoneId: 3,
            talentId: 3,
            hiringManagerId: 1,
            jobId: 3,
            itemId: 3
        });
    });

    it('listJobs payment page with groupd expect 200, data page 1', async () => {
        const response = await handler.run(event(userId1, companyId1, null, 'paymentsPage', 'rowData', 3, 0, [], '', {}, ['providerId']));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(2);
        expect(data.rows[0].jobId).toBe(2);
        expect(data.rows[0].providerId).toBe(providerId1);
        expect(data.rows[1].providerId).toBe(providerId2);
        expect(data.total.allDataCount).toBe(2);
        expect(data.summary).toMatchObject({
            stokeFee: 3,
            transactionFee: 6,
            localCurrencyTotalUSD: 0,
            localCurrencyTotalILS: 60,
            localCurrencyTotalEUR: 0,
            localCurrencyTotalGBP: 0,
            localCurrencyTotalNZD: 0,
            localCurrencyTotalINR: 0,
            localCurrencyTotalCAD: 0,
            localCurrencyTotalAUD: 0,
            localCurrencyTotalSGD: 0,
            localCurrencySubTotalUSD: 0,
            localCurrencySubTotalILS: 30,
            localCurrencySubTotalEUR: 0,
            localCurrencySubTotalGBP: 0,
            localCurrencySubTotalNZD: 0,
            localCurrencySubTotalINR: 0,
            localCurrencySubTotalCAD: 0,
            localCurrencySubTotalAUD: 0,
            localCurrencySubTotalSGD: 0,
            requestedHours: 4,
            plannedLocalUSD: 10,
            plannedLocalILS: 10,
            plannedLocalEUR: 10,
            plannedLocalGBP: 0,
            plannedLocalNZD: 0,
            plannedLocalINR: 0,
            plannedLocalCAD: 0,
            plannedLocalAUD: 0,
            plannedLocalSGD: 0,
            approvedUSD: 0,
            approvedILS: 20,
            approvedEUR: 0,
            approvedGBP: 0,
            approvedNZD: 0,
            approvedINR: 0,
            approvedCAD: 0,
            approvedAUD: 0,
            approvedSGD: 0,
            plannedHours: null,
            amount: 30,
            milestoneId: 3,
            talentId: 3,
            hiringManagerId: 1,
            jobId: 3,
            itemId: 3
        });
    });

    it('listJobs payment page with groupd expect 200, data page 1', async () => {
        const response = await handler.run(event(userId1, companyId1, null, 'paymentsPage', 'rowData', 3, 0, [], '', {}, [], [{ key: 'providerId', value: providerId1 }]));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(2);
        expect(data.rows[0].jobId).toBe(jobId1);
        expect(data.rows[0].providerId).toBe(providerId1);
        expect(data.rows[1].providerId).toBe(providerId1);
        expect(data.total.allDataCount).toBe(2);
    });


    it('listJobs payment page expect 200, data page 2', async () => {
        const response = await handler.run(event(userId1, companyId1, null, 'paymentsPage', 'rowData', 1, 1));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].jobId).toBe(jobId2);
        expect(data.rows[0].itemId).toBe(ms2);
        expect(data.total.allDataCount).toBe(3);
    });

    it('listJobs payment page expect 200, data page 1 sort by title', async () => {
        const response = await handler.run(event(userId1, companyId1, null, 'paymentsPage', 'rowData', 1, 0, [{ sort: "desc", colId: "milestoneTitle" }]));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].jobId).toBe(jobId3);
        expect(data.rows[0].itemId).toBe(ms3);
        expect(data.total.allDataCount).toBe(3);
    });

    it('listJobs payment page expect 200, data page 1 filter by text', async () => {
        const response = await handler.run(event(userId1, companyId1, null, 'paymentsPage', 'rowData', 1, 0, [], '1'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].jobId).toBe(jobId1);
        expect(data.rows[0].itemId).toBe(ms1);
        expect(data.total.allDataCount).toBe(1);
    });

    it('listJobs payment page expect 200, data page 1 filter by workspace', async () => {
        const response = await handler.run(event(userId1, companyId1, null, 'paymentsPage', 'rowData', 1, 0, [], '', { workspaces: [entityId2] }));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].jobId).toBe(jobId3);
        expect(data.rows[0].itemId).toBe(ms3);
        expect(data.total.allDataCount).toBe(1);
    });

    it('listJobs payment page expect 200, data page 1 filter by workspace with more then 10', async () => {
        const response = await handler.run(
            event(userId1, companyId1, null, 'paymentsPage', 'rowData', 1, 0, [], '', {
                workspaces: [
                    entityId2,
                    'entityId21',
                    'entityId22',
                    'entityId23',
                    'entityId24',
                    'entityId25',
                    'entityId26',
                    'entityId27',
                    'entityId28',
                    'entityId29',
                    'entityId220',
                    'entityId211',
                ],
            }),
        );
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.rows.length).toBe(1);
        expect(data.rows[0].jobId).toBe(jobId3);
        expect(data.rows[0].itemId).toBe(ms3);
        expect(data.total.allDataCount).toBe(1);
    });

    it('listJobs jobs page expect 200, filter meta data', async () => {
        const response = await handler.run(event(userId1, companyId1, 'active', 'jobsPage', 'filterData'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.tags).toMatchObject([{ tags: job1.tags }, { tags: job3.tags }]);
        expect(data.tags).toMatchObject([{ tags: job1.tags }, { tags: job3.tags }]);
    });

    it('listJobs jobs page expect 200, filter meta data for all tab', async () => {
        const response = await handler.run(event(userId1, companyId1, 'all', 'jobsPage', 'filterData'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.tags).toMatchObject([{ tags: job1.tags }, { tags: job3.tags }, { tags: job4.tags }]);
    });
    
    it('listJobs jobs page expect 403, filterData', async () => {
        const response = await handler.run(event(userId2, companyId1, 'all', 'jobsPage', 'filterData'));
        expect(response.statusCode).toBe(403);
    });

    it('listJobs jobs page expect 403, rowData', async () => {
        const response = await handler.run(event(userId2, companyId1, 'all', 'jobsPage', 'rowData'));
        expect(response.statusCode).toBe(403);
    });

    afterAll(async () => {
        result = await jobsService.listByCompanyId(process.env.gsiItemsByCompanyIdAndItemIdIndexName, companyId)
        for (const item of result) {
            await jobsService.delete(item.entityId, item.itemId)
        }
        await usersService.delete(userComapnyAdmin.userId, userComapnyAdmin.entityId);
        await companyProvidersService.delete(companyProvider1.companyId, companyProvider1.itemId);
        await companyProvidersService.delete(companyProvider2.companyId, companyProvider2.itemId);
        await companyProvidersService.delete(companyProviderTalent1.companyId, companyProviderTalent1.itemId);
        await companyProvidersService.delete(companyProviderTalent2.companyId, companyProviderTalent2.itemId);
        await companyProvidersService.delete(companyProviderTalent3.companyId, companyProviderTalent3.itemId);
    });
});