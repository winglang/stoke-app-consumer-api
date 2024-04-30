/* eslint-disable prefer-destructuring */
/* eslint-disable no-undef */
/* eslint-disable max-lines-per-function */
"use strict";

const AWS = require('aws-sdk');
const mod = require("../src/settings");
const _ = require('lodash');

const { SettingsService, UsersService, CompaniesService, constants, formatterLib } = require("stoke-app-common-api");
const jestPlugin = require("serverless-jest-plugin");
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');

const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: "updateSettings" });
const settingsService = new SettingsService(process.env.settingsTableName);
const usersService = new UsersService(process.env.consumerAuthTableName);
const companiesService = new CompaniesService(
    process.env.customersTableName,
    constants.projectionExpression.defaultAttributes,
    constants.attributeNames.defaultAttributes
);
const documentClient = new AWS.DynamoDB.DocumentClient();
const userId = 'JEST-updateSettings-SUB-1234';
const entityId = 'entity-updateSettings-id-1';
const entityId2 = 'entity-updateSettings-id-2';
const entityId3 = 'entity-updateSettings-id-3';
const companyId = 'company-updateSettingsid-1';
const userIdNotAdmin = 'userIdNotAdmin';
const userAdminEntity = 'userAdminEntity';
const customNotAuthorisedLegalEntityUserId = 'not-authorised-user-legal'
const customAuthorisedLegalEntityUserId = 'authorised-user-legal'



const notAdminCompany = {
    userId: userIdNotAdmin,
    companyId,
    entityId: companyId,
    createdBy: userIdNotAdmin,
    modifiedBy: userIdNotAdmin,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user, isEditor: true
    }
};

const adminEntity = {
    userId: userAdminEntity,
    companyId,
    entityId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin, isEditor: true
    }
};

const notAdminEntity = {
    userId: userIdNotAdmin,
    companyId,
    entityId,
    createdBy: userIdNotAdmin,
    modifiedBy: userIdNotAdmin,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user, isEditor: true
    }
};

const notAuthorisedCustomLegalRole = {
    userId: customNotAuthorisedLegalEntityUserId,
    companyId,
    entityId: companyId,
    createdBy: userIdNotAdmin,
    modifiedBy: userIdNotAdmin,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin, isEditor: true,
        permissionsComponents: {
            [permissionsComponentsKeys.legal]: { isEditor: false },
          }
    }
};

const authorisedCustomLegalRole = {
    userId: customAuthorisedLegalEntityUserId,
    companyId,
    entityId: companyId,
    createdBy: userIdNotAdmin,
    modifiedBy: userIdNotAdmin,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin, isEditor: true,
        permissionsComponents: {
            [permissionsComponentsKeys.legal]: { isEditor: true },
          }
    }
};

//////////////////////
// data for beforeAll
//////////////////////
const entityInCompany = {
    companyId,
    itemId: constants.prefix.entity + entityId,
    userId: userId,
    itemData: {
        entityName: "legalEnitiyTest"
    }
};
const entity2InCompany = {
    companyId,
    itemId: constants.prefix.entity + entityId2,
    userId: userId,
    itemData: {
        entityName: "legalEntity2Test"
    }
};
const entity3InCompany = {
    companyId,
    itemId: `${constants.prefix.entity}${entityId3}`,
    userId: userId,
    itemData: {
        entityName: "legalEntity3Test"
    }
};
const companySettings = {
    itemId: constants.prefix.company + companyId,
    userId: userId,
    companyId,
    entityId: companyId,
    itemStatus: constants.settings.status.active,
    itemData: {
        limitedJobPostCount: 0,
        legalEntities: {
            LE_Default: {
                legalDocs: { ipAssignment: "document", nda: "document", nonCompete: "document" },
                location: "LE_LOCATION_1",
                displayName: 'LE_LOCATION_',
                isDefault: 'true'
            }
        }
    }
};


//////////////////////
// updateSettings, create first LegalEntity expect 200
//////////////////////
const legalEntity1name = "LE_NAME_1";
const legalEntity1data = {
    location: "LE_LOCATION_1",
    displayName: "LE_DISPLAYNAME_1",
    legalDocs: { ipAssignment: "document", nda: "document", nonCompete: "document" },
}

const expectedResult1 = {
    LE_Default: {
        legalDocs: { ipAssignment: "document", nda: "document", nonCompete: "document" },
        location: "LE_LOCATION_1",
        displayName: 'LE_LOCATION_',
        isDefault: 'true'
    },
    LENAME1: {
        legalDocs: { ipAssignment: "document", nda: "document", nonCompete: "document" },
        location: "LE_LOCATION_1",
        displayName: "LE_DISPLAYNAME_1",
    },
}

