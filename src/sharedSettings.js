/* eslint-disable complexity */
/* eslint-disable max-lines */
/* eslint-disable max-params */
/* eslint-disable no-mixed-operators */

"use strict";

const {
    SettingsService,
    UsersService,
    responseLib,
    jsonLogger,
    constants,
    formatterLib,
    permisionConstants
} = require("stoke-app-common-api");
const uuidv1 = require("uuid/v1");

const { settingsTableName, consumerAuthTableName } = process.env;
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

/**
 * update - update settings item
 * @public
 * @param {object} event - event.body holds { data, action }, where data is the new data and action is the update opeartion
 * @param {object} context - function request context
 * @returns {object} results
 */
// eslint-disable-next-line max-lines-per-function
module.exports.updateSharedSettings = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    jsonLogger.info({
        type: "TRACKING",
        function: "settings::updateSharedSettings",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        userId,
        event
    });

    const { data, companyId } = JSON.parse(event.body);
    if (!data) {
        return responseLib.failure({ status: false, message: 'missing mandatory parame(data) in the body', data });
    }

    const { filters, groupBy, selectedColumns, periodPicker, dateFilterType, name } = data
    if (!filters || !groupBy || !selectedColumns || !periodPicker || !dateFilterType || !name) {
        const message = "missing required shared report data";
        jsonLogger.error({ type: "TRACKING", function: "settings::updateSharedSettings", message });
        return responseLib.failure({ status: false, message });
    }

    const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } });
    if (role === constants.user.role.unauthorised) {
        jsonLogger.error({
            type: 'TRACKING', function: 'settings::updateSharedSettings', functionName: context.functionName,
            message: 'User is not authorised'
        });
        return responseLib.forbidden({ status: false });
    }

    const id = `${formatterLib.formatName(data.name)}${uuidv1()}`
    const item = {
        itemId: `${constants.prefix.sharedReport}${id}`,
        userId,
        companyId,
        entityId: companyId,
        itemStatus: constants.settings.status.active,
        createdBy: userId,
        createdAt: Date.now(),
        itemData: {
            reportDetails: data,
        }
    };

    const res = await settingsService.create(item);

    jsonLogger.info({ type: "TRACKING", function: "settings::updateSharedSettings", functionName: context.functionName, res });

    return res ? responseLib.success({ sharedReportId: id }) : responseLib.failure({ status: false });
};
