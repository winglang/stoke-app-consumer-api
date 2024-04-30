"use strict";



const companies = require("../src/companies");
const jestPlugin = require("serverless-jest-plugin");
const { SettingsService, CompaniesService, UsersService, constants, snsLib, permisionConstants } = require("stoke-app-common-api");
jest.mock('stoke-app-common-api/service/sqsService');
jest.mock('stoke-app-common-api/lib/snsLib');

const { customersTableName, 
        consumerAuthTableName,
        settingsTableName } = process.env;

const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes); 
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const addUserToCompany = jestPlugin.lambdaWrapper.wrap(companies, { handler: "addUserToCompany" });
const externalDomainsList = ['firstexternal.com', 'secondexternal.com']

const userId = "JEST-TEST-ADD-USER-TO-COMPANY";
const userIdAdmin = "JEST-TEST-ADD-USER-TO-COMPANY-ADMIN";
const userIdAdmin2 = "JEST-TEST-ADD-USER-TO-COMPANY-ADMIN2";
const userIdAdminCustom = "JEST-TEST-ADD-USER-TO-COMPANY-ADMIN-CUSTOM-ROLE";
const companyId = "JEST-TEST-ADD-USER-TO-COMPANY-COMPANY";
const userName = "joe@stokeco.com";
const newUserName = "new@stokeco.com";
const newUserEmail = "new@stokeco.com ";
const userCreationTimeEntityId = "JEST-TEST-ADD-USER-TO-FIRST-ENTITY";
const userCreationTimeEntityId2 = "JEST-TEST-ADD-USER-TO-FIRST-ENTITY-2";
const userCreationTimeEntityIdCompanyAdmin = companyId;
const ssoUserEmailName = 'The.Boss'
const createdEntity = {};

const snsLibSpy = jest.spyOn(snsLib, 'publish');

const invitorUserAdmin = {
  userId: userId,
  entityId: userCreationTimeEntityId,
  companyId: companyId,
  createdBy: userIdAdmin,
  modifiedBy: userIdAdmin,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true,
  }
}

const userAdmin = {
  userId: userIdAdmin,
  entityId: userCreationTimeEntityId,
  companyId: companyId,
  createdBy: userIdAdmin,
  modifiedBy: userIdAdmin,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true,
  }
};

const userAdmin2 = {
  userId: userIdAdmin2,
  entityId: companyId,
  companyId: companyId,
  createdBy: userIdAdmin2,
  modifiedBy: userIdAdmin2,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true
  }
};

const userInCompany = {
  companyId,
  itemId: userName,
  userId: userIdAdmin,
  itemData: {
    givenName: "admin",
    familyName: "admin",
    role: constants.user.role.admin
  }
};

const userAdminCustomRole = {
  userId: userIdAdminCustom,
  entityId: userCreationTimeEntityIdCompanyAdmin,
  companyId: companyId,
  createdBy: userIdAdmin,
  modifiedBy: userIdAdmin,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true,
    permissionsComponents: {
      [permisionConstants.permissionsComponentsKeys.users]: { isEditor: false },
      [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: false },
      [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: false },
      [permisionConstants.permissionsComponentsKeys.workflows]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.talentsCustomField]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.jobsCustomField]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.po]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.legal]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.billing]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.integrations]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.funding]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.advancedSettings]: { isEditor: true },
    }
  }
};

const newUserToCompanyEvent = {
  body: JSON.stringify({
    companyId,
    userCreationTimeEntityId,
    givenName: "givenName",
    familyName: "familyName",
    userEmail: newUserEmail,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userIdAdmin
    }
  }
};

const newUserToCompanyEventViaSsoRegistration = {
  body: JSON.stringify({
    companyId,
    userCreationTimeEntityId,
    givenName: "givenName",
    familyName: "familyName",
    userEmail: `${ssoUserEmailName}@${externalDomainsList[0]}`,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userIdAdmin
    }
  }
};


