/* eslint-disable no-undef */
/* eslint-disable max-lines-per-function */
"use strict";

const companies = require("../src/companies");
const jestPlugin = require("serverless-jest-plugin");
const { CompaniesService, constants, BudgetsService, UsersService, SettingsService } = require("stoke-app-common-api");
const { permissionsComponentsKeys } = require("stoke-app-common-api/config/permisionConstants");

const { customersTableName, budgetsTableName, consumerAuthTableName,  } = process.env;
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const signUpToCompany = jestPlugin.lambdaWrapper.wrap(companies, { handler: "signUpToCompany" });
const userId = "JEST-TEST-SIGN-UP-TO-COMPANY";
const userName = "SIGN-UP-TO-COMPANY@stokeco.com";
const userName2 = "SIGN-UP-TO-COMPANY-2@stokeco.com";
const userName3 = "SIGN-UP-TO-COMPANY-3@stokeco.com";
const userName4 = "SIGN-UP-TO-COMPANY-4@stokeco.com";
const userName5 = "SIGN-UP-TO-COMPANY-5@stokeco.com";
const compAdminId = "JEST-TEST-SIGN-UP-TO-COMPANY-COMP-ADMIN";
const compAdminName = "JEST-TEST-SIGN-UP-TO-COMPANY-COMP-ADMIN-NAME";
const companyId = "JEST-TEST-SIGN-UP-TO-COMPANY-COMPANY-ID";
const userCreationTimeEntityId = "COMP-SIGN-UP-FIRST-ENTITY-ID-1";
const userCreationTimeEntityId2 = "COMP-SIGN-UP-FIRST-ENTITY-ID-2";
const userCreationTimeTeams = [
  "Content",
  "Marketing",
];

const invitingCompAdmin = {
  userId: "invitingCompAdmin",
  entityId: companyId,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: { userRole: constants.user.role.admin, isEditor: true }
};

const permissionsComponents1 = {
  [permissionsComponentsKeys.talents]: { isEditor: true },
  [permissionsComponentsKeys.jobs]: { isEditor: true },
  [permissionsComponentsKeys.budget]: { isEditor: true },
  [permissionsComponentsKeys.po]: { isEditor: true },
  [permissionsComponentsKeys.funding]: { isEditor: true },
  [permissionsComponentsKeys.billing]: { isEditor: true },
  [permissionsComponentsKeys.users]: { isEditor: true },
  [permissionsComponentsKeys.workspaces]: { isEditor: true },
  [permissionsComponentsKeys.legal]: { isEditor: true },
  [permissionsComponentsKeys.jobsCustomField]: { isEditor: true },
  [permissionsComponentsKeys.talentsCustomField]: { isEditor: true },
  [permissionsComponentsKeys.integrations]: { isEditor: true },
  [permissionsComponentsKeys.workflows]: { isEditor: true },
  [permissionsComponentsKeys.advancedSettings]: { isEditor: true }
}

const NotValidWorkspaceScopePermissionsComponents = {
  [permissionsComponentsKeys.talents]: { isEditor: true },
  [permissionsComponentsKeys.jobs]: { isEditor: true },
  [permissionsComponentsKeys.budget]: { isEditor: true },
  [permissionsComponentsKeys.po]: { isEditor: true },
  [permissionsComponentsKeys.funding]: { isEditor: true },
  [permissionsComponentsKeys.billing]: { isEditor: true },
  [permissionsComponentsKeys.users]: { isEditor: true },
  [permissionsComponentsKeys.workspaces]: { isEditor: true },
  [permissionsComponentsKeys.legal]: { isEditor: true },
  [permissionsComponentsKeys.jobsCustomField]: { isEditor: true },
  [permissionsComponentsKeys.talentsCustomField]: { isEditor: true },
  [permissionsComponentsKeys.integrations]: { isEditor: true },
  [permissionsComponentsKeys.workflows]: { isEditor: true },
  [permissionsComponentsKeys.advancedSettings]: { isEditor: true }
}


const notValidPermissionsComponents = {
  'Stam_component': { isEditor: false}
}


