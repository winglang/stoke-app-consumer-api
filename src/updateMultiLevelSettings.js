/* eslint-disable guard-for-in */
/* eslint-disable no-magic-numbers */

"use strict";

const _ = require("lodash");

const {
    SettingsService,
    UsersService,
    responseLib,
    jsonLogger,
    constants,
    permisionConstants,
} = require("stoke-app-common-api");
const { setEntitiesSettingsOnOff } = require('./helpers/settingsHelper');

const { settingsTableName, gsiItemsByCompanyIdAndItemIdIndexName, gsiUsersByEntityIdIndexName } = process.env;
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const FIRSTLEVEL_KEY = 1;
const MULTI_LEVEL = "multiLevelApproval";

const errorReplies = {
    noLevel1: "No level 1 in multilevel chains Object",
    typeNotAnyone: 'MultiLevel settings on level 1 but type is different than anyone',
    thresholdNot0: 'MultiLevel settings on level 1 but threshold is not 0',
    NamedUserNotCompAdmin: 'Named user is not Company Admin',
    NamedUserNotEntityAdmin: 'Named user is not Department Admin',
    namedUserAppearsTwice: "Named User appears in two different levels",
    thresholdLevelLow: "Threshold is lower than threshold on previous level"
};

const validateFirstLevel = (approversChain) => {
    let firstLevel = FIRSTLEVEL_KEY;
    if (_.get(approversChain[firstLevel], constants.multiLevelFields.type) === constants.multiLevelTypes.external) {
        firstLevel += 1;
    }
    if (!approversChain[firstLevel]) {
        jsonLogger.error({ type: "TRACKING", function: "updateMultiLevelSettings::validateFirstLevel", text: errorReplies.noLevel1 });
        return { status: false, errorCode: errorReplies.noLevel1 };
    }

    const type = _.get(approversChain[firstLevel], constants.multiLevelFields.type);
    if (type !== constants.multiLevelTypes.anyone) {
        jsonLogger.error({ type: "TRACKING", function: "updateMultiLevelSettings::validateFirstLevel", text: errorReplies.typeNotAnyone });
        return { status: false, errorCode: errorReplies.typeNotAnyone };
    }

    const threshold = _.get(approversChain[firstLevel], constants.multiLevelFields.threshold);
    if (threshold && threshold !== 0) {
        jsonLogger.error({ type: "TRACKING", function: "updateMultiLevelSettings::validateFirstLevel", text: errorReplies.thresholdNot0 });
        return { status: false, errorCode: errorReplies.thresholdNot0 };
    }

    return { status: true };
}

const validateRestrictions = (approversChain, companyAdmins, entityAdmins = []) => {
    const approversChainSorted = _.sortBy(approversChain, 'level')

    let currThreshold = 0;
    let namedUsers = [];
    for (const key in approversChainSorted) {

        const levelThreshold = _.get(approversChainSorted[key], constants.multiLevelFields.threshold, 0);

        if (levelThreshold >= currThreshold) {
            currThreshold = levelThreshold;
        } else {
            return { status: false, errorCode: errorReplies.thresholdLevelLow };
        }

        const type = _.get(approversChainSorted[key], constants.multiLevelFields.type);
        if (type === constants.multiLevelTypes.namedUser) {
            const usersToValidate = _.get(approversChainSorted[key], constants.multiLevelFields.userIds);
            if (_.isEmpty(_.intersection(usersToValidate, namedUsers))) {
                namedUsers = _.concat(namedUsers, usersToValidate);
            } else {
                return { status: false, errorCode: errorReplies.namedUserAppearsTwice };
            }

            jsonLogger.info({ type: "TRACKING", function: "updateMultiLevelSettings::validateRestrictions", text: `usersToValidate: ${usersToValidate} -- companyAdmins: ${companyAdmins}` })
            const adminsInScope = _.isEmpty(entityAdmins) ? companyAdmins : entityAdmins;
            const unApprovedUsers = _.difference(usersToValidate, adminsInScope)
            if (unApprovedUsers.length) {
                return { status: false, errorCode: _.isEmpty(entityAdmins) ? errorReplies.NamedUserNotCompAdmin : errorReplies.NamedUserNotEntityAdmin };
            }
        }
    }
    return { status: true };
}

