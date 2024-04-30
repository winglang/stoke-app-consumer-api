'use strict';

const { constants } = require("stoke-app-common-api");

const TALENT_CLOUD_CANDIDATES_FILE = {
    name: '/candidates.json',
    folder: 'talentCloud'
}

const TALENT_CLOUD_CATEGORIES_FILE = {
    name: '/categoriesTree.json',
    folder: 'talentCloud'
}

const TALENT_CLOUD_FIVER_PRO_SKILLS_BY_CATEGORIES_FILE = {
    name: '/fiverProSkillsByCategories.json',
    folder: 'talentCloud'
}

// serve single values in json file. keys name in DB / file, values - name in api param
const SINGLE_FIELD_TO_PARAM_MAPPING = {
    candidateId: 'candidateId',
    id: 'id' 
}

// serve array values in json file. keys name in DB / file, values - name api param
const MULTI_FIELD_TO_PARAM_MAPPING = {
    categories: 'categoryId',
    subCategories: 'subCategoryId',
    skills: 'skillIds',
    languages: 'languagesIds',
    country: 'countriesIds'
}

const ALL_FIELDS_MAPPING = {
    ...SINGLE_FIELD_TO_PARAM_MAPPING,
    ...MULTI_FIELD_TO_PARAM_MAPPING
}

const FAVOURITE_TALENTS_LIST_DATA = {
    type: constants.settingsListTypes.talentCloud,
    name: 'favourites'
}

const langProficiencyLevel = {
    basic: 'BASIC',
    conversational: 'CONVERSATIONAL',
    fluent: 'FLUENT',
    nativeOrBilingual: 'NATIVE_OR_BILINGUAL',
}

const langProficiencyLevelCode = {
    [langProficiencyLevel.basic]: 1,
    [langProficiencyLevel.conversational]: 2,
    [langProficiencyLevel.fluent]: 3,
    [langProficiencyLevel.nativeOrBilingual]: 4,
}

const skillProficiencyLevel = {
    beginner: 'BEGINNER',
    intermediate: 'INTERMEDIATE',
    pro: 'PRO'
}

const skillProficiencyLevelCode = {
    [skillProficiencyLevel.beginner]: 1,
    [skillProficiencyLevel.intermediate]: 2,
    [skillProficiencyLevel.pro]: 3,
}

const PROD_STAGE = 'prod';

const FIVERR_ENTERPRISE_BU_ID = "FE";

const TOP_RATED_SELLER = "TOP_RATED_SELLER"

const TALENT_LAKE_EMAIL_GROUP = 'devops-talent';

const categoriesDict = {
    digitalMarketing: "Digital Marketing",
    graphicsDesign: "Graphics & Design",
    writingTranslation: "Writing & Translation",
    hime: "Hime",
    business: "Business",
    trending: "Trending",
    programmingTech: "Programming & Tech",
    other: "Other",
    musicAudio: "Music & Audio",
    videoAnimation: "Video & Animation",
    data: "Data",
    certified: "Certified",
    photography: "Photography",
    consultation: "Consultation",
    roleBased: "Role based",
    endToEndProjects: "End-to-End Projects"
}

const CATEGORY_TO_ID = {
    [categoriesDict.digitalMarketing]: 2,
    [categoriesDict.graphicsDesign]: 3,
    [categoriesDict.writingTranslation]: 5,
    [categoriesDict.hime]: 7,
    [categoriesDict.business]: 8,
    [categoriesDict.trending]: 9,
    [categoriesDict.programmingTech]: 10,
    [categoriesDict.other]: 11,
    [categoriesDict.musicAudio]: 12,
    [categoriesDict.videoAnimation]: 20,
    [categoriesDict.data]: 23,
    [categoriesDict.certified]: 24,
    [categoriesDict.photography]: 25,
    [categoriesDict.consultation]: 26,
    [categoriesDict.roleBased]: 27,
    [categoriesDict.endToEndProjects]: 28
}

module.exports = {
    SINGLE_FIELD_TO_PARAM_MAPPING,
    MULTI_FIELD_TO_PARAM_MAPPING,
    ALL_FIELDS_MAPPING,
    TALENT_CLOUD_CANDIDATES_FILE,
    TALENT_CLOUD_CATEGORIES_FILE,
    FAVOURITE_TALENTS_LIST_DATA,
    TALENT_CLOUD_FIVER_PRO_SKILLS_BY_CATEGORIES_FILE,
    langProficiencyLevel,
    langProficiencyLevelCode,
    FIVERR_ENTERPRISE_BU_ID,
    skillProficiencyLevelCode,
    PROD_STAGE,
    TALENT_LAKE_EMAIL_GROUP,
    categoriesDict,
    CATEGORY_TO_ID,
    TOP_RATED_SELLER,
};
