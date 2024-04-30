/* eslint-disable max-lines */
/* eslint-disable array-bracket-spacing */
/* eslint-disable function-paren-newline */
/* eslint-disable max-lines-per-function */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */
/* eslint-disable arrow-body-style */
/* eslint-disable max-params */

'use strict';

const mod = require('../src/job/jobList');
const jestPlugin = require('serverless-jest-plugin');
const handler = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'handler' });

const _ = require('lodash');
const { UsersService, JobsService, TalentsService, CompanyProvidersService, POService, constants, teamsService } = require('stoke-app-common-api');

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const talentsService = new TalentsService(process.env.talentsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const poService = new POService(process.env.budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);

const users = require('stoke-app-common-api/__tests__/utils/users');

const companyId1 = 'JEST-TEST-LIST-JOBS-COMPANY-ID-1';
const companyId3 = 'JEST-TEST-LIST-JOBS-COMPANY-ID-3';
const companyId4 = 'JEST-TEST-LIST-JOBS-COMPANY-ID-4';
const entityId1 = 'JEST-TEST-LIST-JOBS-ENT-ID-1';
const entityId2 = 'JEST-TEST-LIST-JOBS-ENT-ID-2';
const entityId4 = 'JEST-TEST-LIST-JOBS-ENT-ID-4';
const userId1 = 'JEST-TEST-LIST-JOBS-USER-ID-1';
const userId2 = 'JEST-TEST-LIST-JOBS-USER-ID-2';
const userId3 = 'JEST-TEST-LIST-JOBS-USER-ID-3';
const poId1 = `${constants.prefix.po}JEST-TEST-LIST-JOBS-PO-ID`;

const jobItem = {
    companyId: companyId1,
    entityId: entityId1,
    itemId: 'job_JEST-TEST-LIST-JOBS-JOB-ID-1',
    userId: userId1,
    itemStatus: constants.job.status.active
};

const jobItem2 = {
    companyId: companyId1,
    entityId: entityId1,
    itemId: 'job_JEST-TEST-LIST-JOBS-JOB-ID-2',
    userId: userId2,
    itemStatus: constants.job.status.pendingApproval
};

const jobItem3 = {
    companyId: companyId1,
    entityId: entityId2,
    itemId: 'job_JEST-TEST-LIST-JOBS-JOB-ID-3',
    userId: userId2,
    itemStatus: constants.job.status.pendingApproval
};


const jobItemWithTalentId = {
    companyId: companyId1,
    entityId: entityId2,
    itemStatus: constants.job.status.pending,
    itemId: 'job_JEST-TEST-LIST-JOBS-JOB-ID-5',
    userId: userId3,
    itemData: {
        talentId: "talent_provider_DOCUSIGNfb5c3e50-4906-11eb-b3bd-cf229eada5batalent_c434e920-4908-11eb-ab67-07d7e1e79e08",
        bids: {
            values: [
                "JEST_TEST_LIST_JOBS_TALENT_ID_17",
                "job_JEST-TEST-LIST-JOBS-JOB-ID-5_JEST_TEST_LIST_JOBS_TALENT_ID_2"
            ]
        }
    }
};

const talent5 = {
    itemId: 'talent_provider_DOCUSIGNfb5c3e50-4906-11eb-b3bd-cf229eada5batalent_c434e920-4908-11eb-ab67-07d7e1e79e08',
    itemData: {
        name: 'TALENT_5'
    }
}

const companyProvider5 = {
    companyId: companyId1,
    itemId: 'provider_DOCUSIGNfb5c3e50-4906-11eb-b3bd-cf229eada5ba',
    itemData: {
        providerName: 'COMPANY_PROVIDER_5'
    }
};

const talentFromBid = {
    itemId: 'JEST_TEST_LIST_JOBS_TALENT_ID_17',
    entityId: entityId2,
    itemData: {
        name: 'TALENT_17'
    }
}

const talentFromBid2 = {
    itemId: 'JEST_TEST_LIST_JOBS_TALENT_ID_2',
    entityId: entityId2,
    itemData: {
        name: 'TALENT_2'
    }
}

const jobItemMissingPrefix = {
    companyId: companyId3,
    entityId: entityId1,
    itemId: 'JEST-TEST-LIST-JOBS-JOB-ID-4',
    userId: userId2
};

const event = (userId, entityId, companyId, prefix, itemStatus, isFetchApprovers) => {
    return {
        body: "{}",
        requestContext: {
            identity: {
                cognitoIdentityId: userId
            }
        },
        queryStringParameters: {
            companyId,
            entityId,
            prefix,
            isFetchApprovers: isFetchApprovers,
        },
        multiValueQueryStringParameters: {
            itemStatus: itemStatus ? [itemStatus] : null,
        },
    };
};

const jobForMilestones = {
    entityId: "job_GET-MILESTONES-JEST-TEST-ENT-ID-1",
    itemId: "job_GET-MILESTONES-JEST-TEST-JOB-ID-1",
    userId: "job_GET-MILESTONES-JEST-TEST-USER-ID-1",
    companyId: "job_GET-MILESTONES-JEST-TEST-COMP-ID-1",
    itemData: {}
};

const userForMilestone = {
    userId: jobForMilestones.userId,
    entityId: jobForMilestones.entityId,
    companyId: jobForMilestones.companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
    }
};

