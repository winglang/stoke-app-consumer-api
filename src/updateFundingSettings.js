"use strict";

const _ = require("lodash");

const {
    SettingsService,
    UsersService,
    responseLib,
    jsonLogger,
    constants,
    SqsService,
    CompaniesService,
    permisionConstants,
} = require("stoke-app-common-api");
const { permissionsComponentsKeys } = require("stoke-app-common-api/config/permisionConstants");

const { settingsTableName, gsiItemsByCompanyIdAndItemIdIndexName, gsiUsersByEntityIdIndexName, asyncTasksQueueName, LegalDocsQueueName } = process.env;
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const asyncTasksQueue = new SqsService(asyncTasksQueueName);
const legalDocsQueue = new SqsService(LegalDocsQueueName);

const MAX_ALLOWED_CYCLES = 2;
const PAYMENT_SCHEDULE_PATH = 'itemData.paymentSchedule.dayOfMonthToRollInto';
const FUNDING_PATH = 'itemData.fundingSettings';

const enrichSetingsItem = (userId, data) => ({
    ...data,
    updatedBy: userId,
    lastUpdateTime: new Date().getTime()
});

const getPaymentScheduleItem = (userId, paymentSchedule) => {
    const dayOfMonthToRollInto = _.isEmpty(paymentSchedule)
        ? constants.DEFAULT_PAYMENT_SCHEDULE.dayOfMonthToRollInto
        : paymentSchedule;
    return enrichSetingsItem(userId, { dayOfMonthToRollInto });
}

const validatePaymentSchedule = (paymentSchedule, fundingType, companyId, fundingRequirementType) => {
    if (![constants.fundingRequirementTypes.preFund, constants.fundingRequirementTypes.fundPerCycle].includes(fundingRequirementType) &&
         fundingType === constants.FUNDING_METHODS.ach && !_.isEqual(paymentSchedule, constants.DEFAULT_PAYMENT_SCHEDULE.dayOfMonthToRollInto)) {
        jsonLogger.error({
            type: "TRACKING", function: "updateFundingSettings::validatePaymentSchedule",
            message: "ACH funding mathod can be configured only with default payment cycle", paymentSchedule, companyId, fundingType, 
        });
        return false;
    }

    if (paymentSchedule.length > MAX_ALLOWED_CYCLES) {
        jsonLogger.error({
            type: "TRACKING", function: "updateFundingSettings::validatePaymentSchedule",
            message: "Company admin can configure up to 2 payment cycles", paymentSchedule, companyId
        });
        return false;
    }

    return true;
}

const validateFundingSettings = async (fundingSettings, companyId) => {
    const { method, contactEmail, companyAdminIds } = fundingSettings;
    if (!method || !companyAdminIds || !companyAdminIds.length) {
        jsonLogger.error({
            type: "TRACKING", function: "updateFundingSettings::validateFundingSettings",
            message: "Funding settings are missing mandatory parameter", fundingSettings, companyId,
        });
        return false;
    }

    if (method === constants.FUNDING_METHODS.ach && !contactEmail) {
        jsonLogger.error({
            type: "TRACKING", function: "updateFundingSettings::validateFundingSettings",
            message: "Funding settings of type ACH is missing contactEmail information", contactEmail, companyId,
        });
        return false;
    }

    if (!constants.FUNDING_METHODS[method]) {
        jsonLogger.error({
            type: "TRACKING", function: "updateFundingSettings::validateFundingSettings",
            message: "Funding method is not supported", fundingSettings, companyId,
        });
        return false;
    }

    const companyAdminsList = await usersService.listEntityAdminsWithComponents(gsiUsersByEntityIdIndexName, companyId, false, { [permissionsComponentsKeys.funding]: { isEditor: true } });
    const companyAdminsIdsList = _.map(companyAdminsList, 'userId');
    // eslint-disable-next-line no-magic-numbers
    if (_.difference(companyAdminIds, companyAdminsIdsList).length > 0) {
        jsonLogger.error({
            type: "TRACKING", function: "updateFundingSettings::validateFundingSettings",
            message: "There is user in the list which is not Admin", fundingSettings, companyId,
        });
        return false;
    }

    return true;
}

const shouldSendNotification = (paymentSchedule, fundingSettings, settings) => {
    const isPaymentScheduleChanged = paymentSchedule && !_.isEqual(paymentSchedule, _.get(settings, [PAYMENT_SCHEDULE_PATH], []));
    const isFundingMethodChanged = fundingSettings && _.get(settings, [FUNDING_PATH, 'method']) !== fundingSettings.method;
    const isFundingContactChanged = fundingSettings && _.get(settings, [FUNDING_PATH, 'contactEmail']) !== fundingSettings.contactEmail;
    const isFundingEmailsChanged = fundingSettings && !_.isEqual(_.get(settings, [FUNDING_PATH, 'emails']), fundingSettings.emails);
     return isPaymentScheduleChanged || isFundingMethodChanged || isFundingContactChanged || isFundingEmailsChanged;
}

