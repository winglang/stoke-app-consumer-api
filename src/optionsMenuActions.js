/* eslint-disable max-params */
/* eslint-disable max-lines-per-function */

'use strict';

const _ = require('lodash');

const { jsonLogger, responseLib, CompanyProvidersService, constants, prefixLib, idConverterLib, SettingsService, payableStatusHelper } = require('stoke-app-common-api');

const { isAuthorizedUser } = require('./talentCloud/utils');
const { getBody } = require('./helpers/utils');
const { ACTION_MENU_OPTIONS, getTalentsWithOpenJobs, getActionMenuOptions } = require('./helpers/jobHelper');
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const getAllowedActions = async (companyId, talentId, provider, companyProvider, settings, isCompanyAdmin) => {
    const talentsWithJobs = await getTalentsWithOpenJobs(companyId, talentId);
    return getActionMenuOptions(companyProvider, talentsWithJobs, talentId, settings, provider, isCompanyAdmin, companyProvider)
}

const updateCompanyProvider = async (provider, isTalentWorkforceComplianceIgnored, userId) => { 
    const { companyId, itemId } = provider;
    let response = await companyProvidersService.updateAttribute({ companyId, itemId }, 'itemData.isTalentWorkforceComplianceIgnored', isTalentWorkforceComplianceIgnored, userId);
    if (!response) {
        throw new Error(`Failed to update companyProvider: ${itemId} of companyId: ${companyId}`);
    }
    response = await companyProvidersService.get(companyId, itemId, true);
    jsonLogger.info({ type: "TRACKING", function: "optionsMenuActions::updateCompanyProvider", msg: `isTalentWorkforceComplianceIgnored toggled to: ${isTalentWorkforceComplianceIgnored.value} for itemId: ${itemId}` });
    return response;
}

const handler = async (event) => {
    jsonLogger.info({ type: 'TRACKING', function: 'optionsMenuActions::handler', event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const body = getBody(event);
    const { action, companyId } = body;

    const { isAuthorized, role } = await isAuthorizedUser(userId, companyId);
    const isCompanyAdmin = constants.user.role.admin === role;

    if (!isAuthorized || !isCompanyAdmin) {
        jsonLogger.error({ type: 'TRACKING', function: 'optionsMenuActions::handler', messgage: 'unauthorized role', userId, companyId });
        return responseLib.forbidden({ status: false });
    }

    const result = {};
    const modificationStamp = {
        modifiedAt: Date.now(),
        modifiedBy: userId,
    };
    try {
        switch (action) {
            case ACTION_MENU_OPTIONS.toggleIgnoreWorkforceComplianceBlock: {
                const { talentId } = body;
                if (!talentId || !prefixLib.isTalent(talentId)) {
                    throw new Error('Invalid or missing talentId');
                }
                const companyProvider = await companyProvidersService.get(companyId, talentId, true);
                if (!companyProvider) {
                    throw new Error(`companyProvider talentId: ${talentId} of companyId: ${companyId}, not found `);
                }
                const providerId = idConverterLib.getProviderIdFromTalentId(talentId);
                let provider = await companyProvidersService.get(companyId, providerId, true);
                if (!provider) {
                    throw new Error(`provider providerId: ${providerId} of companyId: ${companyId}, not found `);
                }

                const isTalentWorkforceComplianceIgnoredValue = _.get(provider, 'itemData.isTalentWorkforceComplianceIgnored.value', false);
                const toggledValue = !isTalentWorkforceComplianceIgnoredValue;
                const isTalentWorkforceComplianceIgnored = {
                    value: toggledValue,
                    ...toggledValue ? modificationStamp : {}
                };
                provider = await updateCompanyProvider(provider, isTalentWorkforceComplianceIgnored, userId);
                result.isTalentWorkforceComplianceIgnored = isTalentWorkforceComplianceIgnored
                const settings = await settingsService.get(`${constants.prefix.company}${companyId}`);
                
                result.allowedActions = await getAllowedActions(companyId, talentId, provider, companyProvider, settings, isCompanyAdmin);
                result.payableStatus = payableStatusHelper.getPayableStatusInfo(provider, settings);
                break;
            }
            default:
                jsonLogger.error({ type: 'TRACKING', function: 'optionsMenuActions::handler', message: 'action not found', action });
                break;
        }
    } catch (error) {
        jsonLogger.error({ type: 'TRACKING', function: 'optionsMenuActions::handler', message: error.message });
        return responseLib.failure({ status: false });

    }

    if (!_.isEmpty(result)) {
        return responseLib.success(result);
    }
    return responseLib.failure({ status: false });
}

module.exports = {
    handler,
};
