/* eslint-disable max-lines */
/* eslint-disable complexity */
/* eslint-disable no-await-in-loop */
/* eslint-disable max-depth */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undefined */
/* eslint-disable max-params */
/* eslint-disable max-lines-per-function */

"use strict";

const {
    errorCodes,
    milestonesColumns,
    milestonesHeaders,
    talentsColumns,
    updateModeOverrideFields,
    customFieldsHeadersIdentifiers,
    csvJobTypes,
    csvDefaultAttributes,
    RESPONSES,
    offerJobTimeFrameMap,
} = require("./constansts");
const _ = require("lodash");
const jobs = require("../jobs");
const { isItemAvailableBudget } = require("stoke-app-common-api/helpers/budgetHelper");
const { jsonLogger, constants, JobsService, ExchangeRatesService, SettingsService, BudgetsService, idConverterLib, settingsGetterHelper, payableStatusHelper, dynamoDbUtils } = require("stoke-app-common-api");
const { innerUpdateMilestoneStatusGetStatus, innerUpdateMilestoneStatus } = require("../job/updateMilestoneStatus");
const { transformDataForRow, customFieldsAppending, customFieldStringBuilder } = require("./utils");
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const exchangeRatesService = new ExchangeRatesService(process.env.exchangeRatesTableName, null, null, settingsService);

const isOfferJobRow = (rowData) => _.lowerCase(_.get(rowData, milestonesColumns.jobType)).trim() === _.lowerCase(csvJobTypes.offer) ||
    (_.get(rowData, 'itemStatus') === constants.job.status.pending && _.get(rowData, 'JobFlow') === constants.jobFlow.offer)

const enrichMilestoneWithFromRawData = (fetchResults, rawDataById) => {
    jsonLogger.info({ type: "TRACKING", function: "jobs::enrichMilestoneWithFromRawData", fetchResults, rawDataById });
    
    return _.map(fetchResults, (res) => {
        const newMs = { ...res }
        for (const key of Object.keys(updateModeOverrideFields)) {
            let value = ''
            switch (updateModeOverrideFields[key].type) {
                case Number:
                    value = _.parseInt(rawDataById[res.itemId][`${updateModeOverrideFields[key].name}`])
                    break;
                default: 
                    return rawDataById[res.itemId][`${updateModeOverrideFields[key].name}`]
            }
            newMs.itemData.tempActualRequestCost = value
        }

        return newMs
    })
}

const getMilestonesBulk = async (milestonesToFetch) => {
    jsonLogger.info({ type: "TRACKING", function: "jobs::getMilestonesBulk", milestonesToFetch });
    let fetchResults = [] 
    
    if (!_.isEmpty(milestonesToFetch)) {
        const jobKeys = _.uniqBy(milestonesToFetch.map((ms) => ({ entityId: ms.entityId, itemId: ms.milestoneId })))
        jsonLogger.info({ type: "TRACKING", function: "jobs::getMilestonesBulk", jobKeys });
        fetchResults = await dynamoDbUtils.batchGetParallel(process.env.jobsTableName, jobKeys);
    }
    
    jsonLogger.info({ type: "TRACKING", function: "jobs::getMilestonesBulk", fetchResults });
    return enrichMilestoneWithFromRawData(fetchResults, _.keyBy(milestonesToFetch, 'milestoneId'))
}

const checkRowMissingPermissions = (row, currentUserData) => {
    if (currentUserData.role === constants.user.role.admin) {
        return false
    }

    if (currentUserData.role === constants.user.role.user) {
        if (currentUserData.id !== row.userId) {
            return true
        }
    }

    return false
}