const budget = {
  itemId: constants.prefix.user + userId,
  companyId,
  createdBy: userId,
  itemData: {},
  entityId: userCreationTimeEntityId,
  modifiedBy: userId,
  userId
};

const userItem = {
  companyId,
  itemId: constants.prefix.userPoolId + userName,
  itemStatus: constants.user.status.invited,
  itemData: {
    userCreationTimeEntityId,
    userCreationTimeTeams,
  },
  createdBy: invitingCompAdmin.userId
};

const userItem2 = {
  companyId,
  itemId: constants.prefix.userPoolId + userName2,
  itemStatus: constants.user.status.invited,
  itemData: {
    userCreationTimeEntityId: [userCreationTimeEntityId, userCreationTimeEntityId2],
    userCreationTimeTeams,
  },
  createdBy: invitingCompAdmin.userId
};

const userItem3 = {
  companyId,
  itemId: constants.prefix.userPoolId + userName3,
  itemStatus: constants.user.status.invited,
  itemData: {
    userCreationTimeEntityId: [userCreationTimeEntityId, userCreationTimeEntityId2],
    userCreationTimeTeams,
    permissionsComponents: notValidPermissionsComponents,
  },
  createdBy: invitingCompAdmin.userId
};

const userItem4 = {
  companyId,
  itemId: constants.prefix.userPoolId + userName4,
  itemStatus: constants.user.status.invited,
  itemData: {
    userCreationTimeEntityId: [companyId],
    isCompanyAdmin: true,
    role: constants.user.role.admin,
    permissionsComponents: permissionsComponents1,
  },
  createdBy: invitingCompAdmin.userId
};

const userItem5 = {
  companyId,
  itemId: constants.prefix.userPoolId + userName5,
  itemStatus: constants.user.status.invited,
  itemData: {
    userCreationTimeEntityId: [companyId],
    permissionsComponents: notValidPermissionsComponents,
  },
  createdBy: invitingCompAdmin.userId
};

const compAdminItem = {
  companyId,
  itemId: constants.prefix.userPoolId + compAdminName,
  itemStatus: constants.user.status.invited,
  itemData: {
    isCompanyAdmin: true
  },
  createdBy: invitingCompAdmin.userId
};

const ENTITY2 = 'ENT2';
const ENTITY3 = 'ENT3';
const TEAM1 = 'TeamNumber1';
const TEAM2 = 'TeamNumber2';

