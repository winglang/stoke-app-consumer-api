/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */
/* eslint-disable require-atomic-updates */

'use strict';

const AWS = require('aws-sdk');
const crypto = require('crypto');
const { CompaniesService, constants, jsonLogger, snsLib } = require('stoke-app-common-api');
const { authSnsTopicArn } = process.env;
const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

const fs = require("fs");
const _ = require('lodash')


const ssm = new AWS.SSM();
const {
    PARAM_NAME_INVITATIONID_PASS,
    PARAM_NAME_INVITATIONID_SALT,
    CROSS_COMPANY_USER_POOL_ID,
    CONSUMER_URL_DOMAIN,
    customersTableName
} = process.env;
const params = {
    Names: [
        PARAM_NAME_INVITATIONID_PASS,
        PARAM_NAME_INVITATIONID_SALT
    ],
    WithDecryption: true
};
// eslint-disable-next-line prefer-named-capture-group
const emailRegex = new RegExp(`(.+)(\\+)(.+)(@.+)`, 'u');

const eventType = {
    verifyUserAttribute: 'CustomMessage_VerifyUserAttribute',
    adminCreateUser: 'CustomMessage_AdminCreateUser',
    signUp: 'CustomMessage_SignUp',
    forgotPassword: 'CustomMessage_ForgotPassword',
    updateUserAttribute: 'CustomMessage_UpdateUserAttribute',
}

const companiesService = new CompaniesService(customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes)

const generateExternalItemId = (suffix) => `${constants.prefix.userPoolId}${constants.prefix.external}${suffix}`

const getExternalItem = async (email) => {
    const registrationItemId = generateExternalItemId(email)
    const result = await companiesService.get(registrationItemId);
    
    if (!result) {
        jsonLogger.error({ type: "TRACKING", function: "companies::getOriginalItem", error: 'failed getting original item', registrationItemId });
        return false
    }

    return result
}

/* eslint-disable no-sync */
module.exports.customMessage = async (event, context, callback) => {
    jsonLogger.info({ type: 'TRACKING', function: 'auth::customMessage', event, context, CONSUMER_URL_DOMAIN });
    try {
        let data = null;
        let userEmail = null;
        switch (event.triggerSource) {
            case eventType.signUp:
            case eventType.forgotPassword:
            case eventType.verifyUserAttribute:
            case eventType.updateUserAttribute:
                data = await fs.readFileSync(`${__dirname}/templates/signUp.html`, 'utf8');
                userEmail = _.get(event, 'request.userAttributes.given_name', _.get(event, 'request.userAttributes.email'));
                data = data.replace('{username}', userEmail);
                event.response.emailMessage = data;
                event.response.emailSubject = process.env.WELCOME_EMAIL_SUBJECT;
                break;
            case eventType.adminCreateUser:
                if (event.userPoolId === CROSS_COMPANY_USER_POOL_ID) {
                    data = await fs.readFileSync(`${__dirname}/templates/welcomeCrossCompanyAdmin.html`, 'utf8');
                    const email = _.get(event, 'request.userAttributes.email');
                    data = data.replace('{usernameToReplace}', email);
                    const emailGroups = _.get(event, 'userName', '').match(emailRegex);
                    if (emailGroups && emailGroups.length > 4) {
                        // eslint-disable-next-line prefer-destructuring
                        const companyName = emailGroups[3];
                        data = data.replace('{companyName}', companyName);
                        data = data.replace('company-login/login', `company-login/login?entityName=${companyName}`);
                    }
                } else {
                    data = await fs.readFileSync(`${__dirname}/templates/welcome.html`, 'utf8');
                }
                data = data.replace('{consumerUrlDomain}', CONSUMER_URL_DOMAIN);
                event.response.emailMessage = data;
                event.response.emailSubject = process.env.SIGNUP_EMAIL_SUBJECT;
                break;
            default:
                jsonLogger.info({ type: 'TRACKING', function: 'auth::customMessage', text: 'Unsupported event.triggerSource', triggerSource: event.triggerSource });
        }
        return callback(null, event);
    } catch (e) {
        jsonLogger.error({ type: 'TRACKING', function: 'auth::customMessage', error: e.message });
    }
    const error = new Error('Invalid message');
    return callback(error, event);
};