const validateRow = (row, currentUserData = {}, allProvidersByItemId = {}, allTalentsByEmail = {}, companySetting, isUpdateMilestonesMode, milestonesFetchedById) => {
    const errors = [];
    
    if (isUpdateMilestonesMode) {
        const fetchedMilestone = milestonesFetchedById[row.milestoneId]
        const missingEntityOrMilestone = _.isEmpty(fetchedMilestone) || fetchedMilestone.itemStatus !== constants.job.status.active
        if (missingEntityOrMilestone) {
            errors.push(errorCodes.milestoneToUpdateNotExisting)
        }
    }
    
    if (!row.entityId) {
        errors.push(errorCodes.missingEntityId)
    }

    if (!isUpdateMilestonesMode && !row.talentId) {
        if (!_.get(row, talentsColumns.talentFirstName) || !_.get(row, talentsColumns.talentLastName)) {
            errors.push(errorCodes.missingTalent)
        }
    }
    const { isWorkforceNonCompliantBlocked: isNonCompliantBlockedSettingsOn, isNonLegalCompliantBlocked: isNonLegalCompliantBlockedOn } = settingsGetterHelper.getNonCompliantBlockedSetting(companySetting);
    const provider = allProvidersByItemId[row.providerId];
    const talent = allTalentsByEmail[row.email];
    if (provider) {
        if (isNonCompliantBlockedSettingsOn) {
            const CompliantBlockedEntity = _.get(talent, 'itemData.isProviderSelfEmployedTalent', true) ? provider : talent;
            if (_.get(CompliantBlockedEntity, 'itemData.sequenceOfWork.isNonCompliantBlocked', false)) {
                errors.push(errorCodes.nonCompliantProvider)
            }
        }
        if (isNonLegalCompliantBlockedOn) {
            const isProviderLegalComplianceScoreRed = _.get(provider, 'itemData.legalCompliance.score') === constants.LEGAL_COMPLIANCE_SCORE.red;
            const isTalentLegalComplianceScoreRed = _.get(talent, 'itemData.legalCompliance.score') === constants.LEGAL_COMPLIANCE_SCORE.red;
            if (isProviderLegalComplianceScoreRed || isTalentLegalComplianceScoreRed) {
                errors.push(errorCodes.nonCompliantProvider)
            }
        }
        if (row.milestoneRequestedAmount) {
            const { payableSummary } = payableStatusHelper.getPayableStatusInfo(provider, companySetting) || {};
            jsonLogger.info({ type: "TRACKING", function: "jobsUtils::validateRow", payableSummary });
            const { payableElements, paymentConditions } = payableSummary || {};
            const { paymentDetailsSubmitted, taxFormsSubmitted } = payableElements || {};
            const { paymentMethodAllowed, workforceComplianceStatus = true, mandatoryLegalDocsSigned = true } = paymentConditions || {};

            if (!paymentDetailsSubmitted) {
                errors.push(errorCodes.noPayableProvider)
            }
            if (!taxFormsSubmitted) {
                errors.push(errorCodes.missingTaxForm)
            }
            if (!paymentMethodAllowed) {
                errors.push(errorCodes.disabledPaymentMethod)
            }
            if (!workforceComplianceStatus || !mandatoryLegalDocsSigned) {
                errors.push(errorCodes.nonCompliantProvider)
            }
        }
    }

    // checking if user is not an admin but also trying to create ms / job under another user
    if (checkRowMissingPermissions(row, currentUserData)) {
        errors.push(errorCodes.insufficientPermission)
    }
    return errors;
}

const getJobKey = (row) => `${row.entityId || row.entityName}${row.userId || row.userEmail}${isOfferJobRow(row) ? '' : row.talentId || ''}${(row.jobTitle || '').trim().toLowerCase()}`

const getOfferJobTimeFrame = (timeFrameString) => {
    if (_.includes(offerJobTimeFrameMap.onceOptions, _.toLower(timeFrameString))) {
        return offerJobTimeFrameMap.once
    }
    if (_.includes(offerJobTimeFrameMap.ongoingOptions, _.toLower(timeFrameString))) {
        return offerJobTimeFrameMap.ongoing
    }
    return csvDefaultAttributes[milestonesColumns.timeFrame]
}

const addData = (rows, userId, companyId, mapUserEmailToId, mapUserIdToEmail, mapEntityNameToId, allTalents) => {
    const rowsWithData = [];
    for (const row of rows) {
        const isCreationRow = _.isEmpty(row.milestoneId)
        const isOfferJob = isOfferJobRow(row)
        rowsWithData.push({
            ...transformDataForRow(row),
            milestoneDate: row.milestoneDate ? new Date(row.milestoneDate) : new Date(),
            companyId,
            talentId: _.get(allTalents, [(_.get(row, 'email') || '').toLowerCase(), `itemId`]),
            providerId: idConverterLib.getProviderIdFromTalentId(_.get(allTalents, [(_.get(row, 'email') || '').toLowerCase(), `itemId`])),
            talentFirstName: isCreationRow ? _.get(row, 'talentFirstName') || _.get(allTalents, [_.get(row, 'email' || '').toLowerCase(), `itemData`, 'firstName']) : '',
            talentLastName: isCreationRow ? _.get(row, 'talentLastName') || _.get(allTalents, [_.get(row, 'email' || '').toLowerCase(), `itemData`, 'lastName']) : '',
            userFirstName: isCreationRow ? _.get(mapUserEmailToId, [_.get(row, 'userEmail' || '').toLowerCase(), `itemData`, 'givenName']) || _.get(mapUserIdToEmail, [userId, `itemData`, 'givenName']) : '',
            userLastName: isCreationRow ? _.get(mapUserEmailToId, [_.get(row, 'userEmail' || '').toLowerCase(), `itemData`, 'familyName']) || _.get(mapUserIdToEmail, [userId, `itemData`, 'familyName']) : '',
            userId: isCreationRow ? _.get(mapUserEmailToId, [_.get(row, 'userEmail' || '').toLowerCase(), `userId`], userId) : '',
            entityId: idConverterLib.removePrefix(_.get(mapEntityNameToId, [_.get(row, 'entityName'), `itemId`]), constants.prefix.entity),
            createdBy: userId,
            ...isOfferJob && {
                [milestonesColumns.timeFrame]: getOfferJobTimeFrame(_.get(row, milestonesColumns.timeFrame)),
                [milestonesColumns.fixedRate]: _.get(row, milestonesColumns.fixedRate),
                [milestonesColumns.hourlyRate]: _.get(row, milestonesColumns.hourlyRate),
                [milestonesColumns.instantHire]: _.get(row, milestonesColumns.instantHire),
                [milestonesColumns.quote]: _.get(row, milestonesColumns.quote),
                [milestonesColumns.monthlyEstimatedHours]: _.get(row, milestonesColumns.monthlyEstimatedHours),
            },
        });
    }
    return rowsWithData;
};

