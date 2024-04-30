/* eslint-disable max-lines */
/* eslint-disable no-undefined */
/* eslint-disable no-magic-numbers */
/* eslint-disable prefer-destructuring */
/* eslint-disable max-lines-per-function */
/* eslint-disable multiline-comment-style */

'use strict';

const _ = require('lodash');

const {
    constants, jsonLogger, responseLib,
    CompanyProvidersService, UsersService,
    JobsService, CompaniesService, idConverterLib, permisionConstants
} = require('stoke-app-common-api');
const { ChatService, oneOnOneId, getListsOfParticipants, role: chatRole, BASIC_PARTICIPANTS_SIZE } = require('stoke-chat-api');
const { getExternalCandidateDetails } = require('./talentCloud/utils');
const { sendSNS } = require('./helpers/utils');
const { isTalentLakeEnabledForCompany } = require('./talentCloud/getCandidates');
const { getTalentFromTalentLake } = require('./talentCloud/searchTalents');

const {
    jobsTableName,
    consumerAuthTableName,
    companyProvidersTableName,
    customersTableName,
    TALKJS_APP_ID,
    TALKJS_API_KEY,
    CONSUMER_URL_DOMAIN,
    TALENT_URL_DOMAIN,
} = process.env;

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAttributesAndExternalUserId, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const chatService = new ChatService(TALKJS_APP_ID, TALKJS_API_KEY);

// eslint-disable-next-line valid-jsdoc
/**
 * return the details of the talent by the talentId,
 */
const getTalentDetails = async (companyId, talentId) => {
    const companyProviderId = idConverterLib.getProviderIdFromTalentId(talentId);
    const companyProvider = await companyProvidersService.get(companyId, companyProviderId);
    if (!companyProvider) {
        jsonLogger.error({ type: "TRACKING", function: "chat::getTalentDetails", message: 'Failed to retrieve companyProvider' });
        return null;
    }
    const { itemStatus, externalUserId } = companyProvider;
    const companyProviderItemData = _.get(companyProvider, 'itemData', {});
    const { isProviderSelfEmployedTalent, providerName, providerEmail } = companyProviderItemData;

    let isInvitedTalent = [constants.companyProvider.status.invited, constants.companyProvider.status.notInvited, constants.companyProvider.status.enrolled].includes(itemStatus);
    const isRegisteredTalent = [constants.companyProvider.status.registered, constants.companyProvider.status.active].includes(itemStatus);
    if (!isRegisteredTalent && !isInvitedTalent) {
        jsonLogger.error({ type: "TRACKING", function: "chat::getTalentDetails", itemStatus, message: 'conversation can be created only with invited or registered or active talent' });
        return null;
    }
    if (isProviderSelfEmployedTalent) {
        const providerUserId = idConverterLib.getProviderUserIdFromExternalUserId(externalUserId) 
        const talentUserId = isInvitedTalent ? talentId : providerUserId;
        isInvitedTalent = isInvitedTalent.toString();
        jsonLogger.info({ type: "TRACKING", function: "chat::getTalentDetails", externalUserId, providerUserId, talentUserId, isInvitedTalent });
        return { talentUserId, talentFullName: providerName, talentEmail: providerEmail, isInvitedTalent };
    }

    const talentCompanyProvider = await companyProvidersService.get(companyId, talentId);
    if (!talentCompanyProvider) {
        jsonLogger.error({ type: "TRACKING", function: "chat::getTalentDetails", message: 'Failed to retrieve talentCompanyProvider' });
        return null;
    }
    const talentItemData = _.get(talentCompanyProvider, 'itemData', {});

    const { firstName: talentFirstName, lastName: talentLastName, email: talentEmail } = talentItemData;
    const talentFullName = `${talentFirstName} ${talentLastName}`;
    // when the talent under providers will have a way to use the talent app the talentUserId will need to be change to an app userId
    return { talentUserId: talentId, talentFullName, talentEmail };
}


