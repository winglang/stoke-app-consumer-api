/* eslint-disable array-element-newline */

'use strict';

const commonApi = require('stoke-app-common-api');
const { LedgerService, constants } = commonApi;

const ledgerService = new LedgerService(process.env.ledgerTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

// eslint-disable-next-line max-params
const innerGetRecordsByPeriod = async (userId, params, userRole, entitiesAdmin, entitiesUser) => {
    const { entityId, companyId, talentId, from, to } = params;
    let result = null;
    if (companyId) { // request is by CompanyId
        if (userRole === constants.user.role.admin) {
            // eslint-disable-next-line no-undefined
            result = await ledgerService.ledgersPagingtion('listByCompanyId', [companyId, null, from, to, process.env.gsiItemsByCompanyIdAndItemIdIndexName, talentId]);
        } else {
            // eslint-disable-next-line no-undefined
            result = await ledgerService.ledgersPagingtion('listGlobal', [process.env.gsiItemsByCompanyIdAndItemIdIndexName, companyId, entitiesAdmin, entitiesUser, userId, from, to, talentId, undefined]);
        }
        
    } else { // request is by EntityId
        const ledgerUserId = userRole === constants.user.role.admin ? null : userId;
        result = await ledgerService.ledgersPagingtion('list', [entityId, ledgerUserId, from, to, talentId]);
    }
    return result;
}

module.exports = {
    innerGetRecordsByPeriod,
};

