/* eslint-disable no-magic-numbers */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-undef */
'use strict';

const { job, user } = require('../src/helpers/testHelper');
const jobs = require('./jobListByTalent/jobs.json');
const milestones = require('./jobListByTalent/milestones.json');
const mod = require('../src/job/jobListByTalent');
const jestPlugin = require('serverless-jest-plugin');
const handler = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'handler' });

const _ = require('lodash');
const { UsersService, JobsService, constants, } = require('stoke-app-common-api');

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const event = (userId, talentId, companyId, numberJobsToFetch) => {
    return {
        body: "{}",
        requestContext: {
            identity: {
                cognitoIdentityId: userId
            }
        },
        queryStringParameters: {
            companyId,
            talentId,
            numberJobsToFetch
        },
    };
};

const createdJobsItemsIds = [];

const testName = "JEST-TEST-LIST-BY-TALNET";
const talentId1 = "talent_provider_BY-TALNET-ID-fb5c3e50-4906-11eb-b3bd-cf229eada5batalent_c434e920-4908-11eb-ab67-07d7e1e79e08";
const talentId2 = "talent_provider_BY-TALNET-ID-fb5c3e50-4906-11eb-b3bd-cf229eada5batalent_c434e920-4908-11eb-ab67-2222222";
const companyId = 'JEST-TEST-LIST-BY-TALNET-ID-JOBS-COMPANY-ID--1';
const talentId3 = "provider_TEXTTEAM3c081d20-0bdf-11ec-a20d-7d5e466b44cd";
const providerId1 = `${constants.prefix.provider}${testName}`;
const talentUnderProvider1 = `${constants.prefix.talent}${providerId1}talent_1`
const talentUnderProvider2 = `${constants.prefix.talent}${providerId1}talent_2`
const talentUnderProvider3 = `${constants.prefix.talent}${providerId1}talent_3`
const talentUnderProvider4 = `${constants.prefix.talent}${providerId1}talent_4`
const companyId3 = 'JEST-TEST-LIST-BY-TALNET-ID-JOBS-COMPANY-ID-1';
const userId3 = 'us-east-1:77ed546c-3115-4eb8-94c9-82f9f547b0e0';
const userIdCompanyAdmin = 'JEST-TEST-LIST-BY-TALNET-ID-JOBS-USER-ID--1';
const userIdDepartment1Admin = 'JEST-TEST-LIST-BY-TALNET-ID-JOBS-USER-ID--2';
const userIdDep1User1 = 'JEST-TEST-LIST-BY-TALNET-ID-JOBS-USER-ID--3';
const userIdDep2User1 = 'JEST-TEST-LIST-BY-TALNET-ID-JOBS-USER-ID--5';
const entityId1 = 'JEST-TEST-LIST-BY-TALNET-ID-JOBS-ENT-ID--1';
const entityId2 = 'JEST-TEST-LIST-BY-TALNET-ID-JOBS-ENT-ID--2';
const entityId3 = 'RD8a95db10-ce7e-11eb-b058-b1fe934d5045LIST-BY-TALNET-ID';
const entityId4 = 'BENESHf846e370-c2d5-11eb-8c02-8b2c51cad23c';

const jobId2 = `${constants.prefix.job}${testName}-JOB-ID-2`;
const job2msId1 = `${constants.prefix.milestone}${jobId2}_MS-1`;
const job2msId2 = `${constants.prefix.milestone}${jobId2}_MS-2`;

const jobId3 = `${constants.prefix.job}${testName}-JOB-ID-3`;
const job3msId1 = `${constants.prefix.milestone}${jobId3}_MS-1`;

const jobId4 = `${constants.prefix.job}${testName}-JOB-ID-4`;
const job4msId1 = `${constants.prefix.milestone}${jobId4}_MS-1`;

const jobNoMilestonesId1 = `${constants.prefix.job}${testName}-JOB-NO-MILESTONES-1`;

const jobActiveId = `${constants.prefix.job}${testName}-JOB-ACTIVE-1`;
const jobCompletedId = `${constants.prefix.job}${testName}-JOB-COMPLETE-LAST-WEEK`;

// Department 1
const jobItemDep1NoTalent = job(entityId1, companyId, `${constants.prefix.job}JEST-TEST-LIST-BY-TALNET-ID-JOBS-JOB-ID-DEP-1-1`, constants.job.status.active, userIdCompanyAdmin)
const jobItemDep1WithTalent = job(entityId1, companyId, `${constants.prefix.job}JEST-TEST-LIST-BY-TALNET-ID-JOBS-JOB-ID-DEP-1-2`, constants.job.status.active, userIdCompanyAdmin, {
    talentId: talentId1,
    bids: {
        values: [
            "JEST_TEST_LIST_BY_TALNET_ID_JOBS_TALENT_ID_1",
            `${constants.prefix.job}JEST-TEST-LIST-JOBS-JOB-ID-BY-TALNET-ID-1_JEST_TEST_LIST_JOBS_TALENT_ID_1`
        ]
    }
});
const msId1 = `${constants.prefix.milestone}${jobItemDep1WithTalent.itemId}_MS1`;

