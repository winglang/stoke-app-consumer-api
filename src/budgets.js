/* eslint-disable max-lines */
/* eslint-disable complexity */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-negated-condition */
/* eslint-disable max-depth */
/* eslint-disable max-lines-per-function */

'use strict';

const {
    consumerAuthTableName,
    budgetsTableName,
    asyncTasksQueueName,
    userActionsSnsTopicArn
} = process.env;
const { UsersService, BudgetsService, constants, jsonLogger, responseLib, SqsService, snsLib, permisionConstants } = require('stoke-app-common-api');

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const _ = require('lodash');
const asyncTasksQueue = new SqsService(asyncTasksQueueName);
const { getIsTransferAllowed } = require('./helpers/budgetsHelper');

const buildCompanyPoolItemData = () => {
    const itemData = {}
    const AMOUNT_OF_YEARS_TO_BUDGET = 5;
    const NUM_OF_QUARTER = 4;
    const DEFAULT_BUDGET = 1000000;
    const NUM_OF_PREVIOUS_YEARS = 2;

    const baseQuarter = {
        "available": DEFAULT_BUDGET,
        "total": DEFAULT_BUDGET,
        "committed": 0,
        "approved": 0,
        "pending": 0
    }
    const yearBudget = { 'periods': 4 }
    // eslint-disable-next-line no-plusplus
    for (let q = 1; q <= NUM_OF_QUARTER; q++) {
        yearBudget[q] = baseQuarter;
    }
    const currentYear = Number(new Date().getFullYear().
        toString());
    const firstYear = currentYear - NUM_OF_PREVIOUS_YEARS;
    for (const year of _.range(firstYear, currentYear + AMOUNT_OF_YEARS_TO_BUDGET)) {
        itemData[year] = yearBudget;
    }
    return itemData;
}

/**
 * create basic Budget - for user, company, entity 
 * @public
 * @param {object} data included - userId, entityId, companyId, itemId
 * @param { boolean } createCompanyPool decide if we should create a company pool for this user 
 * @returns {object} results
 */
module.exports.createBaseBudget = (data, createCompanyPool) => {
    const { userId, entityId, companyId, itemId } = data
    const item = {
        userId: userId,
        entityId: entityId,
        companyId: companyId,
        itemId: itemId,
        itemData: createCompanyPool ? buildCompanyPoolItemData() : {},
        createdBy: userId,
        modifiedBy: userId,
    }
    jsonLogger.info({ type: "TRACKING", function: "budgets::createBaseBudget", item });
    return budgetsService.create(item);
}

const resetBudgetRequest = async ({ entityId, itemId, year, period, userId, companyId }) => {
    jsonLogger.info({ type: 'TRACKING', function: 'budgets::resetBudgetRequest', entityId, itemId, year, period, userId, companyId });
    const requestItemId = `${constants.prefix.request}${itemId}`;
    const request = await budgetsService.get(entityId, requestItemId);
    // eslint-disable-next-line array-element-newline
    if (request && _.get(request, ['itemData', year, period, 'requested'], 0) > 0) {
        const { itemData } = request;
        itemData[year][period] = { requested: 0 };
        const item = {
            Key: {
                entityId,
                itemId: requestItemId,
            },
            ExpressionAttributeNames: {
                '#itemData': 'itemData',
                '#modifiedBy': 'modifiedBy',
                '#companyId': 'companyId',
            },
            ExpressionAttributeValues: {
                ':modifiedBy': userId,
                ':companyId': companyId,
                ':itemData': itemData,
            },
            ConditionExpression: '(#companyId = :companyId)',
            UpdateExpression: 'SET #itemData = :itemData ,#modifiedBy = :modifiedBy'
        };
        const resetResult = await budgetsService.update(item.Key, item.UpdateExpression, item.ExpressionAttributeValues, item.ExpressionAttributeNames, item.ConditionExpression);
        if (!resetResult) {
            jsonLogger.error({ type: 'TRACKING', function: 'budgets::resetBudgetRequest', message: 'Budget request reset failed', item });
        }
    }
}


/**
 * transferBudget - transfer Budget between two users, can be performed by Entity admin (or company admin if no entities defined)
 * sourceItemId, sourceEntityId: from whom to transfer
 * targetItemId, targetEntityId: to whom to transfer
 * year: year
 * period: period (1-4 for quarterly budget, 1 for yearly budget)
 * amount: amount to transfer
 * 
 * @public
 * @param {object} event lambda event, event.body must contain origin sourceItemId (with entityId/companyId), target targetItemId (with entityId/companyId), year, period and amount)
 * @param {object} context - lambda context
 * @returns {object} results
 */

