/* eslint-disable no-undef */
/* eslint-disable max-lines-per-function */
"use strict";

const AWS = require('aws-sdk');
const s3 = new AWS.S3({});
const { s3lib } = require('stoke-s3lib');
const rp = require('request-promise-native');
const unzipper = require('unzipper');
const invoices = require("../src/invoices");
const { UsersService, JobsService, LedgerService, constants, permisionConstants } = require("stoke-app-common-api");
const jestPlugin = require("serverless-jest-plugin");

const { consumerAuthTableName, jobsTableName, ledgerTableName } = process.env;

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const ledgerService = new LedgerService(ledgerTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const getInvoices = jestPlugin.lambdaWrapper.wrap(invoices, { handler: "getInvoices" });

const companyAdminUserId = 'JEST-GET-INVOICES-COMP-ADMIN-USER';
const companyId = 'JEST-GET-INVOICES-COMPANY';
const entity1Id = 'JEST-GET-INVOICES-ENTITY-1';
const entity2Id = 'JEST-GET-INVOICES-ENTITY-2';
const entity3Id = 'JEST-GET-INVOICES-ENTITY-3';
const bucket = "dev-fe-api-jobs";

const companyAdminCompanyUser = {
  userId: companyAdminUserId,
  entityId: companyId,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    permissionsComponents: { [permisionConstants.permissionsComponentsKeys.jobs]: {} }
  }
};

const companyAdminEntity1User = {
  userId: companyAdminUserId,
  entityId: entity1Id,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const companyAdminEntity2User = {
  userId: companyAdminUserId,
  entityId: entity2Id,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const companyAdminEntity3User = {
  userId: companyAdminUserId,
  entityId: entity3Id,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const entity1AdminUser = {
  userId: 'JEST-GET-INVOICES-ENT-1-ADMIN-USER',
  entityId: entity1Id,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const entity1User1 = {
  userId: 'JEST-GET-INVOICES-ENT-1-USER-1',
  entityId: entity1Id,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user
  }
};

const entity1User2 = {
  userId: 'JEST-GET-INVOICES-ENT-1-USER-2',
  entityId: entity1Id,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user
  }
};

const entity2AdminUser = {
  userId: 'JEST-GET-INVOICES-ENT-2-ADMIN-USER',
  entityId: entity2Id,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin
  }
};

const entity2User = {
  userId: 'JEST-GET-INVOICES-ENT-2-USER',
  entityId: entity2Id,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user
  }
};

const companyUser1 = {
  userId: 'JEST-GET-INVOICES-COMP-USER-1',
  entityId: companyId,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user
  }
};

const companyUser2 = {
  userId: 'JEST-GET-INVOICES-COMP-USER-2',
  entityId: companyId,
  companyId,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user
  }
};

const mlstn1 = {
  entityId: entity1Id,
  itemId: 'JEST-GET-INVOICES-MLSTN-1',
  userId: entity1User1.userId,
  itemStatus: constants.job.status.pendingApproval,
  itemData: {
    files: [
      {
        isInvoice: true,
        "name": "mlstn1_invoice.pdf",
        "key": "mlstn1_invoice.pdf"
      }, 
      {
        isProForma: true,
        "name": "mlstn1_proinvoice.pdf",
        "key": "mlstn1_proinvoice.pdf"
      },
      {
        autoTalentInvoice: true,
        "name": "mlstn1_autoinvoice.pdf",
        "key": "mlstn1_autoinvoice.pdf"
      }
    ],
  }
};

const mlstn2 = {
  entityId: entity2Id,
  itemId: 'JEST-GET-INVOICES-MLSTN-2',
  userId: entity2User.userId,
  itemStatus: constants.job.status.pendingApproval,
  itemData: {
    files: [
      {
        "name": "mlstn2_invoice.pdf",
        "key": "mlstn2_invoice.pdf"
      },
    ],
  }
};

const mlstn3 = {
  entityId: companyId,
  itemId: 'JEST-GET-INVOICES-MLSTN-3',
  userId: companyUser1.userId,
  itemStatus: constants.job.status.pendingApproval,
  itemData: {
    files: [
      {
        isInvoice: true,
        "name": "mlstn3_invoice.pdf",
        "key": "mlstn3_invoice.pdf"
      }
    ],
  }
};