const addJobData = (rows, mapJobToJobId, customFieldsJob) => {
    const rowsWithData = [];
    for (const row of rows) {
        let rowTags = {}
        _.forEach(customFieldsJob, customField => {
            const id = _.get(customField, 'id')
            const getText = customFieldStringBuilder(id, customFieldsHeadersIdentifiers.jobs)
            const tagUpdate = _.get(row, getText)
            if (tagUpdate) {
                rowTags = customFieldsAppending(rowTags, customField, tagUpdate)
            }
        })
        rowsWithData.push({
            ...row,
            jobId: _.get(mapJobToJobId, [getJobKey(row), 'itemId']),
            currency: (_.get(mapJobToJobId, [getJobKey(row), 'itemData', 'currency']) || row.currency || constants.currencyTypes.default || '').toUpperCase(),
            existingTags: {
                ..._.get(mapJobToJobId, [getJobKey(row), 'tags']),
            },
            mandatoryTags: { ..._.get(row, 'mandatoryTags') },
            customFieldsTags: { ...rowTags }
        });
    }
    return rowsWithData;
};

// eslint-disable-next-line no-extra-parens
const castJobKeyToMilestoneRow = (rows) => _.groupBy(rows, row => getJobKey(row))

const getMapJobKeyToJobId = (rows, mapJobs) => {
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::getActiveJobs", mapJobs });
    // eslint-disable-next-line no-extra-parens
    const rowsByJobs = _.groupBy(rows, row => getJobKey(row));
    const mapJobToJobId = {};
    // eslint-disable-next-line guard-for-in
    for (const keyJob in rowsByJobs) {
        const job = mapJobs[keyJob];
        if (job) {
            mapJobToJobId[keyJob] = job;
        }
    }
    return mapJobToJobId;
}

const getActiveJobs = async (companyId, rows) => {
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::getActiveJobs", companyId });
    const activeJobs = await jobsService.jobsPagingtion('listByCompanyId', undefined, [process.env.gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, null, constants.prefix.job, [constants.job.status.active, constants.job.status.pending]]);
    const mapJobs = _.keyBy(activeJobs, (job) => {
        const jobValuesObject = { ...job, ...job.itemData }
        return getJobKey(jobValuesObject)
    });
    return getMapJobKeyToJobId(rows, mapJobs)
}

const rowsValidations = (rows, currentUserData, allProvidersByItemId, allTalentsByEmail, companySetting, milestonesFetchedById) => {
    const rowsError = [];
    const rowsWithoutError = [];
    
    for (const row of rows) {
        const isUpdateMilestonesMode = !_.isEmpty(row.milestoneId)

        const errors = validateRow(row, currentUserData, allProvidersByItemId, allTalentsByEmail, companySetting, isUpdateMilestonesMode, milestonesFetchedById);
        if (_.size(errors)) {
            rowsError.push({ ..._.omit(row, ['companyId', 'userId', 'entityId', 'talentId']), errors });
        } else {
            rowsWithoutError.push(row);
        }
    }

    return { rowsError, rowsWithoutError };
}

const validateMandatoryTags = (jobMandatoryTags, msMandatoryTags) => !_.isEmpty(jobMandatoryTags) && !_.isEqual(msMandatoryTags, jobMandatoryTags)
const validateCustomFieldsTags = (jobCustomFieldsTags, msCustomFieldsTags) => !_.isEmpty(msCustomFieldsTags) && !_.isEmpty(jobCustomFieldsTags) && !_.isEqual(msCustomFieldsTags, jobCustomFieldsTags)

const getIsFieldDifferent = (job, row, column) => !_.isEmpty(_.get(row, column)) && !_.isEqual(_.get(row, column), _.get(job, column))

const errorOnColumnStringAppend = (errorOnColumnString, errorString) => {
    let errorOnColumnStringReturn = errorOnColumnString
    if (_.isEmpty(errorOnColumnString)) {
        errorOnColumnStringReturn = errorString
    } else {
        errorOnColumnStringReturn = `${errorOnColumnString} and ${errorString}`
    }
    return errorOnColumnStringReturn
}

