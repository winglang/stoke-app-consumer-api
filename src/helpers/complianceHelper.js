/* eslint-disable max-lines */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undefined */

'use strict';

const _ = require('lodash');
const { constants, prefixLib, idConverterLib, } = require('stoke-app-common-api');
const { resolveUserFullName } = require('./csvReport/csvReportHelper');
const { convertCountryCodeToName, getTalentCountry } = require('./utils');

const COMPLIANCE_INFO = 'complianceInfo';

const complianceColors = ['Green', 'Yellow', 'Red'];

const GRAY_COMPLIANCE_SCORE = 3;

const COMPLIANCE_STATUSES = {
    green: 'Green',
    yellow: 'Yellow',
    red: 'Red',
    grey: 'N/A',
};

const AUDIT_STATUSES = {
    inProgress: 'In progress',
    highRisk: 'High risk',
    moderateRisk: 'Moderate risk',
    noRisk: 'No risk',
};

const auditStatusesMap = {
    [AUDIT_STATUSES.inProgress]: 3,
    [AUDIT_STATUSES.highRisk]: 2,
    [AUDIT_STATUSES.moderateRisk]: 1,
    [AUDIT_STATUSES.noRisk]: 0,
};

const getComplianceScoreByColor = complianceColor => {
    const score = _.findIndex(complianceColors, color => color === complianceColor)
    return score < 0 ? GRAY_COMPLIANCE_SCORE : score
}

const getComplianceColorByCalculatedValue = calculatedValue => complianceColors[calculatedValue] || 'N/A'

const REMOTE_JOBS = {
    remotely: 'Remote',
    localPreferred: 'On-site',
    localRequired: 'On-site',
    local: 'On-site',
}

const complianceFields = {
    workingPeriod: 'workingPeriod',
    maxHrsMonth: 'maxHrsMonth',
    engagementTypes: 'engagementTypes',
    state: 'state',
    location: 'location',
    legalDocs: 'legalDocs',
    nda: 'nda',
    ipAssignment: 'ipAssignment',
    nonCompete: 'nonCompete',
    versatileEmployment: 'versatileEmployment',
    taxFormStatus: 'taxFormStatus',
    taxFormStatusUSA: 'taxFormStatusUSA',
    taxFormStatusIL: 'taxFormStatusIL',
    isPayable: 'isPayable',
    self: 'self',
    workforceAudit: 'workforceAudit',
    legalCompliance: 'legalCompliance',
}

const LEGAL_DOCUMENT_STATUS = {
    [constants.legalDocs.status.notUploaded]: 'Missing',
    [constants.legalDocs.status.missing]: 'Missing',
    [constants.legalDocs.status.sent]: 'Pending signature',
    [constants.legalDocs.status.viewed]: 'Pending signature',
    [constants.legalDocs.status.signed]: 'Digitally signed',
    [constants.legalDocs.status.manuallySigned]: 'Manually signed',
    [constants.legalDocs.status.expired]: 'Expired',
    [constants.legalDocs.status.deleted]: 'Deleted',
}

const CHECKED = 'checkmark-checked'
const UNCHECKED = 'checkmark-unchecked'
const SENT = 'sent-yellow'
const EXPIRED = 'error-circle'
const UPLOADED = 'uploaded-circle'
const DELETED = 'deleted-circle'
const MISSING = 'attention'

const getLegalDocIconByStatus = status => {
    switch (status) {
        case constants.legalDocs.status.signed:
        case constants.legalDocs.status.manuallySigned:
            return CHECKED
        case constants.legalDocs.status.sent:
        case constants.legalDocs.status.viewed:
            return SENT
        case constants.legalDocs.status.deleted:
            return DELETED
        case constants.legalDocs.status.expired:
            return EXPIRED
        case constants.legalDocs.status.uploaded:
            return UPLOADED
        case constants.legalDocs.status.notUploaded:
        case constants.legalDocs.status.missing:
            return MISSING
        default:
            return UNCHECKED
    }
}

const complianceConfigScore = {
    fields: {
        [complianceFields.workingPeriod]: {
            warn: value => getComplianceScoreByColor(_.capitalize(value)) > 0,
        },
        [complianceFields.engagementTypes]: {
            warn: value => value === constants.engagementTypes.project,
        },
        [complianceFields.state]: {
            warn: value => !value,
        },
        [complianceFields.location]: {
            warn: value => value,
        },
        [complianceFields.legalDocs]: {
            warn: value => value &&
                (value.status === constants.legalDocs.status.notUploaded ||
                    (value.expirationDate && new Date(value.expirationDate) < new Date())),
        },
        [complianceFields.legalCompliance]: {
            warn: value => value && value.status === constants.legalDocs.status.missing,
        },
        [complianceFields.versatileEmployment]: {
            warn: value => value,
        },
        [complianceFields.taxFormStatus]: {
            warn: value => value,
        },
        [complianceFields.isPayable]: {
            warn: value => value,
        },
        [complianceFields.self]: {
            warn: value => value,
        },
    },
}

