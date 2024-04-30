'use strict';

// tests for deleteJob
const { constants, SettingsService, UsersService, JobsService, permisionConstants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const mod = require('../src/jobs');
const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrappedArchiveJob = lambdaWrapper.wrap(mod, { handler: 'archiveJob' });

const companyId = 'JEST-TEST-REM-JOB-COMPANY-ID-1';
const entityId = 'JEST-TEST-REM-JOB-ENT-ID-1';
const userId = 'JEST-TEST-REM-JOB-USER-ID-1';
const userId2 = 'JEST-TEST-REM-JOB-USER-ID-2';
const userId3 = 'JEST-TEST-REM-JOB-USER-ID-3';
const jobId1 = 'JEST-TEST-REM-JOB-ID-1';
const jobId2 = 'JEST-TEST-REM-JOB-ID-2';
const jobId3 = 'JEST-TEST-REM-JOB-ID-3';
const milstoneId1 = `${constants.prefix.milestone}${jobId1}_'JEST-TEST-REM-milestone-ID-1`;
const milstoneId2 = `${constants.prefix.milestone}${jobId1}_'JEST-TEST-REM-milestone-ID-2`;
const milstoneId3 = `${constants.prefix.milestone}${jobId2}_'JEST-TEST-REM-milestone-ID-3`;
const milstoneId4 = `${constants.prefix.milestone}${jobId2}_'JEST-TEST-REM-milestone-ID-4`;
const milstoneId5 = `${constants.prefix.milestone}${jobId3}_'JEST-TEST-REM-milestone-ID-5`;
const milstoneId6 = `${constants.prefix.milestone}${jobId3}_'JEST-TEST-REM-milestone-ID-6`;

const user = {
    userId,
    entityId,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.user, isEditor: true }
};

const user2 = {
    userId: userId2,
    entityId,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.admin, permissionsComponents: { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } } }
};

const user3 = {
    userId: userId3,
    entityId,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.user, isEditor: true }
};


const jobItem = {
    companyId,
    entityId,
    itemId: jobId1,
    userId: userId,
    itemStatus: constants.job.status.active
};

const milestonItem1 = {
    companyId,
    entityId,
    itemId: milstoneId1,
    userId: userId,
    itemStatus: constants.job.status.active
};

const milestonItem2 = {
    companyId,
    entityId,
    itemId: milstoneId2,
    userId: userId,
    itemStatus: constants.job.status.active
};

const jobItem2 = {
    companyId,
    entityId,
    itemId: jobId2,
    userId: userId,
    itemStatus: constants.job.status.active
};

const milestonItem3 = {
    companyId,
    entityId,
    itemId: milstoneId3,
    userId: userId,
    itemStatus: constants.job.status.pendingApproval
};

const milestonItem4 = {
    companyId,
    entityId,
    itemId: milstoneId4,
    userId: userId,
    itemStatus: constants.job.status.active
};

const jobItem3 = {
    companyId,
    entityId,
    itemId: jobId3,
    userId: userId,
    itemStatus: constants.job.status.active
};

const milestonItem5 = {
    companyId,
    entityId,
    itemId: milstoneId5,
    userId: userId,
    itemStatus: constants.job.status.active
};

const milestonItem6 = {
    companyId,
    entityId,
    itemId: milstoneId6,
    userId: userId,
    itemStatus: constants.job.status.active
};



const event = {
    body: JSON.stringify({ companyId, entityId }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    pathParameters: {
        id: jobId1
    },
};

const eventAdmin = {
    body: JSON.stringify({ companyId, entityId }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId2
        }
    },
    pathParameters: {
        id: jobId1
    },
};

const eventMilestoneAdmin = {
    body: JSON.stringify({ companyId, entityId }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId2
        }
    },
    pathParameters: {
        id: milstoneId4
    },
};

const eventNotAllow = {
    body: JSON.stringify({ companyId, entityId }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId3
        }
    },
    pathParameters: {
        id: jobId1
    },
};

const event500 = {
    body: JSON.stringify({ companyId, entityId }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    pathParameters: {
        id: jobId2
    },
};

const bulkEvent = {
    body: JSON.stringify({ companyId, ids: [{ itemId: jobId1, entityId }, { itemId: jobId3, entityId }] }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    pathParameters: {},
};

const bulkEventAdmin = {
    body: JSON.stringify({ companyId, ids: [{ itemId: jobId1, entityId }, { itemId: jobId3, entityId }] }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId2
        }
    },
    pathParameters: {},
};

const bulkEventMilestoneAdmin = {
    body: JSON.stringify({ companyId, ids: [{ itemId: milstoneId5, entityId }] }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId2
        }
    },
    pathParameters: {},
};

const bulkEventNotAllow = {
    body: JSON.stringify({ companyId, ids: [{ itemId: jobId1, entityId }] }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId3
        }
    },
    pathParameters: {},
};

