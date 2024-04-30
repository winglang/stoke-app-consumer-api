/* eslint-disable no-shadow */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */
/* eslint-disable max-lines-per-function */


'use strict';

const companyProviders = require("../../src/companyProviders");
const jestPlugin = require("serverless-jest-plugin");
const {
  constants,
  UsersService,
  SettingsService,
  CompanyProvidersService,
  TalentsService,
  permisionConstants
} = require("stoke-app-common-api");

const {
  companyProvidersTableName,
  consumerAuthTableName,
  talentsTableName,
  settingsTableName,
} = process.env;

const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAttributesAndExternalUserIdAndTags, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const talentsService = new TalentsService(talentsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const createCompanyProviders = jestPlugin.lambdaWrapper.wrap(companyProviders, { handler: 'createCompanyProviders' });

const compAdminId = "JEST-TEST-CREATE-COMPANY-PROVIDERS-ADMIN";
const nonAdminUserId = "JEST-TEST-CREATE-COMPANY-PROVIDERS-USER";
const entityId = "JEST-TEST-CREATE-COMPANY-PROVIDERS-ENTITY";
const companyId = "JEST-TEST-CREATE-COMPANY-PROVIDERS-CAMPANY";
const providerId = `${constants.prefix.provider}JEST-TEST-CREATE-COMPANY-PROVIDERS-PROVIDER`;
const name = "JEST-TEST-CREATE-COMPANY-PROVIDERS-NAME-1";
const providerName1 = "JEST-TEST-CREATE-COMPANY-PROVIDERS-PROVIDER-1";
const email1 = "Test@stoketalent.Com";
const name2 = "JEST-TEST-CREATE-COMPANY-PROVIDERS-NAME--2";
const providerName2 = "JEST-TEST-CREATE-COMPANY-PROVIDERS-PROVIDER-2";
const providerName3 = "JEST-TEST-CREATE-COMPANY-PROVIDERS-PROVIDER-3";
const name3 = "JEST-TEST-CREATE-COMPANY-PROVIDERS-NAME--3";
const providerName4 = "JEST-TEST-CREATE-COMPANY-PROVIDERS-PROVIDER-4";
const name4 = "JEST-TEST-CREATE-COMPANY-PROVIDERS-NAME--4";

const provider = {
  companyId,
  items: [
    {
      firstName: name,
      lastName: name,
      providerName: providerName1,
      email: email1,
      providerTags: { tag: 1 }
    },
    {
      firstName: name2,
      lastName: name2,
      providerName: providerName2,
    },
    {
      firstName: name3,
      lastName: name3,
      providerName: providerName1
    },
    {
      providerName: providerName3,
    }
  ]
};


const provider2 = {
  companyId,
  items: [
    {
      firstName: name4,
      lastName: name4,
      providerName: providerName4
    }
  ]
};

const provider3 = {
  companyId,
  itemStatus: constants.companyProvider.status.notInvited,
  items: [
    {
      email: "ida+notinvited@stoketalent.com",
      firstName: "Not",
      isProviderSelfEmployedTalent: true,
      lastName: "Invited",
      legalDocuments: [],
      providerEmail: "ida+notinvited@stoketalent.com",
      providerName: "Not Invited",
    }
  ]
};

const providerWithTalents = {
  companyId,
  itemStatus: constants.companyProvider.status.invited,
  items: [
    {
      legalDocuments: [{name: 1}, {name: 2}],
      providerEmail: "provider@stoketalent.com",
      providerName: "ProviderWithTalents",
      isProvider: true,
    },
    {
      email: "talent1@stoketalent.com",
      firstName: "Talent1",
      lastName: "InProvider",
      legalDocuments: [{name: 3}, {name: 4}],
      providerEmail: "provider@stoketalent.com",
      providerName: "ProviderWithTalents",
    },
    {
      email: "talent2@stoketalent.com",
      firstName: "Talent2",
      lastName: "InProvider",
      legalDocuments: [{name: 5}, {name: 5}],
      providerEmail: "provider@stoketalent.com",
      providerName: "ProviderWithTalents",
    }
  ]
}

const providerEvent = {
  body: JSON.stringify(provider),
  requestContext: {
    identity: {
      cognitoIdentityId: compAdminId
    }
  }
};



const provider2Event = {
  body: JSON.stringify(provider2),
  requestContext: {
    identity: {
      cognitoIdentityId: nonAdminUserId
    }
  }
};

const existingProvider = {
  companyId,
  items: [
    {
      firstName: name,
      lastName: name,
      providerId
    }
  ]
};

const existingProviderEvent = {
  body: JSON.stringify(existingProvider),
  requestContext: {
    identity: {
      cognitoIdentityId: compAdminId
    }
  }
};

const providerNoAllowEvent = {
  body: JSON.stringify({ companyId: companyId + "_COMPANY" }),
  requestContext: {
    identity: {
      cognitoIdentityId: compAdminId
    }
  }
};

const providerMissingCompanyIdEvent = {
  body: JSON.stringify({}),
  requestContext: {
    identity: {
      cognitoIdentityId: compAdminId
    }
  }
};

const settings = {
  itemId: `${constants.prefix.company}${companyId}`,
  itemData: {
    sendTalentAppLink: true
  }
};

const providerNotInvitedEvent = {
  body: JSON.stringify(provider3),
  requestContext: {
    identity: {
      cognitoIdentityId: compAdminId
    }
  }
};

const providerWithTalentsEvent = {
  body: JSON.stringify(providerWithTalents),
  requestContext: {
    identity: {
      cognitoIdentityId: compAdminId
    }
  }
};

describe("createCompanyProviders", () => {
  beforeAll(async () => {
    const compAdmin = {
      userId: compAdminId,
      entityId: companyId,
      companyId,
      itemStatus: constants.user.status.active,
      itemData: { userRole: constants.user.role.admin, permissionsComponents: { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } } }
    };
    let result = await usersService.create(compAdmin);
    expect(result).toEqual(compAdmin);
    const compUser = {
      userId: nonAdminUserId,
      entityId,
      companyId,
      itemStatus: constants.user.status.active,
      itemData: { userRole: constants.user.role.user, isEditor: true }
    };
    result = await usersService.create(compUser);
    expect(result).toEqual(compUser);
    result = await settingsService.create(settings);
    expect(result).toEqual(settings);
  });

  it("Add company provider, expect 200, and test data", async () => {
    let response = await createCompanyProviders.run(providerEvent);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.providersResult.length).toBe(6);
    expect(body.talentsResult.length).toBe(3);
    let keyConditionExpression =
      "companyId = :companyId and  begins_with(itemId, :prefix)";
    let expressionAttributeValues = {
      ":companyId": companyId,
      ":prefix": constants.prefix.talent
    };
    const allTalentsProviders = await companyProvidersService.list(
      null,
      keyConditionExpression,
      expressionAttributeValues
    );
    expect(allTalentsProviders).toMatchObject([
      {
        itemData: { 
          email :'test@stoketalent.com'
        },
        modifiedBy: compAdminId,
        createdBy: compAdminId,
        itemStatus: constants.companyProvider.status.invited
      },
      {
        itemData: {},
        modifiedBy: compAdminId,
        createdBy: compAdminId,
        itemStatus: constants.companyProvider.status.invited
      },
      {
        itemData: {},
        modifiedBy: compAdminId,
        createdBy: compAdminId,
        itemStatus: constants.companyProvider.status.invited
      }
    ]);
    expressionAttributeValues[":prefix"] = constants.prefix.provider;
    const allProviders = await companyProvidersService.list(
      null,
      keyConditionExpression,
      expressionAttributeValues
    );
    expect(allProviders).toMatchObject([
      {
        itemData: {
          providerName: providerName1
        },
        modifiedBy: compAdminId,
        createdBy: compAdminId,
        itemStatus: constants.companyProvider.status.invited,
        tags: { tag: 1 }
      },
      {
        itemData: {
          providerName: providerName2
        },
        modifiedBy: compAdminId,
        createdBy: compAdminId,
        itemStatus: constants.companyProvider.status.invited
      }
      ,
      {
        itemData: {
          providerName: providerName3
        },
        modifiedBy: compAdminId,
        createdBy: compAdminId,
        itemStatus: constants.companyProvider.status.invited
      }
    ]);
    for (const tp of allTalentsProviders) {
      const result = await talentsService.get(tp.itemId);
      expect(result).toMatchObject({
        itemId: tp.itemId,
        itemData: {},
        modifiedBy: compAdminId,
        createdBy: compAdminId
      });
    }
    await usersService.update({ userId: compAdminId, entityId: companyId, modifiedBy: compAdminId, itemData: {
      userRole: constants.user.role.admin,
      isEditor: false
    }}) 
    response = await createCompanyProviders.run(providerEvent);
    expect(response.statusCode).toBe(403);
    await usersService.update({ userId: compAdminId, entityId: companyId, modifiedBy: compAdminId, itemData: {
      userRole: constants.user.role.admin,
      isEditor: true
    }})
  });

  it("Add company provider by a user, expect 200", async () => {
    let response = await createCompanyProviders.run(provider2Event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.providersResult.length).toBe(2);
    expect(body.providersResult[1]).toBeDefined();
    expect(body.providersResult[1]).toEqual(body.talentsResult[0]);
  });

  it("Add only talent for not existing companyProvider, expect 500", async () => {
    let response = await createCompanyProviders.run(existingProviderEvent);
    expect(response.statusCode).toBe(500);
  });

  it("Add only talent for existing companyProvider, expect 200, and test data", async () => {
    const provider = {
      companyId,
      itemId: providerId,
      itemStatus: constants.companyProvider.status.registered,
      itemData: {},
      createdBy: nonAdminUserId,

    };
    const result = await companyProvidersService.create(provider);
    expect(result).toEqual(provider);
    let response = await createCompanyProviders.run(existingProviderEvent);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.providersResult.length).toBe(1);
    expect(body.talentsResult.length).toBe(1);
  });

  it("User not allow , expect 403", async () => {
    const response = await createCompanyProviders.run(
      providerNoAllowEvent
    );
    expect(response.statusCode).toBe(403);
  });

  it("missing company id  expect 500", async () => {
    const response = await createCompanyProviders.run(
      providerMissingCompanyIdEvent
    );
    expect(response.statusCode).toBe(500);
  });

  it("Add provider in status notInvited", async () => {
    let response = await createCompanyProviders.run(providerNotInvitedEvent);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const providerId = body.providersResult[0];
    const talentId = body.providersResult[1];
    const createdProvider = await companyProvidersService.get(companyId, providerId);
    expect(createdProvider.itemStatus).toBe(constants.companyProvider.status.notInvited);
    const createdTalent = await companyProvidersService.get(companyId, talentId);
    expect(createdTalent.itemStatus).toBe(constants.companyProvider.status.notInvited);
  });

  it("Create provider with talents", async () => {
    let response = await createCompanyProviders.run(providerWithTalentsEvent);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const providerId = body.providersResult[0];
    const talentId = body.providersResult[1];
    const createdProvider = await companyProvidersService.get(companyId, providerId);
    expect(createdProvider.itemData.legalDocuments).toMatchObject(providerWithTalents.items[0].legalDocuments);
    const createdTalent = await companyProvidersService.get(companyId, talentId);
    expect(createdTalent.itemData.legalDocuments).toMatchObject(providerWithTalents.items[1].legalDocuments);
  });

  afterAll(async () => {
    await usersService.delete(compAdminId, companyId);
    await usersService.delete(nonAdminUserId, entityId);
    const keyConditionExpression = "companyId = :companyId";
    const expressionAttributeValues = { ":companyId": companyId };
    const allProviders = await companyProvidersService.list(
      null,
      keyConditionExpression,
      expressionAttributeValues
    );
    for (const p of allProviders) {
      await companyProvidersService.delete(companyId, p.itemId);
      await talentsService.delete(p.itemId);
    }
    await settingsService.delete(settings.itemId);
  });
});
