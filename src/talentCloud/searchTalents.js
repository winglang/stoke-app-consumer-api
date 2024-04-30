/* eslint-disable max-lines */
/* eslint-disable no-magic-numbers */
/* eslint-disable multiline-comment-style */
/* eslint-disable max-lines-per-function */

'use strict';

const _ = require('lodash');
const fetch = require('node-fetch');

const { jsonLogger, responseLib, constants, ssmLib } = require('stoke-app-common-api');
const { httpActions: HTTP_REQ_TYPES } = constants;
const { isAuthorizedUser } = require('./utils');
const { getBody } = require('../helpers/utils');
const { stage } = process.env;
const { languages, countries } = require('countries-list');
const { langProficiencyLevel,
    langProficiencyLevelCode,
    FIVERR_ENTERPRISE_BU_ID,
    skillProficiencyLevelCode,
    PROD_STAGE,
    TALENT_LAKE_EMAIL_GROUP,
    categoriesDict,
    CATEGORY_TO_ID, 
    TOP_RATED_SELLER } = require('./constants');

const BASE_URL = `https://api.${stage === PROD_STAGE ? '' : 'dev.'}fiverr.com/api/v2/talents/`;

const convertToCategoryObj = (arr) => arr.map(name => ({ id: name, name }));

const getEmailByStage = (email, id) => {
    if (stage === PROD_STAGE) {
        return email;
    }
    return `${TALENT_LAKE_EMAIL_GROUP}+${stage}.${id}@stoketalent.com`;
};

const normalizeLanguages = (proficientLanguages) => proficientLanguages.map(({ code, level }) => {
    const language = languages[code.toLowerCase()];
    const name = language ? language.name : code;
    return {
        name,
        level: langProficiencyLevelCode[level]
    }
});

const normalizeSkills = (skills) => skills.map(({ name, level }) => ({
    name,
    level: skillProficiencyLevelCode[level]
}));

const normalizeEducation = (education) => education.map(({ graduationYear, countryCode, degreeTitle, degree, school }) => ({
    to: graduationYear,
    degree: `${degreeTitle}, ${degree} - ${school}`,
    location: countryCode
}));

const normalizeCertifications = (certifications) => certifications.map(({ name, receivedFrom, year }) => ({
    title: name,
    subtitle: `${receivedFrom}${` (Graduated ${year})`}`,
}));

const normalieClients = (notableClients) => notableClients.map(({ company }) => ({
    name: company.name,
    img: company.logoUrl
}));

const transformTalentToEnterpriseItem = (talent) => {
    if (_.isEmpty(talent)) {
        return {};
    }
    const {
        _id,
        email,
        avatarImageUrl,
        description,
        education,
        displayName,
        location,
        notableClients,
        oneLinerTitle,
        originBu,
        proficientLanguages,
        rating,
        serviceCategories = [],
        skills,
        achievementLevel,
        certifications,
        reviews,
        portfolios,
        onlinePresences
    } = talent;

    const categoriesArray = serviceCategories.reduce((acc, item) => {
        const { categories, subCategories } = acc;
        const { category, subCategory } = item;
        if (!categories.includes(category)) {
            acc.categories.push(category);
        }
        if (!subCategories.includes(subCategory)) {
            acc.subCategories.push(subCategory);
        }
        return acc;
    }, { categories: [], subCategories: [] });

    const categories = _.map(categoriesArray.categories, (category) => CATEGORY_TO_ID[category]).filter(Boolean); // currently works with ids
    const subCategories = convertToCategoryObj(categoriesArray.subCategories);

    const isFromStoke = originBu === FIVERR_ENTERPRISE_BU_ID;

    const { score, count } = rating || {};

    return {
        id: _id,
        languages: _.size(proficientLanguages) ? normalizeLanguages(proficientLanguages) : [],
        skills: _.size(skills) ? normalizeSkills(skills) : [],
        topClient: _.size(notableClients) ? normalieClients(notableClients) : [],
        subCategories,
        country: location.countryCode,
        countryName: _.get(countries, [location.countryCode, 'name'], ""),
        isFromStoke,
        categories,
        jobTitle: oneLinerTitle,
        name: displayName,
        email: getEmailByStage(email, _id),
        description,
        educations: _.size(education) ? normalizeEducation(education) : [],
        reviewsCount: count || 0,
        rating: score || 0,
        img: avatarImageUrl,
        isTopRated: achievementLevel === TOP_RATED_SELLER,
        certifications: normalizeCertifications(certifications || []),
        reviews,
        portfolios,
        onlinePresences,
        markedAsFavourite: false // currently hardcoded to false, should be stored in our db
    }
}

