/* eslint-disable max-lines-per-function */
/* eslint-disable no-undef */
"use strict";

// tests for updateJob

const mod = require("../src/job/approveMilestoneBudgetRequest");
const _ = require('lodash');
const {
  UsersService,
  JobsService,
  constants,
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
const budgetsService = new BudgetsService(
  process.env.budgetsTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);

const jestPlugin = require("serverless-jest-plugin");
const { job } = require("stoke-app-common-api/config/constants");
const lambdaWrapper = jestPlugin.lambdaWrapper;
const approveMilestoneBudgetRequest = lambdaWrapper.wrap(mod, { handler: "handler" });

const entityId = "BUDGET-REQUEST-MS-JEST-TEST-ENT-ID-1";
const entityId2 = "BUDGET-REQUEST-MS-JEST-TEST-ENT-ID-2";
const companyId = "BUDGET-REQUEST-COMPANY_ID";
const userId = "BUDGET-REQUEST-USER-JOB";
const userId2 = "BUDGET-REQUEST-USER-JOB2";
const jobId1 = `${constants.prefix.job}BUDGET-REQUEST-job-1`;
const jobId2 = `${constants.prefix.job}BUDGET-REQUEST-job-2`;
const milestoneId = `${constants.prefix.milestone}${jobId1}_BUDGET-REQUEST-MILESTONE-1`;
const milestoneId2 = `${constants.prefix.milestone}${jobId1}_BUDGET-REQUEST-MILESTONE-2`;
const milestoneId3 = `${constants.prefix.milestone}${jobId1}_BUDGET-REQUEST-MILESTONE-3`;
const milestoneId5 = `${constants.prefix.milestone}${jobId2}_BUDGET-REQUEST-MILESTONE-5`;
const milestoneId6 = `${constants.prefix.milestone}${jobId2}_BUDGET-REQUEST-MILESTONE-6`;
const milestoneId7 = `${constants.prefix.milestone}${jobId2}_BUDGET-REQUEST-MILESTONE-7`;

const companyBudget = {
  itemId: constants.prefix.company + companyId,
  entityId: entityId,
  companyId: companyId,
  itemData: {
    [2019]: {
      periods: 4,
      1: { total: 500, approved: 0, pending: 0, committed: 0, available: 500 },
      2: { total: 500, approved: 0, pending: 0, committed: 0, available: 500 },
      3: { total: 500, approved: 0, pending: 0, committed: 0, available: 500 },
      4: { total: 500, approved: 0, pending: 0, committed: 0, available: 500 }
    },
  },
  modifiedBy: userId
};

const entity1Budget = {
  itemId: constants.prefix.entity + entityId,
  entityId: entityId,
  companyId: companyId,
  itemData: {
    [2019]: {
      periods: 4,
      1: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
      2: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
      3: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
      4: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 }
    },
  },
  modifiedBy: userId
};

const entity2Budget = {
  itemId: constants.prefix.entity + entityId2,
  entityId: entityId2,
  companyId: companyId,
  itemData: {
    [2019]: {
      periods: 4,
      1: { total: 500, approved: 0, pending: 0, committed: 0, available: 500 },
      2: { total: 500, approved: 0, pending: 0, committed: 0, available: 500 },
      3: { total: 500, approved: 0, pending: 0, committed: 0, available: 500 },
      4: { total: 500, approved: 0, pending: 0, committed: 0, available: 500 }
    },
  },
  modifiedBy: userId
};


const userBudget = {
  itemId: constants.prefix.user + userId,
  entityId: entityId,
  companyId: companyId,
  itemData: {
    [2019]: {
      periods: 4,
      1: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
      2: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
      3: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
      4: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 }
    },
  },
  modifiedBy: userId
};

const userCompanyBudget = {
  itemId: constants.prefix.user + userId2,
  entityId: companyId,
  companyId: companyId,
  itemData: {
    [2019]: {
      periods: 4,
      1: { total: 200, approved: 0, pending: 0, committed: 0, available: 200 },
      2: { total: 200, approved: 0, pending: 0, committed: 0, available: 200 },
      3: { total: 200, approved: 0, pending: 0, committed: 0, available: 200 },
      4: { total: 200, approved: 0, pending: 0, committed: 0, available: 200 }
    },
  },
  modifiedBy: userId
};

