/* eslint-disable max-lines */
/* eslint-disable complexity */
/* eslint-disable max-params */
/* eslint-disable no-mixed-operators */

"use strict";

const _ = require('lodash');
const {
    SettingsService,
    UsersService,
    responseLib,
    jsonLogger,
    constants,
    formatterLib,
    dynamoDbUtils
} = require("stoke-app-common-api");
const AWS = require('aws-sdk');
const uuidv1 = require("uuid/v1");
const sns = new AWS.SNS();
const { setEntitiesSettingsOnOff, compareLegalEntityChange, manageWorkspacesInLegalEntity, DEPARTMENT_LEVEL_SETTINGS } = require('./helpers/settingsHelper');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');


const { settingsTableName, consumerAuthTableName, gsiItemsByCompanyIdAndItemIdIndexName } = process.env;
const settingsService = new SettingsService(
    settingsTableName,
    constants.projectionExpression.defaultAttributes,
    constants.attributeNames.defaultAttributes
);
const usersService = new UsersService(
    consumerAuthTableName,
    constants.projectionExpression.defaultAttributes,
    constants.attributeNames.defaultAttributes
);

const listLegalEntitiesAndDepartments = async (companyId) => {
    const legalEntitiesResults = await settingsService.listLegalEntitiesAndDepartments(gsiItemsByCompanyIdAndItemIdIndexName, companyId);
    if (!Array.isArray(legalEntitiesResults)) {
        return responseLib.failure({ status: false });
    }
    const companySettingsResponse = legalEntitiesResults.find((item) => item.itemId.startsWith(constants.prefix.company));
    const departmentsGroupedByLE = legalEntitiesResults.reduce((acc, entitySetting) => {
        if (_.get(entitySetting, 'itemData.legalEntity')) {
            acc[_.get(entitySetting, 'itemData.legalEntity.legalEntityName')] = [
                ..._.get(acc, _.get(entitySetting, 'itemData.legalEntity.legalEntityName'), []),
                entitySetting.itemId
            ]
        }
        return acc;
    }, {});
    const legalEntitiesNames = Object.keys(departmentsGroupedByLE);
    legalEntitiesNames.forEach((name) => {
        companySettingsResponse.itemData.legalEntities[name].depatmentIds = departmentsGroupedByLE[name];
    });
    return companySettingsResponse;
}

/**
 * get - get settings item
 * @public
 * @param {object} event - event.pathParameters must contain settingType (one of constants.prefix keys) and the requested id
 * @param {object} context - function request context
 * @returns {object} results
 */
module.exports.getSettings = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId, settingName, settingType, id } = event.queryStringParameters;
    jsonLogger.info({
        type: "TRACKING",
        function: "settings::getSettings",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        userId,
        companyId,
        settingType,
        id,
        event
    });

    const prefix = settingType ? constants.prefix[settingType] : null;
    if (!prefix || !companyId) {
        return responseLib.failure({ message: 'bad or missing params' });
    }

    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(userId, companyId);
    // for now only company admin can see user setting or entity setting (user himself can see his setting)
    if (role === constants.user.role.unauthorised ||
        prefix === constants.prefix.user && id !== userId && role !== constants.user.role.admin) {
        return responseLib.forbidden({ status: false });
    }

    if (prefix === constants.prefix.entity) {
        const settingsItems = [];
        // eslint-disable-next-line array-callback-return
        [...entitiesAdmin, ...entitiesUser].map((department) => {
            if (department.entityId !== companyId) {
                const settingItemId = `${prefix}${department.entityId}`;
                settingsItems.push({ itemId: settingItemId });
            }
        })
        
        const entitiesResult = await dynamoDbUtils.batchGetParallel(settingsTableName, settingsItems, constants.projectionExpression.defaultAttributes);

        return entitiesResult ? responseLib.success(entitiesResult) : responseLib.failure({ status: false });
    }

    const itemId = `${prefix}${id}`;
    const result = settingName && settingName === constants.settingTypes.legalEntities
        ? await listLegalEntitiesAndDepartments(id)
        : await settingsService.get(itemId);
    return result ? responseLib.success(result) : responseLib.failure({ status: false });
};

