"use strict";

const _ = require('lodash');
const modUsers = require("../src/users");
const modcompany = require("../src/companies");
const jestPlugin = require("serverless-jest-plugin");
const { BudgetsService, SettingsService, UsersService, constants, CompaniesService, formatterLib } = require('stoke-app-common-api');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrappedSignUp = lambdaWrapper.wrap(modcompany, { handler: "signUp" });
const wrappedGetUser = lambdaWrapper.wrap(modUsers, { handler: "getUser" });
// const authLib = require('../src/libs/auth-lib');
const budgetsService = new BudgetsService(
  process.env.budgetsTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const userData = require("../mocks/signUp-event.json");
const failedUserData = require("../mocks/failedSignUp-event.json");
const usersService = new UsersService(
  process.env.consumerAuthTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);
const companiesService = new CompaniesService(
  process.env.customersTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);
const userId = "JEST-TEST-USER-SUB-0987";
let defaultEntityId = null;
const resultCompany = {};

const budget = {
  itemId: constants.prefix.user + userId,
  createdBy: userId,
  itemData: {},
  modifiedBy: userId,
  userId
};

const cBudget = {
  createdBy: userId,
  itemData: {},
  modifiedBy: userId,
  userId
};

beforeAll(async () => {
  const response = await wrappedSignUp.run(userData);
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatch(
    userData.requestContext.identity.cognitoIdentityId
  );
  // use the returned entityId for the following tests
  const body = JSON.parse(response.body);
  userData.queryStringParameters.entityId = body.companyId;
  // use the returned userId for the following tests
  userData.body = response.body;
});

describe("signUp", () => {
  beforeAll(done => {
    done();
  });

  it("default entity was created successfully", async () => {
    const companyItems = await companiesService.list(process.env.gsiItemsByCompanyIdIndexName, userData.queryStringParameters.entityId);
    const entityItem = companyItems.find((item) => item.itemId.startsWith(constants.prefix.entity));
    expect(entityItem.itemData.entityName).toEqual(constants.defaultDepartment.entityName);
    defaultEntityId = entityItem.itemId.replace(constants.prefix.entity, '');
    const entityAdmins = await usersService.listEntityAdmins(process.env.gsiUsersByEntityIdIndexName, defaultEntityId);
    expect(entityAdmins.length).toEqual(1);
    expect(entityAdmins[0].userId).toEqual(userId);
    const settings = await settingsService.get(`${constants.prefix.entity}${defaultEntityId}`)
    expect(settings.itemData).toMatchObject({
        legalEntity: {
          displayName: `stoke ${constants.legalEntity.defaultLegalEntity.name}`,
          legalEntityName: `STOKE ${constants.legalEntity.defaultLegalEntity.name}`,
          isDefault: true,
          location: "Global",
          },
    });
  });

  it("get user details, expect 200", async () => {
    const response = await wrappedGetUser.run(userData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatch(
      userData.requestContext.identity.cognitoIdentityId
    );
    // expect(response.body).toMatch('userRole');
    expect(response.body).toMatch("userId");
    expect(response.body).toMatch("entityId");
    expect(response.body).toMatch("createdBy");
    expect(response.body).toMatch('"itemStatus":"active"');
    expect(response.body).toMatch("createdAt");
    const body = JSON.parse(response.body);
    resultCompany.companyId = body.companyId;

    const compBudget = await budgetsService.get(
      body.companyId,
      constants.prefix.company + body.companyId
    );
    expect(compBudget).toMatchObject(cBudget);
    const EXPECTED_AGGREGATED_VALUE = 28000000;
    let aggregatedAvailable = 0;
    let aggregatedTotal = 0;
    for (const year in compBudget.itemData) {
      for (const q of ['1', '2', '3', '4']) {
        aggregatedAvailable += _.get(compBudget, `itemData.${year}.${q}.available`, 0)
        aggregatedTotal += _.get(compBudget, `itemData.${year}.${q}.total`, 0)
      }
    }
    expect(aggregatedAvailable).toBe(EXPECTED_AGGREGATED_VALUE);
    expect(aggregatedTotal).toBe(EXPECTED_AGGREGATED_VALUE);

    const userBudget = await budgetsService.get(
      body.companyId,
      constants.prefix.user + userId
    );
    expect(userBudget).toMatchObject(budget);
    aggregatedAvailable = 0;
    aggregatedTotal = 0;
    for (const year in userBudget.itemData) {
      for (const q of ['1', '2', '3', '4']) {
        aggregatedAvailable += _.get(userBudget, `itemData.${year}.${q}.available`, 0)
        aggregatedTotal += _.get(userBudget, `itemData.${year}.${q}.total`, 0)
      }
    }
    expect(aggregatedAvailable).toBe(EXPECTED_AGGREGATED_VALUE);
    expect(aggregatedTotal).toBe(EXPECTED_AGGREGATED_VALUE);

    const settings = await settingsService.get(`${constants.prefix.company}${body.companyId}`)
    expect(settings.itemData).toMatchObject({
      publicPosting: false,
      domains: [
        "stokeco.com"
      ],
      legalEntities: {
        [`STOKE ${constants.legalEntity.defaultLegalEntity.name}`]: {
          legalDocs: {},
          displayName: `stoke ${constants.legalEntity.defaultLegalEntity.name}`,
          location: constants.legalEntity.defaultLegalEntity.location,
          isDefault: true
        }
      },
      automaticPayments: true,
      sendJobNotification: true,
      sendLegalDocs: true,
      sendTalentAppLink: true,
      limitedJobPostCount: 0,
      modules: {
        [constants.companyModulesTypes.sourcingTalents]: true,
        [constants.companyModulesTypes.bringYourOwnTalents]: true,
        [constants.companyModulesTypes.talentsManagement]: true,
        [constants.companyModulesTypes.compliance]: true,
        [constants.companyModulesTypes.customsSettings]: true,
        [constants.companyModulesTypes.automations]: true,
      }
    });
  });

  it("signUp, expect 500", async () => {
    const response = await wrappedSignUp.run(failedUserData);
    expect(response.statusCode).toBe(500);
  });
  
  it("signUp, existing user expect 500", async () => {
    const response = await wrappedSignUp.run(userData);
    expect(response.statusCode).toBe(500);
  });

  it("getUser, expect 500", async () => {
    const response = await wrappedGetUser.run(failedUserData);
    expect(response.statusCode).toBe(500);
  });
});

describe("UsersService", () => {
  beforeAll(done => {
    done();
  });

  it("validateUserEntity expect false", async () => {
    const params = JSON.parse(userData.body);
    const result = await usersService.validateUserEntity(
      params.userId,
      "np-such-entity"
    );
    expect(result).toBe(false);
  });

  it("validateUserEntity no params expect false", async () => {
    const result = await usersService.validateUserEntity();
    expect(result).toBe(false);
  });

  it("validateUserEntity expect true", async () => {
    const params = JSON.parse(userData.body);
    const result = await usersService.validateUserEntity(
      params.userId,
      userData.queryStringParameters.entityId
    );
    expect(result).toMatchObject({
      createdBy: userId,
      itemStatus: "active",
      modifiedBy: userId,
      userId: userId,
      itemData: {
        userRole: constants.user.role.admin
      }
    });
  });

  it("validateUserEntity users own entity expect true", async () => {
    const params = JSON.parse(userData.body);
    const result = await usersService.validateUserEntity(
      params.userId,
      params.userId
    );
    expect(result).toBeFalsy();
  });

  it("getUserEntities expect result item(s)", async () => {
    const result = await usersService.listEntities(
      userData.requestContext.identity.cognitoIdentityId
    );
    expect(result).toBeDefined();
  });

  it("failedUsersService expect null", async () => {
    const failedUsersService = new UsersService(
      "no-such-table",
      constants.projectionExpression.defaultAttributes,
      constants.attributeNames.defaultAttributes
    );
    let result = await failedUsersService.get("no-such-user");
    expect(result).toBe(null);
    result = await failedUsersService.create({ userId: "no-such-user" });
    expect(result).toBe(null);
    result = await failedUsersService.listEntities("no-such-user");
    expect(result).toBe(null);
    result = await failedUsersService.delete("no-such-user");
    expect(result).toBe(false);
  });
});
afterAll(async () => {
  await usersService.delete(
    userData.requestContext.identity.cognitoIdentityId,
    userData.queryStringParameters.entityId
  );
  await usersService.delete(userId, userId);
  await usersService.delete(userId, defaultEntityId);
  await companiesService.delete(constants.prefix.userPoolId + "username");
  await companiesService.delete(constants.prefix.company + userData.queryStringParameters.entityId);
  await settingsService.delete(`${constants.prefix.company}${resultCompany.companyId}`)
  await settingsService.delete(`${constants.prefix.user}${userId}`)
  const allBudgets = await budgetsService.listCompany(process.env.gsiItemsByCompanyIdAndItemIdIndexName, resultCompany.companyId);
  if (allBudgets) {
    for (let curBudget of allBudgets) {
      await budgetsService.delete(curBudget.entityId, curBudget.itemId);
    }
  }
});
