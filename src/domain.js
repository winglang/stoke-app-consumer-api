
'use strict';

const _ = require('lodash');

const { jsonLogger, utils, responseLib } = require('stoke-app-common-api');
const { DOMAINS_TO_FEDERATION_MAPPING, LOCAL_DOMAIN_NAME } = require('./../resources/externalDomains');

// eslint-disable-next-line func-names
module.exports.getDomainByEmail = function (event, context, callback) {
    try {
        jsonLogger.info({ type: 'TRACKING', function: 'domain::getDomainByEmail', event, context });
        const data = _.get(event, 'queryStringParameters') || {}
        const { useremail } = data
        if (!useremail) {
            throw new Error('useremail param must be supplied for event');
        }

        const domainName = utils.extractDomainNameFromEmail(useremail)
        jsonLogger.info({ type: 'TRACKING', function: 'domain::getDomainByEmail', event, context });
        
        const federationName = DOMAINS_TO_FEDERATION_MAPPING[domainName]
        
        jsonLogger.info({ type: 'TRACKING', function: 'domain::getDomainByEmail', domainName, federationName });
        
        // currently sso for dev is disabled
        if (federationName && process.env.stage === 'prod') {
            return callback(null, responseLib.success({ domain: federationName }))
        }

        return callback(null, responseLib.success({ domain: LOCAL_DOMAIN_NAME }))

    } catch (error) {
        jsonLogger.error({ type: 'TRACKING', function: 'domain::getDomainByEmail', message: 'error handling get domain by email', error });
        return callback(error, responseLib.failure({ domain: LOCAL_DOMAIN_NAME }))
    }
}

