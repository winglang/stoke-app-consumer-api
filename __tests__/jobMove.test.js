/* eslint-disable max-lines-per-function */
'use strict';
const _ = require('lodash');
const AWS = require('aws-sdk');
const mod = require('../src/job/jobMove');
const jestPlugin = require('serverless-jest-plugin');
const moveJob = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'handler' });

const { UsersService, JobsService, constants, BudgetsService, SettingsService, CompaniesService, teamsService, BidsService, CompanyProvidersService } = require('stoke-app-common-api');

const { jobsBucketName } = process.env;

const documentClient = new AWS.DynamoDB.DocumentClient();

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const bidsService = new BidsService(process.env.bidsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const compAdminUserId = 'JEST-MOVE-JOB-COMP-ADMIN-ID';
const companyId = 'JEST-MOVE-JOB-COMP-ID-1';

const userId1 = 'JEST-MOVE-JOB-USER-ID-1';
const userId2 = 'JEST-MOVE-JOB-USER-ID-2';
const userId3 = 'JEST-MOVE-JOB-USER-ID-3';
const userId4 = 'JEST-MOVE-JOB-USER-ID-4';

const entityId1 = 'JEST-MOVE-JOB-ENT-ID-1';
const entityId2 = 'JEST-MOVE-JOB-ENT-ID-2';

const jobId1 = `${constants.prefix.job}JEST-MOVE-JOB-JOB-ID-1`
const jobId1MilestoneId1 = `${constants.prefix.milestone}${jobId1}_MLSTN-ID-1-1`
const jobId1MilestoneId2 = `${constants.prefix.milestone}${jobId1}_MLSTN-ID-1-2`

const jobId2 = `${constants.prefix.job}JEST-MOVE-JOB-JOB-ID-2`
const candidateId1 = `${constants.prefix.talent}JEST-MOVE-JOB-CANDIDATE-ID-1`;
const candidateId2 = `${constants.prefix.talent}JEST-MOVE-JOB-CANDIDATE-ID-2`;
const candidateId3 = `${constants.prefix.talent}JEST-MOVE-JOB-CANDIDATE-ID-3`;
const candidateId4 = `${constants.prefix.talent}JEST-MOVE-JOB-CANDIDATE-ID-4`;
const bidId1 = `${jobId2}_${candidateId1}`
const bidId2 = `${jobId2}_${candidateId2}`
const bidId3 = `${jobId2}_${candidateId3}`
const bidId4 = `${jobId2}_${candidateId4}`

const jobId3 = `${constants.prefix.job}JEST-MOVE-JOB-JOB-ID-3`
const jobId3MilestoneId1 = `${constants.prefix.milestone}${jobId3}_MLSTN-ID-3-1`

const jobId4 = `${constants.prefix.job}JEST-MOVE-JOB-JOB-ID-4`
const jobId5 = `${constants.prefix.job}JEST-MOVE-JOB-JOB-ID-5`
const jobId6 = `${constants.prefix.job}JEST-MOVE-JOB-JOB-ID-6`
const jobId6MilestoneId1 = `${constants.prefix.milestone}${jobId6}_MLSTN-ID-3-1`
const jobId7 = `${constants.prefix.job}JEST-MOVE-JOB-JOB-ID-7`
const jobId7MilestoneId1 = `${constants.prefix.milestone}${jobId7}_MLSTN-ID-3-1`
const jobId7MilestoneId2 = `${constants.prefix.milestone}${jobId7}_MLSTN-ID-3-1`
const jobId7MilestoneId3 = `${constants.prefix.milestone}${jobId7}_MLSTN-ID-3-1`
const jobId8 = `${constants.prefix.job}JEST-MOVE-JOB-JOB-ID-8`

const providerId = 'provider_111_666'
const talentId1 = `talent_${providerId}`;
const companyProvider = {
    companyId,
    itemId: providerId,
    itemStatus: constants.companyProvider.status.registered,
    externalUserId: "p_userid_us-east-1:1234",
    itemData: {
        providerEmail: "israel+israeli@stoketalent.com",
        providerName: "Israel Israeli",
        isProviderSelfEmployedTalent: true,
        status: "registered",
        isPayable: true,
    }
};

const companyProviderTalent1 = {
    companyId,
    itemId: talentId1,
    itemStatus: constants.companyProvider.status.registered,
    itemData: {
        email: "israel+israeli@stoketalent.com",
        firstName: "Israel",
        isProviderSelfEmployedTalent: true,
        lastName: "Israeli",
        name: "Israel Israeli",
        providerId
    }
};

const companySettings = {
    itemId: `${constants.prefix.company}${companyId}`,
    itemData: {
        legalDocs: {
            ipAssignment: `/${jobsBucketName}/defaults/legalDocs/ipAssignment.pdf`,
            nonCompete: `/${jobsBucketName}/defaults/legalDocs/nonCompete.pdf`,
            nda: `/${jobsBucketName}/defaults/legalDocs/nda.pdf`
        }
    }
};

const compAdminEnt1 = {
    entityId: entityId1,
    userId: compAdminUserId,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
    }
};

