/* eslint-disable max-lines */
/* eslint-disable no-undefined */
/* eslint-disable no-mixed-operators */
/* eslint-disable max-lines-per-function */
/* eslint-disable newline-per-chained-call */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-magic-numbers */


'use strict';

const {
  consumerAuthTableName,
  jobsTableName,
  gsiItemsByCompanyIdAndItemIdIndexNameV2,
  settingsTableName,
  customersTableName,
  ledgerTableName,
  gsiItemsByCompanyIdAndJobIdIdx
} = process.env;

const _ = require('lodash');
const { fetchJobsForMilestones } = require('./helpers/jobHelper');
const { fetchTalentData } = require('./job/jobListAttrs');
const { jobListType } = require('./job/queryAttrs')
const {
  responseLib,
  constants,
  companyDueDateService,
  idConverterLib,
  jsonLogger,
  billingHelper,
  UsersService,
  JobsPaymentStatusService,
  SettingsService,
  BalanceService,
  LedgerService,
  dynamoDbLib,
  permisionConstants
} = require('stoke-app-common-api');
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsPaymentStatusService = new JobsPaymentStatusService(jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const balanceService = new BalanceService(customersTableName, null, constants.attributeNames.defaultAttributes);
const { resolveFundingDate, getBillingEstimationForMilestones, PaidStatuses } = require('./helpers/billingHelper');
const ledgerService = new LedgerService(ledgerTableName);

const negativeDeposit = 'negative';

const fundingDataType = {
  paymentCycle: 'paymentCycle',
  depositData: 'depositData'
}

const getMsDepositAmount = (row) => _.round(_.sum(Object.values(_.get(row, 'itemData.payment.depositData.depositAmount', {}))) || 0, 2)
const getMsDepositIds = (row) => _.get(row, 'itemData.payment.depositData.depositIds', []) || []
const getBillingRows = (row) => row.externalId && (row.externalId.startsWith(constants.balance.prefix.billing) || row.externalId.startsWith(constants.balance.prefix.vat))
const getFeeAmount = (fee) => _.round(_.sum(Object.values(_.get(fee, 'depositFeeData.depositAmount', {}))) || 0, 2);
const getFeeDepositIds = (row) => _.get(row, 'depositFeeData.depositIds', []) || []

const normalizeFees = (fees, requestedDate) => _.map(fees, (fee) => {
  const { depositAmount, allFees: cost, description = '', dateTime } = fee;
  const isNegativeDeposit = Number(requestedDate) < 0;
  let partialPaymentInfo = null;
  if (depositAmount && depositAmount < _.round(cost, 2)) {
    partialPaymentInfo = getFeeDepositIds(fee).filter((id) => id !== Number(requestedDate));
    const allDepositAmount = getFeeAmount(fee);
    if (!isNegativeDeposit && allDepositAmount < _.round(cost, 2)) {
      partialPaymentInfo.push(negativeDeposit)
    }  
  }
  return {
    stokeBill: true,
    title: `${description.replace('Billing - ', '')}`,
    actualCost: cost,
    actualRequestCost: cost,
    cost,
    paymentStatus: constants.payment.status.paid,
    depositAmount,
    itemStatus: constants.job.status.paid,
    fundingDate: dateTime,
    billingDescription: description,
    partialPaymentInfo
  }
})

// eslint-disable-next-line max-params
const normalizeMilestones = (milestones, requestedDate, jobsByKey, billingRows, paymentSchedule) => _.map(milestones, (milestone) => {
  const statusHistory = _.get(milestone, 'itemData.payment.statusHistory', []);
  const pendingFunds = _.find(statusHistory, history => history.status === constants.payment.status.pendingFunds);
  const approvalDate = _.get(pendingFunds, 'date');
  const billings = _.keyBy(_.filter(billingRows, row => row.externalId), 'externalId');
  let diffInDays = 0;
  if (approvalDate) {
    const approvedInCycle = companyDueDateService.getFromCompanySettings(paymentSchedule, approvalDate);
    diffInDays = Math.ceil((requestedDate - approvedInCycle) / (1000 * 60 * 60 * 24));
  }

  const jobItemData = _.get(jobsByKey, [idConverterLib.getJobIdFromMilestoneId(milestone.itemId), 'itemData'], {});
  const { jobTitle, jobStartDate, talentId } = jobItemData;
  const { itemId, userId, entityId, itemData, itemStatus, companyId, depositAmount } = milestone;
  const { title, actualCost: originalAmount, payment, date, cost, costLocal, actualRequestCost, billingId, isAcceleratePayment } = itemData;
  const approval = _.findLast(itemData.approvals, record => record.action === 'approve');
  const fundingDate = resolveFundingDate(milestone);
  const isNegativeDeposit = Number(requestedDate) < 0;
  const actualCost = _.get(payment, 'billingAmount') || originalAmount;
  let partialPaymentInfo = null;
  if (depositAmount && depositAmount < _.round(actualCost, 2)) {
    partialPaymentInfo = getMsDepositIds(milestone).filter((id) => id !== Number(requestedDate));
    const allDepositAmount = getMsDepositAmount(milestone);
    if (!isNegativeDeposit && allDepositAmount < _.round(actualCost, 2)) {
      partialPaymentInfo.push(negativeDeposit)
    }  
  }
  const paymentStatus = _.get(payment, 'status');
  const paymentDate = PaidStatuses.includes(paymentStatus) && _.get(payment, 'valueDate', _.get(payment, 'submittedDate', _.get(payment, 'dueDate'))); 

  return {
    itemId,
    companyId,
    hiringManagerId: userId,
    departmentId: entityId,
    jobTitle,
    title,
    talentId,
    itemStatus: itemStatus === constants.ledgerConstants.status.submitted ? constants.ledgerConstants.status.paid : itemStatus,
    paymentStatus,
    partialPaymentInfo,
    paymentDate,
    plannedAmount: cost,
    cost,
    actualRequestCost,
    costLocal,
    actualCost,
    depositAmount,
    jobStartDate,
    milestoneDeliveryDate: date,
    billingId,
    approvalDate: _.get(approval, 'approveDate'),
    billingDate: _.get(billings, [`billing_${billingId}`, 'dateTime']),
    billingDescription: _.get(billings, [`billing_${billingId}`, 'description']),
    isDelayedPayment: diffInDays > 1,
    isAcceleratePayment,
    fundingDate,
  };
})

const getAvailableBalance = async (companyId, billingRows) => {
  const milestones = await jobsPaymentStatusService.queryMilestonesWithPaymentStatusWithoutBillingId(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId);

  const balance = _.get(_.last(billingRows), 'balance', 0);
  return _.round(balance - _.sumBy(milestones, (row) => _.get(row, 'itemData.actualCost', _.get(row, 'itemData.cost', 0)) || 0) || 0, 2);
}

// eslint-disable-next-line max-params
const getOpenCycleSummary = async (milestones, billingRows, companyId, fees = [], withMissing) => {
  jsonLogger.info({ function: "paymentCycle::getOpenCycleSummary", billingRows, companyId, fees, withMissing });
  let [allocated, total, missing, available, notAllocatedWithBilling] = [0, 0, 0, 0, 0];
  _.forEach(milestones, milestone => {
    const { itemData } = milestone || {};
    const billingAmount = _.get(itemData, 'payment.billingAmount');
    const actualCost = billingAmount || _.get(itemData, 'actualCost', _.get(itemData, 'cost', 0));
    total += actualCost;
    switch (_.get(itemData, 'payment.status')) {
      case constants.payment.status.pending:
      case constants.payment.status.submitted:
      case constants.payment.status.paid:
      case constants.payment.status.cancelled:
      case constants.payment.status.paidVerified:
      case constants.payment.status.scheduled:
      case constants.payment.status.rejected:
        allocated += actualCost;
        break;
      default:
        if (itemData.billingId) {
          notAllocatedWithBilling += actualCost;
        }
        break;
    }
  })
  const feesAllocated = _.sumBy(fees, 'allFees');
  total += feesAllocated;
  allocated += feesAllocated; 
  const notAllocated = total - allocated;
  if (withMissing) {
    available = await getAvailableBalance(companyId, billingRows);
    missing = _.round(Math.max(notAllocated - notAllocatedWithBilling - available, 0), 2);
  }
  jsonLogger.info({ function: "paymentCycle::getOpenCycleSummary", allocated, notAllocated, total, available, missing });
  return { allocated, notAllocated, estimatedTotalPayment: total, available, missing };
}

const getMilestonesByDeposit = async (params = {}, billingRows) => {
  const { companyId, depositId } = params;
  const isNegativeDeposit = Number(depositId) < 0;
  const keyConditionExpression = "companyId = :companyId and begins_with(jobId, :prefix)";
  const filterExpression = `itemStatus in (:submittedStatus, :paidstatus) `
  const expressionAttributeValues = {
    ":companyId": companyId,
    ":submittedStatus": constants.ledgerConstants.status.submitted,
    ":paidstatus": constants.ledgerConstants.status.paid,
    ":prefix": constants.prefix.milestone,
  };

  let ledgers = await ledgerService.queryAll(gsiItemsByCompanyIdAndJobIdIdx, keyConditionExpression, expressionAttributeValues, filterExpression);
  ledgers = dynamoDbLib.filterLatestRecords(ledgers, false);
  if (isNegativeDeposit) {
    ledgers = _.filter(ledgers, (ledger) => ledger.itemStatus === constants.ledgerConstants.status.submitted);
  } else {
    ledgers = _.filter(ledgers, (ledger) => getMsDepositIds(ledger).includes(Number(depositId)));
  }

  const milestones = _.map(ledgers, (ledger) => ({
    ...ledger,
    itemId: ledger.jobId,
    depositAmount: isNegativeDeposit ? _.round(_.get(ledger, 'itemData.actualCost', 0) - getMsDepositAmount(ledger), 2) : _.get(ledger, ['itemData', 'payment', 'depositData', 'depositAmount', depositId])
  }))

  const fees = _.chain(billingRows).
    filter((row) => getBillingRows(row) && (!isNegativeDeposit && 
      _.get(row, 'depositFeeData.depositIds', []).includes(Number(depositId)) || getFeeAmount(row) < row.allFees)).
    map((fee) => ({
      ...fee,
      depositAmount: isNegativeDeposit ? _.round(fee.allFees - getFeeAmount(fee), 2) : _.get(fee, ['depositFeeData', 'depositAmount', depositId])
    })).
    value();
  const totalFees = _.sumBy(fees, 'depositAmount') || 0;
  const allocated = _.sumBy(milestones, 'depositAmount') || 0;
  const allocatedAll = allocated + totalFees;
  const deposits = _.filter(billingRows, (row) => row.dateTime === Number(depositId) && row.amount > 0);
  const total = _.sumBy(deposits, 'amount') || 0;
  const available = await getAvailableBalance(companyId, billingRows);
  const notAllocated = _.round(Math.max(total - allocatedAll, 0), 2);
  const summary = { allocated: allocatedAll, notAllocated, missing: 0, available, estimatedTotalPayment: total };
  jsonLogger.info({ function: "paymentCycle::getMilestonesByDeposit", deposits, summary, billingRows, depositId });
  return { milestones: milestones, fees, summary, requestedDate: depositId };
}

// eslint-disable-next-line max-params
const buildPaymentCycleFees = (allFees, billingTitle, from, to, billingRows) => {
  jsonLogger.info({ function: "paymentCycle::buildPaymentCycleFees", allFees, from, to, billingRows, billingTitle });
  const fees = _.chain(billingRows).
    filter((row) => getBillingRows(row) &&
      row.dateTime > from && row.dateTime <= to).
    value();

  return fees;
}

const getCalculatorInfo = async (companyId) => {
  const promises = [];
  promises.push(jobsPaymentStatusService.queryUpcomingPayments(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId));
  promises.push(jobsPaymentStatusService.queryByStatusWithoutBillingId(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, [constants.job.status.completed, constants.job.status.paid]));
  
  const allMilestones = await Promise.all(promises);
  const [pendingMilestones, milestonesForBilling] = allMilestones;

  const pendingAmount = _.sumBy(pendingMilestones, milestone => _.get(milestone, 'itemData.actualCost', 0));

  const billingFile = await getBillingEstimationForMilestones(companyId, milestonesForBilling);
  const { processingFees, stokeFees } = billingHelper.getFeesBySubject(billingFile);
  return { pendingAmount, transactionAndExchangeFees: processingFees, stokeFees };
}

const getPaymentCycleRows = async (params = [], billingRows, paymentCycles) => {
  const { companyId, requestedPaymentCycle } = params || {};
  const paymentCycle = new Date(_.parseInt(requestedPaymentCycle)).setHours(23, 59, 59, 999) || _.last(paymentCycles);
  const previousCycleTime = _.findLast(paymentCycles, cycle => cycle < paymentCycle) || 0;
  jsonLogger.info({ function: "paymentCycle::getPaymentCycleRows", from: previousCycleTime, to: paymentCycle });
  const from = new Date(previousCycleTime).setHours(23, 59, 59, 999)
  const to = new Date(paymentCycle).setHours(23, 59, 59, 999)

  const milestonesInCycle = await jobsPaymentStatusService.queryMilestonesInPaymentCycle(gsiItemsByCompanyIdAndItemIdIndexNameV2, companyId, from, to);

  const fees = buildPaymentCycleFees(null, null, from, to, billingRows);
  const summary = await getOpenCycleSummary(milestonesInCycle, billingRows, companyId, fees, new Date().setHours(23, 59, 59, 999) < to);
  return { milestones: milestonesInCycle, summary, requestedDate: paymentCycle, fees };
}

module.exports.handler = async (event, context) => {
  jsonLogger.info({ function: "paymentCycle::handler", event, context });

  const userId = event.requestContext.identity.cognitoIdentityId;
  const { companyId, dataType } = event.queryStringParameters || {};
  if (!companyId) {
    jsonLogger.error({ function: "paymentCycle::handler", message: "Missing mandatory params" });
    return responseLib.failure();
  }

  const isCompanyAdmin = await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.funding]: { } });
  if (!isCompanyAdmin) {
    jsonLogger.error({ function: "paymentCycle::handler", message: "Only company admins can get the paymentCycle data" });
    return responseLib.forbidden({ status: false });
  }
  const setting = await settingsService.get(`${constants.prefix.company}${companyId}`);
  const paymentCycles = companyDueDateService.getPaymentCyclesByVersion(setting);
  const billingRows = await balanceService.getCompanyBalanceRows(companyId);
  let milestones = [];
  let requestedDate = null;
  let summary = null;
  let calculator = {};
  let fees = [];
  const currentDataType = dataType || fundingDataType.paymentCycle;
  switch (currentDataType) {
    case fundingDataType.depositData:
      ({ milestones, summary, requestedDate, fees } = await getMilestonesByDeposit(event.queryStringParameters, billingRows));
      break;
    case fundingDataType.paymentCycle:
    default:
      ({ milestones, requestedDate, summary, fees } = await getPaymentCycleRows(event.queryStringParameters, billingRows, paymentCycles));
      calculator = await getCalculatorInfo(companyId);
      calculator.notAllocated = summary.notAllocated;
      calculator.available = summary.available;
      break;
  }
  const jobs = await fetchJobsForMilestones(milestones);
  const jobsByKey = _.keyBy(jobs, 'itemId');
  const rows = normalizeMilestones(milestones, requestedDate, jobsByKey, billingRows, setting.itemData.paymentSchedule);
  const rowsFees = normalizeFees(fees, requestedDate)
  const depositRows = BalanceService.filterDepositRows(billingRows);
  const talents = await fetchTalentData(jobs, jobListType.paymentsPage);
  const result = {
    rows: [...rows, ...rowsFees],
    talents,
    summary,
    depositRows,
    calculator,
    paymentCycles,
  };
  return responseLib.success(result);
};
