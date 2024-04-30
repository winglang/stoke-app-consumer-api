'use strict';

/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */

const _ = require('lodash');
const jobs = require('stoke-app-common-api/__tests__/utils/jobs');
const users = require('stoke-app-common-api/__tests__/utils/users');
const budgets = require('stoke-app-common-api/__tests__/utils/budgets');

const mod = require('../src/jobs');
const { UsersService, JobsService, CompanyProvidersService, constants, BudgetsService, SettingsService, TalentsService, BidsService, permisionConstants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const bidsService = new BidsService(process.env.bidsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrappedSignJobs = lambdaWrapper.wrap(mod, { handler: 'hireTalentAndActivateJob' });
const jobId = 'SIGNJOB-JEST-TEST-JOB-ID-1';
const jobId2 = 'SIGNJOB-JEST-TEST-JOB-ID-2';
const jobId3 = 'SIGNJOB-JEST-TEST-JOB-ID-3';
const jobId4 = 'SIGNJOB-JEST-TEST-JOB-ID-4';
const jobId5 = 'SIGNJOB-JEST-TEST-JOB-ID-5';
const jobId6 = 'SIGNJOB-JEST-TEST-JOB-ID-6';

const entityId = 'SIGNJOB-JEST-TEST-ENT-ID-1';
const entityId2 = 'SIGNJOB-JEST-TEST-ENT-ID-2';
const companyId = 'SIGNJOB-COMPANY-ID';
const talentId = 'TALENT_ID';
const talentId2 = 'TALENT_ID_2';
const companyProviderId = 'provider_stam';
const userId = "USER-JOB-SIGN";
const userId2 = "USER-JOB-SIGN-2";
const companyAdminUserId = "USER-COMPANY-ADMIN-1";
const secondJobId = 'SIGNJOB-JEST-TEST-JOB-ID-2';
const jobIdWithTransfer = 'SIGNJOB-JEST-TEST-JOB-ID-3';
const jobForReActivate = 'SIGNJOB-JEST-TEST-JOB-ID-4';
const freelancerComTalentId = `${constants.marketplaces.freelancerCom.talentPrefix}${constants.prefix.provider}${constants.prefix.talent}123456`;
const freelancerComJobId = 'SIGNJOB-JEST-TEST-JOB-ID-FRLNCR-1';

const companySettings = {
    itemId: `${constants.prefix.company}${companyId}`,
    itemData: {
        jobRequestApproval: {
          enabled: true,
          jobRequestLevels: [
            { id: 1, threshold: 500, type: constants.multiLevelTypes.namedUser, userIds: [companyAdminUserId] },
            { id: 2, threshold: 600, type: constants.multiLevelTypes.companyAdmin }
        ],
        }
    }
};

const jobItemData = {
    title: 'The modified job title 1',
    totalBudget: 100,
    jobStartDate: 1573999835000,
    contract: { sealedContract: { talentId: talentId } }
}

const offeredJobItemData = {
    title: 'Offered job title',
    totalBudget: 100,
    jobStartDate: 1573999835000,
    itemId: talentId,
    itemStatus: constants.job.status.pending,
    talentId,
    jobFlow: constants.jobFlow.offer,
    bids: [
        `${jobId}_${talentId}`,
        `${jobId}_${talentId2}`,
    ],
    talentIds: [
        talentId,
        talentId2,
    ],
}

const job2ItemData = {
    title: 'The modified job title 2',
    totalBudget: 100,
    jobStartDate: 1573888875000,
    contract: { sealedContract: { talentId: talentId } }
}

const eventBody = {
    entityId: entityId,
    itemId: talentId,
    companyId: companyId,
    itemStatus: constants.job.status.active,
    itemData: jobItemData

};

const eventBodyDuplication = {
    entityId: entityId,
    itemId: talentId,
    companyId: companyId,
    itemStatus: constants.job.status.active,
    itemData: jobItemData,
    isKeepPostedJobOpen: true
};

const eventBodySignKeepOpen = {
    entityId: entityId,
    itemId: talentId,
    companyId: companyId,
    itemData: offeredJobItemData,
    isKeepPostedJobOpen: true
};

const eventBodyWithTransfer = {
    entityId: entityId2,
    itemId: talentId,
    companyId: companyId,
    itemStatus: constants.job.status.active,
    itemData: {
        title: 'The modified job title',
        totalBudget: 100,
        jobStartDate: 1573999835000,
        contract: { sealedContract: { talentId: talentId } }
    }
};

const eventBodyFotReactivate = {
    entityId: entityId2,
    itemId: talentId2,
    companyId: companyId,
    itemStatus: constants.job.status.active,
    itemData: {
        title: 'Sign and reactivate talent',
        totalBudget: 70,
        jobStartDate: 1573999835000,
        contract: { sealedContract: { talentId: talentId2 } }
    }
};


const userBudget = {
    itemId: constants.prefix.user + userId,
    entityId: entityId,
    companyId: companyId,
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 100, approved: 50, pending: 20, committed: 10, available: 20 },
            2: { total: 100, approved: 50, pending: 0, committed: 0, available: 50 },
            3: { total: 100, approved: 0, pending: 0, committed: 0, available: 100 },
            4: { total: 100, approved: 0, pending: 0, committed: 0, available: 100 },
        },
    },
    modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
}

const userBudget2 = {
    itemId: constants.prefix.user + userId2,
    entityId: entityId2,
    companyId: companyId,
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 100, approved: 50, pending: 20, committed: 10, available: 20 },
            2: { total: 100, approved: 50, pending: 0, committed: 0, available: 50 },
            3: { total: 100, approved: 0, pending: 0, committed: 0, available: 100 },
            4: { total: 100, approved: 0, pending: 0, committed: 0, available: 100 },
        },
    },
    modifiedBy: userId2
}

