/* eslint-disable valid-jsdoc */

'use strict'

const _ = require('lodash');
const { consumerAuthTableName, settingsTableName, gsiItemsByCompanyIdAndItemIdIndexName } = process.env;
const { WorkflowsService, UsersService, responseLib, jsonLogger, constants, prefixLib } = require("stoke-app-common-api");
const { prefix } = require('stoke-app-common-api/config/constants');

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const workflowsService = new WorkflowsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const isItemIdValid = (itemId) => itemId && prefixLib.getItemPrefix(itemId) === prefix.wf;

const getIsUserAuthorisedToThisWorkflow = (workflowDepartments, entitiesAdmin, role, readOnly) => {
    const isAdmin = constants.user.role.admin === role;
    if (isAdmin) {
        jsonLogger.info({ type: "TRACKING", function: "workflows::getIsUserAuthorisedToThisWorkflow", message: 'user is admin and allowed to view/create/edit this workflow' });
        return true;
    }

    const loopFunction = readOnly ? _.some : _.every;
    // eslint-disable-next-line newline-per-chained-call
    const userIsAdminWorkspaceDict = _.chain(entitiesAdmin).keyBy('entityId').mapValues(() => true).value();
    const isUserAuthorisedInTheWorkflowDepartments = loopFunction(workflowDepartments, (workspace) => userIsAdminWorkspaceDict[workspace]);
    const message = `user is ${isUserAuthorisedInTheWorkflowDepartments ? 'Authorised' : 'unAuthorised'} to ${readOnly ? 'get/list workflows' : 'create/edit this workflow'}`;
    jsonLogger.info({ type: "TRACKING", function: "workflows::getIsUserAuthorisedToThisWorkflow", params: { readOnly, userIsAdminWorkspaceDict, isUserAuthorisedInTheWorkflowDepartments }, message });
    return isUserAuthorisedInTheWorkflowDepartments;
}

/**
 * get companyId and workflow from event body and create a new workflow in the database
 * the workflow attributes spread in the given object (there is no itemData)
 * the response is the created workflow (in it's valid state, with itemData)
 */
module.exports.createWorkflow = async (event, context) => {
    jsonLogger.info({ type: 'TRACKING', function: 'workflows::createWorkflow', event, context });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body);
    const { companyId, workflow } = data;
    jsonLogger.info({ type: "TRACKING", function: "workflows::createWorkflow", params: { userId, companyId, workflow } });
    if (!userId || !companyId || _.isEmpty(workflow)) {
        jsonLogger.error({ type: 'TRACKING', function: 'workflows::createWorkflow', message: 'missing required params' });
        return responseLib.failure({ status: false });
    }
    try {
        const { role, entitiesAdmin } = await usersService.getCompanyUserAuthRole(userId, companyId, true);

        const isUserUnauthorised = constants.user.role.unauthorised === role;
        if (isUserUnauthorised) {
            jsonLogger.error({ type: 'TRACKING', function: 'workflows::createWorkflow', message: 'User is not authorised' });
            return responseLib.forbidden({ status: false });
        }

        const { id, type, department = [], status: itemStatus } = workflow;

        const isUserAuthorisedToEditThisWorkflow = getIsUserAuthorisedToThisWorkflow(department, entitiesAdmin, role);

        if (!isUserAuthorisedToEditThisWorkflow) {
            jsonLogger.error({ type: 'TRACKING', function: 'workflows::createWorkflow', error: 'This user is not authorised to create this workflow on one or all of these departments', department });
            return responseLib.forbidden({ status: false });
        }

        const defaultWorkflowType = prefix.workflow;
        const newItemId = `${prefix.wf}${type || defaultWorkflowType}_${id}`;

        const workflowExist = await workflowsService.get(newItemId);
        if (workflowExist) {
            jsonLogger.error({ type: 'TRACKING', function: 'workflows::createWorkflow', error: 'workflow is already exist', newItemId });
            return responseLib.failure({ status: false });
        }
        const newItem = { itemId: newItemId, itemStatus, companyId, itemData: { ..._.omit(workflow, ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'status']) }, userId };
        const response = await workflowsService.create(newItem);
        return responseLib.success({ workflow: response });
    } catch (error) {
        jsonLogger.error({ type: 'TRACKING', function: 'workflows::createWorkflow', message: "error creating workflow" });
    }
    return responseLib.failure({ status: false });
}

