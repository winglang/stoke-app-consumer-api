/* eslint-disable no-confusing-arrow */
/* eslint-disable no-param-reassign */
/* eslint-disable no-magic-numbers */
/* eslint-disable radix */

'use strict'

const { _ } = require('lodash')

const { SettingsService, constants } = require("stoke-app-common-api")
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const CUSTOM_FIELD = 'customFields'

const serverSideFilterNames = {
    openPaymentCycle: 'openPaymentCycle',
    closePaymentCycle: 'closePaymentCycle',
}

const dateFilterPeriodTypes = {
    year: {
        isForced: 'isYearlyForced',
        period: 'year',
    },
    monthly: {
        isForced: 'isMonthlyForced',
        period: 'month',
    },
    customPeriod: {
        isForced: 'isCustomPeriodForced',
        period: 'customPeriod',
    },
    quarter: {
        period: 'quarter',
    },
    relative: {
        isForced: 'isRelativeForced',
    },
}

const CUSTOM_FIELD_ENTITY_TYPES = {
    providerCustomFields: 'providerCustomFields',
    talentCustomFields: 'talentCustomFields',
    jobsCustomFields: 'jobsCustomFields',
    milestoneCustomFields: 'milestoneCustomFields',
}

const getPeriodRange = (year, quarter, month, customPeriod) => {
    let startPeriod = null;
    let endPeriod = null;

    if (customPeriod) {
        const { from, to } = customPeriod
        if (from && to) {
            const startPeriodLocal = new Date(from)
            const endPeriodLocal = new Date(to)
            startPeriod = Date.UTC(startPeriodLocal.getFullYear(), startPeriodLocal.getMonth(), startPeriodLocal.getDate())
            endPeriod = Date.UTC(endPeriodLocal.getFullYear(), endPeriodLocal.getMonth(), endPeriodLocal.getDate(), 23, 59, 59)
        }
    } else if (!quarter && !month) {
        startPeriod = Date.UTC(year, 0, 1)
        endPeriod = Date.UTC(year, 11, 31, 23, 59, 59)
    } else if (month) {
        startPeriod = Date.UTC(year, month - 1, 1)
        endPeriod = Date.UTC(year, month, 0, 23, 59, 59)
    } else {
        startPeriod = Date.UTC(year, (Number(quarter) - 1) * 3, 1)
        endPeriod = Date.UTC(year, ((Number(quarter) - 1) * 3) + 3, 0, 23, 59, 59)
    }

    return {
        startPeriod,
        endPeriod,
    }
}

const getCustomFieldsContentType = async (companyId) => {
    const companySettings = await settingsService.get(`${constants.prefix.company}${companyId}`);
    const customFieldsKeys = [
        CUSTOM_FIELD_ENTITY_TYPES.providerCustomFields,
        CUSTOM_FIELD_ENTITY_TYPES.talentCustomFields,
        CUSTOM_FIELD_ENTITY_TYPES.jobsCustomFields,
        CUSTOM_FIELD_ENTITY_TYPES.milestoneCustomFields,
    ]

    const customFields = _.pick(_.get(companySettings, 'itemData'), customFieldsKeys)
    return _.reduce(
        customFields,
        (acc, field) => {
            const { fields } = field
            const fieldsContentType = _.chain(fields).
                keyBy('id').
                mapValues(fieldd => ({ contentType: fieldd.contentType, type: fieldd.type })).
                value()
            acc = { ...acc, ...fieldsContentType }
            return acc
        },
        {},
    )
}

const resolvePeriodPicker = (periodPicker, pickerType) => {
    if (_.isEmpty(periodPicker)) return {}

    const year = _.get(periodPicker, dateFilterPeriodTypes.year.period)
    const month = parseInt(_.get(periodPicker, dateFilterPeriodTypes.monthly.period))
    const quarter = parseInt(_.get(periodPicker, dateFilterPeriodTypes.quarter.period))
    const customPeriod = _.get(periodPicker, dateFilterPeriodTypes.customPeriod.period)

    const { startPeriod: from, endPeriod: to } = getPeriodRange(
        year,
        _.get(periodPicker, dateFilterPeriodTypes.year.isForced) ? null : quarter,
        _.get(periodPicker, dateFilterPeriodTypes.monthly.isForced) ||
            _.get(periodPicker, dateFilterPeriodTypes.relative.isForced)
            ? month
            : null,
        _.get(periodPicker, dateFilterPeriodTypes.customPeriod.isForced) ? customPeriod : null,
    )

    return {
        [`${pickerType}`]: { from, to },
    }
}

const resolvePaymentCycle = selectedPaymentCycle => {
    if (!selectedPaymentCycle) return {}

    const filterName =
        selectedPaymentCycle > new Date().getTime()
            ? serverSideFilterNames.openPaymentCycle
            : serverSideFilterNames.closePaymentCycle

    return { [`${filterName}`]: { to: selectedPaymentCycle } }
}

// eslint-disable-next-line consistent-return
const resolveRequestedFields = (selectedColumns) => _.map(selectedColumns, (value, key) => {
        if (value) {
            return key.replace(`customField-`, '')
        }
    }).filter(Boolean)

const resolveFilterName = name => {
    switch (name) {
        case 'talentId':
            return 'talents'
        case 'spaceIds':
            return 'spaces'
        case 'departmentId':
            return 'workspaces'
        case 'hiringManagerId':
            return 'hiringManagers'
        case 'legalEntity':
            return 'legalEntities'
        case 'status':
            return 'milestoneStatus'
        case 'paymentMethod':
            return 'paymentMethods'
        case 'paymentStatus':
            return 'paymentStatus'
        case 'jobHandShakeStage':
            return 'acceptanceStatus'
        default:
            return name
    }
}

const addContentTypeToCustomFieldId = (customFields, customFieldsContentType) => _.reduce(
        customFields,
        (acc, field, key) => {
            const customFieldTypes = customFieldsContentType[key]
            acc[`${customFieldTypes.contentType}_${customFieldTypes.type}_${key}`] = field
            return acc
        },
        {},
    )

const resolveActiveFiltersForPaymentPage = async (activeFilters, companyId) => {
    const customFieldsContentType = await getCustomFieldsContentType(companyId)
    return _.reduce(
        Object.keys(activeFilters),
        (acc, filter) => {
            if (filter === CUSTOM_FIELD) {
                acc[filter] = addContentTypeToCustomFieldId(
                    activeFilters[filter],
                    customFieldsContentType,
                )
            } else {
                const filterName = resolveFilterName(filter)
                acc[filterName] = activeFilters[filter]
            }
            return acc
        },
        {},
    )
}

module.exports = {
    resolveActiveFiltersForPaymentPage,
    resolveRequestedFields,
    resolvePaymentCycle,
    resolvePeriodPicker,
};
