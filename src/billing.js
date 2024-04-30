/* eslint-disable no-undefined */
/* eslint-disable no-magic-numbers */
/* eslint-disable max-lines-per-function */

'use strict';

const { jsonLogger, responseLib, JobsService, constants, CompanyProvidersService, UsersService, CompaniesService, idConverterLib, dynamoDbUtils } = require('stoke-app-common-api');
const _ = require('lodash');
const AWS = require('aws-sdk');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');
const { companyProviderFileds, jobListType } = require("./job/queryAttrs");
const s3 = new AWS.S3({});

const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes)
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);

const readJSON = async (file) => {
  const key = file.Key
  const params = { Bucket: process.env.jobsBucketName, Key: key }
  const data = (await s3.getObject(params).promise()).Body.toString('utf-8');
  return JSON.parse(data);
}

const getIsStokeInvoicesExistags = async (file) => {
  const key = file.Key
  const tags = await s3.getObjectTagging({ Bucket: process.env.jobsBucketName, Key: key }).promise();
  jsonLogger.info({
    type: "TRACKING",
    function: "billing::getIsStokeInvoicesExistags",
    tags
  });
  return _.some(_.get(tags, 'TagSet', []), (tag) => _.get(tag, 'Key') === constants.invoices.stokeInvoicePath)
}

const parseFile = async (file) => {
  const json = await readJSON(file);
  const isStokeInvoicesExist = await getIsStokeInvoicesExistags(file);
  _.set(json, 'isStokeInvoicesExist', isStokeInvoicesExist);
  return json;
}

const addMilestonesDataToBilling = (body, milestones, jobs) => body.map((item) => {
  const milestone = milestones[item.milestoneId];
  const tags = _.get(jobs, `${item.jobId}.tags`);
  const milestoneTags = _.get(milestone, `tags`);
  const startDate = _.get(jobs, `${item.jobId}.itemData.jobStartDate`);
  const invoice = _.find(_.get(milestone, 'files', []), (file) => file.isInvoice);
  const proForma = _.some(_.get(milestone, 'files', []), (file) => file.isProForma)
    ? _.find(_.get(milestone, 'files', []), (file) => file.isProForma)
    : _.find(_.get(milestone, 'files', []), (file) => file.autoTalentInvoice);
  const files = _.filter(_.get(milestone, 'files', []), (file) => !file.isProForma && !file.autoTalentInvoice && !file.isInvoice);
  const valueDate = _.get(milestone, 'payment.valueDate')
  const requestedHours = _.get(milestone, 'requestedData.hourlyValue')
  const jobCurrency = _.get(milestone, 'currency')

  return {
    ...item,
    tags,
    milestoneTags,
    startDate,
    invoice,
    files,
    proForma,
    valueDate,
    jobCurrency,
    requestedHours,
    invoiceNumber: _.get(milestone, 'invoiceNumber'),
    invoiceDate: _.get(milestone, 'invoiceDate'),
    lineItems: _.get(milestone, 'lineItems'),
  }
})

const createBillingData = (billing, milestones, jobs) => billing.reduce((all, curr) => {
  const { body, billingId, name, from, to, title, totalAmount, totalAmountAfterDiscount, vatTotalAmount, totalAmountAfterDiscountAndVAT, summaryRows, version, isStokeInvoicesExist } = curr;
  const existingName = Object.keys(all).filter((key) => key.startsWith(name));
  const index = existingName.length + 1;
  const id = `${name}_${index}`;
  const nameSplit = name.split('_');
  const [year] = nameSplit;
  const { 1: month } = nameSplit;
  const bodyWithJobsData = addMilestonesDataToBilling(body, milestones, jobs);
  const billableActionsFees = _.get(_.find(billing, b => b.billingId === billingId), 'billableActionsFees', {})

  return {
    ...all,
    [id]: {
      id: billingId,
      year,
      title,
      month,
      index,
      from,
      to,
      isStokeInvoicesExist,
      body: bodyWithJobsData,
      totalAmount,
      totalAmountAfterDiscount,
      vatTotalAmount,
      totalAmountAfterDiscountAndVAT,
      isSupportFees: Number(version) >= 2,
      summaryRows,
      billableActionsFees
    }
  };
}, {})

const createDataFromResult = (providers, attr = 'itemId') => providers.reduce((all, curr) => {
  const { itemData, tags } = curr;
  return {
    ...all,
    [curr[attr]]: { ...itemData, tags }
  };
}, {})

