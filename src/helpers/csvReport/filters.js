/* eslint-disable max-lines */
/* eslint-disable no-confusing-arrow */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-await-in-loop */
/* eslint-disable guard-for-in */
/* eslint-disable no-magic-numbers */

'use strict'

const _ = require('lodash');
const { getMilestoneStatusByPaymentStatus } = require('../utils')
const { companyDueDateService, constants, jsonLogger } = require('stoke-app-common-api');
const { jobListType } = require('../../job/queryAttrs');
const { talentTypeOptionsIds, proficienciesOptions, backgroundCheckDisplayedStatus, talentStatuses, sqlAggType, customFieldTypes, talentProfileFieldPrefix } = require('./constants');
const { escape } = require('./csvReportHelper');
const { getComplianceColorByCalculatedValue } = require('../complianceHelper');

/** 
 * use 'contains' when it's a text field, use 'in' (or just omit expression) when it's multiselect field
 * use attributeNotExist: true when you want to get also objects without the attribute(when the attribute is not exist on all of the objects)
 */

const FILTERS = {
    itemStatus: 'itemStatus',
    legalEntities: 'legalEntities',
    openPaymentCycle: 'openPaymentCycle',
    closePaymentCycle: 'closePaymentCycle',
    entities: 'entities',
    workspaces: 'workspaces',
    milestoneDeliveryDate: 'milestoneDeliveryDate',
    assignedPaymentMethod: 'assignedPaymentMethod',
    assignedPaymentStatus: 'assignedPaymentStatus',
    paymentStatus: 'paymentStatus',
    paymentMethods: 'paymentMethods',
    location: 'location',
    score: 'score',
    languagesNames: 'languagesNames',
    complianceValue: 'complianceValue',
    backgroundStatusCheck: 'backgroundStatusCheck',
    listId: 'listId',
}

const complianceFilterKeys = {
    complianceValue: 'compliance',
    complianceWorkforce: 'complianceWorkforce',
    complianceLegal: 'complianceLegal',
    complianceTax: 'complianceTax',
};

const buildFilterSqlLikeExp = (key) => (value) => ` [${key}] LIKE '${value ? `%${value}%` : ""}'`
const buildFilterSqlStrategyExp = (col) => (values, strategy) => _.map(values, (val) => ` [${col}] LIKE '${val ? `%${val}%` : ""}'`).join(` ${strategy === 'AND' ? 'AND' : 'OR'} `)
const buildComplianceFilterSqlLikeOrExp = (compliance) => _.map(Object.keys(compliance), (key) => ` [${key}] in ('${compliance[key].join(`','`)}')`).join(` OR `)
const buildFilterSqlInExp = (key) => (values) => ` [${key}] in ('${values.join(`','`)}')`
const buildFilterSqlNotInExp = (key) => (values) => ` [${key}] NOT in ('${values.join(`','`)}')`
const buildFilterSqlListExp = (values) => _.map(values, (val) => ` [providerId] in ('${val}') OR [talentId] in ('${val}') `).join(` OR `)