const mlstn4 = {
  entityId: entity1Id,
  itemId: 'JEST-GET-INVOICES-MLSTN-4',
  userId: entity1User2.userId,
  itemStatus: constants.job.status.pendingApproval,
  itemData: {
    files: [
      {
        "name": "mlstn4_invoice.pdf",
        "key": "mlstn4_invoice.pdf"
      },
      {
        autoTalentInvoice: true,
        "name": "mlstn4_autoinvoice.pdf",
        "key": "mlstn4_autoinvoice.pdf"
      }
    ]
  }
};

const mlstn1LedgerRecord = {
  itemId: 1577800000001,
  companyId,
  entityId: mlstn1.entityId,
  itemData: {
    "amount": 100,
    "date": 1577830000000,
    "jobId": `job_for_${mlstn1}`,
    "milestoneId": mlstn1.itemId,
    "newStatus": constants.budgets.categories.approved
  },
  userId: mlstn1.userId
};

const mlstn2LedgerRecord = {
  itemId: 1577800000002,
  companyId,
  entityId: mlstn2.entityId,
  itemData: {
    "amount": 100,
    "date": 1577830000000,
    "jobId": `job_for_${mlstn2}`,
    "milestoneId": mlstn2.itemId,
    "newStatus": constants.budgets.categories.approved
  },
  userId: mlstn2.userId
};

const mlstn3LedgerRecord = {
  itemId: 1577800000003,
  companyId,
  entityId: mlstn3.entityId,
  itemData: {
    "amount": 100,
    "date": 1577830000000,
    "jobId": `job_for_${mlstn3}`,
    "milestoneId": mlstn3.itemId,
    "newStatus": constants.budgets.categories.approved
  },
  userId: mlstn3.userId
};

const mlstn4LedgerRecord = {
  itemId: 1577800000004,
  companyId,
  entityId: mlstn4.entityId,
  itemData: {
    "amount": 100,
    "date": 1577830000000,
    "jobId": `job_for_${mlstn4}`,
    "milestoneId": mlstn4.itemId,
    "newStatus": constants.budgets.categories.approved
  },
  userId: mlstn4.userId
};

const jsonFileContent1 = {
  billingId: 'JEST-GET-INVOICES-BILLING_ID',
  body: [
      {
          milestoneId: mlstn1.itemId,
          entityId: mlstn1.entityId,
      },
      {
          milestoneId: mlstn2.itemId,
          entityId: mlstn2.entityId,
      },
  ]
}