const getIdsFromData = (data, attr) => _.reduce(data, (all, curr) => ({ ...all, ...curr.body.reduce((allMs, currMs) => ({ ...allMs, [_.get(currMs, attr)]: true }), {}) }), {})

const getJobsFromBilling = async (billing) => {
  const jobsKeys = _.chain(billing).map((invoice) => _.get(invoice, 'body', [])).
    flatten().
    map((row) => ({ itemId: row.jobId, entityId: row.entityId })).
    uniqBy((item) => `${item.itemId}${item.entityId}`).
    value()
  const jobs = await dynamoDbUtils.batchGetParallel(process.env.jobsTableName, jobsKeys, constants.projectionExpression.defaultAndTagsAttributes);
  return _.keyBy(jobs, 'itemId');

}

/**
 * getBilling - get all billing by company id
 * @param {object} event lambda event, event.queryStringParameters is the method data
 * @param {object} context - lambda context
 * @returns {object} bid
 */
module.exports.getBilling = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  const { companyId, fetchProviders, fetchUsers, billingId } = _.get(event, 'queryStringParameters');

  jsonLogger.info({
    type: "TRACKING",
    function: "billing::getBilling",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    userId, companyId, fetchProviders, fetchUsers, billingId,
  });

  const authorised = await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin, { [permissionsComponentsKeys.billing]: {} });
  if (!authorised) {
    return responseLib.forbidden({ status: false });
  }

  let invoices = null;
  let providers = null;
  let hiringManagers = null;
  try {
    let milestones = [];
    if (billingId) {
      const filterExpression = 'itemData.billingId = :billingId'
      const expressionAttributeValues = {};
      const keyConditionExpression = "companyId = :companyId";
      expressionAttributeValues[":companyId"] = companyId;
      expressionAttributeValues[":billingId"] = billingId;
      milestones = await jobsService.queryAll(process.env.gsiItemsByCompanyIdAndItemIdIndexNameV2, keyConditionExpression, expressionAttributeValues, filterExpression);
    } else {
      milestones = await jobsService.jobsPagingtion('listByCompanyId', undefined, [
        process.env.gsiItemsByCompanyIdAndItemIdIndexNameV2,
        companyId,
        null,
        constants.prefix.milestone,
        [
          constants.job.status.completed,
          constants.job.status.paid
        ]
      ]);
    }
    milestones = createDataFromResult(milestones);
    const prefix = billingId ? `${process.env.billingFolderName}/${companyId}/${billingId}` : `${process.env.billingFolderName}/${companyId}`;
    const params = { Bucket: process.env.jobsBucketName, Prefix: prefix };
    const allFiles = await s3.listObjectsV2(params).promise();
    jsonLogger.info({
      type: "TRACKING",
      function: "billing::getBilling",
      allFiles
    });
    if (!allFiles) {
      jsonLogger.error({
        type: "TRACKING",
        function: "billing::getBilling",
        exception: `error get billing for companyId : ${companyId}`
      });
    }
    const billing = await Promise.all(allFiles.Contents.map((file) => parseFile(file)))
    const jobs = await getJobsFromBilling(billing);
    invoices = createBillingData(billing, milestones, jobs);
    if (invoices) {
      if (fetchProviders) {
        companyProvidersService.setProjectionExpression(companyProviderFileds[jobListType.paymentsPage]);
        providers = await companyProvidersService.companyProvidersPagination('listCompany', [
          companyId,
          undefined,
          undefined,
          undefined
        ]);
        const providersIds = getIdsFromData(invoices, 'providerId');
        // eslint-disable-next-line no-confusing-arrow
        providers = providers.filter((provider) => provider.itemId.startsWith(constants.prefix.talent) ? providersIds[idConverterLib.getProviderIdFromTalentId(provider.itemId)] : providersIds[provider.itemId])
        providers = createDataFromResult(providers);
      }
      if (fetchUsers) {
        hiringManagers = await companiesService.list(process.env.gsiItemsByCompanyIdIndexName, companyId, constants.prefix.userPoolId, {}, 'attribute_exists(userId)');
        const hmIds = getIdsFromData(invoices, 'hiringManagerId');

        hiringManagers = hiringManagers.filter((hiringManager) => hmIds[hiringManager.userId]);
        hiringManagers = createDataFromResult(hiringManagers, 'userId');
      }
    }
  } catch (e) {
    jsonLogger.error({
      type: "TRACKING",
      function: "billing::getBilling",
      exception: e.message, companyId
    });
  }
  return invoices ? responseLib.success({ invoices, providers, hiringManagers }) : responseLib.failure({ status: false });
};
