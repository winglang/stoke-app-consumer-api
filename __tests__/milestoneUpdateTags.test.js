'use strict'

const testedModuleName = 'milestoneUpdateTags'

const testedFile = require(`../src/job/${testedModuleName}`)

const { UsersService, JobsService, constants } = require('stoke-app-common-api')
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
} = generateCompanyMockData(testedModuleName)

const jobId1 = `job_${testedModuleName}-JOB-ID-1`

const job1 = {
    companyId,
    entityId,
    itemId: jobId1,
    userId: userId1,
    itemData: {},
}

const milestoneBaseProps = {
    companyId,
    entityId,
    userId: userId1,
    itemData: { jobId: jobId1 },
}

const basicTags = {
    foo: 'bar',
    quarters: ['Q1', 'Q2'],
}

const milestone1Id = `ms_job_${testedModuleName}-JOB-ID-1_MILESTONE-1-ID`
const milestoneWithoutTags = {
    ...milestoneBaseProps,
    itemId: milestone1Id,
}

const milestoneWithTags = {
    ...milestoneWithoutTags,
    tags: basicTags,
}

const event = (entityId, itemId, userId, tags) => {
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
            tags,
        }),
    }
}

describe('milestoneUpdateTags', () => {
    beforeAll(async () => {
        await Promise.all([
            usersService.create(user1),
            usersService.create(user2),
        ])
        await jobsService.create(job1)
        await jobsService.create(milestoneWithoutTags)
    })

    afterAll(async () => {
        await jobsService.delete(
            milestoneWithoutTags.entityId,
            milestoneWithoutTags.itemId
        )
        await jobsService.delete(job1.entityId, job1.itemId)
        Promise.all([
            usersService.delete(user1.userId, user1.entityId),
            usersService.delete(user2.userId, user2.entityId),
        ])
    })

    it('milestoneUpdateTags - basic positive flow', async () => {
        const response = await wrapped.run(
            event(
                milestoneWithoutTags.entityId,
                milestoneWithoutTags.itemId,
                milestoneWithoutTags.userId,
                basicTags
            )
        )
        expect(response.statusCode).toBe(200)
        const data = JSON.parse(response.body)
        expect(data.Attributes.tags).toMatchObject(basicTags)

        const updatedMilestone = await jobsService.get(
            milestoneWithoutTags.entityId,
            milestoneWithoutTags.itemId
        )
        expect(updatedMilestone).toMatchObject(milestoneWithTags)
    })

    it('milestoneUpdateTags - returns proper response for missing mandatory fields', async () => {
        const response = await wrapped.run(
            event(
                undefined,
                milestoneWithoutTags.itemId,
                milestoneWithoutTags.userId,
                {}
            )
        )
        const responseMessage = JSON.parse(response.body).message
        expect(responseMessage).toMatch(/.*missing mandatory.*/)
        expect(response.statusCode).toBe(500)
    })

    it('milestoneUpdateTags - milestone not found', async () => {
        const response = await wrapped.run(
            event(
                milestoneWithoutTags.entityId,
                'NOT_FOUND',
                milestoneWithoutTags.userId,
                {}
            )
        )
        expect(response.statusCode).toBe(403)
    })

    it('milestoneUpdateTags - unauthorized user', async () => {
        const response = await wrapped.run(
            event(
                milestoneWithoutTags.entityId,
                milestoneWithoutTags.itemId,
                userId2,
                {
                    Language: ['English', 'Hebrew'],
                }
            )
        )
        expect(response.statusCode).toBe(403)
    })
})
