/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undef */

'use strict';
const _ = require('lodash');
const mod = require('../src/workflows');
const jestPlugin = require('serverless-jest-plugin');
const { UsersService, WorkflowsService, constants } = require('stoke-app-common-api');
const { prefix } = require('stoke-app-common-api/config/constants');
const workflowsService = new WorkflowsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const { lambdaWrapper } = jestPlugin;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'deleteWorkflow' });

const testName = 'DELETE-WORKFLOW';
const companyId = `${testName}-COMP-1`;
const entityId = `${testName}-ENTITY-1`;
const entityId2 = `${testName}-ENTITY-2`;
const entityId3 = `${testName}-ENTITY-3`;
const userId1 = `${testName}-admin-user-1`;
const userId2 = `${testName}-workspace-user-1`;
const userId3 = `${testName}-user-1`;
const userId4 = `${testName}-user-2`;

const types = {
  integration: prefix.integration.slice(0, -1),
  workflow: prefix.workflow.slice(0, -1)
}

const userAuthBuilder = (userId, entityId, isAdmin) => ({
  userId,
  entityId,
  companyId,
  createdBy: userId,
  modifiedBy: userId,
  itemStatus: constants.user.status.active,
  itemData: {
    ...isAdmin && { userRole: constants.user.role.admin, isEditor: true }
  }
});

const companyAdmin = userAuthBuilder(userId1, companyId, true);
const workspaceAdmin = userAuthBuilder(userId2, entityId, true);
const user = userAuthBuilder(userId3, entityId);
const unAuthUser = userAuthBuilder(userId4, entityId3);

const baseWorkflowBuilder = (id, userId, department, type) => ({
  action: [
    {
      "key": 0,
      "name": "action",
      "value": "updateMondayOnStokeChange"
    },
    {
      "key": 1,
      "name": "board",
      "value": "1161257965"
    },
    {
      "key": 2,
      "name": "group",
      "value": "topics"
    },
    {
      "key": 3,
      "name": "fieldsMap",
      "value": [
        {
          "name": null,
          "value": {
            "mondayItem": "name",
            "mondayItem_type": "name",
            "stokeField": "talentName"
          }
        }
      ]
    }
  ],
  condition: [],
  createdAt: 1679492665597,
  createdBy: userId,
  department,
  id,
  integrationData: {
    "direction": "out",
    "vendor": "monday"
  },
  name: "When a **Milestone status** changes, **Add** or **update** an item on a **board**",
  status: 'active',
  trigger: [
    {
      "key": 0,
      "value": "milestoneStatusChanged"
    },
    {
      "key": 1,
      "name": "status",
      "value": "ALL"
    }
  ],
  triggerKey: "milestoneStatusChanged",
  type,
  updatedAt: 1679580583272,
  updatedBy: userId,
  workflowId: id
});

const getUniqueId = (id) => `${testName}-${id}`;

const integration1 = baseWorkflowBuilder(getUniqueId(1), userId1, [entityId, entityId2], types.integration)
const integration2 = baseWorkflowBuilder(getUniqueId(2), userId1, [entityId], types.integration)
const workflow1 = baseWorkflowBuilder(getUniqueId(4), userId1, [entityId, entityId2], types.workflow)

const createEventBuilder = (userId, params = {}) => ({
  body: JSON.stringify(params),
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  queryStringParameters: {
    ...params
  }
});

const deleteEventBuilder = (userId, params = {}) => ({
  queryStringParameters: params,
  requestContext: {
    identity: {
      cognitoIdentityId: userId
    }
  },
  queryStringParameters: {
    ...params
  }
});

const users = [];

const createUserAuth = async (userItem) => {
  const res = await usersService.create(userItem);
  users.push(_.pick(res, ['userId', 'entityId']));
  return res;
}