const getHiringManagerDetails = async (hiringManagerUserId) => {
    const response = await companiesService.listByUserId(process.env.gsiItemByUserIdIndexName, hiringManagerUserId, constants.prefix.userPoolId);
    if (!response) {
        jsonLogger.error({ type: "TRACKING", function: "chat::getHiringManagerDetails", message: 'Failed to retrieve the user', hiringManagerUserId });
        return null;
    }
    const [hiringManager] = response;
    jsonLogger.info({ type: "TRACKING", function: "chat::getHiringManagerDetails", hiringManager });
    const { companyId } = hiringManager;
    const { userEmail: hiringManagerUserEmail, givenName: hmFirstName, familyName: hmLastName } = hiringManager.itemData;
    const hiringManagerFullName = `${hmFirstName} ${hmLastName}`;

    const companyData = await companiesService.get(`${constants.prefix.company}${companyId}`);
    if (!companyData) {
        jsonLogger.error({ type: "TRACKING", function: "chat::getHiringManagerDetails", message: 'Failed to retrieve the company data for the companyName', companyId });
        return null;
    }

    const companyName = _.get(companyData, 'itemData.entityName');

    return { hiringManagerFullName, hiringManagerUserEmail, companyName, companyId };
}

const updateContactList = async (itemId, entityId, contactObject) => {
    jsonLogger.info({ type: "TRACKING", function: "chat::updateContactList", params: { itemId, entityId, contactObject } });
    const key = {
        itemId,
        entityId
    }
    const updateExpression = "SET #itemData.#contactList = list_append(if_not_exists(#itemData.#contactList, :empty_array), :newContactObject), #modifiedBy = :modifiedBy";
    const expressionAttributeValues = { ':newContactObject': [contactObject], ':empty_array': [], ':modifiedBy': contactObject.userId };
    const expressionAttributeNames = { '#itemData': 'itemData', '#contactList': 'contactList', '#modifiedBy': 'modifiedBy' };
    const result = await jobsService.updateGeneric(key, updateExpression, expressionAttributeValues, expressionAttributeNames);
    jsonLogger.info({ type: "TRACKING", function: "chat::updateContactList", result });
}

/**
 * creating a talkjs session between the hirinig manager and the talent of the job
 * if the talent isProviderSelfEmployedTalent then the userId of the talkJS user will be the one that he uses to connect to the talent app (provider userId)
 * if not the userId will be the talentId and the name and email will be of the specific talent, in this case the talent wont be able to use the app chat
 * @param {Object} event - event
 * @param {Object} context - context
 * @returns {object} results
 */
