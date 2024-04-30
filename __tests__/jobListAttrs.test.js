/* eslint-disable max-lines */
/* eslint-disable no-magic-numbers */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-undef */
/* eslint-disable array-element-newline */
/* eslint-disable array-bracket-spacing */

'use strict';

const mod = require('../src/job/jobListAttrs');
const jestPlugin = require('serverless-jest-plugin');
const handler = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'handler' });

const _ = require('lodash');
const { UsersService, JobsService, TalentsService, CompanyProvidersService, SettingsService, constants, teamsService, companyDueDateService } = require('stoke-app-common-api');

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const talentsService = new TalentsService(process.env.talentsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const users = require('stoke-app-common-api/__tests__/utils/users');

const companyId1 = 'JEST-TEST-LIST-JOBS-ATTRS_COMPANY-ID-1';
const companyId3 = 'JEST-TEST-LIST-JOBS-ATTRS_COMPANY-ID-3';
const companyId4 = 'JEST-TEST-LIST-JOBS-ATTRS_COMPANY-ID-4';
const companyId5 = 'job_GET-BUDGETJOBS-ATTRS-JEST-TEST-COMP-ID-1'
const entityId1 = 'JEST-TEST-LIST-JOBS-ATTRS_ENT-ID-1';
const entityId2 = 'JEST-TEST-LIST-JOBS-ATTRS_ENT-ID-2';
const entityId4 = 'JEST-TEST-LIST-JOBS-ATTRS_ENT-ID-4';
const userId1 = 'JEST-TEST-LIST-JOBS-ATTRS_USER-ID-1';
const userId2 = 'JEST-TEST-LIST-JOBS-ATTRS_USER-ID-2';
const userId3 = 'JEST-TEST-LIST-JOBS-ATTRS_USER-ID-3';
const providerId1 = 'provider_11111talent_1111';
const providerId4 = 'provider_44444talent_4444';
const talentId1 = `talent_${providerId1}`;
const talentId2 = 'talent_provider_22222talent_2222';
const talentId3 ='talent_provider_33333talent_3333';


const companySettings = {
    itemId: `${constants.prefix.company}${companyId5}`,
    itemData: {
        jobRequestApproval: {
            enabled: true,
            jobRequestLevels: [{ id: 1, type: constants.multiLevelTypes.departmentAdmin, threshold: 101 }],
        }
    },
};

const companySettings1 = {
    itemId: `${constants.prefix.company}${companyId1}`,
    itemData: {
        paymentSchedule: {
            dayOfMonthToRollInto: [5, 12, 19, 26],
            daysToAdvance: 0,
            monthsToAdvance: 0
        },
        paymentScheduleVersions: [
            {
                paymentSchedule: {
                    dayOfMonthToRollInto: [5, 12, 19, 26],
                    daysToAdvance: 0,
                    monthsToAdvance: 0
                },
                activeFrom: new Date().getTime(),
            }
        ],
        legalCompliancePolicy: {
            enabled: true,
            values: {
                requireLegalComplianceSettings: true,
                requireLegalDocsSignSettings: false
            }
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
    },
};

const jobItem = {
    companyId: companyId1,
    entityId: entityId1,
    itemId: 'job_JEST-TEST-LIST-JOBS-ATTRS_JOB-ID-1',
    userId: userId1,
    itemStatus: constants.job.status.active,
    talentId: talentId1,
};

const jobTemplateItem = {
    companyId: constants.jobsTemplateIds.companyId,
    entityId: constants.jobsTemplateIds.entityId,
    itemId: 'template_JEST-TEST-LIST-JOBS-ATTRS_JOB-ID-1',
    userId: userId1,
    itemData: {

    },
    itemStatus: constants.job.status.active,
    talentId: talentId1,
};

const jobItem2 = {
    companyId: companyId1,
    entityId: entityId1,
    itemId: 'job_JEST-TEST-LIST-JOBS-ATTRS_JOB-ID-2',
    userId: userId2,
    itemStatus: constants.job.status.pendingApproval,
    talentId: talentId2,
};

const jobItem3 = {
    companyId: companyId1,
    entityId: entityId2,
    itemId: 'job_JEST-TEST-LIST-JOBS-ATTRS-JOB-ID-3',
    userId: userId2,
    itemStatus: constants.job.status.active,
    talentId: talentId2,
    itemData: {
        "currency": "USD",
        "engagementType": "project",
        "jobHandShakeStage": "APPROVED",
        "talentId": talentId2,
        "jobTitle": "New external approver job",
    },
    viewData: {
        "milestonesData": {
            "aggregatedMilestonesAmounts": {
                "ILS": {
                    "totalActualLocal": 100,
                    "totalRequestedLocal": 100
                },
                "baseCurrency": {
                    "totalActual": 33,
                    "totalPlanned": 33,
                    "totalRequested": 33
                }
            },
            activeMilestones: 1,
            jobMilestoneCardDataByFilterKey: {
                'active': {
                    total: 1,
                    completed: 0,
                    request: 0,
                    nextMilestoneKey: 'pendingPayment'
                }
            },
        },

    }
};

const msJobItem3 = {
    companyId: companyId1,
    entityId: entityId2,
    itemId: 'ms_job_JEST-TEST-LIST-JOBS-ATTRS-JOB-ID-3_3',
    userId: userId2,
    itemStatus: constants.job.status.pendingApproval
};


const jobItemWithTalentId = {
    companyId: companyId1,
    entityId: entityId2,
    itemStatus: constants.job.status.pending,
    itemId: 'job_JEST-TEST-LIST-JOBS-ATTRS_JOB-ID-5',
    userId: userId3,
    itemData: {
        talentId: "talent_provider_DOCUSIGNfb5c3e50-4906-11eb-b3bd-cf229eada5batalent_c434e920-4908-11eb-ab67-07d7e1e79e08",
        bids: {
            values: [
                "JEST_TEST_LIST_JOBS_TALENT_ID_17",
                "job_JEST-TEST-LIST-JOBS-ATTRS_JOB-ID-5_JEST_TEST_LIST_JOBS_TALENT_ID_2"
            ]
        }
    }
};

const talent5 = {
    companyId: companyId1,
    itemId: 'talent_provider_DOCUSIGNfb5c3e50-4906-11eb-b3bd-cf229eada5batalent_c434e920-4908-11eb-ab67-07d7e1e79e08',
    itemData: {
        name: 'TALENT_5'
    },
}
const talent1 = {
    companyId: companyId1,
    itemId: talentId1,
    itemData: {
        name: 'TALENT_1',
        legalCompliance: { score: "green" },
        taxCompliance: { score: "green", taxDocs: [{type: "A", score: "green"}] },
        workforceAudits: [{
            complianceHRSentDate: "2022-07-20",
            endDate: "2022-07-20",
            questionnairesSentDate: "2022-07-20",
            startDate: "2022-07-20",
            status: "No risk",
        }],
        talentProfileData: {
            about: 'Awesome talent',
        },
    },
    itemStatus: constants.companyProvider.status.registered,
}
const talent2 = {
    companyId: companyId1,
    itemId: talentId2,
    itemData: {
        name: 'TALENT_2',
        legalCompliance: { score: "yellow" },
        taxCompliance: { score: "green" },
        workforceAudits: [{
            complianceHRSentDate: "2022-07-20",
            endDate: "2022-07-20",
            questionnairesSentDate: "2022-07-20",
            startDate: "2022-07-20",
            status: "No risk",
        }]
    },
    itemStatus: constants.companyProvider.status.registered,
}
const talent3 = {
    companyId: companyId1,
    itemId: talentId3,
    itemData: {
        name: 'TALENT_3',
        legalCompliance: { score: "green" },
        taxCompliance: { score: "red" },
        workforceAudits: [{
            complianceHRSentDate: "2022-07-20",
            endDate: "2022-07-20",
            questionnairesSentDate: "2022-07-20",
            startDate: "2022-07-20",
            status: "No risk",
        }]
    },
    itemStatus: constants.companyProvider.status.registered,
}

const companyProvider4 = {
    companyId: companyId1,
    itemId: providerId4,
    itemData: {
        name: 'provider_4',
        isProviderSelfEmployedTalent: true,
        legalCompliance: {
            score: "red",
            lastUpdated: "2022-12-12T08:16:23+00:00",
            contractElements: {
                "Service Agreement": {
                    documents: [],
                    status: "missing"
                },
                "Stam Contract": {
                    status: "signed"
                },
            }
        },
        legalDocuments: [
            {
                status: "missing",
                name: "Doc 1",
                legalEntityName: "Entity 1",
                isExpired: false,
            },
            {
                status: "signed",
                name: "Doc 2",
                legalEntityName: "Entity 2",
                isExpired: false,
            }
        ],
    },
    itemStatus: constants.companyProvider.status.invited,
}

const totalEarnedTest = 'TOTAL-EARNED-TEST';

const earnedTestTalent1 = {
    companyId: companyId1,
    itemId: `talent_provider_${totalEarnedTest}_TALENT1`,
    itemData: {
        name: `${totalEarnedTest}_TALENT1`
    },
}

const earnedTestProvider1 = {
    companyId: companyId1,
    itemId: `provider_${totalEarnedTest}`,
    itemData: {
        providerName: `${totalEarnedTest}_Provider`
    }
}

const complianceScoresTest = 'COMPLIANCE_SCORES_TEST';

const complianceScorestTestTalent1 = {
    companyId: companyId1,
    itemId: `talent_provider_${complianceScoresTest}_TALENT1`,
    itemData: {
        name: `${complianceScoresTest}_TALENT1`,
        legalCompliance: { score: "yellow" },
        taxCompliance: { score: "green" },
        workforceAudits: [{
            complianceHRSentDate: "2022-07-20",
            endDate: "2022-07-20",
            questionnairesSentDate: "2022-07-20",
            startDate: "2022-07-20",
            status: "No risk",
        }],
        providerId: `provider_${complianceScoresTest}_TALENT1`,
        workforceComplianceStatus: { score: "yellow" }
    },
}

const complianceScorestTestProvider1 = {
    companyId: companyId1,
    itemId: `provider_${complianceScoresTest}_TALENT1`,
    itemData: {
        name: `${complianceScoresTest}_PROVIDER`,
        legalCompliance: { score: "green" },
        taxCompliance: { score: "green" },
        workforceAudits: [{
            complianceHRSentDate: "2022-07-20",
            endDate: "2022-07-20",
            questionnairesSentDate: "2022-07-20",
            startDate: "2022-07-20",
            status: "No risk",
        }],
        workforceComplianceStatus: { score: "green" },
        isPayable: true,
    },
}

const companyProvider5 = {
    companyId: companyId1,
    itemId: 'provider_DOCUSIGNfb5c3e50-4906-11eb-b3bd-cf229eada5ba',
    itemData: {
        providerName: 'COMPANY_PROVIDER_5'
    }
};

const companyProvider3 = {
    itemId: providerId1,
    companyId: companyId1,
    createdBy: userId1,
    modifiedBy: userId1,
    itemStatus: constants.companyProvider.status.active,
    itemData: {
        isProviderSelfEmployedTalent: true,
        isPayable: true,
        legalCompliance: {
            score: "red",
            lastUpdated: "2022-12-12T08:16:23+00:00",
            contractElements: {
                "Service Agreement": {
                    documents: [],
                    status: "missing"
                },
                "Stam Contract": {
                    status: "signed"
                },
            }
        },
        legalDocuments: [
            {
                status: "missing",
                name: "Doc 1",
                legalEntityName: "Entity 1",
                isExpired: false,
            },
            {
                status: "signed",
                name: "Doc 2",
                legalEntityName: "Entity 2",
                isExpired: false,
            }
        ],
    }
};

const talentFromBid = {
    itemId: 'JEST_TEST_LIST_JOBS_TALENT_ID_17',
    entityId: entityId2,
    itemData: {
        name: 'TALENT_17'
    }
}

const talentFromBid2 = {
    itemId: 'JEST_TEST_LIST_JOBS_TALENT_ID_2',
    entityId: entityId2,
    itemData: {
        name: 'TALENT_2'
    }
}

const jobItemMissingPrefix = {
    companyId: companyId3,
    entityId: entityId1,
    itemId: 'JEST-TEST-LIST-JOBS-ATTRS_JOB-ID-4',
    userId: userId2
};

const event = (userId, companyId, filters, filterKey, paginate) => ({
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        type: 'jobsPage',
        filters,
        filterKey,
        paginate
    }
});

const eventTemplates = (userId, companyId, filterKey) => ({
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        type: 'templatePage',
        filterKey
    }
});