const milestone = {
    entityId: jobForMilestones.entityId,
    itemId: "ms_job_GET-MILESTONES-JEST-TEST-JOB-ID-1_job_GET-MILESTONES-JEST-TEST-MLSTN-ID-1",
    userId: jobForMilestones.userId,
    companyId: jobForMilestones.companyId,
    itemData: {
        jobId: "job_GET-MILESTONES-JEST-TEST-JOB-ID-1",
        cost: 100,
        actualCost: 200,
    },
    poItemId: poId1,
};

const milestone2 = {
    entityId: jobForMilestones.entityId,
    itemId: "ms_job_GET-MILESTONES-JEST-TEST-JOB-ID-1_job_GET-MILESTONES-JEST-TEST-MLSTN-ID-2",
    userId: jobForMilestones.userId,
    companyId: jobForMilestones.companyId,
    itemData: {
        jobId: "job_GET-MILESTONES-JEST-TEST-JOB-ID-1",
        cost: 100,
    },
    poItemId: poId1,
};

const po = {
    itemId: poId1,
    companyId: jobForMilestones.companyId,
    createdBy: userId1,
    poScope: {
        scopeIds: [entityId1],
        scopeType: constants.poScopeTypes.departments,
        poTypes: [constants.poTypes.feesAndAdjustments],
      },
    amount: 0,
    validFrom: 2,
    validTo: 200,
    poNumber: 'test po number addition',
  }

const listMilestonesEvent = {
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: jobForMilestones.userId
        }
    },
    queryStringParameters: {
        entityId: jobForMilestones.entityId,
        jobId: jobForMilestones.itemId
    }
};

const listJobWithTalentDataEvent = {
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: userId3
        }
    },
    queryStringParameters: {
        entityId: entityId2,
        isFetchTalentData: "true"
    }
};

const listJobWithBidsDataEvent = {
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: userId3
        }
    },
    queryStringParameters: {
        entityId: entityId2,
        isFetchBidsData: "true"
    }
};

const listJobWithMilestonesEvent = {
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: jobForMilestones.userId
        }
    },
    queryStringParameters: {
        entityId: jobForMilestones.entityId
    }
};

const listOnlyMilestonesEvent = {
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: jobForMilestones.userId
        }
    },
    queryStringParameters: {
        entityId: jobForMilestones.entityId,
        prefix: constants.prefix.milestone
    }
};

