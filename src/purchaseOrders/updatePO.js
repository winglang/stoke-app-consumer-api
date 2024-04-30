/* eslint-disable max-lines */
/* eslint-disable no-magic-numbers */

'use strict';

const {
    consumerAuthTableName,
    budgetsTableName,
    gsiItemsByCompanyIdAndItemIdIndexNameV2,
    userActionsSnsTopicArn,
} = process.env;
const { UsersService, POService, constants, jsonLogger, responseLib, prefixLib, idConverterLib, snsLib } = require('stoke-app-common-api');
const _ = require('lodash');
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const poService = new POService(budgetsTableName, constants.projectionExpression.defaultAndRangeAttributes, constants.attributeNames.defaultAttributes);
const { getPOTypesByUsage, calculateUnassignedAmount, checkIsValidPOScope, checkIsValidPOScopeType } = require('./normalizer')

const poUpdateParams = {
    address: 'address',
    scopeIds: 'scopeIds',
    scopeType: 'scopeType',
    usageType: 'usageType',
    description: 'description',
    validFrom: 'validFrom',
    validTo: 'validTo',
    isReopenPO: 'isReopenPO',
};

const isValidToUpdatePO = async (poItem, amount) => {
    if (poItem.available + amount < 0) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePO::isValidToUpdatePO',
            message: 'No enough available budget in PO', poItem, amount
        });
        return false;
    }

    const { itemId, entityId: companyId } = poItem || {};
    const mainPOId = idConverterLib.getMainPOIdFromPOItemId(itemId);
    const isLineItem = mainPOId !== poItem.itemId;
    if (!isLineItem || amount < 0) {
        return true;
    }
    // eslint-disable-next-line no-undefined
    const blanketItems = await poService.listPOsV2(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, undefined, undefined, undefined, undefined, mainPOId);
    if (_.isEmpty(blanketItems)) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePO::isValidToUpdatePO',
            message: 'Blanket PO not found', poItem, mainPOId
        });
        return false;
    }

    const blanketUnassignedAmount = calculateUnassignedAmount(blanketItems);
    if (amount > blanketUnassignedAmount) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePO::isValidToUpdatePO',
            message: 'No enought unassigned budget on top level po', companyId, blanketUnassignedAmount, amount, blanketItems
        });
        return false;
    }
    return true;
}

const isValidScope = (newData, poItem, changedAttributes = []) => {
    const { companyId, itemData } = poItem;
    const isChangedScopeIds = changedAttributes.includes(poUpdateParams.scopeIds);
    const isChangedPOTypes = changedAttributes.includes(poUpdateParams.usageType);
    const isChangedPOScopeType = changedAttributes.includes(poUpdateParams.scopeType);
    if (isChangedScopeIds && isChangedPOTypes) {
        return checkIsValidPOScope(newData, companyId)
    }

    let isValid = true;
    if (isChangedPOTypes && newData[poUpdateParams.usageType].includes(constants.poTypes.globalFees)) {
        isValid = _.includes(itemData.poScope.scopeIds, companyId);
    }
    if (isChangedScopeIds) {
        isValid = !_.includes(itemData.poScope.poTypes, constants.poTypes.globalFees) || newData[poUpdateParams.scopeIds].includes(companyId);
    }
    if (isChangedPOScopeType) {
        return checkIsValidPOScopeType(newData[poUpdateParams.scopeType], itemData.poScope.scopeIds, companyId);
    }
    if (!isValid) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePO::isValidScope',
            message: 'Global fees po needs to be defined for entire company', newData, itemData, companyId
        });
    }
    return isValid;
}

const isValidUpdateParams = (poItem, poId, data) => {
    const mainPO = idConverterLib.getMainPOIdFromPOItemId(_.get(poItem, 'itemId'));
    const isBlanketPO = _.get(poItem, 'itemData.isBlanketPO');
    const isLineItem = mainPO !== poId;

    const paramsToUpdate = Object.keys(data);
    return _.every(paramsToUpdate, (paramType) => {
        switch (paramType) {
            case poUpdateParams.scopeType:
            case poUpdateParams.scopeIds:
            case poUpdateParams.usageType: {
                return !isBlanketPO && isValidScope(data, poItem, paramsToUpdate)
            }
            case poUpdateParams.address: {
                return !isLineItem;
            }
            default:
                return true;
        }
    })
}

