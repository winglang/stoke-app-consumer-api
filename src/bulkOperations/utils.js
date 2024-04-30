/* eslint-disable max-lines */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-negated-condition */
/* eslint-disable max-params */
/* eslint-disable no-undefined */
/* eslint-disable prefer-named-capture-group */
/* eslint-disable require-unicode-regexp */
/* eslint-disable no-confusing-arrow */
/* eslint-disable no-throw-literal */
/* eslint-disable no-magic-numbers */

"use strict";

const _ = require("lodash");
const AWS = require("aws-sdk");
const s3 = new AWS.S3({
    signatureVersion: "v4",
});
const { jsonLogger, csvLib, CompaniesService, SettingsService, constants, idConverterLib } = require("stoke-app-common-api");
const { errorCodes, customFieldTypes, customFieldsHeadersIdentifiers, customFieldIdPrefix, allCsvJobTypes, RESPONSES } = require("./constansts");
const { strLowerCaseTrim } = require("stoke-app-common-api/helpers/utils");
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const bulkOperationsConstants = require('../bulkOperations/constansts')

const emailRegEx = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

const dateRegEx = /^\d{4}[-](0?[1-9]|1[012])[-](0?[1-9]|[12][0-9]|3[01])$/

const validateJobType = (value) => {
    const loweCaseValue = value.toLowerCase().trim()
    if (allCsvJobTypes.includes(loweCaseValue)) {
        return value
    }
    return null
}

const validateEmail = email => !email || emailRegEx.test(email) ? email : null

const validateCurrency = currency => !currency ? currency : constants.supportedCurrencies.includes(currency.toUpperCase()) ? currency.toUpperCase() : null;

const validateDate = date => !date ? date : dateRegEx.test(date) ? date : null

const validateNumber = num => !num ? num : isNaN(num) ? null : num;

const validateCategory = (value) => {
    const loweCaseValue = value.toLowerCase().trim()
    if (bulkOperationsConstants.paymentCategories.includes(loweCaseValue)) {
        return value
    }
    return null
}

const confiremColumn = (value) => {
    switch (value.toLowerCase().trim()) {
        case "true":
        case "yes":
        case "1":
            return RESPONSES.YES;

        default:
            return RESPONSES.NO;
    }
}

const csvRowsValidation = (csvAsObjects, headers, headersValidators, getHeadersRequired, rowsError = [], mandatoryCustomFieldsProps) => {
    const rowsWithoutErrorReturn = [];
    const rowsErrorReturn = rowsError;
    _.forEach(csvAsObjects, (row, index) => {
        const headersRequired = getHeadersRequired(row, mandatoryCustomFieldsProps);
        let requiredHeadersArray = _.keys(headersRequired);
        let isRowError = false;
        _.forEach(_.keys(row), (key) => {
            const value = row[key];
            const validator = _.get(headersValidators, key);
            let valueFormated = value;

            if (validator) {
                valueFormated = validator(value);

                if (valueFormated === null) {
                    isRowError = true;
                    rowsErrorReturn.push(`Value for column ${headers[key]} is not Correct - in line ${index + 2}`);
                }
            }

            const required = _.get(headersRequired, key, _.get(_.toString(headersRequired), key,));

            if (required && (!valueFormated || _.isEmpty(valueFormated)) && valueFormated !== 0) {
                isRowError = true;
                const errorMessageValue = !headers[key] && _.startsWith(key, customFieldIdPrefix) ? `Missing value for required column ${key} - in line ${index + 2}` : `Missing value for required column ${headers[key]} - in line ${index + 2}`
                rowsErrorReturn.push(errorMessageValue);
            }
            requiredHeadersArray = _.without(requiredHeadersArray, key);

        })
        if (_.isEmpty(requiredHeadersArray) && !isRowError) {
            rowsWithoutErrorReturn.push(row);
        } else {
            _.forEach(requiredHeadersArray, (header) => {
                const errorMessageValue = !headers[header] && _.startsWith(header, customFieldIdPrefix) ? `Missing value for required column ${header} - in line ${index + 2}` : `Missing value for required column ${headers[header]} - in line ${index + 2}`
                rowsErrorReturn.push(errorMessageValue);
            })
        }
    })
    return { rowsWithoutErrorReturn, rowsErrorReturn };
}

