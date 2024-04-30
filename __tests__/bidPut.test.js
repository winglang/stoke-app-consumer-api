/* eslint-disable max-lines-per-function */
'use strict';

// tests for updateBid

const uuidv1 = require('uuid/v1');
const mod = require('../src/bids');
const jestPlugin = require('serverless-jest-plugin');
const wrappedUpdateBid = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'updateBid' });
const { consumerAuthTableName, bidsTableName, jobsTableName, auditTableName, auditQueueName } = process.env;
const { JobsService, BidsService, UsersService, AuditService, constants, sqsLib } = require('stoke-app-common-api');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const bidsService = new BidsService(bidsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const auditService = new AuditService(auditTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
jest.mock('stoke-app-common-api/service/sqsService');
const SqsService = require('stoke-app-common-api/service/sqsService');
SqsService.prototype.sendMessage.mockImplementation((auditLog) => {
  auditService.create({ ...auditLog, itemId: `${auditLog.type}_${uuidv1()}` });
});

const companyId = 'UPDATEBID-JEST-TEST-COMPANYID';
const entityId = 'UPDATEBID-JEST-TEST-ENT-ID-1';
const userId1 = 'UPDATEBID-JEST-TEST-USER-1';
const jobId = 'UPDATEBID-JEST-TEST-JOBID-1';
const jobId2 = 'UPDATEBID-JEST-TEST-JOBID-2';
const talentId = 'UPDATEBID-JEST-TEST-TALENTID-1'
const talentId2 = 'UPDATEBID-JEST-TEST-TALENTID-2'
const talentId3 = 'UPDATEBID-JEST-TEST-TALENTID-3'
const talentId4 = 'UPDATEBID-JEST-TEST-TALENTID-4'
const userId2 = 'UPDATEBID-JEST-TEST-USER-2';
const userId3 = 'UPDATEBID-JEST-TEST-USER-3';

const user1 = {
  userId: userId1,
  entityId,
  companyId,
  createdBy: userId1,
  modifiedBy: userId1,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user,
    isEditor: true,
    permissionsComponents: {
      [permissionsComponentsKeys.jobs]: { isEditor: true },
    }
  }
};

const user3 = {
  userId: userId3,
  entityId,
  companyId,
  createdBy: userId1,
  modifiedBy: userId1,
  itemStatus: constants.user.status.active,
  itemData: {
    userRole: constants.user.role.user,
    isEditor: true,
    permissionsComponents: {
      [permissionsComponentsKeys.jobs]: { isEditor: true },
    }
  }
};

const bid1 = {
  entityId,
  itemStatus: constants.bidItemStatus.new,
  itemData: {
    pinnedBy: [userId2],
    name: talentId
  },
  itemId: `${jobId}_${talentId}`
}

const bid2 = {
  entityId,
  itemStatus: constants.bidItemStatus.new,
  itemData: {
    pinnedBy: [userId2],
    name: talentId2
  },
  itemId: `${jobId}_${talentId2}`
}

const bid3 = {
  entityId,
  itemStatus: constants.bidItemStatus.new,
  itemData: {
    pinnedBy: [userId2],
    name: talentId3
  },
  itemId: `${jobId}_${talentId3}`
}

const bid4 = {
  entityId,
  itemStatus: constants.bidItemStatus.new,
  itemData: {
    name: talentId4
  },
  itemId: `${jobId2}_${talentId4}`
}

const job1 = {
  entityId,
  itemStatus: 'Pending',
  itemData: {},
  itemId: jobId
}

const job2 = {
  companyId,
  entityId,
  itemStatus: 'Posted',
  itemData: {},
  itemId: jobId2
}

const eventBody1 = {
  entityId,
  suitabilityType: 'isPinned',
  suitabilityValue: true
};

const eventBody2 = {
  entityId,
  suitabilityType: 'isPinned',
  suitabilityValue: false
};

const eventBody3 = {
  ids: [bid1.itemId, bid2.itemId],
  entityId,
  suitabilityType: 'isPinned',
  suitabilityValue: true
};

const eventBody4 = {
  ids: [bid1.itemId, bid2.itemId],
  entityId,
  suitabilityType: 'isPinned',
  suitabilityValue: false
};

const eventBody5 = {
  ids: [bid1.itemId, bid2.itemId, jobId],
  entityId,
  suitabilityType: 'isPinned',
  suitabilityValue: true
};

const eventBody6 = {
  ids: [bid3.itemId],
  entityId,
  itemStatus: constants.bidItemStatus.viewed
};

const eventBody7 = {
  ids: [bid3.itemId],
  entityId,
  itemStatus: constants.bidItemStatus.underConsideration
};

const eventBody8 = {
  ids: [bid4.itemId],
  entityId,
  suitabilityType: 'isViewed',
  suitabilityValue: true
};

const eventBody9 = {
  ids: [bid4.itemId],
  entityId,
  suitabilityType: 'isSaved',
  suitabilityValue: true
};

const eventBody10 = {
  ids: [bid4.itemId],
  entityId,
  suitabilityType: 'isHidden',
  suitabilityValue: true
};

const bidEvent1 = {
  body: JSON.stringify(eventBody1),
  requestContext: {
    identity: {
      cognitoIdentityId: userId1
    }
  },
  pathParameters: {
    id: `${jobId}_${talentId}`,
  }
};

const bidEvent2 = {
  body: JSON.stringify(eventBody2),
  requestContext: {
    identity: {
      cognitoIdentityId: userId1
    }
  },
  pathParameters: {
    id: `${jobId}_${talentId}`,
  }
};

const bidsEvent3 = {
  body: JSON.stringify(eventBody3),
  requestContext: {
    identity: {
      cognitoIdentityId: userId1
    }
  },
  pathParameters: {
    id: undefined,
  }
};

const bidsEvent4 = {
  body: JSON.stringify(eventBody4),
  requestContext: {
    identity: {
      cognitoIdentityId: userId1
    }
  },
  pathParameters: {
    id: undefined,
  }
};

const bidsEvent5 = {
  body: JSON.stringify(eventBody5),
  requestContext: {
    identity: {
      cognitoIdentityId: userId1
    }
  },
  pathParameters: {
    id: undefined,
  }
};

const bidsEvent6 = {
  body: JSON.stringify(eventBody6),
  requestContext: {
    identity: {
      cognitoIdentityId: userId1
    }
  },
  pathParameters: {
    id: undefined,
  }
};

const bidsEvent7 = {
  body: JSON.stringify(eventBody7),
  requestContext: {
    identity: {
      cognitoIdentityId: userId1
    }
  },
  pathParameters: {
    id: undefined,
  }
};

const bidsEvent8 = {
  body: JSON.stringify(eventBody8),
  requestContext: {
    identity: {
      cognitoIdentityId: userId3
    }
  },
  pathParameters: {
    id: `${jobId2}_${talentId4}`,
  }
};

const bidsEvent9 = {
  body: JSON.stringify(eventBody9),
  requestContext: {
    identity: {
      cognitoIdentityId: userId3
    }
  },
  pathParameters: {
    id: `${jobId2}_${talentId4}`,
  }
};

const bidsEvent10 = {
  body: JSON.stringify(eventBody10),
  requestContext: {
    identity: {
      cognitoIdentityId: userId3
    }
  },
  pathParameters: {
    id: `${jobId2}_${talentId4}`,
  }
};

const noPermissionsEvent = {
  body: JSON.stringify(eventBody1),
  requestContext: {
    identity: {
      cognitoIdentityId: 'notExistingUser'
    }
  },
  pathParameters: {
    id: `${jobId}_${talentId}`,
  }
};

const auditDesiredResults = [
  {
    companyId: 'UPDATEBID-JEST-TEST-COMPANYID',
    itemData: {
      itemId: 'UPDATEBID-JEST-TEST-JOBID-2_UPDATEBID-JEST-TEST-TALENTID-4',
      jobId: 'UPDATEBID-JEST-TEST-JOBID-2',
      actionType: 'bidViewed',
      bidItemData: { name: 'UPDATEBID-JEST-TEST-TALENTID-4', viewedBy: ['UPDATEBID-JEST-TEST-USER-3'] },
      userId: 'UPDATEBID-JEST-TEST-USER-3'
    },
  },
  {
    companyId: 'UPDATEBID-JEST-TEST-COMPANYID',
    itemData: {
      itemId: 'UPDATEBID-JEST-TEST-JOBID-2_UPDATEBID-JEST-TEST-TALENTID-4',
      jobId: 'UPDATEBID-JEST-TEST-JOBID-2',
      actionType: 'bidSaved',
      bidItemData: {
        name: 'UPDATEBID-JEST-TEST-TALENTID-4',
        hiddenBy: [],
        viewedBy: ['UPDATEBID-JEST-TEST-USER-3'],
        savedBy: ['UPDATEBID-JEST-TEST-USER-3']
      },
      userId: 'UPDATEBID-JEST-TEST-USER-3'
    },
  },
  {
    companyId: 'UPDATEBID-JEST-TEST-COMPANYID',
    itemData: {
      itemId: 'UPDATEBID-JEST-TEST-JOBID-2_UPDATEBID-JEST-TEST-TALENTID-4',
      jobId: 'UPDATEBID-JEST-TEST-JOBID-2',
      actionType: 'bidHidden',
      bidItemData: {
        name: 'UPDATEBID-JEST-TEST-TALENTID-4',
        hiddenBy: ['UPDATEBID-JEST-TEST-USER-3'],
        viewedBy: ['UPDATEBID-JEST-TEST-USER-3'],
        savedBy: []
      },
      userId: 'UPDATEBID-JEST-TEST-USER-3'
    },
  }
]

const auditsToDelete = [];

describe('bidPut', () => {
  beforeAll(async () => {
    let result = await usersService.create(user1);
    expect(result).toEqual(user1);
    result = await usersService.create(user3);
    expect(result).toEqual(user3);
    result = await bidsService.create(bid1);
    expect(result).toEqual(bid1);
    result = await bidsService.create(bid2);
    expect(result).toEqual(bid2);
    result = await bidsService.create(bid3);
    expect(result).toEqual(bid3);
    result = await bidsService.create(bid4);
    expect(result).toEqual(bid4);
    result = await jobsService.create(job1);
    expect(result).toEqual(job1);
    result = await jobsService.create(job2);
    expect(result).toEqual(job2);
  });

  it('update bid, expect unauthorised', async () => {
    const response = await wrappedUpdateBid.run(noPermissionsEvent);
    expect(response.statusCode).toBe(403);
  });

  it('updateBid - user pinnes bid', async () => {
    let response = await wrappedUpdateBid.run(bidEvent1);
    expect(response.statusCode).toBe(200);
    let result = await bidsService.get(entityId, bid1.itemId);
    expect(result.itemData.pinnedBy).toEqual([userId2, userId1]);
    response = await wrappedUpdateBid.run(bidEvent2);
    expect(response.statusCode).toBe(200);
    result = await bidsService.get(entityId, bid1.itemId);
    expect(result.itemData).toEqual(bid1.itemData);
  });

  it('updateBids - user pinnes multiple bids', async () => {
    let response = await wrappedUpdateBid.run(bidsEvent3);
    expect(response.statusCode).toBe(200);
    let result = await bidsService.get(entityId, bid1.itemId);
    expect(result.itemData.pinnedBy).toEqual([userId2, userId1]);
    result = await bidsService.get(entityId, bid2.itemId);
    expect(result.itemData.pinnedBy).toEqual([userId2, userId1]);
    response = await wrappedUpdateBid.run(bidsEvent4);
    expect(response.statusCode).toBe(200);
    result = await bidsService.get(entityId, bid1.itemId);
    expect(result.itemData).toEqual(bid1.itemData);
    result = await bidsService.get(entityId, bid2.itemId);
    expect(result.itemData).toEqual(bid2.itemData);
  });

  it('updateBids - user pinnes multiple bids with wrong id', async () => {
    let response = await wrappedUpdateBid.run(bidsEvent5);
    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body)
    expect(responseBody[0].value.Attributes.itemData.pinnedBy).toEqual([userId2, userId1]);
    expect(responseBody[1].value.Attributes.itemData.pinnedBy).toEqual([userId2, userId1]);
    expect(responseBody[2].value.statusCode).toBe(500); // wrong id
    let result = await bidsService.get(entityId, bid1.itemId);
    expect(result.itemData.pinnedBy).toEqual([userId2, userId1]);
    result = await bidsService.get(entityId, bid2.itemId);
    expect(result.itemData.pinnedBy).toEqual([userId2, userId1]);
  });

  it('updateBid - update statutses', async () => {
    let response = await wrappedUpdateBid.run(bidsEvent6);
    expect(response.statusCode).toBe(200);
    let responseBody = JSON.parse(response.body)
    let bidStatus = responseBody[0].value.Attributes.itemStatus;
    expect(bidStatus).toBe(constants.bidItemStatus.viewed);
    response = await wrappedUpdateBid.run(bidsEvent7);
    expect(response.statusCode).toBe(200);
    responseBody = JSON.parse(response.body)
    bidStatus = responseBody[0].value.Attributes.itemStatus;
    expect(bidStatus).toBe(constants.bidItemStatus.underConsideration);
    response = await wrappedUpdateBid.run(bidsEvent6);
    responseBody = JSON.parse(response.body)
    expect(response.statusCode).toBe(200);
    expect(responseBody[0].value.statusCode).toBe(500);
  })

  it('updateBid - user pinnes bid with view only user expect 403', async () => {
    await usersService.update({
      userId: user1.userId, entityId: user1.entityId, modifiedBy: user1.userId, itemData: {
        userRole: constants.user.role.user,
        isEditor: false
      }
    })
    const response = await wrappedUpdateBid.run(bidEvent1);
    expect(response.statusCode).toBe(403);
  });

  it('updateBids - user viewed, saved and hid bid. check if audit is sent', async () => {
    let response = await wrappedUpdateBid.run(bidsEvent8);
    expect(response.statusCode).toBe(200);
    response = await wrappedUpdateBid.run(bidsEvent9);
    expect(response.statusCode).toBe(200);
    response = await wrappedUpdateBid.run(bidsEvent10);
    expect(response.statusCode).toBe(200);
    let auditResult = await auditService.list(companyId, constants.audit.types.talentHistory);
    expect(auditResult.length).toBe(3);
    auditResult.forEach((item, index) => {
      auditsToDelete.push(item.itemId);
      expect(item.itemData).toEqual(auditDesiredResults[index].itemData);
    })

  });

  afterAll(async () => {
    let result = await bidsService.delete(entityId, bid1.itemId);
    expect(result).toBe(true);
    result = await bidsService.delete(entityId, bid2.itemId);
    expect(result).toBe(true);
    result = await bidsService.delete(entityId, bid3.itemId);
    expect(result).toBe(true);
    result = await bidsService.delete(entityId, bid4.itemId);
    expect(result).toBe(true);
    result = await usersService.delete(user1.userId, entityId);
    expect(result).toBe(true);
    result = await usersService.delete(user3.userId, entityId);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, jobId);
    expect(result).toBe(true);
    result = await jobsService.delete(entityId, jobId2);
    expect(result).toBe(true);
    auditsToDelete.forEach(async (auditId) => {
      result = await auditService.delete(companyId, auditId);
      expect(result).toBe(true);
    })
  });

});


