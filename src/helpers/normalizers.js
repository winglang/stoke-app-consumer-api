/* eslint-disable max-params */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */

'use strict'

const _ = require('lodash');
const dayjs = require('dayjs');
const { prefixLib } = require('stoke-app-common-api');
const { constants, idConverterLib, jsonLogger } = require("stoke-app-common-api");
const { payableStatusMap } = require('stoke-app-common-api/helpers/payableStatusHelper');
const { getOnboardingProgressInfo } = require('stoke-app-common-api/helpers/onboardingHelper');
const { jobsActions } = require('stoke-app-common-api/config/constants');
const { hiringManagerFullName } = require('./csvReport/csvReportNormalizer');
const { getCompanySettings } = require('./multiLevelHelper');

const MONTH_DAYS = 30

const normalizeJobs = (jobs, currentUser, talentIdsNamesKeyValuePairs, filterKey, companyWorkspacesKeyValuePairs = {}, usersByUserId = {}) => {
    if (jobs) {
        return jobs.map(job => {
            const hiringManagerId = job.userId;
            const talentId = _.get(job, 'itemData.talentId');
            const talentName = _.get(talentIdsNamesKeyValuePairs, talentId, '');
            const department = _.get(companyWorkspacesKeyValuePairs, `${constants.prefix.entity}${job.entityId}`, '');
            const hiringManager = hiringManagerFullName(job, usersByUserId)
            const currency = _.get(job, 'itemData.currency') || constants.currencyTypes.default;
            const planned = _.get(job, 'viewData.milestonesData.aggregatedMilestonesAmounts.baseCurrency.totalPlanned', 0);
            let plannedLocal = planned
            let requested = _.get(job, 'viewData.milestonesData.aggregatedMilestonesAmounts.baseCurrency.totalRequested', 0);
            let approved = _.get(job, 'viewData.milestonesData.aggregatedMilestonesAmounts.baseCurrency.totalActual', 0);
            let paymentCurrency = constants.currencyTypes.default;
            let milestoneCurrency = Object.keys(_.omit(_.get(job, 'viewData.milestonesData.aggregatedMilestonesAmounts'), ['baseCurrency', 'USD', 'undefined']));
            if (_.size(milestoneCurrency) === 1) {
                [milestoneCurrency] = milestoneCurrency;
                if (planned === (_.get(job, `viewData.milestonesData.aggregatedMilestonesAmounts.USD.totalPlannedLocal`) || planned)) {
                    plannedLocal = _.get(job, `viewData.milestonesData.aggregatedMilestonesAmounts.${milestoneCurrency}.totalPlannedLocal`, planned);
                }
                if (requested === (_.get(job, `viewData.milestonesData.aggregatedMilestonesAmounts.USD.totalRequestedLocal`) || requested) &&
                    approved === (_.get(job, `viewData.milestonesData.aggregatedMilestonesAmounts.USD.totalActualLocal`) || approved)) {
                    paymentCurrency = milestoneCurrency;
                    requested = _.get(job, `viewData.milestonesData.aggregatedMilestonesAmounts.${milestoneCurrency}.totalRequestedLocal`, requested);
                    approved = _.get(job, `viewData.milestonesData.aggregatedMilestonesAmounts.${milestoneCurrency}.totalActualLocal`, approved);
                }
            }
            const baseProps = {
                itemId: job.itemId,
                jobId: job.itemId,
                entityId: job.entityId,
                department,
                hiringManager,
                companyId: job.companyId,
                jobFlow: job.jobFlow,
                hiringManagerId: hiringManagerId,
                isHiringManager: currentUser === hiringManagerId,
                status: job.itemStatus,
                title: _.get(job, 'itemData.jobTitle', ''),
                type: _.get(job, 'itemData.workforceType'),
                startDate: new Date(_.get(job, 'itemData.jobStartDate')).getTime(),
                description: _.get(job, 'itemData.jobDescription') || '',
                scope: _.get(job, 'itemData.scope') || '',
                team: _.get(job, `tags.${constants.tags.teams}`, []),
                engagementType: _.get(job, 'itemData.engagementType', ''),
                customRateData: _.get(job, 'itemData.customRateData', {}),
                currency,
                paymentCurrency,
                tags: _.get(job, 'tags', []) || [],
                jobAcceptedTime: _.get(job, 'itemData.jobAcceptedTime'),
                jobHandShakeStage: _.get(job, 'itemData.jobHandShakeStage'),
                bids: _.get(job, 'itemData.bids'),
                talentId: talentId || 'emptyTalent',
                talentName: talentName,
                planned,
                plannedBudget: _.get(job, `viewData.milestonesData.plannedBudget`, 0),
                plannedLocal,
                requested: requested,
                approved: approved,
                jobMilestoneCardData: _.get(job, `viewData.milestonesData.jobMilestoneCardDataByFilterKey.${filterKey}`, {}),
                allowedActions: _.get(job, 'viewData.milestonesData.allowedActions', { [jobsActions.MOVE]: true }),
                activeMilestones: _.get(job, 'viewData.milestonesData.activeMilestones'),
                ...talentId && { providerId: idConverterLib.getProviderIdFromTalentId(talentId) },
            };
            return baseProps
        })
    }
    return [];
}

