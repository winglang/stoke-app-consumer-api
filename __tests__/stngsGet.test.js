/* eslint-disable max-lines-per-function */
"use strict";
// tests for getSettings

const mod = require("../src/settings");
const AWS = require('aws-sdk');
const { SettingsService, UsersService, constants } = require("stoke-app-common-api");
const settingsService = new SettingsService(process.env.settingsTableName);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const documentClient = new AWS.DynamoDB.DocumentClient();

const jestPlugin = require("serverless-jest-plugin");
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: "getSettings" });

const companyId = 'JEST-getSettings-COMP'
const entityId = 'JEST-getSettings-ENT'
const userIdAdmin = 'JEST-getSettings-usr-admin'
const userIdUser = 'JEST-getSettings-usr2-user'
const entityId4 = 'JEST-getSettings-ENT4'

const getLegalEntitiesExpectedResult = {
    LE_NAME_STNGGETTEST: 
        {
            "depatmentIds": ["entity_JEST-getSettings-ENT", "entity_JEST-getSettings-ENT2"], 
            "legalDocs": {"ipAssignment": "document", "nda": "document", "nonCompete": "document"}, 
            "location": "LE_STNGSGET_LOCATION_1"
        }, 
    LE_NAME_STNGGETTEST2: 
        {
            "depatmentIds": ["entity_JEST-getSettings-ENT3"], 
            "legalDocs": {"ipAssignment": "document", "nda": "document", "nonCompete": "document"}, 
            "location": "LE_STNGSGET_LOCATION_2"
        }
};
const entitySettings1 = {
    itemId: constants.prefix.entity + "JEST-getSettings-ENT",
    userId: "JEST-getSettings-usr-admin",
    entityId,
    companyId,
    itemData: {
        legalEntity: {
            ...getLegalEntitiesExpectedResult.LE_NAME_STNGGETTEST2,
            legalEntityName: 'LE_NAME_STNGGETTEST'
        }
    }
};
const entitySettings2 = {
    itemId: constants.prefix.entity + "JEST-getSettings-ENT2",
    userId: "JEST-getSettings-usr-admin",
    entityId,
    companyId,
    itemData: {
        legalEntity: {
            ...getLegalEntitiesExpectedResult.LE_NAME_STNGGETTEST,
            legalEntityName: 'LE_NAME_STNGGETTEST'
        }
    }
};

const entitySettings3 = {
    itemId: constants.prefix.entity + "JEST-getSettings-ENT3",
    userId: "JEST-getSettings-usr-admin",
    entityId,
    companyId,
    itemData: {
        legalEntity: {
            ...getLegalEntitiesExpectedResult.LE_NAME_STNGGETTEST2,
            legalEntityName: 'LE_NAME_STNGGETTEST2'
        }
    }
};

const entitySettings4 = {
    itemId: constants.prefix.entity + entityId4,
    userId: userIdAdmin,
    entityId4,
    companyId,
    itemData: {
        legalEntity: {
            ...getLegalEntitiesExpectedResult.LE_NAME_STNGGETTEST2,
            legalEntityName: 'LE_NAME_STNGGETTEST2'
        },
        approversList: ['USR1', 'USR2'],
    }
};


