/* eslint-disable max-lines */
/* eslint-disable complexity */
/* eslint-disable require-atomic-updates */
/* eslint-disable prefer-const */
/* eslint-disable no-magic-numbers */
/* eslint-disable max-depth */
/* eslint-disable no-extra-parens */
/* eslint-disable no-await-in-loop */
/* eslint-disable max-lines-per-function */
/* eslint-disable array-element-newline */
/* eslint-disable max-params */

'use strict';

const _ = require('lodash');
const AWS = require('aws-sdk');
const {
    constants, jsonLogger, responseLib, prefixLib, snsLib, jobHelper, legalDocsHelper, SqsService,
    CompanyProvidersService, TalentsService, UsersService, SettingsService, BudgetsService,
    JobsService, CompaniesService, tagsService, dynamoDbUtils, BidsService, idConverterLib, personalInfoLib, permisionConstants
} = require('stoke-app-common-api');
const { upgradeProviderDepartments } = require('./updateProviderDepartments');
const { getProviderEffectiveItemStatus } = require('./helpers/utils');
const { createItemId } = require('./helpers/commonHelper');
const { moveJobFiles } = require('./helpers/filesHelper');
const { isNotAllowToEditJob, getIsMilestoneAutoBudget, createNewBidsAndUpdateJob, isJobOffer } = require('./helpers/jobHelper');
const { getJobRequestLevels, getUpdatedJobRequestLevels } = require('./helpers/jobRequestHelper');
const { isItemAvailableBudget } = require('stoke-app-common-api/helpers/budgetHelper');
const { ChatService, role: chatRole } = require('stoke-chat-api');

const { getTalentDetails } = require('./chat');
const { getTalentIdFromBidId } = require('stoke-app-common-api/lib/idConverterLib');
const documentClient = new AWS.DynamoDB.DocumentClient();

const {
    talentsTableName,
    jobsTableName,
    consumerAuthTableName,
    settingsTableName,
    budgetsTableName,
    companyProvidersTableName,
    customersTableName,
    bidsTableName,
    INTERACT_TOPIC_ARN,
    TALKJS_APP_ID,
    TALKJS_API_KEY,
    stage,
    TALENT_URL_DOMAIN,
    asyncTasksQueueName,
    gsiItemByUserIdIndexName,
} = process.env;

const asyncTasksQueue = new SqsService(asyncTasksQueueName);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const talentsService = new TalentsService(talentsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAttributesAndExternalUserId, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const bidsService = new BidsService(bidsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const talentPattern = new RegExp(`(${constants.prefix.talent})(${constants.prefix.provider}.*?)(${constants.prefix.talent})`, 'u');
const chatService = new ChatService(TALKJS_APP_ID, TALKJS_API_KEY);
const talentPatternProviderIdGroup = 2;
const forbidden = 'FORBIDDEN';

const extractProviderId = (talentId) => {
    const talentIdGroups = talentId && talentId.match(talentPattern);
    return talentIdGroups ? talentIdGroups[talentPatternProviderIdGroup] : null;
};

const getCompanySettings = async (companyId) => {
    if (!companyId) {
        return null;
    }
    const result = await settingsService.get(`${constants.prefix.company}${companyId}`);
    return result;
}

const generateUpdateJobItem = async (userId, entityId, itemId, itemData, companyId, itemStatus) => {

    jsonLogger.info({
        type: "TRACKING",
        function: "jobs::generateUpdateJobItem",
        userId, entityId, itemId, itemData, itemStatus
    });
    if (!prefixLib.isMilestone(itemId)) {

        const settings = await getCompanySettings(companyId);
        if (itemData && settings && settings.itemData && settings.itemData.publicPosting) {
            itemData.jobPublicPost = true;
        }
    }

    return {
        entityId,
        itemId,
        itemStatus,
        itemData,
        modifiedBy: userId,
    };
}

const updateJobInner = async (userId, entityId, itemId, itemData, companyId, itemStatus) => {
    const item = await generateUpdateJobItem(userId, entityId, itemId, itemData, companyId, itemStatus);
    const result = await jobsService.update(item);
    return { Attributes: { ...item, itemData: _.get(result, 'Attributes.itemData') } }
}

const getCompanyAndEntitySettings = async (companyId, entityId) => {
    const companySettings = await settingsService.get(`${constants.prefix.company}${companyId}`);
    const entitySettings = await settingsService.get(`${constants.prefix.entity}${entityId}`);
    return { companySettings, entitySettings };
}

const getSignedJobRequestLevels = (milestone, companySettings, entitySettings, isCompanyAdmin, isEntityAdmin, userId) => {
    const msJobRequestLevels = getJobRequestLevels(milestone, companySettings, entitySettings);
    if (!_.isEmpty(msJobRequestLevels)) {
        const { isAuthorised, levelsToApprove } = jobHelper.validateLevelsToApprove(milestone, msJobRequestLevels, userId, isEntityAdmin, isCompanyAdmin, [], constants.MULTI_LEVEL_SETTINGS.jobRequestApproval);
        return isAuthorised
            ? getUpdatedJobRequestLevels(msJobRequestLevels, levelsToApprove, userId)
            : msJobRequestLevels;
    }
    return [];
}

const getSignJobRequestInfo = (milestone, companySettings, entitySettings, isCompanyAdmin, isEntityAdmin, userId) => {
    const jobRequestLevels = getSignedJobRequestLevels(milestone, companySettings, entitySettings, isCompanyAdmin, isEntityAdmin, userId);
    const notApprovedLevels = _.find(jobRequestLevels, (level) => !level.approvedBy);
    return { jobRequestLevels, isJobRequestStatus: !_.isEmpty(notApprovedLevels) };
}

const generateUpdateMilestonesItems = async (entityId, jobId, modifiedBy) => {
    jsonLogger.info({ type: "TRACKING", function: "jobs::generateUpdateMilestonesItems", entityId, jobId, modifiedBy });
    const milestones = await jobsService.list(entityId, null, `${constants.prefix.milestone}${jobId}_`);
    jsonLogger.info({ type: "TRACKING", function: "jobs::generateUpdateMilestonesItems", milestones, jobId, entityId });
    if (!milestones || !milestones.length) {
        return [];
    }

    const sortedMilestones = _.sortBy(milestones, 'itemData.date')
    const allMilstones = []
    let lastDate = null
    let lastCost = 0
    if (sortedMilestones && sortedMilestones.length) {
        const [{ userId, companyId }] = milestones;
        const { companySettings, entitySettings } = await getCompanyAndEntitySettings(companyId, entityId);
        const userBudget = await budgetsService.get(entityId, `${constants.prefix.user}${userId}`);
        const { entitiesAdmin } = await usersService.getCompanyUserAuthRoleWithComponents(modifiedBy, companyId, { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } });
        const isCompanyAdmin = entitiesAdmin.find((entity) => entity.entityId === companyId);
        const isEntityAdmin = entitiesAdmin.find((entity) => entity.entityId === entityId);
        for (const milestone of sortedMilestones) {
            let itemStatusToUpdate = constants.job.status.budgetRequest;
            const { itemData, itemId } = milestone
            let { date, cost } = itemData
            const { jobRequestLevels, isJobRequestStatus } = getSignJobRequestInfo(milestone, companySettings, entitySettings, isCompanyAdmin, isEntityAdmin, modifiedBy);

            if (isJobRequestStatus) {
                itemStatusToUpdate = constants.job.status.jobRequest;
                // eslint-disable-next-line no-negated-condition
            } else if (cost !== 0) {
                date = new Date(date)
                if (lastDate) {
                    if (date.getFullYear() === lastDate.getFullYear()) {
                        // eslint-disable-next-line no-magic-numbers 
                        const currentPeriod = Math.floor(date.getMonth() / 12 * 4) + 1
                        // eslint-disable-next-line no-magic-numbers 
                        const lastPeriod = Math.floor(lastDate.getMonth() / 12 * 4) + 1
                        if (currentPeriod === lastPeriod) {
                            cost += lastCost
                        }
                    }
                }
                lastDate = date
                lastCost = cost

                const isUserBudgetAvailable = isItemAvailableBudget(userBudget, lastDate, lastCost);
                jsonLogger.info({ type: "TRACKING", function: "jobs::generateUpdateMilestonesItems", isUserBudgetAvailable, milestone, cost: lastCost });
                if (isUserBudgetAvailable) {
                    itemStatusToUpdate = constants.job.status.active;
                }
            } else {
                itemStatusToUpdate = constants.job.status.active;
            }

            allMilstones.push({
                entityId: entityId,
                itemId: itemId,
                itemData,
                itemStatus: itemStatusToUpdate,
                modifiedBy: modifiedBy,
                ...(itemStatusToUpdate === constants.job.status.budgetRequest ? { isProcessing: true } : {}),
                ...(_.isEmpty(jobRequestLevels) ? {} : { jobRequestLevels }),
            })
        }
    }
    return allMilstones;
}

const getIsMissingUserBudgetForJob = async (milestones, modifiedBy, companyId, thresholdsSettings, companySettings) => {
    jsonLogger.info({ type: "TRACKING", function: "jobs::getIsMissingUserBudgetForJob", milestones, modifiedBy, thresholdsSettings, companySettings });
    if (!milestones || !milestones.length || _.some(milestones, (item) => item.itemStatus !== constants.job.status.budgetRequest)) {
        jsonLogger.info({ type: "TRACKING", function: "jobs::getIsMissingUserBudgetForJob", message: "not all milestone is budgetReqest", milestones, modifiedBy, thresholdsSettings });
        return false;
    }
    const isSupportPONumbers = _.get(companySettings, 'itemData.isSupportPONumbers');

    const sortedMilestones = _.sortBy(milestones, 'itemData.date')
    if (sortedMilestones && sortedMilestones.length) {
        const [{ entityId }] = milestones
        const isEntityAdmin = await usersService.validateUserEntityWithComponents(modifiedBy, entityId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } });
        const isCompanyAdmin = await usersService.validateUserEntityWithComponents(modifiedBy, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } });
        const adminBudget = await budgetsService.get(entityId, `${constants.prefix.user}${modifiedBy}`);
        const adminCompanyBudget = await budgetsService.get(companyId, `${constants.prefix.user}${modifiedBy}`);
        for (const milestone of sortedMilestones) {
            const { itemData } = milestone;
            if (!isSupportPONumbers && getIsMilestoneAutoBudget(thresholdsSettings, milestone)) {
                jsonLogger.info({ type: "TRACKING", function: "jobs::getIsMissingUserBudgetForJob", message: "milestone has autoBudget", milestone });
                return false;
            }
            const { date, cost } = itemData;
            const isSourceAsTarget = entityId === milestone.entityId && modifiedBy === milestone.userId;
            if (!isSourceAsTarget && isEntityAdmin) {
                const isEntityBudgetAvailable = await isItemAvailableBudget(adminBudget, new Date(date), cost);
                if (isEntityBudgetAvailable) {
                    jsonLogger.info({ type: "TRACKING", function: "jobs::getIsMissingUserBudgetForJob", message: "milestone will transfer budget from entity admin", adminBudget });
                    return false;
                }
            }
            if (!isSupportPONumbers && isCompanyAdmin) {
                const isCompanyBudgetAvailable = await isItemAvailableBudget(adminCompanyBudget, new Date(date), cost);
                if (isCompanyBudgetAvailable) {
                    jsonLogger.info({ type: "TRACKING", function: "jobs::getIsMissingUserBudgetForJob", message: "milestone will transfer budget from compnay admin", adminBudget });
                    return false;
                }
            }
        }
    }
    return true;
}

