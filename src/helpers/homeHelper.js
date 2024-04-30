/* eslint-disable no-magic-numbers */

'use strict'

const { budgetHelper, constants } = require('stoke-app-common-api')
const _ = require('lodash')

const formatDate = date => date && `${new Date(date).getFullYear()}_${budgetHelper.getPeriodByMonth(new Date(date).getMonth(), 4)}`
const JobStatusesChart = {
    APPROVED_PAYMENTS: 'APPROVED_PAYMENTS',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    PENDING_FUNDS: 'PENDING_FUNDS'
}
const getAccumulatedCost = (cost, paymentsChartData, keyPeriod, paymentStatus) => ({
    currency: constants.currencySigns[constants.currencyTypes.USD],
    value: (cost || 0) + 
        (_.has(paymentsChartData, [keyPeriod, paymentStatus])
            ? paymentsChartData[keyPeriod][paymentStatus].value || 0
            : 0)
})
const jobStatusesToReject = [
    constants.payment.status.cancelled,
    constants.payment.status.error,
    constants.payment.status.rejected,
    constants.payment.status.unknown
]
const addChartValue = ({ cost, paymentsChartData, chartKey, paymentStatus }) => ({
			...paymentsChartData,
			[chartKey.quarter]: {
				...paymentsChartData[chartKey.quarter],
				[paymentStatus]: {
					...paymentsChartData[chartKey.quarter] ? paymentsChartData[chartKey.quarter][paymentStatus] : {},
					...getAccumulatedCost(cost, paymentsChartData, chartKey.quarter, paymentStatus)
				}
			},
			[chartKey.year]: {
				...paymentsChartData[chartKey.year],
				[paymentStatus]: {
					...paymentsChartData[chartKey.year] ? paymentsChartData[chartKey.year][paymentStatus] : {},
					...getAccumulatedCost(cost, paymentsChartData, chartKey.year, paymentStatus)
				}
			}
	})
	

module.exports = {
  JobStatusesChart, 
  addChartValue,
  formatDate,
  jobStatusesToReject
}
