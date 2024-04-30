/* eslint-disable max-lines */
/* eslint-disable no-undefined */
/* eslint-disable no-magic-numbers */

'use strict'

const _ = require('lodash');
const { constants, jsonLogger, CompaniesService, CompanyProvidersService, SettingsService, POService, dynamoDbUtils, prefixLib } = require('stoke-app-common-api');
const { jobListType } = require('../../job/queryAttrs');
const { basicFieldsForJobsPage, basicFieldsForPaymentPage, allFieldsForPaymentPage, allFieldsForJobsPage, basicFieldsForTalentDirectoryPage, allFieldsForTalentDirectoryPage } = require('./csvFieldsLists')
const { prettifyNumber } = require('../utils');
const { currencySigns } = require('stoke-app-common-api/config/constants');
const dayjs = require('dayjs');
const { customFieldsTypesNames, customFieldTypes, proficienciesOptions, marketplacesProviderIds, payableStatusesColors, talentStatuses } = require('./constants');
const { companyProvidersTableName, customersTableName, settingsTableName, budgetsTableName, gsiItemsByCompanyIdIndexName, gsiItemsByCompanyIdAndItemIdIndexName, gsiItemsByCompanyIdAndItemIdIndexNameV2 } = process.env;
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const poService = new POService(budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const getMilestonePaymentsProps = milestone => {
    const isAddedFromMilestoneRequest = _.get(milestone, 'itemData.isAddedFromMilestoneRequest', false);
    const msCost = _.get(milestone, 'itemData.cost', "");
    const msActualCost = _.get(milestone, 'itemData.actualCost');
    const msRequestLocal = _.get(milestone, 'itemData.providerData.taxInfo.total');
    const msActualRequestCost = _.get(milestone, 'itemData.actualRequestCost');
    const planned = isAddedFromMilestoneRequest ? '' : msCost
    const plannedLocal = isAddedFromMilestoneRequest
        ? ""
        : _.get(milestone, 'itemData.costLocal', msCost);
    const isCompleted = [constants.job.status.completed, constants.job.status.paid].includes(milestone.itemStatus)
    return {
        planned,
        plannedLocal,
        defaultPlanned: planned,
        requested: msRequestLocal || msActualRequestCost || "",
        defaultRequested: isAddedFromMilestoneRequest
            ? msActualRequestCost || msCost
            : msActualRequestCost,
        approved: isCompleted ? msRequestLocal || msActualCost : "",
        defaultApproved: isCompleted ? msActualCost || msCost : undefined,
    }
}

const getCustomRateData = (job, ms) => {
    const taxInfo = _.get(ms, 'itemData.providerData.taxInfo')
    const { requested } = getMilestonePaymentsProps(ms);

    const customRateData = _.get(job, 'itemData.customRateData')
    const category = _.get(customRateData, 'category')
    const ratePer = _.get(customRateData, 'ratePer')

    const customRate = ratePer && category && `${ratePer} per ${category.toLowerCase()}`
    const customRateCategory = category && ` (per ${category.toLowerCase()})`
    const customPlanned = _.get(customRateData, 'estimatedQuantity')
    const customRequested = requested === '' ? ''
        : prettifyNumber((requested - (_.get(taxInfo, 'tax') || 0)) / (ratePer || 1));

    return {
        customRate,
        customPlanned,
        customRequested,
        customRateCategory
    }
}

const getMandatoryFields = (type, filterKey, fieldsFlags = []) => {
    const mandatoryFields = [];
    switch (type) {
        case jobListType.jobsPage:
            switch (filterKey) {
                case constants.jobsFilters.active.key:
                    mandatoryFields.push(...['milestone', 'job']);
                    break;
                default:
                    mandatoryFields.push(...[]);
                    break;
            }
            break;
        case jobListType.talentDirectoryPage:
            mandatoryFields.push(...['name', 'email', 'providerName']);
            break;
        default:
            mandatoryFields.push(...[]);
    }

    const fieldsByFlag = {
        lineItems: ["lineItemTitle", "lineItemDescription", "lineItemAmount", "lineItemCurrency"],
        timeReport: ["timeReportDate", "timeReportHours", "timeReportComment"],
    }

    if (fieldsFlags.length > 0) {
        _.forEach(fieldsByFlag, (fields, flag) => {
            if (fieldsFlags.includes(flag)) {
                mandatoryFields.push(...fields);
            }
        })
    }

    return _.uniq(mandatoryFields);
}

const orederObjectForCsvRow = (object, order) => _.map(order, item => object[item])
const objectsToArrayOfValues = (objects, order) => _.map(objects, (object) => orederObjectForCsvRow(object, order));

const basicFieldsNames = (type) => {
    switch (type) {
        case jobListType.jobsPage:
            return allFieldsForJobsPage;
        case jobListType.paymentsPageInvoicesData:
        case jobListType.paymentsPage:
            return allFieldsForPaymentPage;
        case jobListType.talentDirectoryPage:
            return allFieldsForTalentDirectoryPage;
        default:
            return {};
    }
}

const getExistedRequestedFields = (requestedFields = [], mandatoryFields = [], type) => _.intersection(basicFieldsNames(type), _.uniq([...requestedFields, ...mandatoryFields]));

const basicFieldsKeyNamePairs = (type) => {
    let basicFields = []
    switch (type) {
        case jobListType.jobsPage:
            basicFields = basicFieldsForJobsPage
            break;
        case jobListType.paymentsPage:
            basicFields = basicFieldsForPaymentPage
            break;
        case jobListType.talentDirectoryPage:
            basicFields = basicFieldsForTalentDirectoryPage
            break;
        default:
            return [];
    }
    return _.chain(basicFields).keyBy('field').
        mapValues('headerName').
        value();
}

const getExistedRequestedCustomFields = (customFields, requestedFields) => {
    const customFieldsKeys = _.map(customFields, 'id');
    return _.intersection(customFieldsKeys, requestedFields);
}

const getCustomFieldHeader = customField => {
    const contentType = customField.type.split('_');
    let typeName = ''
    switch (contentType[0]) {
        case customFieldTypes.provider:
            typeName = customFieldsTypesNames.provider
            break
        case customFieldTypes.talent:
            typeName = customFieldsTypesNames.talent
            break
        case customFieldTypes.job:
            typeName = customFieldsTypesNames.jobs
            break
        case customFieldTypes.ms:
            typeName = customFieldsTypesNames.milestone
            break
        default:
            return _.get(customField, 'name')
    }
    return `${_.get(customField, 'name')} (${typeName} custom field)`
}

const getCustomFieldsKeyNamePairs = (customFields, customFieldsTypes) => _.reduce(
    customFields,
    (acc, field) => {
        acc[field.id] = getCustomFieldHeader({ ...field, type: _.get(customFieldsTypes, field.id) })
        return acc
    },
    {}
)


const getTalentProfileCustomFieldsKeyItemPairs = (talentProfileCustomFields, fieldPath) => _.reduce(
    talentProfileCustomFields,
    (acc, field) => {
        acc[field.id] = _.get(field, fieldPath)
        return acc
    },
    {}
)

const getStatusString = (ms) => {
    const { itemStatus } = ms;
    const isRejected = Boolean(_.get(ms, 'itemData.rejectDate')) || _.get(ms, 'itemData.isRejected');
    if (isRejected) {
        return constants.payment.status.rejected;
    }
    return itemStatus;
}

const escape = (str) => String(str).replace(/"/gum, "'").
replace(/\n/gum, " ")

const getMilestoneTitle = (ms) => {
    const originalMilestoneTitle = _.get(ms, 'itemData.title', '');
    const splittedMilestoneNumber = _.get(ms, 'itemData.splittedMilestoneNumber');
    const milestoneTitle = splittedMilestoneNumber ? `${originalMilestoneTitle} part ${splittedMilestoneNumber}` : originalMilestoneTitle;

    return milestoneTitle
}

// eslint-disable-next-line no-extra-parens
const getValidAddress = addressField => (addressField ? addressField : '')

const getFullAddress = talent => {
    const { address = '', city = '', state = '', postalCode = '', country = '' } = talent || {}
    const fullAddrees = [
        `${getValidAddress(address)}`,
        `${getValidAddress(city)}`,
        `${getValidAddress(state)}`,
        `${getValidAddress(postalCode)}`,
        `${getValidAddress(country)}`,
    ]
    return _.filter(fullAddrees, Boolean).join(' ')
}

const getTalentData = (ms, job, talentsbyTalentId, talentIdsNamesKeyValuePairs) => {
    const talentId = _.get(job, 'itemData.talentId');
    const talentCompletedAt = _.get(ms, 'itemData.talentCompletedAt');
    const talentName = _.get(talentIdsNamesKeyValuePairs, talentId, '');
    const talent = talentsbyTalentId[talentId]
    const talentEmail = _.get(talent, 'itemData.email')
    return {
        talentId,
        talentCompletedAt,
        talentName,
        talentEmail
    }
}

const getApprovalName = (sortedApprovedLevels, usersByUserId) => {
    const approvedByUserId = _.get(sortedApprovedLevels, '[0].approvedBy');
    const approvedByObj = approvedByUserId ? usersByUserId[approvedByUserId] : {};
    return sortedApprovedLevels.length > 0 ? `${_.get(approvedByObj, 'itemData.givenName')} ${_.get(approvedByObj, 'itemData.familyName')}` : '';
}

const getApprovalsNames = (sortedApprovedLevels, usersByUserId) => _.map(sortedApprovedLevels, level => {
    const approvedByUserId = level.approvedBy;
    const approvedByObj = approvedByUserId ? usersByUserId[approvedByUserId] : {};
    return approvedByObj ? `${_.get(approvedByObj, 'itemData.givenName')} ${_.get(approvedByObj, 'itemData.familyName')}` : ''
})

const getSortedApprovedLevels = (ms, column) => {
    const approvals = _.get(ms, 'itemData.approvals', []);
    const approvedLevels = _.filter(approvals, level => level.approvedBy && level.type !== 'external' && level.action === column);
    return _.sortBy(approvedLevels, level => level.approveDate);
}

const getApprovalsData = (ms, usersByUserId) => {
    const sortedApprovedLevels = getSortedApprovedLevels(ms, constants.approvalActionStatus.approve)
    const sortedRejectedLevels = getSortedApprovedLevels(ms, constants.approvalActionStatus.reject)
    const approvedBy = getApprovalsNames(sortedApprovedLevels, usersByUserId)
    const rejectedBy = getApprovalsNames(sortedRejectedLevels, usersByUserId)
    const approveDate = _.get(sortedApprovedLevels, '[0].approveDate');
    return {
        approvedBy,
        rejectedBy,
        approveDate,
    }
}

const getInvoiceData = (ms) => {
    const invoiceDate = _.get(ms, 'itemData.invoiceDate', _.get(ms, 'itemData.proFormaInvoiceDate', _.get(ms, 'itemData.autoProFormaInvoiceDate'))); 
    const proFormaInvoiceNumber = _.get(ms, 'itemData.proFormaInvoiceNumber', _.get(ms, 'itemData.autoProFormaInvoiceNumber'));
    const invoiceNumber = _.get(ms, 'itemData.invoiceNumber', proFormaInvoiceNumber)
    const allFiles = _.get(ms, 'itemData.files', []).filter(Boolean);

    const invoice = allFiles.find(file => file.isInvoice)
    const proForma = allFiles.find(file => file.isProForma) || allFiles.find(file => file.autoTalentInvoice)
    return {
        invoiceDate,
        invoiceNumber,
        proFormaInvoiceNumber,
        invoice,
        proForma,
    }
}

const getCompanyUsersByUserId = async (companyId) => {
    const companyUsers = await companiesService.listAllCompanyUsers(gsiItemsByCompanyIdIndexName, companyId);
    return _.keyBy(companyUsers, 'userId');
}

const getCompanyTalents = (companyId) => companyProvidersService.listCompany(companyId, constants.prefix.talent);

const getCompanyTalentsByTalentId = (companyTalents) => _.keyBy(companyTalents, 'itemId')

const getCompaniesTalentsNames = (talents) => {
    const keyValuePair = {};
    for (const talent of talents) {
        const itemId = _.get(talent, 'itemId');
        let name = _.get(talent, 'itemData.name');
        if (!name) {
            name = `${_.get(talent, 'itemData.firstName')} ${_.get(talent, 'itemData.lastName')}`.trim();
        }
        keyValuePair[itemId] = name;
    }
    jsonLogger.info({ type: "TRACKING", function: "createCsvReport::getCompaniesTalentsNames", talentsSize: _.size(keyValuePair) });
    return keyValuePair;
}

const getCompanyProvidersKeyValuePairs = async (companyId) => {
    const companyProviders = await companyProvidersService.companyProvidersPagination('listCompany', [
        companyId,
        null,
        null,
        null
    ]);
    return _.keyBy(companyProviders, 'itemId');
}

const getCompanyWorkspaces = (companyId) => companiesService.list(gsiItemsByCompanyIdIndexName, companyId, constants.prefix.entity);

const getCompanyWorkspacesKeyValuePairs = (companyEntities) => _.chain(companyEntities).keyBy('itemId').
    mapValues('itemData.entityName').
    value();

const getCompanyWorkspacesByEntityId = (companyEntities) => _.keyBy(companyEntities, 'itemId');

const getCompanyLegalEntitiesAndDepartment = (companyId) => settingsService.listLegalEntitiesAndDepartments(gsiItemsByCompanyIdAndItemIdIndexName, companyId);

const getCompanyLegalEntitiesByDepartment = (legalEntities) => legalEntities.reduce((departments, legalEntity) => {
    const entityId = _.get(legalEntity, 'entityId')
    if (entityId) {
        departments[entityId] = _.get(legalEntity, 'itemData.legalEntity.displayName')
    }
    return departments
}, {});


const getCompanyDepartmentsByLegalEntities = (departments) => departments.reduce((legalEntities, department) => {
    const legalEntity = _.get(department, 'itemData.legalEntity.displayName')
    if (legalEntity) {
        legalEntities[legalEntity] = [...legalEntities[legalEntity] || [], _.get(department, 'entityId')]
        return legalEntities;
    }
    return legalEntities
}, {});

const reduceCustomTypeFields = (customFields, contentType) => customFields.reduce((acc, field) => {
    _.set(field, 'contentType', contentType.replace('_', ''));
    acc[field.id] = `${contentType}${field.type}`;
    return acc;
}, {});

const getCustomFields = (settings) => {
    const jobsCustomFields = _.get(settings, 'itemData.jobsCustomFields.fields', []);
    const jobCustomFieldsTypes = reduceCustomTypeFields(jobsCustomFields, constants.prefix.job);

    const milestonesCustomFields = _.get(settings, 'itemData.milestoneCustomFields.fields', []);
    const msCustomFieldsTypes = reduceCustomTypeFields(milestonesCustomFields, constants.prefix.milestone);

    const talentCustomFields = _.get(settings, 'itemData.talentCustomFields.fields', []);
    const talentCustomFieldsTypes = reduceCustomTypeFields(talentCustomFields, constants.prefix.talent);

    const providerCustomFields = _.get(settings, 'itemData.customFields.companyProvider', [])
    const providerCustomFieldsTypes = reduceCustomTypeFields(providerCustomFields, constants.prefix.provider);

    return { customFields: [...jobsCustomFields, ...milestonesCustomFields, ...talentCustomFields, ...providerCustomFields], customFieldsTypes: { ...jobCustomFieldsTypes, ...msCustomFieldsTypes, ...talentCustomFieldsTypes, ...providerCustomFieldsTypes } };
}

const getPOsNumberByItemId = async (companyId, companySettings) => {
    if (!_.get(companySettings, 'itemData.isPORequired')) {
        return {};
    }
    const pos = await poService.listPOsV2(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId);
    return _.reduce(pos, (posNumbersById, po) => {
        posNumbersById[po.itemId] = _.get(po, 'itemData.poNumber');
        return posNumbersById;
    }, {})
}

const getCompanySettings = (companyId) => settingsService.get(`${constants.prefix.company}${companyId}`);

const getCompanyCustomFields = (companySettings, entitiesCustomFields) => {
    let { customFields, customFieldsTypes } = getCustomFields(companySettings);
    for (const entitiesSettings of entitiesCustomFields) {
        const { customFields: customFieldsFromEntities, customFieldsTypes: entitiesCustomFieldsTypes } = getCustomFields(entitiesSettings);
        customFields = [...customFields, ...customFieldsFromEntities];
        customFieldsTypes = { ...customFieldsTypes, ...entitiesCustomFieldsTypes };
    }
    return { customFields, customFieldsTypes };
}

const getEntitiesCustomFields = async (filters, companyWorkspacesKeyValuePairs) => {
    let { workspaces = [] } = filters;
    if (workspaces.length === 0) {
        workspaces = _.keys(companyWorkspacesKeyValuePairs) || [];
    }
    const uniqueWorkspaces = _.chain(workspaces).uniq().
        map((entityId) => ({ 'itemId': entityId })).
        value();
    const settingsResults = await dynamoDbUtils.batchGetParallel(settingsTableName, uniqueWorkspaces) || [];
    jsonLogger.info({ type: "TRACKING", function: "createCsvReport::getEntitiesCustomFields", settingsResultsSize: settingsResults.length });
    return settingsResults;
}

// eslint-disable-next-line max-params
const preperCustomFieldContent = (tags, field, fieldType, userByUserId) => {
    switch (fieldType) {
        case constants.customFieldTypes.multiselect:
            {
                const options = _.get(tags, field, [])
                return options.join && options.join(", ");
            }
        case constants.customFieldTypes.string:
            {
                const fieldText = _.get(tags, field, '') || '';
                return escape(fieldText);
            }
        case constants.customFieldTypes.users:
            {
                let fieldData = _.get(tags, field, []);
                fieldData = Array.isArray(fieldData) ? fieldData : [];
                const usersNames = _.map(fieldData, (userData = {}) => {
                    const user = userByUserId[userData.id]
                    if (user && user.itemData) {
                        return `${user.itemData.givenName}_${user.itemData.familyName}`
                    }

                    return ''

                })
                return usersNames.join(", ")
            }
        default:
            return _.get(tags, field, '');
    }
}

// eslint-disable-next-line max-params
const preperCustomFieldContentForJobs = (currentJob, ms, field, customFieldsTypes, userByUserId) => {
    const [contentType, fieldType] = customFieldsTypes[field].split('_');
    const prefix = `${contentType}_`;
    const tags = _.get(prefixLib.isJob(prefix) ? currentJob : ms, `tags`, {});
    return preperCustomFieldContent(tags, field, fieldType, userByUserId)
}

// eslint-disable-next-line max-params
const preperCustomFieldContentForProviders = (talent, provider, field, customFieldsTypes, userByUserId) => {
    const [contentType, fieldType] = customFieldsTypes[field].split('_');
    const prefix = `${contentType}_`;
    const tags = _.get(prefixLib.isTalent(prefix) ? talent : provider, `tags`, {});
    return preperCustomFieldContent(tags, field, fieldType, userByUserId)
}

// eslint-disable-next-line max-params
const preperCustomFieldContentForAll = (talent, provider, currentJob, ms, field, customFieldsTypes, userByUserId) => {
    const [contentType, fieldType] = customFieldsTypes[field].split('_');
    const prefix = `${contentType}_`;
    let tags = {};
    switch (prefix) {
        case constants.prefix.job:
            tags = _.get(currentJob, `tags`, {});
            break;
        case constants.prefix.milestone:
            tags = _.get(ms, `tags`, {});
            break;
        case constants.prefix.provider:
            tags = _.get(provider, `tags`, {});
            break;
        case constants.prefix.talent:
            tags = _.get(talent, `tags`, {});
            break;
        default:
            break;
    }
    return preperCustomFieldContent(tags, field, fieldType, userByUserId)
}

const createJobForFreelancer = (jobs = []) => _.groupBy(jobs.filter(job => job.itemId.startsWith('job_')), 'itemData.talentId')
const createActiveJobForFreelancer = (jobs = []) => _.groupBy(jobs.filter(job => job.itemId.startsWith('job_') && [constants.job.status.active, constants.job.status.jobRequest, constants.job.status.budgetRequest].includes(job.itemStatus)), 'itemData.talentId')

const joinObjectValues = (delimiter, props, obj) => props.
    filter(key => obj[key] || obj[key] === 0).
    map(key => String(obj[key]).trim()).
    join(delimiter)

const resolveUserFullName = (itemData = {}) => itemData.name ||
    itemData.fullName ||
    joinObjectValues(' ', ['firstName', 'middleName', 'lastName'], itemData)

const getDepartmentsAmountValues = (departments, companyEntities, companyId, returnIds = false) => {

    if (_.includes(departments, companyId) || !departments) {
        return returnIds ? _.join(_.map(Object.keys(companyEntities), entity => entity.split('_')[1]), ', ') : 'All Workspaces';
    }
    if (_.isEmpty(departments)) {
        return returnIds ? 'MISSING' : 'No workspaces assigned';
    }
    return returnIds ? _.join(departments, ', ')
        : _.join(
            _.map(departments, departmentId => escape(_.get(companyEntities, [`${constants.prefix.entity}${departmentId}`, 'itemData', 'entityName']))),
            ', ',
        )
}

const getProviderSkillsInfo = talent => {
    const skills = [
        ..._.get(talent, 'itemData.skillsAddedByEmployer', []),
        ..._.get(talent, 'itemData.talentProfileData.skills', []),
    ]
    const skillTitles = _.uniq(_.map(skills, 'title'))
    return skillTitles
}

const getProviderLanguagesInfo = talent => {
    const languagesData = [
        ..._.get(talent, 'itemData.languagesAddedByEmployer', []),
        ..._.get(talent, 'itemData.talentProfileData.languages', []),
    ]
    return _.uniqBy(_.filter(languagesData, filter => filter.name), filter => filter.name)
}

const getProviderLanguagesSummary = talent => getProviderLanguagesInfo(talent).
            map(language => _.capitalize(language.name) +
                (language.value
                    ? ` (${proficienciesOptions[language.value.toLowerCase()]})`
                    : '')).
                    join(', ')

const getProviderCertificationsSummary = talent => {
    const certifications = _.get(talent, 'itemData.talentProfileData.certifications', [])
    return _.join(_.map(certifications, certification => _.get(certification, 'title', '')), ', ')
}

const getExperienceRange = (experienceYears) => {
    // eslint-disable-next-line radix
    const experienceYearsNumber = parseInt(experienceYears);
    if (experienceYearsNumber >= 1 && experienceYearsNumber <= 2) {
        return '1-2 years'
    } else if (experienceYearsNumber >= 3 && experienceYearsNumber <= 5) {
        return '3-5 years'
    } else if (experienceYearsNumber > 5) {
        return '6+ years'
    }

    return 'Not provided'
}

const getProviderExperienceSummary = talent => {
    const experiences = _.get(talent, 'itemData.talentProfileData.experience', [])
    return _.join(_.map(experiences, experience => {
        const experienceRange = getExperienceRange(_.get(experience, 'time', '0'))
        const experienceTitle = _.get(experience, 'title', '')
        return `${experienceTitle} (${experienceRange})`
    }), ', ')
}

const getAverageRatingByReviews = talent => {
    const reviews = _.get(talent, 'itemData.talentProfileReviews');
    if (!reviews) return ''

    const filteredReviewsWithRating = _.filter(reviews, review => _.get(review, 'rating') > 0)
    const score = _.reduce(filteredReviewsWithRating, (sum, review) => sum + _.get(review, 'rating'), 0) /
        _.size(filteredReviewsWithRating)
    return parseFloat(score.toFixed(1)) || ''
}

const getTalentDisplayedStatus = (isSelfEmployed, status) => {
    const isNotRegistered = [talentStatuses.invited, talentStatuses.notInvited].includes(status)
    const isStatusShown = isSelfEmployed || !isNotRegistered
    return isStatusShown ? talentStatuses[status] : talentStatuses.noStatus
}

const getIsTalentPayable = (talent, provider) => {
    const payableStatus = _.get(talent.payableStatus, 'payableStatus')
    const isProviderMarketPlace = marketplacesProviderIds.includes(_.get(provider, 'itemId')) || _.get(provider, 'itemData.isMarketplace') || _.get(provider, 'itemData.stokeMarketplace')
    if (isProviderMarketPlace || payableStatus === payableStatusesColors.payable) {
        return 'Yes'
    } else if (payableStatus === payableStatusesColors.customRestricted) {
        return 'Custom restricted'
    }
    return 'No'
}

const getTotalEarned = (talent) => {
    const totalEarnedObject = _.get(talent, 'totalEarned')
    return _.keys(totalEarnedObject).reduce((acc, key) => {
        if (totalEarnedObject[key]) {
            return `${acc}${acc ? ', ' : ''}${totalEarnedObject[key]}${currencySigns[key]}`
        }
        return acc
    }, '')
}

const queryTalents = async (companyId, talentActiveFilters) => {
    jsonLogger.info({ type: "TRACKING", function: "createCsvReport::queryTalents", talentActiveFilters });
    const talents = await companyProvidersService.companyProvidersPagination('listByCompanyIdWithFilter', [
        companyId,
        talentActiveFilters
    ]);
    
    return talents;
}

const getCommentsAndReviews = (talentItemData) => {
    const comments = _.get(talentItemData, 'talentProfileComments', [])
    const reviews = _.get(talentItemData, 'talentProfileReviews', [])
    const commentsAndReviewsString = _.map([...comments, ...reviews], review => _.get(review, 'description')).join(', ')
    return commentsAndReviewsString.replace(/\n/gum, " ")
}


const getExperienceOptions = (talent) => {
    const experience = _.get(talent, 'itemData.talentProfileData.experience', []);
    if (_.isEmpty(experience)) {
        return ['Not provided']
    }
    const experienceYearsRanges = _.uniq(_.map(experience, exp => getExperienceRange(_.get(exp, 'time', '0'))))

    return experienceYearsRanges
}

const getIsSignedUpNoNewJobsThreeMonths = (status, freelancerJobs) => {
    const lastJob = _.max(_.map(freelancerJobs, 'itemData.jobStartDate'));
    return (
        [constants.companyProvider.status.active, constants.companyProvider.status.registered].includes(status) &&
        (!lastJob || dayjs().diff(dayjs(lastJob), 'month') >= 3)
    )
}

module.exports = {
    getMilestonePaymentsProps,
    orederObjectForCsvRow,
    objectsToArrayOfValues,
    getExistedRequestedFields,
    basicFieldsKeyNamePairs,
    getExistedRequestedCustomFields,
    getCustomFieldsKeyNamePairs,
    getStatusString,
    getMandatoryFields,
    escape,
    getCustomRateData,
    getMilestoneTitle,
    getFullAddress,
    getTalentData,
    getCompanyUsersByUserId,
    getCompaniesTalentsNames,
    getCompanyWorkspacesKeyValuePairs,
    getCompanyLegalEntitiesAndDepartment,
    getCompanyLegalEntitiesByDepartment,
    getCompanyDepartmentsByLegalEntities,
    getCompanyWorkspacesByEntityId,
    getCompanyProvidersKeyValuePairs,
    getCompanyTalentsByTalentId,
    getCompanyTalents,
    getCompanyWorkspaces,
    getApprovalName,
    getApprovalsData,
    getInvoiceData,
    getSortedApprovedLevels,
    getCompanyCustomFields,
    getEntitiesCustomFields,
    getCompanySettings,
    createJobForFreelancer,
    resolveUserFullName,
    getDepartmentsAmountValues,
    getProviderSkillsInfo,
    getProviderLanguagesInfo,
    getProviderLanguagesSummary,
    getAverageRatingByReviews,
    getTalentDisplayedStatus,
    getIsTalentPayable,
    getTotalEarned,
    preperCustomFieldContentForJobs,
    preperCustomFieldContentForProviders,
    preperCustomFieldContentForAll,
    queryTalents,
    getCommentsAndReviews,
    createActiveJobForFreelancer,
    basicFieldsNames,
    getTalentProfileCustomFieldsKeyItemPairs,
    preperCustomFieldContent,
    getExperienceOptions,
    getProviderCertificationsSummary,
    getProviderExperienceSummary,
    getPOsNumberByItemId,
    getIsSignedUpNoNewJobsThreeMonths,
};
