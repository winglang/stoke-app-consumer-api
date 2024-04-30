/* eslint-disable camelcase */
/* eslint-disable prefer-named-capture-group */
/* eslint-disable require-unicode-regexp */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */

"use strict";

const _ = require("lodash");
const { consumerAuthTableName, jobsBucketName } = process.env;
const { jsonLogger, constants, UsersService, responseLib, SettingsService } = require("stoke-app-common-api");
const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const AWS = require("aws-sdk");
const s3 = new AWS.S3({ signatureVersion: "v4" });
const { commandOptions, milestonesColumns, milestonesHeaders, talentsHeaders, talentsColumns } = require("./constansts");
const {
    validateJobType,
    validateEmail,
    validateDate,
    saveToFile,
    getMapUserEmailToId,
    getMapEntityNameToId,
    readFileAndValidate,
    getAllKeysIncludedCudtomeFields,
    validateCurrency,
    validateNumber,
    validateCategory,
    getMandatoryJobCustomFieldIds,
    confiremColumn
} = require("./utils");
const {
    isOfferJobRow,
    addData,
    rowsValidations,
    jobsFromRowsValidation,
    createMilestonesPerJob,
    updateMilestonesToPendingStatus,
    addJobData,
    updateMilestonesStatus,
    transferBudget,
    getActiveJobs,
    isMilestonesStatusBudgetRequest,
    getJobsTags,
    updateJobTags,
    getMilestonesBulk,
} = require("./jobsUtils");
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const { updateProvidersTags, getCompanyProviders, createAndGetCompanyProviders } = require("./companyProvidersUtils");

const milestoneHeadersValidator = {
    [milestonesColumns.jobType]: validateJobType,
    [milestonesColumns.email]: validateEmail,
    [milestonesColumns.userEmail]: validateEmail,
    [milestonesColumns.jobStartDate]: validateDate,
    [milestonesColumns.milestoneDate]: validateDate,
    [milestonesColumns.currency]: validateCurrency,
    [milestonesColumns.milestonePlannedAmount]: validateNumber,
    [milestonesColumns.milestoneRequestedAmount]: validateNumber,
    [milestonesColumns.hourlyRate]: validateNumber,
    [milestonesColumns.customRateCategory]: validateCategory,
    [milestonesColumns.customRateQuantity]: validateNumber,
    [milestonesColumns.customRateRate]: validateNumber,
    [talentsColumns.isHireByStoke]: confiremColumn,
}

const milestoneHeadersRequired = (row, mandatoryCustomFieldsProps) => {
    jsonLogger.info({ function: "createMilestonesFromCsv::milestoneHeadersRequired", row, mandatoryCustomFieldsProps });
    const headers = {
        [milestonesColumns.jobType]: true,
        [milestonesColumns.entityName]: true,
        [milestonesColumns.jobTitle]: true,
    };
    const isOfferJobMode = row && isOfferJobRow(row);
    const isUpdateMilestonesMode = row && row[milestonesColumns.milestoneId];
    jsonLogger.info({ function: "createMilestonesFromCsv::milestoneHeadersRequired", isOfferJobMode, isUpdateMilestonesMode });

    if (isUpdateMilestonesMode) {
        headers[milestonesColumns.milestoneId] = true;
        headers[milestonesColumns.milestoneRequestedAmount] = true;
    } else {
        headers[milestonesColumns.email] = true;
        if (Boolean(row) && !isOfferJobMode) {
            headers[milestonesColumns.milestoneTitle] = Boolean(row) && !isOfferJobMode;
        }
        _.assign(headers, _.get(mandatoryCustomFieldsProps, 'mandatoryJobCustomFieldIds'));
        if (_.get(mandatoryCustomFieldsProps, 'isMandatoryCustomJobid')) {
            headers[milestonesColumns.jobID] = true;
        }

    }

    jsonLogger.info({ function: "createMilestonesFromCsv::milestoneHeadersRequired", finalHeaders: headers });
    return headers;
};

