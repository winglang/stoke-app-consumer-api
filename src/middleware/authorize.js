'use strict';

const _ = require('lodash');
const { jsonLogger, CompaniesService, constants, utils } = require('stoke-app-common-api');
const { DOMAINS_TO_FEDERATION_MAPPING } = require('../../resources/externalDomains');
const { customersTableName } = process.env;
const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

module.exports.handler = async (event, context) => {
    jsonLogger.info({ type: 'TRACKING', function: 'authorize::handler', event });
    if (_.get(event, 'requestContext.identity.cognitoIdentityId')) {
        return true;
    }

    try {
        const userpoolId = _.get(event, 'requestContext.authorizer.claims.sub'); 

        const username = _.get(event, ['requestContext', 'authorizer', 'claims', 'cognito:username']); 
        const domainName = utils.extractDomainNameFromEmail(username)
        const isFederationDomain = Boolean(DOMAINS_TO_FEDERATION_MAPPING[domainName])
        const userIdToFetch = isFederationDomain 
            ? `${constants.prefix.userPoolId}${constants.prefix.external}${userpoolId}` 
            : `${constants.prefix.userPoolId}${userpoolId}`

        const user = await companiesService.get(userIdToFetch)
        const userId = _.get(user, 'userId');
        if (!userId) {
            jsonLogger.error({ type: 'TRACKING', function: 'authorize::handler', message: 'missing IdentityId' });
            context.end();
            return false;
        }
        const status = _.get(user, 'itemStatus');
        if (status !== constants.user.status.active) {
            context.end();
            return false;
        }
        const companyId = _.get(user, 'companyId');
        _.set(event, 'requestContext.identity.cognitoIdentityId', userId);
        _.set(event, 'queryStringParameters.companyId', companyId);
        return true;
    } catch (error) {
        jsonLogger.error({ type: 'TRACKING', function: 'authorize::handler', error: error.message });
    }

    context.end();
    return false;
};
