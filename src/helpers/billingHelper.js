/* eslint-disable no-magic-numbers */
/* eslint-disable no-undefined */
/* eslint-disable newline-per-chained-call */

'use strict';

const _ = require('lodash');

const { settingsTableName, exchangeRatesTableName, companyProvidersTableName } = process.env;
const { jsonLogger, constants, billingHelper, dynamoDbUtils, idConverterLib, SettingsService, ExchangeRatesService, CompanyProvidersService } = require('stoke-app-common-api');
const { DEFAULT_CURRENCY } = require('stoke-app-common-api/config/billingConstants');
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const exchangeRatesService = new ExchangeRatesService(exchangeRatesTableName, null, constants.attributeNames.defaultAttributes, settingsService);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAndTagsAttributes);

const PaidStatuses = [
    constants.payment.status.paid,
    constants.payment.status.paidVerified,
    constants.payment.status.scheduled,
    constants.payment.status.submitted,
]

const getMaxBillingDateTime = (rows) => _.chain(rows).
    filter((row) => row.externalId && row.externalId.startsWith(constants.balance.prefix.billing)).
    map('dateTime').
    max().
    value();

const getBillingFilterOptions = (rows) => _.chain(rows).
    filter((row) => row.externalId && row.externalId.startsWith(constants.balance.prefix.billing)).
    map((row) => ({ title: row.description, billingId: idConverterLib.getBillingIdFromExternalId(row.externalId), dateTime: row.dateTime })).
    value();

const getBillingEstimationForMilestones = async (companyId, milestones) => {
    jsonLogger.info({ function: "billlingHelper::getBillingEstimationForMilestones", companyId, milestones });
    const jobKeys = _.uniqBy(milestones.map((mlstn) => ({ entityId: mlstn.entityId, itemId: idConverterLib.getJobIdFromMilestoneId(mlstn.itemId) })), "itemId");
    const jobs = await dynamoDbUtils.batchGetParallel(process.env.jobsTableName, jobKeys, constants.projectionExpression.defaultAttributesAndExternalUserId);
    const jobsGrouped = _.groupBy(jobs, (item) => item.itemId);
    const providers = await billingHelper.getProviders(milestones, jobsGrouped);
    const exchangeRate = await exchangeRatesService.getLatest(DEFAULT_CURRENCY, true, companyId);
    const companyProviderItems = await companyProvidersService.companyProvidersPagination('listCompany', [
        companyId,
        undefined,
        undefined,
        undefined,
    ]);
    const companyProviders = _.keyBy(companyProviderItems, 'itemId');
    const defaultSettings = await settingsService.get(`${constants.prefix.company}${constants.defaultCompanySettings.id}`);
    const companySettings = await settingsService.get(`${constants.prefix.company}${companyId}`);

    const fees = {
        ..._.get(defaultSettings, 'itemData.billing.fees', {}),
        ..._.get(companySettings, 'itemData.billing.fees', {}),
    };
    const range = _.get(companySettings, 'itemData.billing.range', _.get(defaultSettings, 'itemData.billing.range'));
    const { from, to } = billingHelper.getRange(new Date(), range, 1);
    const billingFactors = {
        jobsGrouped,
        providers,
        exchangeRate,
        fees,
        companyProviders,
        from,
        to
    };
    let result = null;
    const billing = billingHelper.createBillingForMilestones(milestones, billingFactors);
    if (billing) {
        const totalAmountAfterDiscount = _.get(billing, 'totalAmountAfterDiscountAndVAT') || _.get(billing, 'totalAmountAfterDiscount');
        const amountWithoutFees = _.sumBy(billing.body, 'amount') || 0;
        const allFees = _.round(Math.max(totalAmountAfterDiscount - amountWithoutFees, 0), 2);
        result = {
            ...billing,
            allFees,
            paymentRows: _.get(billing, 'body'),
            title: _.get(billing, 'title'),
            totalAmountAfterDiscount,
            lastModified: new Date(),
        };
    }
    jsonLogger.info({ function: "billlingHelper::getBillingEstimationForMilestones", result });
    return result;
};

const resolveFundingDate = milestone => _.get(milestone, 'itemData.payment.PendingDate');

module.exports = {
    getMaxBillingDateTime,
    getBillingEstimationForMilestones,
    resolveFundingDate,
    getBillingFilterOptions,
    PaidStatuses,
};