const milestone = job(jobItemDep1WithTalent.entityId, jobItemDep1WithTalent.companyId, msId1, constants.job.status.active, jobItemDep1WithTalent.userId, {
    jobId: jobItemDep1WithTalent.itemId,
    cost: 100,
    actualCost: 200,
    date: "2022-06-30",
    providerData: {
        taxInfo: {
            paymentCurrency: "USD",
            total: 200,
        }
    }
});

const job2 = job(entityId1, companyId, jobId2, constants.job.status.active, userIdCompanyAdmin, { talentId: talentUnderProvider1 });
const job2milestone1 = job(job2.entityId, job2.companyId, job2msId1, constants.job.status.completed, userIdCompanyAdmin, {
    jobId: jobId2,
    cost: 100,
    actualCost: 200,
    date: "2022-06-29",
    providerData: {
        taxInfo: {
            paymentCurrency: "USD",
            total: 200,
        }
    }
})
const job2milestone2 = job(job2.entityId, job2.companyId, job2msId2, constants.job.status.active, userIdCompanyAdmin, job2milestone1.itemData)

const job3 = job(entityId1, companyId, jobId3, constants.job.status.active, userIdCompanyAdmin, { talentId: talentUnderProvider2 });
const job3milestone1 = job(job3.entityId, job3.companyId, job3msId1, constants.job.status.active, userIdCompanyAdmin, {
    jobId: jobId3,
    cost: 100,
    actualCost: 200,
    date: "2022-06-29",
    providerData: {
        taxInfo: {
            paymentCurrency: "USD",
            total: 200,
        }
    }
})
const job4 = job(entityId1, companyId, jobId4, constants.job.status.active, userIdCompanyAdmin, { talentId: talentUnderProvider2 });
const job4milestone1 = job(job3.entityId, job3.companyId, job4msId1, constants.job.status.active, userIdCompanyAdmin, {
    jobId: jobId4,
    cost: 100,
    actualCost: 200,
    date: "2022-06-29",
    providerData: {
        taxInfo: {
            paymentCurrency: "USD",
            total: 200,
        }
    }
})


const jobNoMilestones = job(entityId1, companyId, jobNoMilestonesId1, constants.job.status.active, userIdCompanyAdmin, { talentId: talentUnderProvider3 });

const jobActive = job(entityId1, companyId, jobActiveId, constants.job.status.active, userIdCompanyAdmin, { talentId: talentUnderProvider4 });
const jobCompleted = job(entityId1, companyId, jobCompletedId, constants.job.status.completed, userIdCompanyAdmin, { talentId: talentUnderProvider4 });

// Department 2
const jobItemDep2NoTalent = job(entityId2, companyId, `${constants.prefix.job}JEST-TEST-LIST-BY-TALNET-ID-JOBS-JOB-ID-DEP-2-1`, constants.job.status.active, userIdDep2User1)
const jobItemDep2WithTalent = job(entityId2, companyId, `${constants.prefix.job}JEST-TEST-LIST-BY-TALNET-ID-JOBS-JOB-ID-DEP-2-2`, constants.job.status.active, userIdDep2User1, {
    talentId: talentId1,
});
const jobItemDep2WithTalent2 = job(entityId2, companyId, `${constants.prefix.job}JEST-TEST-LIST-BY-TALNET-ID-JOBS-JOB-ID-DEP-2-3`, constants.job.status.active, userIdDep2User1, {
    talentId: talentId2,
});

