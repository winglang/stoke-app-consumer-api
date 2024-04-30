/* eslint-disable max-lines */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-extra-parens */
/* eslint-disable no-shadow */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */

'use strict';

const dayjs = require('dayjs');
const _ = require('lodash');
const jestPlugin = require('serverless-jest-plugin');
const mod = require('../src/purchaseOrders/poList');
const AWS = require('aws-sdk');
const { UsersService, POService, BudgetsService, JobsService, CompaniesService, SettingsService, CompanyProvidersService, constants } = require('stoke-app-common-api');
const csvLib = require('stoke-app-common-api/lib/csvLib');

const s3 = new AWS.S3({});
const poService = new POService(process.env.budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, [...constants.projectionExpression.defaultAttributes, 'poItemId'], constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const { mandatoryHeaders, exportHeader, billingExportHeaders } = require('../src/purchaseOrders/constants');

const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const testName = 'PO-LIST';
const companyId = `${testName}-COMP-1`;
const anotherCompany = `${testName}-anotherComp`;
const entityId = `${testName}-ENTITY-1`;
const userId1 = `${testName}-ADMIN`;
const userId2 = `${testName}-USER-1`;
const poId1 = `${constants.prefix.po}${testName}-1`;
const poId2 = `${constants.prefix.po}${testName}-2`;
const poId3 = `${constants.prefix.po}${testName}-3`;
const poId4 = `${constants.prefix.po}${testName}-4`;
const poId5 = `${constants.prefix.po}${testName}-5`;
const blanketId = `${constants.prefix.po}${testName}-BLNKT-1`;
const lineItemId1 = `${blanketId}_LI-1`;
const lineItemId2 = `${blanketId}_LI-2`;
const talentId1 = `${constants.prefix.talent}${testName}-TALENT-ID-1`;

const entityAdmin = {
  userId: userId2,
  entityId: entityId,
  companyId: companyId,
  createdBy: userId2,
  modifiedBy: userId2,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const companySettings = {
  itemId: `${constants.prefix.company}${companyId}`,
  itemData: {
    isVatIncluded: true
  }
};

const companySettingsVatExcluded = {
  ...companySettings,
  itemData: {}
};

const companyAdmin = {
  userId: userId1,
  entityId: companyId,
  companyId,
  createdBy: userId1,
  modifiedBy: userId1,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
}

const poWithTalentScopeProps = {
  itemId: poId5,
  companyId: companyId,
  createdBy: companyAdmin.userId,
  poScope: {
      scopeIds: [talentId1],
      scopeType: constants.poScopeTypes.talents,
      poTypes: [constants.poTypes.talentService],
    },
  address: {
    city: "33",
    country: "COUNTRY",
    postalCode: "123-PC",
    state: "CA",
    street: "streed address"
    },
  amount: 99.999,
  validFrom: 2,
  validTo: 200,
  poNumber: poId5,
}

const poWithDepartmentScopeProps = {
  itemId: poId1,
  companyId: companyId,
  createdBy: companyAdmin.userId,
  poScope: {
      scopeIds: [entityId],
      scopeType: constants.poScopeTypes.departments,
      poTypes: [constants.poTypes.talentService],
    },
  address: {
    city: "33",
    country: "COUNTRY",
    postalCode: "123-PC",
    state: "CA",
    street: "streed address"
    },
  amount: 99.999,
  validFrom: 2,
  validTo: 200,
  poNumber: poId1,
}

const poDedicatedForFees = {
  itemId: poId2,
  companyId: companyId,
  createdBy: companyAdmin.userId,
  poScope: {
      scopeIds: [companyId],
      scopeType: constants.poScopeTypes.company,
      poTypes: [constants.poTypes.feesAndAdjustments],
    },
  amount: 0,
  validFrom: 2,
  validTo: 200,
  poNumber: poId2,
}

const poForWorkAndFees = {
  itemId: poId3,
  companyId: companyId,
  createdBy: companyAdmin.userId,
  poScope: {
      scopeIds: [entityId],
      scopeType: constants.poScopeTypes.departments,
      poTypes: [constants.poTypes.feesAndAdjustments],
    },
  amount: 0,
  validFrom: 2,
  validTo: 200,
  poNumber: poId3,
}

const poDedicatedForFeesAndAdjustments = {
  itemId: poId4,
  companyId: companyId,
  createdBy: companyAdmin.userId,
  poScope: {
      scopeIds: [companyId],
      scopeType: constants.poScopeTypes.company,
      poTypes: [constants.poTypes.feesAndAdjustments],
    },
  amount: 100,
  validFrom: 2,
  validTo: 200,
  poNumber: poId4,
}

const blanketPO = {
  itemId: blanketId,
  companyId,
  createdBy: testName,
  amount: 400,
  poScope: {},
  isBlanketPO: true,
  poNumber: blanketId,
}

const lineItem1 = {
  itemId: lineItemId1,
  companyId,
  createdBy: testName,
  amount: 200,
  poScope: {
    scopeIds: [entityId],
    scopeType: constants.poScopeTypes.departments,
    poTypes: [constants.poTypes.feesAndAdjustments, constants.poTypes.talentService],
  },
  poNumber: lineItemId1,
}

const lineItem2 = {
  itemId: lineItemId2,
  companyId,
  createdBy: testName,
  amount: 100,
  poScope: {
    scopeIds: [companyId],
    scopeType: constants.poScopeTypes.company,
    poTypes: [constants.poTypes.talentService],
  },
  poNumber: lineItemId2,
}

const poInAnotherCompanyProps = {
  itemId: poId2,
  companyId: anotherCompany,
  createdBy: testName,
  poScope: {
      scopeIds: [entityId],
      scopeType: constants.poScopeTypes.departments,
      poTypes: [constants.poTypes.talentService],
    },
  amount: 0,
  validFrom: 2,
  validTo: 200,
  poNumber: poId2,
}

const event = (user, exportToCsv, billingId, activeFilters) => ({
  requestContext: {
    identity: {
      cognitoIdentityId: user
    }
  },
  pathParameters: {
    companyId,
  },
  ...(exportToCsv || billingId || activeFilters
    ? { body: JSON.stringify({ exportToCsv: exportToCsv, billingId, activeFilters }) }
    : {}
  )
});

const eventForPoBreakdown = (user, poItemId) => ({
  requestContext: {
    identity: {
      cognitoIdentityId: user
    }
  },
  pathParameters: {
    companyId,
  },
  body: JSON.stringify({ poItemId })
});

const budget = {
  itemId: `${constants.prefix.entity}${entityId}`,
  entityId,
  companyId,
  userId: entityAdmin.userId,
  itemData: {
  }
}
const companyBalance = {
  itemId: `${constants.prefix.company}${companyId}`,
  companyId,
  itemData: {},
  itemPrivateData: {
      balances: [
          {
              currency: 'USD',
              rows: [
                {
                  allFees: 10,
                  amount: 0,
                  balance: 0,
                  depositFeeData: {
                      depositIds: [1655078400000],
                      depositAmount: { 1655078400000: 5 }
                  },
                  dateTime: Date.now(),
                  dateTimeString: "2022-07-13T00:00:00.000Z",
                  description: "Billing - test",
                  externalId: 'billing_2',
                  posInfo: [{ poItemId: poId3, amount: 100 }]
                },
                {
                    allFees: 10,
                    amount: 0,
                    balance: 0,
                    depositFeeData: {
                        depositIds: [1655078400000],
                        depositAmount: { 1655078400000: 5 }
                    },
                    dateTime: Date.now(),
                    dateTimeString: "2022-06-13T00:00:00.000Z",
                    description: "Billing - test",
                    externalId: 'billing_1',
                    posInfo: [{ poItemId: poId3, amount: 50 }]
                },
                {
                    allFees: 5,
                    amount: 0,
                    balance: 0,
                    depositFeeData: {
                        depositIds: [1655078400000],
                        depositAmount: { 1655078400000: 5 }
                    },
                    dateTimeString: "2022-06-13T00:00:00.000Z",
                    description: "Billing - test 2",
                    externalId: 'vat_2',
                    posInfo: [{ poItemId: poId3, amount: -50 }]
                },
                {
                  allFees: 5,
                  amount: 0,
                  balance: 0,
                  depositFeeData: {
                      depositIds: [1655078400000],
                      depositAmount: { 1655078400000: 5 }
                  },
                  dateTimeString: "2022-06-13T00:00:00.000Z",
                  description: "Billing - po breakdown page",
                  externalId: 'vat_2',
                  posInfo: [{ poItemId: poId4, amount: 50 }]
              }
              ]
          },
      ]
  },
  itemStatus: constants.user.status.active,
  createdBy: userId1,
  modifiedBy: userId1,
}

const entityItem = {
  itemId: `${constants.prefix.entity}${entityId}`,
  companyId,
  createdBy: userId1,
  modifiedBy: userId1,
  itemData: {
    entityName: "WorkspaceName"
  },
  itemStatus: "active",
  modifiedAt: 1594192932881,
}

const milestoneKeysToDelete = [];

const providerData = {
  taxInfo: {
    subTotal: 50,
    tax: 50,
    total: 100
  }
 }

const generateMilestone = (msId, jobId, poItemId, costAttributes = {}) => {
  const itemId = `${constants.prefix.milestone}${constants.prefix.job}${testName}${jobId}_${msId}`;
  milestoneKeysToDelete.push({ itemId, entityId });
  return {
    itemId,
    entityId,
    companyId,
    itemData: {
      ...costAttributes,
      providerData,
    },
    itemStatus: constants.job.status.active,
    poItemId,
  }
};

const job1 = {
  itemId: `${constants.prefix.job}${testName}JOB1`,
  entityId,
  companyId,
  itemData: {
    providerData,
    talentId: talentId1,
    jobTitle: 'breakdown job',
  },
  itemStatus: constants.job.status.active,
}

const compTalent1 = {
  itemId: talentId1,
  companyId,
  itemStatus: constants.companyProvider.status.active,
  itemData: {
    name: 'Lenny Kravitz',
  }
};

const getRowsDataFromUrl = async (url, headers) => {
  const decodedUrl = decodeURIComponent(url)
  // eslint-disable-next-line prefer-named-capture-group
  const key = decodedUrl.match(/(?<=.com[/])(.*?)(.csv)/)[0]
  const s3Object = await s3.getObject({ Bucket: process.env.jobsBucketName, Key: key }).promise();
  const fileData = s3Object.Body.toString("utf-8");
  const rows = csvLib.csvToObjects(fileData, headers);
  return rows
}
const creationDate = dayjs(new Date().getTime()).format('DD-MM-YYYY')

const tableViewTest1 = [
{
  mainPONumber: 'po_PO-LIST-5',
  lineItemNumber: '',
  workspaces: '',
  usage: 'Talent payments',
  available: '100',
  used: '0',
  total: '100',
  expirationDate: '01-01-1970',
  creationDate,
  description: '',
  address: 'streed address, 33, CA, 123-PC, COUNTRY'
},
{
  mainPONumber: 'po_PO-LIST-1',
  lineItemNumber: '',
  workspaces: 'WorkspaceName',
  usage: 'Talent payments',
  available: '100',
  used: '100',
  total: '100',
  expirationDate: '01-01-1970',
  creationDate,
  description: '',
  address: 'streed address, 33, CA, 123-PC, COUNTRY'
},
{
  mainPONumber: 'po_PO-LIST-3',
  lineItemNumber: '',
  workspaces: 'WorkspaceName',
  usage: 'Fees',
  available: '0',
  used: '150',
  total: '0',
  expirationDate: '01-01-1970',
  creationDate,
  description: '',
  address: ''
},
{
  mainPONumber: 'po_PO-LIST-2',
  lineItemNumber: '',
  workspaces: 'All Workspaces',
  usage: 'Fees',
  available: '0',
  used: '200',
  total: '0',
  expirationDate: '01-01-1970',
  creationDate,
  description: '',
  address: ''
},
{
  mainPONumber: 'po_PO-LIST-BLNKT-1',
  lineItemNumber: '',
  workspaces: '',
  usage: '',
  available: '0',
  used: '0',
  total: '400',
  expirationDate: '',
  creationDate,
  description: '',
  address: ''
}
];

const tableViewTest1Billing = [
{
  mainPONumber: 'po_PO-LIST-1',
  lineItemNumber: '',
  workspaces: 'WorkspaceName',
  usage: 'Talent payments',
  used: '100',
  expirationDate: '01-01-1970',
  creationDate,
  description: '',
  address: 'streed address, 33, CA, 123-PC, COUNTRY',
  closedBy: '',
},
{
  mainPONumber: 'po_PO-LIST-3',
  lineItemNumber: '',
  workspaces: 'WorkspaceName',
  usage: 'Fees',
  used: '50',
  expirationDate: '01-01-1970',
  creationDate,
  description: '',
  address: '',
  closedBy: '',
}
];

const tableViewTest2 = [
  {
    mainPONumber: 'po_PO-LIST-5',
    lineItemNumber: '',
    scopeType: 'Talent',
    talents: 'Lenny Kravitz',
    workspaces: '',
    usage: 'Talent payments',
    available: '100',
    used: '0',
    total: '100',
    startDate: '01-01-1970',
    expirationDate: '01-01-1970',
    creationDate,
    description: '',
    address: 'streed address, 33, CA, 123-PC, COUNTRY',
    poStatus: 'Closed',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-1',
    lineItemNumber: '',
    scopeType: 'Workspace(s)',
    talents: '',
    workspaces: 'WorkspaceName',
    usage: 'Talent payments',
    available: '100',
    used: '100',
    total: '100',
    startDate: '01-01-1970',
    expirationDate: '01-01-1970',
    creationDate,
    description: '',
    address: 'streed address, 33, CA, 123-PC, COUNTRY',
    poStatus: 'Closed',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-3',
    lineItemNumber: '',
    scopeType: 'Workspace(s)',
    talents: '',
    workspaces: 'WorkspaceName',
    usage: 'Fees',
    available: '0',
    used: '150',
    total: '0',
    startDate: '01-01-1970',
    expirationDate: '01-01-1970',
    creationDate,
    description: '',
    address: '',
    poStatus: 'Closed',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-BLNKT-1',
    lineItemNumber: 'po_PO-LIST-BLNKT-1_LI-1',
    scopeType: 'Workspace(s)',
    talents: '',
    workspaces: 'WorkspaceName',
    usage: 'Fees, Talent payments',
    available: '200',
    used: '100',
    total: '200',
    startDate: '',
    expirationDate: '',
    creationDate,
    description: '',
    address: '',
    poStatus: 'Active',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-2',
    lineItemNumber: '',
    scopeType: 'Company',
    talents: '',
    workspaces: 'All Workspaces',
    usage: 'Fees',
    available: '0',
    used: '200',
    total: '0',
    startDate: '01-01-1970',
    expirationDate: '01-01-1970',
    creationDate,
    description: '',
    address: '',
    poStatus: 'Closed',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-4',
    lineItemNumber: '',
    scopeType: 'Company',
    talents: '',
    workspaces: 'All Workspaces',
    usage: 'Fees',
    available: '100',
    used: '50',
    total: '100',
    startDate: '01-01-1970',
    expirationDate: '01-01-1970',
    creationDate,
    description: '',
    address: '',
    poStatus: 'Closed',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-BLNKT-1',
    lineItemNumber: 'po_PO-LIST-BLNKT-1_LI-2',
    scopeType: 'Company',
    talents: '',
    workspaces: 'All Workspaces',
    usage: 'Talent payments',
    available: '100',
    used: '0',
    total: '100',
    startDate: '',
    expirationDate: '',
    creationDate,
    description: '',
    address: '',
    poStatus: 'Active',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-BLNKT-1',
    lineItemNumber: '',
    scopeType: '',
    talents: '',
    workspaces: 'WorkspaceName',
    usage: 'Fees, Talent payments',
    available: '300',
    used: '100',
    total: '400',
    startDate: '',
    expirationDate: '',
    creationDate,
    description: '',
    address: '',
    poStatus: 'Active',
    closedBy: '',
  }
]

const tableViewTest3 = [
  {
    mainPONumber: 'po_PO-LIST-5',
    lineItemNumber: '',
    scopeType: 'Talent',
    talents: 'Lenny Kravitz',
    workspaces: '',
    usage: 'Talent payments',
    available: '100',
    used: '0',
    total: '100',
    startDate: '01-01-1970',
    expirationDate: '01-01-1970',
    creationDate,
    description: '',
    address: 'streed address, 33, CA, 123-PC, COUNTRY',
    poStatus: 'Closed',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-1',
    lineItemNumber: '',
    scopeType: 'Workspace(s)',
    talents: '',
    workspaces: 'WorkspaceName',
    usage: 'Talent payments',
    available: '100',
    used: '50',
    total: '100',
    startDate: '01-01-1970',
    expirationDate: '01-01-1970',
    creationDate,
    description: '',
    address: 'streed address, 33, CA, 123-PC, COUNTRY',
    poStatus: 'Closed',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-3',
    lineItemNumber: '',
    scopeType: 'Workspace(s)',
    talents: '',
    workspaces: 'WorkspaceName',
    usage: 'Fees',
    available: '0',
    used: '150',
    total: '0',
    startDate: '01-01-1970',
    expirationDate: '01-01-1970',
    creationDate,
    description: '',
    address: '',
    poStatus: 'Closed',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-BLNKT-1',
    lineItemNumber: 'po_PO-LIST-BLNKT-1_LI-1',
    scopeType: 'Workspace(s)',
    talents: '',
    workspaces: 'WorkspaceName',
    usage: 'Fees, Talent payments',
    available: '200',
    used: '50',
    total: '200',
    startDate: '',
    expirationDate: '',
    creationDate,
    description: '',
    address: '',
    poStatus: 'Active',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-2',
    lineItemNumber: '',
    scopeType: 'Company',
    talents: '',
    workspaces: 'All Workspaces',
    usage: 'Fees',
    available: '0',
    used: '100',
    total: '0',
    startDate: '01-01-1970',
    expirationDate: '01-01-1970',
    creationDate,
    description: '',
    address: '',
    poStatus: 'Closed',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-4',
    lineItemNumber: '',
    scopeType: 'Company',
    talents: '',
    workspaces: 'All Workspaces',
    usage: 'Fees',
    available: '100',
    used: '50',
    total: '100',
    startDate: '01-01-1970',
    expirationDate: '01-01-1970',
    creationDate,
    description: '',
    address: '',
    poStatus: 'Closed',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-BLNKT-1',
    lineItemNumber: 'po_PO-LIST-BLNKT-1_LI-2',
    scopeType: 'Company',
    talents: '',
    workspaces: 'All Workspaces',
    usage: 'Talent payments',
    available: '100',
    used: '0',
    total: '100',
    startDate: '',
    expirationDate: '',
    creationDate,
    description: '',
    address: '',
    poStatus: 'Active',
    closedBy: '',
  },
  {
    mainPONumber: 'po_PO-LIST-BLNKT-1',
    lineItemNumber: '',
    scopeType: '',
    talents: '',
    workspaces: 'WorkspaceName',
    usage: 'Fees, Talent payments',
    available: '300',
    used: '50',
    total: '400',
    startDate: '',
    expirationDate: '',
    creationDate,
    description: '',
    address: '',
    poStatus: 'Active',
    closedBy: '',
  },
]

const validateResult = (results, expectedResult) => _.every(results, (result, index) => {
  const row = _.get(expectedResult, [index])
  return _.every(result, (value, key) => _.get(row, [key]) === value)
})

describe('poList', () => {
  beforeAll(async () => {
    await usersService.create(companyAdmin);
    await companiesService.create(entityItem);
    await companiesService.create(companyBalance);
    await settingsService.create(companySettings);
    await poService.create(poWithDepartmentScopeProps);
    await poService.create(poInAnotherCompanyProps);
    await poService.create(poDedicatedForFees);
    await poService.create(poForWorkAndFees);
    await poService.create(blanketPO);
    await poService.create(poWithTalentScopeProps);
    await poService.create(poDedicatedForFeesAndAdjustments);
    await budgetsService.create(budget);
    await jobsService.create(generateMilestone('MS1','JOB1', poId1, { actualCost: 100, billingId: '1' }));
    await jobsService.create(generateMilestone('MS2', 'JOB1', poId2, { cost: 100 }));
    await jobsService.create(generateMilestone('MS3', 'JOB1', poId2, { actualCost: 100, actualRequestCost: 50 }));
    await jobsService.create(generateMilestone('MS4', 'JOB1', lineItemId1, { actualCost: 100, actualRequestCost: 50 }));
    await jobsService.create(job1);
    await companyProvidersService.create(compTalent1);
  });

  it('List PO breakdown(with talentService poType), expect 200', async () => {
    let response = await wrapped.run(eventForPoBreakdown(userId1, poId1));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    expect(response.poData.itemId).toBe("po_PO-LIST-1");
    expect(response.poData.companyId).toBe("PO-LIST-COMP-1");
    expect(response.poData.itemData).toMatchObject({
        totalAmount: 99.999,
        poScope: {
          poTypes: ["talentService"],
          scopeType: constants.poScopeTypes.departments,
          scopeIds: ["PO-LIST-ENTITY-1"]
        },
        address: {country: "COUNTRY" ,state: "CA", city: "33",street: "streed address", postalCode: "123-PC" },
        poNumber: "po_PO-LIST-1"
    })
    expect(response.poData.available).toBe(99.999);
    expect(response.poData.validFrom).toBe(2);
    expect(response.poData.validTo).toBe(200);
    expect(response.poUsageBreakdown).toMatchObject(
      [
        {
          milestoneName:"",
          jobTitle: "breakdown job",
          itemNumber: null,
          talent: "Lenny Kravitz",
          hiringManager:" ",
          workspaces: "WorkspaceName",
          amount: 100
        }
      ])
  })

  it('List PO breakdown(with feesAndAdjustments poType), expect 200', async() => {
    let response = await wrapped.run(eventForPoBreakdown(companyAdmin.userId, poId4));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    expect(response.poData.itemId).toBe("po_PO-LIST-4");
    expect(response.poData.companyId).toBe("PO-LIST-COMP-1");
    expect(response.poData.itemData).toMatchObject({
        totalAmount: 100,
        poScope: {
          poTypes: ["feesAndAdjustments"],
          scopeType: constants.poScopeTypes.company,
          scopeIds: ["PO-LIST-COMP-1"]
        },
        poNumber: "po_PO-LIST-4"
    })
    expect(response.poData.available).toBe(100);
    expect(response.poData.validFrom).toBe(2);
    expect(response.poData.validTo).toBe(200);
    expect(response.poUsageBreakdown).toMatchObject(
      [
        {
          amount: 50,
          billing: 'Billing - po breakdown page',
          itemNumber: null,
        }
      ])
  })

  it('List POs for company, expect 200, data', async () => {
    let response = await wrapped.run(event(userId1));
    expect(response.statusCode).toBe(200);
    response = JSON.parse(response.body);
    expect(response.rows.length).toBe(6);
    expect(response.rows[0].itemId).toBe(poId5);
    expect(response.rows[0].available).toBe(99.999);
    expect(response.rows[0].companyId).toBe(companyId);
    expect(response.rows[0].poNumber).toBe(poWithTalentScopeProps.poNumber);
    expect(response.rows[0].expirationDate).toBe(poWithTalentScopeProps.validTo);
    expect(response.rows[0].startDate).toBe(poWithTalentScopeProps.validFrom);
    expect(response.rows[0].scopeIds).toMatchObject(poWithTalentScopeProps.poScope.scopeIds);
    expect(response.rows[0].scopeType).toBe(poWithTalentScopeProps.poScope.scopeType);
    expect(response.rows[0].originalAmount).toBe(poWithTalentScopeProps.amount);
    expect(response.rows[0].usageType[0]).toBe('talentService');
    expect(response.rows[0].used).toBe(0);
    expect(validateResult([response.rows[0]].tableValues, [tableViewTest1[0]])).toBeTruthy();

    expect(response.rows[1].itemId).toBe(poId1);
    expect(response.rows[1].available).toBe(99.999);
    expect(response.rows[1].companyId).toBe(companyId);
    expect(response.rows[1].poNumber).toBe(poWithDepartmentScopeProps.poNumber);
    expect(response.rows[1].expirationDate).toBe(poWithDepartmentScopeProps.validTo);
    expect(response.rows[1].startDate).toBe(poWithDepartmentScopeProps.validFrom);
    expect(response.rows[1].scopeIds).toMatchObject(poWithDepartmentScopeProps.poScope.scopeIds);
    expect(response.rows[1].scopeType).toBe(poWithDepartmentScopeProps.poScope.scopeType);
    expect(response.rows[1].originalAmount).toBe(poWithDepartmentScopeProps.amount);
    expect(response.rows[1].usageType[0]).toBe('talentService');
    expect(response.rows[1].used).toBe(100);
    expect(validateResult([response.rows[1]].tableValues, [tableViewTest1[1]])).toBeTruthy();

    expect(response.rows[2].itemId).toBe(poId3);
    expect(response.rows[2].available).toBe(0);
    expect(response.rows[2].companyId).toBe(companyId);
    expect(response.rows[2].poNumber).toBe(poForWorkAndFees.poNumber);
    expect(response.rows[2].expirationDate).toBe(poForWorkAndFees.validTo);
    expect(response.rows[2].startDate).toBe(poForWorkAndFees.validFrom);
    expect(response.rows[2].scopeIds).toMatchObject(poForWorkAndFees.poScope.scopeIds);
    expect(response.rows[2].scopeType).toBe(poForWorkAndFees.poScope.scopeType);
    expect(response.rows[2].originalAmount).toBe(poForWorkAndFees.amount);
    expect(response.rows[2].usageType[0]).toBe('fees');
    expect(response.rows[2].used).toBe(150);
    expect(validateResult([response.rows[2]].tableValues, [tableViewTest1[2]])).toBeTruthy();

    expect(response.rows[3].itemId).toBe(poId2);
    expect(response.rows[3].available).toBe(0);
    expect(response.rows[3].companyId).toBe(companyId);
    expect(response.rows[3].poNumber).toBe(poDedicatedForFees.poNumber);
    expect(response.rows[3].expirationDate).toBe(poDedicatedForFees.validTo);
    expect(response.rows[3].startDate).toBe(poDedicatedForFees.validFrom);
    expect(response.rows[3].scopeIds).toMatchObject([companyId]);
    expect(response.rows[3].scopeType).toBe(constants.poScopeTypes.company);
    expect(response.rows[3].originalAmount).toBe(poDedicatedForFees.amount);
    expect(response.rows[3].usageType[0]).toBe('fees');
    expect(response.rows[3].used).toBe(200);
    expect(validateResult([response.rows[3]].tableValues, [tableViewTest1[3]])).toBeTruthy();

    expect(validateResult([response.rows[4]].tableValues, [tableViewTest1[4]])).toBeTruthy();
    expect(response.billingFilterOptions).toMatchObject([
      { title: 'Billing - test', billingId: '2' },
      { title: 'Billing - test', billingId: '1' }
    ])

    // eslint-disable-next-line no-undefined
    response = await wrapped.run(event(userId1, undefined, '1'));
    response = JSON.parse(response.body);
    expect(validateResult([response.rows[0].tableValues], [tableViewTest1Billing[0]]));
    expect(validateResult([response.rows[1].tableValues], [tableViewTest1Billing[1]]));
    
    // eslint-disable-next-line no-undefined
    response = await wrapped.run(event(userId1, undefined, undefined, { scopeIds: [entityId] }));
    response = JSON.parse(response.body);
    expect(response.rows[0].scopeIds).toMatchObject([entityId])
    expect(response.rows[1].scopeIds).toMatchObject([entityId])
    expect(response.rows[2].scopeIds).toMatchObject([companyId])

    // eslint-disable-next-line no-undefined
    response = await wrapped.run(event(userId1, undefined, undefined, { scopeIds: [talentId1] }));
    response = JSON.parse(response.body);
    expect(response.rows[0].scopeIds).toMatchObject([talentId1])
    
    response = await wrapped.run(event(userId1, true, '1'));
    let exportRows = await getRowsDataFromUrl(response.body, Object.values({ ...mandatoryHeaders, ...billingExportHeaders }));
    expect(validateResult(exportRows, tableViewTest1Billing)).toBeTruthy();

    await poService.create(lineItem1);
    await poService.create(lineItem2);
    response = await wrapped.run(event(userId1));
    response = JSON.parse(response.body);

    expect(validateResult([response.rows[3]].tableValues, [tableViewTest2[3]])).toBeTruthy();
    expect(validateResult([response.rows[4]].tableValues, [tableViewTest2[4]])).toBeTruthy();
    expect(validateResult([response.rows[5]].tableValues, [tableViewTest2[5]])).toBeTruthy();

    response = await wrapped.run(event(userId1, true));
    exportRows = await getRowsDataFromUrl(response.body, Object.values({ ...mandatoryHeaders, ...exportHeader }));
    expect(validateResult(exportRows, tableViewTest2)).toBeTruthy();

    await settingsService.create(companySettingsVatExcluded);
    response = await wrapped.run(event(userId1));
    response = JSON.parse(response.body);
    expect(response.rows[0].used).toBe(0);
    expect(validateResult([exportRows[0].tableValues], [tableViewTest3[0]]))

    expect(response.rows[1].used).toBe(50);
    expect(validateResult([exportRows[1].tableValues], [tableViewTest3[1]]))

    expect(response.rows[1].used).toBe(50);
    expect(validateResult([exportRows[2].tableValues], [tableViewTest3[2]]))

    expect(response.rows[2].used).toBe(150);
    expect(validateResult([exportRows[3].tableValues], [tableViewTest3[3]]))
    response = await wrapped.run(event(userId1, true));
    exportRows = await getRowsDataFromUrl(response.body, Object.values({ ...mandatoryHeaders, ...exportHeader }));
    expect(validateResult(exportRows, tableViewTest3)).toBeTruthy();
  });

  afterAll(async () => {
    await poService.delete(companyId, poWithDepartmentScopeProps.itemId);
    await poService.delete(companyId, poWithTalentScopeProps.itemId);
    await poService.delete(anotherCompany, poInAnotherCompanyProps.itemId);
    await poService.delete(companyId, poDedicatedForFees.itemId);
    await poService.delete(companyId, poForWorkAndFees.itemId);
    await poService.delete(companyId, blanketPO.itemId);
    await poService.delete(companyId, lineItem1.itemId);
    await poService.delete(companyId, lineItem2.itemId);
    await poService.delete(companyId, poDedicatedForFeesAndAdjustments.itemId);
    await budgetsService.delete(budget.entityId, budget.itemId);
    await usersService.delete(companyAdmin.userId, companyAdmin.companyId);
    await companiesService.delete(entityItem.itemId);
    await companiesService.delete(companyBalance.itemId);
    await settingsService.delete(companySettings.itemId);
    await jobsService.delete(job1.entityId, job1.itemId);
    await companyProvidersService.delete(companyId, compTalent1.itemId);
    for (const milestone of milestoneKeysToDelete) {
      // eslint-disable-next-line no-await-in-loop
      await jobsService.delete(milestone.entityId, milestone.itemId);
    }
  });

});
