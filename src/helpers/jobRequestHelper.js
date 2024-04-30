/* eslint-disable no-magic-numbers */

'use strict';

const _ = require('lodash');
const { constants, jsonLogger } = require('stoke-app-common-api');
const { getEffectiveSettingForDepartment, SETTING_TYPE } = require('./settingsHelper');

const getJobRequestLevels = (milestone, companySettings, departmentSettings) => {
    jsonLogger.info({ type: 'TRACKING', function: 'jobRequestHelper::getJobRequestLevels', milestone, companySettings, departmentSettings });
    if (constants.job.status.jobRequest === milestone.itemStatus) {
        return _.get(milestone, 'itemData.jobRequestLevels');
    }
    const jobRequestSettings = getEffectiveSettingForDepartment(companySettings, departmentSettings, SETTING_TYPE.jobRequest);
    if (jobRequestSettings) {
        const jobRequestLevels = _.cloneDeep(_.get(jobRequestSettings, 'jobRequestLevels', []));
        if (!_.isEmpty(jobRequestLevels) && constants.job.status.pending === milestone.itemStatus) {
            const { cost } = milestone.itemData || {};
            const requiredLevels = _.filter(jobRequestLevels, (level) => _.get(level, 'threshold', 0) <= cost);
            return _.size(requiredLevels) && requiredLevels;
        }
    }
    return [];
};

const getUpdatedJobRequestLevels = (jobRequestLevels, levelsToApprove, userId, isReject) => {
    jsonLogger.info({ type: 'TRACKING', function: 'jobRequestHelper::getUpdatedJobRequestLevels', jobRequestLevels, levelsToApprove, userId });
    if (_.isEmpty(jobRequestLevels) || !userId) {
        return jobRequestLevels;
    }
    return _.map(jobRequestLevels, level => {
        const approvedLevel = _.find(levelsToApprove, levelToApprove => levelToApprove.id === _.get(level, 'id'))
        return approvedLevel
            ? {
                ...approvedLevel,
                approvedBy: !isReject && userId,
                rejectedBy: isReject && userId,
                approveDate: Date.now(),
            } : level;
    })
}

const getApprovedJobRequestNextStatus = (milestone, levelsToApprove, jobRequestSettings = []) => {
    const jobRequestLevels = _.get(milestone, 'itemData.jobRequestLevels', jobRequestSettings)
    const originalNotApproved = _.filter(jobRequestLevels, (level) => !level.approvedBy);
    const notApprovedLevels = _.differenceBy(originalNotApproved, levelsToApprove, 'id');
    return _.isEmpty(notApprovedLevels)
        ? constants.job.status.active
        : constants.job.status.jobRequest;
}

const isJobRequestMilestone = (milestone) => {
    const { itemStatus, newItemStatus, jobRequestLevels, jobRequestLevelsToApprove } = milestone;
    if (newItemStatus !== constants.job.status.active || ![constants.job.status.pending, constants.job.status.jobRequest].includes(itemStatus)) return false
    return getApprovedJobRequestNextStatus(milestone, jobRequestLevelsToApprove, jobRequestLevels) === constants.job.status.jobRequest
}

const isJobRequestEnabled = (settings) => {
    const isEnabledForCompany = _.get(settings, 'itemData.jobRequestApproval.enabled', false);
    const isWithValidLevels = _.every(_.get(settings, 'itemData.jobRequestApproval.jobRequestLevels', []), (level) => _.isFinite(_.get(level, 'threshold', 0)) && !_.isEmpty(_.get(level, 'userIds', [])));
    return isEnabledForCompany && isWithValidLevels;

}

module.exports = {
    getJobRequestLevels,
    getUpdatedJobRequestLevels,
    isJobRequestEnabled,
    isJobRequestMilestone,
};