const dynamicFiltersKeysByType = {
    [jobListType.jobsPage]: {
        workspaces: { key: 'workspaces', filterKey: 'entityId' },
        talents: { key: 'talents', filterKey: 'talentId' },
        hiringManagers: { key: 'hiringManagers', filterKey: 'hiringManagerId' }
    },
    [jobListType.paymentsPage]: {
        workspaces: { key: 'workspaces', filterKey: 'departmentId' },
        talents: { key: 'talents', filterKey: 'talentId' },
        hiringManagers: { key: 'hiringManagers', filterKey: 'hiringManagerId' },
        listId: { key: 'listId', filterKey: 'listId', buildFilterSqlExp: buildFilterSqlListExp },
    },
    [jobListType.paymentsPageInvoicesData]: {
        workspaces: { key: 'workspaces', filterKey: 'departmentId' },
        talents: { key: 'talents', filterKey: 'talentId' },
        providers: { key: 'providers', filterKey: 'providerId' },
        hiringManagers: { key: 'hiringManagers', filterKey: 'hiringManagerId' },
        listId: { key: 'listId', filterKey: 'listId', buildFilterSqlExp: buildFilterSqlListExp },
    },
    [jobListType.talentDirectoryPage]: {
        assignedDepartments: { key: 'assignedDepartments', filterKey: 'workspacesIds', buildFilterSqlExp: buildFilterSqlStrategyExp('workspacesIds') },
        talents: { key: 'talents', filterKey: 'talentId' },
        paymentMethods: { key: 'paymentMethods', filterKey: 'paymentMethod' },
        location: { key: 'location', filterKey: 'country' },
        score: { key: 'score', filterKey: 'score' },
        complianceValue: { key: 'complianceValue', filterKey: 'complianceValue', buildFilterSqlExp: buildComplianceFilterSqlLikeOrExp },
        payableStatusValue: { key: 'payableStatusValue', filterKey: 'isPayable' },
        skillNames: { key: 'skillNames', filterKey: 'skillsData', buildFilterSqlExp: buildFilterSqlStrategyExp('skillsData') },
        languagesNames: { key: 'languagesNames', filterKey: 'languagesData', buildFilterSqlExp: buildFilterSqlStrategyExp('languagesData') },
        reviewsBySearch: { key: 'reviewsBySearch', filterKey: 'commentsAndReviews', buildFilterSqlExp: buildFilterSqlLikeExp('commentsAndReviews') },
        itemStatus: { key: 'itemStatus', filterKey: 'status' },
        backgroundStatusCheck: { key: 'backgroundStatusCheck', filterKey: 'backgroundCheck' },
        listId: { key: 'listId', filterKey: 'listId', buildFilterSqlExp: buildFilterSqlListExp },
        favorite: { key: 'favorite', filterKey: 'favoriteHiringManagerIds', buildFilterSqlExp: buildFilterSqlLikeExp('favoriteHiringManagerIds') },
        notIncludeStatuses: { key: 'notIncludeStatuses', filterKey: 'notIncludeStatuses', buildFilterSqlExp: buildFilterSqlNotInExp('status') },
        certification: { key: 'certification', filterKey: 'certification', buildFilterSqlExp: buildFilterSqlStrategyExp('certification') },
        freelancerExperience: { key: 'freelancerExperience', filterKey: 'freelancerExperience', buildFilterSqlExp: buildFilterSqlStrategyExp('freelancerExperience') },
        signedUpNoNewJobsThreeMonths: { key: 'signedUpNoNewJobsThreeMonths', filterKey: 'signedUpNoNewJobsThreeMonths' },
    }
};

const createCustomFieldsColumnMapper = (customFields, withPrefix, pageKey) => _.reduce(customFields, (all, value) => {
    const { id, type, contentType } = value;
    const name = `${withPrefix ? `${contentType}_` : ''}${id}`;
    const buildFilterSqlExp = type === 'string' ? buildFilterSqlInExp(name) : buildFilterSqlStrategyExp(name)
    const sqlExpAgg = pageKey === jobListType.talentDirectoryPage && (contentType === customFieldTypes.provider || _.startsWith(id, talentProfileFieldPrefix)) ? sqlAggType.none : sqlAggType.count
    return { ...all, [name]: { sqlExp: name, buildFilterSqlExp, sqlExpAgg } }
}, {})


