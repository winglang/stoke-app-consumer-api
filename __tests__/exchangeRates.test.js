'use strict';

const mod = require('../src/exchangeRates');
const jestPlugin = require('serverless-jest-plugin');
const handler = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'handler' });

const { exchangeRatesTableName, settingsTableName } = process.env;

const { ExchangeRatesService, constants, SettingsService } = require('stoke-app-common-api');
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const exchangeRatesService = new ExchangeRatesService(exchangeRatesTableName, constants.projectionExpression.providerAttributes, constants.attributeNames.providerAttributes, settingsService)

const FX_FEE = 1 / (1 + constants.payment.fee.default);
const companyId = "SETTINGS_JEST_TEST_COMPANY_ID"; 
const fxRateFee = 1.3;
const settings = {
    itemId: `${constants.prefix.company}${companyId}`,
    companyId,
    itemData: {
        fxRateFee
    }
};


const rate = {
    itemId: 'USD',
    itemData: {
        ILS: 3.4444,
        EUR: 0.8888,
    },
    createdAt: Date.now(),
};

describe('exchangeRates', () => {

    beforeAll(async () => {
        await exchangeRatesService.create(rate);
    });

    it('exchangeRates - fetch latest', async () => {
        
        let response = await handler.run({
            queryStringParameters: {
                withFee: 'true'
            }
        });
        expect(response.statusCode).toBe(200);
        let body = JSON.parse(response.body);
        expect(body.exchangeRates).toMatchObject({
            ILS: 3.4444 * FX_FEE,
            EUR: 0.8888 * FX_FEE,
        });
        response = await handler.run({
            queryStringParameters: {
                withFee: 'false'
            }
        });
        expect(response.statusCode).toBe(200);
        body = JSON.parse(response.body);
        expect(body.exchangeRates).toMatchObject({
            ILS: 3.4444,
            EUR: 0.8888,
        });
    });

    it('exchangeRates - by company', async () => {
        await settingsService.create(settings);
        let response = await handler.run({
            queryStringParameters: {
                withFee: 'true',
                companyId
            }
        });
        expect(response.statusCode).toBe(200);
        let body = JSON.parse(response.body);
        expect(body.exchangeRates).toMatchObject({
            ILS: 3.4444 * (1 / fxRateFee),
            EUR: 0.8888 * (1 / fxRateFee),
        });
        
    });

    afterAll(async () => {
        await exchangeRatesService.delete(rate.itemId, rate.createdAt);
    });
});
