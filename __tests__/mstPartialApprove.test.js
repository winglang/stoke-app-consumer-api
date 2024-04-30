/* eslint-disable max-lines */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */
/* eslint-disable max-lines-per-function */

"use strict";

// tests for partialApprove
const _ = require('lodash');
const mod = require("../src/job/milestonePartialApprove");
const {
  UsersService,
  JobsService,
  constants,
  SettingsService,
  BudgetsService
} = require("stoke-app-common-api");
const usersService = new UsersService(
  process.env.consumerAuthTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);
const jobsService = new JobsService(
  process.env.jobsTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);
const settingsService = new SettingsService(
  process.env.settingsTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);
const budgetsService = new BudgetsService(
  process.env.budgetsTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);

const jestPlugin = require("serverless-jest-plugin");
const wrappedPartialApprove = jestPlugin.lambdaWrapper.wrap(mod, {
  handler: 'handler'
});
const testName = 'MS-PARTIAL-APPROVE-JEST-TEST';
const entityId = `${testName}-ENT-ID-1`;
const companyId = `${testName}-COMPANY-ID`;
const userId = "USER-NUMBER1";
const userId2 = "USER-NUMBER2";
const userHirinManagerId = `${testName}-HIRING-MANAGER`;
const userCompanyAdminId = `${testName}-COMP-ADMIN`;
const jobId = `${constants.prefix.job}${testName}-JOB`
const milestoneJobIdms1 = `${constants.prefix.milestone}${jobId}_1`;



const companySettings = {
  itemId: `${constants.prefix.company}${companyId}`,
  itemData: {
    multiLevelApproval: {
      enabled: true,
      approversChain: {
        "1": {
          level: 1,
          threshold: 300,
          type: constants.multiLevelTypes.anyone
        },
        "2": {
          level: 2,
          threshold: 1000,
          type: constants.multiLevelTypes.departmentAdmin
        },
        "3": {
          level: 3,
          threshold: 3000,
          type: constants.multiLevelTypes.namedUser,
          userIds: [userCompanyAdminId]
        },
      }
    }
  }
};

const entitySettings = {
  itemId: `${constants.prefix.entity}${entityId}`,
  itemData: {
    multiLevelApproval: {}
  }
};

const user1Budget = {
  entityId: entityId,
  itemId: `${constants.prefix.user}${userHirinManagerId}`,
  companyId,
  itemData: {
    2021:
    {
      periods: 4,
      1: { total: 0, available: 0, approved: 0, pending: 0, committed: 0 },
      2: { total: 0, available: 0, approved: 0, pending: 0, committed: 0 },
      3: { total: 8900, available: 4461, approved: 0, pending: 4400, committed: 39 },
      4: { total: 0, available: 0, approved: 0, pending: 0, committed: 0 }
    }
  }
};

const eventBody1 = (amount) => ({
  entityId: entityId,
  approveAmount: amount,
  milestoneId: milestoneJobIdms1,
});

const createPartialApproveMS = (body, cognitoUserId) => ({
  body: JSON.stringify(body),
  requestContext: {
    identity: {
      cognitoIdentityId: cognitoUserId
    }
  },
})

const userAdminInEntity = {
  userId: userId,
  entityId: entityId,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true
  }
};

const userHiringManagerInEntity = {
  userId: userHirinManagerId,
  entityId: entityId,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user,
    isEditor: true
  }
}

const userCompanyAdminInCompany = {
  userId: userCompanyAdminId,
  entityId: companyId,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true
  }
}

const userCompanyAdminInEntity = {
  userId: userCompanyAdminId,
  entityId: entityId,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true
  }
}

const resolveMilestone = (status, cost, date = 1609452000000) => ({
  itemId: milestoneJobIdms1,
  entityId: entityId,
  itemStatus: status,
  itemData: {
    jobId,
    cost: status !== constants.job.status.requested ? cost : 0,
    actualCost: cost,
    requestedActualCost: cost,
    date,
    providerData: { taxInfo: { subTotal: cost, tax: 0, total: cost } }
  },
  companyId,
  userId: userHirinManagerId,
})

let result
let approveAmount = 30
let secondApproveAmount = 15
let thirdApproveAmount = 10
let requestAmount = 100

