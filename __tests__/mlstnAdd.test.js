'use strict';
// tests for createMilestones

const jobs = require('../src/jobs');
const { JobsService, UsersService, constants, permisionConstants } = require('stoke-app-common-api');
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const jestPlugin = require('serverless-jest-plugin');
const createMilestones = jestPlugin.lambdaWrapper.wrap(jobs, { handler: 'createMilestones' });


const user = {
    userId: 'CREATE-MILESTONES-JEST-TEST-USER-ID-1',
    entityId: 'CREATE-MILESTONES-JEST-TEST-ENT-ID-1',
    companyId: 'CREATE-MILESTONES-JEST-TEST-COMPANY-ID-1',
    createdBy: 'CREATE-MILESTONES-JEST-TEST-USER-ID-1',
    modifiedBy: 'CREATE-MILESTONES-JEST-TEST-USER-ID-1',
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user,
        permissionsComponents: { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } }
    }
};

const user2 = {
    userId: 'CREATE-MILESTONES-JEST-TEST-USER-ID-2',
    entityId: 'CREATE-MILESTONES-JEST-TEST-ENT-ID-1',
    companyId: 'CREATE-MILESTONES-JEST-TEST-COMPANY-ID-1',
    createdBy: 'CREATE-MILESTONES-JEST-TEST-USER-ID-2',
    modifiedBy: 'CREATE-MILESTONES-JEST-TEST-USER-ID-2',
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user,
        isEditor: true
    }
};

const job = {
    entityId: 'CREATE-MILESTONES-JEST-TEST-ENT-ID-1',
    itemId: 'CREATE-MILESTONES-JEST-TEST-JOB-ID-1',
    userId: 'CREATE-MILESTONES-JEST-TEST-USER-ID-1',
    itemData: {
        title: 'JOB-TITLE',
        category: 'JOB-CATEGORY',
        requiredSkills: [{ value: 'eng2', label: 'eng2' }],
        totalBudget: 1000
    }
};

const createMilestoneEventBody = {
    parentJobId: 'CREATE-MILESTONES-JEST-TEST-JOB-ID-1',
    entityId: 'CREATE-MILESTONES-JEST-TEST-ENT-ID-1',
    milestones: [
        {
            itemData: {
                title: 'MILESTONE-TITLE',
                cost: 100
            },
            itemStatus: constants.job.status.pending
        }
    ]
};


const createMilestoneEvent = {
    body: JSON.stringify(createMilestoneEventBody),
    requestContext: {
        identity: {
            cognitoIdentityId: 'CREATE-MILESTONES-JEST-TEST-USER-ID-1'
        }
    },
    pathParameters: {
        id: ''
    }
};


const createSomeoneElseMilestoneEvent = {
    body: JSON.stringify(createMilestoneEventBody),
    requestContext: {
        identity: {
            cognitoIdentityId: 'CREATE-MILESTONES-JEST-TEST-USER-ID-2'
        }
    },
    pathParameters: {
        id: ''
    }
};

const unauthorisedCreateMilestoneEventBody = {
    parentJobId: 'CREATE-MILESTONES-JEST-TEST-JOB-ID-1',
    entityId: 'CREATE-MILESTONES-JEST-TEST-ENT-ID-1',
    milestones: [
        {
            itemData: {
                title: 'MILESTONE-TITLE'
            }
        }
    ]
};

const unauthorisedCreateMilestoneEvent = {
    body: JSON.stringify(unauthorisedCreateMilestoneEventBody),
    requestContext: {
        identity: {
            cognitoIdentityId: 'CREATE-MILESTONES-JEST-TEST-USER-ID-3'
        }
    },
    pathParameters: {
        id: ''
    }
};



const expectedMilestone = {
    companyId: "CREATE-MILESTONES-JEST-TEST-COMPANY-ID-1",
    createdBy: "CREATE-MILESTONES-JEST-TEST-USER-ID-1",
    entityId: "CREATE-MILESTONES-JEST-TEST-ENT-ID-1",
    itemData: {
      title: "MILESTONE-TITLE",
      cost: 100
    },
    itemStatus: constants.job.status.pending,
    modifiedBy: "CREATE-MILESTONES-JEST-TEST-USER-ID-1",
    userId: "CREATE-MILESTONES-JEST-TEST-USER-ID-1",
};


const expectedJob = {
    entityId: 'CREATE-MILESTONES-JEST-TEST-ENT-ID-1',
    itemId: 'CREATE-MILESTONES-JEST-TEST-JOB-ID-1',
    userId: 'CREATE-MILESTONES-JEST-TEST-USER-ID-1',
    itemData: {
        title: 'JOB-TITLE',
        category: 'JOB-CATEGORY',
        requiredSkills: [{ value: 'eng2', label: 'eng2' }],
        totalBudget: 1100
    }
};

let createdMilestoneId;

describe('createMilestones', () => {
    beforeAll(async () => {
        let response = await usersService.create(user);
        expect(response.userId).toBe(user.userId);
        response = await usersService.create(user2);
        expect(response.userId).toBe(user2.userId);
        response = await jobsService.create(job);
        expect(response.itemId).toBe(job.itemId);
    });

    
    it('createMilestones, expect 200, data', async () => {
        let response = await createMilestones.run(createMilestoneEvent);
        expect(response.statusCode).toBe(200);
        let responseObj = JSON.parse(response.body);
        expect(responseObj.TransactItems.length).toEqual(1);
        expect(responseObj.TransactItems[0].Put).toBeTruthy();
        const createdMilestone = responseObj.TransactItems[0].Put.Item;
        expect(createdMilestone).toMatchObject(expectedMilestone);
        expect(createdMilestone.itemData.jobId).toBeTruthy();
        expect(createdMilestone.itemData.jobId.length).toBeTruthy();
        createdMilestoneId = createdMilestone.itemId;
        expect(createdMilestoneId.startsWith(`${constants.prefix.milestone}${createMilestoneEventBody.parentJobId}_`)).toBeTruthy();
        response = await jobsService.get(job.entityId, createdMilestoneId);
        expect(response.itemData.jobId).toBe(job.itemId);
        response = await jobsService.get(job.entityId, job.itemId);
        expect(response.itemData.totalBudget).toBe(expectedJob.itemData.totalBudget);       
        await usersService.update({ userId: user.userId, entityId: user.entityId, modifiedBy: user.userId, itemData: {
            userRole: constants.user.role.user,
            isEditor: false
        }}) 
        response = await createMilestones.run(createMilestoneEvent);
        expect(response.statusCode).toBe(403);
    });

    
    

    it('createMilestones, expect unauthorised', async () => {
        const response = await createMilestones.run(unauthorisedCreateMilestoneEvent);
        expect(response.statusCode).toBe(403);
    });

    it('createMilestones for job of another user, expect unauthorised', async () => {
        const response = await createMilestones.run(createSomeoneElseMilestoneEvent);
        expect(response.statusCode).toBe(403);
    });

    afterAll(async () => {
        await usersService.delete(user.userId, user.entityId);
        await usersService.delete(user2.userId, user2.entityId);
        await jobsService.delete(job.entityId, job.itemId);
        await jobsService.delete(createMilestoneEventBody.entityId, createdMilestoneId);
    });
});
