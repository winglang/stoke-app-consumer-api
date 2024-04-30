
"use strict";

const { constants } = require('stoke-app-common-api');

const talentProfileFieldPrefix = 'talentProfileCustomField::'
const customFieldTypes = {
    provider: 'provider',
    talent: 'talent',
    job: 'job',
    ms: 'ms',
}

const sqlAggType = {
    count: 'count',
    sum: 'sum',
    concat: 'GROUP_CONCAT',
    concatAll: 'GROUP_CONCAT_ALL',
    none: 'none',
}

const customFieldsTypesNames = {
    provider: 'Individual and company',
    talent: 'Talents under company',
    jobs: 'Jobs',
    milestone: 'Milestones',
}

const proficienciesOptions = {
    any: 'Any proficiency',
    basic: 'Basic',
    conversational: 'Conversational',
    fluent: 'Fluent',
    'native or bilingual': 'Native or Bilingual',
}

const marketplacesProviderIds = Object.freeze([
    `${constants.prefix.provider}FREELANCER_COM`,
    `${constants.prefix.provider}UPWORK_COM`,
    `${constants.prefix.provider}DEMO_GENERATOR`,
])

const backgroundCheckDisplayedStatus = {
    [constants.talentBackgroundCheckStatus.asked]: 'In progress',
    [constants.talentBackgroundCheckStatus.inProgress]: 'In progress',
    [constants.talentBackgroundCheckStatus.attention]: 'Done - Consider',
    [constants.talentBackgroundCheckStatus.success]: 'Done - Clear',
    [constants.talentBackgroundCheckStatus.notSupported]: 'Done - Not supported',
}

const payableStatusesColors = {
    payable: 'green',
    notPayable: 'red',
    customRestricted: 'yellow',
}

const paymentStatusDisplayedName = {
    [constants.payment.status.cancelled]: 'Payment cancelled',
    [constants.payment.status.rejected]: 'Payment rejected',
    [constants.payment.status.pendingPO]: 'Pending PO',
    [constants.payment.status.pendingFunds]: 'On hold',
    [constants.payment.status.scheduled]: 'Payment sent',
    [constants.payment.status.submitted]: 'Payment sent',
    [constants.payment.status.pending]: 'Payment scheduled',
    [constants.payment.status.approved]: 'Payment approved',
    [constants.payment.status.requested]: 'Pending approval',
    [constants.payment.status.paid]: 'Payment completed',
    [constants.payment.status.paidVerified]: 'Payment completed',
}

const talentStatuses = {
    [constants.companyProvider.status.active]: 'active',
    [constants.companyProvider.status.inactive]: 'inactive',
    [constants.companyProvider.status.pending]: 'pending',
    [constants.companyProvider.status.invited]: 'invited',
    [constants.companyProvider.status.registered]: 'registered',
    [constants.companyProvider.status.notInvited]: 'added w/o invite',
    [constants.companyProvider.status.enrolled]: 'in setup',
    noStatus: '-',
}

const talentTypeOptionsIds = {
    INDIVIDUAL: 'individual',
    COMPANY: 'company',
}

module.exports = {
    customFieldTypes,
    customFieldsTypesNames,
    proficienciesOptions,
    marketplacesProviderIds,
    backgroundCheckDisplayedStatus,
    payableStatusesColors,
    paymentStatusDisplayedName,
    talentStatuses,
    talentTypeOptionsIds,
    sqlAggType,
    talentProfileFieldPrefix
}
