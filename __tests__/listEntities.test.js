"use strict";

const _ = require('lodash');

const mod = require("../src/entities");
const {
  CompaniesService,
  UsersService,
  constants,
  teamsService,
  permisionConstants,
} = require("stoke-app-common-api");
const companiesService = new CompaniesService(
  process.env.customersTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);
const usersService = new UsersService(
  process.env.consumerAuthTableName,
  constants.projectionExpression.defaultAndTagsAttributes,
  constants.attributeNames.defaultAttributes
);
const jestPlugin = require("serverless-jest-plugin");
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: "listEntities" });

const companyId = "JEST-TEST-LIST-ENTITIES-COMP";
const entityId1 = "JEST-TEST-LIST-ENTITIES-ENTITY1";
const entityId2 = "JEST-TEST-LIST-ENTITIES-ENTITY2";
const entityId3 = "JEST-TEST-LIST-ENTITIES-ENTITY3";
const userIdAdmin = "JEST-TEST-LIST-ENTITIES-USER-ADMIN";
const userId = "JEST-TEST-LIST-ENTITIES-USER";

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
      [permisionConstants.permissionsComponentsKeys.workspaces]: {},
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
    userRole: constants.user.role.user
  }
};

const userInEntity1 = {
  userId,
  entityId: entityId1,
  companyId,
  createdBy: userId,
  modifiedBy: userId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user
  }
};

const userInEntity2 = {
  userId,
  entityId: entityId2,
  companyId,
  createdBy: userId,
  modifiedBy: userId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true,
  }
};
teamsService.set(userInEntity2, ['Content']);


const entity1InCompany = {
  companyId,
  itemId: constants.prefix.entity + entityId1,
  userId: userIdAdmin,
  itemData: {
    entityName: "Test1"
  }
};

const entity2InCompany = {
  companyId,
  itemId: constants.prefix.entity + entityId2,
  userId: userIdAdmin,
  itemData: {
    entityName: "Test2"
  }
};
teamsService.set(entity2InCompany, ['Content', 'Marketing']);

const entity3InCompany = {
  companyId,
  itemId: constants.prefix.entity + entityId3,
  userId: userIdAdmin,
  itemData: {
    entityName: "Test3"
  }
};

const eventAdmin = {
  body: "{}",
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
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  pathParameters: {
    id: companyId
  }
};

const eventUnAuthorised = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: userIdAdmin + "unauthorised"
    }
  },
  pathParameters: {
    id: companyId
  }
};

describe("listEntities", () => {
  beforeAll(async () => {
    let result = await companiesService.create(entity1InCompany);
    expect(result.itemId).toBe(entity1InCompany.itemId);
    result = await companiesService.create(entity2InCompany);
    expect(result.itemId).toBe(entity2InCompany.itemId);
    result = await companiesService.create(entity3InCompany);
    expect(result.itemId).toBe(entity3InCompany.itemId);
    result = await usersService.create(userAdmin);
    expect(result.userId).toBe(userIdAdmin);
    // result = await usersService.create(user);
    // expect(result.userId).toBe(userId);
    result = await usersService.create(userInEntity1);
    expect(result.userId).toBe(userId);
    result = await usersService.create(userInEntity2);
    expect(result.userId).toBe(userId);
  });

  it("listEntities for admin, expect 200, data", async () => {
    const response = await wrapped.run(eventAdmin);
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.length).toBe(3);
    const [entity2] = data.filter((entity) => entity.itemData.entityName === 'Test2');
    const entityTeams = teamsService.get(entity2);
    expect(entityTeams).toEqual(['Content', 'Marketing']);
    const manager = _.get(entity2, ['tags', constants.tags.teamsAdmins]);
    expect(manager).toEqual([['JEST-TEST-LIST-ENTITIES-USER'], []]);
  });

  it("listEntities, expect 200, data", async () => {
    const response = await wrapped.run(event);
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.length).toBe(2);
    const [entity2] = data.filter((entity) => entity.itemData.entityName === 'Test2');
    const entityTeams = teamsService.get(entity2);
    expect(entityTeams).toEqual(['Content']);
  });

  it("listEntities, expect unauthorised", async () => {
    const response = await wrapped.run(eventUnAuthorised);
    expect(response.statusCode).toBe(403);
  });

  afterAll(async () => {
    //cleanup
    let result = await companiesService.delete(
      constants.prefix.entity + entityId1
    );
    expect(result).toBe(true);
    result = await companiesService.delete(constants.prefix.entity + entityId2);
    expect(result).toBe(true);
    result = await companiesService.delete(constants.prefix.entity + entityId3);
    expect(result).toBe(true);
    result = await usersService.delete(userId, companyId);
    expect(result).toBe(true);
    result = await usersService.delete(userId, entityId1);
    expect(result).toBe(true);
    result = await usersService.delete(userId, entityId2);
    expect(result).toBe(true);
    result = await usersService.delete(userIdAdmin, companyId);
    expect(result).toBe(true);
  });
});
