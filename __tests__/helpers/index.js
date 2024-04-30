const { constants } = require('stoke-app-common-api')

const generateCompanyMockData = (moduleName, permissionsComponents) => {
    const companyId = `${moduleName}-COMPANY-ID-1`
    const entityId = `${moduleName}-ENTITY-ID-1`

    const userId1 = `${moduleName}-USER-ID-1`
    const user1 = {
        companyId: companyId,
        entityId: entityId,
        userId: userId1,
        itemStatus: constants.user.status.active,
        itemData: { userRole: constants.user.role.user, permissionsComponents },
    }

    const userId2 = `${moduleName}-USER-ID-2`
    const user2 = {
        companyId: companyId,
        entityId: entityId,
        userId: userId2,
        itemStatus: constants.user.status.active,
        itemData: { userRole: constants.user.role.user, permissionsComponents },
    }

    const userId3 = `${moduleName}-USER-ID-3`
    const user3 = {
        companyId: companyId,
        entityId: entityId,
        userId: userId3,
        itemStatus: constants.user.status.active,
        itemData: { userRole: constants.user.role.admin, permissionsComponents },
    }

    return {
        companyId,
        entityId,
        userId1,
        user1,
        userId2,
        user2,
        userId3,
        user3,
    }
}

module.exports = { generateCompanyMockData }