const normalizeProviderOnboardingData = (provider, talentsByProviderId, companySettings, usersByUserId, userId) => {
    jsonLogger.info({ type: "TRACKING", function: "onboardingHelper::normalizeProviderOnboardingData", provider });

    const firstName = _.get(provider, ["itemData", "firstName"], "")
    const lastName = _.get(provider, ["itemData", "lastName"])
    const name = _.get(provider, ["itemData", "providerName"], `${firstName} ${lastName}`)
    const isProviderSelfEmployedTalent = _.get(provider, ["itemData", "isProviderSelfEmployedTalent"], false)
    const { itemId } = provider
    const providerTalent = isProviderSelfEmployedTalent ? _.head(talentsByProviderId[itemId]) : {}
    const talentProfileData = _.get(providerTalent, ['itemData', 'talentProfileData']);

        const { signedLegalDocsCount,
        taxDocsCount,
        legalDocsCount,
        signedTaxDocsCount,
        profileStep,
        onboardingProgressPercentage } = getOnboardingProgressInfo(provider, providerTalent, companySettings)
    const providerId = _.get(provider, 'itemId');
    
    const createdBy = _.get(provider, 'createdBy');
    const creatorUser = _.get(usersByUserId, createdBy, {});
    const isInvitorUser = userId === createdBy;
    const invitedBy = `${_.get(creatorUser, 'itemData.givenName', '')} ${_.get(creatorUser, 'itemData.familyName')}`; 
    const result = {
        name,
        email: _.get(provider, ["itemData", "email"]) || _.get(provider, ["itemData", "providerEmail"]),
        // eslint-disable-next-line no-undefined
        img: prefixLib.isProvider(itemId) && !isProviderSelfEmployedTalent ? _.get(provider, ["itemData", "img"]) : undefined,
        status: _.get(provider, "itemStatus"),
        invitationDate: _.get(provider, "createdAt"),
        registrationDate: _.get(provider, ["itemData", "registrationDate"]) || _.get(provider, "createdAt"),
        startTime: _.get(provider, "createdAt"),
        payableStatusValue: payableStatusMap[_.get(provider, ["payableStatus", "payableStatus"])],
        legalDocsCount,
        signedLegalDocsCount,
        legalDocsValue: signedLegalDocsCount === legalDocsCount ? "Yes" : "No",
        taxDocsCount,
        signedTaxDocsCount,
        taxDocsValue: signedTaxDocsCount === taxDocsCount ? "Yes" : "No",
        profileStep,
        onboardingProgressPercentage,
        itemId: _.get(provider, "itemId"),
        providerId,
        groupByProviderIdField: providerId,
        isProviderSelfEmployedTalent,
        isTalentTypeVariant: true,
        id: isProviderSelfEmployedTalent ? _.get(_.head(talentsByProviderId[itemId]), "itemId") : itemId,
        isTalentProfileMissingSkills: isProviderSelfEmployedTalent && _.isEmpty(_.get(talentProfileData, 'skills', [])),
        isTalentProfileMissingAbout: isProviderSelfEmployedTalent && !_.get(talentProfileData, 'about'),
        isTalentProfileMissingEducation: isProviderSelfEmployedTalent && !_.get(talentProfileData, 'education'),
        isTalentProfileMissingExperience: isProviderSelfEmployedTalent && _.isEmpty(_.get(talentProfileData, 'experience', [])),
        isTalentProfileMissingCertifications: isProviderSelfEmployedTalent && _.isEmpty(_.get(talentProfileData, 'certifications', [])),
        invitedBy,
        isInvitorUser,
    }
    jsonLogger.info({ type: "TRACKING", function: "onboardingHelper::normalizeProviderOnboardingData", result });

    return result
}


const normalizeOnboardingData = async (companyTalents, companyId, users, userId) => {
    const companySettings = await getCompanySettings(companyId);
    const [providers, talents] = _.partition(companyTalents, (item) => item.itemId.startsWith(constants.prefix.provider))

        const talentsByProviderId = _.groupBy(talents, (talent) => idConverterLib.getProviderIdFromTalentId(_.get(talent, 'itemId')))
        jsonLogger.info({ type: "TRACKING", function: "onboardingHelper::normalizeOnboardingData", talentsByProviderId, providersCount: _.size(providers) });
        const filteredProviders = _.filter(providers, (provider) => {
            const { itemStatus } = provider
            const { onboardingCompletionTime } = provider.itemData
            const currentDate = dayjs()
            const differenceInDays = dayjs(onboardingCompletionTime).diff(currentDate, 'day')

            return (!onboardingCompletionTime || differenceInDays <= MONTH_DAYS) && ![constants.companyProvider.status.notInvited, constants.companyProvider.status.enrolled, constants.companyProvider.status.inactive].includes(itemStatus)
        })
        const usersByUserId = _.keyBy(users, 'userId');
        return _.map(filteredProviders, (provider) => normalizeProviderOnboardingData(provider, talentsByProviderId, companySettings, usersByUserId, userId))

}

module.exports = {
    normalizeJobs,
    normalizeOnboardingData,
}
