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
const wrapped = lambdaWrapper.wrap(mod, { handler: 'getWorkflows' });

const testName = 'GET-WORKFLOW';
const companyId = `${testName}-COMP-1`;
const entityId = `${testName}-ENTITY-1`;
const entityId2 = `${testName}-ENTITY-2`;
const entityId3 = `${testName}-ENTITY-3`;
const userId1 = `${testName}-admin-user-1`;
const userId5 = `${testName}-admin-user-viewer-2`;
const userId2 = `${testName}-workspace-user-1`;
const userId3 = `${testName}-user-1`;
const userId4 = `${testName}-user-2`;

const types = {
  integration: prefix.integration.slice(0, -1),
  workflow: prefix.workflow.slice(0, -1)
}

const userAuthBuilder = (userId, entityId, isAdmin, isEditor = true) => ({
  userId,
  entityId,
  companyId,
  createdBy: userId,
  modifiedBy: userId,
  itemStatus: constants.user.status.active,
  itemData: {
    ...isAdmin && { userRole: constants.user.role.admin, isEditor }
  }
});

const companyAdmin = userAuthBuilder(userId1, companyId, true);
const companyViewerAdmin = userAuthBuilder(userId5, companyId, true, false);
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
const integration2 = baseWorkflowBuilder(getUniqueId(2), userId1, [entityId2], types.integration)
const integration3 = baseWorkflowBuilder(getUniqueId(3), userId1, [entityId], types.integration)
const workflow1 = baseWorkflowBuilder(getUniqueId(4), userId1, [entityId, entityId2], types.workflow)
const workflow2 = baseWorkflowBuilder(getUniqueId(5), userId1, [entityId, entityId2], types.workflow)

