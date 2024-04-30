'use strict';
const _ = require("lodash");
const s3Files = require('../src/s3FilesProcessor');
const jestPlugin = require('serverless-jest-plugin');
const { s3Event, s3EventError } = require('./mock/s3Milestones');
const { UsersService, TalentsService, SettingsService, JobsService, CompanyProvidersService, BudgetsService, constants, CompaniesService } = require('stoke-app-common-api');
const { errorCodes } = require("../src/bulkOperations/constansts");

const { jobsBucketName, jobsTableName, settingsTableName, consumerAuthTableName, companyProvidersTableName } = process.env;
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const talentsService = new TalentsService(process.env.talentsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const wrapped = jestPlugin.lambdaWrapper.wrap(s3Files, { handler: 'bulkCreateMilestones' });

const providerId = 'provider_JOBS-BULK-FLOW-JEST-TEST-PROVIDER-ID-11'
const providerId2 = 'provider_JOBS-BULK-FLOW-JEST-TEST-PROVIDER-ID-21'
const talentId = `talent_${providerId}BULK-FLOWtalent_TALENT-ID-11`
const talentId2 = `talent_${providerId2}BULK-FLOWtalent_TALENT-ID-21`
const companyId = 'JOBS-BULK-FLOW-JEST-TEST-COMPANY-ID-11'
const entityId = 'JOBS-BULK-FLOW-JEST-TEST-ENT-ID-11'
const entityId2 = 'JOBS-BULK-FLOW-JEST-TEST-ENT-ID-21'
const userIdAdmin = 'JOBS-BULK-FLOW-JEST-TEST-USER-ID-admin1'
const userId = 'JOBS-BULK-FLOW-JEST-TEST-USER-ID-11'
const userId2 = 'JOBS-BULK-FLOW-JEST-TEST-USER-ID-21'


const adminUserBudget = {
  itemId: constants.prefix.user + userIdAdmin,
  entityId: companyId,
  companyId: companyId,
  itemData: {
    2020:
    {
      periods: 4,
      1: { total: 1000, approved: 50, pending: 20, committed: 10, available: 1000 },
      2: { total: 1000, approved: 50, pending: 0, committed: 0, available: 1000 },
      3: { total: 1000, approved: 0, pending: 0, committed: 0, available: 1000 },
      4: { total: 1000, approved: 0, pending: 0, committed: 0, available: 1000 },
    },
  },
  modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-11'
}

const userBudget = {
  itemId: constants.prefix.user + userId,
  entityId: entityId,
  companyId: companyId,
  itemData: {
  },
  modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-11'
}

const userBudget2 = {
  itemId: constants.prefix.user + userId2,
  entityId: entityId,
  companyId: companyId,
  itemData: {
  },
  modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-11'
}

const userBudgetEnity2 = {
  itemId: constants.prefix.user + userId,
  entityId: entityId2,
  companyId: companyId,
  itemData: {
  },
  modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-11'
}

const userBudgetEnity22 = {
  itemId: constants.prefix.user + userId2,
  entityId: entityId2,
  companyId: companyId,
  itemData: {
  },
  modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-11'
}


const entityBudget = {
  itemId: constants.prefix.entity + entityId,
  entityId,
  companyId: companyId,
  itemData: {
  },
  modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-11'
}

const entity2Budget = {
  itemId: constants.prefix.entity + entityId2,
  entityId: entityId2,
  companyId: companyId,
  itemData: {

  },
  modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-11'
}

const companyBudget = {
  itemId: constants.prefix.company + companyId,
  entityId: companyId,
  companyId: companyId,
  itemData: {
    2020:
    {
      periods: 4,
      1: { total: 1000, approved: 0, pending: 0, committed: 0, available: 1000 },
      2: { total: 1000, approved: 0, pending: 0, committed: 0, available: 1000 },
      3: { total: 1000, approved: 0, pending: 0, committed: 0, available: 1000 },
      4: { total: 1000, approved: 0, pending: 0, committed: 0, available: 1000 },
    },
  },
  modifiedBy: 'GET-BUDGET-JEST-TEST-ADMIN-ID-11'
}

const userAdmin = {
  userId: userIdAdmin,
  entityId: companyId,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true
  }
};

const user = {
  userId: userId,
  entityId,
  companyId,
  createdBy: userId,
  modifiedBy: userId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user
  }
};

const settingsDefault = {
  itemId: `comp_${constants.defaultCompanySettings.id}`,
  userId: "offlineContext_cognitoIdentityId1",
  entityId: "offlineContext_cognitoIdentityId1",
  companyId,
  itemData: {
    talentCustomFields: {
      fields: [
        {
          id: 'stoke::talentId',
          name: 'Talent ID',
          uniqKey: true,
        }
      ]
    },
    customFields: {
      companyProvider: [
        {
          id: 'stoke::providerId',
          name: 'Provider ID',
          uniqKey: true,
        }
      ]
    },
  }
};

