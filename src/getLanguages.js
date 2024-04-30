'use strict';

const { jsonLogger, responseLib, constants } = require('stoke-app-common-api');


/**
 * handler - get all supported talent languages
 * @param {object} event lambda event
 * @param {object} context - lambda context
 * @returns {object} objects with list of languages
 */
// eslint-disable-next-line require-await
module.exports.handler = async (event, context) => {
    jsonLogger.info({ function: 'getLanguages::handler', event, context });
    const { languages } = constants;
    return responseLib.success({ languages });
};