const validateOfferJobFields = (job, row, rowsError, rowsWithoutError, jobKey) => {
    const rowsErrorReturn = rowsError
    let rowsWithoutErrorReturn = rowsWithoutError
    let errorOnColumnString = ''
    let isRowError = false

    const fieldsToValidate = [
        milestonesColumns.instantHire,
        milestonesColumns.fixedRate,
        milestonesColumns.hourlyRate,
        milestonesColumns.monthlyEstimatedHours,
        milestonesColumns.quote,
        milestonesColumns.jobDescription,
        milestonesColumns.jobStartDate,
    ]

    for (const field of fieldsToValidate) {
        const isFieldDifferent = getIsFieldDifferent(job, row, field)

        if (isFieldDifferent) {
            isRowError = true
            errorOnColumnString = errorOnColumnStringAppend(errorOnColumnString, milestonesHeaders[field])
        }
    }


    const fixedRate = _.get(row, milestonesColumns.fixedRate)
    const hourlyRate = _.get(row, milestonesColumns.hourlyRate)

    const isHourlyAndFixedMixed = (!_.isEmpty(hourlyRate) && !_.isEmpty(fixedRate)) ||
        (_.get(job, milestonesColumns.hourlyRate) && !_.isEmpty(fixedRate)) ||
        (_.get(job, milestonesColumns.fixedRate) && !_.isEmpty(hourlyRate))

    if (isRowError || isHourlyAndFixedMixed) {

        if (isHourlyAndFixedMixed) {
            rowsErrorReturn.push({ ..._.omit(row, ['companyId', 'userId', 'entityId', 'talentId']), errors: [errorCodes.offerJobHourlyAndFixedRateMixed(_.get(row, milestonesColumns.jobTitle))] });
        }

        rowsWithoutErrorReturn = _.filter(rowsWithoutErrorReturn, rowToFilter => getJobKey(rowToFilter) !== jobKey)
        rowsErrorReturn.push({ ..._.omit(row, ['companyId', 'userId', 'entityId', 'talentId']), errors: [errorCodes.offerJobFieldsNotConsistent(_.get(row, milestonesColumns.jobTitle), errorOnColumnString)] });
    } else {
        const offerJobAggregatedIndex = _.findIndex(rowsWithoutErrorReturn, rowToFilter => getJobKey(rowToFilter) === jobKey && _.get(rowToFilter, 'talentsIds'))

        const talentId = _.get(row, 'talentId')
        const providerId = _.get(row, 'providerId')
        const talentEmail = _.get(row, 'email')
        const talentFirstName = _.get(row, 'talentFirstName')
        const talentLastName = _.get(row, 'talentLastName')

        if (offerJobAggregatedIndex >= 0) {
            if (talentId && providerId && talentEmail && talentFirstName && talentLastName) {
                _.set(rowsWithoutErrorReturn, [offerJobAggregatedIndex, 'talentsIds'], _.concat(_.get(rowsWithoutErrorReturn, [offerJobAggregatedIndex, 'talentsIds']), talentId))
                _.set(rowsWithoutErrorReturn, [offerJobAggregatedIndex, 'providersIds'], _.concat(_.get(rowsWithoutErrorReturn, [offerJobAggregatedIndex, 'providersIds']), providerId))
                _.set(rowsWithoutErrorReturn, [offerJobAggregatedIndex, 'talentsEmails'], _.concat(_.get(rowsWithoutErrorReturn, [offerJobAggregatedIndex, 'talentsEmails']), talentEmail))
                _.set(rowsWithoutErrorReturn, [offerJobAggregatedIndex, 'talentsFirstNames'], _.concat(_.get(rowsWithoutErrorReturn, [offerJobAggregatedIndex, 'talentsFirstNames']), talentFirstName))
                _.set(rowsWithoutErrorReturn, [offerJobAggregatedIndex, 'talentsLastNames'], _.concat(_.get(rowsWithoutErrorReturn, [offerJobAggregatedIndex, 'talentsLastNames']), talentLastName))
            }
        } else {
            const offerJobAggregatedObject = {
                ..._.omit(row, ['talentId', 'providerId', milestonesColumns.email]),
                providersIds: [providerId],
                talentsEmails: [talentEmail],
                talentsIds: [talentId],
                talentsFirstNames: [talentFirstName],
                talentsLastNames: [talentLastName],
            }
            rowsWithoutErrorReturn = _.filter(rowsWithoutErrorReturn, rowToFilter => getJobKey(rowToFilter) !== jobKey)
            rowsWithoutErrorReturn.push(offerJobAggregatedObject)
        }
    }
    return { rowsErrorReturn, rowsWithoutErrorReturn }
}