const compAdminEnt2 = {
    entityId: entityId2,
    userId: compAdminUserId,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
    }
};

const user1 = {
    entityId: entityId1,
    userId: userId1,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user,
        isEditor: true
    }
};

const user2 = {
    entityId: entityId2,
    userId: userId2,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user,
        isEditor: true
    }
};

const user3 = {
    entityId: entityId1,
    userId: userId3,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user,
        isEditor: true
    }
};

const user4 = {
    entityId: companyId,
    userId: userId4,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
    }
};

const job1 = {
    itemId: jobId1,
    entityId: user1.entityId,
    userId: user1.userId,
    companyId,
    itemStatus: constants.job.status.active,
    itemData: {
        totalBudget: 39,
        talentId: 'talent'
    }
};

const job1Mlstn1 = {
    itemId: jobId1MilestoneId1,
    entityId: user1.entityId,
    userId: user1.userId,
    companyId,
    itemStatus: constants.job.status.active,
    itemData: {
        title: 'mlstn-1-1',
        cost: 21,
        date: '2020-07-07T21:40:50.331Z'
    }
};

const job1Mlstn2 = {
    itemId: jobId1MilestoneId2,
    entityId: user1.entityId,
    userId: user1.userId,
    companyId,
    itemStatus: constants.job.status.active,
    itemData: {
        title: 'mlstn-1-2',
        cost: 18,
        date: '2020-07-07T21:41:51.662Z'
    }
};

const user1Budget = {
    entityId: user1.entityId,
    itemId: `${constants.prefix.user}${user1.userId}`,
    companyId,
    itemData: {
        2020:
        {
            periods: 4,
            1: { total: 0, available: 0, approved: 0, pending: 0, committed: 0 },
            2: { total: 0, available: 0, approved: 0, pending: 0, committed: 0 },
            3: { total: 39, available: 461, approved: 0, pending: 0, committed: 39 },
            4: { total: 0, available: 0, approved: 0, pending: 0, committed: 0 }
        }
    }
};

const user2Budget = {
    entityId: user2.entityId,
    itemId: `${constants.prefix.user}${user2.userId}`,
    companyId,
    itemData: {
        2020:
        {
            periods: 4,
            1: { total: 0, available: 0, approved: 0, pending: 0, committed: 0 },
            2: { total: 0, available: 0, approved: 0, pending: 0, committed: 0 },
            3: { total: 0, available: 0, approved: 0, pending: 0, committed: 0 },
            4: { total: 0, available: 0, approved: 0, pending: 0, committed: 0 }
        }
    }
};

const job2 = {
    itemId: jobId2,
    entityId: user1.entityId,
    userId: user1.userId,
    companyId,
    itemStatus: constants.job.status.pending,
    itemData: {
        totalBudget: 0,
        bids: [bidId1, bidId2, bidId3]
    }
};

const bidItem1 = {
    entityId: entityId1,
    itemId: bidId1,
    userId: userId1,
    itemData: { itemId: bidId1, candidate: { itemId: candidateId1 } }
};

const bidItem2 = {
    entityId: entityId1,
    itemId: bidId2,
    userId: userId1,
    itemData: { itemId: bidId2, candidate: { itemId: candidateId2 } }
};

const bidItem3 = {
    entityId: entityId1,
    itemId: bidId3,
    userId: userId1,
    itemData: { itemId: bidId3, candidate: { itemId: candidateId3 } }
};

