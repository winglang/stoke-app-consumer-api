/* eslint-disable max-lines */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-undefined */
/* eslint-disable no-magic-numbers */

"use strict";

const {
  jsonLogger, constants, snsLib, csvLib,
  CompaniesService, JobsService, BudgetsService, UsersService, permisionConstants
} = require("stoke-app-common-api");

const AWS = require("aws-sdk");
const s3 = new AWS.S3({
  signatureVersion: "v4",
});
const jobs = require("./jobs");
const _ = require("lodash");
const { transformDataForRow, saveToFile, getAllKeysIncludedCudtomeFields } = require("./bulkOperations/utils");
const { createAndGetCompanyProviders, rowsProvidersValidation, getCompanyProviders } = require("./bulkOperations/companyProvidersUtils");
const S3_SIGNED_URL_EXPIRED = 60 * 60

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const budgetsService = new BudgetsService(process.env.budgetsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const jobsFlowKeys = {
  companyId: 'Company Id',
  providerEmail: 'Provider Email',
  providerFirstName: 'Provider First name',
  providerLastName: 'Provider Last Name',
  sendInvite: 'Send invite',
  email: 'Talent Email',
  talentFirstName: 'Talent First name',
  talentLastName: 'Talent Last Name',
  userEmail: 'User Email',
  entityId: 'Department Id',
  entityName: 'Department Name',
  jobTitle: 'Job Title',
  jobDescription: 'Job Description',
  miletsotneTitle: 'Milestone Title',
  milestoneDescription: 'Milestone Description',
  milestoneAmount: 'Milestone Amount',
  pendingAmount: 'Milestone Pending Amount',
  approvedAmount: 'Milestone Approve Amount',
  milestoneDate: 'Milestone Date',
  jobStartDate: 'Job Start Date',
  hourlyRate: 'Hourly Rate',
  adminUserId: 'Admin User Id',
};

const callculateBudget = async (rows) => {
  jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::callculateBudget" });
  const allMilestones = _.groupBy(rows, (row) => `companyId: ${row.companyId}, userId: ${row.userId}, email: ${row.userEmail}, entityId: ${row.entityId}, year: ${new Date(Number(row.milestoneDate)).getFullYear()}, period: ${Math.floor(new Date(Number(row.milestoneDate)).getMonth() / 12 * 4) + 1}`);
  const budgetData = {};
  for (const key of Object.keys(allMilestones)) {
    const milestonesBudgets = allMilestones[key];
    const jobBudget = _.sumBy(milestonesBudgets, (milestone) => _.max([
      Number(milestone.milestoneAmount),
      Number(milestone.pendingAmount),
      Number(milestone.approvedAmount),
    ]));
    // eslint-disable-next-line prefer-destructuring
    const firstMilestone = milestonesBudgets[0];
    const { companyId, adminUserId, entityId, userId, milestoneDate } = firstMilestone
    const currentDate = new Date(Number(milestoneDate || Date.now()));
    let isTransfered = false
    let isUserBudgetAvailable = false
    try {
      const sourceUser = adminUserId || userId;
      const isCompanyAdmin = await usersService.validateUserEntityWithComponents(sourceUser, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.budget]: {} });
      isUserBudgetAvailable = await budgetsService.isAvailableBudget(entityId, `${constants.prefix.user}${userId}`, currentDate, jobBudget);
      if (isCompanyAdmin) {
        const fromItem = {
          companyId,
          entityId: companyId,
          itemId: constants.prefix.user + sourceUser,
          modifiedBy: sourceUser,
        };
        const toItem = {
          companyId,
          entityId,
          itemId: constants.prefix.user + userId,
          modifiedBy: userId,
        };

        const result = await budgetsService.transfer(fromItem, toItem, currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 12 * 4) + 1, Math.ceil(jobBudget))
        if (result) {
          isUserBudgetAvailable = true
          isTransfered = true
        }
      }
    } catch (e) {
      jsonLogger.error({ type: "TRACKING", function: "s3FilesProcessor::callculateBudget", message: `Error in calculate budget - ${key}`, error: e });
    }
    budgetData[key] = { budget: jobBudget, isUserBudgetAvailable, isTransfered };
  }
  jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::callculateBudget", budgetData, });
  return budgetData;
};


