'use strict';
// tests for getBudget

const mod = require('../src/budgets');
const { UsersService, BudgetsService, constants, permisionConstants } = require('stoke-app-common-api');
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'listBudgets' });

const companyId = 'LIST-BUDGET-JEST-TEST-COMPANY-ID-1';
const entityId = 'LIST-BUDGET-JEST-TEST-ENTITY-ID-1';
const entityId2 = 'LIST-BUDGET-JEST-TEST-ENTITY-ID-2';
const userId1 = 'LIST-BUDGET-JEST-TEST-ADMIN-ID-1'
const userId2 = 'LIST-BUDGET-JEST-TEST-ADMIN-ID-2'
const userId3 = 'LIST-BUDGET-JEST-TEST-ADMIN-ID-3'
const userId4 = 'LIST-BUDGET-JEST-TEST-ADMIN-ID-4'

const companyAdmin = {
  userId: userId1,
  entityId: companyId,
  companyId: companyId,
  createdBy: userId1,
  modifiedBy: userId1,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    permissionsComponents: {
      [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: false },
  },
  }
};

const entityAdmin = {
  userId: userId2,
  entityId: entityId,
  companyId: companyId,
  createdBy: userId2,
  modifiedBy: userId2,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const entityUser = {
  userId: userId3,
  entityId: entityId,
  companyId: companyId,
  createdBy: userId3,
  modifiedBy: userId3,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user
  }
};

const entityUser2 = {
  userId: userId4,
  entityId: entityId,
  companyId: companyId,
  createdBy: userId4,
  modifiedBy: userId4,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user
  }
};

const entity2User2 = {
  userId: userId4,
  entityId: entityId2,
  companyId: companyId,
  createdBy: userId4,
  modifiedBy: userId4,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const companyBudget = {
  itemId: constants.prefix.company + companyId,
  entityId: companyId,
  companyId: companyId,
  userId: companyAdmin.userId,
  itemData: {
    2019:
    {
      periods: 4,
      1: { total: 100, allocated: 100, approved: 10, pending: 5, committed: 2 },
      2: { total: 100, allocated: 100, approved: 2, pending: 5, committed: 2 },
      3: { total: 100, allocated: 100, approved: 0, pending: 0, committed: 0 },
      4: { total: 100.1, allocated: 100, approved: 0, pending: 0, committed: 0 },
    }
  }
}


const entityBudget = {
  itemId: constants.prefix.entity + entityId,
  entityId: entityId,
  companyId: companyId,
  userId: entityAdmin.userId,
  itemData: {
    2019:
    {
      periods: 4,
      1: { total: 50, allocated: 20, approved: 10, pending: 5, committed: 2 },
      2: { total: 50, allocated: 20, approved: 2, pending: 5, committed: 2 },
      3: { total: 50, allocated: 20, approved: 0, pending: 0, committed: 0 },
      4: { total: 50, allocated: 20, approved: 0, pending: 0, committed: 0 },
    },
  }
}

const entity2Budget = {
  itemId: constants.prefix.entity + entityId2,
  entityId: entityId2,
  companyId: companyId,
  userId: entityAdmin.userId,
  itemData: {
    2019:
    {
      periods: 4,
      1: { total: 20, approved: 10, pending: 5, committed: 2 },
      2: { total: 20, approved: 2, pending: 5, committed: 2 },
      3: { total: 20, approved: 0, pending: 0, committed: 0 },
      4: { total: 20, approved: 0, pending: 0, committed: 0 },
    },
  }
}

const user1Budget = {
  itemId: constants.prefix.user + userId1,
  entityId: entityId,
  companyId: companyId,
  userId: userId1,
  itemData: {
    2019:
    {
      periods: 4,
      1: { total: 20, approved: 10, pending: 5, committed: 2 },
      2: { total: 20, approved: 2, pending: 5, committed: 2 },
      3: { total: 20, approved: 0, pending: 0, committed: 0 },
      4: { total: 20, approved: 0, pending: 0, committed: 0 },
    },
  }
}

const user2Budget = {
  itemId: constants.prefix.user + userId2,
  entityId: entityId,
  companyId: companyId,
  userId: userId2,
  itemData: {
    2019:
    {
      periods: 4,
      1: { total: 20, approved: 10, pending: 5, committed: 2 },
      2: { total: 20, approved: 2, pending: 5, committed: 2 },
      3: { total: 20, approved: 0, pending: 0, committed: 0 },
      4: { total: 20, approved: 0, pending: 0, committed: 0 },
    },
  }
}

const user3Budget = {
  itemId: constants.prefix.user + userId3,
  entityId: entityId,
  companyId: companyId,
  userId: userId3,
  itemData: {
    2019:
    {
      periods: 4,
      1: { total: 20, approved: 10, pending: 5, committed: 2 },
      2: { total: 20, approved: 2, pending: 5, committed: 2 },
      3: { total: 20, approved: 0, pending: 0, committed: 0 },
      4: { total: 20, approved: 0, pending: 0, committed: 0 },
    },
  }
}

const user4Budget = {
  itemId: constants.prefix.user + userId4,
  entityId: entityId,
  companyId: companyId,
  userId: userId4,
  itemData: {
    2019:
    {
      periods: 4,
      1: { total: 20, approved: 10, pending: 5, committed: 2 },
      2: { total: 20, approved: 2, pending: 5, committed: 2 },
      3: { total: 20, approved: 0, pending: 0, committed: 0 },
      4: { total: 20, approved: 0, pending: 0, committed: 0 },
    },
  }
}

const user4BudgetEntity2 = {
  itemId: constants.prefix.user + userId4,
  entityId: entityId2,
  companyId: companyId,
  userId: userId4,
  itemData: {
    2019:
    {
      periods: 4,
      1: { total: 20, approved: 10, pending: 5, committed: 2 },
      2: { total: 20, approved: 2, pending: 5, committed: 2 },
      3: { total: 20, approved: 0, pending: 0, committed: 0 },
      4: { total: 20, approved: 0, pending: 0, committed: 0 },
    },
  }
}

const event = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: companyAdmin.userId
    }
  },
  queryStringParameters: {
    companyId: companyAdmin.companyId
  }
};

