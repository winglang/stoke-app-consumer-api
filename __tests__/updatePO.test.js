/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */

'use strict';

const mod = require('../src/purchaseOrders/updatePO');
const jestPlugin = require('serverless-jest-plugin');
const { UsersService, POService, constants } = require('stoke-app-common-api');
const poService = new POService(process.env.budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const testName = 'UPDATE-PO';
const companyId = `${testName}-COMP-1`;
const entityId = `${testName}-ENTITY-1`;
const userId1 = `${testName}-ADMIN`;
const userId2 = `${testName}-ADMIN2`;
const blanketId = `${constants.prefix.po}${testName}-blanket1`
const lineItemId = `${blanketId}_lineItem1`
const standardId = `${constants.prefix.po}${testName}-standard1`
const talentId = `talent_${testName}-TALENT-1`;

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

const companyAdmin2 = {
  userId: userId2,
  entityId: companyId,
  companyId: companyId,
  createdBy: userId1,
  modifiedBy: userId1,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const lineItemPO = {
  itemId: lineItemId,
  companyId: companyId,
  createdBy: companyAdmin.userId,
  poScope: {
      scopeIds: [entityId],
      scopeType: constants.poScopeTypes.departments,
      poTypes: [constants.poTypes.talentService],
  },
  amount: 100,
  validFrom: new Date().getTime(),
  validTo: new Date(new Date().getFullYear(), new Date().getMonth()+1, 1).getTime(),
  poNumber: lineItemId,
}

const standardPO = {
  itemId: standardId,
  companyId: companyId,
  createdBy: companyAdmin.userId,
  poScope: {
      scopeIds: [entityId],
      scopeType: constants.poScopeTypes.departments,
      poTypes: [constants.poTypes.talentService],
    },
  amount: 100,
  validFrom: new Date().getTime(),
  validTo: new Date(new Date().getFullYear(), new Date().getMonth()+1, 1).getTime(),
  poNumber: standardId,
}

const blanketPO = {
  itemId: blanketId,
  companyId: companyId,
  createdBy: companyAdmin.userId,
  poScope: {
      scopeIds: [entityId],
      scopeType: constants.poScopeTypes.departments,
      poTypes: [constants.poTypes.talentService],
    },
  amount: 100,
  validFrom: 2,
  validTo: 200,
  poNumber: blanketId,
  isBlanketPO: true,
}

const event = (user, poId, data) => ({
  body: 
      JSON.stringify(data),
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

const updatePOData = {
  usageType: ['fees'],
  poUsageMultiPurpose: ['fees', 'talentService'],
  scopeIds: ['updatedDepartment'],
  scopeType: constants.poScopeTypes.departments,
  addresss: { country: 'IL' },
  description: 'updated description',
  validFrom: new Date().getTime(),
  validTo: new Date(new Date().getFullYear(), new Date().getMonth()+1, 1).getTime(),
};

const closedPOData = {
  validFrom: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).getTime(),
  validTo: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime(),
};

describe('updatePO', () => {
  beforeEach(async () => {
    await usersService.create(companyAdmin);
    await usersService.create(companyAdmin2);
    await poService.create(lineItemPO);
    await poService.create(standardPO);
    await poService.create(blanketPO);
  });

  it('Update amount of standard PO', async () => {
    let response = await wrapped.run(event(userId1, standardId, { amount: 100 }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.available).toBe(200);
    expect(response.itemData.totalAmount).toBe(200);
    expect(response.itemPrivateData.actions[1].action).toBe('add');
  });

  it('Update amount in blanket PO', async () => {
    let response = await wrapped.run(event(userId1, blanketId, { amount: 100 }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.itemData.totalAmount).toBe(200);
    expect(response.itemPrivateData.actions[1].action).toBe('add');
    
    response = await wrapped.run(event(userId1, lineItemId, { amount: 300 }));
    expect(response.statusCode).toBe(500);

    response = await wrapped.run(event(userId1, lineItemId, { amount: 50 }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.available).toBe(150);
    expect(response.itemData.totalAmount).toBe(150);

    response = await wrapped.run(event(userId1, lineItemId, { amount: -50 }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.available).toBe(100);
    expect(response.itemData.totalAmount).toBe(100);

  });

  it('Update lineItems details', async () => {
    let response = await wrapped.run(event(userId1, lineItemId, {
      usageType: updatePOData.usageType,
      scopeIds: updatePOData.scopeIds,
    }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.itemData.poScope.poTypes).toMatchObject(['feesAndAdjustments'])
    expect(response.itemData.poScope.scopeIds).toMatchObject(updatePOData.scopeIds)
    expect(response.itemData.poScope.scopeType).toBe(updatePOData.scopeType)
    response = await wrapped.run(event(userId1, lineItemId, { address: updatePOData.addresss }));
    expect(response.statusCode).toBe(500);
    response = await wrapped.run(event(userId1, lineItemId, { validFrom: updatePOData.validFrom, validTo: updatePOData.validTo }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.validFrom).toBe(updatePOData.validFrom)
    expect(response.validTo).toBe(updatePOData.validTo)
  });

  it('Update standardPO details', async () => {
    let response = await wrapped.run(event(userId1, standardId, {
      usageType: updatePOData.poUsageMultiPurpose,
      scopeIds: updatePOData.scopeIds,
      scopeType:  updatePOData.scopeType,
      validFrom: updatePOData.validFrom,
      validTo: updatePOData.validTo,
      address: updatePOData.addresss,
      description: updatePOData.description,
    }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.itemData.poScope.poTypes).toMatchObject(['feesAndAdjustments', 'talentService']);
    expect(response.itemData.poScope.scopeIds).toMatchObject(updatePOData.scopeIds);
    expect(response.itemData.poScope.scopeType).toBe(updatePOData.scopeType);
    expect(response.itemData.address).toMatchObject(updatePOData.addresss);
    expect(response.itemData.description).toBe(updatePOData.description);
    expect(response.validFrom).toBe(updatePOData.validFrom);
    expect(response.validTo).toBe(updatePOData.validTo);

    response = await wrapped.run(event(userId1, standardId, {
      validFrom: null,
      validTo: null,
    }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.validFrom).toBeFalsy();
    expect(response.validTo).toBeFalsy();

    response = await wrapped.run(event(userId1, standardId, { usageType: [...updatePOData.poUsageMultiPurpose, constants.poTypes.globalFees] }));
    expect(response.statusCode).toBe(500);
    response = await wrapped.run(event(userId1, standardId, { usageType: [...updatePOData.poUsageMultiPurpose, constants.poTypes.globalFees], scopeIds: [companyId], scopeType: constants.poScopeTypes.company }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes.itemData;
    expect(response.poScope.poTypes).toMatchObject([
      constants.poTypes.feesAndAdjustments,
      constants.poTypes.talentService,
      constants.poTypes.globalFees
    ]);
  });

  it('Update standardPO with talent scope type', async () => {
    let response = await wrapped.run(event(userId1, standardId, {
      usageType:['fees', 'talentService'],
      scopeIds: [talentId],
      scopeType: constants.poScopeTypes.talents,
    }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.itemData.poScope.poTypes).toMatchObject(['feesAndAdjustments', 'talentService']);
    expect(response.itemData.poScope.scopeIds).toMatchObject([talentId]);
    expect(response.itemData.poScope.scopeType).toBe(constants.poScopeTypes.talents);
  });

  it('Update standardPO with invalid talent scope', async () => {
    let response = await wrapped.run(event(userId1, standardId, {
      usageType: ['fees', 'talentService'],
      scopeIds: [entityId],
      scopeType: constants.poScopeTypes.talents,
    }));
    expect(response.statusCode).toBe(500);
  });

  it('Update standardPO with company scope type', async () => {
    let response = await wrapped.run(event(userId1, standardId, {
      usageType:['fees', 'talentService'],
      scopeIds: [companyId],
      scopeType: constants.poScopeTypes.company,
    }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.itemData.poScope.poTypes).toMatchObject(['feesAndAdjustments', 'talentService']);
    expect(response.itemData.poScope.scopeIds).toMatchObject([companyId]);
    expect(response.itemData.poScope.scopeType).toBe(constants.poScopeTypes.company);
  });

  it('Update standardPO with invalid company scope', async () => {
    let response = await wrapped.run(event(userId1, standardId, {
      usageType: ['fees', 'talentService'],
      scopeIds: [entityId],
      scopeType: constants.poScopeTypes.company,
    }));
    expect(response.statusCode).toBe(500);
  });

  it('Update blanket PO details', async () => {
    let response = await wrapped.run(event(userId1, blanketId, {
      validFrom: updatePOData.validFrom,
      validTo: updatePOData.validTo,
      address: updatePOData.addresss,
      description: updatePOData.description,
    }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.itemData.address).toMatchObject(updatePOData.addresss);
    expect(response.itemData.description).toBe(updatePOData.description);
    expect(response.validFrom).toBe(updatePOData.validFrom);
    expect(response.validTo).toBe(updatePOData.validTo);

    let lineItem = await poService.get(companyId, lineItemId);
    expect(lineItem.validFrom).toBe(updatePOData.validFrom);
    expect(lineItem.validTo).toBe(updatePOData.validTo);

    response = await wrapped.run(event(userId1, blanketId, { usageType: updatePOData.usageType }));
    expect(response.statusCode).toBe(500);
    response = await wrapped.run(event(userId1, blanketId, { scopeIds: updatePOData.scopeIds }));
    expect(response.statusCode).toBe(500);
    expect(response.statusCode).toBe(500);

    response = await wrapped.run(event(userId1, blanketId, {
      validFrom: null,
      validTo: null,
    }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.validFrom).toBeFalsy();
    expect(response.validTo).toBeFalsy();

    lineItem = await poService.get(companyId, lineItemId);
    expect(lineItem.validFrom).toBeFalsy();
    expect(lineItem.validTo).toBeFalsy();
  });

  it ('Close and reopen standard PO', async () => {
    let response = await wrapped.run(event(userId1, standardId, {
      validFrom: closedPOData.validFrom,
      validTo: closedPOData.validTo,
    }));

    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.validFrom).toBe(closedPOData.validFrom);
    expect(response.validTo).toBe(closedPOData.validTo);
    expect(response.itemData.closedBy).toBe(userId1);

    response = await wrapped.run(event(userId2, standardId, {
      isReopenPO: true,
    }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.validFrom).toBeFalsy();
    expect(response.validTo).toBeFalsy();
    expect(response.itemData.closedBy).toBeFalsy();
    expect(response.itemData.statusHistory).toMatchObject([
      { closedBy: userId1 },
      { reopenedBy: userId2 }
    ]);
  })

  it('Close and reopen blanket PO', async () => {
    let response = await wrapped.run(event(userId1, blanketId, {
      validFrom: closedPOData.validFrom,
      validTo: closedPOData.validTo,
    }));

    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.validFrom).toBe(closedPOData.validFrom);
    expect(response.validTo).toBe(closedPOData.validTo);
    expect(response.itemData.closedBy).toBe(userId1);

    let lineItem = await poService.get(companyId, lineItemId);
    expect(lineItem.validFrom).toBe(closedPOData.validFrom);
    expect(lineItem.validTo).toBe(closedPOData.validTo);
    expect(lineItem.itemData.closedBy).toBe(userId1);

    response = await wrapped.run(event(userId2, lineItemId, {
      isReopenPO: true,
    }));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body).Attributes;
    expect(response.validFrom).toBeFalsy();
    expect(response.validTo).toBeFalsy();
    expect(response.itemData.closedBy).toBeFalsy();
    expect(response.itemData.statusHistory).toMatchObject([
      { closedBy: userId1 },
      { reopenedBy: userId2 }
    ]);
    let blanketItem = await poService.get(companyId, blanketId);
    expect(blanketItem.validFrom).toBeFalsy();
    expect(blanketItem.validTo).toBeFalsy();
    expect(blanketItem.itemData.closedBy).toBeFalsy();
    expect(blanketItem.itemData.statusHistory).toMatchObject([
      { closedBy: userId1 },
      { reopenedBy: userId2 }
    ]);

  })

  afterEach(async () => {
    const allPOs = await poService.listPOsV2(process.env.gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId);
    for (const po of allPOs) {
      // eslint-disable-next-line no-await-in-loop
      await poService.delete(po.entityId, po.itemId);
    }
    await usersService.delete(companyAdmin.userId, companyAdmin.entityId);
    await usersService.delete(companyAdmin2.userId, companyAdmin2.entityId);
  });

});
