
"use strict";

const { PROVIDER_TALENT_FIELDS } = require('../companyProviders')

// should be equivelent to this: https://github.com/stoketalent/stoke-app-consumer-client/blob/master/src/assets/strings.js#L222
const paymentCategories = ['article', 'day', 'est', 'item', 'minute', 'rateper', 'sale', 'view', 'runtime min', 'word']

const mandatoryJobIDString = 'stoke::jobId'

const errorCodes = {
    keyExist: `Can't override the key`,
    talentExistInOther: 'Talent already exists in other company',
    talentExist: 'Talent already exists',
    providerExist: 'Company already exists',
    missingEntityId: 'Missing Workspace',
    missingTalent: 'Missing Talent',
    noPayableProvider: 'Provider is not payable',
    nonCompliantProvider: 'Provider is not compliant',
    missingTaxForm: 'Provider is missing tax forms',
    insufficientPermission: 'Insufficient Permissions',
    CSV_RECORD_DONT_MATCH_COLUMNS_LENGTH: 'Missing columns',
    missingRequiredFields: 'Missing required fields',
    numberCustomField: 'The values for type "Number" must be a number',
    checkboxCustomField: 'The values for type "Checkbox" must be true / false',
    emailCustomField: 'The values for type "Email" must contain valid email address',
    disabledPaymentMethod: 'Your company doesn’t support your talent’s preferred payment method',
    jobCustomFieldsNotConsistent: (jobTitle) => `Job custom fields for ${jobTitle} are not consistent among all milestones under that job`,
    offerJobFieldsNotConsistent: (jobTitle, errorOnColumnString) => `Values for ${errorOnColumnString} are not consistent for all rows under ${jobTitle} job`,
    offerJobHourlyAndFixedRateMixed: (jobTitle) => `Not allowed to mix hourly and fixed rates for ${jobTitle} job`,
    milestoneToUpdateNotExisting: 'Updated milestone not exists or not active',
  }

const commandOptions = {
    validation: 'validation',
    dataValidation: 'dataValidation',
    execute: 'execute'
}

const talentsColumns = {
    email: 'email',
    talentFirstName: 'talentFirstName',
    talentLastName: 'talentLastName',
    sendInvite: 'sendInvite',
    companyName: 'companyName',
    providerEmail: 'providerEmail',
    providerFirstName: 'providerFirstName',
    providerLastName: 'providerLastName',
    [PROVIDER_TALENT_FIELDS.isHireByStoke]: PROVIDER_TALENT_FIELDS.isHireByStoke,
};

const talentsHeaders = {
    [talentsColumns.email]: 'Talent Email',
    [talentsColumns.talentFirstName]: 'Talent First name',
    [talentsColumns.talentLastName]: 'Talent Last Name',
    [talentsColumns.sendInvite]: 'Send invite',
    [talentsColumns.companyName]: 'Company name',
    [talentsColumns.providerEmail]: 'Company contact email',
    [talentsColumns.providerFirstName]: 'Company contact first name',
    [talentsColumns.providerLastName]: 'Company contact last name',
    [talentsColumns.isHireByStoke]: 'Hired by Fiverr enterprise',
};

const milestonesColumns = {
    jobType: 'jobType',
    email: 'email',
    userEmail: 'userEmail',
    entityName: 'entityName',
    jobTitle: 'jobTitle',
    jobDescription: 'jobDescription',
    jobID: 'jobID',
    jobStartDate: 'jobStartDate',
    milestoneTitle: 'milestoneTitle',
    milestoneDescription: 'milestoneDescription',
    milestoneDate: 'milestoneDate',
    milestonePlannedAmount: 'milestonePlannedAmount',
    milestoneRequestedAmount: 'milestoneRequestedAmount',
    milestoneId: 'milestoneId',
    currency: 'currency',
    hourlyRate: 'hourlyRate',
    customRateRate: 'customRateRate',
    customRateCategory: 'customRateCategory',
    customRateQuantity: 'customRateQuantity',
    [PROVIDER_TALENT_FIELDS.isHireByStoke]: PROVIDER_TALENT_FIELDS.isHireByStoke,
    fixedRate: 'fixedRate',
    instantHire: 'instantHire',
    quote: 'quote',
    timeFrame: 'timeFrame',
    monthlyEstimatedHours: 'monthlyEstimatedHours',
};

