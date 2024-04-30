"use strict";

const modUsers = require("../src/users");
const jestPlugin = require("serverless-jest-plugin");
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrappedDeleteUser = lambdaWrapper.wrap(modUsers, { handler: "deleteUserInEntity" });

const CompanyCreator = require('./mock/companyCreator');
const creator = new CompanyCreator('EntUsrRem');
const { userId1, userId2, userId3, userId4, adminUserId, entityId1, entityId2, adminUserId2 } = creator;

const { constants, UsersService } = require("stoke-app-common-api");
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const event = (userIdToDelete, entityId, userId, isValidation) => ({
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  pathParameters: {
    id: userIdToDelete
  },
  queryStringParameters: { entityId, isValidation: isValidation?.toString() },
});

const failedEvent = event(userId1, null, null);

describe("deleteUserInEntity", () => {

  beforeEach(async () => {
    await creator.create();
  });

  afterEach(async () => {
    await creator.delete();
  });

  it("delete user - basic flow", async () => {
    const response = await wrappedDeleteUser.run(event(userId1, entityId1, adminUserId));
    expect(response.statusCode).toBe(200);
    const userAfterUpdate = await usersService.get(userId1, entityId1);
    expect(userAfterUpdate).toMatchObject({
      itemStatus: constants.itemStatus.inactive,
    });
  });

  it("delete user - basic flow - isValidation - doesn't really change the user itemStatus (stays active)", async () => {
    const response = await wrappedDeleteUser.run(event(userId1, entityId1, adminUserId, true));
    expect(response.statusCode).toBe(200);
    const userAfterUpdate = await usersService.get(userId1, entityId1);
    expect(userAfterUpdate).toMatchObject({
      itemStatus: constants.itemStatus.active,
    });
  });

  it("delete user - error user has active jobs", async () => {
    const response = await wrappedDeleteUser.run(event(userId2, entityId1, adminUserId));
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.status).toBe(false);
    const userAfterUpdate = await usersService.get(userId2, entityId1);
    expect(userAfterUpdate).toMatchObject({
      itemStatus: constants.itemStatus.active,
    });
  });

  it("delete user - error user unauthorized", async () => {
    const response = await wrappedDeleteUser.run(event(userId2, entityId1, userId1));
    expect(response.statusCode).toBe(403);
    const userAfterUpdate = await usersService.get(userId2, entityId1);
    expect(userAfterUpdate).toMatchObject({
      itemStatus: constants.itemStatus.active,
    });
  });

  it("delete user - error missing entityId", async () => {
    const response = await wrappedDeleteUser.run(failedEvent);
    expect(response.statusCode).toBe(500);
  });

  it("delete user - budget basic flow - only past budgets", async () => {
    const response = await wrappedDeleteUser.run(event(userId3, entityId2, adminUserId));
    expect(response.statusCode).toBe(200);
    const userAfterUpdate = await usersService.get(userId3, entityId2);
    expect(userAfterUpdate).toMatchObject({
      itemStatus: constants.itemStatus.inactive,
    });
  });

  it("delete user - budget basic flow - has future budgets - should return validation error", async () => {
    const response = await wrappedDeleteUser.run(event(userId4, entityId2, adminUserId));
    expect(response.statusCode).toBe(200);
    const userAfterUpdate = await usersService.get(userId4, entityId2);
    expect(userAfterUpdate).toMatchObject({
      itemStatus: constants.itemStatus.active,
    });
  });

  it("delete user - company scope user can not be deleted, expect 403", async () => {
    let response = await wrappedDeleteUser.run(event(adminUserId, entityId2, adminUserId));
    expect(response.statusCode).toBe(403);
    response = await wrappedDeleteUser.run(event(adminUserId2, entityId2, adminUserId));
    expect(response.statusCode).toBe(403);
  });

});