const readFileAndValidate = (object, existingHeaders, headersValidators, requireHeaders, headers, rowsError = [], mandatoryCustomFieldsProps) => {
    let rowsWithoutError = [];
    let rowsErrorReturn = rowsError;
    try {
        const csvAsObjects = csvLib.csvToObjects(object, existingHeaders);
        const missingHeaders = _.difference(_.keys(requireHeaders(null, mandatoryCustomFieldsProps)), existingHeaders);


        if (_.size(missingHeaders)) {
            let missingHeadersMessage = [`${_.get(errorCodes, 'missingRequiredFields')}: `]
            _.forEach(missingHeaders, (header) => {
                const missingHeader = headers[header] || header
                missingHeadersMessage = missingHeadersMessage.concat(missingHeader)
            })
            const errorMessage = _.join(missingHeadersMessage, '').concat(' - in line 2');
            jsonLogger.info({ function: "utils::readFileAndValidate", errorMessage });
            rowsError.push(errorMessage);
        }
        const rowsResult = csvRowsValidation(csvAsObjects, headers, headersValidators, requireHeaders, rowsError, mandatoryCustomFieldsProps);

        rowsWithoutError = _.union(rowsWithoutError, rowsResult.rowsWithoutErrorReturn);
        rowsErrorReturn = _.union(rowsErrorReturn, rowsResult.rowsErrorReturn);
    } catch (e) {
        jsonLogger.info({ function: "utils::readFileAndValidate", error: e });
        rowsError.push(_.get(errorCodes, e.code, e))
    }
    return { rowsWithoutError, rowsError: rowsErrorReturn };
}

const transformDataForRow = (row) => ({
    ...row,
    email: _.get(row, 'email', '').toLowerCase(),
    providerEmail: _.get(row, 'providerEmail', '').toLowerCase(),
    isHireByStoke: _.get(row, 'isHireByStoke') === RESPONSES.YES,
    ..._.get(row, bulkOperationsConstants.milestonesColumns.jobID) && {
        mandatoryTags: {
            [bulkOperationsConstants.mandatoryJobIDString]: _.get(row, bulkOperationsConstants.milestonesColumns.jobID)
        }
    }
});

const addDataToRows = (rows, userId, companyId) => _.map(rows, (row) => ({ userId, ...transformDataForRow(row), companyId }))

const saveToFile = async (rows, path, headers, additionalColumns = []) => {
    const params = {
        Bucket: process.env.jobsBucketName,
        Key: path,
        Body: csvLib.arraysToCsvString([Object.values(headers), ...additionalColumns], rows.map((row) => [...Object.keys(headers), ...additionalColumns].map((valueKey) => row[valueKey]))),
    };
    await s3.putObject(params).promise();
    return path;
}

const getMapUserEmailToId = async (companyId) => {
    const allUsers = await companiesService.list(process.env.gsiItemsByCompanyIdIndexName, companyId, constants.prefix.userPoolId, {}, " attribute_exists(userId) ");
    return { mapUserEmailToId: _.keyBy(allUsers, (user) => (_.get(user, "itemData.userEmail") || '').toLowerCase()), mapUserIdToEmail: _.keyBy(allUsers, "userId") };
};

const getMapEntityNameToId = async (companyId, role, entitiesAdminByEntityId, entitiesUserByEntityId) => {
    jsonLogger.info({ type: "TRACKING", function: "utils::getMapEntityIdByName", companyId, role });
    const filterExpression = ' itemStatus <> (:inactive) ';
    const expressionAttributeValues = { ':inactive': constants.itemStatus.inactive };
    let entities = await companiesService.list(process.env.gsiItemsByCompanyIdIndexName, companyId, constants.prefix.entity, expressionAttributeValues, filterExpression);
    if (role !== constants.user.role.admin) {
        entities = _.filter(entities, (entity) => {
            const entityId = idConverterLib.removePrefix(_.get(entity, "itemId"), constants.prefix.entity);
            return _.get(entitiesAdminByEntityId, entityId) || _.get(entitiesUserByEntityId, entityId);
        })
    }
    return _.keyBy(entities, entity => _.trim(_.get(entity, 'itemData.entityName')));
}

