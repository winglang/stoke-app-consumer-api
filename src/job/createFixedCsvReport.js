/* eslint-disable no-return-assign */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */

'use strict';

const _ = require('lodash');
const { jobsBucketName, bidsTableName, consumerAuthTableName } = process.env;
const { constants, jsonLogger, UsersService, responseLib, csvLib, s3LiteLib, dynamoDbUtils, dateLib } = require('stoke-app-common-api');
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const { jobsByfilterKey } = require('./jobListAttrs');
const { objectsToArrayOfValues, orederObjectForCsvRow, getCompanyTalents, getCompanyTalentsByTalentId } = require('../helpers/csvReport/csvReportHelper');
const { getCompanySettings } = require("../helpers/multiLevelHelper");
const { jobListType } = require("./queryAttrs");

const { getOfferedJobsReportFields } = require('../helpers/csvReport/fixedCsvFieldsLists');

const JOB_ID_CUSTOM_FIELD_ID = 'stoke::jobId'
const DATE_FORMAT = 'MMM DD YYYY HH:mm'

const buildCsvToDownload = async (fieldsHeaders, normlizedRows, columnsOrder) => {
    const csvHeaders = orederObjectForCsvRow(fieldsHeaders, columnsOrder)
    const csvRows = objectsToArrayOfValues(normlizedRows, columnsOrder)
    const jobsCsv = csvLib.arraysToCsvString(csvHeaders, csvRows);
    const key = `tmp/JobsExport-${new Date().toISOString()}.csv`
    const url = await s3LiteLib.putObjectAndSign(jobsBucketName, key, jobsCsv);
    jsonLogger.info({ type: "TRACKING", function: "createFixedCsvReport::buildCsvToDownload", url });
    return url;
}

// eslint-disable-next-line require-await
const getNormlizedRowsForOfferedJobs = async (jobs, talentsbyTalentId, timeZone) => {
    const normlizedRows = [];
    for (const currentJob of jobs) {
        const { itemId: jobId, entityId, itemData, tags } = currentJob;
        const jobTalentId = _.get(itemData, 'talentId');
        const bids = _.get(itemData, 'bids', []);
        if (_.size(bids) > 0) {
            const basicAttributes = {
                jobId,
                job: itemData.jobTitle,
            }
            const newJobBids = Array.isArray(bids) ? bids : _.get(_(bids).value(), 'values');
            const bidsKeys = _.map(newJobBids, (bidId) => ({ itemId: bidId, entityId }));

            // eslint-disable-next-line no-await-in-loop
            const jobBids = await dynamoDbUtils.batchGetParallel(bidsTableName, bidsKeys) || [];
            for (const jobBid of jobBids) {
                const talentId = _.get(jobBid, 'itemData.candidate.itemId');
                const bidTalent = talentsbyTalentId[talentId];
                const talentResponse = _.get(jobBid, 'itemData.offerStatus', '');
                const isThisTalentHired = jobTalentId === talentId ? 'Yes' : 'No';
                const engagementType = _.get(jobBid, 'itemData.engagementType') || _.get(itemData, 'engagementType');
                const quote = _.get(jobBid, 'itemData.quote');
                const responseTimestamp = _.get(jobBid, 'itemData.responseTime');
                const responseTime = responseTimestamp ? new Date(responseTimestamp).toLocaleString('en', { timeZone }) : null
                const bidsData = {
                    role: _.get(jobBid, 'itemData.role', ''),
                    type: engagementType === constants.engagementTypes.project ? 'Fixed' : _.capitalize(engagementType),
                    quote: quote ? `$${quote}` : '',
                    talentName: _.get(jobBid, 'itemData.candidate.name', ''),
                    talentTitle: _.get(bidTalent, 'itemData.jobTitle', ''),
                    responseTime: responseTime ? dateLib.format(responseTime, DATE_FORMAT) : '',
                    talentResponse: _.capitalize(talentResponse),
                    talentHired: jobTalentId ? isThisTalentHired : '',
                    [JOB_ID_CUSTOM_FIELD_ID]: _.get(tags, [JOB_ID_CUSTOM_FIELD_ID])
                }
                if (talentResponse === constants.jobOfferBidStatus.interested) {
                    normlizedRows.push(_.assign({}, basicAttributes, bidsData));
                }
            }
        }
    }
    return normlizedRows.filter(Boolean);
}

const handler = async (event) => {
    jsonLogger.info({ type: "TRACKING", function: "createFixedCsvReport::handler", event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { queryStringParameters } = event;
    const { companyId, type, reportType, timeZone } = queryStringParameters || {};
    jsonLogger.info({ type: "TRACKING", function: "createFixedCsvReport::handler", params: { companyId, type, reportType } });

    if (!companyId || !jobListType[type] || !reportType) {
        const message = "missing required params";
        jsonLogger.error({ type: "TRACKING", function: "createFixedCsvReport::handler", message });
        return responseLib.failure({ status: false, message });
    }

    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(userId, companyId);
    if (role === constants.user.role.unauthorised) {
        return responseLib.forbidden();
    }

    const companyTalents = await getCompanyTalents(companyId);
    const talentsbyTalentId = getCompanyTalentsByTalentId(companyTalents);

    const settings = await getCompanySettings(companyId)

    const isJobsCustomFieldEnabled = _.get(settings, ['itemData', 'jobsCustomFields', 'enabled'], false)
    const isJobIdCustomFieldExist = isJobsCustomFieldEnabled && 
        _.some(_.get(settings, ['itemData', 'jobsCustomFields', 'fields'], []), (field) => _.get(field, 'id') === JOB_ID_CUSTOM_FIELD_ID)

    const offeredJobsReportFields = getOfferedJobsReportFields(isJobIdCustomFieldExist)

    const fieldsHeaders = _.chain(offeredJobsReportFields).keyBy('field').
        mapValues('headerName').
        value();

    const columnsOrder = _.map(offeredJobsReportFields, 'field');

    const filterKey = reportType;
    const { items: jobs } = await jobsByfilterKey(filterKey, role, companyId, entitiesAdmin, entitiesUser, userId, type, { 'itemData.baseJobFlow': { value: 'offer', attributeNotExist: false } });
    const normlizedJobs = await getNormlizedRowsForOfferedJobs(jobs, talentsbyTalentId, timeZone);
    jsonLogger.info({ type: "TRACKING", function: "createFixedCsvReport::handler", jobsSize: jobs.length });
    const url = await buildCsvToDownload(fieldsHeaders, normlizedJobs, columnsOrder);
    return responseLib.success(url);
};

module.exports = {
    handler
}
