'use strict';

const {
    settingsTableName,
} = process.env;

const _ = require('lodash');
const { constants, SettingsService, jsonLogger } = require('stoke-app-common-api');

const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const getIsTransferAllowed = async (sourceEntityId, targetEntityId, companyId) => {
    if (sourceEntityId === targetEntityId || [sourceEntityId, targetEntityId].includes(companyId)) {
        return true;
    }
    
    const setting = await settingsService.get(`${constants.prefix.company}${companyId}`);
    const isBlockMoveBudget = _.get(setting, "itemData.blockMoveBudgetBetweenDepartments.enabled", false);
    if (isBlockMoveBudget) {
        jsonLogger.error({
            type: 'TRACKING', function: 'budgetsHelper::isTransferAllowed',
            message: 'blockMoveBudgetBetweenDepartments is enabled, budget can not be moved between departments',
            sourceEntityId, targetEntityId, companyId,
        });
    }
    return !isBlockMoveBudget;
}

module.exports = {
    getIsTransferAllowed,
};
