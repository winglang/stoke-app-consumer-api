"use strict";

const mod = require("../src/s3Files");
const { UsersService, constants, permisionConstants } = require("stoke-app-common-api");
const jestPlugin = require("serverless-jest-plugin");
const s3Files = require('../src/s3Files')

const usersService = new UsersService(
  process.env.consumerAuthTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);
const signedUrl = jestPlugin.lambdaWrapper.wrap(mod, {
  handler: "getSignedUrl"
});

const userId = "JEST-SIGNED_URL_USER";
const userIdNotAdmin = "JEST-SIGNED_URL_USER_NOT_ADMIN";
const userIdAdmin = "JEST-SIGNED_URL_USER_ADMON";
const entityId = "JEST-SIGNED_URL_ENTITY";
const companyId = "JEST-SIGNED_URL_COMPANY";

const event = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  queryStringParameters: {
    entityId: entityId,
    action: "upload",
    path: "files",
    userIdPath: userId
  }
};

const eventAdmin = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: userIdAdmin
    }
  },
  queryStringParameters: {
    entityId: entityId,
    action: "download",
    path: "files",
    userIdPath: userId
  }
};

const eventNotAdmin = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: userIdNotAdmin
    }
  },
  queryStringParameters: {
    entityId: entityId,
    action: "download",
    path: "files",
    userIdPath: userId
  }
};

const eventVirusScan = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  queryStringParameters: {
    entityId: entityId,
    action: "download",
    path: "files/dummy_virus_scan.png",
    userIdPath: userId
  }
};

const eventVirusScanNoObjectTags = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  queryStringParameters: {
    entityId: entityId,
    action: "download",
    path: "files/dummy_virus_scan_no_tagging.png",
    userIdPath: userId
  }
};

const eventAuditScanNoObjectTags = {
  body: "{}",
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  queryStringParameters: {
    entityId: entityId,
    action: "download",
    path: "files/dummy_audit_scan_results.png",
    userIdPath: userId
  }
};

describe("getSignedUrl", () => {
  beforeAll(async () => {
    const user = {
      userId,
      entityId,
      companyId,
      itemStatus: constants.user.status.active,
      itemData: { userRole: constants.user.role.user, permissionsComponents: { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } } }
    };
    let result = await usersService.create(user);
    expect(result).toEqual(user);
    const userAdmin = {
      userId: userIdAdmin,
      entityId,
      companyId,
      itemStatus: constants.user.status.active,
      itemData: { userRole: constants.user.role.admin, permissionsComponents: { [permisionConstants.permissionsComponentsKeys.jobs]: {} } }
    };
    result = await usersService.create(userAdmin);
    expect(result).toEqual(userAdmin);
    const userNotAdmin = {
      userId: userIdNotAdmin,
      entityId,
      companyId,
      itemStatus: constants.user.status.active,
      itemData: { userRole: constants.user.role.user, permissionsComponents: { [permisionConstants.permissionsComponentsKeys.jobs]: {} } }
    };
    result = await usersService.create(userNotAdmin);
    expect(result).toEqual(userNotAdmin);
  });

  describe("getSignedUrl", () => {
    describe("isCheckFileDownloadAllowed", () => {
      describe("company settings restrictions", () => {
        it("should return false when there is no restriction - background check permissions", async () => {
          const isAllowed = await s3Files.isCheckFileDownloadAllowed(undefined, undefined, undefined, [], 'admin', 'backgroundCheckDocumentViewRestriction')
          expect(isAllowed).toEqual(false)
        })
      })
      
      it("should return false when there is no restriction - auditCheckDocumentViewRestriction", async () => {
        const isAllowed = await s3Files.isCheckFileDownloadAllowed(undefined, undefined, undefined, [], 'admin', 'auditCheckDocumentViewRestriction')
        expect(isAllowed).toEqual(false)
      })
    })
  })

  describe("audit check fields", () => {
    describe("old file", () => {
      it("should return indication file to client", async () => {
        let response = await signedUrl.run(eventAuditScanNoObjectTags);
        expect(response.statusCode).toBe(200);
        let url = JSON.parse(response.body);
        expect(url).toBeDefined()
      })
    })
  })

  describe("virus scan", () => {
    describe("when there are no object tags", () => {
      it("should return indication to client", async () => {
        process.env.virusScanStartTime = '946735794000'
        let response = await signedUrl.run(eventVirusScanNoObjectTags);
        expect(response.statusCode).toBe(200);
        let responseObj = JSON.parse(response.body);
        expect(responseObj).toEqual({ virusScanIndication: { malicious: false, inProgress: true } })
      })
    })
    describe("when there are no object tags", () => {
      it("should not scan for viruses for file older then start scanning time", async () => {
        process.env.virusScanStartTime = '2524658994000'
        let response = await signedUrl.run(eventVirusScan);
        expect(response.statusCode).toBe(200);
        let url = JSON.parse(response.body);
        expect(url).toBeDefined()
      })
    })
  })

  it("signed Url, expect 200, data", async () => {
    let response = await signedUrl.run(event);
    expect(response.statusCode).toBe(200);
    let responseObj = JSON.parse(response.body);
    expect(responseObj.startsWith("https://")).toBeTruthy();
    response = await signedUrl.run(eventAdmin);
    expect(response.statusCode).toBe(200);
    responseObj = JSON.parse(response.body);
    expect(responseObj.startsWith("https://")).toBeTruthy();
    await usersService.update({
      userId: userId, entityId: entityId, modifiedBy: userId, itemData: {
        userRole: constants.user.role.admin,
        isEditor: false
      }
    })
    response = await signedUrl.run(event);
    expect(response.statusCode).toBe(403);
    await usersService.update({
      userId: userId, entityId: entityId, modifiedBy: userIdAdmin, itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
      }
    })
    await usersService.update({
      userId: userIdAdmin, entityId: entityId, modifiedBy: userIdAdmin, itemData: {
        userRole: constants.user.role.admin,
        isEditor: false
      }
    })
    response = await signedUrl.run(eventAdmin);
    expect(response.statusCode).toBe(200);
    await usersService.update({
      userId: userId, entityId: entityId, modifiedBy: userId, itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
      }
    })
  });

  it("signed Url, expect 403, data", async () => {
    let response = await signedUrl.run(eventNotAdmin);
    expect(response.statusCode).toBe(403);
  });

  afterAll(async () => {
    //cleanup
    let result = await usersService.delete(userId, entityId);
    expect(result).toBeTruthy();
    result = await usersService.delete(userIdAdmin, entityId);
    expect(result).toBeTruthy();
    result = await usersService.delete(userIdNotAdmin, entityId);
    expect(result).toBeTruthy();
  });
});
