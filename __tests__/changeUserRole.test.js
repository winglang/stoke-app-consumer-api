'use strict';

const _ = require('lodash');
const mod = require('../src/users/changeUserRole.js');
const jestPlugin = require('serverless-jest-plugin');
const { UsersService, constants, permisionConstants } = require('stoke-app-common-api');
const usersService = new UsersService(
    process.env.consumerAuthTableName,
    constants.projectionExpression.defaultAttributes,
    constants.attributeNames.defaultAttributes,
);
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapperUpdateUser = lambdaWrapper.wrap(mod, { handler: 'handler' });

const userIdToUpdate = 'updateUserInAllCompanyEntities_USER_001';
const userIdOriginalCreator = 'updateUserInAllCompanyEntities_user_ORIGINAL_CREATOR';
const userIdCompanyAdmin = 'updateUserInAllCompanyEntities_user_COMPANY_ADMIN';
const userIdCompanyAdmin2 = 'updateUserInAllCompanyEntities_user_COMPANY_ADMIN-2';
const userIdCompanyAdmin3 = 'updateUserInAllCompanyEntities_user_COMPANY_ADMIN-3';
const userIdCustomRoleNoBudgetPermission = 'updateUserInAllCompanyEntities_user_No_budget_permission';
const userIdWorkspaceAdmin = 'updateUserInAllCompanyEntities_user_WORKSPACE_ADMIN';
const userIdRegular = 'updateUserInAllCompanyEntities_user_REGULAR_USER';
const entityId_1 = 'updateUserInAllCompanyEntities_ENTITY_001';
const entityId_2 = 'updateUserInAllCompanyEntities_ENTITY_002';
const companyId = 'updateUserInAllCompanyEntities_COMPANY_001';

const createUserAuthObject = (userId, entityId, itemData, tags = null) => {
    return {
        userId,
        entityId,
        companyId,
        createdAt: 1642934283602,
        createdBy: userIdOriginalCreator,
        itemData,
        itemStatus: constants.itemStatus.active,
        modifiedAt: 1642934283602,
        modifiedBy: userIdOriginalCreator,
        tags,
    };
};

const adminItemData = {
    isEditor: true,
    userRole: constants.user.role.admin,
};

const adminItemDataCustomRole = {
    isEditor: true,
    userRole: constants.user.role.admin,
    permissionsComponents: {
        [permisionConstants.permissionsComponentsKeys.users]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.workflows]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.talentsCustomField]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.jobsCustomField]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.po]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.legal]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.billing]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.integrations]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.funding]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.advancedSettings]: { isEditor: true },
    }
}

const adminItemDataCustomRoleHigherRole = {
    isEditor: true,
    userRole: constants.user.role.admin,
    permissionsComponents: {
        [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.workflows]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.talentsCustomField]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.jobsCustomField]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.po]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.legal]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.billing]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.integrations]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.funding]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.advancedSettings]: { isEditor: true },
    }
}

const adminItemDataCustomRoleNoBudgetPermissions = {
    isEditor: true,
    userRole: constants.user.role.admin,
    permissionsComponents: {
        [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.workflows]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.talentsCustomField]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.jobsCustomField]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: false },
        [permisionConstants.permissionsComponentsKeys.po]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.legal]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.billing]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.integrations]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.funding]: { isEditor: true },
        [permisionConstants.permissionsComponentsKeys.advancedSettings]: { isEditor: true },
    }
}


const viewerItemData = {
    isEditor: false,
    userRole: constants.user.role.admin,
};


const userItemData = {
    isEditor: true,
    userRole: constants.user.role.user,
};


const permissionsComponents1 = {
    [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true },
    [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: true },
    [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: false },
    [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: false },
    [permisionConstants.permissionsComponentsKeys.workflows]: { isEditor: true },
    [permisionConstants.permissionsComponentsKeys.talentsCustomField]: { isEditor: true },
    [permisionConstants.permissionsComponentsKeys.jobsCustomField]: { isEditor: true },
    [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true },
    [permisionConstants.permissionsComponentsKeys.po]: { isEditor: true },
    [permisionConstants.permissionsComponentsKeys.legal]: { isEditor: true },
    [permisionConstants.permissionsComponentsKeys.billing]: { isEditor: true },
    [permisionConstants.permissionsComponentsKeys.integrations]: { isEditor: true },
    [permisionConstants.permissionsComponentsKeys.funding]: { isEditor: true },
    [permisionConstants.permissionsComponentsKeys.advancedSettings]: { isEditor: true },
};

