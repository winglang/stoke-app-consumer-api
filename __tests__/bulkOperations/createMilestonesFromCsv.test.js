
'use strict';

const mod = require('../../src/bulkOperations/createMilestonesFromCsv');
const jestPlugin = require('serverless-jest-plugin');
const _ = require('lodash');
const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });
const { UsersService, CompanyProvidersService, BudgetsService, ExchangeRatesService, CompaniesService, JobsService, constants, SettingsService, TalentsService, errorCodes, BidsService, snsLib } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const talentsService = new TalentsService(process.env.talentsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const exchangeRatesService = new ExchangeRatesService(process.env.exchangeRatesTableName, constants.projectionExpression.providerAttributes, constants.attributeNames.providerAttributes, settingsService)
const bidsService = new BidsService(process.env.bidsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const { errorCodes: bulkOperationserrorCodes } = require('../../src/bulkOperations/constansts');
const OLD_ENV = process.env;
const snsLibSpy = jest.spyOn(snsLib, 'publish');
const { job } = require('stoke-app-common-api/config/constants');

const companyId = 'CREATE-MILESTONES-CSV-JEST-TEST-COMPANY-ID-1';
const companyId2 = 'CREATE-MILESTONES-CSV-JEST-TEST-COMPANY-ID-2';
const entityId1 = 'CREATE-MILESTONES-CSV-JEST-TEST-ENTITY-ID-1';
const entityId2 = 'CREATE-MILESTONES-CSV-JEST-TEST-ENTITY-ID-2';
const entityId3 = 'CREATE-MILESTONES-CSV-JEST-TEST-ENTITY-ID-3';
const providerId1 = `${constants.prefix.provider}CREATE-MILESTONES-CSV-JEST-TEST-TALENT-ID-1`
const providerId3 = `${constants.prefix.provider}CREATE-MILESTONES-CSV-JEST-TEST-TALENT-ID-3`
const providerId4 = `${constants.prefix.provider}CREATE-MILESTONES-CSV-JEST-TEST-TALENT-ID-4`
const providerId5 = `${constants.prefix.provider}CREATE-MILESTONES-CSV-JEST-TEST-TALENT-ID-5`
const providerId6 = `${constants.prefix.provider}CREATE-MILESTONES-CSV-JEST-TEST-TALENT-ID-6`
const providerId7 = `${constants.prefix.provider}CREATE-MILESTONES-CSV-JEST-TEST-TALENT-ID-7`
const talentId1 = `${constants.prefix.talent}${providerId1}${constants.prefix.talent}-TALENT-ID-1`;
const talentId2 = `${constants.prefix.talent}CREATE-MILESTONES-CSV-JEST-TEST-TALENT-ID-2`;
const talentId3 = `${constants.prefix.talent}${providerId3}`;
const talentId4 = `${constants.prefix.talent}${providerId4}`;
const talentId5 = `${constants.prefix.talent}${providerId5}`;
const talentId6 = `${constants.prefix.talent}${providerId6}`;
const talentId7 = `${constants.prefix.talent}${providerId7}`;
const userId = 'CREATE-MILESTONES-CSV-JEST-TEST-USER-ID-1';
const userId2 = 'CREATE-MILESTONES-CSV-JEST-TEST-USER-ID-2';
const userId3 = 'CREATE-MILESTONES-CSV-JEST-TEST-USER-ID-3';
const userId4 = 'CREATE-MILESTONES-CSV-JEST-TEST-USER-ID-4';
const jobId1 = `${constants.prefix.job}0000CREATE-MILESTONES-CSV-JEST-TEST-JOB-ID-1`
const jobId2 = `${constants.prefix.job}0000CREATE-MILESTONES-CSV-JEST-TEST-JOB-ID-2`
const msId1 = `${constants.prefix.milestone}${jobId1}_ms-1`
const msId2 = `${constants.prefix.milestone}${jobId1}_ms-2`
const validationData = 'bulk/milestones/validationData.csv'
const executeData = 'bulk/milestones/executeData.csv'
const executeDataWithCustomFields = 'bulk/milestones/executeDataWithCustomFields.csv'
const validationEmail = 'bulk/milestones/validationErrorMail.csv'
const validationRequired = 'bulk/milestones/validationErrorRequired3.csv'
const validationRequiredMandatoryFieldFilled = 'bulk/milestones/validationErrorRequired2.csv'
const validationRequiredWithoutMandatoryColumn = 'bulk/milestones/validationErrorRequired.csv'
const validationDataWithCustomFields = 'bulk/milestones/validationDataWithCustomFields2.csv'
const executedataWithCreateTalent = 'bulk/milestones/executedataWithCreateTalent.csv'
const executeDataCurrency = 'bulk/milestones/executeDataCurrency.csv'
const executeDataCustomRate = 'bulk/milestones/jobsWithCustomRateTest.csv'
const executeDataNoMilestoneTitle = 'bulk/milestones/missingMilestoneTitle.csv'
const notCompliantLegal = 'bulk/milestones/notCompliantLegal.csv'
const executeDataMilestoneUpdatePlannedAmount = 'bulk/milestones/executeDataMilestoneUpdate.csv'
const validateDataMilestoneUpdatePlannedAmountMissingId = 'bulk/milestones/executeDataMilestoneUpdateMissingId.csv'
const validateDataMilestoneUpdateNonExitingMS = 'bulk/milestones/executeDataMilestoneUpdateNonExitingMS.csv'
const validAndErrorOfferJobs = 'bulk/milestones/offerJobsWithErrors.csv'
const executeOfferJobs = 'bulk/milestones/offerJobsExecute.csv'
const executeOfferToFirstTalent = 'bulk/milestones/offerJobToFirstTalent.csv'
const executeOfferToSecondTalent = 'bulk/milestones/offerJobToSecondTalent.csv'

const settingsDefault = {
    itemId: `comp_${constants.defaultCompanySettings.id}`,
    companyId,
    itemData: {
        talentCustomFields: {
            fields: [
                {
                    id: 'stoke::talentId',
                    name: 'Talent ID',
                }
            ]
        },
        customFields: {
            companyProvider: [
                {
                    id: 'stoke::providerId',
                    name: 'Provider ID',
                    type: 'string',
                },
                { id: 'talent_string_field_name', name: 'talent_string_field_name', type: 'string' },
                { id: 'talent_number_field_name', name: 'talent_number_field_name', type: 'number' },
                { id: 'talent_checkbox_field_name', name: 'talent_checkbox_field_name', type: 'checkbox' },
                { id: 'talent_email_field_name', name: 'talent_email_field_name', type: 'email' },
            ],
            talent: [
                {
                    id: 'stoke::talentId',
                    name: 'Talent ID',
                    type: 'multiselect',
                    options: ['aaa', 'bbb', 'ccc'],
                },
            ]
        },
    }
};

const settings = {
    itemId: `comp_${companyId}`,
    companyId,
    itemData: {
        budgetModuleActive: false,
        customFields: {
            companyProvider: [
                {
                    id: 'stoke::providerId2',
                    name: 'Provider ID2'
                },
                {
                    id: 'stoke::providerId',
                    name: 'Provider ID',
                }
            ]
        },
        talentCustomFields: {
            fields: [
                {
                    id: 'stoke::talentId',
                    name: 'Talent ID',
                }
            ]
        },
        legalCompliancePolicy: {
            enabled: true,
            values: {
                requireLegalComplianceSettings: true,
                requireLegalDocsSignSettings: false
            }
        },
        jobsCustomFields: {
            fields: [
                {
                    contentType: 'job',
                    id: "test custom",
                    name: "test custom",
                    options: [],
                    type: "string",
                },
                {
                    contentType: "job",
                    id: "Tags custom field",
                    name: "Tags custom field",
                    options: [
                        'tag1',
                        'tag2'
                    ],
                    type: "multiselect",
                },
                {
                    contentType: 'job',
                    id: "mandatory custom field",
                    isCustomFieldRequired: false,
                    name: "mandatory custom field",
                    options: [],
                    type: "string",
                },
            ]
        },
        legalEntities: {
            "LEGALDOCS74167b30-76d7-11ed-9891-871cf14511d0": {
                "displayName": "LegalDocs",
                "isDefault": true,
                "legalDocs": {
                    "Service Agreement": {
                        "expirationMonths": 0,
                        "fileName": "Service_Agreement.pdf",
                        "id": "Service Agreement_f18505365bfd",
                        "policies": [
                            "always",
                            "sensitiveDataExposure",
                            "systemAccess",
                            "onSiteAccess"
                        ],
                        "s3Path": "legelEntities/LegalDocs/1670490371806-Service_Agreement.pdf",
                        "sendDocumentsToTalent": true,
                        "tags": [
                            "Service Agreement"
                        ],
                        "templateName": "Service Agreement"
                    }
                },
                "location": "IL"
            },
        }
    }
};

const settingsDefault2 = {
    itemId: `comp_${constants.defaultCompanySettings.id}2`,
    companyId: companyId2,
    itemData: {
        talentCustomFields: {
            fields: [
                {
                    id: 'stoke::talentId',
                    name: 'Talent ID',
                }
            ]
        },
        customFields: {
            companyProvider: [
                {
                    id: 'stoke::providerId',
                    name: 'Provider ID',
                    type: 'string',
                },
                { id: 'talent_string_field_name', name: 'talent_string_field_name', type: 'string' },
                { id: 'talent_number_field_name', name: 'talent_number_field_name', type: 'number' },
                { id: 'talent_checkbox_field_name', name: 'talent_checkbox_field_name', type: 'checkbox' },
                { id: 'talent_email_field_name', name: 'talent_email_field_name', type: 'email' },
            ],
            talent: [
                {
                    id: 'stoke::talentId',
                    name: 'Talent ID',
                    type: 'multiselect',
                    options: ['aaa', 'bbb', 'ccc'],
                },
            ]
        },
    }
};

const settings2 = {
    itemId: `comp_${companyId2}`,
    companyId: companyId2,
    itemData: {
        budgetModuleActive: false,
        customFields: {
            companyProvider: [
                {
                    id: 'stoke::providerId2',
                    name: 'Provider ID2'
                },
                {
                    id: 'stoke::providerId',
                    name: 'Provider ID',
                }
            ]
        },
        talentCustomFields: {
            fields: [
                {
                    id: 'stoke::talentId',
                    name: 'Talent ID',
                }
            ]
        },
        legalCompliancePolicy: {
            enabled: true,
            values: {
                requireLegalComplianceSettings: true,
                requireLegalDocsSignSettings: false
            }
        },
        jobsCustomFields: {
            fields: [
                {
                    contentType: 'job',
                    id: "test custom",
                    name: "test custom",
                    options: [],
                    type: "string",
                },
                {
                    contentType: "job",
                    id: "Tags custom field",
                    name: "Tags custom field",
                    options: [
                        'tag1',
                        'tag2'
                    ],
                    type: "multiselect",
                },
                {
                    contentType: 'job',
                    id: "mandatory custom field",
                    isCustomFieldRequired: true,
                    name: "mandatory custom field",
                    options: [],
                    type: "string",
                },
            ]
        },
    }
};


const budgetUser = {
    itemId: `${constants.prefix.user}${userId}`,
    entityId: entityId1,
    companyId,
    itemData: {
        '2022': {
            periods: 4,
            1: {
                available: 0,
                total: 0,
                approved: 0,

            },
            2: {
                available: 0,
                total: 0,
                approved: 0,

            },
            3: {
                available: 0,
                total: 0,
                approved: 0,

            },
            4: {
                available: 0,
                total: 0,
                approved: 0,

            }
        }
    }
};

const budgetUserE2 = {
    itemId: `${constants.prefix.user}${userId}`,
    entityId: entityId2,
    companyId,
    itemData: {
        '2022': {
            periods: 4,
            1: {
                available: 0,
                total: 0,
                approved: 0,

            },
            2: {
                available: 0,
                total: 0,
                approved: 0,

            },
            3: {
                available: 0,
                total: 0,
                approved: 0,

            },
            4: {
                available: 0,
                total: 0,
                approved: 0,

            }
        }
    }
};


const budgetUser2 = {
    itemId: `${constants.prefix.user}${userId2}`,
    entityId: entityId1,
    companyId,
    itemData: {
        '2022': {
            periods: 4,
            1: {
                available: 2000,
                total: 2000,
                approved: 2000,

            },
            2: {
                available: 2000,
                total: 2000,
                approved: 2000,

            },
            3: {
                available: 2000,
                total: 2000,
                approved: 2000,

            },
            4: {
                available: 2000,
                total: 2000,
                approved: 2000,

            }
        }
    }
};

const budgetUser2e2 = {
    itemId: `${constants.prefix.user}${userId2}`,
    entityId: entityId2,
    companyId,
    itemData: {
        '2022': {
            periods: 4,
            1: {
                available: 2000,
                total: 2000,
                approved: 2000,

            },
            2: {
                available: 2000,
                total: 2000,
                approved: 2000,

            },
            3: {
                available: 2000,
                total: 2000,
                approved: 2000,

            },
            4: {
                available: 2000,
                total: 2000,
                approved: 2000,

            }
        }
    }
};

const budgetEntity = {
    itemId: `${constants.prefix.entity}${entityId1}`,
    entityId: entityId1,
    companyId,
    itemData: {
        '2022': {
            periods: 4,
            1: {
                available: 0,
                total: 0,
                approved: 0,

            },
            2: {
                available: 0,
                total: 0,
                approved: 0,

            },
            3: {
                available: 0,
                total: 0,
                approved: 0,

            },
            4: {
                available: 0,
                total: 0,
                approved: 0,

            }
        }
    }
};

const budgetEntity2 = {
    itemId: `${constants.prefix.entity}${entityId2}`,
    entityId: entityId2,
    companyId,
    itemData: {
        '2022': {
            periods: 4,
            1: {
                available: 0,
                total: 0,
                approved: 0,

            },
            2: {
                available: 0,
                total: 0,
                approved: 0,

            },
            3: {
                available: 0,
                total: 0,
                approved: 0,

            },
            4: {
                available: 0,
                total: 0,
                approved: 0,

            }
        }
    }
};

const budgetCompanyPool = {
    itemId: `${constants.prefix.user}${userId}`,
    entityId: companyId,
    companyId,
    itemData: {
        '2022': {
            periods: 4,
            1: {
                available: 100000,
                total: 100000,
                approved: 0,

            },
            2: {
                available: 100000,
                total: 100000,
                approved: 1000,

            },
            3: {
                available: 100000,
                total: 100000,
                approved: 100000,

            },
            4: {
                available: 100000,
                total: 100000,
                approved: 100000,

            }
        }
    }
};

const job1 = {
    userId,
    itemId: jobId1,
    entityId: entityId1,
    companyId,
    createdBy: userId,
    itemData: {
        talentId: talentId1,
        jobTitle: 'job test1',
        totalBudget: 100,
    },
    itemStatus: constants.job.status.active
}

const job2 = {
    userId,
    itemId: jobId2,
    entityId: entityId1,
    companyId,
    createdBy: userId,
    itemData: {
        talentId: talentId1,
        jobTitle: 'DUMMY JOB TITLE',
        totalBudget: 100,
    },
    itemStatus: constants.job.status.active
}

const ms1 = {
    userId,
    itemId: msId1,
    entityId: entityId1,
    createdBy: userId,
    companyId,
    itemData: {
        title: 'exist ms',
        cost: 100,
        date: '2022-02-29'
    },
    itemStatus: constants.job.status.completed
}

const ms2 = {
    userId,
    itemId: msId2,
    entityId: entityId1,
    createdBy: userId,
    companyId,
    itemData: {
        title: 'exist ms',
        cost: 100,
        date: '2022-02-29'
    },
    itemStatus: constants.job.status.active
}

const companyAdmin = {
    userId,
    entityId: companyId,
    companyId: companyId,
    createdBy: userId,
    modifiedBy: userId2,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin
    }
};

const companyAdmin2 = {
    userId: userId2,
    entityId: companyId,
    companyId: companyId,
    createdBy: userId,
    modifiedBy: userId2,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin
    }
};

