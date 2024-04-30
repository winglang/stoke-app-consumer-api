'use strict'

const getOfferedJobsReportFields = (isJobIdExist) => {
    const jobTitleField = [{ "field": "job", "headerName": "Job title" }]
    const jobIdCustomField = isJobIdExist ? [{ "field": "stoke::jobId", "headerName": "Job ID" }] : []
        
    return [
        ...jobTitleField,
        ...jobIdCustomField,
        {
            "field": "role",
            "headerName": "Role"
        },
        {
            "field": "type",
            "headerName": "Type"
        },
        {
            "field": "quote",
            "headerName": "Quote"
        },
        {
            "field": "talentName",
            "headerName": "Talent name"
        },
        {
            "field": "talentTitle",
            "headerName": "Title"
        },
        {
            "field": "talentResponse",
            "headerName": "Response"
        },
        {
            "field": "responseTime",
            "headerName": "Response time"
        },
        {
            "field": "talentHired",
            "headerName": "Hired"
        }
    ]
}

module.exports = {
    getOfferedJobsReportFields,
};