module.exports.updateWorkflow = async (event, context) => {
    jsonLogger.info({ type: 'TRACKING', function: 'workflows::updateWorkflow', event, context });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body);
    const { companyId, workflow } = data;
    const { itemId, status: itemStatus } = workflow;
    jsonLogger.info({ type: "TRACKING", function: "workflows::updateWorkflow", params: { userId, companyId, itemId, workflow } });
    if (!userId || !companyId || _.isEmpty(workflow) || !isItemIdValid(itemId)) {
        jsonLogger.error({ type: 'TRACKING', function: 'workflows::updateWorkflow', message: 'missing required params', params: { userId, companyId, itemId, workflow } });
        return responseLib.failure({ status: false });
    }
    try {
        const { role, entitiesAdmin } = await usersService.getCompanyUserAuthRole(userId, companyId, true);
        const isUserUnauthorised = constants.user.role.unauthorised === role;
        if (isUserUnauthorised) {
            jsonLogger.error({ type: 'TRACKING', function: 'workflows::updateWorkflow', error: 'User is not authorised' });
            return responseLib.forbidden({ status: false });
        }
        
        const existingWorkflow = await workflowsService.get(itemId);
        const workflowDepartments = _.get(existingWorkflow, 'itemData.department', []);
        const isUserAuthorisedToEditThisWorkflow = getIsUserAuthorisedToThisWorkflow(workflowDepartments, entitiesAdmin, role);

        if (!isUserAuthorisedToEditThisWorkflow) {
            jsonLogger.error({ type: 'error', function: 'workflows::updateWorkflow', error: 'User is not authorised to edit this workflow' });
            return responseLib.forbidden({ status: false });
        }
        const newItemData = { ..._.get(existingWorkflow, 'itemData', {}), ...workflow };
        const updatedItem = { ...existingWorkflow, ...newItemData, itemStatus, modifiedBy: userId };
        jsonLogger.info({ type: "TRACKING", function: "workflows::updateWorkflow", params: { updatedItem } });

        const response = await workflowsService.update(updatedItem);

        return responseLib.success({ workflow: _.merge(existingWorkflow, _.get(response, 'Attributes')) });
    } catch (error) {
        jsonLogger.error({ type: 'TRACKING', function: 'workflows::updateWorkflow', message: "error updating workflow" });
    }
    return responseLib.failure({ status: false });
}

module.exports.deleteWorkflow = async (event, context) => {
    jsonLogger.info({ type: 'TRACKING', function: 'workflows::deleteWorkflow', event, context });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = event.queryStringParameters;
    const { companyId, workflowId } = data;
    jsonLogger.info({ type: "TRACKING", function: "workflows::deleteWorkflow", params: { userId, companyId, workflowId } });
    if (!userId || !companyId || !workflowId) {
        jsonLogger.error({ type: 'TRACKING', function: 'workflows::deleteWorkflow', message: 'missing required params', params: { userId, companyId, workflowId } });
        return responseLib.failure({ status: false });
    }
    try {
        const { role, entitiesAdmin } = await usersService.getCompanyUserAuthRole(userId, companyId, true);
        const isUserUnauthorised = constants.user.role.unauthorised === role;
        if (isUserUnauthorised) {
            jsonLogger.error({ type: 'TRACKING', function: 'workflows::deleteWorkflow', error: 'User is not authorised' });
            return responseLib.forbidden({ status: false });
        }

        const existingWorkflow = await workflowsService.get(workflowId);
        const workflowDepartments = _.get(existingWorkflow, 'itemData.department', []);
        const isUserAuthorisedToEditThisWorkflow = getIsUserAuthorisedToThisWorkflow(workflowDepartments, entitiesAdmin, role);
        if (!isUserAuthorisedToEditThisWorkflow) {
            jsonLogger.error({ type: 'error', function: 'workflows::deleteWorkflow', error: 'User is not authorised to delete this workflow' });
            return responseLib.forbidden({ status: false });
        }
        const { itemId } = existingWorkflow;
        const response = await workflowsService.archive(itemId, userId);
        if (response) {
            jsonLogger.info({ type: "TRACKING", function: "workflows::deleteWorkflow", message: `${itemId} archived successfully` });
            return responseLib.success({ workflow: { ...existingWorkflow, itemStatus: constants.itemStatus.archived } });
        }
    } catch (error) {
        jsonLogger.error({ type: 'TRACKING', function: 'workflows::deleteWorkflow', message: "error deleting workflow" });
    }
    return responseLib.failure({ status: false });
}

