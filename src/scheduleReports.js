/* eslint-disable prefer-named-capture-group */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-magic-numbers */
/* eslint-disable max-lines-per-function */

"use strict";

const { parseCronExpression } = require("cron-schedule");

const _get = require('lodash/get')
const { jsonLogger, constants, SettingsService, SqsService } = require("stoke-app-common-api");
const { createCsv } = require('./helpers/csvReport/createCsv');
const { resolveActiveFiltersForPaymentPage, resolvePeriodPicker, resolveRequestedFields, resolvePaymentCycle } = require('./helpers/scheduleReportHelper');
const { jobListType } = require('./job/queryAttrs');
const { gsiItemsByCompanyIdAndItemIdIndexName } = process.env;
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const asyncTasksQueue = new SqsService(process.env.asyncTasksQueueName);

 const getIsLastDayInShortMonth = (now, cron) => {
    const [dayInMonth] = cron.days
    const [hours] = cron.hours
    const shortsMonthsCases = [
        { month: 1, lastDayOfMonth: 28 },
        { month: 3, lastDayOfMonth: 30 },
        { month: 5, lastDayOfMonth: 30 },
        { month: 8, lastDayOfMonth: 30 },
        { month: 10, lastDayOfMonth: 30 }
    ]

    const isMonthlySchedule = cron.days.length === 1
    const isDayOneOfLast3Days = [29, 30, 31].includes(dayInMonth)
    const isShortMonthCase = shortsMonthsCases.some(date => date.month === now.getMonth() && date.lastDayOfMonth === now.getDate() && date.lastDayOfMonth < dayInMonth)
    const isScheduleThisHour = hours === now.getHours()

    return isMonthlySchedule && isDayOneOfLast3Days && isShortMonthCase && isScheduleThisHour
}

const createCsvReport = async (userId, companyId, reportDetails) => {
    const data = {
        companyId,
        type: jobListType.paymentsPage,
        filterKey: null,
        tableRequestedFields: resolveRequestedFields(_get(reportDetails, 'selectedColumns')),
        filters: {
            ...resolvePaymentCycle(_get(reportDetails, 'selectedPaymentCycle')),
            ...await resolveActiveFiltersForPaymentPage(_get(reportDetails, 'filters'), companyId),
            ...resolvePeriodPicker(_get(reportDetails, 'periodPicker'), _get(reportDetails, 'dateFilterType')),
        },
    }

    const { key } = await createCsv(userId, data)
    if (!key) {
        jsonLogger.error({ type: "TRACKING", function: "scheduleReports::createCsvRepor", message: "Failed to create csvReport", reportId: reportDetails.id });
    }
    const csvFileKey = decodeURIComponent(key)
    return csvFileKey
}

const sendScheduleReport = async (companyId, reportDetails, csvFileKey) => {
    const reportName = _get(reportDetails, 'name')
    const usersToSend = _get(reportDetails, 'schedulerData.recipients.usersIds') 
    const reportId = _get(reportDetails, 'id')
    try {
        // eslint-disable-next-line guard-for-in
        for (const userId of usersToSend) {
            const res = await asyncTasksQueue.sendMessage({ taskData: { companyId, reportName, reportId, csvFileKey, userId }, type: constants.sqsAsyncTasks.types.schedulerReportEmail });
            if (res) {
                jsonLogger.info({ type: "TRACKING", function: "scheduleReports::sendScheduleReport", message: "scheduleReport email has been sent", reportId: reportDetails.id, res });
            } else {
                jsonLogger.error({ type: "TRACKING", function: "scheduleReports::sendScheduleReport", message: "Failed to send email to asyncTasksQueue", userId, reportName, reportId, csvFileKey, companyId });
            }
        }
    } catch (error) {
      jsonLogger.error({ type: "TRACKING", function: "scheduleReports::sendScheduleReport", message: "Failed to send email to asyncTasksQueue", reportId, companyId, error });
    }
}

/**
 * sendingRelevantReports - send all emails with relevant schedulers reports
 * part of step function
 * @param {Object} event - event of function
 * @param {Object} context - context of function
 * @param {callback} callback - callback of function
 * @returns {null} results
 */
const sendingRelevantReports = async (event, context, callback) => {
    const { companyId } = event;

    jsonLogger.info({
        type: "TRACKING",
        function: "scheduleReports::sendingRelevantReports",
        event,
        context,
        companyId,
    });
    
    const result = { companyId, reportsToSendCount: 0 };
    try {
        // get all scheduler reports of this company
        const schedulerReportsSettings = await settingsService.listSavedReports(gsiItemsByCompanyIdAndItemIdIndexName, companyId, null, true);
        jsonLogger.info({
            type: "TRACKING",
            function: "scheduleReports::sendingRelevantReports",
            companyId,
            schedulerReportsSettings: schedulerReportsSettings,
        });

        // eslint-disable-next-line require-unicode-regexp, prefer-destructuring
        const now = new Date()
        now.setMinutes(0, 0, 0)
        const cronMatchDate = schedulerReportsSettings.filter((item) => {
            const cron = parseCronExpression(item.itemData.reportDetails.schedulerData.scheduleSending)
            const isLastDayInShortMonth = getIsLastDayInShortMonth(now, cron)
            
            jsonLogger.info({
                type: "TRACKING",
                function: "scheduleReports::cronMatchDate",
                cron,
                now,
                reportId: item.itemId,
                cronMatchDate: isLastDayInShortMonth || cron.matchDate(now),
            });
            return isLastDayInShortMonth || cron.matchDate(now)
        });
        result.reportsToSendCount = cronMatchDate.length

        jsonLogger.info({
            type: "TRACKING",
            function: "scheduleReports::sendingRelevantReports",
            companyId,
            reportsToSend: cronMatchDate,
        });

        for (const schedulerReport of cronMatchDate) {
            const reportDetails = _get(schedulerReport, 'itemData.reportDetails')
            const userId = _get(schedulerReport, 'userId')
            const csvFileKey = await createCsvReport(userId, companyId, reportDetails)
            await sendScheduleReport(companyId, reportDetails, csvFileKey)
        }
    } catch (error) {
        jsonLogger.error({
            type: "TRACKING",
            function: "scheduleReports::sendingRelevantReports",
            message: error.message,
        });
    }
    callback(null, result);
};


module.exports = {
    sendingRelevantReports,
}
