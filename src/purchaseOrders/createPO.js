'use strict';

const {
    consumerAuthTableName,
    budgetsTableName,
    gsiItemsByCompanyIdAndItemIdIndexNameV2,
    userActionsSnsTopicArn,
} = process.env;
const { UsersService, POService, constants, jsonLogger, responseLib, formatterLib, snsLib } = require('stoke-app-common-api');
const _ = require('lodash');
const uuidv1 = require("uuid/v1");
const { normalizeResponse, getPOTypesByUsage, checkIsValidPOScope } = require('./normalizer')
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const poService = new POService(budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);

const itemsAddedMessage = 'New items are added to PO Number: ';
const newPOCreatedMessage = 'New PO is created; PO Number: ';

// eslint-disable-next-line max-params
const generatePOItem = (companyId, userId, data, isBlanketPO, blanketPOid) => {
    const { poNumber, description, amount, validFrom, validTo, scopeIds, scopeType, usageType, address } = data;
    return {
        itemId: `${blanketPOid ? `${blanketPOid}_` : `${constants.prefix.po}${formatterLib.formatName(poNumber)}`}${uuidv1()}`,
        companyId,
        createdBy: userId,
        validFrom,
        validTo,
        amount,
        poNumber,
        address,
        poScope: {
            scopeIds,
            scopeType,
            poTypes: _.map(usageType, type => getPOTypesByUsage(type)),
        },
        description,
        isBlanketPO,
    }
}

const isLineItemsAmountValid = (amount, lineItems) => {
    const isValidAmount = amount >= _.sumBy(lineItems, 'amount');
    if (!isValidAmount) {
        jsonLogger.error({ 
            type: 'TRACKING', function: 'craetePO::isLineItemsAmountValid',
            message: 'Line items should not exceed PO planket amount', amount, lineItems
        });
    }
    return isValidAmount;
}

const createLineItems = (blanketPO, lineItems, userId) => {
    if (_.isEmpty(blanketPO) || _.isEmpty(lineItems)) {
        return [];
    }
    const { itemId, companyId, validFrom, validTo } = blanketPO;
    const amount = _.get(blanketPO, 'itemData.totalAmount');
    const results = [];
    const isValidLineItems = isLineItemsAmountValid(amount, lineItems)
    if (isValidLineItems) {
        const blanketId = itemId;
        for (const lineItem of lineItems) {
            const itemToCreate = generatePOItem(companyId, userId, { ...lineItem, validFrom, validTo }, false, blanketId);
            results.push(poService.create(itemToCreate))
        }
    }
    return results;
}

const checkPONUmberUniqness = async (companyId, poNumber) => {
    const keyConditionExpression = 'companyId = :companyId AND begins_with(itemId, :prefix)';
    const expressionAttributeValues = {
        ':companyId': companyId,
        ':prefix': constants.prefix.po,
        ':newPONumber': poNumber,
    };
    const expressionAttributeNames = {
        '#itemData': 'itemData',
        '#poNumber': 'poNumber',
    };
    const filterExpression = "attribute_exists(#itemData.#poNumber) AND #itemData.#poNumber = :newPONumber";
    const response = await poService.query(gsiItemsByCompanyIdAndItemIdIndexNameV2, keyConditionExpression, expressionAttributeValues, filterExpression, expressionAttributeNames);
    return _.isEmpty(response);
}

// eslint-disable-next-line max-params
const sendClickUpTask = async (userId, companyId, mainPO, lineItems, isAddItemsToExistingPO) => {
    const mainPoNumber = _.get(mainPO, 'itemData.poNumber');
    const lineItemNumbers = _.join(_.map(lineItems, (lineItem) => _.get(lineItem, 'itemData.poNumber')), '; ');
    const actionDescription = isAddItemsToExistingPO ? itemsAddedMessage : newPOCreatedMessage;
    // eslint-disable-next-line no-magic-numbers
    const message = `${actionDescription}${mainPoNumber}${_.size(lineItems) ? ` - ${lineItemNumbers}` : ''}`;
    const poNumber = isAddItemsToExistingPO ? `${mainPoNumber} - ${lineItemNumbers}` : mainPoNumber;
    await snsLib.publish(userActionsSnsTopicArn, constants.OperationalTasks.PO_VALIDATION, { userId, companyId, message, poNumber, date: new Date().getTime() });

}