const listOnlyMilestonesAndAppendTheirJobsEvent = {
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: jobForMilestones.userId
        }
    },
    queryStringParameters: {
        entityId: jobForMilestones.entityId,
        prefix: constants.prefix.milestone,
        isAppendJobs: true
    }
};

const listCalculateJobsTotalBudgetEvent = {
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: jobForMilestones.userId
        }
    },
    queryStringParameters: {
        entityId: jobForMilestones.entityId,
        prefix: constants.prefix.milestone,
        isAppendJobs: true,
        isCalculateTotalBudget: true
    }
};

const jobTeamEnglishUser = {
    itemId: 'job_team_english_user',
    entityId: entityId4,
    companyId: companyId4,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 100,
    },
    userId: 'englishUser',
    createdBy: 'englishUser',
};
teamsService.set(jobTeamEnglishUser, ['English']);

const msTeamEnglishUser = {
    itemId: `ms_${jobTeamEnglishUser.itemId}_111`,
    entityId: entityId4,
    companyId: companyId4,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 100,
        jobId: jobTeamEnglishUser.itemId,
    },
    userId: 'englishUser',
    createdBy: 'englishUser',
}

const jobTeamEnglishAdmin = {
    itemId: 'job_team_english_admin',
    entityId: entityId4,
    companyId: companyId4,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 100,
    },
    userId: 'entityAdmin',
    createdBy: 'entityAdmin',
};

teamsService.set(jobTeamEnglishAdmin, ['English']);

const msTeamEnglishAdmin = {
    itemId: `ms_${jobTeamEnglishAdmin.itemId}_222`,
    entityId: entityId4,
    companyId: companyId4,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 100,
        jobId: jobTeamEnglishAdmin.itemId,
    },
    userId: 'entityAdmin',
    createdBy: 'entityAdmin',
}

const jobTeamHebrew = {
    itemId: 'job_team_hebrew',
    entityId: entityId4,
    companyId: companyId4,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 200,
    },
    userId: 'hebrewUser',
    createdBy: 'hebrewUser',
};
teamsService.set(jobTeamHebrew, ['Hebrew']);

const msTeamHebrew = {
    itemId: `ms_${jobTeamHebrew.itemId}_333`,
    entityId: entityId4,
    companyId: companyId4,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 200,
        jobId: jobTeamHebrew.itemId,
    },
    userId: 'hebrewUser',
    createdBy: 'hebrewUser',
};

const companyIdApproval = 'company-ID-approvalOptions';
const entityIdApproval = 'entity-ID-approvalOptions';
const userIdApproval = 'user-ID-approvalOptions-not-admin';
const entityAdminIdApproval = 'user-ID-approvalOptions-entity-admin';
const companyAdminIdApproval = 'user-ID-approvalOptions-company-admin';

const approversChain = {
    "1": {
        level: 1,
        type: "anyone",
    },
    "2": {
        level: 2,
        type: "departmentAdmin"
    },
    "3": {
        level: 3,
        type: "companyAdmin"
    }
}

const approvalUserItem = {
    userId: userIdApproval,
    entityId: entityIdApproval,
    companyId: companyIdApproval,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user,
        isEditor: true
    }
};

const approvalAdminItem = {
    userId: entityAdminIdApproval,
    entityId: entityIdApproval,
    companyId: companyIdApproval,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
    }
};

const approvalCompanyAdminItem1 = {
    userId: companyAdminIdApproval,
    entityId: companyIdApproval,
    companyId: companyIdApproval,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
    }
};

const approvalCompanyAdminItem2 = {
    userId: companyAdminIdApproval,
    entityId: entityIdApproval,
    companyId: companyIdApproval,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
    }
};

const jobApprovalOptions = {
    itemId: 'job_approvalOptions',
    entityId: entityIdApproval,
    companyId: companyIdApproval,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 200,
    },
    userId: userIdApproval,
}

