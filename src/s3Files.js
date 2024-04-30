/* eslint-disable no-nested-ternary */
/* eslint-disable complexity */
/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-undefined */
/* eslint-disable no-magic-numbers */

"use strict";

const {
  jsonLogger,
  UsersService,
  constants,
  responseLib,
  SettingsService,
  permisionConstants
} = require("stoke-app-common-api");

const AWS = require("aws-sdk");
const s3 = new AWS.S3({
  signatureVersion: "v4",
});
const pathLib = require('path')
const mime = require('mime-types')
const _ = require("lodash");
const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const usersService = new UsersService(
  process.env.consumerAuthTableName,
  constants.projectionExpression.defaultAttributes,
  constants.attributeNames.defaultAttributes
);

const s3Actions = Object.freeze({
  upload: "putObject",
  remove: "deleteObject",
  download: "getObject",
});

const getTagSet = async (bucket = process.env.jobsBucketName, keypath) => {
  jsonLogger.info({ type: "TRACKING", function: "s3Files::getTagSet", bucket, keypath });
  const tags = await s3.getObjectTagging({ Bucket: bucket, Key: keypath }).promise();
  jsonLogger.info({ type: "TRACKING", function: "s3Files::getTagSet", tags });
  
  const tagSet = _.get(tags, 'TagSet', []);
  jsonLogger.info({ type: "TRACKING", function: "s3Files::getTagSet", tagSet });

  return tagSet
}


const shouldCheckForVirus = async (bucket = process.env.jobsBucketName, keypath) => {
  // eslint-disable-next-line no-unreachable
  jsonLogger.info({ type: "TRACKING", function: "s3Files::shouldCheckForVirus", bucket, keypath })
  const { LastModified } = await s3.headObject({ Bucket: bucket, Key: keypath }).promise();
  const lastModified = new Date(LastModified).getTime()
  const virusScanStartPoint = new Date(parseInt(process.env.virusScanStartTime, 10)).getTime()

  jsonLogger.info({ type: "TRACKING", function: "s3Files::shouldCheckForVirus", message: `compare between dates: ${lastModified}, ${virusScanStartPoint}` })
  return lastModified >= virusScanStartPoint
}

const getVirusScanTag = (tagList) => {
  jsonLogger.info({ type: "TRACKING", function: "s3Files::getVirusScanTag", tagList });
  const virusScanTag = _.find(tagList, (tag) => _.get(tag, 'Key') === constants.s3ObjectTagTypes.virusScanResults)
  jsonLogger.info({ type: "TRACKING", function: "s3Files::getVirusScanTag", virusScanTag });

  return virusScanTag
};

const getPrivacyTag = (tagList) => {
  jsonLogger.info({ type: "TRACKING", function: "s3Files::getVirusScanTag", tagList });
  const privacyTag = _.find(tagList, (tag) => _.get(tag, 'Key') === constants.s3ObjectTagTypes.privacy)
  jsonLogger.info({ type: "TRACKING", function: "s3Files::getPrivacyTag", privacyTag });
  
  return privacyTag
};

const extractTagValue = (tagObject) => {
  jsonLogger.info({ type: "TRACKING", function: "s3Files::extractTagValue", tagObject });
  const value = _.get(tagObject, 'Value');
  jsonLogger.info({ type: "TRACKING", function: "s3Files::extractTagValue", value });

  return value
};

// eslint-disable-next-line max-params
module.exports.isCheckFileDownloadAllowed = async (userId, companyId, entityId, entitiesAdmin, currentUserRole, settingType = 'backgroundCheckDocumentViewRestriction') => {
  jsonLogger.info({ type: "TRACKING", function: "s3Files::isCheckFileDownloadAllowed", userId, companyId, entityId, entitiesAdmin, currentUserRole, settingType });
  const companySettings = await settingsService.get(`${constants.prefix.company}${companyId}`);
  const settingPath = `itemData.${settingType}`;
  const setting = _.get(companySettings, `${settingPath}`);
  const type = _.get(setting, 'type');
  
  let isAllowed = false;
  jsonLogger.info({ type: "TRACKING", function: "s3Files::isCheckFileDownloadAllowed", currentUserRole, settingType: type });

  switch (type) {
    case constants.permissionsSegmentTypes.departmentAdmin:
      // eslint-disable-next-line no-case-declarations
      jsonLogger.info({ type: "TRACKING", function: "s3Files::isCheckFileDownloadAllowed" });
      isAllowed = currentUserRole === constants.user.role.admin || _.size(entitiesAdmin) > 0;
      break;
    case constants.permissionsSegmentTypes.companyAdmin:
      isAllowed = currentUserRole === constants.user.role.admin;
      break;
    case constants.permissionsSegmentTypes.namedUser:
      // eslint-disable-next-line no-case-declarations
      const approvedIds = _.get(setting, 'userIds');
      jsonLogger.info({ type: "TRACKING", function: "s3Files::isCheckFileDownloadAllowed", approvedIds });
      isAllowed = approvedIds.includes(userId);
      break;
    default:
      isAllowed = false;
      break;
  }

  jsonLogger.info({ type: "TRACKING", function: "s3Files::isCheckFileDownloadAllowed", isAllowed });
  
  return isAllowed;
};

/**
 * get - get Signed Url
 * @public
 * @param {object} event - event.pathParameters must contain
 * @param {object} context - function request context
 * @returns {string} Signed url
 */
