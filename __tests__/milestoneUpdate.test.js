'use strict'

const testedModuleName = 'milestoneUpdate'

const testedFile = require(`../src/job/${testedModuleName}`)

const { UsersService, JobsService, constants, permisionConstants } = require('stoke-app-common-api')
const usersService = new UsersService(
    process.env.consumerAuthTableName,
    constants.projectionExpression.defaultAndTagsAttributes,
    constants.attributeNames.defaultAttributes
)
const jobsService = new JobsService(
    process.env.jobsTableName,
    constants.projectionExpression.defaultAndTagsAttributes,
    constants.attributeNames.defaultAttributes
)

const { lambdaWrapper } = require('serverless-jest-plugin')
const { generateCompanyMockData } = require('./helpers')

const wrapped = lambdaWrapper.wrap(testedFile, { handler: 'handler' })

const {
    companyId,
    entityId,
    userId1,
    user1,
    userId2,
    user2,
} = generateCompanyMockData(testedModuleName, { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } })

const jobId1 = `job_${testedModuleName}-JOB-ID-1`

const job1 = {
    companyId,
    entityId,
    itemId: jobId1,
    userId: userId1,
    itemData: {},
}

const originalTitle = 'title-#1';
const originalDesc = 'desc-#1';

const milestoneBaseProps = {
    companyId,
    entityId,
    userId: userId1,
    itemData: {
        jobId: jobId1,
        title: originalTitle,
        description: originalDesc
    },
}

const milestone1Id = `ms_job_${testedModuleName}-JOB-ID-1_MILESTONE-1-ID`
const milestone = {
    ...milestoneBaseProps,
    itemId: milestone1Id,
}



const newTitle2 = 'title-#2';
const newDesc2 = 'desc-#2';
const newTitle3 = 'title-#3';
const newDesc3 = 'desc-#3';


const event = (entityId, itemId, userId, title, description, lineItems, timeReport) => {
    return {
        requestContext: {
            identity: {
                cognitoIdentityId: userId,
            },
        },
        pathParameters: {
            id: itemId,
        },
        body: JSON.stringify({
            entityId,
            title,
            description,
            lineItems,
            timeReport
        }),
    }
}

describe('milestoneUpdate', () => {
    beforeAll(async () => {
        await Promise.all([
            usersService.create(user1),
            usersService.create(user2),
        ])
        await jobsService.create(job1)
        await jobsService.create(milestone)
    })

    afterAll(async () => {
        await jobsService.delete(
            milestone.entityId,
            milestone.itemId
        )
        await jobsService.delete(job1.entityId, job1.itemId)
        Promise.all([
            usersService.delete(user1.userId, user1.entityId),
            usersService.delete(user2.userId, user2.entityId),
        ])
    })

    it('milestoneUpdate - basic positive flow', async () => {
        const response = await wrapped.run(
            event(
                milestone.entityId,
                milestone.itemId,
                milestone.userId,
                newTitle2,
                newDesc2
            )
        )
        expect(response.statusCode).toBe(200);

        const updatedMilestone = await jobsService.get(
            milestone.entityId,
            milestone.itemId
        )
        const newMilestone = Object.assign({}, milestone);
        newMilestone.itemData.title = newTitle2;
        newMilestone.itemData.description = newDesc2;
        newMilestone.modifiedBy = userId1;
        delete newMilestone.modifiedAt;
        delete updatedMilestone.modifiedAt;

        expect(updatedMilestone).toMatchObject(newMilestone);
    })

    it('milestoneUpdate - basic positive flow #2', async () => {
        const response = await wrapped.run(
            event(
                milestone.entityId,
                milestone.itemId,
                milestone.userId,
                newTitle3,
                undefined
            )
        )
        expect(response.statusCode).toBe(200);

        const updatedMilestone = await jobsService.get(
            milestone.entityId,
            milestone.itemId
        )
        const newMilestone = Object.assign({}, milestone);
        newMilestone.itemData.title = newTitle3;
        newMilestone.modifiedBy = userId1;
        delete newMilestone.modifiedAt;
        delete updatedMilestone.modifiedAt;

        expect(updatedMilestone).toMatchObject(newMilestone);
    })

    it('milestoneUpdate - basic positive flow #3', async () => {
        const response = await wrapped.run(
            event(
                milestone.entityId,
                milestone.itemId,
                milestone.userId,
                undefined,
                newDesc3
            )
        )
        expect(response.statusCode).toBe(200);

        const updatedMilestone = await jobsService.get(
            milestone.entityId,
            milestone.itemId
        )
        const newMilestone = Object.assign({}, milestone);
        newMilestone.itemData.description = newDesc3;
        newMilestone.modifiedBy = userId1;
        delete newMilestone.modifiedAt;
        delete updatedMilestone.modifiedAt;

        expect(updatedMilestone).toMatchObject(newMilestone);
    })

    it('milestoneUpdate - update lineItems', async () => {
        const response = await wrapped.run(
            event(
                milestone.entityId,
                milestone.itemId,
                milestone.userId,
                undefined,
                undefined,
                []
            )
        )
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.Attributes.itemData.lineItems).toMatchObject([])
    })

    it('milestoneUpdate - update timeReport', async () => {
        const response = await wrapped.run(
            event(
                milestone.entityId,
                milestone.itemId,
                milestone.userId,
                undefined,
                undefined,
                undefined,
                [],
            )
        )
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.Attributes.itemData.timeReport).toMatchObject([])
    })

    it('milestoneUpdate - returns proper response for missing mandatory fields #1', async () => {
        const response = await wrapped.run(
            event(
                undefined,
                milestone.itemId,
                milestone.userId,
                newTitle2,
                newDesc2
            )
        )
        const responseMessage = JSON.parse(response.body).message
        expect(responseMessage).toMatch(/.*missing mandatory.*/)
        expect(response.statusCode).toBe(500)
    })

    it('milestoneUpdate - returns proper response for missing mandatory fields #2', async () => {
        const response = await wrapped.run(
            event(
                milestone.entityId,
                milestone.itemId,
                milestone.userId,
                undefined,
                undefined
            )
        )
        const responseMessage = JSON.parse(response.body).message
        expect(responseMessage).toMatch(/.*missing mandatory.*/)
        expect(response.statusCode).toBe(500)
    })

    it('milestoneUpdate - milestone not found', async () => {
        const response = await wrapped.run(
            event(
                milestone.entityId,
                'NOT_FOUND',
                milestone.userId,
                newTitle2,
                newDesc2
            )
        )
        expect(response.statusCode).toBe(403)
    })

    it('milestoneUpdate - unauthorized user', async () => {
        const response = await wrapped.run(
            event(
                milestone.entityId,
                milestone.itemId,
                userId2,
                newTitle2,
                newDesc2
            )
        )
        expect(response.statusCode).toBe(403)
    })
})
