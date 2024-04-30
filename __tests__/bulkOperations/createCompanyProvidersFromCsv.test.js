
'use strict';

const _ = require('lodash');
const mod = require('../../src/bulkOperations/createCompanyProvidersFromCsv');
const jestPlugin = require('serverless-jest-plugin');
const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });
const { UsersService, CompanyProvidersService, constants, SettingsService, TalentsService, prefixLib } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAndTagsAttributes);
const talentsService = new TalentsService(process.env.talentsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const { errorCodes, clearValueKeyword  } = require("../../src/bulkOperations/constansts");

const companyId = 'CREATE-PROVIDER-CSV-JEST-TEST-COMPANY-ID-1';
const userId = 'CREATE-PROVIDER-CSV-JEST-TEST-USER-ID-1';
const userId3 = 'CREATE-PROVIDER-CSV-JEST-TEST-USER-ID-3';
const userId4 = 'CREATE-PROVIDER-CSV-JEST-TEST-USER-ID-4';

const companyProviderId = `${constants.prefix.provider}${companyId}PROVIDER-ID-1`
const talentId = `${constants.prefix.talent}${companyProviderId}${constants.prefix.talent}TALENT-ID-1`;

const validationData = 'bulk/talents/validationData.csv'
const validationDataWithCustomFields = 'bulk/talents/validationDataWithCustomFields2.csv'
const validationDataWithCustomFieldsAndMultiTag = 'bulk/talents/validationDataWithCustomFieldsAndMultiTag3.csv'
const validationEmail = 'bulk/talents/validationErrorMail.csv'
const validationRequired = 'bulk/talents/validationErrorRequired.csv'
const allCustomFieldFileName = `bulk/talents/executeDataWithAllCustomFieldTypes.csv`
const customFieldWithBadEmail = `bulk/talents/executeDataWithAllCustomFieldTypesWrongEmail.csv`
const updateCustomFieldProvider = `bulk/talents/executeDataWithCustomFieldsToUpdate.csv`
const updateCustomFieldTalent = `bulk/talents/executeDataWithCustomFieldsToUpdateTalent.csv`
const updateCustomFieldProviderClearValue = `bulk/talents/executeDataWithCustomFieldsToUpdateClearValue.csv`

const settingsDefault = {
    itemId: `comp_${constants.defaultCompanySettings.id}`,
    companyId,
    itemData: {
        talentCustomFields: {
            fields: [
                {
                    id: 'stoke::talentId',
                    name: 'Talent ID',
                    type: 'string',
                },
                { id: 'talent_string_field_name', name: 'talent_string_field_name', type: 'string' },
            ]
        },
        customFields: {
            talent: [{
                id: 'stoke::talentId',
                name: 'Talent ID',
                type: 'multiselect',
                options: ['aaa', 'bbb', 'ccc']
            }, { id: 'talent_string_field_name', name: 'talent_string_field_name', type: 'string' }],
            companyProvider: [
                {
                    id: 'stoke::providerId',
                    name: 'Provider ID',
                    type: 'string',
                },
                { id: 'provider_string_field_name', name: 'provider_string_field_name', type: 'string' },
                { id: 'provider_multiselect_field_name', name: 'provider_multiselect_field_name', type: 'multiselect', options: ['aaa', 'bbb', 'ccc'] },
                { id: 'provider_number_field_name', name: 'provider_number_field_name', type: 'number' },
                { id: 'provider_checkbox_field_name', name: 'provider_checkbox_field_name', type: 'checkbox' },
                { id: 'provider_email_field_name', name: 'provider_email_field_name', type: 'email' },
                { id: 'talent_email_field_name', name: 'talent_email_field_name', type: 'email' }
            ]
        },
    }
};

const settings = {
    itemId: `comp_${companyId}`,
    companyId,
    itemData: {
        customFields: {
            companyProvider: [
                {
                    id: 'stoke::providerId2',
                    name: 'Provider ID2'
                },

            ],
            talentCustomFields: {
                fields: [
                    {
                        id: 'stoke::talentId',
                        name: 'Talent ID',
                    },
                ]
            },
        }
    }
};


const companyAdmin = {
    userId,
    entityId: companyId,
    companyId: companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        email: 'abc@gmail.com'
    }
};