// eslint-disable-next-line max-lines-per-function
const startConsumerTalentChat = async (event, context) => {
    jsonLogger.info({ type: "TRACKING", function: "chat::startConsumerTalentChat", event, context });
    const data = JSON.parse(event.body);
    const { entityId, jobId, offerTalentId } = data;

    const userId = event.requestContext.identity.cognitoIdentityId;

    if (!entityId || !jobId) {
        return responseLib.failure({ message: 'missing parameters' });
    }

    jsonLogger.info({ type: "TRACKING", function: "chat::startConsumerTalentChat", jobId, userId, entityId, offerTalentId });

    const authorised = await usersService.validateUserEntityWithComponents(userId, entityId, null, { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } });
    if (!authorised) {
        return responseLib.forbidden({ status: false });
    }

    const job = await jobsService.get(entityId, jobId);
    if (!job) {
        jsonLogger.error({ type: "TRACKING", function: "chat::startConsumerTalentChat", job, message: "Job not exist" });
        return responseLib.failure({ status: false });
    }

    const { itemData, companyId } = job;
    let { userId: hiringManagerUserId } = job;
    const { jobTitle, jobFlow } = itemData;
    const isOfferedJob = jobFlow === constants.jobFlow.offer;
    const talentIds = _.get(itemData, 'talentIds', []);
    jsonLogger.info({ type: "TRACKING", function: "chat::startConsumerTalentChat", jobTitle, companyId, hiringManagerUserId });

    // check if the user is authorized to initiate a conversation on this job (this part is different from the implementation on provider - api, there we compare the userId with the talentUserId)
    const notHiringManager = hiringManagerUserId !== userId
    if (notHiringManager) {
        hiringManagerUserId = userId;
        jsonLogger.info({ type: "TRACKING", function: "chat::startConsumerTalentChat", hiringManagerUserId, userId, message: `hiringManagerUserId !== userId, a conversation starts with this user: ${userId}` });
    }

    if (offerTalentId && isOfferedJob && !talentIds.includes(offerTalentId)) {
        jsonLogger.error({ type: "TRACKING", function: "chat::startConsumerTalentChat", talentIds, offerTalentId, message: 'jobFlow is offer but the offerTalentId is not in the talentId list' });
        return responseLib.failure({ status: false });
    }

    const talentId = isOfferedJob ? offerTalentId : _.get(itemData, 'talentId');

    jsonLogger.info({ type: "TRACKING", function: "chat::startConsumerTalentChat", jobFlow, talentId });

    let conversationId = oneOnOneId(jobId, talentId);
    if (notHiringManager) {
        conversationId = oneOnOneId(conversationId, hiringManagerUserId);
    }
    const conversationExist = await chatService.conversationExist(conversationId);
    jsonLogger.info({ type: "TRACKING", function: "chat::startConsumerTalentChat", conversationId, conversationExist, jobId, talentId });

    if (conversationExist) {
        const contactList = _.get(job, 'itemData.contactList', []);
        const isConversationExistInContactList = _.find(contactList, (contact) => contact.conversationId === conversationId);
        if (!isConversationExistInContactList) {
            const contactObject = {
                userId: hiringManagerUserId,
                candidate: talentId,
                date: Date.now(),
                jobId,
                conversationId
            }
            await updateContactList(jobId, entityId, contactObject);
        }
        jsonLogger.info({ type: "TRACKING", function: "chat::startConsumerTalentChat", message: `chat room already created, conversationId: ${conversationId}` });
        return responseLib.success({ conversationId });
    }

    const talentDetails = await getTalentDetails(companyId, talentId);
    if (!talentDetails) {
        jsonLogger.error({ type: "TRACKING", function: "chat::startConsumerTalentChat", message: `can't get talentDetails` });
        return responseLib.failure({ status: false });
    }
    const { talentUserId, talentFullName, talentEmail } = talentDetails;
    jsonLogger.info({ type: "TRACKING", function: "chat::startConsumerTalentChat", talentUserId, talentFullName, talentEmail });

    const hiringManagerDetails = await getHiringManagerDetails(hiringManagerUserId);
    if (!hiringManagerDetails) {
        jsonLogger.error({ type: "TRACKING", function: "chat::startConsumerTalentChat", message: `can't get hiringManagerDetails or companyName` });
        return responseLib.failure({ status: false });
    }
    const { hiringManagerFullName, hiringManagerUserEmail, companyName } = hiringManagerDetails;

    jsonLogger.info({ type: "TRACKING", function: "chat::startConsumerTalentChat", hiringManagerFullName, hiringManagerUserEmail, companyName, CONSUMER_URL_DOMAIN, TALENT_URL_DOMAIN });

    const result = await chatService.createConsumerTalentChatRoom(conversationId, hiringManagerUserId, hiringManagerFullName, hiringManagerUserEmail, talentUserId, talentFullName, talentEmail, jobId, entityId, jobTitle, companyId, companyName, CONSUMER_URL_DOMAIN, TALENT_URL_DOMAIN, undefined, isOfferedJob && idConverterLib.getOfferTalentJobId(jobId, talentId));
    const success = result === conversationId;
    if (success) {
        const contactObject = {
            userId: hiringManagerUserId,
            candidate: talentId,
            date: Date.now(),
            jobId,
            conversationId
        }
        await updateContactList(jobId, entityId, contactObject);
    }
    const message = success ? `chat room created, conversationId: ${conversationId}` : 'failed to create chat room';
    jsonLogger.info({ type: "TRACKING", function: "chat::startConsumerTalentChat", message, result, conversationId });
    return success ? responseLib.success({ conversationId }) : responseLib.failure({ status: false });
}

