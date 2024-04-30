'use strict'

const _ = require('lodash');
const { faker } = require('@faker-js/faker');
const { langProficiencyLevel } = require('../../src/talentCloud/searchTalents');
const { categoriesDict } = require('../../src/talentCloud/constants');

const generateObjectId = () => hex(faker.date.past() / 1000) +
    ' '.repeat(16).replace(/./g, () => hex(faker.number.float() * 16))

const hex = (value) => Math.floor(value).toString(16);

const OriginBu = {
    FIP: 'FIP',
    FE: 'FE'
}

const commonLocales = [
    'en-US', // English (United States)
    'en-GB', // English (United Kingdom)
    'fr-FR', // French (France)
    'es-ES', // Spanish (Spain)
    'de-DE', // German (Germany)
    'it-IT', // Italian (Italy)
    'ja-JP', // Japanese (Japan)
    'ko-KR', // Korean (South Korea)
    'ru-RU', // Russian (Russia)
    'zh-CN', // Chinese (Simplified, China)
    'zh-TW', // Chinese (Traditional, Taiwan)
    'ar-SA', // Arabic (Saudi Arabia)
    'he-IL', // Hebrew (Israel)
];


const availableLanguages = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'fr', name: 'French', native: 'Français' },
    { code: 'he', name: 'Hebrew', native: 'עברית' },
    { code: 'it', name: 'Italian', native: 'Italiano' },
];

const getRandomLanguages = () => {
    const numberOfLanguages = faker.number.int({ min: 1, max: 5 });
    const selectedLanguages = faker.helpers.arrayElements(availableLanguages, numberOfLanguages);

    const proficientLanguages = selectedLanguages.map((language) => {
        const { code } = language;
        const proficiencyLevelArray = Object.values(langProficiencyLevel);
        const level = proficiencyLevelArray[faker.number.int({ min: 0, max: proficiencyLevelArray.length - 1 })];
        return { code: code.toUpperCase(), level };
    });

    return proficientLanguages;
};

const getRandomElementFromArray = (array) => array[faker.number.int({ min: 0, max: array.length - 1 })];

const getRandomLocale = () => getRandomElementFromArray(commonLocales);

const generateAgreedToBeShownOn = () => {
    const agreedToBeShownOn = {};
    agreedToBeShownOn[OriginBu.FIP] = true;
    agreedToBeShownOn[OriginBu.FE] = true;
    return agreedToBeShownOn;
};

const generateBoolValuePerBuObject = (activeOnBu) => activeOnBu.reduce((object, bu) => {
    if (bu === OriginBu.FE) {
        object[bu] = true;
    } else if (faker.datatype.boolean()) {
        object[bu] = faker.datatype.boolean();
    }
    return object;
}, {});

const generateJoinedAt = (activeOnBu) => activeOnBu.reduce((joinedAt, bu) => {
    if (bu === OriginBu.FIP) {
        joinedAt[bu] = faker.date.past();
    }
    return joinedAt;
}, {});

const generateReviews = (activeOnBu) => {
    const reviews = {};
    activeOnBu.forEach((bu) => {
        if (bu === OriginBu.FIP) {
            reviews[bu] = [
                {
                    content: faker.lorem.paragraph(),
                    score: faker.number.float({ min: 1, max: 5, multipleOf: 0.1 }),
                    isBusiness: faker.datatype.boolean(),
                    createdAt: faker.date.past(),
                },
            ];
        }
    });
    return reviews;
};

const generateSystemIds = (activeOn) =>
    activeOn.reduce((systemIds, bu) => {
        systemIds[bu] = faker.string.uuid();
        return systemIds;
    }, {});

const getInitialBuData = (activeOnBuArray) => {
    const originBu = OriginBu.FIP;
    const systemIds = generateSystemIds(activeOnBuArray);
    return { originBu, systemIds };
};

const getLocation = () => {
    const fakeLocation = faker.location;
    return {
        countryName: fakeLocation.country(),
        countryCode: fakeLocation.countryCode(),
    };
};

const generateFakeTestimonial = () => ({
    client: {
        name: faker.person.fullName(),
        role: faker.person.jobTitle(),
        company: faker.company.name(),
    },
    project: {
        name: faker.lorem.word(),
        date: faker.date.past(),
    },
    status: getRandomElementFromArray(['Positive', 'Neutral', 'Negative']),
    text: faker.lorem.paragraph(),
});