/**
 * update or insert company provider
 * @param {Object} companyProvider - existing company provider
 * @param {String} companyId - company id
 * @param {String} itemId - itemId to create or update
 * @param {String} createdBy - createdBy or modifiedBy
 * @param {String} itemData - item data to create or update
 * @param {Boolean} isProviderRegistered - isProviderRegistered
 * @param {String} status - status of the talent
 * @return {promise} return promise of companyProvider updated
 */
const upsertCompanyProvider = async (companyProvider, companyId, itemId, createdBy, itemData, isProviderRegistered, status) => {
    let updateProviderResult = null;
    if (companyProvider) {
        const isTalentInactive = companyProvider.itemStatus === constants.companyProvider.status.inactive;
        // if the user wants to create a job on an inactive talent we need to re-activate it by setting his itemStatus to registered 
        const itemStatus = isTalentInactive && isProviderRegistered ? constants.companyProvider.status.registered : companyProvider.itemStatus
        jsonLogger.info({ type: "TRACKING", function: "jobs::upsertCompanyProvider", message: 'update existing provider', itemStatus });
        updateProviderResult = await companyProvidersService.update({
            companyId,
            itemId,
            modifiedBy: createdBy,
            itemData,
            itemStatus
        });
    } else {
        const isMarketPlace = Object.values(constants.marketplaces).some((mrkt) => itemId.includes(mrkt.provider));
        const itemStatus = await getProviderEffectiveItemStatus(companyId, status || constants.companyProvider.status.inactive, isMarketPlace);
        jsonLogger.info({ type: "TRACKING", function: "jobs::upsertCompanyProvider", message: 'create new provider', itemStatus });
        updateProviderResult = await companyProvidersService.create({
            companyId,
            itemId,
            modifiedBy: createdBy,
            createdBy,
            itemData,
            itemStatus
        });
    }
    if (!updateProviderResult) {
        jsonLogger.error({ type: 'TRACKING', function: "jobs::upsertCompanyProvider", message: 'failed to update/ create company provider', companyProvider, companyId, itemId, createdBy, itemData });
        return null;
    }
    const result = await legalDocsHelper.handler(gsiItemByUserIdIndexName, updateProviderResult);
    return result
}

const normalizeTalentProfile = (companyTalentProfile, talentData) => {
    if (!_.isEmpty(companyTalentProfile)) {
        return companyTalentProfile;
    } else if (!talentData) {
        return null;
    }
    const normalizedSkills = _.get(talentData, 'skills', []).map((skill, index) => ({
        ...skill,
        title: skill.title || skill.name,
        id: skill.id || index,
    }));
    return {
        ...talentData,
        about: talentData.about || talentData.description,
        skills: normalizedSkills,
        portfolio: talentData.portfolio || _.get(talentData, 'portfolios.url')
    }
}

const getProviderToUpdate = async (companyId, providerId, updatedProviderEmail, emailField, prefix) => {
    let existingCompanyProvider = await companyProvidersService.get(companyId, providerId);
    let updateProviderId = _.get(existingCompanyProvider, 'itemId', providerId);
    if (!existingCompanyProvider) {
        const companyProvidersByEmail = await companyProvidersService.getByEmail(companyId, updatedProviderEmail, emailField, prefix);
        if (!_.isEmpty(companyProvidersByEmail)) {
            existingCompanyProvider = _.first(companyProvidersByEmail)
            updateProviderId = _.get(existingCompanyProvider, 'itemId') || providerId
        }
    }
    return {
        providerId: updateProviderId, provider: existingCompanyProvider
    };
}

