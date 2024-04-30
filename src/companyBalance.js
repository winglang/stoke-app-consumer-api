/* eslint-disable max-lines-per-function */
/* eslint-disable newline-per-chained-call */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-magic-numbers */


'use strict';

const { consumerAuthTableName, customersTableName, jobsTableName, gsiItemsByCompanyIdAndItemIdIndexNameV2: indexName, jobsBucketName } = process.env;

const _ = require('lodash');
const { s3lib } = require('stoke-s3lib');
const { responseLib, jsonLogger, constants, UsersService, JobsPaymentStatusService, BalanceService, BillingService, billingHelper, SettingsService, permisionConstants } = require('stoke-app-common-api');
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const jobsPaymentStatusService = new JobsPaymentStatusService(jobsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const balanceService = new BalanceService(customersTableName, null, constants.attributeNames.defaultAttributes);
const billingService = new BillingService(process.env.jobsBucketName, process.env.billingFolderName, process.env.invoicesFolderName)
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const { getBillingEstimationForMilestones } = require('./helpers/billingHelper');

module.exports.handler = async (event, context) => {
  jsonLogger.info({ function: "companyBalance::handler", event, context });

  const userId = event.requestContext.identity.cognitoIdentityId;
  const { companyId } = event.pathParameters || {};
  if (!companyId) {
    jsonLogger.error({ function: "companyBalance::handler", message: "Missing mandatory params" });
    return responseLib.failure();
  }

  const isCompanyAdmin = await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.billing]: { } });
  if (!isCompanyAdmin) {
    return responseLib.forbidden({ status: false });
  }

  const rows = await balanceService.getCompanyBalanceRows(companyId, true);
  if (!rows) {
    return responseLib.failure();
  }

  const setting = await settingsService.get(`${constants.prefix.company}${companyId}`);
  const isBillFundedOnly = billingHelper.isPreFundCompany(setting) || billingHelper.isFundPerCycleCompany(setting)
  const milestones = await isBillFundedOnly ? await jobsPaymentStatusService.queryMilestonesWithPaymentStatusWithoutBillingId(indexName, companyId) : await jobsPaymentStatusService.queryByStatusWithoutBillingId(indexName, companyId, [constants.job.status.completed, constants.job.status.paid]);
  const { totalAmountAfterDiscount } = await getBillingEstimationForMilestones(companyId, milestones);
  BalanceService.enrichBillingRowsStatus(rows)

  const balances = {
    rows,
    milestonesWithoutBillingCost: totalAmountAfterDiscount,
    milestonesPendingFundsCost: 0,
    lastModified: new Date().getTime(),
  };

  jsonLogger.info({ function: "companyBalance::handler", balances });
  return responseLib.send({ balances });
};

module.exports.downloadHandler = async (event, context) => {
	jsonLogger.info({ function: "companyBalance::downloadHandler", event, context });

	const userId = event.requestContext.identity.cognitoIdentityId;
	const { companyId, billingId } = event.pathParameters || {};
	if (!companyId) {
		jsonLogger.error({ function: "companyBalance::downloadHandler", message: "Missing mandatory params" });
		return responseLib.failure();
	}

	const isCompanyAdmin = await usersService.validateUserEntityWithComponents(userId, companyId, constants.user.role.admin, { [permisionConstants.permissionsComponentsKeys.billing]: { } });
	if (!isCompanyAdmin) {
		return responseLib.forbidden({ status: false });
	}

	const rows = await balanceService.getCompanyBalanceRows(companyId);
	const billingRow = _.find(rows, (row) => row.externalId === `billing_${billingId}`);
	if (!billingRow) {
		jsonLogger.error({ function: "companyBalance::downloadHandler", error: "Billing row not found", billingId, billingRow });
		return responseLib.failure();
	}
	let url = null;
	let suffix = 'pdf'
	if (billingRow.invoicePath) {
		url = await s3lib.getSignedUrl("getObject", jobsBucketName, billingRow.invoicePath, 60); // 60 seconds
	} else {
		const invoicesKeys = await billingService.getPDFInvoicesKeys(companyId, billingId, [constants.invoices.stokeProformaInvoicePath]);
		if (_.size(invoicesKeys) === 1) {
			url = await s3lib.getSignedUrl("getObject", jobsBucketName, invoicesKeys[0], 60); // 60 seconds
		} else if (_.size(invoicesKeys) > 1) {
			const zipKey = `${companyId}/${companyId}/${userId}/${`stokeInvoices_${new Date().getTime()}.zip`}`;
			await s3lib.zipObjects(process.env.jobsBucketName, invoicesKeys, zipKey);
			url = await s3lib.getSignedUrl("getObject", jobsBucketName, zipKey, 60); // 60 seconds
			suffix = 'zip';
		}

	}
	jsonLogger.info({ function: "companyBalance::downloadHandler", url });
	return responseLib.send({ url, suffix });
};
