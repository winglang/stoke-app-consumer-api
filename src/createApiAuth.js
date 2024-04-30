'use strict';

/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */

const AWS = require('aws-sdk');
const _ = require('lodash');
const { constants, jsonLogger, responseLib, SettingsService, UsersService, permisionConstants } = require('stoke-app-common-api');
const { consumerAuthTableName, settingsTableName, USER_POOL_ID, REFRESH_TOKEN_TIME, ACCESS_TOKEN_TIME, consumerUserPoolAuthResourceServerCustomCompanyName, consumerUserPoolAuthResourceServerDomainName, consumerUserPoolAuthServerDomainName } = process.env;
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const createLoginUrl = (appClient, redirectUrl) => `https://${consumerUserPoolAuthServerDomainName}/login?response_type=code&client_id=${_.get(appClient, 'UserPoolClient.ClientId')}&redirect_uri=${redirectUrl}`

module.exports.handler = async (event, context, callback) => {
    jsonLogger.info({ type: "TRACKING", function: "createApiAuth::handler", event, context, callback });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body || {});
    const { companyId, redirectUrl } = data;

    if (!companyId || !redirectUrl) {
        const message = "missing required params";
        jsonLogger.error({ type: "TRACKING", function: "createApiAuth::handler", message });
        return responseLib.failure({ status: false, message });
    }

    const role = await usersService.getUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.advancedSettings]: { isEditor: true } });
    if (role !== constants.user.role.admin) {
        return responseLib.forbidden();
    }
    const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
    let appClient = {};
    const settingCompanyId = `${constants.prefix.company}${companyId}`;
    const settings = await settingsService.get(settingCompanyId)
    const clientId = _.get(settings, `itemData.apiSetting.clientIds.${consumerUserPoolAuthResourceServerCustomCompanyName}`);
    if (clientId) {
        jsonLogger.info({ type: "TRACKING", function: "createApiAuth::handler", MESSAGE: 'Find existing clientId' });
        appClient = await cognitoidentityserviceprovider.describeUserPoolClient({ ClientId: clientId, UserPoolId: USER_POOL_ID }).promise();
    } else {
        jsonLogger.info({ type: "TRACKING", function: "createApiAuth::handler", MESSAGE: 'Try to create new app client' });
        const params = {
            ClientName: `${consumerUserPoolAuthResourceServerCustomCompanyName}-${companyId}`,
            UserPoolId: USER_POOL_ID,
            RefreshTokenValidity: REFRESH_TOKEN_TIME,
            AccessTokenValidity: ACCESS_TOKEN_TIME,
            TokenValidityUnits: {
                AccessToken: 'hours',
                RefreshToken: 'days'
            },
            AllowedOAuthFlows: ['code'],
            AllowedOAuthScopes: [`${consumerUserPoolAuthResourceServerDomainName}/${consumerUserPoolAuthResourceServerCustomCompanyName}`],
            AllowedOAuthFlowsUserPoolClient: true,
            CallbackURLs: [redirectUrl],
            LogoutURLs: [redirectUrl],
            ExplicitAuthFlows: [
                'ALLOW_CUSTOM_AUTH',
                'ALLOW_REFRESH_TOKEN_AUTH',
                'ALLOW_USER_PASSWORD_AUTH'
            ],
            SupportedIdentityProviders: ['COGNITO'],
            GenerateSecret: true,
            PreventUserExistenceErrors: 'ENABLED'
    
        };
        appClient = await cognitoidentityserviceprovider.createUserPoolClient(params).promise();
        jsonLogger.info({ type: "TRACKING", function: "createApiAuth::handler", MESSAGE: 'Finish to create new app client', clientId: _.get(appClient, 'UserPoolClient.ClientId') });
        const settingsUpdate = await settingsService.update({ itemId: settingCompanyId, modifiedBy: userId, data: { loginUrl: createLoginUrl(appClient, redirectUrl), redirectUrl, clientIds: { [consumerUserPoolAuthResourceServerCustomCompanyName]: _.get(appClient, 'UserPoolClient.ClientId') } } }, 'set', 'apiSetting')
        if (!settingsUpdate) {
            jsonLogger.error({ type: "TRACKING", function: "createApiAuth::handler", message: 'cant update clientId in setting', companyId });
            return responseLib.failure();
        }
    }
    const result = {
        clientId: _.get(appClient, 'UserPoolClient.ClientId'),
        clientSecret: _.get(appClient, 'UserPoolClient.ClientSecret'),
        url: `https://${consumerUserPoolAuthServerDomainName}/oauth2/token`,
        loginUrl: createLoginUrl(appClient, redirectUrl),
    };
    jsonLogger.info({ type: "TRACKING", function: "createApiAuth::handler", result: _.omit(result, 'clientSecret') });

    return appClient ? responseLib.success(result) : responseLib.failure();
}
