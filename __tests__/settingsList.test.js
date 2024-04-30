"use strict";

const {
    settingsTableName
} = process.env;

const _ = require('lodash');
const mod = require('./../src/settingsList');
const { constants, SettingsService } = require('stoke-app-common-api');
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jestPlugin = require("serverless-jest-plugin");
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'handler' });

const DUMMY_ID = "JEST_DUMMY_ID";
const userId = DUMMY_ID
const DUMMY_COMPANY_ID = "JEST_DUMMY_COMPANY_ID";
const EVENT_DOCUMENT_TYPE = 'user'
const LIST_TYPE = constants.settingsListTypes.talentDirectory
const LIST_NAME = 'DUMMY_LIST_NAME'

const eventBasicData = {
    requestContext: {
        httpMethod: constants.httpActions.get,
        identity: {
            cognitoIdentityId: userId,
        }
    },
    pathParameters: {
        entityType: EVENT_DOCUMENT_TYPE,
        entityId: DUMMY_ID,
        listType: LIST_TYPE,
        listName: LIST_NAME,
    },
    body: {
        listName: LIST_NAME,
    },
};

const createUserSettings = async (userId, companyId) => {
    const userSettings = {
        itemId: constants.prefix.user + userId,
        userId,
        companyId,
        entityId: companyId,
        itemStatus: constants.settings.status.active,
        itemData: { [constants.USER_SETTINGS_TYPE.getStarted]: {} }
    };
    const result = await settingsService.create(userSettings);
    return result;
}

describe('Settings list operations', () => {
    beforeEach(async () => {
        await createUserSettings(DUMMY_ID, DUMMY_COMPANY_ID)
    });

    afterEach(async () => {
        await settingsService.delete(constants.prefix.user + userId);
    })

    describe('operation allowance', () => {
        describe('no user id', () => {
            it('should return forbidden', async () => {
                const eventDataNoUserId = _.clone(eventBasicData)
                let response = await wrapped.run(_.omit(eventDataNoUserId,
                    'requestContext.identity.cognitoIdentityId'));
                expect(response.statusCode).toEqual(403)
            })
        })
    })

    describe('CRUD', () => {
        const eventDataCrud = _.clone(eventBasicData)
        let listId
        let response
        let body
        beforeEach(async () => {
            // create
            eventDataCrud.requestContext.httpMethod = constants.httpActions.post
            eventDataCrud.pathParameters.entityType = constants.scope.user
            eventDataCrud.body = JSON.stringify({ listName: LIST_NAME })

            response = await wrapped.run(eventDataCrud);
            body = JSON.parse(response.body)

            listId = _.first(Object.keys(body.response.list[LIST_TYPE]));

            expect(body.response.list).toEqual({ [LIST_TYPE]: { [listId]: { listData: {}, displayName: `${LIST_NAME}` } } })
        });

        it('should perform crud on list', async () => {
            // add
            eventDataCrud.requestContext.httpMethod = constants.httpActions.put
            eventDataCrud.body = JSON.stringify({
                updatedItems: [{
                    actionType: constants.settingsListActionTypes.add,
                    listId,
                    ids: ['DUMMY_ID'],
                }]
            })
            eventDataCrud.pathParameters.listName = listId // [TODO] - fix this after serverless issue resolved
            response = await wrapped.run(eventDataCrud);
            body = JSON.parse(response.body)
            expect(body).toEqual({ status: true })

            eventDataCrud.requestContext.httpMethod = constants.httpActions.get
            eventDataCrud.queryStringParameters = { listTypeToFetch: LIST_TYPE, listIdToFetch: listId }
            response = await wrapped.run(eventDataCrud);
            body = JSON.parse(response.body)
            expect(body).toEqual({ response: { DUMMY_ID: { active: true, id: 'DUMMY_ID' } } })

            // remove and get
            eventDataCrud.requestContext.httpMethod = constants.httpActions.put
            eventDataCrud.pathParameters.listType = LIST_TYPE
            eventDataCrud.body = JSON.stringify({
                updatedItems: [{
                    actionType: constants.settingsListActionTypes.remove,
                    listId,
                    ids: ['DUMMY_ID'],
                }]
            })
            response = await wrapped.run(eventDataCrud);
            body = JSON.parse(response.body)
            expect(body).toEqual({ status: true })

            eventDataCrud.requestContext.httpMethod = constants.httpActions.get
            eventDataCrud.queryStringParameters = { listTypeToFetch: LIST_TYPE, listIdToFetch: listId }
            response = await wrapped.run(eventDataCrud);
            body = JSON.parse(response.body)
            expect(body).toEqual({ response: { DUMMY_ID: { active: false, id: 'DUMMY_ID' } } })
        })

        describe('multi add', () => {
            it('should add and return object representing', async () => {
                eventDataCrud.requestContext.httpMethod = constants.httpActions.put
                eventDataCrud.pathParameters.listType = LIST_TYPE

                eventDataCrud.body = JSON.stringify({
                    updatedItems: [{
                        actionType: constants.settingsListActionTypes.add,
                        listId,
                        ids: ['abc', 'def'],
                    }]
                })

                let response = await wrapped.run(eventDataCrud);
                let body = JSON.parse(response.body)
                expect(body).toEqual({ 'status': true })


                const eventDataGetList = _.clone(eventBasicData)
                eventDataGetList.requestContext.httpMethod = constants.httpActions.get
                eventDataGetList.queryStringParameters = { listTypeToFetch: LIST_TYPE }
                response = await wrapped.run(eventDataGetList);
                body = JSON.parse(response.body)
                expect(body.response).toEqual({
                    [listId]: {
                        listData:
                        {
                            def: { active: true, id: "def" },
                            abc: { active: true, id: "abc" }
                        },
                        displayName: LIST_NAME
                    }
                })
            })
        })
    })

    describe('delete list', () => {
        const eventDataDeleteList = _.clone(eventBasicData)
        const eventDataGetList = _.clone(eventBasicData)

        it('should return empty results after deleting', async () => {
            // create
            eventDataDeleteList.requestContext.httpMethod = constants.httpActions.post
            eventDataDeleteList.body = JSON.stringify({ listName: "DUMMY_LIST_NAME" })
            let response = await wrapped.run(eventDataDeleteList);
            let body = JSON.parse(response.body)
            const listId = _.first(Object.keys(body.response.list[LIST_TYPE]));
            expect(body.response.list[LIST_TYPE]).toEqual({ [`${listId}`]: { listData: {}, displayName: 'DUMMY_LIST_NAME' } })

            // delete
            eventDataDeleteList.requestContext.httpMethod = constants.httpActions.delete
            response = await wrapped.run(eventDataDeleteList);
            body = JSON.parse(response.body)
            expect(body).toEqual({ 'status': true })

            // get and check
            eventDataGetList.requestContext.httpMethod = constants.httpActions.get
            eventDataGetList.queryStringParameters = { listTypeToFetch: LIST_TYPE }
            response = await wrapped.run(eventDataGetList);
            body = JSON.parse(response.body)
            expect(body).toEqual({ response: { [listId]: { listData: {}, displayName: LIST_NAME } } })
        })
    })
});
