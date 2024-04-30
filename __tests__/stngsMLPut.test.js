/* eslint-disable no-magic-numbers */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-undef */
"use strict";

const mod = require("../src/updateMultiLevelSettings");
const { SettingsService, UsersService, constants, permisionConstants } = require("stoke-app-common-api");
const jestPlugin = require("serverless-jest-plugin");

const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: "handler" });
const settingsService = new SettingsService(process.env.settingsTableName);
const usersService = new UsersService(process.env.consumerAuthTableName);
const userId = 'JEST-STNGSMLPUT-user-1';
const userAdminEntity = 'JEST-STNGSMLPUT-userAdminEntity';
const userIdNotAdmin = 'JEST-STNGSMLPUT-userIdNotAdmin';
const companyId = 'JEST-STNGSMLPUT-company-id-1';
const entityId = 'JEST-STNGSMLPUT-entity-id-1';
const entityId2 = 'JEST-STNGSMLPUT-entity-id-2';
const entityId3 = 'JEST-STNGSMLPUT-entity-id-3';
const userAdminInEntity = 'JEST-STNGSMLPUT-user-in-entity-id-1-1';

const companySettings = {
    itemId: constants.prefix.company + companyId,
    userId: userId,
    companyId,
    entityId: companyId,
    itemStatus: constants.settings.status.active,
    itemData: {
        otherSettings: "other Settings"

    }
};

const entitySettings = {
    itemId: constants.prefix.entity + entityId,
    userId,
    companyId,
    entityId,
    itemStatus: constants.settings.status.active,
    itemData: {
        otherSettings: "other entity Settings"
    }
};

const entity2Settings = {
    ...entitySettings,
    itemId: constants.prefix.entity + entityId2,
};

const entity3Settings = {
    ...entitySettings,
    itemId: constants.prefix.entity + entityId3,
    itemData: {
        otherSettings: "other entity Settings",
        multiLevelApproval: {
            enabled: true,
            approversChain: {
                1: { type: "anyone", level: 1, threshold: 0 },
            },
        },
    }
};

const aftercompanySettings = {
    itemId: constants.prefix.company + companyId,
    userId: userId,
    companyId,
    entityId: companyId,
    itemStatus: constants.settings.status.active,
    itemData: {
        otherSettings: "other Settings",
        multiLevelApproval: {
            enabled: true,
            approversChain: {
                1: {
                    type: "anyone",
                    level: 1,
                    threshold: 0
                },
                2: {
                    type: "departmentAdmin",
                    level: 2,
                    threshold: 0
                },
                3: {
                    type: "namedUser",
                    level: 3,
                    threshold: 0,
                    userIds: [
                        userId, userAdminEntity
                    ]
                }
            }
        }
    }
};

const notAdminCompany = {
    userId: userIdNotAdmin,
    companyId,
    entityId: companyId,
    createdBy: userIdNotAdmin,
    modifiedBy: userIdNotAdmin,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user, isEditor: false
    }
};

const aftercompanySettingsNoApprovelChains = {
    itemId: constants.prefix.company + companyId,
    userId: userId,
    companyId,
    entityId: companyId,
    itemStatus: constants.settings.status.active,
    itemData: {
        otherSettings: "other Settings",
        multiLevelApproval: {
            enabled: false,
            approversChain: {}
        }
    }
};

const adminEntity = {
    userId: userAdminEntity,
    companyId,
    entityId: companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin, isEditor: true
    }
};

const companyAdminInEntity1 = {
    userId,
    companyId,
    entityId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        permissionsComponents: {
            [permisionConstants.permissionsComponentsKeys.advancedSettings]: { isEditor: true },
            [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true }
        }
    },
};

const companyAdminInEntity2 = {
    ...companyAdminInEntity1,
    entityId: entityId2,
};

const companyAdminInEntity3 = {
    ...companyAdminInEntity1,
    entityId: entityId3,
};

const entityAdminInEntity1 = {
    userId: userAdminInEntity,
    companyId,
    entityId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.admin },
};

const entityAdminInEntity2 = {
    ...entityAdminInEntity1,
    entityId: entityId2,
};

const entityAdminInEntity3 = {
    ...entityAdminInEntity1,
    entityId: entityId3,
};


