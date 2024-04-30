/* eslint-disable complexity */
/* eslint-disable radix */
/* eslint-disable no-undefined */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */

'use strict';

const _ = require('lodash');
const { isEmpty } = require('lodash');
const commonApi = require('stoke-app-common-api');
const { jsonLogger, responseLib, ListService, SettingsService, CompanyProvidersService, constants } = commonApi;
const { isAuthorizedUser, s3FileAsObject } = require('./utils');
const { TALENT_CLOUD_CANDIDATES_FILE, SINGLE_FIELD_TO_PARAM_MAPPING, ALL_FIELDS_MAPPING, FAVOURITE_TALENTS_LIST_DATA } = require('./constants');
const { searchInTalentLake, getTalentFromTalentLake } = require('./searchTalents');
const listService = new ListService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const DEFAULT_SIZE = 10;
const ALL = 'ALL';
const CATEGORY_ID = 'categoryId';

const checkArrayType = (candidateFieldArray, value) => candidateFieldArray.includes(parseInt(value)) || candidateFieldArray.includes(value)
const checkIdType = (fieldIds, value) => fieldIds && !isNaN(parseInt(value)) && fieldIds.includes(parseInt(value))
const checkNameType = (fieldNames, value) => fieldNames && fieldNames.includes(value)
const checkStringArrayType = (fieldNames, value) => _.find(value.split(","), valueInstance => fieldNames.includes(valueInstance))

const findTalentById = (candidatesJson, candidateId) => candidatesJson.find((candidate) => candidate.id && candidate.id.toString() === candidateId)

const filterBySingleValueField = (candidatesJson, fieldName, value) => candidatesJson.find((candidate) => candidate[fieldName] && candidate[fieldName] === value.toString())
const filterByMultiValueField = (candidatesJson, fieldName, value) => candidatesJson.filter((candidate) => {
    const candidateFieldArray = _.compact(_.castArray(candidate[fieldName]))

    const fieldIds = _.map(candidateFieldArray, (instance) => parseInt(instance.id))
    const fieldNames = _.map(candidateFieldArray, (instance) => instance.name && instance.name.toString())

    return checkArrayType(candidateFieldArray, value) ||
        checkIdType(fieldIds, value) ||
        checkNameType(fieldNames, value) ||
        checkStringArrayType(fieldNames, value)
})

const candidateParserItatee = field => candidate => parseInt(_.get(candidate, field))
const calculateDataPage = (index, size, candidates) => _.slice(_.orderBy(candidates, [candidateParserItatee('rating'), candidateParserItatee('reviewsCount')], ['desc', 'desc']), index * size, (index + 1) * size)

const enrichWithFavouriteData = async (userId, candidates, companyId) => {
    const list = await listService.get('user', userId, FAVOURITE_TALENTS_LIST_DATA.type, FAVOURITE_TALENTS_LIST_DATA.name)
    jsonLogger.info({ type: 'TRACKING', function: 'getCandidates::enrichWithFavouriteData', message: 'user favourite list:', list });
    const favouriteIds = _.keys(list)

    const companyProviders = await companyProvidersService.companyProvidersPagination('listCompany', [
        companyId,
        constants.prefix.talent,
        undefined,
        undefined
    ]);

    const companyProvidersEmailMap = _.keyBy(companyProviders, 'itemData.email')

    candidates.forEach((candidate = {}) => {
        candidate.markedAsFavourite = favouriteIds.includes(candidate.id)

        const existProvider = companyProvidersEmailMap[_.get(candidate, 'email')]

        if (existProvider) {
            const providerData = _.get(existProvider, 'itemData', {})
            _.set(candidate, 'name', _.get(providerData, 'providerName', _.get(providerData, 'name', `${_.get(providerData, 'firstName')} ${_.get(providerData, 'lastName')}`)))
            _.set(candidate, 'img', _.get(providerData, 'img'))
            _.set(candidate, 'talentId', existProvider.itemId)
        }
    })
}

const filterBySearch = (candidatesAsJson, searchText) => candidatesAsJson.filter((candidate) => {
    jsonLogger.info({ type: 'TRACKING', function: 'getCandidates::filterBySearch', message: `text searched: ${searchText}` });
    const comparedSearchText = _.lowerCase(searchText)
    const candidateJobTitle = _.lowerCase(candidate.jobTitle);
    const candidateDescription = _.lowerCase(candidate.description);
    const candidateSkills = _.map(candidate.skills, skill => _.lowerCase(skill.name))
    return _.includes(candidateJobTitle, comparedSearchText) || _.some(candidateSkills, skill => _.includes(skill, comparedSearchText)) || _.includes(candidateDescription, comparedSearchText);
})

const isTalentLakeEnabledForCompany = async (companyId) => {
    const companySettings = await settingsService.get(`${constants.prefix.company}${companyId}`);
    const isTalentLakeEnabled = _.get(companySettings, 'itemData.isTalentLakeEnabled', false);
    jsonLogger.info({ type: 'TRACKING', function: 'getCandidates::isTalentLakeEnabledForCompany', isTalentLakeEnabled });
    return isTalentLakeEnabled;
}

/**
 * handler endpoint returns talentCloudGetCategories
 * @param {Object} event - event data - should include filter type
 * @param {Object} context - context data
 * @returns {Object} talentCloudGetCategories used
 */