const msApprovalOptions1 = {
    itemId: `ms_${jobApprovalOptions.itemId}_msApprovalOptions1`,
    entityId: entityIdApproval,
    companyId: companyIdApproval,
    itemStatus: constants.job.status.pendingApproval,
    itemData: {
        cost: 200,
        jobId: jobApprovalOptions.itemId,
    },
    userId: userIdApproval,
    createdBy: userIdApproval,
};

const msApprovalOptions2 = {
    itemId: `ms_${jobApprovalOptions.itemId}_msApprovalOptions2`,
    entityId: entityIdApproval,
    companyId: companyIdApproval,
    itemStatus: constants.job.status.secondApproval,
    itemData: {
        cost: 200,
        jobId: jobApprovalOptions.itemId,
        approversChain: {
            ...approversChain,
            1: {
                ...approversChain["1"],
                approvedBy: userIdApproval,
            }
        },
    },
    userId: userIdApproval,
    createdBy: userIdApproval,
};

const msApprovalOptions3 = {
    itemId: `ms_${jobApprovalOptions.itemId}_msApprovalOptions3`,
    entityId: entityIdApproval,
    companyId: companyIdApproval,
    itemStatus: constants.job.status.secondApproval,
    itemData: {
        cost: 200,
        jobId: jobApprovalOptions.itemId,
        approversChain: {
            ...approversChain,
            2: {
                ...approversChain["2"],
                approvedBy: entityAdminIdApproval,
            },
            3: {
                ...approversChain["3"],
                type: 'namedUser',
                userIds: [companyAdminIdApproval],
            }
        },
    },
    userId: userIdApproval,
    createdBy: userIdApproval,
};

const msJobRequestOptions4 = {
    itemId: `ms_${jobApprovalOptions.itemId}_msApprovalOptions4`,
    entityId: entityIdApproval,
    companyId: companyIdApproval,
    itemStatus: constants.job.status.jobRequest,
    itemData: {
        cost: 200,
        jobId: jobApprovalOptions.itemId,
        jobRequestLevels: [{ id: 1, type: constants.multiLevelTypes.departmentAdmin, threshold: 101 }],
    },
    userId: userIdApproval,
    createdBy: userIdApproval,
};

const approvalOptions1Event = {
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: userIdApproval,
        }
    },
    queryStringParameters: {
        entityId: entityIdApproval,
        jobId: jobApprovalOptions.itemId,
        prefix: constants.prefix.milestone,
    }
};

const approvalOptions2Event = {
    ...approvalOptions1Event,
    requestContext: {
        identity: {
            cognitoIdentityId: entityAdminIdApproval,
        }
    },
};

const approvalOptions3Event = {
    ...approvalOptions1Event,
    requestContext: {
        identity: {
            cognitoIdentityId: companyAdminIdApproval,
        }
    },
};