/**
 * update CompanyProvider for new job
 * @param {string} companyId - id of company 
 * @param {string} entityId - id of entity
 * @param {string} talentId - id of talent
 * @param {string} modifiedBy - id of user
 * @param {string} hiringManagerId - id of hiringManager
 * @param {string} jobId - id of job
 * @param {string} updatedProviderEmail - provider id
 * @param {boolean} isHireCandidate - isHireCandidate in order to set isHireByStoke flag for billing purposes
 * @param {object} legalDocumentsToSend - legalDocuments to send to newly created provider
 * @param {string} status - status of the talent
 * @param {object} enrollData - job data to save from the enrollment
 * @return {promise} return promise of companyProvider updated
 */
const updateCompanyProvider = async (companyId, entityId, talentId, modifiedBy, hiringManagerId, jobId, updatedProviderEmail, isHireCandidate, legalDocumentsToSend, status, enrollData) => {
    jsonLogger.info({ type: "TRACKING", function: "jobs::updateCompanyProvider", companyId, entityId, talentId, modifiedBy, hiringManagerId, jobId, updatedProviderEmail, isHireCandidate, legalDocumentsToSend, status, enrollData });

    const talentCompanyProvider = await companyProvidersService.get(companyId, talentId);
    const compTalentItemData = _.get(talentCompanyProvider, 'itemData', {});

    let { providerId } = compTalentItemData;
    // eslint-disable-next-line init-declarations
    let providerLegalDocuments;
    if (!providerId) {
        providerId = extractProviderId(talentId);
        compTalentItemData.providerId = providerId;

        const entitySettings = await settingsService.get(`${constants.prefix.entity}${entityId}`);
        const entityLegalDocuments = _.get(entitySettings, 'itemData.legalEntity.legalDocs');
        const legalDocs = _.map(legalDocumentsToSend, (value, legaldocName) => value && (_.get(entityLegalDocuments, legaldocName))).filter(Boolean)
        const todayDate = new Date()
        providerLegalDocuments = _.map(legalDocs, doc => {
            const docExperation = _.get(doc, 'expirationMonths')
            return {
                name: _.get(doc, 'templateName'),
                legalEntityName: _.get(doc, 'legalEntity'),
                companySignerEmail: _.get(doc, 'companySignerEmail'),
                companySignerName: _.get(doc, 'companySignerName'),
                requestedByUserId: modifiedBy,
                ...((docExperation && docExperation > 0) && { expirationDate: todayDate.setMonth(todayDate.getMonth() + docExperation) }),
            }
        })
    }

    let isProviderSelfEmployedTalent = false;
    let isProviderRegistered = false;
    const talent = await talentsService.get(talentId);
    if (providerId) {
        const { provider: existingCompanyProvider, providerId: updateProviderId } = await getProviderToUpdate(companyId, providerId, updatedProviderEmail, 'providerEmail', constants.prefix.provider)

        const existingItemData = _.get(existingCompanyProvider, 'itemData', {});
        let { providerEmail, providerName } = existingItemData;
        const externalUserId = _.get(existingCompanyProvider, 'externalUserId');
        isProviderRegistered = prefixLib.isExtProviderUserId(externalUserId);
        jsonLogger.info({ type: "TRACKING", function: "jobs::updateCompanyProvider", existingCompanyProvider, isProviderRegistered });

        const marketplace = Object.values(constants.marketplaces).find((mrkt) => mrkt.provider === providerId);

        if (!existingCompanyProvider && !marketplace) {
            isProviderSelfEmployedTalent = true;
        }
        // eslint-disable-next-line no-extra-parens
        providerName = providerName || (marketplace && marketplace.providerName);
        if (!providerName || !providerEmail || updatedProviderEmail !== providerEmail) {
            providerName = providerName || _.get(talent, 'itemData.name');
            let talentEmail = _.get(talent, 'itemData.email');
            talentEmail = talentEmail && decodeURIComponent(talentEmail);
            providerEmail = providerEmail || talentEmail;

            await upsertCompanyProvider(
                existingCompanyProvider,
                companyId,
                updateProviderId,
                modifiedBy,
                {
                    ...existingItemData,
                    providerName,
                    providerEmail: _.toLower(updatedProviderEmail) || providerEmail,
                    isProviderSelfEmployedTalent: _.get(
                        existingCompanyProvider,
                        "itemData.isProviderSelfEmployedTalent",
                        isProviderSelfEmployedTalent
                    ),
                    departments: upgradeProviderDepartments(_.get(existingItemData, 'departments', [companyId]), [entityId], companyId),
                    ...(providerLegalDocuments && { legalDocuments: providerLegalDocuments }),
                    ...(enrollData && { enrollData }),
                },
                isProviderRegistered,
                status
            );
        }
    } else {
        jsonLogger.error({ type: "TRACKING", function: "jobs::updateCompanyProvider", message: "talent from talents table should always have provider id" });
    }
    const { email, name, firstName } = compTalentItemData;
    const isProviderSelfEmployedTalentUpdated = _.get(
        talentCompanyProvider,
        "itemData.isProviderSelfEmployedTalent",
        isProviderSelfEmployedTalent
    )
    // eslint-disable-next-line no-mixed-operators
    if (!email || !(name && firstName)) {
        compTalentItemData.name = _.get(talent, 'itemData.name');
        compTalentItemData.email = email || _.get(talent, 'itemData.email');
        if (isProviderSelfEmployedTalentUpdated && !compTalentItemData.email) {
            compTalentItemData.email = _.toLower(updatedProviderEmail);
        }
    }
    compTalentItemData.talentProfileData = normalizeTalentProfile(compTalentItemData.talentProfileData, _.get(talent, 'itemData'));
    compTalentItemData.isHireByStoke = _.get(compTalentItemData, 'isHireByStoke', _.get(talent, 'itemData.isHireByStoke', Boolean(isHireCandidate)));
    compTalentItemData.departments = upgradeProviderDepartments(_.get(compTalentItemData, 'departments', [companyId]), [entityId], companyId);

    const updatedCompanyProvider = await upsertCompanyProvider(
        talentCompanyProvider,
        companyId,
        talentId,
        modifiedBy,
        {
            ...compTalentItemData,
            isProviderSelfEmployedTalent: isProviderSelfEmployedTalentUpdated,
        },
        isProviderRegistered,
        status
    );
    if (updatedCompanyProvider) {
        jsonLogger.info({ type: "TRACKING", function: "jobs::updateCompanyProvider", message: "update companyProvider with jobData" });
    }
    return updatedCompanyProvider
};

// eslint-disable-next-line max-lines-per-function
const innerCreateJob = async (companyId, entityId, userId, createdBy, itemData, itemStatus, tags, existingItemId, prefix) => {
    jsonLogger.info({
        type: "TRACKING",
        function: "jobs::innerCreateJob",
        companyId, entityId, userId, createdBy, itemStatus, itemData, tags, prefix
    });

    if (!tagsService.validate(tags)) {
        return null;
    }

    const itemId = existingItemId || createItemId(prefix || constants.prefix.job);
    itemData.baseJobFlow = itemData.jobFlow;
    const item = {
        userId,
        entityId: entityId,
        itemId: itemId,
        itemStatus: itemStatus || constants.job.status.pending,
        itemData,
        createdBy,
        modifiedBy: createdBy,
        companyId,
        tags,
    };

    const jobResult = await jobsService.create(item);

    jsonLogger.info({
        type: "TRACKING",
        function: "jobs::innerCreateJob",
        jobResult
    });

    if (!jobResult) {
        jsonLogger.error({
            type: "TRACKING",
            function: "jobs::innerCreateJob",
            message: "job  creation failed"
        });
        return null;
    }

    return jobResult;
};


