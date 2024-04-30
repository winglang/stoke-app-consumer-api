'use strict';
const _ = require('lodash');
const scheduleReports = require("../src/scheduleReports.js"); 
const jestPlugin = require("serverless-jest-plugin");
const handler = jestPlugin.lambdaWrapper.wrap(scheduleReports, { handler: 'sendingRelevantReports' });
const { jobHelper, constants, UsersService, JobsService, CompanyProvidersService, CompaniesService, SettingsService, idConverterLib } = require('stoke-app-common-api');
const { formatTimestamp, convertCountryCodeToName, getPaymentStatusByMilestoneStatus, getJobHoursValues, resolvePaymentMethod, prettifyNumber, getTalentAddress } = require('../src/helpers/utils');
const csvLib = require('stoke-app-common-api/lib/csvLib');
const { escape, getMilestoneTitle, getStatusString } = require('../src/helpers/csvReport/csvReportHelper');
const { resolveActiveFiltersForPaymentPage, resolvePeriodPicker, resolveRequestedFields, resolvePaymentCycle } = require('../src/helpers/scheduleReportHelper');
const { jobListType } = require('../src/job/queryAttrs');
const AWS = require('aws-sdk');
const s3 = new AWS.S3({});
const { createCsv } = require('../src/helpers/csvReport/createCsv.js');
const { basicFieldsForPaymentPage, allFieldsForPaymentPage } = require('../src/helpers/csvReport/csvFieldsLists.js');
const { paymentStatusDisplayedName } = require('../src/helpers/csvReport/constants.js');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes)
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAndTagsAttributes);
const settingsService = new SettingsService(process.env.settingsTableName);

const getRowsDataFromUrl = async (url, headers) => {
  const decodedUrl = decodeURIComponent(url)
  const key = decodedUrl.match(/(?<=.com[/])(.*?)(.csv)/)[0]
  let s3Object = await s3.getObject({ Bucket: process.env.jobsBucketName, Key: key }).promise();
  const fileData = s3Object.Body.toString("utf-8");
  const rows = csvLib.csvToObjects(fileData, headers);
  return rows
}

const testName = 'SENDING-RELEVANT-REPORTS-TEST'
const entityId1 = `${testName}-ENT-ID-1`;
const entityId2 = `${testName}-ENT-ID-2`;
const entityId3 = `${testName}-ENT-ID-3`;
const companyId = `${testName}-COMP-ID-1`;
const companyId2 = `${testName}-COMP-ID-2`;
const userId1 = `${testName}-USER-ID-1`;
const userId2 = `${testName}-USER-ID-2`;
const userId3 = `${testName}-USER-ID-3`;
const providerId = `${constants.prefix.provider}${companyId}_PROVIDER-ID-1`;
const talentId1 = `${constants.prefix.talent}${providerId}${constants.prefix.talent}${testName}-TALENT-ID-1`;
const talentId2 = `${constants.prefix.talent}${providerId}${constants.prefix.talent}${testName}-TALENT-ID-2`;
const talentId3 = `${constants.prefix.talent}${providerId}${constants.prefix.talent}${testName}-TALENT-ID-3`;
const jobId1 = `job_${testName}-job-1`;
const jobId2 = `job_${testName}-job-2`;
const jobId3 = `job_${testName}-job-3`;
const jobId4 = `job_${testName}-job-4`;
const jobId5 = `job_${testName}-job-5`;
const jobId6 = `job_${testName}-job-6`;
const milestoneId1 = `ms_${jobId1}_ms1`;
const milestoneId2 = `ms_${jobId2}_ms2`;
const savedReportIdWithScheduler1 = `${testName}-SAVED-REPORT-ID-1`;
const savedReportIdWithScheduler2 = `${testName}-SAVED-REPORT-ID-2`;
const savedReportIdWithoutScheduler = `${testName}-SAVED-REPORT-ID-3`;

const milestoneId3_1 = `ms_${jobId3}_ms1`;
const milestoneId3_2 = `ms_${jobId3}_ms2`;
const milestoneId3_3 = `ms_${jobId3}_ms3`;
const milestoneId4_1 = `ms_${jobId4}_ms1`;
const milestoneId4_2 = `ms_${jobId4}_ms2`;
const milestoneId5_1 = `ms_${jobId5}_ms1`;
const milestoneId6_1 = `ms_${jobId6}_ms1`;

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

const headersNamesForPaymentsFields = _.map(basicFieldsForPaymentPage, 'headerName')

