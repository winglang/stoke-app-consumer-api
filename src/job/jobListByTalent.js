/* eslint-disable max-lines-per-function */

'use strict';

const _ = require('lodash');

const {
    jobsTableName,
    consumerAuthTableName,
    gsiItemsByCompanyIdAndItemIdIndexNameV2
} = process.env;

const { constants, jsonLogger, responseLib, JobsService, UsersService, prefixLib, idConverterLib } = require('stoke-app-common-api');
const { isWithinXTimeFromNow } = require("stoke-app-common-api/lib/dateLib");
const { isProvider } = prefixLib;
const { calculateTotalEarned, getNonFinalizedJobs } = require('../helpers/jobHelper')
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const activeStatuses = [
    constants.job.status.active,
    constants.job.status.completed,
    constants.job.status.paid,
    constants.job.status.pendingApproval,
    constants.job.status.secondApproval,
]

const getLatestJobs = (jobs, numberJobsToFetch) => {
    const lastestJobsIds = _.chain(jobs).
    filter(job => job.itemStatus === constants.job.status.active).
    sortBy(job => new Date(_.get(job, 'itemData.jobStartDate'), ['desc']).getTime()).
    takeRight(numberJobsToFetch).
    value();

    return lastestJobsIds
}

const getLatestJobAndMilestones = (milestones, jobs, numberJobsToFetch) => {
    const lastJobIds = _.chain(milestones).
        filter(ms => activeStatuses.includes(ms.itemStatus)).
        sortBy(ms => new Date(_.get(ms, 'itemData.date')).getTime()).
        takeRight(numberJobsToFetch).
        map(({ itemId }) => idConverterLib.getJobIdFromMilestoneId(itemId)).
        value();
    return _.filter([...milestones, ...jobs], ({ itemId }) => {
        const jobId = prefixLib.isJob(itemId) ? itemId : idConverterLib.getJobIdFromMilestoneId(itemId)
        return lastJobIds.includes(jobId)
    })
}

const getActiveDepartments = (items) => {
    const notFinalizedJobs = getNonFinalizedJobs(items);
    return _.uniq(_.map(notFinalizedJobs, 'entityId'));
}

const getLatestJobsPerTalent = (items, numberJobsToFetch) => {
    const [jobs, milestones] = _.partition(items, item => prefixLib.isJob(item.itemId));
    const jobsByTalent = _.groupBy(jobs, job => _.get(job, 'itemData.talentId'));
    const milestonesByJobId = _.groupBy(milestones, ms => idConverterLib.getJobIdFromMilestoneId(ms.itemId));

    let result = [];
    _.forEach(Object.keys(jobsByTalent), (key) => {
        const talentJobs = _.get(jobsByTalent, [key], []);
        const talentMilestones = _.chain(talentJobs).
            map(job => _.get(milestonesByJobId, [job.itemId], [])).
            flatten().
            value();
        result = [...result, ...getLatestJobAndMilestones(talentMilestones, talentJobs, numberJobsToFetch)]
    });

    if (_.isEmpty(result)) {
        _.forEach(Object.keys(jobsByTalent), (key) => {
            const talentJobs = _.get(jobsByTalent, [key], []);
            result = [...result, ...getLatestJobs(talentJobs, numberJobsToFetch)]
        });        
    }

    return result;
};

const getTotalEarned = (jobs) => {
    const completedMilestones = _.filter(jobs, job => {
        const isCompleted = [constants.job.status.completed, constants.job.status.paid].includes(job.itemStatus)
        return prefixLib.isMilestone(job.itemId) && isCompleted
    });
    return calculateTotalEarned(completedMilestones);
};


const mapJobReviewOptions = (jobs) => _.map(jobs, (job) => (
{ itemId: _.get(job, 'itemId'), 
    title: _.get(job, 'itemData.jobTitle', ''), 
    talentId: _.get(job, 'itemData.talentId', ''), 
    entityId: _.get(job, 'entityId', ''), 
    startTime: _.get(job, 'itemData.startTime', '') }));

const filterJobReviewOptions = (items) => _.filter(items, (item) => {
        const isJob = _.get(item, 'itemId').startsWith(constants.prefix.job);
        const isActive = _.get(item, 'itemStatus') === constants.job.status.active;
        // eslint-disable-next-line no-magic-numbers
        const isCompletedLast2Monthes = _.get(item, 'itemStatus') === constants.job.status.completed && isWithinXTimeFromNow(new Date(_.get(item, 'modifiedAt', 0)), 2, 0)
        return isJob && (isActive || isCompletedLast2Monthes)
    })

module.exports.handler = async (event) => {
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { queryStringParameters } = event;
    const { companyId, talentId, numberJobsToFetch } = queryStringParameters || {};

    if (!companyId || !talentId) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobListByTalent::handler', message: `companyId and talentId are mandatory` });
    }

    jsonLogger.info({ type: "TRACKING", function: "jobListByTalent::handler", userId, companyId, event });

    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(userId, companyId);
    if (role === constants.user.role.unauthorised) {
        jsonLogger.error({ type: 'TRACKING', function: 'jobListByTalent::handler', message: `user ${userId} is unautorized` });
        return responseLib.forbidden({ status: false });
    }
    const isCompanyAdmin = role === constants.user.role.admin;

    let items = null;
    if (isProvider(talentId)) {
        items = await jobsService.listByProviderId(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, userId, constants.prefix.milestone, talentId, null, isCompanyAdmin, entitiesAdmin, entitiesUser);
    } else {
        items = await jobsService.listByTalentsIds(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, userId, constants.prefix.milestone, [talentId], [], isCompanyAdmin, entitiesAdmin, entitiesUser);
    }

    const jobReviewOptions = mapJobReviewOptions(filterJobReviewOptions(items));
    const activeDepartments = getActiveDepartments(items)
    const totalEarned = getTotalEarned(items);
    // eslint-disable-next-line no-magic-numbers
    if (numberJobsToFetch && numberJobsToFetch > 0) {
        items = getLatestJobsPerTalent(items, numberJobsToFetch);
    }

    const itemSize = _.size(items);
    jsonLogger.info({ type: 'TRACKING', function: 'jobListByTalent::handler', itemSize });

    if (!items) {
        return responseLib.forbidden({ status: false });
    }
    
    return responseLib.success({ jobs: items, totalEarned, activeDepartments, jobReviewOptions });
};
