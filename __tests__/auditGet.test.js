'use strict';

const mod = require('../src/audit');
const { UsersService, AuditService, CompaniesService, POService, constants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const auditService = new AuditService(process.env.auditTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const poService = new POService(process.env.budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);

const jestPlugin = require('serverless-jest-plugin');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const userId = 'userId-audit';
const companyId = 'compId_audit';
const entityId = 'entityID-audit';
const entityId2 = 'entityID2-audit';
const type = constants.audit.types.workflows;
const auditId1 = 'workflows_audit1';
const auditId2 = 'workflows_audit2';
const auditPOId1 = 'po_configuration_auditPO1';
const auditPOId2 = 'po_configuration_auditPO2';
const auditPOId3 = 'po_configuration_auditPO3';
const auditPOId4 = 'po_configuration_auditPO4';
const auditPOId5 = 'po_configuration_auditPO5';
const auditPOId6 = 'po_configuration_auditPO6';
const poItemId = 'po_TESTAUDIT1';
const poItemId2 = 'po_TESTAUDIT2';

const createEvent = (auditType, pageSize = 10, sortModel, activeFilters) => ({
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  queryStringParameters: {
    companyId,
    type: auditType
  }, body: JSON.stringify({
    paginationParams: {
      page: {
        pageSize,
        startRow: 0
      },
      sortModel,
      activeFilters
    },
  })
})

const event2 = {
  requestContext: {
    identity: {
      cognitoIdentityId: 'userId'
    }
  },
  queryStringParameters: {
    companyId,
    type
  }
};

const event3 = {
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  queryStringParameters: {
    companyId,
  }
};

const audit1 = {
  itemId: auditId1,
  type,
  companyId,
  itemData: {
    workflow: { id: '1' }
  },
  itemStatus: constants.itemStatus.active
}

const audit2 = {
  itemId: auditId2,
  type,
  companyId,
  itemData: {
    workflow: {
      id: '2'
    }
  },
  itemStatus: constants.itemStatus.active
}

const workspaceInCompany = {
  companyId,
  itemId: `${constants.prefix.entity}${entityId}`,
  userId: userId,
  itemData: {
    entityName: "PO Audit Test 1"
  }
};

const workspace2InCompany = {
  companyId,
  itemId: `${constants.prefix.entity}${entityId2}`,
  userId: userId,
  itemData: {
    entityName: "PO Audit Test 1"
  }
};


const userInCompany = {
  companyId,
  itemId: constants.prefix.userPoolId + userId,
  userId,
  itemData: {
    familyName: "Fruma",
    givenName: "Truman",
    role: "admin",
  }
};

const address = {
  city: "NY",
  country: "United States",
  postalCode: "12345",
  state: "NY",
  street: "street 12"
}

const po1 = {
  itemId: poItemId,
  companyId,
  createdBy: userId,
  poScope: {
    scopeIds: [entityId],
    poTypes: [constants.poTypes.feesAndAdjustments, constants.poTypes.talentService],
  },
  address,
  amount: 11,
  poNumber: "testAudit1",
}

const po2 = {
  itemId: poItemId2,
  companyId,
  createdBy: userId,
  poScope: {},
  address,
  amount: 11,
  poNumber: "testAudit2",
  isBlanketPO: true
}

const po3 = {
  itemId: `${poItemId2}_li1`,
  companyId,
  createdBy: userId,
  poScope: {
    scopeIds: [companyId],
    poTypes: [constants.poTypes.globalFees],
    scopeType: constants.poScopeTypes.company,
  },
  amount: 13,
  poNumber: "10",
}

const auditPO1 = {
  companyId,
  itemId: auditPOId1,
  itemData: {
    itemId: poItemId,
    actionType: "create",
    poItemData: {
      address,
      description: "descr",
      poNumber: "testAudit1",
      poScope: {
        scopeIds: [entityId],
        poTypes: [constants.poTypes.feesAndAdjustments, constants.poTypes.talentService],
        scopeType: constants.poScopeTypes.departments,
      },
      totalAmount: 11
    },
    userId,
  },
  itemStatus: constants.itemStatus.active
}

const auditPO2 = {
  companyId,
  itemId: auditPOId2,
  itemData: {
    itemId: poItemId2,
    actionType: "create",
    poItemData: {
      address,
      description: "descr",
      poNumber: "testAudit2",
      totalAmount: 11,
      isBlanketPO: true,
    },
    userId,
  },
  itemStatus: constants.itemStatus.active
}

const auditPO3 = {
  companyId,
  itemId: auditPOId3,
  itemData: {
    itemId: po3.itemId,
    actionType: "create",
    poItemData: {
      poNumber: po3.poNumber,
      totalAmount: 13,
      poScope: {
        scopeIds: [companyId],
        poTypes: [constants.poTypes.globalFees],
        scopeType: constants.poScopeTypes.company,
      },
    },
    userId,
  },
  itemStatus: constants.itemStatus.active
}

const auditPO4 = {
  companyId,
  itemId: auditPOId4,
  itemData: {
    itemId: po3.itemId,
    actionType: "add",
    amount: 20,
    userId,
  },
  itemStatus: constants.itemStatus.active
}

const auditPO5 = {
  companyId,
  itemId: auditPOId5,
  itemData: {
    itemId: po3.itemId,
    actionType: "subtract",
    amount: -20,
    userId,
  },
  itemStatus: constants.itemStatus.active
}

const auditPO6 = {
  companyId,
  itemId: auditPOId6,
  itemData: {
    itemId: po3.itemId,
    actionType: "updateDetails",
    userId,
    newValues: {
      address,
      scopeIds: [entityId],
      description: "33 --",
      poTypes: [constants.poTypes.talentService]
    },
  },
  itemStatus: constants.itemStatus.active
}

const poAuditResult = [
  {
    itemId: auditPOId6,
    poItemId: po3.itemId,
    createdAt: 1678606642059,
    date: '12 Mar 2023, 09:37:22',
    action: 'Update details',
    user: "Truman Fruma",
    poNumber: `${po2.poNumber} - ${po3.poNumber}`,
    change: "usage type: Talent payments\nworkspaces: PO Audit Test 1\ndescription: 33 --\naddress: street 12, NY, NY, 12345, United States",
  },
  {
    itemId: auditPOId5,
    poItemId: po3.itemId,
    createdAt: 1678606642058,
    date: '12 Mar 2023, 09:37:22',
    action: 'Deduct amount',
    user: "Truman Fruma",
    poNumber: `${po2.poNumber} - ${po3.poNumber}`,
    change: "$20",
  },
  {
    itemId: auditPOId4,
    poItemId: po3.itemId,
    createdAt: 1678606642057,
    date: '12 Mar 2023, 09:37:22',
    action: 'Add amount',
    user: "Truman Fruma",
    poNumber: `${po2.poNumber} - ${po3.poNumber}`,
    change: "$20",
  },
  {
    itemId: auditPOId3,
    poItemId: po3.itemId,
    createdAt: 1678606642056,
    date: '12 Mar 2023, 09:37:22',
    action: 'New PO',
    user: "Truman Fruma",
    poNumber: `${po2.poNumber} - ${po3.poNumber}`,
    change: "Item: $13\nusage type: Additional services\nscope type: Company",
  },
  {
    itemId: auditPOId2,
    poItemId: poItemId2,
    createdAt: 1678606642055,
    date: '12 Mar 2023, 09:37:22',
    action: 'New PO',
    user: "Truman Fruma",
    poNumber: po2.poNumber,
    change: "Blanket PO: $11\ndescription: descr\naddress: street 12, NY, NY, 12345, United States",
  },
  {
    itemId: auditPOId1,
    poItemId,
    createdAt: 1678606642054,
    date: '12 Mar 2023, 09:37:22',
    action: 'New PO',
    user: "Truman Fruma",
    poNumber: po1.poNumber,
    change: "Standart PO: $11\nusage type: Fees, Talent payments\nscope type: Workspace(s)\nworkspaces: PO Audit Test 1\ndescription: descr\naddress: street 12, NY, NY, 12345, United States",
  },
]

describe('getAudit', () => {
  beforeAll(async () => {
    const user = {
      userId,
      entityId: companyId,
      companyId,
      itemStatus: constants.user.status.active,
      itemData: {
        userRole: constants.user.role.admin, permissionsComponents: {
          [permissionsComponentsKeys.po]: { isEditor: false },
          [permissionsComponentsKeys.workflows]: { isEditor: false },
        }
      }
    };
    await usersService.create(user);
    await auditService.create(audit1, { createdAt: 1678606642054 });
    await auditService.create(audit2, { createdAt: 1678606642055 });
    await poService.create(po1);
    await poService.create(po2);
    await poService.create(po3);
    await auditService.create(auditPO1, { createdAt: 1678606642054 });
    await auditService.create(auditPO2, { createdAt: 1678606642055 });
    await auditService.create(auditPO3, { createdAt: 1678606642056 });
    await auditService.create(auditPO4, { createdAt: 1678606642057 });
    await auditService.create(auditPO5, { createdAt: 1678606642058 });
    await auditService.create(auditPO6, { createdAt: 1678606642059 });
    await companiesService.create(workspaceInCompany);
    await companiesService.create(workspace2InCompany);
    await companiesService.create(userInCompany);

  });

  it('getAudit, expect 200, return data', () => {
    return wrapped.run(createEvent(type)).then((response) => {
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const { rows, total } = body;
      expect(total.allDataCount).toBe(2);
      expect(rows.length).toBe(2);
      expect(rows).toMatchObject([
        {
          itemId: 'workflows_audit1',
          workflow: {},
          createdAt: 1678606642054,
          date: '12 Mar 2023, 09:37:22',
          trigger: '',
          action: '',
          actionItem: {},
          actionTooltip: ''
        },
        {
          itemId: 'workflows_audit2',
          createdAt: 1678606642055,
          workflow: {},
          date: '12 Mar 2023, 09:37:22',
          trigger: '',
          action: '',
          actionItem: {},
          actionTooltip: ''
        }
      ])
    });
  });

  it('get Purchase Orders Audit, expect 200, return data', () => {
    return wrapped.run(createEvent(constants.audit.types.poConfiguration)).then((response) => {
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const { rows, total } = body;
      expect(total.allDataCount).toBe(6);
      expect(rows.length).toBe(6);
      expect(rows).toMatchObject(poAuditResult);
    });
  });

  it('getAudit, expect 200, return data - paginate', () => {
    return wrapped.run(createEvent(type, 1)).then((response) => {
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const { rows, total } = body;
      expect(total.allDataCount).toBe(2);
      expect(rows.length).toBe(1);
      expect(rows).toMatchObject([
        {
          itemId: 'workflows_audit1',
          workflow: {},
          createdAt: 1678606642054,
          date: '12 Mar 2023, 09:37:22',
          trigger: '',
          action: '',
          actionItem: {},
          actionTooltip: ''
        }
      ])
    });
  });

  it('getAudit, expect 200, return data - order', () => {
    return wrapped.run(createEvent(type, 10, [{
      colId: 'date',
      sort: 'DESC'
    }])).then((response) => {
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const { rows, total } = body;
      expect(total.allDataCount).toBe(2);
      expect(rows.length).toBe(2);
      expect(rows).toMatchObject([
        {
          itemId: 'workflows_audit2',
          createdAt: 1678606642055,
          workflow: {},
          date: '12 Mar 2023, 09:37:22',
          trigger: '',
          action: '',
          actionItem: {},
          actionTooltip: ''
        },
        {
          itemId: 'workflows_audit1',
          workflow: {},
          createdAt: 1678606642054,
          date: '12 Mar 2023, 09:37:22',
          trigger: '',
          action: '',
          actionItem: {},
          actionTooltip: ''
        }
      ])
    });
  });

  it('getAudit, expect 200, return data - paginate order', () => {
    return wrapped.run(createEvent(type, 1, [{
      colId: 'date',
      sort: 'DESC'
    }])).then((response) => {
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const { rows, total } = body;
      expect(total.allDataCount).toBe(2);
      expect(rows.length).toBe(1);
      expect(rows).toMatchObject([
        {
          itemId: 'workflows_audit2',
          createdAt: 1678606642055,
          workflow: {},
          date: '12 Mar 2023, 09:37:22',
          trigger: '',
          action: '',
          actionItem: {},
          actionTooltip: ''
        }
      ])
    });
  });

  it('getAudit, expect 200, return data - filter', () => {
    return wrapped.run(createEvent(type, 10, undefined, { workflowId: [2] })).then((response) => {
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const { rows, total } = body;
      expect(total.allDataCount).toBe(1);
      expect(rows.length).toBe(1);
      expect(rows).toMatchObject([
        {
          itemId: 'workflows_audit2',
          createdAt: 1678606642055,
          workflow: {},
          date: '12 Mar 2023, 09:37:22',
          trigger: '',
          action: '',
          actionItem: {},
          actionTooltip: ''
        }
      ])
    });
  });

  it('getAudit, expect 403', () => {
    return wrapped.run(event2).then((response) => {
      expect(response.statusCode).toBe(403);
    });
  });

  it('getAudit, expect 500', () => {
    return wrapped.run(event3).then((response) => {
      expect(response.statusCode).toBe(500);
    });
  });

  afterAll(async () => {
    //cleanup
    await auditService.delete(companyId, audit1.itemId);
    await auditService.delete(companyId, audit2.itemId);
    await auditService.delete(companyId, auditPO1.itemId);
    await auditService.delete(companyId, auditPO2.itemId);
    await auditService.delete(companyId, auditPO3.itemId);
    await auditService.delete(companyId, auditPO4.itemId);
    await auditService.delete(companyId, auditPO5.itemId);
    await auditService.delete(companyId, auditPO6.itemId);
    await poService.delete(companyId, po1.itemId);
    await poService.delete(companyId, po2.itemId);
    await poService.delete(companyId, po3.itemId);
    await companiesService.delete(workspaceInCompany.itemId);
    await companiesService.delete(userInCompany.itemId);
  });

});
