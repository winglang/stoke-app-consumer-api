'use strict';
const _ = require('lodash');
const dayjs = require('dayjs');
const createCsvReport = require("../src/job/createCsvReport");
const jestPlugin = require("serverless-jest-plugin");
const handler = jestPlugin.lambdaWrapper.wrap(createCsvReport, { handler: 'handler' });
const { constants, UsersService, JobsService, CompanyProvidersService, CompaniesService, SettingsService, idConverterLib, companyDueDateService, jobHelper, ListService, POService } = require('stoke-app-common-api');
const csvLib = require('stoke-app-common-api/lib/csvLib');
const { escape, getMilestoneTitle, getStatusString, resolveUserFullName, getTalentDisplayedStatus, getDepartmentsAmountValues, getIsTalentPayable, getProviderSkillsInfo, getProviderLanguagesSummary, getAverageRatingByReviews, getTotalEarned, getProviderCertificationsSummary, getProviderExperienceSummary } = require('../src/helpers/csvReport/csvReportHelper');
const { getComplianceColorByCalculatedValue } = require('../src/helpers/complianceHelper');
const { basicFieldsForJobsPage, allFieldsForPaymentPage, allFieldsForJobsPage, allFieldsForTalentDirectoryPage, headersNamesForJobFields, headersNamesForPaymentsFields, headersNamesForTalentDirectoryFields, basicFieldsForTalentDirectoryPage } = require('../src/helpers/csvReport/csvFieldsLists');
const { formatTimestamp, convertCountryCodeToName, getPaymentStatusByMilestoneStatus, getJobHoursValues, resolvePaymentMethod, prettifyNumber, getTalentAddress, getTalentCountry, getTalentPhone } = require('../src/helpers/utils');
const { backgroundCheckDisplayedStatus, paymentStatusDisplayedName } = require('../src/helpers/csvReport/constants');
const { buildPaymentCycleFilterBuilder } = require('../src/helpers/csvReport/filters');
const { jobListType } = require('../src/job/queryAttrs');
const listService = new ListService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const AWS = require('aws-sdk');
const s3 = new AWS.S3({});
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes)
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAndTagsAttributes);
const settingsService = new SettingsService(process.env.settingsTableName);
const poService = new POService(process.env.budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);

const testName = 'CREATE-CSV-TEST'
const entityId1 = `${testName}-ENT-ID-1`;
const entityId2 = `${testName}-ENT-ID-2`;
const entityId3 = `${testName}-ENT-ID-3`;
const companyId = `${testName}-COMP-ID-1`;
const companyId2 = `${testName}-COMP-ID-2`;
const userId1 = `${testName}-USER-ID-1`;
const userId2 = `${testName}-USER-ID-2`;
const userId3 = `${testName}-USER-ID-3`;
const providerId1 = `${constants.prefix.provider}${companyId}_PROVIDER-ID-1`;
const providerId2 = `${constants.prefix.provider}${companyId}_PROVIDER-ID-2`;
const providerId3 = `${constants.prefix.provider}${companyId}_PROVIDER-ID-3`;
const talentId1 = `${constants.prefix.talent}${providerId1}${constants.prefix.talent}${testName}-TALENT-ID-1`;
const talentId2 = `${constants.prefix.talent}${providerId2}${constants.prefix.talent}${testName}-TALENT-ID-2`;
const talentId3 = `${constants.prefix.talent}${providerId1}${constants.prefix.talent}${testName}-TALENT-ID-3`;
const jobId1 = `job_${testName}-job-1`;
const jobId2 = `job_${testName}-job-2`;
const jobId3 = `job_${testName}-job-3`;
const jobId4 = `job_${testName}-job-4`;
const jobId5 = `job_${testName}-job-5`;
const jobId6 = `job_${testName}-job-6`;
const milestoneId1 = `ms_${jobId1}_ms1`;
const milestoneId2 = `ms_${jobId2}_ms2`;
const poId1 = `po_${testName}-po-1`;
const poId2 = `po_${testName}-po-2`;
const lineItemId1 = `${poId1}_LI-1`;

const milestoneId3_1 = `ms_${jobId3}_ms1`;
const milestoneId3_2 = `ms_${jobId3}_ms2`;
const milestoneId3_3 = `ms_${jobId3}_ms3`;
const milestoneId4_1 = `ms_${jobId4}_ms1`;
const milestoneId4_2 = `ms_${jobId4}_ms2`;
const milestoneId5_1 = `ms_${jobId5}_ms1`;
const milestoneId6_1 = `ms_${jobId6}_ms1`;

const LIST_NAME = 'LIST_FOR_EXAMPLE'
const DOCUMENT_ID = 'SETTINGS_ID'
let listId

const itemId = (documentType, documentId) => {
  const documentPrefix = constants.prefix[documentType]

  return `${documentPrefix}${documentId}`
}

const createBasicSettings = async (documentType, documentId, companyId, userId) => {
  const companySettings = {
      itemId: itemId(documentType, documentId),
      userId,
      companyId,
      entityId: documentId,
      itemStatus: constants.settings.status.active,
      itemData: {}
  };

  return await settingsService.create(companySettings);
}
const complianceSequenceFields = ["workingPeriod", "activeEngagementLength", "averageMonthlyHours", "averageMonthlyPay"];

const getTalentDirectoryHadersByFields = () => {
  const field_header = _.chain(basicFieldsForTalentDirectoryPage).keyBy('field').mapValues('headerName').value();
  return _.map(complianceSequenceFields, (field) => field_header[field]);
}

const complianceSequenceHeaders = getTalentDirectoryHadersByFields();

const removeSequenceFields = (rows) => {
  return rows.map(row => _.omit(row, complianceSequenceHeaders));
}

const customFieldsIds = {
  job: {
    externalApproverEmail: 'stoke::externalApproverEmail',
    customTextJob1: 'customTextJob1',
    customTagsJob1: 'customTagsJob1'
  },
  ms: {
    customTextMs1: 'customTextMs1',
    customTagsMs1: 'customTagsMs1',
  }
}

const customFieldsArray = ['stoke::externalApproverEmail', 'customTextJob1', 'customTagsJob1', 'customTextMs1', 'customTagsMs1'];
const customFieldsHeadersArray = ['Parent Email', 'Job custom text field1', 'Job custom tag field1', 'Ms custom text field1', 'Ms custom tag field1'];
const talentProfileFieldsHeaders = ["talentProfileCustomField::Emergency phone number", "talentProfileCustomField::Food allergies"];
const lineItemsArray = ['Line item title', 'Line item description', 'Line item amount', 'Line item currency'];
const fieldsForJobsPage = allFieldsForJobsPage.concat(['lineItems'])

const po1 = {
  itemId: poId1,
  companyId,
  createdBy: testName,
  poScope: {
      scopeIds: [entityId1],
      scopeType: constants.poScopeTypes.departments,
      poTypes: [constants.poTypes.talentService],
  },
  amount: 800,
  poNumber: 'poNumber1',
}

const lineItem1 = {
  itemId: lineItemId1,
  companyId,
  createdBy: testName,
  amount: 200,
  poScope: {
    scopeIds: [entityId1],
    scopeType: constants.poScopeTypes.departments,
    poTypes: [constants.poTypes.feesAndAdjustments, constants.poTypes.talentService],
  },
  poNumber: 'lineItem1',
}

const po2 = {
  itemId: poId2,
  companyId,
  createdBy: testName,
  poScope: {
      scopeIds: [talentId2],
      scopeType: constants.poScopeTypes.talents,
      poTypes: [constants.poTypes.talentService, constants.poTypes.feesAndAdjustments],
  },
  amount: 700,
  poNumber: 'poNumber2',
}

const job1 = {
  companyId,
  entityId: entityId1,
  itemId: jobId1,
  userId: userId1,
  itemStatus: constants.job.status.active,
  talentId: talentId1,
  itemData: {
    talentId : talentId1,
    jobTitle: "programming",
    talentId: talentId1,
    engagementType: "project",
    jobHandShakeStage: "APPROVED",
    hourlyBudget: 38.25,
    customRateData: {
      category: "Word",
      estimatedQuantity: "25",
      ratePer: 1
    },
    jobStartDate: "2022-11-14",
  },
  tags: {
    address: 'address',
    __stoke__teams: ["SMA"]
  },
  viewData: {
    milestonesData: {
      aggregatedMilestonesAmounts: {
        ILS: {
          totalActualLocal: 50,
          totalRequestedLocal: 454.92999999999995
        },
        USD: {
          totalPlannedLocal: 190
        },
        baseCurrency: {
          totalActual: 15.88,
          totalPlanned: 190,
          totalRequested: 144.51
        }
      },
      filters: {
        hasActiveMilestones: true,
        hasOverdueMilestones: true
      },
    }
  }
};

const job2 = {
  companyId,
  entityId: entityId2,
  itemId: jobId2,
  userId: userId2,
  itemStatus: constants.job.status.active,
  talentId: talentId2,
  itemData: {
    jobTitle: "voice over",
    talentId: talentId2,
    engagementType: "project",
    jobHandShakeStage: "REJECTED",
    hourlyBudget: 40,
    customRateData: {
      category: "Word",
      estimatedQuantity: "250",
      ratePer: 2
    },
    jobStartDate: "2023-11-14",
  },
  tags: {
    address: 'address',
    "stoke::externalApproverEmail": "test@stoketalent.com",
    __stoke__teams: ["ODA"]
  },
  viewData: {
    milestonesData: {
      aggregatedMilestonesAmounts: {
        ILS: {
          totalActualLocal: 50,
          totalRequestedLocal: 454.92999999999995
        },
        USD: {
          totalPlannedLocal: 190
        },
        baseCurrency: {
          totalActual: 15.88,
          totalPlanned: 190,
          totalRequested: 144.51
        }
      },
      filters: {
        hasActiveMilestones: false,
        hasOverdueMilestones: false
      },
    }
  }
};

const jobForCustomFieldsBuilder = ({ jobId, jobTitle, tags }) => ({
  companyId: companyId2,
  entityId: entityId3,
  itemId: jobId,
  userId: userId3,
  itemStatus: constants.job.status.active,
  talentId: talentId3,
  itemData: {
    jobTitle,
    talentId: talentId3,
    engagementType: "project",
    jobHandShakeStage: constants.job.handshakeStages.APPROVED,
  },
  tags
})

const job3 = jobForCustomFieldsBuilder({
  jobId: jobId3,
  jobTitle: "Borat movie 1",
  tags: {
    [customFieldsIds.job.externalApproverEmail]: "test@stoketalent.com",
    [customFieldsIds.job.customTagsJob1]: ["Yes"],
    [customFieldsIds.job.customTextJob1]: "foo"
  }
});

const job4 = jobForCustomFieldsBuilder({
  jobId: jobId4,
  jobTitle: "Borat 2",
  tags: {
    [customFieldsIds.job.customTagsJob1]: ["No"]
  }
});

const job5 = jobForCustomFieldsBuilder({
  jobId: jobId5,
  jobTitle: "Borat 3",
  tags: {
    [customFieldsIds.job.customTagsJob1]: ["Yes", "No"]
  }
});

const job6 = jobForCustomFieldsBuilder({
  jobId: jobId6,
  jobTitle: "Borat 4",
  tags: {
    [customFieldsIds.job.externalApproverEmail]: "test@stoketalent.com",
    [customFieldsIds.job.customTextJob1]: "foo"
  }
});

const msForCustomFieldsBuilder = ({ msId, title, tags }) => ({
  companyId: companyId2,
  entityId: entityId3,
  itemId: msId,
  userId: userId3,
  itemStatus: constants.job.status.active,
  talentId: talentId3,
  itemData: {
    cost: 50,
    costLocal: 50,
    currency: "USD",
    date: "2022-11-30",
    description: "",
    jobId: idConverterLib.getJobIdFromMilestoneId(msId),
    savedBudget: 0,
    startTime: 1668518847309,
    title
  },
  tags
})


const ms3_1 = msForCustomFieldsBuilder({
  msId: milestoneId3_1,
  title: "Borat 3_1",
  tags: {
    [customFieldsIds.ms.customTextMs1]: "text123",
    [customFieldsIds.ms.customTagsMs1]: ["True"]
  }
});

const ms3_2 = msForCustomFieldsBuilder({
  msId: milestoneId3_2,
  title: "Borat 3_2",
  tags: {
    [customFieldsIds.ms.customTagsMs1]: ["False"]
  }
});

const ms3_3 = msForCustomFieldsBuilder({
  msId: milestoneId3_3,
  title: "Borat 3_3",
  tags: {
    [customFieldsIds.ms.customTextMs1]: "text45",
    [customFieldsIds.ms.customTagsMs1]: ["True", "False"]
  }
});

const ms4_1 = msForCustomFieldsBuilder({
  msId: milestoneId4_1,
  title: "Borat 4_1",
  tags: {
    [customFieldsIds.ms.customTagsMs1]: ["True", "False"]
  }
});

const ms4_2 = msForCustomFieldsBuilder({
  msId: milestoneId4_2,
  title: "Borat 4_2",
  tags: {
    [customFieldsIds.ms.customTextMs1]: "text123"
  }
});

const ms5_1 = msForCustomFieldsBuilder({
  msId: milestoneId5_1,
  title: "Borat 5_1",
  tags: {
    [customFieldsIds.ms.customTagsMs1]: ["False"]
  }
});

const ms6_1 = msForCustomFieldsBuilder({
  msId: milestoneId6_1,
  title: "Borat 6_1",
  tags: {
    [customFieldsIds.ms.customTextMs1]: "text45",
  }
});


