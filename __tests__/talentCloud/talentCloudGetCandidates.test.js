'use strict';

const { _ } = require('lodash')
const { constants, CompaniesService, UsersService, CompanyProvidersService, jsonLogger, ListService } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const mod = require('../../src/talentCloud/getCandidates');
const jestPlugin = require('serverless-jest-plugin');
const handler = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'handler' });
const { SINGLE_FIELD_TO_PARAM_MAPPING, MULTI_FIELD_TO_PARAM_MAPPING } = require('../../src/talentCloud/constants')

const companyId = 'EXPLORE-PAGE-DATA-TEST-COMPANY-ID-1'
const entityId1 = 'EXPLORE-PAGE-DATA-TEST-ENTITY-ID-1';
const userId = 'EXPLORE-PAGE-DATA-TEST-USER-ID-1';
const jsonTalentId = 'de389578-2bdb-4d4b-953f-dc4f0f6df51b';
const talentId1 = 'talent_11111111-2222-3333-4444-55555555555b';
const talentId2 = 'talent_11111111-2222-3333-4444-55555555555c';
const jsonLoggerSpy = jest.spyOn(jsonLogger, 'info');
const talentCloudCommonEmail = 'check@stoketalent.com'
const pageIndex1 = 0;
const pageIndex2 = 2;
const pageSize = 5;

const basicEventData = {
    queryStringParameters: {
        companyId,
        index: pageIndex1
    },
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    candidatesFileData: {
        name: '/candidates.json',
        folder: 'talentCloudTests'
    }
}

const eventExecuteCategoryAndIds = {
    ...basicEventData,
    queryStringParameters: {
        categoryId: '8',
        companyId
    }, multiValueQueryStringParameters: {
        skillIds: ['1', '2', '3']
    }
};

const eventExecuteCategoryNoIds = {
    ...basicEventData,
    queryStringParameters: {
        categoryId: '8',
        companyId
    }
};

const eventExecuteCategoryNoCategory = {
    ...basicEventData,
    queryStringParameters: {
        companyId
    },
    multiValueQueryStringParameters: {
        skillIds: ['1', '2', '3'],
    }
};

const eventExecuteCategoryNoCategoryNoIds = {
    ...basicEventData,
    queryStringParameters: {
        companyId
    },
    multiValueQueryStringParameters: {}
};

const eventExecuteSubCategoryId = {
    ...basicEventData,
    queryStringParameters: {
        companyId,
        subCategoryId: '1'
    },
    multiValueQueryStringParameters: {}
};

const eventExecuteTalentId = {
    ...basicEventData,
    pathParameters: {
        companyId,
        candidateId: jsonTalentId
    },
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    }
};

const eventExecutePageSize = {
    ...basicEventData,
    queryStringParameters: {
        companyId,
        index: pageIndex1,
        size: pageSize
    },
    multiValueQueryStringParameters: {
        skillIds: ['1', '2', '3']
    }
}

const eventExecuteLastPageSize = {
    ...basicEventData,
    queryStringParameters: {
        companyId,
        index: pageIndex2,
        size: pageSize
    },
    multiValueQueryStringParameters: {
        skillIds: ['1', '2', '3']
    }
}

const entity1 = {
    itemId: `${constants.prefix.entity}${entityId1}`,
    itemData: {
        entityName: 'entity1'
    },
    companyId,
    itemStatus: constants.job.status.active
}

const user1 = {
    itemId: `${constants.prefix.userPoolId}${userId}`,
    userId,
    itemData: {
        userEmail: 'test+he+1+createmilestone@stoketalent.com'
    },
    companyId,
    itemStatus: constants.job.status.active
}

const companyAdmin = {
    userId,
    entityId: companyId,
    companyId: companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin
    }
};

const talent1 = {
    companyId: companyId,
    itemId: talentId1,
    itemData: {
        img: 'REAL_IMG1',
        firstName: 'TALENT',
        lastName: 'TALENT',
        email: 'talent1@stoketalent.com'
    },
    itemStatus: constants.companyProvider.status.registered,
}

const talent2 = {
    companyId: companyId,
    itemId: talentId2,
    itemData: {
        img: 'REAL_IMG2',
        firstName: 'TALENT',
        lastName: 'TALENT',
        email: talentCloudCommonEmail
    },
    itemStatus: constants.companyProvider.status.registered,
}