const permissionsComponents2 = {
    ...adminItemDataCustomRoleHigherRole.permissionsComponents,
    [permisionConstants.permissionsComponentsKeys.talentsCustomField]: { isEditor: false },
};

const notValidPermissionsComponents = {
    Stam_component: { isEditor: true },
};

const notValidPermissionForWorkspaceScope = {
    [permisionConstants.permissionsComponentsKeys.po]: { isEditor: true },
};

const userAuth_user1_user_entity1 = createUserAuthObject(userIdToUpdate, entityId_1, userItemData, {
    __stoke__teams: [],
});

const userAuth_user1_viewer_entity2 = createUserAuthObject(userIdToUpdate, entityId_2, viewerItemData);

const userAuth_companyAdmin_companyId = createUserAuthObject(userIdCompanyAdmin, companyId, adminItemData);
const userAuth_companyAdmin_entity1 = createUserAuthObject(userIdCompanyAdmin, entityId_1, adminItemData);
const userAuth_companyAdmin_entity2 = createUserAuthObject(userIdCompanyAdmin, entityId_2, adminItemData);
const userAuth_companyAdmin2_companyId = createUserAuthObject(userIdCompanyAdmin2, companyId, adminItemDataCustomRole);
const userAuth_companyAdmin2_entityId1 = createUserAuthObject(userIdCompanyAdmin2, entityId_1, adminItemDataCustomRole);
const userAuth_companyAdmin2_entityId2 = createUserAuthObject(userIdCompanyAdmin2, entityId_2, adminItemDataCustomRole);
const userAuth_companyAdmin3_companyId = createUserAuthObject(userIdCompanyAdmin3, companyId, adminItemDataCustomRoleHigherRole);
const userAuth_companyAdmin3_entityId1 = createUserAuthObject(userIdCompanyAdmin3, entityId_1, adminItemDataCustomRoleHigherRole);
const userAuth_companyAdmin3_entityId2 = createUserAuthObject(userIdCompanyAdmin3, entityId_2, adminItemDataCustomRoleHigherRole);
const userAuth_workspaceAdmin_entity1 = createUserAuthObject(userIdWorkspaceAdmin, entityId_1, adminItemData);
const userAuth_adminCustomRole_no_budget_permission = createUserAuthObject(userIdCustomRoleNoBudgetPermission, entityId_1, adminItemDataCustomRoleNoBudgetPermissions);

const userAuth_regularUser_entity1 = createUserAuthObject(userIdRegular, entityId_1, userItemData);

const createUpdateEvent = (userId, userRole, isEditor, userToUpdate = userIdToUpdate, permissionsComponents) => {
    return {
        pathParameters: {
            id: userToUpdate,
        },
        body: JSON.stringify({
            companyId,
            userRole,
            isEditor,
            permissionsComponents,
            ownerInWorkspaces: [],
        }),
        requestContext: {
            identity: {
                cognitoIdentityId: userId,
            },
        },
    };
};

const createUpdateOwnerShipEvent = (userId, userRole, isEditor, userToUpdate = userIdToUpdate, ownerInWorkspaces, isWithoutAdminRequest) => {
    return {
        pathParameters: {
            id: userToUpdate,
        },
        body: JSON.stringify({
            companyId,
            userRole,
            isEditor,
            permissionsComponents: {},
            ownerInWorkspaces,
            isWithoutAdminRequest,
        }),
        requestContext: {
            identity: {
                cognitoIdentityId: userId,
            },
        },
    };
}

const removeDateAttributes = (body) =>
    _.map(body, (b) => {
        delete b.modifiedAt;
        return b;
    });