//////////////////////
// updateSettings, create second LegalEntity expect 200
//////////////////////
const legalEntity2name = "LE_NAME_2";

const legalEntity2data = {
    location: "LE_LOCATION_2",
    displayName: "LE_DISPLAYNAME_2",
    legalDocs: { ipAssignment: "document", nda: "document", nonCompete: "document" },
    workspacesIds: [entityId3],
}

const expectedResult2 = {
    LE_Default: {
        legalDocs: { ipAssignment: "document", nda: "document", nonCompete: "document" },
        location: "LE_LOCATION_1",
        displayName: 'LE_LOCATION_',
        isDefault: 'true'
    },
    LENAME1: {
        legalDocs: { ipAssignment: "document", nda: "document", nonCompete: "document" },
        location: "LE_LOCATION_1",
        displayName: "LE_DISPLAYNAME_1",
    },
    LENAME2: {
        legalDocs: { ipAssignment: "document", nda: "document", nonCompete: "document" },
        location: "LE_LOCATION_2",
        displayName: "LE_DISPLAYNAME_2",
    },
}

const expectedResult3 = {
    LENAME1: {
        legalDocs: { ipAssignment: "document", nda: "document", nonCompete: "document" },
        location: "LE_LOCATION_1",
        displayName: "LE_DISPLAYNAME_1",
    },
    LENAME2: {
        legalDocs: { ipAssignment: "document", nda: "document", nonCompete: "document" },
        location: "LE_LOCATION_2",
        displayName: "LE_DISPLAYNAME_2",
        isDefault: "true"
    },
    LE_Default: {
        legalDocs: { ipAssignment: "document", nda: "document", nonCompete: "document" },
        location: "LE_LOCATION_1",
        displayName: 'LE_LOCATION_',
    }
}

//////////////////////
// updateSettings, create first LegalEntity expect 200 authorised custom role
//////////////////////
const legalEntity3name = "LE_NAME_3";
const legalEntity3data = {
    location: "LE_LOCATION_3",
    displayName: "LE_DISPLAYNAME_3",
    legalDocs: { ipAssignment: "document", nda: "document", nonCompete: "document" },
}

const expectedResultAuthorisedCustomRole = [
        {
            location: 'LE_LOCATION_1',
            displayName: 'LE_LOCATION_',
            legalDocs: {
              ipAssignment: 'document',
              nonCompete: 'document',
              nda: 'document'
            }
        },
        {
            location: 'LE_LOCATION_3',
            displayName: 'LE_DISPLAYNAME_3',
            legalDocs: {
              ipAssignment: 'document',
              nonCompete: 'document',
              nda: 'document'
            }
        },
        {
            location: 'LE_LOCATION_1',
            displayName: 'LE_DISPLAYNAME_2Tag',
            legalDocs: {
              ipAssignment: 'documentTag',
              nonCompete: 'documentTag',
              nda: 'documentTag'
            }
        },
        {
            location: 'LE_LOCATION_2',
            isDefault: 'true',
            legalDocs: {
              ipAssignment: 'document',
              nonCompete: 'document',
              nda: 'document'
            },
            displayName: 'LE_DISPLAYNAME_2'
        }
    ]

// ////////////////////
// change in legal entity , expext 200
// ////////////////////
const legalEntity1withChange = {
    location: "LE_LOCATION_1",
    displayName: "LE_DISPLAYNAME_2Tag",
    legalDocs: { ipAssignment: "documentTag", nda: "documentTag", nonCompete: "documentTag" }
}

const getLegalEntityName = (settings, leName) => {
    const legalEntities = settings.itemData.legalEntities;
    return _.find(Object.keys(legalEntities), le => le.startsWith(formatterLib.formatName(leName)))
}