const getParticipantsList = async (event, context) => {
    jsonLogger.info({ type: "TRACKING", function: "chat::getParticipantsList", event, context });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const conversationId = event.pathParameters.id;

    jsonLogger.info({ type: "TRACKING", function: "chat::getParticipantsList", userId, conversationId });

    if (!conversationId) {
        jsonLogger.info({ type: "TRACKING", function: "chat::getParticipantsList", message: 'missing conversationId' });
        return responseLib.failure({ message: 'missing parameters' });
    }

    const conversation = await chatService.getConversation(conversationId);
    if (!conversation) {
        jsonLogger.info({ type: "TRACKING", function: "chat::getParticipantsList", message: 'conversation not exist' });
        return responseLib.failure({ message: 'conversation not exist' });
    }

    const { companyId } = conversation.custom;

    const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.jobs]: {} })
    if (role === constants.user.role.unauthorised) {
        jsonLogger.info({ type: "TRACKING", function: "chat::getParticipantsList", message: 'user is not authorised' });
        return responseLib.forbidden({ status: false });
    }

    const { allParticipants, basicParticipants } = getListsOfParticipants(conversation);
    if (basicParticipants.length !== BASIC_PARTICIPANTS_SIZE) {
        jsonLogger.info({ type: "TRACKING", function: "chat::getParticipantsList", message: 'missing basic participants' });
        return responseLib.failure({ message: 'missing basic participants' });
    }

    const companyUsers = await companiesService.listAllCompanyUsers(process.env.gsiItemsByCompanyIdIndexName, companyId, constants.itemStatus.active, true);

    const inviteableUsers = companyUsers.filter(user => !allParticipants.includes(user.userId)).map(user => ({
        givenName: user.itemData.givenName,
        familyName: user.itemData.familyName,
        userEmail: user.itemData.userEmail,
        role: user.itemData.role,
        userId: user.userId
    }));

    jsonLogger.info({ type: "TRACKING", function: "chat::getParticipantsList", inviteableUsers });

    return responseLib.success({ inviteableUsers });
}

const registerAndJoinConversation = async (conversationId, participentUserId) => {
    // eslint-disable-next-line no-await-in-loop
    const talkJsUser = await chatService.userExist(participentUserId);
    const consumerInboxUrl = `${CONSUMER_URL_DOMAIN}/chat`;
    jsonLogger.info({ type: "TRACKING", function: "chat::registerAndJoinConversation", istalkJsUser: Boolean(talkJsUser) });
    if (!talkJsUser) {
        // eslint-disable-next-line no-await-in-loop
        const userDetails = await getHiringManagerDetails(participentUserId);
        if (!userDetails) {
            jsonLogger.error({ type: "TRACKING", function: "chat::registerAndJoinConversation", message: `can't get user or companyName details` });
            // eslint-disable-next-line no-continue
            return;
        }
        const { hiringManagerFullName, hiringManagerUserEmail } = userDetails;
        // eslint-disable-next-line no-await-in-loop 
        await chatService.createOrUpdateUser(participentUserId, hiringManagerFullName, hiringManagerUserEmail, chatRole.Consumer, undefined, undefined, undefined, { consumerInboxUrl });
    }
    // eslint-disable-next-line no-await-in-loop
    const userJoined = await chatService.joinConversation(conversationId, participentUserId, true);
    // eslint-disable-next-line consistent-return
    return Boolean(userJoined);
}

const changeChatParticipantsList = async (event, context) => {
    jsonLogger.info({ type: "TRACKING", function: "chat::changeChatParticipantsList", event, context });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const conversationId = event.pathParameters.id;
    const data = JSON.parse(event.body);
    const { participentsList } = data;

    jsonLogger.info({ type: "TRACKING", function: "chat::changeChatParticipantsList", userId, conversationId, participentsList });

    if (!conversationId || !participentsList || participentsList.length === 0) {
        jsonLogger.info({ type: "TRACKING", function: "chat::changeChatParticipantsList", message: 'missing parameters' });
        return responseLib.failure({ message: 'missing parameters' });
    }

    const conversation = await chatService.getConversation(conversationId);

    if (!conversation) {
        jsonLogger.info({ type: "TRACKING", function: "chat::changeChatParticipantsList", message: 'conversation not exist' });
        return responseLib.failure({ message: 'conversation not exist' });
    }

    const { companyId } = conversation.custom;

    const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.jobs]: {} })
    if (role === constants.user.role.unauthorised) {
        jsonLogger.info({ type: "TRACKING", function: "chat::changeChatParticipantsList", message: 'user is not authorised' });
        return responseLib.forbidden({ status: false });
    }

    const { allParticipants, basicParticipants } = getListsOfParticipants(conversation);
    if (basicParticipants.length !== BASIC_PARTICIPANTS_SIZE) {
        jsonLogger.info({ type: "TRACKING", function: "chat::changeChatParticipantsList", message: 'missing basic participants' });
        return responseLib.failure({ message: 'missing basic participants' });
    }

    const joinedParticipants = [];
    for (const participentUserId of participentsList) {
        if (allParticipants.includes(participentUserId)) {
            jsonLogger.info({ type: "TRACKING", function: "chat::changeChatParticipantsList", message: `userId: ${participentUserId} already in the conversation` });
            // eslint-disable-next-line no-continue
            continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const result = await registerAndJoinConversation(conversationId, participentUserId);
        if (result) {
            joinedParticipants.push(participentUserId);
            jsonLogger.info({ type: "TRACKING", function: "chat::changeChatParticipantsList", message: `userId: ${participentUserId} joined the conversation` });

        }
    }
    jsonLogger.info({ type: "TRACKING", function: "chat::changeChatParticipantsList", joinedParticipants });
    return responseLib.success();
}