const job3 = {
    itemId: jobId3,
    entityId: user1.entityId,
    userId: user1.userId,
    companyId,
    itemStatus: constants.job.status.active,
    itemData: {
        totalBudget: 10
    }
};

const job3Mlstn1 = {
    itemId: jobId3MilestoneId1,
    entityId: user1.entityId,
    userId: user1.userId,
    companyId,
    itemStatus: constants.job.status.pendingApproval,
    itemData: {
        title: 'mlstn-3-1',
        cost: 10,
        date: '2020-07-13T21:40:50.331Z'
    }
};

const job4 = {
    itemId: jobId4,
    entityId: user1.entityId,
    userId: user1.userId,
    companyId,
    itemStatus: constants.job.status.active,
    itemData: {
        totalBudget: 10,
        talentId: 'talent_provider_111_222'
    },
    tags: {
        [constants.tags.teams]: ['OldTeam'],
    }
};

const job5 = {
    itemId: jobId5,
    entityId: user1.entityId,
    userId: user1.userId,
    companyId,
    itemStatus: constants.job.status.draft,
    itemData: {
        totalBudget: 10,
    },
    tags: {
        [constants.tags.teams]: ['OldTeam'],
    }
};

const job6 = {
    itemId: jobId6,
    entityId: user2.entityId,
    userId: user2.userId,
    companyId,
    itemStatus: constants.job.status.active,
    itemData: {
        totalBudget: 10,
        talentId: talentId1
    },
    tags: {
        [constants.tags.teams]: ['OldTeam'],
        "Custom tag field": [
            "No"
        ],
        "Custom text field": "text",
    }
};
const job6Mlstn1 = {
    itemId: jobId6MilestoneId1,
    entityId: user2.entityId,
    userId: user2.userId,
    companyId,
    itemStatus: constants.job.status.active,
    itemData: {
        title: 'mlstn-6-1',
        cost: 10,
        date: '2020-07-13T21:40:50.331Z'
    },
    tags: {
        "Milestone tags custom field": [
            "True"
        ],
        "Milestone text custom field": "test1"
    },
};


const job7 = {
    itemId: jobId7,
    entityId: user2.entityId,
    userId: user2.userId,
    companyId,
    itemStatus: constants.job.status.active,
    itemData: {
        totalBudget: 10,
        talentId: talentId1
    }
};
const job7Mlstn1 = {
    itemId: jobId7MilestoneId1,
    entityId: user2.entityId,
    userId: user2.userId,
    companyId,
    itemStatus: constants.job.status.paid,
    itemData: {
        title: 'mlstn-7-1',
        cost: 10,
        date: '2020-07-13T21:40:50.331Z'
    }
};
const job7Mlstn2 = {
    itemId: jobId7MilestoneId2,
    entityId: user2.entityId,
    userId: user2.userId,
    companyId,
    itemStatus: constants.job.status.requested,
    itemData: {
        title: 'mlstn-7-2',
        cost: 10,
        isRejected: true,
        date: '2020-07-13T21:40:50.331Z'
    }
};

const job7Mlstn3 = {
    itemId: jobId7MilestoneId3,
    entityId: user2.entityId,
    userId: user2.userId,
    companyId,
    itemStatus: constants.job.status.active,
    itemData: {
        title: 'mlstn-7-3',
        cost: 10,
        date: '2020-07-13T21:40:50.331Z'
    }
};

const job8 = {
    itemId: jobId8,
    entityId: user1.entityId,
    userId: user1.userId,
    companyId,
    itemStatus: constants.job.status.active,
    itemData: {
        totalBudget: 39,
        talentId: 'talent'
    }
};

const ent1 = {
    itemId: constants.prefix.entity + user1.entityId,
    createdBy: compAdminUserId,
    modifiedBy: compAdminUserId,
};
teamsService.set(ent1, ['OldTeam', 'NewTeam1']);

const ent2 = {
    itemId: constants.prefix.entity + user2.entityId,
    createdBy: compAdminUserId,
    modifiedBy: compAdminUserId,
};
teamsService.set(ent2, ['NewTeam2']);

