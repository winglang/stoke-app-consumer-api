/* eslint-disable max-lines-per-function */
/* eslint-disable no-undef */
"use strict";
// tests for listEntities

const mod = require("../../src/entities");
const {
  CompaniesService,
  UsersService,
  BudgetsService,
  SettingsService,
  constants,
  permisionConstants
} = require("stoke-app-common-api");
const companiesService = new CompaniesService(
  process.env.customersTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);
const usersService = new UsersService(
  process.env.consumerAuthTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);

const budgetsService = new BudgetsService(
  process.env.budgetsTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);

const settingsService = new SettingsService(
  process.env.settingsTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);

const jestPlugin = require("serverless-jest-plugin");
const { permissionsComponentsKeys } = require("stoke-app-common-api/config/permisionConstants");
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: "createEntity" });

const companyId = "JEST-TEST-CREATE-ENTITY-COMP";
const userIdAdmin = "JEST-TEST-CREATE-ENTITY-USER-ADMIN";
const userIdAdmin2 = "JEST-TEST-CREATE-ENTITY-USER-ADMIN-2";
const userIdAdmin3 = "JEST-TEST-CREATE-ENTITY-USER-ADMIN-3";

const userId = "JEST-TEST-CREATE-ENTITY-USER";

const budget = {
  companyId,
  createdBy: userIdAdmin,
  itemData: {},
  modifiedBy: userIdAdmin,
  userId: userIdAdmin
};

const userAdmin = {
  userId: userIdAdmin,
  entityId: companyId,
  companyId,
  createdBy: userIdAdmin,
  modifiedBy: userIdAdmin,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    permissionsComponents: {
      [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: true },
    }
  }
};

const userAdmin2 = {
  userId: userIdAdmin2,
  entityId: companyId,
  companyId,
  createdBy: userIdAdmin2,
  modifiedBy: userIdAdmin2,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin, isEditor: true
  }
};

const userAdmin3 = {
  userId: userIdAdmin3,
  entityId: companyId,
  companyId,
  createdBy: userIdAdmin3,
  modifiedBy: userIdAdmin3,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin, isEditor: true,
    permissionsComponents: {
      [permissionsComponentsKeys.jobs]: { isEditor: false },
    }  
  }
};

const user = {
  userId,
  entityId: companyId,
  companyId,
  createdBy: userId,
  modifiedBy: userId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user, isEditor: true
  }
};

const eventBody = {
  entityName: "Department 1"
};

const eventAdmin = {
  body: JSON.stringify(eventBody),
  requestContext: {
    identity: {
      cognitoIdentityId: userIdAdmin
    }
  },
  pathParameters: {
    id: companyId
  }
};

const event = {
  body: JSON.stringify(eventBody),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  pathParameters: {
    id: companyId
  }
};

const entityCreated = {};

describe("createeEntity", () => {
  beforeAll(async () => {
    let result = await usersService.create(userAdmin);
    expect(result.userId).toBe(userIdAdmin);
    result = await usersService.create(userAdmin2);
    expect(result.userId).toBe(userIdAdmin2);
    result = await usersService.create(userAdmin3);
    expect(result.userId).toBe(userIdAdmin3);
    result = await usersService.create(user);
    expect(result.userId).toBe(userId);
  });

  it("createeEntity for admin, expect 200, data", async () => {
    let response = await wrapped.run(eventAdmin);
    expect(response.statusCode).toBe(200);
    let body = JSON.parse(response.body);
    expect(body.itemId).toContain('DEPARTMENT');
    entityCreated.itemId = body.itemId;
    const userBudget = await budgetsService.get(entityCreated.itemId.substr(constants.prefix.entity.length), entityCreated.itemId);
    expect(userBudget).toMatchObject({ ...budget, entityId: entityCreated.itemId.substr(constants.prefix.entity.length) });
    const authAdmin = await usersService.get(userIdAdmin, entityCreated.itemId.substr(constants.prefix.entity.length))
    expect(authAdmin).toMatchObject({
      companyId,
      createdBy: userIdAdmin,
      itemData: { userRole: 'admin' },
      itemStatus: 'active',
      entityId: entityCreated.itemId.substr(constants.prefix.entity.length),
      modifiedBy: userIdAdmin,
      userId: userIdAdmin
    })
    const authAdmin2 = await usersService.get(userIdAdmin2, entityCreated.itemId.substr(constants.prefix.entity.length))
    expect(authAdmin2).toMatchObject({
      companyId,
      createdBy: userIdAdmin,
      itemData: { userRole: 'admin', isEditor: true },
      itemStatus: 'active',
      entityId: entityCreated.itemId.substr(constants.prefix.entity.length),
      modifiedBy: userIdAdmin,
      userId: userIdAdmin2
    })

    const authAdmin3 = await usersService.get(userIdAdmin3, entityCreated.itemId.substr(constants.prefix.entity.length))
    expect(authAdmin3).toMatchObject({
      companyId,
      createdBy: userIdAdmin,
      itemData: { userRole: 'admin', isEditor: true, permissionsComponents: {
        [permissionsComponentsKeys.jobs]: { isEditor: false },
        }
       },
      itemStatus: 'active',
      entityId: entityCreated.itemId.substr(constants.prefix.entity.length),
      modifiedBy: userIdAdmin,
      userId: userIdAdmin3
    })

    const settings = await settingsService.get(entityCreated.itemId);
    expect(settings).toBeTruthy();
    expect(settings.itemData).toMatchObject({});

    const userInEntity = await usersService.get(userId, entityCreated.itemId.substr(constants.prefix.entity.length))
    expect(userInEntity).toBeUndefined();
    await usersService.update({
      userId: userAdmin.userId, entityId: userAdmin.entityId, modifiedBy: userAdmin.userId, itemData: {
        userRole: constants.user.role.admin,
        isEditor: false
      }
    })
    response = await wrapped.run(eventAdmin);
    expect(response.statusCode).toBe(403);
    await usersService.update({
      userId: userAdmin.userId, entityId: userAdmin.entityId, modifiedBy: userAdmin.userId, itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
      }
    })
  });


  it("create entity with already existing entity name, expect 403", async () => {
    let response = await wrapped.run(eventAdmin);
    expect(response.statusCode).toBe(403);
  })


  it("createeEntity , expect 403", () => {
    return wrapped.run(event).then(response => {
      expect(response.statusCode).toBe(403);
    });
  });

  afterAll(async () => {
    //cleanup
    let result = await companiesService.delete(entityCreated.itemId);
    result = await usersService.delete(userId, companyId);
    expect(result).toBe(true);
    result = await usersService.delete(userIdAdmin, companyId);
    expect(result).toBe(true);
    const allBudgets = await budgetsService.listCompany(
      process.env.gsiItemsByCompanyIdAndItemIdIndexName,
      companyId
    );
    for (let curBudget of allBudgets) {
      result = await budgetsService.delete(
        curBudget.entityId,
        curBudget.itemId
      );
      expect(result).toBe(true);
    }
    result = await usersService.delete(userIdAdmin, entityCreated.itemId.substr(constants.prefix.entity.length));
    expect(result).toBe(true);
    result = await usersService.delete(userIdAdmin2, entityCreated.itemId.substr(constants.prefix.entity.length));
    expect(result).toBe(true);
  });
});