// eslint-disable-next-line max-lines-per-function
const createJob = async (event, context) => {
    const data = JSON.parse(event.body);
    const identityUserId = event.requestContext.identity.cognitoIdentityId;
    const { entityId, userId, itemStatus, itemData, tags, type } = data;

    jsonLogger.info({
        type: "TRACKING",
        function: "jobs::createJob",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        jobType: type,
        userId,
        identityUserId,
        entityId,
        tags,
        event
    });

    if (!itemData) {
        return responseLib.failure({
            message: "missing itemData in body"
        });
    }

    const role = userId && identityUserId !== userId ? constants.user.role.admin : null;
    const authorised = await usersService.validateUserEntityWithComponents(identityUserId, entityId, role, { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } });
    if (!authorised) {
        return responseLib.forbidden({ status: false });
    }
    if (userId && identityUserId !== userId) {
        const hmAuthorised = await usersService.validateUserEntityWithComponents(userId, entityId, null, { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } });
        if (!hmAuthorised) {
            return responseLib.forbidden({ status: false });
        }
    }
    const { companyId } = authorised;
    if (companyId === entityId) {
        jsonLogger.error({ type: "TRACKING", function: "jobs::createJob", message: "entityId cannot be the same as companyId" });
        return responseLib.failure({ status: false });
    }

    const realUserId = userId || identityUserId
    const isTemplate = type === constants.job.jobType.template

    const isTemplateOriginally = _.get(itemData, 'isTemplateOriginally');
    const templateId = _.get(itemData, 'templateId');
    const jobFiles = _.get(itemData, 'files');

    const result = await innerCreateJob(companyId, entityId, realUserId, identityUserId, itemData, itemStatus, tags, null, isTemplate ? constants.prefix.template : null);

    if (result && isTemplateOriginally && templateId && !_.isEmpty(jobFiles)) {
        const oldPath = `${companyId}/${entityId}/${userId}/${templateId}/fileUploads`;
        // eslint-disable-next-line no-undefined
        const newFilesArray = await moveJobFiles(jobFiles, companyId, entityId, userId, undefined, undefined, result.itemId, oldPath);
        if (!newFilesArray || _.size(jobFiles) !== _.size(newFilesArray)) {
            jsonLogger.error({ type: 'TRACKING', function: 'jobs::createJob', message: 'failed to copy job files, returning empty array', jobFiles, newFilesArray });
        }
        _.set(itemData, 'files', newFilesArray);
        const resultNew = await updateJobInner(userId, entityId, result.itemId, itemData, companyId, itemStatus);
        _.set(result, 'itemData', _.get(resultNew, 'Attributes.itemData'));
    }

    return result ? responseLib.success(result) : responseLib.failure({ status: false });
};

const isItemStatus = (itemStatus) => itemStatus && Object.values(constants.job.status).includes(itemStatus);

const setMilestoneBasicDetails = (milestone, itemId, entityId, companyId, createdBy, userId, talentId) => {
    milestone.itemData.jobId = itemId;
    milestone.itemId = createItemId(`${constants.prefix.milestone}${itemId}_`);
    milestone.entityId = entityId;
    milestone.userId = userId;
    milestone.companyId = companyId;
    milestone.createdBy = createdBy;
    milestone.modifiedBy = createdBy;
    if (talentId) {
        milestone.talentId = talentId;
    }
    return milestone
}

const milestonesCreation = async (milestones, parentJob, entityId, createdBy) => {
    const result = await jobsService.transactCreate(milestones);
    if (result) {
        const item = { entityId: entityId, itemId: parentJob.itemId, itemData: parentJob.itemData, modifiedBy: createdBy };
        const jobResult = await jobsService.update(item);
        if (jobResult) {
            return result;
        }
    }
    return null;
}

const innerCreateMilestones = async (companyId, entityId, parentJob, createdBy, milestones) => {
    jsonLogger.info({
        type: "TRACKING", function: "jobs::innerCreateMilestones", companyId, entityId, parentJob, createdBy, milestones
    });
    const { itemData, itemId } = parentJob;
    let { totalBudget } = itemData || {};

    for (const milestone of milestones) {
        if (!milestone || !milestone.itemData || !milestone.itemData.title || !isItemStatus(milestone.itemStatus)) {
            jsonLogger.error({
                type: "TRACKING", function: "jobs::innerCreateMilestones", message: "missing required data", milestone
            });
            return null;
        }
        const { cost } = milestone.itemData;
        if (isNaN(cost)) {
            jsonLogger.error({
                type: "TRACKING", function: "jobs::innerCreateMilestones", message: "cost should be a number", cost
            });
            return null;
        }
        const talentId = _.get(parentJob, 'itemData.talentId');
        setMilestoneBasicDetails(milestone, itemId, entityId, companyId, createdBy, parentJob.userId, talentId);

        // eslint-disable-next-line no-magic-numbers
        totalBudget = (totalBudget || 0) + (cost || 0);

    }
    parentJob.itemData.totalBudget = totalBudget;

    const result = await milestonesCreation(milestones, parentJob, entityId, createdBy)
    return result
}

const createMilestones = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body);

    const { parentJobId, entityId, milestones } = data;

    jsonLogger.info({
        type: "TRACKING", function: "jobs::createMilestones", functionName: context.functionName, awsRequestId: context.awsRequestId,
        userId, parentJobId, entityId, milestones, event
    });


    if (!parentJobId || !parentJobId.length || !entityId || !entityId.length || !milestones || !milestones.length) {
        return responseLib.failure({ message: "missing required data", parentJobId, entityId, milestones });
    }

    const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, null, { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } });
    if (!authorised) {
        return responseLib.forbidden({ status: false });
    }
    const parentJob = await jobsService.get(entityId, parentJobId);

    if (isNotAllowToEditJob(authorised.itemData.userRole, userId, parentJob.userId)) {
        return responseLib.forbidden({ status: false });
    }


    const { companyId } = authorised;
    const result = await innerCreateMilestones(companyId, entityId, parentJob, userId, milestones)
    return result ? responseLib.success(result) : responseLib.failure({ status: false });
}

