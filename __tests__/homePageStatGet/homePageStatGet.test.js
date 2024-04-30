'use strict';

const _ = require('lodash');
const params = require('./params.json');
const companyProviders = require('./companyProviders.json');
const companyActiveJobs = require('./companyActiveJobs.json');
const userAuth = require('./userAuth.json');
const endPointResponse = require('./response.json');


const homePage = require('../../src/homePage');
const { JobsService, UsersService, CompanyProvidersService, constants } = require('stoke-app-common-api');
const jestPlugin = require('serverless-jest-plugin');

const getHomePageStatistics = jestPlugin.lambdaWrapper.wrap(homePage, { handler: 'getHomePageStatistics' });

const {
    jobsTableName,
    consumerAuthTableName,
    companyProvidersTableName,
} = process.env;

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

// changing the startTime so that the test is within a fixed time frame
companyActiveJobs[1].itemData.startTime = _.now();



const createdJobsItemsIds = [];
const createdProvidersItems = [];
const createdUserAuth = [];
const PAYMENTS_CHART_DATA = {
    '2021_2': { APPROVED_PAYMENTS: { value: 700 } },
    '2021_3': {
      PENDING_APPROVAL: { value: 878 },
      APPROVED_PAYMENTS: { value: 460 }
    }
  }

describe('getHomePageStatistics', () => {


    beforeAll(async () => {
        for (const job of companyActiveJobs) {
            let response = await jobsService.create(job);
            const item = { entityId: job.entityId, itemId: job.itemId }
            createdJobsItemsIds.push(item);
            expect(response.itemId).toBe(job.itemId);
        }

        for (const provider of companyProviders) {
            let response = await companyProvidersService.create(provider);
            const item = { companyId: provider.companyId, itemId: provider.itemId }
            createdProvidersItems.push(item);
            expect(response.itemId).toBe(provider.itemId);
        }

        for (const auth of userAuth) {
            let response = await usersService.create(auth);
            const item = { userId: auth.userId, entityId: auth.entityId }
            createdUserAuth.push(item);
            expect(response.itemId).toBe(auth.itemId);
        }


    });


    it('get activeJobs and activeTalents, expect 200', async () => {
        let response = await getHomePageStatistics.run(params);
        expect(response.statusCode).toBe(200);
        let responseObj = JSON.parse(response.body);
        expect(responseObj.jobs.length).toBe(endPointResponse.jobs.length);
        expect(responseObj.budgetRequests.length).toBe(endPointResponse.budgetRequests.length);
        expect(responseObj.milestones.length).toBe(endPointResponse.milestones.length);
        expect(responseObj.talents.length).toBe(endPointResponse.talents.length);
        expect(responseObj.budgetByJob.length).toBe(endPointResponse.budgetByJob.length);
        expect(responseObj.bids.length).toBe(endPointResponse.bids.length);
        expect(responseObj.jobsCounter).toMatchObject(endPointResponse.jobsCounter);
        expect(responseObj.talentsCounter).toMatchObject(endPointResponse.talentsCounter);
        expect(responseObj.paymentsChartData).toMatchObject(PAYMENTS_CHART_DATA)
    });



    afterAll(async () => {
        for (const job of createdJobsItemsIds) {
            let response = await jobsService.delete(job.entityId, job.itemId);
            expect(response).toBe(true);
        }

        for (const provider of createdProvidersItems) {
            let response = await companyProvidersService.delete(provider.companyId, provider.itemId);
            expect(response).toBeTruthy();
        }

        for (const auth of createdUserAuth) {
            let response = await usersService.delete(auth.userId, auth.entityId);
            expect(response).toBeTruthy();
        }

    });

});