describe('jobMove', () => {
    beforeEach(async () => {
        let response = await jobsService.create(job1);
        expect(response.itemId).toEqual(job1.itemId);
        response = await jobsService.create(job1Mlstn1);
        expect(response.itemId).toEqual(job1Mlstn1.itemId);
        response = await jobsService.create(job1Mlstn2);
        expect(response.itemId).toEqual(job1Mlstn2.itemId);
        response = await jobsService.create(job2);
        expect(response.itemId).toEqual(job2.itemId);
        response = await jobsService.create(job3);
        expect(response.itemId).toEqual(job3.itemId);
        response = await jobsService.create(job3Mlstn1);
        expect(response.itemId).toEqual(job3Mlstn1.itemId);
        response = await jobsService.create(job4);
        expect(response.itemId).toEqual(job4.itemId);
        response = await jobsService.create(job5);
        expect(response.itemId).toEqual(job5.itemId);
        response = await jobsService.create(job6);
        expect(response.itemId).toEqual(job6.itemId);
        response = await jobsService.create(job6Mlstn1);
        expect(response.itemId).toEqual(job6Mlstn1.itemId);

        response = await jobsService.create(job7);
        expect(response.itemId).toEqual(job7.itemId);
        response = await jobsService.create(job8);
        expect(response.itemId).toEqual(job8.itemId);
        response = await jobsService.create(job7Mlstn1);
        expect(response.itemId).toEqual(job7Mlstn1.itemId);
        response = await jobsService.create(job7Mlstn2);
        expect(response.itemId).toEqual(job7Mlstn2.itemId);
        response = await jobsService.create(job7Mlstn3);
        expect(response.itemId).toEqual(job7Mlstn3.itemId);

        response = await usersService.create(compAdminEnt1);
        expect(response.userId).toEqual(compAdminEnt1.userId);
        response = await usersService.create(compAdminEnt2);
        expect(response.userId).toEqual(compAdminEnt2.userId);
        response = await usersService.create(user1);
        expect(response.userId).toEqual(user1.userId);
        response = await usersService.create(user2);
        expect(response.userId).toEqual(user2.userId);
        response = await usersService.create(user3);
        expect(response.userId).toEqual(user3.userId);
        response = await usersService.create(user4);
        expect(response.userId).toEqual(user4.userId);
        response = await settingsService.create(companySettings);
        expect(response.itemId).toEqual(companySettings.itemId);
        response = await budgetsService.create(user1Budget);
        expect(response.itemId).toEqual(user1Budget.itemId);
        response = await budgetsService.create(user2Budget);
        expect(response.itemId).toEqual(user2Budget.itemId);

        response = await bidsService.create(bidItem1);
        expect(response.itemData).toMatchObject(bidItem1.itemData);
        response = await bidsService.create(bidItem2);
        expect(response.itemData).toMatchObject(bidItem2.itemData);
        response = await bidsService.create(bidItem3);
        expect(response.itemData).toMatchObject(bidItem3.itemData);

        await companiesService.create(ent1);
        await companiesService.create(ent2);

        await companyProvidersService.create(companyProvider);
        await companyProvidersService.create(companyProviderTalent1);

    });

    afterEach(async () => {
        await jobsService.delete(job1.entityId, job1.itemId);
        await jobsService.delete(job1Mlstn1.entityId, job1Mlstn1.itemId);
        await jobsService.delete(job1Mlstn2.entityId, job1Mlstn2.itemId);
        await jobsService.delete(job2.entityId, job2.itemId);
        await jobsService.delete(job3.entityId, job3.itemId);
        await jobsService.delete(job3Mlstn1.entityId, job3Mlstn1.itemId);
        await jobsService.delete(job4.entityId, job4.itemId);
        await jobsService.delete(job5.entityId, job5.itemId);
        await jobsService.delete(job6.entityId, job6.itemId);
        await jobsService.delete(job6Mlstn1.entityId, job6Mlstn1.itemId);
        await jobsService.delete(job7.entityId, job7.itemId);
        await jobsService.delete(job7Mlstn1.entityId, job7Mlstn1.itemId);
        await jobsService.delete(job7Mlstn2.entityId, job7Mlstn2.itemId);
        await jobsService.delete(job7Mlstn3.entityId, job7Mlstn3.itemId);

        await bidsService.delete(bidItem1.entityId, bidItem1.itemId);
        await bidsService.delete(bidItem2.entityId, bidItem2.itemId);
        await bidsService.delete(bidItem3.entityId, bidItem3.itemId);

        await usersService.delete(compAdminEnt1.userId, compAdminEnt1.entityId);
        await usersService.delete(compAdminEnt2.userId, compAdminEnt2.entityId);
        await usersService.delete(user1.userId, user1.entityId);
        await usersService.delete(user2.userId, user2.entityId);
        await usersService.delete(user3.userId, user3.entityId);
        await usersService.delete(user4.userId, user4.entityId);
        await settingsService.delete(companySettings.itemId);
        await budgetsService.delete(user1Budget.entityId, user1Budget.itemId);
        await budgetsService.delete(user2Budget.entityId, user2Budget.itemId);

        await companiesService.delete(ent1.itemId);
        await companiesService.delete(ent2.itemId);

        await companyProvidersService.delete(companyProvider.companyId, companyProvider.itemId);
        await companyProvidersService.delete(companyProviderTalent1.companyId, companyProviderTalent1.itemId);
    });

    it('move job, expect successfull move, 200', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user2.entityId,
                targetUserId: user2.userId,
                jobIds: job1.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const moveJobTime = new Date().getTime();
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(200);
        let jobs = await jobsService.list(user2.entityId, user2.userId, constants.prefix.job);
        jobs = jobs.filter((job) => job.createdAt > moveJobTime);
        expect(jobs.length).toEqual(1);
        const [movedJob] = jobs;
        expect(movedJob).toMatchObject({
            companyId,
            createdBy: compAdminUserId,
            entityId: user2.entityId,
            itemData: {
                totalBudget: 0,
                jobMovedData: {
                    srcEntityId: 'JEST-MOVE-JOB-ENT-ID-1',
                    srcJobId: 'job_JEST-MOVE-JOB-JOB-ID-1',
                    srcUserId: 'JEST-MOVE-JOB-USER-ID-1'
                }
            },
            itemStatus: constants.job.status.budgetRequest,
            modifiedBy: compAdminUserId,
            userId: user2.userId
        });
        let milestones = await jobsService.list(user2.entityId, user2.userId, constants.prefix.milestone);
        milestones = milestones.filter((job) => job.createdAt > moveJobTime);
        expect(milestones.length).toEqual(2);
        expect(milestones).toMatchObject([
            {
                companyId,
                createdBy: compAdminUserId,
                entityId: user2.entityId,
                itemData: {
                    cost: 21,
                    title: 'mlstn-1-1'
                },
                itemStatus: constants.job.status.budgetRequest,
                modifiedBy: compAdminUserId,
                userId: user2.userId
            },
            {
                companyId,
                createdBy: compAdminUserId,
                entityId: user2.entityId,
                itemData: {
                    cost: 18,
                    title: 'mlstn-1-2'
                },
                itemStatus: constants.job.status.budgetRequest,
                modifiedBy: compAdminUserId,
                userId: user2.userId
            }
        ]);
        const origJob = await jobsService.get(job1.entityId, job1.itemId);
        expect(origJob.itemStatus).toEqual(constants.job.status.archived);
        expect(origJob.itemData.newJobId).toEqual(movedJob.itemId);
        expect(origJob.itemData.newEntityId).toEqual(movedJob.entityId);
    });

    it('move pending job with bids and no milestones, expect successful move, 200', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user2.entityId,
                targetUserId: user2.userId,
                jobIds: job2.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const moveJobTime = new Date().getTime();
        let response = await moveJob.run(event);
        expect(response.statusCode).toBe(200);
        let jobs = await jobsService.list(user2.entityId, user2.userId, constants.prefix.job);
        jobs = jobs.filter((job) => job.createdAt > moveJobTime);
        expect(jobs.length).toEqual(1);
        const [movedJob] = jobs;
        expect(movedJob).toMatchObject({
            companyId,
            createdBy: compAdminUserId,
            entityId: user2.entityId,
            itemData: {
                bids: documentClient.createSet([
                    `${movedJob.itemId}_${candidateId1}`,
                    `${movedJob.itemId}_${candidateId2}`,
                    `${movedJob.itemId}_${candidateId3}`,
                ]),
                totalBudget: 0,
            },
            itemStatus: constants.job.status.pending,
            modifiedBy: compAdminUserId,
            userId: user2.userId
        });
        await usersService.update({
            userId: compAdminEnt1.userId, entityId: compAdminEnt1.entityId, modifiedBy: compAdminEnt1.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: false
            }
        })
        response = await moveJob.run(event);
        expect(response.statusCode).toBe(403);
        await usersService.update({
            userId: compAdminEnt1.userId, entityId: compAdminEnt1.entityId, modifiedBy: compAdminEnt1.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        })
        await usersService.update({
            userId: user2.userId, entityId: user2.entityId, modifiedBy: user2.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: false
            }
        })
        response = await moveJob.run(event);
        expect(response.statusCode).toBe(403);
        await usersService.update({
            userId: user2.userId, entityId: user2.entityId, modifiedBy: user2.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        })
    });

    it('move draft job with no bids or milestones, expect successful move, 200', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user2.entityId,
                targetUserId: user2.userId,
                jobIds: jobId5,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const moveJobTime = new Date().getTime();
        let response = await moveJob.run(event);
        expect(response.statusCode).toBe(200);
        let jobs = await jobsService.list(user2.entityId, user2.userId, constants.prefix.job);
        jobs = jobs.filter((job) => job.createdAt > moveJobTime);
        expect(jobs.length).toEqual(1);
        const [movedJob] = jobs;
        expect(movedJob).toMatchObject({
            companyId,
            createdBy: compAdminUserId,
            entityId: user2.entityId,
            itemData: {
                totalBudget: 0,
            },
            itemStatus: constants.job.status.draft,
            modifiedBy: compAdminUserId,
            userId: user2.userId
        });
        await usersService.update({
            userId: compAdminEnt1.userId, entityId: compAdminEnt1.entityId, modifiedBy: compAdminEnt1.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: false
            }
        })
        response = await moveJob.run(event);
        expect(response.statusCode).toBe(403);
        await usersService.update({
            userId: compAdminEnt1.userId, entityId: compAdminEnt1.entityId, modifiedBy: compAdminEnt1.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        })
        await usersService.update({
            userId: user2.userId, entityId: user2.entityId, modifiedBy: user2.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: false
            }
        })
        response = await moveJob.run(event);
        expect(response.statusCode).toBe(403);
        await usersService.update({
            userId: user2.userId, entityId: user2.entityId, modifiedBy: user2.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        })
    });

    it('move job to company instead of entity, expect failure, 500', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user4.companyId,
                targetUserId: user4.userId,
                jobIds: job2.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: user4.userId
                }
            },
        };
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({ status: false});

    });

    it('move job from company instead of entity, expect failure, 500', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.companyId,
                targetEntityId: user2.entityId,
                targetUserId: user2.userId,
                jobIds: job2.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({ status: false});
    });

    it('move job without specifying job id, expect failure, 500', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user2.entityId,
                targetUserId: user2.userId
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            }
        };
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(500);
    });

    it('move job without specifying target user id, expect failure, 500', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user2.entityId,
                jobIds: job2.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(500);
    });

    it('move job without specifying target entity id, expect failure, 500', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetUserId: user2.userId,
                jobIds: job2.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(500);
    });

    it('move job without specifying source entity id, expect failure, 500', async () => {
        const event = {
            body: JSON.stringify({
                targetEntityId: user2.entityId,
                targetUserId: user2.userId,
                jobIds: job2.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(500);
    });

    it('move job with a pending approval milestone, expect failure, 500', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user2.entityId,
                targetUserId: user2.userId,
                jobIds: job3.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({ status: false});
    });

    it('move job with same source and target user + entity, expect failure, 500', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user1.entityId,
                targetUserId: user1.userId,
                jobIds: job3.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({ status: false});
    });

    it('move job with same source and target user + entity + teams, expect failure, 500', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user1.entityId,
                targetUserId: user1.userId,
                targetTeams: ['OldTeam'],
                jobIds: job4.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({ status: false});
    });

    it('move job to another team in the same entity - successful', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user1.entityId,
                targetUserId: user1.userId,
                targetTeams: ['NewTeam1'],
                jobIds: job4.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(200);

        const job = await jobsService.get(user1.entityId, job4.itemId);
        const teams = teamsService.get(job);
        expect(teams).toEqual(['NewTeam1']);
    });

    it('move job to another team in the another entity - successful', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user2.entityId,
                targetUserId: user2.userId,
                targetTeams: ['NewTeam2'],
                jobIds: job4.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };

        const moveJobTime = new Date().getTime();
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(200);
        let jobs = await jobsService.list(user2.entityId, user2.userId, constants.prefix.job);
        jobs = jobs.filter((job) => job.createdAt > moveJobTime);
        expect(jobs.length).toEqual(1);
        const [movedJob] = jobs;
        expect(movedJob).toMatchObject({
            companyId,
            createdBy: compAdminUserId,
            entityId: user2.entityId,
            itemStatus: constants.job.status.active,
            itemData: {
                totalBudget: 0
            },
            modifiedBy: compAdminUserId,
            userId: user2.userId
        });

        const teams = teamsService.get(movedJob);
        expect(teams).toEqual(['NewTeam2']);
    });

    it('move job to another entity and target team does not exist - error', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user2.entityId,
                targetUserId: user2.userId,
                targetTeams: ['NewTeam2', 'TeamDoesNotExist'],
                jobIds: job4.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };

        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({ status: false});
    });

    it('move job with tags and milestones with tags', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user2.entityId,
                targetEntityId: user3.entityId,
                targetUserId: user3.userId,
                targetTeams: ['NewTeam1'],
                jobIds: job6.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };

        const response = await moveJob.run(event);
        let responseObj = JSON.parse(response.body);
        let tags = _.get(responseObj, 'tags', {});
        expect(tags).toEqual({
            "Custom tag field": [
                "No"
            ],
            "__stoke__teams": [
                "NewTeam1"
            ],
            "Custom text field": "text"
        });
        const { entityId, itemId } = responseObj;
        const [milestoneWithTag] = await jobsService.list(entityId, user3.userId, 'ms_');
        tags = _.get(milestoneWithTag, 'tags', {});
        expect(tags).toEqual(job6Mlstn1.tags);
    });

    it('move job ignores rejected requested milestone and do not clone it', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user2.entityId,
                targetEntityId: user3.entityId,
                targetUserId: user3.userId,
                jobIds: job7.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };

        const response = await moveJob.run(event);
        let responseObj = JSON.parse(response.body);

        let { itemId: jobId, entityId } = responseObj;
        const milestones = await jobsService.list(entityId, null, `${constants.prefix.milestone}${jobId}`);
        const milestoneSize = milestones.length;
        expect(milestoneSize).toEqual(1);
    });

    it('move job, jobId Array but not srcEntityId, 500', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user2.entityId,
                targetUserId: user2.userId,
                jobIds: [job1.itemId, job2.itemId],
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(500);
    });

    it('move job, srcEntityId Array but not jobId, 500', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: [user1.entityId, user2.entityId],
                targetEntityId: user2.entityId,
                targetUserId: user2.userId,
                jobIds: job1.itemId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(500);
    });

    it('move job and keep original open, expect successfull move, 200', async () => {
        const event = {
            body: JSON.stringify({
                srcEntityIds: user1.entityId,
                targetEntityId: user2.entityId,
                targetUserId: user2.userId,
                jobIds: job8.itemId,
                isKeepOriginalJobOpen: true,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: compAdminUserId
                }
            },
        };
        const moveJobTime = new Date().getTime();
        const response = await moveJob.run(event);
        expect(response.statusCode).toBe(200);
        let jobs = await jobsService.list(user2.entityId, user2.userId, constants.prefix.job);
        jobs = jobs.filter((job) => job.createdAt > moveJobTime);
        expect(jobs.length).toEqual(1);
        const [movedJob] = jobs;
        expect(movedJob).toMatchObject({
            companyId,
            createdBy: compAdminUserId,
            entityId: user2.entityId,
            itemData: {
                totalBudget: 0,
                jobMovedData: {
                    srcEntityId: 'JEST-MOVE-JOB-ENT-ID-1',
                    srcJobId: 'job_JEST-MOVE-JOB-JOB-ID-8',
                    srcUserId: 'JEST-MOVE-JOB-USER-ID-1'
                }
            },
            itemStatus: constants.job.status.active,
            modifiedBy: compAdminUserId,
            userId: user2.userId
        });
        const origJob = await jobsService.get(job1.entityId, job1.itemId);
        expect(origJob.itemStatus).toEqual(constants.job.status.active);
    });
});
