const companyProviderBeforeUpdate = {
    "companyId": "JEST-TEST-UPDATE-COMPANY-PROVIDERS",
    "itemId": "provider_ARMINDUKEc9ae3c50-7d44-11ec-92d6-3d7d68ca7a41",
    "itemStatus": "registered",
    "itemData": {
        "uploadedFiles": [],
        "paymentSystem": "Payoneer",
        "country": "US", "img": "/static/media/provider_4.1b32c2ab.svg",
        "taxFormStatus": false, "legalCompliance": {
            "score": "red",
            "lastUpdated": "2022-03-01T06:31:29+00:00",
            "contractElements": { "IP": { "documents": [], "status": "missing" } }
        },
        "taxCompliance": { "name": "W-8BEN", "lastUpdated": "2022-03-01T06:31:29+00:00", "score": "green" },
        "legalDocuments": [
            { "status": "signed", "signature_request_id": "5b869081-bbe9-4fa8-a749-e38939e6cd3d", "legalEntityName": "Tax", "name": "W-8BEN" }
        ],
        "isProviderSelfEmployedTalent": true,
        "workforceComplianceStatus": {
            "score": "green",
            "lastUpdated": 1646024736624,
            "engagementType": ["project"],
            "location": ["remotely"],
            "startInCompanyTime": 1643131755347,
            "providerType": "selfEmployedFreelancer",
            "isColocated": false
        },
        "taxFormType": "W-8BEN",
        "registrationDate": 1643049888526,
        "workforceCompliance": {},
        "paymentMethod": "Payoneer",
        "providerEmail": "m@gmail.com",
        "providerName": "A D",
        "isPayable": true,
        "title": "",
        "status": "registered",
        "description": "",
        "portfolios": null
    },
};

const newLegalDocuments = [
    { "expirationDate": null, "legalEntityName": "WITHSOCRAT Org", "name": "IP Agreement for Socrates" },
    { "status": "signed", "signature_request_id": "5b869081-bbe9-4fa8-a749-e38939e6cd3d", "legalEntityName": "Tax", "name": "W-8BEN" }
];

const companyProviderAfterUpdate = {
    ...companyProviderBeforeUpdate,
    itemData: {
        ...companyProviderBeforeUpdate.itemData,
        legalDocuments: newLegalDocuments,
    }
};

const event = {
    body: JSON.stringify(companyProviderAfterUpdate),
    requestContext: {
        identity: {
            cognitoIdentityId: "JEST-TEST-UPDATE-COMPANY-PROVIDERS"
        }
    }, pathParameters: {
        id: companyProviderBeforeUpdate.itemId
    }
};

module.exports = {
    companyProviderBeforeUpdate,
    companyProviderAfterUpdate,
    event,
}