const getCustomeFileds = async (companyId) => {
    const companySetting = await settingsService.get(`${constants.prefix.company}${companyId}`);
    const defaultSetting = await settingsService.get(`${constants.prefix.company}${constants.defaultCompanySettings.id}`);
    const arrayDefaultProviderPath = _.get(defaultSetting, 'itemData.customFields.companyProvider');
    const arraySettingProviderPath = _.get(companySetting, 'itemData.customFields.companyProvider');
    const customFieldsCompanyProvider = [
        ..._.isEmpty(arrayDefaultProviderPath) ? [] : arrayDefaultProviderPath,
        ..._.isEmpty(arraySettingProviderPath) ? [] : arraySettingProviderPath,

    ]
    const arrayDefaultTalentPath = _.get(defaultSetting, 'itemData.customFields.talent');
    const arraySettingTalentPath = _.get(companySetting, 'itemData.talentCustomFields.fields');
    const customFieldsCompanyTalent = [
        ..._.isEmpty(arrayDefaultTalentPath) ? [] : arrayDefaultTalentPath,
        ..._.isEmpty(arraySettingTalentPath) ? [] : arraySettingTalentPath,

    ]
    const arrayDefaultJobPath = _.get(defaultSetting, 'itemData.customFields.jobsCustomFields');
    const arraySettingJobPath = _.get(companySetting, 'itemData.jobsCustomFields.fields');
    const customFieldsJob = [
        ..._.isEmpty(arrayDefaultJobPath) ? [] : arrayDefaultJobPath,
        ..._.isEmpty(arraySettingJobPath) ? [] : arraySettingJobPath,

    ]

    const mandatoryCustomJobid = _.get(companySetting, 'itemData.mandatoryCustomJobid')

    jsonLogger.info({ function: "utils::getCustomeFileds", companyId, customFieldsCompanyTalent, customFieldsCompanyProvider, customFieldsJob, mandatoryCustomJobid });
    return { customFieldsCompanyTalent, customFieldsCompanyProvider, customFieldsJob, mandatoryCustomJobid };
}


const customFieldComparer = (customFields, fieldToCompare, suffix) => _.find(
    customFields,
    (custom) => strLowerCaseTrim(_.join(_.concat(custom.name, suffix), ' ')) ===
        strLowerCaseTrim(fieldToCompare)
);

const customFieldStringBuilder = (customFieldId, suffix) => customFieldIdPrefix.concat(customFieldId, ' ', suffix);

const isCustomeFiled = (customeFieldHeader, customFieldsCompanyProvider, customFieldsCompanyTalent, customFieldsJob) => {
    if (!_.some(customFieldTypes, type => _.includes(customeFieldHeader, customFieldsHeadersIdentifiers[type]))) {
        return undefined
    }

    const customeFieldHeaderToCompare = _.replace(customeFieldHeader, '(*)', '')

    let customField = customFieldComparer(customFieldsJob, customeFieldHeaderToCompare, customFieldsHeadersIdentifiers.jobs)
    if (customField) {
        return customFieldStringBuilder(_.get(customField, 'id'), customFieldsHeadersIdentifiers.jobs);
    }

    customField = customFieldComparer(customFieldsCompanyProvider, customeFieldHeaderToCompare, customFieldsHeadersIdentifiers.provider)
    if (customField) {
        return customFieldStringBuilder(_.get(customField, 'id'), customFieldsHeadersIdentifiers.provider);
    }

    customField = customFieldComparer(customFieldsCompanyTalent, customeFieldHeaderToCompare, customFieldsHeadersIdentifiers.talent)
    if (customField) {
        return customFieldStringBuilder(_.get(customField, 'id'), customFieldsHeadersIdentifiers.talent);
    }
    return undefined
}

const getMandatoryJobCustomFieldIds = customFieldsJob => {
    const mandatoryJobCustomFields = _.filter(customFieldsJob, customField => _.get(customField, 'isCustomFieldRequired'))
    const mandatoryJobCustomFieldsIds = _.map(mandatoryJobCustomFields, mandatoryField => customFieldIdPrefix.concat(_.get(mandatoryField, 'id'), ' ', customFieldsHeadersIdentifiers.jobs));
    return _.fromPairs(mandatoryJobCustomFieldsIds.map(key => [key, true]));
}