const isAuthorized = async (userId, companyId, type, itemId, entityId, setting) => {
    if (type === constants.prefix.entity) {
        const isUserAuthorized = await usersService.validateUserEntity(userId, entityId, constants.user.role.admin, true);
        return isUserAuthorized
    }

    const isUpdatingLegalEntites = setting.startsWith(constants.settingTypes.legalEntities) && type === constants.prefix.company

    const { role } = isUpdatingLegalEntites ? await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permissionsComponentsKeys.legal]: { isEditor: true } })
     : await usersService.getCompanyUserAuthRole(userId, companyId, true);

    if (type === constants.prefix.user) {
        return role !== constants.user.role.unauthorised && (role === constants.user.role.admin || itemId === `${constants.prefix.user}${userId}`);
    }
    return role === constants.user.role.admin;
}

const isSupportedPrefix = (prefix) => [
    constants.prefix.company,
    constants.prefix.user,
    constants.prefix.entity
].includes(prefix);

const extractLENameFromPath = (legalEntityPath) => {
    const [
        setting,
        legalEntityName
    ] = legalEntityPath.split('.') || {};
    return { setting, legalEntityName };
}

const updateLegalEntity = async (legalEntityPath, data, companyId, userId) => {
    jsonLogger.info({
        type: "TRACKING",
        function: "settings::updateLegalEntity",
        legalEntityPath, data, companyId, userId
    });
    const { legalEntityName } = extractLENameFromPath(legalEntityPath);
    const setting = await settingsService.get(`${constants.prefix.company}${companyId}`);
    const legalEntities = _.get(setting, "itemData.legalEntities", {});
    const legalEntity = legalEntityName && legalEntities[legalEntityName];
    const item = {
        itemId: `${constants.prefix.company}${companyId}`,
        data: data,
        modifiedBy: userId,
        index: gsiItemsByCompanyIdAndItemIdIndexName
    };

    if (data.isDefault) {
        const previousDefaultName = Object.keys(legalEntities).find((key) => legalEntities[key].isDefault);
        if (previousDefaultName) {
            const changeDefaultItem = {
                ..._.omit(item, 'data'),
                data: _.omit(legalEntities[previousDefaultName], 'isDefault')
            }
            await settingsService.update(changeDefaultItem, 'set', `${constants.settingTypes.legalEntities}.${previousDefaultName}`);
        }
    }

    if (!legalEntity) {
        return settingsService.update(item, 'set', `${constants.settingTypes.legalEntities}.${formatterLib.formatName(legalEntityName)}${uuidv1()}`);
    }
    return settingsService.updateLegalEntity(item, 'set', legalEntityName);
}

/**
 * update - update settings item
 * @public
 * @param {object} event - event.body holds { data, action }, where data is the new data and action is the update opeartion
 * @param {object} context - function request context
 * @returns {object} results
 */