const getTalentLakeBasicHeaders = async () => {
    const [TALENT_LAKE_TOKEN] = await ssmLib.getParametersFromSSM('talentLake/token');
    if (!TALENT_LAKE_TOKEN) {
        jsonLogger.info({ type: "TRACKING", function: "searchTalents::getTalentLakeBasicHeaders", msg: `talent lake token for ${stage} is missing` });
        return responseLib.forbidden({ status: false });
    }

    return {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${TALENT_LAKE_TOKEN}`,
    };
};

const isJsonResponse = async (response) => {
    const contentType = response.headers.get('content-type');
    const isJson = response.ok && contentType && contentType.includes('application/json');
    if (isJson) {
        return true;
    }
    try {
        const text = await response.text();
        jsonLogger.info({ type: "TRACKING", function: "searchTalents::isJsonResponse", text });    
    } catch (error) {
        jsonLogger.error({ type: 'error', function: 'searchTalents::isJsonResponse', message: error.message });
    }
    return false;
}

const getTalentFromTalentLake = async (talentId) => {
    jsonLogger.info({ type: "TRACKING", function: "searchTalents::getTalentFromTalentLake", talentId });
    const basicHeaders = await getTalentLakeBasicHeaders();

    const endpoint = `${BASE_URL}${talentId}`;
    let response = {};
    let talent = {};
    try {
        response = await fetch(endpoint, {
            method: HTTP_REQ_TYPES.get,
            headers: { ...basicHeaders }
        });
        talent = response ? await response.json() : {};
        const { statusCode } = talent;
        if (statusCode) {
            throw new Error(`talent lake api error: ${talent.message}`);
        }

    } catch (error) {
        jsonLogger.error({ type: 'error', function: 'searchTalents::getTalentFromTalentLake', message: error.message });
        return false;
    }

    return transformTalentToEnterpriseItem(talent);
};

const searchInTalentLake = async (searchParams, basicHeadersInput) => {
    jsonLogger.info({ type: "TRACKING", function: "searchTalents::searchInTalentLake", searchParams });

    const basicHeaders = basicHeadersInput || await getTalentLakeBasicHeaders();

    let response = {};
    let searchResults = {};
    const body = JSON.stringify({
        isDisplayNameExist: true,
        ...searchParams
    });
    jsonLogger.info({ type: "TRACKING", function: "searchTalents::searchInTalentLake", body });
    try {
        const endpoint = `${BASE_URL}search`;
        response = await fetch(endpoint, {
            method: HTTP_REQ_TYPES.post,
            body,
            headers: { ...basicHeaders }
        });

        const isJson = await isJsonResponse(response);
        if (!isJson) {
            throw new Error('talent lake api error: response is not json');
        }
        searchResults = response ? await response.json() : {};
        if (_.has(searchResults, 'talents')) {
            searchResults.talents = searchResults.talents.map(transformTalentToEnterpriseItem);
        }

        const { statusCode } = searchResults;
        if (statusCode) {
            throw new Error(`talent lake api error: ${searchResults.message}`);
        }

    } catch (error) {
        jsonLogger.error({ type: 'error', function: 'searchTalents::searchInTalentLake', message: error.message });
        return false;
    }

    return searchResults;
};

const getTalentLakeFacets = async (basicHeadersInput) => {
    const basicHeaders = basicHeadersInput || await getTalentLakeBasicHeaders();

    let response = {};
    let searchResults = {};

    try {
        const endpoint = `${BASE_URL}facets`;
        response = await fetch(endpoint, {
            method: HTTP_REQ_TYPES.get,
            headers: { ...basicHeaders }
        });

        searchResults = response ? await response.json() : {};

        const { statusCode } = searchResults;
        if (statusCode) {
            throw new Error(`talent lake api error: ${searchResults.message}`);
        }
    } catch (error) {
        jsonLogger.error({ type: 'error', function: 'searchTalents::getTalentLakeFacets', message: error.message });
        return false;
    }

    return searchResults;
};

const normalizeCategoryLeaf = (categoryResponse, id, name) => { 
    const { talents, facets } = categoryResponse;
    const { categoryFacet, subCategoryFacet } = facets;
    const { count: categoryCount } = _.find(categoryFacet.values, { value: name }) || { count: 0 };
    const subCategories = _.map(subCategoryFacet.values, ({ value, count }) => ({ id: value, name: value, talentCount: count }));
    const skills = _.map(facets.skillsFacet.values, ({ value }) => ({ id: value, name: value }));
    return {
        category: {
            name,
            id,
            presentationName: name,
            subCategories,
            freelancersNumber: categoryCount,
            talentsPreview: talents,
            skills
        }
    }
}

const getNormalizedCategoryLeaf = async (category, basicHeadersInput) => {
    const { id, name } = category;
    const categoryResponse = await searchInTalentLake({ category: name, pageSize: 5 }, basicHeadersInput);

    if (!categoryResponse) {
        throw new Error(`failed fetching category ${name} from talent lake`);
    }
    return normalizeCategoryLeaf(categoryResponse, id, name);
}

const buildCategoryTreeResponse = (categoriesTree, facets) => {
    const supportedLanguages = _.chain(facets).get('languagesFacet.values').
        map(({ value }) => {
            const language = languages[value.toLowerCase()];
            const name = language ? language.name : false;
            return name;
        }).
        filter(Boolean).
        value();
    const supportedLocations = _.chain(facets).get('locationsFacet.values').
        map(({ value }) => value).
        value();
    return {
        categoriesTree,
        supportedLanguages,
        supportedLocations
    }
}

const getPreviewAndFiltersData = async () => {
    try {
        const basicHeaders = await getTalentLakeBasicHeaders();
        const categoriesTree = await Promise.all(_.map(Object.values(categoriesDict), (category) => getNormalizedCategoryLeaf({ id: CATEGORY_TO_ID[category], name: category }, basicHeaders)));
        const { facets } = await getTalentLakeFacets(basicHeaders) || {};
        return buildCategoryTreeResponse(categoriesTree, facets);
    } catch (error) {
        jsonLogger.error({ type: 'error', function: 'searchTalents::getPreviewAndFiltersData', message: error.message });
        return false;
    }
}

/**
 * searchTalents handler
 * @param {Object} event - event data
 * 
 * const searchParamsExample = {
 *      "query": "string",
 *      "category": "string",
 *      "subCategory": "string",
 *      "nestedSubCategory": "string",
 *      "isVetted": true,
 *      "isDisplayNameExist": true,
 *      "skills": ["string"],
 *      "languages": ["string"],
 *      "locations": ["string"],
 *      "lastItemCursor": "string",
 *      "pageSize": 10
 *  }
 * 
 * @returns {Object} talent search results
 */
const handler = async (event) => {
    jsonLogger.info({ type: 'TRACKING', function: 'searchTalents::handler', event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { queryStringParameters = {} } = event;
    const { companyId, isOnlyFacets } = queryStringParameters;
    const searchParams = getBody(event);

    const { isAuthorized } = await isAuthorizedUser(userId, companyId);
    if (!isAuthorized) {
        jsonLogger.error({ type: 'TRACKING', function: 'searchTalents::handler', messgage: 'unauthorized role', userId, companyId });
        return responseLib.forbidden({ status: false });
    }

    const searchResult = isOnlyFacets ? await getTalentLakeFacets() : await searchInTalentLake(searchParams);
    if (searchResult) {
        return responseLib.success(searchResult);
    }
    return responseLib.failure({ status: false });
}

module.exports = {
    handler,
    langProficiencyLevel,
    searchInTalentLake,
    normalizeCategoryLeaf,
    getTalentFromTalentLake,
    getPreviewAndFiltersData,
    buildCategoryTreeResponse,
    getNormalizedCategoryLeaf,
    transformTalentToEnterpriseItem
};