const newUserToCompanyEventCompanyAdmin = {
  body: JSON.stringify({
    companyId,
    userCreationTimeEntityId: userCreationTimeEntityIdCompanyAdmin,
    givenName: "givenName",
    familyName: "familyName",
    userEmail: newUserEmail,
    createdBy: userIdAdmin,
    modifiedBy: userIdAdmin,
    itemStatus: constants.user.status.active
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userIdAdmin
    }
  }
};

const newUserToCompanyEventMultiCreationTimeEntity = {
  body: JSON.stringify({
    companyId,
    userCreationTimeEntityId: [userCreationTimeEntityId, userCreationTimeEntityId2],
    givenName: "givenName",
    familyName: "familyName",
    userEmail: newUserEmail,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userIdAdmin2
    }
  }
};

const newUserToCompanyEventNotAuth = {
  body: JSON.stringify({
    companyId,
    userCreationTimeEntityId: userCreationTimeEntityId2,
    itemId: newUserName,
    givenName: "givenName",
    familyName: "familyName",
    userEmail: newUserEmail,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  }
};

const newUserToCompanyEventMissingCompanyId = {
  body: JSON.stringify({
    itemId: newUserName,
    givenName: "givenName",
    familyName: "familyName",
    userEmail: newUserEmail,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  }
};

const basicCompanySettings = {
  itemId: `${constants.prefix.company}${companyId}`,
  itemData: {
      jobRequestApproval: {
        enabled: true,
        jobRequestLevels: [],
      }
  }
};

const newUserEventCustomRoleNotValidCustomPermissions = {
  body: JSON.stringify({
    companyId,
    userCreationTimeEntityId: userCreationTimeEntityIdCompanyAdmin,
    itemId: newUserName,
    givenName: "givenName",
    familyName: "familyName",
    userEmail: `stam-${newUserEmail}`,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    permissionsComponents: {
      'Stam_component': { isEditor: true },
    }
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userIdAdminCustom
    }
  }
};

const newUserEventCustomRoleNotValidTryToInviteSomeoneWithHigherPermissions = {
  body: JSON.stringify({
    companyId,
    userCreationTimeEntityId: userCreationTimeEntityIdCompanyAdmin,
    itemId: newUserName,
    givenName: "givenName",
    familyName: "familyName",
    userEmail: `stam-${newUserEmail}`,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    role: constants.user.role.admin, 
    permissionsComponents: {
      [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: false },
      [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: false },
      [permisionConstants.permissionsComponentsKeys.workflows]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.talentsCustomField]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.jobsCustomField]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.po]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.legal]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.billing]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.integrations]: { isEditor: true },
      [permisionConstants.permissionsComponentsKeys.funding]: { isEditor: true },
    }
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  }
};

