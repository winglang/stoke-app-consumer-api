/* eslint-disable no-undefined */
/* eslint-disable max-lines-per-function */
/* eslint-disable require-await */
/* eslint-disable no-magic-numbers */
/* eslint-disable complexity */
/* eslint-disable array-callback-return */
/* eslint-disable array-element-newline */
/* eslint-disable no-extra-parens */

'use strict';

const _ = require('lodash');
const { UsersService, CompanyProvidersService, jsonLogger, responseLib, dateLib, constants, idConverterLib, permisionConstants } = require('stoke-app-common-api');
const {
    JobStatusesChart, 
    addChartValue,
    formatDate,
    jobStatusesToReject
} = require('./helpers/homeHelper')
const { jobListType, companyProviderFileds, } = require('./job/queryAttrs');
const { fetchJobs, fetchBidsData } = require('./job/jobListAttrs');
const {
    consumerAuthTableName,
    companyProvidersTableName,
} = process.env;

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const listActiveJobsAndTalents = (companyActiveJobs, talentData) => {
    jsonLogger.info({ type: "TRACKING", function: "homePage::listActiveJobsAndTalents", talentDataSize: _.size(talentData) });
    const activeProvidersInCompany = {};
    talentData.map((provider) => {
        if ([
            constants.companyProvider.status.registered,
            constants.companyProvider.status.active
        ].includes(provider.itemStatus)) {
            activeProvidersInCompany[provider.itemId] = true;
        }
    });

    jsonLogger.info({ type: "TRACKING", function: "homePage::listActiveJobsAndTalents", activeProvidersInCompanyLength: _.size(activeProvidersInCompany) });
    const uniqueTalents = {};
    const activeJobs = companyActiveJobs.length;
    let newJobsThisWeek = 0;
    let activeTalents = 0;
    let newTalentsThisWeek = 0;
    companyActiveJobs.map((job) => {
        if (_.get(activeProvidersInCompany, job.itemData.talentId, false)) {
            const jobInThisWeek = dateLib.isOnSameTimeUnit(job.itemData.startTime || job.itemData.postedAt, 'week');
            newJobsThisWeek += jobInThisWeek;
            if (!_.get(uniqueTalents, job.itemData.talentId, false)) {
                activeTalents += 1;
                newTalentsThisWeek += jobInThisWeek;
            }
            uniqueTalents[job.itemData.talentId] = true;
        }
    });
    const result = { activeJobs: { activeJobs, newJobsThisWeek }, activeTalents: { activeTalents, newTalentsThisWeek } };
    jsonLogger.info({ type: "TRACKING", function: "homePage::listActiveJobsAndTalents", result });
    return result;
}

const jobsListsDivider = (rawJobs) => {

    const jobs = [];
    const milestones = [];
    const jobsWithActiveStatus = [];
    const budgetRequests = [];
    const pendingForBids = [];
    const jobIds = {}
    const providerIds = {}
    let paymentsChartData = {}
    const chartKey = {
        year: '',
        quarter: ''
    }

    rawJobs.map((job) => {
        const isJob = job.itemId.startsWith(constants.prefix.job);
        const currentStatus = job.itemStatus;

        if (isJob) {
            if (currentStatus === constants.job.status.pending) {
                pendingForBids.push(job);
            }
            if ([
                constants.job.status.active,
                constants.job.status.budgetRequest,
                constants.job.status.pendingApproval
            ].includes(currentStatus)) {
                jobs.push(_.omit(job, 'itemData.bids'));
            }
        } else {
            chartKey.quarter = job.itemData && formatDate(job.itemData.date)
            chartKey.year = job.itemData && job.itemData.date && new Date(job.itemData.date).getFullYear()
        }

        switch (currentStatus) {
            case constants.job.status.active:
                if (isJob) {
                    jobsWithActiveStatus.push(job);
                }
                break;
            case constants.job.status.budgetRequest:
            case constants.job.status.overageBudgetRequest:
                if (!isJob) {
                    budgetRequests.push(job);
                    jobIds[idConverterLib.getJobIdFromMilestoneId(job.itemId)] = true;
                }
                break;
            case constants.job.status.pendingApproval:
            case constants.job.status.secondApproval:
            case constants.job.status.requested:
                if (!isJob && !_.get(job, 'itemData.isRejected')) {
                    milestones.push(job);
                        jobIds[idConverterLib.getJobIdFromMilestoneId(job.itemId)] = true;
                    if (chartKey.year) {
                        paymentsChartData = addChartValue({ 
                            cost: _.get(job, 'itemData.actualCost', _.get(job, 'itemData.actualRequestCost')),
                            chartKey,
                            paymentStatus: JobStatusesChart.PENDING_APPROVAL,
                            paymentsChartData
                         })
                    }
                }
                break;
            case constants.job.status.completed:
            case constants.job.status.paid:
                if (!isJob && chartKey.year) {
                    if (!_.get(job.itemData, 'payment.status') || !jobStatusesToReject.includes(job.itemData.payment.status)) {
                        const isPendingFund = job.itemData.payment && job.itemData.payment.status === constants.payment.status.pendingFunds 
                        paymentsChartData = addChartValue({ 
                            cost: job.itemData.actualCost, 
                            chartKey,
                            paymentStatus: JobStatusesChart.APPROVED_PAYMENTS,
                            paymentsChartData
                         })

                        if (isPendingFund) {   
                            paymentsChartData = addChartValue({ 
                                cost: job.itemData.actualCost, 
                                chartKey,
                                paymentStatus: JobStatusesChart.PENDING_FUNDS,
                                paymentsChartData
                             })
                    }
                }
            }
                break;
            default:
                break;
        }
    })

    jobs.forEach((job) => {
        const filter = jobIds[job.itemId];
        if (filter) {
            providerIds[job.itemData.talentId] = true;
        }
    });

    return { jobs, milestones, jobsWithActiveStatus, budgetRequests, pendingForBids, providerIds, paymentsChartData };
}

