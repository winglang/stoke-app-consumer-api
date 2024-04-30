"use strict";

const modUsers = require("../src/users");
const jestPlugin = require("serverless-jest-plugin");
const deleteUserInTeam = jestPlugin.lambdaWrapper.wrap(modUsers, { handler: "deleteUserInTeam" });

const CompanyCreator = require('./mock/companyCreator');
const creator = new CompanyCreator('TeamUsrRem');
const { userId1, userId5, adminUserId, entityId3, teamName1, teamName2 } = creator;

const { constants, UsersService, teamsService } = require("stoke-app-common-api");
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const event = (userIdToDelete, entityId, teamName, userId, isValidation) => ({
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    pathParameters: {
        id: userIdToDelete
    },
    queryStringParameters: { entityId, teamName, isValidation: isValidation?.toString() },
});

describe("deleteUserInTeam", () => {

    beforeEach(async () => {
        await creator.create();
    });

    afterEach(async () => {
        await creator.delete();
    });

    it("delete user from team - basic flow", async () => {
        const response = await deleteUserInTeam.run(event(userId5, entityId3, teamName1, adminUserId));
        expect(response.statusCode).toBe(200);
        const userAfterUpdate = await usersService.get(userId5, entityId3);
        expect(userAfterUpdate).toMatchObject({
            itemStatus: constants.itemStatus.active,
        });
        const userTeams = teamsService.get(userAfterUpdate);
        expect(userTeams).toEqual([teamName2]);
    });

    it("delete user from team - basic flow - isValidation - doesn't really change the user teams", async () => {
        const response = await deleteUserInTeam.run(event(userId5, entityId3, teamName1, adminUserId, true));
        expect(response.statusCode).toBe(200);
        const userAfterUpdate = await usersService.get(userId5, entityId3);
        expect(userAfterUpdate).toMatchObject({
            itemStatus: constants.itemStatus.active,
        });
        const userTeams = teamsService.get(userAfterUpdate);
        expect(userTeams).toEqual([teamName1, teamName2]);
    });

    it("delete user - error user has active jobs", async () => {
        const response = await deleteUserInTeam.run(event(userId5, entityId3, teamName2, adminUserId));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.status).toBe(false);
        const userAfterUpdate = await usersService.get(userId5, entityId3);
        expect(userAfterUpdate).toMatchObject({
            itemStatus: constants.itemStatus.active,
        });
    });

    it("delete user - error user unauthorized", async () => {
        const response = await deleteUserInTeam.run(event(userId5, entityId3, teamName2, userId1));
        expect(response.statusCode).toBe(403);
        const userAfterUpdate = await usersService.get(userId5, entityId3);
        expect(userAfterUpdate).toMatchObject({
            itemStatus: constants.itemStatus.active,
        });
    });

});
