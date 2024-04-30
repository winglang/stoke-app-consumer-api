/* eslint-disable max-lines */
/* eslint-disable no-undefined */
/* eslint-disable no-magic-numbers */

'use strict'

const _ = require('lodash');
const { sqlAggType } = require('./constants');
const { currencyTypes } = require('stoke-app-common-api/config/constants');

const buildLocalAmountSql = (curency, field) => _.map(_.uniq(Object.values(currencyTypes)), (currencyType) => `sum(case when ${curency} = '${currencyType}' then ${field} else 0 end) as ${field}${currencyType}`).join(', ');


// add more basic fields here, this array order will be the column order of the csv exported file
const basicFieldsForJobsPage = [
    {
        "field": "milestone",
        "headerName": "Milestones"
    },
    {
        "field": "job",
        "headerName": "Job"
    },
    {
        "field": "lineItemTitle",
        "headerName": "Line item title"
    },
    {
        "field": "lineItemDescription",
        "headerName": "Line item description"
    },
    {
        "field": "lineItemAmount",
        "headerName": "Line item amount"
    },
    {
        "field": "lineItemCurrency",
        "headerName": "Line item currency"
    },
    {
        "field": "description",
        "headerName": "Description"
    },
    {
        "field": "engagementType",
        "headerName": "Type"
    },
    {
        "field": "status",
        "headerName": "Status"
    },
    {
        "field": "hiringManager",
        "headerName": "Hiring Manager"
    },
    {
        "field": "department",
        "headerName": "Workspace"
    },
    {
        "field": "comment",
        "headerName": "Talent's comment"
    },
    {
        "field": "jobStartDate",
        "headerName": "Job Start Date"
    },
    {
        "field": "team",
        "headerName": "Space"
    },
    {
        "field": "talentData",
        "headerName": "Talent"
    },
    {
        "field": "date",
        "headerName": "Delivery Date"
    },
    {
        "field": "plannedLocal",
        "headerName": "Planned"
    },
    {
        "field": "requested",
        "headerName": "Requested"
    },
    {
        "field": "approvedDate",
        "headerName": "Approved Date"
    },
    {
        "field": "approvedBy",
        "headerName": "Approved By"
    },
    {
        "field": "rejectedBy",
        "headerName": "Rejected by"
    },
    {
        "field": "approved",
        "headerName": "Approved"
    },
    {
        "field": "requestedDate",
        "headerName": "Requested Date"
    },
    {
        "field": "invitationDate",
        "sqlExp": 'invitationDate',
    },
    {
        "field": "registrationDate",
        "sqlExp": 'registrationDate',
    },
    {
        "field": "startDate",
        "sqlExp": 'startDate',
    },
]

