/* eslint-disable max-lines */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-await-in-loop */
/* eslint-disable max-lines-per-function */
/* eslint-disable array-element-newline */
/* eslint-disable max-params */


'use strict';

const _ = require('lodash');
const { constants, jsonLogger, responseLib, JobsService, SettingsService, idConverterLib, jobHelper, UsersService } = require('stoke-app-common-api');
const jobs = require("../jobs");
const { getMilestone } = require('./../helpers/jobHelper');
const { getMultiLevelContext } = require('./../helpers/multiLevelHelper');
const { innerUpdateMilestoneStatusGetStatus, innerUpdateMilestoneStatus } = require("./updateMilestoneStatus");

const { jobsTableName, settingsTableName, consumerAuthTableName } = process.env;

const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);


const resolveRetainerByPercentage = (percentage, value) => {
    if (!value) return 0
    const newValue = Number(value) * percentage
    return Number(value) - newValue
}

const updateMilestoneInner = async (userId, entityId, itemId, itemData, itemStatus) => {
    const item = {
        entityId,
        itemId,
        itemStatus,
        itemData,
        modifiedBy: userId,
    };
    const result = await jobsService.update(item);
    return result;
}

/**
 * calculating partial approve amount with fees
 * @param {object} milestone - the milestone 
 * @param {object} completedMilestone - the completed milestone 
 * @param {number} amount - the amount we want to approve
 * @param {number} percentage - the percentage amount from the original request
 * @returns {object} updated milestone itemData
 */
const resolveMilestoneItemDataAfterPaymentRequest = (milestone, completedMilestone, amount, percentage) => {
    const { providerData, actualCost } = completedMilestone.itemData

    const subTotal = (providerData.taxInfo.subTotal || 0) - amount
    const tax = resolveRetainerByPercentage(percentage, providerData.taxInfo.tax)
    const updatedActualCost = resolveRetainerByPercentage(percentage, actualCost)
    const approvals = jobHelper.getLatestApprovers(completedMilestone)

    const newItemDataProps = {
        ..._.pick(completedMilestone.itemData, [
            'invoiceDate',
            'invoiceNumber',
            'proFormaInvoiceDate',
            'proFormaInvoiceNumber',
            'approversChain',
        ]),
        approvals,
        actualCost: updatedActualCost,
        actualRequestCost: updatedActualCost,
        providerData: {
            comment: providerData.comment,
            commentTime: providerData.commentTime,
            taxInfo: {
                paymentCurrency: providerData.taxInfo.paymentCurrency,
                total: subTotal + tax,
                subTotal,
                tax
            }
        }
    }

    return { ...milestone.itemData, ...newItemDataProps }
}

/**
 * calculating partial approve amount with fees
 * @param {object} milestone - the milestone 
 * @param {number} approveAmount - the amount will be approved
 * @returns {object} results ( amount, percentage )
 */
const resolvePartialApproveAmountWithFees = (milestone, approveAmount) => {
    const { providerData = {}, actualCost, actualRequestCost } = milestone.itemData

    const requestedAmountByTalent = _.get(providerData, 'taxInfo.subTotal')

    // to calculate the right amount with rate fees
    const approvePercentage = approveAmount / requestedAmountByTalent
    const usdRequestedActualCost = (actualCost || actualRequestCost) * approvePercentage

    return {
        amount: usdRequestedActualCost,
        percentage: approvePercentage
    }
}

/**
 * inner complete milestone with partial amount
 * @param {object} milestone - the milestone 
 * @param {object} multiLevelContext - settings
 * @param {array} levelsToApprove - levels to approve
 * @param {string} requestUserId - the user that initiated this action
 * @param {number} usdAmount - the partial approve amount in usd
 * @param {number} localAmount - the partial approve amount in payment currency
 * @param {number} percentage - the partial approve amount percentage from the original talent request
 * @returns {object} result
 */
const approvePartialMilestoneAmount = async (milestone, multiLevelContext, levelsToApprove, requestUserId, usdAmount, localAmount, percentage) => {
    jsonLogger.info({
        type: 'TRACKING',
        function: 'jobs::approvePartialMilestoneAmount',
        milestone, requestUserId, usdAmount, localAmount, percentage
    });

    const milestoneClone = _.cloneDeep(milestone)

    const { itemData: { providerData, actualRequestCost, splittedMilestoneNumber } } = milestoneClone

    const tax = (providerData.taxInfo.tax || 0) * percentage

    const newItemData = {
        actualRequestCost,
        actualCost: usdAmount,
        splittedMilestoneNumber: splittedMilestoneNumber || 1,
        providerData: {
            taxInfo: {
                paymentCurrency: providerData.taxInfo.paymentCurrency || "USD",
                total: localAmount + tax,
                subTotal: localAmount,
                tax,
            }
        }
    }

    _.set(milestoneClone, 'newItemData', newItemData)
    _.set(milestoneClone, 'multiLevelContext', multiLevelContext)
    _.set(milestoneClone, 'levelsToApprove', levelsToApprove)

    const [updatedMilestone] = await innerUpdateMilestoneStatusGetStatus([milestoneClone], constants.job.status.completed);
    const result = await innerUpdateMilestoneStatus(updatedMilestone, constants.job.status.completed, requestUserId);

    jsonLogger.info({
        type: 'partial approve milestone done',
        function: 'jobs::approvePartialMilestoneAmount',
        result,
    });

    return result
}

