/* eslint-disable arrow-body-style */

'use strict';

const { responseLib } = require('stoke-app-common-api');
const uuidv1 = require('uuid/v1');


// eslint-disable-next-line no-confusing-arrow
module.exports.createArray = (value) => value ? [value] : null;

module.exports.createResult = (status, reason) => ({ status, reason });

/**
 * @param {boolean} status successful or failure
 * @param {string} reason failure reason
 * @returns {object} HTTP response
 */
module.exports.createResponse = (status, reason) => responseLib.success({ status: Boolean(status), reason });

module.exports.createItemId = (prefix) => `${prefix}${uuidv1()}`;