// eslint-disable-next-line max-lines-per-function
module.exports.updateSettings = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    jsonLogger.info({
        type: "TRACKING",
        function: "settings::updateSettings",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        userId,
        event
    });

    const { data, action, companyId, scope, setting, entityId } = JSON.parse(event.body);
    if (!data || !setting) {
        return responseLib.failure({ status: false, message: 'missing mandatory parameters in the body', data, setting });
    }
    const itemIdPrefix = scope ? constants.prefix[scope] : constants.availableSettings[setting].keyPrefix;
    if (!itemIdPrefix || !isSupportedPrefix(itemIdPrefix)) {
        return responseLib.failure({ status: false, message: 'setting for this type is not supported' });
    }

    if (itemIdPrefix === constants.prefix.entity && !entityId) {
        return responseLib.failure({ status: false, message: 'setting type is entity but missing entityId' });
    }

    let result = null;

    let itemId = ''

    switch (itemIdPrefix) {
        case constants.prefix.user:
            itemId = `${itemIdPrefix}${userId}`
            break;
        case constants.prefix.entity:
            itemId = `${itemIdPrefix}${entityId}`
            break;
        default:
            itemId = `${itemIdPrefix}${companyId}`
    }

    const authorised = await isAuthorized(userId, companyId, itemIdPrefix, itemId, entityId, setting)

    if (!authorised) {
        return responseLib.forbidden({ status: false });
    }

    if (setting.startsWith(constants.settingTypes.legalEntities) && itemIdPrefix === constants.prefix.company) {
        const oldSettings = await settingsService.get(itemId)
        const isChanged = compareLegalEntityChange(data, _.get(oldSettings, `itemData.${setting}`, {}))
        jsonLogger.info({ type: 'TRACKING', function: 'settings::updateSettings', isChanged });

        result = await updateLegalEntity(setting, _.omit(data, 'workspacesIds'), companyId, userId);
        if (result && isChanged) {
            const notification = {
                Subject: 'legal entities were changed',
                Message: JSON.stringify({
                    legalEntityName: setting,
                    companyId,
                    userId,
                    files: _.map(_.get(data, "legalDocs", {}), (file, key) => ({
                        [key]: `${process.env.jobsBucketName}/${companyId}/${companyId}/${userId}/${file.s3Path}`
                    })),
                }),
                TopicArn: process.env.legalEntitiesSnsTopicArn,
            };
            try {
                const resultSns = await sns.publish(notification).promise();
                jsonLogger.info({ type: 'TRACKING', function: 'settings::updateSettings', text: 'send sns topic for legal entities', resultSns });
            } catch (e) {
                jsonLogger.error({ type: 'TRACKING', function: 'settings::updateSettings', text: `exception - ${e.message}`, e });
            }
        }

        const workspacesIds = _.get(data, 'workspacesIds')
        let manageWorkspacesResults = []

        if (result && !_.isEmpty(workspacesIds)) {
            const legalEntitiesAndDepartments = await listLegalEntitiesAndDepartments(companyId)
            const entitiesAndWorkspaces = _.get(legalEntitiesAndDepartments, 'itemData.legalEntities')

            const updatedEntityId = _.findKey(_.get(result, 'Attributes.itemData.legalEntities'), entity => entity.displayName === data.displayName)
            const updatedEntityFromDB = entitiesAndWorkspaces[updatedEntityId]

            manageWorkspacesResults = await manageWorkspacesInLegalEntity(updatedEntityFromDB, workspacesIds, entitiesAndWorkspaces, updatedEntityId, companyId, userId)
            if (manageWorkspacesResults.includes(null)) {
                jsonLogger.error({ type: 'TRACKING', function: 'settings::updateSettings', text: 'Some workspaces failed to move to desired legal entity', workspacesIds, manageWorkspacesResults });
            } else {
                jsonLogger.info({ type: 'TRACKING', function: 'settings::updateSettings', text: 'All workspaces successfully moved to desired ', manageWorkspacesResults });
            }
        }

        return result ? responseLib.success(result) : responseLib.failure({ status: false });
    }


    const settingsOn = _.get(data, 'settingsOn', [])
    const settingsOff = _.get(data, 'settingsOff', [])
    const isSettingsOnOff = !_.isEmpty(settingsOn) || !_.isEmpty(settingsOff)

    const item = {
        itemId,
        data: isSettingsOnOff ? _.omit(data, ['settingsOn', 'settingsOff']) : data,
        modifiedBy: userId,
        index: gsiItemsByCompanyIdAndItemIdIndexName
    };
    result = await settingsService.update(item, action, setting);

    if (setting === constants.settingTypes.allowTalentsToRequestPaymentSettings) {
        const itemUploadInvoicesNotifiction = {
            itemId,
            data: _.get(data, 'enabled', false),
            modifiedBy: userId,
        }
        await settingsService.update(itemUploadInvoicesNotifiction, action, constants.sqsAsyncTasks.types.uploadInvoicesNotifiction, false)
    }

    if (result && isSettingsOnOff && _.includes(DEPARTMENT_LEVEL_SETTINGS, setting) && itemIdPrefix === constants.prefix.company) {

        jsonLogger.info({ type: 'TRACKING', function: 'settings::updateSettings', text: 'Updating multiple departments' });

        result = _.concat(result, await setEntitiesSettingsOnOff(action, setting, userId, settingsOn, settingsOff))
    }

    return result ? responseLib.success(result) : responseLib.failure({ status: false });
};