const crossRowsValidation = (rowsError, rowsWithoutError, msRowsToJobKey) => {

    const mapJobKeyToTags = {}
    const jobsKeys = _.keys(msRowsToJobKey)
    let rowsErrorReturn = rowsError
    let rowsWithoutErrorReturn = rowsWithoutError
    for (const jobKey of jobsKeys) {
        let jobMandatoryTags = {}
        let jobCustomFieldsTags = {}
        let JobExistingTags = {}
        for (const milestone of msRowsToJobKey[jobKey]) {
            const msMandatoryTags = _.get(milestone, 'mandatoryTags')
            const msCustomFieldsTags = _.get(milestone, 'customFieldsTags')
            if (validateMandatoryTags(jobMandatoryTags, msMandatoryTags) || validateCustomFieldsTags(jobCustomFieldsTags, msCustomFieldsTags)) {
                rowsError.push({ ..._.omit(milestone, ['companyId', 'userId', 'entityId', 'talentId']), errors: [errorCodes.jobCustomFieldsNotConsistent(_.get(milestone, 'jobTitle'))] });
                rowsWithoutErrorReturn = _.filter(rowsWithoutErrorReturn, row => getJobKey(row) !== jobKey)
            } else if (_.isEmpty(jobMandatoryTags)) {
                jobMandatoryTags = msMandatoryTags
                JobExistingTags = _.get(milestone, 'existingTags')
            }

            if (_.isEmpty(jobCustomFieldsTags)) {
                jobCustomFieldsTags = msCustomFieldsTags
            }

            if (isOfferJobRow(milestone)) {
                ({ rowsErrorReturn, rowsWithoutErrorReturn } = validateOfferJobFields(_.get(msRowsToJobKey, [jobKey, 0]), milestone, rowsError, rowsWithoutErrorReturn, jobKey))
            }
        }
        mapJobKeyToTags[jobKey] = { ...JobExistingTags, ...jobMandatoryTags, ...jobCustomFieldsTags }
    }
    return { rowsError: rowsErrorReturn, rowsWithoutErrorReturn, mapJobKeyToTags }
}

const jobsFromRowsValidation = (rowsError, rowsWithoutError) => {
    const msRowsToJobKey = castJobKeyToMilestoneRow(rowsWithoutError);
    return crossRowsValidation(rowsError, rowsWithoutError, msRowsToJobKey)
}

const getDolarAmount = (amount, currency, exchangeRate = {}) => {
    jsonLogger.info({ type: 'TRACKING', function: 'jobHelper::getDolarAmount', amount, currency, exchangeRate });

    const exchangeRateForCurrency = _.get(exchangeRate, currency)
    if (!amount || !exchangeRateForCurrency || currency === constants.currencyTypes.default) {
        return amount
    }
    const dollarAmount = Number(amount) / exchangeRateForCurrency;
    const roundedDollarAmount = _.round(dollarAmount, 2);
    jsonLogger.info({ type: 'TRACKING', function: 'jobHelper::getDolarAmount', dollarAmount, roundedDollarAmount });
    return roundedDollarAmount;
};

const getJobRate = (job) => {
    const hourlyRate = _.get(job, milestonesColumns.hourlyRate)
    if (hourlyRate) {
        jsonLogger.info({ type: "TRACKING", function: "jobsUtils::getJobRate", text: 'adding hourly budget' });
        return { hourlyBudget: hourlyRate, engagementType: constants.engagementTypes.hourly }
    }
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::getJobRate", text: 'no hourly budget, adding custom rate' });
    return {
        customRateData: {
            category: _.get(job, milestonesColumns.customRateCategory),
            estimatedQuantity: _.get(job, milestonesColumns.customRateQuantity) || "0",
            ratePer: parseInt(_.get(job, milestonesColumns.customRateRate) || "0", 10)
        },
        hourlyBudget: null,
        engagementType: _.get(job, milestonesColumns.customRateCategory) ? constants.engagementTypes.custom : constants.engagementTypes.project
    }

}

const createJob = async (job, isJobHandShakeRequired = true) => {
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::createJob", message: "Start create job", job, isJobHandShakeRequired });
    const isOfferJobMode = isOfferJobRow(job)
    const jobItemData = {
        jobStartDate: _.get(job, milestonesColumns.jobStartDate) ? new Date(_.get(job, milestonesColumns.jobStartDate)).getTime() : Date.now(),
        talentId: job.talentId,
        jobTitle: _.get(job, milestonesColumns.jobTitle),
        jobDescription: _.get(job, milestonesColumns.jobDescription),
        totalBudget: 0,
        currency: job.currency,
        jobFlow: isOfferJobMode ? constants.jobFlow.offer : constants.jobFlow.start,
        baseJobFlow: isOfferJobMode ? constants.jobFlow.offer : constants.jobFlow.start,
        isCSVJob: true,
        ...!isOfferJobMode && { talentId: job.talentId },
        ...isOfferJobMode && {
            talentIds: _.get(job, 'talentsIds', []),
            hourlyBudget: _.get(job, milestonesColumns.hourlyRate),
            maxHours: _.get(job, milestonesColumns.monthlyEstimatedHours),
            budgetPerMilestone: _.get(job, milestonesColumns.fixedRate),
            engagementType: _.get(job, milestonesColumns.hourlyRate) ? constants.engagementTypes.hourly : constants.engagementTypes.project,
            timeFrame: _.get(job, milestonesColumns.timeFrame) || csvDefaultAttributes[milestonesColumns.timeFrame],
            withTalentQuoteOffer: _.get(job, milestonesColumns.quote) === RESPONSES.YES,
            totalBudget: _.get(job, milestonesColumns.hourlyRate) * _.get(job, milestonesColumns.monthlyEstimatedHours) || 0,
            isAutomaticHire: _.get(job, milestonesColumns.instantHire) === RESPONSES.YES,
            recurringPeriods: 1,
            repeatEvery: 0,
        }
    };

    if (!isOfferJobMode) {
        Object.assign(jobItemData, getJobRate(job))

        if (isJobHandShakeRequired) {
            jobItemData.jobHandShakeStage = constants.job.handshakeStages.REQUESTED
        }
    }
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::createJob", jobItemData });
    const { userId, createdBy, entityId, companyId, talentId } = job;
    const createdJob = await jobs.innerCreateJob(companyId, entityId, userId, createdBy, jobItemData, isOfferJobMode ? constants.job.status.initial : constants.job.status.autoDraft);
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::createJob", message: "Job created", createdJob });

    const { itemData, itemId } = createdJob;
    if (isOfferJobMode) {
        await jobs.innerUpdateJob(itemId, userId, entityId, constants.job.status.pending, itemData)
        jsonLogger.info({ type: "TRACKING", function: "jobsUtils::createJob", message: "job offered" });

    } else {
        await jobs.innerSign(companyId, entityId, itemData, itemId, userId, createdBy, talentId);
        jsonLogger.info({ type: "TRACKING", function: "jobsUtils::createJob", message: "job signed" });
    }
    return createdJob;
}

