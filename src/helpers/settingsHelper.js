'use strict';

const {
    settingsTableName,
    gsiItemsByCompanyIdAndItemIdIndexName,
} = process.env;

const _ = require('lodash');
const { constants, SettingsService, jsonLogger, idConverterLib, utils } = require('stoke-app-common-api');

const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const getSettingsByDepartment = async (companyId) => {
    if (!companyId) {
        jsonLogger.info({ type: 'TRACKING', function: 'settingsHelper::getSettingsByDepartment', message: 'missing companyId' });
        return false;
    }
    const entitiesSettings = await settingsService.listEntities(gsiItemsByCompanyIdAndItemIdIndexName, companyId);
    return _.keyBy(entitiesSettings, 'itemId');
}

const DEPARTMENT_LEVEL_SETTINGS = ['autoApproveBudgetRequestThresholds', 'jobRequestApproval', 'allowTalentsToRequestPaymentSettings'] 

const SETTING_TYPE = {
    jobRequest: constants.MULTI_LEVEL_SETTINGS.jobRequestApproval,
    multiLevel: constants.MULTI_LEVEL_SETTINGS.multiLevelApproval,
};
const LEGAL_ENTITY_FIELDS = {
    legalDocs: 'legalDocs',
    contractElements: 'contractElements',
    isAdvancedMode: 'isAdvancedMode'
}
const LEGAL_DOCS_TYPES = {
    s3Path: 's3Path',
    companySignerEmail: 'companySignerEmail',
};
const SETTING_PATH_BY_TYPE = {
    [SETTING_TYPE.jobRequest]: 'itemData.jobRequestApproval',
    [SETTING_TYPE.multiLevel]: 'itemData.multiLevelApproval',
};
const getEffectiveSettingForDepartment = (companySettings, entitySettings, settingType) => {
    const settingPath = SETTING_PATH_BY_TYPE[settingType];
    const isEnabledForCompany = _.get(companySettings, `${settingPath}.enabled`, false);
    const isEnabledForEntity = _.get(entitySettings, `${settingPath}.enabled`, true);
    if (isEnabledForCompany && isEnabledForEntity) {
        const entitySettingOnPath = _.get(entitySettings, settingPath);
        return _.isEmpty(entitySettingOnPath) ? _.get(companySettings, settingPath) : entitySettingOnPath;
    }
    return false;
};

const itemSettingOn = (entityId, userId) => ({
    itemId: constants.prefix.entity.concat(entityId),
    data: {},
    modifiedBy: userId,
    index: gsiItemsByCompanyIdAndItemIdIndexName
})
const itemSettingOff = (entityId, userId) => ({
    itemId: constants.prefix.entity.concat(entityId),
    data: { userId },
    modifiedBy: userId,
    index: gsiItemsByCompanyIdAndItemIdIndexName
})

// eslint-disable-next-line max-params
const setEntitiesSettingsOnOff = async (action, setting, userId, settingsOn, settingsOff) => {
    jsonLogger.info({ type: 'TRACKING', function: 'settingsHelper::setEntitiesSettingsOnOff', setting, settingsOn, settingsOff });
    let result = await Promise.all(_.map(settingsOn, entityIdOn => settingsService.update(itemSettingOn(entityIdOn, userId), action, setting)))

    result = _.concat(result, await Promise.all(_.map(settingsOff, entityIdOff => settingsService.update(itemSettingOff(entityIdOff, userId), action, setting))))

    return result
}