const entity1 = {
  userId: userId1,
  entityId: entityId1,
  companyId,
  itemId: constants.prefix.entity + entityId1,
  itemData: {
    entityName: "R&D",
    userRole: constants.user.role.admin,
    costCenter: 10023,
  },
  tags: {
    __stoke__teams: ['SMA']
  }
};

const entity2 = {
  userId: userId2,
  entityId: entityId2,
  companyId,
  itemId: constants.prefix.entity + entityId2,
  itemData: {
    entityName: "Design",
    userRole: constants.user.role.admin,
    costCenter: 10128,
  },
  tags: {
    __stoke__teams: ['ODA']
  }
};

const entity3 = {
  userId: userId3,
  entityId: entityId3,
  companyId: companyId2,
  itemId: constants.prefix.entity + entityId3,
  itemData: {
    entityName: "CustomFilters",
    userRole: constants.user.role.admin
  }
};

const authUser1 = {
  userId: userId1,
  entityId: entityId1,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const authUserCompany = {
  userId: userId1,
  entityId: companyId,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const authUserCompany2 = {
  userId: userId3,
  entityId: companyId2,
  companyId: companyId2,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};


const user1 = {
  companyId,
  itemId: constants.prefix.userPoolId + userId1,
  userId: userId1,
  itemStatus: constants.user.status.active,
  itemData: {
    userEmail: 'test1@test.com',
    givenName: 'user',
    familyName: 'test'
  }
}

const authUser2 = {
  userId: userId1,
  entityId: entityId2,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};


const user2 = {
  companyId,
  itemId: constants.prefix.userPoolId + userId2,
  userId: userId2,
  itemStatus: constants.user.status.active,
  itemData: {
    userEmail: 'test2@test.com',
    givenName: 'user',
    familyName: 'test'
  }
}

const user3 = {
  companyId: companyId2,
  itemId: constants.prefix.userPoolId + userId3,
  userId: userId3,
  itemStatus: constants.user.status.active,
  itemData: {
    userEmail: 'user3@test.com',
    givenName: 'user3',
    familyName: 'test'
  }
}

const companyItem = {
  itemId: `${constants.prefix.company}${companyId}`,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {}
};

const companyItem2 = {
  itemId: `${constants.prefix.company}${companyId2}`,
  companyId: companyId2,
  itemStatus: constants.user.status.active,
  itemData: {}
};

const basicCompanySettings = {
  itemId: `${constants.prefix.company}${companyId}`,
  itemData: {
    isPORequired: true,
    jobRequestApproval: {
      enabled: true,
      jobRequestLevels: [],
    },
    jobsCustomFields: {
      fields: [
        {
          id: "stoke::externalApproverEmail",
          name: "Parent Email",
          options: [],
          type: 'string',
          contentType: 'job'
        }
      ]
    },
    talentCustomFields: {
      fields: [
       {
        "id": "Hourly Fee",
        "name": "Hourly Fee",
        "options": [
        ],
        "type": "string",
       },
       {
        "id": "Tier",
        "name": "Tier",
        "options": [
         "Tier B",
         "Tier C"
        ],
        "type": "multiselect",
       }
      ]
    },
    talentProfileCustomFields: {
      fields: [
       {
        "id": "talentProfileCustomField::Emergency phone number",
        "name": "Emergency phone number",
        "options": [
        ],
        "type": "string",
       },
       {
        "id": "talentProfileCustomField::Food allergies",
        "name": "Food allergies",
        "options": [
         "Beans",
         "Penauts",
         "Sugar",
         "Milk",
        ],
        "type": "multiselect",
       }
      ]
    },
    customFields: {
      companyProvider: [
       {
        "id": "extaf email",
        "name": "extaf email",
        "options": [
        ],
        "type": "string"
       },
       {
        "id": "Phone Number",
        "name": "Phone Number",
        "options": [
        ],
        "type": "string"
       },
      ],
      "enabled": true
    },
    paymentSchedule: {
      dayOfMonthToRollInto: [19],
      daysToAdvance: 0,
      monthsToAdvance: 0
    },
  },
};


const basicSettingsCompany2 = {
  itemId: `${constants.prefix.company}${companyId2}`,
  companyId: companyId2,
  entityId: companyId2,
  itemData: {
    jobsCustomFields: {
      enabled: true,
      fields: [
        {
          id: "stoke::externalApproverEmail",
          name: "Parent Email",
          options: [],
          type: "string",
          contentType: 'job'
        },
        {
          id: "customTextJob1",
          name: "Job custom text field1",
          options: [],
          type: "string",
          contentType: 'job'
        },
        {
          id: "customTagsJob1",
          name: "Job custom tag field1",
          options: [
            "Yes",
            "No"
          ],
          type: "multiselect",
          contentType: 'job'
        }
      ]
    },
    milestoneCustomFields: {
      enabled: true,
      fields: [
        {
          id: "customTextMs1",
          name: "Ms custom text field1",
          options: [],
          type: "string",
          contentType: 'ms'
        },
        {
          id: "customTagsMs1",
          name: "Ms custom tag field1",
          options: [
            "True",
            "False"
          ],
          type: "multiselect",
          contentType: 'ms'
        }
      ]
    }
  },
  itemStatus: constants.settings.status.active
};

const entitySettings1 = {
  itemId: constants.prefix.entity + entityId1,
  userId: userId1,
  entityId: entityId1,
  companyId,
  itemData: {
    legalEntity: {
      displayName: "Benesh Org",
      legalDocs: {
        'NDA-BEN': {
          expirationMonths: 0,
          fileName: "MUTUAL-NON-DISCLOSURE-AGREEMENT.docx",
          policies: [
            "always",
            "sensitiveDataExposure",
            "systemAccess",
            "onSiteAccess"
          ],
          s3Path: "legelEntities/BeneshOrg/1646301914904-MUTUAL-NON-DISCLOSURE-AGREEMENT.docx",
          sendDocumentsToTalent: true,
          tags: [
            "NDA"
          ],
          templateName: "NDA-BEN"
        }
      },
      legalEntityName: "BENESH Org",
      location: "Global"
    }
  }
};

const entitySettings2 = {
  itemId: constants.prefix.entity + entityId2,
  userId: userId2,
  entityId: entityId2,
  companyId,
  itemData: {
    legalEntity: {
      displayName: "Test",
      isDefault: true,
      legalDocs: {
        'NDA-BEN': {
          expirationMonths: 0,
          fileName: "MUTUAL-NON-DISCLOSURE-AGREEMENT.docx",
          id: "NDA-BEN",
          isOnlyTalentSign: true,
          legalEntity: "TEST",
          policies: [
            "sensitiveDataExposure"
          ],
          s3Path: "legelEntities/Test/1646276178402-MUTUAL-NON-DISCLOSURE-AGREEMENT.docx",
          sendDocumentsToTalent: false,
          status: "active",
          tags: [
            "NDA"
          ],
          templateName: "NDA-BEN"
        }
      },
      legalEntityName: "TEST",
      location: "USA"
    }
  }
};


const entitiesByEntityId  = {
  'entity_CREATE-CSV-TEST-ENT-ID-1': {
    itemId: 'entity_CREATE-CSV-TEST-ENT-ID-1',
    companyId: 'CREATE-CSV-TEST-COMP-ID-1',
    itemData: { entityName: 'R&D' },
  },
  'entity_CREATE-CSV-TEST-ENT-ID-2': {
    itemId: 'entity_CREATE-CSV-TEST-ENT-ID-2',
    companyId: 'CREATE-CSV-TEST-COMP-ID-1',
    itemData: { entityName: 'Design' },
  }
}

const compProvider1 = {
  itemId: providerId1,
  companyId,
  createdBy: userId1,
  modifiedBy: userId1,
  itemStatus: constants.user.status.active,
  itemData: {
    name: 'Lenny Kravitz',
    email: 'lennykravitz1@stoketalent.com',
    providerEmail: 'lennykravitz1@stoketalent.com',
    companyTaxId: 200327443,
    providerName: 'Lenny Kravitz',
    country: 'IL',
    address: '103 Princeton Junction',
    city: "Princeton",
    state: "New Jersey",
    postalCode: "123456",
    phone: "732546549753",
    departments: [],
    paymentMethod: constants.paymentMethods.eCheck,
    sequenceOfWork: {
      activeEngagementLength: 8,
      averageMonthlyHours: 14.31,
      averageMonthlyPay: 281.3,
      continuityValues: {
        isNonCompliantBlocked: true,
        resetContinuityValue: 0,
        workContinuityHoursRed: 0,
        workContinuityHoursYellow: 0,
        workContinuityValueRed: 52,
        workContinuityValueYellow: 51
      },
      isHrComplianceRiskStatusRed: true,
      isNonCompliantBlocked: true,
      lastPeriodDate: 1706745600000,
      score: "green",
      totalEngagementMonths: 8
    },
  },
  tags: {
    address: 'address',
    "talentProfileCustomField::Emergency phone number": "911",
    "talentProfileCustomField::Food allergies": ["Beans", "Sugar"],
  }
};

const compProvider2 = {
  itemId: providerId2,
  companyId,
  createdBy: userId1,
  modifiedBy: userId1,
  itemStatus: constants.user.status.active,
  itemData: {
    isProviderSelfEmployedTalent: true,
    legalCompliance: {
      score: 'yellow',
    },
    name: 'Sean Paul',
    email: 'seanpaul@stoketalent.com',
    providerEmail: 'lennykravitz1@stoketalent.com',
    companyTaxId: 200327443,
    providerName: 'Sean Paul',
    country: 'US',
    address: '306 Princcess Junction',
    city: "Jerusalem",
    state: "Tel Aviv",
    country: 'israel',
    postalCode: "654321",
    phone: "05497686387",
    departments: [],
    paymentSystem: constants.payment.name.tipalti,
  },
  tags: {
    address: 'address',
    "talentProfileCustomField::Emergency phone number": "911000",
    "talentProfileCustomField::Food allergies": ["Beans", "Milk", "Penauts"],
  }
};

const compProvider3 = {
  itemId: providerId3,
  companyId,
  createdBy: userId1,
  modifiedBy: userId1,
  itemStatus: constants.user.status.invited,
  itemData: {
    isProviderSelfEmployedTalent: false,
    legalCompliance: {
      score: 'yellow',
    },
    name: 'Britney Spears',
    providerName: 'Britney Spears',
    providerEmail: 'britneyspears@stoketalent.com',
    companyTaxId: 200327443,
    country: 'US',
    address: '306 Princcess Junction',
    city: "New Jersey",
    state: "New York",
    country: 'United State',
    postalCode: "654321",
    phone: "0896745326",
    departments: [],
    paymentSystem: constants.payment.name.payoneer,
    isPayable: true,
  }
};

const compTalent1 = {
  itemId: talentId1,
  companyId,
  itemStatus: constants.companyProvider.status.registered,
  itemData: {
    workforceAudits: [
      {
       "id": 1674719715051,
       "lastReminderToProvider": 1674719762924,
       "questionnairesSentDate": "2023-01-26",
       "startDate": "2023-01-26",
       "status": "In progress"
      }
    ],
    sequenceOfWork: {
      "activeEngagementLength": 0,
      "continuityValues": {
       "isNonCompliantBlocked": true,
       "resetContinuityValue": 0,
       "workContinuityHoursRed": 0,
       "workContinuityHoursYellow": 0,
       "workContinuityValueRed": 1,
       "workContinuityValueYellow": 1
      },
      "isNonCompliantBlocked": false,
      "lastPeriodDate": 1683590400000,
      "score": "green",
      "totalEngagementMonths": 0
     },
    legalCompliance: {
      score: 'green',
    },
    name: 'Lenny Kravitz',
    email: 'lennykravitz1@stoketalent.com',
    address: '103 Princeton Junction',
    city: "Princeton",
    state: "New Jersey",
    country: 'IL',
    postalCode: "123456",
    phone: "732546549753",
    departments: [entityId1, entityId2],
    isProviderSelfEmployedTalent: false,
    providerId: providerId1,
    jobTitle: 'bestJob',
    languagesAddedByEmployer: [
      {
        id: 3,
        name: 'Arabic',
        title: "Add language #",
        value: 'conversational'
      }
    ],
    skillsAddedByEmployer: [
      {
        title: ".net"
      },
    ],
    talentProfileData: {
      skills: [
        {
          title: "4d"
        },
        {
          title: "agile development"
        }
      ],
     experience: [
          {
              title: "Real estates",
              id: "f18c58f779a0",
              time: "1"
          },
          {
              title: "General manager",
              id: "f18c58f7d011",
              time: "4"
          }
      ] 
    },
    talentProfileReviews: [
      {
       description: "dsfdfds",
       rating: 4,
      },
      {
       description: "sdsdsgfds",
       rating: 0,
      },
      {
       description: "dgsagsf",
       rating: 5,
      }
     ]
  },
  tags: {
    "extaf email": "talent1test@extaf.com",
    "Hourly Fee": "4,000 euro per month",
    "Phone Number": "(+972) 0546179778",
    "Tier": [
     "Tier B"
    ]
  },
  totalEarned: {
    "ILS": 223.52,
  },
  complianceInfo: {
    "scores": {
        "general": 0,
        "workforce": 3,
        "legal": 0,
        "tax": 3
    },
  },
  payableStatus: {
    "payableStatus": "red",
    "isPayableValid": false,
    "taxFormStatusInfo": null,
    "payableSummary": {
        "payableElements": {
            "paymentDetailsSubmitted": true,
            "taxFormsSubmitted": false
        },
        "paymentConditions": {
            "paymentMethodAllowed": true,
            "workforceComplianceStatus": true
        }
    }
  }
};

const compTalent2 = {
  itemId: talentId2,
  companyId,
  itemStatus: constants.companyProvider.status.invited,
  itemData: {
    name: 'Sean Paul',
    email: 'seanpaul@stoketalent.com',
    address: '103 Princeton Junction',
    city: "Princeton",
    state: "New Jersey",
    country: 'US',
    postalCode: "123456",
    phone: "732546549753",
    departments: [entityId2],
    isProviderSelfEmployedTalent: true,
    providerId: providerId2,
    jobTitle: 'paginationJob',
    backgroundStatusCheck: 'success',
    workforceAudits: [
      {
       "complianceHRSentDate": "2021-05-13",
       "endDate": "2021-05-13",
       "id": 1620917962794,
       "report": {
        "id": "OCTOBERCOM4775e8d0-06e1-11eb-bc82-03d3267cd82f/OCTOBERCOM4775e8d0-06e1-11eb-bc82-03d3267cd82f/provider_SUSANNEVEG404811f0-0e11-11eb-aa64-598182004fe8/workforceComplianceReports/1620917975373/Test.pdf",
        "name": "Test.pdf",
        "percentage": 99,
        "s3Path": "provider_SUSANNEVEG404811f0-0e11-11eb-aa64-598182004fe8/workforceComplianceReports/1620917975373/Test.pdf",
        "type": "application/pdf"
       },
       "startDate": "2021-05-13",
       "status": "No risk"
      }
     ],
    skillsAddedByEmployer: [
      {
        title: "apache hadoop"
      },
      {
        title: "blog install"
      }
    ],
    talentProfileData: {
      languages: [
        {
         id: 1,
         name: "English",
         title: "Add language #",
         value: "basic"
        },
        {
         id: 2,
         name: null,
         title: "Add language #",
         value: null
        },
      ],
      skills: [
        {
          title: "amazon s3"
        },
        {
          title: "apache"
        }
      ],
      certifications: [
          {
              logo: {
                s3Path: "logoPath",
                name: "logo.png",
                type: "image/png"
              },
              id: "f18bfc0197d1",
              title: "certification 1",
              document: {
                s3Path: "documentPath",
                name: "my certification.pdf",
                type: "application/pdf"
            }
          }
      ]
    },
    talentProfileReviews: [
      {
       description: "excellent freelancer",
       rating: 2,
      },
      {
        description: "very good",
        rating: 2,
       }
    ]
  },
  totalEarned: {"USD": 323.52},  
  complianceInfo: {
    scores:{
      legal: 1,
      general: 1,
      workforce: 3,
      tax: 3
    },
  },
  payableStatus: {
    payableStatus: "red",
    isPayableValid: false,
    taxFormStatusInfo: null,
    payableSummary: {
      payableElements: {
          paymentDetailsSubmitted: true,
          taxFormsSubmitted: false
      },
      paymentConditions: {
          paymentMethodAllowed: true,
          workforceComplianceStatus: true
      }
    }
  }
};

const compTalent3 = {
  itemId: talentId3,
  companyId: companyId2,
  itemStatus: constants.user.status.invited,
  itemData: {
    name: 'Borat Sagdiyev',
    departments: [],
    isProviderSelfEmployedTalent: false,
  },
  tags: {
    address: 'Kazakhstan',
  }
};

const milestone1 = {
  companyId,
  entityId: entityId1,
  itemId: milestoneId1,
  userId: userId1,
  modifiedBy: userId1,
  itemStatus: constants.job.status.completed,
  poItemId: lineItemId1,
  itemData: {
    requestedData: {
      hourlyValue: 52,
    },
    lineItems: [{
      "name": "123",
      "description": "aaaa",
      "amount": "10$",
    },
    {
      "name": "456",
      "description": "bbbbb",
      "amount": "20$",
    }],
    timeReport: [{
      "date": "12-11-2012",
      "hours": "6",
      "comment": "My first week",
    },
    {
      "date": "12-12-2012",
      "hours": "6",
      "comment": "My second week",
    }],
    date: "2022-08-31",
    cost: 46,
    costLocal: 46,
    providerData: {
      taxInfo: {
        total: 223.52,
        tax: 103.79,
        subTotal: 223.52,
        paymentCurrency: "ILS",
        stokeUmbrella: true
      },
      comment: null
    },
    autoProFormaInvoiceDate: 1668367640132,
    autoProFormaInvoiceNumber: 10301,
    files: [
      {
        autoTalentInvoice: true,
        isInvoice: true,
        key: "job_fa78db80-6388-11ed-b700-175959050e6a/ms_job_fa78db80-6388-11ed-b700-175959050e6a_fbb6d9c0-6388-11ed-b171-fb34b4205a3f/Benesh - Ariel Talent - Invoice (10301).pdf",
        name: "Benesh - Ariel Talent - Invoice (10301).pdf"
      }
    ],
    payment: {
      status: "Pending",
      valueDate: 1657090800000,
      dueDate: new Date('4.15.2022').getTime(),
      billingAmount: 450,
      name: "Tipalti",
      feeData: {
        transactionFee: {
          type: "ACH",
          cost: 5.5218,
        },
        accelerateFee: {
          cost: 0
        }
      },
      PendingDate: 1655905990000
    },
    description: "good job\n!",
    title: "Milestone for August",
    talentCompletedAt: "2022-10-01",
    approvals: [
      {
        approvedBy: userId1,
        action: "approve",
        approveDate: "2022-08-14",
        level: 1
      }
    ],
    currency: "USD",
    startTim: 1660502656297,
    actualRequestCost: 71,
    endTime: "2023-02-20",
    actualCost: 71,
    requestLocal: 71,
  },
};

const milestone2 = {
  companyId,
  entityId: entityId2,
  itemId: milestoneId2,
  userId: userId2,
  itemStatus: constants.job.status.paid,
  talentId: talentId2,
  poItemId: poId2,
  itemData: {
    requestedData: {
      hourlyValue: 52,
    },
    date: "2022-09-31",
    cost: 56,
    costLocal: 56,
    providerData: {
      taxInfo: {
        total: 323.52,
        tax: 23,
        subTotal: 323.52,
        paymentCurrency: "USD",
        stokeUmbrella: false,
      },
      comment: null
    },
    payment: {
      feeData: {
        transactionFee: {
          type: constants.paymentMethods.eCheck,
          cost: 6.5218,
        },
        accelerateFee: {
          cost: 0
        }
      },
      status: "Submitted",
      valueDate: 1657090800000,
      dueDate: new Date('02.15.2022').getTime(),
      PendingDate: 1653227590000,
      billingAmount: 550,
      name: "Tipalti",
    },
    proFormaInvoiceDate: 1668367640134,
    proFormaInvoiceNumber: 10304,
    files: [
      {
        isInvoice: true,
        autoTalentInvoice: true,
        key: "job_fa78db80-6388-11ed-b700-175959050e6a/ms_job_fa78db80-6388-11ed-b700-175959050e6a_fbb6d9c0-6388-11ed-b171-fb34b4205a3f/Benesh - Ariel Talent - Invoice (10301).pdf",
        name: "Benesh - Ariel Talent - Invoice (10301).pdf"
      }
    ],
    description: "bad job\n!",
    title: "Milestone for July",
    talentCompletedAt: "2023-10-5",
    approvals: [
      {
        approvedBy: userId1,
        action: "approve",
        approveDate: "2021-08-14",
        level: 1
      },
      {
        approvedBy: userId2,
        action: "reject",
        approveDate: "2021-08-14",
        level: 1
      }
    ],
    currency: "USD",
    startTim: 1660502656297,
    actualRequestCost: 81,
    endTime: new Date('5.20.2023').getTime(),
    actualCost: 81,
    requestLocal: 81,
  },
};

const eventForJobsPageBuilder = (filters, requestedFields) => ({
  body: JSON.stringify({
    companyId: companyId,
    type: jobListType.jobsPage,
    filterKey: constants.jobsFilters.active.key,
    tableRequestedFields: requestedFields,
    filters,
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId1
    }
  },
})

const eventForReportingPageBuilder = filters => ({
  body: JSON.stringify({
    companyId: companyId,
    type: jobListType.paymentsPage,
    filterKey: null,
    tableRequestedFields: allFieldsForPaymentPage.concat(['lineItems', 'timeReport']),
    filters,
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId1
    }
  },
})

const eventForReportingPageBuilderUserNotAuthorized = () => ({
  body: JSON.stringify({
    companyId: companyId,
    type: jobListType.paymentsPage,
    filterKey: null,
    tableRequestedFields: allFieldsForPaymentPage.concat(['lineItems', 'timeReport']),
    filters: {},
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: 'notAuthorized'
    }
  },
})

const customFieldsRequestedFields = (header) => _.map(_.omitBy(basicFieldsForJobsPage, (item) => lineItemsArray.includes(item.headerName)), header ? 'headerName' : 'field').concat(header ? customFieldsHeadersArray : customFieldsArray);

const eventWithCustomFieldFilterBuilder = (regularFields = {}, customFields = {}) => ({
  body: JSON.stringify({
    companyId: companyId2,
    type: 'jobsPage',
    filterKey: constants.jobsFilters.active.key,
    tableRequestedFields: customFieldsRequestedFields(),
    filters: {
      ...regularFields,
      customFields
    }
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId3
    }
  }
})

const eventWithTalentProfileFieldFilterBuilder = (regularFields = {}, talentProfileFields = {}) => ({
  body: JSON.stringify({
    companyId,
    type: jobListType.talentDirectoryPage,
    filterKey: "null",
    tableRequestedFields: talentProfileFieldsHeaders,
    filters: {
      ...regularFields,
      talentProfileFields
    }
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId1
    }
  }
})

const eventForTalentDirectoryPageBuilder = (filters, customTableRequestedFields) => ({
  body: JSON.stringify({
    companyId: companyId,
    type: jobListType.talentDirectoryPage,
    filterKey: "null",
    tableRequestedFields: customTableRequestedFields || allFieldsForTalentDirectoryPage,
    filters,
  }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId1
    }
  },
})

const getRows = (msArr = []) => _.filter(withoutFilters, (_, key) => msArr.includes(key));

const expectedRowsForJobsMilestone1 = [
  {
    "Milestones": _.get(milestone1, 'itemData.title'),
    "Job": _.get(job1, 'itemData.jobTitle'),
    "Line item title": _.get(milestone1, 'itemData.lineItems[0].name'),
    "Line item description": _.get(milestone1, 'itemData.lineItems[0].description'),
    "Line item amount": _.get(milestone1, 'itemData.lineItems[0].amount'),
    "Line item currency": _.get(milestone1, 'itemData.lineItems[0].currency', constants.currencyTypes.default),
    "Description": escape(_.get(milestone1, 'itemData.description') || ''),
    "Type": jobHelper.getEngedgmentTypeString(_.get(job1, 'itemData.engagementType')),
    "Status": _.get(milestone1, 'itemStatus'),
    "Hiring Manager": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Workspace": _.get(entity1, 'itemData.entityName'),
    "Job Start Date": formatTimestamp(_.get(job1, 'itemData.jobStartDate')),
    "Talent's comment": escape(_.get(milestone1, 'itemData.providerData.comment') || ''),
    "Space": _.get(job1, `tags.${constants.tags.teams}[0]`, ''),
    "Talent": _.get(compTalent1, 'itemData.name'),
    "Delivery Date": formatTimestamp(_.get(milestone1, 'itemData.date')),
    "Planned": _.get(milestone1, 'itemData.costLocal').toString(),
    "Requested": _.get(milestone1, 'itemData.providerData.taxInfo.total').toString(),
    "Approved Date": formatTimestamp(_.get(milestone1, 'itemData.approvals[0].approveDate')),
    "Approved By": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Rejected by": '',
    "Approved": _.get(milestone1, 'itemData.providerData.taxInfo.total').toString(),
    "Requested Date": formatTimestamp(_.get(milestone1, 'itemData.talentCompletedAt'))
  },
  {
    "Milestones": _.get(milestone1, 'itemData.title'),
    "Job": _.get(job1, 'itemData.jobTitle'),
    "Line item title": _.get(milestone1, 'itemData.lineItems[1].name'),
    "Line item description": _.get(milestone1, 'itemData.lineItems[1].description'),
    "Line item amount": _.get(milestone1, 'itemData.lineItems[1].amount'),
    "Line item currency": _.get(milestone1, 'itemData.lineItems[0].currency', constants.currencyTypes.default),
    "Description": escape(_.get(milestone1, 'itemData.description') || ''),
    "Type": jobHelper.getEngedgmentTypeString(_.get(job1, 'itemData.engagementType')),
    "Status": _.get(milestone1, 'itemStatus'),
    "Hiring Manager": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Workspace": _.get(entity1, 'itemData.entityName'),
    "Job Start Date": formatTimestamp(_.get(job1, 'itemData.jobStartDate')),
    "Talent's comment": escape(_.get(milestone1, 'itemData.providerData.comment') || ''),
    "Space": _.get(job1, `tags.${constants.tags.teams}[0]`, ''),
    "Talent": _.get(compTalent1, 'itemData.name'),
    "Delivery Date": formatTimestamp(_.get(milestone1, 'itemData.date')),
    "Planned": _.get(milestone1, 'itemData.costLocal').toString(),
    "Requested": _.get(milestone1, 'itemData.providerData.taxInfo.total').toString(),
    "Approved Date": formatTimestamp(_.get(milestone1, 'itemData.approvals[0].approveDate')),
    "Approved By": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Approved": _.get(milestone1, 'itemData.providerData.taxInfo.total').toString(),
    "Rejected by": '',
    "Requested Date": formatTimestamp(_.get(milestone1, 'itemData.talentCompletedAt'))
  }
]

const expectedRowsForJobsMilestone2 = [
  {
    "Milestones": _.get(milestone2, 'itemData.title'),
    "Job": _.get(job2, 'itemData.jobTitle'),
    "Line item title": '',
    "Line item description": '',
    "Line item amount": '',
    "Line item currency": '',
    "Description": escape(_.get(milestone2, 'itemData.description') || ''),
    "Type": jobHelper.getEngedgmentTypeString(_.get(job2, 'itemData.engagementType')),
    "Status": _.get(milestone2, 'itemStatus'),
    "Hiring Manager": `${_.get(user2, 'itemData.givenName')} ${_.get(user2, 'itemData.familyName')}`,
    "Workspace": _.get(entity2, 'itemData.entityName'),
    "Job Start Date": formatTimestamp(_.get(job2, 'itemData.jobStartDate')),
    "Talent's comment": escape(_.get(milestone2, 'itemData.providerData.comment') || ''),
    "Space": _.get(job2, `tags.${constants.tags.teams}[0]`, ''),
    "Talent": _.get(compTalent2, 'itemData.name'),
    "Delivery Date": formatTimestamp(_.get(milestone2, 'itemData.date')),
    "Planned": _.get(milestone2, 'itemData.costLocal').toString(),
    "Requested": _.get(milestone2, 'itemData.providerData.taxInfo.total').toString(),
    "Approved Date": formatTimestamp(_.get(milestone2, 'itemData.approvals[0].approveDate')),
    "Approved By": `${_.get(user2, 'itemData.givenName')} ${_.get(user2, 'itemData.familyName')}`,
    "Approved": _.get(milestone2, 'itemData.providerData.taxInfo.total').toString(),
    "Rejected by": '',
    "Requested Date": formatTimestamp(_.get(milestone2, 'itemData.talentCompletedAt'))
  }
]

const expectedRowsForReportingMilestone1 = [
  {
    "Milestone Id": _.get(milestone1, 'itemId'),
    "Company": _.get(compProvider1, 'itemData.providerName'),
    "Talent email": _.get(compTalent1, 'itemData.email'),
    "Talent": _.get(compProvider1, 'itemData.name'),
    "Company contact email": _.get(compProvider1, 'itemData.providerEmail'),
    "Talent Tax ID": _.get(compProvider1, 'itemData.companyTaxId').toString(),
    "Talent location": convertCountryCodeToName(_.get(compProvider1, 'itemData.country', {})),
    "Talent address": getTalentAddress(_.get(compTalent1, 'itemData')),
    "Talent phone": _.get(compTalent1, 'itemData.phone'),
    "Hiring manager": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Workspace": _.get(entity1, 'itemData.entityName'),
    "Space": _.get(job1, `tags.${constants.tags.teams}[0]`, ''),
    "Cost center": _.get(entity1, 'itemData.costCenter').toString(),
    "Legal entity": _.get(entitySettings1, 'itemData.legalEntity.displayName'),
    "Job title": _.get(job1, 'itemData.jobTitle'),
    "Job type": jobHelper.getEngedgmentTypeString(_.get(job1, 'itemData.engagementType')),
    "Milestone name": getMilestoneTitle(milestone1),
    "Milestone delivery date": formatTimestamp(_.get(milestone1, 'itemData.date')),
    "Milestone status": getPaymentStatusByMilestoneStatus(getStatusString(milestone1)),
    "Job status": _.get(job1, 'itemStatus'),
    "Current amount (USD)": _.get(milestone1, 'itemData.payment.billingAmount').toString(),
    "Job currency": _.get(milestone1, 'itemData.currency'),
    "Hourly rate (job currency)": _.get(job1, 'itemData.hourlyBudget').toString(),
    "Planned hours": getJobHoursValues(_.get(milestone1, 'itemData.costLocal'), Number(_.get(job1, 'itemData.hourlyBudget'))).toString(),
    "Approved amount (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.total').toString(),
    "Planned amount (job currency)": _.get(milestone1, 'itemData.cost').toString(),
    "Job Start Date": formatTimestamp(_.get(job1, 'itemData.jobStartDate')),
    "Requested date": formatTimestamp(_.get(milestone1, 'itemData.talentCompletedAt')),
    "Approved date": formatTimestamp(_.get(milestone1, 'itemData.approvals[0].approveDate')),
    "Approved by": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Rejected by": '',
    "Payment currency": _.get(milestone1, 'itemData.providerData.taxInfo.paymentCurrency'),
    "Requested hours": _.get(milestone1, 'itemData.requestedData.hourlyValue').toString(),
    "Requested sub-total (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Requested VAT/TAX (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.tax').toString(),
    "Requested total (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Payment status": _.get(paymentStatusDisplayedName, _.get(milestone1, 'itemData.payment.status'), _.get(milestone1, 'itemData.payment.status')),
    "Payment date": formatTimestamp(_.get(milestone1, 'itemData.payment.valueDate')),
    "Invoice number": _.get(milestone1, 'itemData.autoProFormaInvoiceNumber').toString(),
    "Invoice date": formatTimestamp(_.get(milestone1, 'itemData.autoProFormaInvoiceDate')),
    "Invoice": _.get(_.get(milestone1, 'itemData.files', []).filter(Boolean).find(file => file.autoTalentInvoice), 'name'),
    "Tax Invoice / Receipt": _.get(_.get(milestone1, 'itemData.files', []).filter(Boolean).find(file => file.isInvoice), 'name'),
    "Payment Method": resolvePaymentMethod(milestone1),
    "Transaction fee (USD)": Number(Number(_.get(milestone1, 'itemData.payment.feeData.transactionFee.cost', 0)) + Number(_.get(milestone1, 'itemData.payment.feeData.accelerateFee.cost', 0))).toString(),
    "Service Fee (USD)": "",
    "Requested (custom)": prettifyNumber((_.get(milestone1, 'itemData.providerData.taxInfo.total') - (_.get(milestone1, 'itemData.providerData.taxInfo.tax'))) / _.get(job1, 'itemData.customRateData.ratePer')),
    "Rate (custom)": `${_.get(job1, 'itemData.customRateData.ratePer')} per ${_.get(job1, 'itemData.customRateData.category').toLowerCase()}`,
    "Planned (custom)": _.get(job1, 'itemData.customRateData.estimatedQuantity'),
    "Talent's comment": escape(_.get(milestone1, 'itemData.providerData.comment') || ''),
    "Line item title": _.get(milestone1, 'itemData.lineItems[0].name'),
    "Line item description": _.get(milestone1, 'itemData.lineItems[0].description'),
    "Line item amount": _.get(milestone1, 'itemData.lineItems[0].amount'),
    "Line item currency": _.get(milestone1, 'itemData.lineItems[0].currency', constants.currencyTypes.default),
    "Time report date": '',
    "Time report hours": '',
    "Time report comment": '',
    "PO item number": "lineItem1",
    "PO number": "poNumber1"
  },
  {
    "Milestone Id": _.get(milestone1, 'itemId'),
    "Company": _.get(compProvider1, 'itemData.providerName'),
    "Talent email": _.get(compTalent1, 'itemData.email'),
    "Talent": _.get(compProvider1, 'itemData.name'),
    "Company contact email": _.get(compProvider1, 'itemData.providerEmail'),
    "Talent Tax ID": _.get(compProvider1, 'itemData.companyTaxId').toString(),
    "Talent location": convertCountryCodeToName(_.get(compProvider1, 'itemData.country', {})),
    "Talent address": getTalentAddress(_.get(compProvider1, 'itemData')),
    "Talent phone": _.get(compProvider1, 'itemData.phone'),
    "Hiring manager": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Workspace": _.get(entity1, 'itemData.entityName'),
    "Space": _.get(job1, `tags.${constants.tags.teams}[0]`, ''),
    "Cost center": _.get(entity1, 'itemData.costCenter').toString(),
    "Legal entity": _.get(entitySettings1, 'itemData.legalEntity.displayName'),
    "Job title": _.get(job1, 'itemData.jobTitle'),
    "Job type": jobHelper.getEngedgmentTypeString(_.get(job1, 'itemData.engagementType')),
    "Milestone name": getMilestoneTitle(milestone1),
    "Milestone delivery date": formatTimestamp(_.get(milestone1, 'itemData.date')),
    "Milestone status": getPaymentStatusByMilestoneStatus(getStatusString(milestone1)),
    "Job status": _.get(job1, 'itemStatus'),
    "Current amount (USD)": _.get(milestone1, 'itemData.payment.billingAmount').toString(),
    "Job currency": _.get(milestone1, 'itemData.currency'),
    "Hourly rate (job currency)": _.get(job1, 'itemData.hourlyBudget').toString(),
    "Planned hours": getJobHoursValues(_.get(milestone1, 'itemData.costLocal'), Number(_.get(job1, 'itemData.hourlyBudget'))).toString(),
    "Approved amount (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.total').toString(),
    "Planned amount (job currency)": _.get(milestone1, 'itemData.cost').toString(),
    "Job Start Date": formatTimestamp(_.get(job1, 'itemData.jobStartDate')),
    "Requested date": formatTimestamp(_.get(milestone1, 'itemData.talentCompletedAt')),
    "Approved date": formatTimestamp(_.get(milestone1, 'itemData.approvals[0].approveDate')),
    "Approved by": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Rejected by": '',
    "Payment currency": _.get(milestone1, 'itemData.providerData.taxInfo.paymentCurrency'),
    "Requested hours": _.get(milestone1, 'itemData.requestedData.hourlyValue').toString(),
    "Requested sub-total (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Requested VAT/TAX (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.tax').toString(),
    "Requested total (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Payment status": _.get(paymentStatusDisplayedName, _.get(milestone1, 'itemData.payment.status'), _.get(milestone1, 'itemData.payment.status')),
    "Payment date": formatTimestamp(_.get(milestone1, 'itemData.payment.valueDate')),
    "Invoice number": _.get(milestone1, 'itemData.autoProFormaInvoiceNumber').toString(),
    "Invoice date": formatTimestamp(_.get(milestone1, 'itemData.autoProFormaInvoiceDate')),
    "Invoice": _.get(_.get(milestone1, 'itemData.files', []).filter(Boolean).find(file => file.autoTalentInvoice), 'name'),
    "Tax Invoice / Receipt": _.get(_.get(milestone1, 'itemData.files', []).filter(Boolean).find(file => file.isInvoice), 'name'),
    "Payment Method": resolvePaymentMethod(milestone1),
    "Transaction fee (USD)": Number(Number(_.get(milestone1, 'itemData.payment.feeData.transactionFee.cost', 0)) + Number(_.get(milestone1, 'itemData.payment.feeData.accelerateFee.cost', 0))).toString(),
    "Service Fee (USD)": "",
    "Requested (custom)": prettifyNumber((_.get(milestone1, 'itemData.providerData.taxInfo.total') - (_.get(milestone1, 'itemData.providerData.taxInfo.tax'))) / _.get(job1, 'itemData.customRateData.ratePer')),
    "Rate (custom)": `${_.get(job1, 'itemData.customRateData.ratePer')} per ${_.get(job1, 'itemData.customRateData.category').toLowerCase()}`,
    "Planned (custom)": _.get(job1, 'itemData.customRateData.estimatedQuantity'),
    "Talent's comment": escape(_.get(milestone1, 'itemData.providerData.comment') || ''),
    "Line item title": _.get(milestone1, 'itemData.lineItems[1].name'),
    "Line item description": _.get(milestone1, 'itemData.lineItems[1].description'),
    "Line item amount": _.get(milestone1, 'itemData.lineItems[1].amount'),
    "Line item currency": _.get(milestone1, 'itemData.lineItems[0].currency', constants.currencyTypes.default),
    "Time report date": '',
    "Time report hours": '',
    "Time report comment": '',
    "PO item number": "lineItem1",
    "PO number": "poNumber1"
  },
  {
    "Milestone Id": _.get(milestone1, 'itemId'),
    "Company": _.get(compProvider1, 'itemData.providerName'),
    "Talent email": _.get(compTalent1, 'itemData.email'),
    "Talent": _.get(compProvider1, 'itemData.name'),
    "Company contact email": _.get(compProvider1, 'itemData.providerEmail'),
    "Talent Tax ID": _.get(compProvider1, 'itemData.companyTaxId').toString(),
    "Talent location": convertCountryCodeToName(_.get(compProvider1, 'itemData.country', {})),
    "Talent address": getTalentAddress(_.get(compProvider1, 'itemData')),
    "Talent phone": _.get(compProvider1, 'itemData.phone'),
    "Hiring manager": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Workspace": _.get(entity1, 'itemData.entityName'),
    "Space": _.get(job1, `tags.${constants.tags.teams}[0]`, ''),
    "Cost center": _.get(entity1, 'itemData.costCenter').toString(),
    "Legal entity": _.get(entitySettings1, 'itemData.legalEntity.displayName'),
    "Job title": _.get(job1, 'itemData.jobTitle'),
    "Job type": jobHelper.getEngedgmentTypeString(_.get(job1, 'itemData.engagementType')),
    "Milestone name": getMilestoneTitle(milestone1),
    "Milestone delivery date": formatTimestamp(_.get(milestone1, 'itemData.date')),
    "Milestone status": getPaymentStatusByMilestoneStatus(getStatusString(milestone1)),
    "Job status": _.get(job1, 'itemStatus'),
    "Current amount (USD)": _.get(milestone1, 'itemData.payment.billingAmount').toString(),
    "Job currency": _.get(milestone1, 'itemData.currency'),
    "Hourly rate (job currency)": _.get(job1, 'itemData.hourlyBudget').toString(),
    "Planned hours": getJobHoursValues(_.get(milestone1, 'itemData.costLocal'), Number(_.get(job1, 'itemData.hourlyBudget'))).toString(),
    "Approved amount (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.total').toString(),
    "Planned amount (job currency)": _.get(milestone1, 'itemData.cost').toString(),
    "Job Start Date": formatTimestamp(_.get(job1, 'itemData.jobStartDate')),
    "Requested date": formatTimestamp(_.get(milestone1, 'itemData.talentCompletedAt')),
    "Approved date": formatTimestamp(_.get(milestone1, 'itemData.approvals[0].approveDate')),
    "Approved by": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Rejected by": '',
    "Payment currency": _.get(milestone1, 'itemData.providerData.taxInfo.paymentCurrency'),
    "Requested hours": _.get(milestone1, 'itemData.requestedData.hourlyValue').toString(),
    "Requested sub-total (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Requested VAT/TAX (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.tax').toString(),
    "Requested total (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Payment status": _.get(paymentStatusDisplayedName, _.get(milestone1, 'itemData.payment.status'), _.get(milestone1, 'itemData.payment.status')),
    "Payment date": formatTimestamp(_.get(milestone1, 'itemData.payment.valueDate')),
    "Invoice number": _.get(milestone1, 'itemData.autoProFormaInvoiceNumber').toString(),
    "Invoice date": formatTimestamp(_.get(milestone1, 'itemData.autoProFormaInvoiceDate')),
    "Invoice": _.get(_.get(milestone1, 'itemData.files', []).filter(Boolean).find(file => file.autoTalentInvoice), 'name'),
    "Tax Invoice / Receipt": _.get(_.get(milestone1, 'itemData.files', []).filter(Boolean).find(file => file.isInvoice), 'name'),
    "Payment Method": resolvePaymentMethod(milestone1),
    "Transaction fee (USD)": Number(Number(_.get(milestone1, 'itemData.payment.feeData.transactionFee.cost', 0)) + Number(_.get(milestone1, 'itemData.payment.feeData.accelerateFee.cost', 0))).toString(),
    "Service Fee (USD)": "",
    "Requested (custom)": prettifyNumber((_.get(milestone1, 'itemData.providerData.taxInfo.total') - (_.get(milestone1, 'itemData.providerData.taxInfo.tax'))) / _.get(job1, 'itemData.customRateData.ratePer')),
    "Rate (custom)": `${_.get(job1, 'itemData.customRateData.ratePer')} per ${_.get(job1, 'itemData.customRateData.category').toLowerCase()}`,
    "Planned (custom)": _.get(job1, 'itemData.customRateData.estimatedQuantity'),
    "Talent's comment": escape(_.get(milestone1, 'itemData.providerData.comment') || ''),
    "Line item title": '',
    "Line item description": '',
    "Line item amount": '',
    "Line item currency": '',
    "Time report date": dayjs(_.get(milestone1, 'itemData.timeReport[0].date'), constants.dateFormats.saved.milestone.timeReport).format(constants.dateFormats.displayed.milestone.timeReport),
    "Time report hours": _.get(milestone1, 'itemData.timeReport[0].hours'),
    "Time report comment": _.get(milestone1, 'itemData.timeReport[0].comment'),
    "PO item number": "lineItem1",
    "PO number": "poNumber1"
  },
  {
    "Milestone Id": _.get(milestone1, 'itemId'),
    "Company": _.get(compProvider1, 'itemData.providerName'),
    "Talent email": _.get(compTalent1, 'itemData.email'),
    "Talent": _.get(compProvider1, 'itemData.name'),
    "Company contact email": _.get(compProvider1, 'itemData.providerEmail'),
    "Talent Tax ID": _.get(compProvider1, 'itemData.companyTaxId').toString(),
    "Talent location": convertCountryCodeToName(_.get(compProvider1, 'itemData.country', {})),
    "Talent address": getTalentAddress(_.get(compProvider1, 'itemData')),
    "Talent phone": _.get(compProvider1, 'itemData.phone'),
    "Hiring manager": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Workspace": _.get(entity1, 'itemData.entityName'),
    "Space": _.get(job1, `tags.${constants.tags.teams}[0]`, ''),
    "Cost center": _.get(entity1, 'itemData.costCenter').toString(),
    "Legal entity": _.get(entitySettings1, 'itemData.legalEntity.displayName'),
    "Job title": _.get(job1, 'itemData.jobTitle'),
    "Job type": jobHelper.getEngedgmentTypeString(_.get(job1, 'itemData.engagementType')),
    "Milestone name": getMilestoneTitle(milestone1),
    "Milestone delivery date": formatTimestamp(_.get(milestone1, 'itemData.date')),
    "Milestone status": getPaymentStatusByMilestoneStatus(getStatusString(milestone1)),
    "Job status": _.get(job1, 'itemStatus'),
    "Current amount (USD)": _.get(milestone1, 'itemData.payment.billingAmount').toString(),
    "Job currency": _.get(milestone1, 'itemData.currency'),
    "Hourly rate (job currency)": _.get(job1, 'itemData.hourlyBudget').toString(),
    "Planned hours": getJobHoursValues(_.get(milestone1, 'itemData.costLocal'), Number(_.get(job1, 'itemData.hourlyBudget'))).toString(),
    "Approved amount (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.total').toString(),
    "Planned amount (job currency)": _.get(milestone1, 'itemData.cost').toString(),
    "Job Start Date": formatTimestamp(_.get(job1, 'itemData.jobStartDate')),
    "Requested date": formatTimestamp(_.get(milestone1, 'itemData.talentCompletedAt')),
    "Approved date": formatTimestamp(_.get(milestone1, 'itemData.approvals[0].approveDate')),
    "Approved by": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Rejected by": '',
    "Payment currency": _.get(milestone1, 'itemData.providerData.taxInfo.paymentCurrency'),
    "Requested hours": _.get(milestone1, 'itemData.requestedData.hourlyValue').toString(),
    "Requested sub-total (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Requested VAT/TAX (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.tax').toString(),
    "Requested total (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Payment status": _.get(paymentStatusDisplayedName, _.get(milestone1, 'itemData.payment.status'), _.get(milestone1, 'itemData.payment.status')),
    "Payment date": formatTimestamp(_.get(milestone1, 'itemData.payment.valueDate')),
    "Invoice number": _.get(milestone1, 'itemData.autoProFormaInvoiceNumber').toString(),
    "Invoice date": formatTimestamp(_.get(milestone1, 'itemData.autoProFormaInvoiceDate')),
    "Invoice": _.get(_.get(milestone1, 'itemData.files', []).filter(Boolean).find(file => file.autoTalentInvoice), 'name'),
    "Tax Invoice / Receipt": _.get(_.get(milestone1, 'itemData.files', []).filter(Boolean).find(file => file.isInvoice), 'name'),
    "Payment Method": resolvePaymentMethod(milestone1),
    "Transaction fee (USD)": Number(Number(_.get(milestone1, 'itemData.payment.feeData.transactionFee.cost', 0)) + Number(_.get(milestone1, 'itemData.payment.feeData.accelerateFee.cost', 0))).toString(),
    "Service Fee (USD)": "",
    "Requested (custom)": prettifyNumber((_.get(milestone1, 'itemData.providerData.taxInfo.total') - (_.get(milestone1, 'itemData.providerData.taxInfo.tax'))) / _.get(job1, 'itemData.customRateData.ratePer')),
    "Rate (custom)": `${_.get(job1, 'itemData.customRateData.ratePer')} per ${_.get(job1, 'itemData.customRateData.category').toLowerCase()}`,
    "Planned (custom)": _.get(job1, 'itemData.customRateData.estimatedQuantity'),
    "Talent's comment": escape(_.get(milestone1, 'itemData.providerData.comment') || ''),
    "Line item title": '',
    "Line item description": '',
    "Line item amount": '',
    "Line item currency": '',
    "Time report date": dayjs(_.get(milestone1, 'itemData.timeReport[1].date'), constants.dateFormats.saved.milestone.timeReport).format(constants.dateFormats.displayed.milestone.timeReport),
    "Time report hours": _.get(milestone1, 'itemData.timeReport[1].hours'),
    "Time report comment": _.get(milestone1, 'itemData.timeReport[1].comment'),
    "PO item number": "lineItem1",
    "PO number": "poNumber1"
  },
]

const expectedRowsForReportingMilestone2 = [
  {
    "Milestone Id": _.get(milestone2, 'itemId'),
    "Company": _.get(compProvider2, 'itemData.providerName'),
    "Talent email": _.get(compTalent2, 'itemData.email'),
    "Talent": _.get(compProvider2, 'itemData.name'),
    "Company contact email": _.get(compProvider2, 'itemData.providerEmail'),
    "Talent Tax ID": _.get(compProvider2, 'itemData.companyTaxId').toString(),
    "Talent location": convertCountryCodeToName(_.get(compProvider2, 'itemData.country', {})),
    "Talent address": getTalentAddress(_.get(compProvider2, 'itemData')),
    "Talent phone": _.get(compProvider2, 'itemData.phone'),
    "Hiring manager": `${_.get(user2, 'itemData.givenName')} ${_.get(user2, 'itemData.familyName')}`,
    "Workspace": _.get(entity2, 'itemData.entityName'),
    "Space": _.get(job2, `tags.${constants.tags.teams}[0]`, ''),
    "Cost center": _.get(entity2, 'itemData.costCenter').toString(),
    "Legal entity": _.get(entitySettings2, 'itemData.legalEntity.displayName'),
    "Job title": _.get(job2, 'itemData.jobTitle'),
    "Job type": jobHelper.getEngedgmentTypeString(_.get(job2, 'itemData.engagementType')),
    "Milestone name": getMilestoneTitle(milestone2),
    "Milestone delivery date": formatTimestamp(_.get(milestone2, 'itemData.date')),
    "Milestone status": getPaymentStatusByMilestoneStatus(getStatusString(milestone2)),
    "Current amount (USD)": _.get(milestone2, 'itemData.payment.billingAmount').toString(),
    "Job currency": _.get(milestone2, 'itemData.currency'),
    "Hourly rate (job currency)": _.get(job2, 'itemData.hourlyBudget').toString(),
    "Planned hours": getJobHoursValues(_.get(milestone2, 'itemData.costLocal'), Number(_.get(job2, 'itemData.hourlyBudget'))).toString(),
    "Approved amount (payment currency)": _.get(milestone2, 'itemData.providerData.taxInfo.total').toString(),
    "Planned amount (job currency)": _.get(milestone2, 'itemData.cost').toString(),
    "Job Start Date": formatTimestamp(_.get(job2, 'itemData.jobStartDate')),
    "Requested date": formatTimestamp(_.get(milestone2, 'itemData.talentCompletedAt')),
    "Approved date": formatTimestamp(_.get(milestone2, 'itemData.approvals[0].approveDate')),
    "Approved by": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Rejected by": `${_.get(user2, 'itemData.givenName')} ${_.get(user2, 'itemData.familyName')}`,
    "Payment currency": _.get(milestone2, 'itemData.providerData.taxInfo.paymentCurrency'),
    "Requested hours": _.get(milestone2, 'itemData.requestedData.hourlyValue').toString(),
    "Requested sub-total (payment currency)": _.get(milestone2, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Requested VAT/TAX (payment currency)": _.get(milestone2, 'itemData.providerData.taxInfo.tax').toString(),
    "Requested total (payment currency)": _.get(milestone2, 'itemData.providerData.taxInfo.total').toString(),
    "Payment status": _.get(paymentStatusDisplayedName, _.get(milestone2, 'itemData.payment.status'), _.get(milestone2, 'itemData.payment.status')),
    "Payment date": formatTimestamp(_.get(milestone2, 'itemData.payment.valueDate')),
    "Invoice number": _.get(milestone2, 'itemData.proFormaInvoiceNumber').toString(),
    "Invoice date": formatTimestamp(_.get(milestone2, 'itemData.proFormaInvoiceDate')),
    "Invoice": _.get(_.get(milestone2, 'itemData.files', []).filter(Boolean).find(file => file.autoTalentInvoice), 'name'),
    "Tax Invoice / Receipt": _.get(_.get(milestone2, 'itemData.files', []).filter(Boolean).find(file => file.isInvoice), 'name'),
    "Payment Method": resolvePaymentMethod(milestone2),
    "Transaction fee (USD)": Number(Number(_.get(milestone2, 'itemData.payment.feeData.transactionFee.cost', 0)) + Number(_.get(milestone2, 'itemData.payment.feeData.accelerateFee.cost', 0))).toString(),
    "Service Fee (USD)": "",
    "Requested (custom)": prettifyNumber((_.get(milestone2, 'itemData.providerData.taxInfo.total') - (_.get(milestone2, 'itemData.providerData.taxInfo.tax'))) / _.get(job2, 'itemData.customRateData.ratePer')),
    "Rate (custom)": `${_.get(job2, 'itemData.customRateData.ratePer')} per ${_.get(job2, 'itemData.customRateData.category').toLowerCase()}`,
    "Planned (custom)": _.get(job2, 'itemData.customRateData.estimatedQuantity'),
    "Talent's comment": escape(_.get(milestone2, 'itemData.providerData.comment') || ''),
    "Line item title": '',
    "Line item description": '',
    "Line item amount": '',
    "Line item currency": '',
    "Time report date": '',
    "Time report hours": '',
    "Time report comment": '',
    "Job status": _.get(job2, 'itemStatus'),
    "PO item number": "",
    "PO number": "poNumber2",
  }
]

const expectedRowsMilestone2ForPaymentCycle = (expectedValue) => {
  expectedValue['Milestone status'] = constants.ledgerConstants.status.approved;
  expectedValue['Approved amount (payment currency)'] = _.get(milestone2, 'itemData.providerData.taxInfo.total').toString();
  return [expectedValue];
}

const expectedRowsCustomFields = [
  {
    "Milestones": _.get(milestone2, 'itemData.title'),
    "Job": _.get(job2, 'itemData.jobTitle'),
    "Line item title": '',
    "Line item description": '',
    "Line item amount": '',
    "Line item currency": '',
    "Description": escape(_.get(milestone2, 'itemData.description') || ''),
    "Type": jobHelper.getEngedgmentTypeString(_.get(job2, 'itemData.engagementType')),
    "Status": _.get(milestone2, 'itemStatus'),
    "Hiring Manager": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Workspace": _.get(entity2, 'itemData.entityName'),
    "Job Start Date": formatTimestamp(_.get(job2, 'itemData.jobStartDate')),
    "Talent's comment": escape(_.get(milestone2, 'itemData.providerData.comment') || ''),
    "Space": _.get(job2, `tags.${constants.tags.teams}[0]`, ''),
    "Talent": _.get(compTalent2, 'itemData.name'),
    "Delivery Date": formatTimestamp(_.get(milestone2, 'itemData.date')),
    "Planned": _.get(milestone2, 'itemData.costLocal').toString(),
    "Requested": _.get(milestone2, 'itemData.providerData.taxInfo.total').toString(),
    "Approved Date": formatTimestamp(_.get(milestone2, 'itemData.approvals[0].approveDate')),
    "Approved By": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Approved": _.get(milestone2, 'itemData.providerData.taxInfo.total').toString(),
    "Rejected by": '',
    "Requested Date": formatTimestamp(_.get(milestone2, 'itemData.talentCompletedAt')),
    "Parent Email": "test@stoketalent.com",
  }
]

const expectedRowsRequestedFields = [
  {
    "Milestones": _.get(milestone1, 'itemData.title'),
    "Job": _.get(job1, 'itemData.jobTitle'),
    "Description": (_.get(milestone1, 'itemData.description') || '').replace(/\n/gum, " "),
    "Workspace": _.get(entity1, 'itemData.entityName'),
    "Approved Date": formatTimestamp(_.get(milestone1, 'itemData.approvals[0].approveDate')),
    "Approved By": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Approved": _.get(milestone1, 'itemData.providerData.taxInfo.total').toString(),
    "Requested Date": formatTimestamp(_.get(milestone1, 'itemData.talentCompletedAt'))
  },
  {
    "Milestones": _.get(milestone2, 'itemData.title'),
    "Job": _.get(job2, 'itemData.jobTitle'),
    "Description": escape(_.get(milestone2, 'itemData.description') || ''),
    "Workspace": _.get(entity2, 'itemData.entityName'),
    "Approved Date": formatTimestamp(_.get(milestone2, 'itemData.approvals[0].approveDate')),
    "Approved By": `${_.get(user2, 'itemData.givenName')} ${_.get(user2, 'itemData.familyName')}`,
    "Approved": _.get(milestone2, 'itemData.providerData.taxInfo.total').toString(),
    "Requested Date": formatTimestamp(_.get(milestone2, 'itemData.talentCompletedAt'))
  },
]

const expectedRowsForTalent = (talent, provider) => {
  const talentData = talent.itemData
  const isSelfEmployed = _.get(talentData, 'isProviderSelfEmployedTalent')
  const providerData = provider.itemData
  const complianceInfoScores = _.get(talent, 'complianceInfo.scores')
  return [
    {
      "Provider name": resolveUserFullName(talentData),
      "Talent": resolveUserFullName(talentData),
      "Email": _.get(talentData, 'email'),
      "Status": _.get(talent, 'itemStatus') === constants.companyProvider.status.registered ? constants.companyProvider.status.active : _.get(talent, 'itemStatus'),
      "Workspaces": getDepartmentsAmountValues(talentData.departments, entitiesByEntityId, companyId),
      "Title": _.get(talentData, 'jobTitle'),
      "Payable": getIsTalentPayable(talent, provider),
      "Full address": getTalentAddress(isSelfEmployed && _.get(talentData, 'address') ? talentData : providerData),
      "Location": convertCountryCodeToName(getTalentCountry(isSelfEmployed && _.get(talentData, 'country') ? talentData : providerData)),
      "Phone": getTalentPhone(isSelfEmployed && _.get(talentData, 'phone') ? talentData : providerData),
      "Skills": getProviderSkillsInfo(talent).join(", "),
      "Languages": getProviderLanguagesSummary(talent),
      "Score": getAverageRatingByReviews(talent).toString(),
      "Payment method": _.get(providerData, 'paymentMethod', _.get(providerData, 'paymentSystem')),
      "Compliance": getComplianceColorByCalculatedValue(_.get(complianceInfoScores, 'general')),
      "Workforce classification": getComplianceColorByCalculatedValue(_.get(complianceInfoScores, 'workforce')),
      "Legal compliance": getComplianceColorByCalculatedValue(_.get(complianceInfoScores, 'legal')),
      "Tax compliance": getComplianceColorByCalculatedValue(_.get(complianceInfoScores, 'tax')),
      "Talent Type": isSelfEmployed ? 'Individual' : 'Talent under company',
      "Total jobs": "1",
      "Total earned (all time)": getTotalEarned(talent),
      "BG check": _.get(backgroundCheckDisplayedStatus, _.get(talentData, 'backgroundStatusCheck'), _.get(talentData, 'backgroundStatusCheck', '')),
      "Certifications": getProviderCertificationsSummary(talent),
      "Experience": getProviderExperienceSummary(talent),
      "signedUpNoNewJobsThreeMonths": talent.itemId === talentId1 ? "true" : "false",
    }
  ]
}

const expectedRowsForCompanyProvider = (provider) => {
  const providerData = provider.itemData
  return {
    "BG check": "",
    "Certifications": "",
    "Compliance": "Yellow",
    "Email": _.get(providerData, 'providerEmail'),
    "Experience": "",
    "Full address": "",
    "Languages": "",
    "Legal compliance": "Yellow",
    "Location": "",
    "Payable": "Yes",
    "Payment method": _.get(providerData, 'paymentMethod', _.get(providerData, 'paymentSystem')),
    "Phone": "",
    "Provider name": _.get(providerData, 'providerName'),
    "Score": "",
    "Skills": "",
    "Status": "'-",
    "Talent": "Britney Spears",
    "Talent Type": "Talent under company",
    "Tax compliance": "N/A",
    "Title": "",
    "Total earned (all time)": "",
    "Total jobs": "",
    "Workforce classification": "N/A",
    "Workspaces": getDepartmentsAmountValues(providerData.departments, entitiesByEntityId, companyId),
    "signedUpNoNewJobsThreeMonths": "",
  }
}

const withoutFilters = {
  '3_1': {
    Milestones: 'Borat 3_1',
    Job: 'Borat movie 1',
    Description: '',
    Type: 'Fixed',
    Status: 'Active',
    'Hiring Manager': 'user3 test',
    Workspace: 'CustomFilters',
    "Job Start Date": "",
    "Talent's comment": '',
    Space: '',
    Talent: 'Borat Sagdiyev',
    'Delivery Date': '30-Nov-2022',
    Planned: '50',
    Requested: '',
    'Approved Date': '',
    'Approved By': '',
    Approved: '',
    "Rejected by": '',
    'Requested Date': '',
    'Parent Email': 'test@stoketalent.com',
    'Job custom text field1': 'foo',
    'Job custom tag field1': 'Yes',
    'Ms custom text field1': 'text123',
    'Ms custom tag field1': 'True'
  },
  '3_2': {
    Milestones: 'Borat 3_2',
    Job: 'Borat movie 1',
    Description: '',
    Type: 'Fixed',
    Status: 'Active',
    'Hiring Manager': 'user3 test',
    Workspace: 'CustomFilters',
    "Job Start Date": "",
    "Talent's comment": '',
    Space: '',
    Talent: 'Borat Sagdiyev',
    'Delivery Date': '30-Nov-2022',
    Planned: '50',
    Requested: '',
    'Approved Date': '',
    'Approved By': '',
    "Rejected by": '',
    Approved: '',
    'Requested Date': '',
    'Parent Email': 'test@stoketalent.com',
    'Job custom text field1': 'foo',
    'Job custom tag field1': 'Yes',
    'Ms custom text field1': '',
    'Ms custom tag field1': 'False'
  },
  '3_3': {
    Milestones: 'Borat 3_3',
    Job: 'Borat movie 1',
    Description: '',
    Type: 'Fixed',
    Status: 'Active',
    'Hiring Manager': 'user3 test',
    Workspace: 'CustomFilters',
    "Job Start Date": "",
    "Talent's comment": '',
    Space: '',
    Talent: 'Borat Sagdiyev',
    'Delivery Date': '30-Nov-2022',
    Planned: '50',
    Requested: '',
    'Approved Date': '',
    'Approved By': '',
    "Rejected by": '',
    Approved: '',
    'Requested Date': '',
    'Parent Email': 'test@stoketalent.com',
    'Job custom text field1': 'foo',
    'Job custom tag field1': 'Yes',
    'Ms custom text field1': 'text45',
    'Ms custom tag field1': 'True, False'
  },
  '4_1': {
    Milestones: 'Borat 4_1',
    Job: 'Borat 2',
    Description: '',
    Type: 'Fixed',
    Status: 'Active',
    'Hiring Manager': 'user3 test',
    Workspace: 'CustomFilters',
    "Job Start Date": "",
    "Talent's comment": '',
    Space: '',
    Talent: 'Borat Sagdiyev',
    'Delivery Date': '30-Nov-2022',
    Planned: '50',
    Requested: '',
    'Approved Date': '',
    'Approved By': '',
    "Rejected by": '',
    Approved: '',
    'Requested Date': '',
    'Parent Email': '',
    'Job custom text field1': '',
    'Job custom tag field1': 'No',
    'Ms custom text field1': '',
    'Ms custom tag field1': 'True, False'
  },
  '4_2': {
    Milestones: 'Borat 4_2',
    Job: 'Borat 2',
    Description: '',
    Type: 'Fixed',
    Status: 'Active',
    'Hiring Manager': 'user3 test',
    Workspace: 'CustomFilters',
    "Job Start Date": "",
    "Talent's comment": '',
    Space: '',
    Talent: 'Borat Sagdiyev',
    'Delivery Date': '30-Nov-2022',
    Planned: '50',
    Requested: '',
    'Approved Date': '',
    'Approved By': '',
    "Rejected by": '',
    Approved: '',
    'Requested Date': '',
    'Parent Email': '',
    'Job custom text field1': '',
    'Job custom tag field1': 'No',
    'Ms custom text field1': 'text123',
    'Ms custom tag field1': ''
  },
  '5_1': {
    Milestones: 'Borat 5_1',
    Job: 'Borat 3',
    Description: '',
    Type: 'Fixed',
    Status: 'Active',
    'Hiring Manager': 'user3 test',
    Workspace: 'CustomFilters',
    "Job Start Date": "",
    "Talent's comment": '',
    Space: '',
    Talent: 'Borat Sagdiyev',
    'Delivery Date': '30-Nov-2022',
    Planned: '50',
    Requested: '',
    'Approved Date': '',
    'Approved By': '',
    "Rejected by": '',
    Approved: '',
    'Requested Date': '',
    'Parent Email': '',
    'Job custom text field1': '',
    'Job custom tag field1': 'Yes, No',
    'Ms custom text field1': '',
    'Ms custom tag field1': 'False'
  },
  '6_1': {
    Milestones: 'Borat 6_1',
    Job: 'Borat 4',
    Description: '',
    Type: 'Fixed',
    Status: 'Active',
    'Hiring Manager': 'user3 test',
    Workspace: 'CustomFilters',
    "Job Start Date": "",
    "Talent's comment": '',
    Space: '',
    Talent: 'Borat Sagdiyev',
    'Delivery Date': '30-Nov-2022',
    Planned: '50',
    Requested: '',
    'Approved Date': '',
    'Approved By': '',
    "Rejected by": '',
    Approved: '',
    'Requested Date': '',
    'Parent Email': 'test@stoketalent.com',
    'Job custom text field1': 'foo',
    'Job custom tag field1': '',
    'Ms custom text field1': 'text45',
    'Ms custom tag field1': ''
  }
}

const getRowsDataFromUrl = async (url, headers) => {
  const decodedUrl = decodeURIComponent(url)
  const key = decodedUrl.match(/(?<=.com[/])(.*?)(.csv)/)[0]
  let s3Object = await s3.getObject({ Bucket: process.env.jobsBucketName, Key: key }).promise();
  const fileData = s3Object.Body.toString("utf-8");
  const rows = csvLib.csvToObjects(fileData, headers);
  return rows
}

beforeAll(async () => {
  await companiesService.create(companyItem);
  await companiesService.create(companyItem2);
  await companiesService.create(user1);
  await companiesService.create(user2);
  await companiesService.create(user3);
  await companiesService.create(entity1);
  await companiesService.create(entity2);
  await companiesService.create(entity3);
  await usersService.create(authUserCompany);
  await usersService.create(authUserCompany2);
  await usersService.create(authUser1);
  await usersService.create(authUser2);
  await companyProvidersService.create(compTalent1);
  await companyProvidersService.create(compTalent2);
  await companyProvidersService.create(compTalent3);
  await companyProvidersService.create(compProvider1);
  await companyProvidersService.create(compProvider2);
  await companyProvidersService.create(compProvider3);
  await jobsService.create(job1);
  await jobsService.create(job2);
  await jobsService.create(job3);
  await jobsService.create(job4);
  await jobsService.create(job5);
  await jobsService.create(job6);
  await jobsService.create(milestone1);
  await jobsService.create(milestone2);
  await jobsService.create(ms3_1);
  await jobsService.create(ms3_2);
  await jobsService.create(ms3_3);
  await jobsService.create(ms4_1);
  await jobsService.create(ms4_2);
  await jobsService.create(ms5_1);
  await jobsService.create(ms6_1);
  await settingsService.create(basicCompanySettings);
  await settingsService.create(basicSettingsCompany2);
  await settingsService.create(entitySettings1);
  await settingsService.create(entitySettings2);
  await poService.create(po1);
  await poService.create(lineItem1);
  await poService.create(po2);
})

describe('createCsvReport - Job Page', () => {
  it('expect getting url', async () => {
    let response = await handler.run(eventForJobsPageBuilder({}, fieldsForJobsPage));
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toBeUndefined();
  });

  it('expect to get this data', async () => {
    let response = await handler.run(eventForJobsPageBuilder({}, fieldsForJobsPage));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForJobFields)

    expect(rows).toEqual(expectedRowsForJobsMilestone1.concat(expectedRowsForJobsMilestone2))
  });

  it('event with requested fields', async () => {
    const requestedFields = ["milestone", "job", "description", "department", "approvedDate", "approvedBy", "approved", "requestedDate"]
    const requestedHedearsName = ["Milestones", "Job", "Description", "Workspace", "Approved Date", "Approved By", "Approved", "Requested Date"]
    let response = await handler.run(eventForJobsPageBuilder({}, requestedFields));
    const rows = await getRowsDataFromUrl(response.body, requestedHedearsName)
    expect(rows).toEqual(expectedRowsRequestedFields)
  });

  it('event without requested fields', async () => {
    let response = await handler.run(eventForJobsPageBuilder({ workspaces: [entityId2] }, []));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForJobFields)
    expect(rows).toEqual(expectedRowsForJobsMilestone2)
  });

  it('event with workspaces filter', async () => {
    let response = await handler.run(eventForJobsPageBuilder({ workspaces: [entityId2] }, allFieldsForJobsPage));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForJobFields)

    expect(rows).toEqual(expectedRowsForJobsMilestone2)
  });

  it('event with hiring managers filter', async () => {
    let response = await handler.run(eventForJobsPageBuilder({ hiringManagers: [userId2] }, fieldsForJobsPage));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForJobFields)

    expect(rows).toEqual(expectedRowsForJobsMilestone2)
  });

  it('event with talents filter', async () => {
    let response = await handler.run(eventForJobsPageBuilder(
      { talents: [talentId2] },
      fieldsForJobsPage
    )
    );
    const rows = await getRowsDataFromUrl(response.body, headersNamesForJobFields)

    expect(rows).toEqual(expectedRowsForJobsMilestone2)
  });

  it('event with Acceptance status filter', async () => {
    let response = await handler.run(eventForJobsPageBuilder({
      acceptanceStatus: ["APPROVED"],
    }, fieldsForJobsPage));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForJobFields)

    expect(rows).toEqual(expectedRowsForJobsMilestone1)
  });

  it('event with has active milestone filter', async () => {
    let response = await handler.run(eventForJobsPageBuilder({
      hasActiveMilestones: [false],
    }, fieldsForJobsPage));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForJobFields)

    expect(rows).toEqual(expectedRowsForJobsMilestone2)
  });

  it('event with has overdue milestone filter', async () => {
    let response = await handler.run(eventForJobsPageBuilder({
      hasOverdueMilestones: [true]
    }, fieldsForJobsPage));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForJobFields)

    expect(rows).toEqual(expectedRowsForJobsMilestone1)
  });

  it('event with hiring managers and workspaces filter', async () => {
    let response = await handler.run(eventForJobsPageBuilder({
      hiringManagers: [userId2],
      workspaces: [entityId2],
    }, fieldsForJobsPage));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForJobFields);

    expect(rows).toEqual(expectedRowsForJobsMilestone2)
  });

  it('event with custom fields', async () => {
    let response = await handler.run(eventForJobsPageBuilder({
      workspaces: [entityId2],
    }, allFieldsForJobsPage.concat(['lineItems', 'timeReport', 'stoke::externalApproverEmail'])));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForJobFields.concat(["Parent Email"]));

    expect(rows).toEqual(expectedRowsCustomFields)
  });

  it('event with free text filter', async () => {
    let response = await handler.run(eventForJobsPageBuilder({
      quickFilterText: "programming",
    }, fieldsForJobsPage));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForJobFields);

    expect(rows).toEqual(expectedRowsForJobsMilestone1)
  });
})