describe("updateSettings", () => {
    beforeAll(async () => {
        await usersService.create({
            userId,
            entityId: companyId,
            companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin, isEditor: true
            }
        });
        await usersService.create({
            userId,
            entityId,
            companyId,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin, isEditor: true
            }
        });
        await usersService.create(notAdminCompany);
        await usersService.create(notAdminEntity);
        await usersService.create(adminEntity);
        await usersService.create(notAuthorisedCustomLegalRole);
        await usersService.create(authorisedCustomLegalRole);
        await settingsService.create({
            itemId: `user_${userId}`,
            userId: userId,
            entityId,
            companyId,
            itemData: {}
        });
        await settingsService.create({
            itemId: `${constants.prefix.entity}${entityId}`,
            userId: userId,
            entityId,
            companyId,
            itemData: {}
        });
        await settingsService.create({
            itemId: `${constants.prefix.entity}${entityId2}`,
            userId: userId,
            entityId,
            companyId,
            itemData: {}
        });
        await settingsService.create({
            itemId: `${constants.prefix.entity}${entityId3}`,
            userId: userId,
            entityId,
            companyId,
            itemData: {}
        });
        await companiesService.create(entityInCompany);
        await companiesService.create(entity2InCompany);
        await companiesService.create(entity3InCompany);
        const result = await settingsService.create(companySettings);
        expect(result.itemId).toBe(`comp_${companyId}`);

    })

    it("updateSettings, expect 200", async () => {
        const event = {
            body: JSON.stringify({
                data: ['talent-id-1'],
                action: 'add',
                companyId: companyId,
                scope: "user",
                setting: "favorites",
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).Attributes.itemData).toEqual({
            favorites: ['talent-id-1']
        })
        const filtersEvent = {
            body: JSON.stringify({
                data: {
                    talentSearchFilters: {
                        filterName: 'filter1',
                        filterDetails: { skills: ['123'], languages: ['234'] }
                    },
                },
                action: 'set',
                companyId: companyId,
                scope: 'user',
                setting: 'filters',
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        response = await wrapped.run(filtersEvent);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).Attributes.itemData).toEqual({
            favorites: ['talent-id-1'],
            filters: {
                talentSearchFilters: {
                    filterName: 'filter1',
                    filterDetails: { skills: ['123'], languages: ['234'] }
                }
            }
        })

        await usersService.update({
            userId, entityId: companyId, modifiedBy: userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: false
            }
        });
        response = await wrapped.run(event);
        expect(response.statusCode).toBe(200); //user can update settings of himself even if not an editor
        await usersService.update({
            userId, entityId: companyId, modifiedBy: userId, itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        })
    })

    it("exclude department test - expect 200", async () => {
        const eventExclude = {
            body: JSON.stringify({
                data: {
                    amount: 10,
                    settingsOn: [entityId2],
                    settingsOff: [entityId],
                },
                action: 'set',
                companyId: companyId,
                scope: "company",
                setting: "autoApproveBudgetRequestThresholds",
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        let response = await wrapped.run(eventExclude);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)[1].Attributes.itemData).toEqual(
            {
                autoApproveBudgetRequestThresholds: {},
            }
        )
        expect(JSON.parse(response.body)[2].Attributes.itemData).toEqual(
            {
                autoApproveBudgetRequestThresholds: { userId: userId },
            }
        )
    })
    it("set legalEntity of the department - expect 500", async () => {
        const event = {
            body: JSON.stringify({
                data: 'LE_NAME_1_not_exist',
                action: 'add',
                companyId,
                scope: 'entity',
                entityId,
                setting: "legalEntities",
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

    it("updateSettings, create first LegalEntity expect 200", async () => {
        const event = {
            body: JSON.stringify({
                data: legalEntity1data,
                action: 'set',
                companyId: companyId,
                scope: 'company',
                setting: `legalEntities.${legalEntity1name}`,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        expect(Object.values(JSON.parse(response.body).Attributes.itemData.legalEntities)).toEqual(Object.values(expectedResult1));

    });

    it("updateSettings, create second LegalEntity expect 200", async () => {
        const event = {
            body: JSON.stringify({
                data: legalEntity2data,
                action: 'set',
                companyId: companyId,
                scope: 'company',
                setting: `legalEntities.${legalEntity2name}`
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        const settings = JSON.parse(response.body).Attributes;
        const newLE = getLegalEntityName(settings, legalEntity2name)
        expect(newLE).toBeTruthy();
        const legalEntities = settings.itemData.legalEntities;
        expect(_.size(legalEntities)).toBe(3);
        expect(legalEntities[newLE]).toEqual(expectedResult2.LENAME2);
        const entityData = await settingsService.get(`${constants.prefix.entity}${entityId3}`)
        const entityDataLegalDisplayName = _.get(entityData, 'itemData.legalEntity.displayName')
        expect(entityDataLegalDisplayName).toEqual(legalEntity2data.displayName)

    });

    it("updateSettings, change default LegalEntity expect 200", async () => {
        const settings = await settingsService.get(`${constants.prefix.company}${companyId}`);
        const leName = getLegalEntityName(settings, legalEntity2name)
        const event = {
            body: JSON.stringify({
                data: { ...legalEntity2data, isDefault: 'true' },
                action: 'set',
                companyId: companyId,
                scope: 'company',
                setting: `legalEntities.${leName}`,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).Attributes.itemData.legalEntities[leName]).toEqual(expectedResult3.LENAME2);
        expect(JSON.parse(response.body).Attributes.itemData.legalEntities.LE_Default).toEqual(expectedResult3.LE_Default);

    });

    it("set invalid legalEntity to department - expect 500", async () => {
        const event = {
            body: JSON.stringify({
                data: 'LE_NAME_3',
                action: 'add',
                companyId,
                scope: 'entity',
                entityId,
                setting: "legalEntities"
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

    it("change in exisiting legal entity , expext 200", async () => {
        const settings = await settingsService.get(`${constants.prefix.company}${companyId}`);
        const leName = getLegalEntityName(settings, legalEntity1name)
        const event = {
            body: JSON.stringify({
                data: legalEntity1withChange,
                action: 'set',
                companyId: companyId,
                scope: 'company',
                setting: `legalEntities.${leName}`,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).Attributes.itemData.legalEntities[leName]).toEqual(legalEntity1withChange);
    });

    it("update allowTalentsToRequestPaymentSettings will update uploadInvoicesNotifiction", async () => {
        const body = {
            data: { enabled: true },
            action: 'set',
            companyId: companyId,
            scope: 'company',
            setting: `allowTalentsToRequestPaymentSettings`,
        }
        const event = {
            body: JSON.stringify(body),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response1 = await wrapped.run(event);
        expect(response1.statusCode).toBe(200);
        const settings1 = await settingsService.get(`${constants.prefix.company}${companyId}`);
        expect(settings1.itemData.uploadInvoicesNotifiction).toEqual(true);
        
        body.data = { enabled: false }
        event.body = JSON.stringify(body)
        const response2 = await wrapped.run(event);
        expect(response2.statusCode).toBe(200);
        const settings2 = await settingsService.get(`${constants.prefix.company}${companyId}`);
        expect(settings2.itemData.uploadInvoicesNotifiction).toEqual(false);
    });

    it("updateSettings, create first LegalEntity expect 200 by aithorised legal entity custom role", async () => {
        const event = {
            body: JSON.stringify({
                data: legalEntity3data,
                action: 'set',
                companyId: companyId,
                scope: 'company',
                setting: `legalEntities.${legalEntity3name}`,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: userId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        expect(_.find(expectedResultAuthorisedCustomRole, entity => entity?.displayName === Object.values(JSON.parse(response.body).Attributes.itemData.legalEntities)[0].displayName)).toBeTruthy()
        expect(_.find(expectedResultAuthorisedCustomRole, entity => entity?.displayName === Object.values(JSON.parse(response.body).Attributes.itemData.legalEntities)[1].displayName)).toBeTruthy()
        expect(_.find(expectedResultAuthorisedCustomRole, entity => entity?.displayName === Object.values(JSON.parse(response.body).Attributes.itemData.legalEntities)[2].displayName)).toBeTruthy()
        expect(_.find(expectedResultAuthorisedCustomRole, entity => entity?.displayName === Object.values(JSON.parse(response.body).Attributes.itemData.legalEntities)[3].displayName)).toBeTruthy()
    });


    it("updateSettings, legal entities setting by not authorised user, expect fail", async () => {
        const event = {
            body: JSON.stringify({
                data: legalEntity1data,
                action: 'set',
                companyId: companyId,
                scope: 'company',
                setting: `legalEntities.${legalEntity1name}`,
            }),
            requestContext: {
                identity: {
                    cognitoIdentityId: customNotAuthorisedLegalEntityUserId
                }
            },
        };
        const response = await wrapped.run(event);
        expect(response.statusCode).toBe(403);

    });

    afterAll(async () => {
        let result = await usersService.delete(userId, entityId);
        expect(result).toBe(true);
        result = await settingsService.delete(`user_${userId}`);
        expect(result).toBe(true);
        result = await usersService.delete(userIdNotAdmin, entityId);
        expect(result).toBe(true);
        result = await usersService.delete(userAdminEntity, entityId);
        expect(result).toBe(true);
        result = await usersService.delete(userIdNotAdmin, companyId);
        expect(result).toBe(true);
        result = await usersService.delete(notAuthorisedCustomLegalRole, companyId);
        expect(result).toBe(true);
        result = await usersService.delete(authorisedCustomLegalRole, companyId);
        expect(result).toBe(true);
        result = await settingsService.delete(`comp_${companyId}`);
        expect(result).toBe(true);
        result = await settingsService.delete(`entity_${entityId}`);
        expect(result).toBe(true);
        result = await settingsService.delete(`entity_${entityId2}`);
        expect(result).toBe(true);
        result = await settingsService.delete(`entity_${entityId3}`);
        expect(result).toBe(true);
        await usersService.delete(userId, entityId);
        expect(result).toBe(true);
        await usersService.delete(userId, companyId);
        expect(result).toBe(true);
        await companiesService.delete(`entity_${entityId}`)
        expect(result).toBe(true);
        await companiesService.delete(`entity_${entityId2}`)
        expect(result).toBe(true);
        await companiesService.delete(`entity_${entityId3}`)
        expect(result).toBe(true);
    });

});