// eslint-disable-next-line max-lines-per-function
const sendAchForm = async ({ fundingSettings, fundingType, fillerData, companyId, item, userId }) => {
    const achFormStatus = _.get(fundingSettings, ['achFormStatus', 'status'], false);
    const shouldSendAchForm = !achFormStatus && fundingType === constants.FUNDING_METHODS.ach;
    if (shouldSendAchForm) {
        const legalDocuments = [
                {
                isGlobal: true,
                isWithNoProviderCustomFields: true,
                legalEntityName: 'ACH',
                name: 'ACH',
                companySignerEmail: _.get(fillerData, 'email', ''),
                companySignerName: _.get(fillerData, 'fullName', ''),
            }
        ]
        const legalDocsData = {
            senderName: _.get(fillerData, 'fullName', ''),
            legalDocuments,
            email: _.get(fundingSettings, 'contactEmail'),
            providerName: _.get(fundingSettings, 'contactEmail'),
            isSendEmail: true,
        };
      let messageSentResult = await legalDocsQueue.sendMessage({ companyId, legalDocsData });
      if (messageSentResult) {
        jsonLogger.info({
            type: "TRACKING", function: "updateFundingSettings::handler",
            message: "ACH form sent to be signed", legalDocsData, messageSentResult,
        });
        const updatedSettings = {
            ...fundingSettings,
            achFormStatus: {
                status: constants.message.status.sent,
                envelopeId: messageSentResult,
            }
        }
        messageSentResult = await settingsService.update({ ...item, data: enrichSetingsItem(userId, updatedSettings) }, 'set', constants.settingTypes.fundingSettings);
        if (!messageSentResult) {
            jsonLogger.error({
                type: "TRACKING", function: "updateFundingSettings::handler",
                message: "Failed to update fundingSetings with ach data", fundingSettings, companyId,
            });
            return responseLib.failure({ status: false });
        }
      } else {
        jsonLogger.error({
            type: "TRACKING", function: "updateFundingSettings::handler",
            message: "Failed to send ACH form", legalDocsData, messageSentResult,
        });
      }
    }
   return responseLib.success();
}

// eslint-disable-next-line max-lines-per-function, complexity

// eslint-disable-next-line max-lines-per-function
module.exports.handler = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    jsonLogger.info({ type: "TRACKING", function: "updateFundingSettings::handler", functionName: context.functionName, awsRequestId: context.awsRequestId, userId, event });

    const { data, companyId } = JSON.parse(event.body);

    jsonLogger.info({ type: "TRACKING", function: "updateFundingSettings::handler", data, companyId });

    if (!companyId || !data) {
        return responseLib.failure({ status: false, message: "Missing mandatory parameters", companyId, data });
    }

    const { role } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.funding]: { isEditor: true } })
    if (role !== constants.user.role.admin) {
        jsonLogger.error({ type: "TRACKING", function: "updateFundingSettings::handler", message: "Only company admin can update funding settings", userId });
        return responseLib.forbidden({ status: false });
    }

    const { paymentSchedule, fundingSettings } = data;

    const item = {
        itemId: `${constants.prefix.company}${companyId}`,
        modifiedBy: userId,
        index: gsiItemsByCompanyIdAndItemIdIndexName
    };
    let result = null;
    const settings = await settingsService.get(`${constants.prefix.company}${companyId}`);
    const isAchFormSigned = _.get(settings, `${FUNDING_PATH}.achFormStatus.signDate`, false);
    const fundingType = fundingSettings
        ? _.get(fundingSettings, 'method')
        : _.get(settings, [FUNDING_PATH, 'method']);
    const fundingRequirementType = _.get(settings, ['itemData', 'payments', 'fundingRequirementType']);
    const isValidPaymentSchedule = !paymentSchedule || validatePaymentSchedule(paymentSchedule, fundingType, companyId, fundingRequirementType);
    const isValidFundingSettings = !fundingSettings || await validateFundingSettings(fundingSettings, companyId);

    if (!isValidFundingSettings || !isValidPaymentSchedule) {
        jsonLogger.error({
            type: "TRACKING", function: "updateFundingSettings::handler",
            message: "Invalid funding settings", isValidFundingSettings, isValidPaymentSchedule, paymentSchedule, fundingSettings
        });
        return responseLib.failure({ status: false });
    }

    if (paymentSchedule) {
        result = await settingsService.update({ ...item, data: getPaymentScheduleItem(userId, paymentSchedule) }, 'set', constants.settingTypes.paymentSchedule);
        if (!result) {
            jsonLogger.error({
                type: "TRACKING", function: "updateFundingSettings::handler",
                message: "Failed to update payment schedule", paymentSchedule, companyId,
            });
            return responseLib.failure({ status: false });
        }
    }

    if (fundingSettings) {
        const achFormStatus = _.get(settings, `${FUNDING_PATH}.achFormStatus`);
        const updatedFundingSettings = {
            ...fundingSettings,
            achFormStatus,
        }
        result = await settingsService.update({ ...item, data: enrichSetingsItem(userId, updatedFundingSettings) }, 'set', constants.settingTypes.fundingSettings);
        if (!result) {
            jsonLogger.error({
                type: "TRACKING", function: "updateFundingSettings::handler",
                message: "Failed to update fundingSetings", fundingSettings, companyId,
            });
            return responseLib.failure({ status: false });
        }
    }

    let userInfo = await companiesService.listByUserId(process.env.gsiItemByUserIdIndexName, userId, constants.prefix.userPoolId);
    if (userInfo) {
        [userInfo] = userInfo;
    }

    const fillerData = {
        fullName: `${_.get(userInfo, 'itemData.givenName')} ${_.get(userInfo, 'itemData.familyName')}`,
        email: _.get(userInfo, 'itemData.userEmail'),
    };

    if (result && shouldSendNotification(paymentSchedule, fundingSettings, settings)) {
        jsonLogger.info({
            type: "TRACKING", function: "updateFundingSettings::handler",
            message: "Funding settings are updated and notofication will be sent", paymentSchedule, fundingSettings, settings,
        });
        await asyncTasksQueue.sendMessage({ taskData: { companyId, isPaymentScheduleNotification: !fundingSettings && paymentSchedule }, type: constants.sqsAsyncTasks.types.fundingSettingsSummary });
        if (!isAchFormSigned) {
            await sendAchForm({ fundingSettings, fundingType, fillerData, companyId, item, userId }); 
        }
    }
    return result ? responseLib.success(result) : responseLib.failure({ status: false });
};
