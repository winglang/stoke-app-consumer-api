/* eslint-disable no-case-declarations */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */
/* eslint-disable max-statements */
/* eslint-disable complexity */

'use strict';

const _ = require('lodash');
const dayjs = require('dayjs');

const injectValuesToText = (string = '', values = [], fallback = '') => {
    if (!string || !values.length) return string
    return values.reduce(
        (text, value, index) => text.replace(`{${index}}`, value || fallback),
        string,
    )
}


const conditionTypes = {
    talentStatusIs: 'talentStatusIs',
    customFieldChanged: 'customFieldChanged',
}

const triggerTypes = {
    milestoneStatusChanged: 'milestoneStatusChanged',
    milestonePaymentStatusChanged: 'milestonePaymentStatusChanged',
    customerStatusChanged: 'customerStatusChanged',
    jobStatusChanged: 'jobStatusChanged',
    talentStatusChanged: 'talentStatusChanged',
    legalDocumentsStatusChanged: 'legalDocumentsStatusChanged',
    talentBecomesFullyCompliant: 'talentBecomesFullyCompliant',
    talentComplianceAudit: 'talentComplianceAudit',
    talentWorkforceCompliance: 'talentWorkforceCompliance',
    customFieldChanged: 'customFieldChanged',
    billingCreated: 'billingCreated',
    milestoneRejectedByExternalSecondApprover: 'milestoneRejectedByExternalSecondApprover',
    talentOfferResponseChanged: 'talentOfferResponseChanged',
}

const actionTypes = {
    setCustomField: 'setCustomField',
    sendCustomEmail: 'sendCustomEmail',
    callToApi: 'callToApi',
}

const workflowsLogsStrings = {
    actionTitle: {
        callToApi: 'Call to API',
        setCustomField: '{0} **{1}** custom field **{2}** changed to **{3}**',
        sendCustomEmailMultiple: 'Email **{0}** sent to {1} recipients',
        sendCustomEmail: 'Email **{0}** sent to {1}',
    },
    triggerTitle: {
        milestoneStatusChanged: 'Milestone **{0}** changed to **{1}**',
        milestonePaymentStatusChanged: 'Milestone **{0}** payment status changed to **{1}**',
        customerStatusChanged: 'User **{0}** changed to **{1}**',
        jobStatusChanged: 'Job **{0}** changed to **{1}**',
        talentStatusChanged: 'Talent **{0}** changed to **{1}**',
        legalDocumentsStatusChanged: 'Document **{0}** for **{1}** is **{2}**',
        talentBecomesFullyCompliant: 'Talent **{0}** becomes fully compliant',
        talentComplianceAudit: 'Workforce audit report for talent **{0}** is **{1}**',
        talentWorkforceCompliance: 'Talent **{0}** workforce compliance changed to **{1}**',
        customFieldChanged: '{0} **{1}** custom field **{2}** changed to **{3}**',
        billingCreated: 'Billing **{0}** created ',
        milestoneRejectedByExternalSecondApprover: 'Milestone **{0}** Rejected By Second Approver', 
        talentOfferResponseChanged: 'Talent **{0}** responded **{1}** to the job **{2}**',
    },
    conditionTitle: {
        talentStatusIs: ' and talent **{0}** status is **{1}**',
        customFieldChanged: ' and custom field **{0}** is **{1}**',
    },
    titlePrefix: {
        ms: 'Milestone',
        milestone: 'Milestone',
        job: 'Job',
        provider: 'talent',
        talent: 'talent',
    },
    triggerStatus: {
        talentComplianceAudit: {
            sent: 'sent to talent',
        },
    },
}

const resolveActionTitle = (actionItem, actionType) => {
    const { entity, actionTitle, tagsAction, allEmails, subjectLine = '' } = actionItem
    switch (actionType) {
        case actionTypes.setCustomField:
            const key = Object.keys(tagsAction || {})[0] || ''
            return injectValuesToText(workflowsLogsStrings.actionTitle.setCustomField, [
                _.get(workflowsLogsStrings, `titlePrefix.${entity}`),
                actionTitle,
                key.replace('stoke::', ''),
                _.get(tagsAction, key),
            ])
        case actionTypes.sendCustomEmail:
            if (_.size(allEmails) === 1) {
                return injectValuesToText(workflowsLogsStrings.actionTitle.sendCustomEmail, [
                    _.trim(subjectLine),
                    allEmails[0],
                ])
            }
            return injectValuesToText(
                workflowsLogsStrings.actionTitle.sendCustomEmailMultiple,
                [_.trim(subjectLine), _.size(allEmails)],
            )

        case actionTypes.callToApi:
            return workflowsLogsStrings.actionTitle.callToApi
        default:
            break
    }
    return ''
}