// eslint-disable-next-line max-lines-per-function
module.exports.getSignedUrl = async (event, context) => {
  const userId = event.requestContext.identity.cognitoIdentityId;
  // eslint-disable-next-line no-magic-numbers
  const Expires = isNaN(process.env.S3_SIGNED_URL_EXPIRED)
    ? 5 * 60
    : Number(process.env.S3_SIGNED_URL_EXPIRED);
  const {
    companyId,
    entityId,
    path,
    action,
    userIdPath,
  } = event.queryStringParameters ? event.queryStringParameters : {};
  jsonLogger.info({
    type: "TRACKING",
    function: "s3Files::getSignedUrl",
    functionName: context.functionName,
    awsRequestId: context.awsRequestId,
    event,
    entityId,
    companyId,
    path,
    action,
    userIdPath,
    userId,
  });
  const s3Action = s3Actions[action];
  const scopeInCompany = companyId || entityId;
  let realCompanyId = companyId;
  if (!s3Action || !scopeInCompany || !path) {
    return responseLib.failure({
      message: "missing requierd parameter",
    });
  }
  const scope = userIdPath || userId;
  const needAdmin = userId === scope ? null : constants.user.role.admin;
  const isEditor = s3Action !== s3Actions.download
  // eslint-disable-next-line init-declarations
  let entitiesAdmin, role
  if (companyId) {
    ({ role, entitiesAdmin } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor } }));
    const isEntityUser =
      role === constants.user.role.user && !_.size(entitiesAdmin);
    // eslint-disable-next-line no-extra-parens
    if (role === constants.user.role.unauthorised || (needAdmin && isEntityUser)) {
      return responseLib.forbidden({ status: false });
    }
  } else {
    const authorised = await usersService.validateUserEntityWithComponents(
      userId,
      entityId,
      needAdmin,
      { [permisionConstants.permissionsComponentsKeys.jobs]: { isEditor } }
    );
    realCompanyId = authorised.companyId;
    if (!authorised) {
      return responseLib.forbidden({ status: false });
    }
  }

  const bucketName = process.env.jobsBucketName
  const keyPath = `${realCompanyId}/${scopeInCompany}/${userIdPath ? `${userIdPath}/` : ""}${path}`;
  
  jsonLogger.info({
    type: "TRACKING",
    function: "s3Files::getSignedUrl",
    keyPath,
    bucket: bucketName,
  });

  const params = {
    Bucket: bucketName,
    Key: keyPath,
    Expires,
  };
  
  let isFileLegit = true;
  const virusScanIndication = {
    malicious: false,
    inProgress: false
  }
  if (s3Action === s3Actions.download) {
    const contentType = mime.lookup(keyPath);
    
    if (contentType) {
      params.ResponseContentType = contentType;
      const tagSet = await getTagSet(bucketName, keyPath)
      jsonLogger.info({ type: "TRACKING", function: "s3Files::getSignedUrl", tagSet });
      const privacyTag = getPrivacyTag(tagSet)
      const privacyTagExists = !_.isEmpty(privacyTag)
      
      if (!privacyTagExists && await shouldCheckForVirus(bucketName, keyPath, privacyTag)) {
        jsonLogger.info({ type: "TRACKING", function: "s3Files::getSignedUrl", message: 'checking for view scan results' }); 
        const virusScanTag = getVirusScanTag(tagSet)
        if (_.isEmpty(tagSet) || _.isEmpty(virusScanTag)) {
          jsonLogger.info({ type: "TRACKING", function: "s3Files::getSignedUrl", message: 'waiting for file to be scanned' }); 
          virusScanIndication.inProgress = true
        } else {
          const virusScanResults = extractTagValue(virusScanTag)
          jsonLogger.info({ type: "TRACKING", function: "s3Files::getSignedUrl", virusScanTag, virusScanResults });
      
          // eslint-disable-next-line max-depth
          if (virusScanResults !== constants.antiVirusScanResults.clean) {
            jsonLogger.info({ type: "TRACKING", function: "s3Files::getSignedUrl", message: 'malicious file found, aborting' });
            virusScanIndication.malicious = true;
          }
          jsonLogger.info({ type: "TRACKING", function: "s3Files::getSignedUrl", message: 'skipping validation due to filed older then the start scanning date' }); 
        }
      }


      if (privacyTagExists) {
        const privacyTagValue = extractTagValue(privacyTag)
        // eslint-disable-next-line max-depth
        switch (privacyTagValue) {
          case constants.privacyTagsTypes.backgroundCheck:
            isFileLegit = await module.exports.isCheckFileDownloadAllowed(userId, companyId, entityId, entitiesAdmin, role);
            break;
          case constants.privacyTagsTypes.auditCheck:
            isFileLegit = await module.exports.isCheckFileDownloadAllowed(userId, companyId, entityId, entitiesAdmin, role, 'auditCheckDocumentViewRestriction');
            break;
          default:
            isFileLegit = true;
            break;
        }
      }
    }
  } else if (s3Action === s3Actions.upload) {
    const extension = pathLib.extname(keyPath);
    if (extension && !constants.uploadFileExtensions.includes(extension.toLowerCase().substring(1))) {
      const message = 'FILE_TYPE_NOT_ALLOW';
      jsonLogger.error({ type: "TRACKING", function: "s3Files::getSignedUrl", message, extension });
      return responseLib.failure({ status: false, message });
    }
  }
  
  const virusScanStop = virusScanIndication.malicious || virusScanIndication.inProgress
  const url = isFileLegit && await s3.getSignedUrl(s3Action, params);

  jsonLogger.info({
    type: "TRACKING",
    function: "s3Files::getSignedUrl",
    message: "Succeeded Get Signedurl ",
    url,
  });
  
  return virusScanStop ? responseLib.success({ virusScanIndication }) : url ? responseLib.success(url) : responseLib.forbidden({ status: false });
  
};