const compareLegalEntityChange = (newSettings, oldSettings) => {
    let isRelevantChange = false

    if (!_.isEqual(newSettings, oldSettings)) {
        const newSettingsLegalDocs = _.get(newSettings, LEGAL_ENTITY_FIELDS.legalDocs)
        const oldSettingsLegalDocs = _.get(oldSettings, LEGAL_ENTITY_FIELDS.legalDocs)

        const newS3Paths = _.omitBy(_.mapValues(newSettingsLegalDocs, (legalEntityObject) => legalEntityObject[LEGAL_DOCS_TYPES.s3Path]), _.isNil);
        const oldS3Paths = _.omitBy(_.mapValues(oldSettingsLegalDocs, (legalEntityObject) => legalEntityObject[LEGAL_DOCS_TYPES.s3Path]), _.isNil);

        const newCompanySignerEmails = _.omitBy(_.mapValues(newSettingsLegalDocs, (legalEntityObject) => legalEntityObject[LEGAL_DOCS_TYPES.companySignerEmail]), _.isNil);
        const oldCompanySignerEmails = _.omitBy(_.mapValues(newSettingsLegalDocs, (legalEntityObject) => legalEntityObject[LEGAL_DOCS_TYPES.companySignerEmail]), _.isNil);

        const newIsAdvancedMode = _.get(newSettings, LEGAL_ENTITY_FIELDS.isAdvancedMode);
        const oldIsAdvancedMode = _.get(oldSettings, LEGAL_ENTITY_FIELDS.isAdvancedMode);

        const newContractElements = _.get(newSettings, LEGAL_ENTITY_FIELDS.contractElements);
        const oldContractElements = _.get(oldSettings, LEGAL_ENTITY_FIELDS.contractElements);

        if (
            !_.isEqual(newS3Paths, oldS3Paths) || 
            !_.isEqual(newCompanySignerEmails, oldCompanySignerEmails) || 
            !_.isEqual(newContractElements, oldContractElements) || 
            !_.isEqual(newIsAdvancedMode, oldIsAdvancedMode)
        ) {
            isRelevantChange = true
        }
    }
    jsonLogger.info({ type: 'TRACKING', function: 'settingsHelper::compareLegalEntityChange', newSettings, oldSettings, isRelevantChange });
    return isRelevantChange
}

const manageWorkspacesInLegalEntity = (
    entity,
    workspacesIds,
    legalEntities,
    entityId,
    companyId,
    userId,
// eslint-disable-next-line max-params
) => {
    jsonLogger.info({ type: "TRACKING", function: "settingsHelper::manageWorkspacesInLegalEntity", entity, workspacesIds, legalEntities });
    const defaultEntity = _.find(legalEntities, item => item.isDefault)
    const entityDepartments = _.map(_.get(entity, 'depatmentIds'), id => idConverterLib.removePrefix(id, constants.prefix.entity))

    const workpacesToAdd = _.filter(
        workspacesIds,
        id => !entityDepartments.includes(id),
    )
    const workspacesToRemove = _.filter(
        entityDepartments,
        department => !workspacesIds.includes(department),
    )

    jsonLogger.info({ type: "TRACKING", function: "settingsHelper::manageWorkspacesInLegalEntity", workpacesToAdd, workspacesToRemove });

    const promises = []

    _.forEach(workpacesToAdd, workspace => {
        promises.push(settingsService.setDepartmentLegalEntity(entityId, constants.prefix.entity + workspace, userId, companyId))
    })

    _.forEach(workspacesToRemove, workspace => {
        promises.push(settingsService.setDepartmentLegalEntity(defaultEntity.id, `${constants.prefix.entity}${workspace}`, userId, companyId))
    })

    return Promise.all(promises)
}

const isSSoRegistration = async (companyId, userEmail) => {
    jsonLogger.info({ type: "TRACKING", function: "settingsHelper::isSSoRegistration", companyId, userEmail });

    let result = false;
    try {
        const userEmailDomain = utils.extractDomainNameFromEmail(userEmail);
        const settings = await settingsService.get(`${constants.prefix.company}${companyId}`);

        const { itemData } = settings || {};
        const companiesExternalDomains = itemData && itemData.allowedExternalDomains; // should be in form of list ['domain.com', 'domain2.com']
        result = companiesExternalDomains && companiesExternalDomains.includes(userEmailDomain)
    } catch (error) {
        jsonLogger.error({ type: "TRACKING", function: "settingsHelper::isSSoRegistration", message: "failed checking users sso registration", error });
    }

    jsonLogger.info({ type: "TRACKING", function: "settingsHelper::isSSoRegistration", result });
    return result;
}

module.exports = {
    getSettingsByDepartment,
    getEffectiveSettingForDepartment,
    setEntitiesSettingsOnOff,
    compareLegalEntityChange,
    manageWorkspacesInLegalEntity,
    SETTING_TYPE,
    DEPARTMENT_LEVEL_SETTINGS,
    isSSoRegistration,
};
