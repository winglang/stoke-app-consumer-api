const entities = require('../../src/entities');
const jestPlugin = require('serverless-jest-plugin');
const updateEntityStatus = jestPlugin.lambdaWrapper.wrap(entities, { handler: "updateEntityStatus" });

const { constants, BudgetsService, errorCodes, permisionConstants } = require('stoke-app-common-api');
const { users, customers, jobs } = require('stoke-app-common-api/__tests__/utils');

const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const event = (userId, entityId, itemStatus, isValidation) => {
    return {
        requestContext: {
            identity: {
                cognitoIdentityId: userId,
            }
        },
        pathParameters: {
            id: entityId,
        },
        body: JSON.stringify({ itemStatus, isValidation }),
    };
};

const companyId = 'updateEntityStatus-Company';
const entityId = 'updateEntityStatus-Entity';
const jobId = 'updateEntityStatus-Job';

const companyAdminUserId = 'updateEntityStatus-CompanyAdmin-UserId';

const budgetUserId = 'updateEntityStatus-UserId';
const budgetBase = {
    entityId,
    companyId,
    itemData: {
        2020:
        {
            periods: 4,
            1: { total: 10, approved: 0, pending: 0, committed: 0, available: 10 },
            2: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            3: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            4: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
        },
        2030:
        {
            periods: 4,
            1: { total: 14, approved: 1, pending: 1, committed: 1, available: 11 },
            2: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
            3: { total: 13, approved: 0, pending: 0, committed: 0, available: 13 },
            4: { total: 0, approved: 0, pending: 0, committed: 0, available: 0 },
        },
    },
    modifiedBy: 'updateEntityStatusCompany'
};

const budgets = [
    {
        ...budgetBase,
        itemId: constants.prefix.entity + entityId,
    },
    {
        ...budgetBase,
        itemId: constants.prefix.user + budgetUserId,
    },
    {
        ...budgetBase,
        entityId: companyId,    // company pool
        itemId: constants.prefix.user + companyAdminUserId,
    },
];

describe('updateEntityStatus Tests', () => {

    beforeEach(async () => {
        await customers.createEntity(companyId, entityId, 'Colors', 'user1', {});
        await users.create(companyId, entityId, 'user1');
        await users.createAdmin(companyId, entityId, 'entityAdmin1', null, null, null, {
            [permisionConstants.permissionsComponentsKeys.workspaces]: { isEditor: true },
        });
        await users.createAdmin(companyId, entityId, companyAdminUserId, ['ASDF']);
        await users.createAdmin(companyId, companyId, companyAdminUserId, [], false, true);
    });

    afterEach(async () => {
        await customers.deleteEntity(entityId);
        await users.remove(entityId, 'user1');
        await users.remove(entityId, 'entityAdmin1');
        await users.remove(entityId, companyAdminUserId);
        await users.remove(companyId, companyAdminUserId);
        await jobs.deleteJob(entityId, jobId);
        for (const budget of budgets) {
            await budgetsService.delete(budget.entityId, budget.itemId);
        }
    });

    test('updateEntityStatus - user is not entity admin - unauthorized', async () => {
        const result = await updateEntityStatus.run(event('user1', entityId, constants.itemStatus.inactive));
        expect(result.statusCode).toBe(403);
    });

    test('updateEntityStatus - archive entity admin successful', async () => {
        const result = await updateEntityStatus.run(event('entityAdmin1', entityId, constants.itemStatus.inactive));
        expect(result.statusCode).toBe(200);
        const data = JSON.parse(result.body);
        expect(data.status).toBe(true);
    });

    test('updateEntityStatus - archive company admin successful + unarchive successful', async () => {
        // archive
        const result1 = await updateEntityStatus.run(event(companyAdminUserId, entityId, constants.itemStatus.inactive));
        expect(result1.statusCode).toBe(200);
        const data1 = JSON.parse(result1.body);
        expect(data1.status).toBe(true);

        // unarchive
        const result2 = await updateEntityStatus.run(event(companyAdminUserId, entityId, constants.itemStatus.active));
        expect(result2.statusCode).toBe(200);
        const data2 = JSON.parse(result2.body);
        expect(data2.status).toBe(true);
    });

    test('updateEntityStatus - archive entity admin with future available budget validation - success with warning', async () => {
        for (const budget of budgets) {
            await budgetsService.create(budget);
        }
        const result = await updateEntityStatus.run(event('entityAdmin1', entityId, constants.itemStatus.inactive, true));
        expect(result.statusCode).toBe(200);
        const data = JSON.parse(result.body);
        expect(data.status).toBe(true);
        expect(data.reason).toBe(errorCodes.deleteErrors.FUTURE_BUDGETS);
    });

    test('updateEntityStatus - archive entity admin with future available budget action - success', async () => {
        for (const budget of budgets) {
            await budgetsService.create(budget);
        }
        const result = await updateEntityStatus.run(event('entityAdmin1', entityId, constants.itemStatus.inactive, false));
        expect(result.statusCode).toBe(200);
        const data = JSON.parse(result.body);
        expect(data.status).toBe(true);

        const userBudget = await budgetsService.get(entityId, constants.prefix.user + budgetUserId);
        expect(userBudget.itemData[2030][1].available).toBe(0);
        expect(userBudget.itemData[2030][3].available).toBe(0);

        const adminBudget = await budgetsService.get(companyId, constants.prefix.user + companyAdminUserId);
        expect(adminBudget.itemData[2030][1].available).toBe(22);
        expect(adminBudget.itemData[2030][3].available).toBe(26);
    });

    test('updateEntityStatus - archive entity admin with active job - fail', async () => {
        await jobs.createJob(companyId, entityId, jobId, 'moshe', Date.now(), 100, constants.itemStatus.active);
        const result = await updateEntityStatus.run(event('entityAdmin1', entityId, constants.itemStatus.inactive));
        expect(result.statusCode).toBe(200);
        const data = JSON.parse(result.body);
        expect(data.status).toBe(false);
        expect(data.reason).toBe(errorCodes.deleteErrors.NON_FINALIZED_JOBS);
    });

    test('updateEntityStatus - unarchive - entity already active - fail', async () => {
        const result = await updateEntityStatus.run(event('entityAdmin1', entityId, constants.itemStatus.active));
        expect(result.statusCode).toBe(200);
        const data = JSON.parse(result.body);
        expect(data.status).toBe(false);
    });

});