const company3Admin = {
    userId: userId3,
    entityId: companyId,
    companyId: companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin
    }
};

const company4Admin = {
    userId: userId4,
    entityId: companyId,
    companyId: companyId,
    createdBy: userId4,
    modifiedBy: userId4,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin
    }
};

const eventExecute = {
    body:
        JSON.stringify({ companyId, key: validationData, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventExecuteWithCustomFields = {
    body:
        JSON.stringify({ companyId, key: validationDataWithCustomFields, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventExecuteWithTagsCustomFields = {
    body:
        JSON.stringify({ companyId, key: validationDataWithCustomFieldsAndMultiTag, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};


const eventValidationData = {
    body:
        JSON.stringify({ companyId, key: validationData, command: 'dataValidation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventValidationEmail = {
    body:
        JSON.stringify({ companyId, key: validationEmail, command: 'validation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventValidationRequired = {
    body:
        JSON.stringify({ companyId, key: validationRequired, command: 'validation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventErrorPath = {
    body:
        JSON.stringify({ companyId, key: 'ssssssssssss', command: 'validation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventErrorMissingParams = {
    body:
        JSON.stringify({ companyId }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventErrorAuth = {
    body:
        JSON.stringify({ companyId }),
    requestContext: {
        identity: {
            cognitoIdentityId: 'userId'
        }
    },
};

const eventExecuteWithAllCustomFields = {
    body:
        JSON.stringify({ companyId, key: allCustomFieldFileName, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId3
        }
    },
};

const eventExecuteWithBadEmailCustomFields = {
    body:
        JSON.stringify({ companyId, key: customFieldWithBadEmail, command: 'dataValidation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: company4Admin.userId
        }
    },
};

const eventDataValidationWithUpdateProviderCustomFields = {
    body:
        JSON.stringify({ companyId, key: updateCustomFieldProvider, command: 'dataValidation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId3
        }
    },
};

const eventValidationWithUpdateProviderCustomFields = {
    body:
        JSON.stringify({ companyId, key: updateCustomFieldProvider, command: 'validation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId3
        }
    },
};


const eventExecuteWithUpdateProviderCustomFields = {
    body:
        JSON.stringify({ companyId, key: updateCustomFieldProvider, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId3
        }
    },
};

const eventValidationWithUpdateTalentCustomFields = {
    body:
        JSON.stringify({ companyId, key: updateCustomFieldTalent, command: 'dataValidation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId3
        }
    },
};

const eventExecuteWithUpdateTalentCustomFields = {
    body:
        JSON.stringify({ companyId, key: updateCustomFieldTalent, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId3
        }
    },
};

const eventExecuteWithUpdateProviderClearValueCustomFields = {
    body:
        JSON.stringify({ companyId, key: updateCustomFieldProviderClearValue, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId3
        }
    },
};


const csvTalentsIdsToDelete = []

describe('createCompanyProvidersFromCsv', () => {
    beforeEach(async () => {
        let result = await usersService.create(companyAdmin);
        expect(result.userId).toBe(companyAdmin.userId);
        result = await settingsService.create(settingsDefault);
        expect(result.itemId).toBe(settingsDefault.itemId);
        result = await settingsService.create(settings);
        expect(result.itemId).toBe(settings.itemId);
    });

    it('create company providers, validation data 200 ', async () => {
        const response = await wrapped.run(eventValidationData);
        expect(response.statusCode).toBe(200);
        let result = JSON.parse(response.body);
        expect(result.rowsError.length).toBe(0);
        expect(result.rowsWithoutError.length).toBe(7);
        result = await companyProvidersService.listCompany(companyId)
        expect(result.length).toBe(0);
    });

    it('create company providers, execute data with custom field 200 ', async () => {
        const response = await wrapped.run(eventExecuteWithCustomFields);
        expect(response.statusCode).toBe(200);
        let result = await companyProvidersService.getByEmail(companyId, 'csvtest+custom+42@stoketalent.com', 'email')
        csvTalentsIdsToDelete.push(result[0].itemId)
        expect(result.length).toBe(1);
        expect(result[0].tags).toMatchObject({ 'stoke::talentId': ['1'] });
        result = await companyProvidersService.getByEmail(companyId, 'csvtest+custom+41@stoketalent.com', 'providerEmail')
        expect(result.length).toBe(1);
        expect(result[0].tags).toMatchObject({
            'stoke::providerId': "1",
            'stoke::providerId2': "1",
        });

        result = await companyProvidersService.getByEmail(companyId, 'csvtest+ofrit+talent@stoketalent.com', 'email')
        expect(result.length).toBe(1);
        expect(result[0].tags).toMatchObject({
            "stoke::talentId": ["2"]
        });

    });

    it('create company providers, execute data 200 ', async () => {
        const response = await wrapped.run(eventExecute);
        expect(response.statusCode).toBe(200);
        const result = await companyProvidersService.listCompany(companyId)
        csvTalentsIdsToDelete.push((_.map(result, res => prefixLib.isTalent(res.itemId) && res.itemId).filter(Boolean)))
        const body = JSON.parse(response.body);
        expect(result.length).toBe(21);
        expect(body).toHaveProperty('result.rowsWithTalentId');
        expect(body).toHaveProperty('result.rowsWithTalentIsNotPayable');
        expect(body.result.rowsWithTalentId).toHaveLength(0);
        expect(body.result.rowsWithTalentIsNotPayable).toHaveLength(6);

        const hiredByStokeTalents = result.filter(item => item.itemData.isHireByStoke === true)
        expect(hiredByStokeTalents).toHaveLength(1);
        expect(hiredByStokeTalents[0].itemData.isHireByStoke).toBe(true);
        expect(hiredByStokeTalents[0].itemData.email).toBe('csvtest+hiredbystoke@stoketalent.com');
    });

    it('create company providers, validation error data 200 ', async () => {
        const response = await wrapped.run(eventValidationData);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.rowsError.length).toBe(2);
        expect(result.rowsWithoutError.length).toBe(5);
    });

    it('create company providers, validation email 200 ', async () => {
        const response = await wrapped.run(eventValidationEmail);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.rowsError[0]).toBe("Value for column Talent Email is not Correct - in line 5");
    });


    it('csv createMilestones, validation required 200 ', async () => {
        const response = await wrapped.run(eventValidationRequired);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.rowsError[0]).toBe("Missing value for required column Talent First name - in line 2");
    });

    it('create company providers, missing file expect 500 ', async () => {
        const response = await wrapped.run(eventErrorPath);
        expect(response.statusCode).toBe(500);
    });

    it('create company providers, missing params expect 500 ', async () => {
        const response = await wrapped.run(eventErrorMissingParams);
        expect(response.statusCode).toBe(500);

    });

    it('create company providers, expect 403 ', async () => {
        const response = await wrapped.run(eventErrorAuth);
        expect(response.statusCode).toBe(403);
    });

    it('create company providers, execute data with multi tags in custom field ', async () => {
        let result = await companyProvidersService.getByEmail(companyId, 'csvtest+custom+42@stoketalent.com', 'email')

        if (result) {
            await companyProvidersService.delete(companyId, result[0].itemId)
        }
        const response = await wrapped.run(eventExecuteWithTagsCustomFields);
        expect(response.statusCode).toBe(200);
        result = await companyProvidersService.getByEmail(companyId, 'csvtest+custom+42@stoketalent.com', 'email')
        csvTalentsIdsToDelete.push(result[0].itemId)
        expect(result.length).toBe(1);
        expect(result[0].tags).toMatchObject({ 'stoke::talentId': ['aaa', 'bbb', 'ccc'] });
    });

    describe('custom fields support', () => {
        beforeEach(async () => {
            await settingsService.create(settingsDefault);
            await settingsService.create(settings);
            await usersService.create(company3Admin);
            await usersService.create(company4Admin);
        });
        
        afterEach(async () => {
            await settingsService.delete(settings.itemId);
            await usersService.delete(company3Admin.userId, company3Admin.companyId);
            await usersService.delete(company4Admin.userId, company4Admin.companyId);
        });
        
        it('should support all unique custom fields in the relevant format', async () => {
            const response = await wrapped.run(eventExecuteWithAllCustomFields);
            expect(response.statusCode).toBe(200);

            const result = await companyProvidersService.getByEmail(companyId, 'csvtest+custom+43@stoketalent.com', 'email')
            csvTalentsIdsToDelete.push(result[0].itemId);
            expect(result.length).toBe(1);
        })
        
        it('should fail for non valid email', async () => {
            const response = await wrapped.run(eventExecuteWithBadEmailCustomFields);
            expect(response.statusCode).toBe(200);
            const result = JSON.parse(response.body);
            expect(result.rowsError.length).toBe(1);
            expect(result.rowsError[0].errors).toContain(errorCodes.emailCustomField)
        })

        describe('Update talents and provider custom field', () => {
            describe('Company Provider', () => {
                describe('Validations', () => {
                    beforeEach(async () => {
                        await companyProvidersService.delete(companyId, companyProviderId)
                    })

                    it('Should succeed when there is no talent email but there is a provider email', async () => {
                        const response = await wrapped.run(eventValidationWithUpdateProviderCustomFields);
                        expect(response.statusCode).toBe(200);
                        const result = JSON.parse(response.body);
                        expect(result.rowsError).toEqual([])
                    })
                })
                xdescribe('Commit', () => {
                    beforeEach(async () => {
                        await companyProvidersService.create({ itemId: companyProviderId, companyId, itemData: { email: 'test+provider1@test.com', providerEmail: 'test+provider1@test.com'  }});
                    })
    
                    afterEach(async () => {
                        await companyProvidersService.delete(companyId, companyProviderId)
                    })
    
                    it('Should update the value of a custom field', async () => {
                        const response = await wrapped.run(eventExecuteWithUpdateProviderCustomFields);
                        expect(response.statusCode).toBe(200);
                        const results = await companyProvidersService.getByEmail(companyId, 'test+provider1@test.com', 'email')
                        const provider = _.head(results)
                        expect(provider.tags).toMatchObject({ provider_string_field_name: 'abc@gmail.com' })
                    })
                })
            })


            describe('Clear value', () => {
                beforeEach(async () => {
                    await companyProvidersService.create({ itemId: companyProviderId, companyId, tags: { 
                        provider_string_field_name: 'DATA_DATA',
                        provider_multiselect_field_name: ['aaa','bbb'],
                    }, itemData: { email: 'test+provider1@test.com', providerEmail: 'test+provider1@test.com' }});
                })

                afterEach(async () => {
                    await companyProvidersService.delete(companyId, companyProviderId)
                })

                it(`Should clear the value of a string custom field when value is ${clearValueKeyword}`, async () => {
                    let results = await companyProvidersService.getByEmail(companyId, 'test+provider1@test.com', 'email')
                    const response = await wrapped.run(eventExecuteWithUpdateProviderClearValueCustomFields);
                    expect(response.statusCode).toBe(200);
                    results = await companyProvidersService.getByEmail(companyId, 'test+provider1@test.com', 'email')
                    const provider = _.head(results)
                    expect(provider.tags).toMatchObject({})
                })
            })

            describe('Talent', () => {
                xdescribe('Commit', () => {
                    beforeEach(async () => {
                        await companyProvidersService.create({ itemId: talentId, companyId, itemData: { email: 'test+talent1@test.com' }, itemStatus: constants.job.status.active });
                    })
    
                    afterEach(async () => {
                        await companyProvidersService.delete(companyId, talentId)
                    })
                
                    it('Should update the value of a custom field', async () => {
                        const response = await wrapped.run(eventExecuteWithUpdateTalentCustomFields);
                        expect(response.statusCode).toBe(200);
                        const results = await companyProvidersService.getByEmail(companyId, 'test+talent1@test.com', 'email')
                        const talent = _.head(results)
                        expect(talent.tags).toMatchObject({ talent_string_field_name: 'abc@gmail.com' })
                    })
                })
            })
        })
    })

    afterAll(async () => {
        await usersService.delete(userId, companyId);
        await settingsService.delete(settings.itemId);
        await settingsService.delete('comp_' + constants.defaultCompanySettings.id);
        const result = await companyProvidersService.listCompany(companyId)
        for (const item of result) {
            await companyProvidersService.delete(companyId, item.itemId)
        }
        for (const id of _.flatten(csvTalentsIdsToDelete)) {
            await talentsService.delete(id)
        }
    });
});
