
'use strict';

const _ = require('lodash');
const { consumerAuthTableName, gsiItemsByCompanyIdIndexName } = process.env;
const { UsersService, constants, jsonLogger, responseLib } = require('stoke-app-common-api');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);


const resolveFilteredApproversByType = (approversByType, type, entitiesToInclude) => _.chain(approversByType).
pick([type]).
mapValues((approversOfType) => {
    const scopes = _.keys(approversOfType);
    const authorisedScopes = _.filter(scopes, (scope) => _.some(entitiesToInclude, (entityId) => scope.startsWith(entityId)));
    return _.pick(approversOfType, authorisedScopes);
}).
value()

/**
 * getApprovers endpoint returns approvers of all types in user's scope
 * @param {Object} event 
 * @param {Object} context 
 * @returns {Array} Array of approvers by types (isBudgetOwner, isJobsApprover)
 */

module.exports.handler = async (event, context) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId } = event.queryStringParameters;
    const { multiValueQueryStringParameters } = event;
    const { entities } = multiValueQueryStringParameters || [];
    jsonLogger.info({ type: 'TRACKING', function: 'approvers::handler',
    functionName: context.functionName, awsRequestId: context.awsRequestId, userId, companyId, event });
    if (!companyId) {
        return responseLib.failure({ message: 'missing mandatory parameters', companyId });
    } 
    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permissionsComponentsKeys.jobs]: {} });

    if (role === constants.user.role.unauthorised) {
        return responseLib.forbidden({ status: false });
    } 
    // eslint-disable-next-line no-undefined
    const approversByIsJobApprover = await usersService.listCompanyApproversByType(gsiItemsByCompanyIdIndexName, companyId, undefined, { [permissionsComponentsKeys.jobs]: {} });
    // eslint-disable-next-line no-undefined
    const approversByIsBudgetOwner = await usersService.listCompanyApproversByType(gsiItemsByCompanyIdIndexName, companyId, undefined, { [permissionsComponentsKeys.budget]: { isEditor: true }, [permissionsComponentsKeys.jobs]: {} });

    let entitiesToInclude = _.uniq(_.map([
            ...entitiesUser,
            ...entitiesAdmin
        ], (entity) => entity.entityId));

    if (role !== constants.user.role.admin && !_.isEmpty(entitiesAdmin)) {
        entitiesToInclude = [
            ...entitiesToInclude,
            companyId
        ];
    }
    if (!_.isEmpty(entities)) {
        entitiesToInclude = _.intersection(entities, entitiesToInclude);
    }

        const filteredApproversByIsJobApprover = resolveFilteredApproversByType(approversByIsJobApprover, constants.additionalRoleTypes.isJobsApprover, entitiesToInclude);
        const filteredApproversByIsBudgetOwner = resolveFilteredApproversByType(approversByIsBudgetOwner, constants.additionalRoleTypes.isBudgetOwner, entitiesToInclude);

        const filteredApprovers = { ...filteredApproversByIsJobApprover, ...filteredApproversByIsBudgetOwner }
    return responseLib.success(filteredApprovers);
}