const eventPayment = (userId, companyId) => ({
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        type: 'paymentsPage',
    }
});

const eventTalents = (userId, companyId) => ({
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        type: 'talentsPage',
    }
});

const eventBudget = (userId, companyId, filters) => ({
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        type: 'budgetPage',
        filters,
    }
});

const onboardingEvent = (userId, companyId) => ({
    body: "{}",
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        type: 'onboardingPage',
    }
});

const jobForMilestones = {
    entityId: "job_GET-MILESTONES-JEST-TEST--ATTRS-ENT-ID-1",
    itemId: "job_GET-MILESTONES-JEST-TEST-LIST-ATTRS",
    userId: "job_GET-MILESTONES-JEST-TEST-USER-ID-1",
    companyId: "job_GET-MILESTONES-ATTRS-JEST-TEST-COMP-ID-1",
    itemData: { jobTitle: 'jobTitle' }
};

const userForMilestone = {
    userId: jobForMilestones.userId,
    entityId: jobForMilestones.entityId,
    companyId: jobForMilestones.companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
    }
};

const milestone = {
    entityId: jobForMilestones.entityId,
    itemId: "ms_job_GET-MILESTONES-JEST-TEST-LIST-ATTRS_jobGET-MILESTONES-JEST-TEST-MLSTN-ID-1",
    userId: jobForMilestones.userId,
    companyId: jobForMilestones.companyId,
    itemData: {
        jobId: "job_GET-MILESTONES-JEST-TEST-LIST-ATTRS",
        cost: 100,
        actualCost: 200,
        payment: {
            status: constants.payment.status.pendingFunds,
        }
    },
    itemStatus: constants.job.status.completed,
};

