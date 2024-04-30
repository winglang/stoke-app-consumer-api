/* eslint-disable camelcase */
/* eslint-disable max-lines-per-function */
'use strict';
const _ = require('lodash');
const mod = require('../src/providerLegalDocs/providerAddLegalDocs');
const jestPlugin = require('serverless-jest-plugin');
const providerAddLegalDocument = jestPlugin.lambdaWrapper.wrap(mod, { handler: 'handler' });

const { constants, UsersService, CompanyProvidersService } = require('stoke-app-common-api');
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const companyId = 'JEST-PROVIDER-ADD-LEGAL-DOCS-COMP-ID-1';
const userId = "JEST-PROVIDER-ADD-LEGAL-DOCS-USER-1";
const provider1ItemId = "provider_JEST-PROVIDER-ADD-LEGAL-DOCS-PROVIDER-ID-1";
const provider2ItemId = "provider_JEST-PROVIDER-ADD-LEGAL-DOCS-PROVIDER-ID-2";
const provider3ItemId = "provider_JEST-PROVIDER-ADD-LEGAL-DOCS-PROVIDER-ID-3";

const expirationDateIn20Days = new Date(Date.now() + (20 * 24 * 60 * 60 * 1000)).getTime()
const expirationDateIn40Days = new Date(Date.now() + (40 * 24 * 60 * 60 * 1000)).getTime()
// const expirationDateYesterday = new Date(Date.now() - (1 * 24 * 60 * 60 * 1000)).getTime()
const expirationDateYesterday = new Date(Date.now() - (60 * 24 * 60 * 60 * 1000)).getTime() 

const provider1 = {
    itemId: provider1ItemId,
    companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemData: {
        firstName: "Name",
        lastName: "LastName",
        isProviderSelfEmployedTalent: true,
        legalDocuments: [
            {
                name: "DOC1",
                legalEntityName: "Sportority Inc",
                status: "sent",
                signature_request_id: "d2f00cb5-46d2-4160-9c4b-b26dde1e7263"
            },
        ]
    },
    tags: {
        originalValue: ["123"],
    },
};

const provider2 = {
    itemId: provider2ItemId,
    companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemData: {
        firstName: "Name",
        lastName: "LastName",
        isProviderSelfEmployedTalent: true,
        legalDocuments: [
            {
                name: "DOC1",
                legalEntityName: "Sportority Inc",
                status: "sent",
                signature_request_id: "d2f00cb5-46d2-4160-9c4b-b26dde1e7263"
            },
        ]
    },
    tags: {
        originalValue: ["123"],
    },
};

const provider3 = {
    itemId: provider3ItemId,
    companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemData: {
        firstName: "Name",
        lastName: "LastName",
        isProviderSelfEmployedTalent: true,
        legalDocuments: [
            {
                name: "Document 4",
                legalEntityName: "MUSIC",
                status: "signed",
                isExpired: true,
                signature_request_id: "d2f00cb5-46d2-4160-9c4b-b26dde1e7111"
            },
        ]
    }
};

const user = {
    userId,
    entityId: `${companyId}-ENT-1`,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: { userRole: constants.user.role.admin, isEditor: true },
};

const userNotAllowedEvent = {
    body: JSON.stringify({
        legalDocuments: ['documents'],
        companyId: companyId,
    }),
    requestContext: {
        identity: {
            cognitoIdentityId: 'not-existing-user'
        }
    },
    pathParameters: {
        id: provider1ItemId
    }
}