const getMapUserIdToEmail = async (rows) => {
  const allUsers = await companiesService.list(process.env.gsiItemsByCompanyIdIndexName, rows[0].companyId, constants.prefix.userPoolId, {}, " attribute_exists(userId) ");
  const mapEmailToId = allUsers.reduce((obj, user) => ({ ...obj, [_.get(user, "itemData.userEmail")]: user.userId }), {});
  jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::getMapUserIdToEmail", mapEmailToId, });
  if (!mapEmailToId || !Object.keys(mapEmailToId).length) {
    return null;
  }
  return rows.map((row) => ({ ...row, userId: mapEmailToId[row.userEmail] }));
};


const activeJobsByTalentId = async (talentId, entityId, userId) => {
  const keyConditionExpression = `entityId = :entityId and begins_with(itemId, :prefix)`;
  const filterExpression = `itemStatus = :active and userId = :userId and itemData.talentId = :talentId`;
  const expressionAttributeValues = {
    ':prefix': constants.prefix.job,
    ':entityId': entityId,
    ':active': constants.job.status.active,
    ':userId': userId,
    ':talentId': talentId,
  };
  const existingJobs = await jobsService.queryAll(null, keyConditionExpression, expressionAttributeValues, filterExpression)
  return _.first(existingJobs);
}