describe('Delete workflows', () => {
  beforeAll(async () => {
    await createUserAuth(companyAdmin);
    await createUserAuth(workspaceAdmin);
    await createUserAuth(user);
    await createUserAuth(unAuthUser);
  });

  it('Test delete integration by company admin - success', async () => {
    let response = await mod.createWorkflow(createEventBuilder(companyAdmin.userId, { companyId, workflow: integration1 }));
    expect(response.statusCode).toBe(200);
    let parsedBody = JSON.parse(response.body);
    const integration = _.get(parsedBody, 'workflow');
    response = await wrapped.run(deleteEventBuilder(companyAdmin.userId, { companyId, workflowId: integration.itemId }));
    expect(response.statusCode).toBe(200);
    parsedBody = JSON.parse(response.body);
    const { itemStatus } = _.get(parsedBody, 'workflow');
    expect(itemStatus).toBe('archived');
  });

  it('Test delete integration by workspace admin (the user has access to all of the workflow departments) - success', async () => {
    let response = await mod.createWorkflow(createEventBuilder(workspaceAdmin.userId, { companyId, workflow: integration2 }));
    expect(response.statusCode).toBe(200);
    let parsedBody = JSON.parse(response.body);
    const integration = _.get(parsedBody, 'workflow');
    response = await wrapped.run(deleteEventBuilder(workspaceAdmin.userId, { companyId, workflowId: integration.itemId }));
    expect(response.statusCode).toBe(200);
    parsedBody = JSON.parse(response.body);
    const { itemStatus } = _.get(parsedBody, 'workflow');
    expect(itemStatus).toBe('archived');
  });

  it('Test delete integration by workspace admin (the user has access only to 1 of the workflow departments) - failure', async () => {
    let response = await mod.createWorkflow(createEventBuilder(companyAdmin.userId, { companyId, workflow: integration1 }));
    expect(response.statusCode).toBe(200);
    const parsedBody = JSON.parse(response.body);
    const integration = _.get(parsedBody, 'workflow');
    response = await wrapped.run(deleteEventBuilder(workspaceAdmin.userId, { companyId, workflowId: integration.itemId }));
    expect(response.statusCode).toBe(403);
    const { status } = JSON.parse(response.body);
    expect(status).toBeFalsy();
  });

  it('Test delete workflow by user - failure', async () => {
    let response = await mod.createWorkflow(createEventBuilder(companyAdmin.userId, { companyId, workflow: workflow1 }));
    expect(response.statusCode).toBe(200);
    let parsedBody = JSON.parse(response.body);
    const workflow = _.get(parsedBody, 'workflow');
    response = await wrapped.run(deleteEventBuilder(user.userId, { companyId, workflowId: workflow.itemId }));
    expect(response.statusCode).toBe(403);
    const { status } = JSON.parse(response.body);
    expect(status).toBeFalsy();
  });

  it('Test delete workflow by unauthorised user - failure', async () => {
    let response = await mod.createWorkflow(createEventBuilder(companyAdmin.userId, { companyId, workflow: workflow1 }));
    expect(response.statusCode).toBe(200);
    let parsedBody = JSON.parse(response.body);
    const workflow = _.get(parsedBody, 'workflow');
    response = await wrapped.run(deleteEventBuilder(unAuthUser.userId, { companyId, workflowId: workflow.itemId }));
    expect(response.statusCode).toBe(403);
    const { status } = JSON.parse(response.body);
    expect(status).toBeFalsy();
  });

  it('Test delete integration with missing params - failure', async () => {
    let response = await mod.createWorkflow(createEventBuilder(companyAdmin.userId, { companyId, workflow: workflow1 }));
    expect(response.statusCode).toBe(200);
    let parsedBody = JSON.parse(response.body);
    const workflow = _.get(parsedBody, 'workflow');
    response = await wrapped.run(deleteEventBuilder(companyAdmin.userId, { workflowId: workflow.itemId }));
    expect(response.statusCode).toBe(500);
    const { status } = JSON.parse(response.body);
    expect(status).toBeFalsy();
  });

  afterEach(async () => {
    const workflows = await workflowsService.listWorkflows(process.env.gsiItemsByCompanyIdAndItemIdIndexName, companyId, prefix.wf, undefined, true);
    await Promise.all(workflows.map((wf) => workflowsService.delete(wf.itemId)))
  });
  afterAll(async () => {
    await Promise.all(users.map((user) => usersService.delete(user.userId, user.entityId)));
  });
});
