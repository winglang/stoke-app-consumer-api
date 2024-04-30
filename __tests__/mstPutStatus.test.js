/* eslint-disable max-lines */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */
/* eslint-disable max-lines-per-function */

"use strict";

// tests for updateJob

const mod = require("../src/job/updateMilestoneStatus");
const {
  UsersService,
  JobsService,
  constants,
  BudgetsService,
  SettingsService,
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
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const jestPlugin = require("serverless-jest-plugin");
const handler = jestPlugin.lambdaWrapper.wrap(mod, {
  handler: 'handler'
});
const testName = 'UPDATE-STATUS-MS-JEST-TEST';
const entityId = `${testName}-ENT-ID-1`;
const entityId2 = `${testName}-ENT-ID-2`;
const entityId3 = `${testName}-ENT-ID-3`;
const companyId = `${testName}-COMPANY-ID`;
const userId = "MST-PUT-STATUS";
const userId2 = "MST-PUT-STATUS2";
const userHirinManagerId = `${testName}-HIRING-MANAGER`;
const userCompanyAdminId = `${testName}-COMP-ADMIN`;
const userCompanyAdminId2 = `${testName}-COMP-ADMIN-2`;
const milestoneId = `${constants.prefix.milestone}_MILESTONE-1`;
const milestoneId2 = `${constants.prefix.milestone}_MILESTONE-2`;
const milestoneId3 = `${constants.prefix.milestone}_MILESTONE-3`;
const milestoneId4 = `${constants.prefix.milestone}_MILESTONE-4`;
const milestoneId5 = `${constants.prefix.milestone}_MILESTONE-5`;
const milestoneId51 = `${constants.prefix.milestone}_MILESTONE-51`;
const jobId = `${constants.prefix.job}_${testName}_JOB`
const jobId2 = `${constants.prefix.job}_${testName}_JOB2`
const milestoneId6 = `${constants.prefix.milestone}_MILESTONE-6`;
const milestoneId7 = `${constants.prefix.milestone}_MILESTONE-7`;
const milestoneId8 = `${constants.prefix.milestone}_MILESTONE-8`;
const milestoneId9 = `${constants.prefix.milestone}_MILESTONE-9`;
const milestoneId10 = `${constants.prefix.milestone}_MILESTONE-10`;
const jobId3 = `${constants.prefix.job}-${testName}-JOB-ID-3`;
const jobId4 = `${constants.prefix.job}-${testName}-JOB-ID-4`;
const jobId5 = `${constants.prefix.job}-${testName}-JOB-ID-5`;
const milestoneJobId3ms1 = `${constants.prefix.milestone}${jobId3}_1`;
const milestoneJobId3ms2 = `${constants.prefix.milestone}${jobId3}_2`;
const milestoneJobId3ms3 = `${constants.prefix.milestone}${jobId3}_3`;
const milestoneJobId3ms4 = `${constants.prefix.milestone}${jobId3}_4`;
const milestoneJobId3ms5 = `${constants.prefix.milestone}${jobId3}_5`;
const milestoneJobId3ms6 = `${constants.prefix.milestone}${jobId3}_6`;
const milestoneJobId3ms7 = `${constants.prefix.milestone}${jobId3}_7`;
const milestoneJobId3ms11 = `${constants.prefix.milestone}${jobId3}_11`;
const milestoneJobId3ms8 = `${constants.prefix.milestone}${milestoneId8}`;
const milestoneJobId3ms9 = `${constants.prefix.milestone}${milestoneId9}`;
const milestoneJobId3ms10 = `${constants.prefix.milestone}${milestoneId10}`;
const milestoneJobId4ms1 = `${constants.prefix.milestone}${jobId4}_1`;
const milestoneJobId4ms2 = `${constants.prefix.milestone}${jobId4}_2`;
const milestoneJobId5ms1 = `${constants.prefix.milestone}${jobId5}_1`;

const companySettings = {
  itemId: `${constants.prefix.company}${companyId}`,
  itemData: {
    multiLevelApproval: {
      enabled: true,
      approversChain: {
        "1": {
          level: 1,
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
    },
    jobRequestApproval: {
      enabled: true,
      jobRequestLevels: [
        { id: 1, type: constants.multiLevelTypes.namedUser, threshold: 101, userIds: [userCompanyAdminId] },
        { id: 2, type: constants.multiLevelTypes.companyAdmin, threshold: 101 },
      ],
    }
  },
};

const entitySettings = {
  itemId: `${constants.prefix.entity}${entityId}`,
  itemData: {
    multiLevelApproval: {}
  },
  companyId,
  entityId: entityId3,
}

const entity2Settings = {
  itemId: `${constants.prefix.entity}${entityId2}`,
  itemData: {
    multiLevelApproval: {
      enabled: false,
    },
    jobRequestApproval: {
      enabled: false,
      jobRequestLevels: [{ id: 1, type: constants.multiLevelTypes.namedUser, threshold: 101, userIds: [userCompanyAdminId] }],
    }
  },
  companyId,
  entityId: entityId2,
}

const entity3Settings = {
  itemId: `${constants.prefix.entity}${entityId3}`,
  itemData: {
    multiLevelApproval: {
      enabled: true,
      approversChain: [
        { level: 1, type: constants.multiLevelTypes.anyone },
        { level: 2, threshold: 1000, type: constants.multiLevelTypes.departmentAdmin },
        { level: 3, threshold: 3000, type: constants.multiLevelTypes.namedUser, userIds: [userCompanyAdminId] },
      ],
    }
  },
  companyId,
  entityId: entityId3,
}

const userBudget = {
  itemId: constants.prefix.user + userId,
  entityId: entityId,
  companyId: companyId,
  itemData: {
    2019: {
      periods: 4,
      1: {
        total: 300,
        approved: 0,
        pending: 0,
        committed: 200,
        available: 100
      },
      2: {
        total: 200,
        approved: 0,
        pending: 0,
        committed: 100,
        available: 100
      },
      3: {
        total: 200,
        approved: 0,
        pending: 0,
        committed: 100,
        available: 100
      },
      4: { total: 200, approved: 0, pending: 0, committed: 100, available: 100 }
    }
  },
  modifiedBy: "GET-BUDGET-JEST-TEST-ADMIN-ID-1"
};

const userBudgetEntity3 = {
  itemId: constants.prefix.user + userId,
  entityId: entityId3,
  companyId: companyId,
  itemData: {
    2021: {
      periods: 4,
      1: {
        total: 0,
        approved: 0,
        pending: 0,
        committed: 0,
        available: 0
      },
      2: {
        total: 10000,
        approved: 0,
        pending: 0,
        committed: 6006,
        available: 10000
      },
      3: {
        total: 0,
        approved: 0,
        pending: 0,
        committed: 0,
        available: 0
      },
      4: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 }
    }
  },
  modifiedBy: "GET-BUDGET-JEST-TEST-ADMIN-ID-1"
};

const userAdminBudgetInCompany = {
  ...userBudgetEntity3,
  entityId: companyId,
}

const userBudget2 = {
  itemId: constants.prefix.user + userId,
  entityId: entityId2,
  companyId: companyId,
  itemData: {
    2019: {
      periods: 4,
      1: {
        total: 200,
        approved: 0,
        pending: 0,
        committed: 200,
        available: 0
      },
      2: {
        total: 100,
        approved: 0,
        pending: 0,
        committed: 100,
        available: 0
      },
      3: {
        total: 100,
        approved: 0,
        pending: 0,
        committed: 100,
        available: 0
      },
      4: { total: 200, approved: 0, pending: 0, committed: 100, available: 100 }
    }
  },
  modifiedBy: "GET-BUDGET-JEST-TEST-ADMIN-ID-1"
};

const eventBody1 = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    {
      itemId: milestoneId,
      entityId: entityId,
    }
  ]
};

