/* eslint-disable max-lines */
/* eslint-disable complexity */
/* eslint-disable require-unicode-regexp */
/* eslint-disable prefer-named-capture-group */
/* eslint-disable max-params */
/* eslint-disable multiline-comment-style */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-undefined */
/* eslint-disable no-magic-numbers */

'use strict';

const _ = require('lodash');
const dayjs = require('dayjs');

const { constants, idConverterLib, prefixLib, jobHelper } = require('stoke-app-common-api');
const { getMilestonePaymentsProps, getStatusString, escape, getCustomRateData, getMilestoneTitle, getTalentData, getApprovalName, getApprovalsData, getInvoiceData, getSortedApprovedLevels, preperCustomFieldContentForJobs, resolveUserFullName, getDepartmentsAmountValues, getProviderLanguagesInfo, getProviderLanguagesSummary, getProviderSkillsInfo, getAverageRatingByReviews, getTalentDisplayedStatus, getIsTalentPayable, getTotalEarned, getCommentsAndReviews, preperCustomFieldContentForAll, preperCustomFieldContent, getExperienceOptions, getProviderCertificationsSummary, getProviderExperienceSummary, getIsSignedUpNoNewJobsThreeMonths } = require('./csvReportHelper');
const { getPaymentStatusByMilestoneStatus, convertCountryCodeToName, getJobHoursValues, getBillingFees, resolvePaymentMethod, getTalentCountry, getTalentAddress, getTalentPhone, formatTimestamp } = require('../utils');
const { paymentStatusDisplayedName, backgroundCheckDisplayedStatus } = require('./constants');
const { updateProviderStatusToActive } = require('../jobHelper');
const { getComplianceEnrichment, getComplianceColorByCalculatedValue } = require('../complianceHelper');
const getLineItemsAttributes = (ms) => _.get(ms, 'itemData.lineItems', []).map(lineItem => ({ lineItemTitle: lineItem.name || '', lineItemDescription: lineItem.description || '', lineItemAmount: lineItem.amount || '', lineItemCurrency: lineItem.currency || constants.currencyTypes.default }));
const getTimeReportAttributes = (ms) => _.get(ms, 'itemData.timeReport', []).map(timeReport => ({ timeReportDate: dayjs(timeReport.date, constants.dateFormats.saved.milestone.timeReport).format(constants.dateFormats.displayed.milestone.timeReport) || '', timeReportHours: timeReport.hours || '', timeReportComment: timeReport.comment || '' }));

const hiringManagerFullName = (ms, usersByUserId) => {
    const hiringManager = usersByUserId[ms.userId]
    return `${_.get(hiringManager, 'itemData.givenName', '')} ${_.get(hiringManager, 'itemData.familyName', '')}`
}