const resolveTrigger = (actionItem, conditionItem, workflow) => {
    if (!actionItem) {
        return null
    }
    const { triggerKey: triggerType } = workflow
    const {
        triggerTitle,
        itemStatus,
        documentName,
        tagsChanges,
        itemIdForAudit,
        itemId,
        billingDate,
        jobTitle,
    } = actionItem
    let trigger = ''
    switch (triggerType) {
        case triggerTypes.milestoneStatusChanged:
        case triggerTypes.milestonePaymentStatusChanged:
        case triggerTypes.jobStatusChanged:
        case triggerTypes.talentStatusChanged:
        case triggerTypes.talentWorkforceCompliance:
        case triggerTypes.talentComplianceAudit:
        case triggerTypes.customerStatusChanged:
            trigger = injectValuesToText(
                _.get(workflowsLogsStrings, `triggerTitle.${triggerType}`),
                [
                    triggerTitle,
                    _.get(workflowsLogsStrings, `triggerStatus.${triggerType}.${itemStatus}`) ||
                    itemStatus,
                ],
            )
            break
        case triggerTypes.legalDocumentsStatusChanged:
            trigger = injectValuesToText(
                _.get(workflowsLogsStrings, `triggerTitle.${triggerType}`),
                [documentName, triggerTitle, itemStatus],
            )
            break
        case triggerTypes.talentBecomesFullyCompliant:
            trigger = injectValuesToText(
                _.get(workflowsLogsStrings, `triggerTitle.${triggerType}`),
                [triggerTitle],
            )
            break
        case triggerTypes.customFieldChanged:
            const realItemId = itemIdForAudit || itemId
            const key = Object.keys(tagsChanges || {})[0] || ''
            const prefix = `${realItemId.split('_')[0]}`
            trigger = injectValuesToText(
                _.get(workflowsLogsStrings, `triggerTitle.${triggerType}`),
                [
                    _.get(workflowsLogsStrings, `.titlePrefix.${prefix}`),
                    triggerTitle,
                    key.replace('stoke::', ''),
                    _.get(tagsChanges, key),
                ],
            )
            break
        case triggerTypes.billingCreated:
            trigger = injectValuesToText(
                _.get(workflowsLogsStrings, `triggerTitle.${triggerType}`),
                [billingDate],
            )
            break
        case triggerTypes.milestoneRejectedByExternalSecondApprover:
            trigger = injectValuesToText(_.get(workflowsLogsStrings, `triggerTitle.${triggerType}`), [itemId])
            break
        case triggerTypes.talentOfferResponseChanged:
            trigger = injectValuesToText(
                _.get(workflowsLogsStrings, `triggerTitle.${triggerType}`),
                [_.get(actionItem, 'talentName', ''), itemStatus, jobTitle],
            )
            break
        default:
            break
    }
    let conditionTitle = ''
    const conditionTrigger = _.get(workflow, 'condition[0].value')
    const { talentName } = conditionItem
    let fieldName = ''
    let fieldValue = ''
    let providerStatus = ''
    switch (conditionTrigger) {
        case conditionTypes.talentStatusIs:
            providerStatus = _.get(workflow, 'condition[1].value')
            conditionTitle = injectValuesToText(
                _.get(conditionTypes, `.conditionTitle.${conditionTrigger}`),
                [talentName, providerStatus],
            )
            break
        case conditionTypes.customFieldChanged:
            fieldName = _.get(workflow, 'condition[2].value')
            fieldValue = _.get(workflow, 'condition[3].value')
            conditionTitle = injectValuesToText(
                _.get(conditionTypes, `.conditionTitle.${conditionTrigger}`),
                [fieldName, fieldValue],
            )
            break

        default:
            break
    }
    return `${trigger}${conditionTitle}`
}


module.exports.normalizeWorkflowLogs = (logs) => _.map(logs, (item) => {
    const { itemData = {}, createdAt, itemId } = item
    const { workflow, actionItem = {}, conditionItem = {} } = itemData
    const actionType = _.get(item, 'itemData.actionType')
    const action = resolveActionTitle(actionItem, actionType)
    return {
        itemId,
        createdAt,
        workflow,
        workflowId: _.get(workflow, 'id'),
        date: dayjs(createdAt).format('DD MMM YYYY, HH:mm:ss'),
        name: _.get(workflow, 'name'),
        trigger: resolveTrigger(actionItem, conditionItem, workflow),
        action,
        actionItem,
        actionTooltip:
            actionType === actionTypes.sendCustomEmail
                ? _.get(actionItem, 'allEmails', []).join('\n')
                : action,
    }
})

module.exports.dataExportWorkflowLogs = (logs) => {
    const headers = ['date', 'name', 'trigger', 'action'];
    const rows = _.map(logs, (item) => _.map(headers, (header) => (_.get(item, header) || '').replaceAll('**', ''))).filter(Boolean)
    return { rows, headers: _.invokeMap(headers, 'toUpperCase') }
}

module.exports.columnMapperWorkflowLogs = () => ({ workflowId: 'workflowId', date: 'createdAt', name: 'name', action: 'action', trigger: 'trigger' })