const handler = async (event) => {
    jsonLogger.info({ type: 'TRACKING', function: 'getCandidates::handler', event });

    const userId = event.requestContext.identity.cognitoIdentityId;
    const { pathParameters = {}, queryStringParameters = {}, multiValueQueryStringParameters = {}, candidatesFileData } = event;
    const { companyId, size, index, searchText, lastItemCursor } = queryStringParameters || {};
    const { candidateId } = pathParameters || {};
    // eslint-disable-next-line radix
    const resultSize = parseInt(size) || DEFAULT_SIZE;
    // eslint-disable-next-line radix
    const resultIndex = parseInt(index) || 0;

    const { isAuthorized } = await isAuthorizedUser(userId, companyId);
    if (!isAuthorized) {
        jsonLogger.error({ type: 'TRACKING', function: 'getCandidates::handler', message: 'unauthorized role', userId, companyId });
        return responseLib.forbidden({ status: false });
    }

    if (await isTalentLakeEnabledForCompany(companyId)) {
        if (candidateId) {
            const talent = await getTalentFromTalentLake(candidateId);
            if (talent) {
                await enrichWithFavouriteData(userId, [talent], companyId);
                return responseLib.success(_.castArray(talent));
            }
            jsonLogger.info({ type: "TRACKING", function: "getCandidates::handler", message: `did not find data for id: ${candidateId}` });
            return responseLib.failure({ status: false });
        }
        const { categoryTitle, subCategoryTitle, languagesCodes, skillIds, countriesIds } = queryStringParameters;
        const searchParams = {
            query: searchText && searchText.length > 0 ? searchText : undefined,
            category: categoryTitle ? categoryTitle : undefined,
            subCategory: subCategoryTitle ? subCategoryTitle : undefined,
            skills: skillIds ? skillIds.split(',') : undefined,
            languages: languagesCodes ? _.castArray(languagesCodes.split(',')) : undefined,
            locations: countriesIds ? _.castArray(countriesIds.split(',')) : undefined,
            lastItemCursor: lastItemCursor && lastItemCursor.length > 0 ? lastItemCursor : undefined,
            pageSize: resultSize === DEFAULT_SIZE ? undefined : resultSize,
        }
        const { talents, ...searchResults } = await searchInTalentLake(_.omitBy(searchParams, _.isNil));
        jsonLogger.info({ type: "TRACKING", function: "getCandidates::handler", searchResults });
        if (!isEmpty(talents)) {
            await enrichWithFavouriteData(userId, talents, companyId);
            return responseLib.success({ ...searchResults, talents });
        }
        return responseLib.success({ ...searchResults, talents: [] });
    }

    let filterFound = false
    let candidatesAsJson = await s3FileAsObject(candidatesFileData || TALENT_CLOUD_CANDIDATES_FILE)

    if (candidateId) {
        jsonLogger.info({ type: 'TRACKING', function: 'getCandidates::handler', message: 'filtering by candidateId', candidateId });
        const candidateData = findTalentById(candidatesAsJson, candidateId)

        if (isEmpty(candidateData)) {
            jsonLogger.error({ type: 'TRACKING', function: 'getCandidates::handler', message: `did not find data for id: ${candidateId}` });
            return responseLib.send({ status: false })
        }

        await enrichWithFavouriteData(userId, [candidateData], companyId)

        return responseLib.send([candidateData]);
    }

    Object.keys(ALL_FIELDS_MAPPING).forEach((fieldName) => {
        const queryOrPathParamName = ALL_FIELDS_MAPPING[fieldName]
        const queryOrPathParamValue = _.get(pathParameters, queryOrPathParamName) || _.get(queryStringParameters, queryOrPathParamName) || _.get(multiValueQueryStringParameters, queryOrPathParamName)
        if (!isEmpty(queryOrPathParamValue)) {
            if (SINGLE_FIELD_TO_PARAM_MAPPING[fieldName]) {
                jsonLogger.info({ type: 'TRACKING', function: 'getCandidates::handler', message: `filtering by single value field: ${queryOrPathParamName}, value: ${queryOrPathParamValue}` })
                candidatesAsJson = filterBySingleValueField(candidatesAsJson, fieldName, queryOrPathParamValue)
            } else if (queryOrPathParamName !== CATEGORY_ID || queryOrPathParamValue !== ALL) {
                jsonLogger.info({ type: 'TRACKING', function: 'getCandidates::handler', message: `filtering by multi values field: ${queryOrPathParamName}, value: ${queryOrPathParamValue}` })
                candidatesAsJson = filterByMultiValueField(candidatesAsJson, fieldName, queryOrPathParamValue)
            }
            filterFound = true
        }
    })

    if (!filterFound) {
        jsonLogger.error({ type: 'TRACKING', function: 'getCandidates::handler', message: `no filter was found. should include one of ${Object.values(ALL_FIELDS_MAPPING).join(", ")}` });
        return responseLib.forbidden({ status: false });
    }

    if (searchText) {
        candidatesAsJson = filterBySearch(candidatesAsJson, searchText);
    }


    const pagedCandidates = calculateDataPage(resultIndex, resultSize, _.castArray(candidatesAsJson));

    if (!isEmpty(pagedCandidates)) {
        await enrichWithFavouriteData(userId, pagedCandidates, companyId)
    }
    return responseLib.send(pagedCandidates);
}

module.exports = {
    handler,
    isTalentLakeEnabledForCompany
};
