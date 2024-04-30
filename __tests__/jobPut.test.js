'use strict';

// tests for updateJob

const mod = require('../src/jobs');
const { UsersService, JobsService, CompanyProvidersService, BidsService, constants, permisionConstants } = require('stoke-app-common-api');
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const bidsService = new BidsService(process.env.bidsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAttributesAndExternalUserId, constants.attributeNames.defaultAttributes);
const jestPlugin = require('serverless-jest-plugin');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrappedUpdateJobs = lambdaWrapper.wrap(mod, { handler: 'updateJob' });
const jobDataWrongEntity = require('../mocks/createJobWrongEntity-event.json');
const jobDataWrongId = require('../mocks/createJobWrongJobId-event.json');
const archiveJobWrongId = JSON.parse(jobDataWrongId.body);
const itemId = 'UPDATEJOB-JEST-TEST-JOB-ID-1';
const itemId2 = 'UPDATEJOB-JEST-TEST-JOB-ID-2';
const itemId3 = 'UPDATEJOB-JEST-TEST-JOB-ID-3';
const itemId4 = 'job_UPDATEJOB-JEST-TEST-JOB-ID-4';
const itemId5 = 'job_UPDATEJOB-JEST-TEST-JOB-ID-5';
const itemId6 = 'job_UPDATEJOB-JEST-TEST-JOB-ID-6';
const itemId7 = 'job_UPDATEJOB-JEST-TEST-JOB-ID-7';
const itemId8 = 'job_UPDATEJOB-JEST-TEST-JOB-ID-8';
const companyProviderId1 = 'talent_UPDATEJOB-JEST-TEST-provider-ID-1talent_talent1';
const companyProviderId2 = 'talent_UPDATEJOB-JEST-TEST-provider-ID-2talent_talent2';
const ms3 = `ms_${itemId3}_milestone1`;
const ms4 = `ms_${itemId3}_milestone2`;
const userId = 'UPDATEJOB-JEST-TEST-USR-ID-1';
const entityId = 'UPDATEJOB-JEST-TEST-ENT-ID-1';
const companyId = 'UPDATEJOB-JEST-TEST-COMP-ID-1';
const eventBody = {
  entityId: entityId,
  itemId: itemId,
  itemStatus: 'paused',
  itemData: {
    title: 'The modified job title',
  },
  isKeepPostedJobOpen: true
};

const companyProvider = {
  itemId: companyProviderId1,
  companyId,
  itemStatus: constants.companyProvider.status.registered,
  createdBy: userId,
  modifiedBy: userId,
  itemData: {
    firstName: 'firstName',
    lastName: 'lastName',
    talentProfileData: {
      jobTitle: 'job title'
    }
  }
}

const companyProvider2 = {
  itemId: companyProviderId2,
  companyId,
  itemStatus: constants.companyProvider.status.registered,
  createdBy: userId,
  modifiedBy: userId,
  itemData: {
    firstName: 'firstName2',
    lastName: 'lastName2',
    talentProfileData: {
      jobTitle: 'job title 2'
    }
  }
}

const modifiedJobData = {
  body: JSON.stringify(eventBody),
  requestContext: {
    identity: {
      cognitoIdentityId: entityId
    }
  },
  pathParameters: {
    id: itemId
  }
};

const job2 = {
  itemId: itemId2,
  entityId,
  userId,
  itemStatus: constants.job.status.draft,
  itemData: {},
}

const job3 = {
  itemId: itemId3,
  entityId,
  userId,
  itemStatus: constants.job.status.active,
  itemData: {},
}

const job4 = {
  itemId: itemId4,
  entityId,
  userId,
  itemStatus: constants.job.status.initial,
  itemData: {
    jobFlow: constants.jobFlow.offer,
    talentIds: [companyProviderId1],
  },
}

const job5 = {
  itemId: itemId5,
  entityId,
  userId,
  itemStatus: constants.job.status.active,
  itemData: {
    jobFlow: constants.jobFlow.post,
    talentId: companyProviderId1
  },
}

const job6 = {
  itemId: itemId6,
  entityId,
  userId,
  itemStatus: constants.job.status.active,
  itemData: {
    jobFlow: constants.jobFlow.post,
    talentId: companyProviderId1
  },
}

const job7 = {
  itemId: itemId7,
  entityId,
  userId,
  itemStatus: constants.job.status.completed,
  itemData: {
    jobFlow: constants.jobFlow.post,
    talentId: companyProviderId1
  },
}

const job8 = {
  itemId: itemId8,
  entityId,
  userId,
  itemStatus: constants.job.status.pending,
  itemData: {
    jobFlow: constants.jobFlow.post,
    talentId: companyProviderId1
  },
}


const milestone3 = {
  itemId: ms3,
  entityId,
  userId,
  itemStatus: constants.job.status.active,
  itemData: {},
}