/**
 * @param {Object} event - get talentId and isCompanyGroupChat from the body params
 * @returns {object} results - conversationId for authorised user and error message for unauthorised user or other inner errors
 */
// eslint-disable-next-line max-lines-per-function
const startOneOnOneConsumerTalentChat = async (event) => {
    jsonLogger.info({ type: "TRACKING", function: "chat::startOneOnOneConsumerTalentChat", event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body);
    const { talentId, isCompanyGroupChat, isExternalCandidate = false, jobValues = {} } = data;
    jsonLogger.info({ type: "TRACKING", function: "chat::startOneOnOneConsumerTalentChat", userId, talentId, isCompanyGroupChat, isExternalCandidate, jobValues });

    const userDetails = await getHiringManagerDetails(userId);
    const { hiringManagerFullName, hiringManagerUserEmail, companyName, companyId } = userDetails;
    const hiringManagerUserId = userId;
    const authorised = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.jobs]: {} });
    if (!authorised || authorised.role === constants.user.role.unauthorised) {
        return responseLib.forbidden({ status: false });
    }

    let talentDetails = {};
    if (isExternalCandidate) {
        if (await isTalentLakeEnabledForCompany(companyId)) {
            const talentLakeCandidate = await getTalentFromTalentLake(talentId);
            talentDetails = {
                talentUserId: talentLakeCandidate.id,
                talentFullName: talentLakeCandidate.name,
                talentEmail: talentLakeCandidate.email
            }
        } else {
            talentDetails = await getExternalCandidateDetails(talentId);
        }
    } else {
        talentDetails = await getTalentDetails(companyId, talentId);
    }

    if (_.isEmpty(talentDetails)) {
        jsonLogger.error({ type: "TRACKING", function: "chat::startOneOnOneConsumerTalentChat", message: `can't get external talent details`, talentId });
        return responseLib.failure({ status: false });
    }

    const { talentUserId, talentFullName, talentEmail, isInvitedTalent } = talentDetails;
    jsonLogger.info({ type: "TRACKING", function: "chat::startOneOnOneConsumerTalentChat", talentUserId, talentFullName, talentEmail });
    if (!talentUserId || !talentFullName || !talentEmail) {
        jsonLogger.error({ type: "TRACKING", function: "chat::startOneOnOneConsumerTalentChat", message: `missing mandatory fields` });
        return responseLib.failure({ status: false });
    }

    const conversationId = oneOnOneId(isCompanyGroupChat ? companyId : hiringManagerUserId, talentUserId);
    const conversationExist = await chatService.conversationExist(conversationId);
    jsonLogger.info({ type: "TRACKING", function: "chat::startOneOnOneConsumerTalentChat", conversationId, conversationExist, talentId });

    if (conversationExist) {
        const conversation = await chatService.getConversation(conversationId);
        const { allParticipants } = getListsOfParticipants(conversation);
        if (isCompanyGroupChat && !allParticipants.includes(hiringManagerUserId)) {
            const result = await registerAndJoinConversation(conversationId, hiringManagerUserId);
            jsonLogger.info({ type: "TRACKING", function: "chat::startOneOnOneConsumerTalentChat", message: `group chat room already created, conversationId: ${conversationId}, trying to register and join user as a member`, result });
        }
        jsonLogger.info({ type: "TRACKING", function: "chat::startOneOnOneConsumerTalentChat", message: `chat room already created, conversationId: ${conversationId}` });
        return responseLib.success({ conversationId });
    }

    jsonLogger.info({ type: "TRACKING", function: "chat::startOneOnOneConsumerTalentChat", hiringManagerFullName, hiringManagerUserEmail, companyName, CONSUMER_URL_DOMAIN, TALENT_URL_DOMAIN });
    const result = isExternalCandidate 
        ? await chatService.createGeneralConsumerExternalCandidateChatRoom(conversationId, companyId, companyName, hiringManagerUserId, hiringManagerFullName, hiringManagerUserEmail, talentUserId, talentFullName, talentEmail, talentId, CONSUMER_URL_DOMAIN, TALENT_URL_DOMAIN, jobValues)
        : await chatService.createGeneralConsumerTalentChatRoom(conversationId, companyId, companyName, hiringManagerUserId, hiringManagerFullName, hiringManagerUserEmail, talentUserId, talentFullName, talentEmail, talentId, CONSUMER_URL_DOMAIN, TALENT_URL_DOMAIN, isCompanyGroupChat, isInvitedTalent)
    const success = result === conversationId;
    if (isExternalCandidate) {
        await sendSNS(companyId, undefined, undefined, talentId, userId, `chat room created for external candidate - ${conversationId}`, true, talentFullName, talentEmail);
    }
    const message = success ? `chat room created, conversationId: ${conversationId}` : 'failed to create chat room';
    jsonLogger.info({ type: "TRACKING", function: "chat::startOneOnOneConsumerTalentChat", message, result, conversationId });
    return success ? responseLib.success({ conversationId }) : responseLib.failure({ status: false });
}

