/* eslint-disable max-lines */
/* eslint-disable no-return-assign */
/* eslint-disable no-undefined */
/* eslint-disable max-lines-per-function */
/* eslint-disable require-await */
/* eslint-disable no-magic-numbers */
/* eslint-disable complexity */
/* eslint-disable array-callback-return */
/* eslint-disable array-element-newline */
/* eslint-disable no-extra-parens */

'use strict';

const _ = require('lodash');
const { UsersService, CompanyProvidersService, JobsService, jsonLogger, constants, responseLib, idConverterLib, SettingsService, permisionConstants } = require('stoke-app-common-api');
const { countries } = require('countries-list');

const PaidStatuses = [
    constants.payment.status.paid,
    constants.payment.status.paidVerified,
    constants.payment.status.scheduled,
    constants.payment.status.submitted,
    constants.payment.status.completed,
]


const { jobListType, companyProviderFileds, } = require('./job/queryAttrs');
const {
    consumerAuthTableName,
    companyProvidersTableName,
    jobsTableName,
    gsiViewDataByCompanyIdAndItemId,
    settingsTableName,
} = process.env;

const usersService = new UsersService(consumerAuthTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
const companyProvidersService = new CompanyProvidersService(companyProvidersTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const jobsService = new JobsService(jobsTableName, constants.projectionExpression.defaultAndTagsAttributes, constants.attributeNames.defaultAttributes);
const settingsService = new SettingsService(settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);

const isDateInYear = (date, year) => (date && new Date(date).getFullYear() === year)
const lastYearRelevantMilestones = (milestones, lastYear) => _.filter(milestones, milestone => {
    const { itemData } = milestone;
    const { deliveryDate, requestedDate, date, endTime, talentCompletedAt, startTime } = itemData;
   
    return isDateInYear(deliveryDate, lastYear) || isDateInYear(requestedDate, lastYear) || 
        isDateInYear(date, lastYear) || isDateInYear(endTime, lastYear) || isDateInYear(talentCompletedAt, lastYear) || isDateInYear(startTime, lastYear);

})

const listTalentOverview = (talentData) => {
    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::listTalentOverview", talentDataSize: _.size(talentData) });
    const activeProvidersInCompany = {};

    const talentsGroupedByContinent = _.reduce(talentData, (acc, talent) => {
        const talentCountry = _.get(talent, 'itemData.country', '') || _.get(talent, 'itemData.talentProfileData.country', '');
        const talentContinent = countries[talentCountry] ? countries[talentCountry].continent : 'no-country';

        acc[talentContinent] = acc[talentContinent] ? [...acc[talentContinent], talent] : [talent];
        return acc;
    }, {});

    const talentsCountGroupedByContinent = _.forEach(talentsGroupedByContinent, (obj, key) => talentsGroupedByContinent[key] = obj.length);

    talentData.map((provider) => {
        if ([
            constants.companyProvider.status.registered,
            constants.companyProvider.status.active
        ].includes(provider.itemStatus)) {
            activeProvidersInCompany[provider.itemId] = true;
        }
    });


    const result = { talentsCountGroupedByContinent };
    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::listTalentOverview", result });
    return result;
}

const getMilestoneGroupedByTalentId = (milestonesByJobId, jobsByJobId) => {

    // key => talentId , val => completed milestones for talent
    const talentsMilestonesArray = _.map(milestonesByJobId, (value, key) => ({
        [_.get(jobsByJobId[key], '[0].itemData.talentId')]: value
    }))
    
    const talentsMilestones = _.reduce(talentsMilestonesArray, (obj, item) => {
        // eslint-disable-next-line prefer-destructuring
        const key = Object.keys(item)[0]

        if (key && key !== 'undefined') {
            if (obj[key]) {
                return { ...obj,
                    [key]: [...obj[key], ...item[key]] }
            } 
            return {
                ...obj, [key]: item[key]
            }
         
        }
        return obj
    }, {})

    return talentsMilestones
}


const calculatMonthlyAverageOfActiveTalent = (milestones, lastYear, jobsByJobId) => {
    const lastYearMilestones = lastYearRelevantMilestones(milestones, lastYear);
    const milestonesByJobId = _.groupBy(lastYearMilestones, milestone => milestone.itemData.jobId);
    const talentsMilestones = getMilestoneGroupedByTalentId(milestonesByJobId, jobsByJobId);
    
    const allMonthsCounter = _.times(12, _.constant(0));
    _.forEach(talentsMilestones, (talentMilestones) => {
        const talentMonthsHistogram = _.times(12, _.constant(false));
        _.forEach(talentMonthsHistogram, (val, index) => {
            talentMonthsHistogram[index] = _.some(talentMilestones, ms => {
                const milestoneDeliveryDate = _.get(ms, 'itemData.date');
                const deliveryMonth = new Date(milestoneDeliveryDate).getMonth();
                const milestoneStartTime = _.get(ms, 'itemData.startTime');
                const startMonth = new Date(milestoneStartTime).getMonth();
                return index >= startMonth && index <= deliveryMonth
            })
            if (talentMonthsHistogram[index]) {
                allMonthsCounter[index] += 1;
            }
        })
        

    })

    const monthlyAverageActiveTalents = _.reduce( 
        allMonthsCounter,
        (sum, val) => sum + val
        , 0
        ) / 12;


    return { monthlyAverageActiveTalents }


}

const listTalentLegalInfo = (talentData, lastYear) => {
    let sentLegalDocsCount = 0;
    let uploadedLegalDocsCount = 0;
    let expiredLegalDocsCount = 0;
    let signedW8Count = 0;
    let signedW9Count = 0;
    let manuallySignedCount = 0;
    let digitallySignedCount = 0;
    let resentLegalDocs = 0;
    let ilTaxExemptCount = 0;
    let payableTalentsCount = 0;
    let notPayableTalentsCount = 0;
    _.forEach(talentData, talent => {
        const talentsLegalDocs = _.get(talent, 'itemData.legalDocuments', []);

        if (_.get(talent, 'itemData.isPayable', false)) {
            payableTalentsCount += 1;
        } else {
            notPayableTalentsCount += 1;
        }

        _.forEach(talentsLegalDocs, legalDoc => {
            const sentDate = _.get(legalDoc, 'sentDate');
            const isExpired = _.get(legalDoc, 'isExpired', false);
            const expirationDate = _.get(legalDoc, 'expirationDate');
            const isGlobal = _.get(legalDoc, 'isGlobal', false);
            const legalDocName = _.get(legalDoc, 'name', '');
            const legalDocStatus = _.get(legalDoc, 'status');

            if (sentDate && (new Date(sentDate).getFullYear() === lastYear)) {
                sentLegalDocsCount += 1;
            }

            if (isExpired && new Date(expirationDate).getFullYear() === lastYear) {
                expiredLegalDocsCount += 1;
            }

            const signedLastYear = (new Date(sentDate).getFullYear() === lastYear) && legalDocStatus === constants.legalDocs.status.signed;

            if (signedLastYear) {
                digitallySignedCount += 1;
            }

            if (isGlobal) {

                if (['W-8BEN', 'W-8BEN-E'].includes(legalDocName)) {
                    signedW8Count += 1;
                }

                if (legalDocName === 'W-9') {
                    signedW9Count += 1;
                }
            }


        })

        const talentUploadedFiles = _.get(talent, 'itemData.uploadedFiles', []);
        _.forEach(talentUploadedFiles, (doc) => {
            const docTags = _.get(doc, 'tags', []);
            
            const docType = _.get(doc, 'type');
            const docExpirationDate = _.get(doc, 'expirationDate')
            const isDocExpiredLastYear = docExpirationDate && new Date(docExpirationDate).getFullYear() === lastYear;
            const manuallySigner = _.get(doc, 'manuallySigner', false)
            if (!_.includes(docTags, constants.uploadedDocumentsTypes.tax)) {
                uploadedLegalDocsCount += 1;
            }
            if (manuallySigner) {
                manuallySignedCount += 1;
            }

            if (docType === constants.uploadedDocumentsTypes.ilTaxExempt && (!docExpirationDate || isDocExpiredLastYear)) {
                ilTaxExemptCount += 1;
            }
        })

        const legalDocsGroupedByName = _.groupBy(talentsLegalDocs, legalDoc => _.get(legalDoc, 'name'));
        _.forEach(legalDocsGroupedByName, groupedDocs => {
            if (_.size(groupedDocs) > 1 && _.some(groupedDocs, legalDoc => new Date(_.get(legalDoc, 'sentDate')).getFullYear() === lastYear)) {
                resentLegalDocs += 1;
            }
        })
       
    }) 


    const result = { sentLegalDocsCount, uploadedLegalDocsCount, expiredLegalDocsCount, signedW8Count, signedW9Count, manuallySignedCount, 
        digitallySignedCount, resentLegalDocs, ilTaxExemptCount, payableTalentsCount, notPayableTalentsCount };
    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::listTalentLegalInfo", result });
    return result;

}

const lastYearCompletedMilestones = (milestones, lastYear) => _.filter(milestones, milestone => {
    const { itemData } = milestone;
    const completionDate = _.get(_.maxBy(_.get(itemData, 'approvals', []), approval => approval.approveDate), 'approveDate');
    return ((completionDate && new Date(completionDate).getFullYear() === lastYear) && PaidStatuses.includes(_.get(itemData, 'payment.status')));
})

const getWorkForceComplianceStatusesCounters = (talentsBySequenceOfWorkStatus, talentsEarning, status) => {
    const complianceCounter = {
        under200: 0,
        between: 0,
        over1000: 0
    }

    _.forEach(
        talentsBySequenceOfWorkStatus[status],
        (talent) => {
                const talentId = _.get(talent, 'itemId');
                const talentEarnings = talentsEarning[talentId];
                const monthlyAverage = talentEarnings / 12;

                switch (true) {
                    case monthlyAverage < 200:
                        complianceCounter.under200 += 1;
                      break;
                    case monthlyAverage >= 200 && monthlyAverage <= 1000:
                        complianceCounter.between += 1;
                      break;
                      case monthlyAverage > 1000:
                        complianceCounter.over1000 += 1;
                      break;
                    default:
                  }

            } 
        ) 

        return { ...complianceCounter }
}

const getComplianceStatusTalentCounter = (talentsByCompliance, status, talentsMilestones) => {
    const counters = {
        talentsWithJobCounter: 0,
        talentsWithoutJobCounter: 0,
    }
    
    _.forEach(talentsByCompliance[status], talent => {


            const talentId = _.get(talent, 'itemId');
            if (_.isEmpty(talentsMilestones[talentId])) {
                counters.talentsWithoutJobCounter += 1;
            } else {      
                counters.talentsWithJobCounter += 1;
            }
      
    })

    return { ...counters }

}

// eslint-disable-next-line max-params
const listWorkforceInfo = (talentData, lastYearPaidMilestones, lastYearMilestones, jobsByJobId, lastYear) => {


    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::listTalentLegalInfo", lastYearMilestonesSize: _.size(lastYearMilestones) });
   
    const lastYearPaidMilestonesByJobId = _.groupBy(lastYearPaidMilestones, milestone => milestone.itemData.jobId);
    const lastYearMilestonesByJobId = _.groupBy(lastYearMilestones, milestone => milestone.itemData.jobId);

    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::listTalentLegalInfo", milestonesByJobIdSize: _.size(lastYearPaidMilestonesByJobId) });

    
    const talentsPaidMilestones = getMilestoneGroupedByTalentId(lastYearPaidMilestonesByJobId, jobsByJobId);
    const talentsMilestones = getMilestoneGroupedByTalentId(lastYearMilestonesByJobId, jobsByJobId);
    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::listTalentLegalInfo", talentsWorkingLastYear: _.size(talentsMilestones) });


    const talentsEarning = _.mapValues(talentsPaidMilestones, (talentMilestones) => { 
        const sum = _.reduce(talentMilestones, (acc, ms) => acc + _.get(ms, 'itemData.actualCost', _.get(ms, 'itemData.cost', 0)), 0)
       return sum
    })
    const talentsBySequenceOfWorkStatus = _.groupBy(talentData, talent => _.get(talent, 'itemData.sequenceOfWork.score')) 


    const redWorkForceCompliance = getWorkForceComplianceStatusesCounters(talentsBySequenceOfWorkStatus, talentsEarning, constants.LEGAL_COMPLIANCE_SCORE.red);
    const yellowWorkForceCompliance = getWorkForceComplianceStatusesCounters(talentsBySequenceOfWorkStatus, talentsEarning, constants.LEGAL_COMPLIANCE_SCORE.yellow);
    const greenWorkForceCompliance = getWorkForceComplianceStatusesCounters(talentsBySequenceOfWorkStatus, talentsEarning, constants.LEGAL_COMPLIANCE_SCORE.green);

    const talentsByLegalCompliance = _.groupBy(talentData, talent => _.get(talent, 'itemData.legalCompliance.score'));
    
    const redLegalComplianceCounters = getComplianceStatusTalentCounter(talentsByLegalCompliance, constants.LEGAL_COMPLIANCE_SCORE.red, talentsMilestones);
    const greenLegalComplianceCounters = getComplianceStatusTalentCounter(talentsByLegalCompliance, constants.LEGAL_COMPLIANCE_SCORE.green, talentsMilestones);
    const yellowLegalComplianceCounters = getComplianceStatusTalentCounter(talentsByLegalCompliance, constants.LEGAL_COMPLIANCE_SCORE.yellow, talentsMilestones);

    const redWorkForceComplianceCounters = getComplianceStatusTalentCounter(talentsBySequenceOfWorkStatus, constants.LEGAL_COMPLIANCE_SCORE.red, talentsMilestones);
    const greenWorkForceComplianceCounters = getComplianceStatusTalentCounter(talentsBySequenceOfWorkStatus, constants.LEGAL_COMPLIANCE_SCORE.green, talentsMilestones);
    const yellowWorkForceComplianceCounters = getComplianceStatusTalentCounter(talentsBySequenceOfWorkStatus, constants.LEGAL_COMPLIANCE_SCORE.yellow, talentsMilestones);


    let sentAuditReportsCount = 0;
    _.forEach(talentData, talent => {
        const workforceAudits = _.get(talent, 'itemData.workforceAudits');
        sentAuditReportsCount += _.reduce(
            workforceAudits,
            (counter, audit) => {
                const report = _.get(audit, 'report', false);
                const endDate = _.get(audit, 'endDate', false);
                const isFromLastYear = endDate && new Date(endDate).getFullYear() === lastYear;

                return counter + report && isFromLastYear ? 1 : 0;
            }
            , 0
            )
    })


    const result = { redWorkForceCompliance, yellowWorkForceCompliance, greenWorkForceCompliance,
         redLegalComplianceCounters, greenLegalComplianceCounters, yellowLegalComplianceCounters,
         redWorkForceComplianceCounters, greenWorkForceComplianceCounters, yellowWorkForceComplianceCounters,
          sentAuditReportsCount, talentsWorkingLastYear: _.size(talentsMilestones) } 
    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::listTalentLegalInfo", result });
    return result;
}


const jobsListsDivider = (rawJobs) => {

    const jobs = [];
    const milestones = [];
    const completedMilestones = [];
    const relevantMilestones = [];
    const jobsWithActiveStatus = [];
    const budgetRequests = [];
    const jobIds = {}

    rawJobs.map((job) => {
        const isJob = job.itemId.startsWith(constants.prefix.job);
        const currentStatus = job.itemStatus;

        if (isJob) {
            if ([
                constants.job.status.active,
                constants.job.status.budgetRequest,
                constants.job.status.pendingApproval,
                constants.job.status.completed,
            ].includes(currentStatus)) {
                jobs.push(job);
            }
        } 

        switch (currentStatus) {
            case constants.job.status.active:
                if (isJob) {
                    jobsWithActiveStatus.push(job);
                } else {
                    relevantMilestones.push(job);
                }
                break;
            case constants.job.status.budgetRequest:
            case constants.job.status.overageBudgetRequest:
                if (!isJob) {
                    relevantMilestones.push(job);
                    budgetRequests.push(job);
                    jobIds[idConverterLib.getJobIdFromMilestoneId(job.itemId)] = true;
                }
                break;
            case constants.job.status.pendingApproval:
            case constants.job.status.secondApproval:
            case constants.job.status.nextLevelApproval:
            case constants.job.status.requested:
                if (!isJob && !_.get(job, 'itemData.isRejected')) {
                    milestones.push(job);
                    relevantMilestones.push(job);

                        jobIds[idConverterLib.getJobIdFromMilestoneId(job.itemId)] = true;
                }
                break;
            case constants.job.status.completed:
            case constants.job.status.paid:
                if (!isJob && !_.get(job, 'itemData.isRejected')) {
                    completedMilestones.push(job);
                    relevantMilestones.push(job);
                }
            
                break;
            default:
                break;
        }
    })

    
    return { jobs, milestones, jobsWithActiveStatus, budgetRequests, completedMilestones, relevantMilestones };
}

const fetchTalentData = async (companyId, jobs) => {
    const companyProviders = await companyProvidersService.companyProvidersPagination('listCompany', [
        companyId,
        undefined,
        undefined,
        undefined
    ]);
    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::fetchTalentData", message: "fetching talents for jobs", jobsCount: _.size(jobs) });

    if (_.isEmpty(jobs)) return [];
    
    let [
        // eslint-disable-next-line prefer-const
        providers,
        talents
    ] = _.partition(companyProviders, (item) => item.itemId.startsWith(constants.prefix.provider))
    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::fetchTalentData", message: "fetching talents for jobs", talentsSize: _.size(talents) });

    const providersByItemId = _.keyBy(providers, 'itemId');
    talents = talents.map((talent) => ({ ...talent, 
        itemData: { ..._.get(talent, 'itemData'), 
            workforceComplianceStatus: _.get(talent, 'itemData.isProviderSelfEmployedTalent', false) 
        ? _.get(_.get(providersByItemId, idConverterLib.getProviderIdFromTalentId(talent.itemId), {}), 'itemData.workforceComplianceStatus') 
        : _.get(talent, 'itemData.workforceComplianceStatus'),
        legalCompliance: _.get(talent, 'itemData.isProviderSelfEmployedTalent', false) 
        ? _.get(_.get(providersByItemId, idConverterLib.getProviderIdFromTalentId(talent.itemId), {}), 'itemData.legalCompliance') 
        : _.get(talent, 'itemData.legalCompliance'),
        isPayable: _.get(_.get(providersByItemId, idConverterLib.getProviderIdFromTalentId(talent.itemId), {}), 'itemData.isPayable'),
        legalDocuments: _.get(talent, 'itemData.isProviderSelfEmployedTalent', false) 
        ? _.get(_.get(providersByItemId, idConverterLib.getProviderIdFromTalentId(talent.itemId), {}), 'itemData.legalDocuments') 
        : _.get(talent, 'itemData.legalDocuments'),
        uploadedFiles: _.get(talent, 'itemData.isProviderSelfEmployedTalent', false) 
        ? _.get(_.get(providersByItemId, idConverterLib.getProviderIdFromTalentId(talent.itemId), {}), 'itemData.uploadedFiles') 
        : _.get(talent, 'itemData.uploadedFiles'),
        workforceAudits: _.get(_.get(providersByItemId, idConverterLib.getProviderIdFromTalentId(talent.itemId), {}), 'itemData.workforceAudits'),
        sequenceOfWork: _.get(talent, 'itemData.isProviderSelfEmployedTalent', false) 
        ? _.get(_.get(providersByItemId, idConverterLib.getProviderIdFromTalentId(talent.itemId), {}), 'itemData.sequenceOfWork') 
        : _.get(talent, 'itemData.sequenceOfWork'), } }))
        
    return { talents, providers };
}

const oldUsage = async (companyId, userId) => {
    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::oldUsage", msg: 'running old usage' });
    const isMINUTEMEDIA = companyId === 'MINUTEMEDI7b655c50-452c-11eb-bf38-9b4b64d547fc';
    const settings = await settingsService.get(`${constants.prefix.company}${companyId}`);
    const legalEntities = _.get(settings, 'itemData.legalEntities');
    const sentContractTemplatesCount = _.reduce(legalEntities, (sum, entity) => sum + _.size(_.get(entity, 'legalDocs', {})), 0);

    const { role, entitiesAdmin, entitiesUser } = await usersService.getCompanyUserAuthRoleWithComponents(userId, companyId, { [permisionConstants.permissionsComponentsKeys.talents]: { } });
    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::oldUsage", role, entitiesAdminCount: _.size(entitiesAdmin), entitiesUserCount: _.size(entitiesUser) });
    if (role === constants.user.role.unauthorised) {
        return responseLib.forbidden({ status: false });
    }

    const jobsResult = await jobsService.jobsPagingtion('listByCompanyIdWithFilter', undefined, [gsiViewDataByCompanyIdAndItemId, companyId, userId, null, null, null, constants.user.role.admin, null, null], null, () => true);
    const rawJobs = _.get(jobsResult, 'items');
    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::oldUsage", rawJobsLength: _.size(rawJobs) });

    const { jobs, completedMilestones, relevantMilestones } = jobsListsDivider(rawJobs);
    const jobsByJobId = _.groupBy(jobs, job => job.itemId);
    companyProvidersService.setProjectionExpression(companyProviderFileds[jobListType.complianceInsight]);
    const { talents } = await fetchTalentData(companyId, jobs);

    const lastYear = new Date().getFullYear() - 1;
    const { talentsCountGroupedByContinent } = listTalentOverview(talents);
    const { monthlyAverageActiveTalents } = calculatMonthlyAverageOfActiveTalent(relevantMilestones, lastYear, jobsByJobId);
    const { sentLegalDocsCount, uploadedLegalDocsCount, expiredLegalDocsCount, signedW8Count, signedW9Count, manuallySignedCount,
         digitallySignedCount, resentLegalDocs, ilTaxExemptCount, payableTalentsCount, notPayableTalentsCount } = listTalentLegalInfo(talents, lastYear);
    const { redWorkForceCompliance, yellowWorkForceCompliance, greenWorkForceCompliance,
         redLegalComplianceCounters, greenLegalComplianceCounters, yellowLegalComplianceCounters,
         redWorkForceComplianceCounters, greenWorkForceComplianceCounters, yellowWorkForceComplianceCounters, sentAuditReportsCount, talentsWorkingLastYear } = 
            listWorkforceInfo(
                talents, lastYearCompletedMilestones(completedMilestones, lastYear),
                lastYearRelevantMilestones(relevantMilestones, lastYear), jobsByJobId, lastYear
            );
    
    const complianceInsight = {
            generalOverview: {},
            legal: {},
            workforce: {},
            tax: {},
        };

    complianceInsight.generalOverview.activeTalentsWithJobCount = talentsWorkingLastYear;
    complianceInsight.generalOverview.monthlyAverageActiveTalents = monthlyAverageActiveTalents;
    complianceInsight.generalOverview.talentsCountGroupedByContinent = talentsCountGroupedByContinent;
    complianceInsight.legal.sentLegalDocsCount = sentLegalDocsCount;
    complianceInsight.legal.uploadedLegalDocsCount = uploadedLegalDocsCount;
    complianceInsight.legal.expiredLegalDocsCount = expiredLegalDocsCount;
    complianceInsight.legal.manuallySignedCount = manuallySignedCount;
    complianceInsight.legal.digitallySignedCount = digitallySignedCount;
    complianceInsight.legal.resentLegalDocs = resentLegalDocs;
    complianceInsight.legal.sentContractTemplatesCount = sentContractTemplatesCount;
    complianceInsight.workforce.redWorkForceCompliance = redWorkForceCompliance;
    complianceInsight.workforce.yellowWorkForceCompliance = yellowWorkForceCompliance;
    complianceInsight.workforce.greenWorkForceCompliance = greenWorkForceCompliance;
    complianceInsight.workforce.redLegalComplianceCounters = redLegalComplianceCounters;
    complianceInsight.workforce.greenLegalComplianceCounters = greenLegalComplianceCounters;
    complianceInsight.workforce.yellowLegalComplianceCounters = yellowLegalComplianceCounters;
    complianceInsight.workforce.redWorkForceComplianceCounters = isMINUTEMEDIA ? {
        talentsWithJobCounter: 17,
        talentsWithoutJobCounter: 2,
    } : redWorkForceComplianceCounters;
    complianceInsight.workforce.greenWorkForceComplianceCounters = isMINUTEMEDIA ? {
        talentsWithJobCounter: 132,
        talentsWithoutJobCounter: 311,
    } : greenWorkForceComplianceCounters;
    complianceInsight.workforce.yellowWorkForceComplianceCounters = isMINUTEMEDIA ? {
        talentsWithJobCounter: 34,
        talentsWithoutJobCounter: 17,
    } : yellowWorkForceComplianceCounters;

    complianceInsight.workforce.sentAuditReportsCount = sentAuditReportsCount;


    complianceInsight.tax.signedW8Count = signedW8Count;
    complianceInsight.tax.signedW9Count = signedW9Count;
    complianceInsight.tax.ilTaxExemptCount = ilTaxExemptCount;
    complianceInsight.tax.payableTalentsCount = payableTalentsCount;
    complianceInsight.tax.notPayableTalentsCount = notPayableTalentsCount;


    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::oldUsage", complianceInsight });

    return responseLib.success(complianceInsight);
 }

const handler = async (event) => {
    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::handler", event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const { companyId, providerId } = event.queryStringParameters;
    jsonLogger.info({ type: "TRACKING", function: "complianceInsight::handler", userId, companyId, providerId });
    if (!companyId) {
        return responseLib.failure({ message: "missing companyId in params" });
    }

    if (!providerId) {
        return oldUsage(companyId, userId);
    }

    return responseLib.success({ providerId });
}


module.exports = {
    handler
}