const eventBody1EmailMode = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    {
      itemId: milestoneId,
      entityId: entityId,
      itemData: { actualCost: 100 }
    }
  ],
};

const eventBody2 = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    {
      itemId: milestoneId2,
      entityId,
    }
  ]
};

const eventBody3 = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    {
      itemId: milestoneId3,
      itemData: { actualCost: 300 },
      entityId,
    }
  ]
};

const eventBody51 = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    {
      itemId: milestoneId51,
      entityId,
    }
  ]
};

const eventRejectBody3 = {
  ...eventBody3,
  itemStatus: constants.job.status.budgetDeclined,
};

const eventRejecToTalentBody3 = {
  ...eventBody3,
  itemStatus: constants.job.status.active,
};

const wrongEventBody = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    {
      entityId: `${entityId}_WRONG`,
      itemId: milestoneId
    } 
  ]
};

const eventBodyAsArray = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    { entityId, itemId: milestoneId },
    { entityId, itemId: milestoneId2 }
  ]

};
const eventBodyDifferentStatusAsArray = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    { entityId: entityId2, itemId: milestoneId7 },
    { entityId: entityId2, itemId: milestoneId6 }
  ]
};

const eventBody3AsArray = {
  entityId: entityId,
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [{ entityId, itemId: milestoneId3, itemData: { actualCost: 300 } }]
};


const eventRejectBody3AsArray = {
  ...eventBody3AsArray,
  itemStatus: constants.job.status.budgetDeclined,
};

const eventBody51AsArray = {
  entityId: entityId,
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [{ entityId, itemId: milestoneId51, itemData: { actualCost: 300 } }]
};


const eventBody4AsArray = {
  entityId: entityId,
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    { entityId: entityId2, itemId: milestoneId6 },
    { entityId, itemId: milestoneId4 }
  ]
};

const eventBody5AsArray = {
  entityId: entityId,
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [{ entityId, itemId: milestoneId5 }]
};

const eventRejecToTalentBody3AsArray = {
  ...eventBody3,
  itemStatus: constants.job.status.active,
};

const eventBodyMultiLevelApproval1 = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    { entityId: entityId3, itemId: milestoneJobId3ms1 },
    { entityId: entityId3, itemId: milestoneJobId3ms3 },
  ]
}

const eventBodyZeroCost = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    { entityId: entityId3, itemId: milestoneJobId3ms8 },
    { entityId: entityId3, itemId: milestoneJobId3ms9 },
    { entityId: entityId3, itemId: milestoneJobId3ms5 },
  ]
}

const eventBodyCompletedMilestone = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [{ entityId: entityId3, itemId: milestoneJobId3ms10 }]
}
const eventBodyCreateMilestone = {
  companyId: companyId,
  itemStatus: constants.job.status.active,
  milestones: [
    { entityId: entityId3, itemId: milestoneJobId4ms1 },
    { entityId: entityId3, itemId: milestoneJobId4ms2 },
  ]
}

const eventBodyNoJobRequestInDepartment = {
  companyId: companyId,
  itemStatus: constants.job.status.active,
  milestones: [{ entityId: entityId2, itemId: milestoneJobId5ms1 }]
}

const eventBodyApproveJobRequest = {
  companyId: companyId,
  itemStatus: constants.job.status.active,
  milestones: [{ entityId: entityId3, itemId: milestoneJobId4ms1 }]
}