const getMilestonesData = (rows, allTalents, exchangeRate) => rows.map((row) => {
    const costLocal = Number(_.get(row, milestonesColumns.milestonePlannedAmount) || 0);
    const cost = getDolarAmount(costLocal, row.currency, exchangeRate)
    const actualCostLocal = Number(_.get(row, milestonesColumns.milestoneRequestedAmount) || 0);
    const actualCost = getDolarAmount(actualCostLocal, row.currency, exchangeRate);
    
    return {
        id: _.get(row, 'milestoneId'),
        entityId: _.get(row, 'entityId'),
        userId: _.get(row, 'userId'),
        itemStatus: constants.job.status.pending,
        itemData: {
            title: _.get(row, milestonesColumns.milestoneTitle),
            description: _.get(row, milestonesColumns.milestoneDescription),
            date: _.get(row, milestonesColumns.milestoneDate) ? new Date(_.get(row, milestonesColumns.milestoneDate)).getTime() : Date.now(),
            cost,
            costLocal,
            currency: row.currency,
            tempActualRequestCost: actualCost,
            tempActualRequestLocalCost: actualCostLocal,
            talentData: {
                firstName: _.get(row, 'talentFirstName'),
                lastName: _.get(row, 'talentLastName'),
                name: `${_.get(row, 'talentFirstName')} ${_.get(row, 'talentLastName')}`,
                img: _.get(allTalents, [_.get(row, 'email'), 'itemData', `img`])
            },
        },
    }
});


const createMilestones = async (job, milestones, allTalents, createdBy, exchangeRate) => {
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::createMilestones", message: "create milestones for job", job, createdBy });
    const milestonesToCreate = getMilestonesData(milestones, allTalents, exchangeRate);
    const { companyId, entityId } = job;
    const milestonesCreated = await jobs.innerCreateMilestones(companyId, entityId, job, createdBy, milestonesToCreate);
    return _.chain(milestonesCreated).get('TransactItems', []).
        map('Put.Item').
        value();
}

const updateMilestonesStatus = async (milestones, itemStatus, userId) => {
    jsonLogger.info({ type: 'TRACKING', function: 'jobsUtils::updateMilestonesStatus', message: 'Try to update status', itemStatus, userId });
    const milestonesWithNewStatus = await innerUpdateMilestoneStatusGetStatus(milestones, itemStatus);
    const result = await Promise.all(milestonesWithNewStatus.map((milestone) => innerUpdateMilestoneStatus(milestone, itemStatus, userId)));
    return _.map(result, 'Attributes');
}

const offerExistingJobToTalent = async (job, talentIds, userId) => {
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::offerExistingJobToTalent", message: "Offer existing job to talents", job, talentIds, userId });
    const { entityId, itemId, itemData } = job;
    let currentBids = _.get(itemData, 'bids');
    if (!_.isArray(currentBids)) {
        currentBids = _.get(currentBids, 'values');
    }

    const jobItemData = {
        ...itemData,
        talentIds: _.uniq(_.concat(_.get(job, 'itemData.talentIds'), talentIds)),
        bids: currentBids,
    };

    const offeredJob = await jobs.innerUpdateJob(itemId, userId, entityId, constants.job.status.pending, jobItemData, constants.job.operation.updatePostedJob);
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::offerExistingJobToTalent", message: "Job offered to talents" });

    return _.get(offeredJob, 'Attributes')
}

