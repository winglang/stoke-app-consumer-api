'use strict';

const { constants } = require('stoke-app-common-api');

const strings = Object.freeze({
    allWorkspaces: 'All Workspaces',
    fees: 'Fees',
    talentPayments: 'Talent payments',
    globalFees: 'Additional services',
    headerNames: {
        mainPONumber: 'PO number',
        lineItemNumber: 'Item number',
        scopeType: 'Scope',
        talents: 'Talent',
        workspaces: 'Workspaces',
        usage: 'Usage',
        available: 'Available (USD)',
        used: 'Used (USD)',
        total: 'Total (USD)',
        startDate: 'Period start',
        expirationDate: 'Period end',
        creationDate: 'Created on',
        description: 'Description',
        address: 'Address',
        poStatus: 'PO status',
        closedBy: 'Closed By',
    },
    poUsageHeaderNames: {
        milestoneName: 'Milestone name',
        jobTitle: 'Job title',
        itemNumber: 'Item number',
        talent: 'Talent',
        hiringManager: 'Hiring manager',
        workspaces: 'Workspace',
        amount: 'Amount',
        billing: 'Billing',
    },
    scopeTypeValues: {
        [constants.poScopeTypes.company]: 'Company',
        [constants.poScopeTypes.departments]: 'Workspace(s)',
        [constants.poScopeTypes.talents]: 'Talent',
    }
});

module.exports = {
    strings
};