const settings = {
  itemId: `comp_${companyId}`,
  userId: "offlineContext_cognitoIdentityId1",
  entityId: "offlineContext_cognitoIdentityId1",
  companyId,
  itemData: {
    customFields: {
      companyProvider: [
        {
          id: 'stoke::providerId21',
          name: 'Provider ID21'
        }
      ]
    },
    legalDocs: {
      nda: "/" + jobsBucketName + "/defaults/legalDocs/nda.pdf",
      nonCompete: "/" + jobsBucketName + "/defaults/legalDocs/nonCompete.pdf",
      ipAssignment: "/" + jobsBucketName + "/defaults/legalDocs/ipAssignment.pdf"
    }
  }
};


describe('createJobFullFlow', () => {
  beforeAll(async () => {
    let response = await usersService.create(user);
    expect(response.userId).toBe(user.userId);
    response = await usersService.create(userAdmin);
    expect(response.userId).toEqual(userAdmin.userId);
    let settingsResponse = await settingsService.create(settingsDefault);
    expect(settingsResponse.itemId).toBe(settingsDefault.itemId);
    settingsResponse = await settingsService.create(settings);
    expect(settingsResponse.itemId).toBe(settings.itemId);
    await companyProvidersService.create({
      itemId: providerId,
      companyId,
      itemData: { isPayable: true, providerEmail: 'test1@test.com' }
    });

    await companyProvidersService.create({
      itemId: providerId2,
      companyId,
      itemData: { isPayable: true, providerEmail: 'test21@test.com' }
    });

    await companyProvidersService.create({
      itemId: talentId,
      companyId,
      itemData: { email: 'test1@test.com' }
    });
    await talentsService.create({
      itemId: talentId,
      companyId,
      itemData: { email: 'test1@test.com' }
    });
    await companyProvidersService.create({
      itemId: talentId2,
      companyId,
      itemData: { email: 'test21@test.com' }
    });
    response = await budgetsService.create(companyBudget);
    expect(response).toEqual(companyBudget);
    response = await budgetsService.create(adminUserBudget);
    expect(response).toEqual(adminUserBudget);
    response = await budgetsService.create(entityBudget);
    expect(response).toEqual(entityBudget);
    response = await budgetsService.create(entity2Budget);
    expect(response).toEqual(entity2Budget);
    response = await budgetsService.create(userBudget);
    expect(response).toEqual(userBudget);
    response = await budgetsService.create(userBudget2);
    expect(response).toEqual(userBudget2);
    response = await budgetsService.create(userBudgetEnity2);
    expect(response).toEqual(userBudgetEnity2);
    response = await budgetsService.create(userBudgetEnity22);
    expect(response).toEqual(userBudgetEnity22);
    response = await companiesService.create({
      companyId,
      itemId: constants.prefix.userPoolId + userId,
      userId,
      itemStatus: constants.user.status.invited,
      itemData: {
        userEmail: 'test1@test.com'
      }
    })

    response = await companiesService.create({
      companyId,
      itemId: constants.prefix.userPoolId + userId2,
      userId: userId2,
      itemStatus: constants.user.status.invited,
      itemData: {
        userEmail: 'test21@test.com'
      }
    })

  });


  it('createJob, expect 200, data', async () => {
    let result = await wrapped.run(s3Event)
    expect(Object.values(result)).toMatchObject([
      { milestones: 3, milestonesPending: 2, milestonesApproved: 1 },
      { milestones: 3, milestonesPending: 2, milestonesApproved: 1 },
      { milestones: 3, milestonesPending: 2, milestonesApproved: 1 },
      { milestones: 3, milestonesPending: 2, milestonesApproved: 1 }
    ])
    let jobs = await jobsService.list(entityId, userId)
    expect(jobs.length).toBe(4)
    jobs = await jobsService.list(entityId2, userId)
    expect(jobs.length).toBe(4)
    jobs = await jobsService.list(entityId, userId2)
    expect(jobs.length).toBe(4)
    jobs = await jobsService.list(entityId2, userId2)
    expect(jobs.length).toBe(4)
    let provider = await companyProvidersService.getByEmail(companyId, 'test31@test.com', 'providerEmail')
    // expect(provider[0].tags).toMatchObject({ 'stoke::providerId': "441", 'stoke::providerId2': "345" })
    expect(provider[0].itemData).toMatchObject({ providerEmail: 'test31@test.com', isProviderSelfEmployedTalent: true, providerName: 'test test' })
    provider = await companyProvidersService.getByEmail(companyId, 'test31@test.com', 'email')
    // expect(provider[0].tags).toMatchObject({ 'stoke::talentId': "333" })
    expect(provider[0].itemData).toMatchObject({ email: 'test31@test.com', isProviderSelfEmployedTalent: true, firstName: 'test', lastName: 'test' })
    provider = await companyProvidersService.getByEmail(companyId, 'test41@test.com', 'providerEmail')
    expect(provider[0].itemData).toMatchObject({ providerEmail: 'test41@test.com', isProviderSelfEmployedTalent: false, providerName: 'test test' })
    provider = await companyProvidersService.getByEmail(companyId, 'test441@test.com', 'email')
    expect(provider[0].itemData).toMatchObject({ email: 'test441@test.com', isProviderSelfEmployedTalent: false, firstName: 'test', lastName: 'test' })
    result = await budgetsService.get(entityId, userBudget.itemId)
    expect(result.itemData['2020']).toMatchObject({
      '1': {
        available: 0,
        approved: 0,
        committed: 0,
        total: 0,
        allocated: 0,
        pending: 0
      },
      '2': {
        available: 100,
        approved: 0,
        committed: 0,
        total: 100,
        pending: 0,
        allocated: 0
      },
      '3': {
        available: 120,
        approved: 0,
        committed: 0,
        total: 120,
        pending: 0,
        allocated: 0
      },
      '4': {
        available: 100,
        approved: 0,
        committed: 0,
        total: 100,
        pending: 0,
        allocated: 0
      },
      periods: 4

    })
    result = await budgetsService.get(entityId, userBudget2.itemId)
    expect(result.itemData['2020']).toMatchObject({
      '1': {
        available: 0,
        approved: 0,
        committed: 0,
        total: 0,
        allocated: 0,
        pending: 0
      },
      '2': {
        available: 100,
        approved: 0,
        committed: 0,
        total: 100,
        pending: 0,
        allocated: 0
      },
      '3': {
        available: 120,
        approved: 0,
        committed: 0,
        total: 120,
        pending: 0,
        allocated: 0
      },
      '4': {
        available: 100,
        approved: 0,
        committed: 0,
        total: 100,
        pending: 0,
        allocated: 0
      },
      periods: 4

    })
    result = await budgetsService.get(entityId, userBudgetEnity2.itemId)
    expect(result.itemData['2020']).toMatchObject({
      '1': {
        available: 0,
        approved: 0,
        committed: 0,
        total: 0,
        allocated: 0,
        pending: 0
      },
      '2': {
        available: 100,
        approved: 0,
        committed: 0,
        total: 100,
        pending: 0,
        allocated: 0
      },
      '3': {
        available: 120,
        approved: 0,
        committed: 0,
        total: 120,
        pending: 0,
        allocated: 0
      },
      '4': {
        available: 100,
        approved: 0,
        committed: 0,
        total: 100,
        pending: 0,
        allocated: 0
      },
      periods: 4

    })
    result = await budgetsService.get(entityId, userBudgetEnity22.itemId)
    expect(result.itemData['2020']).toMatchObject({
      '1': {
        available: 0,
        approved: 0,
        committed: 0,
        total: 0,
        allocated: 0,
        pending: 0
      },
      '2': {
        available: 100,
        approved: 0,
        committed: 0,
        total: 100,
        pending: 0,
        allocated: 0
      },
      '3': {
        available: 120,
        approved: 0,
        committed: 0,
        total: 120,
        pending: 0,
        allocated: 0
      },
      '4': {
        available: 100,
        approved: 0,
        committed: 0,
        total: 100,
        pending: 0,
        allocated: 0
      },
      periods: 4

    })

  });

  it('Validation errors, expect 200, errors', async () => {
    const result = await wrapped.run(s3EventError);
    expect(result[0].errors).toMatchObject([errorCodes.talentExistInOther]);
    // expect(result[0][1].errors).toMatchObject(['Provider ID is not valid']);
    // expect(result[0][2].errors).toMatchObject(['Provider ID is not valid', 'Talent ID is not valid']);
  })

  afterAll(async () => {
    await companiesService.delete(constants.prefix.userPoolId + userId)
    await companiesService.delete(constants.prefix.userPoolId + userId2)
    await usersService.delete(userId, entityId);
    await settingsService.delete(settings.itemId);
    const allProviders = await companyProvidersService.listCompany(companyId);
    for (const p of allProviders) {
      await companyProvidersService.delete(companyId, p.itemId);
    }
    await budgetsService.delete(companyId, adminUserBudget.itemId)
    await budgetsService.delete(entityId, userBudget.itemId)
    await budgetsService.delete(entityId, userBudget2.itemId)
    await budgetsService.delete(entityId, userBudgetEnity2.itemId)
    await budgetsService.delete(entityId, userBudgetEnity22.itemId)
    await budgetsService.delete(entityId, companyBudget.itemId)
    await budgetsService.delete(entityId, entityBudget.itemId)
    await budgetsService.delete(entityId, entity2Budget.itemId)
    const jobs = await jobsService.listByCompanyId('gsiItemsByCompanyIdAndItemId', companyId);
    for (const job of jobs) {
      await jobsService.delete(job.entityId, job.itemId)
    }
  });
});