const user2Budget = {
  itemId: constants.prefix.user + userId2,
  entityId: entityId2,
  companyId: companyId,
  itemData: {
    [2019]: {
      periods: 4,
      1: { total: 200, approved: 0, pending: 0, committed: 0, available: 200 },
      2: { total: 200, approved: 0, pending: 0, committed: 0, available: 200 },
      3: { total: 200, approved: 0, pending: 0, committed: 0, available: 200 },
      4: { total: 200, approved: 0, pending: 0, committed: 0, available: 200 }
    },
  },
  modifiedBy: userId2
};

const eventBody = {
  entityId: entityId,
  companyId: companyId,
  sourceEntityId: entityId2,
  items: [{ itemId: milestoneId, entityId: entityId }]
};

const eventBody2 = {
  entityId: entityId,
  companyId: companyId,
  sourceEntityId: entityId2,
  items: [{ itemId: milestoneId2, entityId: entityId2 }]
};

const eventBody3 = {
  entityId: entityId,
  companyId: companyId,
  sourceEntityId: entityId2,
  items: [{ itemId: milestoneId3, entityId }]
};

const eventBody4 = {
  entityId: entityId,
  companyId: companyId,
  sourceEntityId: entityId,
  items: [{ itemId: milestoneId3, entityId }]
};

const eventBody5 = {
  entityId: entityId2,
  companyId: companyId,
  sourceEntityId: entityId2,
  items: [{ itemId: milestoneId5, entityId: entityId2 }]
};

const eventBody6 = {
  entityId: entityId2,
  companyId: companyId,
  items: [{ itemId: milestoneId6, entityId: entityId2 }],
};

const eventBody7 = {
  entityId: entityId2,
  companyId: companyId,
  items: [{ itemId: milestoneId7, entityId: entityId2 }],
};

const eventBody8 = {
  entityId: entityId,
  companyId: companyId,
  PONumber: 's100',
  items: [{ itemId: milestoneId, entityId }, { itemId: milestoneId2, entityId: entityId2 }, { itemId: milestoneId3, entityId }],
};

const eventBody9 = {
  entityId: entityId,
  sourceEntityId: companyId,
  companyId: companyId,
  items: [],
};

const wrongEventBody = {
  entityId: entityId + "_WRONG",
  sourceEntityId: entityId2,
  companyId: companyId
};

const approveMsData = {
  body: JSON.stringify(eventBody),
  requestContext: {
    identity: {
      cognitoIdentityId: userId2,
    }
  }
};

const approveMsData2 = {
  body: JSON.stringify(eventBody2),
  requestContext: {
    identity: {
      cognitoIdentityId: userId2
    }
  }
};

const approveMsData3 = {
  body: JSON.stringify(eventBody3),
  requestContext: {
    identity: {
      cognitoIdentityId: userId2
    }
  }
};

const approveMsData4 = {
  body: JSON.stringify(eventBody4),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  }
};

const approveMsData5 = {
  body: JSON.stringify(eventBody5),
  requestContext: {
    identity: {
      cognitoIdentityId: userId2
    }
  }
};

const approveMsData6 = {
  body: JSON.stringify(eventBody6),
  requestContext: {
    identity: {
      cognitoIdentityId: userId2
    }
  }
};

const approveMsData7 = {
  body: JSON.stringify(eventBody7),
  requestContext: {
    identity: {
      cognitoIdentityId: userId2
    }
  }
};

const approveMsData8 = {
  body: JSON.stringify(eventBody8),
  requestContext: {
    identity: {
      cognitoIdentityId: userId2
    }
  }
};

const eventWithNoMS = {
  body: {},
  requestContext: {
    identity: {
      cognitoIdentityId: userId2
    }
  }
};

const wrongSignedJobData = {
  body: JSON.stringify(wrongEventBody),
  requestContext: {
    identity: {
      cognitoIdentityId: userId2
    }
  },
  pathParameters: {
    id: milestoneId
  }
};

const job1 = {
  itemId: jobId1,
  entityId,
  itemStatus: constants.job.status.active,
  itemData: { jobTitle: 'jobTitle', cost: 100 },
  companyId,
  userId
}