module.exports.getWorkflows = async (event, context) => {
    jsonLogger.info({ type: 'TRACKING', function: 'workflows::getWorkflows', event, context });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { queryStringParameters } = event;
    const { companyId, workflowTypePrefix, itemId } = queryStringParameters || {};
    jsonLogger.info({ type: "TRACKING", function: "workflows::getWorkflows", params: { userId, companyId, workflowTypePrefix, itemId } });
    if (!userId || !companyId) {
        jsonLogger.error({ type: 'TRACKING', function: 'workflows::getWorkflows', message: 'missing required params' });
        return responseLib.failure({ status: false });
    }
    try {
        const { role, entitiesAdmin } = await usersService.getCompanyUserAuthRole(userId, companyId);
        const isUserNotAuthorised = constants.user.role.unauthorised === role;
        if (isUserNotAuthorised) {
            jsonLogger.error({ type: 'TRACKING', function: 'workflows::getWorkflows', error: 'User is not authorised' });
            return responseLib.forbidden({ status: false });
        }
        const isAdmin = constants.user.role.admin === role;

        if (itemId) {
            const workflow = await workflowsService.get(itemId);
            if (workflow) {
                const workflowDepartments = _.get(workflow, 'itemData.department', []);
                const isAuthorisedToViewThisWorkflow = getIsUserAuthorisedToThisWorkflow(workflowDepartments, entitiesAdmin, role, true);
                if (!isAuthorisedToViewThisWorkflow) {
                    jsonLogger.error({ type: 'error', function: 'workflows::getWorkflows', error: 'User is not authorised to get this workflow' });
                    return responseLib.forbidden({ status: false });
                }
                const isEditable = isAdmin || getIsUserAuthorisedToThisWorkflow(workflowDepartments, entitiesAdmin, role);
                return responseLib.success({ workflow: { ...workflow, isEditable } });
            }
            jsonLogger.error({ type: 'error', function: 'workflows::getWorkflows', error: `couldn't return a workflow with the requested itemId: ${itemId}` });
            return responseLib.failure({ status: false });
        }

        const userIsAdminWorkspaceList = _.map(entitiesAdmin, (auth) => auth.entityId);
        // eslint-disable-next-line no-undefined
        const response = await workflowsService.listWorkflows(gsiItemsByCompanyIdAndItemIdIndexName, companyId, workflowTypePrefix, isAdmin ? undefined : userIsAdminWorkspaceList) || [];
        const workflows = response.map((workflow) => ({ ...workflow, isEditable: isAdmin || getIsUserAuthorisedToThisWorkflow(_.get(workflow, 'itemData.department', []), entitiesAdmin, role) }));
        return responseLib.success({ workflows });
    } catch (error) {
        jsonLogger.error({ type: 'TRACKING', function: 'workflows::getWorkflows', message: "error getting workflows" });
    }
    return responseLib.failure({ status: false });
}