const innerSign = async (companyId, entityId, itemData, jobId, userId, modifiedBy, providerItemId, milestones, providerEmail, isHireCandidate, legalDocumentsToSend) => {
    jsonLogger.info({ type: "TRACKING", function: "jobs::innerSign", companyId, entityId, itemData, jobId, userId, modifiedBy, providerItemId, providerEmail, isHireCandidate, legalDocumentsToSend });
    if (milestones && milestones.length) {
        const parentJob = await jobsService.get(entityId, jobId);
        const mlstnsCreationResult = await innerCreateMilestones(companyId, entityId, parentJob, modifiedBy, milestones);
        if (!mlstnsCreationResult) {
            jsonLogger.error({ type: 'TRACKING', function: 'jobs::innerSign', message: 'failed to create milestones' });
            return null;
        }
    }

    const { jobStartDate, monthlyBudget, totalBudget } = itemData;
    let isMissingCompanyBudget = false;
    let itemStatus = constants.job.status.active;
    if (jobStartDate) {
        const currentDate = new Date(jobStartDate);
        // eslint-disable-next-line no-magic-numbers
        const isCompanyBudgetAvailable = await budgetsService.isAvailableBudget(companyId, `${constants.prefix.company}${companyId}`, currentDate, monthlyBudget || totalBudget);
        jsonLogger.info({ type: "TRACKING", function: "jobs::innerSign", isCompanyBudgetAvailable });

        if (!isCompanyBudgetAvailable) {
            itemStatus = constants.job.status.budgetRequest
            isMissingCompanyBudget = true
        }
    }
    let updateItems = await generateUpdateMilestonesItems(entityId, jobId, modifiedBy);
    const availableStatuses = _.countBy(updateItems, 'itemStatus');
    itemStatus = (availableStatuses[constants.job.status.active] && constants.job.status.active) ||
        (availableStatuses[constants.job.status.budgetRequest] && constants.job.status.budgetRequest) ||
        (availableStatuses[constants.job.status.jobRequest] && constants.job.status.jobRequest) ||
        itemStatus

    const companySettings = await settingsService.get(`${constants.prefix.company}${companyId}`);
    const thresholdsSettings = await settingsService.getAutoApproveThresholds(companyId, entityId);
    const isMissingUserBudget = itemStatus !== constants.job.status.jobRequest && await getIsMissingUserBudgetForJob(updateItems, modifiedBy, companyId, thresholdsSettings, companySettings);


    const { providerId: updateTalentId } = await getProviderToUpdate(companyId, providerItemId, providerEmail, 'email', constants.prefix.talent)

    updateItems = updateItems.map((item) => _.omit(item, 'itemData'));
    updateItems.push({
        entityId,
        itemId: jobId,
        itemStatus,
        itemData: { ...itemData, talentId: updateTalentId },
        modifiedBy,
    });
    for (const updateItem of updateItems) {
        const updated = await jobsService.update(updateItem);
        if (!updated) {
            jsonLogger.error({ type: "TRACKING", function: "jobs::innerSign", message: 'Error to update item', updateItem });
            return null;
        }
    }
    await updateCompanyProvider(companyId, entityId, updateTalentId, modifiedBy, userId, jobId, providerEmail, isHireCandidate, legalDocumentsToSend);

    const result = {
        isMissingUserBudget,
        isMissingCompanyBudget,
        isJobRequest: itemStatus === constants.job.status.jobRequest,
    };

    jsonLogger.info({ type: "TRACKING", function: "jobs::innerSign", message: 'Finish update all relevant items', result });
    return result;
}

const resolveHiredBy = async (companyId, userId, hiringManagerId) => {
    const { role } = await usersService.getCompanyUsersData(userId, companyId);
    let hiredBy = userId;
    if (role === constants.user.role.admin) {
        const response = await companiesService.listByUserId(process.env.gsiItemByUserIdIndexName, userId, constants.prefix.userPoolId);
        if (!response) {
            jsonLogger.error({ type: "TRACKING", function: "jobs::resolveHiredBy", message: 'Failed to retrieve the user', companyId, userId, response });
            return false;
        }
        const [userData] = response;
        hiredBy = _.get(userData, 'itemData.stokeAdmin') ? hiringManagerId : hiredBy;
    }
    jsonLogger.info({ type: "TRACKING", function: "jobs::resolveHiredBy", hiredBy });
    return hiredBy;
}

const buildInteractSns = (companyId, entityId, jobId, talentId, userId, operation) => {
    if (!talentId)
        jsonLogger.error({ type: "TRACKING", function: "jobs::buildInteractSns", message: 'missing talentId' });
    return {
        Subject: `${companyId} - Job talent interaction: ${operation}`,
        Message: { companyId, entityId, jobId, talentId, userId, operation },
        TopicArn: INTERACT_TOPIC_ARN
    }
}

const duplicateJob = async (companyId, entityId, currentJob, providerItemId, userId, isHireAndKeepOpen) => {
    let isPostedJobDuplicated = false;
    const newJobItemData = {
        // eslint-disable-next-line no-shadow
        ..._.omitBy(currentJob.itemData, (_, key) => ['bids', 'jobHireData', 'draftMilestones', 'talentId', 'providerId'].includes(key)),
        budgetPerMilestone: 0,
        hourlyBudget: 0,
        weeklyBudget: 0,
        monthlyBudget: 0,
        totalBudget: 0,
        recurringPeriods: 1,
        jobDuplicated: { from: currentJob.itemId }
    };

    const newItemId = createItemId(constants.prefix.job);
    const jobFiles = _.get(currentJob, 'itemData.files', []);
    if (_.size(jobFiles)) {
        newJobItemData.files = await moveJobFiles(
            jobFiles,
            companyId,
            entityId,
            currentJob.userId,
            entityId,
            currentJob.userId,
            newItemId,
        );
    }

    if (isHireAndKeepOpen) {
        let talentIds = _.get(currentJob, 'itemData.talentIds');
        talentIds = Array.isArray(talentIds) ? talentIds : _.get(_(talentIds).value(), 'values')
        talentIds = _.filter(talentIds, (value) => value !== providerItemId);
        newJobItemData.talentIds = talentIds
        newJobItemData.isHiredAndKeptOpen = true;
    }

    let createdJob = await innerCreateJob(companyId, entityId, currentJob.userId, userId, newJobItemData, currentJob.itemStatus, currentJob.tags, newItemId);
    if (createdJob) {
        let jobBids = _.get(currentJob, 'itemData.bids');
        if (_.size(jobBids)) {
            jobBids = Array.isArray(jobBids) ? jobBids : _.get(_(jobBids).value(), 'values')
            jobBids = _.filter(jobBids, (value) => value !== `${currentJob.itemId}_${providerItemId}`);
            createdJob = await createNewBidsAndUpdateJob(jobBids, currentJob.entityId, createdJob, userId);
        }

        jsonLogger.info({ type: "TRACKING", function: "jobs::duplicateJob", message: 'posted job cloned succesfully', originalJob: `${JSON.stringify(currentJob)}`, duplicateJob: `${JSON.stringify(createdJob)}` });
        isPostedJobDuplicated = true;
    } else {
        jsonLogger.error({ type: 'TRACKING', function: 'jobs::duplicateJob', message: 'failed to clone posted job' });
    }

    return { isPostedJobDuplicated, createdJob };
}

const changeChatAfterHire = async (job) => {
    const { companyId, itemData, itemId } = job;
    const { talentId } = itemData;
    if (!companyId || !talentId) {
        jsonLogger.info({ type: "TRACKING", function: "companyProvidersProcessor::changeChatAfterHire", companyId, itemId, message: 'one or more of this values is missing (companyId, itemId,  externalUserId), changing candidate chat has failed' });
        return;
    }
    const companyProviderId = idConverterLib.getProviderIdFromTalentId(talentId);
    const { externalUserId } = await companyProvidersService.get(companyId, companyProviderId) || {};
    const extractedTalentUserId = idConverterLib.getProviderUserIdFromExternalUserId(externalUserId);
    let result = null;
    if (extractedTalentUserId) {
        const talkJsTalent = await chatService.getUser(extractedTalentUserId);
        if (!talkJsTalent) {
            const talentDetails = await getTalentDetails(companyId, talentId);
            const { talentUserId, talentFullName, talentEmail } = talentDetails;
            const talentInboxUrl = `${TALENT_URL_DOMAIN}/chat`
            // eslint-disable-next-line no-undefined
            result = await chatService.createOrUpdateUser(talentUserId, talentFullName, talentEmail, chatRole.Talent, undefined, undefined, undefined, { talentInboxUrl });
        }
        result = await chatService.changeCandidateChatAfterHiring(talentId, companyId, stage, itemId, extractedTalentUserId);
    } else {
        result = await chatService.changeCandidateChatAfterHiring(talentId, companyId, stage, itemId);
    }
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersProcessor::changeChatAfterHire", message: `changing candidate chat has ${result ? 'succeeded' : 'failed'}` });
}