describe("signUpToCompany", () => {
  beforeAll(async () => {
    let response = await companiesService.create(userItem);
    expect(response.itemId).toBe(userItem.itemId);
    response = await companiesService.create(userItem2);
    expect(response.itemId).toBe(userItem2.itemId);
    response = await companiesService.create(userItem3);
    expect(response.itemId).toBe(userItem3.itemId);
    response = await companiesService.create(userItem4);
    expect(response.itemId).toBe(userItem4.itemId);
    response = await companiesService.create(userItem5);
    expect(response.itemId).toBe(userItem5.itemId);
    response = await companiesService.create(compAdminItem);
    expect(response.itemId).toBe(compAdminItem.itemId);
    response = await companiesService.create({ itemId: `${constants.prefix.entity}${userCreationTimeEntityId}` });
    expect(response.itemId).toBe(`${constants.prefix.entity}${userCreationTimeEntityId}`, companyId );
    response = await companiesService.create({ itemId: `${constants.prefix.entity}${userCreationTimeEntityId2}` });
    expect(response.itemId).toBe(`${constants.prefix.entity}${userCreationTimeEntityId2}`, companyId );
    response = await companiesService.create({ itemId: `${constants.prefix.entity}${ENTITY2}`, companyId, tags: { "__stoke__teams": [TEAM1] } });
    expect(response.itemId).toBe(`${constants.prefix.entity}${ENTITY2}`);
    response = await companiesService.create({ itemId: `${constants.prefix.entity}${ENTITY3}`, companyId, tags: { "__stoke__teams": [TEAM2] } });
    expect(response.itemId).toBe(`${constants.prefix.entity}${ENTITY3}`);
    response = await usersService.create(invitingCompAdmin);
    expect(response.userId).toBe(invitingCompAdmin.userId);
  });

  it("update user, expect 200, and test data", async () => {
    const updateUserEvent = {
      requestContext: {
        identity: {
          cognitoIdentityId: userId,
          cognitoAuthenticationProvider: "JEST-TEST-USER-DELETE-USER:" + userName
        }
      }
    };    
    let response = await signUpToCompany.run(updateUserEvent);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      modifiedBy: userId,
      userId,
      itemStatus: "active",
      itemData: {
        userCreationTimeEntityId,
      }
    });

    const userBudget = await budgetsService.get(
      userCreationTimeEntityId,
      constants.prefix.user + userId
    );
    expect(userBudget).toMatchObject(budget);

    const userAuthItem = await usersService.get(userId, userCreationTimeEntityId);
    expect(userAuthItem).toMatchObject({
      companyId,
      createdBy: userId,
      entityId: userCreationTimeEntityId,
      itemData: {
        userRole: "user",
      },
      itemStatus: "active",
      modifiedBy: userId,
      userId,
      tags: {
        [constants.tags.teams]: ['Content', 'Marketing'],
      }
    });

    const userSetting = await settingsService.get(`user_${userId}`)
    expect(userSetting.itemData.list.talentDirectory).toMatchObject({ '__stoke__favoriteTalents': { listData: {}, displayName: 'Favorite' } });
  });

  it("update user custom role, expect 200, and test data", async () => {
    const updateUserEvent = {
      requestContext: {
        identity: {
          cognitoIdentityId: userId,
          cognitoAuthenticationProvider: "JEST-TEST-USER-DELETE-USER:" + userName4
        }
      }
    };    
    let response = await signUpToCompany.run(updateUserEvent);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      modifiedBy: userId,
      userId,
      itemStatus: "active",
      itemData: {
        userCreationTimeEntityId: [companyId],
        role: constants.user.role.admin,
        permissionsComponents: permissionsComponents1,
      }
    });

  });

  it("update user multiple userCreationTimeEntityId, expect 200, and test data", async () => {
    const updateUserEvent = {
      requestContext: {
        identity: {
          cognitoIdentityId: userId,
          cognitoAuthenticationProvider: "JEST-TEST-USER-DELETE-USER:" + userName2
        }
      }
    };    

    let response = await signUpToCompany.run(updateUserEvent);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      modifiedBy: userId,
      userId,
      itemStatus: "active",
      itemData: {
        userCreationTimeEntityId: [userCreationTimeEntityId, userCreationTimeEntityId2],
      }
    });

    const userBudget = await budgetsService.get(
      userCreationTimeEntityId,
      constants.prefix.user + userId
    );
    expect(userBudget).toMatchObject(budget);

    const userAuthItem1 = await usersService.get(userId, userCreationTimeEntityId);
    expect(userAuthItem1).toMatchObject({
      companyId,
      createdBy: userId,
      entityId: userCreationTimeEntityId,
      itemData: {
        userRole: "user",
      },
      itemStatus: "active",
      modifiedBy: userId,
      userId,
      tags: {
        [constants.tags.teams]: [],
      }
    });

    const userAuthItem2 = await usersService.get(userId, userCreationTimeEntityId2);
    expect(userAuthItem2).toMatchObject({
      companyId,
      createdBy: userId,
      entityId: userCreationTimeEntityId2,
      itemData: {
        userRole: "user",
      },
      itemStatus: "active",
      modifiedBy: userId,
      userId,
      tags: {
        [constants.tags.teams]: [],
      }
    });    
  });

  it("sign up user with no valid permissions components, expect 500", async () => {
    const updateUserEvent = {
      requestContext: {
        identity: {
          cognitoIdentityId: userId,
          cognitoAuthenticationProvider: "JEST-TEST-USER-DELETE-USER:" + userName3
        }
      }
    };    

    let response = await signUpToCompany.run(updateUserEvent);
    expect(response.statusCode).toBe(500);   
  });

  it("sign up user with no valid permissions components for scope, expect 500", async () => {
    const updateUserEvent = {
      requestContext: {
        identity: {
          cognitoIdentityId: userId,
          cognitoAuthenticationProvider: "JEST-TEST-USER-DELETE-USER:" + userName5
        }
      }
    };    

    let response = await signUpToCompany.run(updateUserEvent);
    expect(response.statusCode).toBe(500);   
  });

  it("sign up user with inviting user having lower components for scope, expect 500", async () => {
    const updateUserEvent = {
      requestContext: {
        identity: {
          cognitoIdentityId: userId,
          cognitoAuthenticationProvider: "JEST-TEST-USER-DELETE-USER:" + userName5
        }
      }
    };    

    let response = await signUpToCompany.run(updateUserEvent);
    expect(response.statusCode).toBe(500);   
  });

  it("sign up company admin to existing company, expect success", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: compAdminId,
          cognitoAuthenticationProvider: "JEST-TEST-USER-DELETE-USER:" + compAdminName
        }
      }
    };
    let response = await signUpToCompany.run(event);
    expect(response.statusCode).toBe(200);
    const userAuthItems = await usersService.listEntities(compAdminId, companyId);
    expect(userAuthItems).toMatchObject([
      {
          "companyId": companyId,
          "createdBy": "JEST-TEST-SIGN-UP-TO-COMPANY-COMP-ADMIN",
          "entityId": ENTITY2,
          "itemData": {
              "userRole": "admin"
          },
          "itemStatus": "active",
          "modifiedBy": "JEST-TEST-SIGN-UP-TO-COMPANY-COMP-ADMIN",
          "userId": "JEST-TEST-SIGN-UP-TO-COMPANY-COMP-ADMIN"
      },
      {
          "companyId": companyId,
          "createdBy": "JEST-TEST-SIGN-UP-TO-COMPANY-COMP-ADMIN",
          "entityId": ENTITY3,
          "itemData": {
              "userRole": "admin"
          },
          "itemStatus": "active",
          "modifiedBy": "JEST-TEST-SIGN-UP-TO-COMPANY-COMP-ADMIN",
          "userId": "JEST-TEST-SIGN-UP-TO-COMPANY-COMP-ADMIN"
      }
  ]);
  });

  it("Text new company admin gets all company teams", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: "invitingCompAdmin",
          cognitoAuthenticationProvider: "JEST-TEST-USER-DELETE-USER:" + compAdminName
        }
      }
    };
    let response = await signUpToCompany.run(event);
    expect(response.statusCode).toBe(200);
    const user2 = await usersService.get(invitingCompAdmin.userId, ENTITY2)
    expect(user2.tags.__stoke__teams).toMatchObject([TEAM1])
    const user3 = await usersService.get(invitingCompAdmin.userId, ENTITY3)
    expect(user3.tags.__stoke__teams).toMatchObject([TEAM2])
  })

  afterAll(async () => {
    await companiesService.delete(constants.prefix.userPoolId + userName);
    await companiesService.delete(constants.prefix.userPoolId + userName2);
    await companiesService.delete(constants.prefix.userPoolId + userName3);
    await companiesService.delete(constants.prefix.userPoolId + userName4);
    await companiesService.delete(constants.prefix.userPoolId + userName5);
    await companiesService.delete(constants.prefix.userPoolId + compAdminName);
    await companiesService.delete(`${constants.prefix.entity}${userCreationTimeEntityId}`);
    await companiesService.delete(`${constants.prefix.entity}${userCreationTimeEntityId2}`);
    await companiesService.delete(`${constants.prefix.entity}ENT2`);
    await companiesService.delete(`${constants.prefix.entity}ENT3`);
    await usersService.delete(userId, userCreationTimeEntityId);
    await usersService.delete(userId, userCreationTimeEntityId2);
    await usersService.delete(invitingCompAdmin.userId, invitingCompAdmin.entityId);
    await budgetsService.delete(companyId, constants.prefix.user + userId);
    await settingsService.delete(`${constants.prefix.user}${userId}`);
    await settingsService.delete(`${constants.prefix.user}${invitingCompAdmin.userId}`);
    await settingsService.delete(`${constants.prefix.user}${compAdminId}`);
  });
});