const validateMultiLevelConfiguration = (approversChain, companyAdmins, entityAdmins) => {
    const firstLevelValidation = validateFirstLevel(approversChain);
    if (!firstLevelValidation.status) {
        return firstLevelValidation;
    }

    const approversChainValidation = validateRestrictions(approversChain, companyAdmins, entityAdmins)
    if (!approversChainValidation.status) {
        return approversChainValidation;
    }
    return { status: true };
}

// eslint-disable-next-line max-params
const getUpdateItem = (prefix, id, data, modifiedBy) => ({
    itemId: prefix + id,
    data,
    modifiedBy,
    index: gsiItemsByCompanyIdAndItemIdIndexName,
});

const getAdminIds = async entityId => {
    const adminsInEntity = await usersService.listEntityAdmins(gsiUsersByEntityIdIndexName, entityId, true);
    return _.map(adminsInEntity, 'userId');
}

const validateMLConfigurationForDepartment = async (entityId, newMLSetting, companyAdmins, companyId) => {
    const settings = await settingsService.get(`${constants.prefix.company}${companyId}`);
    if (!_.get(settings, ['itemData', MULTI_LEVEL, 'enabled'], false)) {
        jsonLogger.error({
            type: "TRACKING", function: "updateMultiLevelSettings::validateMLConfigurationForDepartment",
            message: "MultilevelApproval should be enabled on company level first", entityId, companyId, settings
        })
        return false;
    }
    if (newMLSetting) {
        const { enabled, approversChain } = newMLSetting;
        const entityAdmins = await getAdminIds(entityId);
        const enitySettingValidation = enabled && validateMultiLevelConfiguration(approversChain, companyAdmins, entityAdmins);
        if (enabled && !enitySettingValidation.status) {
            jsonLogger.error({ type: "TRACKING", function: "updateMultiLevelSettings::validateMLConfigurationForDepartment", message: "Multi level setting for entity is not valid and will not be updated", entityId, enitySettingValidation })
            return enitySettingValidation;
        }
    }
    return { status: true };
};

// eslint-disable-next-line max-lines-per-function
module.exports.handler = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    jsonLogger.info({ type: "TRACKING", function: "updateMultiLevelSettings::handler", functionName: context.functionName, awsRequestId: context.awsRequestId, userId, event });

    const { data, companyId, entityId } = JSON.parse(event.body);

    jsonLogger.info({ type: "TRACKING", function: "updateMultiLevelSettings::handler", data, companyId, entityId });

    if (!companyId || !data) {
        return responseLib.failure({ status: false, message: "Missing mandatory parameters", companyId, data });
    }

    const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.advancedSettings]: { isEditor: true }, [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor: true } })
    if (role !== constants.user.role.admin) {
        return responseLib.forbidden({ status: false });
    }

    const { approversChain } = data;
    const companyAdmins = await getAdminIds(companyId);

    if (!_.isEmpty(approversChain)) {
        const settingValidation = entityId
            ? await validateMLConfigurationForDepartment(entityId, approversChain, companyAdmins, companyId)
            : validateMultiLevelConfiguration(approversChain, companyAdmins);
        if (!settingValidation.status) {
            return responseLib.failure({ status: settingValidation.status, message: settingValidation.errorCode });
        }
    }

    const settingsOn = _.get(data, 'settingsOn', [])
    const settingsOff = _.get(data, 'settingsOff', [])
    const isSettingsOnOff = !_.isEmpty(settingsOn) || !_.isEmpty(settingsOff)

    const dataToUpdate = isSettingsOnOff ? _.omit(data, ['settingsOn', 'settingsOff']) : data

    const settingsToUpdate = entityId
        ? getUpdateItem(constants.prefix.entity, entityId, dataToUpdate, userId)
        : getUpdateItem(constants.prefix.company, companyId, dataToUpdate, userId);
    let result = await settingsService.update(settingsToUpdate, 'set', MULTI_LEVEL);

    if (result && isSettingsOnOff && !entityId) {

        jsonLogger.info({ type: 'TRACKING', function: 'settings::updateSettings', text: 'Updating multiple departments' });

        result = _.concat(result, await setEntitiesSettingsOnOff('set', MULTI_LEVEL, userId, settingsOn, settingsOff))
    }


    return result ? responseLib.success(result) : responseLib.failure({ status: false });
};
