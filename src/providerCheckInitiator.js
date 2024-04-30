'use strict';

const commonApi = require('stoke-app-common-api');
const {
    companyProvidersTableName,
    authSnsTopicArn,
    consumerAuthTableName,
    customersTableName
} = process.env
const { jsonLogger, responseLib, snsLib, CompanyProvidersService, constants, idConverterLib, UsersService, CompaniesService } = commonApi;
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const _ = require('lodash');
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const AUDIT_IN_PROGRESS = 'In progress'
const SNS_MESSAGE_BY_TYPE = Object.freeze({
    background: 'Background check for user',
    audit: 'Audit check for talent'
});

const REQUEST_STATUS_BY_TYPE = Object.freeze({
    background: {
        key: 'backgroundStatusCheck',
        value: constants.talentBackgroundCheckStatus.asked
    },
    audit: {
        key: 'auditStatusCheck',
        value: constants.talentAuditCheckStatus.asked
    }
});

const handleWorkforceAudits = async (type, companyId, talentId, userId) => {
    jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::handleWorkforceAudits', checkType: type, talentId, userId, companyId });
    if (type !== 'audit') {
        return;
    }
    
    const companyProviderId = idConverterLib.getProviderIdFromTalentId(talentId);
    jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::handleWorkforceAudits', companyProviderId });
    const providerToUpdate = await companyProvidersService.get(companyId, companyProviderId)
    jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::handleWorkforceAudits', providerToUpdate });
    const audits = _.compact(_.flatten([
        providerToUpdate.itemData.workforceAudits, {
            complianceHRSentDate: "time",
            questionnairesSentDate: "time",
            id: new Date().getTime(),
            status: AUDIT_IN_PROGRESS,
            requestedBy: userId
        }
    ]))

    const companyProviderToUpdate = {
        ...providerToUpdate,
        itemData: {
            ...providerToUpdate.itemData,
            workforceAudits: audits,
        },
        modifiedBy: userId,
    };
    
    jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::handleWorkforceAudits', companyProviderToUpdate });
    await companyProvidersService.update(companyProviderToUpdate)
}

const markProvider = async (userId, companyProvider, type) => {
    jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::markProvider', id: companyProvider.itemId, checkType: type });
    const { key, value } = REQUEST_STATUS_BY_TYPE[`${type}`]
    jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::markProvider', key, value });
    
    const companyProviderToUpdate = {
        ...companyProvider,
        itemData: {
            ...companyProvider.itemData,
            [key]: value,
        },
        modifiedBy: userId,
    };
    await companyProvidersService.update(companyProviderToUpdate)
}

const processUsers = async (companyId, initiatorUser, usersToNotify, type) => {
    jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::processUsers', initiatorUser, usersToNotify, checkType: type });
    const handledIds = []
    const snsTitle = SNS_MESSAGE_BY_TYPE[`${type}`]
    jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::processUsers', snsTitle });
    await Promise.all(_.map(usersToNotify, async (user) => {
        jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::processUsers', text: `about to send SNS for: ${type}. user: ${user.itemId}` });
        await snsLib.publish(authSnsTopicArn, snsTitle, { userDetails: initiatorUser, companyId, talentId: user.itemId });
        await markProvider(initiatorUser, user, type)
        await handleWorkforceAudits(type, user.companyId, user.itemId, initiatorUser.userId)
        handledIds.push(user.itemId)
    }))

    return handledIds
}

const buildProviderObject = async (companyId, ids) => {
    jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::buildProviderObject', companyId, ids });
    let providersData = []
    try {
        const providerKeys = ids.map((id) => ({ companyId, itemId: id }))
        jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::buildProviderObject', providerKeys });
        providersData = await companyProvidersService.batchGet(providerKeys, { ignoreUnprocessedAndFlatten: true })
    } catch (e) {
        jsonLogger.error({ type: 'TRACKING', function: 'providerCheckInitiator::buildProviderObject', message: `Failed notifying check. exception - ${e.message}`, e });
    }

    return providersData
}

/**
 * handler endpoint returns providerCheckInitiator
 * @param {Object} event - event data - should include talent Ids
 * @param {Object} context - context data
 * @returns {Object} list of initiated Ids
 */
const handler = async (event) => {
    jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::handler', event });
    const data = JSON.parse(event.body);
    const { companyId, providerIds, type = 'background' } = data;

    const userId = event.requestContext.identity.cognitoIdentityId;
    jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::handler', providerIds, companyId, checkType: type });

    const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [commonApi.permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } });
    
    if (role === constants.user.role.unauthorised) {
        jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::handler', message: 'user unauthorised', userId });
        return responseLib.forbidden({ status: false, message: `must be an editor to run this action` });
    }

    if (_.isEmpty(providerIds) || !companyId) {
        return responseLib.failure({ status: false, message: `missing required params: providerIds, companyId` });
    }
    
    if (!Object.keys(SNS_MESSAGE_BY_TYPE).includes(type)) {
        return responseLib.failure({ status: false, message: `not suppurted check type: ${type}` });
    }

    
    const users = await companiesService.listByUserId(process.env.gsiItemByUserIdIndexName, userId, constants.prefix.userPoolId);
    if (_.isEmpty(users)) {
        return responseLib.failure({ status: false, message: `failed fetching user data by id: ${userId}` });
    } 
    
    jsonLogger.info({ type: 'TRACKING', function: 'providerCheckInitiator::handler', users });
    const userData = _.head(users);
    
    const userList = await buildProviderObject(companyId, providerIds)
    const results = await processUsers(companyId, userData, userList, type)

    return responseLib.success({ results });
}

module.exports = {
    handler,
};