const createMilestonesPerJob = async (companyId, rows, allTalents, mapJobToJobId, isJobHandShakeRequired) => {
    const exchangeRate = await exchangeRatesService.getLatest(constants.currencyTypes.default, true, companyId);
    const allMilestones = [];
    // eslint-disable-next-line no-extra-parens
    const rowsByJobs = _.groupBy(rows, row => getJobKey(row));
    const jobIdToJobRow = {}
    // eslint-disable-next-line guard-for-in
    for (const jobKey in rowsByJobs) {
        const milestonesPerJob = _.get(rowsByJobs, jobKey);
        let job = _.get(mapJobToJobId, jobKey)
        const jobRow = _.first(milestonesPerJob);
        const isOfferJobMode = isOfferJobRow(jobRow)
        if (!job) {
            // eslint-disable-next-line no-await-in-loop
            job = await createJob(jobRow, isJobHandShakeRequired);

            if (isOfferJobMode) {
                allMilestones.push(job);
            }
        } else if (isOfferJobMode) {
            const res = await offerExistingJobToTalent(job, _.get(milestonesPerJob[0], 'talentsIds'), jobRow.createdBy)
            allMilestones.push(res);
        }
        if (!isOfferJobMode) {
            // eslint-disable-next-line no-await-in-loop
            const currentMilestones = await createMilestones(job, milestonesPerJob, allTalents, jobRow.createdBy, exchangeRate);
            allMilestones.push(currentMilestones);
        }

        jobIdToJobRow[_.get(job, 'itemId')] = jobRow
    }
    jsonLogger.info({ type: 'TRACKING', function: 'jobsUtils::createMilestonesPerJob', message: { allMilestones, jobIdToJobRow } });
    return { allMilestones, jobIdToJobRow };
}

const updateMilestonesToPendingStatus = async (milestones, userId, isStokeUmbrella) => {
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::updateMilestonesToPendingStatus", milestones, userId, isStokeUmbrella });
    const milestonesToPending = milestones.
        filter((milestone) => milestone.itemStatus === constants.job.status.active && milestone.itemData.tempActualRequestCost).
        map((milestone) => ({
            ...milestone,
            itemId: milestone.id,
            itemStatus: constants.job.status.pendingApproval,
            itemData: {
                ...milestone.itemData,
                actualRequestCost: milestone.itemData.tempActualRequestCost,
                actualCost: milestone.itemData.tempActualRequestCost,
                providerData: {
                    taxInfo: {
                        paymentCurrency: milestone.itemData.currency || constants.currencyTypes.default,
                        total: milestone.itemData.tempActualRequestLocalCost,
                        subTotal: milestone.itemData.tempActualRequestLocalCost,
                        stokeUmbrella: isStokeUmbrella
                    }
                },
                isRequestedByHm: true
            },
            modifiedBy: userId,
        }));
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::updateMilestonesToPendingStatus", milestonesToPending });
    let result = [];
    if (milestonesToPending && milestonesToPending.length) {
        result = await updateMilestonesStatus(milestonesToPending, constants.job.status.pendingApproval, userId);
    }
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::updateMilestonesToPendingStatus", result });
    return result;
}

const getCompanyPoolAdminUserId = (companyAdminsBudget, date, amount) => {
    const companyAdminUserId = _.chain(companyAdminsBudget).find((companyAdminBudget) => isItemAvailableBudget(companyAdminBudget, new Date(date), amount)).
        get('itemId', '').
        value();
    return idConverterLib.removePrefix(companyAdminUserId, constants.prefix.user);
}

const isMilestonesStatusBudgetRequest = async (companyId, rows, allTalents) => {
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::isMilestonesStatusBudgetRequest", companyId, rows, allTalents })
    const exchangeRate = await exchangeRatesService.getLatest(constants.currencyTypes.default, true, companyId);
    let milestonesToCheck = getMilestonesData(rows, allTalents, exchangeRate);
    milestonesToCheck = _.filter(milestonesToCheck, (ms) => ms.itemData.tempActualRequestCost);
    const milestonesWithNewStatus = await innerUpdateMilestoneStatusGetStatus(milestonesToCheck, constants.job.status.active);

    const groupedMilestonesByEntityId = _.uniqBy(milestonesWithNewStatus, (ms) => ms.entityId).
        filter(ms => [constants.job.status.budgetRequest, constants.job.status.overageBudgetRequest].includes(ms.newItemStatus))
    const groupedMilestonesQuarter = _.uniqBy(milestonesWithNewStatus, (ms) => {
        const date = _.get(ms, 'itemData.date');
        const currentDate = new Date(date);
        const year = currentDate.getFullYear();
        const period = Math.floor(currentDate.getMonth() / 12 * 4) + 1;
        return `${year}${period}${ms.userId}${ms.entityId}`;
    }).filter(ms => [constants.job.status.budgetRequest, constants.job.status.overageBudgetRequest].includes(ms.newItemStatus))

    return {
        missingQuartersCount: groupedMilestonesByEntityId ? groupedMilestonesByEntityId.length : 0,
        missingWorkspacesCount: groupedMilestonesQuarter ? groupedMilestonesQuarter.length : 0
    }
}

