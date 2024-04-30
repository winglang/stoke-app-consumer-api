/* eslint-disable max-params */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-undefined */
/* eslint-disable array-element-newline */

'use strict';

const {
    settingsTableName,
} = process.env;

const _ = require('lodash');
const { constants, SettingsService, jobHelper, prefixLib, jsonLogger } = require('stoke-app-common-api');
const { getEffectiveSettingForDepartment, SETTING_TYPE } = require('./settingsHelper');

const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const getNextApprovalRecord = (approvals, userId, action = 'approve') => {
    const level = _.size(jobHelper.getLatestApprovers({ itemData: { approvals } })) + 1;
    return { approvedBy: userId, approveDate: Date.now(), action, level };
};

const getMultiLevelContext = (milestone, companySettings, entitySettings) => {
    const milestoneApproversChain = _.get(milestone, 'itemData.approversChain');
    if (constants.job.status.secondApproval === milestone.itemStatus) {
        jsonLogger.info({ type: "TRACKING", function: "multiLevelHelper::getMultiLevelContext", milestone, multiLevelContext: milestoneApproversChain });
        return milestoneApproversChain;
    }
    const multiLevelSettings = getEffectiveSettingForDepartment(companySettings, entitySettings, SETTING_TYPE.multiLevel);
    if (multiLevelSettings) {
        if ([constants.job.status.pendingApproval, constants.job.status.requested].includes(milestone.itemStatus)) {
            let approversChain = _.cloneDeep(_.get(multiLevelSettings, 'approversChain', []));
            const { actualCost, actualRequestCost } = milestone.itemData || {};
            const requestedAmount = actualCost || actualRequestCost;
            approversChain = _.filter(approversChain, (level) => _.get(level, constants.multiLevelFields.threshold, 0) < requestedAmount); 
            approversChain = _.map(approversChain, (level) => {
                if (level.type === constants.multiLevelTypes.external) {
                    return _.find(milestoneApproversChain, (milestoneLevel) => milestoneLevel.type === constants.multiLevelTypes.external) || level;
                }
                return level;
            })
            jsonLogger.info({ type: "TRACKING", function: "multiLevelHelper::getMultiLevelContext", milestone, multiLevelContext: approversChain });
            return approversChain;
        }
    }
    jsonLogger.info({ type: "TRACKING", function: "multiLevelHelper::getMultiLevelContext", message: "No multilevel context for this milestone", milestone });
    return false;
};

const getUpdatedLevels = (milestone, approversChainSettings, levelsToApprove, userId, isReject) => {
    const approversChain = [constants.job.status.pendingApproval, constants.job.status.requested].includes(milestone.itemStatus) && !isReject
        ? approversChainSettings
        : Object.values(_.get(milestone, 'itemData.approversChain'));
    if (_.isEmpty(approversChain) || _.isEmpty(levelsToApprove) || !userId) {
        return approversChain;
    }
    _.forEach(levelsToApprove, (level) => {
        const levelId = _.get(level, 'level');
        const levelIndex = _.findIndex(approversChain, (chainLevel) => chainLevel.level === levelId)
        if (levelId && levelIndex >= 0) {
            approversChain[levelIndex].approvedBy = !isReject && userId;
            approversChain[levelIndex].rejectedBy = isReject && userId;
            approversChain[levelIndex].approveDate = Date.now();
        }
    })
    return approversChain;
}

const StatusesBySettingType = {
    [constants.MULTI_LEVEL_SETTINGS.multiLevelApproval]: [
        constants.job.status.pendingApproval,
        constants.job.status.secondApproval,
        constants.job.status.requested,
    ],
    [constants.MULTI_LEVEL_SETTINGS.jobRequestApproval]: [constants.job.status.jobRequest],
}

const approvalOptionsKeys = {
    [constants.MULTI_LEVEL_SETTINGS.multiLevelApproval]: 'approvalOptions',
    [constants.MULTI_LEVEL_SETTINGS.jobRequestApproval]: 'approveJobRequestOptions',
}

const isStatusForApproval = (status) => _.flatMap(Object.values(StatusesBySettingType)).includes(status);

const enrichMsWithApprovalOptions = (item, approversChainSettings, userId, isEntityAdmin, isCompanyAdmin, settingTypes = [constants.MULTI_LEVEL_SETTINGS.multiLevelApproval]) => {
    const isMilestone = prefixLib.isMilestone(item.itemId);
    const approvalOptions = {};
    if (isMilestone) {
        _.forEach(settingTypes, (settingType) => {
            if (StatusesBySettingType[settingType].includes(item.itemStatus)) {
                _.set(approvalOptions, approvalOptionsKeys[settingType], jobHelper.getApproveOptions(item, approversChainSettings, userId, isEntityAdmin, isCompanyAdmin, settingType))
            }
        })
    }
    return {
        ...item,
        ...approvalOptions,
    }
}

const getCompanySettings = async (companyId) => {
    if (!companyId) {
        return null;
    }
    const result = await settingsService.get(`${constants.prefix.company}${companyId}`);
    return result;
}

module.exports = {
    getCompanySettings,
    getNextApprovalRecord,
    getMultiLevelContext,
    getUpdatedLevels,
    enrichMsWithApprovalOptions,
    isStatusForApproval,
};
