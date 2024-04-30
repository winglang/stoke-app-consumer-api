'use strict';

const { DOMAINS_TO_FEDERATION_MAPPING, LOCAL_DOMAIN_NAME } = require('./../resources/externalDomains');
const jestPlugin = require('serverless-jest-plugin');

const { lambdaWrapper } = jestPlugin;

const mod = require('../src/domain');
const wrapped = lambdaWrapper.wrap(mod, { handler: 'getDomainByEmail' });
const useremail = 'theboss@stoketalent.com'

const event = {
    queryStringParameters: {
        useremail,
    }
}

describe('getDomainByEmail', () => {
    describe('valid request', () => {
        describe('sso domain', () => {
            const ssoDomain = Object.keys(DOMAINS_TO_FEDERATION_MAPPING)

            ssoDomain.forEach((key) => {
                it('should return proper request', async () => {
                    const newEvent = { ...event }
                    newEvent.queryStringParameters.useremail = `abs@${key}`
                    const response = await wrapped.run(newEvent);
                    const body = JSON.parse(response.body)
                    expect(body.domain).toBe(DOMAINS_TO_FEDERATION_MAPPING[key])
                })
            })
        })

        describe('default domain', () => {
            const ssoDomain = 'NON_EXISTING'

            it('should return proper request', async () => {
                const newEvent = { ...event }
                newEvent.queryStringParameters.useremail = `abs@${ssoDomain}`
                const response = await wrapped.run(newEvent);
                const body = JSON.parse(response.body)
                expect(body.domain).toBe(LOCAL_DOMAIN_NAME)
            })
        })
    })


    describe('invalid request', () => {
        it('should return error', async () => {
            try {
                const newEvent = { ...event }
                newEvent.queryStringParameters.useremail = ''
                await wrapped.run(newEvent);
            } catch (error) {
                expect(error.message).toBe('useremail param must be supplied for event')
            }
        })
    })
});