const getNormlizedMilestonesForJobsPage = (milestones, jobsByItemId, usersByUserId, talentsbyTalentId, existedRequestedCustomFields, companyWorkspacesKeyValuePairs, talentIdsNamesKeyValuePairs, lineItemsExist, customFieldsTypes) => {
    const normlizedMilestones = [];
    for (const ms of milestones) {
        const jobId = idConverterLib.getJobIdFromMilestoneId(ms.itemId);
        const currentJob = _.get(jobsByItemId, jobId);
        if (!currentJob || currentJob.itemStatus !== constants.job.status.active || !ms.itemData) {
            // eslint-disable-next-line no-continue
            continue;
        }

        const { plannedLocal, requested, approved } = getMilestonePaymentsProps(ms);
        const { talentCompletedAt, talentName, talentId } = getTalentData(ms, currentJob, talentsbyTalentId, talentIdsNamesKeyValuePairs)

        const sortedApprovedLevels = getSortedApprovedLevels(ms, constants.approvalActionStatus.approve)
        const approvedByFullName = getApprovalName(sortedApprovedLevels, usersByUserId)
        const approveDate = _.get(sortedApprovedLevels, '[0].approveDate');

        const customFieldsKeyValuePairs = _.map(existedRequestedCustomFields, (field) => ({ [field]: preperCustomFieldContentForJobs(currentJob, ms, field, customFieldsTypes, usersByUserId) }));

        const basicAttributes = {
            jobId,
            itemId: ms.itemId,
            milestone: getMilestoneTitle(ms),
            job: currentJob.itemData.jobTitle,
            entityId: ms.entityId,
            talentId,
            hiringManagerId: ms.userId,
            description: escape(ms.itemData.description || ''),
            talentData: talentName,
            comment: escape(_.get(ms, 'itemData.providerData.comment') || ''),
            department: companyWorkspacesKeyValuePairs[`${constants.prefix.entity}${ms.entityId}`] || '',
            team: _.get(currentJob, `tags.${constants.tags.teams}[0]`, ''),
            engagementType: jobHelper.getEngedgmentTypeString(_.get(currentJob, 'itemData.engagementType', '')),
            status: getStatusString(ms),
            jobStatus: getStatusString(currentJob),
            hiringManager: hiringManagerFullName(ms, usersByUserId),
            date: formatTimestamp(_.get(ms, 'itemData.date')),
            plannedLocal,
            requested,
            requestedDate: talentCompletedAt ? formatTimestamp(talentCompletedAt) : '',
            approved,
            approvedDate: approveDate ? formatTimestamp(approveDate) : '',
            approvedBy: approvedByFullName,
            jobStartDate: formatTimestamp(_.get(currentJob, 'itemData.jobStartDate')),
        }

        const lineItemsAttributes = getLineItemsAttributes(ms);

        if (!lineItemsExist || lineItemsAttributes.length === 0) {
            normlizedMilestones.push(_.assign(basicAttributes, ...customFieldsKeyValuePairs));
        } else {
            for (const lineItem of lineItemsAttributes) {
                normlizedMilestones.push(_.assign({}, basicAttributes, ...customFieldsKeyValuePairs, lineItem))
            }
        }
    }
    return normlizedMilestones.filter(Boolean);
}

const getNormlizedProvidersForTalentDirectory = (companyId, providers, entitiesByEntityId, providersByProviderId, talentsByProviderId, existedRequestedCustomFields, usersByUserId, customFieldsTypes, withPrefix) => {
    const normalizedProviders = []

    for (const provider of providers) {

        const providerItemData = _.get(provider, 'itemData', {})
        const complianceInfo = _.get(provider, 'complianceInfo')
        const status = _.get(provider, 'itemStatus')
        const providerStatus = status || constants.companyProvider.status.inactive

        const { general, workforce, legal, tax } = _.get(complianceInfo, 'scores')
        const compliance = getComplianceColorByCalculatedValue(general)
        const complianceWorkforce = getComplianceColorByCalculatedValue(workforce)
        const complianceLegal = getComplianceColorByCalculatedValue(legal)
        const complianceTax = getComplianceColorByCalculatedValue(tax)

        const providerInvitationDate = _.get(provider, "createdAt")
        const providerRegistrationDate = _.get(providerItemData, 'registrationDate') || providerInvitationDate

        const basicAttributes = {
            status: getTalentDisplayedStatus(false, status),
            name: _.get(providerItemData, 'providerName'),
            email: _.get(providerItemData, 'providerEmail'),
            providerId: provider.itemId,
            startTime: providerInvitationDate,
            providerInvitationDate,
            providerRegistrationDate,
            providerName: _.get(providerItemData, 'providerName'),
            providerEmail: _.get(providerItemData, 'providerEmail'),
            providerStatus,
            providerCompliance: getComplianceEnrichment(provider, talentsByProviderId, providersByProviderId),
            providerScore: getAverageRatingByReviews(provider).toString(),
            providerAddress: getTalentAddress(providerItemData),
            providerCountry: convertCountryCodeToName(getTalentCountry(providerItemData)),
            providerPhone: getTalentPhone(providerItemData),
            workspaces: getDepartmentsAmountValues(providerItemData.departments, entitiesByEntityId, companyId),
            paymentMethod: _.get(providerItemData, 'paymentMethod', _.get(providerItemData, 'paymentSystem')),
            workspacesIds: getDepartmentsAmountValues(providerItemData.departments, entitiesByEntityId, companyId, true),
            talentType: 'Talent under company',
            providerAssignedDepartments: _.get(providerItemData, 'departments', [companyId]),
            isProviderSelfEmployedTalent: _.get(providerItemData, 'isProviderSelfEmployedTalent'),
            providerImg: _.get(provider, 'itemData.img'),
            favoriteHiringManagerIds: _.get(provider, 'itemData.favoriteHiringManagerIds'),
            providerAllowedActions: _.get(provider, 'allowedActions'),
            providerLegalDocuments: _.get(provider, 'itemData.legalDocuments'),
            isPayable: _.get(providerItemData, 'isPayable') ? 'Yes' : 'No',
            compliance,
            complianceWorkforce,
            complianceLegal,
            complianceTax,
            skillsData: getProviderSkillsInfo(provider).join(', '),
            skills: getProviderSkillsInfo(provider),
            languages: getProviderLanguagesInfo(provider),
            languagesData: getProviderLanguagesSummary(provider),  
        }

        // eslint-disable-next-line no-loop-func
        const customFieldsKeyValuePairs = _.map(existedRequestedCustomFields, (field) => {
            const name = withPrefix ? `${customFieldsTypes[field].split('_')[0]}_${field}` : field;
            return { [name]: preperCustomFieldContentForAll(null, provider, null, null, field, customFieldsTypes, usersByUserId) }
        });

        normalizedProviders.push(_.assign(basicAttributes, ...customFieldsKeyValuePairs));
    }

    return normalizedProviders.filter(Boolean);
}