const milestonesHeaders = {
    [milestonesColumns.jobType]: 'Job Kind (Assign/Offer)',
    [milestonesColumns.email]: 'Talent email',
    [milestonesColumns.userEmail]: 'Hiring Manager Email',
    [milestonesColumns.entityName]: 'Workspace Name',
    [milestonesColumns.jobTitle]: 'Job Title',
    [milestonesColumns.jobDescription]: 'Job Description',
    [milestonesColumns.jobID]: 'Job ID',
    [milestonesColumns.jobStartDate]: 'Job Start Date',
    [milestonesColumns.milestoneTitle]: 'Milestone Title',
    [milestonesColumns.milestoneDescription]: 'Milestone Description',
    [milestonesColumns.milestoneDate]: 'Milestone Delivery Date',
    [milestonesColumns.milestonePlannedAmount]: 'Planned Amount',
    [milestonesColumns.milestoneRequestedAmount]: 'Requested Amount',
    [milestonesColumns.milestoneId]: 'Milestone Id',
    [milestonesColumns.currency]: 'Currency',
    [milestonesColumns.hourlyRate]: 'Hourly Rate',
    [milestonesColumns.customRateRate]: 'Custom rate - Rate',
    [milestonesColumns.customRateCategory]: 'Custom rate - Category',
    [milestonesColumns.customRateQuantity]: 'Custom rate - Quantity',
    [milestonesColumns.isHireByStoke]: 'Hired by Fiverr enterprise',
    [milestonesColumns.fixedRate]: 'Fixed Rate',
    [milestonesColumns.instantHire]: 'Instant Hire',
    [milestonesColumns.quote]: 'Ask talents to submit a quote for this job',
    [milestonesColumns.timeFrame]: 'Job Time Frame',
    [milestonesColumns.monthlyEstimatedHours]: 'Monthly Estimated Hours',
};

const customFieldTypes = ['provider', 'talent', 'jobs']

const customFieldsHeadersIdentifiers = {
    provider: '(Individual and company custom field)',
    talent: '(Talents under company custom field)',
    jobs: '(Jobs custom field)',
}

const customFieldIdPrefix = 'customField '

const updateModeOverrideFields = {
    milestoneRequestedAmount: { type: Number, name: 'milestoneRequestedAmount' }
}

const allCsvJobTypes = ['assign', 'offer']

const csvJobTypes = {
    assign: 'assign',
    offer: 'offer',
}

const clearValueKeyword = 'DELETE_VALUE'
const csvDefaultAttributes = {
    [milestonesColumns.timeFrame]: 'once',
}

const RESPONSES = {
    YES: 'Yes',
    NO: 'No'
}

const offerJobTimeFrameMap = {
    onceOptions: ['once', 'one time', 'one-time', 'onetime'],
    ongoingOptions: ['ongoing', 'on going', 'on-going'],
    once: 'once',
    ongoing: 'ongoing',
}

module.exports = {
    mandatoryJobIDString,
    paymentCategories,
    commandOptions,
    talentsColumns,
    talentsHeaders,
    milestonesColumns,
    milestonesHeaders,
    errorCodes,
    customFieldTypes,
    customFieldsHeadersIdentifiers,
    customFieldIdPrefix,
    updateModeOverrideFields,
    allCsvJobTypes,
    csvJobTypes,
    clearValueKeyword,
    csvDefaultAttributes,
    RESPONSES,
    offerJobTimeFrameMap,
}