module.exports.transferBudget = async (event, context) => {
    const data = JSON.parse(event.body);
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { sourceItemId, sourceEntityId, targetItemId, targetEntityId, year, period, amount, isApproveRequest } = data;

    jsonLogger.info({ type: 'TRACKING', function: 'budgets::transferBudget', functionName: context.functionName, awsRequestId: context.awsRequestId, userId, data, event });

    if (!sourceItemId || !sourceEntityId || !targetItemId || !targetEntityId || !year || !period || !amount) {
        return responseLib.failure({ message: 'missing mandatory params in body' });
    }
    // must be admin of both source and target
    const authorisedSource = await usersService.validateUserEntityWithComponents(userId, sourceEntityId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true } });
    if (!authorisedSource) {
        jsonLogger.error({ type: 'error', function: 'budgets::transferBudget', message: 'source is not authorised' });
        return responseLib.forbidden({ status: false });
    }

    const authorisedTargetItemId = await usersService.validateUserEntityWithComponents(targetItemId.replace(constants.prefix.user, ''), targetEntityId, null, { [permisionConstants.permissionsComponentsKeys.budget]: { } });
    if (!authorisedTargetItemId) {
        jsonLogger.error({ type: 'error', function: 'budgets::transferBudget', message: 'target is not authorised' });
        return responseLib.forbidden({ status: false });
    }

    let isCompanyAdmin = false;
    const { companyId } = authorisedSource;
    if (sourceEntityId === companyId) { // already checked
        isCompanyAdmin = true;
    } else {
        isCompanyAdmin = await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.budget]: { isEditor: true } });
    }

    const isTransferAllowed = await getIsTransferAllowed(sourceEntityId, targetEntityId, companyId);
    const authorisedTarget = isCompanyAdmin || sourceEntityId === targetEntityId ? true : await usersService.validateUserEntityWithComponents(userId, targetEntityId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.budget]: { } });
    if (!authorisedTarget || !isTransferAllowed) {
        jsonLogger.error({ type: 'error', function: 'budgets::transferBudget', message: 'target is not authorised or transfer is not allowed' });
        return responseLib.forbidden({ status: false });
    }

    const fromItem = {
        companyId,
        entityId: sourceEntityId,
        itemId: sourceItemId,
        modifiedBy: userId,
    };
    const toItem = {
        companyId,
        entityId: targetEntityId,
        itemId: targetItemId,
        modifiedBy: userId,
    };
    const result = await budgetsService.transfer(fromItem, toItem, year, period, amount);
    await snsLib.publish(userActionsSnsTopicArn, 'budgets::transferBudget', { result, fromItem, toItem, year, period, amount });

    if (isApproveRequest) {
        resetBudgetRequest({
            entityId: targetEntityId,
            itemId: targetItemId,
            year,
            period,
            userId,
            companyId
        })
    }

    if (result) {
        if (companyId !== targetEntityId) {
            await asyncTasksQueue.sendMessage({ taskData: { grantedBy: userId, toItem, amount }, type: constants.sqsAsyncTasks.types.grantBudgetEmailNotifiction });
        }
        if (companyId !== sourceEntityId) {
            await asyncTasksQueue.sendMessage({ taskData: { pulledBy: userId, fromItem, amount }, type: constants.sqsAsyncTasks.types.pullBudgetEmailNotification });
        }
    }

    return result ? responseLib.success(result) : responseLib.failure({ status: false });
}

/**
 * getBudget - get Budget item for a specific user or a company or entity 
 * budgetItem model:
 * +----------+--------+--------+-----------+----------+
 * | entityId | itemId | userId | companyId | itemData | 
 * +----------+--------+--------+-----------+----------+
 * itemId:  (the partition key) sets the 'scope', it will contain userId for a users' budget, companyId for company budget and entity budget 
 * entityId: (the partition key) entity id or company id.
 * companyId: the companyId.
 * itemData:  structure to contain all budget data including breakdown to relevant sub periods, used / committed budget etc...
 * 
 * @public
 * @param {object} event lambda event, event.queryStringParameters is the method data
 * @param {object} context - lambda context
 * @returns {object} results
 */
module.exports.getBudget = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const itemId = event.pathParameters.id;
    const { queryStringParameters } = event;
    let companyId = null
    let entityId = null

    if (queryStringParameters) {
        ({ entityId, companyId } = queryStringParameters);
    }

    jsonLogger.info({ type: 'TRACKING', function: 'budgets::getBudget', functionName: context.functionName, awsRequestId: context.awsRequestId, userId: userId, entityId: entityId, companyId: companyId, event: event });
    if (!companyId && !entityId) {
        return responseLib.failure({ message: 'missing companyId or entityId in query string' });
    }

    const scope = companyId ? companyId : entityId
    const role = constants.prefix.user + userId === itemId ? null : constants.user.role.admin;
    const authorised = await usersService.validateUserEntityWithComponents(userId, scope, role, { [permisionConstants.permissionsComponentsKeys.budget]: { } });
    if (!authorised)
        return responseLib.forbidden({ status: false });


    const result = await budgetsService.get(scope, itemId);
    if (!result)
        return responseLib.failure({ status: false });
    return responseLib.success(result);
}

