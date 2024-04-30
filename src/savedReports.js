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
const _ = require('lodash')
const { settingsTableName, consumerAuthTableName, gsiItemsByCompanyIdAndUserIdIndexName, gsiUsersByEntityIdIndexName } = process.env;
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

// * update savedReport setting item
// * @public
// * @param {object} event - event.body holds { data, companyId, pathToUpdate, id }, where data is the new data
// * @param {object} context - function request context
// * @returns {object} results
// */
// eslint-disable-next-line max-lines-per-function
module.exports.updateSavedReport = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    jsonLogger.info({
        type: "TRACKING",
        function: "settings::updateSavedReport",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        userId,
        event
    });
 
    const { reportDetails, companyId } = JSON.parse(event.body);
    const reportId = _.get(event.pathParameters, 'id');
    if (!reportDetails || !companyId || !userId || !reportId) {
        return responseLib.failure({ status: false, message: 'missing mandatory param in the body', reportDetails, companyId, userId, reportId });
    }
 
    const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } });
    if (role === constants.user.role.unauthorised) {
        jsonLogger.error({
            type: 'TRACKING', function: 'settings::updateSavedReport', functionName: context.functionName,
            message: 'User is not authorised'
        });
        return responseLib.forbidden({ status: false });
    }


    const companyAdminsList = await usersService.listEntityAdmins(gsiUsersByEntityIdIndexName, companyId);
    const notCustomCompanyAdmins = _.filter(companyAdminsList, admin => _.isNil(_.get(admin, ['itemData', 'permissionsComponents'])));
    const companyAdminsIdsList = _.map(notCustomCompanyAdmins, 'userId');
    const recipientsIds = _.get(reportDetails, ['schedulerData', 'recipients', 'usersIds'], []);
    // eslint-disable-next-line no-magic-numbers
    if (_.difference(recipientsIds, companyAdminsIdsList).length > 0) {
        jsonLogger.error({
            type: 'TRACKING', function: 'settings::updateSavedReport', functionName: context.functionName,
            message: 'recipients are not authorised'
        });
        return responseLib.forbidden({ status: false });
    }
    const item = {
        itemId: `${constants.prefix.savedReport}${reportId}`,
        modifiedBy: userId,
        data: reportDetails,
    };
 
    const res = await settingsService.update(item, 'set', 'reportDetails')

    jsonLogger.info({ type: "TRACKING", function: "settings::updateSavedReport", functionName: context.functionName, res });
 
    return res ? responseLib.success(_.get(res, 'Attributes.itemData.reportDetails')) : responseLib.failure({ status: false });
 };


// * create savedReport setting item
// * @public
// * @param {object} event - event.body holds { reportDetails, companyId }, where data is the new data and reportDetails is the report we want to save
// * @param {object} context - function request context
// * @returns {object} results
// */
// eslint-disable-next-line max-lines-per-function
module.exports.createSavedReport = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    jsonLogger.info({
        type: "TRACKING",
        function: "settings::createSavedReport",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        userId,
        event
    });
 
    const { reportDetails, companyId } = JSON.parse(event.body);
    if (!reportDetails || !companyId || !userId) {
        return responseLib.failure({ status: false, message: 'missing mandatory param in the body', reportDetails, companyId, userId });
    }
 
    const { filters, groupBy, selectedColumns, periodPicker, dateFilterType, name } = reportDetails
    if (!filters || !groupBy || !selectedColumns || !periodPicker || !dateFilterType || !name) {
        const message = "missing required shared report data";
        jsonLogger.error({ type: "TRACKING", function: "settings::createSavedReport", message });
        return responseLib.failure({ status: false, message });
    }

    const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } });
    if (role === constants.user.role.unauthorised) {
        jsonLogger.error({
            type: 'TRACKING', function: 'settings::createSavedReport', functionName: context.functionName,
            message: 'User is not authorised'
        });
        return responseLib.forbidden({ status: false });
    }

    const id = `${formatterLib.formatName(reportDetails.name)}${uuidv1()}`
    const item = {
        itemId: `${constants.prefix.savedReport}${id}`,
        userId,
        companyId,
        entityId: companyId,
        itemStatus: constants.settings.status.active,
        createdBy: userId,
        createdAt: Date.now(),
        modifiedBy: userId,
        itemData: {
            reportDetails: {
                ...reportDetails,
                isScheduler: false,
                id,
            }
        }
    };
 
    const res = await settingsService.create(item);
    jsonLogger.info({ type: "TRACKING", function: "settings::createSavedReport", functionName: context.functionName, res });
 
    return res ? responseLib.success({ savedReportId: id, savedReport: _.get(res, 'itemData.reportDetails') }) : responseLib.failure({ status: false });
 };


/**
 * get - get settings item
 * @public
 * @param {object} event - event.pathParameters must contain companyId
 * @param {object} context - function request context
 * @returns {object} results
 */
 module.exports.getSavedReports = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId } = event.queryStringParameters;
    jsonLogger.info({
        type: "TRACKING",
        function: "settings::getSavedReports",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        userId,
        companyId,
        event
    });

    const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { } });
    if (role === constants.user.role.unauthorised) {
        jsonLogger.error({
            type: 'TRACKING', function: 'settings::getSavedReports', functionName: context.functionName,
            message: 'User is not authorised'
        });
        return responseLib.forbidden({ status: false });
    }

    const res = await settingsService.listSavedReports(gsiItemsByCompanyIdAndUserIdIndexName, companyId, userId);

    const savedReportsByName = res.reduce((acc, savedReport) => {
        acc[_.get(savedReport, 'itemData.reportDetails.name')] = _.get(savedReport, 'itemData.reportDetails')
        return acc 
    }, {})

    return res ? responseLib.success(savedReportsByName) : responseLib.failure({ status: false });
};

module.exports.deleteSavedReport = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const reportId = _.get(event.pathParameters, 'id');
    const { companyId } = event.queryStringParameters;
    jsonLogger.info({
        type: "TRACKING",
        function: "settings::deleteSavedReport",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        userId,
        companyId,
        event
    });

    const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { isEditor: true } });
    if (role === constants.user.role.unauthorised) {
        jsonLogger.error({
            type: 'TRACKING', function: 'settings::deleteSavedReport', functionName: context.functionName,
            message: 'User is not authorised'
        });
        return responseLib.forbidden({ status: false });
    }
 
    const res = await settingsService.archive(`${constants.prefix.savedReport}${reportId}`, userId)

    return res ? responseLib.success(res) : responseLib.failure({ status: false });
};
