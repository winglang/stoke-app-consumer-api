'use strict';

const jobs = require('../src/jobs');
const jestPlugin = require('serverless-jest-plugin');
const { UsersService, SettingsService, JobsService, CompanyProvidersService, constants, permisionConstants } = require('stoke-app-common-api');

const { jobsBucketName, jobsTableName, settingsTableName, consumerAuthTableName } = process.env;
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const wrapped = jestPlugin.lambdaWrapper.wrap(jobs, { handler: 'createJob' });

const userId2 =  'CREATE-JOB-JEST-TEST-USER-ID-2'
const talentId = 'CREATE-JOB-JEST-TEST-TALENT-ID-1'
const companyId = 'CREATE-JOB-JEST-TEST-COMPANY-ID-1'
const entityId = 'CREATE-JOB-JEST-TEST-ENT-ID-1'
const user = {
  userId: 'CREATE-JOB-JEST-TEST-USER-ID-1',
  entityId,
  companyId,
  createdBy: 'CREATE-JOB-JEST-TEST-USER-ID-1',
  modifiedBy: 'CREATE-JOB-JEST-TEST-USER-ID-1',
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user,
    permissionsComponents: { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } }
  }
};

const user2 = {
  userId: userId2,
  entityId,
  companyId,
  createdBy: 'CREATE-JOB-JEST-TEST-USER-ID-1',
  modifiedBy: 'CREATE-JOB-JEST-TEST-USER-ID-1',
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user,
    isEditor: true
  }
};

const adminUser = {
  userId: 'CREATE-JOB-JEST-TEST-USER-ID-ADMIIN',
  entityId,
  companyId,
  createdBy: 'CREATE-JOB-JEST-TEST-USER-ID-1',
  modifiedBy: 'CREATE-JOB-JEST-TEST-USER-ID-1',
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true
  }
};

const compAdminUser = {
  userId: 'CREATE-JOB-JEST-TEST-USER-ID-COMP-ADMIIN',
  entityId: companyId,
  companyId,
  createdBy: 'CREATE-JOB-JEST-TEST-USER-ID-1',
  modifiedBy: 'CREATE-JOB-JEST-TEST-USER-ID-1',
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.admin,
    isEditor: true
  }
};


const eventBody = {
  entityId,
  itemData: {
    title: 'JOB-TITLE',
    category: 'JOB-CATEGORY',
    requiredSkills: [{ value: 'eng2', label: 'eng2' }]
  }
};

const event = {
  body: JSON.stringify(eventBody),
  requestContext: {
    identity: {
      cognitoIdentityId: user.userId
    }
  },
  pathParameters: {
    id: ''
  }
};

const eventBodyActiveWithUserId = {
  entityId,
  userId: userId2,
  itemStatus: constants.job.status.active,
  itemData: {
    talentId,
    title: 'JOB-TITLE',
    category: 'JOB-CATEGORY',
    requiredSkills: [{ value: 'eng2', label: 'eng2' }]
  }
};

const eventActiveWithUserId = {
  body: JSON.stringify(eventBodyActiveWithUserId),
  requestContext: {
    identity: {
      cognitoIdentityId: user.userId
    }
  },
  pathParameters: {
    id: ''
  }
};

const eventBodyActiveAdminWithUserId = {
  entityId,
  userId: userId2,
  itemStatus: constants.job.status.active,
  itemData: {
    talentId,
    title: 'JOB-TITLE',
    category: 'JOB-CATEGORY',
    requiredSkills: [{ value: 'eng2', label: 'eng2' }]
  }
};

const eventActiveAdminWithUserId = {
  body: JSON.stringify(eventBodyActiveAdminWithUserId),
  requestContext: {
    identity: {
      cognitoIdentityId: adminUser.userId
    }
  },
  pathParameters: {
    id: ''
  }
};


const unauthorisedEventBody = {
  entityId: 'NO-SUCH-ENTITY-ID',
  itemData: {}
};

const unauthorisedEvent = {
  body: JSON.stringify(unauthorisedEventBody),
  requestContext: {
    identity: {
      cognitoIdentityId: 'USER-SUB-1234-JOB-ADD'
    }
  },
  pathParameters: {
    id: ''
  }
};