const basicFieldsForPaymentPage = [
    {
        "field": "talentName",
        "headerName": "Talent"
    },
    {
        "field": "email",
        "headerName": "Talent email"
    },
    {
        "field": "providerName",
        "headerName": "Company",
        sqlExpAgg: sqlAggType.none,
    },
    {
        "field": "providerEmail",
        "headerName": "Company contact email",
        sqlExpAgg: sqlAggType.none,
    },
    {
        "field": "companyTaxId",
        "headerName": "Talent Tax ID",
        sqlExpAgg: sqlAggType.none,
    },
    {
        "field": "location",
        "headerName": "Talent location",
        sqlExpAgg: sqlAggType.none,
    },
    {
        "field": "address",
        "headerName": "Talent address",
        sqlExpAgg: sqlAggType.none,
    },
    {
        "field": "phone",
        "headerName": "Talent phone",
        sqlExpAgg: sqlAggType.none,
    },
    {
        "field": "hiringManager",
        "headerName": "Hiring manager",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "department",
        "headerName": "Workspace",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "space",
        "headerName": "Space",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "costCenter",
        "headerName": "Cost center",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "legalEntity",
        "headerName": "Legal entity",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "jobTitle",
        "headerName": "Job title",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "jobType",
        "headerName": "Job type",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "jobStatus",
        "headerName": "Job status",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "startDate",
        "headerName": "Job Start Date",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "milestoneTitle",
        "headerName": "Milestone name",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "milestoneId",
        "headerName": "Milestone Id",
        sqlExpAgg: sqlAggType.count,
    },
    {
        "field": "date",
        "headerName": "Milestone delivery date",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "status",
        "headerName": "Milestone status",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "lineItemTitle",
        "headerName": "Line item title",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "lineItemDescription",
        "headerName": "Line item description",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "lineItemAmount",
        "headerName": "Line item amount"
    },
    {
        "field": "lineItemCurrency",
        "headerName": "Line item currency"
    },
    {
        "field": "timeReportDate",
        "headerName": "Time report date",
    },
    {
        "field": "timeReportHours",
        "headerName": "Time report hours",
    },
    {
        "field": "timeReportComment",
        "headerName": "Time report comment",
    },
    {
        "field": "timeReportHoursSum",
        sqlExpAgg: sqlAggType.sum,
    },
    {
        "field": "timeReportSessionsSum",
        sqlExpAgg: sqlAggType.sum,
    },
    {
        "field": "amount",
        "headerName": "Current amount (USD)",
        sqlExpAgg: sqlAggType.sum,
    },
    {
        "field": "currency",
        "headerName": "Job currency",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "hourlyRate",
        "headerName": "Hourly rate (job currency)",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "plannedHours",
        "headerName": "Planned hours",
        sqlExpAgg: sqlAggType.sum,
    },
    {
        "field": "approved",
        "headerName": "Approved amount (payment currency)",
        sqlExpAgg: buildLocalAmountSql('localCurrencyType', 'approved'),
    },
    {
        "field": "plannedLocal",
        "headerName": "Planned amount (job currency)",
        sqlExpAgg: buildLocalAmountSql('jobCurrency', 'plannedLocal'),
    },
    {
        "field": "requestDate",
        "headerName": "Requested date",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "approveDate",
        "headerName": "Approved date",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "approvedBy",
        "headerName": "Approved by",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "rejectedBy",
        "headerName": "Rejected by",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "localCurrencyType",
        "headerName": "Payment currency",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "requestedHours",
        "headerName": "Requested hours",
        sqlExpAgg: sqlAggType.sum,
    },
    {
        "field": "localCurrencySubTotal",
        "headerName": "Requested sub-total (payment currency)",
        sqlExpAgg: buildLocalAmountSql('localCurrencyType', 'localCurrencySubTotal'),
    },
    {
        "field": "localCurrencyTax",
        "headerName": "Requested VAT/TAX (payment currency)",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "localCurrencyTotal",
        "headerName": "Requested total (payment currency)",
        sqlExpAgg: buildLocalAmountSql('localCurrencyType', 'localCurrencyTotal'),
    },
    {
        "field": "paymentStatus",
        "headerName": "Payment status",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "paymentValueDate",
        "headerName": "Payment date",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "invoiceNumber",
        "headerName": "Invoice number"
    },
    {
        "field": "invoiceDate",
        "headerName": "Invoice date",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "proForma",
        "headerName": "Invoice",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "invoice",
        "headerName": "Tax Invoice / Receipt",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "paymentMethod",
        "headerName": "Payment Method",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "transactionFee",
        "headerName": "Transaction fee (USD)",
        sqlExpAgg: sqlAggType.sum,
    },
    {
        "field": "stokeFee",
        "headerName": "Service Fee (USD)",
        sqlExpAgg: sqlAggType.sum,
    },
    {
        "field": "customRate",
        "headerName": "Rate (custom)",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "customPlanned",
        "headerName": "Planned (custom)",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "customRequested",
        "headerName": "Requested (custom)",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "comment",
        "headerName": "Talent's comment",
        sqlExpAgg: sqlAggType.concat,
    },
    {
        "field": "poNumber",
        "headerName": "PO number",
        sqlExpAgg: sqlAggType.concat,
    },    
    {
        "field": "itemNumber",
        "headerName": "PO item number",
        sqlExpAgg: sqlAggType.concat,
    }
]

const basicFieldsForTalentDirectoryPage = [
    {
        "field": "providerName",
        "headerName": "Provider name",
        "sqlExpAgg": sqlAggType.none,
    },
    {
        "field": "email",
        "headerName": "Email",
    },
    {
        "field": "name",
        "headerName": "Talent",
    },
    {
        "field": "status",
        "headerName": "Status",
        "sqlExpAgg": sqlAggType.concat,
    },
    {
        "field": "workspaces",
        "headerName": "Workspaces",
    },
    {
        "field": "title",
        "headerName": "Title",
        "sqlExpAgg": sqlAggType.concat,
    },
    {
        "field": "isPayable",
        "headerName": "Payable",
        "sqlExpAgg": sqlAggType.none,
    },
    {
        "field": "address",
        "headerName": "Full address",
    },
    {
        "field": "country",
        "headerName": "Location",
    },
    {
        "field": "phone",
        "headerName": "Phone",
    },
    {
        "field": "skillsData",
        "headerName": "Skills",
    },
    {
        "field": "languagesData",
        "headerName": "Languages",
    },
    {
        "field": "score",
        "headerName": "Score",
        "sqlExpAgg": sqlAggType.concat,
    },
    {
        "field": "paymentMethod",
        "headerName": "Payment method",
        "sqlExpAgg": sqlAggType.none,
    },
    {
        "field": "compliance",
        "headerName": "Compliance",
    },
    {
        "field": "complianceWorkforce",
        "headerName": "Workforce classification",
    },
    {
        "field": "complianceLegal",
        "headerName": "Legal compliance",
    },
    {
        "field": "complianceTax",
        "headerName": "Tax compliance",
    },
    {
        "field": "talentType",
        "headerName": "Talent Type",
    },
    {
        "field": "totalJobs",
        "headerName": "Total jobs",
        "sqlExpAgg": sqlAggType.sum,
    },
    {
        "field": "totalEarned",
        "headerName": "Total earned (all time)",
    },
    {
        "field": "backgroundCheck",
        "headerName": "BG check",
        "sqlExpAgg": sqlAggType.concat,
    },
    {
        "field": "certificationsData",
        "headerName": "Certifications",
    },
    {
        "field": "experienceData",
        "headerName": "Experience",
    },
    {
        "field": "workingPeriod",
        "headerName": "Working Period",
        "sqlExpAgg": sqlAggType.none,
    },
    {
        "field": "activeEngagementLength",
        "headerName": "Engagement Length",
        "sqlExpAgg": sqlAggType.none,
    },
    {
        "field": "averageMonthlyHours",
        "headerName": "Average Monthly Hours",
        "sqlExpAgg": sqlAggType.none,
    },
    {
        "field": "averageMonthlyPay",
        "headerName": "Average Monthly Pay (USD)",
        "sqlExpAgg": sqlAggType.none,
    },
    {
        "field": "signedUpNoNewJobsThreeMonths",
        "headerName": "signedUpNoNewJobsThreeMonths",
        "sqlExp": "signedUpNoNewJobsThreeMonths",
    }

]