const getNormlizedTalentsForTalentDirectory = (companyId, talents, entitiesByEntityId, jobsByTalentId, activeJobByTalentId, providersByProviderId, talentsByProviderId, existedRequestedCustomFields, usersByUserId, customFieldsTypes, withPrefix, existedRequestedTalentProfileCustomFields, talentProfileCustomFieldsTypes) => {
    const normlizedTalents = [];

    for (const talent of talents) {
        if (!prefixLib.isTalent(_.get(talent, 'itemId'))) {
            // eslint-disable-next-line no-continue
            continue;
        }
        const providerId = idConverterLib.getProviderIdFromTalentId(talent.itemId)
        const provider = providersByProviderId[providerId];
        const providerItemData = _.get(provider, 'itemData', {})
        const isSelfEmployed = _.get(talent, 'itemData.isProviderSelfEmployedTalent')
        const talentCountry = _.get(talent, 'itemData.country', _.get(talent, 'itemData.profileCountry', _.get(talent, 'itemData.talentProfileData.country')))
        const location = getTalentCountry(isSelfEmployed && talentCountry ? talent.itemData : providerItemData)
        const complianceInfo = _.get(talent, 'complianceInfo')
        const backgroundStatusCheck = _.get(talent, 'itemData.backgroundStatusCheck', '')
        const freelancerJobs = _.get(jobsByTalentId, talent.itemId, [])
        const status = updateProviderStatusToActive(activeJobByTalentId, _.get(talent, 'itemStatus'), talent.itemId)
        const providerStatus = isSelfEmployed ? status : _.get(provider, 'itemStatus', constants.companyProvider.status.inactive)

        const talentName = resolveUserFullName(talent.itemData)
        const providerName = _.get(provider, 'itemData.providerName')

        const compliance = getComplianceColorByCalculatedValue(_.get(complianceInfo, 'scores.general'))
        const complianceWorkforce = getComplianceColorByCalculatedValue(_.get(complianceInfo, 'scores.workforce'))
        const complianceLegal = getComplianceColorByCalculatedValue(_.get(complianceInfo, 'scores.legal'))
        const complianceTax = getComplianceColorByCalculatedValue(_.get(complianceInfo, 'scores.tax'))

        const invitationDate = _.get(talent, "createdAt")
        const registrationDate = _.get(talent, ["itemData", "registrationDate"]) || _.get(talent, "createdAt")
        
        const providerInvitationDate = _.get(provider, "createdAt")
        const providerRegistrationDate = _.get(provider, ["itemData", "registrationDate"]) || _.get(provider, "createdAt")
        
        const firstFreelancerActiveJob = _.min(_.map(freelancerJobs, 'itemData.jobStartDate'))
        const startDate = new Date(firstFreelancerActiveJob).getTime()
        const workingPeriod = _.get(provider, 'itemData.sequenceOfWork.totalEngagementMonths', 0)
        const averageMonthlyHours = _.get(provider, 'itemData.sequenceOfWork.averageMonthlyHours', 0)
        const averageMonthlyPay = _.get(provider, 'itemData.sequenceOfWork.averageMonthlyPay', 0)
        const activeEngagementLength = _.get(provider, 'itemData.sequenceOfWork.activeEngagementLength', 0)
        const enrollData = _.get(providerItemData, 'enrollData')
        const signedUpNoNewJobsThreeMonths = getIsSignedUpNoNewJobsThreeMonths(status, freelancerJobs).toString();
        
        const basicAttributes = {
            startDate,
            startTime: providerInvitationDate,
            talentId: talent.itemId,
            providerName: providerName || talentName,
            email: _.get(talent.itemData, 'email'),
            name: talentName,
            status: getTalentDisplayedStatus(isSelfEmployed, status),
            workspaces: getDepartmentsAmountValues(talent.itemData.departments, entitiesByEntityId, companyId),
            title: _.get(talent.itemData, 'jobTitle'),
            isPayable: getIsTalentPayable(talent, provider),
            address: getTalentAddress(isSelfEmployed && _.get(talent, 'itemData.address') ? talent.itemData : providerItemData),
            country: convertCountryCodeToName(location),
            phone: getTalentPhone(isSelfEmployed && _.get(talent, 'itemData.phone') ? talent.itemData : providerItemData),
            skillsData: getProviderSkillsInfo(talent).join(', '),
            languagesData: getProviderLanguagesSummary(talent),
            score: getAverageRatingByReviews(talent).toString(),
            paymentMethod: _.get(provider, 'itemData.paymentMethod', _.get(provider, 'itemData.paymentSystem')),
            compliance,
            complianceWorkforce,
            complianceLegal,
            complianceTax,
            workspacesIds: getDepartmentsAmountValues(talent.itemData.departments, entitiesByEntityId, companyId, true),
            talentType: isSelfEmployed ? 'Individual' : 'Talent under company',
            totalJobs: freelancerJobs.length > 0 ? freelancerJobs.length : '',
            totalEarned: getTotalEarned(talent),
            totalEarnedObject: _.get(talent, 'totalEarned'),
            backgroundCheck: _.get(backgroundCheckDisplayedStatus, backgroundStatusCheck, backgroundStatusCheck),
            commentsAndReviews: getCommentsAndReviews(talent.itemData),
            providerStatus,
            providerAssignedDepartments: _.get(provider, 'itemData.departments', [companyId]),
            assignedDepartments: _.get(talent, 'itemData.departments', [companyId]),
            isProviderSelfEmployedTalent: _.get(provider, 'itemData.isProviderSelfEmployedTalent'),
            skills: getProviderSkillsInfo(talent),
            providerCompliance: getComplianceEnrichment(provider, talentsByProviderId, providersByProviderId),
            providerId,
            providerEmail: _.get(providerItemData, 'providerEmail'),
            enrollData,
            languages: getProviderLanguagesInfo(talent),
            providerScore: getAverageRatingByReviews(provider).toString(),
            providerAddress: getTalentAddress(providerItemData),
            providerCountry: convertCountryCodeToName(getTalentCountry(providerItemData)),
            providerPhone: getTalentPhone(providerItemData),
            img: _.get(talent, 'itemData.img'),
            providerImg: _.get(provider, 'itemData.img'),
            complianceScores: getComplianceEnrichment(talent, talentsByProviderId, providersByProviderId),
            favoriteHiringManagerIds: isSelfEmployed ? _.get(provider, 'itemData.favoriteHiringManagerIds') : _.get(talent, 'itemData.favoriteHiringManagerIds'),
            allowedActions: _.get(talent, 'allowedActions'),
            providerAllowedActions: _.get(provider, 'allowedActions'),
            payableStatus: _.get(talent, 'payableStatus'),
            legalDocuments: _.get(isSelfEmployed ? provider : talent, 'itemData.legalDocuments'),
            providerLegalDocuments: _.get(provider, 'itemData.legalDocuments'),
            certification: _.isEmpty(_.get(talent, 'itemData.talentProfileData.certifications', [])) ? ['Doesn’t have'] : ['Has certification'],
            freelancerExperience: getExperienceOptions(talent).join(', '),
            certifications: _.get(talent, 'itemData.talentProfileData.certifications', []),
            experience: _.get(talent, 'itemData.talentProfileData.experience', []),
            certificationsData: getProviderCertificationsSummary(talent),
            experienceData: getProviderExperienceSummary(talent),
            invitationDate,
            registrationDate,
            providerInvitationDate,
            providerRegistrationDate,
            workingPeriod,
            averageMonthlyHours,
            averageMonthlyPay,
            activeEngagementLength,
            signedUpNoNewJobsThreeMonths,
        }

        // eslint-disable-next-line no-loop-func
        const customFieldsKeyValuePairs = _.map(existedRequestedCustomFields, (field) => {
            const name = withPrefix ? `${customFieldsTypes[field].split('_')[0]}_${field}` : field;
            return { [name]: preperCustomFieldContentForAll(talent, provider, null, null, field, customFieldsTypes, usersByUserId) }
        });

        const talentProfileCustomFieldsKeyValuePairs = _.map(existedRequestedTalentProfileCustomFields, (field) => ({ [field]: preperCustomFieldContent(_.get(provider, 'tags', {}), field, talentProfileCustomFieldsTypes[field], usersByUserId) }));
        normlizedTalents.push(_.assign(basicAttributes, ...talentProfileCustomFieldsKeyValuePairs, ...customFieldsKeyValuePairs));
    }

    return normlizedTalents.filter(Boolean);
}