const bulkEvent500 = {
    body: JSON.stringify({ companyId, ids: [{ itemId: jobId2, entityId }] }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    pathParameters: {},
};


describe('archiveJob', () => {
    beforeEach(async () => {
        let result = await usersService.create(user);
        expect(result).toEqual(user);
        result = await usersService.create(user2);
        expect(result).toEqual(user2);
        result = await usersService.create(user3);
        expect(result).toEqual(user3);
        result = await jobsService.create(jobItem);
        expect(result).toEqual(jobItem);
        result = await jobsService.create(jobItem2);
        expect(result).toEqual(jobItem2);
        result = await jobsService.create(milestonItem3);
        expect(result).toEqual(milestonItem3);
        result = await jobsService.create(milestonItem4);
        expect(result).toEqual(milestonItem4);
        result = await jobsService.create(milestonItem1);
        expect(result).toEqual(milestonItem1);
        result = await jobsService.create(milestonItem2);
        expect(result).toEqual(milestonItem2);
        result = await jobsService.create(jobItem3);
        expect(result).toEqual(jobItem3);
        result = await jobsService.create(milestonItem5);
        expect(result).toEqual(milestonItem5);
        result = await jobsService.create(milestonItem6);
        expect(result).toEqual(milestonItem6);
    });


    it('archive wrong job, expect 403', async () => {
        let response = await wrappedArchiveJob.run(eventNotAllow)
        expect(response.statusCode).toBe(403);
        response = await wrappedArchiveJob.run(bulkEventNotAllow)
        expect(response.statusCode).toBe(403);
    });

    it('archive job post, expect 500', async () => {
        let response = await wrappedArchiveJob.run(event500);
        expect(response.statusCode).toBe(500);
        response = await wrappedArchiveJob.run(bulkEvent500);
        expect(response.statusCode).toBe(500);
    });


    it('archive job, expect 200, user role', async () => {
        let response = await wrappedArchiveJob.run(event)
        expect(response.statusCode).toBe(200);
        response = await jobsService.get(entityId, jobId1)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, milstoneId1)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, milstoneId2)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        await usersService.update({
            userId: user.userId, entityId: user.entityId, modifiedBy: user.userId, itemData: {
                userRole: constants.user.role.user,
                isEditor: false
            }
        })
        response = await wrappedArchiveJob.run(event)
        expect(response.statusCode).toBe(403);
    });

    it('archive job, expect 200, admin role', async () => {
        let response = await wrappedArchiveJob.run(eventAdmin)
        expect(response.statusCode).toBe(200);
        response = await jobsService.get(entityId, jobId1)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, milstoneId1)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, milstoneId2)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        await usersService.update({
            userId: user2.userId, entityId: user2.entityId, modifiedBy: user2.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: false
            }
        })
        response = await wrappedArchiveJob.run(eventAdmin)
        expect(response.statusCode).toBe(403);
        await usersService.update({
            userId: user2.userId, entityId: user2.entityId, modifiedBy: user2.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        })
    });

    it('archive milestone, expect 200, admin role', async () => {
        let response = await wrappedArchiveJob.run(eventMilestoneAdmin)
        expect(response.statusCode).toBe(200);
        response = await jobsService.get(entityId, milstoneId4)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        await usersService.update({
            userId: user2.userId, entityId: user2.entityId, modifiedBy: user2.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: false
            }
        })
        response = await wrappedArchiveJob.run(eventAdmin)
        expect(response.statusCode).toBe(403);
    });

    it('bulk archive job, expect 200, user role', async () => {
        let response = await wrappedArchiveJob.run(bulkEvent)
        expect(response.statusCode).toBe(200);
        response = await jobsService.get(entityId, jobId1)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, milstoneId1)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, milstoneId2)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, jobId3)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, milstoneId5)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, milstoneId6)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        await usersService.update({
            userId: user.userId, entityId: user.entityId, modifiedBy: user.userId, itemData: {
                userRole: constants.user.role.user,
                isEditor: false
            }
        })
        response = await wrappedArchiveJob.run(bulkEvent)
        expect(response.statusCode).toBe(403);
    });

    it('bulk archive job, expect 200, admin role', async () => {
        let response = await wrappedArchiveJob.run(bulkEventAdmin)
        expect(response.statusCode).toBe(200);
        response = await jobsService.get(entityId, jobId1)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, milstoneId1)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, milstoneId2)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, jobId3)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, milstoneId5)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        response = await jobsService.get(entityId, milstoneId6)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        await usersService.update({
            userId: user2.userId, entityId: user2.entityId, modifiedBy: user2.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: false
            }
        })
        response = await wrappedArchiveJob.run(bulkEventAdmin)
        expect(response.statusCode).toBe(403);
        await usersService.update({
            userId: user2.userId, entityId: user2.entityId, modifiedBy: user2.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        })
    });

    it('bulk archive milestone, expect 200, admin role', async () => {
        let response = await wrappedArchiveJob.run(bulkEventMilestoneAdmin)
        expect(response.statusCode).toBe(200);
        response = await jobsService.get(entityId, milstoneId5)
        expect(response.itemStatus).toBe(constants.itemStatus.archived);
        await usersService.update({
            userId: user2.userId, entityId: user2.entityId, modifiedBy: user2.userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: false
            }
        })
        response = await wrappedArchiveJob.run(bulkEventAdmin)
        expect(response.statusCode).toBe(403);
    });

    afterAll(async () => {
        //cleanup
        let result = await jobsService.delete(entityId, jobId1);
        expect(result).toBe(true);
        result = await jobsService.delete(entityId, jobId2);
        expect(result).toBe(true);
        result = await jobsService.delete(entityId, jobId3);
        expect(result).toBe(true);
        result = await jobsService.delete(entityId, milstoneId1);
        expect(result).toBe(true);
        result = await jobsService.delete(entityId, milstoneId2);
        expect(result).toBe(true);
        result = await jobsService.delete(entityId, milstoneId3);
        expect(result).toBe(true);
        result = await jobsService.delete(entityId, milstoneId4);
        expect(result).toBe(true);
        result = await jobsService.delete(entityId, milstoneId5);
        expect(result).toBe(true);
        result = await jobsService.delete(entityId, milstoneId6);
        expect(result).toBe(true);
        result = await usersService.delete(userId, entityId);
        expect(result).toBeTruthy();
        result = await usersService.delete(userId2, entityId);
        expect(result).toBeTruthy();
        result = await usersService.delete(userId3, entityId);
        expect(result).toBeTruthy();
    });
});