const triggerEmailForNonChosenTalents = async (emailType, currentJob, companyId, entityId, jobId, chosenTalentId) => {
    let jobBids = _.get(currentJob, 'itemData.bids', []);
    jobBids = Array.isArray(jobBids) ? jobBids : _.get(_(jobBids).value(), 'values');

    // eslint-disable-next-line newline-per-chained-call
    const remainingTalents = _.chain(jobBids).map(bid => getTalentIdFromBidId(bid)).filter(talentId => talentId !== chosenTalentId).value();
    jsonLogger.info({ type: "TRACKING", function: "jobs::triggerEmailForNonChosenTalents", msg: 'send email to remaining talents', remainingTalents, currentJob });
    const taskData = {
        companyId,
        entityId,
        jobId,
        remainingTalents,
        jobTitle: _.get(currentJob, 'itemData.jobTitle', '')
    }
    try {
        await asyncTasksQueue.sendMessage({ taskData, type: emailType });
    } catch (e) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobs::triggerEmailForNonChosenTalents', text: `exception - ${e.message}`, e });
    }
}

// eslint-disable-next-line max-lines-per-function
const innerHireTalent = async ({ userRole, itemId, jobId, userId, entityId, companyId, providerEmail, itemData, milestones, isKeepPostedJobOpen, isPostJobMovedAndKeepOpen }) => {
    const legalDocumentsToSend = _.get(itemData, 'legalDocuments');

    // send sns
    const interactNotification = await buildInteractSns(companyId, entityId, jobId, itemId, userId, constants.message.type.hire);
    jsonLogger.info({ type: "TRACKING", function: "jobs::innerHireTalent", operation: constants.message.type.hire, interactNotification });
    await snsLib.publish(interactNotification.TopicArn, interactNotification.Subject, interactNotification.Message);

    let currentItemData = itemData;
    const currentJob = await jobsService.get(entityId, jobId);
    if (
        !currentJob || ![
            constants.job.status.budgetRequest,
            constants.job.status.autoDraft,
            constants.job.status.draft,
            constants.job.status.posted,
            constants.job.status.pending
        ].includes(currentJob.itemStatus)
    ) {
        jsonLogger.error({ type: "TRACKING", function: "jobs::innerHireTalent", message: "job not exist or on wrong status", job: currentJob });
        return responseLib.failure({ status: false });
    }

    jsonLogger.info({ type: "TRACKING", function: "jobs::innerHireTalent", currentJob });

    if (isNotAllowToEditJob(userRole, userId, currentJob.userId)) {
        return responseLib.forbidden({ status: false });
    }

    const hiredBy = await resolveHiredBy(companyId, userId, currentJob.userId);
    if (!hiredBy) {
        return responseLib.failure({ status: false });
    }

    if (!currentItemData) {
        currentItemData = currentJob.itemData;
    }

    const { isPostedJobDuplicated, createdJob } = isKeepPostedJobOpen ? await duplicateJob(companyId, entityId, currentJob, itemId, userId, true) : false;
    if (isPostedJobDuplicated) {
        const jobDuplicationReference = _.get(currentJob, 'itemData.jobDuplicated', {});
        currentItemData.jobDuplicated = { ...jobDuplicationReference, to: createdJob.itemId }

        if (isJobOffer(currentJob)) {
            const taskData = {
                oldEntityId: currentJob.entityId,
                oldItemId: currentJob.itemId,
                oldUserId: currentJob.userId,
                newEntityId: createdJob.entityId,
                newItemId: createdJob.itemId,
                newUserId: createdJob.userId,
                idToRemoveFromBids: itemId,
                type: constants.offerTalentActionTypes.moveJob
            };
            await asyncTasksQueue.sendMessage({ taskData, type: constants.sqsAsyncTasks.types.offerTalentUpdate });
        }
    }

    let isHireCandidate = false
    if ((currentJob.itemData.jobFlow === constants.jobFlow.post && currentJob.itemStatus === constants.job.status.pending) || (isKeepPostedJobOpen || isPostJobMovedAndKeepOpen)) {
        isHireCandidate = true
    }

    if (currentJob.itemData.jobFlow === constants.jobFlow.post && currentJob.itemData.jobHireData) {
        currentItemData.jobFlow = constants.jobFlow.start
        await changeChatAfterHire(currentJob);
    }

    if (currentJob.itemData.jobFlow === constants.jobFlow.offer) {
        currentItemData.jobFlow = constants.jobFlow.start
    }

    if (!isKeepPostedJobOpen && !isPostJobMovedAndKeepOpen) {
        if (currentJob.itemData.baseJobFlow === constants.jobFlow.offer) {
            await triggerEmailForNonChosenTalents(constants.sqsAsyncTasks.types.offerJobNotAvailable, currentJob, companyId, entityId, jobId, itemId);
            await asyncTasksQueue.sendMessage({ taskData: { entityId: currentJob.entityId, itemId: currentJob.itemId, userId: currentJob.userId, type: constants.offerTalentActionTypes.archiveJob }, type: constants.sqsAsyncTasks.types.offerTalentUpdate });
        }
        if (currentJob.itemData.baseJobFlow === constants.jobFlow.post && currentJob.itemStatus === constants.job.status.pending) {
            await triggerEmailForNonChosenTalents(constants.sqsAsyncTasks.types.bidOppourtunityClosed, currentJob, companyId, entityId, jobId, itemId);
        }
    }

    const result = await innerSign(companyId, entityId, currentItemData, jobId, currentJob.userId, hiredBy, itemId, milestones, providerEmail, isHireCandidate, legalDocumentsToSend);
    return { ...result, isKeepPostedJobOpen, isPostedJobDuplicated, isPostJobMovedAndKeepOpen }
}

/**
 * hireTalentAndActivateJob - add contract to the job and adds the talent to company's talents (or updates its data
 * if was already hired by the company in the past)
 * @param {Object} event - event
 * @param {Object} context - context
 * @returns {object} results
 */
// eslint-disable-next-line max-lines-per-function
const hireTalentAndActivateJob = async (event, context) => {

    const data = JSON.parse(event.body);
    const { entityId, itemId, providerEmail, companyId, itemData, milestones, isKeepPostedJobOpen, isPostJobMovedAndKeepOpen } = data;
    const jobId = event.pathParameters.id;

    const userId = event.requestContext.identity.cognitoIdentityId;

    jsonLogger.info({
        type: "TRACKING",
        function: "jobs::hireTalentAndActivateJob",
        functionName: context.functionName, awsRequestId: context.awsRequestId,
        jobId, userId, entityId, itemId, event, milestones, providerEmail, isKeepPostedJobOpen, isPostJobMovedAndKeepOpen
    });

    const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, null, { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } });
    if (!authorised) {
        return responseLib.forbidden({ status: false });
    }

    const result = await innerHireTalent({ userRole: authorised.itemData.userRole, itemId, jobId, userId, entityId, companyId, providerEmail, itemData, milestones, isKeepPostedJobOpen, isPostJobMovedAndKeepOpen })

    return result ? responseLib.success(result) : responseLib.failure({ status: false });
}