const newDocumentEvent = {
    body: JSON.stringify({
        legalDocuments: [{
            expirationDate: expirationDateIn40Days,
            legalEntityName: "MUSIC",
            name: "Document 4",
            status: 'sent',
        }],
        companyId: companyId,
    }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    pathParameters: {
        id: provider1ItemId
    }
}

const newDocumentsEvent = {
    body: JSON.stringify({
        legalDocuments: [{
            expirationDate: expirationDateIn40Days,
            legalEntityName: "MUSIC",
            name: "Document 4",
            status: 'sent',
        }, {
            expirationDate: expirationDateIn20Days,
            legalEntityName: "MOVIES",
            name: "Document 5",
            status: 'sent',
        }],
        companyId: companyId,
        ids: [provider1ItemId, provider2ItemId]
    }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
}

const newDocumentsEvent2 = {
    body: JSON.stringify({
        legalDocuments: [{
            expirationDate: expirationDateIn40Days,
            legalEntityName: "MUSIC",
            name: "Document 4",
            status: 'sent',
        }, {
            expirationDate: expirationDateIn40Days,
            legalEntityName: "MOVIES",
            name: "Document 5",
            status: 'sent',
        }],
        companyId: companyId,
        ids: [provider1ItemId, provider2ItemId]
    }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
}

const newDocumentsEvent3 = {
    body: JSON.stringify({
        legalDocuments: [{
            legalEntityName: "MUSIC",
            name: "Document 4",
            expirationDate: expirationDateYesterday,
        }],
        companyId,
    }),
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    pathParameters: {
        id: provider3ItemId
    }
}

const expectedResult1 = [
    {
        name: "DOC1",
        legalEntityName: "Sportority Inc",
        status: "sent",
        signature_request_id: "d2f00cb5-46d2-4160-9c4b-b26dde1e7263"
    },
    {
        expirationDate: expirationDateIn40Days,
        legalEntityName: "MUSIC",
        name: "Document 4",
        status: 'sent',
    }
]

const expectedResult2 = [
    {
        name: "DOC1",
        legalEntityName: "Sportority Inc",
        status: "sent",
        signature_request_id: "d2f00cb5-46d2-4160-9c4b-b26dde1e7263"
    },
    {
        expirationDate: expirationDateIn40Days,
        legalEntityName: "MUSIC",
        name: "Document 4",
        status: 'sent',
    },
    {
        expirationDate: expirationDateIn20Days,
        legalEntityName: "MOVIES",
        name: "Document 5",
        status: 'sent',
    }
]

const expectedResult3 = [
    {
        name: "DOC1",
        legalEntityName: "Sportority Inc",
        status: "sent",
        signature_request_id: "d2f00cb5-46d2-4160-9c4b-b26dde1e7263"
    },
    {
        expirationDate: expirationDateIn40Days,
        legalEntityName: "MUSIC",
        name: "Document 4",
        status: 'sent',
    },
    {
        expirationDate: expirationDateIn20Days,
        legalEntityName: "MOVIES",
        name: "Document 5",
        status: 'sent',
    },
    {
        expirationDate: expirationDateIn40Days,
        legalEntityName: "MOVIES",
        name: "Document 5",
        status: 'sent',
    }
]

describe('providerAddLegalDocs', () => {
    beforeAll(async () => {
        let response = await usersService.create(user);
        expect(response).toBe(user);
    });

    beforeEach(async () => {
        let response = await companyProvidersService.create(provider1);
        expect(response.itemId).toBe(provider1ItemId);
        response = await companyProvidersService.create(provider2);
        expect(response.itemId).toBe(provider2ItemId);
        response = await companyProvidersService.create(provider3);
        expect(response.itemId).toBe(provider3ItemId);
    });
    
    afterEach(async () => {
        // cleanup
        let result = await companyProvidersService.delete(companyId, provider1ItemId);
        expect(result).toBe(true);
        result = await companyProvidersService.delete(companyId, provider2ItemId);
        expect(result).toBe(true);
        result = await companyProvidersService.delete(companyId, provider3ItemId);
        expect(result).toBe(true);
    });

    it('User not alloed, expect 403', async () => {
        const response = await providerAddLegalDocument.run(userNotAllowedEvent);
        expect(response.statusCode).toBe(403);
    });

    it('Add new documents', async () => {
        const response = await providerAddLegalDocument.run(newDocumentEvent);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body)
        expect(responseBody.Attributes.itemData.legalDocuments).toMatchObject(expectedResult1)
        expect(responseBody.isNewDocsAdded).toBeTruthy()
    })

    it('Add new documents in bulk', async () => {
        const response = await providerAddLegalDocument.run(newDocumentsEvent);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body)
        expect(responseBody[0].Attributes.itemData.legalDocuments).toMatchObject(expectedResult2)
        expect(responseBody[0].isNewDocsAdded).toBeTruthy()
        expect(responseBody[1].Attributes.itemData.legalDocuments).toMatchObject(expectedResult2)
        expect(responseBody[1].isNewDocsAdded).toBeTruthy()
    })

    it('Add resend attributes to expired and covering docs', async () => {
        const response = await providerAddLegalDocument.run(newDocumentsEvent3);
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body)
        const newLegalDocuments = _.get(responseBody, 'Attributes.itemData.legalDocuments', []);
        const [expiredDoc, newDoc] = newLegalDocuments;
        const { isExpiredCoverd, signature_request_id } = expiredDoc;
        const { isResend, signatureRequestId } = newDoc.resendData;
        expect(isExpiredCoverd).toBeTruthy();
        expect(isResend).toBeTruthy();
        expect(signature_request_id).toBe(signatureRequestId);
    })

    it('Add only new documents (send also exist documents) in bulk', async () => {
        /// Send 1 doc to 1 provider
        let response = await providerAddLegalDocument.run(newDocumentEvent);
        expect(response.statusCode).toBe(200);
        let responseBody = JSON.parse(response.body)
        expect(responseBody.Attributes.itemData.legalDocuments).toMatchObject(expectedResult1)

        /// Send 3 doc to 2 provider and now they have 3 docs when 1 of them is close to expire
        response = await providerAddLegalDocument.run(newDocumentsEvent);
        expect(response.statusCode).toBe(200);
        responseBody = JSON.parse(response.body)
        expect(responseBody[0].Attributes.itemData.legalDocuments).toMatchObject(expectedResult2)
        expect(responseBody[0].isNewDocsAdded).toBeTruthy()
        expect(responseBody[1].Attributes.itemData.legalDocuments).toMatchObject(expectedResult2)
        expect(responseBody[1].isNewDocsAdded).toBeTruthy()

        /// Send 3 doc to 2 provider again and now the doc that close to expire replaced with a new one
        response = await providerAddLegalDocument.run(newDocumentsEvent2);
        expect(response.statusCode).toBe(200);
        responseBody = JSON.parse(response.body)
        expect(responseBody[0].Attributes.itemData.legalDocuments).toMatchObject(expectedResult3)
        expect(responseBody[0].isNewDocsAdded).toBeTruthy()
        expect(responseBody[1].Attributes.itemData.legalDocuments).toMatchObject(expectedResult3)
        expect(responseBody[1].isNewDocsAdded).toBeTruthy()

        /// Send 3 doc to 2 provider again and now all the docs exist and not close to expire so the function didnt update the docs
        response = await providerAddLegalDocument.run(newDocumentsEvent2);
        expect(response.statusCode).toBe(200);
        responseBody = JSON.parse(response.body)
        expect(responseBody[0].Attributes.itemData.legalDocuments).toMatchObject(expectedResult3)
        expect(responseBody[0].isNewDocsAdded).toBeFalsy()
        expect(responseBody[1].Attributes.itemData.legalDocuments).toMatchObject(expectedResult3)
        expect(responseBody[1].isNewDocsAdded).toBeFalsy()
    })

    afterAll(async () => {
        // cleanup
        result = await usersService.delete(user.userId, user.entityId);
        expect(result).toBe(true);
    });
})