describe('createCsvReport - Reporting Page', () => {

  beforeAll(async () => {
    await createBasicSettings('user', userId1, companyId, userId1)

    const newList = await listService.create('user', userId1, userId1, constants.settingsListTypes.talentDirectory, LIST_NAME);
    listId = Object.keys(newList.list[`${constants.settingsListTypes.talentDirectory}`])[0];
    await listService.addItems('user', userId1, userId1, constants.settingsListTypes.talentDirectory, listId, [ talentId1, talentId2]);
  });

  it('expect getting url', async () => {
    let response = await handler.run(eventForReportingPageBuilder({}));

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toBeUndefined();
  });

  it('when user is not authorized expect to get error', async () => {
    let response = await handler.run(eventForReportingPageBuilderUserNotAuthorized({}));

    expect(response.statusCode).toBe(403);
    expect(response.body).toBe("{\"message\":\"Authentication failed\"}");
  });

  it('expect to get this data', async () => {
    let response = await handler.run(eventForReportingPageBuilder({}));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);

    expect(rows).toEqual(expectedRowsForReportingMilestone1.concat(expectedRowsForReportingMilestone2))
  });

  it('event with list filter', async () => {
    let response = await handler.run(eventForReportingPageBuilder({
      listId: [listId],
    }));

    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);
    expect(rows).toEqual(expectedRowsForReportingMilestone1.concat(expectedRowsForReportingMilestone2))
  })

  it('event with period Picker filter by custom period', async () => {
    const milestoneDeliveryDateFilter = { milestoneDeliveryDate: { from: new Date('8.1.2022').getTime(), to: new Date('9.1.2022').getTime() } }
    let response = await handler.run(eventForReportingPageBuilder(milestoneDeliveryDateFilter));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);

    expect(rows).toEqual(expectedRowsForReportingMilestone1)
  });

  it('event with period Picker filter by month', async () => {
    const milestonePaymentDateFilter = { milestonePaymentDate: { from: new Date('2.1.2022').getTime(), to: new Date('2.28.2022').getTime() } }

    let response = await handler.run(eventForReportingPageBuilder(milestonePaymentDateFilter));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);
    expect(rows).toEqual(expectedRowsForReportingMilestone2)
  });

  it('event with period Picker filter by year', async () => {
    const milestoneRequestDateFilter = { milestoneRequestDate: { from: new Date('1.1.2023').getTime(), to: new Date('12.28.2023').getTime() } }

    let response = await handler.run(eventForReportingPageBuilder(milestoneRequestDateFilter));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);

    expect(rows).toEqual(expectedRowsForReportingMilestone2)
  });

  it('event with period Picker filter by quarter', async () => {
    const milestoneApproveDateFilter = { milestoneApproveDate: { from: "2023-01-01", to: "2023-03-28" } }

    let response = await handler.run(eventForReportingPageBuilder(milestoneApproveDateFilter));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);

    expect(rows).toEqual(expectedRowsForReportingMilestone1)
  });

  it('event with item status filter', async () => {
    let response = await handler.run(eventForReportingPageBuilder({ itemStatus: ["committed"]}));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);

    expect(rows).toEqual([])
  })

  it('event with payment method filter', async () => {
    let response = await handler.run(eventForReportingPageBuilder({ paymentMethods: ["eCheck"] }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);

    expect(rows).toEqual(expectedRowsForReportingMilestone2)
  })

  it('event with payment status filter', async () => {
    let response = await handler.run(eventForReportingPageBuilder({ paymentStatus: ["Pending"] }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);

    expect(rows).toEqual(expectedRowsForReportingMilestone1)
  })

  it('event with legal entities filter', async () => {
    let response = await handler.run(eventForReportingPageBuilder({
      legalEntities: ["Benesh Org", "Without documents"],
      workspaces: [entityId1],
    }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);

    expect(rows).toEqual(expectedRowsForReportingMilestone1)
  })

  it('event with not valid legal entities filter', async () => {
    let response = await handler.run(eventForReportingPageBuilder({
      legalEntities: ["Benesh Org", "Without documents"],
      workspaces: [entityId2],
    }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);

    expect(rows).toEqual([])
  })

  it('event filter by workspace  with more then 10', async () => {
    let response = await handler.run(eventForReportingPageBuilder({
      workspaces: [
        entityId2,
        'entityId21',
        'entityId22',
        'entityId23',
        'entityId24',
        'entityId25',
        'entityId26',
        'entityId27',
        'entityId28',
        'entityId29',
        'entityId220',
        'entityId211',
      ]
    }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);
    expect(rows).toEqual(expectedRowsForReportingMilestone2)
  })

  it('event with space filter', async () => {
    let response = await handler.run(eventForReportingPageBuilder({
      spaces: ["ODA"]
    }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);

    expect(rows).toEqual(expectedRowsForReportingMilestone2)
  })

  it('event with open payment cycle filter - not paid yet', async () => {
    let response = await handler.run(eventForReportingPageBuilder({
      openPaymentCycle: { to: 1655631404896, from: companyDueDateService.getPreviousPaymentCycle(basicCompanySettings.itemData.paymentSchedule, 1655631404896) }
    }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);

    expect(rows).toEqual(expectedRowsForReportingMilestone2)
  })

  it('event with close payment cycle filter', async () => {
    await jobsService.update({ itemId: milestoneId2, entityId: entityId2, itemStatus: constants.job.status.paid, modifiedBy: userId1 });
    let response = await handler.run(eventForReportingPageBuilder({
      closePaymentCycle: { to: 1655631404896, from: companyDueDateService.getPreviousPaymentCycle(basicCompanySettings.itemData.paymentSchedule, 1655631404896) }
    }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);

    expect(rows).toEqual([{ ...expectedRowsForReportingMilestone2[0], "Approved amount (payment currency)": "323.52", "Milestone status": "approved" }])
  })

  it('event with open payment cycle filter - already paid', async () => {
    await jobsService.update({ itemId: milestoneId2, entityId: entityId2, itemStatus: constants.job.status.paid, modifiedBy: userId1 });

    let response = await handler.run(eventForReportingPageBuilder({
      openPaymentCycle: { to: 1655631404896, from: companyDueDateService.getPreviousPaymentCycle(basicCompanySettings.itemData.paymentSchedule, 1655631404896) },
      spaces: ["ODA"],
      paymentMethods: ["eCheck"],
    }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);
    expect(rows).toEqual(expectedRowsMilestone2ForPaymentCycle({ ...expectedRowsForReportingMilestone2[0] }))
  })
})

it('event with open payment cycle filter - already paid', async () => {
  _.set(milestone1, 'itemData.payment.dueDate', 1655631404895);
  _.set(milestone1, 'itemData.payment.PendingDate', 1651224590000);
  _.set(milestone1, 'itemStatus', constants.job.status.completed);
  await jobsService.update(milestone1);
  await jobsService.update({ itemId: milestoneId2, entityId: entityId2, itemStatus: constants.job.status.paid, modifiedBy: userId1 });

  let response = await handler.run(eventForReportingPageBuilder({
    openPaymentCycle: { to: 1655631404896, from: companyDueDateService.getPreviousPaymentCycle(basicCompanySettings.itemData.paymentSchedule, 1655631404896) },
  }));
  const rows = await getRowsDataFromUrl(response.body, headersNamesForPaymentsFields);
  expect(rows.length).toEqual(5)
})

describe('buildPaymentCycleFilterBuilder function', () => {
  it('should return function', () => {
    const to = new Date();
    const builderResult = buildPaymentCycleFilterBuilder(to.setDate(to.getDate() - 7), to)
    expect(typeof builderResult).toEqual('function')
  })

  it('the returned function should return appropiate expressionAttributeValues, expressionAttributeNames and filterExpression', () => {
    const to = new Date();
    const builderResult = buildPaymentCycleFilterBuilder(to.setDate(to.getDate() - 7), new Date());

    const eaValuePrefix = `:eav_0`;
    const eaNamePrefix = `#ean_0`;

    const functionResult = builderResult(eaValuePrefix, eaNamePrefix)
    expect(Object.keys(functionResult)).toContainEqual('expressionAttributeValues');
    expect(Object.keys(functionResult)).toContainEqual('expressionAttributeNames');
    expect(Object.keys(functionResult)).toContainEqual('filterExpression');

    for (const key in functionResult.expressionAttributeValues) {
      expect(key.startsWith(eaValuePrefix)).toBe(true);
    }

    for (const key in functionResult.expressionAttributeNames) {
      expect(key.startsWith(eaNamePrefix)).toBe(true);
    }
  })
});

describe('createCsvReport - custom field filters', () => {

  it('event with all custom field filters', async () => {
    let response = await handler.run(eventWithCustomFieldFilterBuilder());
    const rows = await getRowsDataFromUrl(response.body, customFieldsRequestedFields(true));

    const expectedRows = getRows(['3_1', '3_2', '3_3', '4_1', '4_2', '5_1', '6_1']);
    expect(rows).toEqual(expectedRows);
  });

  it('event where quickFilterText is "movie"', async () => {
    let response = await handler.run(eventWithCustomFieldFilterBuilder({ quickFilterText: 'movie' }));
    const rows = await getRowsDataFromUrl(response.body, customFieldsRequestedFields(true));
    const expectedRows = getRows(['3_1', '3_2', '3_3']);
    expect(rows).toEqual(expectedRows);
  });

  it('event where customTextJob1 is "foo"', async () => {
    let response = await handler.run(eventWithCustomFieldFilterBuilder({}, { job_string_customTextJob1: ["foo"] }));
    const rows = await getRowsDataFromUrl(response.body, customFieldsRequestedFields(true));
    const expectedRows = getRows(['3_1', '3_2', '3_3', '6_1']);
    expect(rows).toEqual(expectedRows);
  });

  it('event where customTextJob1 is "foo" and customTagsMs1 "True"', async () => {
    let response = await handler.run(eventWithCustomFieldFilterBuilder({}, { job_string_customTextJob1: ["foo"], ms_multiselect_customTagsMs1: ["True"] }));
    const rows = await getRowsDataFromUrl(response.body, customFieldsRequestedFields(true));
    const expectedRows = getRows(['3_1', '3_3']);
    expect(rows).toEqual(expectedRows);
  });

  it('event where customTextJob1 is "foo", customTagsMs1 "True" and customTextMs1 "text45"', async () => {
    let response = await handler.run(eventWithCustomFieldFilterBuilder({}, { job_string_customTextJob1: ["foo"], ms_multiselect_customTextMs1: ["text45"], ms_multiselect_customTagsMs1: ["True"] }));
    const rows = await getRowsDataFromUrl(response.body, customFieldsRequestedFields(true));
    const expectedRows = getRows(['3_3']);
    expect(rows).toEqual(expectedRows);
  });

  it('event where customTagsJob1 is "Yes" and customTextMs1 "text123"', async () => {
    let response = await handler.run(eventWithCustomFieldFilterBuilder({}, { job_multiselect_customTagsJob1: ["Yes"], ms_string_customTextMs1: ["text123"] }));
    const rows = await getRowsDataFromUrl(response.body, customFieldsRequestedFields(true));
    const expectedRows = getRows(['3_1']);
    expect(rows).toEqual(expectedRows);
  });

  it('event where externalApproverEmail is "test@stoketalent.com", quickFilterText is "movie", customTagsMs1 "False" and customTextMs1 "text45"', async () => {
    let response = await handler.run(eventWithCustomFieldFilterBuilder({ quickFilterText: 'movie' }, { 'job_string_stoke::externalApproverEmail': ["test@stoketalent.com"], ms_multiselect_customTagsMs1: ["False"], ms_string_customTextMs1: ["text45"] }));
    const rows = await getRowsDataFromUrl(response.body, customFieldsRequestedFields(true));
    const expectedRows = getRows(['3_3']);
    expect(rows).toEqual(expectedRows);
  });
});

describe('createCsvReport - Talent Directory Page', () => {
  it('expect getting url', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({}));
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toBeUndefined();
  });

  it('event with talent status filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ itemStatus: [constants.user.status.active] }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent1, compProvider1))
  })

  it('event with talent type filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ talentType: ['individual'] }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent2, compProvider2))
  })

  it('event with talentId filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ talents: [talentId1] }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent1, compProvider1))
  })

  it('event with paymentMethod filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ paymentMethods: [constants.payment.name.tipalti] }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent2, compProvider2))
  })

  it('event with location filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ location: ['Israel'] }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent1, compProvider1))
  })

  it('event with score filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ score: [4] }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent1, compProvider1))
  })

  it('event with background check status filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ backgroundStatusCheck: ['success' ]}));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent2, compProvider2))
  })

  it('event with background check status filter with blank option', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ backgroundStatusCheck: ['MISSING']}));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent1, compProvider1))
  })

  it('event with payableStatusValue status filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ payableStatusValue: [ "No" ]}));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent1, compProvider1).concat(expectedRowsForTalent(compTalent2, compProvider2)))
  })

  it('event with skillNames filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ skillNames: ['agile development', 'painting'] }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent1, compProvider1))
  })

  it('event with workspaces filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ assignedDepartments: [entityId1] }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent1, compProvider1))
  })

  it('event with languages filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ 
      languagesNames: [ { id: "English", proficiency: ["basic", "conversational"] }, { id: "Afar", proficiency: [ "conversational" ] }, { id: "Francais", proficiency: [ "any" ] }]
    }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent2, compProvider2))
  })

  it('event with languages filter with any proficiency', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ 
      languagesNames: [ { id: "Arabic", proficiency: [ "any" ] }]
    }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent1, compProvider1))
  })

  it('event with compliance filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder( { complianceValue: [
      { id: "complianceValue", values: [{ id: 2, isChecked: true }, { id: 1, isChecked: false }, { id: 0, isChecked: false }]},
      { id: "complianceWorkforce", values: [ { id: 2, isChecked: false }, {  id: 1, isChecked: true }, { id: 0, isChecked: false }]},
      { id: "complianceLegal", values: [ { id: 2, isChecked: false }, {  id: 1, isChecked: false }, { id: 0, isChecked: true }]},
      { id: "complianceTax", values: [ { id: 2, isChecked: true }, {  id: 1, isChecked: false }, { id: 0, isChecked: false }]}
    ]}));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent1, compProvider1))
  })

  it('event with compliance filter with more than one value selected', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder( { complianceValue: [
      { id: "complianceValue", values: [{ id: 2, isChecked: true }, { id: 1, isChecked: false }, { id: 0, isChecked: true }]},
      { id: "complianceWorkforce", values: [ { id: 2, isChecked: false }, {  id: 1, isChecked: true }, { id: 0, isChecked: false }]},
      { id: "complianceLegal", values: [ { id: 2, isChecked: false }, {  id: 1, isChecked: true }, { id: 0, isChecked: false }]},
      { id: "complianceTax", values: [ { id: 2, isChecked: true }, {  id: 1, isChecked: false }, { id: 0, isChecked: false }]}
    ]}));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);

    expect(removeSequenceFields(rows)).toEqual([
      ...expectedRowsForTalent(compTalent1, compProvider1), 
      ...expectedRowsForTalent(compTalent2, compProvider2), 
      expectedRowsForCompanyProvider(compProvider3),
      ])
  })

  it('event with comments and reviews filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ reviewsBySearch: 'excellent' }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent2, compProvider2))
  })

  it('event with quick filter search', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ quickFilterText: 'Sean' }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent2, compProvider2))
  })

  it('event with freelancer experience filter', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ 
        freelancerExperience: [
          "1-2 years",
          "3-5 years"
      ]
    }));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent1, compProvider1))
  })

  it('event with certification filter - has certifications', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ certification: ["Has certification"]}));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent2, compProvider2))
  })

  it('event with certification filter - does not have certifications', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ certification: ["Doesn’t have"]}));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    expect(removeSequenceFields(rows)).toEqual(expectedRowsForTalent(compTalent1, compProvider1))
  })

  it('event with certification filter - have and does not have', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({ certification: ["Has certification", "Doesn’t have"]}));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    const expectedRows = [
      ...expectedRowsForTalent(compTalent1, compProvider1),
      ...expectedRowsForTalent(compTalent2, compProvider2)
    ]
    expect(removeSequenceFields(rows)).toEqual(expectedRows)
  })

  it('event with talent profile custom field', async () => {
    let response = await handler.run(eventWithTalentProfileFieldFilterBuilder());
    const rows = await getRowsDataFromUrl(response.body, ['providerName', 'email', 'talent'].concat(talentProfileFieldsHeaders));
    const expectedRows = [
      {
        providerName: 'Lenny Kravitz',
        email: 'lennykravitz1@stoketalent.com',
        talent: 'Lenny Kravitz',
        'talentProfileCustomField::Emergency phone number': '911',
        'talentProfileCustomField::Food allergies': 'Beans, Sugar'
      },
      {
        providerName: 'Sean Paul',
        email: 'seanpaul@stoketalent.com',
        talent: 'Sean Paul',
        'talentProfileCustomField::Emergency phone number': '911000',
        'talentProfileCustomField::Food allergies': 'Beans, Milk, Penauts'
      },
      {
        "email": "britneyspears@stoketalent.com",
        "providerName": "Britney Spears",
        "talent": "Britney Spears",
        "talentProfileCustomField::Emergency phone number": "",
        "talentProfileCustomField::Food allergies": "",
      },
    ]
    expect(rows).toEqual(expectedRows);
  });

  it('event with talent profile custom field, with filter', async () => {
    let response = await handler.run(eventWithTalentProfileFieldFilterBuilder({}, { 'talentProfileCustomField::Emergency phone number': ['911'] }));
    const rows = await getRowsDataFromUrl(response.body, ['providerName', 'email', 'talent'].concat(talentProfileFieldsHeaders));
    const expectedRows = [
      {
        providerName: 'Lenny Kravitz',
        email: 'lennykravitz1@stoketalent.com',
        talent: 'Lenny Kravitz',
        'talentProfileCustomField::Emergency phone number': '911',
        'talentProfileCustomField::Food allergies': 'Beans, Sugar'
      }
    ]
    expect(rows).toEqual(expectedRows);
  });

  it('event with all providers includes company provider without talents under them', async () => {
    let response = await handler.run(eventForTalentDirectoryPageBuilder({}));
    const rows = await getRowsDataFromUrl(response.body, headersNamesForTalentDirectoryFields);
    const expectedRows = [
      ...expectedRowsForTalent(compTalent1, compProvider1),
      ...expectedRowsForTalent(compTalent2, compProvider2),
      expectedRowsForCompanyProvider(compProvider3),
    ]

    expect(removeSequenceFields(rows)).toEqual(expectedRows)
  })

  it('event for showing compliance sequence fields', async () => {
    const customTableRequestedFields = ['providerName', 'email', 'name', ...complianceSequenceFields]
    const baseAndComplianceSequenceHeaders = [
      "Provider name", "Email", "Talent", ...complianceSequenceHeaders
      ];

    const customFilters = {
        "notIncludeStatuses":[
          "inactive"
        ],
      }
    
    const response = await handler.run(eventForTalentDirectoryPageBuilder(customFilters, customTableRequestedFields));
    const rows = await getRowsDataFromUrl(response.body, baseAndComplianceSequenceHeaders);
    const expectedRows = [
      {
        'Provider name': 'Lenny Kravitz',
        Email: 'lennykravitz1@stoketalent.com',
        Talent: 'Lenny Kravitz',
        'Working Period': '8',
        'Engagement Length': '8',
        'Average Monthly Hours': '14.31',
        'Average Monthly Pay (USD)': '281.3'
      },
      {
        'Provider name': 'Sean Paul',
        Email: 'seanpaul@stoketalent.com',
        Talent: 'Sean Paul',
        'Working Period': '0',
        'Engagement Length': '0',
        'Average Monthly Hours': '0',
        'Average Monthly Pay (USD)': '0'
      },
      {
        'Provider name': 'Britney Spears',
        Email: 'britneyspears@stoketalent.com',
        Talent: 'Britney Spears',
        'Working Period': '',
        'Engagement Length': '',
        'Average Monthly Hours': '',
        'Average Monthly Pay (USD)': ''
      }
    ]
    expect(rows).toEqual(expectedRows)
  })
})