// eslint-disable-next-line max-params
const startConsumerCandidateChat = async (job, talentId, contactActionDetails, notHiringManager, isOfferJob) => {
    jsonLogger.info({ type: "TRACKING", function: "chat::startConsumerCandidateChat", job, talentId, contactActionDetails, notHiringManager, isOfferJob });
    const { companyId, itemId: jobId, entityId } = job;
    const { hiringManagerUserId, hiringManagerFullName, talentUserId, talentFullName, talentEmail, hiringManagerUserEmail, companyName, jobTitle } = contactActionDetails;

    let conversationId = oneOnOneId(jobId, talentId);
    if (notHiringManager) {
        conversationId = oneOnOneId(conversationId, hiringManagerUserId);
    }
    const conversationExist = await chatService.conversationExist(conversationId);
    let snsMessageInfo = `chat room already created, conversationId: ${conversationId}`;
    if (!conversationExist) {
        const inboxUrl = `${CONSUMER_URL_DOMAIN}/chat`;
        if (isOfferJob) {
            // eslint-disable-next-line require-atomic-updates
            conversationId = await chatService.createConsumerTalentChatRoom(conversationId, hiringManagerUserId, hiringManagerFullName, hiringManagerUserEmail, talentUserId, talentFullName, talentEmail, jobId, entityId, jobTitle, companyId, companyName, CONSUMER_URL_DOMAIN, TALENT_URL_DOMAIN);
            snsMessageInfo = `chat room created (offer job), conversationId: ${conversationId}`;
        } else {
            // eslint-disable-next-line prefer-const, require-atomic-updates
            conversationId = await chatService.createConsumerCandidateChatRoom(companyId, hiringManagerUserId, hiringManagerFullName, hiringManagerUserEmail, talentId, talentFullName, talentEmail, jobId, jobTitle, inboxUrl, companyName, entityId, undefined, notHiringManager);
            snsMessageInfo = `chat room created, conversationId: ${conversationId}`;
        }
    }

    const contactList = _.get(job, 'itemData.contactList', []);
    const isConversationExistInContactList = _.find(contactList, (contact) => contact.conversationId === conversationId);
    if (!isConversationExistInContactList) {
        const contactObject = {
            userId: hiringManagerUserId,
            candidate: talentId,
            date: Date.now(),
            jobId,
            conversationId
        }
        await updateContactList(jobId, entityId, contactObject)
    }

    jsonLogger.info({ type: "TRACKING", function: "chat::startConsumerCandidateChat", snsMessageInfo });
    return { conversationId, conversationExist, snsMessageInfo };
}

module.exports = {
    startConsumerTalentChat,
    getParticipantsList,
    changeChatParticipantsList,
    startOneOnOneConsumerTalentChat,
    startConsumerCandidateChat,
    getTalentDetails
}
