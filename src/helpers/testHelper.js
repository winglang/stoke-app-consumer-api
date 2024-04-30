
'use strict';

/* eslint-disable max-params */

module.exports.job = (entityId, companyId, itemId, itemStatus, userId, itemData) => ({ entityId, companyId, itemId, itemStatus, userId, itemData });

module.exports.user = (userId, entityId, companyId, status, role) => (
    {
        userId: userId,
        entityId: entityId,
        companyId: companyId,
        itemStatus: status,
        itemData: {
            userRole: role,
            isEditor: true
        }
    }
)