/**
 * postAuthentication - CognitoUserPool PostAuthentication Lambda trigger
 * @public
 * @param {object} event lambda event
 * @param {object} context lambda context
 * @param {funcion} callback callback 
 * @returns {object} callback 
 */
module.exports.postAuthentication = async (event, context, callback) => {
    try {
        jsonLogger.info({ type: 'TRACKING', function: 'auth::postAuthentication', event, context });
        const userAttributes = _.get(event, 'request.userAttributes');
        if (userAttributes) {
            userAttributes.userPoolId = _.get(event, 'userPoolId');
            await snsLib.publish(authSnsTopicArn, 'postAuthentication', userAttributes);
        } else {
            jsonLogger.error({ type: 'TRACKING', function: 'auth::postAuthentication', text: 'Failed retrieving userAttributes', event });
        }
    } catch (e) {
        jsonLogger.error({ type: 'TRACKING', function: 'auth::postAuthentication', exception: e.message });
    }
    return callback(null, event);
};

/**
 * preTokenGeneration - CognitoUserPool PreTokenGeneration Lambda trigger
 * @public
 * @param {object} event lambda event
 * @param {object} context lambda context
 * @param {funcion} callback callback 
 * @returns {object} callback 
 */
module.exports.preTokenGeneration = /* async */ (event, context, callback) => {
    try {
        jsonLogger.info({ type: 'TRACKING', function: 'auth::preTokenGeneration', event, context });
    } catch (e) {
        jsonLogger.error({ type: 'TRACKING', function: 'auth::preTokenGeneration', exception: e.message });
    }
    return callback(null, event);
};

/**
 * cipher
 * @public
 * @param {string} input to encrypte
 * @returns {string}  encrypted 
 */
