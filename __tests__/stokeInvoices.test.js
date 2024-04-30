const mod = require("../src/stokeInvoices");
const { constants, UsersService, permisionConstants } = require("stoke-app-common-api");
const AWS = require("aws-sdk");
const s3 = new AWS.S3({});
const usersService = new UsersService(
  process.env.consumerAuthTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);

const jestPlugin = require("serverless-jest-plugin");
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: "handler" });

const entityId = "GET-STOK-INVOICES-TEST-ENT-ID-1";
const companyId = "GET-STOK-INVOICES-TEST-COMP-ID-1";
const userId = "GET-STOK-INVOICES-TEST-USER-ID-1";
const talentId = "provider_GET-STOK-INVOICES-TEST-TALENT-ID-1";
const jobId1 = "job_-GET-STOK-INVOICES-job-1";
const milestoneId1 = `ms_${jobId1}_ms1`;
const milestoneId2 = `ms_${jobId1}_ms2`;

const jsonFileContent1 = {
  from: "2019-12-25",
  to: "2020-01-24",
  billingId: "2020-01-24-2020-01-24",
  name: "2020_00",
  title: "Spetember",
  body: [
    {
      milestoneId: milestoneId2,
      jobId: jobId1,
      hiringManagerId: userId,
      entityId,
      providerId: talentId,
      jobTitle: "job title",
      milestoneTitle: "title 2",
      amount: 50,
      milestoneStatus: "Completed",
      files: [],
    },
    {
      milestoneId: milestoneId1,
      jobId: jobId1,
      hiringManagerId: userId,
      entityId,
      providerId: talentId,
      jobTitle: "job title",
      milestoneTitle: "title 1",
      amount: 50,
      milestoneStatus: "Completed",
      files: [],
    },
  ],
};

const event = {
  requestContext: {
    identity: {
      cognitoIdentityId: userId,
    },
  },
  queryStringParameters: {
    companyId,
    billingId: "2020-01-24-2020-01-24",
  },
};

const eventNotAuth = {
  requestContext: {
    identity: {
      cognitoIdentityId: "userId",
    },
  },
  queryStringParameters: {
    companyId,
    billingId: jsonFileContent1.billingId,
  },
};

const userEntityAdmin = {
  userId,
  entityId: companyId,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    permissionsComponents: { [permisionConstants.permissionsComponentsKeys.jobs]: {} }
  },
};

describe("stokeInvoices", () => {
  beforeEach(async () => {
    let response = await usersService.create(userEntityAdmin);
    expect(response).toEqual(userEntityAdmin);
    const params = {
      Bucket: process.env.jobsBucketName,
      Key: `${process.env.billingFolderName}/${companyId}/${jsonFileContent1.billingId}.json`,
      Body: JSON.stringify(jsonFileContent1),
    };
    await s3.putObject(params).promise();
    let pdfParams = {
      Bucket: process.env.jobsBucketName,
      Key: `${process.env.invoicesFolderName}/${companyId}/stoke.pdf`,
      Body: JSON.stringify('file'),
    };
    await s3.putObject(pdfParams).promise();
    pdfParams = {
      Bucket: process.env.jobsBucketName,
      Key: `${process.env.invoicesFolderName}/${companyId}/stokeFee.pdf`,
      Body: JSON.stringify('file'),
    };
    await s3.putObject(pdfParams).promise();
    await s3
      .putObjectTagging({
        Bucket: process.env.jobsBucketName,
        Key: params.Key,
        Tagging: {
          TagSet: [
            {
              Key: constants.invoices.stokeFeeInvoicePath,
              Value: `${process.env.invoicesFolderName}/${companyId}/stoke.pdf`,
            },
            {
              Key: constants.invoices.stokeInvoicePath,
              Value: `${process.env.invoicesFolderName}/${companyId}/stokeFee.pdf`,
            },
          ],
        },
      })
      .promise();
  });

  it("stokeInvoices, expect 200, data", async () => {
    let response = await wrapped.run(event);
    expect(response.statusCode).toBe(200);
    let body = JSON.parse(response.body);
    expect(body.url).not.toBeNull();
  });

  it("stokeInvoices, expect 403", async () => {
    let response = await wrapped.run(eventNotAuth);
    expect(response.statusCode).toBe(403);
  });

  afterAll(async () => {
    await usersService.delete(userId, entityId);
  });
});