const transferBudget = async (rows, companyId, budgetModuleActive, isSupportPONumbers) => {
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::transferBudget", companyId, budgetModuleActive, isSupportPONumbers });

    if (budgetModuleActive !== false) {
        jsonLogger.info({ type: "TRACKING", function: "jobsUtils::transferBudget", message: 'dont transfer budget - only for budgetModuleActive = false' });
        return null;
    }

    if (isSupportPONumbers) {
        jsonLogger.info({ type: 'TRACKING', function: 'jobsUtils::transferBudget', isSupportPONumbers, message: 'auto approve is blocked because isSupportPONumbers.' });
        return false
    }

    const companyAdminsBudget = await budgetsService.listEntity(companyId, constants.prefix.user);
    const allMilestones = _.groupBy(rows, (row) => `
        companyId: ${row.companyId}, 
        userId: ${row.userId}, 
        entityId: ${row.entityId}, 
        year: ${new Date(row.milestoneDate).getFullYear()}, 
        period: ${Math.floor(new Date(row.milestoneDate).getMonth() / 12 * 4) + 1}
    `);

    const budgetData = {};
    const exchangeRate = await exchangeRatesService.getLatest(constants.currencyTypes.default, true, companyId);
    for (const key of Object.keys(allMilestones)) {
        const milestonesBudgets = allMilestones[key];
        let jobBudget = 0
        for (const milestone of milestonesBudgets) {
            const currency = _.get(milestone, 'currency')
            const milestoneCost = Number(_.get(milestone, milestonesColumns.milestonePlannedAmount));
            const milestoneCostByDollar = getDolarAmount(milestoneCost, currency, exchangeRate)
            jobBudget += milestoneCostByDollar
        }

        if (jobBudget === 0) {
            // eslint-disable-next-line no-continue
            continue;
        }

        const firstMilestone = _.first(milestonesBudgets);
        const { entityId, userId, milestoneDate } = firstMilestone || {}
        const currentDate = new Date(Number(milestoneDate || Date.now()));
        let isTransfered = false
        try {
            const sourceUser = getCompanyPoolAdminUserId(companyAdminsBudget, currentDate, jobBudget);
            if (sourceUser) {
                const fromItem = {
                    companyId,
                    entityId: companyId,
                    itemId: constants.prefix.user + sourceUser,
                    modifiedBy: sourceUser,
                };
                const toItem = {
                    companyId,
                    entityId,
                    itemId: constants.prefix.user + userId,
                    modifiedBy: userId,
                };

                const result = await budgetsService.transfer(fromItem, toItem, currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 12 * 4) + 1, Math.ceil(jobBudget))
                if (result) {
                    isTransfered = true
                }
            }
        } catch (e) {
            jsonLogger.error({ type: "TRACKING", function: "jobsUtils::transferBudget", message: `Error in calculate budget - ${key}`, error: e });
        }
        budgetData[key] = { budget: jobBudget, isTransfered };
    }
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::transferBudget", budgetData, });
    return budgetData;
};

const getJobsTags = (jobRows, mapJobKeyToTags) => _.mapValues(jobRows, row => {
    let jobTags = _.get(row, 'tags')
    const jobKey = getJobKey(row)
    jobTags = { ...jobTags, ...mapJobKeyToTags[jobKey] }
    return jobTags
})

const updateJobTags = async (jobsToUpdate, tagsToAdd) => {
    jsonLogger.info({ type: "TRACKING", function: "jobsUtils::updateJobTags", jobsToUpdate, tagsToAdd });
    const jobsIds = _.keys(jobsToUpdate)
    for (const jobId of jobsIds) {
        const jobRow = jobsToUpdate[jobId]
        const updatedTags = tagsToAdd[jobId]

        if (_.size(updatedTags) && !_.isEqual(updatedTags, _.get(jobRow, 'tags', {}))) {
            const result = await jobsService.update({ entityId: _.get(jobRow, 'entityId'), itemId: jobId, tags: updatedTags, modifiedBy: _.get(jobRow, 'userId') })
            if (result) {
                jsonLogger.info({ type: "TRACKING", function: "jobsUtils::updateJobTags", jobRow, updatedTags, message: 'updated tags for job' });
            } else {
                jsonLogger.error({ type: "TRACKING", function: "jobsUtils::updateJobTags", jobRow, updatedTags, message: 'error updating tags for job' });
            }
        }

    }
}

module.exports = {
    isOfferJobRow,
    addData,
    addJobData,
    rowsValidations,
    jobsFromRowsValidation,
    createMilestonesPerJob,
    updateMilestonesToPendingStatus,
    updateMilestonesStatus,
    transferBudget,
    getActiveJobs,
    isMilestonesStatusBudgetRequest,
    getJobsTags,
    updateJobTags,
    getMilestonesBulk,
}