const paginationFieldsForTalentDirectoryPage = [
    {
        field: "talentId",
        sqlExpAgg: sqlAggType.concat,
        sqlExp: 'talentId',
    },
    {
        field: "providerId",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerId',
    },
    {
        field: "isProviderSelfEmployedTalent",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'isProviderSelfEmployedTalent',
    },
    {
        field: "providerEmail",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerEmail',
    },
    {
        field: "totalEarnedObject",
        sqlExpAgg: sqlAggType.concatAll,
        sqlExp: 'totalEarnedObject',
    },
    {
        field: "providerStatus",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerStatus',
    },
    {
        field: "enrollData",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'enrollData',
    },
    {
        field: "providerAssignedDepartments",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerAssignedDepartments'
    },
    {
        field: "providerCountry",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerCountry'
    },
    {
        field: "providerAddress",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerAddress'
    },
    {
        field: "providerPhone",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerPhone'
    },
    {
        field: "providerImg",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerImg',
    },
    {
        field: "img",
        sqlExpAgg: sqlAggType.concat,
        sqlExp: 'img',
    },
    {
        field: "complianceScores",
        sqlExpAgg: sqlAggType.concat,
        sqlExp: 'complianceScores',
    },
    {
        field: "providerTitle",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerTitle',
    },
    {
        field: "providerScore",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerScore',
    },
    {
        field: "providerCompliance",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerCompliance',
    },
    {
        field: 'providerAllowedActions',
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerAllowedActions',
    },
    {
        field: 'allowedActions',
        sqlExpAgg: sqlAggType.concat,
        sqlExp: 'allowedActions',
    },
    {
        field: 'providerLegalDocuments',
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerLegalDocuments',
    },
    {
        field: 'legalDocuments',
        sqlExpAgg: sqlAggType.concat,
        sqlExp: 'legalDocuments',
    },
    {
        field: 'skills',
        sqlExpAgg: sqlAggType.concat,
        sqlExp: 'skills',
    },
    {
        field: 'languages',
        sqlExpAgg: sqlAggType.concat,
        sqlExp: 'languages'
    },
    {
        field: "experience",
        sqlExpAgg: sqlAggType.concat,
        sqlExp: 'experience',
    },
    {
        field: "certifications",
        sqlExpAgg: sqlAggType.concat,
        sqlExp: 'certifications',
    },
    {
        field: "startTime",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'startTime',
    },
    {
        field: "providerInvitationDate",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerInvitationDate',
    },
    {
        field: "providerRegistrationDate",
        sqlExpAgg: sqlAggType.none,
        sqlExp: 'providerRegistrationDate',
    },
    {
        field: "payableStatus",
        sqlExpAgg: sqlAggType.none,
        sqlExp: "payableStatus",
    }
]

const allFieldsForPaymentPage = _.map(basicFieldsForPaymentPage, 'field')
const allFieldsForJobsPage = _.map(basicFieldsForJobsPage, 'field')
const allFieldsForTalentDirectoryPage = _.map(basicFieldsForTalentDirectoryPage, 'field')

const headersNamesForJobFields = _.map(basicFieldsForJobsPage, 'headerName')
const headersNamesForPaymentsFields = _.map(basicFieldsForPaymentPage, 'headerName')
const headersNamesForTalentDirectoryFields = _.map(basicFieldsForTalentDirectoryPage, 'headerName')

module.exports = {
    basicFieldsForJobsPage,
    basicFieldsForPaymentPage,
    basicFieldsForTalentDirectoryPage,
    allFieldsForPaymentPage,
    allFieldsForJobsPage,
    allFieldsForTalentDirectoryPage,
    headersNamesForJobFields,
    headersNamesForPaymentsFields,
    headersNamesForTalentDirectoryFields,
    paginationFieldsForTalentDirectoryPage,
};