const milestone2 = {
    entityId: jobForMilestones.entityId,
    itemId: "ms_job_GET-MILESTONES-JEST-TEST-LIST-ATTRS_jobGET-MILESTONES-JEST-TEST-MLSTN-ID-2",
    userId: jobForMilestones.userId,
    companyId: jobForMilestones.companyId,
    itemData: {
        jobId: "job_GET-MILESTONES-JEST-TEST-LIST-ATTRS",
        cost: 100,
    },
    itemStatus: constants.job.status.overageBudgetRequest,
};

const jobForBudget = {
    entityId: "job_GET-BUDGETJOBS-JEST-TEST--ATTRS-ENT-ID-1",
    itemId: "job_GET-BUDGETJOBS-JEST-TEST-LIST-ATTRS",
    userId: "job_GET-BUDGETJOBS-JEST-TEST-USER-ID-1",
    companyId: companyId5,
    itemData: { jobTitle: 'jobTitle' },
    itemStatus: constants.job.status.active
};

const jobBudgetItem = {
    companyId: jobForBudget.companyId,
    entityId: jobForBudget.entityId,
    itemId: "job_GET-BUDGETJOBS-active-JEST-TEST-LIST-ATTRS2",
    userId: jobForBudget.userId,
    itemStatus: constants.job.status.active
};

const userForBudgetMilestone = {
    userId: jobForBudget.userId,
    entityId: jobForBudget.entityId,
    companyId: jobForBudget.companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        isEditor: true,
        isBudgetOwner: true,
    }
};

const budgetMilestone = {
    entityId: jobForBudget.entityId,
    itemId: `ms_${jobForBudget.itemId}_jobGET-BUDGETJOBS-JEST-TEST-MLSTN-ID-1`,
    userId: jobForBudget.userId,
    companyId: jobForBudget.companyId,
    itemData: {
        jobId: jobForBudget.itemId,
        cost: 100,
        actualCost: 200,
    },
    itemStatus: constants.job.status.completed,
};

const budgetMilestone2 = {
    entityId: jobForBudget.entityId,
    itemId: `ms_${jobForBudget.itemId}_jobGET-BUDGETJOBS-JEST-TEST-MLSTN-ID-2`,
    userId: jobForBudget.userId,
    companyId: jobForBudget.companyId,
    itemData: {
        jobId: jobForBudget.itemId,
        cost: 100,
    },
    itemStatus: constants.job.status.overageBudgetRequest,
};

const jobRequestMilestone1 = {
    entityId: jobForBudget.entityId,
    itemId: `ms_${jobForBudget.itemId}_jobGET--JOBREQUEST-MS-1`,
    userId: jobForBudget.userId,
    companyId: jobForBudget.companyId,
    itemData: {
        jobId: jobForBudget.itemId,
        cost: 100,
        jobRequestLevels: [{ id: 1, type: constants.multiLevelTypes.departmentAdmin, threshold: 101 }],
    },
    itemStatus: constants.job.status.jobRequest,
};

const jobWithCompletedMilestones = {
    entityId: jobForMilestones.entityId,
    itemId: `job_${totalEarnedTest}JOB1`,
    userId: "job_GET-MILESTONES-JEST-TEST-USER-ID-1",
    companyId: companyId1,
    itemData: {
        jobTitle: 'jobTitle1',
        talentId: earnedTestTalent1.itemId
    },
    itemStatus: constants.job.status.active,
};

const completedMilestone1 = {
    entityId: jobWithCompletedMilestones.entityId,
    itemId: `ms_${jobWithCompletedMilestones.itemId}_${totalEarnedTest}MST1`,
    userId: jobWithCompletedMilestones.userId,
    companyId: jobWithCompletedMilestones.companyId,
    itemData: {
        jobId: jobWithCompletedMilestones.itemId,
        title: "Test 4",
        payment: {
            status: constants.payment.status.pending,
            statusHistory: [{
                status: constants.payment.status.pending,
                date: 1664711224000,
            }],
            PendingDate: 1664711224000,
            dueDate: 1664711224000,
        },
        providerData: {
            taxInfo: {
                paymentCurrency: "USD",
                total: 11,
            }
        }
    },
    itemStatus: constants.job.status.completed,
};

const completedMilestone2 = {
    entityId: jobWithCompletedMilestones.entityId,
    itemId: `ms_${jobWithCompletedMilestones.itemId}_${totalEarnedTest}MST2`,
    userId: jobWithCompletedMilestones.userId,
    companyId: jobWithCompletedMilestones.companyId,
    itemData: {
        jobId: jobWithCompletedMilestones.itemId,
        title: "Test 4",
        payment: {
            status: constants.payment.status.paid,
            statusHistory: [{
                status: constants.payment.status.pending,
                date: 1664711224000,
            }],
            PendingDate: 1664711224000,
            dueDate: 1664711224000,
        },
        providerData: {
            taxInfo: {
                paymentCurrency: "USD",
                total: 22,
            }
        }
    },
    itemStatus: constants.job.status.paid,
};

const jobForEnrichmentTest = {
    entityId: jobForMilestones.entityId,
    itemId: `job_${totalEarnedTest}JOB2`,
    userId: "job_GET-MILESTONES-JEST-TEST-USER-ID-1",
    companyId: companyId1,
    itemData: {
        jobTitle: 'jobTitle',
        talentId: earnedTestTalent1.itemId
    },
    itemStatus: constants.job.status.active,
};

const completedMilestone3 = {
    entityId: jobForEnrichmentTest.entityId,
    itemId: `ms_${jobForEnrichmentTest.itemId}_${totalEarnedTest}MST3`,
    userId: jobForEnrichmentTest.userId,
    companyId: jobForEnrichmentTest.companyId,
    itemData: {
        jobId: jobForEnrichmentTest.itemId,
        title: "Test 121",
        providerData: {
            taxInfo: {
                paymentCurrency: "ILS",
                total: 121,
            }
        },
        payment: { dueDate: 123 },
    },
    itemStatus: constants.job.status.completed,
};

const jobTeamEnglishUser = {
    itemId: 'job_team_english_user',
    entityId: entityId4,
    companyId: companyId4,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 100,
    },
    userId: 'englishUser',
    createdBy: 'englishUser',
};
teamsService.set(jobTeamEnglishUser, ['English']);

