/* eslint-disable prefer-named-capture-group */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-magic-numbers */
/* eslint-disable max-lines-per-function */

"use strict";

const _map = require('lodash/map')
const { jsonLogger, constants, CompaniesService } = require("stoke-app-common-api");
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

/**
 * getAllCompanies - get all companies in the system
 * part of step function
 * @param {Object} event - event of function
 * @param {Object} context - context of function
 * @param {callback} callback - callback of function
 * @returns {object} results
 */
const getAllCompanies = async (event, context, callback) => {
    jsonLogger.info({ type: "TRACKING", function: "getAllCompanies::getAllCompanies", event, context });

    let allCompanies = [];
    try {
        allCompanies = event && event.companyId
            ? [{ companyId: event.companyId }]
            : await companiesService.listByItemStatus(process.env.gsiItemByItemStatusIdxV2, constants.itemStatus.active, constants.prefix.company, true);
    } catch (err) {
        jsonLogger.error({ type: 'TRACKING', function: 'getAllCompanies::getAllCompanies', message: err.message });
    }

    const result = _map(allCompanies, (company) => ({ companyId: company.companyId }));
    jsonLogger.info({ type: "TRACKING", function: "getAllCompanies::getAllCompanies", result });
    callback(null, result);
};

module.exports = {
    getAllCompanies,
}