describe('listJobs', () => {
    beforeAll(async () => {
        const userEntityAdmin = {
            userId: userId1,
            entityId: entityId1,
            companyId: companyId1,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        };
        let result = await usersService.create(userEntityAdmin);
        expect(result).toEqual(userEntityAdmin);
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
        result = await usersService.create(userComapnyAdmin);
        expect(result).toEqual(userComapnyAdmin);
        const userForJobWithTalentId = {
            userId: userId3,
            entityId: entityId2,
            companyId: companyId1,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        };
        result = await usersService.create(userForJobWithTalentId);
        expect(result).toEqual(userForJobWithTalentId);
        const userEntityUser = {
            userId: userId2,
            entityId: entityId1,
            companyId: companyId1,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.user,
                isEditor: true
            }
        };
        result = await usersService.create(userEntityUser);
        userEntityUser.entityId = entityId2;
        result = await usersService.create(userEntityUser);
        expect(result).toEqual(userEntityUser);
        result = await usersService.create(approvalUserItem);
        expect(result).toEqual(approvalUserItem);
        result = await usersService.create(approvalAdminItem);
        expect(result).toEqual(approvalAdminItem);
        result = await usersService.create(approvalCompanyAdminItem1);
        expect(result).toEqual(approvalCompanyAdminItem1);
        result = await usersService.create(approvalCompanyAdminItem2);
        expect(result).toEqual(approvalCompanyAdminItem2);
        
        // create test job
        result = await jobsService.create(jobItem);
        expect(result.itemId).toBe(jobItem.itemId);
        result = await jobsService.create(jobItem2);
        expect(result.itemId).toBe(jobItem2.itemId);
        result = await jobsService.create(jobItem3);
        expect(result.itemId).toBe(jobItem3.itemId);
        result = await jobsService.create(jobItemWithTalentId);
        expect(result.itemId).toBe(jobItemWithTalentId.itemId);
        result = await jobsService.create(jobItemMissingPrefix);
        expect(result.itemId).toBe(jobItemMissingPrefix.itemId);
        result = await usersService.create(userForMilestone);
        expect(result).toEqual(userForMilestone);
        result = await jobsService.create(jobForMilestones);
        expect(result.itemId).toBe(jobForMilestones.itemId);
        result = await jobsService.create(milestone);
        expect(result.itemId).toBe(milestone.itemId);
        result = await jobsService.create(milestone2);
        expect(result.itemId).toBe(milestone2.itemId);
        result = await talentsService.create(talent5);
        expect(result.itemId).toBe(talent5.itemId);
        result = await talentsService.create(talentFromBid);
        expect(result.itemId).toBe(talentFromBid.itemId);
        result = await talentsService.create(talentFromBid2);
        expect(result.itemId).toBe(talentFromBid2.itemId);
        await companyProvidersService.create(companyProvider5);
        result = await jobsService.create(jobApprovalOptions);
        expect(result.itemId).toBe(jobApprovalOptions.itemId);
        result = await jobsService.create(msApprovalOptions1);
        expect(result.itemId).toBe(msApprovalOptions1.itemId);
        result = await jobsService.create(msApprovalOptions2);
        expect(result.itemId).toBe(msApprovalOptions2.itemId);
        result = await jobsService.create(msApprovalOptions3);
        expect(result.itemId).toBe(msApprovalOptions3.itemId);
        result = await jobsService.create(msJobRequestOptions4);
        expect(result.itemId).toBe(msJobRequestOptions4.itemId);
        
        // teams security tests - companyId4 and entityId4
        await users.createAdmin(companyId4, companyId4, 'companyAdmin');
        await users.createAdmin(companyId4, entityId4, 'companyAdmin');
        await users.createAdmin(companyId4, entityId4, 'entityAdmin', ['English']);
        await users.create(companyId4, entityId4, 'jobList_test_approver')
        await users.create(companyId4, entityId4, 'englishUser', constants.user.role.user, ['English']);
        await users.create(companyId4, entityId4, 'hebrewUser', constants.user.role.user, ['Hebrew']);

        await jobsService.create(jobTeamEnglishAdmin);
        await jobsService.create(jobTeamEnglishUser);
        await jobsService.create(jobTeamHebrew);

        await jobsService.create(msTeamEnglishAdmin);
        await jobsService.create(msTeamEnglishUser);
        await jobsService.create(msTeamHebrew);

        await poService.create(po);
    });

    it('admin listJobs, expect 200, data', () => {
        return handler.run(event(userId1, entityId1, null, constants.prefix.job)).then((response) => {
            expect(response.statusCode).toBe(200);
            const responseObj = JSON.parse(response.body);
            expect(responseObj.jobs.length).toBe(2);
            expect(responseObj).toMatchObject({ jobs: [jobItem, jobItem2] });
        });
    });

    it('admin list active jobs, expect 200, data', () => {
        return handler.run(event(userId1, entityId1, null, constants.prefix.job, constants.job.status.active)).then((response) => {
            expect(response.statusCode).toBe(200);
            const responseObj = JSON.parse(response.body);
            expect(responseObj.jobs.length).toBe(1);
            expect(responseObj).toMatchObject({ jobs: [jobItem] });
        });
    });

    it('listJobs with talent data, expect 200, data', async () => {
        const response = await handler.run(listJobWithTalentDataEvent);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        const expectedTalent = _.pick(talent5, [
            'itemId',
            'itemData.img',
            'itemData.name',
            'itemData.firstName',
            'itemData.lastName',
        ]);
        expectedTalent.itemData.providerName = companyProvider5.itemData.providerName;
        expect(responseBody).toMatchObject({
            jobs: [
                jobItem3,
                jobItemWithTalentId,
            ],
            talents: [expectedTalent],
        });
    });

    it('listJobs with bids data, expect 200, data', async () => {
        const response = await handler.run(listJobWithBidsDataEvent);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({
            jobs: [
                jobItem3,
                jobItemWithTalentId
            ],
            bids: [
                { itemId: 'JEST_TEST_LIST_JOBS_TALENT_ID_2' },
                { itemId: 'JEST_TEST_LIST_JOBS_TALENT_ID_17', }
            ]
        });
    });

    it('listJobs with milestones, expect 200, job & milestones', async () => {
        const response = await handler.run(listJobWithMilestonesEvent);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({
            jobs: [
                jobForMilestones,
                { ...milestone, poNumber: 'test po number addition'},
                { ...milestone2, poNumber: 'test po number addition'}
            ]
        });
    });

    it('list only milestones, expect 200, only milestones', async () => {
        const response = await handler.run(listOnlyMilestonesEvent);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({
            jobs: [
                { ...milestone, poNumber: 'test po number addition'},
                { ...milestone2, poNumber: 'test po number addition'}
            ]
        });
    });

    it('list only milestones, expect 200, only milestones', async () => {
        const response = await handler.run(listOnlyMilestonesAndAppendTheirJobsEvent);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({
            jobs: [
                { ...milestone, poNumber: 'test po number addition'},
                { ...milestone2, poNumber: 'test po number addition'},
                jobForMilestones
            ]
        });
    });

    it('calculate jobs total Cost, expect 200', async () => {
        const response = await handler.run(listCalculateJobsTotalBudgetEvent);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({
            jobs: [
                { ...milestone, poNumber: 'test po number addition'},
                { ...milestone2, poNumber: 'test po number addition'},
                jobForMilestones
            ]
        });
        const job = responseBody.jobs[2];
        expect(job.itemData.totalBudget).toBe(300);
    });

    it('user listJobs, expect 200, data', () => {
        return handler.run(event(userId2, entityId1, null, constants.prefix.job)).then((response) => {
            expect(response.statusCode).toBe(200);
            const responseObj = JSON.parse(response.body);
            expect(responseObj.jobs.length).toBe(1);
            expect(responseObj).toMatchObject({ jobs: [jobItem2] });
        });
    });

    it('listJobsByCompanyId - company admin, expect 200, data', () => {
        return handler.run(event(userId1, null, companyId1)).then((response) => {
            expect(response.statusCode).toBe(200);
            const responseObj = JSON.parse(response.body);
            expect(responseObj.jobs.length).toBe(4);
            expect(responseObj).toMatchObject({ jobs: [jobItem, jobItem2, jobItem3, jobItemWithTalentId] });
        });
    });

    it('listJobsByCompanyId entity user, expect 200, data', () => {
        return handler.run(event(userId2, null, companyId1)).then((response) => {
            expect(response.statusCode).toBe(200);
            const responseObj = JSON.parse(response.body);
            expect(responseObj.jobs.length).toBe(2);
            expect(responseObj).toMatchObject({ jobs: [jobItem2, jobItem3] });
        });
    });

    it('listJobs, expect unauthorised', async () => {
        const response = await handler.run(event('NO_SUCH_USER'));
        expect(response.statusCode).toBe(403);
    });

    it('listJobs with jobId, expect milestones, 200', async () => {
        const response = await handler.run(listMilestonesEvent);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({ jobs: [milestone, milestone2] });
    });

    it('teams - companyAdmin list companyId4', async () => {
        const response = await handler.run(event('companyAdmin', null, companyId4));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(6);
    });

    it('teams - companyAdmin list entityId4', async () => {
        const response = await handler.run(event('companyAdmin', entityId4));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(6);
    });

    it('teams - entityAdmin list companyId4', async () => {
        const response = await handler.run(event('entityAdmin', null, companyId4));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(4);
        expect(data.jobs).toEqual(expect.arrayContaining(
            [jobTeamEnglishAdmin, msTeamEnglishAdmin, jobTeamEnglishUser, msTeamEnglishUser]
        ));
    });

    it('teams - entityAdmin list entityId4', async () => {
        const response = await handler.run(event('entityAdmin', entityId4));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(4);
        expect(data.jobs).toEqual(expect.arrayContaining(
            [jobTeamEnglishAdmin, msTeamEnglishAdmin, jobTeamEnglishUser, msTeamEnglishUser]
        ));
    });

    it('teams - englishUser list companyId4', async () => {
        const response = await handler.run(event('englishUser', null, companyId4));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(2);
        expect(data.jobs).toEqual(expect.arrayContaining(
            [jobTeamEnglishUser, msTeamEnglishUser]
        ));
    });

    it('teams - englishUser list entityId4', async () => {
        const response = await handler.run(event('englishUser', entityId4));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(2);
        expect(data.jobs).toEqual(expect.arrayContaining(
            [jobTeamEnglishUser, msTeamEnglishUser]
        ));
    });

    it('teams - hebrewUser list companyId4', async () => {
        const response = await handler.run(event('hebrewUser', null, companyId4));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(2);
        expect(data.jobs).toEqual(expect.arrayContaining(
            [jobTeamHebrew, msTeamHebrew]
        ));
    });

    it('teams - hebrewUser list entityId4', async () => {
        const response = await handler.run(event('hebrewUser', entityId4));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(2);
        expect(data.jobs).toEqual(expect.arrayContaining(
            [jobTeamHebrew, msTeamHebrew]
        ));
    });

    it('teams - fetch approvers', async () => {
        const response = await handler.run(event('hebrewUser', entityId4, companyId4, null, null, true));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.approvers).toMatchObject({ 'JEST-TEST-LIST-JOBS-ENT-ID-4': [ 'entityAdmin' ] });
    });

    it('getJob - ms approvalOptions user', async () => {
        const response = await handler.run(approvalOptions1Event);
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        let approvalOptions = data.jobs[0].approvalOptions;
        expect(approvalOptions).toMatchObject({ directApprovals: [{ type: 'anyone' }] });
        approvalOptions = data.jobs[1].approvalOptions;
        expect(approvalOptions).toMatchObject({ onBehalfApprovals: [], directApprovals: [] });
        approvalOptions = data.jobs[2].approvalOptions;
        expect(approvalOptions).toMatchObject({ directApprovals: [{ type: 'anyone' }] });
    });

    it('getJob - ms approvalOptions entity admin', async () => {
        const response = await handler.run(approvalOptions2Event);
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        let approvalOptions = data.jobs[0].approvalOptions;
        expect(approvalOptions).toMatchObject({ onBehalfApprovals: [{ type: 'anyone' }] });
        approvalOptions = data.jobs[1].approvalOptions;
        expect(approvalOptions).toMatchObject({ directApprovals: [{ type: 'departmentAdmin', level: 2 }], onBehalfApprovals: [] });
        approvalOptions = data.jobs[2].approvalOptions;
        expect(approvalOptions).toMatchObject({ directApprovals: [], onBehalfApprovals: [{ type: 'anyone' }] });
    });

    it('getJob - ms approvalOptions company admin', async () => {
        const response = await handler.run(approvalOptions3Event);
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        let approvalOptions = data.jobs[0].approvalOptions;
        expect(approvalOptions).toMatchObject({ onBehalfApprovals: [{ type: 'anyone' }] });
        approvalOptions = data.jobs[1].approvalOptions;
        expect(approvalOptions).toMatchObject({ directApprovals: [{ type: 'companyAdmin', level: 3 }], onBehalfApprovals: [{ type: 'departmentAdmin', level: 2 }] });
        approvalOptions = data.jobs[2].approvalOptions;
        expect(approvalOptions).toMatchObject({ directApprovals: [{ type: 'namedUser', level: 3 }], onBehalfApprovals: [{ type: 'anyone', level: 1 }] });
        const approveJobRequestOptions = data.jobs[3].approveJobRequestOptions;
        expect(approveJobRequestOptions).toMatchObject({ directApprovals: [], onBehalfApprovals: [{ type: 'departmentAdmin', threshold: 101, id: 1 }] });
    });

    afterAll(async () => {
        await jobsService.delete(entityId1, jobItem.itemId);
        await usersService.delete(userId1, entityId1);
        await usersService.delete(userId1, companyId1);
        await jobsService.delete(entityId1, jobItem2.itemId);
        await jobsService.delete(entityId2, jobItemWithTalentId.itemId);
        await jobsService.delete(jobItemMissingPrefix.entityId, jobItemMissingPrefix.itemId);
        await usersService.delete(userId2, entityId1);
        await usersService.delete(userId2, entityId2);
        await usersService.delete(userId2, companyId1);
        await usersService.delete(userId3, entityId2);
        await jobsService.delete(jobForMilestones.entityId, jobForMilestones.itemId);
        await jobsService.delete(jobForMilestones.entityId, milestone.itemId);
        await jobsService.delete(jobForMilestones.entityId, milestone2.itemId);
        await usersService.delete(jobForMilestones.userId, jobForMilestones.entityId);
        await talentsService.delete(talent5.itemId);
        await talentsService.delete(talentFromBid.entityId, talentFromBid.itemId);
        await talentsService.delete(talentFromBid.entityId, talentFromBid2.itemId);
        await companyProvidersService.delete(companyProvider5.companyId, companyProvider5.itemId);

        await users.remove(companyId4, 'companyAdmin');
        await users.remove(entityId4, 'companyAdmin');
        await users.remove(entityId4, 'entityAdmin');
        await users.remove(entityId4, 'hebrewUser');
        await users.remove(entityId4, 'englishUser');
        await users.remove(entityId4, 'jobList_test_approver');
        await users.remove(entityIdApproval, userIdApproval);
        await users.remove(entityIdApproval, entityAdminIdApproval);
        await users.remove(entityIdApproval, companyAdminIdApproval);
        await users.remove(companyIdApproval, companyAdminIdApproval);

        await jobsService.delete(jobTeamEnglishAdmin.entityId, jobTeamEnglishAdmin.itemId);
        await jobsService.delete(jobTeamEnglishUser.entityId, jobTeamEnglishAdmin.itemId);
        await jobsService.delete(jobTeamHebrew.entityId, jobTeamHebrew.itemId);

        await jobsService.delete(msTeamEnglishAdmin.entityId, msTeamEnglishAdmin.itemId);
        await jobsService.delete(msTeamEnglishUser.entityId, msTeamEnglishAdmin.itemId);
        await jobsService.delete(msTeamHebrew.entityId, msTeamHebrew.itemId);

        await jobsService.delete(jobApprovalOptions.entityId, jobApprovalOptions.itemId);
        await jobsService.delete(msApprovalOptions1.entityId, msApprovalOptions1.itemId);
        await jobsService.delete(msApprovalOptions2.entityId, msApprovalOptions2.itemId);
        await jobsService.delete(msApprovalOptions3.entityId, msApprovalOptions3.itemId);
        await jobsService.delete(msJobRequestOptions4.entityId, msJobRequestOptions4.itemId);
        await poService.delete(companyId1, po.itemId);
    });
});