const normalizeLegalCompliance = (legalCompliance, legalDocs) => ({
    ...legalCompliance,
    contractElements: _.mapValues(_.get(legalCompliance, 'contractElements'), element => ({
        ...element,
        warn: complianceConfigScore.fields.legalCompliance.warn(element),
        value: LEGAL_DOCUMENT_STATUS[_.get(element, 'status')],
        iconType: complianceConfigScore.fields.legalCompliance.warn(element)
            ? 'attention'
            : getLegalDocIconByStatus(_.get(element, 'status')),
        subTitle: _.map(_.get(element, 'documents'), documentId => _.get(
            _.find(legalDocs, legalDoc => legalDoc.id === documentId),
            'name',
            documentId,
        ),),
    })),
})

// eslint-disable-next-line no-confusing-arrow
const booleanToComplianceValue = (value, trueValue = 'Yes', falseValue = 'No') => value ? trueValue : falseValue
const normalizeEngagementTypes = engagementTypes => _.map(engagementTypes, type => constants.engagementTypes[type])
const normalizeLocations = locations => _.map(locations, location => REMOTE_JOBS[location])
const getTaxFormStatusValue = (name, isValid) => [
    {
        value: booleanToComplianceValue(
            Boolean(name),
            `${name} ${'submitted'}`,
            'not submitted',
        ),
        warn: complianceConfigScore.fields.taxFormStatus.warn(!isValid),
        isValid,
    },
]

// eslint-disable-next-line no-extra-parens, no-negated-condition
const taxFormStatusDetails = (taxDoc) => (!taxDoc
    ? null
    : getTaxFormStatusValue(
        _.get(taxDoc, 'name', ''),
        [COMPLIANCE_STATUSES.green, COMPLIANCE_STATUSES.grey].includes(COMPLIANCE_STATUSES[_.get(taxDoc, 'score', 'grey')],),
    ))

// eslint-disable-next-line max-lines-per-function
const getComplianceEnrichment = (provider, talentsByProviderId, providersByProviderId) => {
    if (!provider) return {}
    const isFreelancer = _.get(provider, 'itemData.isProviderSelfEmployedTalent')
    const isCompanyProvider = provider.itemId.startsWith(constants.prefix.provider)
    const isProvider = isCompanyProvider || isFreelancer

    const companyProvider = providersByProviderId[idConverterLib.getProviderIdFromTalentId(provider.itemId)]
    const sequenceOfWork = _.get(!isFreelancer || isCompanyProvider ? provider : companyProvider, 'itemData.sequenceOfWork', [])
    const taxDocs = _.get(!isFreelancer || isCompanyProvider ? provider : companyProvider, 'itemData.taxCompliance.taxDocs', [])

    // eslint-disable-next-line no-extra-parens
    const workforceAudit = _.reduce(_.get(provider, 'itemData.workforceAudits', []), (acc, workforceAuditItem) => (new Date(workforceAuditItem.id).getTime() > new Date(acc.id).getTime() ? workforceAuditItem : acc))
    const activeEngagementLength = _.get(sequenceOfWork, 'activeEngagementLength')
    const continuityHourLimit = Math.max(
        _.get(sequenceOfWork, 'continuityValues.workContinuityHoursRed', 0),
        _.get(sequenceOfWork, 'continuityValues.workContinuityHoursYellow', 0),
    )
    const continuityScore = _.get(sequenceOfWork, 'score')
    const country = convertCountryCodeToName(getTalentCountry(provider.itemData))
    const legalComplianceToUpdate = _.get(provider, 'complianceInfo.legalCompliance')

    const workforceComplianceStatus = isProvider ? _.get(isCompanyProvider ? provider : companyProvider, 'itemData.workforceComplianceStatus') : {}
    const engagementTypes = normalizeEngagementTypes(_.get(workforceComplianceStatus, 'engagementType', []))
    const locations = normalizeLocations(_.get(workforceComplianceStatus, 'location', []))

    const workingPeriod =
        activeEngagementLength >= 0
            ? `${activeEngagementLength} month${activeEngagementLength === 1 ? '' : 's'}`
            : undefined

    const talents = _.get(talentsByProviderId, provider.itemId, []).map(talent => ({
        name: resolveUserFullName(talent.itemData),
        id: talent.itemId,
        img: talent.itemData.img,
        email: talent.itemData.email,
        complianceValue: _.get(talent, 'complianceInfo.scores.general'),
    }))

    const complianceData = {
        isCompanyProvider,
        isCompanyTalent: !isProvider,
        isFreelancer: isFreelancer,
        workingPeriod: workingPeriod
            ? [
                {
                    value: workingPeriod,
                    warn: complianceConfigScore.fields.workingPeriod.warn(continuityScore),
                    subTitleValue:
                        continuityHourLimit > 0 ? `${continuityHourLimit} hrs` : undefined,
                },
            ]
            : undefined,
        engagementTypes: engagementTypes.length ? engagementTypes.map(engagementType => ({ value: engagementType })) : undefined,
        location: locations.length ? [{ value: locations.length === 1 ? locations[0] : 'Partially' }] : undefined,
        state: country ? [{ value: country }] : undefined,
        legalCompliance: normalizeLegalCompliance(legalComplianceToUpdate, provider.itemData.legalDocuments),
        taxFormStatusUSA: taxFormStatusDetails(_.find(taxDocs, { type: 'USA Tax File' })),
        taxFormStatusIL: taxFormStatusDetails(_.find(taxDocs, { type: 'Israeli Tax Exempt' })),
        self: [
            {
                value: booleanToComplianceValue(provider.itemData.isProviderSelfEmployedTalent),
            },
        ],
        talentsScores: _.get(provider, 'complianceInfo.talentsScores'),
        talents,
        workforceAudit,
    }
    complianceData.scores = _.get(provider, 'complianceInfo.scores')
    return complianceData
}