const createDynamicCustomFieldsFilter = (filters, withPrefix) => {
    const { customFields } = filters || {};
    const customFieldsActiveFilters = {};
    if (customFields) {
        for (const [filter, values] of Object.entries(customFields)) {
            const [contentType, , key] = filter.split('_');
            customFieldsActiveFilters[`${withPrefix ? `${contentType}_` : ''}${key}`] = _.map(values, value => typeof value === 'string' ? escape(value).replace(/'/gum, "''") : value || "")
        }
    }
    return customFieldsActiveFilters;
}

const blankOption = 'MISSING'

const allowedStatusForMilestoneDeliveryDate = [
    constants.job.status.paid,
    constants.job.status.completed,
    constants.job.status.active,
    constants.job.status.pendingApproval,
    constants.job.status.overageBudgetRequest,
    constants.job.status.secondApproval,
]

const jobsFiltersData = {
    acceptanceStatus: {
        path: 'itemData.jobHandShakeStage',
    },
    hasActiveMilestones: {
        path: 'viewData.milestonesData.filters.hasActiveMilestones',
    },
    hasOverdueMilestones: {
        path: 'viewData.milestonesData.filters.hasOverdueMilestones',
    },
    jobStartDate: {
        path: "itemData.jobStartDate",
        expression: constants.expressionDBType.inRange,
    },
    spaces: {
        path: `tags.${constants.tags.teams}`,
        expression: constants.expressionDBType.contains
    }
}

// use same configuration as in jobsFiltersData for ms dedicated filters (ie. space/team)
const msFiltersData = {
    itemStatus: {
        path: 'itemStatus',
    },
    paymentStatus: {
        path: 'itemData.payment.status',
    },
    assignedPaymentStatus: {
        path: 'itemData.payment.status',
        attributeNotExist: true
    },
    paymentMethods: {
        path: 'itemData.payment.feeData.transactionFee.type',
    },
    assignedPaymentMethod: {
        path: 'itemData.payment.feeData.transactionFee.type',
        attributeNotExist: true
    },
    milestoneDeliveryDate: {
        path: "itemData.date",
        expression: constants.expressionDBType.inRange,
    },
    milestoneRequestDate: {
        path: "itemData.talentCompletedAt",
        expression: constants.expressionDBType.inRange,
    },
    milestoneApproveDate: {
        path: "itemData.endTime",
        expression: constants.expressionDBType.inRange,
    },
    milestonePaymentDate: {
        path: "itemData.payment.dueDate",
        expression: constants.expressionDBType.inRange,
    },
    openPaymentCycle: {
        path: "itemData.payment.PendingDate",
        expression: constants.expressionDBType.filterExpressionBuilder,
    },
    closePaymentCycle: {
        path: "itemData.payment.PendingDate",
        expression: constants.expressionDBType.filterExpressionBuilder,
    },
}


const buildPaymentCycleFilterBuilder = (previousPaymentCycle, paymentCycle, companySettings) => {
    const from = previousPaymentCycle || companyDueDateService.getPreviousPaymentCycle(companySettings.itemData.paymentSchedule, paymentCycle);
    const fromEpoch = new Date(from).getTime()
    const toEpoch = new Date(paymentCycle).getTime()
    const pendingFromEpoch = new Date(fromEpoch).setHours(0, 0, 0, 0);
    const pendingToEpoch = new Date(toEpoch).setHours(0, 0, 0, 0);
    const isOpenCycle = paymentCycle > new Date().setUTCHours(23, 59, 59, 999);


    const buildFilterExpressionObject = (eaValuePrefix, eaNamePrefix) => {

        const eaValueFrom = `${eaValuePrefix}_from`;
        const eaValueTo = `${eaValuePrefix}_to`;
        const eaValueFromEpoch = `${eaValueFrom}_epoch`;
        const eaValueToEpoch = `${eaValueTo}_epoch`;
        const eaValuePendingFrom = `${eaValuePrefix}_pendingFrom`;
        const eaValuePendingTo = `${eaValuePrefix}_pendingTo`;
        const eaValuePendingFromEpoch = `${eaValueFrom}_pendingEpoch`;
        const eaValuePendingToEpoch = `${eaValueTo}_pendingEpoch`;
        const eaValueStatusPaid = `${eaValuePrefix}_paid`;
        const eaValueStatusCompleted = `${eaValuePrefix}_completed`;
        const eaValuePendinPO = `${eaValuePrefix}_pendingPO`;

        const expressionAttributeValues = {
            [eaValueFrom]: new Date(fromEpoch).toISOString(),
            [eaValueTo]: new Date(toEpoch).toISOString(),
            [eaValueFromEpoch]: fromEpoch,
            [eaValueToEpoch]: toEpoch,
            [eaValuePendingFrom]: new Date(pendingFromEpoch).toISOString(),
            [eaValuePendingTo]: new Date(pendingToEpoch).toISOString(),
            [eaValuePendingFromEpoch]: pendingFromEpoch,
            [eaValuePendingToEpoch]: pendingToEpoch,
            [eaValueStatusPaid]: constants.job.status.paid,
            [eaValueStatusCompleted]: constants.job.status.completed,
            [eaValuePendinPO]: constants.payment.status.pendingPO,
        }

        const eaNameItemData = `${eaNamePrefix}_itemData`
        const eaNamePayment = `${eaNamePrefix}_payment`
        const eaNamePendingDate = `${eaNamePrefix}_pendingDate`
        const eaNameDueDateDate = `${eaNamePrefix}_dueDate`
        const eaNameItemStatus = `${eaNamePrefix}_itemStatus`
        const eaNamePaymentStatus = `${eaNamePrefix}_status`
        const eaNamePendingDatePath = `${eaNameItemData}.${eaNamePayment}.${eaNamePendingDate}`
        const eaNameDueDatePath = `${eaNameItemData}.${eaNamePayment}.${eaNameDueDateDate}`
        const eaNamePaymentStatusPath = `${eaNameItemData}.${eaNamePayment}.${eaNamePaymentStatus}`

        const expressionAttributeNames = {
            [eaNameItemData]: 'itemData',
            [eaNamePayment]: 'payment',
            [eaNamePendingDate]: 'PendingDate',
            [eaNameDueDateDate]: 'dueDate',
            [eaNameItemStatus]: 'itemStatus',
            [eaNamePaymentStatus]: 'status'
        }

        const attributeExistsFilter = `attribute_exists(${eaNamePendingDatePath})
                          AND (
                            ((${eaNamePendingDatePath} BETWEEN ${eaValuePendingFrom} AND ${eaValuePendingTo} OR ${eaNamePendingDatePath} BETWEEN ${eaValuePendingFromEpoch} AND ${eaValuePendingToEpoch}) AND ${eaNameItemStatus} = ${eaValueStatusPaid})
                            OR 
                            ((${eaNameDueDatePath} BETWEEN ${eaValueFrom} AND ${eaValueTo} OR ${eaNameDueDatePath} BETWEEN ${eaValueFromEpoch} AND ${eaValueToEpoch}) AND ${eaNameItemStatus} = ${eaValueStatusCompleted} AND attribute_exists(${eaNameDueDatePath}))
                          )`

        const attributeNotExistsFilter = `attribute_not_exists(${eaNamePendingDatePath}) AND (${eaNameItemStatus} IN (${eaValueStatusCompleted}))`
        const conditionalExpression = isOpenCycle
            ? `((${attributeNotExistsFilter}) OR (${attributeExistsFilter}))`
            : attributeExistsFilter

        const filterExpression = `(${eaNamePaymentStatusPath} <> ${eaValuePendinPO} AND ${conditionalExpression})`;
        return {
            expressionAttributeValues,
            expressionAttributeNames,
            filterExpression
        }
    }

    return buildFilterExpressionObject
}

// eslint-disable-next-line max-params
const normalizeFilters = (filters = {}, departmentBylegalEntities, companySettings, type, lists, userId) => {

    const normalizedFiltersRes = Object.keys(filters).reduce((normalizedFilters, key) => {
        switch (key) {
            case FILTERS.itemStatus: {
                if (type === jobListType.paymentsPage) {
                    normalizedFilters[key] = getMilestoneStatusByPaymentStatus(filters[key])
                } else if (type === jobListType.talentDirectoryPage) {
                    normalizedFilters[key] = _.map(filters[key], status => talentStatuses[status])
                }
                return normalizedFilters;
            }
            case FILTERS.legalEntities: {
                const entitiesResultsFromLegalEntities = filters[key].reduce((entitiesId, legalEntity) => {
                    const entityId = _.get(departmentBylegalEntities, legalEntity)
                    if (entityId) {
                        return entitiesId.concat(entityId)
                    }
                    return entitiesId
                }, [])
                normalizedFilters[FILTERS.entities] = entitiesResultsFromLegalEntities
                return normalizedFilters;
            }
            case FILTERS.openPaymentCycle: {
                normalizedFilters[key] = buildPaymentCycleFilterBuilder(filters[key].from, filters[key].to, companySettings)
                return normalizedFilters;
            }
            case FILTERS.closePaymentCycle: {
                const from = filters[key].from || companyDueDateService.getPreviousPaymentCycle(companySettings.itemData.paymentSchedule, filters[key].to);
                normalizedFilters[key] = buildPaymentCycleFilterBuilder(from, filters[key].to, companySettings)
                return normalizedFilters;
            }
            case FILTERS.assignedPaymentMethod: {
                if (filters[key].includes(blankOption)) {
                    normalizedFilters[key] = filters[key]
                } else {
                    normalizedFilters[FILTERS.paymentMethods] = filters[key]
                }
                return normalizedFilters;
            }
            case FILTERS.assignedPaymentStatus: {
                if (filters[key].includes(constants.payment.status.paid)) {
                    filters[key].push(constants.payment.status.paidVerified)
                }
                if (filters[key].includes(blankOption)) {
                    normalizedFilters[key] = filters[key]
                } else {
                    normalizedFilters[FILTERS.paymentStatus] = filters[key]
                }
                return normalizedFilters;
            }
            case FILTERS.score: {
                // eslint-disable-next-line no-shadow
                normalizedFilters[key] = Array.from({ length: Math.ceil((5 - filters[key][0]) * 10) + 1 }, (_, i) => {
                    const number = filters[key][0] + (i * 0.1);
                    return (number % 1 === 0 ? number : number.toFixed(1)).toString();
                })
                return normalizedFilters
            }
            case FILTERS.languagesNames: {
                normalizedFilters[key] = filters[key].reduce((acc, language) => {
                    const proficiencies = _.get(language, 'proficiency', [])
                    return acc.concat(proficiencies.length && proficiencies[0] !== 'any'
                        ? _.map(proficiencies, (proficiency) => `${_.capitalize(language.id)} (${proficienciesOptions[proficiency.toLowerCase()]})`)
                        : [_.capitalize(language.id)])
                }, [])
                return normalizedFilters
            }
            case FILTERS.complianceValue: {
                normalizedFilters[key] = filters[key].reduce((normalizedCompliance, compliance) => {
                    const selectedValues = _.filter(compliance.values, value => value.isChecked)
                    if (selectedValues.length) {
                        normalizedCompliance[complianceFilterKeys[compliance.id]] = _.map(selectedValues, selectedValue => getComplianceColorByCalculatedValue(selectedValue.id))
                    }
                    return normalizedCompliance
                }, {})
                return normalizedFilters
            }
            case FILTERS.backgroundStatusCheck: {
                normalizedFilters[key] = _.reduce(filters[key], (acc, value) => {
                    acc.push(value === blankOption ? '' : backgroundCheckDisplayedStatus[value])
                    return acc;
                }, [])
                return normalizedFilters
            }
            case FILTERS.listId: {
                if (filters[FILTERS.listId] === 'favorite') {
                    normalizedFilters.favorite = userId
                    return normalizedFilters
                }
                const talents = _.map(filters[key], listId => _.get(lists, [listId, 'listData'], {}));
                const selectedTalents = _.chain(talents).
                    map(data => _.values(data)).
                    flatten().
                    filter(talent => _.get(talent, 'active', true)).
                    value();

                if (_.isEmpty(selectedTalents)) {
                    normalizedFilters[key] = ['']
                } else {
                    normalizedFilters[key] = _.map(selectedTalents, data => data.id);
                }
                return normalizedFilters
            }
            default: {
                normalizedFilters[key] = filters[key]
                return normalizedFilters;
            }
        }
    }, {});

    if (type === jobListType.paymentsPage) {
        normalizedFiltersRes.itemStatus = FILTERS.itemStatus in filters
            ? _.intersection(normalizedFiltersRes.itemStatus, allowedStatusForMilestoneDeliveryDate)
            : allowedStatusForMilestoneDeliveryDate
    }
    jsonLogger.info({ type: "TRACKING", function: "createCsvReport::normalizeFilters", normalizedFiltersRes });
    return normalizedFiltersRes;
}

const isValidWorkspaceFilter = filters => {
    const entities = _.get(filters, FILTERS.entities)
    const workspaces = _.get(filters, FILTERS.workspaces)
    if (entities && entities.length > 0 && workspaces && workspaces.length > 0) {
        const filtersIntersections = _.intersection(entities, workspaces)
        if (filtersIntersections.length === 0) {
            return {
                isValid: false,
                validFilter: null
            }
        }
        return {
            isValid: true,
            validFilter: filtersIntersections
        }
    }
    return {
        isValid: true,
        validFilter: _.union(entities, workspaces)
    }
}

const buildDedicatedFilters = (typeFiltersData, filters) => _.reduce(filters, (acc, values, key) => {
    if (_.size(_.castArray(values)) && _.hasIn(typeFiltersData, key)) {
        const filterData = typeFiltersData[key];
        const expression = _.get(filterData, 'expression');
        acc[filterData.path] = { value: values, ...expression && { expression }, attributeNotExist: _.get(filterData, 'attributeNotExist', false) }
    }
    return acc;
}, {});

const getTalentActiveFilters = (filters = {}, dynamicFiltersKeys) => {
    const dynamicFilters = {}
    if (_.size(dynamicFiltersKeys)) {
        _.forEach(dynamicFiltersKeys, (value) => {
            const filterValues = _.get(filters, value.key);
            dynamicFilters[value.filterKey] = filterValues;
            delete filters[value.key];
        })
    }

    const { talentType = [] } = filters || {};
    const talentTypeFilter = {}
    if (talentType.includes(talentTypeOptionsIds.INDIVIDUAL)) {
        talentTypeFilter['itemData.isProviderSelfEmployedTalent'] = [true];
    } else if (talentType.includes(talentTypeOptionsIds.COMPANY)) {
        talentTypeFilter['itemData.isProviderSelfEmployedTalent'] = { value: [false], attributeNotExist: true };
    }

    const activeFilters = { ...talentTypeFilter };
    return _.size({ ...activeFilters, ...dynamicFilters }) ? { talentActiveFilters: activeFilters, talentDynamicFilters: dynamicFilters } : null;
}

module.exports = {
    msFiltersData,
    jobsFiltersData,
    normalizeFilters,
    buildDedicatedFilters,
    isValidWorkspaceFilter,
    buildPaymentCycleFilterBuilder,
    getTalentActiveFilters,
    dynamicFiltersKeysByType,
    createDynamicCustomFieldsFilter,
    createCustomFieldsColumnMapper
};
