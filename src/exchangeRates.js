'use strict';

// eslint-disable-next-line no-underscore-dangle
const _pick = require('lodash/pick');
const { exchangeRatesTableName, settingsTableName } = process.env;

const { ExchangeRatesService, SettingsService, constants, responseLib, jsonLogger } = require('stoke-app-common-api');
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const exchangeRatesService = new ExchangeRatesService(exchangeRatesTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes, settingsService)

module.exports.handler = async (event, context) => {
    jsonLogger.info({ function: 'exchangeRates::handler', event, context });
    const { withFee, companyId } = event.queryStringParameters || {};
    const exchangeRates = await exchangeRatesService.getLatest('USD', withFee === 'true', companyId);
    const supportedExchangeRates = _pick(exchangeRates, constants.supportedCurrencies);
    return exchangeRates ? responseLib.success({ exchangeRates: supportedExchangeRates }) : responseLib.failure({ status: false });
};
