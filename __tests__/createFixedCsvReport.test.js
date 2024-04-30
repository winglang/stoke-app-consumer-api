'use strict';
const _ = require('lodash');
const createFixedCsvReport = require("../src/job/createFixedCsvReport");
const jestPlugin = require("serverless-jest-plugin");
const handler = jestPlugin.lambdaWrapper.wrap(createFixedCsvReport, { handler: 'handler' });
const { constants, JobsService, idConverterLib, BidsService, CompanyProvidersService, UsersService, SettingsService } = require('stoke-app-common-api');
const csvLib = require('stoke-app-common-api/lib/csvLib');
const { getOfferedJobsReportFields } = require('../src/helpers/csvReport/fixedCsvFieldsLists');

const AWS = require('aws-sdk');
const s3 = new AWS.S3({});

const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAndTagsAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const bidsService = new BidsService(process.env.bidsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName);


const testName = 'CREATE-FIXED-CSV-TEST'
const companyId1 = `${testName}-COMP-ID-1`;
const entityId1 = `${testName}-ENT-ID-1`;
const userId1 = `${testName}-USER-ID-1`;
const providerPrefix = `${constants.prefix.provider}${testName}`;
const providerId1 = `${providerPrefix}${companyId1}-PROVIDER-ID-1`;
const talentId1 = `${constants.prefix.talent}${providerId1}${constants.prefix.talent}TALENT-ID-1`;
const providerId2 = `${providerPrefix}${companyId1}-PROVIDER-ID-2`;
const talentId2 = `${constants.prefix.talent}${providerId2}${constants.prefix.talent}TALENT-ID-2`;
const providerId3 = `${providerPrefix}${companyId1}-PROVIDER-ID-3`;
const talentId3 = `${constants.prefix.talent}${providerId3}${constants.prefix.talent}TTALENT-ID-3`;

const talentsNames = {
  [talentId1]: 'talent 1',
  [talentId2]: 'talent 2',
  [talentId3]: 'talent 3',
}

const jobId1 = `job_${testName}-job-1`;
const jobId2 = `job_${testName}-job-2`;