const settings = {
  itemId: `comp_${companyId}`,
  userId: "offlineContext_cognitoIdentityId",
  entityId: "offlineContext_cognitoIdentityId",
  companyId,
  itemData: {
    legalDocs: {
      nda: "/" + jobsBucketName + "/defaults/legalDocs/nda.pdf",
      nonCompete: "/" + jobsBucketName + "/defaults/legalDocs/nonCompete.pdf",
      ipAssignment: "/" + jobsBucketName + "/defaults/legalDocs/ipAssignment.pdf"
    }
  }
};

describe('createJob', () => {
  beforeAll(async () => {
    let response = await usersService.create(user);
    expect(response.userId).toBe(user.userId);
    response = await usersService.create(user2);
    expect(response.userId).toBe(user2.userId);
    response = await usersService.create(adminUser);
    expect(response.userId).toBe(adminUser.userId);
    response = await usersService.create(compAdminUser);
    expect(response.userId).toBe(compAdminUser.userId);
    const settingsResponse = await settingsService.create(settings);
    expect(settingsResponse.itemId).toBe(settings.itemId);
  });

  it('createJob, expect 200, data', async () => {
    let response = await wrapped.run(event)
    expect(response.statusCode).toBe(200);
    let responseObj = JSON.parse(response.body);
    expect(responseObj.itemData).toMatchObject(eventBody.itemData);
    expect(responseObj.itemId).toBeDefined();
    let itemId = responseObj.itemId;
    let entityId = responseObj.entityId;
    response = await jobsService.get(entityId, itemId)
    expect(response.itemId).toBe(itemId);
    expect(response.userId).toBe(user.userId);
    expect(response.itemStatus).toBe(constants.job.status.pending);
    expect(response.itemData).toMatchObject(eventBody.itemData);
    await usersService.update({ entityId: user.entityId, userId: user.userId, modifiedBy: user.userId, itemData: {
      userRole: constants.user.role.user,
      isEditor: false
    } })
    response = await wrapped.run(event)
    expect(response.statusCode).toBe(403);
    eventBody.itemId = itemId; // store for later usage in clearAll
    response = await wrapped.run(eventActiveAdminWithUserId)
    expect(response.statusCode).toBe(200);
    responseObj = JSON.parse(response.body);
    expect(responseObj.itemData).toMatchObject(eventBodyActiveAdminWithUserId.itemData);
    expect(responseObj.itemId).toBeDefined();
    itemId = responseObj.itemId;
    entityId = responseObj.entityId;
    response = await jobsService.get(entityId, itemId)
    expect(response.itemId).toBe(itemId);
    expect(response.userId).toBe(userId2);
    expect(response.itemStatus).toBe(constants.job.status.active);
    expect(response.itemData).toMatchObject(eventBodyActiveWithUserId.itemData);
    await usersService.update({ entityId: user2.entityId, userId: user2.userId, modifiedBy: user2.userId, itemData: {
      userRole: constants.user.role.user,
      isEditor: false
    } })
    response = await wrapped.run(eventActiveAdminWithUserId)
    expect(response.statusCode).toBe(403);
    eventBodyActiveWithUserId.itemId = itemId; // store for later usage in clearAll
    response = await wrapped.run(eventActiveWithUserId)
    expect(response.statusCode).toBe(403);
  });

  it('create job post, entityId is the same as the companyId, expect failure', async () => {
    const eventBody = {
      entityId: companyId,
      itemData: {
        title: 'JOB-TITLE',
        category: 'JOB-CATEGORY',
        requiredSkills: [{ value: 'eng2', label: 'eng2' }]
      }
    };
    
    const event = {
      body: JSON.stringify(eventBody),
      requestContext: {
        identity: {
          cognitoIdentityId: compAdminUser.userId
        }
      },
      pathParameters: {
        id: ''
      }
    };
    const response = await wrapped.run(event)
    expect(response.statusCode).toBe(500);
  });

  it('create job post, expect unauthorised', async () => {
    const response = await wrapped.run(unauthorisedEvent);
    expect(response.statusCode).toBe(403);
  });

  afterAll(async () => {
    await jobsService.delete(eventBody.entityId, eventBody.itemId);
    await jobsService.delete(eventBodyActiveWithUserId.entityId, eventBodyActiveWithUserId.itemId);
    await usersService.delete(user.userId, user.entityId);
    await usersService.delete(user2.userId, user2.entityId);
    await usersService.delete(adminUser.userId, adminUser.entityId);
    await usersService.delete(compAdminUser.userId, compAdminUser.entityId);
    await settingsService.delete(settings.itemId);
  });
});