const generateFakeTestimonials = () => {
    const count = faker.number.int({ min: 1, max: 2 });
    return _.times(count, generateFakeTestimonial);
};

const getPortfolio = (withText) => {
    const title = withText ? faker.lorem.word() : undefined;
    const description = withText ? faker.lorem.sentence() : undefined;
    const items = _.times(faker.number.int({ min: 1, max: 2 }), () => ({
        attachmentUrl: faker.internet.url(),
    }));
    const partialPortfolio = _.omitBy({ title, description }, _.isUndefined);
    const portfolio = { ...partialPortfolio, items };
    return portfolio;
};

const getPortfolios = () => {
    const portfolios = [getPortfolio(true)];
    portfolios.push(getPortfolio(false));
    return portfolios;
};

const getEducations = () =>
    _.times(faker.number.int({ min: 1, max: 2 }), () => ({
        degree: faker.lorem.word(),
        graduationYear: faker.number.int({ min: 1965, max: 2010 }),
        degreeTitle: faker.lorem.word(),
        countryCode: faker.location.countryCode(),
        school: faker.lorem.word(),
    }));

const getCertifications = () =>
    _.times(faker.number.int({ min: 1, max: 2 }), () => ({
        receivedFrom: faker.lorem.word(),
        name: faker.lorem.word(),
        year: faker.number.int({ min: 1965, max: 2010 }),
    }));


const generateTimestamps = () => {
    let createdAt = faker.date.past();
    let updatedAt = faker.date.past();
    if (createdAt > updatedAt) {
        [createdAt, updatedAt] = [updatedAt, createdAt];
    }
    return { createdAt, updatedAt };
};

const setupSeedForStaticData = (timeDeviation = 2000) => {
    faker.seed(123);
    if (timeDeviation > 0) {
        let clock = new Date("2020-01-01").getTime();
        faker.setDefaultRefDate(() => {
            clock += timeDeviation;
            return new Date(clock);
        });
    } else {
        faker.setDefaultRefDate(new Date('2020-01-01'));
    }
}

