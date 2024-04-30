/* eslint-disable max-lines-per-function */

'use strict';

const _ = require('lodash');
const { UsersService, jsonLogger, constants, teamsService, responseLib, SqsService } = require('stoke-app-common-api');
const { permissionScope, permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');
const { isPermissionsComponentsValid, isUserNotAllowedToHandlePermissionsComponents } = require('stoke-app-common-api/helpers/permissonHelper');
const { consumerAuthTableName, asyncTasksQueueName } = process.env;

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const asyncTasksQueue = new SqsService(asyncTasksQueueName);

const resolveWorkspaceOwner = (userInWorkspace, ownerInWorkspaces, ownerInSpaces = []) => {
    const isBudgetOwner = _.get(userInWorkspace, 'itemData.isBudgetOwner', false);
    return ownerInWorkspaces.includes(userInWorkspace.entityId) && !_.size(ownerInSpaces) ? !isBudgetOwner : isBudgetOwner;
}

// this function toggle the exsiting spaces in ownerOfTeams, if it get ownerInWorkspaces the function toogle all the space of this user has, but if get ownerInSpace, it toggles only the space that the user send in this array
const resolveSpaceOwner = (userInWorkspace, ownerInWorkspaces, ownerInSpaces = []) => {
    const currentOwnerOfSpaces = _.get(userInWorkspace, 'itemData.ownerOfTeams', []);
    const existingSpacesInTags = _.intersection(ownerInSpaces, teamsService.get(userInWorkspace));
    const isSpaceOwnerCanChange = _.size(ownerInWorkspaces) && _.size(ownerInSpaces) && _.size(existingSpacesInTags);
    const ownerOfTeams = isSpaceOwnerCanChange ? _.xor(currentOwnerOfSpaces, existingSpacesInTags) : currentOwnerOfSpaces;
    jsonLogger.info({ type: "TRACKING", function: "changeUserRole::resolveSpaceOwner", ownerOfTeams });
    return ownerOfTeams;
}

/**
 *
 * @param {object} event lambda event, event.body is the method data, data must contain userRole: user/admin, isEditor: true/false,  optionals: ownerInWorkspaces: [array of workspaces], ownerInSpaces: [array, of spaces names] (if ownerInSpaces is passed the ownerInWorkspaces should contain only one value)
 * the function updates the userToUpdate role and permission in his existing workspaces.
 * @param {object} context lambda context
 * @returns {Array} result is array of updated userAuth objects
 */
// eslint-disable-next-line complexity
const handler = async (event, context) => {
    jsonLogger.info({ type: 'TRACKING', function: 'changeUserRole::handler', functionName: context.functionName, awsRequestId: context.awsRequestId, event });
    const data = JSON.parse(event.body);
    const userIdToUpdate = event.pathParameters.id;
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId, userRole, isEditor, ownerInWorkspaces, ownerInSpaces, permissionsComponents, isWithoutAdminRequest } = data;
    jsonLogger.info({ type: "TRACKING", function: "changeUserRole::handler", companyId, userRole, isEditor, ownerInWorkspaces, ownerInSpaces, permissionsComponents, isWithoutAdminRequest });

    const isChangeToCustomRole = !_.isEmpty(permissionsComponents);

    if (!companyId || (_.isNil(userRole) && _.isNil(isEditor) && _.isEmpty(ownerInWorkspaces) && _.isEmpty(ownerInSpaces))) {
        jsonLogger.error({ type: 'TRACKING', function: 'changeUserRole::handler', message: `missing params` });
        return responseLib.failure({ status: false });
    }

    const { role: roleOfUpdatedUser, entitiesAdmin: userToUpdateEntitiesAdmin, entitiesUser: userToUpdateEntitiesUser } = await usersService.getCompanyUserAuthRole(userIdToUpdate, companyId);
    const userPermissionScope = roleOfUpdatedUser === constants.user.role.admin ? permissionScope.companyAdmin : permissionScope.workspaceAdmin;

    if (isChangeToCustomRole && !isPermissionsComponentsValid(permissionsComponents, userPermissionScope)) {
        jsonLogger.error({ type: 'TRACKING', function: 'changeUserRole::handler', message: `not valid permissions components` });
        return responseLib.failure({ status: false });
    }

    if (!_.isEmpty(ownerInWorkspaces)) {
        const { role: userToUpdateBudgetRole } = await usersService.getCompanyUserAuthRoleWithComponents(userIdToUpdate, companyId, { [permissionsComponentsKeys.budget]: { isEditor: true } })
        if (userToUpdateBudgetRole === constants.user.role.unauthorised) {
            jsonLogger.error({ type: 'TRACKING', function: 'changeUserRole::handler', message: `set owner for someone with no budget permissions` });
            return responseLib.failure({ status: false });
        }
    }

    const userCurrentWorkspaces = _.concat(userToUpdateEntitiesUser, userToUpdateEntitiesAdmin);    
    const currentPermissionsComponents = _.get(userCurrentWorkspaces, '[0].itemData.permissionsComponents', {});
    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(userId, companyId, true);

    const requestorUserWorkspaces = _.concat(entitiesUser, entitiesAdmin);
    const requestorPermissionsComponents = _.get(requestorUserWorkspaces, '[0].itemData.permissionsComponents', {});
    const isRequestorWithCustomRole = !_.isEmpty(requestorPermissionsComponents);

    if (isChangeToCustomRole && isUserNotAllowedToHandlePermissionsComponents(permissionsComponents, requestorPermissionsComponents, currentPermissionsComponents)) {
        jsonLogger.error({ type: 'TRACKING', function: 'changeUserRole::handler', message: `user with custom role trying to change role to higher permissions than he is allowed ` });
        return responseLib.failure({ status: false });
    }


    if (isChangeToCustomRole && isRequestorWithCustomRole) {
        jsonLogger.error({ type: 'TRACKING', function: 'changeUserRole::handler', message: `user with custom role trying to change custom role user` });
        return responseLib.failure({ status: false });
    }

 
    const isRequestorCompanyAdminEditor = role === constants.user.role.admin && !isRequestorWithCustomRole;

    const isChangePermissions = !_.isNil(userRole) || !_.isNil(isEditor);

    if (!isRequestorCompanyAdminEditor && !isWithoutAdminRequest) {
        if (_.size(entitiesAdmin)) {
        jsonLogger.info({ type: 'TRACKING', function: 'changeUserRole::handler', message: `only company admins can change role and permissions` });
        try {
            const taskData = {
              companyId,
              requestingUserId: userId, 
              requestedUserData: {
                ...data, 
                requestedUserID: userIdToUpdate
            },
              listOfWorkspaces: userCurrentWorkspaces,
              isMemberToWorkspaceAdmin: userRole !== constants.user.role.user
            };
            await asyncTasksQueue.sendMessage({ taskData, type: constants.sqsAsyncTasks.types.requestToChangeUserRole });
            return responseLib.accepted({ status: true });
          } catch (e) {
            jsonLogger.error({ type: 'TRACKING', function: 'changeUserRole::handler', text: `exception - ${e.message}`, e });
            return responseLib.failure({ status: false });
          }
        }
        return responseLib.forbidden({ status: false });
    }

    if (isChangePermissions && userRole === constants.user.role.user && !isEditor) {
        jsonLogger.error({ type: 'TRACKING', function: 'changeUserRole::handler', message: `userRole of type 'user' needs to have editor permission` });
        return responseLib.failure({ status: false });
    }

    // eslint-disable-next-line no-magic-numbers
    if (_.size(ownerInWorkspaces) > 1 && _.size(ownerInSpaces)) {
        jsonLogger.error({ type: 'TRACKING', function: 'changeUserRole::handler', message: `updating multiple workspaces with multiple spaces is not supported` });
        return responseLib.failure({ status: false });
    }

    if (_.size(ownerInSpaces) && !_.size(ownerInWorkspaces)) {
        jsonLogger.error({ type: 'TRACKING', function: 'changeUserRole::handler', message: `missing workspace for given spaces`, ownerInSpaces });
        return responseLib.failure({ status: false });
    }

    const userCurrentWorkspacesSize = _.size(userCurrentWorkspaces);
    jsonLogger.info({ type: "TRACKING", function: "changeUserRole::handler", userCurrentWorkspacesSize });
    if (!userCurrentWorkspacesSize) {
        jsonLogger.error({ type: "TRACKING", function: "changeUserRole::handler", message: 'user has no workspaces' });
        return responseLib.failure({ status: false });
    }

    const userIsAdminWorkspaceList = _.map(entitiesAdmin, (auth) => auth.entityId);
    
    // eslint-disable-next-line no-undefined
    const savedPermissionsComponents = _.isEmpty(permissionsComponents) ? undefined : permissionsComponents;
    const usersToUpdate = [];
    for (const workspace of userCurrentWorkspaces) {
        const { entityId, itemData } = workspace;
        const canBeOwner = (userRole || itemData.userRole) === constants.user.role.admin && (_.isNil(isEditor) ? _.get(itemData, 'isEditor', false) : isEditor);
        if (isRequestorCompanyAdminEditor || _.includes(userIsAdminWorkspaceList, entityId)) { 
            const isBudgetOwner = canBeOwner && resolveWorkspaceOwner(workspace, ownerInWorkspaces, ownerInSpaces);
            const userItemUpdate = {
                userId: userIdToUpdate,
                entityId,
                modifiedBy: userId,
                itemData: {
                    ..._.get(workspace, 'itemData'),
                    ...!_.isNil(userRole) && isRequestorCompanyAdminEditor && { userRole },
                    ...!_.isNil(isEditor) && isRequestorCompanyAdminEditor && { isEditor },
                    isBudgetOwner,
                    isJobsApprover: isBudgetOwner,
                    ownerOfTeams: canBeOwner ? resolveSpaceOwner(workspace, ownerInWorkspaces, ownerInSpaces) : [],
                    permissionsComponents: savedPermissionsComponents,
                }
            };
            jsonLogger.info({ type: "TRACKING", function: "changeUserRole::handler", message: 'try to update workspace permissions', userItemUpdate });
            usersToUpdate.push(userItemUpdate);
        } else {
            jsonLogger.info({ type: "TRACKING", function: "changeUserRole::handler", message: 'user is not admin in this workspace', userId, entityId });
        }
    }

    const result = await Promise.all(_.map(usersToUpdate, user => usersService.update(user)));
    const resultsWithEntity = _.mergeWith(result, usersToUpdate, (objValue, srcValue) => _.assign(objValue.Attributes, { entityId: _.get(srcValue, 'entityId'), userId: _.get(srcValue, 'userId') }));
    jsonLogger.info({ type: "TRACKING", function: "changeUserRole::handler", resultsWithEntity });
    return result ? responseLib.success(resultsWithEntity) : responseLib.failure({ status: false });
}


module.exports = {
    handler
}