const addApproversToResponse = async (budgets, companyId) => {
    jsonLogger.info({ type: 'TRACKING', function: 'budgets::addApproversToResponse', budgets, companyId });
    const approvers = await usersService.listCompanyIdApprovers(process.env.gsiItemsByCompanyIdIndexName, companyId, { [permisionConstants.permissionsComponentsKeys.budget]: { } });
    return _.map(budgets, (budget) => ({
        ...budget,
        approvers: _.get(approvers, [_.get(budget, 'entityId')]),
    }))
}

/**
 * aggregate 2 Budgets
 * @private
 * @param {object} objValue - 1 budget 
 * @param {object} srcValue - 2 budget 
 * @param {string} key - the current key 
 * @returns {object} new budget aggregated
 */
// eslint-disable-next-line consistent-return
const aggregateBudget = (objValue, srcValue, key) => {
    if (Number.isFinite(objValue) && Number.isFinite(srcValue) && key !== 'periods') {
        return objValue + srcValue;
    }
}

/**
 * aggregate All Budgets
 * @private
 * @param {object} groupByEntity - all budgets 
 * @returns {object} new budget aggregated
 */
const aggregateAllBudgets = (groupByEntity) => _.reduce(groupByEntity, (allItems, item) => _.mergeWith(_.cloneDeep(item.itemData), allItems, aggregateBudget), {})

/**
 * listBudgets -list budget entries under a company (requires company admin) or entity (requires entity admin)
 * queryStringParameters should contain one of:
 *   companyId: the companyId. or:
 *   entityId: the entityId.
 *   (optional) filter: 'company', 'entity' or 'user' which will filter items based on the matching type
 * 
 * @public
 * @param {object} event lambda event, event.queryStringParameters is the method data
 * @param {object} context - lambda context
 * @returns {object} results
 */

// eslint-disable-next-line max-lines-per-function
// eslint-disable-next-line complexity
module.exports.listBudgets = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { queryStringParameters } = event;
    let companyId = null;
    let entityId = null;
    let filter = null;

    if (queryStringParameters) {
        ({ entityId, companyId, filter } = queryStringParameters);
    }

    jsonLogger.info({ type: 'TRACKING', function: 'budgets::listBudgets', functionName: context.functionName, awsRequestId: context.awsRequestId, userId: userId, entityId: entityId, companyId: companyId, filter: filter, event: event });

    if (!companyId && !entityId) {
        return responseLib.failure({ message: 'missing companyId or entityId in query string' });
    }

    let result = null;
    if (companyId) {
        const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.budget]: { } })
        switch (role) {
            case constants.user.role.admin:
                result = await budgetsService.listCompany(process.env.gsiItemsByCompanyIdAndItemIdIndexName, companyId, filter);
                break
            case constants.user.role.user:
                // eslint-disable-next-line no-case-declarations
                const relevantFilter = filter && filter === constants.prefix.user ? filter : null;
                result = await budgetsService.listGlobal(process.env.gsiItemsByCompanyIdAndItemIdIndexName, companyId, entitiesAdmin, entitiesUser, userId, relevantFilter)
                if (result && !result.find((item) => item.itemId.startsWith(constants.prefix.company)) && !relevantFilter) {
                    const resultGroupByEntity = _.groupBy(result, (item) => item.entityId);
                    // create  entity budget if needed.
                    _.forEach(resultGroupByEntity, (values, key) => {
                        if (!values.find((item) => item.itemId.startsWith(constants.prefix.entity))) {
                            const entityItemData = aggregateAllBudgets(values)
                            result.push({ itemId: constants.prefix.entity + key, companyId, entityId: key, itemData: entityItemData })
                        }
                    });
                    const aggregateAllitem = aggregateAllBudgets(result.filter((item) => item.itemId.startsWith(constants.prefix.entity)));
                    const companyItem = { itemId: constants.prefix.company + companyId, companyId, entityId: companyId, itemData: aggregateAllitem }
                    // filter compnat budget like entity
                    result = result.filter((item) => item.companyId !== item.entityId)
                    result.push(companyItem)
                    if (filter) {
                        result = result.filter((item) => item.itemId.startsWith(filter))
                    }
                }
                break
            default:
                return responseLib.forbidden({ status: false });
        }
    } else {
        const role = await usersService.getUserAuthRoleWithComponents(userId, entityId, { [permisionConstants.permissionsComponentsKeys.budget]: { } });
        if (role === constants.user.role.unauthorised) {
            return responseLib.forbidden({ status: false });
        }
        const userIdFilter = role === constants.user.role.admin ? null : userId;
        result = await budgetsService.listEntity(entityId, filter, userIdFilter);
    }

    if (filter === constants.prefix.entity) {
        // eslint-disable-next-line require-atomic-updates
        result = await addApproversToResponse(result, companyId);
    }

    return result ? responseLib.success(result) : responseLib.failure({ status: false });
}
