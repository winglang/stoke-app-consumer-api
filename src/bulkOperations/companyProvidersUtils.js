/* eslint-disable max-lines */
/* eslint-disable max-params */
/* eslint-disable no-await-in-loop */
/* eslint-disable max-lines-per-function */

"use strict";

const _ = require("lodash");
const { constants, jsonLogger, TalentsService, idConverterLib, CompanyProvidersService } = require("stoke-app-common-api");
const { PROVIDER_FIELDS, PROVIDER_TALENT_FIELDS, createCompanyProvider, createCompanyProviderTalent } = require("../companyProviders");
const talentsService = new TalentsService(process.env.talentsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const { errorCodes, customFieldIdPrefix, customFieldsHeadersIdentifiers } = require("./constansts");
const { saveToFile, validateEmail, validateNumber, customFieldsAppending } = require("./utils");
const { clearValueKeyword } = require('./constansts')

const concatName = (firstName, lastName) => `${firstName} ${lastName}`

const getProviderName = (row, isProviderSelfEmployedTalent) => {
    if (row.companyName) {
        return row.companyName;
    }
    if (isProviderSelfEmployedTalent) {
        return concatName(row.talentFirstName, row.talentLastName);
    }
    return concatName(row.providerFirstName, row.providerLastName);
}


const createAndGetcompanyProvider = async (row, mapTalentEmailToId, mapProviderEmailToId, allProviderData) => {
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::createAndGetcompanyProvider", row, mapTalentEmailToId, mapProviderEmailToId });
    const { allProvidersByEmail, allTalentsByEmail, allProvidersByItemId, allTalentsByItemId } = allProviderData;
    const rowWithId = { ...row };
    const isProviderSelfEmployedTalent = !row.providerEmail;
    let companyTalent = mapTalentEmailToId[row.email];
    let provider = mapProviderEmailToId[row.providerEmail || row.email];
    let talent = null;
    const itemData = {
        [PROVIDER_FIELDS.providerName]: getProviderName(row, isProviderSelfEmployedTalent),
        [PROVIDER_FIELDS.providerContactFirstName]: row.providerFirstName,
        [PROVIDER_FIELDS.providerContactLastName]: row.providerLastName,
        [PROVIDER_FIELDS.providerEmail]: isProviderSelfEmployedTalent ? row.email : row.providerEmail,
        [PROVIDER_TALENT_FIELDS.firstName]: row.talentFirstName,
        [PROVIDER_TALENT_FIELDS.lastName]: row.talentLastName,
        [PROVIDER_TALENT_FIELDS.email]: row.email,
        [PROVIDER_TALENT_FIELDS.isProviderSelfEmployedTalent]: isProviderSelfEmployedTalent,
        [PROVIDER_TALENT_FIELDS.departments]: [],
    };
    const companyProviderToCreate = [];
    if (!provider) {
        provider = _.get(allProvidersByEmail, _.get(row, 'providerEmail'));
        if (!provider) {
            jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::createAndGetcompanyProvider", message: 'Create new provider', email: row.providerEmail });
            const inviteStatus = row.sendInvite === 'No' ? constants.companyProvider.status.notInvited : constants.companyProvider.status.invited
            provider = await createCompanyProvider(row.companyId, itemData, inviteStatus, row.userId);
            companyProviderToCreate.push(provider);
        }
    }

    if (!companyTalent || isProviderSelfEmployedTalent) {
        if (_.get(row, 'isHireByStoke')) {
            itemData[PROVIDER_TALENT_FIELDS.isHireByStoke] = row.isHireByStoke;
        }
        companyTalent = _.get(allTalentsByEmail, _.get(row, 'email'));
        if (!companyTalent) {
            jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::createAndGetcompanyProvider", message: 'Create new talent', email: row.email });
            const talentStatus = provider.itemStatus || constants.companyProvider.status.invited;
            itemData.img = _.get(provider, 'itemData.img');
            ({ companyTalent, talent } = await createCompanyProviderTalent(row.companyId, provider.itemId, itemData, talentStatus, row.userId));
            companyProviderToCreate.push(companyTalent);
            const talentsResult = await talentsService.create(talent);
            jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::createAndGetcompanyProvider", talentsResult });
        }
    }

    const result = await companyProvidersService.batchCreate(companyProviderToCreate);
    for (const id of result) {
        const createdItem = await companyProvidersService.get(row.companyId, id);
        if (_.get(createdItem, 'itemId', '').startsWith(constants.prefix.provider)) {
            allProvidersByItemId[id] = createdItem;
            allProvidersByEmail[_.get(createdItem, 'itemData.providerEmail', '')] = createdItem;
        } else {
            allTalentsByItemId[id] = createdItem;
            allTalentsByEmail[_.get(createdItem, 'itemData.email', '')] = createdItem;
        }
    }
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::createAndGetcompanyProvider", result, companyProviderToCreate });
    rowWithId.providerId = provider.itemId;
    rowWithId.talentId = companyTalent.itemId;
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::createAndGetcompanyProvider", providerId: rowWithId.providerId, talentId: rowWithId.talentId });
    return rowWithId
}

const updateProviderTags = async (customFieldsCompanyProvider, provider, row, key, isTalent) => {
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::updateProviderTags", provider, customFieldsCompanyProvider, isTalent, key, row, message: 'try to update tags of provider' });
    let tags = _.get(provider, 'tags', {})
    let clearValue = false
    for (const customField of customFieldsCompanyProvider) {
        const getText = customFieldIdPrefix.concat(customField.id, ' ', isTalent ? customFieldsHeadersIdentifiers.talent : customFieldsHeadersIdentifiers.provider)
        const tagUpdate = _.get(row, getText)
        const isAllowChangeTag = _.get(key, 'id') !== customField.id || !_.get(provider, `tags.${customField.id}`)
        jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::updateProviderTags", message: `handling type: ${customField.type}`, isAllowChangeTag, tagUpdate });
        if (isAllowChangeTag && tagUpdate) {
            clearValue = tagUpdate === clearValueKeyword
            if (clearValue) {
                tags = _.omit(tags, _.get(customField, 'id'))
            } else {
                tags = customFieldsAppending(tags, customField, tagUpdate)
            }
            
        }
    }

    if (clearValue || (_.size(tags) && !_.isEqual(tags, _.get(provider, 'tags', {})))) {
        const result = await companyProvidersService.update({ companyId: provider.companyId, itemId: provider.itemId, tags, modifiedBy: constants.admin.userId })
        if (result) {
            jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::updateProviderTags", provider, tags, message: 'update tags of providers' });
        } else {
            jsonLogger.error({ type: "TRACKING", function: "companyProvidersUtils::updateProviderTags", provider, tags, message: 'error update tags of provider' });
        }
    }
}

const getCompanyProviders = async (companyId, customFieldsProvider = {}) => {
    const { customFieldsCompanyProvider, customFieldsCompanyTalent } = customFieldsProvider;
    const allCompanyProviders = await companyProvidersService.companyProvidersPagination('listCompany', [
        companyId,
        null,
        null,
        null
    ]);
    const [
        allProviders,
        allTalents
    ] = _.partition(allCompanyProviders, (provider) => provider.itemId.startsWith(constants.prefix.provider));
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::getCompanyProviders", allProviders, allTalents });

    const providerKey = _.find(customFieldsCompanyProvider, 'uniqKey');
    const allProvidersByItemId = _.keyBy(allProviders, `itemId`);
    const allProvidersByEmail = _.keyBy(_.filter(allProviders, `itemData.${PROVIDER_FIELDS.providerEmail}`), (provider) => (_.get(provider, `itemData.${PROVIDER_FIELDS.providerEmail}`) || '').toLowerCase());
    let allProvidersByKey = {};
    if (providerKey) {
        allProvidersByKey = _.keyBy(allProviders, `tags.${providerKey.id}`);
    }
    const allTalentsByEmail = _.keyBy(_.filter(allTalents, `itemData.${PROVIDER_TALENT_FIELDS.email}`), (talent) => (_.get(talent, `itemData.${PROVIDER_TALENT_FIELDS.email}`) || '').toLowerCase());
    const allTalentsByItemId = _.keyBy(allTalents, `itemId`);
    const talentKey = _.find(customFieldsCompanyTalent, 'uniqKey');
    let allTalentsByKey = {};
    if (talentKey) {
        allTalentsByKey = _.keyBy(allTalents, `tags.${talentKey.id}`);
    }
    return { allProvidersByKey, allProvidersByEmail, allProvidersByItemId, providerKey, allTalentsByEmail, allTalentsByItemId, allTalentsByKey, talentKey };
}

const updateProvidersTags = async (customFieldsProvider, allProviderData, rows) => {
    const { customFieldsCompanyProvider, customFieldsCompanyTalent } = customFieldsProvider;
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::updateProvidersTags", customFieldsProvider });
    const { allProvidersByItemId, allTalentsByItemId, talentKey, providerKey } = allProviderData;
    if (_.size(customFieldsCompanyProvider)) {
        const rowsByProvider = _.groupBy(rows, 'providerId');
        for (const providerId of Object.keys(rowsByProvider)) {
            const [providerRow] = rowsByProvider[providerId];
            const provider = allProvidersByItemId[providerRow.providerId]
            if (provider) {
                await updateProviderTags(customFieldsCompanyProvider, provider, providerRow, providerKey);
            }
        }
    }

    if (_.size(customFieldsCompanyTalent)) {
        const rowsByTalent = _.groupBy(rows, 'talentId');
        for (const talentId of Object.keys(rowsByTalent)) {
            const [rowTalent] = rowsByTalent[talentId];
            const talent = allTalentsByItemId[rowTalent.talentId];
            if (talent) {
                await updateProviderTags(customFieldsCompanyTalent, talent, rowTalent, talentKey, true);
            }
        }

    }
}


const createAndGetCompanyProviders = async (rows, allProviderData, customFieldsProvider = {}) => {
    const mapTalentEmailToId = {};
    const mapProviderEmailToId = {};
    const rowsWithTalentId = [];
    const rowsWithTalentIsNotPayable = [];
    for (const row of rows) {
        const rowWithTalentId = await createAndGetcompanyProvider(row, mapTalentEmailToId, mapProviderEmailToId, allProviderData);
        mapTalentEmailToId[row.email] = { itemId: rowWithTalentId.talentId };
        mapProviderEmailToId[row.providerEmail || row.email] = { itemId: rowWithTalentId.providerId };
        const { allProvidersByItemId } = allProviderData;
        const provider = _.get(allProvidersByItemId, rowWithTalentId.providerId);
        rowWithTalentId.talentData = _.get(provider, 'itemData.talentData', {});
        if (_.get(provider, 'itemData.isPayable')) {
            jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::createAndGetCompanyProviders", message: 'provider is payable', provider });
            rowsWithTalentId.push(rowWithTalentId);
        } else {
            jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::createAndGetCompanyProviders", message: 'provider is not payable', provider });
            rowsWithTalentIsNotPayable.push(rowWithTalentId);
        }
    }
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::createAndGetCompanyProviders", rowsWithTalentId, rowsWithTalentIsNotPayable });
    await updateProvidersTags(customFieldsProvider, allProviderData, [
        ...rowsWithTalentId,
        ...rowsWithTalentIsNotPayable
    ]);
    return { rowsWithTalentId, rowsWithTalentIsNotPayable };
};

const isRowIdNotValid = (allProvidersByEmail, allProvidersByKey, row, key) => {
    if (!_.size(allProvidersByKey)) {
        return row;
    }
    const rowId = _.get(row, key.id);
    const rowNotValid = { ...row };
    if (!rowId) {
        return rowNotValid;
    }

    const rowEmail = _.get(row, 'providerEmail');
    const providerKey = _.get(allProvidersByEmail, [
        rowEmail,
        'tags',
        key.id
    ]) || rowId;
    const providerEmail = _.get(allProvidersByKey, `${rowId}.itemData.providerEmail`) || rowEmail;
    const isValid = (rowEmail || '').toLowerCase() === (providerEmail || '').toLowerCase() && String(rowId) === String(providerKey);
    if (!isValid) {
        rowNotValid.errors = [
            ...rowNotValid.errors || [],
            errorCodes.keyExist
        ]
        jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::isRowIdNotValid", message: 'row is not valid', rowNotValid, rowEmail, providerEmail, rowId, providerKey });
    }
    return rowNotValid;
}

const talentsAndProviderByEmail = (row, allTalentsByEmail, allProvidersByEmail) => {
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::talentsAndProviderByEmail", row, allTalentsByEmail, allProvidersByEmail });
    const rowEmail = _.get(row, 'email', '').toLowerCase();
    const rowProviderEmail = _.get(row, 'providerEmail', '').toLowerCase();
    const talent = _.get(allTalentsByEmail, `${rowEmail}`);
    const provider = _.get(allProvidersByEmail, `${rowProviderEmail}`);
    
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::talentsAndProviderByEmail", talent, provider, rowEmail });
    return { talent, provider, rowEmail };
}

const isRowEmailNotValid = (allTalentsByEmail, allProvidersByItemId, row) => {
    const rowEmail = _.get(row, 'email');
    const rowProviderEmail = _.get(row, 'providerEmail');
    const talent = _.get(allTalentsByEmail, `${rowEmail}`, {});
    const providerEmail = _.get(allProvidersByItemId, `${idConverterLib.getProviderIdFromTalentId(_.get(talent, 'itemId'), '')}.itemData.providerEmail`) || rowProviderEmail;
    const isValid = (providerEmail || '').toLowerCase() === (rowProviderEmail || '').toLowerCase();
    const rowNotValid = { ...row };
    if (!isValid) {
        rowNotValid.errors = [
            ...rowNotValid.errors || [],
            errorCodes.talentExistInOther
        ]
        jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::isRowEmailNotValid", message: 'row is not valid', rowNotValid, providerEmail, rowProviderEmail, rowEmail });
    }
    return rowNotValid;
}

const isRowEmailExist = (allTalentsByEmail, allProvidersByEmail, row) => {
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::isRowEmailExist", allTalentsByEmail, allProvidersByEmail, row });
    const { talent, provider, rowEmail } = talentsAndProviderByEmail(row, allTalentsByEmail, allProvidersByEmail);

    if (talent) {
        return true
    }
    if (provider && !rowEmail) {
        return true
    }

    return false;
}

const isRowCustomFieldsNotValid = (row, customFieldsProvider) => {
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::isRowCustomFieldsNotValid", row, customFieldsProvider })
    const { customFieldsCompanyTalent, customFieldsCompanyProvider } = customFieldsProvider
    let isValid = true
    let errorCode = null
    const relevantCustomFields = row.providerEmail ? customFieldsCompanyTalent : customFieldsCompanyProvider
    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::isRowCustomFieldsNotValid", relevantCustomFields })

    for (const customField of relevantCustomFields) {
        const value = row[customField.id]
        jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::isRowCustomFieldsNotValid", message: 'validating custom fields', value, customField })
        if (!_.isEmpty(value)) {
            switch (customField.type) {
                case constants.customFieldTypes.email:
                    for (const email of value.split(';')) {
                        // eslint-disable-next-line max-depth
                        if (!validateEmail(email)) {
                            isValid = false
                            errorCode = errorCodes.emailCustomField
                            break;
                        }
                    }

                    break;
                case constants.customFieldTypes.number:
                    if (!validateNumber(value)) {
                        isValid = false
                        errorCode = errorCodes.numberCustomField
                        break;
                    }
                    break;
                case constants.customFieldTypes.checkbox:
                    if (!['TRUE', 'true', 'FALSE', 'false'].includes(value)) {
                        isValid = false
                        errorCode = errorCodes.checkboxCustomField
                        break;
                    }
                    break;
                default:
                    jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::isRowCustomFieldsNotValid", message: 'skipping validation', value, customField })
            }
        }
    }

    const rowNotValid = { ...row };
    if (!isValid) {
        rowNotValid.errors = [
            ...rowNotValid.errors || [],
            errorCode
        ]
        jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::isRowCustomFieldsNotValid", message: 'row is not valid', rowNotValid });
    }

    return rowNotValid;
}


const rowsProvidersValidation = async (rows, companyId, allProviderData, errorPath, headers, checkExisting, customFieldsProvider) => {
    jsonLogger.info({ type: "TRACKING", function: "bulkOperationsHelper::rowsProvidersValidation", companyId, customFieldsProvider, allProviderData });
    const { allProvidersByKey, allProvidersByEmail, allProvidersByItemId, providerKey, allTalentsByEmail, allTalentsByKey, talentKey } = allProviderData;
    const rowsError = [];
    const rowsWithoutError = [];
    _.forEach(rows, (row) => {
        let rowNotValid = isRowIdNotValid(allProvidersByEmail, allProvidersByKey, row, providerKey);
        rowNotValid = isRowIdNotValid(allTalentsByEmail, allTalentsByKey, rowNotValid, talentKey);
        if (customFieldsProvider) {
            rowNotValid = isRowCustomFieldsNotValid(row, customFieldsProvider);
        }

        rowNotValid = isRowEmailNotValid(allTalentsByEmail, allProvidersByItemId, rowNotValid);
        
        jsonLogger.info({ type: "TRACKING", function: "bulkOperationsHelper::rowsProvidersValidation" });
        if (checkExisting) {
            row.isNew = !isRowEmailExist(allTalentsByEmail, allProvidersByEmail, rowNotValid)
        }
        if (_.size(rowNotValid.errors)) {
            rowsError.push(rowNotValid);
        } else {
            rowsWithoutError.push(row);
        }
    });
    if (rowsError.length) {
        jsonLogger.info({ type: "TRACKING", function: "companyProvidersUtils::rowsProvidersValidation", rowsError });
        try {
            await saveToFile(rowsError, errorPath, headers, ['errors']);
        } catch (e) {
            jsonLogger.error({ type: 'TRACKING', function: 'companyProvidersUtils::createJobFullFlow', text: `exception - ${e.message}`, e });
        }
    }
    return { rowsError, rowsWithoutError };
}


module.exports = {
    createAndGetCompanyProviders,
    getCompanyProviders,
    rowsProvidersValidation,
    updateProvidersTags,
}