// const customFieldsArray = ['stoke::externalApproverEmail', 'customTextJob1', 'customTagsJob1', 'customTextMs1', 'customTagsMs1'];
// const customFieldsHeadersArray = ['Parent Email', 'Job custom text field1', 'Job custom tag field1', 'Ms custom text field1', 'Ms custom tag field1'];
// const lineItemsArray = ['Line item title', 'Line item description', 'Line item amount'];
// const headersNamesForJobFields = _.map(basicFieldsForJobsPage, 'headerName')
// const headersNamesForPaymentsFields = _.map(basicFieldsForPaymentPage, 'headerName')
// const fieldsForJobsPage = allFieldsForJobsPage.concat(['lineItems'])

const job1 = {
  companyId,
  entityId: entityId1,
  itemId: jobId1,
  userId: userId1,
  itemStatus: constants.job.status.active,
  talentId: talentId1,
  itemData: {
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
    __stoke__teams: [ 'SMA' ]
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
    __stoke__teams: [ 'ODA' ]
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
          type: ""
        }
      ]
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
          type: "string"
        },
        {
          id: "customTextJob1",
          name: "Job custom text field1",
          options: [],
          type: "string"
        },
        {
          id: "customTagsJob1",
          name: "Job custom tag field1",
          options: [
            "Yes",
            "No"
          ],
          type: "multiselect"
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
          type: "string"
        },
        {
          id: "customTagsMs1",
          name: "Ms custom tag field1",
          options: [
            "True",
            "False"
          ],
          type: "multiselect"
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

const compProvider = {
  itemId: providerId,
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
    country: 'US',
    address: '103 Princeton Junction',
    city: "Princeton",
    state: "New Jersey",
    postalCode: "123456",
    phone: "732546549753",
  },
  tags: {
    address: 'address',
  }
};

const compTalent1 = {
  itemId: talentId1,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    name: 'Lenny Kravitz',
    email: 'lennykravitz1@stoketalent.com',
    address: '103 Princeton Junction',
    city: "Princeton",
    state: "New Jersey",
    country: "US",
    postalCode: "123456",
    phone: "732546549753",
  },
};

const compTalent2 = {
  itemId: talentId2,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    name: 'Lenny Kravitz',
    email: 'lennykravitz2@stoketalent.com',
    address: '103 Princeton Junction',
    city: "Princeton",
    state: "New Jersey",
    country: "US",
    postalCode: "123456",
    phone: "732546549753",
  },
};

