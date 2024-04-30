/* eslint-disable no-magic-numbers */
/* eslint-disable max-params */
/* eslint-disable max-lines-per-function */

'use strict'

const {
    jobsTableName,
    settingsTableName,
} = process.env;

const _ = require('lodash');
const { jsonLogger, JobsService, constants, SettingsService, idConverterLib, CryptoService } = require("stoke-app-common-api");
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const cryptoService = new CryptoService('consumerApp', 'webhook');

const mailTypes = {
    externalApprover: "externalApprover",
    budgetApproval: "budgetApproval",
}

/**
 * processSingleRecord - process one record
 * @param {Object} record - the record 
 * @returns {object} provider 
 */
const processSingleRecord = async (record) => {
    jsonLogger.info({ type: 'TRACKING', function: 'processWebhookSqs::processSingleRecord', record });
    const item = JSON.parse(record.body);
    jsonLogger.info({ type: 'TRACKING', function: 'processWebhookSqs::processSingleRecord', item });
    const { queryStringParameters } = item;
    // eslint-disable-next-line prefer-const
    let { type, entityId, itemId, status } = queryStringParameters || {};
    entityId = await cryptoService.decrypt(entityId);
    itemId = await cryptoService.decrypt(itemId);
    if (type === mailTypes.externalApprover) {
        const milestone = await jobsService.get(entityId, itemId);
        if (!milestone) {
            jsonLogger.info({ type: 'TRACKING', function: 'processWebhookSqs::processSingleRecord', message: 'missing milestone', record });
        }
        if ([
            constants.job.status.pendingApproval,
            constants.job.status.secondApproval,
            constants.job.status.overageBudgetRequest,
        ].includes(milestone.itemStatus)) {
            jsonLogger.info({ type: 'TRACKING', function: 'processWebhookSqs::processSingleRecord', milestone });
            const { companyId, itemData, userId } = milestone;
            const job = await jobsService.get(entityId, idConverterLib.getJobIdFromMilestoneId(itemId));
            if (!job) {
                jsonLogger.info({ type: 'TRACKING', function: 'processWebhookSqs::processSingleRecord', message: 'missing job', record });
            }
            const userEmail = _.get(job, 'tags.stoke::externalApproverEmail') || userId;
            // eslint-disable-next-line prefer-const
            let { approversChain, approvals = [] } = itemData;
            if (!approversChain) {
                const settingType = await settingsService.getEffectiveSettingForDepartment(companyId, entityId, constants.settingTypes.multiLevel);
                ({ approversChain } = settingType);
            }

            let approvedBy = null;
            let rejectedBy = null;
            if (status === 'yes') {
                approvedBy = userEmail
            } else if (status === 'no') {
                rejectedBy = userEmail
            }
            const externalLevel = _.find(approversChain, (level) => level.type === constants.multiLevelTypes.external)
            if (externalLevel) {
                if (status === 'yes') {
                    const approveRecord = { approvedBy, approveDate: Date.now(), action: 'approve', level: externalLevel.level, type: constants.multiLevelTypes.external }
                    approvals.push(approveRecord);
                }
                approversChain = _.map(approversChain, (level) => ({
                    ...level,
                    ...level.type === constants.multiLevelTypes.external ? {
                        approvedBy,
                        rejectedBy,
                        approveDate: Date.now(),
                    } : {}
                }));
                const isAllApproved = _.every(approversChain, (level) => level.approvedBy);
                const itemStatus = isAllApproved ? constants.job.status.completed : milestone.itemStatus;
                const result = await jobsService.update({ entityId, itemId, approversChain, approvals, modifiedBy: userEmail, itemStatus });
                jsonLogger.info({ type: 'TRACKING', function: 'processWebhookSqs::processSingleRecord', result, approversChain });
            }
        }
    }

    if (type === mailTypes.budgetApproval) {
        jsonLogger.info({ type: 'TRACKING', function: 'processWebhookSqs::processSingleRecord', message: 'handling budgetApproval mail' });
    }

    return true;
};

/**
 * handler - process all invoices tasks
 * @public
 * @param {object} event - event data
 * @param {object} context - lambda context
 * @param {object} callback - lambda callback
 * @returns {object} results
 */
module.exports.handler = async (event, context, callback) => {
    jsonLogger.info({
        type: 'TRACKING', function: 'processWebhookSqs::handler', functionName: context.functionName, awsRequestId: context.awsRequestId, event,
    });
    for (const record of event.Records) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await processSingleRecord(record);
        } catch (e) {
            jsonLogger.error({ function: 'processWebhookSqs::handler', message: e.message });
        }
    }
    callback(null, { status: true });
};

