/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */

'use strict';

const mod = require('../src/purchaseOrders/createPO');
const jestPlugin = require('serverless-jest-plugin');
const { UsersService, POService, constants } = require('stoke-app-common-api');
const poService = new POService(process.env.budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const testName = 'CREATE-PO';
const companyId = `${testName}-COMP-1`;
const entityId = `${testName}-ENTITY-1`;
const userId1 = `${testName}-ADMIN`;
const talentId = `talent_${testName}-TALENT-1`

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

const poFeesAndAdjustmentsEntity1 = {
  description: 'test description ',
  poNumber: 'A12',
  amount: 1000,
  scopeIds: [entityId],
  scopeType: constants.poScopeTypes.departments,
  usageType: ["fees"],
  validFrom: 1653653289291,
  validTo: 1705392990000,
};

const poFeesAndAdjustmentsGlobal = {
  description: 'test description ',
  poNumber: 'A13',
  amount: 2000,
  scopeIds: [companyId],
  scopeType: constants.poScopeTypes.company,
  usageType: ["fees"],
  validFrom: 1653653289291,
  validTo: 1705392990000,
};

const poTalentServicesGlobal = {
  description: 'test description ',
  poNumber: 'A14',
  amount: 3000,
  scopeIds: [entityId],
  scopeType: constants.poScopeTypes.departments,
  usageType: ["talentService", "fees"],
};

const redundantPONumber = {
  description: 'test description ',
  poNumber: 'Aredundant',
  amount: 3000,
  scopeIds: [entityId],
  scopeType: constants.poScopeTypes.departments,
  usageType: ["talentService"],
};

const blanketPODetails = {
  description: 'test description ',
  poNumber: 'A15',
  amount: 3000,
  scopeIds: [companyId],
  scopeType: constants.poScopeTypes.company,
  isBlanketPO: true,
  lineItems: [
    {
      description: 'line item 1',
      poNumber: 'A15-1',
      amount: 1000,
      scopeIds: [entityId],
      scopeType: constants.poScopeTypes.departments,
      usageType: ["talentService"],
    }
  ]
};

const invalidScope = {
  description: 'test description ',
  poNumber: 'B1',
  amount: 3000,
  scopeIds: [entityId],
  scopeType: constants.poScopeTypes.departments,
  usageType: [constants.poTypes.globalFees],
};

const blanketPONoLineItems = {
  description: 'test description ',
  poNumber: 'A16',
  amount: 3000,
  scopeIds: [companyId],
  scopeType: constants.poScopeTypes.company,
  isBlanketPO: true,
};

const poWithTalentScope = {
  description: 'test description ',
  poNumber: 'A17',
  amount: 3000,
  scopeIds: [talentId],
  scopeType: constants.poScopeTypes.talents,
  usageType: ["talentService", "fees"],
};

const poWithInvalidTalentScope = {
  description: 'test description ',
  poNumber: 'A18',
  amount: 3000,
  scopeIds: [entityId],
  scopeType: constants.poScopeTypes.talents,
  usageType: ["talentService", "fees"],
};

const poWithCompanyScope = {
  description: 'test description ',
  poNumber: 'A19',
  amount: 3000,
  scopeIds: [companyId],
  scopeType: constants.poScopeTypes.company,
  usageType: [constants.poTypes.globalFees],
};

const addLineItemsToPO = {
  lineItems: [
    {
      description: 'line item 1',
      poNumber: 'lineItem-1',
      amount: 50,
      scopeIds: [entityId],
      scopeType: constants.poScopeTypes.departments,
      usageType: ["talentService"],
    },
    {
      description: 'line item 1',
      poNumber: 'lineItem-2',
      amount: 50,
      scopeIds: [entityId],
      scopeType: constants.poScopeTypes.departments,
      usageType: ["talentService"],
    }
  ]
}

const event = (user, poDetails, poId) => ({
  body: 
      JSON.stringify(poDetails),    
  requestContext: {
    identity: {
      cognitoIdentityId: user
    }
  },
  pathParameters: {
    companyId,
    poId,
  }
});

describe('cratePO', () => {
  beforeAll(async () => {
    await usersService.create(companyAdmin);
  });

  it('Create PO, scope: feesAndAdjustments and department, expect 200, data', async () => {
    let response = await wrapped.run(event(userId1, poFeesAndAdjustmentsEntity1));
    expect(response.statusCode).toBe(200);
    [response] = JSON.parse(response.body);
    expect(response.available).toBe(poFeesAndAdjustmentsEntity1.amount);
    expect(response.createdBy).toBe(userId1);
    expect(response.itemId.startsWith('po_A12')).toBeTruthy();
    expect(response.poNumber).toBe(poFeesAndAdjustmentsEntity1.poNumber);
    expect(response.expirationDate).toBe(poFeesAndAdjustmentsEntity1.validTo);
    expect(response.startDate).toBe(poFeesAndAdjustmentsEntity1.validFrom);
    expect(response.scopeIds).toMatchObject(poFeesAndAdjustmentsEntity1.scopeIds);
    expect(response.scopeType).toBe(poFeesAndAdjustmentsEntity1.scopeType);
    expect(response.usageType[0]).toBe(poFeesAndAdjustmentsEntity1.usageType[0]);
    expect(response.originalAmount).toBe(poFeesAndAdjustmentsEntity1.amount);
  });

  it('Create PO, scope: talentfeesAndAdjustments and whole company, expect 200, data', async () => {
    let response = await wrapped.run(event(userId1, poFeesAndAdjustmentsGlobal));
    expect(response.statusCode).toBe(200);
    [response] = JSON.parse(response.body);
    expect(response.available).toBe(poFeesAndAdjustmentsGlobal.amount);
    expect(response.createdBy).toBe(userId1);
    expect(response.itemId.startsWith('po_A13')).toBeTruthy();
    expect(response.poNumber).toBe(poFeesAndAdjustmentsGlobal.poNumber);
    expect(response.expirationDate).toBe(poFeesAndAdjustmentsGlobal.validTo);
    expect(response.startDate).toBe(poFeesAndAdjustmentsGlobal.validFrom);
    expect(response.scopeIds).toMatchObject([companyId]);
    expect(response.scopeType).toBe(poFeesAndAdjustmentsGlobal.scopeType);
    expect(response.usageType[0]).toBe(poFeesAndAdjustmentsGlobal.usageType[0]);
    expect(response.originalAmount).toBe(poFeesAndAdjustmentsGlobal.amount);
  });

  it('Create PO, for talentServices in global scope, expect 200, data', async () => {
    let response = await wrapped.run(event(userId1, poTalentServicesGlobal));
    expect(response.statusCode).toBe(200);
    [response] = JSON.parse(response.body);
    expect(response.available).toBe(poTalentServicesGlobal.amount);
    expect(response.createdBy).toBe(userId1);
    expect(response.itemId.startsWith('po_A14')).toBeTruthy();
    expect(response.poNumber).toBe(poTalentServicesGlobal.poNumber);
    expect(response.expirationDate).toBeFalsy();
    expect(response.startDate).toBeFalsy();
    expect(response.validTo).toBeFalsy();
    expect(response.scopeIds).toMatchObject(poTalentServicesGlobal.scopeIds);
    expect(response.scopeType).toBe(poTalentServicesGlobal.scopeType);
    expect(response.usageType[0]).toBe(poTalentServicesGlobal.usageType[0]);
    expect(response.usageType[1]).toBe(poTalentServicesGlobal.usageType[1]);
    expect(response.originalAmount).toBe(poTalentServicesGlobal.amount);
  });

  it('Create PO, with talents scope, expect 200, data', async () => {
    let response = await wrapped.run(event(userId1, poWithTalentScope));
    expect(response.statusCode).toBe(200);
    [response] = JSON.parse(response.body);
    expect(response.available).toBe(poWithTalentScope.amount);
    expect(response.createdBy).toBe(userId1);
    expect(response.itemId.startsWith('po_A17')).toBeTruthy();
    expect(response.poNumber).toBe(poWithTalentScope.poNumber);
    expect(response.expirationDate).toBeFalsy();
    expect(response.startDate).toBeFalsy();
    expect(response.validTo).toBeFalsy();
    expect(response.scopeIds).toMatchObject(poWithTalentScope.scopeIds);
    expect(response.scopeType).toBe(poWithTalentScope.scopeType);
    expect(response.usageType[0]).toBe(poWithTalentScope.usageType[0]);
    expect(response.usageType[1]).toBe(poWithTalentScope.usageType[1]);
    expect(response.originalAmount).toBe(poWithTalentScope.amount);
  });

  it('Create PO, with company scope, expect 200, data', async () => {
    let response = await wrapped.run(event(userId1, poWithCompanyScope));
    expect(response.statusCode).toBe(200);
    [response] = JSON.parse(response.body);
    expect(response.available).toBe(poWithCompanyScope.amount);
    expect(response.createdBy).toBe(userId1);
    expect(response.itemId.startsWith('po_A19')).toBeTruthy();
    expect(response.poNumber).toBe(poWithCompanyScope.poNumber);
    expect(response.expirationDate).toBeFalsy();
    expect(response.startDate).toBeFalsy();
    expect(response.validTo).toBeFalsy();
    expect(response.scopeIds).toMatchObject(poWithCompanyScope.scopeIds);
    expect(response.scopeType).toBe(poWithCompanyScope.scopeType);
    expect(response.usageType[0]).toBe(poWithCompanyScope.usageType[0]);
    expect(response.originalAmount).toBe(poWithCompanyScope.amount);
  });

  it('Create PO, with invalid talent poScope, expect error 500, data', async () => {
    const response = await wrapped.run(event(userId1, poWithInvalidTalentScope));
    expect(response.statusCode).toBe(500);
  });

  it('Create PO, redudant PO number, expect error 500, data', async () => {
    await wrapped.run(event(userId1, redundantPONumber));
    const response = await wrapped.run(event(userId1, redundantPONumber));
    expect(response.statusCode).toBe(500);
  });

  it('Anothorised user', async () => {
    const response = await wrapped.run(event('someone', poTalentServicesGlobal));
    expect(response.statusCode).toBe(403);
  });

  it('Create PO for globalFees', async () => {
    let response = await wrapped.run(event(userId1, invalidScope));
    expect(response.statusCode).toBe(500);
    response = await wrapped.run(event(userId1, { ...invalidScope, scopeIds: [companyId], scopeType: constants.poScopeTypes.company }));
    expect(response.statusCode).toBe(200);
    [response] = JSON.parse(response.body);
    expect(response.usageType).toMatchObject([constants.poTypes.globalFees]);
    expect(response.scopeIds).toMatchObject([companyId]);
    expect(response.scopeType).toBe(constants.poScopeTypes.company)
  });

  it('Create Blanket PO, expect 200, data', async () => {
    let response = await wrapped.run(event(userId1, blanketPODetails));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    expect(response[0].available).toBeFalsy();
    expect(response[0].isBlanketPO).toBeTruthy();
    expect(response[0].createdBy).toBe(userId1);
    expect(response[0].itemId.startsWith(`po_${blanketPODetails.poNumber}`)).toBeTruthy();
    expect(response[0].poNumber).toBe(blanketPODetails.poNumber);
    expect(response[0].expirationDate).toBeFalsy();
    expect(response[0].scopeIds).toMatchObject(blanketPODetails.scopeIds);
    expect(response[0].scopeType).toBe(blanketPODetails.scopeType);
    expect(response[0].mainPO).toBe(response[0].itemId);

    expect(response[1].available).toBe(blanketPODetails.lineItems[0].amount);
    expect(response[1].isBlanketPO).toBeFalsy();
    expect(response[1].itemId.startsWith(response[0].itemId)).toBeTruthy();
    expect(response[1].poNumber).toBe(blanketPODetails.lineItems[0].poNumber);
    expect(response[1].expirationDate).toBeFalsy();
    expect(response[1].scopeIds).toMatchObject(blanketPODetails.lineItems[0].scopeIds);
    expect(response[1].scopeType).toBe(blanketPODetails.lineItems[0].scopeType);
    expect(response[1].usageType[0]).toBe(blanketPODetails.lineItems[0].usageType[0]);
    expect(response[1].mainPO).toBe(response[0].itemId);
  });

  it('Add lineItems to Blanket PO, expect 200, data', async () => {
    let response = await wrapped.run(event(userId1, blanketPONoLineItems));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    expect(response[0].available).toBeFalsy();
    expect(response[0].isBlanketPO).toBeTruthy();
    expect(response[0].createdBy).toBe(userId1);
    expect(response[0].itemId.startsWith(`po_${blanketPONoLineItems.poNumber}`)).toBeTruthy();
    expect(response[0].poNumber).toBe(blanketPONoLineItems.poNumber);
    expect(response[0].expirationDate).toBeFalsy();
    expect(response[0].scopeIds).toMatchObject(blanketPONoLineItems.scopeIds);
    expect(response[0].scopeType).toBe(blanketPONoLineItems.scopeType);
    response = await wrapped.run(event(userId1, addLineItemsToPO, response[0].itemId));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    expect(response.length).toBe(2)
  });

  afterAll(async () => {
    const allPOs = await poService.listPOsV2(process.env.gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId);
    for (const po of allPOs) {
      // eslint-disable-next-line no-await-in-loop
      await poService.delete(po.entityId, po.itemId);
    }
    await usersService.delete(companyAdmin.userId, companyAdmin.entityId);
  });

});