const msTeamEnglishUser = {
    itemId: `ms_${jobTeamEnglishUser.itemId}_111`,
    entityId: entityId4,
    companyId: companyId4,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 100,
        jobId: jobTeamEnglishUser.itemId,
    },
    userId: 'englishUser',
    createdBy: 'englishUser',
}

const jobTeamEnglishAdmin = {
    itemId: 'job_team_english_admin',
    entityId: entityId4,
    companyId: companyId4,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 100,
    },
    userId: 'entityAdmin',
    createdBy: 'entityAdmin',
};

teamsService.set(jobTeamEnglishAdmin, ['English']);

const msTeamEnglishAdmin = {
    itemId: `ms_${jobTeamEnglishAdmin.itemId}_222`,
    entityId: entityId4,
    companyId: companyId4,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 100,
        jobId: jobTeamEnglishAdmin.itemId,
    },
    userId: 'entityAdmin',
    createdBy: 'entityAdmin',
}

const jobTeamHebrew = {
    itemId: 'job_team_hebrew',
    entityId: entityId4,
    companyId: companyId4,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 200,
    },
    userId: 'hebrewUser',
    createdBy: 'hebrewUser',
};
teamsService.set(jobTeamHebrew, ['Hebrew']);

const msTeamHebrew = {
    itemId: `ms_${jobTeamHebrew.itemId}_333`,
    entityId: entityId4,
    companyId: companyId4,
    itemStatus: constants.job.status.active,
    itemData: {
        cost: 200,
        jobId: jobTeamHebrew.itemId,
    },
    userId: 'hebrewUser',
    createdBy: 'hebrewUser',
};

const talentsAtrributes = ['itemId', 'itemData.img', 'itemData.name', 'itemData.firstName', 'itemData.lastName']
// eslint-disable-next-line no-confusing-arrow
const expectedResponse = (results, omitValues, pick) => pick
    ? _.map(results, (result) => _.pick(result, omitValues))
    : _.map(results, (result) => _.omit(result, omitValues));