describe("getInvoices", () => {
  beforeAll(async () => {
    let result = await usersService.create(companyAdminCompanyUser);
    expect(result.userId).toBe(companyAdminCompanyUser.userId);
    result = await usersService.create(companyAdminEntity1User);
    expect(result.userId).toBe(companyAdminEntity1User.userId);
    result = await usersService.create(companyAdminEntity2User);
    expect(result.userId).toBe(companyAdminEntity2User.userId);
    result = await usersService.create(companyAdminEntity3User);
    expect(result.userId).toBe(companyAdminEntity3User.userId);
    result = await usersService.create(entity1AdminUser);
    expect(result.userId).toBe(entity1AdminUser.userId);
    result = await usersService.create(entity1User1);
    expect(result.userId).toBe(entity1User1.userId);
    result = await usersService.create(entity1User2);
    expect(result.userId).toBe(entity1User2.userId);
    result = await usersService.create(entity2AdminUser);
    expect(result.userId).toBe(entity2AdminUser.userId);
    result = await usersService.create(entity2User);
    expect(result.userId).toBe(entity2User.userId);
    result = await usersService.create(companyUser1);
    expect(result.userId).toBe(companyUser1.userId);
    result = await usersService.create(companyUser2);
    expect(result.userId).toBe(companyUser2.userId);

    result = await jobsService.create(mlstn1);
    expect(result.itemId).toBe(mlstn1.itemId);
    result = await jobsService.create(mlstn2);
    expect(result.itemId).toBe(mlstn2.itemId);
    result = await jobsService.create(mlstn3);
    expect(result.itemId).toBe(mlstn3.itemId);
    result = await jobsService.create(mlstn4);
    expect(result.itemId).toBe(mlstn4.itemId);

    result = await ledgerService.create(mlstn1LedgerRecord);
    expect(result.itemId).toBe(mlstn1LedgerRecord.itemId);
    result = await ledgerService.create(mlstn2LedgerRecord);
    expect(result.itemId).toBe(mlstn2LedgerRecord.itemId);
    result = await ledgerService.create(mlstn3LedgerRecord);
    expect(result.itemId).toBe(mlstn3LedgerRecord.itemId);
    result = await ledgerService.create(mlstn4LedgerRecord);
    expect(result.itemId).toBe(mlstn4LedgerRecord.itemId);

    await Promise.all([
      s3.putObject({ Bucket: bucket, Key: s3lib.generateFileKey(companyId, mlstn1.entityId, mlstn1.userId, mlstn1.itemData.files[0].key) }).promise(),
      s3.putObject({ Bucket: bucket, Key: s3lib.generateFileKey(companyId, mlstn1.entityId, mlstn1.userId, mlstn1.itemData.files[1].key) }).promise(),
      s3.putObject({ Bucket: bucket, Key: s3lib.generateFileKey(companyId, mlstn1.entityId, mlstn1.userId, mlstn1.itemData.files[2].key) }).promise(),
      s3.putObject({ Bucket: bucket, Key: s3lib.generateFileKey(companyId, mlstn2.entityId, mlstn2.userId, mlstn2.itemData.files[0].key) }).promise(),
      s3.putObject({ Bucket: bucket, Key: s3lib.generateFileKey(companyId, mlstn3.entityId, mlstn3.userId, mlstn3.itemData.files[0].key) }).promise(),
      s3.putObject({ Bucket: bucket, Key: s3lib.generateFileKey(companyId, mlstn4.entityId, mlstn4.userId, mlstn4.itemData.files[0].key) }).promise(),
      s3.putObject({ Bucket: bucket, Key: s3lib.generateFileKey(companyId, mlstn4.entityId, mlstn4.userId, mlstn4.itemData.files[1].key) }).promise(),
      s3.putObject({ Bucket: bucket, Key: `billing/${companyId}/${jsonFileContent1.billingId}.json`, Body: JSON.stringify(jsonFileContent1) }).promise(),
    ]);
  });

  it("get Invoices and Documents of company, by company admin, expect 6 files", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: companyAdminCompanyUser.userId
        }
      },
      queryStringParameters: {
        from: 1577790000000,
        to: 1577810000000,
        companyId,
      }
    }
    const response = await getInvoices.run(event);
    const invoices = JSON.parse(response.body);
    expect(invoices.url).toBeTruthy();
    expect(invoices.filenames).toEqual({
      [mlstn1.itemId]: [mlstn1.itemData.files[0].name, mlstn1.itemData.files[1].name, mlstn1.itemData.files[2].name],
      [mlstn2.itemId]: [mlstn2.itemData.files[0].name],
      [mlstn3.itemId]: [mlstn3.itemData.files[0].name],
      [mlstn4.itemId]: [mlstn4.itemData.files[0].name, mlstn4.itemData.files[1].name]
    });
    const returnedInvoices = [];
    const expectedInvocies = [
      mlstn1.itemData.files[1].name,
      mlstn1.itemData.files[0].name,
      mlstn1.itemData.files[2].name,
      mlstn2.itemData.files[0].name,
      mlstn3.itemData.files[0].name,
      mlstn4.itemData.files[1].name,
      mlstn4.itemData.files[0].name
    ];
    await rp(invoices.url).pipe(unzipper.Parse()).on('entry', (entry) => returnedInvoices.push(entry.path)).promise();
    expect(returnedInvoices.sort()).toEqual(expectedInvocies.sort());
  });

  it("get invoices of company, by company admin, expect 2 invoices", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: companyAdminCompanyUser.userId
        }
      },
      queryStringParameters: {
        from: 1577790000000,
        to: 1577810000000,
        companyId,
        type: 'invoice',
      }
    }
    const response = await getInvoices.run(event);
    const invoices = JSON.parse(response.body);
    expect(invoices.url).toBeTruthy();
    expect(invoices.filenames).toEqual({
      [mlstn1.itemId]: [mlstn1.itemData.files[0].name],
      [mlstn3.itemId]: [mlstn3.itemData.files[0].name],
    });
    const returnedInvoices = [];
    const expectedInvocies = [
      mlstn1.itemData.files[0].name,
      mlstn3.itemData.files[0].name,
    ];
    await rp(invoices.url).pipe(unzipper.Parse()).on('entry', (entry) => returnedInvoices.push(entry.path)).promise();
    expect(returnedInvoices.sort()).toEqual(expectedInvocies.sort());
  });

  it("get documents of company, by company admin, expect 2 documents", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: companyAdminCompanyUser.userId
        }
      },
      queryStringParameters: {
        from: 1577790000000,
        to: 1577810000000,
        companyId,
        type: 'file',
      }
    }
    const response = await getInvoices.run(event);
    const invoices = JSON.parse(response.body);
    expect(invoices.url).toBeTruthy();
    expect(invoices.filenames).toEqual({
      [mlstn2.itemId]: [mlstn2.itemData.files[0].name],
      [mlstn4.itemId]: [mlstn4.itemData.files[0].name],
    });
    const returnedInvoices = [];
    const expectedInvocies = [
      mlstn2.itemData.files[0].name,
      mlstn4.itemData.files[0].name,
    ];
    await rp(invoices.url).pipe(unzipper.Parse()).on('entry', (entry) => returnedInvoices.push(entry.path)).promise();
    expect(returnedInvoices.sort()).toEqual(expectedInvocies.sort());
  });

  it("get invoices of company, by company admin, in a specific timeframe, expect 'no invoices' response", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: companyAdminCompanyUser.userId
        }
      },
      queryStringParameters: {
        from: 1576800000000,
        to: 1576800000000,
        companyId
      }
    }
    const response = await getInvoices.run(event);
    const result = JSON.parse(response.body);
    expect(result).toEqual('no invoices');
  });

  it("get invoices of company, by company admin, in a specific timeframe, expect 1 invoice", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: companyAdminCompanyUser.userId
        }
      },
      queryStringParameters: {
        from: 1577800000002,
        to: 1577800000003,
        companyId,
        type: 'invoice'
      }
    }
    const response = await getInvoices.run(event);
    const invoices = JSON.parse(response.body);
    expect(invoices.url).toBeTruthy();
    expect(invoices.filenames).toEqual({
      [mlstn3.itemId]: [mlstn3.itemData.files[0].name]
    });
    const returnedInvoices = [];
    const expectedInvocies = [
      mlstn3.itemData.files[0].name
    ];
    await rp(invoices.url).pipe(unzipper.Parse()).on('entry', (entry) => returnedInvoices.push(entry.path)).promise();
    expect(returnedInvoices.sort()).toEqual(expectedInvocies.sort());
  });

  it("get invoices of company, by company user 1, expect 1 invoice", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: companyUser1.userId
        }
      },
      queryStringParameters: {
        from: 1577790000000,
        to: 1577810000000,
        companyId,
        type: 'invoice'
      }
    }
    const response = await getInvoices.run(event);
    const invoices = JSON.parse(response.body);
    expect(invoices.url).toBeTruthy();
    expect(invoices.filenames).toEqual({
      [mlstn3.itemId]: [mlstn3.itemData.files[0].name]
    });
    const returnedInvoices = [];
    const expectedInvocies = [mlstn3.itemData.files[0].name];
    await rp(invoices.url).pipe(unzipper.Parse()).on('entry', (entry) => returnedInvoices.push(entry.path)).promise();
    expect(returnedInvoices).toEqual(expectedInvocies);
  });

  it("get invoices of company, by company user 2, expect 'no invoices' response", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: companyUser2.userId
        }
      },
      queryStringParameters: {
        from: 1577790000000,
        to: 1577810000000,
        companyId,
        type: 'invoice'
      }
    }
    const response = await getInvoices.run(event);
    const result = JSON.parse(response.body);
    expect(result).toEqual('no invoices');
  });

  it("get invoices of company, by entity 1 user 1", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: entity1User1.userId
        }
      },
      queryStringParameters: {
        from: 1577790000000,
        to: 1577810000000,
        companyId,
      }
    }
    const response = await getInvoices.run(event);
    expect(response.statusCode).toBe(200);
    const invoices = JSON.parse(response.body);
    expect(invoices.url).toBeTruthy();
    expect(invoices.filenames).toEqual({
      [mlstn1.itemId]: [mlstn1.itemData.files[0].name, mlstn1.itemData.files[1].name, mlstn1.itemData.files[2].name]
    });
  });

  it("get proforma of company, by entity 1 user 1", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: entity1User1.userId
        }
      },
      queryStringParameters: {
        from: 1577790000000,
        to: 1577810000000,
        companyId,
        type: 'proForma'
      }
    }
    const response = await getInvoices.run(event);
    expect(response.statusCode).toBe(200);
    const invoices = JSON.parse(response.body);
    expect(invoices.url).toBeTruthy();
    expect(invoices.filenames).toEqual({
      [mlstn1.itemId]: [mlstn1.itemData.files[1].name]
    });
  });


  it("get invoices of company, by entity 1 admin", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: entity1AdminUser.userId
        }
      },
      queryStringParameters: {
        from: 1577790000000,
        to: 1577810000000,
        companyId,
      }
    }
    const response = await getInvoices.run(event);
    expect(response.statusCode).toBe(200);
    const invoices = JSON.parse(response.body);
    expect(invoices.url).toBeTruthy();
    expect(invoices.filenames).toEqual({
      [mlstn1.itemId]: [mlstn1.itemData.files[0].name, mlstn1.itemData.files[1].name, mlstn1.itemData.files[2].name],
      [mlstn4.itemId]: [mlstn4.itemData.files[0].name, mlstn4.itemData.files[1].name]
    });
  });
  
  it("get pro invoices of company, by entity 1 admin", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: entity1AdminUser.userId
        }
      },
      queryStringParameters: {
        from: 1577790000000,
        to: 1577810000000,
        companyId,
        type: 'proForma'
      }
    }
    const response = await getInvoices.run(event);
    expect(response.statusCode).toBe(200);
    const invoices = JSON.parse(response.body);
    expect(invoices.url).toBeTruthy();
    expect(invoices.filenames).toEqual({
      [mlstn1.itemId]: [mlstn1.itemData.files[1].name],
      [mlstn4.itemId]: [mlstn4.itemData.files[1].name]
    });
  });
  
  it("get invoices of company, by billingId", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: companyAdminCompanyUser.userId
        }
      },
      queryStringParameters: {
        billingId: jsonFileContent1.billingId,
        companyId,
      }
    }
    const response = await getInvoices.run(event);
    expect(response.statusCode).toBe(200);
    const invoices = JSON.parse(response.body);
    expect(invoices.url).toBeTruthy();
    expect(invoices.filenames).toEqual({
      [mlstn1.itemId]: [mlstn1.itemData.files[0].name, mlstn1.itemData.files[1].name, mlstn1.itemData.files[2].name],
      [mlstn2.itemId]: [mlstn2.itemData.files[0].name]
    });
  });

  it("get invoices, missing scope, expect 500, failure", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: companyAdminCompanyUser.userId
        }
      },
      pathParameters: {},
      queryStringParameters: {
        from: 1577800000002,
        to: 1577800000003
      }
    }
    const response = await getInvoices.run(event);
    expect(response.statusCode).toBe(500);
  });

  it("get invoices, missing 'from', expect 500, failure", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: companyAdminCompanyUser.userId
        }
      },
      queryStringParameters: {
        to: 1577800000003,
        companyId
      }
    }
    const response = await getInvoices.run(event);
    expect(response.statusCode).toBe(500);
  });

  it("get invoices, missing 'to', expect 500, failure", async () => {
    const event = {
      requestContext: {
        identity: {
          cognitoIdentityId: companyAdminCompanyUser.userId
        }
      },
      queryStringParameters: {
        from: 1577800000002,
        companyId
      }
    }
    const response = await getInvoices.run(event);
    expect(response.statusCode).toBe(500);
  });

  it("get zip invoices, with missing download file", async () => {
    const INVOICES_ZIP_SIGNED_URL_EXPIRATION_TIME = 10000
    const mlstFileIndex = 0;
    const uploadedFileKey = s3lib.generateFileKey(companyId, companyId, entity1User1.userId, mlstn1.itemData.files[mlstFileIndex].key);
    const notExistsFileKey = 'i am a key that dose not exists';
    await s3lib.putObject({ Bucket: bucket, Key: uploadedFileKey, Body: JSON.stringify(jsonFileContent1) });
    const fileZipKey = s3lib.generateFileKey(companyId, companyId, entity1User1.userId, 'result.zip');
    const srcObjectKeys = [
                            uploadedFileKey,
                            notExistsFileKey
                          ];
    await s3lib.zipObjects(bucket, srcObjectKeys, fileZipKey);
    const url = await s3lib.getS3().getSignedUrl("getObject", {
      Bucket: bucket,
      Key: fileZipKey,
      Expires: INVOICES_ZIP_SIGNED_URL_EXPIRATION_TIME
    });
    expect(url).toBeDefined();

    const returnedInvoices = [];
    await rp(url).pipe(unzipper.Parse()).on('entry', (entry) => returnedInvoices.push(entry.path)).promise();
    expect(returnedInvoices.length).toEqual(1);
  });

  afterAll(async () => {
    await Promise.all([
      usersService.delete(companyAdminCompanyUser.userId, companyAdminCompanyUser.entityId),
      usersService.delete(companyAdminEntity1User.userId, companyAdminEntity1User.entityId),
      usersService.delete(companyAdminEntity2User.userId, companyAdminEntity2User.entityId),
      usersService.delete(companyAdminEntity3User.userId, companyAdminEntity3User.entityId),
      usersService.delete(entity1AdminUser.userId, entity1AdminUser.entityId),
      usersService.delete(entity1User1.userId, entity1User1.entityId),
      usersService.delete(entity2AdminUser.userId, entity2AdminUser.entityId),
      usersService.delete(entity1User2.userId, entity1User2.entityId),
      usersService.delete(companyUser1.userId, companyUser1.entityId),
      usersService.delete(companyUser2.userId, companyUser2.entityId),
      jobsService.delete(mlstn1.entityId, mlstn1.itemId),
      jobsService.delete(mlstn2.entityId, mlstn2.itemId),
      jobsService.delete(mlstn3.entityId, mlstn3.itemId),
      jobsService.delete(mlstn4.entityId, mlstn4.itemId),
      ledgerService.delete(mlstn1LedgerRecord.entityId, mlstn1LedgerRecord.itemId),
      ledgerService.delete(mlstn2LedgerRecord.entityId, mlstn2LedgerRecord.itemId),
      ledgerService.delete(mlstn3LedgerRecord.entityId, mlstn3LedgerRecord.itemId),
      ledgerService.delete(mlstn4LedgerRecord.entityId, mlstn4LedgerRecord.itemId),
      s3.deleteObject({ Bucket: bucket, Key: `${companyId}/${mlstn1.entityId}/${mlstn1.userId}/${mlstn1.itemData.files[0].key}` }).promise(),
      s3.deleteObject({ Bucket: bucket, Key: `${companyId}/${mlstn2.entityId}/${mlstn2.userId}/${mlstn2.itemData.files[0].key}` }).promise(),
      s3.deleteObject({ Bucket: bucket, Key: `${companyId}/${mlstn3.entityId}/${mlstn3.userId}/${mlstn3.itemData.files[0].key}` }).promise(),
      s3.deleteObject({ Bucket: bucket, Key: `${companyId}/${mlstn4.entityId}/${mlstn4.userId}/${mlstn4.itemData.files[0].key}` }).promise()
    ]);
    await Promise.all([
      s3.deleteObject({ Bucket: bucket, Key: `${companyId}/${mlstn1.entityId}/${mlstn1.userId}` }).promise(),
      s3.deleteObject({ Bucket: bucket, Key: `${companyId}/${mlstn2.entityId}/${mlstn2.userId}` }).promise(),
      s3.deleteObject({ Bucket: bucket, Key: `${companyId}/${mlstn3.entityId}/${mlstn3.userId}` }).promise(),
      s3.deleteObject({ Bucket: bucket, Key: `${companyId}/${mlstn4.entityId}/${mlstn4.userId}` }).promise()
    ]);
    await Promise.all([
      s3.deleteObject({ Bucket: bucket, Key: `${companyId}/${mlstn1.entityId}` }).promise(),
      s3.deleteObject({ Bucket: bucket, Key: `${companyId}/${mlstn2.entityId}` }).promise(),
      s3.deleteObject({ Bucket: bucket, Key: `${companyId}/${mlstn3.entityId}` }).promise(),
      s3.deleteObject({ Bucket: bucket, Key: `${companyId}/${mlstn4.entityId}` }).promise()
    ]);
    await s3.deleteObject({ Bucket: bucket, Key: `${companyId}` }).promise();
  });
});