const getNormlizedMilestonesForInvoices = (milestones, jobsByItemId, talentsbyTalentId, providersByProviderId, talentIdsNamesKeyValuePairs) => {
    const normlizedMilestones = [];
    for (const ms of milestones) {

        const jobId = idConverterLib.getJobIdFromMilestoneId(ms.itemId);
        const currentJob = _.get(jobsByItemId, jobId);
        // job milestone has to be completed or active
        if (!currentJob || ![constants.job.status.completed, constants.job.status.active].includes(currentJob.itemStatus) || !ms.itemData) {
            // eslint-disable-next-line no-continue
            continue;
        }
        const { talentId, talentName } = getTalentData(ms, currentJob, talentsbyTalentId, talentIdsNamesKeyValuePairs)
        const providerId = talentId ? idConverterLib.getProviderIdFromTalentId(talentId) : {}
        const provider = providerId ? providersByProviderId[providerId] : {}
        const providerName = _.get(provider, 'itemData.providerName', `${_.get(provider, 'itemData.firstName', '')} ${_.get(provider, 'itemData.lastName', '')}`);

        const basicAttributes = {
            departmentId: ms.entityId,
            talentId,
            providerId,
            hiringManagerId: ms.userId,
            entityId: ms.entityId,
            itemId: ms.itemId,
            milestoneTitle: getMilestoneTitle(ms),
            talentName: talentName,
            jobTitle: currentJob.itemData.jobTitle,
            providerName,

        }
        normlizedMilestones.push(basicAttributes);
    }

    return normlizedMilestones.filter(Boolean);
}

