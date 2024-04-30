'use strict';

const getLanguages = require('../src/getLanguages');
const jestPlugin = require('serverless-jest-plugin');

const handler = jestPlugin.lambdaWrapper.wrap(getLanguages, { handler: 'handler' });

describe('getLanguages', () => {

    it('getLanguages, expect success', async () => {
        const { body } = await handler.run();
        const { languages } = JSON.parse(body) || {};
        expect(languages).toMatchObject(['en']);
    });
});
