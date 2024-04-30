'use strict';

const tableFieldNames = {
    poNumber: 'poNumber',
    scopeType: 'scopeType',
    talents: 'talents',
    workspaces: 'workspaces',
    usage: 'usage',
    available: 'available',
    used: 'used',
    total: 'total',
    period: 'period',
    startDate: 'startDate',
    expirationDate: 'expirationDate',
    creationDate: 'creationDate',
    description: 'description',
    blanketPOId: 'blanketPOId',
    mainPONumber: 'mainPONumber',
    lineItemNumber: 'lineItemNumber',
    address: 'address',
    poStatus: 'poStatus',
    closedBy: 'closedBy',
};

const columnTypesByView = {
    byBillingView: [
        tableFieldNames.poNumber,
        tableFieldNames.scopeType,
        tableFieldNames.talents,
        tableFieldNames.workspaces,
        tableFieldNames.usage,
        tableFieldNames.used,
        tableFieldNames.period,
        tableFieldNames.startDate,
        tableFieldNames.expirationDate,
        tableFieldNames.creationDate,
        tableFieldNames.description,
        tableFieldNames.blanketPOId,
        tableFieldNames.mainPONumber,
        tableFieldNames.lineItemNumber,
        tableFieldNames.address,
        tableFieldNames.closedBy,
    ],
    fullView: [
        tableFieldNames.poNumber,
        tableFieldNames.scopeType,
        tableFieldNames.talents,
        tableFieldNames.workspaces,
        tableFieldNames.usage,
        tableFieldNames.available,
        tableFieldNames.used,
        tableFieldNames.total,
        tableFieldNames.period,
        tableFieldNames.startDate,
        tableFieldNames.expirationDate,
        tableFieldNames.creationDate,
        tableFieldNames.description,
        tableFieldNames.blanketPOId,
        tableFieldNames.mainPONumber,
        tableFieldNames.lineItemNumber,
        tableFieldNames.address,
        tableFieldNames.poStatus,
        tableFieldNames.closedBy,
    ]
};

const mandatoryHeaders = {
    mainPONumber: 'mainPONumber',
    lineItemNumber: 'lineItemNumber',
}

const billingExportHeaders = {
    workspaces: 'workspaces',
    usage: 'usage',
    used: 'used',
    expirationDate: 'expirationDate',
    creationDate: 'creationDate',
    description: 'description',
    address: 'address',
    closedBy: 'closedBy',
};

const exportHeader = {
    scopeType: 'scopeType',
    talents: 'talents',
    workspaces: 'workspaces',
    usage: 'usage',
    available: 'available',
    used: 'used',
    total: 'total',
    startDate: 'startDate',
    expirationDate: 'expirationDate',
    creationDate: 'creationDate',
    description: 'description',
    address: 'address',
    poStatus: 'poStatus',
    closedBy: 'closedBy',
};

const mandatoryPoUsageHeaders = {
    milestoneName: 'milestoneName',
    amount: 'amount',
    billing: 'billing',
}

const exportPoUsageHeader = {
    milestoneName: 'milestoneName',
    jobTitle: 'jobTitle',
    itemNumber: 'itemNumber',
    talent: 'talent',
    hiringManager: 'hiringManager',
    workspaces: 'workspaces',
    amount: 'amount',
    billing: 'billing',
}

const ADDRESS_FIELDS = ["street", "city", "state", "postalCode", "country"];

const USAGE_TYPES = {
    talentService: 'talentService',
    fees: 'fees',
    globalFees: 'globalFees',
};

const poFilters = {
    scopeIds: 'scopeIds',
    poScopeType: 'poScopeType',
    poStatus: 'poStatus',
}

const PO_BREAKDOWN_ROW_TYPE = {
    milestone: 'milestone',
    billing: 'billing',
}

const PO_STATUS = {
    closed: 'Closed',
    active: 'Active',
}

module.exports = {
    mandatoryHeaders,
    exportHeader,
    billingExportHeaders,
    ADDRESS_FIELDS,
    USAGE_TYPES,
    columnTypesByView,
    tableFieldNames,
    poFilters,
    PO_BREAKDOWN_ROW_TYPE,
    PO_STATUS,
    exportPoUsageHeader,
    mandatoryPoUsageHeaders,
};