describe('talentCloudGetCategories get talents for category and skill', () => {
    beforeEach(async () => {
        let result = await usersService.create(companyAdmin);
        expect(result.userId).toBe(companyAdmin.userId);
        result = await companiesService.create(user1);
        expect(result.itemId).toBe(user1.itemId);
        result = await companiesService.create(entity1);
        expect(result.itemId).toBe(entity1.itemId);
    })

    afterAll(async () => {
        let result = await companiesService.delete(entity1.itemId);
        expect(result).toBe(true);
        result = await companiesService.delete(user1.itemId);
        expect(result).toBe(true);
        result = await usersService.delete(companyAdmin.userId, companyId);
        expect(result).toBe(true);
    });

    describe('by category and skill', () => {
        it('should return 200 status code and json with data', async () => {
            const response = await handler.run(eventExecuteCategoryAndIds)
            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.body).length).toBe(10)
        });

        it('should return 200 status code and json with data when no skill id array supplied', async () => {
            const response = await handler.run(eventExecuteCategoryNoIds)
            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.body).length).toBe(10)
        });

        it('should return 200 status code and json with data when no category supplied', async () => {
            const response = await handler.run(eventExecuteCategoryNoCategory)
            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.body).length).toBe(10)
        });

        it('should return 403 when no category and no ids are sent', async () => {
            const response = await handler.run(eventExecuteCategoryNoCategoryNoIds)
            expect(response.statusCode).toBe(403);
        });

        describe('talentCloudGetCandidates by sub category id', () => {
            it('should return 200 status code and json with talent data', async () => {
                const response = await handler.run(eventExecuteSubCategoryId)
                expect(response.statusCode).toBe(200);
                expect(JSON.parse(response.body).length).toBe(10);
            });
        })
    });

    describe('talentCloudGetCandidates by id', () => {
        beforeEach(async () => {
            jest.spyOn(ListService.prototype, 'get').mockImplementation(async () => {
                return {
                    [`${jsonTalentId}`]: {
                        "active": true,
                        "id": `${jsonTalentId}`
                    }
                }
            });
        })
        it('should return 200 status code and json with talent data', async () => {
            const response = await handler.run(eventExecuteTalentId)
            expect(response.statusCode).toBe(200);
            const parsedJson = JSON.parse(response.body)
            expect(parsedJson.length).toBe(1);
            expect(parsedJson[0].markedAsFavourite).toBe(true)
        });
    })

    describe('predefined filters', () => {
        describe('talentCloudGetCandidates filter by all relevant single field filters', () => {
            Object.keys(SINGLE_FIELD_TO_PARAM_MAPPING).forEach((fieldName) => {
                const mockValue = ['a', 'b', 'c'][Math.floor(Math.random() * 3)]
                const dataWithParams = { ...basicEventData, queryStringParameters: { companyId } }
                dataWithParams.queryStringParameters[`${SINGLE_FIELD_TO_PARAM_MAPPING[fieldName]}`] = mockValue
                it('should return 200 status code and json with talent data', async () => {
                    const response = await handler.run(dataWithParams)
                    expect(response.statusCode).toBe(200);
                    expect(jsonLoggerSpy).toHaveBeenCalled()
                });
            })
        })

        describe('talentCloudGetCandidates filter by all relevant multi field filters', () => {
            Object.keys(MULTI_FIELD_TO_PARAM_MAPPING).forEach((fieldName) => {
                const mockValue = ['a', 'b', 'c'][Math.floor(Math.random() * 3)]
                const dataWithParams = { ...basicEventData, queryStringParameters: { companyId } }
                dataWithParams.queryStringParameters[`${MULTI_FIELD_TO_PARAM_MAPPING[fieldName]}`] = mockValue

                it('should return 200 status code and json with talent data', async () => {
                    const response = await handler.run(dataWithParams)
                    expect(response.statusCode).toBe(200);
                    expect(jsonLoggerSpy).toHaveBeenCalled()
                });
            })
        })
    })

    describe('pagination support', () => {
        it('should return 200 status code and json with data that is limited by page size', async () => {
            const response = await handler.run(eventExecutePageSize)
            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.body).length).toBe(5);
        });

        it('should return 200 status code and json with page contains less than full page (last page)', async () => {
            const response = await handler.run(eventExecuteLastPageSize)
            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.body).length).toBe(3);
        });
    })

    describe('set exist provider/talent data in talent could data', () => {
        it('should return 200 status code, talents have exist talent email will return with this talent data', async () => {
            let response = await handler.run(eventExecuteTalentId)
            expect(response.statusCode).toBe(200);
            let body = JSON.parse(response.body)[0];
            expect(body.talentId).toBeUndefined();

            response = await companyProvidersService.create(talent1);
            expect(response.itemId).toBe(talentId1);
            response = await companyProvidersService.create(talent2);
            expect(response.itemId).toBe(talentId2);

            response = await handler.run(eventExecuteTalentId)
            expect(response.statusCode).toBe(200);
            body = JSON.parse(response.body)[0];

            expect(body.talentId).toBe(talent2.itemId);
            expect(body.name).toBe(`${talent2.itemData.firstName} ${talent2.itemData.lastName}`);
            expect(body.img).toBe(talent2.itemData.img);

            response = await companyProvidersService.delete(companyId, talentId1);
            expect(response).toBe(true);
            response = await companyProvidersService.delete(companyId, talentId2);
            expect(response).toBe(true);
        })
    })
});