describe("milestonePartialApprove", () => {
  beforeEach(async () => {
    result = await jobsService.create({
      itemId: jobId,
      entityId,
      itemStatus: constants.job.status.active,
      itemData: { totalBudget: 100 },
      companyId,
      userId: userHirinManagerId
    });
    expect(result.itemId).toEqual(jobId);

    result = await usersService.create(userAdminInEntity);
    expect(result).toEqual(userAdminInEntity);

    result = await usersService.create(userHiringManagerInEntity);
    expect(result).toEqual(userHiringManagerInEntity);

    result = await usersService.create(userCompanyAdminInCompany);
    expect(result).toEqual(userCompanyAdminInCompany);

    result = await usersService.create(userCompanyAdminInEntity);
    expect(result).toEqual(userCompanyAdminInEntity);

    result = await settingsService.create(companySettings);
    expect(result.itemData).toEqual(companySettings.itemData);
    result = await settingsService.create(entitySettings);
    expect(result.itemData).toEqual(entitySettings.itemData);

    result = await budgetsService.create(user1Budget);
    expect(result.itemId).toEqual(user1Budget.itemId);
  });

  afterEach(async () => {
    await jobsService.delete(entityId, jobId);
    await jobsService.delete(entityId, milestoneJobIdms1);
    await usersService.delete(userAdminInEntity.userId, userAdminInEntity.entityId);
    await usersService.delete(userHiringManagerInEntity.userId, userHiringManagerInEntity.entityId);
    await usersService.delete(userCompanyAdminInCompany.userId, userCompanyAdminInCompany.entityId);
    await usersService.delete(userCompanyAdminInEntity.userId, userCompanyAdminInEntity.entityId);
    await settingsService.delete(companySettings.itemId);
    await settingsService.delete(entitySettings.itemId);
    await budgetsService.delete(user1Budget.entityId, user1Budget.itemId);
  });

  it("milestonePartialApprove post, expect 200", async () => {
    result = await jobsService.create(resolveMilestone(constants.job.status.pendingApproval, requestAmount));
    expect(result.itemId).toEqual(milestoneJobIdms1);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(30), userHirinManagerId));
    expect(result.statusCode).toBe(200);
  });

  it("milestonePartialApprove post, expect unauthorised", async () => {
    result = await jobsService.create(resolveMilestone(constants.job.status.pendingApproval, requestAmount));
    expect(result.itemId).toEqual(milestoneJobIdms1);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(30), userId2));
    expect(result.statusCode).toBe(403);
  });

  it("milestonePartialApprove post, expect missing params", async () => {
    result = await jobsService.create(resolveMilestone(constants.job.status.pendingApproval, requestAmount));
    expect(result.itemId).toEqual(milestoneJobIdms1);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(), userId2));
    expect(result.statusCode).toBe(500);

    result = await wrappedPartialApprove.run(createPartialApproveMS(_.omit(eventBody1(30), 'entityId'), userId2));
    expect(result.statusCode).toBe(500);

    result = await wrappedPartialApprove.run(createPartialApproveMS(_.omit(eventBody1(30), 'milestoneId'), userId2));
    expect(result.statusCode).toBe(500);
  });

  it("milestonePartialApprove post, expect exeption on wrong milestone status", async () => {
    result = await jobsService.create(resolveMilestone(constants.job.status.budgetRequest, requestAmount));
    expect(result.itemId).toEqual(milestoneJobIdms1);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(50), userHirinManagerId));
    expect(result.statusCode).toBe(403);
  });

  it("milestonePartialApprove post, expect exeption on non-exist milestone", async () => {
    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(50), userHirinManagerId));
    expect(result.statusCode).toBe(403);
  });

  it("send pending apprval MS expect recieve completed and pending approval MSs with right amounts", async () => {
    result = await jobsService.create(resolveMilestone(constants.job.status.pendingApproval, requestAmount));
    expect(result.itemId).toEqual(milestoneJobIdms1);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(approveAmount), userHirinManagerId));
    let [approvedMilestone, remainingMilestone] = JSON.parse(result.body);

    expect(approvedMilestone.itemStatus).toBe(constants.job.status.completed);
    expect(approvedMilestone.itemData.actualCost).toBe(approveAmount);
    expect(remainingMilestone.itemStatus).toBe(constants.job.status.pendingApproval);
    expect(remainingMilestone.itemData.actualCost).toBe(requestAmount - approveAmount);
    expect(remainingMilestone.itemData.splittedMilestoneNumber).toBe(2);
  });

  it("send requested MS expect recieve completed and pending approval request MSs with right amounts", async () => {
    result = await jobsService.create(resolveMilestone(constants.job.status.requested, requestAmount, new Date('08.22.2021').getTime()));
    expect(result.itemId).toEqual(milestoneJobIdms1);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(approveAmount), userHirinManagerId));
    let [approvedMilestone, remainingMilestone] = JSON.parse(result.body);

    expect(approvedMilestone.itemStatus).toBe(constants.job.status.completed);
    expect(approvedMilestone.itemData.actualCost).toBe(approveAmount);
    expect(remainingMilestone.itemStatus).toBe(constants.job.status.pendingApproval);
    expect(remainingMilestone.itemData.actualCost).toBe(requestAmount - approveAmount);
    expect(remainingMilestone.itemData.splittedMilestoneNumber).toBe(2);
  });

  it("send requested MS expect recieve budget request and overage budget request MSs with right amounts", async () => {
    requestAmount = 250
    approveAmount = 150
    result = await jobsService.create(resolveMilestone(constants.job.status.requested, requestAmount));
    expect(result.itemId).toEqual(milestoneJobIdms1);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(approveAmount), userHirinManagerId));
    let [firstMilestone, remainingMilestone] = JSON.parse(result.body);

    expect(firstMilestone.itemStatus).toBe(constants.job.status.overageBudgetRequest);
    expect(firstMilestone.itemData.actualCost).toBe(approveAmount);
    expect(remainingMilestone.itemStatus).toBe(constants.job.status.pendingApproval);
    expect(remainingMilestone.itemData.actualCost).toBe(requestAmount - approveAmount);
    expect(remainingMilestone.itemData.splittedMilestoneNumber).toBe(2);
  });

  it("send pending approval with regular user MS expect recieve second approve and pending approval MSs with right amounts", async () => {
    requestAmount = 1400
    approveAmount = 1100
    result = await jobsService.create(resolveMilestone(constants.job.status.pendingApproval, requestAmount, new Date('08.22.2021').getTime()));
    expect(result.itemId).toEqual(milestoneJobIdms1);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(approveAmount), userHirinManagerId));
    let [firstMilestone, remainingMilestone] = JSON.parse(result.body);

    expect(firstMilestone.itemStatus).toBe(constants.job.status.secondApproval);
    expect(firstMilestone.itemData.actualCost).toBe(approveAmount);
    expect(remainingMilestone.itemStatus).toBe(constants.job.status.pendingApproval);
    expect(remainingMilestone.itemData.actualCost).toBe(requestAmount - approveAmount);
    expect(remainingMilestone.itemData.splittedMilestoneNumber).toBe(2);
  });

  it("send pending approval with department admin MS expect recieve completed and pending approval MSs with right amounts", async () => {
    requestAmount = 400
    approveAmount = 350
    result = await jobsService.create(resolveMilestone(constants.job.status.pendingApproval, requestAmount, new Date('08.22.2021').getTime()));
    expect(result.itemId).toEqual(milestoneJobIdms1);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(approveAmount), userId));
    let [approvedMilestone, remainingMilestone] = JSON.parse(result.body);

    expect(approvedMilestone.itemStatus).toBe(constants.job.status.completed);
    expect(approvedMilestone.itemData.actualCost).toBe(approveAmount);
    expect(remainingMilestone.itemStatus).toBe(constants.job.status.pendingApproval);
    expect(remainingMilestone.itemData.actualCost).toBe(requestAmount - approveAmount);
    expect(remainingMilestone.itemData.splittedMilestoneNumber).toBe(2);
  });

  it("send pending approval with department admin MS expect recieve second approve and pending approval MSs with right amounts", async () => {
    requestAmount = 1400
    approveAmount = 1100
    secondApproveAmount = 1001
    result = await jobsService.create(resolveMilestone(constants.job.status.pendingApproval, requestAmount, new Date('08.22.2021').getTime()));
    expect(result.itemId).toEqual(milestoneJobIdms1);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(approveAmount), userId));
    let [firstMilestone, remainingMilestone] = JSON.parse(result.body);

    expect(firstMilestone.itemStatus).toBe(constants.job.status.secondApproval);
    expect(firstMilestone.itemData.actualCost).toBe(approveAmount);
    expect(remainingMilestone.itemStatus).toBe(constants.job.status.pendingApproval);
    expect(remainingMilestone.itemData.actualCost).toBe(requestAmount - approveAmount);
    expect(remainingMilestone.itemData.splittedMilestoneNumber).toBe(2);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(secondApproveAmount, firstMilestone.id), userId));
    [firstMilestone, remainingMilestone] = JSON.parse(result.body);

    expect(firstMilestone.itemStatus).toBe(constants.job.status.completed);
    expect(firstMilestone.itemData.actualCost).toBe(secondApproveAmount);
    expect(remainingMilestone.itemStatus).toBe(constants.job.status.secondApproval);
    expect(remainingMilestone.itemData.actualCost).toBe(approveAmount - secondApproveAmount);
    expect(remainingMilestone.itemData.splittedMilestoneNumber).toBe(2);
  });

  it("send pending approval with company admin MS expect recieve completed and pending approval MSs with right amounts", async () => {
    approveAmount = 1100
    requestAmount = 1400
    secondApproveAmount = 1001
    result = await jobsService.create(resolveMilestone(constants.job.status.pendingApproval, requestAmount, new Date('08.22.2021').getTime()));
    expect(result.itemId).toEqual(milestoneJobIdms1);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(approveAmount), userAdminInEntity.userId));
    let [firstMilestone, remainingMilestone] = JSON.parse(result.body);

    expect(firstMilestone.itemStatus).toBe(constants.job.status.secondApproval);
    expect(firstMilestone.itemData.actualCost).toBe(approveAmount);
    expect(remainingMilestone.itemStatus).toBe(constants.job.status.pendingApproval);
    expect(remainingMilestone.itemData.actualCost).toBe(requestAmount - approveAmount);
    expect(remainingMilestone.itemData.splittedMilestoneNumber).toBe(2);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(secondApproveAmount, firstMilestone.id), userCompanyAdminId));
    [firstMilestone, remainingMilestone] = JSON.parse(result.body);

    expect(firstMilestone.itemStatus).toBe(constants.job.status.completed);
    expect(firstMilestone.itemData.actualCost).toBe(secondApproveAmount);
    expect(remainingMilestone.itemStatus).toBe(constants.job.status.secondApproval);
    expect(remainingMilestone.itemData.actualCost).toBe(approveAmount - secondApproveAmount);
    expect(remainingMilestone.itemData.splittedMilestoneNumber).toBe(2);
  });

  it("send pending approval with company admin MS expect recieve second approve and pending approval MSs with right amounts", async () => {
    requestAmount = 4400
    approveAmount = 3600
    secondApproveAmount = 3400
    thirdApproveAmount = 3200
    result = await jobsService.create(resolveMilestone(constants.job.status.pendingApproval, requestAmount, new Date('08.22.2021').getTime()));
    expect(result.itemId).toEqual(milestoneJobIdms1);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(approveAmount), userCompanyAdminId));
    let [firstMilestone, remainingMilestone] = JSON.parse(result.body);

    expect(firstMilestone.itemStatus).toBe(constants.job.status.secondApproval);
    expect(firstMilestone.itemData.actualCost).toBe(approveAmount);
    expect(remainingMilestone.itemStatus).toBe(constants.job.status.pendingApproval);
    expect(remainingMilestone.itemData.actualCost).toBe(requestAmount - approveAmount);
    expect(remainingMilestone.itemData.splittedMilestoneNumber).toBe(2);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(secondApproveAmount, firstMilestone.id), userCompanyAdminId));
    [firstMilestone, remainingMilestone] = JSON.parse(result.body);

    expect(firstMilestone.itemStatus).toBe(constants.job.status.secondApproval);
    expect(firstMilestone.itemData.actualCost).toBe(secondApproveAmount);
    expect(remainingMilestone.itemStatus).toBe(constants.job.status.secondApproval);
    expect(remainingMilestone.itemData.actualCost).toBe(approveAmount - secondApproveAmount);
    expect(remainingMilestone.itemData.splittedMilestoneNumber).toBe(2);

    result = await wrappedPartialApprove.run(createPartialApproveMS(eventBody1(thirdApproveAmount, firstMilestone.id), userCompanyAdminId));
    [firstMilestone, remainingMilestone] = JSON.parse(result.body);

    expect(firstMilestone.itemStatus).toBe(constants.job.status.completed);
    expect(firstMilestone.itemData.actualCost).toBe(thirdApproveAmount);
    expect(remainingMilestone.itemStatus).toBe(constants.job.status.secondApproval);
    expect(remainingMilestone.itemData.actualCost).toBe(secondApproveAmount - thirdApproveAmount);
    expect(remainingMilestone.itemData.splittedMilestoneNumber).toBe(2);
  });
});