const compTalent3 = {
  itemId: talentId3,
  companyId: companyId2,
  itemStatus: constants.user.status.active,
  itemData: {
    name: 'Borat Sagdiyev'
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
  itemStatus: constants.job.status.active,
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
  itemStatus: constants.job.status.requested,
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

const expectedRowsForReportingMilestone1 = [
  {
    "Milestone Id": _.get(milestone1, 'itemId'),
    "Company": _.get(compProvider, 'itemData.providerName'),
    "Talent email": _.get(compTalent1, 'itemData.email'),
    "Talent": _.get(compProvider, 'itemData.name'),
    "Company contact email": _.get(compProvider, 'itemData.providerEmail'),
    "Talent Tax ID": _.get(compProvider, 'itemData.companyTaxId').toString(),
    "Talent location": convertCountryCodeToName(_.get(compProvider, 'itemData.country', {})),
    "Talent address": getTalentAddress( _.get(compTalent1, 'itemData')),
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
    "Approved amount (payment currency)": '',
    "Planned amount (job currency)": _.get(milestone1, 'itemData.cost').toString(),
    "Job Start Date": formatTimestamp(_.get(job1, 'itemData.jobStartDate')),
    "Requested date": formatTimestamp(_.get(milestone1, 'itemData.talentCompletedAt')),
    "Approved date": formatTimestamp(_.get(milestone1,'itemData.approvals[0].approveDate')),
    "Approved by": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Rejected by": '',
    "Payment currency":  _.get(milestone1, 'itemData.providerData.taxInfo.paymentCurrency'),
    "Requested hours": _.get(milestone1, 'itemData.requestedData.hourlyValue').toString(),
    "Requested sub-total (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Requested VAT/TAX (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.tax').toString(),
    "Requested total (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Payment status": _.get(paymentStatusDisplayedName, _.get(milestone1, 'itemData.payment.status'), _.get(milestone1, 'itemData.payment.status')),
    "Payment date": formatTimestamp(_.get(milestone1, 'itemData.payment.valueDate')),
    "Invoice number": _.get(milestone1, 'itemData.autoProFormaInvoiceNumber').toString(),
    "Invoice date": formatTimestamp(_.get(milestone1, 'itemData.autoProFormaInvoiceDate')),
    "Invoice": _.get(_.get(milestone1, 'itemData.files', []).filter(Boolean).find(file => file.autoTalentInvoice),'name'),
    "Tax Invoice / Receipt": _.get(_.get(milestone1, 'itemData.files', []).filter(Boolean).find(file => file.isInvoice), 'name'),
    "Time report comment": "",
    "Time report date": "",
    "Time report hours": "",
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
    "Milestone status": "committed",
    "PO item number": "",
    "PO number": "",
  },
  {
    "Milestone Id": _.get(milestone1, 'itemId'),
    "Company": _.get(compProvider, 'itemData.providerName'),
    "Talent email": _.get(compTalent1, 'itemData.email'),
    "Talent": _.get(compProvider, 'itemData.name'),
    "Company contact email": _.get(compProvider, 'itemData.providerEmail'),
    "Talent Tax ID": _.get(compProvider, 'itemData.companyTaxId').toString(),
    "Talent location": convertCountryCodeToName(_.get(compProvider, 'itemData.country', {})),
    "Talent address": getTalentAddress( _.get(compTalent1, 'itemData')),
    "Talent phone": _.get(compProvider, 'itemData.phone'),
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
    "Approved amount (payment currency)": '',
    "Planned amount (job currency)": _.get(milestone1, 'itemData.cost').toString(),
    "Job Start Date": formatTimestamp(_.get(job1, 'itemData.jobStartDate')),
    "Requested date": formatTimestamp(_.get(milestone1, 'itemData.talentCompletedAt')),
    "Approved date": formatTimestamp(_.get(milestone1,'itemData.approvals[0].approveDate')),
    "Approved by": `${_.get(user1, 'itemData.givenName')} ${_.get(user1, 'itemData.familyName')}`,
    "Rejected by": '',
    "Payment currency":  _.get(milestone1, 'itemData.providerData.taxInfo.paymentCurrency'),
    "Requested hours": _.get(milestone1, 'itemData.requestedData.hourlyValue').toString(),
    "Requested sub-total (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Requested VAT/TAX (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.tax').toString(),
    "Requested total (payment currency)": _.get(milestone1, 'itemData.providerData.taxInfo.subTotal').toString(),
    "Payment status": _.get(paymentStatusDisplayedName, _.get(milestone1, 'itemData.payment.status'), _.get(milestone1, 'itemData.payment.status')),
    "Payment date": formatTimestamp(_.get(milestone1, 'itemData.payment.valueDate')),
    "Invoice number": _.get(milestone1, 'itemData.autoProFormaInvoiceNumber').toString(),
    "Invoice date": formatTimestamp(_.get(milestone1, 'itemData.autoProFormaInvoiceDate')),
    "Invoice": _.get(_.get(milestone1, 'itemData.files', []).filter(Boolean).find(file => file.autoTalentInvoice),'name'),
    "Tax Invoice / Receipt": _.get(_.get(milestone1, 'itemData.files', []).filter(Boolean).find(file => file.isInvoice), 'name'),
    "Time report comment": "",
    "Time report date": "",
    "Time report hours": "",
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
    "PO item number": "",
    "PO number": "",
  },
]

const reportDetails = {
  "filters": {
      "hiringManagerId": [
        `${userId1}`
      ],
  },
  "groupBy": "providerId",
  "selectedColumns": allFieldsForPaymentPage.concat(['lineItems']).reduce((acc, val) => {
    acc[val] = true;
    return acc;
  }, {}),
  "periodPicker": {
      "year": 2022,
      "month": "1",
      "quarter": "1",
      "customPeriod": {
          "from": "",
          "to": ""
      },
      "isYearlyForced": true,
      "isMonthlyForced": false,
      "isCustomPeriodForced": false,
      "isRelativeForced": false,
      "relativePeriod": "Month",
      "relativeType": "current"
  },
  "dateFilterType": "milestoneDeliveryDate",
  "name": "check"
}

const savedReportWithScheduler1 = {
  itemId: `${constants.prefix.savedReport}${savedReportIdWithScheduler1}`,
  userId: userId1,
  companyId,
  entityId: companyId,
  itemStatus: constants.settings.status.active,
  createdBy: userId1,
  createdAt: Date.now(),
  modifiedBy: userId1,
  itemData: {
      reportDetails: {
          ...reportDetails,
          isScheduler: true,
          schedulerData: {
            scheduleSending: '0 * * * *',
            recipients: {
              usersIds: [userId1, userId2]
            },
          }
      },
  },
};

const savedReportWithScheduler2 = {
  itemId: `${constants.prefix.savedReport}${savedReportIdWithScheduler2}`,
  userId: userId2,
  companyId,
  entityId: companyId,
  itemStatus: constants.settings.status.active,
  createdBy: userId2,
  createdAt: Date.now(),
  modifiedBy: userId2,
  itemData: {
      reportDetails: {
          ...reportDetails,
          isScheduler: true,
          schedulerData: {
            scheduleSending: '0 * * * *',
            recipients: {
              usersIds: [user1, user2]
            },
          }
      },
  },
};

const savedReportWithoutScheduler = {
  itemId: `${constants.prefix.savedReport}${savedReportIdWithoutScheduler}`,
  userId: userId2,
  companyId: companyId2,
  entityId: companyId2,
  itemStatus: constants.settings.status.active,
  createdBy: userId2,
  createdAt: Date.now(),
  modifiedBy: userId2,
  itemData: {
      reportDetails: {
          ...reportDetails,
          isScheduler: false,
      },
  },
};

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
  await companyProvidersService.create(compProvider);
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
  await settingsService.create(basicCompanySettings)
  await settingsService.create(basicSettingsCompany2)
  await settingsService.create(entitySettings1)
  await settingsService.create(entitySettings2)
  await settingsService.create(savedReportWithScheduler1)
  await settingsService.create(savedReportWithScheduler2)
  await settingsService.create(savedReportWithoutScheduler)
})