const entityAdminBudget = {
    itemId: constants.prefix.user + companyAdminUserId,
    entityId: entityId2,
    companyId: companyId,
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            2: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            3: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            4: { total: 100, approved: 0, pending: 0, committed: 0, available: 100 },
        },
    },
    modifiedBy: userId2
}

const companyAdminBudget = {
    itemId: constants.prefix.user + companyAdminUserId,
    entityId: companyId,
    companyId: companyId,
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            2: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            3: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            4: { total: 1000, approved: 0, pending: 0, committed: 0, available: 1000 },
        },
    },
    modifiedBy: userId2
}

const companyBudget = {
    itemId: constants.prefix.company + companyId,
    entityId: companyId,
    companyId: companyId,
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 100, approved: 50, pending: 20, committed: 10, available: 20 },
            2: { total: 100, approved: 50, pending: 0, committed: 0, available: 50 },
            3: { total: 100, approved: 0, pending: 0, committed: 0, available: 100 },
            4: { total: 100, approved: 0, pending: 0, committed: 0, available: 100 },
        },
    },
    modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
}

const entityBudget = {
    itemId: constants.prefix.entity + entityId,
    entityId,
    companyId: companyId,
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 100, approved: 50, pending: 20, committed: 10, available: 20 },
            2: { total: 100, approved: 50, pending: 0, committed: 0, available: 50 },
            3: { total: 100, approved: 0, pending: 0, committed: 0, available: 100 },
            4: { total: 100, approved: 0, pending: 0, committed: 0, available: 100 },
        },
    },
    modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
}

const entityBudget2 = {
    itemId: constants.prefix.entity + entityId2,
    entityId: entityId2,
    companyId: companyId,
    itemData: {
        2019:
        {
            periods: 4,
            1: { total: 100, approved: 50, pending: 20, committed: 10, available: 20 },
            2: { total: 100, approved: 50, pending: 0, committed: 0, available: 50 },
            3: { total: 100, approved: 0, pending: 0, committed: 0, available: 100 },
            4: { total: 100, approved: 0, pending: 0, committed: 0, available: 100 },
        },
    },
    modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
}


const eventBody2 = {
    entityId: entityId,
    itemId: talentId,
    companyId: companyId,
    itemStatus: constants.job.status.active,
    itemData: job2ItemData
};

const wrongEventBody = {
    entityId: entityId + "_WRONG",
    itemId: talentId,
    companyId: companyId,
    itemData: {
        title: 'The modified job title',
        contract: { sealedContract: { talentId: talentId } }
    }
};

const signedJobData = {
    body: JSON.stringify(eventBody),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    pathParameters: {
        id: jobId
    }
};

const signedJobDataDuplicate = {
    body: JSON.stringify(eventBodyDuplication),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    pathParameters: {
        id: jobId
    }
};

const signedOfferKeepOpen = {
    body: JSON.stringify(eventBodySignKeepOpen),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    pathParameters: {
        id: jobId6
    }
};

const signedJobData2 = {
    body: JSON.stringify(eventBody2),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    pathParameters: {
        id: secondJobId
    }
};

const signedJobDataWithTransfer = {
    body: JSON.stringify(eventBodyWithTransfer),
    requestContext: {
        identity: {
            cognitoIdentityId: companyAdminUserId
        }
    },
    pathParameters: {
        id: jobIdWithTransfer
    }
};

const signedJobDataWithReactivate = {
    body: JSON.stringify(eventBodyFotReactivate),
    requestContext: {
        identity: {
            cognitoIdentityId: companyAdminUserId
        }
    },
    pathParameters: {
        id: jobForReActivate
    }
};


const wrongSignedJobData = {
    body: JSON.stringify(wrongEventBody),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    pathParameters: {
        id: jobId
    }
};


const TALENT_EMAIL = "bimbambom@stoketalent.com";
const TALENT_EMAIL2 = "bimbambom2@stoketalent2.com";
const talent = {
    itemId: `${constants.prefix.talent}PROVIDER-ID-1_talent_BIMBAMBOM-TALENT`,
    companyId,
    itemData: {
        name: "BimbamBom",    
        email: TALENT_EMAIL,
    }
};

const companyProvider = {
    itemId: `${talent.itemId}_BIMBAMBOM-PROVIDER`,
    companyId,
    itemData: {
        isProviderSelfEmployedTalent: true,
        legalCompliance: {},
        legalDocuments: [],
        providerEmail: TALENT_EMAIL,
        providerName: "BimbamBom",    
    }
}


const bid = {
    "itemData": {
        "availability": "available",
        "amount": 5,
        "bidType": "fixed",
        "stoke_score": {
            "score": 0.05
        },
        "candidate": {
            "country": "",
            "email": TALENT_EMAIL,
            "currency": {
                "name": "US Dollar",
                "sign": "$",
                "code": "USD"
            },
            "hourly_rate": {
                "max": 55,
                "min": 55
            },
            "img": "",
            "title": "asdasd",
            "languages": [],
            "name": "asdasd",
            "description": "asdasd",
            "platform": "STOK",
            "skills": [],
            "top_skills": [],
            "score": {
                "rating": 5,
                "reviews": 0
            },
            "portfolios": [],
            "isProviderSelfEmployedTalent": true,
            "category": "engineer",
            "itemId": talent.itemId
        }
    }
};