const job2 = {
  itemId: jobId2,
  entityId: entityId2,
  itemStatus: constants.job.status.active,
  itemData: { jobTitle: 'jobTitle2', cost: 100 },
  companyId,
  userId
}

const milestone = {
  itemId: milestoneId,
  entityId,
  itemStatus: constants.job.status.budgetRequest,
  itemData: { date: 1546500308000, cost: 100, jobId: jobId1, budgetRequestSentEmail: true },
  companyId,
  userId
}

const milestone2 = {
  itemId: milestoneId2,
  entityId,
  itemStatus: constants.job.status.overageBudgetRequest,
  itemData: { date: 1546500308000, cost: 100, actualCost: 200, jobId: jobId1, budgetRequestSentEmail: true },
  companyId,
  userId
}

const milestone3 = {
  itemId: milestoneId3,
  entityId,
  itemStatus: constants.job.status.budgetRequest,
  itemData: { date: 1546500308000, cost: 100, jobId: jobId1, budgetRequestSentEmail: true },
  companyId,
  userId
}

const milestone5 = {
  itemId: milestoneId5,
  entityId: entityId2,
  itemStatus: constants.job.status.budgetRequest,
  itemData: { date: 1546500308000, cost: 100, jobId: jobId2, budgetRequestSentEmail: true },
  companyId,
  userId: userId2
}

const approversChain = {
  "1": {
    level: 1,
    type: constants.multiLevelTypes.anyone
  },
  "2": {
    level: 2,
    threshold: 50,
    type: constants.multiLevelTypes.departmentAdmin
  },
  "3": {
    level: 3,
    threshold: 100,
    type: constants.multiLevelTypes.companyAdmin
  },
};

const milestone6 = {
  itemId: milestoneId6,
  entityId: entityId2,
  itemStatus: constants.job.status.overageBudgetRequest,
  itemData: {
    date: 1546500308000,
    cost: 100,
    actualCost: 200,
    jobId: jobId2,
    budgetRequestSentEmail: true,
    approversChain,
    approvals: [{ approvedBy: userId, action: 'approved', level: 1 }],
  },
  companyId,
  userId: userId2
}

const milestone7 = {
  itemId: milestoneId7,
  entityId: entityId2,
  itemStatus: constants.job.status.overageBudgetRequest,
  itemData: {
    date: 1546500308000,
    cost: 100,
    actualCost: 200,
    jobId: jobId2,
    budgetRequestSentEmail: true,
    approversChain: {
      1: { level: 1, type: constants.multiLevelTypes.anyone, approvedBy: userId2 },
      2: { level: 2, threshold: 50, type: constants.multiLevelTypes.namedUser, userIds: [3] },
      3: { level: 3, threshold: 100, type: constants.multiLevelTypes.namedUser, userIds: [1] },
    },
    approvals: [{ approvedBy: userId2, action: 'approved', level: 1 }],
  },
  companyId,
  userId: userId2
}

const user1 = {
  userId: userId,
  entityId: entityId,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true
  }
}

const user2 = {
  userId: userId2,
  entityId: entityId2,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true
  }
}

const user2Incompany = {
  userId: userId2,
  entityId: companyId,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true
  }
}

const user2InEntity1 = {
  userId: userId2,
  entityId: entityId,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true
  }
}