const eventBuilder = (userId, params = {}) => ({
  body:
    JSON.stringify(params),
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


describe('Get workflows', () => {
  beforeAll(async () => {
    await createUserAuth(companyAdmin);
    await createUserAuth(companyViewerAdmin);
    await createUserAuth(workspaceAdmin);
    await createUserAuth(user);
    await createUserAuth(unAuthUser);
    let response = await mod.createWorkflow(eventBuilder(companyAdmin.userId, { companyId, workflow: integration1 }));
    expect(response.statusCode).toBe(200);
    response = await mod.createWorkflow(eventBuilder(companyAdmin.userId, { companyId, workflow: integration2 }));
    expect(response.statusCode).toBe(200);
    response = await mod.createWorkflow(eventBuilder(companyAdmin.userId, { companyId, workflow: integration3 }));
    expect(response.statusCode).toBe(200);
    response = await mod.createWorkflow(eventBuilder(companyAdmin.userId, { companyId, workflow: workflow1 }));
    expect(response.statusCode).toBe(200);
  });

  it('Test get workflows by company admin - success', async () => {
    let response = await wrapped.run(eventBuilder(companyAdmin.userId, { companyId, workflowTypePrefix: prefix.ws }));
    expect(response.statusCode).toBe(200);
    let parsedBody = JSON.parse(response.body);
    let { workflows } = parsedBody;
    expect(_.size(workflows)).toBe(4);

    response = await wrapped.run(eventBuilder(companyAdmin.userId, { companyId, workflowTypePrefix: prefix.integration }));
    expect(response.statusCode).toBe(200);
    parsedBody = JSON.parse(response.body);
    ({ workflows } = parsedBody);
    expect(_.size(workflows)).toBe(3);

    response = await wrapped.run(eventBuilder(companyAdmin.userId, { companyId, workflowTypePrefix: prefix.workflow }));
    expect(response.statusCode).toBe(200);
    parsedBody = JSON.parse(response.body);
    ({ workflows } = parsedBody);
    expect(_.size(workflows)).toBe(1);

    const testedItemId = `${prefix.wf}${prefix.integration}${integration1.id}`;
    response = await wrapped.run(eventBuilder(companyAdmin.userId, { companyId, itemId: testedItemId }));
    expect(response.statusCode).toBe(200);
    parsedBody = JSON.parse(response.body);
    const { workflow } = parsedBody;
    const { itemId } = workflow;
    expect(itemId).toBe(testedItemId);
  });

  it('Test get workflows by company admin viewer - success', async () => {
    let response = await wrapped.run(eventBuilder(companyViewerAdmin.userId, { companyId, workflowTypePrefix: prefix.ws }));
    expect(response.statusCode).toBe(200);
    let parsedBody = JSON.parse(response.body);
    let { workflows } = parsedBody;
    expect(_.size(workflows)).toBe(4);

    response = await wrapped.run(eventBuilder(companyViewerAdmin.userId, { companyId, workflowTypePrefix: prefix.integration }));
    expect(response.statusCode).toBe(200);
    parsedBody = JSON.parse(response.body);
    ({ workflows } = parsedBody);
    expect(_.size(workflows)).toBe(3);

    response = await wrapped.run(eventBuilder(companyViewerAdmin.userId, { companyId, workflowTypePrefix: prefix.workflow }));
    expect(response.statusCode).toBe(200);
    parsedBody = JSON.parse(response.body);
    ({ workflows } = parsedBody);
    expect(_.size(workflows)).toBe(1);

    const testedItemId = `${prefix.wf}${prefix.integration}${integration1.id}`;
    response = await wrapped.run(eventBuilder(companyViewerAdmin.userId, { companyId, itemId: testedItemId }));
    expect(response.statusCode).toBe(200);
    parsedBody = JSON.parse(response.body);
    const { workflow } = parsedBody;
    const { itemId } = workflow;
    expect(itemId).toBe(testedItemId);

    // check if viewer can edit workflow - failure
    const workflowItemData = _.get(workflow, 'itemData'); 
    const workflowWithoutItemData = _.omit(workflow, ['itemData', 'itemStatus']);
    const workflowToUpdate = { ...workflowWithoutItemData, ...workflowItemData, status: constants.itemStatus.inactive };
    response = await mod.updateWorkflow(eventBuilder(companyViewerAdmin.userId, { companyId, workflow: workflowToUpdate }));
    parsedBody = JSON.parse(response.body);
    expect(response.statusCode).toBe(403);
    // check if viewer can delete workflow - failure
    response = await mod.deleteWorkflow(eventBuilder(companyViewerAdmin.userId, { companyId, workflowId: workflowToUpdate.itemId }));
    parsedBody = JSON.parse(response.body);
    expect(response.statusCode).toBe(403);
    // check if viewer can create workflow - failure
    response = await mod.createWorkflow(eventBuilder(companyViewerAdmin.userId, { companyId, workflow: workflow2 }));
    parsedBody = JSON.parse(response.body);
    expect(response.statusCode).toBe(403);
  });

  it('Test get workflows by workspace admin - success', async () => {
    const response = await wrapped.run(eventBuilder(workspaceAdmin.userId, { companyId, workflowTypePrefix: prefix.wf }));
    expect(response.statusCode).toBe(200);
    const { workflows } = JSON.parse(response.body);
    expect(workflows.length).toBe(3);
  });

  it('Test get workflows by regular user - failure', async () => {
    const response = await wrapped.run(eventBuilder(user.userId, { companyId, workflowTypePrefix: prefix.wf }));
    expect(response.statusCode).toBe(403);
    const { status } = JSON.parse(response.body);
    expect(status).toBeFalsy();
  });

  it('Test get workflows by unauthorised user - failure', async () => {
    const response = await wrapped.run(eventBuilder(unAuthUser.userId, { companyId, workflowTypePrefix: prefix.workflow }));
    expect(response.statusCode).toBe(403);
    const { status } = JSON.parse(response.body);
    expect(status).toBeFalsy();
  });

  it('Test get workflows with missing required params - failure', async () => {
    const response = await wrapped.run(eventBuilder(unAuthUser.userId, { workflowTypePrefix: prefix.workflow }));
    expect(response.statusCode).toBe(500);
    const { status } = JSON.parse(response.body);
    expect(status).toBeFalsy();
  });

  afterAll(async () => {
    const workflows = await workflowsService.listWorkflows(process.env.gsiItemsByCompanyIdAndItemIdIndexName, companyId, prefix.wf);
    await Promise.all(workflows.map((wf) => workflowsService.delete(wf.itemId)))
    await Promise.all(users.map((user) => usersService.delete(user.userId, user.entityId)));
  });
});