describe('listJobs', () => {
    beforeAll(async () => {
        // User Company Admin 
        const userComapnyAdmin33 = user(userId3, entityId3, companyId3, constants.user.status.active, constants.user.role.admin);
        expect(await usersService.create(userComapnyAdmin33)).toEqual(userComapnyAdmin33);
        const userComapnyAdmin34 = user(userId3, entityId4, companyId3, constants.user.status.active, constants.user.role.admin);
        expect(await usersService.create(userComapnyAdmin34)).toEqual(userComapnyAdmin34);

        const userComapnyAdmin1 = user(userIdCompanyAdmin, entityId1, companyId, constants.user.status.active, constants.user.role.admin);
        expect(await usersService.create(userComapnyAdmin1)).toEqual(userComapnyAdmin1);

        const userComapnyAdmin2 = user(userIdCompanyAdmin, entityId2, companyId, constants.user.status.active, constants.user.role.admin);
        expect(await usersService.create(userComapnyAdmin2)).toEqual(userComapnyAdmin2);

        const userComapnyAdmin3 = user(userIdCompanyAdmin, companyId, companyId, constants.user.status.active, constants.user.role.admin);
        expect(await usersService.create(userComapnyAdmin3)).toEqual(userComapnyAdmin3);

        // User Department Admin 
        const userDepartmentAdmin = user(userIdDepartment1Admin, entityId1, companyId, constants.user.status.active, constants.user.role.admin);
        expect(await usersService.create(userDepartmentAdmin)).toEqual(userDepartmentAdmin);

        // User1 Department 1
        const userDepartment1User1 = user(userIdDep1User1, entityId1, companyId, constants.user.status.active, constants.user.role.user);
        expect(await usersService.create(userDepartment1User1)).toEqual(userDepartment1User1);

        // User3 Department 2
        const userDepartment2User1 = user(userIdDep2User1, entityId2, companyId, constants.user.status.active, constants.user.role.user);
        expect(await usersService.create(userDepartment2User1)).toEqual(userDepartment2User1);

        // Job Department 1
        expect(await jobsService.create(jobItemDep1NoTalent)).toBe(jobItemDep1NoTalent);
        expect(await jobsService.create(jobItemDep1WithTalent)).toBe(jobItemDep1WithTalent);
        expect(await jobsService.create(milestone)).toBe(milestone);
        expect(await jobsService.create(job2)).toBe(job2);
        expect(await jobsService.create(job2milestone1)).toBe(job2milestone1);
        expect(await jobsService.create(job2milestone2)).toBe(job2milestone2);
        expect(await jobsService.create(job3)).toBe(job3);
        expect(await jobsService.create(job3milestone1)).toBe(job3milestone1);
        expect(await jobsService.create(job4)).toBe(job4);
        expect(await jobsService.create(job4milestone1)).toBe(job4milestone1);
        expect(await jobsService.create(jobNoMilestones)).toBe(jobNoMilestones);
        expect(await jobsService.create(jobActive)).toBe(jobActive);
        expect(await jobsService.create(jobCompleted)).toBe(jobCompleted);

        // Job Department 2
        expect(await jobsService.create(jobItemDep2NoTalent)).toBe(jobItemDep2NoTalent);
        expect(await jobsService.create(jobItemDep2WithTalent)).toBe(jobItemDep2WithTalent);
        expect(await jobsService.create(jobItemDep2WithTalent2)).toBe(jobItemDep2WithTalent2);

        const jobsAndMS = _.flatten([...jobs, ...milestones]);
        for (const job of jobsAndMS) {
            let response = await jobsService.create(job);
            const item = { entityId: job.entityId, itemId: job.itemId }
            createdJobsItemsIds.push(item);
            expect(response.itemId).toBe(job.itemId);
        }

    });

    it('list jobs with providerId', async () => {
        let response = await handler.run(event(userId3, talentId3, companyId3, constants.prefix.job, constants.job.status.active));
        expect(response.statusCode).toBe(200);
        let responseObj = JSON.parse(response.body);
        expect(responseObj.jobs.length).toBe(24);


    });

    it('list job with company admin ', async () => {
        let response = await handler.run(event(userIdCompanyAdmin, talentId1, companyId, constants.prefix.milestone, constants.job.status.active));
        expect(response.statusCode).toBe(200);
        let responseObj = JSON.parse(response.body);
        expect(responseObj.jobs.length).toBe(3);
        expect(responseObj).toMatchObject({ jobs: [jobItemDep1WithTalent, jobItemDep2WithTalent, milestone] });
    });

    it('list job with department admin ', async () => {
        let response = await handler.run(event(userIdDepartment1Admin, talentId1, companyId, constants.prefix.milestone, constants.job.status.active));
        expect(response.statusCode).toBe(200);
        let responseObj = JSON.parse(response.body);
        expect(responseObj.jobs.length).toBe(2);
        expect(responseObj).toMatchObject({ jobs: [jobItemDep1WithTalent, milestone] });
    });

    it('list job with user ', async () => {
        let response = await handler.run(event(userIdDep1User1, talentId1, companyId, constants.prefix.milestone, constants.job.status.active));
        expect(response.statusCode).toBe(200);
        let responseObj = JSON.parse(response.body);
        expect(responseObj.jobs.length).toBe(0);
        expect(responseObj.activeDepartments.length).toBe(0);
        expect(responseObj).toMatchObject({ jobs: [] });

        response = await handler.run(event(userIdDep2User1, talentId1, companyId, constants.prefix.milestone, constants.job.status.active));
        expect(response.statusCode).toBe(200);
        responseObj = JSON.parse(response.body);
        expect(responseObj.jobs.length).toBe(1);
        expect(responseObj.activeDepartments.length).toBe(1);
        expect(responseObj).toMatchObject({ jobs: [jobItemDep2WithTalent] });

        response = await handler.run(event(userIdDep2User1, talentId2, companyId, constants.prefix.milestone, constants.job.status.active));
        expect(response.statusCode).toBe(200);
        responseObj = JSON.parse(response.body);
        expect(responseObj.jobs.length).toBe(1);
        expect(responseObj.activeDepartments.length).toBe(1);
        expect(responseObj).toMatchObject({ jobs: [jobItemDep2WithTalent2] });
    });

    it('List last active jobs by amout ', async () => {
        let response = await handler.run(event(userIdCompanyAdmin, talentUnderProvider1, companyId, 2));
        expect(response.statusCode).toBe(200);
        let responseObj = JSON.parse(response.body);
        expect(responseObj.jobs.length).toBe(3);
        expect(responseObj.activeDepartments.length).toBe(1);
        expect(responseObj.totalEarned).toMatchObject({ USD: 200 });

        response = await handler.run(event(userIdCompanyAdmin, providerId1, companyId, 1));
        expect(response.statusCode).toBe(200);
        responseObj = JSON.parse(response.body);
        expect(responseObj.jobs.length).toBe(5);
        expect(responseObj.activeDepartments.length).toBe(1);
        expect(responseObj.totalEarned).toMatchObject({ USD: 200 });

        response = await handler.run(event(userIdCompanyAdmin, providerId1, companyId));
        expect(response.statusCode).toBe(200);
        responseObj = JSON.parse(response.body);
        expect(responseObj.jobs.length).toBe(10);
        expect(responseObj.activeDepartments.length).toBe(1);
        expect(responseObj.totalEarned).toMatchObject({ USD: 200 });
    });


    it('List jobs without milestones', async () => {
        let response = await handler.run(event(userIdCompanyAdmin, talentUnderProvider3, companyId, 2));
        expect(response.statusCode).toBe(200);
        let responseObj = JSON.parse(response.body);
        expect(responseObj.jobs.length).toBe(1);
        expect(responseObj.activeDepartments.length).toBe(1);
        expect(responseObj.totalEarned).toMatchObject({});
    });

    it('List jobReviewOptions', async () => {
        let response = await handler.run(event(userIdCompanyAdmin, talentUnderProvider4, companyId, 2));
        expect(response.statusCode).toBe(200);
        let responseObj = JSON.parse(response.body);
        expect(responseObj.jobReviewOptions.length).toBe(2);
    });

    afterAll(async () => {
        await jobsService.delete(entityId1, jobItemDep1NoTalent.itemId);
        await jobsService.delete(entityId1, jobItemDep1WithTalent.itemId);
        await jobsService.delete(milestone.entityId, milestone.itemId);
        await jobsService.delete(entityId2, jobItemDep2NoTalent.itemId);
        await jobsService.delete(entityId2, jobItemDep2WithTalent.itemId);
        await jobsService.delete(entityId2, jobItemDep2WithTalent2.itemId);
        await jobsService.delete(job2.entityId, job2.itemId);
        await jobsService.delete(job2milestone1.entityId, job2milestone1.itemId);
        await jobsService.delete(job2milestone2.entityId, job2milestone2.itemId);
        await jobsService.delete(job3.entityId, job3.itemId);
        await jobsService.delete(job3milestone1.entityId, job3milestone1.itemId);
        await jobsService.delete(job4.entityId, job4.itemId);
        await jobsService.delete(job4milestone1.entityId, job4milestone1.itemId);
        await jobsService.delete(jobNoMilestones.entityId, jobNoMilestones.itemId);
        await jobsService.delete(jobActive.entityId, jobActive.itemId);
        await jobsService.delete(jobCompleted.entityId, jobCompleted.itemId);
        await usersService.delete(userIdCompanyAdmin, entityId1);
        await usersService.delete(userIdDepartment1Admin, entityId1);
        await usersService.delete(userIdDep1User1, entityId1);
        await usersService.delete(userIdDep2User1, entityId1);
        await usersService.delete(userIdCompanyAdmin, companyId);

        for (const job of createdJobsItemsIds) {
            let response = await jobsService.delete(job.entityId, job.itemId);
            expect(response).toBe(true);
        }
    });
});