const isActiveItem = (item) => {
    const expirationDate = _.get(item, 'validTo');
    return !expirationDate || expirationDate >= Date.now();
}

const updateDatesOnItems = async (companyId, userId, mainPoId, updatedDetails) => {
    // eslint-disable-next-line no-undefined
    const blanketItems = await poService.listPOsV2(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, undefined, undefined, undefined, undefined, `${mainPoId}_`);
    const updatedExpiration = _.pick(updatedDetails, [poUpdateParams.validFrom, poUpdateParams.validTo]);
    const promises = [];
    for (const item of blanketItems) if (isActiveItem(item)) {
        promises.push(poService.updatePODetails(companyId, item.itemId, userId, updatedExpiration))
    }
    const result = await Promise.all(promises);
    jsonLogger.info({
        type: 'TRACKING', function: 'updatePO::updateDatesOnItems',
        message: 'Update items expiration dates', companyId, updatedExpiration, result,
    });
    return result;
}

const reopenLineItems = async (companyId, userId, mainPOId, isBlanketPO) => {
    const items = isBlanketPO
        // eslint-disable-next-line no-undefined
        ? await poService.listPOsV2(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, undefined, undefined, undefined, undefined, mainPOId)
        : [await poService.get(companyId, idConverterLib.getMainPOIdFromPOItemId(mainPOId))];
    const promises = [];

    for (const item of items) {
        const isClosed = !isActiveItem(item);
        if (isClosed) {
            promises.push(poService.updatePODetails(
                companyId,
                item.itemId,
                userId,
                { [poUpdateParams.isReopenPO]: true }
            ))
        }
    }
    const result = await Promise.all(promises);
    jsonLogger.info({
        type: 'TRACKING', function: 'updatePO::reopenLineItems',
        message: 'Reopen line items', companyId, mainPOId, result,
    });
    return result;
}

const sendClickUpTask = async (userId, companyId, poItem, isAmountChaged) => {
    let poNumber = _.get(poItem, 'itemData.poNumber');
    const poId = _.get(poItem, 'itemId');
    const mainPOId = idConverterLib.getMainPOIdFromPOItemId(_.get(poItem, 'itemId'));
    const isLineItem = mainPOId !== poId;

    if (isLineItem) {
        const mainPOItem = await poService.get(companyId, mainPOId);
        poNumber = `${_.get(mainPOItem, 'itemData.poNumber')} - ${poNumber}`;
    }

    const message = isAmountChaged ? `Amount of PO ${poNumber} is changed ` : `PO ${poNumber} details were changed `;
    // eslint-disable-next-line no-magic-numbers
    await snsLib.publish(userActionsSnsTopicArn, constants.OperationalTasks.PO_VALIDATION, { userId, companyId, message, poNumber, date: new Date().getTime() });

}

