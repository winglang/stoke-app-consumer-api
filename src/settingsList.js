/* eslint-disable max-lines-per-function */

'use strict';

const _ = require('lodash');

const { ListService, constants } = require('stoke-app-common-api');
const commonApi = require('stoke-app-common-api');
const { jsonLogger, responseLib } = commonApi;
const listService = new ListService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes)

const AUTOMATIC_CREATE_LIST_TYPES = [constants.settingsListTypes.talentCloud, constants.settingsListTypes.talentDirectory] // currently not supporting automated creation

const isOperationAllowed = (entityType, entityId, userId) => {
    jsonLogger.info({ type: 'TRACKING', function: 'settingsList::isOperationAllowed', entityType, entityId, userId });
    if (entityType === constants.scope.user) {
        if (!userId) {
            jsonLogger.error({ type: 'TRACKING', function: 'settingsList::isOperationAllowed', messgage: 'missing user id. Are you authenticated?' });
            return false
        }

        return true
    }
    
    jsonLogger.error({ type: 'TRACKING', function: 'settingsList::isOperationAllowed', messgage: '***currently supporting only user scope***' });
    return false

}

// eslint-disable-next-line max-params
const handleUpdate = async (entityType, entityId, listType, userId, listId, actionType, values) => {
    jsonLogger.info({ type: 'TRACKING', function: 'settingsList::handleUpdate', entityType, entityId, listType, userId, listId, actionType, values });
    let response = null;
    
    if (actionType === constants.settingsListActionTypes.add) {
        response = await listService.addItems(entityType, entityId, userId, listType, listId, values)
    } else {
        response = await listService.removeItems(entityType, entityId, userId, listType, listId, values)
    }

    return response
}

// eslint-disable-next-line max-params
const handleMultiUpdate = async (entityType, entityId, userId, body, listType) => {
    jsonLogger.info({ type: 'TRACKING', function: 'settingsList::handleMultiUpdate', entityType, entityId, userId, body, listType });
    
    const data = JSON.parse(body)
    
    const { updatedItems } = data;
    const updatedItemsAsArray = _.castArray(updatedItems)

    if (_.isEmpty(updatedItemsAsArray)) {
        jsonLogger.error({ type: 'TRACKING', function: 'settingsList::handleMultiUpdate', message: 'empty data array' });
        throw new Error(`Missing updatedItems body param, for list type: ${listType}`);
    }

    jsonLogger.info({ type: 'TRACKING', function: 'settingsList::handleMultiUpdate', message: `about to update the following items ${updatedItemsAsArray}` });
    const response = await Promise.all(updatedItemsAsArray.map(async (itemToUpdate) => {
        const { actionType, listId } = itemToUpdate
        const values = _.castArray(itemToUpdate.ids)

        jsonLogger.info({ type: 'TRACKING', function: 'settingsList::handleMultiUpdate', message: `updating item::: ${actionType}, ${listId}, ${values} ` });
        const result = await handleUpdate(entityType, entityId, listType, userId, listId, actionType, values)

        return result
    }))

    return response
}

/**
 * @param {Object} event - event data - should include filter type
 * @param {Object} context - context data
 * @returns {Object} success / failure indication
 */
// eslint-disable-next-line complexity
const handler = async (event) => {
    jsonLogger.info({ type: 'TRACKING', function: 'settingsList::handler', event });
    const userId = event.requestContext.identity.cognitoIdentityId;

    const method = event.requestContext.httpMethod
    const { pathParameters, queryStringParameters, multiValueQueryStringParameters } = event;
    const { entityType, listType, listName } = pathParameters || {};
    let { entityId } = pathParameters || {}
    const { actionType, ids } = multiValueQueryStringParameters || {};
    const { listTypeToFetch, listIdToFetch, fetchActiveOnly = false } = queryStringParameters || {}
    
    const escapedListName = decodeURI(listName)
 
    jsonLogger.info({ type: 'TRACKING', function: 'settingsList::handler', message: 'list action params:', method, ...{ entityType, entityId, listType, listName, escapedListName, ids, fetchActiveOnly } });
    let response = {}

    if (!isOperationAllowed(entityType, entityId, userId)) {
        jsonLogger.error({ type: 'TRACKING', function: 'settingsList::handler', messgage: 'unauthorised operation', entityType, entityId, userId });
        return responseLib.forbidden({ status: false });
    }

    // [TODO] - fix this after serverless issue resolved
    const listId = listName
    entityId = userId

    try {
        switch (method) {
            case constants.httpActions.post:
                
                // eslint-disable-next-line no-case-declarations
                const { listName: listNameToCreate } = JSON.parse(event.body)
                jsonLogger.info({ type: 'TRACKING', function: 'settingsList::handler', messgage: 'Create new list with name:', listNameToCreate });
                
                response = await listService.create(entityType, entityId, userId, listType, listNameToCreate)
                
                if (!response) {
                    throw new Error(`Failed creating list: ${listType}, ${listNameToCreate}`);
                }
                return responseLib.success({ response })
            case constants.httpActions.patch:

                // eslint-disable-next-line no-case-declarations
                const { newListName: newListNameToCreate } = JSON.parse(event.body)

                jsonLogger.info({ type: 'TRACKING', function: 'settingsList::handler', messgage: 'Rename list with name:', newListNameToCreate });

                response = await listService.changeListName(entityType, entityId, userId, listType, listId, decodeURI(newListNameToCreate))
                
                if (!response) {
                    throw new Error(`Failed updating list name: ${listType}, ${listId}. new name: ${decodeURI(newListNameToCreate)}`);
                }
                return responseLib.success({ response })
            case constants.httpActions.put:
                response = await handleMultiUpdate(entityType, entityId, userId, event.body, listType)
                
                if (!response) {
                    throw new Error(`Failed updating list: ${listType}, ${listId}, ${actionType}`);
                }

                return responseLib.success({ status: true })
            case constants.httpActions.get:
                response = await listService.get(entityType, entityId, listTypeToFetch, listIdToFetch, fetchActiveOnly)
                
                return responseLib.success({ response })
            case constants.httpActions.delete:
                response = await listService.deleteList(entityType, entityId, userId, listType, listId)
                if (!response) {
                    throw new Error(`Failed deleting list: ${listType}, ${listId}`);
                }

                return responseLib.success({ status: true })
            default:
                throw new Error(`action not found ${method}`);
        }
    } catch (error) {
        jsonLogger.error({ type: 'TRACKING', function: 'settingsList::handler', message: 'failed updating list', error });
        return responseLib.failure({ status: false }) 
    }
}

module.exports = {
    AUTOMATIC_CREATE_LIST_TYPES,
    handler,
};