const getNormlizedMilestonesForPaymentsPage = (milestones, jobsByItemId, usersByUserId, providersByProviderId, entitiesByEntityId, talentsbyTalentId, legalEntitiesByDepartment, existedRequestedCustomFields, companyWorkspacesKeyValuePairs, talentIdsNamesKeyValuePairs, POsByItemId, lineItemsExist, timeReportExist, customFieldsTypes, withPrefix) => {
    const normlizedMilestones = [];
    for (const ms of milestones) {
        const jobId = idConverterLib.getJobIdFromMilestoneId(ms.itemId);
        const currentJob = _.get(jobsByItemId, jobId);

        // job milestone has to be completed or active
        if (!currentJob || ![constants.job.status.completed, constants.job.status.active].includes(currentJob.itemStatus) || !ms.itemData) {
            // eslint-disable-next-line no-continue
            continue;
        }
        const { approved } = getMilestonePaymentsProps(ms);
        const { approvedBy, rejectedBy, approveDate } = getApprovalsData(ms, usersByUserId)
        const { talentId, talentCompletedAt, talentName, talentEmail } = getTalentData(ms, currentJob, talentsbyTalentId, talentIdsNamesKeyValuePairs)
        const talent = talentsbyTalentId[talentId]
        const { customRate, customPlanned, customRequested, customRateCategory } = getCustomRateData(currentJob, ms);
        const { invoiceDate, invoiceNumber, proFormaInvoiceNumber, invoice, proForma } = getInvoiceData(ms)
        const providerId = talentId ? idConverterLib.getProviderIdFromTalentId(talentId) : {}
        const provider = providerId ? providersByProviderId[providerId] : {}
        const department = entitiesByEntityId[`${constants.prefix.entity}${currentJob.entityId}`]

        const billingAmount = _.get(ms, 'itemData.payment.billingAmount')
        const plannedAmount = _.get(ms, 'itemData.cost')
        const plannedLocal = _.get(ms, 'itemData.costLocal', plannedAmount)
        const requestedAmount = _.get(ms, 'itemData.actualRequestCost', _.get(ms, 'itemData.actualCost'))
        const amount = billingAmount || requestedAmount || plannedAmount
        const taxInfo = _.get(ms, 'itemData.providerData.taxInfo')
        const currency = _.get(ms, 'itemData.currency', constants.currencyTypes.default)
        const jobCurrency = _.get(currentJob, 'itemData.currency', constants.currencyTypes.default)
        const paymentCurrency = _.get(taxInfo, 'paymentCurrency', currency)

        const requestedLocalValue = _.get(ms, 'itemData.providerData.taxInfo.stokeUmbrella')
            ? _.get(ms, 'itemData.providerData.taxInfo.subTotal')
            : _.get(ms, 'itemData.providerData.taxInfo.total')
        const requestLocal = requestedLocalValue ? Number(requestedLocalValue) : requestedLocalValue

        let hourlyRate = _.get(currentJob, 'itemData.hourlyBudget')
        if (!isNaN(hourlyRate)) {
            hourlyRate = Number(hourlyRate)
        }

        const requestedHours = _.get(ms, 'itemData.requestedData.hourlyValue')
        const plannedLocalAmount = _.get(ms, 'itemData.costLocal')
        const plannedHours = hourlyRate ? getJobHoursValues(plannedLocalAmount, hourlyRate) : ''
        const { stokeFee, transactionFee } = getBillingFees(_.get(ms, 'itemData.payment.feeData'))
        const paymentMethod = resolvePaymentMethod(ms)
        const paymentStatus = _.get(ms, 'itemData.payment.status')

        let space = _.get(currentJob, 'tags.__stoke__teams[0]');
        if (!_.get(department, 'tags.__stoke__teams', []).includes(space)) {
            space = null
        }

        const msTimeReport = _.get(ms, 'itemData.timeReport', [])
        const jobEngagementType = jobHelper.getEngedgmentTypeString(_.get(currentJob, 'itemData.engagementType', ''));
        const jobCustomeRateCatagory = jobEngagementType === constants.engagementTypes.custom ? customRateCategory : '';
        const basicAttributes = {
            milestoneId: ms.itemId,
            jobId,
            departmentId: ms.entityId,
            itemId: ms.itemId,
            talentId,
            providerId,
            hiringManagerId: ms.userId,
            // eslint-disable-next-line no-negated-condition
            providerName: _.get(provider, 'itemData.providerName', `${_.get(provider, 'itemData.firstName', '')} ${_.get(provider, 'itemData.lastName', '')}`),
            providerEmail: _.get(provider, 'itemData.providerEmail'),
            jobTitle: currentJob.itemData.jobTitle,
            jobType: `${jobEngagementType}${jobCustomeRateCatagory}`,
            jobStatus: currentJob.itemStatus,
            startDate: formatTimestamp(_.get(currentJob, 'itemData.jobStartDate')),
            milestoneTitle: getMilestoneTitle(ms),
            talentName: talentName,
            hiringManager: hiringManagerFullName(ms, usersByUserId),
            department: companyWorkspacesKeyValuePairs[`${constants.prefix.entity}${ms.entityId}`] || '',
            costCenter: _.get(department, 'itemData.costCenter'),
            legalEntity: _.get(legalEntitiesByDepartment, currentJob.entityId),
            status: getPaymentStatusByMilestoneStatus(getStatusString(ms)),
            location: convertCountryCodeToName(getTalentCountry(_.get(provider, 'itemData', {}))),
            address: getTalentAddress(_.get(provider, 'itemData', {})),
            phone: getTalentPhone(_.get(provider, 'itemData', {})),
            amount,
            plannedLocal: plannedLocal,
            approved: approved,
            date: formatTimestamp(_.get(ms, 'itemData.date')),
            paymentStatus: _.get(paymentStatusDisplayedName, paymentStatus, paymentStatus),
            originalPaymentStatus: paymentStatus,
            paymentValueDate: formatTimestamp(_.get(ms, 'itemData.payment.valueDate')),
            approveDate: formatTimestamp(approveDate),
            approvedBy: approvedBy.join(','),
            rejectedBy: rejectedBy.join(','),
            requestDate: talentCompletedAt ? formatTimestamp(talentCompletedAt) : '',
            localCurrencyType: paymentCurrency,
            localCurrencyTotal: requestLocal,
            localCurrencySubTotal: _.get(taxInfo, 'subTotal'),
            companyTaxId: _.get(provider, 'itemData.companyTaxId'),
            hourlyRate: hourlyRate === 0 ? '' : hourlyRate,
            currency,
            jobCurrency,
            plannedHours,
            requestedHours: requestedHours === 0 ? '' : requestedHours,
            transactionFee: transactionFee === 0 ? '' : transactionFee,
            stokeFee: stokeFee === 0 ? '' : stokeFee,
            paymentMethod,
            email: talentEmail,
            space,
            customRate,
            customPlanned,
            customRequested,
            comment: escape(_.get(ms, 'itemData.providerData.comment') || ''),
            localCurrencyTax: _.get(taxInfo, 'tax'),
            invoiceNumber,
            proFormaInvoiceNumber,
            invoiceDate: formatTimestamp(invoiceDate),
            proForma: _.get(proForma, 'name'),
            invoice: _.get(invoice, 'name'),
            proFormaObj: proForma,
            invoiceObj: invoice,
            timeReportHoursSum: _.sumBy(msTimeReport, 'hours'),
            timeReportSessionsSum: msTimeReport.length,
            lineItems: _.get(ms, 'itemData.lineItems', []),
            // eslint-disable-next-line no-extra-parens
            itemNumber: (ms.poItemId && idConverterLib.getMainPOIdFromPOItemId(ms.poItemId) !== ms.poItemId) ? _.get(POsByItemId, ms.poItemId) : '',
            poNumber: ms.poItemId ? _.get(POsByItemId, idConverterLib.getMainPOIdFromPOItemId(ms.poItemId)) : '',
        }

        const lineItemsAttributes = getLineItemsAttributes(ms);
        const timeReportAttributes = getTimeReportAttributes(ms);

        // eslint-disable-next-line no-loop-func
        const customFieldsKeyValuePairs = _.map(existedRequestedCustomFields, (field) => {
            const name = withPrefix ? `${customFieldsTypes[field].split('_')[0]}_${field}` : field;
            return { [name]: preperCustomFieldContentForAll(talent, provider, currentJob, ms, field, customFieldsTypes, usersByUserId) }
        });
        if ((!lineItemsExist || lineItemsAttributes.length === 0) && (!timeReportExist || timeReportAttributes.length === 0)) {
            normlizedMilestones.push(_.assign(basicAttributes, ...customFieldsKeyValuePairs));
        } else {
            for (const lineItem of lineItemsAttributes) {
                normlizedMilestones.push(_.assign({}, basicAttributes, ...customFieldsKeyValuePairs, lineItem))
            }
            for (const timeReport of timeReportAttributes) {
                normlizedMilestones.push(_.assign({}, basicAttributes, ...customFieldsKeyValuePairs, timeReport))
            }
        }
    }
    return normlizedMilestones.filter(Boolean);
}

module.exports = {
    getNormlizedMilestonesForPaymentsPage,
    getNormlizedMilestonesForInvoices,
    getNormlizedMilestonesForJobsPage,
    getNormlizedTalentsForTalentDirectory,
    getNormlizedProvidersForTalentDirectory,
    hiringManagerFullName,
};