// eslint-disable-next-line max-lines-per-function
describe("addUserToCompany", () => {
  beforeAll(async () => {
    expect(process.env.PARAM_NAME_INVITATIONID_PASS).toBeTruthy();
    expect(process.env.PARAM_NAME_INVITATIONID_SALT).toBeTruthy();
    let response = await companiesService.create(userInCompany);
    expect(response.userId).toBe(userIdAdmin);
    response = await usersService.create(invitorUserAdmin);
    expect(response.userId).toBe(userId);
    response = await usersService.create(userAdmin);
    expect(response.userId).toBe(userIdAdmin);
    response = await usersService.create(userAdmin2);
    expect(response.userId).toBe(userIdAdmin2);
    response = await usersService.create(userAdminCustomRole);
    expect(response.userId).toBe(userIdAdminCustom);
    response = await companiesService.create({ itemId: `${constants.prefix.entity}${userCreationTimeEntityId}` });
    expect(response.itemId).toBe(`${constants.prefix.entity}${userCreationTimeEntityId}`);
    response = await companiesService.create({ itemId: `${constants.prefix.entity}${userCreationTimeEntityId2}` });
    expect(response.itemId).toBe(`${constants.prefix.entity}${userCreationTimeEntityId2}`);
  });

  it("add users, expect 200, and test data", async () => {
    let response = await addUserToCompany.run(newUserToCompanyEvent);
    expect(response.statusCode).toBe(200);
    response = await companiesService.get(
      constants.prefix.userPoolId + "givenNamefamilyName"
    );
    expect(response).toMatchObject({
      createdBy: userIdAdmin,
      itemData: {
        givenName: "givenName",
        familyName: "familyName",
        userEmail: newUserEmail.trim(),
        userCreationTimeEntityId
      },
      itemStatus: "invited",
      companyId,
      modifiedBy: userIdAdmin
    });
    response = await addUserToCompany.run(newUserToCompanyEvent);
    expect(response.statusCode).toBe(200);
  });

  it("add users, expect 403, user not allowed ,is not editor", async () => {
    let response = await addUserToCompany.run(newUserToCompanyEvent);
    expect(response.statusCode).toBe(200);
    response = await companiesService.get(
      constants.prefix.userPoolId + "givenNamefamilyName"
    );
    expect(response).toMatchObject({
      createdBy: userIdAdmin,
      itemData: {
        givenName: "givenName",
        familyName: "familyName",
        userEmail: newUserEmail.trim(),
        userCreationTimeEntityId
      },
      itemStatus: "invited",
      companyId,
      modifiedBy: userIdAdmin
    });
    await usersService.update({ userId: userAdmin.userId, entityId: userAdmin.entityId, modifiedBy: userAdmin.userId, itemData: {
      userRole: constants.user.role.admin,
      isEditor: false
    }}) 
    response = await addUserToCompany.run(newUserToCompanyEvent);
    expect(response.statusCode).toBe(202);
  });

  it("add users, expect 202, user with permissions components and allowed users and workspaces permissions", async () => {
    let response = await usersService.update({ userId: userAdmin.userId, entityId: userAdmin.entityId, modifiedBy: userAdmin.userId, itemData: {
      userRole: constants.user.role.admin,
      isEditor: true,
      permissionsComponents: {
        [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.workflows]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.talentsCustomField]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.jobsCustomField]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.po]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.legal]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.billing]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.integrations]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.funding]: { isEditor: true },
      }
    }}) 
    response = await addUserToCompany.run(newUserToCompanyEvent);
    expect(response.statusCode).toBe(202);
    response = await companiesService.get(
      constants.prefix.userPoolId + "givenNamefamilyName"
    );
    expect(response).toMatchObject({
      createdBy: userIdAdmin,
      itemData: {
        givenName: "givenName",
        familyName: "familyName",
        userEmail: newUserEmail.trim(),
        userCreationTimeEntityId
      },
      itemStatus: "invited",
      companyId,
      modifiedBy: userIdAdmin
    });
  });

  it("add users, expect 403, user with permissions components and not allowed users and workspaces permissions", async () => {
    await usersService.update({ userId: userAdmin.userId, entityId: userAdmin.entityId, modifiedBy: userAdmin.userId, itemData: {
      userRole: constants.user.role.admin,
      isEditor: true,
      permissionsComponents: {
        [permisionConstants.permissionsComponentsKeys.users]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.workflows]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.talentsCustomField]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.jobsCustomField]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.po]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.legal]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.billing]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.integrations]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.funding]: { isEditor: true },
      }
    }}) 
    let response = await addUserToCompany.run(newUserToCompanyEvent);
        
    response = await addUserToCompany.run(newUserToCompanyEvent);
    expect(response.statusCode).toBe(202);
  });

  it("add users multi userCreationTimeEntityId, expect 200, and test data", async () => {
    await usersService.update({ userId: userAdmin.userId, entityId: userAdmin.entityId, modifiedBy: userAdmin.userId, itemData: {
      userRole: constants.user.role.admin,
      isEditor: true,
    }}) 
    let response = await addUserToCompany.run(newUserToCompanyEventMultiCreationTimeEntity);
    expect(response.statusCode).toBe(200);
    response = await companiesService.get(
      constants.prefix.userPoolId + "givenNamefamilyName"
    );
    expect(response).toMatchObject({
      createdBy: userIdAdmin2,
      itemData: {
        givenName: "givenName",
        familyName: "familyName",
        userEmail: newUserEmail.trim(),
        userCreationTimeEntityId: [userCreationTimeEntityId, userCreationTimeEntityId2]
      },
      itemStatus: "invited",
      companyId,
      modifiedBy: userIdAdmin2
    });
    
    response = await addUserToCompany.run(newUserToCompanyEvent);
    expect(response.statusCode).toBe(200);
  });  

  it("first entity id does not exist, expect 403", async () => {
    const event = {
      body: JSON.stringify({
        companyId,
        userCreationTimeEntityId: 'no-such-entity-id',
        itemId: newUserName,
        givenName: "givenName",
        familyName: "familyName",
        userEmail: newUserEmail,
        createdBy: userId,
        modifiedBy: userId,
        itemStatus: constants.user.status.active
      }),
      requestContext: {
        identity: {
          cognitoIdentityId: userId
        }
      }
    };
    const response = await addUserToCompany.run(event);
    expect(response.statusCode).toBe(403);
  });

  it("User not admin add user to company, expect 202", async () => {
    const response = await addUserToCompany.run(newUserToCompanyEventNotAuth);
    expect(response.statusCode).toBe(202);
  });

  it("missing company id add user to company, expect 500", async () => {
    const response = await addUserToCompany.run(
      newUserToCompanyEventMissingCompanyId
    );
    expect(response.statusCode).toBe(500);
  });

  it("add user to company - company admin", async () => {
    const response = await addUserToCompany.run(
      newUserToCompanyEventCompanyAdmin
    );
    
    expect(response.statusCode).toBe(202);
  });

  it("add custom role user to company with no valid permissions, expect 500", async () => {
    const response = await addUserToCompany.run(
      newUserEventCustomRoleNotValidCustomPermissions
    );
    
    expect(response.statusCode).toBe(500);
  });

  it("add custom role user to company with custom role, expect 500", async () => {
    const response = await addUserToCompany.run(
      newUserEventCustomRoleNotValidTryToInviteSomeoneWithHigherPermissions
    );
    
    expect(response.statusCode).toBe(500);
  });

    describe('sso registration', async () => {
      let response;
      beforeEach(async () => {
        await usersService.update({ userId: userAdmin.userId, entityId: userAdmin.entityId, modifiedBy: userAdmin.userId, itemData: {
          userRole: constants.user.role.admin, 
          isEditor: true
        }}) 
        response = await addUserToCompany.run(newUserToCompanyEventViaSsoRegistration);
        
        basicCompanySettings.itemData.allowedExternalDomains = externalDomainsList
        await settingsService.create(basicCompanySettings)
      })
      
      it('should return well response', async () => {
        expect(response).toBeDefined();
        expect(response.body).toBeDefined();
        expect(response.statusCode).toBe(200);
      })
      
      it('should keep dispatch users::addUserToCompany event via sns', async () => {
        expect(snsLibSpy).toHaveBeenCalled()
      });

      it('should create user with external sign', async () => {
        const parsedBody = JSON.parse(response.body)
        const originalUserEmail = `${ssoUserEmailName}@${externalDomainsList[0]}`
        expect(parsedBody['itemId'].includes(constants.prefix.external)).toBeDefined();
        expect(parsedBody['itemId']).toBe(`${constants.prefix.userPoolId}${constants.prefix.external}${originalUserEmail.toLowerCase()}`)
      });
    });


  afterAll(async () => {
    await companiesService.delete(userName);
    await companiesService.delete(createdEntity.itemId);
    await companiesService.delete(`${constants.prefix.userPoolId}givenNamefamilyName`);
    await companiesService.delete(`${constants.prefix.entity}${userCreationTimeEntityId}`);
    await companiesService.delete(`${constants.prefix.entity}${userCreationTimeEntityId2}`);
    await usersService.delete(userId, companyId);
    await usersService.delete(userIdAdmin, companyId);
    await usersService.delete(userIdAdminCustom, companyId);
    await usersService.delete(userIdAdmin, createdEntity.itemId.substr(constants.prefix.entity.length));
    await usersService.delete(userIdAdmin2, createdEntity.itemId.substr(constants.prefix.entity.length));
  });
});
