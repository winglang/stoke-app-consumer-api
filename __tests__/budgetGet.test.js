'use strict';

// tests for getBudget

const mod = require('../src/budgets');
const { UsersService, BudgetsService, constants, permisionConstants } = require('stoke-app-common-api');
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'getBudget' });
const userId = 'GET-BUDGET-JEST-TEST-ADMIN-ID-1'
const userIdNotAdmin = 'GET-BUDGET-JEST-TEST-NOT-ADMIN-ID-1'
const userIdNotExist = 'GET-BUDGET-JEST-TEST-NOT-EXIST-ID-1'
const entityId = 'GET-BUDGET-JEST-TEST-ENTITY-ID-1'
const companyId = 'GET-BUDGET-JEST-TEST-COMPANY-ID-1'

const adminCompany = {
  userId,
  companyId,
  entityId: companyId,
  createdBy: userId,
  modifiedBy: userId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    permissionsComponents: {
      [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: false },
    },
  }
};

const notAdminCompany = {
  userId: userIdNotAdmin,
  companyId,
  entityId: companyId,
  createdBy: userIdNotAdmin,
  modifiedBy: userIdNotAdmin,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user
  }
};

const adminEntity = {
  userId,
  companyId,
  entityId,
  createdBy: userId,
  modifiedBy: userId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const notAdminEntity = {
  userId: userIdNotAdmin,
  companyId,
  entityId,
  createdBy: userIdNotAdmin,
  modifiedBy: userIdNotAdmin,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user
  }
};

const companyBudgetItem = {
  companyId,
  entityId: companyId,
  itemId: constants.prefix.company + companyId,
  itemData: {
    2019: {
      1: {
        approved: 100000,
        committed: 20000,
        total: 500000,
        available: 500000,
        pending: 50000
      },
      periods: 4
    }
  }
}

const entityBudgetItem = {
  companyId,
  entityId,
  itemId: constants.prefix.entity + entityId,
  itemData: {
    2019: {
      1: {
        approved: 100000,
        committed: 20000,
        total: 500000,
        available: 500000,
        pending: 50000
      },
      periods: 4
    }
  }
}

const userBudgetEntityItem = {
  companyId,
  entityId,
  itemId: constants.prefix.user + userId,
  userId,
  itemData: {
    2019: {
      1: {
        approved: 100000,
        committed: 20000,
        total: 500000,
        available: 500000,
        pending: 50000
      },
      periods: 4
    }
  }
};

const userBudgetCompanyItem = {
  companyId,
  entityId: companyId,
  itemId: constants.prefix.user + userId,
  userId,
  itemData: {
    2019: {
      1: {
        approved: 100000,
        committed: 20000,
        total: 500000,
        available: 500000,
        pending: 50000
      },
      periods: 4
    }
  }
};



const companyEvent = {
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  pathParameters: {
    id: constants.prefix.company + companyId
  },
  queryStringParameters: {
    companyId
  }
};

const companyEventUnauthorized = {
  requestContext: {
    identity: {
      cognitoIdentityId: notAdminCompany
    }
  },
  pathParameters: {
    id: constants.prefix.company + companyId
  },
  queryStringParameters: {
    companyId
  }
};

const entityEvent = {
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  pathParameters: {
    id: constants.prefix.entity + entityId
  },
  queryStringParameters: {
    entityId
  }
};

const entityEventUnauthorized = {
  requestContext: {
    identity: {
      cognitoIdentityId: notAdminCompany
    }
  },
  pathParameters: {
    id: constants.prefix.entity + entityId
  },
  queryStringParameters: {
    entityId
  }
};

const userEvent = {
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  pathParameters: {
    id: constants.prefix.user + userId
  },
  queryStringParameters: {

  }
};

const userEventUnauthorized = {
  requestContext: {
    identity: {
      cognitoIdentityId: userIdNotExist
    }
  },
  pathParameters: {
    id: constants.prefix.user + userIdNotExist
  },
  queryStringParameters: {

  }
};

describe('getBudget', () => {
  beforeAll(async () => {
    // create an admin user in company
    let result = await usersService.create(adminCompany);
    expect(result.userId).toBe(userId);
    result = await usersService.create(adminEntity);
    expect(result.userId).toBe(userId);
    result = await usersService.create(notAdminCompany);
    expect(result.userId).toBe(userIdNotAdmin);
    result = await usersService.create(notAdminEntity);
    expect(result.userId).toBe(userIdNotAdmin);
    // create test budgets
    await budgetsService.create(companyBudgetItem);
    await budgetsService.create(entityBudgetItem);
    await budgetsService.create(userBudgetEntityItem);
    await budgetsService.create(userBudgetCompanyItem);
  });

  it('getBudget for company, expect 200, data', () => {
    return wrapped.run(companyEvent).then((response) => {
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject(companyBudgetItem);
    });
  });

  it('getBudget for company, expect 403', () => {
    return wrapped.run(companyEventUnauthorized).then((response) => {
      expect(response.statusCode).toBe(403);
    });
  });

  it('getBudget for entity, expect 200, data', () => {
    return wrapped.run(entityEvent).then((response) => {
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject(entityBudgetItem);
    });
  });

  it('getBudget for company, expect 403', () => {
    return wrapped.run(entityEventUnauthorized).then((response) => {
      expect(response.statusCode).toBe(403);
    });
  });

  it('getBudget for user, expect 200, data', async () => {
    userEvent.queryStringParameters.companyId = companyId
    let response = await wrapped.run(userEvent);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject(userBudgetCompanyItem);
    userEvent.queryStringParameters.companyId = entityId
    response = await wrapped.run(userEvent);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject(userBudgetEntityItem);

  });

  it('getBudget for user, expect 403', async () => {
    userEventUnauthorized.queryStringParameters.companyId = companyId
    let response = await wrapped.run(userEventUnauthorized);
    expect(response.statusCode).toBe(403);
    userEventUnauthorized.queryStringParameters.companyId = entityId;
    response = await wrapped.run(userEventUnauthorized);
    expect(response.statusCode).toBe(403);
  });

  afterAll(async () => {
    //cleanup
    let result = await usersService.delete(userId, companyId);
    expect(result).toBe(true);
    result = await usersService.delete(userId, entityId);
    expect(result).toBe(true);
    result = await usersService.delete(userIdNotAdmin, companyId);
    expect(result).toBe(true);
    result = await usersService.delete(userIdNotAdmin, entityId);
    expect(result).toBe(true);
    result = await budgetsService.delete(entityId, constants.prefix.entity + entityId);
    expect(result).toBe(true);
    result = await budgetsService.delete(entityId, constants.prefix.user + userId);
    expect(result).toBe(true);
    result = await budgetsService.delete(companyId, constants.prefix.company + companyId);
    expect(result).toBe(true);
    result = await budgetsService.delete(companyId, constants.prefix.user + userId);
    expect(result).toBe(true);
  });

});