const getAllKeysIncludedCudtomeFields = async (data, headersDefinition, companyId) => {
    const [headers] = csvLib.csvToObjects(data, null, 1, 1);
    const allKeys = [];
    const mapHeadersValues = _.invertBy(headersDefinition, strLowerCaseTrim);
    const allHeadersValues = Object.keys(mapHeadersValues);
    const customFieldHeaders = [];
    const { customFieldsCompanyTalent, customFieldsCompanyProvider, customFieldsJob, mandatoryCustomJobid } = await getCustomeFileds(companyId, customFieldHeaders);
    for (const header of headers) {
        const headerKeyValue = allHeadersValues.find((value) => strLowerCaseTrim(header).startsWith(value))
        const id = isCustomeFiled(header, customFieldsCompanyProvider, customFieldsCompanyTalent, customFieldsJob)
        if (headerKeyValue && !id) {
            allKeys.push(mapHeadersValues[headerKeyValue][0]);
        } else if (id) {
            allKeys.push(id);
        } else {
            allKeys.push(header);
        }

    }

    return { allKeys, customFieldsProvider: { customFieldsCompanyProvider, customFieldsCompanyTalent }, customFieldsJob, mandatoryCustomJobid };
}

const generateBasicTagAppend = (tags, customField, tagToAppend) => ({ ...tags, [_.get(customField, 'id')]: tagToAppend })

// meant for single choosen tag
const generateSingleTagAppend = (tags, customField, tagToAppend) => ({ ...tags, [_.get(customField, 'id')]: [tagToAppend] })

const customFieldsAppending = (tags, customField, tagToAppend) => {
    jsonLogger.info({ function: "utils::customFieldsAppending", tags, customField, tagToAppend });
    let updatedTags = tags
    const tagToAppendTrimmed = _.trim(tagToAppend)

    switch (customField.type) {
        case constants.customFieldTypes.multiselect:
            if (tagToAppend.includes(';')) {
                // eslint-disable-next-line require-unicode-regexp
                const multiTagValue = tagToAppend.replace(/^\s+|\s+$/g, '').split(';')
                updatedTags = {
                    ...updatedTags,
                    [_.get(customField, 'id')]: _.map(multiTagValue, value => _.trim(value)).filter(Boolean)
                }
            } else {
                updatedTags = generateSingleTagAppend(updatedTags, customField, tagToAppendTrimmed)
            }
            break;
        case constants.customFieldTypes.email:
            if (tagToAppend.includes(';')) {
                // eslint-disable-next-line require-unicode-regexp
                const multiTagValue = tagToAppend.replace(/^\s+|\s+$/g, '').split(';')
                updatedTags = {
                    ...updatedTags,
                    [_.get(customField, 'id')]: _.map(multiTagValue, value => _.trim(value)).filter(Boolean)
                }
            } else {
                updatedTags = generateBasicTagAppend(updatedTags, customField, tagToAppendTrimmed)
            }
            break;
        case constants.customFieldTypes.number:
            updatedTags = { ...updatedTags, [_.get(customField, 'id')]: _.toNumber(tagToAppendTrimmed) }
            break;
        case constants.customFieldTypes.checkbox:
            updatedTags = { ...updatedTags, [_.get(customField, 'id')]: tagToAppendTrimmed.toLowerCase() }
            break;
        case constants.customFieldTypes.string:
            updatedTags = { ...updatedTags, [_.get(customField, 'id')]: tagToAppendTrimmed.replace(/\n/gu, " ") }
            break;
        default:
            updatedTags = generateBasicTagAppend(updatedTags, customField, tagToAppendTrimmed)

    }

    return updatedTags
}

module.exports = {
    validateJobType,
    validateEmail,
    validateDate,
    validateCurrency,
    validateNumber,
    validateCategory,
    confiremColumn,
    addDataToRows,
    transformDataForRow,
    saveToFile,
    getMapUserEmailToId,
    getMapEntityNameToId,
    readFileAndValidate,
    getAllKeysIncludedCudtomeFields,
    customFieldsAppending,
    getMandatoryJobCustomFieldIds,
    customFieldStringBuilder,
}