const eventBodyMultiLevelReject1 = {
  companyId: companyId,
  itemStatus: constants.job.status.active,
  milestones: [
    { entityId: entityId3, itemId: milestoneJobId3ms4, itemData: { nextLevelRejectedBy: {}, nextLevelRejectMessage: "msg" } },
    { entityId: entityId3, itemId: milestoneJobId3ms11, itemData: { nextLevelRejectedBy: {}, nextLevelRejectMessage: "msg" } },
  ]
}

const eventBodyMultiLevelReject2 = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [{ entityId: entityId3, itemId: milestoneJobId3ms4 }]
}

const eventBodyMultiLevelApproval2 = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [{ entityId: entityId3, itemId: milestoneJobId3ms1 }]
}
const eventBodyMultiLevelApproval3 = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    { entityId: entityId3, itemId: milestoneJobId3ms1 },
    { entityId: entityId3, itemId: milestoneJobId3ms2 },
    { entityId: entityId3, itemId: milestoneJobId3ms3 },
  ]
}

const eventBodyMultiLevelApproval4 = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [
    { entityId: entityId3, itemId: milestoneJobId3ms2, approvedLevels: [{ level: 1 }, { level: 3 }] },
    { entityId: entityId3, itemId: milestoneJobId3ms3 },
  ]
}

const eventBodyOverageMultiLevel = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [{ entityId: entityId3, itemId: milestoneJobId3ms5 }]
}

const eventBodyNotInTurnApproval = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [{ entityId: entityId3, itemId: milestoneJobId3ms6, approvedLevels: [{ level: 1 }] }]
}

const eventBodyNotInTurnApproval2 = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [{ entityId: entityId3, itemId: milestoneJobId3ms6 }]
}

const eventBodyOnlyNamedApprover = {
  companyId: companyId,
  itemStatus: constants.job.status.completed,
  milestones: [{ entityId: entityId3, itemId: milestoneJobId3ms7 }]
}

const createMsUpdateRequest = (body, cognitoUserId, pathParamId) => {
  const pathParameters = pathParamId ? { id: pathParamId } : {};
  return {
    body: JSON.stringify(body),
    requestContext: {
      identity: {
        cognitoIdentityId: cognitoUserId
      }
    },
    pathParameters: pathParameters
  }
}

const userAdminInEntity3 = {
  userId: userId,
  entityId: entityId3,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: { userRole: constants.user.role.admin,
    isEditor: true }
};

const userHiringManagerInEntity3 = {
  userId: userHirinManagerId,
  entityId: entityId3,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: { userRole: constants.user.role.user,
    isEditor: true }
}

const userCompanyAdminInCompany = {
  userId: userCompanyAdminId,
  entityId: companyId,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: { userRole: constants.user.role.admin,
    isEditor: true }
}

const userCompanyAdmin2InCompany = {
  userId: userCompanyAdminId2,
  entityId: companyId,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: { userRole: constants.user.role.admin,
    isEditor: true }
}

const userCompanyAdminInEntity3 = {
  userId: userCompanyAdminId,
  entityId: entityId3,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: { userRole: constants.user.role.admin,
    isEditor: true }
}

const userCompanyAdmin2InEntity3 = {
  userId: userCompanyAdminId2,
  entityId: entityId3,
  companyId: companyId,
  itemStatus: constants.user.status.active,
  itemData: { userRole: constants.user.role.admin,
    isEditor: true }
}

const updateStatusMsData = createMsUpdateRequest(eventBody1, userId);
const updateStatusMsDataAsArray = createMsUpdateRequest(eventBodyAsArray, userId2, 'ignore');
const updateStatusMsDifferentStatusDataAsArray = createMsUpdateRequest(eventBodyDifferentStatusAsArray, userId, 'ignore');
const updateStatusMsData2 = createMsUpdateRequest(eventBody2, userId);
const updateStatusMsData3 = createMsUpdateRequest(eventBody3, userId);
const updateStatusMsData3AsArray = createMsUpdateRequest(eventBody3AsArray, userId, 'milestoneId3');
const updateStatusMsData4AsArray = createMsUpdateRequest(eventBody4AsArray, userId);
const updateStatusMsData5AsArray = createMsUpdateRequest(eventBody5AsArray, userId);
const overageRejectMsData3 = createMsUpdateRequest(eventRejectBody3, userId, milestoneId3);
const overageRejectMsData3AsArray = createMsUpdateRequest(eventRejectBody3AsArray, userId, milestoneId3);
const rejectCompleteArchivedMilestoneRequest = createMsUpdateRequest(eventBody51, userId, milestoneId51);
const rejectCompleteArchivedMilestonesAsArrayRequest = createMsUpdateRequest(eventBody51AsArray, userId, milestoneId51);

const rejectToTalentMsData3 = {
  ...updateStatusMsData3,
  body: JSON.stringify(eventRejecToTalentBody3),
};

const rejectToTalentMsData3AsArray = {
  ...updateStatusMsData3,
  body: JSON.stringify(eventRejecToTalentBody3AsArray),
};

const wrongSignedJobData = {
  body: JSON.stringify(wrongEventBody),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  }
};

const eventBodyActive = {
  companyId: companyId,
  itemStatus: constants.job.status.active,
  milestones: [
    {
      itemId: milestoneId,
      entityId,
    }
  ]
};

const eventBodyActiveMs5 = {
  companyId: companyId,
  itemStatus: constants.job.status.active,
  milestones: [
    {
      itemId: milestoneId5,
      entityId,
    }
  ]
};