// eslint-disable-next-line max-lines-per-function
const createJobFullFlow = async (rows, key, customFieldsProvider) => {
  jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", rows, customFieldsProvider });
  const companyId = _.get(rows, '[0].companyId');
  const allProviderData = await getCompanyProviders(companyId, customFieldsProvider);
  const errorPath = `jobsFlows/error/${companyId}/${key.split('/').pop()}-${Date.now()}.csv`
  const { rowsError } = await rowsProvidersValidation(rows, companyId, allProviderData, errorPath, jobsFlowKeys);
  if (_.size(rowsError)) {
    const fileUrl = await s3.getSignedUrl('getObject', {
      Bucket: process.env.jobsBucketName,
      Key: errorPath,
      Expires: S3_SIGNED_URL_EXPIRED,
    });
    await snsLib.publish(process.env.jobsFlowSnsTopicArn, `Error in csv for company id - ${companyId} - rows`, { url: fileUrl, path: errorPath });
    jsonLogger.info({ type: 'TRACKING', function: 'bulkOperationsHelper::createJobFullFlow', text: 'send sns topic for ERROR creation jobs', errorPath });
    return rowsError;
  }

  const rowsWithUserId = await getMapUserIdToEmail(rows);
  const { rowsWithTalentId, rowsWithTalentIsNotPayable } = await createAndGetCompanyProviders(rowsWithUserId, allProviderData, customFieldsProvider);

  jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", rowsWithTalentId, rowsWithTalentIsNotPayable });

  const budgetData = await callculateBudget(rowsWithTalentId);
  if (_.some(budgetData, (row) => !row.isUserBudgetAvailable)) {
    jsonLogger.error({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", message: "no budget available", });
    return null;
  }
  const statistics = {};
  if (rowsWithTalentId && rowsWithTalentId.length) {
    const allMilestones = _.groupBy(rowsWithTalentId, (row) => `${row.companyId} ${row.talentId} ${row.userId} ${row.entityId}`);
    for (const keyMs of Object.keys(allMilestones)) {
      try {
        const milestones = allMilestones[keyMs];
        jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", message: "start job flow", jobData: milestones[0] });
        // eslint-disable-next-line prefer-destructuring
        const { talentId, userId, adminUserId, entityId, jobTitle, jobDescription, hourlyRate, jobStartDate } = milestones[0];
        const milestoneTalent = _.get(allProviderData, `allTalentsByItemId.${talentId}`);

        const milestoneTalentData = {
          firstName: _.get(milestoneTalent, 'itemData.firstName'),
          lastName: _.get(milestoneTalent, 'itemData.lastName'),
          name: ''.concat(_.get(milestoneTalent, 'itemData.firstName'), ' ', _.get(milestoneTalent, 'itemData.lastName')),
          img: _.get(milestoneTalent, 'itemData.img')
        }

        const itemData = {
          jobStartDate: jobStartDate ? new Date(jobStartDate).getTime() : Date.now(),
          talentId, jobTitle, jobDescription,
          hourlyBudget: Number(hourlyRate),
          totalBudget: _.sumBy(milestones, (ms) => Number(ms.milestoneAmount)),
          talentData: milestoneTalentData,
        };

        // eslint-disable-next-line no-loop-func
        const milestonesToCreate = milestones.map((milestone) => ({
          itemStatus: constants.job.status.pending,
          itemData: {
            title: milestone.miletsotneTitle,
            description: milestone.milestoneDescription,
            date: milestone.milestoneDate,
            cost: Number(milestone.milestoneAmount),
            pendingAmount: Number(milestone.pendingAmount),
            approvedAmount: Number(milestone.approvedAmount),
            talentData: milestoneTalentData,
          },
        }));


        let job = await activeJobsByTalentId(talentId, entityId, userId);
        if (job) {
          jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", message: "Do not create job - existing job active for talent", job });
          const milestonesCreates = await jobs.innerCreateMilestones(companyId, entityId, job, userId, milestonesToCreate);
          jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", message: "milestones created", milestonesCreates });
          const activeMilestones = await jobsService.transactUpdate(milestonesToCreate.map((ms) => ({ ...ms, itemStatus: constants.job.status.active })));
          jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", message: "milestones updated to active", activeMilestones });
        } else {
          jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", message: "Start create jobb" });
          job = await jobs.innerCreateJob(companyId, entityId, userId, adminUserId || userId, itemData, constants.job.status.autoDraft);
          jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", message: "Job created", job, });

          const updatedJob = await jobsService.get(entityId, job.itemId, true);

          const innerSignResult = await jobs.innerSign(companyId, entityId, updatedJob.itemData, job.itemId, userId, adminUserId || userId, talentId, milestonesToCreate);
          jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", message: "milestones created", innerSignResult });
        }


        let updatedMilestones = await jobsService.list(entityId, null, `${constants.prefix.milestone}${job.itemId}_`, undefined, true);
        const milestonesPending = updatedMilestones.
          filter((milestone) => milestone.itemStatus === constants.job.status.active && milestone.itemData.pendingAmount).
          map((milestone) => ({
            itemId: milestone.itemId,
            entityId: milestone.entityId,
            itemStatus: constants.job.status.pendingApproval,
            itemData: {
              ..._.omit(milestone.itemData, "pendingAmount"),
              actualRequestCost: milestone.itemData.pendingAmount,
              actualCost: milestone.itemData.pendingAmount,
              providerData: { taxInfo: { paymentCurrency: "USD" } },
            },
            modifiedBy: userId,
          }));
        jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", milestonesPending, });
        if (milestonesPending && milestonesPending.length) {
          await jobsService.transactUpdate(milestonesPending);
        }

        updatedMilestones = await jobsService.list(entityId, null, `${constants.prefix.milestone}${job.itemId}_`);
        const milestonesApproved = updatedMilestones.
          filter((milestone) => milestone.itemStatus === constants.job.status.pendingApproval && milestone.itemData.approvedAmount).
          map((milestone) => ({
            itemId: milestone.itemId,
            entityId: milestone.entityId,
            itemStatus: constants.job.status.completed,
            itemData: {
              ..._.omit(milestone.itemData, "approvedAmount"),
              actualCost: milestone.itemData.approvedAmount,
            },
            modifiedBy: userId,
          }));
        jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", milestonesApproved, });
        if (milestonesApproved && milestonesApproved.length) {
          await jobsService.transactUpdate(milestonesApproved);
        }
        statistics[job.itemId] = {
          milestones: updatedMilestones.length,
          milestonesPending: milestonesPending.length,
          milestonesApproved: milestonesApproved.length,
        };
      } catch (e) {
        jsonLogger.error({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", message: e.message, stack: e.stack });
      }
    }
  }
  let url = null;
  let path = null;
  if (rowsWithTalentIsNotPayable && rowsWithTalentIsNotPayable.length) {
    path = await saveToFile(rowsWithTalentIsNotPayable, `jobsFlows/old/${companyId}/${key.split('/').pop()}-${Date.now()}.csv`, jobsFlowKeys);
    url = await s3.getSignedUrl('getObject', {
      Bucket: process.env.jobsBucketName,
      Key: path,
      Expires: S3_SIGNED_URL_EXPIRED,
    });
  }
  const subject = `bulk creation file for company id - ${rows[0].companyId}`;
  const message = { path, statistics, url };
  try {
    const result = await snsLib.publish(process.env.jobsFlowSnsTopicArn, subject, message);
    jsonLogger.info({ type: 'TRACKING', function: 's3FilesProcessor::createJobFullFlow', text: 'send sns topic for bulk creation jobs', result });
  } catch (e) {
    jsonLogger.error({ type: 'TRACKING', function: 's3FilesProcessor::createJobFullFlow', text: `exception - ${e.message}`, e });
  }
  jsonLogger.info({ type: "TRACKING", function: "s3FilesProcessor::createJobFullFlow", message: "done", statistics, });
  return statistics;
};

const transformData = (rows) => rows.map((row) => ({ ...transformDataForRow(row), milestoneDate: row.milestoneDate ? new Date(row.milestoneDate).getTime() : Date.now() }));

const bulkCreateMilestones = async (event, context, callback) => {
  jsonLogger.info({ function: "s3FilesProcessor::test", functionName: context.functionName, awsRequestId: context.awsRequestId, event, });
  const rows = event;

  const customFieldsProvider = {
    customFieldsCompanyProvider: [],
    customFieldsCompanyTalent: []
  }
  const result = await createJobFullFlow(transformData(rows), 'key', customFieldsProvider);
  callback(null, result);
};

const handler = async (event, context, callback) => {
  const allResult = []
  try {
    jsonLogger.info({ function: "s3FilesProcessor::processS3Records", functionName: context.functionName, awsRequestId: context.awsRequestId, event, });
    for (const record of event.Records) {
      if (record.eventName === "ObjectCreated:Put") {
        const { name } = record.s3.bucket;
        const { key } = record.s3.object;
        // eslint-disable-next-line require-unicode-regexp
        const s3Object = await s3.getObject({ Bucket: name, Key: decodeURIComponent(key.replace(/\+/g, " ")) }).promise();
        const data = s3Object.Body.toString("utf-8");
        const keysPath = key.split('/')
        const companyId = keysPath[keysPath.length - 2];
        const { allKeys, customFieldsProvider } = await getAllKeysIncludedCudtomeFields(data, jobsFlowKeys, companyId);
        const rows = csvLib.csvToObjects(data, allKeys);
        if (name === process.env.jobsBucketName) {
          const result = await createJobFullFlow(transformData(rows), key, customFieldsProvider);
          allResult.push(result);
        }
      }
    }
  } catch (e) {
    jsonLogger.error({ type: "TRACKING", function: "s3FilesProcessor::processS3Records", message: e.message, stack: e.stack });
  }
  callback(null, allResult);
};


module.exports = {
  rowsProvidersValidation,
  bulkCreateMilestones,
  handler
}