module.exports.cipherInput = async (input) => {
    const algorithm = 'aes-192-cbc';
    const result = await ssm.getParameters(params).promise();
    const password = result.Parameters.filter((param) => param.Name === PARAM_NAME_INVITATIONID_PASS)[0].Value;
    const salt = result.Parameters.filter((param) => param.Name === PARAM_NAME_INVITATIONID_SALT)[0].Value;
    // eslint-disable-next-line no-magic-numbers, no-sync
    const key = crypto.pbkdf2Sync(password, salt, 100000, 24, 'sha512');
    // eslint-disable-next-line no-magic-numbers
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(input, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted + iv.toString('hex');
};


/**
 * decrypt
 * @public
 * @param {string} input to decrypt
 * @returns {string}  decrypted
 */
const decrypt = async (input) => {
    const ivPosition = 32;

    if (input && input.length > ivPosition) {
        const result = await ssm.getParameters(params).promise();
        const algorithm = 'aes-192-cbc';
        const password = result.Parameters.filter((param) => param.Name === PARAM_NAME_INVITATIONID_PASS)[0].Value;
        const salt = result.Parameters.filter((param) => param.Name === PARAM_NAME_INVITATIONID_SALT)[0].Value;
        const keyLength = 24;
        const iterations = 100000;
        // eslint-disable-next-line no-sync
        const key = crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha512');
        const ivText = input.substring(input.length - ivPosition);
        // eslint-disable-next-line no-undef
        const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivText, 'hex'));
        // eslint-disable-next-line no-magic-numbers
        let decrypted = decipher.update(input.substring(0, input.length - ivPosition), 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    return null;
};

module.exports.decrypt = decrypt;

const getUserByEmail = (userPoolId, email) => {
    jsonLogger.info({ type: 'TRACKING', function: 'auth::getUserByEmail', userPoolId, email });
    const userParams = {
      UserPoolId: userPoolId,
      Filter: `email = '${email}'`
    }

    return cognitoidentityserviceprovider.listUsers(userParams).promise()
}

// when an exiting user is trying to connect with the same email address with external provider. based on: https://stackoverflow.com/questions/59635482/aws-cognito-best-practice-to-handle-same-user-with-same-email-address-signing
const linkProviderToUser = async (username, userPoolId, providerName, providerUserId) => {
    const linkParams = {
        DestinationUser: {
            ProviderAttributeValue: username,
            ProviderName: 'Cognito'
        },
        SourceUser: {
            ProviderAttributeName: 'Cognito_Subject',
            ProviderAttributeValue: providerUserId,
            ProviderName: providerName
        },
        UserPoolId: userPoolId
    }

    let result = {}
    
    try {
        jsonLogger.info({ type: 'TRACKING', function: 'auth::linkProviderToUser', text: 'about to connect account', userPoolId, linkParams });
        result = await cognitoidentityserviceprovider.adminLinkProviderForUser(linkParams).promise()
    } catch (error) {
        jsonLogger.error({ type: "TRACKING", function: 'auth::linkProviderToUser', text: 'failed connecting accounts', linkParams });
    }

    return result
}

module.exports.preSignUp = async (event, context, callback) => {
    // split the email address so we can compare domains
    const { email } = event.request.userAttributes;
    

    jsonLogger.info({
        type: "TRACKING",
        function: "users::preSignUp",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        email,
        request: event.request,
        event
    });
    
    if (event.triggerSource === constants.cognitoUserPoolLambdaTriggerSources.preSignUpAdminCreateUser) {
        jsonLogger.info({ type: "TRACKING", function: "users::preSignUp", text: `skipping validation due to trigger source: ${event.triggerSource}` });
        return callback(null, event);
    }
    
    if (event.triggerSource === constants.cognitoUserPoolLambdaTriggerSources.preSignUpExternalProvider) {
        jsonLogger.info({ type: "TRACKING", function: "users::preSignUp", text: 'external provider trigger source flow' });
        const { userName } = event
        const [
            group,
            userEmail
        ] = userName.split('_') // example: "OktaDevActiveFens_user@activefens.com"


        const usersByEmail = await getUserByEmail(event.userPoolId, userEmail)
        if (usersByEmail) {
            if (usersByEmail.Users.length > 0) {
                jsonLogger.info({ type: 'TRACKING', function: 'auth::preSignUp', message: 'found registered user. link provider to the existing', group, userEmail });
                if (usersByEmail.Users.length > 1) {
                    jsonLogger.error({ type: 'TRACKING', function: 'auth::preSignUp', message: `found more then single user with email ${userEmail}. aborting!` });
                    return callback(null, event); 
                }
                await linkProviderToUser(usersByEmail.Users[0].Username, event.userPoolId, group, userEmail)
                return callback(null, event); 
            }
        }

        const externalItem = await getExternalItem(userEmail.toLowerCase())
        
        if (externalItem && externalItem.itemStatus === constants.user.status.invited) {
            jsonLogger.info({ type: "TRACKING", 
                function: "users::preSignUp",
                username: event.userName,
                text: `skipping validation due to trigger source: ${event.triggerSource}` });
            
            return callback(null, event); 
        } 
        
        jsonLogger.error({ type: 'TRACKING', function: 'auth::preSignUp', message: 'external provider flow, but user was not invited, or domain is not registered as external under company settings', userEmail });
        const error = new Error('PreSignUp failed with error Invalid Invitation ID');
        return callback(error, event);
    }

    try {
        if (event.request.validationData) {
            const { invitationId, accountType = constants.accountTypes.freemium } = event.request.validationData;
            const decrypted = await decrypt(invitationId);

            jsonLogger.info({
                type: "TRACKING",
                function: "users::preSignUp",
                functionName: context.functionName,
                awsRequestId: context.awsRequestId,
                text: 'decrypted invitationId',
                decrypted,
            });

            if (decrypted && email && decrypted.toLowerCase() === `${email.toLowerCase()}_${accountType.toLowerCase()}`) {
                return callback(null, event);
            }
        }
    } catch (e) {
        jsonLogger.info({
            type: "TRACKING",
            function: "users::preSignUp",
            functionName: context.functionName,
            awsRequestId: context.awsRequestId,
            text: 'exception',
            error: e.message
        });
    }
    const error = new Error('Invalid Invitation ID');
    // return error to Amazon Cognito
    return callback(error, event);
}

const createNewCustomer = async (originalItem, email, sub) => {
    jsonLogger.info({ type: "TRACKING", function: "auth::createNewCustomer", originalItem, email, sub });
    const newItem = { ...originalItem };
    newItem.itemId = generateExternalItemId(sub);
    _.set(newItem, 'userEmail', email)
    _.set(newItem, 'itemData.userEmail', email)
    const result = await companiesService.create(newItem)

    if (!result) {
        jsonLogger.error({ type: "TRACKING", function: "auth::createNewCustomer", error: 'failed creating new customer', sub });
        return false
    }

    return true
}

module.exports.updateUserData = async (email, sub) => {
    jsonLogger.info({ type: "TRACKING", function: "users::updateUserData", sub, email });

    // refers to cognito data
    if (!sub || !email) {
        return false
    }

    const originalItem = await getExternalItem(email.toLowerCase())
    if (!originalItem) {
        jsonLogger.error({ type: "TRACKING", function: "companies::signUpToCompany", error: 'failed to get user', email });
        return false
    }

    const newItem = await createNewCustomer(originalItem, email, sub)
    if (!newItem) {
        jsonLogger.error({ type: "TRACKING", function: "companies::signUpToCompany", error: 'failed creating new item', sub });
        return false
    }

    try {
        jsonLogger.info({ type: "TRACKING", function: "companies::signUpToCompany", text: `about to archive item with Id: ${originalItem.itemId}` });
        await companiesService.archive({ itemId: originalItem.itemId }, sub)
    } catch (error) {
        jsonLogger.error({ type: "TRACKING", function: "companies::signUpToCompany", text: 'failed cleaning old item', originalItem, error });
    }
    
    return true
}

module.exports.postConfirmation = async (event, context, callback) => {
    jsonLogger.info({
        type: "TRACKING",
        function: "users::postConfirmation",
        functionName: context.functionName,
        awsRequestId: context.awsRequestId,
        request: event.request
    });


    if (event.triggerSource === constants.cognitoUserPoolLambdaTriggerSources.postConfirmationConfirmSignUp && _.get(event, 'request.userAttributes.cognito:user_status') === 'EXTERNAL_PROVIDER') {
        try {
            const { userName } = event // should be "group_mail"
            const [
                // eslint-disable-next-line no-unused-vars
                _group,
                userEmail
            ] = userName.split('_')

            jsonLogger.info({ type: "TRACKING", function: "auth::postConfirmation", text: `handling confirmation due to trigger source: ${event.triggerSource}` });
            const userSub = event.request.userAttributes.sub

            const updatedUser = await module.exports.updateUserData(userEmail, userSub)
            if (updatedUser) {
                jsonLogger.info({ type: "TRACKING", function: "auth::postConfirmation", updatedUser });
                return callback(null, event);
            }

            throw new Error('Failed updating external user data');
        } catch (error) {
            jsonLogger.info({ type: "TRACKING", function: "auth::postConfirmation", text: 'Failed handling external registration', error });
            return callback(error, event);
        }
    }

    jsonLogger.info({ type: "TRACKING", function: "auth::postConfirmation", text: `skipping confirmation due to trigger source: ${event.triggerSource}` });
    return callback(null, event);
}