const companyAdmin3 = {
    userId: userId4,
    entityId: companyId2,
    companyId: companyId2,
    createdBy: userId,
    modifiedBy: userId2,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin
    }
};

const authUser1EntityId1 = {
    userId,
    entityId: entityId1,
    companyId: companyId,
    createdBy: userId,
    modifiedBy: userId2,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin
    }
}
const authUser1EntityId2 = {
    userId,
    entityId: entityId2,
    companyId: companyId,
    createdBy: userId,
    modifiedBy: userId2,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin
    }
}
const authUser2EntityId1 = {
    userId: userId2,
    entityId: entityId1,
    companyId: companyId,
    createdBy: userId,
    modifiedBy: userId2,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin
    }
}
const authUser2EntityId2 = {
    userId: userId2,
    entityId: entityId2,
    companyId: companyId,
    createdBy: userId,
    modifiedBy: userId2,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin
    }
}

const user2EntityId3 = {
    userId: userId3,
    entityId: entityId3,
    companyId: companyId,
    createdBy: userId,
    modifiedBy: userId3,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.user
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

const entity2 = {
    itemId: `${constants.prefix.entity}${entityId2}`,
    itemData: {
        entityName: 'entity2'
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

const user2 = {
    itemId: `${constants.prefix.userPoolId}${userId2}`,
    userId: userId2,
    itemData: {
        userEmail: 'test+he+2+createmilestone@stoketalent.com'
    },
    companyId,
    itemStatus: constants.job.status.active
}

const companyProvider1 = {
    itemId: providerId1,
    itemData: {
        providerEmail: 'test+talent+1+createmilestone@stoketalent.com',
        providerFirstName: 'test',
        providerLastName: 'test',
        isPayable: true
    },
    companyId,
    itemStatus: constants.job.status.active
}

const companyTalent1 = {
    itemId: talentId1,
    itemData: {
        email: 'test+talent+1+createmilestone@stoketalent.com',
        firstName: 'test',
        lastName: 'test'
    },
    companyId,
    itemStatus: constants.job.status.active
}

const companyTalent2 = {
    itemId: talentId2,
    itemData: {
        email: 'test+talent+2+createmilestone@stoketalent.com',
        firstName: 'test2',
        lastName: 'test2'
    },
    companyId,
    itemStatus: constants.job.status.active
}

const companyProvider3 = {
    itemId: providerId3,
    companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.companyProvider.status.active,
    itemData: {
        providerEmail: 'test+talent+legal+1+createmilestone@stoketalent.com',
        firstName: 'test',
        lastName: 'legal',
        isPayable: true,
        isProviderSelfEmployedTalent: true,
        legalCompliance: {
            score: "red",
            lastUpdated: "2022-12-12T08:16:23+00:00",
            contractElements: {
                "Service Agreement": {
                    documents: [],
                    status: "missing"
                }
            }
        }
    }
};

const companyProvider4 = {
    itemId: providerId4,
    companyId,
    itemStatus: constants.companyProvider.status.active,
    itemData: {
        providerEmail: 'test+talent+offer+jobs+1+createmilestone@stoketalent.com',
        firstName: 'create',
        lastName: 'offer',
        isPayable: true,
        isProviderSelfEmployedTalent: true,
    }
};

const companyTalent4 = {
    itemId: talentId4,
    itemData: {
        email: 'test+talent+offer+jobs+1+createmilestone@stoketalent.com',
        firstName: 'create',
        lastName: 'offer'
    },
    companyId,
    itemStatus: constants.job.status.active
}

const companyProvider5 = {
    itemId: providerId5,
    companyId,
    itemStatus: constants.companyProvider.status.active,
    itemData: {
        providerEmail: 'test+talent+offer+jobs+2+createmilestone@stoketalent.com',
        firstName: 'create2',
        lastName: 'offer2',
        isPayable: true,
        isProviderSelfEmployedTalent: true,
    }
};

const companyTalent5 = {
    itemId: talentId5,
    itemData: {
        email: 'test+talent+offer+jobs+2+createmilestone@stoketalent.com',
        firstName: 'create2',
        lastName: 'offer2'
    },
    companyId,
    itemStatus: constants.job.status.active
}

const companyProvider6 = {
    itemId: providerId6,
    companyId,
    itemStatus: constants.companyProvider.status.active,
    itemData: {
        providerEmail: 'test+talent+offer+jobs+3+createmilestone@stoketalent.com',
        firstName: 'create3',
        lastName: 'offer3',
        isPayable: true,
        isProviderSelfEmployedTalent: true,
    }
};

const companyTalent6 = {
    itemId: talentId6,
    itemData: {
        email: 'test+talent+offer+jobs+3+createmilestone@stoketalent.com',
        firstName: 'create3',
        lastName: 'offer3'
    },
    companyId,
    itemStatus: constants.job.status.active
}

const companyProvider7 = {
    itemId: providerId7,
    companyId,
    itemStatus: constants.companyProvider.status.active,
    itemData: {
        providerEmail: 'test+talent+offer+jobs+4+createmilestone@stoketalent.com',
        firstName: 'create4',
        lastName: 'offer4',
        isPayable: true,
        isProviderSelfEmployedTalent: true,
    }
};

const companyTalent7 = {
    itemId: talentId7,
    itemData: {
        email: 'test+talent+offer+jobs+4+createmilestone@stoketalent.com',
        firstName: 'create4',
        lastName: 'offer4'
    },
    companyId,
    itemStatus: constants.job.status.active
}

const companyTalent3 = {
    itemId: talentId3,
    itemData: {
        email: 'test+talent+legal+1+createmilestone@stoketalent.com',
        firstName: 'test',
        lastName: 'legal'
    },
    companyId,
    itemStatus: constants.job.status.active
}

const waitingForBudgetJob = {
    userId,
    itemId: jobId1,
    entityId: entity1,
    companyId,
    createdBy: userId,
    itemData: {
        companyAdmin,
        talentId: talentId1,
        jobTitle: 'job withoutBudget',
        totalBudget: 100,
    },
    itemStatus: constants.job.status.budgetRequest
}

const eventExecute = {
    body:
        JSON.stringify({ companyId, key: executeData, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId2
        }
    },
};

const eventCustomFieldsExecute = {
    body:
        JSON.stringify({ companyId, key: executeDataWithCustomFields, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId2
        }
    },
};

const eventPayable = {
    body:
        JSON.stringify({ companyId, key: executeData, command: 'dataValidation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId2
        }
    },
};

const eventValidationByUser = {
    body:
        JSON.stringify({ companyId, key: executeDataCurrency, command: 'dataValidation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId3
        }
    },
};

const eventValidationTalentNotCompliant = {
    body:
        JSON.stringify({ companyId, key: notCompliantLegal, command: 'dataValidation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};


const eventExecuteCurrency = {
    body:
        JSON.stringify({ companyId, key: executeDataCurrency, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId2
        }
    },
};

const eventValidationData = {
    body:
        JSON.stringify({ companyId, key: validationData, command: 'validation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventExecutedataWithCreateTalent = {
    body:
        JSON.stringify({ companyId, key: executedataWithCreateTalent, command: 'execute' }),
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

const eventValidationRequiredWithoutMandatoryColumn = {
    body:
        JSON.stringify({ companyId: companyId2, key: validationRequiredWithoutMandatoryColumn, command: 'validation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId4
        }
    },
};

const eventValidationRequiredMandatoryFieldFilled = {
    body:
        JSON.stringify({ companyId, key: validationRequiredMandatoryFieldFilled, command: 'validation' }),
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

const eventWithJobMissingBudget = {
    body:
        JSON.stringify({ companyId, key: executeDataCurrency, command: 'dataValidation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventExecuteDataCustomRate = {
    body:
        JSON.stringify({ companyId, key: executeDataCustomRate, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId2
        }
    },
};

const eventExecuteDataNoMilestoneTitle = {
    body:
        JSON.stringify({ companyId, key: executeDataNoMilestoneTitle, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId2
        }
    },
};


const eventExecuteUpdateMilestonePlannedAmount = {
    body:
        JSON.stringify({ companyId, key: executeDataMilestoneUpdatePlannedAmount, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventValidationMilestonePlannedAmountMissingMSId = {
    body:
        JSON.stringify({ companyId, key: validateDataMilestoneUpdatePlannedAmountMissingId, command: 'validation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventValidateDataMilestoneUpdateNonExitingMS = {
    body:
        JSON.stringify({ companyId, key: validateDataMilestoneUpdateNonExitingMS, command: 'dataValidation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventValidatedValidAndErrorOfferJobs = {
    body:
        JSON.stringify({ companyId, key: validAndErrorOfferJobs, command: 'dataValidation' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventExecuteOfferJobs = {
    body:
        JSON.stringify({ companyId, key: executeOfferJobs, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventExecuteOfferToFirstTalent = {
    body:
        JSON.stringify({ companyId, key: executeOfferToFirstTalent, command: 'execute' }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
};

const eventExecuteOfferToSecondTalent = {
    body:
        JSON.stringify({ companyId, key: executeOfferToSecondTalent, command: 'execute' }),
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

const rate = {
    itemId: 'USD',
    itemData: {
        ILS: 3.4444,
        EUR: 0.8888,
    },
    createdAt: Date.now(),
};

let talentIdFromCsv = '';

const offerErrorsExpected = [
    'Values for Hourly Rate are not consistent for all rows under Offer Error Hourly not consistent job',
    'Values for Instant Hire are not consistent for all rows under Offer Error Instant Hire not consistent job',
    'Values for Ask talents to submit a quote for this job are not consistent for all rows under Offer Error Quote not consistent job',
    'Not allowed to mix hourly and fixed rates for Offer Error mixed hourly and fixed rate job',
    'Values for  are not consistent for all rows under Offer Error mixed hourly and fixed rate job',
    'Values for Job Start Date are not consistent for all rows under Offer Error job start date not consistent job',
    'Values for Job Description are not consistent for all rows under Offer Error job description not consistent job',
]


describe('createMilestonesFromCsv', () => {
    beforeEach(async () => {
        jest.resetModules()
        process.env = { ...OLD_ENV };
        let result = await usersService.create(companyAdmin);
        expect(result.userId).toBe(companyAdmin.userId);
        result = await usersService.create(companyAdmin2);
        expect(result.userId).toBe(companyAdmin2.userId);
        result = await usersService.create(companyAdmin3);
        expect(result.userId).toBe(companyAdmin3.userId);
        result = await usersService.create(authUser1EntityId1);
        expect(result.userId).toBe(authUser1EntityId1.userId);
        result = await usersService.create(authUser1EntityId2);
        expect(result.userId).toBe(authUser1EntityId2.userId);
        result = await usersService.create(authUser2EntityId1);
        expect(result.userId).toBe(authUser2EntityId1.userId);
        result = await usersService.create(authUser2EntityId2);
        expect(result.userId).toBe(authUser2EntityId2.userId);
        result = await companiesService.create(entity1);
        expect(result.itemId).toBe(entity1.itemId);
        result = await companiesService.create(entity2);
        expect(result.itemId).toBe(entity2.itemId);
        result = await companiesService.create(user1);
        expect(result.itemId).toBe(user1.itemId);
        result = await companiesService.create(user2);
        expect(result.itemId).toBe(user2.itemId);
        result = await companyProvidersService.create(companyProvider1)
        expect(result.itemId).toBe(companyProvider1.itemId);
        result = await companyProvidersService.create(companyProvider3)
        expect(result.itemId).toBe(companyProvider3.itemId);
        result = await companyProvidersService.create(companyProvider4)
        expect(result.itemId).toBe(companyProvider4.itemId);
        result = await companyProvidersService.create(companyProvider5)
        expect(result.itemId).toBe(companyProvider5.itemId);
        result = await companyProvidersService.create(companyProvider6)
        expect(result.itemId).toBe(companyProvider6.itemId);
        result = await companyProvidersService.create(companyProvider7)
        expect(result.itemId).toBe(companyProvider7.itemId);
        result = await companyProvidersService.create(companyTalent1)
        expect(result.itemId).toBe(companyTalent1.itemId);
        result = await talentsService.create(companyTalent1);
        expect(result.itemId).toBe(companyTalent1.itemId);
        result = await companyProvidersService.create(companyTalent2)
        expect(result.itemId).toBe(companyTalent2.itemId);
        result = await companyProvidersService.create(companyTalent3)
        expect(result.itemId).toBe(companyTalent3.itemId);
        result = await companyProvidersService.create(companyTalent4)
        expect(result.itemId).toBe(companyTalent4.itemId);
        result = await companyProvidersService.create(companyTalent5)
        expect(result.itemId).toBe(companyTalent5.itemId);
        result = await companyProvidersService.create(companyTalent6)
        expect(result.itemId).toBe(companyTalent6.itemId);
        result = await companyProvidersService.create(companyTalent7)
        expect(result.itemId).toBe(companyTalent7.itemId);
        result = await jobsService.create(job1)
        expect(result.itemId).toBe(job1.itemId);
        result = await jobsService.create(ms1)
        expect(result.itemId).toBe(ms1.itemId);
        result = await budgetsService.create(budgetUser)
        expect(result.itemId).toBe(budgetUser.itemId);
        result = await budgetsService.create(budgetUserE2)
        expect(result.itemId).toBe(budgetUserE2.itemId);
        result = await budgetsService.create(budgetUser2)
        expect(result.itemId).toBe(budgetUser2.itemId);
        result = await budgetsService.create(budgetUser2e2)
        expect(result.itemId).toBe(budgetUser2e2.itemId);
        result = await budgetsService.create(budgetEntity)
        expect(result.itemId).toBe(budgetEntity.itemId);
        result = await budgetsService.create(budgetEntity2)
        expect(result.itemId).toBe(budgetEntity2.itemId);
        result = await budgetsService.create(budgetCompanyPool)
        expect(result.itemId).toBe(budgetCompanyPool.itemId);
        result = await settingsService.create(settingsDefault);
        expect(result.itemId).toBe(settingsDefault.itemId);
        result = await settingsService.create(settings);
        expect(result.itemId).toBe(settings.itemId);
        result = await settingsService.create(settingsDefault2);
        expect(result.itemId).toBe(settingsDefault2.itemId);
        result = await settingsService.create(settings2);
        expect(result.itemId).toBe(settings2.itemId);
        await exchangeRatesService.create(rate);
        snsLibSpy.mockImplementation(async (topicArn, subject, messageObject) => {
            console.log("SENDING SNS MESSAGE, PARAMS:::", topicArn, subject, messageObject)
        });


        result = await jobsService.create(waitingForBudgetJob)

    });


    it('csv createMilestones, validation data 200 ', async () => {
        const response = await wrapped.run(eventValidationData);
        expect(response.statusCode).toBe(200);
        let result = JSON.parse(response.body);
        expect(result.rowsError.length).toBe(1);
    });

    it('csv createMilestones, execute Data with create talent 200 ', async () => {
        const response = await wrapped.run(eventExecutedataWithCreateTalent);
        expect(response.statusCode).toBe(200);
        let result = await companyProvidersService.getByEmail(companyId, 'csvtest+aaaaaa232@stoketalent.com', 'email')
        talentIdFromCsv = result[0].itemId;
        expect(result.length).toBe(1);
        result = await companyProvidersService.getByEmail(companyId, 'csvtest+aaaaaa233@stoketalent.com', 'providerEmail')
        expect(result.length).toBe(1);
    });

    describe('update exiting milestones', () => {
        beforeEach(async () => {
            await jobsService.create(job2)
            await jobsService.create(ms2)
        })

        afterEach(async () => {
            await jobsService.delete(ms2.entityId, ms2.itemId)
            await jobsService.delete(job2.entityId, job2.itemId)
        })

        it('return error when milestone id is missing value', async () => {
            const response = await wrapped.run(eventValidationMilestonePlannedAmountMissingMSId);
            let result = JSON.parse(response.body);
            expect(result.rowsError.includes("Missing value for required column Requested Amount - in line 2")).toBe(true);
        });


        it('return error when milestone does not exists', async () => {
            const response = await wrapped.run(eventValidateDataMilestoneUpdateNonExitingMS);
            let result = JSON.parse(response.body);
            expect(result.rowsError[0].errors.includes(bulkOperationserrorCodes.milestoneToUpdateNotExisting)).toBe(true);
        });


        it('return change the status and amount of milestone', async () => {
            const response = await wrapped.run(eventExecuteUpdateMilestonePlannedAmount);
            expect(response.statusCode).toBe(200);
            const resultsMs = await jobsService.get(ms2.entityId, ms2.itemId)
            expect(resultsMs.itemStatus).toEqual(constants.job.status.pendingApproval)
            expect(resultsMs.itemData.actualRequestCost).toEqual(100)
            expect(resultsMs.itemData.cost).toEqual(100)
        });
    })

    it('csv createMilestones, execute Data with currency 200 ', async () => {
        const response = await wrapped.run(eventExecuteCurrency);
        expect(response.statusCode).toBe(200);
        const result = await jobsService.listByCompanyId(process.env.gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId)
        expect(result.length).toBe(5);
        expect(result).toMatchObject([
            {
                itemId: jobId1,
            },
            {
                itemData: {
                    currency: 'ILS',
                }
            },
            {
                itemData: {
                    costLocal: 0,
                    providerData: {
                        taxInfo: {
                            paymentCurrency: 'USD',
                            total: 200.
                        }
                    },
                    currency: 'USD',
                    actualRequestCost: 200,
                    actualCost: 200
                },
            },
            {
                itemId: msId1,
            },
            {
                itemData: {
                    cost: 29.87,
                    costLocal: 100,
                    currency: 'ILS',
                    providerData: {
                        taxInfo: {
                            paymentCurrency: 'ILS',
                            total: 100
                        }
                    },
                    actualRequestCost: 29.87,
                    actualCost: 29.87
                }
            }
        ])
    });

    it('csv createMilestones, execute data not payable ', async () => {
        const copyCompanyProvider1 = _.cloneDeep(companyProvider1);
        copyCompanyProvider1.itemData.isPayable = false;
        await companyProvidersService.create(copyCompanyProvider1);
        let response = await wrapped.run(eventPayable);
        expect(response.statusCode).toBe(200);
        let result = JSON.parse(response.body);
        expect(result.rowsError[0].errors[0]).toBe("Provider is not payable");
        copyCompanyProvider1.itemData.isPayable = true;
        copyCompanyProvider1.itemData.taxCompliance = { score: 'red' };
        await companyProvidersService.create(copyCompanyProvider1);
        response = await wrapped.run(eventPayable);
        expect(response.statusCode).toBe(200);
        result = JSON.parse(response.body);
        expect(result.rowsError[0].errors[0]).toBe("Provider is missing tax forms");
    })

    it('csv createMilestones, provider isNonCompliantBlocked ', async () => {
        const copyCompanyProvider1 = _.cloneDeep(companyProvider1);
        copyCompanyProvider1.itemData.sequenceOfWork = { isNonCompliantBlocked: true };
        await companyProvidersService.create(copyCompanyProvider1);
        const copyCompanyTalent1 = _.cloneDeep(companyTalent1);
        copyCompanyTalent1.itemData.isProviderSelfEmployedTalent = true;
        await companyProvidersService.create(copyCompanyTalent1);
        const copySettings = _.cloneDeep(settings);
        copySettings.itemData.workforceContinuityPolicy = { enabled: true, values: { isNonCompliantBlocked: true } };
        await settingsService.create(copySettings)
        let response = await wrapped.run(eventPayable);
        expect(response.statusCode).toBe(200);
        let result = JSON.parse(response.body);
        expect(result.rowsError[0].errors[0]).toBe("Provider is not compliant");
    })

    it('csv createMilestones, talent isNonCompliantBlocked ', async () => {
        const copyCompanyTalent1 = _.cloneDeep(companyTalent1);
        copyCompanyTalent1.itemData.sequenceOfWork = { isNonCompliantBlocked: true };
        copyCompanyTalent1.itemData.isProviderSelfEmployedTalent = false;
        await companyProvidersService.create(copyCompanyTalent1);
        const copySettings = _.cloneDeep(settings);
        copySettings.itemData.workforceContinuityPolicy = { enabled: true, values: { isNonCompliantBlocked: true } };
        await settingsService.create(copySettings)
        let response = await wrapped.run(eventPayable);
        expect(response.statusCode).toBe(200);
        let result = JSON.parse(response.body);
        expect(result.rowsError[0].errors[0]).toBe("Provider is not compliant");
    })

    it('csv createMilestones, execute data 200 ', async () => {
        const response = await wrapped.run(eventExecute);
        expect(response.statusCode).toBe(200);
        const result = await jobsService.listByCompanyId(process.env.gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId)

        expect(result.length).toBe(18);
        expect(result.length).toBe(18);
        expect(result).toMatchObject([
            {
                companyId,
                createdBy: userId,
                itemData: {
                    talentId: talentId1,
                    totalBudget: 200,
                    jobTitle: 'job test1'
                },
                itemStatus: 'Active',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    hourlyBudget: null,
                    talentId: talentId2,
                    totalBudget: 300,
                    jobStartDate: 1646092800000,
                    jobTitle: 'job test1'
                },
                itemStatus: 'Active',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    hourlyBudget: null,
                    talentId: talentId1,
                    totalBudget: 600,
                    jobStartDate: 1646092800000,
                    jobTitle: 'job test1'
                },
                itemStatus: 'Active',
                entityId: entityId1,
                modifiedBy: userId2,
                userId: userId2
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    hourlyBudget: null,
                    talentId: talentId1,
                    totalBudget: 300,
                    jobStartDate: 1646092800000,
                    jobTitle: 'job test1'
                },
                itemStatus: 'Active',
                entityId: entityId2,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    hourlyBudget: null,
                    talentId: talentId1,
                    totalBudget: 300,
                    jobStartDate: 1646092800000,
                    jobTitle: 'job test2'
                },

                itemStatus: 'Active',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 0,
                    actualRequestCost: 200,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test1'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 100,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test2'
                },
                itemStatus: 'Active',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId,
                itemData: { title: 'exist ms', date: '2022-02-29', cost: 100 },
                itemStatus: 'Completed',
                entityId: entityId1,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 200,
                    actualRequestCost: 200,
                    talentData: {
                        firstName: 'test2',
                        lastName: 'test2',
                        name: 'test2 test2'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test3'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 100,
                    actualRequestCost: 100,
                    talentData: {
                        firstName: 'test2',
                        lastName: 'test2',
                        name: 'test2 test2'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test4'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 200,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test5'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId: userId2
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 100,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test6'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId: userId2
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 200,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test11'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId: userId2
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1672272000000,
                    cost: 100,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test12'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId: userId2
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 200,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test7'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId2,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 100,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test8'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId2,
                modifiedBy: userId2,
                userId
            },

            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 200,
                    actualRequestCost: 200,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test9'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 100,
                    actualRequestCost: 100,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test10'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            }
        ])
    });

    it('csv createMilestones with Job custom fields, execute data 200 ', async () => {
        const response = await wrapped.run(eventCustomFieldsExecute);
        expect(response.statusCode).toBe(200);
        const result = await jobsService.listByCompanyId(process.env.gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId)

        expect(result.length).toBe(18);
        expect(result.length).toBe(18);
        expect(result).toMatchObject([
            {
                companyId,
                createdBy: userId,
                itemData: {
                    talentId: talentId1,
                    totalBudget: 200,
                    jobTitle: 'job test1'
                },
                itemStatus: 'Active',
                entityId: entityId1,
                modifiedBy: userId,
                userId,
                tags: {
                    'test custom': 'text1',
                    'Tags custom field': ['tag1', 'tag1', 'tag2'],
                    'stoke::jobId': 'ID1'
                }
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    hourlyBudget: null,
                    talentId: talentId2,
                    totalBudget: 300,
                    jobStartDate: 1646092800000,
                    jobTitle: 'job test1'
                },
                itemStatus: 'Active',
                entityId: entityId1,
                modifiedBy: userId,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    hourlyBudget: null,
                    talentId: talentId1,
                    totalBudget: 600,
                    jobStartDate: 1646092800000,
                    jobTitle: 'job test1'
                },
                itemStatus: 'Active',
                entityId: entityId1,
                modifiedBy: userId2,
                userId: userId2
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    hourlyBudget: null,
                    talentId: talentId1,
                    totalBudget: 300,
                    jobStartDate: 1646092800000,
                    jobTitle: 'job test1'
                },
                itemStatus: 'Active',
                entityId: entityId2,
                modifiedBy: userId,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    hourlyBudget: null,
                    talentId: talentId1,
                    totalBudget: 300,
                    jobStartDate: 1646092800000,
                    jobTitle: 'job test2'
                },

                itemStatus: 'Active',
                entityId: entityId1,
                modifiedBy: userId,
                userId,
                tags: {
                    'test custom': 'text2',
                    'Tags custom field': ['tag1', 'tag1', 'tag2'],
                    'stoke::jobId': 'ID1'
                }
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 0,
                    actualRequestCost: 200,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test1'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 100,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test2'
                },
                itemStatus: 'Active',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId,
                itemData: { title: 'exist ms', date: '2022-02-29', cost: 100 },
                itemStatus: 'Completed',
                entityId: entityId1,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 200,
                    actualRequestCost: 200,
                    talentData: {
                        firstName: 'test2',
                        lastName: 'test2',
                        name: 'test2 test2'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test3'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 100,
                    actualRequestCost: 100,
                    talentData: {
                        firstName: 'test2',
                        lastName: 'test2',
                        name: 'test2 test2'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test4'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 200,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test5'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId: userId2
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 100,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test6'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId: userId2
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 200,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test11'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId: userId2
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1672272000000,
                    cost: 100,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test12'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId: userId2
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 200,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test7'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId2,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 100,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test8'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId2,
                modifiedBy: userId2,
                userId
            },

            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 200,
                    actualRequestCost: 200,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test9'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            },
            {
                companyId,
                createdBy: userId2,
                itemData: {
                    date: 1646092800000,
                    cost: 100,
                    actualRequestCost: 100,
                    talentData: {
                        firstName: 'test',
                        lastName: 'test',
                        name: 'test test'
                    },
                    description: 'milestone description test',
                    title: 'milestone title test10'
                },
                itemStatus: 'Pending Approval',
                entityId: entityId1,
                modifiedBy: userId2,
                userId
            }
        ])
    });

    it('csv createMilestones, execute data with custom field 200 ', async () => {
        const response = await wrapped.run(eventExecuteWithCustomFields);
        expect(response.statusCode).toBe(200);
        let result = await companyProvidersService.getByEmail(companyId, 'test+talent+1+createmilestone@stoketalent.com', 'email')
        expect(result.length).toBe(1);
        expect(result[0].tags).toMatchObject({ 'stoke::talentId': '1' });
        result = await companyProvidersService.getByEmail(companyId, 'test+talent+1+createmilestone@stoketalent.com', 'providerEmail')
        expect(result.length).toBe(1);
        expect(result[0].tags).toMatchObject({
            'stoke::providerId': "2",
            'stoke::providerId2': "3",
        });
    });

    // this test is failing because there is a typo in the csv file - Milstone Title instead of Milestone Title
    it('csv createMilestones, validation email 200 ', async () => {
        const response = await wrapped.run(eventValidationEmail);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.rowsError[0]).toBe("Value for column Talent email is not Correct - in line 2");
    });

    it('csv createMilestones, validation required 200 ', async () => {
        const response = await wrapped.run(eventValidationRequired);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.rowsError.includes("Missing value for required column Talent email - in line 2")).toBeTruthy();
    });

    it('csv createMilestones, validation required 200, mandatory column is not in the csv', async () => {
        const response = await wrapped.run(eventValidationRequiredWithoutMandatoryColumn);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result.rowsError[0]).toBe("Missing required fields: customField mandatory custom field (Jobs custom field) - in line 2");
    });

    it('csv createMilestones, validation required 200, mandatory column filled', async () => {
        const response = await wrapped.run(eventValidationRequiredMandatoryFieldFilled);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(_.size(result.rowsError)).toBe(1);
        expect(result.rowsError[0]).toBe("Missing value for required column Talent email - in line 2");
    });



    it('csv createMilestones, missing file expect 500 ', async () => {
        const response = await wrapped.run(eventErrorPath);
        expect(response.statusCode).toBe(500);
    });

    it('csv createMilestones, missing params expect 500 ', async () => {
        const response = await wrapped.run(eventErrorMissingParams);
        expect(response.statusCode).toBe(500);

    });

    it('csv createMilestones, expect 403 ', async () => {
        const response = await wrapped.run(eventErrorAuth);
        expect(response.statusCode).toBe(403);

    });

    it('csv no milestone title ', async () => {
        const response = await wrapped.run(eventExecuteDataNoMilestoneTitle);
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.body);
        expect(result).toEqual({ status: true })
    });

    describe('CSV budget validation', () => {
        describe('missing budget', () => {
            const copySettings = _.cloneDeep(settings);

            describe('budget module active', () => {
                it('csv failed for validating request - budget module active', async () => {
                    copySettings.itemData.budgetModuleActive = true;
                    await settingsService.create(copySettings)
                    const response = await wrapped.run(eventWithJobMissingBudget);
                    expect(response.statusCode).toBe(200);
                    let result = JSON.parse(response.body);
                    expect(result).toEqual({ generalError: { type: 'budget', data: { missingWorkspacesCount: 1, missingQuartersCount: 1 } } })
                });
            });

            describe('budget module is not active', () => {
                it('csv not failing validation', async () => {
                    copySettings.itemData.budgetModuleActive = false;
                    await settingsService.create(copySettings)
                    const response = await wrapped.run(eventWithJobMissingBudget);
                    expect(response.statusCode).toBe(200);
                    let result = JSON.parse(response.body);
                    expect(result).not.toContain({ generalError: { type: 'budget' } });
                });
            });
        })
    });

    describe('permissions errors', () => {
        describe('user validation', () => {
            beforeEach(async () => {
                await usersService.create(user2EntityId3);
            })

            it('adds error when user which is not admin trying to create job for other user ', async () => {
                const response = await wrapped.run(eventValidationByUser);
                expect(response.statusCode).toBe(200);
                let result = JSON.parse(response.body);
                const firstRowsErrors = result.rowsError[0].errors;
                expect(firstRowsErrors.includes(bulkOperationserrorCodes.insufficientPermission)).toBe(true)
            });

            it('adds error when user is not legal comlient ', async () => {
                const response = await wrapped.run(eventValidationTalentNotCompliant);
                expect(response.statusCode).toBe(200);
                let result = JSON.parse(response.body);
                const firstRowsErrors = result.rowsError[0].errors;
                expect(firstRowsErrors.includes(bulkOperationserrorCodes.nonCompliantProvider)).toBe(true)
            });
        })
    });

    describe('eventExecuteDataCustomRate', () => {
        describe('data execute', () => {
            beforeEach(async () => {
                await usersService.create(user2EntityId3);
            })

            it('adds error when user which is not admin trying to create job for other user ', async () => {
                const response = await wrapped.run(eventExecuteDataCustomRate);
                expect(response.statusCode).toBe(200);
                const result = await jobsService.listByCompanyId(process.env.gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId)
                const groupedResult = _.groupBy(result, (item) => {
                    return item.itemData && item.itemData.jobTitle && item.itemData.jobTitle
                })
                const newJobeResults = _.first(groupedResult['job test3'])
                expect(newJobeResults.itemData).toHaveProperty('customRateData')
                const customData = newJobeResults.itemData.customRateData
                expect(customData.category).toEqual('Minute')
                expect(customData.estimatedQuantity).toEqual('2')
                expect(customData.ratePer).toEqual(3)
            });
        })
    });

    describe('CSV offer job', () => {
        it('csv offer job, dataValidation data 200 ', async () => {
            const response = await wrapped.run(eventValidatedValidAndErrorOfferJobs);
            expect(response.statusCode).toBe(200);
            const result = JSON.parse(response.body);
            const rowsError = result.rowsError;
            expect(rowsError.length).toBe(7);
            const errorsArray = _.flatMap(rowsError, (rowError) => rowError.errors)
            expect(errorsArray).toEqual(offerErrorsExpected)

            const rowsWithoutError = result.rowsWithoutError;
            expect(rowsWithoutError.length).toBe(5);

            const instantHireJob = rowsWithoutError.find((row) => row.jobTitle === 'Offer csv instant hire')
            expect(instantHireJob).toMatchObject({
                talentsIds: [companyTalent4.itemId, companyTalent5.itemId],
                providersIds: [companyProvider4.itemId, companyProvider5.itemId],
                talentsEmails: [companyTalent4.itemData.email, companyTalent5.itemData.email],
                instantHire: 'Yes',
                jobType: 'Offer',
                userEmail: user1.itemData.userEmail,
                entityName: entity1.itemData.entityName,
                jobTitle: 'Offer csv instant hire',
                jobDescription: 'This is a instant hire csv offer job',
                timeFrame: 'once',
                jobStartDate: '2024-02-20',
                hourlyRate: '25',
                monthlyEstimatedHours: '4',
                instantHire: 'Yes',
                quote: 'Yes',
                companyId: companyId,
                userId: userId,
                entityId: entityId1,
                createdBy: userId,
                currency: 'USD',
            })

            const offerTwoNoInstantHire = rowsWithoutError.find((row) => row.jobTitle === 'Offer csv Two talents')
            expect(offerTwoNoInstantHire).toMatchObject({
                talentsIds: [companyTalent4.itemId, companyTalent5.itemId],
                providersIds: [companyProvider4.itemId, companyProvider5.itemId],
                talentsEmails: [companyTalent4.itemData.email, companyTalent5.itemData.email],
                instantHire: 'Yes',
                jobType: 'Offer',
                userEmail: user1.itemData.userEmail,
                entityName: entity1.itemData.entityName,
                jobTitle: 'Offer csv Two talents',
                jobDescription: 'This offer job was offered to two talents using CSV',
                timeFrame: 'once',
                jobStartDate: '2024-02-20',
                hourlyRate: '25',
                monthlyEstimatedHours: '4',
                instantHire: '',
                quote: 'Yes',
                companyId: companyId,
                userId: userId,
                entityId: entityId1,
                createdBy: userId,
                currency: 'USD',
            })

            const offerSingleHourlyRate = rowsWithoutError.find((row) => row.jobTitle === 'Offer csv Single talent Hourly rate')
            expect(offerSingleHourlyRate).toMatchObject({
                talentsIds: [companyTalent4.itemId],
                providersIds: [companyProvider4.itemId],
                talentsEmails: [companyTalent4.itemData.email],
                instantHire: '',
                jobType: 'Offer',
                userEmail: user1.itemData.userEmail,
                entityName: entity1.itemData.entityName,
                jobTitle: 'Offer csv Single talent Hourly rate',
                jobDescription: 'Offer me, and only me, a job from csv ',
                timeFrame: 'once',
                jobStartDate: '2024-02-20',
                hourlyRate: '12',
                monthlyEstimatedHours: '5',
                instantHire: '',
                quote: '',
                companyId: companyId,
                userId: userId,
                entityId: entityId1,
                createdBy: userId,
                currency: 'USD',
            })

            const offerSingleFixedRate = rowsWithoutError.find((row) => row.jobTitle === 'Offer csv Single talent Fixed rate')
            expect(offerSingleFixedRate).toMatchObject({
                talentsIds: [companyTalent4.itemId],
                providersIds: [companyProvider4.itemId],
                talentsEmails: [companyTalent4.itemData.email],
                instantHire: '',
                jobType: 'Offer',
                userEmail: user1.itemData.userEmail,
                entityName: entity1.itemData.entityName,
                jobTitle: 'Offer csv Single talent Fixed rate',
                jobDescription: 'Offer me, and only me, a job from csv ',
                timeFrame: 'once',
                jobStartDate: '2024-02-20',
                fixedRate: '14',
                monthlyEstimatedHours: '5',
                instantHire: '',
                quote: '',
                companyId: companyId,
                userId: userId,
                entityId: entityId1,
                createdBy: userId,
                currency: 'USD',
            })

            const offerSingleOngoing = rowsWithoutError.find((row) => row.jobTitle === 'Offer csv Single talent Ongoing')
            expect(offerSingleOngoing).toMatchObject({
                talentsIds: [companyTalent4.itemId],
                providersIds: [companyProvider4.itemId],
                talentsEmails: [companyTalent4.itemData.email],
                instantHire: '',
                jobType: 'Offer',
                userEmail: user1.itemData.userEmail,
                entityName: entity1.itemData.entityName,
                jobTitle: 'Offer csv Single talent Ongoing',
                jobDescription: 'Offer me, and only me, a job from csv ',
                timeFrame: 'ongoing',
                jobStartDate: '2024-02-20',
                fixedRate: '14',
                monthlyEstimatedHours: '5',
                instantHire: '',
                quote: '',
                companyId: companyId,
                userId: userId,
                entityId: entityId1,
                createdBy: userId,
                currency: 'USD',
            })
        })

        it('csv offer job, execute data 200 ', async () => {
            const response = await wrapped.run(eventExecuteOfferJobs);
            expect(response.statusCode).toBe(200);

            const offeredJobs = await jobsService.jobsPagingtion('listByCompanyId', undefined, [process.env.gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, null, constants.prefix.job, [constants.job.status.pending]]);
            expect(offeredJobs.length).toBe(5);

            let bidsCreated = []

            const instantHireJob = offeredJobs.find((job) => job.itemData.jobTitle === 'Offer csv instant hire')
            expect(instantHireJob).toMatchObject({
                companyId,
                createdBy: userId,
                itemData: {
                    totalBudget: 100,
                    jobTitle: 'Offer csv instant hire',
                    maxHours: '4',
                    baseJobFlow: 'offer',
                    engagementType: 'hourly',
                    repeatEvery: 0,
                    isAutomaticHire: true,
                    timeFrame: 'once',
                    jobFlow: 'offer',
                    recurringPeriods: 1,
                    isCSVJob: true,
                    hourlyBudget: '25',
                    jobDescription: 'This is a instant hire csv offer job',
                    currency: 'USD',
                    talentIds: [companyTalent4.itemId, companyTalent5.itemId],
                    withTalentQuoteOffer: true,
                },
                itemStatus: constants.job.status.pending,
                entityId: entityId1,
                modifiedBy: userId,
                userId
            })
            bidsCreated = bidsCreated.concat(_.get(instantHireJob, 'itemData.bids.values'))

            const offerTwoNoInstantHire = offeredJobs.find((job) => job.itemData.jobTitle === 'Offer csv Two talents')
            expect(offerTwoNoInstantHire).toMatchObject({
                companyId,
                createdBy: userId,
                itemData: {
                    totalBudget: 100,
                    jobTitle: 'Offer csv Two talents',
                    maxHours: '4',
                    baseJobFlow: 'offer',
                    engagementType: 'hourly',
                    repeatEvery: 0,
                    isAutomaticHire: false,
                    timeFrame: 'once',
                    jobFlow: 'offer',
                    recurringPeriods: 1,
                    isCSVJob: true,
                    hourlyBudget: '25',
                    jobDescription: 'This offer job was offered to two talents using CSV',
                    currency: 'USD',
                    talentIds: [companyTalent4.itemId, companyTalent5.itemId],
                    withTalentQuoteOffer: true,
                },
                itemStatus: constants.job.status.pending,
                entityId: entityId1,
                modifiedBy: userId,
                userId
            })
            bidsCreated = bidsCreated.concat(_.get(offerTwoNoInstantHire, 'itemData.bids.values'))

            const offerSingleHourlyRate = offeredJobs.find((job) => job.itemData.jobTitle === 'Offer csv Single talent Hourly rate')
            expect(offerSingleHourlyRate).toMatchObject({
                companyId,
                createdBy: userId,
                itemData: {
                    totalBudget: 60,
                    jobTitle: 'Offer csv Single talent Hourly rate',
                    maxHours: '5',
                    baseJobFlow: 'offer',
                    engagementType: 'hourly',
                    repeatEvery: 0,
                    isAutomaticHire: false,
                    timeFrame: 'once',
                    jobFlow: 'offer',
                    recurringPeriods: 1,
                    isCSVJob: true,
                    hourlyBudget: '12',
                    jobDescription: 'Offer me, and only me, a job from csv ',
                    currency: 'USD',
                    talentIds: [companyTalent4.itemId],
                    withTalentQuoteOffer: false,
                },
                itemStatus: constants.job.status.pending,
                entityId: entityId1,
                modifiedBy: userId,
                userId
            })
            bidsCreated = bidsCreated.concat(_.get(offerSingleHourlyRate, 'itemData.bids.values'))

            const offerSingleFixedRate = offeredJobs.find((job) => job.itemData.jobTitle === 'Offer csv Single talent Fixed rate')
            expect(offerSingleFixedRate).toMatchObject({
                companyId,
                createdBy: userId,
                itemData: {
                    totalBudget: 0,
                    jobTitle: 'Offer csv Single talent Fixed rate',
                    baseJobFlow: 'offer',
                    engagementType: 'project',
                    repeatEvery: 0,
                    isAutomaticHire: false,
                    timeFrame: 'once',
                    jobFlow: 'offer',
                    recurringPeriods: 1,
                    isCSVJob: true,
                    jobDescription: 'Offer me, and only me, a job from csv ',
                    currency: 'USD',
                    talentIds: [companyTalent4.itemId],
                    withTalentQuoteOffer: false,
                },
                itemStatus: constants.job.status.pending,
                entityId: entityId1,
                modifiedBy: userId,
                userId
            })
            bidsCreated = bidsCreated.concat(_.get(offerSingleFixedRate, 'itemData.bids.values'))

            const offerSingleOngoing = offeredJobs.find((job) => job.itemData.jobTitle === 'Offer csv Single talent Ongoing')
            expect(offerSingleOngoing).toMatchObject({
                companyId,
                createdBy: userId,
                itemData: {
                    totalBudget: 0,
                    jobTitle: 'Offer csv Single talent Ongoing',
                    baseJobFlow: 'offer',
                    engagementType: 'project',
                    repeatEvery: 0,
                    isAutomaticHire: false,
                    timeFrame: 'ongoing',
                    jobFlow: 'offer',
                    recurringPeriods: 1,
                    isCSVJob: true,
                    jobDescription: 'Offer me, and only me, a job from csv ',
                    currency: 'USD',
                    talentIds: [companyTalent4.itemId],
                    withTalentQuoteOffer: false,
                },
                itemStatus: constants.job.status.pending,
                entityId: entityId1,
                modifiedBy: userId,
                userId
            })
            bidsCreated = bidsCreated.concat(_.get(offerSingleOngoing, 'itemData.bids.values'))

            await Promise.all(_.map(bidsCreated, async (bidId) => bidsService.delete(entityId1, bidId)))

        });

        it('csv offer job to first talent and later to second, execute data 200 ', async () => {
            process.env.jobSNSTopicArn = "arn:aws:sns:us-east-1:727244588241:dev-jobs-notifications";
            const { jobSNSTopicArn } = process.env;
            let response = await wrapped.run(eventExecuteOfferToFirstTalent);
            expect(response.statusCode).toBe(200);

            const offeredJobs = await jobsService.jobsPagingtion('listByCompanyId', undefined, [process.env.gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, null, constants.prefix.job, [constants.job.status.pending]]);
            expect(offeredJobs.length).toBe(1);

            expect(offeredJobs[0]).toMatchObject({
                companyId: 'CREATE-MILESTONES-CSV-JEST-TEST-COMPANY-ID-1',
                createdBy: 'CREATE-MILESTONES-CSV-JEST-TEST-USER-ID-1',
                itemData: {
                    totalBudget: 100,
                    jobTitle: 'Offer csv test offer one and then to another',
                    maxHours: '4',
                    baseJobFlow: 'offer',
                    engagementType: 'hourly',
                    repeatEvery: 0,
                    isAutomaticHire: false,
                    timeFrame: 'once',
                    jobFlow: 'offer',
                    recurringPeriods: 1,
                    isCSVJob: true,
                    hourlyBudget: '25',
                    jobDescription: 'Or sends his regards',
                    currency: 'USD',
                    budgetPerMilestone: null,
                    talentIds: [talentId6],
                    withTalentQuoteOffer: false
                },
                itemStatus: 'Pending',
                entityId: 'CREATE-MILESTONES-CSV-JEST-TEST-ENTITY-ID-1',
                modifiedBy: 'CREATE-MILESTONES-CSV-JEST-TEST-USER-ID-1',
                userId: 'CREATE-MILESTONES-CSV-JEST-TEST-USER-ID-1',
            })

            response = await wrapped.run(eventExecuteOfferToFirstTalent);
            expect(response.statusCode).toBe(200);

            expect(snsLibSpy).toHaveBeenCalledWith(jobSNSTopicArn, 'Posted job updated', { companyId: companyId, entityId: entityId1, userId: userId, itemId: offeredJobs[0].itemId})

            const bidsCreated = _.get(offeredJobs[0], 'itemData.bids.values')
            await Promise.all(_.map(bidsCreated, async (bidId) => bidsService.delete(entityId1, bidId)))

        });
    });

    afterEach(async () => {
        process.env = OLD_ENV;
        await usersService.delete(userId, companyId);
        await usersService.delete(userId4, companyId2);
        await usersService.delete(userId2, companyId);
        await usersService.delete(userId, entityId1);
        await usersService.delete(userId2, entityId1);
        await usersService.delete(userId, entityId2);
        await usersService.delete(userId2, entityId2);
        await usersService.delete(user2EntityId3.userId, user2EntityId3.entityId);
        await settingsService.delete(settings.itemId);
        await settingsService.delete(settingsDefault.itemId);
        await settingsService.delete(settings2.itemId);
        await settingsService.delete(settingsDefault2.itemId);
        await talentsService.delete(companyTalent1.itemId);
        await talentsService.delete(talentIdFromCsv); // if this one fails, comment and run again
        talentsService
        await exchangeRatesService.delete(rate.itemId, rate.createdAt);
        let result = await companyProvidersService.listCompany(companyId)
        for (const item of result) {
            await companyProvidersService.delete(companyId, item.itemId)
        }
        result = await jobsService.listByCompanyId(process.env.gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId)
        for (const item of result) {
            await jobsService.delete(item.entityId, item.itemId)
        }
        result = await companiesService.list(process.env.gsiItemsByCompanyIdIndexName, companyId);
        for (const item of result) {
            await companiesService.delete(item.itemId)
        }
        result = await budgetsService.listCompany(process.env.gsiItemsByCompanyIdAndItemIdIndexName, companyId)
        for (const item of result) {
            await companiesService.delete(item.itemId)
        }

        await budgetsService.delete(budgetUser.entityId, budgetUser.itemId);
        await budgetsService.delete(budgetUserE2.entityId, budgetUserE2.itemId);
        await budgetsService.delete(budgetUser2.entityId, budgetUser2.itemId);
        await budgetsService.delete(budgetUser2e2.entityId, budgetUser2e2.itemId);
        await budgetsService.delete(budgetEntity.entityId, budgetEntity.itemId);
        await budgetsService.delete(budgetEntity2.entityId, budgetEntity2.itemId);
        await budgetsService.delete(budgetCompanyPool.entityId, budgetCompanyPool.itemId);
    });
});
