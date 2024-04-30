
/* eslint-disable max-params */
/* eslint-disable no-undefined */
/* eslint-disable no-await-in-loop */

'use strict';

const _ = require('lodash');
const { constants, jsonLogger, budgetHelper, errorCodes, BudgetsService, JobsService } = require('stoke-app-common-api');

const jobHelper = require('./jobHelper');
const { createResult, createArray } = require('./commonHelper');

const {
    budgetsTableName,
    jobsTableName,
} = process.env;

const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const getFutureBudgets = async (entityId) => {
    jsonLogger.info({ type: 'TRACKING', function: 'entityHelper::getFutureBudgets', entityId });
    const budget = await budgetsService.get(entityId, `${constants.prefix.entity}${entityId}`);
    return budgetHelper.getFutureAvailableBudgets(createArray(budget));
};

module.exports.validateActivateEntity = (entity, itemStatus) => {
    const status = entity.itemStatus === constants.itemStatus.inactive && itemStatus === constants.itemStatus.active;
    return { status };
}
  
  
// eslint-disable-next-line max-params
module.exports.validateDeleteEntity = async (entityId) => {
    jsonLogger.info({ type: 'TRACKING', function: 'entityHelper::validateDeleteEntity', entityId });

    if (!entityId) {
        jsonLogger.error({ type: 'TRACKING', function: 'entityHelper::validateDeleteEntity', message: 'Missing mandatory param' });
        return createResult(false, errorCodes.deleteErrors.MISSING_PARAMS);
    }

    // eslint-disable-next-line array-element-newline
    const jobs = await jobsService.jobsPagingtion('list', undefined, [entityId, undefined, constants.prefix.job, undefined]);
    const notFinalizedJobs = jobHelper.getNonFinalizedJobs(jobs);
    if (!_.isEmpty(notFinalizedJobs)) {
        jsonLogger.info({ type: 'TRACKING', function: 'entityHelper::validateDeleteEntity', message: 'Entity has jobs that are not finalized', notFinalizedJobs });
        return createResult(false, errorCodes.deleteErrors.NON_FINALIZED_JOBS);
    }

    const budgets = await getFutureBudgets(entityId);
    if (!_.isEmpty(budgets)) {
        jsonLogger.info({ type: 'TRACKING', function: 'entityHelper::validateDeleteEntity', message: 'Entity has future budgets' });
        return createResult(true, errorCodes.deleteErrors.FUTURE_BUDGETS);
    }

    jsonLogger.info({ type: 'TRACKING', function: 'entityHelper::validateDeleteEntity', status: true });
    return createResult(true);
};

module.exports.pullAvailableBudgetsToCompanyPool = async (companyId, entityId, budgetOwnerUserId, modifiedByUserId) => {
    jsonLogger.info({ type: 'TRACKING', function: 'entityHelper::pullAvailableBudgetsToCompanyPool', companyId, entityId, budgetOwnerUserId, modifiedByUserId });

    const toCompanyPoolBudget = {
        companyId,
        entityId: companyId,
        itemId: constants.prefix.user + budgetOwnerUserId,
        modifiedBy: modifiedByUserId,
    };

    const allBudgets = await budgetsService.listEntity(entityId, constants.prefix.user);
    const budgets = budgetHelper.getFutureAvailableBudgets(allBudgets);

    const results = [];
    for (const budget of budgets) {
        const fromUserBudget = {
            companyId,
            entityId,
            itemId: budget.itemId,
            modifiedBy: modifiedByUserId,
        };

        results.push(await budgetsService.transfer(
            fromUserBudget,
            toCompanyPoolBudget,
            budget.year,
            budget.period,
            budget.budget.available,
        ));
    }

    jsonLogger.info({ type: 'TRACKING', function: 'entityHelper::pullAvailableBudgetsToCompanyPool', results });
    const result = _.every(results, Boolean);
    if (result) {
        jsonLogger.info({ type: 'TRACKING', function: 'entityHelper::pullAvailableBudgetsToCompanyPool', result });
    } else {
        jsonLogger.error({ type: 'TRACKING', function: 'entityHelper::pullAvailableBudgetsToCompanyPool', error: "Failed to pull budgets to company pool", result });
    }
    return result;
};