describe('listJobs', () => {
    beforeAll(async () => {
        const userEntityAdmin = {
            userId: userId1,
            entityId: entityId1,
            companyId: companyId1,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        };
        let result = await usersService.create(userEntityAdmin);
        expect(result).toEqual(userEntityAdmin);
        const userComapnyAdmin = {
            userId: userId1,
            entityId: companyId1,
            companyId: companyId1,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        };
        result = await usersService.create(userComapnyAdmin);
        expect(result).toEqual(userComapnyAdmin);
        const userForJobWithTalentId = {
            userId: userId3,
            entityId: entityId2,
            companyId: companyId1,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        };
        result = await usersService.create(userForJobWithTalentId);
        expect(result).toEqual(userForJobWithTalentId);
        const userEntityUser = {
            userId: userId2,
            entityId: entityId1,
            companyId: companyId1,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.user,
                isEditor: true
            }
        };
        result = await usersService.create(userEntityUser);
        userEntityUser.entityId = entityId2;
        result = await usersService.create(userEntityUser);
        expect(result).toEqual(userEntityUser);

        // create test job
        result = await jobsService.create(jobItem);
        expect(result.itemId).toBe(jobItem.itemId);
        result = await jobsService.create(jobItem2);
        expect(result.itemId).toBe(jobItem2.itemId);
        result = await jobsService.create(jobItem3);
        expect(result.itemId).toBe(jobItem3.itemId);
        result = await jobsService.create(msJobItem3);
        expect(result.itemId).toBe(msJobItem3.itemId);
        result = await jobsService.create(jobItemWithTalentId);
        expect(result.itemId).toBe(jobItemWithTalentId.itemId);
        result = await jobsService.create(jobItemMissingPrefix);
        expect(result.itemId).toBe(jobItemMissingPrefix.itemId);
        result = await usersService.create(userForMilestone);
        expect(result).toEqual(userForMilestone);
        result = await usersService.create(userForBudgetMilestone);
        expect(result).toEqual(userForBudgetMilestone);
        result = await jobsService.create(jobForMilestones);
        expect(result.itemId).toBe(jobForMilestones.itemId);
        result = await jobsService.create(milestone);
        expect(result.itemId).toBe(milestone.itemId);
        result = await jobsService.create(milestone2);
        expect(result.itemId).toBe(milestone2.itemId);
        result = await jobsService.create(jobForBudget);
        expect(result.itemId).toBe(jobForBudget.itemId);
        result = await jobsService.create(budgetMilestone);
        expect(result.itemId).toBe(budgetMilestone.itemId);
        result = await jobsService.create(budgetMilestone2);
        expect(result.itemId).toBe(budgetMilestone2.itemId);
        result = await jobsService.create(jobBudgetItem);
        expect(result.itemId).toBe(jobBudgetItem.itemId);
        result = await jobsService.create(jobRequestMilestone1);
        expect(result.itemId).toBe(jobRequestMilestone1.itemId);
        result = await companyProvidersService.create(talent5);
        expect(result.itemId).toBe(talent5.itemId);
        result = await talentsService.create(talentFromBid);
        expect(result.itemId).toBe(talentFromBid.itemId);
        result = await talentsService.create(talentFromBid2);
        expect(result.itemId).toBe(talentFromBid2.itemId);
        await companyProvidersService.create(companyProvider5);
        result = await jobsService.create(jobWithCompletedMilestones);
        expect(result.itemId).toBe(jobWithCompletedMilestones.itemId);
        result = await jobsService.create(jobForEnrichmentTest);
        expect(result.itemId).toBe(jobForEnrichmentTest.itemId);
        result = await jobsService.create(completedMilestone1);
        expect(result.itemId).toBe(completedMilestone1.itemId);
        result = await jobsService.create(completedMilestone2);
        expect(result.itemId).toBe(completedMilestone2.itemId);
        result = await jobsService.create(completedMilestone3);
        expect(result.itemId).toBe(completedMilestone3.itemId);
        result = await jobsService.create(jobTemplateItem);
        expect(result.itemId).toBe(jobTemplateItem.itemId);
        await companyProvidersService.create(earnedTestProvider1);
        result = await companyProvidersService.create(earnedTestTalent1);
        expect(result.itemId).toBe(earnedTestTalent1.itemId);
        result = await companyProvidersService.create(companyProvider3);
        expect(result.itemId).toBe(companyProvider3.itemId);

        // teams security tests - companyId4 and entityId4
        await users.createAdmin(companyId4, companyId4, 'companyAdmin');
        await users.createAdmin(companyId4, entityId4, 'companyAdmin');
        await users.createAdmin(companyId4, entityId4, 'entityAdmin', ['English']);
        await users.create(companyId4, entityId4, 'jobList_test_approver')
        await users.create(companyId4, entityId4, 'englishUser', constants.user.role.user, ['English']);
        await users.create(companyId4, entityId4, 'hebrewUser', constants.user.role.user, ['Hebrew']);

        await jobsService.create(jobTeamEnglishAdmin);
        await jobsService.create(jobTeamEnglishUser);
        await jobsService.create(jobTeamHebrew);

        await jobsService.create(msTeamEnglishAdmin);
        await jobsService.create(msTeamEnglishUser);
        await jobsService.create(msTeamHebrew);

        await settingsService.create(companySettings);
        await settingsService.create(companySettings1);
    });

    it('listJobs jobs page expect 200, data', async () => {
        const response = await handler.run(event(userId1, companyId1));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({
            bids: [{ itemId: 'JEST_TEST_LIST_JOBS_TALENT_ID_17' }],
            jobs: expectedResponse([
                jobItem3,
                jobItem,
                jobItem2,
                jobItemWithTalentId,
                jobWithCompletedMilestones,
                jobForEnrichmentTest,
                msJobItem3,
                completedMilestone1,
                completedMilestone2,
                completedMilestone3,
            ], ['createdAt', 'modifiedAt', 'itemData.payment', 'talentId', 'viewData']),
            talents: expectedResponse([talent5, earnedTestTalent1], talentsAtrributes, true),
        });
    });

    it('listJobs jobs page active tab with paginate expect 200, data', async () => {
        const response = await handler.run(event(userId1, companyId1, undefined, 'active', true));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody.jobs[0]).toMatchObject(
            {
                itemId: 'job_JEST-TEST-LIST-JOBS-ATTRS-JOB-ID-3',
                jobId: 'job_JEST-TEST-LIST-JOBS-ATTRS-JOB-ID-3',
                entityId: 'JEST-TEST-LIST-JOBS-ATTRS_ENT-ID-2',
                companyId: 'JEST-TEST-LIST-JOBS-ATTRS_COMPANY-ID-1',
                hiringManagerId: 'JEST-TEST-LIST-JOBS-ATTRS_USER-ID-2',
                isHiringManager: false,
                status: 'Active',
                title: 'New external approver job',
                description: '',
                engagementType: 'project',
                currency: 'USD',
                tags: [],
                jobHandShakeStage: 'APPROVED',
                talentId: 'talent_provider_22222talent_2222',
                talentName: '',
                plannedLocal: 33,
                requested: 100,
                approved: 100,
                jobMilestoneCardData: {
                    total: 1,
                    completed: 0,
                    request: 0,
                    nextMilestoneKey: 'pendingPayment'
                },
                activeMilestones: 1,
                providerId: 'provider_22222'
            },
        );
    });

    it('listJobs with filters jobs page expect 200, data', async () => {
        const filters = { entityId: ['JEST-TEST-LIST-JOBS-ATTRS_ENT-ID-2'], userId: ['JEST-TEST-LIST-JOBS-ATTRS_USER-ID-2'] };
        const response = await handler.run(event(userId1, companyId1, filters, 'pendingApproval'));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({
            bids: [],
            jobs: [_.omit(jobItem3, ['createdAt', 'modifiedAt', 'talentId', 'viewData']), _.omit(msJobItem3, ['createdAt', 'modifiedAt', 'talentId', 'viewData'])],
            talents: [],
        });
        const approvers = _.get(
            _.find(_.get(responseBody, 'jobs'), milestone => milestone.itemId === msJobItem3.itemId),
            'approvers'
        )
        expect(approvers).toEqual([userId2])
    });

    it('listJobs payments page expect 200, data', async () => {
        const response = await handler.run(eventPayment(userId1, companyId1));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({
            jobs: expectedResponse(
                [jobItem3, jobItem, jobItem2, jobItemWithTalentId, jobWithCompletedMilestones, jobForEnrichmentTest, msJobItem3, completedMilestone1, completedMilestone2, completedMilestone3,],
                ['createdAt', 'modifiedAt', 'itemData.bids', 'itemData.payment', 'talentId', 'itemData.jobHandShakeStage', 'viewData']
            ),
            talents: [
                _.omit(talent5, ['createdAt', 'modifiedAt', 'companyId']),
                _.omit(earnedTestTalent1, ['createdAt', 'modifiedAt', 'companyId']),
                _.omit(companyProvider5, ['createdAt', 'modifiedAt', 'companyId']),
            ],
        });
        const currentPaymentCycle = new Date(companyDueDateService.getFromCompanySettings(companySettings1.itemData.paymentSchedule)).setUTCHours(23, 59, 59, 999);
        expect(responseBody.paymentCycles[0]).toBe(currentPaymentCycle);
        expect(responseBody.paymentCycles.length).toBe(1);
    });

    it('listJobs talents page expect 200, data', async () => {
        const response = await handler.run(eventTalents(userId1, companyId1));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        const omitedTalents = _.map(responseBody.talents, (talent) => talent.itemId !== providerId1 ? _.omit(talent, ['paymentMethod', 'allowedActions', 'complianceInfo']) : _.omit(talent, ['paymentMethod', 'complianceInfo']));
        const testBody = { ...responseBody, talents: omitedTalents };
        expect(testBody).toMatchObject({
            jobs:
                [
                    _.omit(jobItem3, ['createdAt', 'modifiedAt', 'itemData.bids', 'talentId', 'itemData.currency', 'itemData.jobHandShakeStage', 'viewData']),
                    _.omit(jobItem, ['createdAt', 'modifiedAt', 'itemData.bids', 'talentId', 'viewData']),
                    _.omit(jobItem2, ['createdAt', 'modifiedAt', 'itemData.bids', 'talentId', 'viewData']),
                    _.omit(jobItemWithTalentId, ['createdAt', 'modifiedAt', 'itemData.bids', 'viewData']),
                    {
                        ..._.omit(jobWithCompletedMilestones, ['createdAt', 'modifiedAt', 'viewData']),
                        activeMilestonesCount: 0,
                        totalEarned: { USD: 33 },
                    },
                    {
                        ..._.omit(jobForEnrichmentTest, ['createdAt', 'modifiedAt', 'viewData']),
                        lastPaymentDate: 123,
                        activeMilestonesCount: 0,
                        totalEarned: { ILS: 121 },
                    },
                ],
            talents: [
                { ..._.omit(companyProvider3, ['createdBy', 'modifiedBy', 'modifiedAt', 'companyId']), allowedActions: { "cancelInvitation": { "value": false }, "removeTalent": { "value": false }, "deactivate": { "value": true }, "startJob": { "value": false, "warning": true }, "requestPayment": { "warning": true } } },
                { ..._.omit(talent5, ['createdAt', 'modifiedAt', 'companyId']), totalEarned: {} },
                {
                    ..._.omit(earnedTestTalent1, ['createdAt', 'modifiedAt', 'companyId']),
                    totalEarned: { USD: 33, ILS: 121 },
                    lastPaymentDate: 1664711224000,
                    activeMilestonesCount: 0,
                },
                _.omit(companyProvider5, ['createdAt', 'modifiedAt', 'companyId']),
                _.omit(earnedTestProvider1, ['createdAt', 'modifiedAt', 'companyId']),
            ]
        });
    });

    it('listJobs with statistics on talents page expect 200, data', async () => {
        const response = await handler.run(eventTalents(jobForMilestones.userId, jobForMilestones.companyId));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody.jobs).toMatchObject([
            {
                ..._.omit(jobForMilestones, ['createdAt', 'modifiedAt', 'itemData.bids']),
                activeMilestonesCount: 1,
                totalEarned: { USD: 200 }
            }
        ]);
    });

    it('listJobs with statistics on talents page expect 200, data', async () => {
        const copySetting = _.cloneDeep(companySettings);
        copySetting.companyId = jobForMilestones.companyId;
        copySetting.itemId = `comp_${jobForMilestones.companyId}`;
        copySetting.itemData.isActiveTalentNoJobsMode = true;
        await settingsService.create(copySetting);
        const response = await handler.run(eventTalents(jobForMilestones.userId, jobForMilestones.companyId));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody.jobs).toMatchObject([
            
        ]);
        await settingsService.delete(copySetting.itemId);
    });


    it('listJobs with milestones, expect 200, job & milestones', async () => {
        const response = await handler.run(event(jobForMilestones.userId, jobForMilestones.companyId));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody).toMatchObject({
            jobs: [
                _.omit(jobForMilestones, ['createdAt', 'modifiedAt']),
                _.omit(milestone, ['createdAt', 'modifiedAt']),
                _.omit(milestone2, ['createdAt', 'modifiedAt']),
            ]
        });
    });

    it('listJobsByCompanyId entity user, expect 200, data', () => handler.run(event(userId2, companyId1)).then((response) => {
        expect(response.statusCode).toBe(200);
        const responseObj = JSON.parse(response.body);
        expect(responseObj.jobs.length).toBe(3);
        expect(responseObj).toMatchObject({
            jobs: [
                _.omit(jobItem3, ['createdAt', 'modifiedAt', 'talentId', 'viewData']),
                _.omit(jobItem2, ['createdAt', 'modifiedAt', 'talentId', 'viewData']),
                _.omit(msJobItem3, ['createdAt', 'modifiedAt']),
            ]
        });
    }))

    it('listJobs, expect unauthorised', async () => {
        const response = await handler.run(event('NO_SUCH_USER'));
        expect(response.statusCode).toBe(500);
    });


    it('teams - companyAdmin list companyId4', async () => {
        const response = await handler.run(event('companyAdmin', companyId4));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(6);
    });

    it('teams - entityAdmin list companyId4', async () => {
        const response = await handler.run(event('entityAdmin', companyId4));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(4);
        expect(data.jobs).toEqual(expect.arrayContaining([
            _.omit(jobTeamEnglishAdmin, ['modifiedAt', 'createdBy']),
            _.omit(msTeamEnglishAdmin, ['modifiedAt', 'createdBy']),
            _.omit(jobTeamEnglishUser, ['modifiedAt', 'createdBy']),
            _.omit(msTeamEnglishUser, ['modifiedAt', 'createdBy']),
        ]));
    });

    it('teams - englishUser list companyId4', async () => {
        const response = await handler.run(event('englishUser', companyId4));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(2);
        expect(data.jobs).toEqual(expect.arrayContaining([
            _.omit(jobTeamEnglishUser, ['modifiedAt', 'createdBy']),
            _.omit(msTeamEnglishUser, ['modifiedAt', 'createdBy']),
        ]));
    });

    it('teams - hebrewUser list companyId4', async () => {
        const response = await handler.run(event('hebrewUser', companyId4));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(2);
        expect(data.jobs).toEqual(expect.arrayContaining([
            _.omit(jobTeamHebrew, ['modifiedAt', 'createdBy']),
            _.omit(msTeamHebrew, ['modifiedAt', 'createdBy']),
        ]));
    });

    it('listJobs with filters budget page expect 200, data', async () => {
        const filters = { itemStatus: ['budgetRequest', 'overageBudgetRequest', 'Active'] };
        const response = await handler.run(eventBudget(jobForBudget.userId, jobForBudget.companyId, filters));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data).toMatchObject({
            jobs: [
                _.omit(jobForBudget, ['createdAt', 'modifiedAt']),
                _.omit(budgetMilestone2, ['createdAt', 'modifiedAt']),
            ]
        });
    });

    it('listJobs with pending approval expect 200, data', async () => {
        const response = await handler.run(event(jobForBudget.userId, jobForBudget.companyId, null, 'pendingApproval'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data).toMatchObject({
            jobs: [
            ]
        });
    });

    it('listJobs with budgetRequests expect 200, data', async () => {
        const response = await handler.run(event(jobForBudget.userId, jobForBudget.companyId, null, 'budgetRequests'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data).toMatchObject({
            jobs: [
                _.omit(jobForBudget, ['createdAt', 'modifiedAt']),
                _.omit(budgetMilestone2, ['createdAt', 'modifiedAt'])
            ]
        });
        const approvers = _.get(
            _.find(_.get(data, 'jobs'), milestone => milestone.itemId === budgetMilestone2.itemId),
            'approvers'
        )
        expect(approvers).toEqual([jobForBudget.userId])
    });

    it('listJobs with jobRequests expect 200, data', async () => {
        const response = await handler.run(event(jobForBudget.userId, jobForBudget.companyId, null, 'jobRequests'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data.jobs.length).toBe(2);
        expect(data.jobs[1].approveJobRequestOptions.directApprovals.length).toBe(1);
    });

    it('listJobs with active expect 200, data', async () => {
        const response = await handler.run(event(jobForBudget.userId, jobForBudget.companyId, null, 'active'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data).toMatchObject({
            jobs: [
                _.omit(jobForBudget, ['createdAt', 'modifiedAt']),
                _.omit(jobBudgetItem, ['createdAt', 'modifiedAt']),
                _.omit(jobRequestMilestone1, ['createdAt', 'modifiedAt']),
                _.omit(budgetMilestone, ['createdAt', 'modifiedAt']),
                _.omit(budgetMilestone2, ['createdAt', 'modifiedAt']),
            ],
        });
    });

    it('listJobs with posted expect 200, data', async () => {
        const response = await handler.run(event(jobForBudget.userId, jobForBudget.companyId, null, 'posted'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data).toMatchObject({
            jobs: [
            ]
        });
    });

    it('listJobs with drafts expect 200, data', async () => {
        const response = await handler.run(event(jobForBudget.userId, jobForBudget.companyId, null, 'drafts'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data).toMatchObject({
            jobs: [
            ]
        });
    });

    it('listJobs with all expect 200, data', async () => {
        const response = await handler.run(event(jobForBudget.userId, jobForBudget.companyId, null, 'all'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data).toMatchObject({
            jobs: [
                _.omit(jobForBudget, ['createdAt', 'modifiedAt']),
                _.omit(jobBudgetItem, ['createdAt', 'modifiedAt']),
                _.omit(jobRequestMilestone1, ['createdAt', 'modifiedAt']),
                _.omit(budgetMilestone, ['createdAt', 'modifiedAt']),
                _.omit(budgetMilestone2, ['createdAt', 'modifiedAt']),
            ],
        });
    });

    it('listJobsAttrs templets page for posted expect 200, data', async () => {
        const response = await handler.run(eventTemplates(jobItemWithTalentId.userId, jobItemWithTalentId.companyId, 'posted'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data).toMatchObject({
            jobs: [
                _.omit(jobItemWithTalentId, ['createdAt', 'modifiedAt'])
            ]
        });
    });

    it('listJobsAttrs templets page for templates expect 200, data', async () => {
        const response = await handler.run(eventTemplates(jobForBudget.userId, jobForBudget.companyId, 'templates'));
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.body);
        expect(data).toMatchObject({
            jobs: [
                _.omit(jobTemplateItem, ['createdAt', 'modifiedAt', 'talentId'])
            ]
        });
    });


    afterAll(async () => {
        await jobsService.delete(entityId1, jobItem.itemId);
        await jobsService.delete(entityId1, jobItem2.itemId);
        await jobsService.delete(entityId2, jobItemWithTalentId.itemId);
        await jobsService.delete(jobItemMissingPrefix.entityId, jobItemMissingPrefix.itemId);
        await jobsService.delete(jobTeamEnglishAdmin.entityId, jobTeamEnglishAdmin.itemId);
        await jobsService.delete(jobTeamEnglishUser.entityId, jobTeamEnglishUser.itemId);
        await jobsService.delete(jobTeamHebrew.entityId, jobTeamHebrew.itemId);
        await jobsService.delete(msTeamEnglishAdmin.entityId, msTeamEnglishAdmin.itemId);
        await jobsService.delete(msTeamEnglishUser.entityId, msTeamEnglishUser.itemId);
        await jobsService.delete(msTeamHebrew.entityId, msTeamHebrew.itemId);
        await jobsService.delete(jobWithCompletedMilestones.entityId, jobWithCompletedMilestones.itemId);
        await jobsService.delete(jobForEnrichmentTest.entityId, jobForEnrichmentTest.itemId);
        await jobsService.delete(completedMilestone1.entityId, completedMilestone1.itemId);
        await jobsService.delete(completedMilestone2.entityId, completedMilestone2.itemId);
        await jobsService.delete(completedMilestone3.entityId, completedMilestone3.itemId);
        await jobsService.delete(jobForMilestones.entityId, jobForMilestones.itemId);
        await jobsService.delete(jobForMilestones.entityId, milestone.itemId);
        await jobsService.delete(jobForMilestones.entityId, milestone2.itemId);
        await jobsService.delete(jobForBudget.entityId, jobForBudget.itemId);
        await jobsService.delete(jobForMilestones.entityId, budgetMilestone.itemId);
        await jobsService.delete(jobForMilestones.entityId, budgetMilestone2.itemId);
        await jobsService.delete(jobForBudget.entityId, jobBudgetItem.itemId);
        await jobsService.delete(jobItem3.entityId, jobItem3.itemId);
        await jobsService.delete(msJobItem3.entityId, msJobItem3.itemId);
        await jobsService.delete(jobTemplateItem.entityId, jobTemplateItem.itemId);
        await jobsService.delete(jobRequestMilestone1.entityId, jobRequestMilestone1.itemId);

        await usersService.delete(userId1, entityId1);
        await usersService.delete(userId1, companyId1);
        await usersService.delete(userId2, entityId1);
        await usersService.delete(userId2, companyId1);
        await usersService.delete(userId2, entityId2);
        await usersService.delete(userId3, entityId2);
        await usersService.delete(jobForMilestones.userId, jobForMilestones.entityId);
        await usersService.delete(jobForBudget.userId, jobForBudget.entityId);

        await talentsService.delete(talentFromBid.itemId);
        await talentsService.delete(talentFromBid2.itemId);

        await users.remove(companyId4, 'companyAdmin');
        await users.remove(entityId4, 'companyAdmin');
        await users.remove(entityId4, 'entityAdmin');
        await users.remove(entityId4, 'hebrewUser');
        await users.remove(entityId4, 'englishUser');
        await users.remove(entityId4, 'jobList_test_approver');

        await companyProvidersService.delete(earnedTestProvider1.companyId, earnedTestProvider1.itemId);
        await companyProvidersService.delete(companyProvider5.companyId, companyProvider5.itemId);
        await companyProvidersService.delete(talent5.companyId, talent5.itemId);
        await companyProvidersService.delete(earnedTestTalent1.companyId, earnedTestTalent1.itemId);
    });
});


describe('listJobs2', () => {
    beforeAll(async () => {
        const userEntityAdmin = {
            userId: userId1,
            entityId: entityId1,
            companyId: companyId1,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        };
        let result = await usersService.create(userEntityAdmin);
        expect(result).toEqual(userEntityAdmin);
        const userComapnyAdmin = {
            userId: userId1,
            entityId: companyId1,
            companyId: companyId1,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        };
        result = await usersService.create(userComapnyAdmin);
        expect(result).toEqual(userComapnyAdmin);
        const userForJobWithTalentId = {
            userId: userId3,
            entityId: entityId2,
            companyId: companyId1,
            itemStatus: constants.user.status.active,
            itemData: {
                userRole: constants.user.role.admin,
                isEditor: true
            }
        };
        result = await jobsService.create(jobItem);
        expect(result.itemId).toBe(jobItem.itemId);
        result = await jobsService.create(jobItem2);
        expect(result.itemId).toBe(jobItem2.itemId);
        result = await jobsService.create(jobItem3);
        expect(result.itemId).toBe(jobItem3.itemId);
        result = await companyProvidersService.create(talent1);
        expect(result.itemId).toBe(talent1.itemId);
        result = await companyProvidersService.create(talent2);
        expect(result.itemId).toBe(talent2.itemId);
        result = await companyProvidersService.create(talent3);
        expect(result.itemId).toBe(talent3.itemId);
        result = await companyProvidersService.create(companyProvider4);
        expect(result.itemId).toBe(companyProvider4.itemId);
        result = await companyProvidersService.create(complianceScorestTestProvider1);
        expect(result.itemId).toBe(complianceScorestTestProvider1.itemId);
        result = await companyProvidersService.create(complianceScorestTestTalent1);
        expect(result.itemId).toBe(complianceScorestTestTalent1.itemId);

        await users.createAdmin(companyId4, companyId4, 'companyAdmin');
        await users.createAdmin(companyId4, entityId4, 'companyAdmin');
    })

    it('listJobs talents with itemStatus active for talent with jobs expect 200, data', async () => {
        const response = await handler.run(eventTalents(userId1, companyId1));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body).talents;
        const talent1Response = _.find(responseBody, talent => talent.itemId === talentId1)
        expect(talent1Response.itemStatus).toEqual(constants.companyProvider.status.active);
    });

    it('listJobs talents with self employed talents - comliance scores expect 200, data', async () => {
        const response = await handler.run(eventTalents(userId1, companyId1));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body).talents;
        const talent1Response = _.find(responseBody, talent => talent.itemId === talentId1)
        expect(talent1Response.complianceInfo.scores).toEqual({ general: 0, workforce: 0, legal: 0, tax: 3 });
        const talent2Response = _.find(responseBody, talent => talent.itemId === talentId2)
        expect(talent2Response.complianceInfo.scores).toEqual({ general: 1, workforce: 0, legal: 1, tax: 3 });
        const talent3Response = _.find(responseBody, talent => talent.itemId === talentId3)
        expect(talent3Response.complianceInfo.scores).toEqual({ general: 0, workforce: 0, legal: 0, tax: 3 });
    });

    it('listJobs talents under company and provider company - comliance scores expect 200, data', async () => {
        const response = await handler.run(eventTalents(userId1, companyId1));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body).talents;
        const providerResponse = _.find(responseBody, talent => talent.itemId === complianceScorestTestProvider1.itemId)
        expect(providerResponse.complianceInfo.scores).toEqual({ general: 1, workforce: 0, legal: 0, tax: 0 });
        const talentResponse = _.find(responseBody, talent => talent.itemId === complianceScorestTestTalent1.itemId)
        expect(talentResponse.complianceInfo.scores).toEqual({ general: 1, workforce: 0, legal: 1, tax: 3 });
    });

    it('listJobs talents under company and provider company - payable status expect 200, data', async () => {
        const response = await handler.run(eventTalents(userId1, companyId1));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body).talents;

        const providerResponse = _.find(responseBody, talent => talent.itemId === complianceScorestTestProvider1.itemId)
        expect(providerResponse.payableStatus.payableStatus).toBe('green');
        const talentResponse = _.find(responseBody, talent => talent.itemId === complianceScorestTestTalent1.itemId)
        expect(talentResponse.payableStatus.isPayableValid).toBeTruthy();

        expect(responseBody[0].payableStatus.payableStatus).toBe('yellow');
        expect(responseBody[0].payableStatus.payableSummary.payableElements.paymentDetailsSubmitted).toBeTruthy();
        expect(responseBody[0].payableStatus.payableSummary.payableElements.taxFormsSubmitted).toBeTruthy();
        expect(responseBody[0].payableStatus.payableSummary.paymentConditions.mandatoryLegalDocsSigned).toBeFalsy();
        expect(responseBody[0].payableStatus.payableSummary.paymentConditions.workforceComplianceStatus).toBe(undefined);

        expect(responseBody[1].payableStatus.payableStatus).toBe('red');
        expect(responseBody[1].payableStatus.payableSummary.payableElements.paymentDetailsSubmitted).toBeFalsy();
        expect(responseBody[1].payableStatus.payableSummary.payableElements.taxFormsSubmitted).toBeTruthy();
        expect(responseBody[1].payableStatus.payableSummary.paymentConditions.mandatoryLegalDocsSigned).toBeFalsy();
        expect(responseBody[1].payableStatus.payableSummary.paymentConditions.workforceComplianceStatus).toBe(undefined);

    });

    it('onboarding talents, data', async () => {
        const response = await handler.run(onboardingEvent(userId1, companyId1));
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);

        //talent with 60% on boarding progress - talent profile info is not a requirement
        expect(responseBody.onboardingSummary[0].legalDocsCount).toBe(2);
        expect(responseBody.onboardingSummary[0].signedLegalDocsCount).toBe(1);
        expect(responseBody.onboardingSummary[0].legalDocsValue).toBe("No");
        expect(responseBody.onboardingSummary[0].onboardingProgressPercentage).toBe(0.6);
        expect(responseBody.onboardingSummary[0].profileStep).toBe(1);
        expect(responseBody.onboardingSummary[0].payableStatusValue).toBe('Custom Restrectid');


         //talent with 20% on boarding progress
         expect(responseBody.onboardingSummary[1].legalDocsCount).toBe(2);
         expect(responseBody.onboardingSummary[1].signedLegalDocsCount).toBe(1);
         expect(responseBody.onboardingSummary[1].legalDocsValue).toBe("No");
         expect(responseBody.onboardingSummary[1].onboardingProgressPercentage).toBe(0.2);
         expect(responseBody.onboardingSummary[1].profileStep).toBe(0);
         expect(responseBody.onboardingSummary[1].payableStatusValue).toBe('No');




        //talent with 100% on boarding progress - legal compliance and tax compliance valid 
        expect(responseBody.onboardingSummary[2].taxDocsCount).toBe(0);
        expect(responseBody.onboardingSummary[2].signedTaxDocsCount).toBe(0);
        expect(responseBody.onboardingSummary[2].taxDocsValue).toBe("Yes");
        expect(responseBody.onboardingSummary[2].legalDocsCount).toBe(0);
        expect(responseBody.onboardingSummary[2].signedLegalDocsCount).toBe(0);
        expect(responseBody.onboardingSummary[2].legalDocsValue).toBe("Yes");
        expect(responseBody.onboardingSummary[2].profileStep).toBe(6);
        expect(responseBody.onboardingSummary[2].onboardingProgressPercentage).toBe(1);
        expect(responseBody.onboardingSummary[2].payableStatusValue).toBe('Yes');



    });

    afterAll(async () => {
        await jobsService.delete(entityId1, jobItem.itemId);
        await jobsService.delete(entityId1, jobItem2.itemId);
        await jobsService.delete(jobItem3.entityId, jobItem3.itemId);
        await jobsService.delete(budgetMilestone.entityId, budgetMilestone.itemId);
        await jobsService.delete(budgetMilestone2.entityId, budgetMilestone2.itemId);
        await companyProvidersService.delete(talent1.companyId, talent1.itemId);
        await companyProvidersService.delete(talent2.companyId, talent2.itemId);
        await companyProvidersService.delete(talent3.companyId, talent3.itemId);
        await companyProvidersService.delete(companyProvider4.companyId, companyProvider4.itemId);
        await companyProvidersService.delete(complianceScorestTestTalent1.companyId, complianceScorestTestTalent1.itemId);
        await companyProvidersService.delete(complianceScorestTestProvider1.companyId, complianceScorestTestProvider1.itemId);
        await companyProvidersService.delete(companyProvider3.companyId, companyProvider3.itemId);
        await usersService.delete(userId1, entityId1);
        await usersService.delete(userId1, companyId1);
        await users.remove(companyId4, 'companyAdmin');
        await users.remove(entityId4, 'companyAdmin');
        await settingsService.delete(companySettings.itemId);
        await settingsService.delete(companySettings1.itemId);
    })
})