const signKeepOpenBid1 = {
    entityId: entityId,
    itemId: `${jobId}_${talentId}`,
    companyId: companyId,
    itemData: {
        availability: "available",
        amount: 5,
        bidType: "fixed",
        stoke_score: {
            score: 0.05
        },
        candidate: {
            country: "",
            email: TALENT_EMAIL,
            currency: {
                name: "US Dollar",
                sign: "$",
                code: "USD"
            },
            hourly_rate: {
                max: 55,
                min: 55
            },
            img: "",
            title: "asdasd",
            languages: [],
            name: "asdasd",
            description: "asdasd",
            platform: "STOK",
            skills: [],
            top_skills: [],
            score: {
                rating: 5,
                reviews: 0
            },
            portfolios: [],
            isProviderSelfEmployedTalent: true,
            category: "engineer",
            itemId: talent.itemId
        }
    },
    userId: userId,
    createdBy: userId,
    modifiedBy: userId
}

const signKeepOpenBid2 = {
    entityId: entityId,
    itemId: `${jobId}_${talentId2}`,
    companyId: companyId,
    itemData: {
        availability: "available",
        amount: 5,
        bidType: "fixed",
        stoke_score: {
            score: 0.05
        },
        candidate: {
            country: "",
            email: TALENT_EMAIL2,
            currency: {
                name: "US Dollar",
                sign: "$",
                code: "USD"
            },
            hourly_rate: {
                max: 55,
                min: 55
            },
            img: "",
            title: "asdasd",
            languages: [],
            name: "asdasd",
            description: "asdasd",
            platform: "STOK",
            skills: [],
            top_skills: [],
            score: {
                rating: 5,
                reviews: 0
            },
            portfolios: [],
            isProviderSelfEmployedTalent: true,
            category: "engineer",
            itemId: talentId2
        }
    },
    userId: userId,
    createdBy: userId,
    modifiedBy: userId
}

const milestoneId_job1_ms1 = `${constants.prefix.milestone}${jobId}_MILESTONE-1`;
const milestoneId_job2_ms1 = `${constants.prefix.milestone}${secondJobId}_MILESTONE-1`;
const milestoneId_job2_ms3 = `${constants.prefix.milestone}${secondJobId}_MILESTONE-3`;

const milestoneId1WithTransfer = `${constants.prefix.milestone}${jobIdWithTransfer}_MILESTONE-1`;
const milestoneId2WithTransfer = `${constants.prefix.milestone}${jobIdWithTransfer}_MILESTONE-2`;

const milestoneForReactivate = `${constants.prefix.milestone}${jobForReActivate}_MILESTONE-1`;

const createEvent = (companyId, entityId, jobId, callerUserId, talentId, extraData) => {
    const eventBody = {
        entityId: entityId,
        itemId: talentId,
        companyId: companyId,
        itemData: {
            title: 'The modified job title',
            contract: { sealedContract: { talentId: talentId } }
        }, 
        ...(extraData || {})
    };

    return {
        body: JSON.stringify(eventBody),
        requestContext: {
            identity: {
                cognitoIdentityId: callerUserId
            }
        },
        pathParameters: {
            id: constants.prefix.job + jobId
        }
    };
}

// eslint-disable-next-line no-shadow
const getJobItem = (jobId, entityId, userId, status) => ({
    itemId: `${constants.prefix.job}${jobId}`,
    entityId,
    userId,
    itemStatus: status,
    itemData: {},
    companyId,
});

// eslint-disable-next-line no-shadow
const getMilestoneItem = (jobId, msId, entityId, userId, status, cost) => ({
    itemId: `${constants.prefix.milestone}${constants.prefix.job}${jobId}_${msId}`,
    entityId,
    userId,
    itemStatus: status,
    itemData: { cost, date: 1573999835000, },
    companyId,
});