// eslint-disable-next-line max-lines-per-function
const updatePODetails = async (companyId, poId, userId, data) => {
    jsonLogger.info({
        type: 'TRACKING', function: 'updatePO::updatePODetails',
        message: 'Update po details', companyId, poId, userId, data
    });

    const poItem = await poService.get(companyId, poId);
    if (!poItem || _.isEmpty(poItem)) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePO::updatePODetails',
            message: 'PO is not found', companyId, poItem
        });
        return responseLib.failure({ status: false });
    }

    const isValidParams = isValidUpdateParams(poItem, poId, data);
    if (!isValidParams) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePO::updatePODetails',
            message: 'Update parameters are not valid for this po type', companyId, poId, userId, data
        });
        return responseLib.failure({ status: false });
    }
    const updatedDetails = {};
    _.forEach(Object.keys(data), paramType => {
        switch (paramType) {
            case poUpdateParams.description:
            case poUpdateParams.scopeType:
            case poUpdateParams.scopeIds:
            case poUpdateParams.validFrom:
            case poUpdateParams.validTo:
            case poUpdateParams.address: {
                updatedDetails[paramType] = data[paramType];
                break;
            }
            case poUpdateParams.usageType: {
                updatedDetails.poTypes = _.map(data[paramType], type => getPOTypesByUsage(type));
                break;
            }
            case poUpdateParams.isReopenPO: {
                updatedDetails[poUpdateParams.isReopenPO] = true;
                break;
            }
            default:
                jsonLogger.info({
                    type: 'TRACKING', function: 'updatePO::updatePODetails',
                    message: 'This parameter is not exposed for update', companyId, poId, userId, paramType
                });
                break;
        }
    })

    if (_.isEmpty(updatedDetails)) {
        jsonLogger.info({
            type: 'TRACKING', function: 'updatePO::updatePODetails',
            message: 'No update parameters', companyId, poId, userId, data, updatedDetails
        });
        return responseLib.failure({ status: false });
    }
    const result = await poService.updatePODetails(companyId, poId, userId, updatedDetails);
    const isBlanketPO = _.get(poItem, 'itemData.isBlanketPO');
    const mainPO = idConverterLib.getMainPOIdFromPOItemId(_.get(poItem, 'itemId'));
    const isLineItem = mainPO !== poId;

    if (isBlanketPO && (Object.keys(updatedDetails).includes(poUpdateParams.validFrom) || Object.keys(updatedDetails).includes(poUpdateParams.validTo))) {
        await updateDatesOnItems(companyId, userId, poId, updatedDetails)
    } else if ((isBlanketPO || isLineItem) && Object.keys(updatedDetails).includes(poUpdateParams.isReopenPO)) {
        await reopenLineItems(companyId, userId, poId, isBlanketPO)
    }
    await sendClickUpTask(userId, companyId, poItem);
    return responseLib.success(result);
} 

const updatePOAmount = async (companyId, poId, userId, amount) => {
    if (!poId || !amount || !prefixLib.isPO(poId)) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePO::updatePOAmount',
            message: 'Missing mandatory parameters to update PO', companyId, poId, userId,
        });
        return responseLib.failure({ status: false });
    }

    const poItem = await poService.get(companyId, poId);

    if (_.isEmpty(poItem)) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePO::updatePOAmount',
            message: 'PO item was not found', companyId, userId, poId, amount
        });
        return responseLib.failure({ status: false });
    }

    const isValid = await isValidToUpdatePO(poItem, amount);
    if (!isValid) {
        return responseLib.failure({ status: false });
    }

    const result = await poService.updatePOAmount(companyId, poId, userId, amount);
    if (_.isEmpty(result)) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePO::updatePOAmount',
            message: 'Failed to update PO', companyId, userId, poId, amount
        });
        return responseLib.failure({ status: false });
    }

    await sendClickUpTask(userId, companyId, poItem, true)
    return responseLib.success(result);
}

// eslint-disable-next-line max-lines-per-function
module.exports.handler = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId, poId } = event.pathParameters;

    jsonLogger.info({ type: 'TRACKING', function: 'updatePO::handler', functionName: context.functionName, awsRequestId: context.awsRequestId, userId, companyId, event });

    const authorised = await usersService.validateUserEntity(userId, companyId, constants.user.role.admin);
    if (!authorised) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePO::handler', functionName: context.functionName,
            message: 'Only company admins can update POs'
        });
        return responseLib.forbidden({ status: false });
    }
    const data = JSON.parse(event.body);
    const changedAttributes = Object.keys(data);
    if (!poId || !prefixLib.isPO(poId) || _.isEmpty(changedAttributes)) {
        jsonLogger.error({
            type: 'TRACKING', function: 'updatePO::handler',
            message: 'Missing mandatory parameters to update PO', companyId, poId, userId, data
        });
        return responseLib.failure({ status: false });
    }

    if (changedAttributes.includes('amount')) {
        const { amount } = data;
        return updatePOAmount(companyId, poId, userId, amount);
    }

    return updatePODetails(companyId, poId, userId, data);
    
};