describe('updateUser', () => {
    beforeEach(async () => {
        let response = await usersService.create(userAuth_user1_user_entity1);
        expect(response.userId).toBe(userIdToUpdate);
        response = await usersService.create(userAuth_user1_viewer_entity2);
        expect(response.userId).toBe(userIdToUpdate);
        response = await usersService.create(userAuth_companyAdmin_companyId);
        expect(response.userId).toBe(userIdCompanyAdmin);
        response = await usersService.create(userAuth_companyAdmin_entity1);
        expect(response.userId).toBe(userIdCompanyAdmin);
        response = await usersService.create(userAuth_companyAdmin_entity2);
        expect(response.userId).toBe(userIdCompanyAdmin);
        response = await usersService.create(userAuth_workspaceAdmin_entity1);
        expect(response.userId).toBe(userIdWorkspaceAdmin);
        response = await usersService.create(userAuth_regularUser_entity1);
        expect(response.userId).toBe(userIdRegular);
        response = await usersService.create(userAuth_companyAdmin2_companyId);
        expect(response.userId).toBe(userIdCompanyAdmin2);
        response = await usersService.create(userAuth_companyAdmin2_entityId1);
        expect(response.userId).toBe(userIdCompanyAdmin2);
        response = await usersService.create(userAuth_companyAdmin2_entityId2);
        expect(response.userId).toBe(userIdCompanyAdmin2);
        response = await usersService.create(userAuth_companyAdmin3_companyId);
        expect(response.userId).toBe(userIdCompanyAdmin3);
        response = await usersService.create(userAuth_companyAdmin3_entityId1);
        expect(response.userId).toBe(userIdCompanyAdmin3);
        response = await usersService.create(userAuth_companyAdmin3_entityId2);
        expect(response.userId).toBe(userIdCompanyAdmin3);
        response = await usersService.create(userAuth_adminCustomRole_no_budget_permission);
        expect(response.userId).toBe(userIdCustomRoleNoBudgetPermission);
        userAuth_adminCustomRole_no_budget_permission
    });

    it('company admin update user in all workspaces, expect 200', async () => {
        const updateUserEvent = createUpdateEvent(userIdCompanyAdmin, constants.user.role.user, true);
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(200);
        const body = removeDateAttributes(JSON.parse(response.body));
        expect(body).toMatchObject([
            {
                modifiedBy: 'updateUserInAllCompanyEntities_user_COMPANY_ADMIN',
                itemData: { userRole: 'user', isEditor: true },
                entityId: 'updateUserInAllCompanyEntities_ENTITY_001',
                userId: 'updateUserInAllCompanyEntities_USER_001',
            },
            {
                modifiedBy: 'updateUserInAllCompanyEntities_user_COMPANY_ADMIN',
                itemData: { userRole: 'user', isEditor: true },
                entityId: 'updateUserInAllCompanyEntities_ENTITY_002',
                userId: 'updateUserInAllCompanyEntities_USER_001',
            },
        ]);
    });

    it('company admin update user with custom role in all workspaces, expect 200', async () => {
        const updateUserEvent = createUpdateEvent(
            userIdCompanyAdmin,
            constants.user.role.admin,
            true,
            userIdCompanyAdmin2,
            permissionsComponents1,
        );
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(200);
        const body = removeDateAttributes(JSON.parse(response.body));

        expect(body).toMatchObject([
            {
                modifiedBy: 'updateUserInAllCompanyEntities_user_COMPANY_ADMIN',
                itemData: {
                    userRole: 'admin',
                    isEditor: true,
                    permissionsComponents: permissionsComponents1,
                    isBudgetOwner: false,
                    isJobsApprover: false,
                    ownerOfTeams: [],
                },
                entityId: 'updateUserInAllCompanyEntities_COMPANY_001',
                userId: userIdCompanyAdmin2,
            },
            {
                modifiedBy: 'updateUserInAllCompanyEntities_user_COMPANY_ADMIN',
                itemData: {
                    userRole: 'admin',
                    isEditor: true,
                    permissionsComponents: permissionsComponents1,
                    isBudgetOwner: false,
                    isJobsApprover: false,
                    ownerOfTeams: [],
                },
                entityId: 'updateUserInAllCompanyEntities_ENTITY_001',
                userId: userIdCompanyAdmin2,
            },
            {
                modifiedBy: 'updateUserInAllCompanyEntities_user_COMPANY_ADMIN',
                itemData: {
                    userRole: 'admin',
                    isEditor: true,
                    permissionsComponents: permissionsComponents1,
                    isBudgetOwner: false,
                    isJobsApprover: false,
                    ownerOfTeams: [],
                },
                entityId: 'updateUserInAllCompanyEntities_ENTITY_002',
                userId: userIdCompanyAdmin2,
            },
        ]);
    });

    it('company admin update user try to change role custom role from workspace role to company scope, expect 500', async () => {
        const updateUserEvent = createUpdateEvent(
            userIdCompanyAdmin,
            constants.user.role.admin,
            true,
            undefined,
            permissionsComponents1,
        );
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(500);
    });

    it('company admin update user with not valid custom role, expect 500', async () => {
        const updateUserEvent = createUpdateEvent(
            userIdCompanyAdmin,
            constants.user.role.admin,
            true,
            undefined,
            notValidPermissionsComponents,
        );
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(500);
    });

    it('custom role update try to change role to higher roles, expect 500', async () => {
        const updateUserEvent = createUpdateEvent(
            userIdCompanyAdmin,
            constants.user.role.admin,
            true,
            undefined,
            notValidPermissionsComponents,
        );
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(500);
    });

    it('workspace admin try to update user on his workspaces and sucessedes (request to change role), expect 202', async () => {
        const updateUserEvent = createUpdateEvent(userIdWorkspaceAdmin, constants.user.role.user, true);
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(202);
    });

    it('change role custom role permission workspace scope not valid settings, expect 500', async () => {
        const updateUserEvent = createUpdateEvent(
            userIdWorkspaceAdmin,
            constants.user.role.admin,
            true,
            undefined,
            notValidPermissionForWorkspaceScope,
        );
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(500);
    });

    it('change role custom role permission, user with lower permissions he requests to', async () => {
        const updateUserEvent = createUpdateEvent(
            userIdCompanyAdmin2,
            constants.user.role.admin,
            true,
            userIdCompanyAdmin3,
            permissionsComponents1,
        );
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(500);
    });

    it('change role of custom role user by custom role use - not allowed, expected 500', async () => {
        const updateUserEvent = createUpdateEvent(
            userIdCompanyAdmin2,
            constants.user.role.admin,
            true,
            userIdCompanyAdmin3,
            permissionsComponents2,
        );
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(500);
    });

    it('regular user try to update other user and fails, expect 403', async () => {
        const updateUserEvent = createUpdateEvent(userIdRegular, constants.user.role.admin, true);
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(403);
    });

    it('set owner ship to someone without budget permissions, expect 403', async () => {
        const updateUserEvent = createUpdateOwnerShipEvent(userIdCompanyAdmin, constants.user.role.admin, true, userIdCustomRoleNoBudgetPermission, [ entityId_1 ]);
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(500);
    });

    it('company admin update user owner in workspace, expect 200', async () => {
        const updateUserEvent = createUpdateOwnerShipEvent(userIdCompanyAdmin, constants.user.role.admin, true, userIdCompanyAdmin3, [ entityId_1 ]);
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(200);
    });

    it('workspace admin update user owner in workspace, expect 200', async () => {
        const updateUserEvent = createUpdateOwnerShipEvent(userIdWorkspaceAdmin, constants.user.role.admin, true, userIdCompanyAdmin3, [ entityId_1 ], true);
        let response = await wrapperUpdateUser.run(updateUserEvent);
        expect(response.statusCode).toBe(200);
    });

    afterEach(async () => {
        //cleanup
        let result = await usersService.delete(userIdToUpdate, entityId_1);
        expect(result).toBe(true);
        result = await usersService.delete(userIdToUpdate, entityId_2);
        expect(result).toBe(true);
        result = await usersService.delete(userIdCompanyAdmin, companyId);
        expect(result).toBe(true);
        result = await usersService.delete(userIdCompanyAdmin, entityId_1);
        expect(result).toBe(true);
        result = await usersService.delete(userIdCompanyAdmin, entityId_2);
        expect(result).toBe(true);
        result = await usersService.delete(userIdCompanyAdmin2, companyId);
        expect(result).toBe(true);
        result = await usersService.delete(userIdCompanyAdmin2, entityId_1);
        expect(result).toBe(true);
        result = await usersService.delete(userIdCompanyAdmin2, entityId_2);
        expect(result).toBe(true);
        result = await usersService.delete(userIdCompanyAdmin3, companyId);
        expect(result).toBe(true);
        result = await usersService.delete(userIdCompanyAdmin3, entityId_1);
        expect(result).toBe(true);
        result = await usersService.delete(userIdCompanyAdmin3, entityId_2);
        expect(result).toBe(true);
        result = await usersService.delete(userIdWorkspaceAdmin, entityId_1);
        expect(result).toBe(true);
        result = await usersService.delete(userIdRegular, entityId_1);
        expect(result).toBe(true);
        result = await usersService.delete(userIdCustomRoleNoBudgetPermission, entityId_1);
        expect(result).toBe(true);
    });
});
