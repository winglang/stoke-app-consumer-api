const { constants, JobsService, UsersService, BudgetsService, CompaniesService, permisionConstants } = require("stoke-app-common-api");

const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const createUser = (userId, entityId, companyId, role = constants.user.role.user, isEditor = false, teams) => ({
    userId,
    entityId,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: { userRole: role, isEditor,
        permissionsComponents: {
            [permisionConstants.permissionsComponentsKeys.users]: { isEditor: true },
        }
    },
    ...(teams && { tags: { [constants.tags.teams]: teams }}),
});

const createCompanyUser = (companyId, userpoolUserId, userId, firstName) => ({
    itemId: userpoolUserId,
    companyId,
    userId,
    itemStatus: constants.user.status.active,
    itemData: {
        givenName: firstName,
        familyName: 'Family'
    }
})

class CompanyCreator {

    constructor(companyName) {
        this.companyName = companyName;

        this.companyId = `JEST-${companyName}-COMP`;
        this.entityId1 = `JEST-${companyName}-ENTITY1`;
        this.entityId2 = `JEST-${companyName}-ENTITY2`;
        this.entityId3 = `JEST-${companyName}-ENTITY3`;
        this.entityId4 = `JEST-${companyName}-ENTITY4`;
        this.teamName1 = `JEST-${companyName}-TEAM1`;
        this.teamName2 = `JEST-${companyName}-TEAM2`;

        this.userId1 = `JEST-${companyName}-USER1-with-completed-job`;  // entity 1 - completed job
        this.userId2 = `JEST-${companyName}-USER2-with-active-job`;     // entity 1 - active job
        this.userId3 = `JEST-${companyName}-USER3-WITH-OLD-BUDGETS`;    // entity 2 - old budgets
        this.userId4 = `JEST-${companyName}-USER4-WITH-FUTURE-BUDGETS`; // entity 2 - future budgets
        this.userId5 = `JEST-${companyName}-USER5-with-teams`;          // entity 3 - teams
        this.userId6 = `JEST-${companyName}-USER6-with-company-pool`;   // entity companyId - company pool budget
        this.adminUserId = `JEST-${companyName}-ADMIN-1`;
        this.adminUserId2 = `JEST-${companyName}-ADMIN-2`;
        this.ssoUserId = `JEST-${companyName}-SSOUSER-with-teams`;

        this.userPoolUserId1 = constants.prefix.userPoolId + `JEST-${companyName}-userpoolUSER1`;
        this.userPoolUserId2 = constants.prefix.userPoolId + `JEST-${companyName}-userpoolUSER2`;
        this.userPoolUserId3 = constants.prefix.userPoolId + `JEST-${companyName}-userpoolUSER3`;
        this.userPoolUserId4 = constants.prefix.userPoolId + `JEST-${companyName}-userpoolUSER4`;
        this.userPoolUserId5 = constants.prefix.userPoolId + `JEST-${companyName}-userpoolUSER5`;
        this.userPoolUserId6 = constants.prefix.userPoolId + `JEST-${companyName}-userpoolUSER6`;
        this.userPoolInvitedUserId = constants.prefix.userPoolId + `JEST-${companyName}-userpoolInvited1`;
        this.userPoolAdminUserId = constants.prefix.userPoolId + `JEST-${companyName}-userpoolADMIN1`;
        this.userPoolSsoUserId = constants.prefix.userPoolId + constants.prefix.external + `JEST-${companyName}-userpoolUSER5`;

        this.users = [
            createUser(this.userId1, this.entityId1, this.companyId),
            createUser(this.userId1, this.entityId2, this.companyId),
            createUser(this.userId2, this.entityId1, this.companyId),
            createUser(this.userId2, this.entityId2, this.companyId),
            createUser(this.userId3, this.entityId1, this.companyId),
            createUser(this.userId3, this.entityId2, this.companyId),
            createUser(this.userId4, this.entityId1, this.companyId),
            createUser(this.userId4, this.entityId2, this.companyId),
            createUser(this.userId5, this.entityId3, this.companyId, undefined, undefined, [this.teamName1, this.teamName2]),
            createUser(this.userId6, this.entityId4, this.companyId, undefined, undefined, [this.teamName1, this.teamName2]),
            createUser(this.ssoUserId, this.entityId1, this.companyId, undefined, undefined, [this.teamName1, this.teamName2]),
            createUser(this.adminUserId, this.entityId1, this.companyId, constants.user.role.admin, true),
            createUser(this.adminUserId, this.entityId2, this.companyId, constants.user.role.admin, true),
            createUser(this.adminUserId, this.entityId3, this.companyId, constants.user.role.admin, true),
            createUser(this.adminUserId, this.companyId, this.companyId, constants.user.role.admin, true),
            createUser(this.adminUserId2, this.companyId, this.companyId, constants.user.role.admin, true),
            createUser(this.adminUserId2, this.entityId2, this.companyId, constants.user.role.admin, true),
        ];

        this.companyUsers = [
            createCompanyUser(this.companyId, this.userPoolUserId1, this.userId1, 'User One'),
            createCompanyUser(this.companyId, this.userPoolUserId2, this.userId2, 'User Two'),
            createCompanyUser(this.companyId, this.userPoolUserId3, this.userId3, 'User Three'),
            createCompanyUser(this.companyId, this.userPoolUserId4, this.userId4, 'User Four'),
            createCompanyUser(this.companyId, this.userPoolUserId5, this.userId5, 'User Five'),
            createCompanyUser(this.companyId, this.userPoolUserId6, this.userId6, 'User Six'),
            createCompanyUser(this.companyId, this.userPoolInvitedUserId, undefined, 'Invited User'),
            createCompanyUser(this.companyId, this.userPoolAdminUserId, this.adminUserId, 'Admin User'),
            createCompanyUser(this.companyId, this.userPoolSsoUserId, this.ssoUserId, 'SSo User'),
        ];

        // jobs are in entityId1
        this.jobs = [
            {
                companyId: this.companyId,
                entityId: this.entityId1,
                itemId: 'job_completedJob',
                userId: this.userId1,
                itemStatus: constants.job.status.completed,
            },
            {
                companyId: this.companyId,
                entityId: this.entityId1,
                itemId: 'job_activeJob',
                userId: this.userId2,
                itemStatus: constants.job.status.active,
            },
            {
                companyId: this.companyId,
                entityId: this.entityId3,
                itemId: 'job_activeJob_with_team',
                userId: this.userId5,
                itemStatus: constants.job.status.active,
                tags: {
                    [constants.tags.teams]: this.teamName2,
                }
            },
            {
                companyId: this.companyId,
                entityId: this.entityId1,
                itemId: 'job_activeJob_with_team_sso',
                userId: this.userPoolSsoUserId,
                itemStatus: constants.job.status.completed,
            }
        ];

        // budgets are in entityId2
        this.budgets = [
            {
                entityId: this.entityId2,
                itemId: constants.prefix.user + this.userId3,
                companyId: this.companyId,
                userId: this.userId3,
                itemData: {
                    "2020": {
                        "1": { allocated: 0, available: 0, committed: 0, pending: 10, approved: 0, total: 10 },
                        "2": { allocated: 0, available: 0, committed: 10, pending: 0, approved: 0, total: 10 },
                        "3": { allocated: 0, available: 10, committed: 0, pending: 0, approved: 0, total: 10 },
                        "4": { allocated: 0, available: 10, committed: 0, pending: 0, approved: 0, total: 10 },
                        "periods": 4
                    },
                    "2021": {
                        "1": { allocated: 0, available: 0, committed: 0, pending: 0, approved: 10, total: 10 },
                        "2": { allocated: 0, available: 0, committed: 0, pending: 0, approved: 0, total: 0 },
                        "3": { allocated: 0, available: 0, committed: 0, pending: 0, approved: 0, total: 0 },
                        "4": { allocated: 0, available: 0, committed: 0, pending: 0, approved: 0, total: 0 },
                        "periods": 4
                    },
                },
            },
            {
                entityId: this.entityId2,
                itemId: constants.prefix.user + this.userId4,
                companyId: this.companyId,
                userId: this.userId4,
                itemData: {
                    "2030": {
                        "1": { allocated: 0, available: 10, committed: 0, pending: 0, approved: 0, total: 10 },
                        "2": { allocated: 0, available: 0, committed: 10, pending: 0, approved: 0, total: 10 },
                        "3": { allocated: 0, available: 0, committed: 0, pending: 10, approved: 0, total: 10 },
                        "4": { allocated: 0, available: 0, committed: 0, pending: 0, approved: 10, total: 10 },
                        "periods": 4
                    },
                },
            },
            {
                entityId: this.companyId,
                itemId: constants.prefix.user + this.userId6,
                companyId: this.companyId,
                userId: this.userId6,
                itemData: {
                    "2030": {
                        "1": { allocated: 0, available: 10, committed: 0, pending: 0, approved: 0, total: 10 },
                        "2": { allocated: 0, available: 0, committed: 10, pending: 0, approved: 0, total: 10 },
                        "3": { allocated: 0, available: 0, committed: 0, pending: 10, approved: 0, total: 10 },
                        "4": { allocated: 0, available: 0, committed: 0, pending: 0, approved: 10, total: 10 },
                        "periods": 4
                    },
                },
            },
        ];

    }

    async create() {
        for (const user of this.users) {
            await usersService.create(user);
        }
        for (const companyUser of this.companyUsers) {
            await companiesService.create(companyUser);
        }
        for (const job of this.jobs) {
            await jobsService.create(job);
        }
        for (const budget of this.budgets) {
            await budgetsService.create(budget);
        }
    }

    async delete() {
        for (const user of this.users) {
            await usersService.delete(user.userId, user.entityId);
        }
        for (const companyUser of this.companyUsers) {
            await companiesService.delete(companyUser.itemId);
        }
        for (const job of this.jobs) {
            await jobsService.delete(job.entityId, job.itemId);
        }
        for (const budget of this.budgets) {
            await budgetsService.delete(budget.entityId, budget.itemId);
        }
    }

}

module.exports = CompanyCreator;