describe("updateMultiLevelSettings", () => {
    beforeAll(async () => {
        await settingsService.create(companySettings);
        await settingsService.create(entitySettings);
        await settingsService.create(entity2Settings);
        await settingsService.create(entity3Settings);
        await usersService.create({
            userId,
            entityId: companyId,
            companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                permissionsComponents: {
                    [permisionConstants.permissionsComponentsKeys.advancedSettings]: { isEditor: true },
                    [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true }
                }
            }
        });
        await usersService.create(notAdminCompany);
        await usersService.create(adminEntity);
        await usersService.create(companyAdminInEntity1);
        await usersService.create(entityAdminInEntity1);
        await usersService.create(companyAdminInEntity2);
        await usersService.create(entityAdminInEntity2);
        await usersService.create(companyAdminInEntity3);
        await usersService.create(entityAdminInEntity3);

    })

    //////////////////////
    // updateMultiLevelSettings, create three approvers chains. expect 200
    //////////////////////
    it("updateMultiLevelSettings, create three approvers chains. expect 200", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: true,
                    approversChain: {
                        1: {
                            type: "anyone",
                            level: 1,
                            threshold: 0
                        },
                        2: {
                            type: "departmentAdmin",
                            level: 2,
                            threshold: 0
                        },
                        3: {
                            type: "namedUser",
                            level: 3,
                            threshold: 0,
                            userIds: [userId, userAdminEntity],
                        }
                    }
                },
                scope: "company",
                action: "set",
                companyId,
            }),

            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).Attributes.itemData).toEqual(aftercompanySettings.itemData)
    });

    //////////////////////
    // updateMultiLevelSettings, no permission. expect 403
    //////////////////////
    it("updateMultiLevelSettings, no permission. expect 403", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: false,
                    approversChain: {
                        1: {
                            type: "anyone",
                            level: 1,
                            threshold: 0
                        },
                        2: {
                            type: "departmentAdmin",
                            level: 2,
                            threshold: 0
                        }
                    }
                },
                scope: "company",
                action: "set",
                companyId
            }),

            requestContext: {
                identity: {
                    cognitoIdentityId: "JEST-STNGSMLPUT-user-x"
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(403);
    });

    //////////////////////
    // updateMultiLevelSettings with no approvers chains. expect 200
    //////////////////////

    it("updateMultiLevelSettings with no approvers chains. expect 200", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: false,
                    approversChain: {

                    }
                },
                scope: "company",
                action: "set",
                companyId
            }),

            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).Attributes.itemData).toEqual(aftercompanySettingsNoApprovelChains.itemData)
    });

    //////////////////////
    // updateMultiLevelSettings, type for level 1 is different from "anyone". expect 500
    //////////////////////
    it("updateMultiLevelSettings, type for level 1 is different from \"anyone\". expect 500", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: false,
                    approversChain: {
                        1: {
                            type: "departmentAdmin",
                            level: 1,
                            threshold: 0
                        }
                    }
                },
                scope: "company",
                action: "set",
                companyId
            }),

            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    });

    //////////////////////
    // updateMultiLevelSettings, threshold for level 1 is different from 0. expect 500
    //////////////////////
    it("updateMultiLevelSettings, threshold for level 1 is different from 0. expect 500", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: false,
                    approversChain: {
                        1: {
                            type: "anyone",
                            level: 1,
                            threshold: 1
                        }
                    }
                },
                scope: "company",
                action: "set",
                companyId
            }),

            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    });

    //////////////////////
    // updateMultiLevelSettings, create two approvers chains but no level 1 chain. expect 500
    //////////////////////
    it("updateMultiLevelSettings, create two approvers chains but no level 1 chain. expect 500", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: false,
                    approversChain: {
                        2: {
                            type: "anyone",
                            level: 1,
                            threshold: 0
                        },
                        3: {
                            type: "departmentAdmin",
                            level: 2,
                            threshold: 0
                        }
                    }
                },
                scope: "company",
                action: "set",
                companyId
            }),

            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    });

    //////////////////////
    // updateMultiLevelSettings, named user is not Company Admin. expect 500
    //////////////////////
    it("updateMultiLevelSettings, named user is not Company Admin. expect 500", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: false,
                    approversChain: {
                        1: {
                            type: "anyone",
                            level: 1,
                            threshold: 0
                        },
                        2: {
                            type: "departmentAdmin",
                            level: 2,
                            threshold: 0
                        },
                        3: {
                            type: "namedUser",
                            level: 3,
                            threshold: 0,
                            userIds: [userId, userIdNotAdmin],
                        }
                    }
                },
                companyId
            }),

            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    });

    //////////////////////
    // updateMultiLevelSettings with no companyId. expect 500
    //////////////////////

    it("updateMultiLevelSettings with no companyId. expect 500", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: false,
                    approversChain: {

                    }
                },
                scope: "company",
                action: "set",
            }),

            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    });

    //////////////////////
    // updateMultiLevelSettings with no data. expect 500
    //////////////////////

    it("updateMultiLevelSettings with no data. expect 500", async () => {
        const event = {
            body: JSON.stringify({
                companyId,
                scope: "company",
                action: "set",
            }),

            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    });

    //////////////////////
    // updateMultiLevelSettings, same named user appears twice in two levels. expect 500
    //////////////////////
    it("updateMultiLevelSettings, same named user appears twice in two levels. expect 500", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: true,
                    approversChain: {
                        1: {
                            type: "anyone",
                            level: 1,
                            threshold: 0
                        },
                        2: {
                            type: "namedUser",
                            level: 2,
                            threshold: 0,
                            userIds: [userId]
                        },
                        3: {
                            type: "namedUser",
                            level: 3,
                            threshold: 0,
                            userIds: [userId, userAdminEntity]
                        }
                    }
                },
                scope: "company",
                action: "set",
                companyId,
            }),

            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    });

    //////////////////////
    // updateMultiLevelSettings, threshold in level 3 is lower than threshold in level 2. expect 500
    //////////////////////
    it("updateMultiLevelSettings, threshold in level 3 is lower than threshold in level 2. expect 500", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: true,
                    approversChain: {
                        1: {
                            type: "anyone",
                            level: 1,
                            threshold: 0
                        },
                        3: {
                            type: "namedUser",
                            level: 3,
                            threshold: 1,
                            userIds: [userId]
                        },
                        2: {
                            type: "departmentAdmin",
                            level: 2,
                            threshold: 2
                        }
                    }
                },
                scope: "company",
                action: "set",
                companyId,
            }),

            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    });

    it("updateMultiLevelSettings, in entity. expect 403", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: true,
                    approversChain: {
                        1: { type: "anyone", level: 1, threshold: 0 },
                        3: { type: "namedUser", level: 3, threshold: 1, userIds: [userId] },
                    },
                },
                entityId: 'test-not-authorized',
                action: "set",
                companyId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userAdminInEntity
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(403);
    });

    it("updateMultiLevelSettings, test 1, valid settings in entity expect 200", async () => {
        const event = {
            body: JSON.stringify({
                data: { enabled: false },
                entityId,
                action: "set",
                companyId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        response = JSON.parse(response.body);
        expect(response.Attributes.itemData.multiLevelApproval.enabled).toBeFalsy();
    });

    it("updateMultiLevelSettings, test 2, disabled on company level 500", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: true,
                    approversChain: {
                        1: { type: "anyone", level: 1, threshold: 0 },
                        2: { type: "namedUser", level: 2, threshold: 1, userIds: [userAdminInEntity] },
                    }
                },
                entityId: entityId2,
                action: "set",
                companyId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(500);
    });

    it("updateMultiLevelSettings, test 3, level 200", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: true,
                    approversChain: {
                        1: { type: "anyone", level: 1, threshold: 0 },
                        2: { type: "namedUser", level: 2, threshold: 1, userIds: [userId] },
                    }
                },
                action: "set",
                companyId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        const event2 = {
            body: JSON.stringify({
                data: {
                    enabled: true,
                    approversChain: {
                        1: { type: "anyone", level: 1, threshold: 0 },
                        2: { type: "namedUser", level: 2, threshold: 1, userIds: [userAdminInEntity] },
                    }
                },
                entityId: entityId2,
                action: "set",
                companyId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        response = await wrapped.run(event2);
        expect(response.statusCode).toBe(200);
        response = JSON.parse(response.body);
        expect(response.Attributes.itemData.multiLevelApproval.enabled).toBeTruthy();
    });
    it("updateMultiLevelSettings, exclude department test - expect 200", async () => {
        const event = {
            body: JSON.stringify({
                data: {
                    enabled: true,
                    approversChain: {
                        1: { type: "anyone", level: 1, threshold: 0 },
                        2: { type: "namedUser", level: 2, threshold: 1, userIds: [userId] },
                    },
                    settingsOn: [entityId2],
                    settingsOff: [entityId],
                },
                action: "set",
                companyId,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)[1].Attributes.itemData).toEqual(
            {
                multiLevelApproval: {},
                otherSettings: "other entity Settings",
            }
        )
        expect(JSON.parse(response.body)[2].Attributes.itemData).toEqual(
            {
                multiLevelApproval: { userId: userId },
                otherSettings: "other entity Settings",
            }
        )
    });

    afterAll(async () => {
        await usersService.delete(userId, companyId);
        await usersService.delete(notAdminCompany.userId, companyId);
        await usersService.delete(userAdminEntity, companyId);
        await usersService.delete(companyAdminInEntity1.userId, companyAdminInEntity1.entityId);
        await usersService.delete(entityAdminInEntity1.userId, entityAdminInEntity1.entityId);
        await usersService.delete(companyAdminInEntity2.userId, companyAdminInEntity2.entityId);
        await usersService.delete(entityAdminInEntity2.userId, entityAdminInEntity2.entityId);
        await usersService.delete(companyAdminInEntity3.userId, companyAdminInEntity3.entityId);
        await usersService.delete(entityAdminInEntity3.userId, entityAdminInEntity3.entityId);
        await settingsService.delete(`comp_${companyId}`);
        await settingsService.delete(`entity_${entityId}`);
        await settingsService.delete(`entity_${entityId2}`);
        await settingsService.delete(`entity_${entityId3}`);
    });

});