describe('signJob', () => {
    beforeEach(async () => {
        let response = await settingsService.create(companySettings);
        expect(response.itemData).toEqual(companySettings.itemData);

        const item = {
            itemId: jobId,
            entityId: entityId,
            userId,
            itemStatus: constants.job.status.draft,
            itemData: {},
        };
        response = await jobsService.create(item);
        await jobsService.create({
            itemId: milestoneId_job1_ms1,
            entityId,
            itemStatus: constants.job.status.pending,
            itemData: { date: 1573999835000, cost: 100 },
            companyId,
            userId
        });

        item.itemId = secondJobId;

        response = await jobsService.create(item);

        await jobsService.create({
            itemId: milestoneId_job2_ms1,
            entityId,
            itemStatus: constants.job.status.pending,
            itemData: { date: 1573999835000, cost: 100 },
            companyId,
            userId
        });

        await jobsService.create({
            itemId: milestoneId_job2_ms3,
            entityId,
            itemStatus: constants.job.status.pending,
            itemData: { date: 1576584308000, cost: 100 },
            companyId,
            userId
        });

        await jobsService.create({
            itemId: freelancerComJobId,
            entityId,
            itemStatus: constants.job.status.pending,
            itemData: { date: 1576584308000, cost: 100 },
            companyId,
            userId
        });

        const itemWithTransfer = {
            itemId: jobIdWithTransfer,
            entityId: entityId2,
            userId: userId2,
            itemStatus: constants.job.status.autoDraft,
            itemData: {},
        };
        response = await jobsService.create(itemWithTransfer);

        const itemForReActivate = {
            itemId: jobForReActivate,
            entityId: entityId2,
            userId: userId2,
            itemStatus: constants.job.status.autoDraft,
            itemData: {},
        };
        response = await jobsService.create(itemForReActivate);

        await jobsService.create({
            itemId: milestoneForReactivate,
            entityId: entityId2,
            itemStatus: constants.job.status.pending,
            itemData: { date: 1576584308000, cost: 70 },
            companyId,
            userId: userId2,
        });

        await jobsService.create({
            itemId: milestoneId1WithTransfer,
            entityId: entityId2,
            itemStatus: constants.job.status.pending,
            itemData: { date: 1573999835000, cost: 100 },
            companyId,
            userId: userId2,
        });

        await jobsService.create({
            itemId: milestoneId2WithTransfer,
            entityId: entityId2,
            itemStatus: constants.job.status.pending,
            itemData: { date: 1576584308000, cost: 100 },
            companyId,
            userId: userId2,
        });

        await companyProvidersService.create({
            itemId: talentId,
            companyId,
            itemData: {}
        });

        await companyProvidersService.create({companyId, itemId: companyProviderId, externalUserId: 'p_userid_stam', itemStatus: constants.companyProvider.status.inactive});
        await companyProvidersService.create({companyId, itemId: talentId2, itemData:{providerName: 'stam name' , providerEmail: 'test@email.com', providerId: companyProviderId}, itemStatus: constants.companyProvider.status.inactive});

        response = await companyProvidersService.create({
            itemId: freelancerComTalentId,
            companyId,
            itemData: {}
        });
        expect(response).toBeTruthy();

        const userAuth = {
            userId: userId,
            entityId: entityId,
            companyId: companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.user,
                permissionsComponents: { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } }
            }
        };
        response = await usersService.create(userAuth);
        expect(response).toEqual(userAuth);
        const userAuth2 = {
            userId: userId,
            entityId: entityId2,
            companyId: companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.user,
                isEditor: true
            }
        };
        response = await usersService.create(userAuth2);
        expect(response).toEqual(userAuth2);
        const userAuth3 = {
            userId: userId2,
            entityId: entityId2,
            companyId: companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.user,
                isEditor: true
            }
        };
        response = await usersService.create(userAuth3);
        expect(response).toEqual(userAuth3);

        await usersService.create({
            userId: companyAdminUserId,
            entityId: entityId2,
            companyId: companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        });

        await usersService.create({
            userId: companyAdminUserId,
            entityId: companyId,
            companyId: companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        });

        await usersService.create({
            userId: companyAdminUserId,
            entityId,
            companyId: companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        });

        response = await budgetsService.create(companyBudget);
        expect(response).toEqual(companyBudget);
        response = await budgetsService.create(entityBudget);
        expect(response).toEqual(entityBudget);
        response = await budgetsService.create(entityBudget2);
        expect(response).toEqual(entityBudget2);
        response = await budgetsService.create(userBudget2);
        expect(response).toEqual(userBudget2);
        response = await budgetsService.create(companyAdminBudget);
        expect(response).toEqual(companyAdminBudget);
    });

    it('sign job post, expect 200', async () => {
        let response = await wrappedSignJobs.run(signedJobData);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({ isMissingUserBudget: true, isMissingCompanyBudget: false });
        response = await jobsService.get(entityId, jobId);
        expect(response.itemData.contract.sealedContract.talentId).toBe(talentId);
        expect(response.itemStatus).toBe(constants.job.status.budgetRequest);
        response = await jobsService.get(entityId, milestoneId_job1_ms1);
        expect(response.itemStatus).toBe(constants.job.status.budgetRequest);
        response = await companyProvidersService.get(companyId, talentId);
        response = await budgetsService.create(userBudget);
        expect(response).toEqual(userBudget);
        await companyProvidersService.delete(companyId, talentId)
        response = await wrappedSignJobs.run(signedJobData2);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({ isMissingUserBudget: false, isMissingCompanyBudget: false });
        response = await jobsService.get(entityId, secondJobId);
        expect(response.itemStatus).toBe(constants.job.status.active);
        response = await jobsService.get(entityId, milestoneId_job2_ms1);
        expect(response.itemStatus).toBe(constants.job.status.active);
        response = await jobsService.get(entityId, milestoneId_job2_ms3);
        expect(response.itemStatus).toBe(constants.job.status.budgetRequest);
        response = await companyProvidersService.get(companyId, talentId);
        response = await wrappedSignJobs.run(signedJobData);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({ isMissingUserBudget: false, isMissingCompanyBudget: false });
        response = await jobsService.get(entityId, jobId);
        expect(response.itemStatus).toBe(constants.job.status.active);
        response = await jobsService.get(entityId, milestoneId_job2_ms1);
        expect(response.itemStatus).toBe(constants.job.status.active);
        response = await jobsService.get(entityId, milestoneId_job2_ms3);
        expect(response.itemStatus).toBe(constants.job.status.budgetRequest);
        response = await companyProvidersService.get(companyId, talentId);
        await usersService.update({
            userId, entityId, modifiedBy: userId, itemData: {
                userRole: constants.user.role.user,
                isEditor: false
            }
        })
        response = await wrappedSignJobs.run(signedJobData);
        expect(response.statusCode).toBe(403);
        await usersService.update({
            userId, entityId, modifiedBy: userId, itemData: {
                userRole: constants.user.role.user,
                isEditor: true
            }
        })
    });

    it('sign job post with job duplication, expect 200', async () => {
        let response = await wrappedSignJobs.run(signedJobDataDuplicate);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({ isMissingUserBudget: true, isMissingCompanyBudget: false, isKeepPostedJobOpen: true, isPostedJobDuplicated: true });
        const currentJob = await jobsService.get(entityId, jobId);
        response = await mod.duplicateJob(companyId, entityId, currentJob, userId);
        expect(_.get(response, 'createdJob.itemData.jobDuplicated.from')).toBe(jobId);
    });

    it('sign job offer and keep open, expect 200', async () => {
        await companyProvidersService.create(talent)
        await companyProvidersService.create(companyProvider)
        await bidsService.create(signKeepOpenBid1);
        await bidsService.create(signKeepOpenBid2);
        await jobsService.create({
            itemId: jobId6,
            entityId,
            itemStatus: constants.job.status.pending,
            itemData: offeredJobItemData,
            companyId,
            userId
        });
        let response = await wrappedSignJobs.run(signedOfferKeepOpen);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({ isMissingUserBudget: false, isMissingCompanyBudget: false, isKeepPostedJobOpen: true, isPostedJobDuplicated: true });
        const currentJob = await jobsService.get(entityId, jobId6);
        const duplicatedJobId = _.get(currentJob, 'itemData.jobDuplicated.to')
        const duplicatedJob = await jobsService.get(entityId, duplicatedJobId);
        expect((duplicatedJob.itemData.talentIds)).toEqual([talentId2])

        await bidsService.delete(entityId, `${jobId}_${talentId}`);
        await bidsService.delete(entityId, signKeepOpenBid2.itemId);
        await jobsService.delete(entityId, jobId6)
        await jobsService.delete(entityId, duplicatedJob.itemId)
    });

    it('sign job post with auto transfer from entity budget, expect 200', async () => {
        // make company admin user also a department admin (entityId2), only for this test case
        await usersService.create({
            userId: companyAdminUserId,
            entityId: entityId2,
            companyId: companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        });

        await budgetsService.create(entityAdminBudget);

        let response = await wrappedSignJobs.run(signedJobDataWithTransfer);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            isMissingUserBudget: false,
            isMissingCompanyBudget: false,
        });

        response = await jobsService.get(entityId2, jobIdWithTransfer);
        expect(response.itemStatus).toBe(constants.job.status.active);
        response = await jobsService.get(entityId2, milestoneId1WithTransfer);
        expect(response.itemStatus).toBe(constants.job.status.active);
        response = await jobsService.get(entityId2, milestoneId2WithTransfer);
        expect(response.itemStatus).toBe(constants.job.status.budgetRequest);
        response = await budgetsService.get(entityId2, userBudget2.itemId);
        expect(response.itemData[2019]).toMatchObject({
            '1': {
                available: 20,
                total: 100,
                approved: 50,
                committed: 10,
                pending: 20
            },
            '2': { available: 50, total: 100, approved: 50, committed: 0, pending: 0 },
            '3': { available: 100, total: 100, approved: 0, committed: 0, pending: 0 },
            '4': { available: 100, approved: 0, committed: 0, total: 100, pending: 0 },
            periods: 4
        })

        await usersService.delete(companyAdminUserId, entityId2);
        await budgetsService.delete(entityAdminBudget.entityId, entityAdminBudget.itemId);
    });

    it('sign job post with transfer budget, expect 200', async () => {
        let response = await wrappedSignJobs.run(signedJobDataWithTransfer);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            isMissingUserBudget: false,
            isMissingCompanyBudget: false,
        });

        response = await jobsService.get(entityId2, jobIdWithTransfer);
        expect(response.itemStatus).toBe(constants.job.status.active);
        response = await jobsService.get(entityId2, milestoneId1WithTransfer);
        expect(response.itemStatus).toBe(constants.job.status.active);
        response = await jobsService.get(entityId2, milestoneId2WithTransfer);
        expect(response.itemStatus).toBe(constants.job.status.budgetRequest);
        response = await budgetsService.get(entityId2, userBudget2.itemId);
        expect(response.itemData[2019]).toMatchObject({
            '1': {
                available: 20,
                total: 100,
                approved: 50,
                committed: 10,
                pending: 20
            },
            '2': { available: 50, total: 100, approved: 50, committed: 0, pending: 0 },
            '3': { available: 100, total: 100, approved: 0, committed: 0, pending: 0 },
            '4': { available: 100, approved: 0, committed: 0, total: 100, pending: 0 },
            periods: 4
        })
    });

    it('sign job post, expect unauthorised', async () => {
        const response = await wrappedSignJobs.run(wrongSignedJobData);
        expect(response.statusCode).toBe(403);
    });

    it('sign job with freelancer com talent, expect creation of provider', async () => {
        const body = {
            entityId: entityId,
            itemId: freelancerComTalentId,
            companyId: companyId,
            itemStatus: constants.job.status.active,
            itemData: {
                title: 'job title X',
                totalBudget: 11,
                jobStartDate: 1573199834000,
                contract: {
                    sealedContract: {
                        talentId: freelancerComTalentId
                    }
                }
            }
        };
        const event = {
            body: JSON.stringify(body),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
            pathParameters: {
                id: freelancerComJobId
            }
        };
        let companyTalent = await companyProvidersService.get(companyId, freelancerComTalentId);
        expect(companyTalent.itemData.providerId).toBeUndefined();
        const response = await wrappedSignJobs.run(event);
        expect(response.statusCode).toBe(200);
        companyTalent = await companyProvidersService.get(companyId, freelancerComTalentId);
        expect(companyTalent.itemData.providerId).toBe(constants.marketplaces.freelancerCom.provider);
        const companyProvider = await companyProvidersService.get(companyId, constants.marketplaces.freelancerCom.provider);
        expect(companyProvider.itemData.providerName).toBe(constants.marketplaces.freelancerCom.providerName);

    });

    it('user signs a new job, has enough budget', async () => {
        await users.create(companyId, entityId, 'user1');
        await budgets.create(companyId, entityId, 'user1', 100);
        await jobs.createJob(companyId, entityId, 'job1', 'user1', undefined, undefined, constants.job.status.pending);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms1', 'user1', jobs.date_2020_01_01, 100);

        const event = createEvent(companyId, entityId, 'job1', 'user1', talentId);
        const response = await wrappedSignJobs.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            isMissingUserBudget: false,
            isMissingCompanyBudget: false,
        });

        const result = await budgets.get(entityId, 'user1');
        expect(result.available).toBe(100);
    });

    it('user signs a new job, not enough budget, should create a budget request', async () => {
        await users.create(companyId, entityId, 'user1');
        await budgets.create(companyId, entityId, 'user1', 100);
        await jobs.createJob(companyId, entityId, 'job1', 'user1', undefined, undefined, constants.job.status.pending);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms1', 'user1', jobs.date_2020_01_01, 200);

        const event = createEvent(companyId, entityId, 'job1', 'user1', talentId);
        const response = await wrappedSignJobs.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            isMissingUserBudget: true,
            isMissingCompanyBudget: false,
        });

        const result = await budgets.get(entityId, 'user1');
        expect(result.available).toBe(100);
    });

    it('department admin creates a new job for another user, user has enough budget', async () => {
        await users.create(companyId, entityId, 'user1');
        await budgets.create(companyId, entityId, 'user1', 100);
        await jobs.createJob(companyId, entityId, 'job1', 'user1', undefined, undefined, constants.job.status.pending);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms1', 'user1', jobs.date_2020_01_01, 100);

        await users.createAdmin(companyId, entityId, 'entityAdmin');
        await budgets.create(companyId, entityId, 'entityAdmin', 0);

        const event = createEvent(companyId, entityId, 'job1', 'entityAdmin', talentId);
        const response = await wrappedSignJobs.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            isMissingUserBudget: false,
            isMissingCompanyBudget: false,
        });

        const result = await budgets.get(entityId, 'user1');
        expect(result.available).toBe(100);
    });

    it('department admin creates a new job for another user, user not enough budget', async () => {
        await users.create(companyId, entityId, 'user1');
        await budgets.create(companyId, entityId, 'user1', 100);
        await budgets.get(entityId, 'user1');
        await jobs.createJob(companyId, entityId, 'job1', 'user1', undefined, undefined, constants.job.status.pending);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms1', 'user1', jobs.date_2020_01_01, 200);

        await users.createAdmin(companyId, entityId, 'entityAdmin');
        await budgets.create(companyId, entityId, 'entityAdmin', 0);

        const event = createEvent(companyId, entityId, 'job1', 'entityAdmin', talentId);
        const response = await wrappedSignJobs.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            isMissingUserBudget: true,
            isMissingCompanyBudget: false,
        });

        const result = await budgets.get(entityId, 'user1');
        expect(result.available).toBe(100);
    });

    it('department admin creates a new job for another user, user not enough budget, projection to transfer from entity admin to user', async () => {
        await users.create(companyId, entityId, 'user1');
        await budgets.create(companyId, entityId, 'user1', 100);
        await jobs.createJob(companyId, entityId, 'job1', 'user1', undefined, undefined, constants.job.status.pending);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms1', 'user1', jobs.date_2020_01_01, 200);

        await users.createAdmin(companyId, entityId, 'entityAdmin');
        await budgets.create(companyId, entityId, 'entityAdmin', 1000);

        const event = createEvent(companyId, entityId, 'job1', 'entityAdmin', talentId); // will move 200 from entity admin to user
        const response = await wrappedSignJobs.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            isMissingUserBudget: false,
            isMissingCompanyBudget: false,
        });

        const userBudget = await budgets.get(entityId, 'user1');
        expect(userBudget.available).toBe(100);
        const adminBudget = await budgets.get(entityId, 'entityAdmin');
        expect(adminBudget.available).toBe(1000);
    });

    it('department admin creates a new job for another user with two milestones, user has enough budget for some, project to transfer from entity admin to user', async () => {
        await users.create(companyId, entityId, 'user1');
        await budgets.create(companyId, entityId, 'user1', 200);
        await jobs.createJob(companyId, entityId, 'job1', 'user1', undefined, undefined, constants.job.status.pending);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms1', 'user1', jobs.date_2020_01_01, 100);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms2', 'user1', jobs.date_2020_02_01, 100);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms3', 'user1', jobs.date_2020_03_01, 100);

        await users.createAdmin(companyId, entityId, 'entityAdmin');
        await budgets.create(companyId, entityId, 'entityAdmin', 1000);

        const event = createEvent(companyId, entityId, 'job1', 'entityAdmin', talentId); // will move 100 from entity admin to user
        const response = await wrappedSignJobs.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            isMissingUserBudget: false,
            isMissingCompanyBudget: false,
        });

        const userBudget = await budgets.get(entityId, 'user1');
        expect(userBudget.available).toBe(200);
        const adminBudget = await budgets.get(entityId, 'entityAdmin');
        expect(adminBudget.available).toBe(1000);
    });

    it('company admin creates a new job for another user, user not enough budget, admin not enough budget', async () => {
        await users.create(companyId, entityId, 'user1');
        await budgets.create(companyId, entityId, 'user1', 100);
        await jobs.createJob(companyId, entityId, 'job1', 'user1', undefined, undefined, constants.job.status.pending);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms1', 'user1', jobs.date_2020_01_01, 200);

        await users.createAdmin(companyId, companyId, 'companyAdmin');
        await users.createAdmin(companyId, entityId, 'companyAdmin');
        await budgets.create(companyId, companyId, 'companyAdmin', 0);

        const event = createEvent(companyId, entityId, 'job1', 'companyAdmin', talentId);
        const response = await wrappedSignJobs.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            isMissingUserBudget: true,
            isMissingCompanyBudget: false,
        });

        const result = await budgets.get(entityId, 'user1');
        expect(result.available).toBe(100);
    });

    it('company admin creates a new job for another user, user not enough budget, admin has budget', async () => {
        await users.create(companyId, entityId, 'user1');
        await budgets.create(companyId, entityId, 'user1', 100);
        await jobs.createJob(companyId, entityId, 'job1', 'user1', undefined, undefined, constants.job.status.pending);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms1', 'user1', jobs.date_2020_01_01, 200);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms2', 'user1', jobs.date_2020_02_01, 100);

        await users.createAdmin(companyId, companyId, 'companyAdmin');
        await users.createAdmin(companyId, entityId, 'companyAdmin');
        await budgets.create(companyId, companyId, 'companyAdmin', 1000);

        const event = createEvent(companyId, entityId, 'job1', 'companyAdmin', talentId);
        const response = await wrappedSignJobs.run(event); // transfers 200 from company admin to user
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            isMissingUserBudget: false,
            isMissingCompanyBudget: false,
        });

        const result = await budgets.get(entityId, 'user1');
        expect(result.available).toBe(100);
        const adminBudget = await budgets.get(companyId, 'companyAdmin');
        expect(adminBudget.available).toBe(1000);
    });

    it('company admin creates a new job, not enough budget in department, admin has budget in company', async () => {
        await users.createAdmin(companyId, companyId, 'companyAdmin');
        await users.createAdmin(companyId, entityId, 'companyAdmin');
        await budgets.create(companyId, entityId, 'companyAdmin', 0);
        await budgets.create(companyId, companyId, 'companyAdmin', 1000);

        await jobs.createJob(companyId, entityId, 'job1', 'companyAdmin', undefined, undefined, constants.job.status.pending);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms1', 'companyAdmin', jobs.date_2020_01_01, 100);
        await jobs.createMilestone(companyId, entityId, 'job1', 'ms2', 'companyAdmin', jobs.date_2020_02_01, 100);

        const event = createEvent(companyId, entityId, 'job1', 'companyAdmin', talentId);
        const response = await wrappedSignJobs.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({
            isMissingUserBudget: false,
            isMissingCompanyBudget: false,
        });

        const result = await budgets.get(entityId, 'companyAdmin');
        expect(result.available).toBe(0);
        const adminBudget = await budgets.get(companyId, 'companyAdmin');
        expect(adminBudget.available).toBe(1000);
    });

    it('Job signed and inactive talent is reactivated', async () => {
        const response = await wrappedSignJobs.run(signedJobDataWithReactivate);
        expect(response.statusCode).toBe(200);
        const updatedTalent = await companyProvidersService.get(companyId, talentId2);
        expect(updatedTalent.itemStatus).toBe('registered');
    });

    it('Job and milestones are in jobRequest', async () => {
        let response = await jobsService.create(getJobItem(jobId2, entityId, userId, constants.job.status.pending));
        response = await jobsService.create(getMilestoneItem(jobId2, 1, entityId, userId, constants.job.status.pending, 500));
        response = await jobsService.create(getMilestoneItem(jobId2, 2, entityId, userId, constants.job.status.pending, 90));

        const event = createEvent(companyId, entityId, jobId2, userId, talentId);
        response = await wrappedSignJobs.run(event);
        expect(response.statusCode).toBe(200);
        response = await jobsService.get(entityId, `${constants.prefix.job}${jobId2}`);
        expect(response.itemStatus).toBe(constants.job.status.budgetRequest);
        response = await jobsService.get(entityId, `${constants.prefix.milestone}${constants.prefix.job}${jobId2}_${1}`);
        expect(response.itemStatus).toBe(constants.job.status.jobRequest);
        response = await jobsService.get(entityId, `${constants.prefix.milestone}${constants.prefix.job}${jobId2}_${2}`);
        expect(response.itemStatus).toBe(constants.job.status.budgetRequest);

        response = await jobsService.create(getJobItem(jobId3, entityId, userId, constants.job.status.pending));
        response = await jobsService.create(getMilestoneItem(jobId3, 1, entityId, userId, constants.job.status.pending, 500));
        const event2 = createEvent(companyId, entityId, jobId3, userId, talentId);
        response = await wrappedSignJobs.run(event2);
        expect(response.statusCode).toBe(200);
        response = await jobsService.get(entityId, `${constants.prefix.job}${jobId3}`);
        expect(response.itemStatus).toBe(constants.job.status.jobRequest);
        response = await jobsService.get(entityId, `${constants.prefix.milestone}${constants.prefix.job}${jobId3}_${1}`);
        expect(response.itemStatus).toBe(constants.job.status.jobRequest);

        response = await jobsService.create(getJobItem(jobId4, entityId, userId, constants.job.status.pending));
        response = await jobsService.create(getMilestoneItem(jobId4, 1, entityId, userId, constants.job.status.pending, 500));
        response = await jobsService.create(getMilestoneItem(jobId4, 2, entityId, userId, constants.job.status.pending, 600));
        const event3 = createEvent(companyId, entityId, jobId4, companyAdminUserId, talentId);
        response = await wrappedSignJobs.run(event3);
        expect(response.statusCode).toBe(200);
        response = await jobsService.get(entityId, `${constants.prefix.job}${jobId4}`);
        expect(response.itemStatus).toBe(constants.job.status.budgetRequest);
        response = await jobsService.get(entityId, `${constants.prefix.milestone}${constants.prefix.job}${jobId4}_${1}`);
        expect(response.itemStatus).toBe(constants.job.status.budgetRequest);
        expect(response.itemData.jobRequestLevels[0].approvedBy).toBe(companyAdminUserId);
        response = await jobsService.get(entityId, `${constants.prefix.milestone}${constants.prefix.job}${jobId4}_${2}`);
        expect(response.itemStatus).toBe(constants.job.status.jobRequest);
        expect(response.itemData.jobRequestLevels[0].approvedBy).toBe(companyAdminUserId);


    });

    it('Hire talent no duplicate talent', async () => {
        await companyProvidersService.create(talent)
        await companyProvidersService.create(companyProvider)
        const jobResponse = await jobsService.create(getJobItem(jobId5, entityId, userId, constants.job.status.pending));

        const bidItemId = `${jobResponse.itemId}_${bid.itemData.candidate.itemId}`
        const bidToCreate = {
            entityId: entityId, itemId: bidItemId, companyId: companyId, itemData: bid.itemData, userId: userId, createdBy: userId, modifiedBy: userId
        }
        const createBidResult = await bidsService.create(bidToCreate);
        const job = await jobsService.get(entityId, jobResponse.itemId);
        
        expect(_.get(job, 'itemData.talentId')).toBe(undefined);
        await wrappedSignJobs.run(createEvent(companyId, entityId, jobId5, userId, createBidResult.itemId, {providerEmail: TALENT_EMAIL}));
        const jobUpdated = await jobsService.get(entityId, `${constants.prefix.job}${jobId5}`);
        expect(_.get(jobUpdated, 'itemData.talentId')).toBe(talent.itemId);

        await companyProvidersService.delete(companyId, companyProvider.itemId);
        await companyProvidersService.delete(talent.itemId)
        await bidsService.delete(entityId, bidItemId);
        await jobsService.delete(entityId, jobId5);
    });

    afterEach(async () => {
        await companyProvidersService.delete(companyId, talentId);
        await companyProvidersService.delete(companyId, freelancerComTalentId);
        await companyProvidersService.delete(companyId, talentId2);
        await companyProvidersService.delete(companyId, companyProviderId);
        await companyProvidersService.delete(companyId, companyProviderId);
        await jobsService.delete(entityId, secondJobId);
        await jobsService.delete(entityId, jobId);
        await jobsService.delete(entityId, jobId2);
        await jobsService.delete(entityId, jobId3);
        await jobsService.delete(entityId, jobId4);
        await jobsService.delete(entityId, freelancerComJobId);
        await jobsService.delete(entityId, milestoneId_job1_ms1);
        await jobsService.delete(entityId, `${constants.prefix.milestone}${constants.prefix.job}${jobId2}_${2}`);
        await jobsService.delete(entityId, `${constants.prefix.milestone}${constants.prefix.job}${jobId2}_${1}`);
        await jobsService.delete(entityId, `${constants.prefix.milestone}${constants.prefix.job}${jobId3}_${1}`);
        await jobsService.delete(entityId, `${constants.prefix.milestone}${constants.prefix.job}${jobId4}_${1}`);
        await jobsService.delete(entityId, `${constants.prefix.milestone}${constants.prefix.job}${jobId4}_${2}`);
        await jobsService.delete(entityId, milestoneId_job2_ms1);
        await jobsService.delete(entityId, milestoneId_job2_ms1);
        await jobsService.delete(entityId2, jobIdWithTransfer);
        await jobsService.delete(entityId2, milestoneId1WithTransfer);
        await jobsService.delete(entityId2, milestoneId2WithTransfer);
        await jobsService.delete(entityId2, jobForReActivate);
        await jobsService.delete(entityId2, milestoneForReactivate);
        await jobsService.delete(entityId, milestoneId_job2_ms3);
        await usersService.delete(userId, entityId);
        await usersService.delete(userId2, entityId2);
        await usersService.delete(companyAdminUserId, entityId);
        await budgetsService.delete(entityId, userBudget.itemId);
        await budgetsService.delete(entityId2, userBudget2.itemId);
        await budgetsService.delete(entityId, entityBudget.itemId);
        await budgetsService.delete(entityId2, entityBudget2.itemId);
        await budgetsService.delete(entityId, companyBudget.itemId);
        await budgetsService.delete(companyId, companyBudget.itemId);
        await budgetsService.delete(companyAdminBudget.companyId, companyAdminBudget.itemId);
        await users.remove(entityId, 'user1');
        await users.remove(entityId, 'entityAdmin');
        await users.remove(entityId, 'companyAdmin');
        await users.remove(companyId, 'companyAdmin');
        await budgets.remove(entityId, 'user1');
        await budgets.remove(entityId, 'entityAdmin');
        await budgets.remove(entityId, 'companyAdmin');
        await budgets.remove(companyId, 'companyAdmin');
        await jobs.deleteJob(entityId, 'job1');
        await jobs.deleteMilestone(entityId, 'job1', 'ms1');
        await jobs.deleteMilestone(entityId, 'job1', 'ms2');
        await jobs.deleteMilestone(entityId, 'job1', 'ms3');
        await settingsService.delete(companySettings.itemId);
    });
});