const eventBodyActiveMs2 = {
  companyId: companyId,
  itemStatus: constants.job.status.active,
  milestones: [
    {
      itemId: milestoneId2,
      entityId: entityId,
    }
  ]
};

const eventBody3Active = {
  entityId: entityId,
  companyId: companyId,
  itemStatus: constants.job.status.active,
  itemData: { message: 'rejecting message', isRejected: true }
};

const eventBody3Activems4 = {
  companyId: companyId,
  itemStatus: constants.job.status.active,
  milestones: [
    {
      itemData: { message: 'rejecting message', isRejected: true },
      itemId: milestoneId4,
      entityId,
    }
  ]
};

const eventBodyPendingApproval = {
  companyId: companyId,
  itemStatus: constants.job.status.pendingApproval,
  milestones: [
    {
      itemId: milestoneId5,
      entityId,
    }
  ]
};

const eventBodyPendingApprovalEmptyMSList = {
  companyId: companyId,
  itemStatus: constants.job.status.pendingApproval,
  milestones: []
};

const updateStatusMsDataActive = createMsUpdateRequest(eventBodyActive, userId);
const updateStatusMsDataActiveViewer = createMsUpdateRequest(eventBodyActive, userId2);
const updateStatusMs5RequestedToActive = createMsUpdateRequest(eventBodyActiveMs5, userId);
const updateStatusMs5ActiveToPendingApproval = createMsUpdateRequest(eventBodyPendingApproval, userId);
const updateStatusMsData2Active = createMsUpdateRequest(eventBodyActiveMs2, userId);
const updateStatusMsData3Active = createMsUpdateRequest(eventBody3Activems4, userId);