const getWorstTalentComplianceDataForMarketplace = (talents = []) => {
    // eslint-disable-next-line no-confusing-arrow
    const valueComparator = (valueA, valueB) => valueA > valueB ? valueA : valueB

    return talents.reduce(
        (worstComplianceTalentData, talent) => {
            const {
                general: worstGeneral,
                tax: worstTax,
                workforce: worstWorkforce,
                legal: worstLegal,
            } = worstComplianceTalentData
            const { general, tax, workforce, legal } = _.get(talent, 'complianceInfo.scores', {})
            return {
                general: valueComparator(worstGeneral, general),
                tax: valueComparator(worstTax, tax),
                workforce: valueComparator(worstWorkforce, workforce),
                legal: valueComparator(worstLegal, legal),
            }
        },
        {
            general: 0,
            tax: -1,
            workforce: -1,
            legal: -1,
        },
    )
}

// eslint-disable-next-line max-lines-per-function
const getComplianceInfo = (freelancer, talentsUnderCurrentProviderEnriched = []) => {
    let scores = {}
    // eslint-disable-next-line no-undef-init
    let talentsScores = undefined

    const legal = getComplianceScoreByColor(_.get(COMPLIANCE_STATUSES, [_.get(freelancer, 'itemData.legalCompliance.score')]),)
    const tax = prefixLib.isProvider(_.get(freelancer, 'itemId', '')) ? getComplianceScoreByColor(_.get(COMPLIANCE_STATUSES, [_.get(freelancer, 'itemData.taxCompliance.score', 3)]),) : 3

    const workforceAudits = _.get(freelancer, 'itemData.workforceAudits')

    const workforceAudit = _.reduce(
        workforceAudits,
        (acc, audit) => {
            if (new Date(audit.id).getTime() > new Date(acc.id).getTime()) {
                return audit;
            }
            return acc;
        },
    )

    const auditStatus = _.get(workforceAudit, 'status')

    const providerTalentsScores = _.map(talentsUnderCurrentProviderEnriched, (talent = {}) => _.get(talent, 'complianceInfo.scores.general'))
    if (talentsUnderCurrentProviderEnriched && !_.get(freelancer, 'itemData.isProviderSelfEmployedTalent')) {
        talentsScores = _.reduce(
            providerTalentsScores,
            (acc, score) => ({ ...acc, [`${score}`]: (acc[score] || 0) + 1 }),
            {},
        )
    }

    const workforceCompliance = _.get(freelancer, 'itemData.sequenceOfWork')

    const isHrComplianceRiskStatusRed = _.get(freelancer, 'itemData.sequenceOfWork.isHrComplianceRiskStatusRed', false);

    let workforce = null;

    if (isHrComplianceRiskStatusRed) {
        workforce = auditStatusesMap[AUDIT_STATUSES.highRisk];
    } else if (_.get(workforceAudit, 'startDate') && auditStatus) {
        workforce = auditStatusesMap[auditStatus];
    } else {
        workforce = getComplianceScoreByColor(_.capitalize(_.get(workforceCompliance, 'score', 'grey')));
    }

    const allScores = [workforce, legal, tax, ...providerTalentsScores]

    // eslint-disable-next-line no-nested-ternary
    const general = allScores.includes(2) ? 2 : allScores.includes(1) ? 1 : allScores.every(score => score === 3) ? 3 : 0

    const isMarketplace = Object.values(constants.marketplaces).some(place => String(_.get(freelancer, 'itemId', '')).startsWith(place.provider))
    if (isMarketplace) {
        scores = getWorstTalentComplianceDataForMarketplace(talentsUnderCurrentProviderEnriched)
    } else {
        scores = { general, workforce, legal, tax }
    }

    const legalCompliance = _.get(freelancer, 'itemData.legalCompliance', {})

    return { scores: scores, legalCompliance, talentsScores }
}

module.exports = {
    COMPLIANCE_INFO,
    COMPLIANCE_STATUSES,
    getComplianceInfo,
    complianceColors,
    getComplianceEnrichment,
    getComplianceColorByCalculatedValue,
};