describe("approveMilestoneBudgetRequest", () => {
  beforeEach(async () => {
    let result = await jobsService.create(job1);
    expect(result).toEqual(job1);
    result = await jobsService.create(job2);
    expect(result).toEqual(job2);
    result = await jobsService.create(milestone);
    expect(result).toEqual(milestone);
    result = await jobsService.create(milestone2);
    expect(result).toEqual(milestone2);
    result = await jobsService.create(milestone3);
    expect(result).toEqual(milestone3);
    result = await jobsService.create(milestone5);
    expect(result).toEqual(milestone5);
    result = await jobsService.create(milestone6);
    expect(result).toEqual(milestone6);
    result = await jobsService.create(milestone7);
    expect(result).toEqual(milestone7);
    result = await usersService.create(user1);
    expect(result).toEqual(user1);
    result = await usersService.create(user2);
    expect(result).toEqual(user2);
    result = await usersService.create(user2Incompany);
    expect(result).toEqual(user2Incompany);
    result = await usersService.create(user2InEntity1);
    expect(result).toEqual(user2InEntity1);
    result = await budgetsService.create(userBudget);
    expect(result).toEqual(userBudget);
    result = await budgetsService.create(userCompanyBudget);
    expect(result).toEqual(userCompanyBudget);
    result = await budgetsService.create(user2Budget);
    expect(result).toEqual(user2Budget);
    result = await budgetsService.create(companyBudget);
    expect(result).toEqual(companyBudget);
    result = await budgetsService.create(entity1Budget);
    expect(result).toEqual(entity1Budget);
    result = await budgetsService.create(entity2Budget);
    expect(result).toEqual(entity2Budget);
  });

  it("approveMilestoneBudgetRequest post, expect 200 - old configuration", async () => {
    let response = await approveMilestoneBudgetRequest.run(approveMsData);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId);
    expect(response.itemStatus).toBe(constants.job.status.active);
    response = await budgetsService.get(entityId, userBudget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ approved: 0, available: 100, committed: 0, pending: 0, total: 100 });
    response = await budgetsService.get(entityId2, user2Budget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ total: 100, approved: 0, pending: 0, committed: 0, available: 100 });
    response = await budgetsService.get(entityId, companyBudget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ approved: 0, available: 500, committed: 0, pending: 0, total: 500 });
    response = await budgetsService.get(entityId, entity1Budget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ approved: 0, available: 100, committed: 0, pending: 0, total: 100 });
    response = await budgetsService.get(entityId2, entity2Budget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ total: 400, approved: 0, pending: 0, committed: 0, available: 400 });
    
    await usersService.update({
      userId: user2.userId, entityId: user2.entityId, modifiedBy: user2.userId, itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
      }
    })

    response = await approveMilestoneBudgetRequest.run(approveMsData2);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId2);
    expect(response.itemStatus).toBe(constants.job.status.completed);
    response = await budgetsService.get(entityId, userBudget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ approved: 0, available: 200, committed: 0, pending: 0, total: 200 });
    response = await budgetsService.get(entityId2, user2Budget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ total: 0, approved: 0, pending: 0, committed: 0, available: 0 });
    response = await budgetsService.get(entityId, companyBudget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ approved: 0, available: 500, committed: 0, pending: 0, total: 500 });
    response = await budgetsService.get(entityId, entity1Budget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ approved: 0, available: 200, committed: 0, pending: 0, total: 200 });
    response = await budgetsService.get(entityId2, entity2Budget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ total: 300, approved: 0, pending: 0, committed: 0, available: 300 });

    response = await approveMilestoneBudgetRequest.run(approveMsData3);
    response = JSON.parse(response.body)
    
    
    response = await jobsService.get(entityId, milestoneId3);
    expect(response.itemStatus).toBe(constants.job.status.budgetRequest);
    response = await budgetsService.get(entityId, userBudget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ approved: 0, available: 200, committed: 0, pending: 0, total: 200 });
    response = await budgetsService.get(entityId2, user2Budget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ total: 0, approved: 0, pending: 0, committed: 0, available: 0 });
    response = await budgetsService.get(entityId, companyBudget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ approved: 0, available: 500, committed: 0, pending: 0, total: 500 });
    response = await budgetsService.get(entityId, entity1Budget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ approved: 0, available: 200, committed: 0, pending: 0, total: 200 });
    response = await budgetsService.get(entityId2, entity2Budget.itemId);
    expect(response.itemData[2019][1]).toMatchObject({ total: 300, approved: 0, pending: 0, committed: 0, available: 300 });

    response = await approveMilestoneBudgetRequest.run(approveMsData4);
    response = await jobsService.get(entityId, milestoneId3);
    expect(response.itemStatus).toBe(constants.job.status.active);
    const { budgetRequestSentEmail } = response.itemData;
    expect(budgetRequestSentEmail).toBeFalsy();

    response = await approveMilestoneBudgetRequest.run(approveMsData5);
    response = JSON.parse(response.body)
    const succedeResult = response.allResults
    expect(succedeResult).toEqual(undefined);
    response = await jobsService.get(entityId2, milestoneId5);
    expect(response.itemStatus).toBe(constants.job.status.budgetRequest);
  });


  it("approveMilestoneBudgetRequest post, expect unauthorised", async () => {
    const response = await approveMilestoneBudgetRequest.run(wrongSignedJobData);
    expect(response.statusCode).toBe(403);
  });

  it("approveMilestoneBudgetRequest post, with talentCompletedAt expect 'Completed' status", async () => {
    const milestone = await jobsService.get(entityId, milestoneId);
    milestone.itemData.talentCompletedAt = Date.now();
    milestone.modifiedBy = userId;
    await jobsService.update(milestone);

    const response = await approveMilestoneBudgetRequest.run(approveMsData);
    expect(response.statusCode).toBe(200);

    const updatedMilestone = await jobsService.get(entityId, milestoneId);
    expect(updatedMilestone.itemStatus).toBe(constants.job.status.completed);
  });

  it("overageBudgetRequest, next status Second Approval level 3", async () => {
    let response = await approveMilestoneBudgetRequest.run(approveMsData6);
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    
    const succedeResult = response.allMilestonesTransferred[0]

    expect(succedeResult.result.Attributes.itemData.approvals.length).toBe(1);
    expect(succedeResult.result.Attributes.itemData.isNextLevelApprover).toBe(true);
    expect(succedeResult.result.Attributes.itemStatus).toBe(constants.job.status.secondApproval);

  });

  it("overageBudgetRequest, next status Second Approval level 2", async () => {
    let response = await approveMilestoneBudgetRequest.run(approveMsData7);
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);

    const succedeResult = response.allMilestonesTransferred[0]

    expect(succedeResult.result.Attributes.itemData.approvals.length).toBe(1);
    expect(succedeResult.result.Attributes.itemData.isNextLevelApprover).toBeFalsy();
    expect(succedeResult.result.Attributes.itemStatus).toBe(constants.job.status.secondApproval);
  });

  describe('mail actions', () => {
    describe('extract MS by code', () => {
      beforeAll(async () => {
        const milestonesToSave = [milestone, milestone2]
        const emailCode = await jobsService.persisMilestonesForMail(companyId, milestonesToSave)
        eventWithNoMS.body = JSON.stringify(Object.assign(eventBody9, { emailCode } ))
      })
      
      it('approveMilestoneBudgetRequest - items are coming from email from mail', async () => {
          let response = await approveMilestoneBudgetRequest.run(eventWithNoMS);
          expect(response.statusCode).toBe(200);
          
          response = JSON.parse(response.body);
          expect(response.length).toEqual(2);
      });
    })
  })

  afterEach(async () => {
    //cleanup
    let result = await jobsService.delete(entityId, milestoneId);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, milestoneId2);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, milestoneId3);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId2, milestoneId5);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId2, milestoneId6);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId2, milestoneId7);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, jobId1);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId2, jobId2);
    expect(result).toBe(true);
    result = await usersService.delete(userId, entityId);
    expect(result).toBeTruthy();
    result = await usersService.delete(userId2, entityId2);
    expect(result).toBeTruthy();
    result = await usersService.delete(userId2, entityId);
    expect(result).toBeTruthy();
    result = await budgetsService.delete(entityId, userBudget.itemId);
    expect(result).toBeTruthy();
    result = await budgetsService.delete(userCompanyBudget.entityId, userCompanyBudget.itemId);
    expect(result).toBeTruthy();
    result = await budgetsService.delete(entityId, user2Budget.itemId);
    expect(result).toBeTruthy();
    result = await budgetsService.delete(entityId, companyBudget.itemId);
    expect(result).toBeTruthy();
    result = await budgetsService.delete(entityId, entity1Budget.itemId);
    expect(result).toBeTruthy();
    result = await budgetsService.delete(entityId, entity2Budget.itemId);
    expect(result).toBeTruthy();
    result = await budgetsService.delete(entityId2, entity2Budget.itemId);
    expect(result).toBeTruthy();
    result = await budgetsService.delete(entityId2, user2Budget.itemId);
    expect(result).toBeTruthy();
  });
});
