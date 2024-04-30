/* eslint-disable max-params */
/* eslint-disable require-unicode-regexp */
/* eslint-disable prefer-named-capture-group */
/* eslint-disable no-magic-numbers */

"use strict"

const { INTERACT_TOPIC_ARN, SEND_TALENT_APP_LINK, settingsTableName } = process.env;
const { dateLib, constants, jsonLogger, SettingsService } = require("stoke-app-common-api");
const { STOKE_FEE_KEYS_ROWS } = require('stoke-app-common-api/config/billingConstants');
const _ = require('lodash');
const aws = require("aws-sdk");
const sns = new aws.SNS();
const milestoneConstants = Object.freeze({
    status: constants.job.status,
});

const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const MILESTONE_STATUS = milestoneConstants.status

const formatTimestamp = (timestamp) => dateLib.format(timestamp, 'DD-MMM-YYYY');

const prettifyNumber = number => {
    if (number === '') return ''
    if (!number) return 0
    const cleanString = number.toString().replace(',', '')
    const roundedString = Number(cleanString).toFixed(2)
    const roundedNumber = Number(roundedString)
    return roundedNumber.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}


const getPaymentStatusByMilestoneStatus = milestoneStatus => {
    switch (milestoneStatus) {
        case MILESTONE_STATUS.paid:
        case MILESTONE_STATUS.completed:
            return constants.ledgerConstants.status.approved

        case MILESTONE_STATUS.overageBudgetRequest:
        case MILESTONE_STATUS.pendingApproval:
        case MILESTONE_STATUS.nextLevelApproval:
            return constants.ledgerConstants.status.pending

        case MILESTONE_STATUS.active:
            return constants.ledgerConstants.status.committed
        default:
            return ''
    }
}

const getMilestoneStatusByPaymentStatus = statuses => {
    let milestoneStatuses = []
    for (const paymentStatus of statuses) {
        switch (paymentStatus) {
            case constants.ledgerConstants.status.approved:
                milestoneStatuses = milestoneStatuses.concat([MILESTONE_STATUS.paid, MILESTONE_STATUS.completed])
                break;
            case constants.ledgerConstants.status.pending:
                milestoneStatuses = milestoneStatuses.concat([MILESTONE_STATUS.pendingApproval, MILESTONE_STATUS.nextLevelApproval, MILESTONE_STATUS.overageBudgetRequest])
                break;
            case constants.ledgerConstants.status.committed:
                milestoneStatuses = milestoneStatuses.concat([MILESTONE_STATUS.active])
                break;
            default:
                return ''
        }
    }
    return milestoneStatuses
}

const convertCountryCodeToName = code => {
    if (!code || code === '--') {
        return ''
    }

    try {
        const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
        return regionNames.of(code)
    } catch (e) {
        return code
    }
}

const getJobHoursValues = (totalBudget, hourlyBudget) => {
    if (hourlyBudget === 0 || isNaN(totalBudget))
        return 0
    return Number((totalBudget / hourlyBudget).toFixed(2))
}

const getBillingFees = milestone => {
    const stokeFee = _.sumBy(STOKE_FEE_KEYS_ROWS, key => Number(_.get(milestone, `${key}.cost`, 0)))
    const transactionFee =
        Number(_.get(milestone, 'transactionFee.cost', 0)) +
        Number(_.get(milestone, 'accelerateFee.cost', 0))
    return { stokeFee, transactionFee }
}

const resolvePaymentMethod = milestone => {
    let paymentName = _.get(milestone, 'itemData.payment.name')
    if (paymentName === constants.payment.name.tipalti) {
        paymentName = _.get(milestone, 'itemData.payment.feeData.transactionFee.type')
    }
    return paymentName
}
// eslint-disable-next-line no-extra-parens
const getValidAddress = addressField => (addressField ? addressField : '')

const getTalentCountry = talent => _.get(talent, 'country', _.get(talent, 'profileCountry', _.get(talent, 'talentProfileData.country', '')))

const getTalentAddress = talent => {
    const { address = '', city = '', state = '', postalCode = '', country = '' } = talent || {}
    const fullAddrees = [
        `${getValidAddress(address)}`,
        `${getValidAddress(city)}`,
        `${getValidAddress(state)}`,
        `${getValidAddress(postalCode)}`,
        `${convertCountryCodeToName(getValidAddress(country))}`,
    ]
    return _.filter(fullAddrees, Boolean).join(' ')
}

const getTalentPhone = talent => {
    const { phone = '' } = talent || ''
    return _.size(phone) > 0 ? String(phone) : ''
}

const getUserName = (userId, usersByUserId) => {
    const user = userId && usersByUserId[userId]
    return user ? `${_.get(user, 'itemData.givenName')} ${_.get(user, 'itemData.familyName')}` : ''
}

const getBody = (event) => {
    const body = _.get(event, 'body');
    return _.isString(body) ? JSON.parse(body) : body;
}
  
const sendSNS = async (companyId, entityId, jobId, talentId, contactingUserId, snsMessageInfo, isCatalog, talentFullName, talentEmail) => {
    const notification = {
      Subject: `${companyId} - Job talent interaction: contact`,
      Message: JSON.stringify({ companyId, entityId, jobId, talentId, userId: contactingUserId, operation: constants.message.type.contact, message: snsMessageInfo, isCatalog, talentFullName, talentEmail }),
      TopicArn: INTERACT_TOPIC_ARN
    };
    jsonLogger.info({ type: "TRACKING", function: "utils::sendSNS", notification });
    try {
      await sns.publish(notification).promise();
    } catch (error) {
      jsonLogger.error({ type: 'TRACKING', function: 'utils::sendSNS', error, message: error.message });
    }
  }

const getProviderEffectiveItemStatus = async (companyId, itemStatus, isMarketplace) => {
    if (SEND_TALENT_APP_LINK === 'true') {
      return constants.companyProvider.status.invited;
    }
    if (isMarketplace) {
      return constants.companyProvider.status.registered;
    }
    if (itemStatus === constants.companyProvider.status.notInvited) {
      return constants.companyProvider.status.notInvited;
    }
    if (itemStatus === constants.companyProvider.status.enrolled) {
      return constants.companyProvider.status.enrolled;
    }
    const setting = await settingsService.get(`${constants.prefix.company}${companyId}`);
    const sendTalentAppLink = _.get(setting, "itemData.sendTalentAppLink");
    return sendTalentAppLink ? constants.companyProvider.status.invited : itemStatus;
}

module.exports = {
    getPaymentStatusByMilestoneStatus,
    convertCountryCodeToName,
    getJobHoursValues,
    getBillingFees,
    resolvePaymentMethod,
    getTalentCountry,
    getTalentAddress,
    getTalentPhone,
    prettifyNumber,
    formatTimestamp,
    getMilestoneStatusByPaymentStatus,
    getProviderEffectiveItemStatus,
    getBody,
    getUserName,
    sendSNS
};
