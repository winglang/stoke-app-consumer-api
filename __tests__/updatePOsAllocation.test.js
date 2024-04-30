/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */

'use strict';

const mod = require('../src/purchaseOrders/updatePOsAllocation');
const jestPlugin = require('serverless-jest-plugin');
const { UsersService, POService, constants, JobsService } = require('stoke-app-common-api');
const poService = new POService(process.env.budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAndTagsAttributes);

const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const testName = 'UPDATE-PO-ALLOCATION';
const companyId = `${testName}-COMP-1`;
const entityId1 = `${testName}-ENTITY-1`;
const entityId2 = `${testName}-ENTITY-2`;
const userId1 = `${testName}-ADMIN`;
const poToAssignId = `po_${testName}-poToAssign`;
const poToRevertId = `po_${testName}-poToRevert`;
const milestoneId1 = `ms_job${testName}-MILESTONE-1`;
const milestoneId2 = `ms_job${testName}-MILESTONE-2`;

const companyAdmin = {
  userId: userId1,
  entityId: companyId,
  companyId: companyId,
  createdBy: userId1,
  modifiedBy: userId1,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const poToAssign = {
  itemId: poToAssignId,
  companyId: companyId,
  createdBy: companyAdmin.userId,
  poScope: {
      scopeIds: [entityId1],
      scopeType: constants.poScopeTypes.departments,
      poTypes: [constants.poTypes.talentService],
    },
  amount: 1000,
  validFrom: new Date().getTime(),
  validTo: new Date(new Date().getFullYear(), new Date().getMonth()+1, 1).getTime(),
  poNumber: 'poToAssign',
}

const poToRevert = {
  itemId: poToRevertId,
  companyId: companyId,
  createdBy: companyAdmin.userId,
  poScope: {
      scopeIds: [entityId1],
      scopeType: constants.poScopeTypes.departments,
      poTypes: [constants.poTypes.talentService],
    },
  amount: 1000,
  validFrom: new Date().getTime(),
  validTo: new Date(new Date().getFullYear(), new Date().getMonth()+1, 1).getTime(),
  poNumber: 'poToRevert',
}

const event = (user, data) => ({
  body: 
      JSON.stringify(data),
  requestContext: {
    identity: {
      cognitoIdentityId: user
    }
  },
  pathParameters: {
    companyId,
  }
});

const milestone2 = {
  companyId,
  entityId: entityId2,
  itemId: milestoneId2,
  userId: userId1,
  poItemId: poToRevertId,
}

const milestone1 = {
  companyId,
  entityId: entityId1,
  itemId: milestoneId1,
  userId: userId1,
  modifiedBy: userId1,
  itemStatus: constants.job.status.completed,
  poItemId: poToRevertId,
  itemData: {
    requestedData: {
      hourlyValue: 52,
    },
    date: "2022-08-31",
    cost: 200,
    costLocal: 200,
    providerData: {
      taxInfo: {
        total: 223.52,
        tax: 103.79,
        subTotal: 223.52,
        paymentCurrency: "ILS",
        stokeUmbrella: true
      },
      comment: null
    },
    payment: {
      status: "Pending",
      valueDate: 1657090800000,
      dueDate: new Date('4.15.2022').getTime(),
      name: "Tipalti",
      feeData: {
        transactionFee: {
          type: "ACH",
          cost: 5.5218,
        },
        accelerateFee: {
          cost: 0
        }
      },
      PendingDate: 1655905990000
    },
    description: "good job\n!",
    title: "Milestone for August",
    talentCompletedAt: "2022-10-01",
    approvals: [
      {
        approvedBy: userId1,
        action: "approve",
        approveDate: "2022-08-14",
        level: 1
      }
    ],
    currency: "USD",
    startTim: 1660502656297,
    actualRequestCost: 200,
    endTime: "2023-02-20",
    actualCost: 200,
    requestLocal: 200,
  },
};

describe('updatePOsAllocation', () => {
  beforeAll(async () => {
    await usersService.create(companyAdmin);
    await poService.create(poToAssign);
    await poService.create(poToRevert);
    await jobsService.create(milestone1);
    await jobsService.create(milestone2);
  });

  it('change PO allocation of milestone', async () => {
    let response = await wrapped.run(event(userId1, { milestoneId: milestoneId1, entityId: entityId1, poToAssignId }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.poItemId).toBe(poToAssignId);

    const poToAssign = await poService.get(companyId, poToAssignId);
    expect(poToAssign.available).toBe(800);
    const poToRevert = await poService.get(companyId, poToRevertId);
    expect(poToRevert.available).toBe(1200);
  });

  it('try to change allocation of milestone to po with wrong scope', async () => {
    let response = await wrapped.run(event(userId1, { milestoneId: milestoneId2, entityId: entityId2, poToAssignId }));
    expect(response.statusCode).toBe(500);
    const { message } = JSON.parse(response.body);
    expect(message).toBe("Milestone assignment can't be changed");
  });

  afterAll(async () => {
    await usersService.delete(companyAdmin.userId, companyAdmin.entityId);
    await poService.delete(companyId, poToAssignId);
    await poService.delete(companyId, poToRevertId);
    await jobsService.delete(milestone1.entityId, milestone1.itemId)
    await jobsService.delete(milestone2.entityId, milestone2.itemId)
  });

});