const authUser1 = {
  userId: userId1,
  entityId: entityId1,
  companyId: companyId1,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const offerJobBuilder = (jobId, jobTitle, talentIds, bids) => ({
  companyId: companyId1,
  entityId: entityId1,
  itemId: jobId,
  userId: userId1,
  itemStatus: constants.job.status.pending,
  itemData: {
    jobTitle,
    withTalentQuoteOffer: true,
    talentIds,
    baseJobFlow: 'offer',
    engagementType: 'hourly',
    bids
  },
  tags: {
    'stoke::jobId': 'CUSTOM_JOB_ID'
  }
})

const bidsBuilder = (bidId) => ({
  entityId: entityId1,
  itemId: bidId,
  userId: userId1,
  itemData: {
    candidate: {
      itemId: idConverterLib.getTalentIdFromBidId(bidId),
      name: talentsNames[idConverterLib.getTalentIdFromBidId(bidId)]
    },
    offerStatus: constants.jobOfferBidStatus.interested,
    role: 'developer',
    quote: 66,
    existingTalent: true,
    jobId: idConverterLib.getJobIdFromBidItemId(bidId),
    responseTime: new Date('11/11/11').getTime()
  }
})

const companyProviderBuilder = (talentId) => ({
  itemId: talentId,
  companyId: companyId1,
  itemStatus: constants.user.status.active,
  itemData: {
    name: talentsNames[talentId],
    email: `${talentsNames[talentId]}@stoketalent.com`,
    jobTitle: 'bla'
  }
})

const companySettingsBuilder = (isWithCustomJobId) => ({
  itemId: `${constants.prefix.company}${companyId1}`,
  itemData: {
    jobsCustomFields: isWithCustomJobId ? {
      enabled: true,
      fields: [
        {
          id: "stoke::jobId",
          name: "Job ID",
          type: "string"
        }
      ]
    } : {},
  },
})

const talentIds = [talentId1, talentId2, talentId3];
const getBidIdsArray = (jobId) => _.map(talentIds, (talentId) => `${jobId}_${talentId}`);

const talent1 = companyProviderBuilder(talentId1);
const talent2 = companyProviderBuilder(talentId2);
const talent3 = companyProviderBuilder(talentId3);

const job1BidIdsArray = getBidIdsArray(jobId1);
const job1BidsArray = _.map(job1BidIdsArray, (bidId) => bidsBuilder(bidId))

const job1 = offerJobBuilder(jobId1, 'job1', talentIds, job1BidIdsArray);

const job2BidIdsArray = getBidIdsArray(jobId2);
const job2BidsArray = _.map(job2BidIdsArray, (bidId) => bidsBuilder(bidId))

const job2 = offerJobBuilder(jobId2, 'job2', talentIds, job1BidIdsArray);

const getHeadersNames = (isJobIdExist) => _.map(getOfferedJobsReportFields(isJobIdExist), 'headerName')

const getRowsDataFromUrl = async (url, headers) => {
  const decodedUrl = decodeURIComponent(url)
  const key = decodedUrl.match(/(?<=.com[/])(.*?)(.csv)/)[0]
  let s3Object = await s3.getObject({ Bucket: process.env.jobsBucketName, Key: key }).promise();
  const fileData = s3Object.Body.toString("utf-8");
  const rows = csvLib.csvToObjects(fileData, headers);
  return rows
}

beforeAll(async () => {
  await usersService.create(authUser1);
  await companyProvidersService.create(talent1);
  await companyProvidersService.create(talent2);
  await companyProvidersService.create(talent3);
  await Promise.all(_.map(job1BidsArray, (bidItem) => bidsService.create(bidItem)));
  await jobsService.create(job1);
  await Promise.all(_.map(job2BidsArray, (bidItem) => bidsService.create(bidItem)));
  await jobsService.create(job2);

})

describe('createFixedCsvReport - offer job report', () => {
  const fixedCsvEvent = {
    requestContext: {
      identity: {
        cognitoIdentityId: userId1
      }
    },
    queryStringParameters: {
      companyId: companyId1,
      type: "jobsPage",
      reportType: "offer"
    }
  }
  it('expect getting url', async () => {
    await settingsService.create(companySettingsBuilder(false))
    let response = await handler.run(fixedCsvEvent);
    expect(response.statusCode).toBe(200);
    const rows = await getRowsDataFromUrl(response.body, getHeadersNames(false));
    const offerResult = [
      {
        'Job title': 'job1',
        Role: 'developer',
        'Type': 'Hourly',
        'Quote': '$66',
        'Talent name': 'talent 2',
        Title: 'bla',
        Response: 'Interested',
        'Response time': 'Nov 11 2011 00:00',
        Hired: ''
      },
      {
        'Job title': 'job1',
        Role: 'developer',
        'Type': 'Hourly',
        'Quote': '$66',
        'Talent name': 'talent 1',
        Title: 'bla',
        Response: 'Interested',
        'Response time': 'Nov 11 2011 00:00',
        Hired: ''
      },
      {
        'Job title': 'job1',
        Role: 'developer',
        'Type': 'Hourly',
        'Quote': '$66',
        'Talent name': 'talent 3',
        Title: 'bla',
        Response: 'Interested',
        'Response time': 'Nov 11 2011 00:00',
        Hired: ''
      },
      {
        'Job title': 'job2',
        Role: 'developer',
        'Type': 'Hourly',
        'Quote': '$66',
        'Talent name': 'talent 2',
        Title: 'bla',
        Response: 'Interested',
        'Response time': 'Nov 11 2011 00:00',
        Hired: ''
      },
      {
        'Job title': 'job2',
        Role: 'developer',
        'Type': 'Hourly',
        'Quote': '$66',
        'Talent name': 'talent 1',
        Title: 'bla',
        Response: 'Interested',
        'Response time': 'Nov 11 2011 00:00',
        Hired: ''
      },
      {
        'Job title': 'job2',
        Role: 'developer',
        'Type': 'Hourly',
        'Quote': '$66',
        'Talent name': 'talent 3',
        Title: 'bla',
        Response: 'Interested',
        'Response time': 'Nov 11 2011 00:00',
        Hired: ''
      }
    ]
    expect(rows).toEqual(offerResult);
    await settingsService.delete(companyId1);
  });
  it('expect getting url to eport with job ID custom field if exist', async () => {
    await settingsService.create(companySettingsBuilder(true))
    let response = await handler.run(fixedCsvEvent);
    expect(response.statusCode).toBe(200);
    const rows = await getRowsDataFromUrl(response.body, getHeadersNames(true));
    const offerResult = [
      {
        'Job title': 'job1',
        'Job ID': 'CUSTOM_JOB_ID',
        Role: 'developer',
        'Type': 'Hourly',
        'Quote': '$66',
        'Talent name': 'talent 2',
        Title: 'bla',
        Response: 'Interested',
        'Response time': 'Nov 11 2011 00:00',
        Hired: '',
      },
      {
        'Job title': 'job1',
        'Job ID': 'CUSTOM_JOB_ID',
        Role: 'developer',
        'Type': 'Hourly',
        'Quote': '$66',
        'Talent name': 'talent 1',
        Title: 'bla',
        Response: 'Interested',
        'Response time': 'Nov 11 2011 00:00',
        Hired: ''
      },
      {
        'Job title': 'job1',
        'Job ID': 'CUSTOM_JOB_ID',
        Role: 'developer',
        'Type': 'Hourly',
        'Quote': '$66',
        'Talent name': 'talent 3',
        Title: 'bla',
        Response: 'Interested',
        'Response time': 'Nov 11 2011 00:00',
        Hired: ''
      },
      {
        'Job title': 'job2',
        'Job ID': 'CUSTOM_JOB_ID',
        Role: 'developer',
        'Type': 'Hourly',
        'Quote': '$66',
        'Talent name': 'talent 2',
        Title: 'bla',
        Response: 'Interested',
        'Response time': 'Nov 11 2011 00:00',
        Hired: ''
      },
      {
        'Job title': 'job2',
        'Job ID': 'CUSTOM_JOB_ID',
        Role: 'developer',
        'Type': 'Hourly',
        'Quote': '$66',
        'Talent name': 'talent 1',
        Title: 'bla',
        Response: 'Interested',
        'Response time': 'Nov 11 2011 00:00',
        Hired: ''
      },
      {
        'Job title': 'job2',
        'Job ID': 'CUSTOM_JOB_ID',
        Role: 'developer',
        'Type': 'Hourly',
        'Quote': '$66',
        'Talent name': 'talent 3',
        Title: 'bla',
        Response: 'Interested',
        'Response time': 'Nov 11 2011 00:00',
        Hired: ''
      }
    ]
    expect(rows).toEqual(offerResult);
    await settingsService.delete(companyId1);
  });


})


afterAll(async () => {
  await usersService.delete(authUser1.userId, authUser1.entityId);
  await companyProvidersService.delete(companyId1, talentId1);
  await companyProvidersService.delete(companyId1, talentId2);
  await companyProvidersService.delete(companyId1, talentId3);
  await jobsService.delete(entityId1, job1.itemId);
  await jobsService.delete(entityId1, job2.itemId);
  await Promise.all(_.map(job1BidIdsArray, (itemId) => bidsService.delete(entityId1, itemId)));
  await Promise.all(_.map(job2BidIdsArray, (itemId) => bidsService.delete(entityId1, itemId)));
});