/**
 * update milstone status 
 * @param {Object} event - event
 * @param {Object} context - context
 * @returns {object} results
 */
// eslint-disable-next-line complexity
const handler = async (event, context) => {
    const data = JSON.parse(event.body);
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { entityId, milestoneId, approveAmount } = data;

    jsonLogger.info({
        type: "TRACKING",
        function: "milestonePartialApprove::handler",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        userId, entityId, milestoneId, approveAmount
    });

    if (!entityId || !milestoneId || !approveAmount) {
        return responseLib.failure({ message: 'missing mandatory params in body' });
    }

    const roleInEntity = await usersService.getUserAuthRole(userId, entityId);
    if (roleInEntity === constants.user.role.unauthorised) {
        jsonLogger.error({ type: 'TRACKING', function: 'milestonePartialApprove::handler', message: 'This user is not authorised to approve this milestone', userId, entityId });
        return responseLib.forbidden({ status: false });
    }

    const jobId = idConverterLib.getJobIdFromMilestoneId(milestoneId);
    const { milestone, job } = await getMilestone(userId, entityId, jobId, milestoneId, true)
    const { companyId, entityId: milestoneEntityId, userId: milestoneUserId, itemStatus } = milestone || {}

    if (
        ![
            constants.job.status.pendingApproval,
            constants.job.status.secondApproval,
            constants.job.status.requested
        ].includes(itemStatus)
    ) {
        jsonLogger.error({
            type: 'TRACKING',
            function: 'milestonePartialApprove::handler',
            message: 'Not allow to edit milestone with this status',
            userId, milestoneId, itemStatus
        });
        return responseLib.forbidden({ status: false });
    }

    const roleInCompany = await usersService.getUserAuthRole(userId, companyId);
    const isCompanyAdmin = roleInCompany === constants.user.role.admin;
    const isEntityAdmin = roleInEntity === constants.user.role.admin;

    const settings = await settingsService.get(`${constants.prefix.company}${companyId}`);
    const entitySettings = await settingsService.get(`${constants.prefix.entity}${milestoneEntityId}`);

    const multiLevelContext = getMultiLevelContext(milestone, settings, entitySettings);
    const approvedLevelsInfo = multiLevelContext && jobHelper.validateLevelsToApprove(milestone, multiLevelContext, userId, isEntityAdmin, isCompanyAdmin);
    if (multiLevelContext && !approvedLevelsInfo.isAuthorised) {
        jsonLogger.error({ type: 'TRACKING', function: 'milestonePartialApprove::handler', message: 'This user is not authorised to approve this milestone', userId, milestone });
        return responseLib.forbidden({ status: false });
    }
    const { amount, percentage } = resolvePartialApproveAmountWithFees(milestone, Number(approveAmount))
    const approvedMilestoneResult = await approvePartialMilestoneAmount(milestone, multiLevelContext, _.get(approvedLevelsInfo, 'levelsToApprove', []), userId, amount, Number(approveAmount), percentage)

    const newMilestone = {
        itemStatus: constants.job.status.pending,
        itemData: {
            ..._.pick(
                milestone.itemData,
                ['title', 'description', 'date', 'talentCompletedAt', 'currency']
            ),
            files: _.filter(milestone.itemData.files, (file) => !file.autoTalentInvoice),
            splittedMilestoneNumber: (milestone.itemData.splittedMilestoneNumber || 1) + 1,
            cost: 0,
        }
    }
    const talentId = _.get(job, 'itemData.talentId')
    jobs.setMilestoneBasicDetails(newMilestone, job.itemId, milestoneEntityId, companyId, userId, job.userId, talentId);

    const createdMilestoneResult = await jobs.milestonesCreation([newMilestone], job, milestoneEntityId, userId);
    const createdMilestone = _.get(createdMilestoneResult, ['TransactItems', 0, 'Put', 'Item'])

    if (!createdMilestone) {
        jsonLogger.error({
            type: 'TRACKING',
            function: 'milestonePartialApprove::handler',
            message: 'failed to create new milestone from the partial approve retainer'
        });
        return responseLib.failure({ message: 'failed to create new milestone' });
    }

    let result = await updateMilestoneInner(milestoneUserId, milestoneEntityId, createdMilestone.itemId, createdMilestone.itemData, constants.job.status.active);

    if (!result) {
        jsonLogger.error({
            type: 'TRACKING',
            function: 'milestonePartialApprove::handler',
            message: 'failed to make the new milestone active'
        });
        return responseLib.failure({ message: 'failed to make the new milestone active' });
    }

    const updatedItemData = resolveMilestoneItemDataAfterPaymentRequest(result.Attributes, milestone, Number(approveAmount), percentage);
    result = await updateMilestoneInner(milestoneUserId, milestoneEntityId, createdMilestone.itemId, updatedItemData, constants.job.status.pendingApproval);

    if (_.size(updatedItemData.approvals)) {
        result = await updateMilestoneInner(milestoneUserId, milestoneEntityId, createdMilestone.itemId, _.get(result, 'Attributes.itemData'), constants.job.status.secondApproval);
    }

    await jobsService.update({ itemId: milestoneId, entityId, modifiedBy: userId, actualRequestCost: amount });
 
    return responseLib.success(_.map([approvedMilestoneResult, result], (res) => res.Attributes));
}

module.exports = {
    handler,
}