// eslint-disable-next-line complexity
const innerUpdateJob = async (itemId, userId, entityId, itemStatus, itemData, jobSnsOperation, talentId, isKeepPostedJobOpen, message, duplicatedFrom, resendTalentIds) => {
    jsonLogger.info({
        type: "TRACKING",
        function: "jobs::innerUpdateJob",
        itemId,
        userId,
        entityId,
        itemData,
        itemStatus,
        talentId,
        jobSnsOperation,
        isKeepPostedJobOpen,
        duplicatedFrom,
        resendTalentIds
    });

    const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, null, { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } });
    if (!authorised)
        return forbidden;

    const currentJob = await jobsService.get(entityId, itemId);

    if (!currentJob) {
        return false;
    }

    if (isNotAllowToEditJob(authorised.itemData.userRole, userId, currentJob.userId)) {
        return forbidden;
    }
    const jobCurrentNewItemData = itemData || currentJob.itemData;
    const isItemMilestone = prefixLib.isMilestone(itemId);
    const isResendFlow = !_.isEmpty(resendTalentIds)

    if (isResendFlow) {
        jsonLogger.info({ type: "TRACKING", function: "jobs::innerUpdateJob", message: 'resend mail flow - dispatch asyncTasksQueue and return', entityId, jobId: itemId });
        asyncTasksQueue.sendMessage({ taskData: { entityId, jobId: itemId, resendTalentIds }, type: constants.sqsAsyncTasks.types.talentJobOffer });
        return true;
    }

    const talentIds = _.get(itemData, 'talentIds') || [];

    if (itemStatus === constants.job.status.pending && !isItemMilestone && currentJob.itemData.jobFlow === constants.jobFlow.offer && talentIds.length) {
        let existBidIds = _.get(itemData, 'bids') || [];
        let companyProvidersKeys = []
        const isInitialSet = currentJob.itemStatus === constants.job.status.initial
        
        jsonLogger.info({ type: "TRACKING", function: "jobs::innerUpdateJob", message: 'handle offer job', isInitialSet, currentJob, itemStatus });
        if (isInitialSet) {
            companyProvidersKeys = talentIds.map(((bidId) => ({ companyId: authorised.companyId, itemId: bidId })));
        } else if (talentIds.length !== existBidIds.length) {
            const bidsTalentsIds = existBidIds.map((bidId) => getTalentIdFromBidId(bidId))
            companyProvidersKeys = talentIds.
                filter((jobTalentId) => !bidsTalentsIds.includes(jobTalentId)).
                map((jobTalentId) => ({ companyId: authorised.companyId, itemId: jobTalentId }))
        }

        if (itemStatus === currentJob.itemStatus && itemData !== currentJob.itemData) {
            await asyncTasksQueue.sendMessage({ taskData: { entityId, itemId, userId, itemData, type: constants.offerTalentActionTypes.itemDataUpdate }, type: constants.sqsAsyncTasks.types.offerTalentUpdate });
        }

        if (companyProvidersKeys.length) {
            const companyProviders = await dynamoDbUtils.batchGetParallel(companyProvidersTableName, companyProvidersKeys, constants.projectionExpression.defaultAndTagsAttributes);
            const bidsToCreate = companyProviders.map((companyProvider) => {
                const talentProfileReviews = _.get(companyProvider, 'itemData.talentProfileReviews');
                const numberOfReviews = _.size(talentProfileReviews)
                const averageRating = Math.round(_.meanBy(talentProfileReviews, 'rating') * 100) / 100
                const { fullName } = personalInfoLib.getCompanyProviderPersonalInfo(companyProvider);
                const candidate = {
                    itemId: companyProvider.itemId,
                    name: fullName,
                    img: _.get(companyProvider, 'itemData.img'),
                    title: _.get(companyProvider, 'itemData.talentProfileData.jobTitle'),
                    ...(averageRating && { averageRating, numberOfReviews }),
                }
                return ({
                    userId,
                    entityId,
                    itemId: `${itemId}_${companyProvider.itemId}`,
                    createdBy: userId,
                    modifiedBy: userId,
                    itemData: {
                        jobId: itemId,
                        existingTalent: true,
                        candidate,
                    }
                })
            });
            const createBidResult = await bidsService.batchCreate(bidsToCreate);
            if (!createBidResult) {
                return false;
            }
            const bids = companyProviders.map((companyProvider) => `${itemId}_${companyProvider.itemId}`)

            itemData.bids = documentClient.createSet([...existBidIds, ...bids]);
            
            if (bids.length && !isInitialSet) {
                asyncTasksQueue.sendMessage({ taskData: { entityId, jobId: itemId, newBids: bids }, type: constants.sqsAsyncTasks.types.talentJobOffer });
            }
        }
    }
    if (itemStatus === constants.job.status.completed && !isItemMilestone) {
        if (currentJob.itemStatus !== constants.job.status.active) {
            jsonLogger.error({
                type: "TRACKING",
                function: "jobs::innerUpdateJob",
                message: 'can complete only active job',
                currentJob
            });
            return false;
        }

        let milestones = await jobsService.list(entityId, null, `${constants.prefix.milestone}${itemId}`);

        const archivedStatusesInCompletedAction = [
            constants.job.status.active,
            constants.job.status.budgetRequest,
            constants.job.status.requested,
            constants.job.status.budgetDeclined,
            constants.job.status.jobRequest,
        ];

        const allowCompletedStatuses = [
            constants.job.status.completed,
            constants.job.status.paid,
        ];

        if (milestones.some((milestone) => ![...archivedStatusesInCompletedAction, ...allowCompletedStatuses].includes(milestone.itemStatus))) {
            jsonLogger.error({
                type: "TRACKING",
                function: "jobs::innerUpdateJob",
                message: `can complete only active job with milestones paid and completed statuses ${[...archivedStatusesInCompletedAction, ...allowCompletedStatuses]}`,
                currentJob
            });
            return false;
        }
        _.set(jobCurrentNewItemData, 'completeMessage', message)
        const canceledMilestones = [];
        const milestonesArchive = milestones.filter((milestone) => archivedStatusesInCompletedAction.includes(milestone.itemStatus));
        const updateItems = milestonesArchive.map((milestone) => {
            canceledMilestones.push({
                itemId: milestone.itemId,
                title: _.get(milestone, 'itemData.title', ''),
                message: _.get(milestone, 'itemData.message', ''),
                isCanceled: true,
                canceledByUser: userId,
            })
            return {
                entityId,
                itemId: milestone.itemId,
                itemStatus: constants.itemStatus.archived,
                modifiedBy: userId,
            }
        });

        _.set(jobCurrentNewItemData, 'canceledMilestones', [..._.get(jobCurrentNewItemData, 'canceledMilestones', []), ...canceledMilestones]);

        const milestoneResult = await jobsService.transactUpdate(updateItems);
        if (!milestoneResult) {
            return false;
        }
    }

    if (Object.values(constants.job.operation).includes(jobSnsOperation)) {
        switch (jobSnsOperation) {
            case constants.job.operation.hire: {
                const { companyId } = authorised;
                const interactNotification = await buildInteractSns(companyId, entityId, itemId, talentId, userId, constants.message.type.hire);
                jsonLogger.info({ type: "TRACKING", function: "jobs::updateJob", jobSnsOperation, companyId, interactNotification });
                await snsLib.publish(interactNotification.TopicArn, interactNotification.Subject, interactNotification.Message);
                break;
            }
            case constants.job.operation.updatePostedJob:
                await snsLib.publish(process.env.jobSNSTopicArn, constants.job.operation.updatePostedJob, { userId, entityId, companyId: authorised.companyId, itemId });
                jsonLogger.info({ type: "TRACKING", function: "jobs::updateJob", jobSnsOperation });
                break;

            default:
                jsonLogger.info({ type: "TRACKING", function: "jobs::updateJob", jobSnsOperation, message: 'the sns message is not defined for the given operation' });
                break;
        }
    }
    const { isPostedJobDuplicated, createdJob } = isKeepPostedJobOpen ? await duplicateJob(currentJob.companyId, entityId, currentJob, talentId, userId) : false;
    if (isPostedJobDuplicated) {
        const jobDuplicationReference = _.get(currentJob, 'itemData.jobDuplicated', {});
        jobCurrentNewItemData.jobDuplicated = { ...jobDuplicationReference, to: createdJob.itemId }
        jsonLogger.info({ type: "TRACKING", function: "jobs::innerUpdateJob", isPostedJobDuplicated, newJobId: createdJob.itemId });
        
    }
    if (currentJob.itemData.jobFlow === constants.jobFlow.post && itemStatus === constants.job.status.pending && talentId) {
        _.set(jobCurrentNewItemData, 'bids', [`${currentJob.itemId}_${talentId}`])
    }

    if (isKeepPostedJobOpen && duplicatedFrom && prefixLib.isJob(duplicatedFrom.itemId) && currentJob.itemData.jobFlow === constants.jobFlow.post) {
        const originalJob = await jobsService.get(duplicatedFrom.entityId, duplicatedFrom.itemId, true);
        const originalBids = _.get(originalJob, 'itemData.bids');
        if (_.size(originalBids)) {
            const bids = await createNewBidsAndUpdateJob(originalBids, duplicatedFrom.entityId, currentJob, userId, true, true);
            jobCurrentNewItemData.bids = bids;
            jobCurrentNewItemData.jobDuplicated = { from: duplicatedFrom.itemId }
        }
    }

    // this data is not sent by the client on edit job
    if (currentJob.itemData.archivedLinks) {
        jobCurrentNewItemData.archivedLinks = currentJob.itemData.archivedLinks;
    }
    if (currentJob.itemData.jobMovedData) {
        jobCurrentNewItemData.jobMovedData = currentJob.itemData.jobMovedData;
    }

    const result = await updateJobInner(userId, entityId, itemId, jobCurrentNewItemData, authorised.companyId, itemStatus);
    return { ...result, isKeepPostedJobOpen, isPostedJobDuplicated };
}

