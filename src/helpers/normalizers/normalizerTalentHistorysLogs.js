
'use strict';

const _ = require('lodash');
const dayjs = require('dayjs');

const { constants } = require('stoke-app-common-api');
const { getCompanyUsersByUserId } = require('../csvReport/csvReportHelper');


const STOKE_ADMIN = 'stokeAdmin'

const talentHistoryLogsStrings = {
    stokeAdmin: 'Fiverr Enterprise',
    you: 'You',
    actionTitles: {
        [constants.talentHistoryActionTypes.bidCreated]: '{0} was added to Fiverr Enterprise',
        [constants.talentHistoryActionTypes.bidViewed]: '{0} viewed the candidate’s profile ',
        [constants.talentHistoryActionTypes.bidContacted]: '{0} contacted the candidate',
        [constants.talentHistoryActionTypes.bidSaved]: '{0} saved the candidate',
        [constants.talentHistoryActionTypes.bidHidden]: '{0} hid the candidate',
        [constants.talentHistoryActionTypes.bidEvaluated]: '{0} added an evaluation',
    }

}

const resolveActionTitle = (user, actionType, candidate) => {
    const actionTitle = _.get(talentHistoryLogsStrings.actionTitles, actionType);
    switch (actionType) {
        case constants.talentHistoryActionTypes.bidCreated:
            return actionTitle ? actionTitle.replace('{0}', _.get(candidate, 'name')) : '';
        case constants.talentHistoryActionTypes.bidViewed:
        case constants.talentHistoryActionTypes.bidContacted:
        case constants.talentHistoryActionTypes.bidSaved:
        case constants.talentHistoryActionTypes.bidHidden:
        case constants.talentHistoryActionTypes.bidEvaluated:
            return actionTitle ? actionTitle.replace('{0}', user) : '';
        default:
            return '';
    }
}

const resolveUserName = (user) => {
    if (user === STOKE_ADMIN) {
        return talentHistoryLogsStrings.stokeAdmin
    }
    return `${_.get(user, 'itemData.givenName', '')} ${_.get(user, 'itemData.familyName', '')}`;
}

module.exports.normalizeTalentHistoryLogs = async (companyId, logs, currentUserId) => {
    const userNamesById = await getCompanyUsersByUserId(companyId);
    return _.map(logs, (item) => {
        const { itemData = {}, createdAt, itemId } = item;
        const { itemId: talentId, jobId, actionType, bidItemData, userId } = itemData;
        const bidItemId = _.join([jobId, '_', talentId], '');
        const user = _.get(userNamesById, userId, userId);

        return {
            itemId,
            bidItemId,
            talentId,
            createdAt,
            user: userId === currentUserId ? talentHistoryLogsStrings.you : resolveUserName(user),
            userId,
            action: resolveActionTitle(userId === currentUserId ? talentHistoryLogsStrings.you : resolveUserName(user), actionType, _.get(bidItemData, 'candidate')),
            date: dayjs(createdAt).format('DD MMM YYYY, HH:mm:ss'),
            actionType,
        }
    })
}

module.exports.dataExportTalentHistoryLogs = (logs) => {
    const headers = ['action', 'date'];
    const rows = _.map(logs, (item) => _.map(headers, (header) => _.get(item, header) || '')).filter(Boolean)
    return { rows, headers: _.invokeMap(headers, 'toUpperCase') }
}

module.exports.columnMapperBidHistoryLogs = () => ({
    bidItemId: { key: 'bidItemId', filterKey: 'jobId', buildFilterSqlExp: (value) => ` [bidItemId] LIKE '%${value}%'` },
    talentId: 'talentId',
    createdAt: 'createdAt',
    date: 'date',
    name: 'name',
    action: 'action',
    actionType: 'actionType',
    user: 'user'
})
