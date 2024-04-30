const mod = require('../src/billing');
const { constants, UsersService, JobsService, CompanyProvidersService, CompaniesService } = require('stoke-app-common-api');
const AWS = require('aws-sdk');
const s3 = new AWS.S3({});
const usersService = new UsersService(process.env.consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(process.env.companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const companiesService = new CompaniesService(process.env.customersTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes)
const jobsService = new JobsService(process.env.jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAndTagsAttributes);

const jestPlugin = require('serverless-jest-plugin');
const { permissionsComponentsKeys } = require('stoke-app-common-api/config/permisionConstants');
const lambdaWrapper = jestPlugin.lambdaWrapper;
const wrapped = lambdaWrapper.wrap(mod, { handler: 'getBilling' });

const entityId = 'GET-BILLING-TEST-ENT-ID-1';
const companyId = 'GET-BILLING-TEST-COMP-ID-1';
const userId = 'GET-BILLING-TEST-USER-ID-1';
const talentId = 'provider_GET-BILLING-TEST-TALENT-ID-1';
const jobId1 = 'job_-GET-BILLING-job-1';
const milestoneId1 = `ms_${jobId1}_ms1`;
const milestoneId2 = `ms_${jobId1}_ms2`;
const milestoneId3 = `ms_${jobId1}_ms3`;
const milestoneId4 = `ms_${jobId1}_ms4`;
const billingId = '2020-01-24-2020-01-24';
const billingId2 = '2019-11-25-2019-12-24';

const job1 = {
    companyId,
    entityId,
    itemId: jobId1,
    userId,
    itemStatus: constants.job.status.paid,
    itemData: {

    },
    tags: {
        address: 'address',
    }
};

const lineItems = [{
    "amount": "13$",
    "description": "1234",
    "name": "lineItem",
}]

const milestone1 = {
    companyId,
    entityId,
    itemId: milestoneId1,
    userId,
    itemStatus: constants.job.status.paid,
    itemData: {
        billingId,
        lineItems,
        files: [{
            key: '1568192593716-filename.svg',
            size: 285,
            name: 'filename.svg',
            type: 'image/svg+xml',
        },
        {
            key: '1568192593716-filename.svg',
            size: 285,
            name: 'invoce.svg',
            type: 'image/svg+xml',
            isInvoice: true
        },
        {
            key: '1568192593716-filename.svg',
            size: 285,
            name: 'invoce.svg',
            type: 'image/svg+xml',
            isProForma: true
        },
        {
            key: '1568192593716-filename.svg',
            size: 285,
            name: 'invoce.svg',
            type: 'image/svg+xml',
            autoTalentInvoice: true
        }],
    },
};

const event = {
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        fetchProviders: true,
        fetchUsers: true
    }
}

const eventBillingId = {
    requestContext: {
        identity: {
            cognitoIdentityId: userId
        }
    },
    queryStringParameters: {
        companyId,
        billingId,
        fetchProviders: true,
        fetchUsers: true
    }
}

const eventNotAuth = {
    requestContext: {
        identity: {
            cognitoIdentityId: 'userId'
        }
    },
    queryStringParameters: {
        companyId,
        fetchProviders: true,
        fetchUsers: true
    }
}


const userItem = {
    companyId,
    itemId: `${constants.prefix.userPoolId}${userId}`,
    userId: userId,
    itemData: {
        userEmail: 'test@test.com',
        givenName: 'test@test.com',
        familyName: 'test@test.com',
    },
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.invited
};

const userEntityAdmin = {
    userId,
    entityId: companyId,
    companyId,
    itemStatus: constants.user.status.active,
    itemData: {
        userRole: constants.user.role.admin,
        permissionsComponents: {
            [permissionsComponentsKeys.billing]: { isEditor: false },
        }
    }
};

const compTalent = {
    itemId: talentId,
    companyId,
    createdBy: userId,
    modifiedBy: userId,
    itemStatus: constants.user.status.active,
    itemData: {
        name: 'test'
    },
    tags: {
        address: 'address',
    }
};


const jsonFileContent1 = {
    from: '2019-12-25',
    to: '2020-01-24',
    billingId,
    name: '2020_00',
    title: 'Spetember',
    body: [
        {
            milestoneId: milestoneId2,
            jobId: jobId1,
            hiringManagerId: userId,
            entityId,
            providerId: talentId,
            jobTitle: 'job title',
            milestoneTitle: 'title 2',
            amount: 50,
            milestoneStatus: 'Completed',
            files: []
        },
        {
            milestoneId: milestoneId1,
            jobId: jobId1,
            hiringManagerId: userId,
            entityId,
            providerId: talentId,
            jobTitle: 'job title',
            milestoneTitle: 'title 1',
            amount: 50,
            milestoneStatus: 'Completed',
            files: []
        }
    ]
}

const jsonFileContent2 = {
    from: '2019-11-25',
    to: '2019-12-24',
    billingId: billingId2,
    name: '2019_11',
    body: [
        {
            milestoneId: milestoneId3,
            jobId: jobId1,
            hiringManagerId: userId,
            entityId,
            providerId: talentId,
            jobTitle: 'job title',
            milestoneTitle: 'title 3',
            amount: 50,
            milestoneStatus: 'Completed',
            files: []
        },
        {
            milestoneId: milestoneId4,
            jobId: jobId1,
            hiringManagerId: userId,
            entityId,
            providerId: talentId,
            jobTitle: 'job title',
            milestoneTitle: 'title 4',
            amount: 50,
            milestoneStatus: 'Completed',
            files: []
        }
    ]
}

describe('billing', () => {
    beforeEach(async () => {
        let response = await usersService.create(userEntityAdmin);
        expect(response).toEqual(userEntityAdmin);
        response = await companiesService.create(userItem);
        expect(response).toEqual(userItem);
        response = await companyProvidersService.create(compTalent);
        expect(response.itemId).toBe(compTalent.itemId);
        response = await jobsService.create(milestone1);
        expect(response.itemId).toBe(milestone1.itemId);
        response = await jobsService.create(job1);
        expect(response.itemId).toBe(job1.itemId);
        let params = { Bucket: process.env.jobsBucketName, Key: `billing/${companyId}/${jsonFileContent1.billingId}`, Body: JSON.stringify(jsonFileContent1) };
        await s3.putObject(params).promise();
        await s3.putObjectTagging({ Bucket: process.env.jobsBucketName, Key: params.Key, Tagging: { TagSet: [{ Key: constants.invoices.stokeInvoicePath, Value: 'path' },] } }).promise();
        params = { Bucket: process.env.jobsBucketName, Key: `billing/${companyId}/${jsonFileContent2.billingId}`, Body: JSON.stringify(jsonFileContent2) };
        await s3.putObject(params).promise();
    })

    it('getBilling, expect 200, data', async () => {
        let response = await wrapped.run(event);
        expect(response.statusCode).toBe(200);
        let body = JSON.parse(response.body);
        expect(body).toMatchObject({
            invoices: {
                '2020_00_1': {
                    isStokeInvoicesExist: true,
                    title: jsonFileContent1.title,
                    body: [
                        {
                            milestoneId: milestoneId2,
                            jobId: jobId1,
                            hiringManagerId: userId,
                            entityId,
                            providerId: talentId,
                            jobTitle: 'job title',
                            milestoneTitle: 'title 2',
                            amount: 50,
                            milestoneStatus: 'Completed',
                            files: [],
                            tags: {
                                address: 'address',
                            }
                        },
                        {
                            milestoneId: milestoneId1,
                            jobId: jobId1,
                            hiringManagerId: userId,
                            entityId,
                            providerId: talentId,
                            jobTitle: 'job title',
                            milestoneTitle: 'title 1',
                            amount: 50,
                            milestoneStatus: 'Completed',
                            files: [milestone1.itemData.files[0]],
                            invoice: milestone1.itemData.files[1],
                            proForma: milestone1.itemData.files[2],
                            tags: {
                                address: 'address',
                            },
                            lineItems,
                        }
                    ]
                }, '2019_11_1': { body: jsonFileContent2.body, isStokeInvoicesExist: false }
            },
            providers: {
                [compTalent.itemId]: {
                    ...compTalent.itemData,
                    tags: compTalent.tags
                },
            },
            hiringManagers: { [userItem.userId]: userItem.itemData },
        });
    });

    it('getBilling by billingId, expect 200, data', async () => {
        let response = await wrapped.run(eventBillingId);
        expect(response.statusCode).toBe(200);
        let body = JSON.parse(response.body);
        expect(body.invoices['2019_11_1']).toBeUndefined();
        expect(body.invoices['2020_00_1']).toBeDefined();
        expect(body).toMatchObject({
            invoices: {
                '2020_00_1': {
                    isStokeInvoicesExist: true,
                    title: jsonFileContent1.title,
                    body: [
                        {
                            milestoneId: milestoneId2,
                            jobId: jobId1,
                            hiringManagerId: userId,
                            entityId,
                            providerId: talentId,
                            jobTitle: 'job title',
                            milestoneTitle: 'title 2',
                            amount: 50,
                            milestoneStatus: 'Completed',
                            files: [],
                            tags: {
                                address: 'address',
                            }
                        },
                        {
                            milestoneId: milestoneId1,
                            jobId: jobId1,
                            hiringManagerId: userId,
                            entityId,
                            providerId: talentId,
                            jobTitle: 'job title',
                            milestoneTitle: 'title 1',
                            amount: 50,
                            milestoneStatus: 'Completed',
                            files: [milestone1.itemData.files[0]],
                            invoice: milestone1.itemData.files[1],
                            proForma: milestone1.itemData.files[2],
                            tags: {
                                address: 'address',
                            }
                        }
                    ]
                }
            },
            providers: {
                [compTalent.itemId]: {
                    ...compTalent.itemData,
                    tags: compTalent.tags
                },
            },
            hiringManagers: { [userItem.userId]: userItem.itemData },
        });
    });

    it('getBilling, expect 403', async () => {
        let response = await wrapped.run(eventNotAuth);
        expect(response.statusCode).toBe(403);
    });


    afterAll(async () => {
        await usersService.delete(userId, entityId);
        await companiesService.delete(userItem.itemId);
        await companyProvidersService.delete(companyId, compTalent.itemId);
        await jobsService.delete(entityId, milestone1.itemId);
        await jobsService.delete(entityId, job1.itemId);
    });
})