const generateRandomTalent = () => {
    const activeOnBuArray = [OriginBu.FIP];

    return {
        _id: generateObjectId(),
        ...getInitialBuData(activeOnBuArray),
        agreedToBeShownOn: generateAgreedToBeShownOn(),
        fullName: faker.person.fullName(),
        displayName: `${faker.person.firstName()} ${faker.string.alpha({ casing: 'upper' })}`,
        email: faker.internet.email(),
        location: getLocation(),
        proficientLanguages: getRandomLanguages(),
        avatarImageUrl: faker.image.avatar(),
        csmName: faker.person.firstName(),
        skills: [
            {
                name: faker.lorem.word(),
                professionAlias: faker.lorem.word(),
                type: faker.lorem.word(),
                level: faker.lorem.word(),
                isVerified: faker.datatype.boolean(),
            },
        ],
        notableClients: [
            {
                description: faker.lorem.sentence(),
                startDate: faker.date.past(),
                endDate: faker.date.past(),
                company: {
                    name: faker.company.name(),
                    description: faker.company.catchPhrase(),
                    industry: faker.company.buzzPhrase(),
                    logoUrl: faker.image.urlLoremFlickr({ category: 'business' }),
                    isInFortuneList: faker.datatype.boolean(),
                },
            },
        ],
        rating: {
            count: faker.number.int({ max: 100 }),
            score: faker.number.float({ min: 1, max: 5, multipleOf: 0.1 }),
        },
        reviews: generateReviews(activeOnBuArray),
        testimonials: generateFakeTestimonials(),
        isActive: generateBoolValuePerBuObject(activeOnBuArray),
        achievementLevel: faker.lorem.word(),
        isVetted: generateBoolValuePerBuObject(activeOnBuArray),
        approvedGigsCount: faker.number.int({ max: 100 }),
        serviceCategories: [
            {
                category: categoriesDict[getRandomElementFromArray(Object.keys(categoriesDict))],
                subCategory: faker.lorem.word(),
                nestedSubCategory: faker.lorem.word(),
            },
        ],
        introVideoUrl: faker.internet.url(),
        oneLinerTitle: faker.person.jobTitle(),
        description: faker.lorem.paragraph(),
        isHighlyResponsive: faker.datatype.boolean(),
        responseTimeInHours: faker.number.int({ max: 24 }),
        onlinePresences: [
            {
                platform: faker.lorem.word(),
                url: faker.internet.url(),
                influenceCount: faker.number.int({ max: 1000 }),
                influenceType: faker.lorem.word(),
            },
        ],
        professionalPresences: [
            {
                platform: faker.lorem.word(),
                url: faker.internet.url(),
                influenceCount: faker.number.int({ max: 1000 }),
                influenceType: faker.lorem.word(),
            },
        ],
        financialAnalyticsCounters: {
            earningsInCents: faker.number.int({ min: 0, max: 100000 }),
            expensesInCents: faker.number.int({ min: 0, max: 10000 }),
            compensationsInCents: faker.number.int({ min: 0, max: 10000 }),
        },
        asp: faker.number.int({ min: 1, max: 1000 }),
        completedOrdersCount: faker.number.int({ max: 100 }),
        cancelledOrdersCount: faker.number.int({ max: 100 }),
        activeOrdersCount: faker.number.int({ max: 100 }),
        gigReports: faker.number.int({ max: 100 }),
        orderCompletionRate: faker.number.float({ max: 1, multipleOf: 0.01 }),
        onTimeDeliveryRate: faker.number.float({ max: 1, multipleOf: 0.01 }),
        responseRate: faker.number.float({ max: 1, multipleOf: 0.01 }),
        lastWarnedAt: faker.date.past(),
        qualityScore: faker.number.int({ max: 5 }),
        hasLoyaltyScores: faker.datatype.boolean(),
        loggedInAt: faker.date.recent(),
        locale: getRandomLocale(),
        joinedAt: generateJoinedAt(activeOnBuArray),
        portfolios: getPortfolios(),
        education: getEducations(),
        certifications: getCertifications(),
        ...generateTimestamps(),
    };
};

const generateTalents = (count = 10, isRepetable = true, timeDeviation = 2000) => {
    if (isRepetable) {
        setupSeedForStaticData(timeDeviation);
    }
    return _.times(count, generateRandomTalent)
};


const repeat = (valueFunc) => {
    const uniqueSet = new Set();
    _.times(faker.number.int({ min: 1, max: 10 }), () => uniqueSet.add(valueFunc()));
    return _.map(Array.from(uniqueSet), (item) => {
        return {
            value: item,
            count: faker.number.int({ min: 1, max: 100 })
        }
    }
    );
}

const getRandomLanguageCode = () => {
    const randomIndex = faker.number.int({ min: 0, max: availableLanguages.length - 1 });
    return availableLanguages[randomIndex].code.toUpperCase();
}

const generateFacets = (timeDeviation = 2000) => {
    setupSeedForStaticData(timeDeviation);
    const facets = {
        categoryFacet: {
            name: "category",
            values: repeat(() => faker.commerce.department()),
            isMulti: false
        },
        subCategoryFacet: {
            name: "subCategory",
            values: repeat(() => faker.commerce.productAdjective() + ' ' + faker.commerce.productMaterial()),
            isMulti: false
        },
        nestedSubCategoryFacet: {
            name: "nestedSubCategory",
            values: repeat(() => faker.commerce.productName()),
            isMulti: false
        },
        skillsFacet: {
            name: "skills",
            values: repeat(() => faker.lorem.word()),
            isMulti: true
        },
        languagesFacet: {
            name: "languages",
            values: repeat(() => getRandomLanguageCode()),
            isMulti: true
        },
        locationsFacet: {
            name: "locations",
            values: repeat(() => faker.location.countryCode()),
            isMulti: true
        }
    };
    return facets;
}

const getTalentLakeResponse = (count = 10, timeDeviation = 2000) => {
    const talents = generateTalents(count, true, timeDeviation);
    return {
        talents,
        facets: generateFacets(timeDeviation),
        totalItemsCount: 350,
        lastItemCursor: _.last(talents)._id,
    }
}

module.exports = {
    generateTalents,
    generateFacets,
    getTalentLakeResponse
}