describe("getSettings", () => {
    beforeAll(async () => {
        let result = await usersService.create({
            userId: userIdAdmin,
            entityId: companyId,
            companyId: companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin
            }
        });
        expect(result.userId).toBe(userIdAdmin)
        result = await usersService.create({
            userId: userIdUser,
            entityId: entityId,
            companyId: companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.user
            }
        });
        expect(result.userId).toBe(userIdUser)
        result = await usersService.create({
            userId: userIdAdmin,
            entityId: entityId4,
            companyId: companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin
            }
        });
        result = await settingsService.create({
            itemId: `comp_${companyId}`,
            companyId: companyId,
            itemData: {
                favorites: ["talent-id-1", "talent-id-2", "talent-id-3"],
                legalEntities: {
                    LE_NAME_STNGGETTEST: {
                        legalDocs: {ipAssignment: "document", nda: "document", nonCompete: "document"},
                        location: "LE_STNGSGET_LOCATION_1"
                    },
                    LE_NAME_STNGGETTEST2: {
                        legalDocs: {ipAssignment: "document", nda: "document", nonCompete: "document"},
                        location: "LE_STNGSGET_LOCATION_2"
                    }
                }
            }
        });
        expect(result.itemId).toBe(`comp_${companyId}`);
        result = await settingsService.create(entitySettings1);
        expect(result).toMatchObject(entitySettings1);
        result = await settingsService.create(entitySettings2);
        expect(result).toMatchObject(entitySettings2);
        result = await settingsService.create(entitySettings3);
        expect(result).toMatchObject(entitySettings3);
        result = await settingsService.create({
            itemId: `user_${userIdAdmin}`,
            companyId: companyId,
            itemData: {
                favorites: ["talent-id-1", "talent-id-2", "talent-id-3"]
            }
        });
        expect(result.itemId).toBe(`user_${userIdAdmin}`);
        result = await settingsService.create({
            itemId: `user_${userIdUser}`,
            companyId: companyId,
            itemData: {
                favorites: ["talent-id-1", "talent-id-2", "talent-id-3"]
            }
        });
        expect(result.itemId).toBe(`user_${userIdUser}`);
    });

    it("getSettings of company, expect 200", async () => {
        const event = {
            body: {},
            requestContext: {
                identity: {
                    cognitoIdentityId: userIdUser
                }
            },
            queryStringParameters: {
                companyId,
                id: companyId,
                settingType: 'company',
            }
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.itemId).toBe(`comp_${companyId}`);
        expect(body.itemData).toMatchObject({
            favorites: ["talent-id-1", "talent-id-2", "talent-id-3"]
        });
    });

    it("getSettings of user , expect 200", async () => {
        const event = {
            body: {},
            requestContext: {
                identity: {
                    cognitoIdentityId: userIdAdmin
                }
            },
            queryStringParameters: {
                companyId,
                id: userIdUser,
                settingType: 'user'
            }
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.itemId).toBe(`user_${userIdUser}`);
        expect(body.itemData).toMatchObject({
            favorites: ["talent-id-1", "talent-id-2", "talent-id-3"]
        });
    });

    it("getSettings of user himself , expect 200", async () => {
        const event = {
            body: {},
            requestContext: {
                identity: {
                    cognitoIdentityId: userIdUser
                }
            },
            queryStringParameters: {
                companyId,
                id: userIdUser,
                settingType: 'user'
            }
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.itemId).toBe(`user_${userIdUser}`);
        expect(body.itemData).toMatchObject({
            favorites: ["talent-id-1", "talent-id-2", "talent-id-3"]
        });
    });

    it("getLegalEntities of Company , expect 200", async () => {
        const event = {
            body: {},
            requestContext: {
                identity: {
                    cognitoIdentityId: userIdUser
                }
            },
            queryStringParameters: {
                companyId,
                settingName: 'legalEntities',
                id: companyId,
                settingType: 'company'
            }
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.itemData.legalEntities).toMatchObject(getLegalEntitiesExpectedResult);
    });

    it("getSettings of entity, expect 200", async () => {
        let result = await settingsService.create(entitySettings4);
        expect(result).toMatchObject(entitySettings4);
        const event = {
            body: {},
            requestContext: {
                identity: {
                    cognitoIdentityId: userIdAdmin
                }
            },
            queryStringParameters: {
                companyId: companyId,
                id: entityId4,
                settingType: 'entity'
            }
        };
        const response = await wrapped.run(event);
        const responseEnt4 = JSON.parse(response.body)[0];
        expect(responseEnt4.itemData).toMatchObject(entitySettings4.itemData)
    })

    it("getSettings user, expect unauthorized", async () => {
        const event = {
            body: {},
            requestContext: {
                identity: {
                    cognitoIdentityId: userIdUser
                }
            },
            queryStringParameters: {
                companyId,
                id: userIdAdmin,
                settingType: 'user',
            }
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(403);
    });

    afterAll(async () => {
        let result = await settingsService.delete(`comp_${companyId}`);
        expect(result).toBe(true);
        result = await settingsService.delete(`user_${userIdAdmin}`);
        expect(result).toBe(true);
        result = await settingsService.delete(`user_${userIdUser}`);
        expect(result).toBe(true);
        result = await settingsService.delete('entity_JEST-getSettings-ENT');
        expect(result).toBe(true);
        result = await settingsService.delete('entity_JEST-getSettings-ENT2');
        expect(result).toBe(true);
        result = await settingsService.delete('entity_JEST-getSettings-ENT3');
        expect(result).toBe(true);
        result = await settingsService.delete(entitySettings4.itemId);
        result = await usersService.delete(userIdAdmin, companyId);
        expect(result).toBe(true);
        result = await usersService.delete(userIdUser, entityId);
        expect(result).toBe(true);
    });
});

