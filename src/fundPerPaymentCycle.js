/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */

'use strict';

const {
  consumerAuthTableName,
  jobsTableName,
  gsiItemsByCompanyIdAndItemIdIndexNameV2,
  settingsTableName,
  customersTableName,
} = process.env;

const _ = require('lodash');
const { fetchJobsForMilestones } = require('./helpers/jobHelper');
const {
  responseLib,
  constants,
  companyDueDateService,
  idConverterLib,
  jsonLogger,
  UsersService,
  JobsPaymentStatusService,
  SettingsService,
  BalanceService,
  paymentCyclesHelper,
  permisionConstants
} = require('stoke-app-common-api');
const { jobListFields } = require("./job/queryAttrs");
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsPaymentStatusService = new JobsPaymentStatusService(jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsPaymentServiceMinimized = new JobsPaymentStatusService(jobsTableName, jobListFields.paymentCyclesMinimalAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const balanceService = new BalanceService(customersTableName, null, constants.attributeNames.defaultAttributes);
const { resolveFundingDate, PaidStatuses } = require('./helpers/billingHelper');


const cycleTypes = {
  closed: 'CLOSED',
  notCovered: 'NOT_COVERED',
  open: 'OPEN',
  blocked: 'BLOCKED',
}

// eslint-disable-next-line max-params
const normalizeMilestones = (milestones, jobsByKey, cycleType, range, billingRows) => _.map(milestones, (milestone) => {

  const { from, to: paymentCycleDate } = range || {};
  const jobItemData = _.get(jobsByKey, [idConverterLib.getJobIdFromMilestoneId(milestone.itemId), 'itemData'], {});
  const billings = _.keyBy(_.filter(billingRows, row => row.externalId), 'externalId');
  const { jobTitle, jobStartDate, talentId } = jobItemData;
  const { itemId, userId, entityId, itemData, itemStatus, companyId } = milestone;
  const { title, payment, date, cost, costLocal, actualRequestCost, isAcceleratePayment, billingId } = itemData;
  const fundingDate = resolveFundingDate(milestone);
  const actualCost = paymentCyclesHelper.getBillingAmount(milestone);
  const paymentStatus = _.get(payment, 'status');
  const dueDate = _.get(payment, 'dueDate');
  const paymentDate = PaidStatuses.includes(paymentStatus) && _.get(payment, 'valueDate', _.get(payment, 'submittedDate', dueDate));
  const paymentCycle = paymentStatus !== constants.payment.status.pendingFunds && paymentCycleDate;
  const approval = _.findLast(itemData.approvals, record => record.action === 'approve');
  const isOverThreshold = cycleType === cycleTypes.open && paymentStatus === constants.payment.status.pendingFunds

  return {
    itemId,
    companyId,
    hiringManagerId: userId,
    departmentId: entityId,
    jobTitle,
    title,
    talentId,
    itemStatus,
    paymentStatus,
    paymentDate,
    plannedAmount: cost,
    cost,
    actualRequestCost,
    costLocal,
    actualCost,
    jobStartDate,
    milestoneDeliveryDate: date,
    isAcceleratePayment,
    fundingDate,
    paymentCycle,
    approvalDate: _.get(approval, 'approveDate'),
    billingDescription: _.get(billings, [`billing_${billingId}`, 'description']),
    isDelayedPayment: dueDate < from,
    isOverThreshold
  };
})

const isFundPerPaymentCycle = (companySettings) => _.get(companySettings, 'itemData.payments.fundingRequirementType') === constants.fundingRequirementTypes.fundPerCycle;

const normalizeFees = (balanceRows, range) => {
  const { from, to } = range;
  jsonLogger.info({ function: "fundPerPaymentCycle::normalizeFees", balanceRows, from, to });
  const feesInCycle = _.filter(balanceRows, (row) => row.allFees && row.externalId && row.dateTime > from && row.dateTime <= to);
  jsonLogger.info({ function: "fundPerPaymentCycle::normalizeFees", feesInCycle });

  const normalizedFees = _.map(feesInCycle, (fee) => {
    const { allFees, description = '', dateTime } = fee;
    
    return {
      stokeBill: true,
      title: `${description.replace('Billing - ', '')}`,
      actualCost: allFees,
      actualRequestCost: allFees,
      cost: allFees,
      paymentStatus: constants.payment.status.paid,
      itemStatus: constants.job.status.paid,
      fundingDate: dateTime,
      billingDescription: description,
      paymentCycle: to,
    }
  })

  return normalizedFees;
}

const calculateFeesInCycle = (balanceRows, to, from) => {
  const feesRows = _.filter(balanceRows, (row) => row.allFees && row.externalId && row.dateTime > from && row.dateTime <= to);
  jsonLogger.info({ function: "fundPerPaymentCycle::calculateFeesInCycle", feesRows });
  if (_.isEmpty(feesRows)) {
    return 0
  }
  return _.round(_.sumBy(feesRows, 'allFees'), 0);
}

const getTotalAmountFromMilestones = (milestones) => {
  const milestonesCount = _.size(milestones);
  const milestonesTotal = _.isEmpty(milestones) ? 0 : _.round(_.sumBy(milestones, (row) => paymentCyclesHelper.getBillingAmount(row)));
  return { milestonesCount, milestonesTotal };
};

const isFuturePaymentCycle = (requestedCycle) => {
  const now = new Date().setUTCHours(23, 59, 59, 999);
  const requested = new Date(requestedCycle).setUTCHours(23, 59, 59, 999);
  return requested > now;
}

const calculateNotCoveredAmounts = async (companyId, openCycleTotal) => {
  jsonLogger.info({ function: "fundPerPaymentCycle::calculateNotCoveredAmounts", companyId, openCycleTotal });
  const companyBalance = await balanceService.getCompanyBalanceAmount(companyId);
  const notBilledMilestones = await jobsPaymentServiceMinimized.queryByStatusWithoutBillingId(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, [constants.job.status.completed, constants.job.status.paid]);
  const { milestonesTotal: notBilledAmount } = getTotalAmountFromMilestones(notBilledMilestones);  
  const notCoveredAmount = Math.max(notBilledAmount - companyBalance - openCycleTotal, 0);
  jsonLogger.info({ function: "fundPerPaymentCycle::calculateNotCoveredAmounts", companyBalance, notCoveredAmount });

  return notCoveredAmount;
}

const getCycleTotalDetails = (milestonesInCycle, balanceRows, range) => {
  const { milestonesTotal, milestonesCount } = getTotalAmountFromMilestones(milestonesInCycle);
  const feesTotal = calculateFeesInCycle(balanceRows, range.to, range.from);
  return { milestonesTotal, milestonesCount, feesTotal };
}

const getCyclesWithRanges = (paymentCycles) => _.reduce(
  paymentCycles,
  (result, value) => {
    result[value] = paymentCyclesHelper.getRange(paymentCycles, value);
    return result;
  },
  {}
);

const getNotCoveredPaymentCycles = async (companyId, paymentCycles, notCoveredAmount, balanceRows) => {
  const notCoveredCycles = [];
  
  if (notCoveredAmount > 0) {
    const historicalPaymentCycles = _.dropRight(paymentCycles);
    const paymentCycleRanges = getCyclesWithRanges(paymentCycles);

    let remainedNotCoveredAmount = notCoveredAmount;
    let cycleId = _.size(historicalPaymentCycles) - 1;

    while (remainedNotCoveredAmount > constants.paymentCycleThresholds.grace && cycleId >= 0) {
        const cycle = historicalPaymentCycles[cycleId];
        const range = paymentCycleRanges[cycle];
        
        // eslint-disable-next-line no-await-in-loop
        const milestonesInCycle = await jobsPaymentServiceMinimized.queryMilestonesInPaymentCycle(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, range.from, range.to);
        const { milestonesTotal, feesTotal } = getCycleTotalDetails(milestonesInCycle, balanceRows, range);
        const total = milestonesTotal + feesTotal;
        
        // eslint-disable-next-line require-atomic-updates
        remainedNotCoveredAmount -= total;
        cycleId -= 1;
        notCoveredCycles.push(cycle)

        jsonLogger.info({ function: "fundPerPaymentCycle::getNotCoveredPaymentCycles", notCoveredCycles, remainedNotCoveredAmount, notCoveredAmount });
    }
  }

  return notCoveredCycles;
}

module.exports.handler = async (event, context) => {
  jsonLogger.info({ function: "fundPerPaymentCycle::handler", event, context });

  const userId = event.requestContext.identity.cognitoIdentityId;
  const { companyId, requestedPaymentCycle, fetchInitialData } = event.queryStringParameters || {};
  
  jsonLogger.info({ function: "fundPerPaymentCycle::handler", companyId, requestedPaymentCycle, fetchInitialData });
  
  if (!companyId) {
    jsonLogger.error({ function: "fundPerPaymentCycle::handler", message: "Missing mandatory params" });
    return responseLib.failure();
  }

  const isCompanyAdmin = await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.funding]: { } });
  if (!isCompanyAdmin) {
    jsonLogger.error({ function: "fundPerPaymentCycle::handler", message: "Only company admins can get the paymentCycle data" });
    return responseLib.forbidden({ status: false });
  }
  const companySettings = await settingsService.get(`${constants.prefix.company}${companyId}`);

  if (!isFundPerPaymentCycle(companySettings)) {
    jsonLogger.error({ function: "fundPerPaymentCycle::handler", message: "This company is not in fundPerPaymentCycleMode", companySettings });
    return responseLib.forbidden({ status: false });
  }

  const paymentCycles = companyDueDateService.getPaymentCyclesByVersion(companySettings);
  const range = paymentCyclesHelper.getRange(paymentCycles, requestedPaymentCycle);
  
  const milestonesInCycle = await jobsPaymentStatusService.queryMilestonesInPaymentCycle(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, range.from, range.to);
  const balanceRows = await balanceService.getCompanyBalanceRows(companyId);

  const { milestonesTotal, milestonesCount, feesTotal } = getCycleTotalDetails(milestonesInCycle, balanceRows, range);
  
  let notCoveredCycles = [];
  let notCoveredInPreviousCycles = null;
  let openCycleType = null;

  if (fetchInitialData || isFuturePaymentCycle(requestedPaymentCycle)) {
    notCoveredInPreviousCycles = await calculateNotCoveredAmounts(companyId, feesTotal + milestonesTotal);
    notCoveredCycles = await getNotCoveredPaymentCycles(companyId, paymentCycles, notCoveredInPreviousCycles, balanceRows);
    openCycleType = notCoveredInPreviousCycles > constants.paymentCycleThresholds.grace ? cycleTypes.blocked : cycleTypes.open;
    jsonLogger.info({ function: "fundPerPaymentCycle::handler", notCoveredInPreviousCycles, notCoveredCycles, openCycleType });
  }

  const jobs = await fetchJobsForMilestones(milestonesInCycle);
  const jobsByKey = _.keyBy(jobs, 'itemId');

  const normalizedMilestones = normalizeMilestones(milestonesInCycle, jobsByKey, openCycleType, range, balanceRows);
  const normalizedFees = normalizeFees(balanceRows, range);
  const rows = [
    ...normalizedMilestones,
    ...normalizedFees
  ];

  const result = {
    rows,
    openCycleType,
    milestonesTotal,
    feesTotal,
    notCoveredInPreviousCycles,
    paymentCycles,
    milestonesCount,
    notCoveredCycles,
  };

  jsonLogger.info({ function: "fundPerPaymentCycle::handler", result });

  return responseLib.success(result);
};