/**
 * updateJob - updates a job's data
 * @param {Object} event - event
 * @param {Object} context - context
 * @returns {object} results
 */
// eslint-disable-next-line complexity
const updateJob = async (event, context) => {
    const body = JSON.parse(event.body);
    const userId = event.requestContext.identity.cognitoIdentityId;
    const itemId = _.get(event.pathParameters, 'id');
    const isBulkAction = Array.isArray(body) && !itemId
    const dataArray = isBulkAction ? body : [body]

    let results = []
    for (const data of dataArray) {
        const { itemId: jobId, entityId, itemStatus, itemData, jobSnsOperation, talentId, isKeepPostedJobOpen, message, duplicatedFrom, resendTalentIds } = data;
        jsonLogger.info({
            type: "TRACKING",
            function: "jobs::updateJob",
            functionName: context.functionName,
            awsRequestId: context.awsRequestId,
            userId,
            entityId,
            itemId,
            data,
            resendTalentIds
        });

        results.push(innerUpdateJob(itemId || jobId, userId, entityId, itemStatus, itemData, jobSnsOperation, talentId, isKeepPostedJobOpen, message, duplicatedFrom, resendTalentIds))
    }
    results = await Promise.all(results)

    if (results.some(res => res && res !== forbidden)) {
        return responseLib.success(isBulkAction ? results : results[0])
    }
    return results.every(res => res === forbidden)
        ? responseLib.forbidden({ status: false })
        : responseLib.failure({ status: false })
}

const innerArchiveJob = async (userId, itemId, entityId, companyId) => {
    if (!entityId || !itemId) {
        return false;
    }

    const role = await usersService.getUserAuthRoleWithComponents(userId, entityId, { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } });
    if (role === constants.user.role.unauthorised) {
        return forbidden;
    }

    const job = await jobsService.get(entityId, itemId);
    if (!job) {
        jsonLogger.error({
            type: "TRACKING",
            function: "jobs::innerArchiveJob",
            job,
            message: "Job not exist"
        });
        return false;
    }

    if (isNotAllowToEditJob(role, userId, job.userId)) {
        return forbidden;
    }

    const notAllowArchiveStatusJob = [
        constants.job.status.pendingApproval,
        constants.job.status.completed,
        constants.job.status.paid,
        constants.job.status.overageBudgetRequest,
        constants.job.status.secondApproval
    ];

    if (notAllowArchiveStatusJob.includes(job.itemStatus)) {
        jsonLogger.error({
            type: "TRACKING",
            function: "jobs::innerArchiveJob",
            job,
            message: "Cant remove job"
        });
        return false;
    }

    let milestones = []
    if (!prefixLib.isMilestone(itemId)) {
        milestones = await jobsService.list(entityId, null, `${constants.prefix.milestone}${itemId}_`);
        if (!milestones || milestones.some((milestone) => notAllowArchiveStatusJob.includes(milestone.itemStatus))) {
            jsonLogger.error({
                type: "TRACKING",
                function: "jobs::innerArchiveJob",
                job,
                milestones,
                message: "Can't remove job"
            });
            return false;
        }
    }

    let updateItems = [
        {
            entityId,
            itemId,
            itemStatus: constants.itemStatus.archived,
            modifiedBy: userId,
        }
    ]

    updateItems = updateItems.concat(milestones.map((milestone) => ({
        entityId,
        itemId: milestone.itemId,
        itemStatus: constants.itemStatus.archived,
        modifiedBy: userId,
    })));

    if (job.itemStatus === constants.job.status.pending) {
        const emailType = _.get(job, 'itemData.baseJobFlow') === constants.jobFlow.offer ? constants.sqsAsyncTasks.types.offerJobNotAvailable : constants.sqsAsyncTasks.types.bidOppourtunityClosed;
        await triggerEmailForNonChosenTalents(emailType, job, companyId, entityId, itemId);
        await asyncTasksQueue.sendMessage({ taskData: { entityId, itemId, userId: job.userId, type: constants.offerTalentActionTypes.archiveJob }, type: constants.sqsAsyncTasks.types.offerTalentUpdate });
    }   

    return jobsService.transactUpdate(updateItems);
}

const archiveJob = async (event, context) => {
    const data = JSON.parse(event.body);
    const userId = event.requestContext.identity.cognitoIdentityId;
    const itemId = _.get(event.pathParameters, 'id');
    const { ids, entityId, companyId } = data;

    jsonLogger.info({
        type: "TRACKING",
        function: "jobs::archiveJob",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        userId,
        companyId,
        entityId,
        itemId,
        ids,
        data,
    });

    let results = []
    for (const item of ids || [{ itemId, entityId }]) {
        const result = innerArchiveJob(userId, item.itemId, item.entityId, companyId)
        results.push(result)
    }
    results = await Promise.all(results)

    if (results.some(res => res && res !== forbidden)) {
        return responseLib.success({ status: true })
    }

    return results.every(res => res === forbidden)
        ? responseLib.forbidden({ status: false })
        : responseLib.failure({ status: false })
}

module.exports = {
    createJob,
    hireTalentAndActivateJob,
    createMilestones,
    innerCreateJob,
    updateJob,
    archiveJob,
    innerSign,
    innerUpdateJob,
    updateJobInner,
    innerCreateMilestones,
    setMilestoneBasicDetails,
    milestonesCreation,
    duplicateJob,
    innerHireTalent,
    updateCompanyProvider
}
