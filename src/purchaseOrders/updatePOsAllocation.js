'use strict';

const {
    consumerAuthTableName,
    budgetsTableName,
    jobsTableName,
} = process.env;
const { UsersService, POService, JobsService, constants, jsonLogger, responseLib, prefixLib } = require('stoke-app-common-api');
const { getMilestoneAmountByVatForCompany } = require('stoke-app-common-api/helpers/billingHelper');

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const poService = new POService(budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(jobsTableName, [...constants.projectionExpression.defaultAttributes, 'poItemId', 'talentId'], constants.attributeNames.defaultAttributes);

const _ = require('lodash');
const PO_AMOUNT_ERROR_TYPE = 'POAmount'; 

const validatePOscopeForMilestone = (milestone, po) => {
    const { entityId, talentId } = milestone || {};
    const { poTypes, scopeType, scopeIds } = _.get(po, 'itemData.poScope', {});

    if (!_.includes(poTypes, constants.poTypes.talentService)) return false
    switch (scopeType) {
        case constants.poScopeTypes.talents:
            return scopeIds.includes(talentId)
        case constants.poScopeTypes.departments:
            return scopeIds.includes(entityId)
        default:
            return true
    }
}

const validateManualAssignment = (milestone, po) => {
    if (_.get(milestone, 'itemData.billingId')) {
        jsonLogger.error({ type: 'TRACKING', function: 'updatePOsAllocation::validateManualAssignment', error: "It's not allowed to re-assign milestone after billing", entityId: milestone.entityId, milestoneId: milestone.itemId });
        return false;
    }
    if (!validatePOscopeForMilestone(milestone, po)) {
        jsonLogger.error({ type: 'TRACKING', function: 'updatePOsAllocation::validateManualAssignment', error: "PO with this scope can't cover this milestone", milestone, po });
        return false;
    }

    return true;
}

// eslint-disable-next-line max-params
const changeMilestoneAssignment = async (companyId, milestone, poToRevert, poToAssign, userId, amount) => {
    jsonLogger.info({ type: 'TRACKING', function: 'updatePOsAllocation::changeMilestoneAssignment', companyId, milestone, poToRevert, poToAssign, userId, amount });

    let result = await poService.updateMilestoneCovergaeByPO(companyId, milestone, poToAssign, userId, -amount);
    if (!result) {
        jsonLogger.error({ type: 'TRACKING', function: 'updatePOsAllocation::changeMilestoneAssignment', error: 'failed to update new PO allocation', poToAssign, amount, milestone });
        return responseLib.failure({ status: false });
    }

    const updatedMilestone = await jobsService.update({
        entityId: milestone.entityId,
        itemId: milestone.itemId,
        modifiedBy: userId,
        poItemId: poToAssign.itemId,
    });

    if (!updatedMilestone) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePOsAllocation::changeMilestoneAssignment', milestone, poToRevertId: poToRevert.itemId, poToAssign,
            message: 'failed to update milestone poItemId'
        });
        return responseLib.failure({ status: false });
    }
    
    result = await poService.updateMilestoneCovergaeByPO(companyId, milestone, poToRevert, userId, amount);
    if (!result) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePOsAllocation::changeMilestoneAssignment', poToRevert, milestone, amount,
            message: 'failed to revert previous PO allocation'
        });
        return responseLib.failure({ status: false });
    }

    return responseLib.success(updatedMilestone);
}

// eslint-disable-next-line max-lines-per-function
module.exports.handler = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId } = event.pathParameters;
    jsonLogger.info({ type: 'TRACKING', function: 'updatePOsAllocation::handler', functionName: context.functionName, awsRequestId: context.awsRequestId, userId, companyId, event });

    const authorised = await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin);
    if (!authorised) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePOsAllocation::handler', functionName: context.functionName,
            message: 'Only company admins can update POs'
        });
        return responseLib.forbidden({ status: false });
    }
    const data = JSON.parse(event.body);
    const { milestoneId, entityId, poToAssignId } = data

    if (!milestoneId || !entityId || !poToAssignId || !prefixLib.isPO(poToAssignId)) {
        jsonLogger.error({ type: 'TRACKING', function: 'updatePOsAllocation::handler', message: "Missing mandatory parameters, milestone assignment can't be changed", milestoneId, entityId, poToAssignId });
        return responseLib.failure({ status: false, message: "Missing mandatory parameters, milestone assignment can't be changed", milestoneId, entityId, poToAssignId });
    }

    const milestone = await jobsService.get(entityId, milestoneId);
    if (!milestone) {
        jsonLogger.error({ type: 'TRACKING', function: 'updatePOsAllocation::handler', message: "milestone was not found", entityId, milestoneId });
        return responseLib.failure({ status: false, message: 'milestone was not found', entityId, milestoneId });
    }

    const poToAssign = await poService.get(companyId, poToAssignId);
    if (!poToAssign) {
        jsonLogger.error({ type: 'TRACKING', function: 'updatePOsAllocation::handler', message: "PO to assign was not found", companyId, poToAssignId });
        return responseLib.failure({ status: false, message: 'PO to assign was not found', companyId, poToAssignId });
    }

    const poToRevert = await poService.get(companyId, milestone.poItemId);
    if (!poToRevert) {
        jsonLogger.error({ type: 'TRACKING', function: 'updatePOsAllocation::handler', message: "PO to revert was not found", poToRevert: milestone.poItemId });
        return responseLib.failure({ status: false, message: 'PO to revert was not found', poToRevert: milestone.poItemId });
    }

    if (!validateManualAssignment(milestone, poToAssign)) {
        jsonLogger.error({ type: 'TRACKING', function: 'updatePOsAllocation::handler', message: "Milestone assignment can't be changed", milestone, poToAssign });
        return responseLib.failure({ status: false, message: "Milestone assignment can't be changed", milestone, poToAssign });
    }

    const amount = await getMilestoneAmountByVatForCompany(milestone, companyId);

    if (poToAssign.available < amount) {
        jsonLogger.error({ type: 'TRACKING', function: 'updatePOsAllocation::handler', message: "Milestone assignment can't be changed, no available amount in po", amount, poToAssign });
        return responseLib.failure({ status: false, errorType: PO_AMOUNT_ERROR_TYPE, milestoneAmount: amount, availableInTargetPO: poToAssign.available });
    }

    return changeMilestoneAssignment(companyId, milestone, poToRevert, poToAssign, userId, amount);
};