const addLineItemsToExistingPO = async (companyId, blanketPOId, lineItems, userId) => {
    const blanketPO = await poService.get(companyId, blanketPOId);

    if (_.isEmpty(blanketPO)) {
        jsonLogger.error({
            type: 'TRACKING', function: 'craetePO::addLineItemsToExistingPO',
            message: 'Blanket po is not found, lineItems will not be created ', companyId, blanketPOId, lineItems
        });
        return responseLib.failure({ status: false });
    }
    const createdLineItems = await Promise.all(createLineItems(blanketPO, lineItems, userId));
    if (createdLineItems.some(res => !res || _.isEmpty(res))) {
        jsonLogger.error({
            type: 'TRACKING', function: 'craetePO::addLineItemsToExistingPO',
            message: 'Some lineItems were not created ', companyId, blanketPOId, lineItems
        });
        return responseLib.failure({ status: false });
    }
    
    const response = normalizeResponse(companyId, createdLineItems);
    await sendClickUpTask(userId, companyId, blanketPO, createdLineItems, true)
    return responseLib.success(response);
}

// eslint-disable-next-line max-lines-per-function
module.exports.handler = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId, poId } = event.pathParameters;

    jsonLogger.info({ type: 'TRACKING', function: 'craetePO::handler', functionName: context.functionName, awsRequestId: context.awsRequestId, userId, companyId, event });

    const authorised = await usersService.validateUserEntity(userId, companyId, constants.user.role.admin);
    if (!authorised) {
        jsonLogger.error({
            type: 'TRACKING', function: 'craetePO::handler', functionName: context.functionName,
            message: 'Only companyadmins create POs'
        });
        return responseLib.forbidden({ status: false });
    }
    const data = JSON.parse(event.body);
    const { poNumber, amount, validFrom, validTo, isBlanketPO, lineItems } = data;

    if (poId) {
        return addLineItemsToExistingPO(companyId, poId, lineItems, userId);
    }

    if (!poNumber || !amount) {
        jsonLogger.error({ type: 'TRACKING', function: 'craetePO::handler',
        message: 'Missing mandatory parameters to craete PO', companyId, userId, data });
        return responseLib.failure({ status: false });
    }

    if ((validFrom || validTo) && !(validFrom && validFrom)) {
        jsonLogger.error({ type: 'TRACKING', function: 'craetePO::handler',
        message: 'PO expiration requires validFrom and validTo', companyId, userId, data });
        return responseLib.failure({ status: false });
    }

    const isUniqPONUmber = await checkPONUmberUniqness(companyId, poNumber)
    if (!isUniqPONUmber) {
        jsonLogger.error({
            type: 'TRACKING', function: 'craetePO::handler',
            message: 'PO number must be unique', companyId, userId, data,
        });
        return responseLib.failure({ status: false });
    }

    const isValidPOScope = isBlanketPO || checkIsValidPOScope(data, companyId)
    if (!isValidPOScope) {
        return responseLib.failure({ status: false });
    }

    const poItem = generatePOItem(companyId, userId, data, isBlanketPO);
    const mainPO = await poService.create(poItem);
    if (!mainPO || _.isEmpty(mainPO)) {
        jsonLogger.error({
            type: 'TRACKING', function: 'craetePO::handler',
            message: 'PO was not created', companyId, userId, data
        });
        return responseLib.failure({ status: false });
    }
    
    let createdLineItems = [];
    if (isBlanketPO && !_.isEmpty(lineItems)) {
        createdLineItems = await Promise.all(createLineItems(mainPO, lineItems, userId));
    }
    const results = [mainPO, ...createdLineItems];
    if (results.some(res => !res || _.isEmpty(res))) {
        jsonLogger.error({
            type: 'TRACKING', function: 'craetePO::handler',
            message: 'Error in creating some lineItems in blanket PO', companyId, lineItems, results
        });
    }
    
    const response = normalizeResponse(companyId, results);
    await sendClickUpTask(userId, companyId, mainPO, createdLineItems)

    return responseLib.success(response);
};