const milestone4 = {
  itemId: ms4,
  entityId,
  userId,
  itemStatus: constants.job.status.pendingApproval,
  itemData: {},
}


const event2 = {
  body: JSON.stringify({ entityId, itemData: {}, itemStatus: constants.job.status.completed }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  pathParameters: {
    id: itemId2
  }
}

const event3 = {
  body: JSON.stringify({ entityId, itemData: {}, itemStatus: constants.job.status.completed }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  pathParameters: {
    id: itemId3
  }
}

const event4 = {
  body: JSON.stringify({ entityId, itemData: { talentIds: [companyProviderId1], jobFlow: constants.jobFlow.offer }, itemStatus: constants.job.status.pending }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  pathParameters: {
    id: itemId4
  }
}

const event5 = {
  body: JSON.stringify([
    { itemId: itemId5, entityId, itemData: job5.itemData, itemStatus: constants.job.status.completed },
    { itemId: itemId6, entityId, itemData: job6.itemData, itemStatus: constants.job.status.completed }
  ]),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
}

const event6 = {
  body: JSON.stringify({ entityId, itemData: { talentIds: [companyProviderId1, companyProviderId2], bids: [`${itemId4}_${companyProviderId1}`], jobFlow: constants.jobFlow.offer }, itemStatus: constants.job.status.pending }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  pathParameters: {
    id: itemId4
  }
}

const event7 = {
  body: JSON.stringify([
    { itemId: itemId4, entityId, itemData: job4.itemData, itemStatus: constants.job.status.completed },
    { itemId: itemId7, entityId, itemData: job7.itemData, itemStatus: constants.job.status.completed }
  ]),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
}

const event8 = {
  body: JSON.stringify([
    { itemId: itemId8, talentId: companyProviderId1, entityId, itemData: job8.itemData, itemStatus: constants.job.status.pending },
  ]),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
}

const resendEvent = {
  body: JSON.stringify({ resendTalentIds: [companyProviderId1, companyProviderId2], entityId, itemData: { talentIds: [companyProviderId1], jobFlow: constants.jobFlow.offer }, itemStatus: constants.job.status.pending }),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  pathParameters: {
    id: itemId4
  }
}

jest.mock('stoke-app-common-api/service/sqsService');
const SqsService = require('stoke-app-common-api/service/sqsService');
SqsService.prototype.sendMessage.mockImplementation(() => true);

describe('updateJob', () => {
  beforeEach(async () => {
    let user = {
      userId: archiveJobWrongId.userId,
      entityId: archiveJobWrongId.entityId,
      companyId: archiveJobWrongId.companyId,
      itemStatus: constants.user.status.active,
      itemData: {
        userRole: constants.user.role.admin,
        permissionsComponents: { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } }
      }
    };
    let result = await usersService.create(user);
    expect(result).toEqual(user);
    const item = {
      itemId: itemId,
      entityId: entityId,
      itemStatus: 'New',
      itemData: {},
    };

    let response = await jobsService.create(item);
    jobDataWrongEntity.pathParameters.id = response.itemId;
    response = await jobsService.create(job2);
    expect(response.itemId).toEqual(itemId2);
    response = await jobsService.create(job3);
    expect(response.itemId).toEqual(itemId3);
    response = await jobsService.create(job4);
    expect(response.itemId).toEqual(itemId4);
    response = await jobsService.create(job5);
    expect(response.itemId).toEqual(itemId5);
    response = await jobsService.create(job6);
    expect(response.itemId).toEqual(itemId6);
    response = await jobsService.create(job7);
    expect(response.itemId).toEqual(itemId7);
    response = await jobsService.create(job8);
    expect(response.itemId).toEqual(itemId8);
    response = await companyProvidersService.create(companyProvider);
    expect(response.itemId).toEqual(companyProviderId1);
    response = await companyProvidersService.create(companyProvider2);
    expect(response.itemId).toEqual(companyProviderId2);
    response = await jobsService.create(milestone3);
    expect(response.itemId).toEqual(ms3);
    response = await jobsService.create(milestone4);
    expect(response.itemId).toEqual(ms4);
    user = {
      userId,
      entityId,
      companyId,
      itemStatus: constants.user.status.active,
      itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
      }
    };
    response = await usersService.create(user);
    expect(response.userId).toEqual(userId);
  });

  it('update job post, expect 200', async () => {
    const user = {
      userId: entityId,
      entityId,
      companyId: entityId,
      itemStatus: constants.user.status.active,
      itemData: {
        userRole: constants.user.role.admin,
        isEditor: true
      }
    };
    let result = await usersService.create(user);
    expect(result).toEqual(user);
    let response = await wrappedUpdateJobs.run(modifiedJobData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatch(/itemData/);
    response = await jobsService.get(entityId, itemId);
    expect(response.itemData.title).toBe('The modified job title');
    expect(response.itemStatus).toBe('paused');
    result = await usersService.delete(entityId, entityId);
    expect(result).toBeTruthy();
    await usersService.update({
      userId: user.userId, entityId: user.entityId, modifiedBy: user.userId, itemData: {
        userRole: constants.user.role.admin,
        isEditor: false
      }
    })
    response = await wrappedUpdateJobs.run(modifiedJobData);
    expect(response.statusCode).toBe(403);

  });

  it('update job post, expect unauthorised', async () => {
    const response = await wrappedUpdateJobs.run(jobDataWrongEntity);
    expect(response.statusCode).toBe(403);
  });

  it('update job post, expect 500', async () => {
    const response = await wrappedUpdateJobs.run(jobDataWrongId);
    expect(response.statusCode).toBe(500);
  });

  it('update job post, expect 500 for complete job', async () => {
    const response = await wrappedUpdateJobs.run(event2);
    expect(response.statusCode).toBe(500);
  });

  it('update job post, expect 500 for complete job with milestone pendingApproval', async () => {
    let response = await wrappedUpdateJobs.run(event3);
    expect(response.statusCode).toBe(500);
  });

  it('update job post, expect 200 for complete job with milestone active', async () => {
    await jobsService.delete(entityId, ms4);
    let response = await wrappedUpdateJobs.run(event3);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, ms3);
    expect(response.itemStatus).toBe(constants.job.status.archived);
  });

  it('update job offer, expect 200', async () => {
    let response = await wrappedUpdateJobs.run(event4);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, itemId4);
    expect(response.itemStatus).toBe(constants.job.status.pending);
    expect(response.itemData.bids.values[0]).toBe(`${itemId4}_${companyProviderId1}`);
    response = await bidsService.get(entityId, `${itemId4}_${companyProviderId1}`);
    expect(response.itemData).toMatchObject({
      existingTalent: true,
      jobId: itemId4,
      candidate: {
        itemId: companyProviderId1,
        name: 'firstName lastName',
        title: 'job title'
      },
    });

    // Add new candidate
    response = await wrappedUpdateJobs.run(event6);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, itemId4);
    expect(response.itemStatus).toBe(constants.job.status.pending);
    expect(response.itemData.bids.values[0]).toBe(`${itemId4}_${companyProviderId1}`);
    expect(response.itemData.bids.values[1]).toBe(`${itemId4}_${companyProviderId2}`);
    expect(response.itemData.bids.values.length).toBe(2);
    response = await bidsService.get(entityId, `${itemId4}_${companyProviderId2}`);
    expect(response.itemData).toMatchObject({
      existingTalent: true,
      jobId: itemId4,
      candidate: {
        itemId: companyProviderId2,
        name: 'firstName2 lastName2',
        title: 'job title 2'
      },
    });
  });

  it('complete jobs in bulk, expect 200', async () => {
    let response = await wrappedUpdateJobs.run(event5);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, itemId5);
    expect(response.itemStatus).toBe(constants.job.status.completed);
    response = await jobsService.get(entityId, itemId6);
    expect(response.itemStatus).toBe(constants.job.status.completed);
  });

  it('try to complete draft and inital jobs in bulk to recieve error, expect 500', async () => {
    let response = await wrappedUpdateJobs.run(event7);
    expect(response.statusCode).toBe(500);
  });

  it('tryUpdate talentId for postedJob, expect 200', async () => {
    let response = await wrappedUpdateJobs.run(event8);
    expect(response.statusCode).toBe(200);
    response = await jobsService.get(entityId, itemId8);
    expect(response.itemData.talentId).toBe(companyProviderId1);
  });


  it('resend invite flow - send SQS exectly once', async () => {
    SqsService.prototype.sendMessage.mockReset()
    let response = await jobsService.get(entityId, itemId4);
    response = await wrappedUpdateJobs.run(resendEvent);
    expect(response.statusCode).toBe(200);
    expect(SqsService.prototype.sendMessage).toHaveBeenCalledWith({
      taskData: { entityId, jobId: itemId4, resendTalentIds: [companyProviderId1, companyProviderId2] }, 
      type: constants.sqsAsyncTasks.types.talentJobOffer 
    })
  });

  afterEach(async () => {
    //cleanup
    let result = await jobsService.delete(entityId, itemId);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, itemId2);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, itemId3);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, itemId4);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, itemId5);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, itemId6);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, itemId7);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, itemId8);
    expect(result).toBe(true);
    result = await companyProvidersService.delete(companyId, companyProviderId1);
    expect(result).toBe(true);
    result = await companyProvidersService.delete(companyId, companyProviderId2);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, ms3);
    expect(result).toBe(true);
    result = await usersService.delete(archiveJobWrongId.userId, archiveJobWrongId.entityId);
    expect(result).toBeTruthy();
    result = await usersService.delete(userId, entityId);
    expect(result).toBeTruthy();
  });

});


