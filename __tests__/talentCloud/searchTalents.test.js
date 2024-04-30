const { categoriesDict, CATEGORY_TO_ID } = require('../../src/talentCloud/constants');
const searchTalents = require('../../src/talentCloud/searchTalents');

const { getTalentLakeResponse } = require('./talentLakeUtils');

describe('searchTalents Tests', () => {
    const talentLakeResponse = getTalentLakeResponse(2);
    const { talents, facets } = talentLakeResponse;
    const fiverrTalent = talents[0];
    test('test transformTalentToEnterpriseItem', async () => {
        const expectedResult = {
            "id": "5cbcbcb5b463b8bb76cf6a97",
            "languages": [
                {
                    "name": "French",
                    "level": 1
                }
            ],
            "skills": [
                {
                    "name": "valetudo"
                }
            ],
            "topClient": [
                {
                    "name": "Friesen, Brekke and Kub",
                    "img": "https://loremflickr.com/640/480/business?lock=6769297535795200"
                }
            ],
            "subCategories": [
                {
                    "id": "comminor",
                    "name": "comminor"
                }
            ],
            "country": "IR",
            "isFromStoke": false,
            "categories": [
                27
            ],
            "jobTitle": "Global Creative Facilitator",
            "name": "Garfield F",
            "onlinePresences": [
                {
                    "influenceCount": 282,
                "influenceType": "veniam",
                    "platform": "beatus",
                    "url": "https://flimsy-imagination.name",
                },
            ],
            "email": "devops-talent+dev.5cbcbcb5b463b8bb76cf6a97@stoketalent.com",
            "description": "Creo spiritus comes tolero considero ustilo assumenda. Tricesimus adsum confido demulceo ipsam eligendi. Nobis enim colligo abbas verto voveo sollers.",
            "educations": [
                {
                    "to": 1984,
                    "degree": "suggero, administratio - tumultus",
                    "location": "EE"
                },
                {
                    "to": 1972,
                    "degree": "timor, creber - tondeo",
                    "location": "SC"
                }
            ],
            "reviewsCount": 48,
            "rating": 4.3,
            "img": "https://cloudflare-ipfs.com/ipfs/Qmd3W5DuhgHirLHGVixi6V76LhCkZUz6pnFt5AJBiyvHye/avatar/96.jpg",
            "isTopRated": false,
            "countryName": "Iran",
            "certifications":[
                 {
                    "subtitle": "stipes (Graduated 2010)",
                    "title": "cohibeo",
                 },
              ],
              "portfolios": [
                {
                    "description": "Valens defendo vere infit.",
                   "items": [
                        {
                         "attachmentUrl": "https://all-efficiency.net/",
                      },
                     ],
                    "title": "abscido",
                },
                {
                 "items":  [
                        {
                           "attachmentUrl": "https://nippy-average.info/",
                        },
                        {
                           "attachmentUrl": "https://silver-iron.net/",
                        },
                       ],
                    },
                ],
            "reviews":  {
                    "FIP":  [
                                {
                                    "content": "Pax cimentarius impedit damnatio conicio absque cognomen confugo cur. Stabilis ustulo utique ceno dolore defluo sortitus censura. Tui quibusdam cerno spero ex turbo atque.",
                                     "createdAt": new Date("2019-03-28T06:08:25.841Z"),
                                     "isBusiness": true,
                                     "score": 1.3,
                                },
                            ],
                        },
            "markedAsFavourite": false
        }
        const enterpriseTalent = searchTalents.transformTalentToEnterpriseItem(fiverrTalent);
        expect(enterpriseTalent).toEqual(expectedResult);
    });

    test('test getNormalizedCategoryLeaf', async () => {
        const categoryName = categoriesDict.digitalMarketing;
        const categoryId = CATEGORY_TO_ID[categoryName];
        const { category } = await searchTalents.normalizeCategoryLeaf(talentLakeResponse, categoryId, categoryName);
        const { id, name, talentsPreview, subCategories, skills } = category;
        expect(id).toEqual(categoryId);
        expect(name).toEqual(categoryName);
        expect(talentsPreview.length).toEqual(2);
        expect(subCategories.length).not.toEqual(0);
        expect(skills.length).not.toEqual(0);
    });

    test('test buildCategoryTreeResponse', async () => {
        const categoryName = categoriesDict.digitalMarketing;
        const categoryId = CATEGORY_TO_ID[categoryName];
        const category = await searchTalents.normalizeCategoryLeaf(talentLakeResponse, categoryId, categoryName);
        const categoriesTree = [category];
        const result = await searchTalents.buildCategoryTreeResponse(categoriesTree, facets);
        const expectedSupportedLanguages = ['French', 'English'];
        const expectedSupportedLocations = ['QA', 'TN', 'PA', 'VA', 'LC'];
        expect(result).toHaveProperty('categoriesTree');
        const { supportedLanguages, supportedLocations } = result;
        expect(supportedLanguages).toEqual(expectedSupportedLanguages);
        expect(supportedLocations).toEqual(expectedSupportedLocations);
    });

});