describe('sendingRelevantReports', () => {
  it('expect sending schedulerReports when exist', async () => {
    let response = await handler.run({ companyId });
    const expectedResult = { companyId, reportsToSendCount: 2 };
    expect(response).toMatchObject(expectedResult);
  });

  it('expect not sending any report when schedulerReports not exist', async () => {
    let response = await handler.run({ companyId: companyId2 });
    const expectedResult = { companyId: companyId2, reportsToSendCount: 0 };
    expect(response).toMatchObject(expectedResult);
  });
})

describe('sendScheduleReport function', () => {
  it('should return valid csvFileKey', async () => {
    const data = {
      companyId,
      type: jobListType.paymentsPage,
      filterKey: null,
      tableRequestedFields: resolveRequestedFields(_.get(reportDetails, 'selectedColumns')),
      filters: {
          ...resolvePaymentCycle(_.get(reportDetails, 'selectedPaymentCycle')),
          ...await resolveActiveFiltersForPaymentPage(_.get(reportDetails, 'filters'), companyId),
          ...resolvePeriodPicker(_.get(reportDetails, 'periodPicker'), _.get(reportDetails, 'dateFilterType')),
      }
    }
    const { url } = await createCsv(userId1, data)
    const rows = await getRowsDataFromUrl(url, headersNamesForPaymentsFields)
    expect(rows).toEqual(expectedRowsForReportingMilestone1)
  })
});


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
  await companyProvidersService.delete(companyId, providerId);

  // await jobsService.delete(entityId1, milestoneId1);
  // await jobsService.delete(entityId2, milestoneId2);
  await jobsService.delete(entityId1, jobId1);
  await jobsService.delete(entityId2, jobId2);

  await jobsService.delete(entityId3, jobId3);
  await jobsService.delete(entityId3, jobId4);
  await jobsService.delete(entityId3, jobId5);
  await jobsService.delete(entityId3, jobId6);

  // await jobsService.delete(entityId3, milestoneId3_1);
  // await jobsService.delete(entityId3, milestoneId3_2);
  // await jobsService.delete(entityId3, milestoneId3_3);
  // await jobsService.delete(entityId3, milestoneId4_1);
  // await jobsService.delete(entityId3, milestoneId4_2);
  // await jobsService.delete(entityId3, milestoneId5_1);
  // await jobsService.delete(entityId3, milestoneId6_1);

  await settingsService.delete(entitySettings1);
  await settingsService.delete(entitySettings2);
  await settingsService.delete(basicCompanySettings.itemId);
  await settingsService.delete(basicSettingsCompany2.itemId);

  // AWSMock.restore('SQS');
  // await settingsService.delete(savedReportWithScheduler1.itemId)
  // await settingsService.delete(savedReportWithScheduler2.itemId)
  // await settingsService.delete(savedReportWithoutScheduler.itemId)
});