afterAll(async () => {
  await companiesService.delete(companyItem.itemId);
  await companiesService.delete(companyItem2.itemId);
  await companiesService.delete(user1.itemId);
  await companiesService.delete(user2.itemId);
  await companiesService.delete(user3.itemId);
  await companiesService.delete(entity1.itemId);
  await companiesService.delete(entity2.itemId);
  await companiesService.delete(entity3.itemId);
  await usersService.delete(authUser1.userId, entityId1);
  await usersService.delete(authUser2.userId, entityId2);
  await usersService.delete(authUserCompany.userId, companyId);
  await usersService.delete(authUserCompany2.userId, companyId2);
  await companyProvidersService.delete(companyId, talentId1);
  await companyProvidersService.delete(companyId, talentId2);
  await companyProvidersService.delete(companyId2, talentId3);
  await companyProvidersService.delete(companyId, providerId1);
  await companyProvidersService.delete(companyId, providerId2);
  await companyProvidersService.delete(companyId, providerId3);

  await jobsService.delete(entityId1, milestoneId1);
  await jobsService.delete(entityId2, milestoneId2);
  await jobsService.delete(entityId1, jobId1);
  await jobsService.delete(entityId2, jobId2);

  await jobsService.delete(entityId3, jobId3);
  await jobsService.delete(entityId3, jobId4);
  await jobsService.delete(entityId3, jobId5);
  await jobsService.delete(entityId3, jobId6);

  await jobsService.delete(entityId3, milestoneId3_1);
  await jobsService.delete(entityId3, milestoneId3_2);
  await jobsService.delete(entityId3, milestoneId3_3);
  await jobsService.delete(entityId3, milestoneId4_1);
  await jobsService.delete(entityId3, milestoneId4_2);
  await jobsService.delete(entityId3, milestoneId5_1);
  await jobsService.delete(entityId3, milestoneId6_1);

  await settingsService.delete(entitySettings1.itemId);
  await settingsService.delete(entitySettings2.itemId);
  await settingsService.delete(basicCompanySettings.itemId);
  await settingsService.delete(basicSettingsCompany2.itemId);
  await settingsService.delete(constants.prefix.user + userId1);

  await poService.delete(companyId, po1.itemId);
  await poService.delete(companyId, lineItem1.itemId);
  await poService.delete(companyId, po2.itemId);
});