const eventNotAdmin = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: userId3
    }
  },
  queryStringParameters: {
    companyId: companyAdmin.companyId
  }
};


const entityEvent = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: entityAdmin.userId
    }
  },
  queryStringParameters: {
    entityId: entityAdmin.entityId
  }
};

const entityEventForUser4 = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: userId4
    }
  },
  queryStringParameters: {
    companyId
  }
};

const entityEventForUser4WithFilter = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: userId4
    }
  },
  queryStringParameters: {
    companyId,
    filter: constants.prefix.company
  }
};


const entityEventNotAdmin = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: userId3
    }
  },
  queryStringParameters: {
    entityId: entityAdmin.entityId
  }
};

const unauthorisedEvent = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: entityAdmin.userId + 'not user'
    }
  },
  queryStringParameters: {
    companyId: companyAdmin.companyId
  }
};

describe('listBudgets', () => {
  beforeAll(async () => {
    // create an admin users in company and entity
    let result = await usersService.create(companyAdmin);
    expect(result.userId).toBe(companyAdmin.userId);
    result = await usersService.create(entityAdmin);
    expect(result.userId).toBe(entityAdmin.userId);
    result = await usersService.create(entityUser);
    expect(result.userId).toBe(entityUser.userId);
    result = await usersService.create(entityUser2);
    expect(result.userId).toBe(entityUser2.userId);
    result = await usersService.create(entity2User2);
    expect(result.userId).toBe(entity2User2.userId);
    // create test budgets
    result = await budgetsService.create(companyBudget);
    expect(result.itemId).toBe(companyBudget.itemId);
    result = await budgetsService.create(entityBudget);
    expect(result.itemId).toBe(entityBudget.itemId);
    result = await budgetsService.create(entity2Budget);
    expect(result.itemId).toBe(entity2Budget.itemId);
    result = await budgetsService.create(user1Budget);
    expect(result.itemId).toBe(user1Budget.itemId);
    result = await budgetsService.create(user2Budget);
    expect(result.itemId).toBe(user2Budget.itemId);
    result = await budgetsService.create(user3Budget);
    expect(result.itemId).toBe(user3Budget.itemId);
    result = await budgetsService.create(user4Budget);
    expect(result.itemId).toBe(user4Budget.itemId);
    result = await budgetsService.create(user4BudgetEntity2);
    expect(result.itemId).toBe(user4BudgetEntity2.itemId);
  });

  it('listBudgets for company scope, expect 200, data', async () => {
    let response = await wrapped.run(event)
    expect(response.statusCode).toBe(200);
    let responseObj = JSON.parse(response.body);
    expect(responseObj).toMatchObject([companyBudget, entityBudget, entity2Budget, user1Budget, user2Budget, user3Budget, user4Budget, user4BudgetEntity2]);
    event.queryStringParameters['filter'] = 'user';
    response = await wrapped.run(event)
    expect(response.statusCode).toBe(200);
    responseObj = JSON.parse(response.body);
    expect(responseObj).toMatchObject([user1Budget, user2Budget, user3Budget, user4Budget, user4BudgetEntity2]);
  });


  it('listBudgets for company scope not admin , expect 200, data', async () => {
    const aggregateCompany = {
      itemId: constants.prefix.company + companyId,
      entityId: companyId,
      companyId: companyId,
      itemData: {
        2019:
        {
          periods: 4,
          1: { total: 20, approved: 10, pending: 5, committed: 2 },
          2: { total: 20, approved: 2, pending: 5, committed: 2 },
          3: { total: 20, approved: 0, pending: 0, committed: 0 },
          4: { total: 20, approved: 0, pending: 0, committed: 0 },
        }
      }
    }
    const aggregateEntity = {
      itemId: constants.prefix.entity + entityId,
      entityId: entityId,
      companyId: companyId,
      itemData: {
        2019:
        {
          periods: 4,
          1: { total: 20, approved: 10, pending: 5, committed: 2 },
          2: { total: 20, approved: 2, pending: 5, committed: 2 },
          3: { total: 20, approved: 0, pending: 0, committed: 0 },
          4: { total: 20, approved: 0, pending: 0, committed: 0 },
        },
      }
    }
    let response = await wrapped.run(eventNotAdmin)
    expect(response.statusCode).toBe(200);
    let responseObj = JSON.parse(response.body);
    expect(responseObj).toMatchObject([user3Budget, aggregateEntity, aggregateCompany]);
  });

  it('listBudgets for entity scope, expect 200, data', async () => {
    let response = await wrapped.run(entityEvent)
    expect(response.statusCode).toBe(200);
    let responseObj = JSON.parse(response.body);
    expect(responseObj).toMatchObject([entityBudget, user1Budget, user2Budget, user3Budget, user4Budget]);
    entityEvent.queryStringParameters['filter'] = 'user';
    response = await wrapped.run(entityEvent)
    expect(response.statusCode).toBe(200);
    responseObj = JSON.parse(response.body);
    expect(responseObj).toMatchObject([user1Budget, user2Budget, user3Budget, user4Budget]);
  });

  it('listBudgets for compnay scope - admin in one entity not admin in another entity, expect 200, data', async () => {
    const aggregateCompany = {
      itemId: constants.prefix.company + companyId,
      entityId: companyId,
      companyId: companyId,
      itemData: {
        2019:
        {
          periods: 4,
          1: { total: 40, approved: 20, pending: 10, committed: 4 },
          2: { total: 40, approved: 4, pending: 10, committed: 4 },
          3: { total: 40, approved: 0, pending: 0, committed: 0 },
          4: { total: 40, approved: 0, pending: 0, committed: 0 },
        },
      }
    }
    const aggregateEntity = {
      itemId: constants.prefix.entity + entityId,
      entityId: entityId,
      companyId: companyId,
      itemData: {
        2019:
        {
          periods: 4,
          1: { total: 20, approved: 10, pending: 5, committed: 2 },
          2: { total: 20, approved: 2, pending: 5, committed: 2 },
          3: { total: 20, approved: 0, pending: 0, committed: 0 },
          4: { total: 20, approved: 0, pending: 0, committed: 0 },
        },
      }
    }
    let response = await wrapped.run(entityEventForUser4)
    expect(response.statusCode).toBe(200);
    let responseObj = JSON.parse(response.body);
    expect(responseObj).toMatchObject([entity2Budget, user4Budget, user4BudgetEntity2, aggregateEntity, aggregateCompany]);
  });

  it('listBudgets for compnay scope - admin in one entity not admin in another entity with filter compnaty, expect 200, data', async () => {
    const aggregate = {
      itemId: constants.prefix.company + companyId,
      entityId: companyId,
      companyId: companyId,
      itemData: {
        2019:
        {
          periods: 4,
          1: { total: 40, approved: 20, pending: 10, committed: 4 },
          2: { total: 40, approved: 4, pending: 10, committed: 4 },
          3: { total: 40, approved: 0, pending: 0, committed: 0 },
          4: { total: 40, approved: 0, pending: 0, committed: 0 },
        },
      }
    }
    let response = await wrapped.run(entityEventForUser4WithFilter)
    expect(response.statusCode).toBe(200);
    let responseObj = JSON.parse(response.body);
    expect(responseObj).toMatchObject([aggregate]);
  });

  it('listBudgets for entity scope not admin, expect 200, data', async () => {
    let response = await wrapped.run(entityEventNotAdmin)
    expect(response.statusCode).toBe(200);
    let responseObj = JSON.parse(response.body);
    expect(responseObj).toMatchObject([user3Budget]);
  });

  it('listBudgets, expect unauthorised', async () => {
    const response = await wrapped.run(unauthorisedEvent);
    expect(response.statusCode).toBe(403);
  });


  afterAll(async () => {
    //cleanup
    let result = await budgetsService.delete(companyBudget.entityId, companyBudget.itemId);
    expect(result).toBe(true);
    result = await budgetsService.delete(entityBudget.entityId, entityBudget.itemId);
    expect(result).toBe(true);
    result = await budgetsService.delete(entityBudget.entityId, entity2Budget.itemId);
    expect(result).toBe(true);
    result = await budgetsService.delete(user1Budget.entityId, user1Budget.itemId);
    expect(result).toBe(true);
    result = await budgetsService.delete(user1Budget.entityId, user2Budget.itemId);
    expect(result).toBe(true);
    result = await budgetsService.delete(user4Budget.entityId, user4Budget.itemId);
    expect(result).toBe(true);
    result = await budgetsService.delete(user4BudgetEntity2.entityId, user4Budget.itemId);
    expect(result).toBe(true);
    result = await budgetsService.delete(user1Budget.entityId, user3Budget.itemId);
    expect(result).toBe(true);
    result = await usersService.delete(companyAdmin.userId, companyAdmin.companyId);
    expect(result).toBe(true);
    result = await usersService.delete(entityAdmin.userId, entityAdmin.entityId);
    expect(result).toBe(true);
    result = await usersService.delete(userId4, entityId);
    expect(result).toBe(true);
    result = await usersService.delete(userId4, entityId2);
    expect(result).toBe(true);
  });

});