module.exports.handler = async (event, context) => {
    jsonLogger.info({ function: "createMilestonesFromCsv::handler", functionName: context.functionName, awsRequestId: context.awsRequestId, event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body);
    const { companyId, key, command } = data;
    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRole(userId, companyId, true);
    if (role === constants.user.role.unauthorised) {
        return responseLib.forbidden({ status: false });
    }

    if (!companyId || !key || !command) {
        const message = 'Missing parameters in body';
        jsonLogger.error({ function: "createMilestonesFromCsv::handler", message, companyId, key, command });
        return responseLib.failure({ message });
    }

    const basePath = decodeURIComponent(key.replace(/\+/gu, " "))
    const path = `${companyId}/${companyId}/${basePath}`;
    jsonLogger.info({ function: "createMilestonesFromCsv::handler", path });
    const errorPath = `${basePath.substring(0, basePath.lastIndexOf('/'))}/errors/${basePath.substring(basePath.lastIndexOf('/'))}`;

    let s3Object = null

    try {
        s3Object = await s3.getObject({ Bucket: jobsBucketName, Key: path }).promise();
    } catch (e) {
        jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'Error to get file' });
        return responseLib.failure({ message: e.message });
    }

    const fileData = s3Object.Body.toString("utf-8");
    const { allKeys, customFieldsProvider, customFieldsJob, mandatoryCustomJobid } = await getAllKeysIncludedCudtomeFields(fileData, { ...milestonesHeaders, ...talentsHeaders }, companyId);
    const mandatoryJobCustomFieldIds = getMandatoryJobCustomFieldIds(customFieldsJob);
    const csvRowsError = [];
    const resultValidation = readFileAndValidate(fileData, allKeys, milestoneHeadersValidator, milestoneHeadersRequired, milestonesHeaders, csvRowsError, { isMandatoryCustomJobidEnabled: _.get(mandatoryCustomJobid, 'enabled'), mandatoryJobCustomFieldIds });
    let { rowsError, rowsWithoutError } = resultValidation;
    if (command === commandOptions.validation) {
        jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'Done validation', resultValidation });
        return responseLib.send(resultValidation);
    }

    const allProviderData = await getCompanyProviders(companyId, customFieldsProvider);
    const { allTalentsByEmail, allProvidersByItemId } = allProviderData;

    const { mapUserEmailToId, mapUserIdToEmail } = await getMapUserEmailToId(companyId);
    const entitiesAdminByEntityId = _.keyBy(entitiesAdmin, 'entityId');
    const entitiesUserByEntityId = _.keyBy(entitiesUser, 'entityId');
    const mapEntityNameToId = await getMapEntityNameToId(companyId, role, entitiesAdminByEntityId, entitiesUserByEntityId);
    rowsWithoutError = addData(rowsWithoutError, userId, companyId, mapUserEmailToId, mapUserIdToEmail, mapEntityNameToId, allTalentsByEmail);
    const mapJobToJobId = await getActiveJobs(companyId, rowsWithoutError);

    rowsWithoutError = addJobData(rowsWithoutError, mapJobToJobId, customFieldsJob);

    const companySetting = await settingsService.get(`${constants.prefix.company}${companyId}`);
    const budgetModuleActive = _.get(companySetting, 'itemData.budgetModuleActive')
    const isSupportPONumbers = _.get(companySetting, 'itemData.isSupportPONumbers')
    const isJobHandShakeRequired = _.get(companySetting, 'itemData.isJobHandShakeRequired', true)
    const isStokeUmbrella = _.get(companySetting, 'itemData.stokeUmbrella');

    if (budgetModuleActive !== false) {
        const missingBudgetData = await isMilestonesStatusBudgetRequest(companyId, rowsWithoutError, allTalentsByEmail)
        if (missingBudgetData.missingQuartersCount > 0 && missingBudgetData.missingWorkspacesCount > 0) {
            jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'budget Module is Active and company Missing budget', companyId });
            return responseLib.send({ generalError: { type: 'budget', data: missingBudgetData } });
        }
    }

    const curretUserData = { role: entitiesAdmin.length ? constants.user.role.admin : constants.user.role.user, id: userId };
    const milestonesToFetch = _.filter(rowsWithoutError, (ms) => !_.isEmpty(ms.milestoneId))
    jsonLogger.info({ type: "TRACKING", function: "createMilestonesFromCsv::handler", milestonesToFetch });
    const allMilestonesFetched = await getMilestonesBulk(milestonesToFetch);
    ({ rowsError, rowsWithoutError } = rowsValidations(rowsWithoutError, curretUserData, allProvidersByItemId, allTalentsByEmail, companySetting, _.keyBy(allMilestonesFetched, 'itemId')));
    const resultCustomFieldValidation = jobsFromRowsValidation(rowsError, rowsWithoutError)
    rowsError = _.get(resultCustomFieldValidation, 'rowsError')
    rowsWithoutError = _.get(resultCustomFieldValidation, 'rowsWithoutErrorReturn')

    if (command === commandOptions.dataValidation) {
        jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'Done data validation', rowsError, rowsWithoutError });
        if (rowsError.length) {
            jsonLogger.info({ type: "TRACKING", function: "createMilestonesFromCsv::handler", rowsError });
            try {
                await saveToFile(rowsError, `${companyId}/${companyId}/${errorPath}`, milestonesHeaders, ['errors']);
            } catch (e) {
                jsonLogger.error({ type: 'TRACKING', function: 'createMilestonesFromCsv::handler', text: `exception - ${e.message}`, e });
            }
        }
        return responseLib.send({
            rowsError,
            rowsWithoutError,
            errorPath,
        });
    }

    await transferBudget(rowsWithoutError, companyId, budgetModuleActive, isSupportPONumbers);

    jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'Try to create new talents' });
    const [rowsToCreateTalent, rowsWithExistingTalentId] = _.partition(rowsWithoutError, (row) => !row.talentId && _.get(row, talentsColumns.email) && _.get(row, talentsColumns.talentFirstName) && _.get(row, talentsColumns.talentLastName));
    const { rowsWithTalentId, rowsWithTalentIsNotPayable } = await createAndGetCompanyProviders(rowsToCreateTalent, allProviderData, customFieldsProvider);
    rowsWithoutError = [...rowsWithExistingTalentId, ...rowsWithTalentId, ...rowsWithTalentIsNotPayable]
    jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'done to create new talents' });

    //  we call jobsFromRowsValidation function again because we want to get updated mapJobKeyToTags object after we created new talents and so jobKey was updated
    const mapJobKeyToTags = _.get(jobsFromRowsValidation(rowsError, rowsWithoutError), 'mapJobKeyToTags')

    const milestonesToCreate = _.filter(rowsWithoutError, (ms) => _.isEmpty(ms.milestoneId))
    jsonLogger.info({ type: "TRACKING", function: "createMilestonesFromCsv::handler", milestonesToCreate });
    const { allMilestones: allMilestonesCreated, jobIdToJobRow } = await createMilestonesPerJob(companyId, milestonesToCreate, allTalentsByEmail, mapJobToJobId, isJobHandShakeRequired)
    const allMilestonesCreatedOrFetched = _.concat(allMilestonesCreated, allMilestonesFetched)
    jsonLogger.info({ function: "createMilestonesFromCsv::handler", allMilestonesCreatedOrFetched });

    if (_.isEmpty(allMilestonesCreatedOrFetched)) {
        jsonLogger.error({ function: "createMilestonesFromCsv::handler", message: 'error to create rows with status active' });
        responseLib.failure({ status: false })
    }

    const jobsTags = getJobsTags(jobIdToJobRow, mapJobKeyToTags)
    jsonLogger.info({ function: "createMilestonesFromCsv::handler", jobsTags });
    const milestonesItems = _.filter(_.flatten(allMilestonesCreatedOrFetched), milestone => _.startsWith(milestone.itemId, constants.prefix.milestone))
    const milestonesWithActiveOrBudgetRequest = await updateMilestonesStatus(milestonesItems, constants.job.status.active, userId);
    jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'Done create rows with status active' });

    jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'Try to update status to pending approval', milestonesWithActiveOrBudgetRequest });
    const result = await updateMilestonesToPendingStatus(milestonesWithActiveOrBudgetRequest, userId, isStokeUmbrella)
    if (!result) {
        jsonLogger.error({ function: "createMilestonesFromCsv::handler", message: 'error to create rows to pending approval' });
        return responseLib.failure({ status: false });
    }
    jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'Done create rows to pending approval' });

    jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'Try to update provider custom field' });
    await updateProvidersTags(customFieldsProvider, allProviderData, rowsWithoutError);
    jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'Done update provider custom field' });

    jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'Try to update job custom field' });
    await updateJobTags(jobIdToJobRow, jobsTags);
    jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'Done update job custom field' });


    jsonLogger.info({ function: "createMilestonesFromCsv::handler", message: 'Done execute' });
    return responseLib.success({ status: true });
};