describe("updateMilestoneStatus", () => {
  beforeEach(async () => {
    await jobsService.create({
      itemId: milestoneId,
      entityId,
      itemStatus: constants.job.status.pendingApproval,
      itemData: { date: 1546500308000, cost: 100, actualCost: 200 },
      companyId,
      userId
    });
    await jobsService.create({
      itemId: milestoneId2,
      entityId,
      itemStatus: constants.job.status.pending,
      itemData: { date: 1446500308000, cost: 100, actualCost: 200 },
      companyId,
      userId
    });
    await jobsService.create({
      itemId: milestoneId3,
      entityId,
      itemStatus: constants.job.status.pending,
      itemData: { date: 1546500308000, cost: 100, actualCost: 200 },
      companyId,
      userId
    });

    await jobsService.create({
      itemId: milestoneId51,
      entityId,
      itemStatus: constants.job.status.archived,
      itemData: { date: 1546500308000, cost: 100, actualCost: 200 },
      companyId,
      userId
    });

    await jobsService.create({
      itemId: milestoneId4,
      entityId,
      itemStatus: constants.job.status.pendingApproval,
      itemData: { date: 1546500308000, cost: 100, actualCost: 200 },
      companyId,
      userId
    });

    await jobsService.create({
      itemId: milestoneId5,
      entityId,
      createdBy: `${constants.prefix.extProviderUserId}EXTERNALUSERID`,
      itemStatus: constants.job.status.requested,
      itemData: { date: 1546500308000, cost: 100, invoice: 123, title: 'MS requested by external user', files: [], jobId },
      companyId,
      userId
    });

    await jobsService.create({
      itemId: jobId,
      entityId,
      itemStatus: constants.job.status.active,
      itemData: { totalBudget: 100 },
      companyId,
      userId
    });
    
    await jobsService.create({
      itemId: milestoneId7,
      entityId: entityId2,
      itemStatus: constants.job.status.secondApproval,
      itemData: { date: 1546500308000, cost: 100, actualCost: 100 },
      companyId,
      userId
    });
    
    await jobsService.create({
      itemId: milestoneJobId3ms8,
      entityId: entityId3,
      itemStatus: constants.job.status.pendingApproval,
      itemData: { date: 1622556027196, cost: 0, actualCost: 0 },
      companyId,
      userId: userHirinManagerId
    });
    
    await jobsService.create({
      itemId: milestoneJobId3ms9,
      entityId: entityId3,
      itemStatus: constants.job.status.pendingApproval,
      itemData: { date: 1622556027196, cost: 100, actualCost: 50, actualRequestCost: 50 },
      companyId,
      userId: userHirinManagerId
    });
    
    await jobsService.create({
      itemId: milestoneJobId3ms10,
      entityId: entityId3,
      itemStatus: constants.job.status.completed,
      itemData: { date: 1622556027196, cost: 100, actualCost: 50, actualRequestCost: 50 },
      companyId,
      userId: userHirinManagerId
    });

    await jobsService.create({
      itemId: milestoneJobId4ms1,
      entityId: entityId3,
      itemStatus: constants.job.status.pending,
      itemData: { date: 1622556027196, cost: 150 },
      companyId,
      userId: userHirinManagerId
    });

    await jobsService.create({
      itemId: milestoneJobId4ms2,
      entityId: entityId3,
      itemStatus: constants.job.status.pending,
      itemData: { date: 1622556027196, cost: 0 },
      companyId,
      userId: userHirinManagerId
    });

    await jobsService.create({
      itemId: milestoneJobId5ms1,
      entityId: entityId2,
      itemStatus: constants.job.status.pending,
      itemData: { date: 1622556027196, cost: 150 },
      companyId,
      userId: userHirinManagerId
    });
    
    await jobsService.create({
      itemId: milestoneId6,
      entityId: entityId2,
      createdBy: `${constants.prefix.extProviderUserId}EXTERNALUSERID`,
      itemStatus: constants.job.status.pendingApproval,
      itemData: { date: 1546500308000, cost: 100, actualCost: 100 },
      companyId,
      userId
    });

    await jobsService.create({
      itemId: jobId2,
      entityId: entityId2,
      itemStatus: constants.job.status.active,
      itemData: { totalBudget: 100 },
      companyId,
      userId
    });

    await jobsService.create({
      itemId: jobId3,
      entityId: entityId3,
      itemStatus: constants.job.status.active,
      itemData: { totalBudget: 10000 },
      companyId,
      userId: userHirinManagerId
    });

    await jobsService.create({
      itemId: milestoneJobId3ms1,
      entityId: entityId3,
      itemStatus: constants.job.status.pendingApproval,
      itemData: { date: 1622556027196, cost: 1001, actualCost: 1001 },
      companyId,
      userId: userHirinManagerId
    });

    await jobsService.create({
      itemId: milestoneJobId3ms4,
      entityId: entityId3,
      itemStatus: constants.job.status.secondApproval,
      itemData: { 
        date: 1622556027196,
        cost: 1001,
        actualCost: 1001,
        approversChain: {
          1: { level: 1, type: constants.multiLevelTypes.anyone, approvedBy: userHirinManagerId },
          2: { level: 2, threshold: 1000, type: constants.multiLevelTypes.departmentAdmin },
        },
        approvals: [{ approveDate: 1623338939935, approvedBy: userHirinManagerId, action: 'approve', level: 1 }]
      },
      companyId,
      userId: userHirinManagerId
    });

    await jobsService.create({
      itemId: milestoneJobId3ms11,
      entityId: entityId3,
      itemStatus: constants.job.status.secondApproval,
      itemData: { 
        date: 1622556027196,
        cost: 1001,
        actualCost: 1001,
        approversChain: {
          1: { level: 1, type: constants.multiLevelTypes.anyone },
          2: { level: 2, threshold: 1000, type: constants.multiLevelTypes.departmentAdmin, approvedBy: 'admin' },
        },
        approvals: [{ approveDate: 1623338939935, approvedBy: 'admin', action: 'approve', level: 2 }]
      },
      companyId,
      userId: userHirinManagerId
    });

    await jobsService.create({
      itemId: milestoneJobId3ms2,
      entityId: entityId3,
      itemStatus: constants.job.status.pendingApproval,
      itemData: { date: 1622556027196, cost: 1001, actualCost: 1001 },
      companyId,
      userId: userHirinManagerId
    });

    await jobsService.create({
      itemId: milestoneJobId3ms3,
      entityId: entityId3,
      itemStatus: constants.job.status.pendingApproval,
      itemData: { date: 1622556027196, cost: 3001, actualCost: 3001 },
      companyId,
      userId: userHirinManagerId
    });

    await jobsService.create({
      itemId: milestoneJobId3ms5,
      entityId: entityId3,
      itemStatus: constants.job.status.pendingApproval,
      itemData: { date: 1622556027196, cost: 3001, actualCost: 11111 },
      companyId,
      userId: userHirinManagerId
    });

    await jobsService.create({
      itemId: milestoneJobId3ms6,
      entityId: entityId3,
      itemStatus: constants.job.status.pendingApproval,
      itemData: { date: 1622556027196, cost: 3001, actualCost: 1001 },
      companyId,
      userId: userHirinManagerId
    });

    await jobsService.create({
      itemId: milestoneJobId3ms7,
      entityId: entityId3,
      itemStatus: constants.job.status.pendingApproval,
      itemData: { date: 1622556027196, cost: 3001, actualCost: 3001 },
      companyId,
      userId: userCompanyAdminId,
    });


    const user = {
      userId: userId,
      entityId: entityId,
      companyId: companyId,
      itemStatus: constants.user.status.active,
      itemData: { userRole: constants.user.role.admin,
        isEditor: true }
    };

    let result = await usersService.create(user);
    expect(result).toEqual(user);

    const userEntity2 = {
      userId: userId,
      entityId: entityId2,
      companyId: companyId,
      itemStatus: constants.user.status.active,
      itemData: { userRole: constants.user.role.admin,
        isEditor: true }
    };

    result = await usersService.create(userEntity2);
    expect(result).toEqual(userEntity2);
    const user2 = {
      userId: userId2,
      entityId: entityId,
      companyId: companyId,
      itemStatus: constants.user.status.active,
      itemData: { userRole: constants.user.role.admin,
        isEditor: true }
    };

    result = await usersService.create(user2);
    expect(result).toEqual(user2);
    
    const user2Entity2 = {
      userId: userId2,
      entityId: entityId2,
      companyId: companyId,
      itemStatus: constants.user.status.active,
      itemData: { 
        userRole: constants.user.role.admin,
        isEditor: true
      }
    };
    result = await usersService.create(user2Entity2);
    expect(result).toEqual(user2Entity2);
    
    result = await usersService.create(userAdminInEntity3);
    expect(result).toEqual(userAdminInEntity3);
    result = await usersService.create(userHiringManagerInEntity3);
    expect(result).toEqual(userHiringManagerInEntity3);
    result = await usersService.create(userCompanyAdminInCompany);
    expect(result).toEqual(userCompanyAdminInCompany);
    result = await usersService.create(userCompanyAdmin2InCompany);
    expect(result).toEqual(userCompanyAdmin2InCompany);
    result = await usersService.create(userCompanyAdminInEntity3);
    expect(result).toEqual(userCompanyAdminInEntity3);
    result = await usersService.create(userCompanyAdmin2InEntity3);
    expect(result).toEqual(userCompanyAdmin2InEntity3);
    result = await budgetsService.create(userBudget);
    expect(result).toEqual(userBudget);
    result = await budgetsService.create(userBudget2);
    expect(result).toEqual(userBudget2);
    result = await budgetsService.create(userBudgetEntity3);
    expect(result).toEqual(userBudgetEntity3);
    result = await budgetsService.create(userAdminBudgetInCompany);
    expect(result).toEqual(userAdminBudgetInCompany);

    result = await settingsService.create(companySettings);
    expect(result.itemData).toEqual(companySettings.itemData);
    result = await settingsService.create(entitySettings);
    expect(result.itemData).toEqual(entitySettings.itemData);
    result = await settingsService.create(entity2Settings);
    expect(result.itemData).toEqual(entity2Settings.itemData);
    result = await settingsService.create(entity3Settings);
    expect(result.itemData).toEqual(entity3Settings.itemData);

  });

  describe('email mode',() => {
    let updateStatusMsDataEmailMode
    
    beforeAll(async () => {
      const milestonesToSave = eventBody1EmailMode.milestones
      const emailCode = await jobsService.persisMilestonesForMail(companyId, milestonesToSave)
      updateStatusMsDataEmailMode = createMsUpdateRequest(Object.assign(eventBody1EmailMode, { emailCode } ), userId);
    })

    it("should return proper object", async () => {
      const response = await handler.run(updateStatusMsDataEmailMode);
      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toEqual({ verificationData: { hasChanged: false, finalApproval: true, msCount: 1, msSum: 100, msToApprove: [
        { 
          entityId, 
          itemId: milestoneId,
          amount: 200,
          diff: 0,
          currency: 'USD'
        }
      ]}})
    })  
  })

  it("updateMilestoneStatus post, expect 200", async () => {
    let response = await handler.run(updateStatusMsData);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId);
    // eslint-disable-next-line no-undefined
    expect(response.itemData.approvals).not.toBe(undefined);
    expect(response.itemData.approvals.length).toBe(1);
    expect(response.itemData.approvals[0].approvedBy).toBe(userId);
    // eslint-disable-next-line no-undefined
    expect(response.itemData.approvals[0].approveDate).not.toBe(undefined);
    expect(response.itemStatus).toBe(constants.job.status.completed);
    response = await handler.run(updateStatusMsData2);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId2);
    expect(response.itemStatus).toBe(constants.job.status.overageBudgetRequest);
    response = await handler.run(updateStatusMsData3);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId3);
    expect(response.itemStatus).toBe(constants.job.status.overageBudgetRequest);
    response = await handler.run(overageRejectMsData3);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId3);
    expect(response.itemData.budgetRequestRejectedBy).toBe(userId);
    expect(response.itemData.approvals[response.itemData.approvals.length - 1].action).toBe('reject');
    expect(response.itemData.approvals[response.itemData.approvals.length - 1].approvedBy).toBe(userId);
    expect(response.itemStatus).toBe(constants.job.status.pendingApproval);
    response = await handler.run(rejectToTalentMsData3);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId3);
    // eslint-disable-next-line no-undefined
    expect(response.itemData.budgetRequestRejectedBy).toBe(undefined);
    expect(response.itemStatus).toBe(constants.job.status.active);
    response = await handler.run(rejectCompleteArchivedMilestoneRequest);
    expect(response.statusCode).toBe(403);
    response = await handler.run(rejectCompleteArchivedMilestonesAsArrayRequest);
    expect(response.statusCode).toBe(403);
  });
  
  it("updateMilestoneStatus as array different statuses post, expect 200", async () => {
    let response = await handler.run(updateStatusMsDifferentStatusDataAsArray);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId2, milestoneId6);
    expect(response.itemStatus).toBe(constants.job.status.completed);
    response = await jobsService.get(entityId2, milestoneId7);
    expect(response.itemStatus).toBe(constants.job.status.completed);
  });
  
  it("updateMilestoneStatus as array post, expect 200", async () => {
    let response = await handler.run(updateStatusMsDataAsArray);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId);
    expect(response.itemStatus).toBe(constants.job.status.completed);
    response = await jobsService.get(entityId, milestoneId2);
    expect(response.itemStatus).toBe(constants.job.status.overageBudgetRequest);
    response = await handler.run(updateStatusMsData3AsArray);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId3);
    expect(response.itemStatus).toBe(constants.job.status.overageBudgetRequest);
    response = await handler.run(overageRejectMsData3AsArray);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId3);
    expect(response.itemData.budgetRequestRejectedBy).toBe(userId);
    expect(response.itemStatus).toBe(constants.job.status.pendingApproval);
    response = await handler.run(updateStatusMsData5AsArray);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId5);
    expect(response.itemStatus).toBe(constants.job.status.completed);
    // // eslint-disable-next-line no-undefined
    response = await handler.run(rejectToTalentMsData3AsArray);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId3);
    // // eslint-disable-next-line no-undefined
    // eslint-disable-next-line no-undefined
    expect(response.itemData.budgetRequestRejectedBy).toBe(undefined);
    expect(response.itemStatus).toBe(constants.job.status.active);
  });
  
  it("updateMilestoneStatus as array post 2 dentityIds, expect 200", async () => {
    let response = await handler.run(updateStatusMsData4AsArray);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId4);
    expect(response.itemStatus).toBe(constants.job.status.completed);
    response = await jobsService.get(entityId2, milestoneId6);
    expect(response.itemStatus).toBe(constants.job.status.completed);
  });

  it("updateMilestoneStatus to active, expect 200", async () => {
    let response = await handler.run(updateStatusMsDataActive);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId);
    expect(response.itemStatus).toBe(constants.job.status.active);
    response = await handler.run(updateStatusMsData2Active);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId2);
    expect(response.itemStatus).toBe(constants.job.status.budgetRequest);
    response = await handler.run(updateStatusMsData3Active);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId4);
    expect(response.itemStatus).toBe(constants.job.status.active);
    expect(response.itemData.message).toBe(eventBody3Active.itemData.message);
    expect(response.itemData.isRejected).toBe(eventBody3Active.itemData.isRejected);
    expect(response.itemData.actualCost).toBe(200);
    await usersService.update({ userId: userId2, entityId, modifiedBy: userId, itemData: {
      userRole: constants.user.role.admin,
      isEditor: false
    } }) 
    response = await handler.run(updateStatusMsDataActiveViewer);
    expect(response.statusCode).toBe(403);
  });

  it("updateMilestoneStatus post, expect unauthorised", async () => {
    const response = await handler.run(wrongSignedJobData);
    expect(response.statusCode).toBe(403);
  });

  it("updateMilestoneStatus put, activate 'Requsested' MS, expect 200", async () => {
    let response = await handler.run(updateStatusMs5RequestedToActive);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId5);
    expect(response.itemStatus).toBe(constants.job.status.active);
    response = await handler.run(updateStatusMs5ActiveToPendingApproval);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, milestoneId5);
    expect(response.itemStatus).toBe(constants.job.status.pendingApproval);
  });

  it("approveMilestone multi level flows", async () => {
    let response = await handler.run(createMsUpdateRequest(eventBodyMultiLevelApproval1, userHirinManagerId));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.secondApproval);
    expect(response[0].Attributes.itemData.approvals.length).toBe(1);
    expect(response[0].Attributes.itemData.approvals[0].level).toBe(1);
    expect(response[0].Attributes.itemData.approvals[0].approvedBy).toBe(userHirinManagerId);
    expect(response[1].Attributes.itemStatus).toBe(constants.job.status.secondApproval);
    expect(response[1].Attributes.itemData.approvals.length).toBe(1);
    expect(response[1].Attributes.itemData.approvals[0].level).toBe(1);
    
    response = await handler.run(createMsUpdateRequest(eventBodyMultiLevelApproval2, userHirinManagerId));
    expect(response.statusCode).toBe(403);
    response = await handler.run(createMsUpdateRequest(eventBodyMultiLevelApproval3, userId));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body)
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.completed);
    expect(response[0].Attributes.itemData.approvals.length).toBe(2);
    expect(response[0].Attributes.itemData.approvals[0].approvedBy).toBe(userHirinManagerId);
    expect(response[0].Attributes.itemData.approvals[1].approvedBy).toBe(userId);
    expect(response[0].Attributes.itemData.approvals[1].level).toBe(2);
    expect(response[1].Attributes.itemStatus).toBe(constants.job.status.secondApproval);
    expect(response[1].Attributes.itemData.approvals.length).toBe(2)
    expect(response[2].Attributes.itemStatus).toBe(constants.job.status.secondApproval);
    expect(response[2].Attributes.itemData.approvals.length).toBe(1)


    response = await handler.run(createMsUpdateRequest(eventBodyMultiLevelApproval4, userCompanyAdminId));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.completed);
    expect(response[0].Attributes.itemData.approvals.length).toBe(2)
    expect(response[1].Attributes.itemStatus).toBe(constants.job.status.completed);
    expect(response[1].Attributes.itemData.approvals.length).toBe(3)
    
  });

  it("rejectMilestone multi level flow", async () => {
    let response = await handler.run(createMsUpdateRequest(eventBodyMultiLevelReject1, userId));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.pendingApproval);
    expect(response[0].Attributes.itemData.approversChain[1].rejectedBy).toBe(userId);
    expect(response[0].Attributes.itemData.approvals.length).toBe(2)
    expect(response[0].Attributes.itemData.approvals[1].action).toBe('reject')
    expect(response[0].Attributes.itemData.approvals[1].level).toBe(2)
    expect(response[0].Attributes.itemData.approvals[1].approvedBy).toBe(userId);
    expect(response[1].Attributes.itemStatus).toBe(constants.job.status.active);
    expect(response[1].Attributes.itemData.approversChain[0].rejectedBy).toBe(userId);

    response = await handler.run(createMsUpdateRequest(eventBodyMultiLevelReject2, userHirinManagerId));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemData.approvals.length).toBe(3);
    expect(response[0].Attributes.itemData.approvals[2].action).toBe('approve');
    expect(response[0].Attributes.itemData.approvals[2].level).toBe(1);
    expect(response[0].Attributes.itemData.approvals[2].approvedBy).toBe(userHirinManagerId);
    expect(response[0].Attributes.itemData.approversChain[0].approvedBy).toBe(userHirinManagerId);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.secondApproval);
    expect(response[0].Attributes.itemData.approversChain[1].rejectedBy).toBeUndefined();
  });

  it("overageBudgetRequest with multi level flow", async () => {
    let response = await handler.run(createMsUpdateRequest(eventBodyOverageMultiLevel, userId));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.overageBudgetRequest);
    expect(response[0].Attributes.itemData.approvals.length).toBe(1);
  });
  
  it("update status with zero cost", async () => {
    let response = await handler.run(createMsUpdateRequest(eventBodyZeroCost, userId));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.overageBudgetRequest);
    expect(response[1].Attributes.itemStatus).toBe(constants.job.status.completed);
    expect(response[2].Attributes.itemStatus).toBe(constants.job.status.completed);
  });
  
  it("update status for completed milestone - 403", async () => {
    const response = await handler.run(createMsUpdateRequest(eventBodyCompletedMilestone, userId));
    expect(response.statusCode).toBe(403);
  });

  it("Approve on behalf of HM when direct levels exist", async () => {
    let response = await handler.run(createMsUpdateRequest(eventBodyNotInTurnApproval, userCompanyAdminId));
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.secondApproval);
    expect(response[0].Attributes.itemData.approversChain[0].approvedBy).toBe(userCompanyAdminId);

    response = await handler.run(createMsUpdateRequest(eventBodyNotInTurnApproval2, userCompanyAdminId));
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.completed);
    expect(response[0].Attributes.itemData.approversChain[1].approvedBy).toBe(userCompanyAdminId);
  });

  it("Named user and HM", async () => {
    let response = await handler.run(createMsUpdateRequest(eventBodyOnlyNamedApprover, userCompanyAdminId));
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.secondApproval);
    expect(response[0].Attributes.itemData.approversChain[0].approvedBy).toBe(userCompanyAdminId);
    expect(response[0].Attributes.itemData.approversChain[2].approvedBy).toBe(userCompanyAdminId);

    response = await handler.run(createMsUpdateRequest(eventBodyOnlyNamedApprover, userCompanyAdminId));
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.completed);
  });

  it("Milestone moved to jobRequest ", async () => {
    let response = await handler.run(createMsUpdateRequest(eventBodyCreateMilestone, userHirinManagerId));
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.active);
    expect(response[1].Attributes.itemStatus).toBe(constants.job.status.jobRequest);
    response = await handler.run(createMsUpdateRequest(eventBodyApproveJobRequest, userId));
    expect(response.statusCode).toBe(403);
    
    response = await handler.run(createMsUpdateRequest(eventBodyApproveJobRequest, userCompanyAdminId));
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.jobRequest);
    expect(response[0].Attributes.itemData.jobRequestLevels[0].approvedBy).toBe(userCompanyAdminId);

    response = await handler.run(createMsUpdateRequest(eventBodyApproveJobRequest, userCompanyAdminId2));
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.budgetRequest);
    expect(response[0].Attributes.itemData.jobRequestLevels[0].approvedBy).toBe(userCompanyAdminId);
    expect(response[0].Attributes.itemData.isProcessing).toBeTruthy();

    response = await handler.run(createMsUpdateRequest(eventBodyNoJobRequestInDepartment, userCompanyAdminId));
    response = JSON.parse(response.body);
  });

  it("Job request disabled in department", async () => {
    let response = await handler.run(createMsUpdateRequest(eventBodyNoJobRequestInDepartment, userId));
    response = JSON.parse(response.body);
    expect(response[0].Attributes.itemStatus).toBe(constants.job.status.budgetRequest);
    expect(response[0].Attributes.itemData.isProcessing).toBeTruthy();
    expect(response[0].Attributes.itemData.jobRequestLevels).toBeFalsy();
  });
  
  afterEach(async () => {
    // cleanup
    let result = await jobsService.delete(entityId, milestoneId);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, milestoneId2);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, milestoneId3);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, milestoneId4);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, milestoneId5);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, milestoneId51);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId2, milestoneId6);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId2, milestoneId7);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId2, milestoneJobId3ms8);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId2, milestoneJobId3ms9);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId3ms1);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId3ms2);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId3ms3);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId3ms4);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId3ms5);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId3ms6);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId3ms7);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId3ms8);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId3ms9);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId3ms10);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId3ms11);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId4ms1);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, milestoneJobId4ms2);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId2, milestoneJobId5ms1);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, jobId);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId2, jobId2);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, jobId3);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId3, jobId4);
    expect(result).toBe(true);
    result = await usersService.delete(userId, entityId);
    expect(result).toBeTruthy();
    result = await usersService.delete(userId, entityId2);
    expect(result).toBeTruthy();
    result = await usersService.delete(userId, entityId3);
    expect(result).toBeTruthy();
    result = await usersService.delete(userId2, entityId);
    expect(result).toBeTruthy();
    result = await usersService.delete(userId2, entityId2);
    expect(result).toBeTruthy();
    result = await usersService.delete(userHirinManagerId, entityId3);
    expect(result).toBeTruthy();
    result = await usersService.delete(userCompanyAdminId, companyId);
    expect(result).toBeTruthy();
    result = await usersService.delete(userCompanyAdminId, entityId3);
    expect(result).toBeTruthy();
    result = await usersService.delete(userCompanyAdminId2, companyId);
    expect(result).toBeTruthy();
    result = await usersService.delete(userCompanyAdminId2, entityId3);
    expect(result).toBeTruthy();
    result = await budgetsService.delete(entityId, userBudget.itemId);
    expect(result).toBeTruthy();
    result = await budgetsService.delete(entityId2, userBudget2.itemId);
    expect(result).toBeTruthy();
    result = await budgetsService.delete(entityId3, userBudgetEntity3.itemId);
    expect(result).toBeTruthy();
    result = await budgetsService.delete(companyId, userAdminBudgetInCompany.itemId);
    expect(result).toBeTruthy();
    result = await settingsService.delete(companySettings.itemId);
    result = await settingsService.delete(entitySettings.itemId);
    result = await settingsService.delete(entity2Settings.itemId);
    result = await settingsService.delete(entity3Settings.itemId);
  });
});