const fetchTalentData = async (companyId, jobs) => {
    const companyProviders = await companyProvidersService.companyProvidersPagination('listCompany', [
        companyId,
        undefined,
        undefined,
        undefined
    ]);
    jsonLogger.info({ type: "TRACKING", function: "jobs::fetchTalentData", message: "fetching talents for jobs", jobsCount: _.size(jobs) });
    if (_.isEmpty(jobs)) return [];
    let [
        providers,
        talents
    ] = _.partition(companyProviders, (item) => item.itemId.startsWith(constants.prefix.provider))
    providers = _.keyBy(providers, 'itemId');
    talents = talents.map((talent) => ({ ...talent, itemData: { ..._.get(talent, 'itemData'), providerName: _.get(_.get(providers, idConverterLib.getProviderIdFromTalentId(talent.itemId), {}), 'itemData.providerName') } }))
    return talents;
}

/**
 * getHomePageStatistics - "homePageStatGet" hendler, Collects some of the home-page data and returns is as a unified JSON object.
 * @param {object} event - event data with the following params:
 * {String} userId - used (with the companyId) to authenticate the user
 * {String} companyId - used as the company identifier for all the data collection process
 * @returns {Object} result - home-page statistics object
 */
const getHomePageStatistics = async (event) => {
    const statistics = {};
    jsonLogger.info({ type: "TRACKING", function: "homePage::getHomePageStatistics", event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId } = event.queryStringParameters;
    jsonLogger.info({ type: "TRACKING", function: "homePage::getHomePageStatistics", userId, companyId });
    if (!companyId) {
        return responseLib.failure({ message: "missing companyId in params" });
    }
    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.jobs]: {}, [permisionConstants.permissionsComponentsKeys.talents]: {} });
    jsonLogger.info({ type: "TRACKING", function: "homePage::getHomePageStatistics", role, entitiesAdminCount: _.size(entitiesAdmin), entitiesUserCount: _.size(entitiesUser) });
    if (role === constants.user.role.unauthorised) {
        return responseLib.forbidden({ status: false });
    }


    const jobsResult = await fetchJobs(role, companyId, entitiesAdmin, entitiesUser, userId, null, jobListType.homePage);
    const rawJobs = _.get(jobsResult, 'items');
    jsonLogger.info({ type: "TRACKING", function: "homePage::getHomePageStatistics", rawJobsLength: _.size(rawJobs) });

    const { jobs, milestones, jobsWithActiveStatus, budgetRequests, pendingForBids, providerIds, paymentsChartData } = jobsListsDivider(rawJobs);
    const bidsdata = await fetchBidsData(pendingForBids);
    companyProvidersService.setProjectionExpression(companyProviderFileds[jobListType.homePage]);
    let talentData = await fetchTalentData(companyId, jobs);


    const { activeJobs, activeTalents } = listActiveJobsAndTalents(jobsWithActiveStatus, talentData);

    talentData = talentData.filter((talent) => providerIds[talent.itemId])

    statistics.jobs = jobs;
    statistics.talents = talentData;
    statistics.budgetRequests = budgetRequests;
    statistics.milestones = milestones;
    statistics.budgetByJob = [];
    statistics.bids = bidsdata;
    statistics.jobsCounter = activeJobs;
    statistics.talentsCounter = activeTalents;
    statistics.paymentsChartData = paymentsChartData

    jsonLogger.info({ type: "TRACKING", function: "homePage::getHomePageStatistics", length: _.size(statistics) });

    return responseLib.success(statistics);
}


module.exports = {
    getHomePageStatistics
}
