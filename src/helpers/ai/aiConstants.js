/* eslint-disable max-lines */

'use strict'

const languages = {
  'Аҧсуа': 'Abkhaz',
  'Afaraf': 'Afar',
  'Afrikaans': 'Afrikaans',
  'Akan': 'Akan',
  'Shqip': 'Albanian',
  'አማርኛ': 'Amharic',
  'العربية': 'Arabic',
  'Aragonés': 'Aragonese',
  'Հայերեն': 'Armenian',
  'অসমীয়া': 'Assamese',
  'Авар': 'Avaric',
  'avesta': 'Avestan',
  'Aymar': 'Aymara',
  'Azərbaycanca': 'Azerbaijani',
  'Bamanankan': 'Bambara',
  'Башҡортса': 'Bashkir',
  'Euskara': 'Basque',
  'Беларуская': 'Belarusian',
  'বাংলা': 'Bengali',
  'भोजपुरी': 'Bihari',
  'Bislama': 'Bislama',
  'Bosanski': 'Bosnian',
  'Brezhoneg': 'Breton',
  'Български': 'Bulgarian',
  'မြန်မာဘာသာ': 'Burmese',
  'Català': 'Catalan',
  'Chamoru': 'Chamorro',
  'Нохчийн': 'Chechen',
  'Chichewa': 'Chichewa',
  '中文': 'Chinese',
  'Чӑвашла': 'Chuvash',
  'Kernewek': 'Cornish',
  'Corsu': 'Corsican',
  'ᓀᐦᐃᔭᐍᐏᐣ': 'Cree',
  'Hrvatski': 'Croatian',
  'Čeština': 'Czech',
  'Dansk': 'Danish',
  'Divehi': 'Divehi',
  'Nederlands': 'Dutch',
  'རྫོང་ཁ': 'Dzongkha',
  'English': 'English',
  'Esperanto': 'Esperanto',
  'Eesti': 'Estonian',
  'Eʋegbe': 'Ewe',
  'Føroyskt': 'Faroese',
  'Na Vosa Vaka-Viti': 'Fijian',
  'Suomi': 'Finnish',
  'Français': 'French',
  'Fulfulde': 'Fula',
  'Galego': 'Galician',
  'ქართული': 'Georgian',
  'Deutsch': 'German',
  'Ελληνικά': 'Greek',
  "Avañe'ẽ": 'Guaraní',
  'ગુજરાતી': 'Gujarati',
  'Kreyòl Ayisyen': 'Haitian',
  'هَوُسَ': 'Hausa',
  'עברית': 'Hebrew',
  'Otjiherero': 'Herero',
  'हिन्दी': 'Hindi',
  'Hiri Motu': 'Hiri Motu',
  'Magyar': 'Hungarian',
  'Interlingua': 'Interlingua',
  'Bahasa Indonesia': 'Indonesian',
  'Interlingue': 'Interlingue',
  'Gaeilge': 'Irish',
  'Igbo': 'Igbo',
  'Iñupiak': 'Inupiaq',
  'Ido': 'Ido',
  'Íslenska': 'Icelandic',
  'Italiano': 'Italian',
  'ᐃᓄᒃᑎᑐᑦ': 'Inuktitut',
  '日本語': 'Japanese',
  'Basa Jawa': 'Javanese',
  'Kalaallisut': 'Kalaallisut',
  'ಕನ್ನಡ': 'Kannada',
  'Kanuri': 'Kanuri',
  'كشميري': 'Kashmiri',
  'Қазақша': 'Kazakh',
  'ភាសាខ្មែរ': 'Khmer',
  'Gĩkũyũ': 'Kikuyu',
  'Kinyarwanda': 'Kinyarwanda',
  'Кыргызча': 'Kyrgyz',
  'Коми': 'Komi',
  'Kongo': 'Kongo',
  '한국어': 'Korean',
  'Kurdî': 'Kurdish',
  'Kuanyama': 'Kwanyama',
  'Latina': 'Latin',
  'Lëtzebuergesch': 'Luxembourgish',
  'Luganda': 'Ganda',
  'Limburgs': 'Limburgish',
  'Lingála': 'Lingala',
  'ພາສາລາວ': 'Lao',
  'Lietuvių': 'Lithuanian',
  'Tshiluba': 'Luba-Katanga',
  'Latviešu': 'Latvian',
  'Gaelg': 'Manx',
  'Македонски': 'Macedonian',
  'Malagasy': 'Malagasy',
  'Bahasa Melayu': 'Malay',
  'മലയാളം': 'Malayalam',
  'Malti': 'Maltese',
  'Māori': 'Māori',
  'मराठी': 'Marathi',
  'Kajin M̧ajeļ': 'Marshallese',
  'Монгол': 'Mongolian',
  'Dorerin Naoero': 'Nauru',
  'Diné Bizaad': 'Navajo',
  'isiNdebele': 'Southern Ndebele',
  'नेपाली': 'Nepali',
  'Owambo': 'Ndonga',
  'Norsk (Bokmål)': 'Norwegian Bokmål',
  'Norsk (Nynorsk)': 'Norwegian Nynorsk',
  'Norsk': 'Norwegian',
  'ꆈꌠ꒿ Nuosuhxop': 'Nuosu',
  'Occitan': 'Occitan',
  'ᐊᓂᔑᓈᐯᒧᐎᓐ': 'Ojibwe',
  'Словѣ́ньскъ': 'Old Church Slavonic',
  'Afaan Oromoo': 'Oromo',
  'ଓଡି଼ଆ': 'Oriya',
  'Ирон æвзаг': 'Ossetian',
  'ਪੰਜਾਬੀ': 'Panjabi',
  'पाऴि': 'Pāli',
  'فارسی': 'Persian',
  'Polski': 'Polish',
  'پښتو': 'Pashto',
  'Português': 'Portuguese',
  'Runa Simi': 'Quechua',
  'Rumantsch': 'Romansh',
  'Kirundi': 'Kirundi',
  'Română': 'Romanian',
  'Русский': 'Russian',
  'संस्कृतम्': 'Sanskrit',
  'Sardu': 'Sardinian',
  'سنڌي‎': 'Sindhi',
  'Sámegiella': 'Northern Sami',
  'Gagana Sāmoa': 'Samoan',
  'Sängö': 'Sango',
  'Српски': 'Serbian',
  'Gàidhlig': 'Gaelic',
  'ChiShona': 'Shona',
  'සිංහල': 'Sinhala',
  'Slovenčina': 'Slovak',
  'Slovenščina': 'Slovene',
  'Soomaaliga': 'Somali',
  'Sesotho': 'Southern Sotho',
  'Español': 'Spanish',
  'Basa Sunda': 'Sundanese',
  'Kiswahili': 'Swahili',
  'SiSwati': 'Swati',
  'Svenska': 'Swedish',
  'தமிழ்': 'Tamil',
  'తెలుగు': 'Telugu',
  'Тоҷикӣ': 'Tajik',
  'ภาษาไทย': 'Thai',
  'ትግርኛ': 'Tigrinya',
  'བོད་ཡིག': 'Tibetan Standard',
  'Türkmençe': 'Turkmen',
  'Tagalog': 'Tagalog',
  'Setswana': 'Tswana',
  'faka Tonga': 'Tonga',
  'Türkçe': 'Turkish',
  'Xitsonga': 'Tsonga',
  'Татарча': 'Tatar',
  'Twi': 'Twi',
  'Reo Mā’ohi': 'Tahitian',
  'ئۇيغۇرچه': 'Uyghur',
  'Українська': 'Ukrainian',
  'اردو': 'Urdu',
  'O‘zbek': 'Uzbek',
  'Tshivenḓa': 'Venda',
  'Tiếng Việt': 'Vietnamese',
  'Volapük': 'Volapük',
  'Walon': 'Walloon',
  'Cymraeg': 'Welsh',
  'Wolof': 'Wolof',
  'Frysk': 'Western Frisian',
  'isiXhosa': 'Xhosa',
  'ייִדיש': 'Yiddish',
  'Yorùbá': 'Yoruba',
  'Cuengh': 'Zhuang',
  'isiZulu': 'Zulu'
};

const countries = {
  "af": "Afghanistan",
  "ax": "Åland Islands",
  "al": "Albania",
  "dz": "Algeria",
  "as": "American Samoa",
  "ad": "Andorra",
  "ao": "Angola",
  "ai": "Anguilla",
  "aq": "Antarctica",
  "ag": "Antigua and Barbuda",
  "ar": "Argentina",
  "am": "Armenia",
  "aw": "Aruba",
  "au": "Australia",
  "at": "Austria",
  "az": "Azerbaijan",
  "bs": "Bahamas",
  "bh": "Bahrain",
  "bd": "Bangladesh",
  "bb": "Barbados",
  "by": "Belarus",
  "be": "Belgium",
  "bz": "Belize",
  "bj": "Benin",
  "bm": "Bermuda",
  "bt": "Bhutan",
  "bo": "Bolivia, Plurinational State of",
  "bq": "Bonaire, Sint Eustatius and Saba",
  "ba": "Bosnia and Herzegovina",
  "bw": "Botswana",
  "bv": "Bouvet Island",
  "br": "Brazil",
  "io": "British Indian Ocean Territory",
  "bn": "Brunei Darussalam",
  "bg": "Bulgaria",
  "bf": "Burkina Faso",
  "bi": "Burundi",
  "cv": "Cabo Verde",
  "kh": "Cambodia",
  "cm": "Cameroon",
  "ca": "Canada",
  "ky": "Cayman Islands",
  "cf": "Central African Republic",
  "td": "Chad",
  "cl": "Chile",
  "cn": "China",
  "cx": "Christmas Island",
  "cc": "Cocos (Keeling) Islands",
  "co": "Colombia",
  "km": "Comoros",
  "cg": "Congo",
  "cd": "Congo, Democratic Republic of the",
  "ck": "Cook Islands",
  "cr": "Costa Rica",
  "hr": "Croatia",
  "cu": "Cuba",
  "cw": "Curaçao",
  "cy": "Cyprus",
  "cz": "Czechia",
  "ci": "Côte d'Ivoire",
  "dk": "Denmark",
  "dj": "Djibouti",
  "dm": "Dominica",
  "do": "Dominican Republic",
  "ec": "Ecuador",
  "eg": "Egypt",
  "sv": "El Salvador",
  "gq": "Equatorial Guinea",
  "er": "Eritrea",
  "ee": "Estonia",
  "sz": "Eswatini",
  "et": "Ethiopia",
  "fk": "Falkland Islands (Malvinas)",
  "fo": "Faroe Islands",
  "fj": "Fiji",
  "fi": "Finland",
  "fr": "France",
  "gf": "French Guiana",
  "pf": "French Polynesia",
  "tf": "French Southern Territories",
  "ga": "Gabon",
  "gm": "Gambia",
  "ge": "Georgia",
  "de": "Germany",
  "gh": "Ghana",
  "gi": "Gibraltar",
  "gr": "Greece",
  "gl": "Greenland",
  "gd": "Grenada",
  "gp": "Guadeloupe",
  "gu": "Guam",
  "gt": "Guatemala",
  "gg": "Guernsey",
  "gn": "Guinea",
  "gw": "Guinea-Bissau",
  "gy": "Guyana",
  "ht": "Haiti",
  "hm": "Heard Island and McDonald Islands",
  "va": "Holy See",
  "hn": "Honduras",
  "hk": "Hong Kong",
  "hu": "Hungary",
  "is": "Iceland",
  "in": "India",
  "id": "Indonesia",
  "ir": "Iran, Islamic Republic of",
  "iq": "Iraq",
  "ie": "Ireland",
  "im": "Isle of Man",
  "il": "Israel",
  "it": "Italy",
  "jm": "Jamaica",
  "jp": "Japan",
  "je": "Jersey",
  "jo": "Jordan",
  "kz": "Kazakhstan",
  "ke": "Kenya",
  "ki": "Kiribati",
  "kp": "Korea, Democratic People's Republic of",
  "kr": "Korea, Republic of",
  "kw": "Kuwait",
  "kg": "Kyrgyzstan",
  "la": "Lao People's Democratic Republic",
  "lv": "Latvia",
  "lb": "Lebanon",
  "ls": "Lesotho",
  "lr": "Liberia",
  "ly": "Libya",
  "li": "Liechtenstein",
  "lt": "Lithuania",
  "lu": "Luxembourg",
  "mo": "Macao",
  "mg": "Madagascar",
  "mw": "Malawi",
  "my": "Malaysia",
  "mv": "Maldives",
  "ml": "Mali",
  "mt": "Malta",
  "mh": "Marshall Islands",
  "mq": "Martinique",
  "mr": "Mauritania",
  "mu": "Mauritius",
  "yt": "Mayotte",
  "mx": "Mexico",
  "fm": "Micronesia, Federated States of",
  "md": "Moldova, Republic of",
  "mc": "Monaco",
  "mn": "Mongolia",
  "me": "Montenegro",
  "ms": "Montserrat",
  "ma": "Morocco",
  "mz": "Mozambique",
  "mm": "Myanmar",
  "na": "Namibia",
  "nr": "Nauru",
  "np": "Nepal",
  "nl": "Netherlands",
  "nc": "New Caledonia",
  "nz": "New Zealand",
  "ni": "Nicaragua",
  "ne": "Niger",
  "ng": "Nigeria",
  "nu": "Niue",
  "nf": "Norfolk Island",
  "mk": "North Macedonia",
  "mp": "Northern Mariana Islands",
  "no": "Norway",
  "om": "Oman",
  "pk": "Pakistan",
  "pw": "Palau",
  "ps": "Palestine, State of",
  "pa": "Panama",
  "pg": "Papua New Guinea",
  "py": "Paraguay",
  "pe": "Peru",
  "ph": "Philippines",
  "pn": "Pitcairn",
  "pl": "Poland",
  "pt": "Portugal",
  "pr": "Puerto Rico",
  "qa": "Qatar",
  "ro": "Romania",
  "ru": "Russian Federation",
  "rw": "Rwanda",
  "re": "Réunion",
  "bl": "Saint Barthélemy",
  "sh": "Saint Helena, Ascension and Tristan da Cunha",
  "kn": "Saint Kitts and Nevis",
  "lc": "Saint Lucia",
  "mf": "Saint Martin (French part)",
  "pm": "Saint Pierre and Miquelon",
  "vc": "Saint Vincent and the Grenadines",
  "ws": "Samoa",
  "sm": "San Marino",
  "st": "Sao Tome and Principe",
  "sa": "Saudi Arabia",
  "sn": "Senegal",
  "rs": "Serbia",
  "sc": "Seychelles",
  "sl": "Sierra Leone",
  "sg": "Singapore",
  "sx": "Sint Maarten (Dutch part)",
  "sk": "Slovakia",
  "si": "Slovenia",
  "sb": "Solomon Islands",
  "so": "Somalia",
  "za": "South Africa",
  "gs": "South Georgia and the South Sandwich Islands",
  "ss": "South Sudan",
  "es": "Spain",
  "lk": "Sri Lanka",
  "sd": "Sudan",
  "sr": "Suriname",
  "sj": "Svalbard and Jan Mayen",
  "se": "Sweden",
  "ch": "Switzerland",
  "sy": "Syrian Arab Republic",
  "tw": "Taiwan, Province of China",
  "tj": "Tajikistan",
  "tz": "Tanzania, United Republic of",
  "th": "Thailand",
  "tl": "Timor-Leste",
  "tg": "Togo",
  "tk": "Tokelau",
  "to": "Tonga",
  "tt": "Trinidad and Tobago",
  "tn": "Tunisia",
  "tr": "Turkey",
  "tm": "Turkmenistan",
  "tc": "Turks and Caicos Islands",
  "tv": "Tuvalu",
  "ug": "Uganda",
  "ua": "Ukraine",
  "ae": "United Arab Emirates",
  "gb": "United Kingdom",
  "um": "United States Minor Outlying Islands",
  "us": "United States",
  "uy": "Uruguay",
  "uz": "Uzbekistan",
  "vu": "Vanuatu",
  "ve": "Venezuela, Bolivarian Republic of",
  "vn": "Viet Nam",
  "vg": "Virgin Islands, British",
  "vi": "Virgin Islands, U.S.",
  "wf": "Wallis and Futuna",
  "eh": "Western Sahara",
  "ye": "Yemen",
  "zm": "Zambia",
  "zw": "Zimbabwe"
};

const engagementTypes = {
  "hourly": 'hourly',
  "project": 'project',
  "monthly": 'monthly',
  "custom": 'custom',
};

const skillsForFixedPrompts = {
  "video editor and animator": [
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Video editing",
        "name": "Video editing",
        "sourceName": "fiverr"
      },
      "itemId": "design_Video editing"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Animation",
        "name": "Animation",
        "sourceName": "fiverr"
      },
      "itemId": "design_Animation"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Marketing",
        "name": "Marketing",
        "sourceName": "fiverr"
      },
      "itemId": "design_Marketing"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Editing",
        "name": "Editing",
        "sourceName": "fiverr"
      },
      "itemId": "design_Editing"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Storytelling",
        "name": "Storytelling",
        "sourceName": "fiverr"
      },
      "itemId": "design_Storytelling"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Adobe After Effects",
        "name": "Adobe After Effects",
        "sourceName": "fiverr"
      },
      "itemId": "design_Adobe After Effects"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Adobe Premiere Pro",
        "name": "Adobe Premiere Pro",
        "sourceName": "fiverr"
      },
      "itemId": "design_Adobe Premiere Pro"
    }
  ],
  "react and javascript expert": [
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "javascript",
        "name": "JavaScript",
        "sourceName": "fiverr"
      },
      "itemId": "engineer_javascript"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "web applications",
        "name": "Web Applications",
        "sourceName": "fiverr"
      },
      "itemId": "engineer_web applications"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "software development",
        "name": "Software Development",
        "sourceName": "fiverr"
      },
      "itemId": "engineer_software development"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "programming",
        "name": "Programming",
        "sourceName": "fiverr"
      },
      "itemId": "engineer_programming"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "git",
        "name": "Git",
        "sourceName": "fiverr"
      },
      "itemId": "engineer_git"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "testing",
        "name": "Testing",
        "sourceName": "fiverr"
      },
      "itemId": "engineer_testing"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "software quality assurance",
        "name": "Software Quality Assurance",
        "sourceName": "fiverr"
      },
      "itemId": "engineer_software quality assurance"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "manual testing",
        "name": "Manual Testing",
        "sourceName": "fiverr"
      },
      "itemId": "engineer_manual testing"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "selenium",
        "name": "Selenium",
        "sourceName": "fiverr"
      },
      "itemId": "engineer_selenium"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "integration testing",
        "name": "Integration Testing",
        "sourceName": "fiverr"
      },
      "itemId": "engineer_integration testing"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "front-end development",
        "name": "Front-end Development",
        "sourceName": "fiverr"
      },
      "itemId": "engineer_front-end development"
    }
  ],
  "project manager": [
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Process improvement",
        "name": "Process improvement",
        "sourceName": "fiverr"
      },
      "itemId": "operation_Process improvement"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Project management",
        "name": "Project management",
        "sourceName": "fiverr"
      },
      "itemId": "operation_Project management"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Time management",
        "name": "Time management",
        "sourceName": "fiverr"
      },
      "itemId": "operation_Time management"
    },
    {
      "itemStatus": "active",
      "itemData": {
          "sourceId": "leadership",
          "name": "leadership",
          "sourceName": "fiverr"
      },
      "itemId": "operation_leadership"
  },
  {
      "itemStatus": "active",
      "itemData": {
          "sourceId": "communication",
          "name": "communication",
          "sourceName": "fiverr"
      },
      "itemId": "operation_communication"
  },
  {
      "itemStatus": "active",
      "itemData": {
          "sourceId": "problem-solving",
          "name": "problem-solving",
          "sourceName": "fiverr"
      },
      "itemId": "operation_problem-solving"
  }
  ],
  "social media marketing expert": [
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "marketing strategy",
        "name": "Marketing Strategy",
        "sourceName": "fiverr"
      },
      "itemId": "marketing_marketing strategy"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "social media advertising",
        "name": "Social Media Advertising",
        "sourceName": "fiverr"
      },
      "itemId": "marketing_social media advertising"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "marketing advice",
        "name": "Marketing Advice",
        "sourceName": "fiverr"
      },
      "itemId": "marketing_marketing advice"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "business consulting",
        "name": "Business Consulting",
        "sourceName": "fiverr"
      },
      "itemId": "marketing_business consulting"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "consulting",
        "name": "Consulting",
        "sourceName": "fiverr"
      },
      "itemId": "marketing_consulting"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "social media copy",
        "name": "Social Media Copy",
        "sourceName": "fiverr"
      },
      "itemId": "marketing_social media copy"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "ad copy",
        "name": "Ad Copy",
        "sourceName": "fiverr"
      },
      "itemId": "marketing_ad copy"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "email copy",
        "name": "Email Copy",
        "sourceName": "fiverr"
      },
      "itemId": "marketing_email copy"
    }
  ],
  "i need someone to write me a blog post": [
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "SEO",
        "name": "SEO",
        "sourceName": "fiverr"
      },
      "itemId": "marketing_SEO"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Writing",
        "name": "Writing",
        "sourceName": "fiverr"
      },
      "itemId": "marketing_Writing"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Storytelling",
        "name": "Storytelling",
        "sourceName": "fiverr"
      },
      "itemId": "marketing_Storytelling"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "research",
        "name": "Research",
        "sourceName": "fiverr"
      },
      "itemId": "engineer_research"
    },
    {
      "itemStatus": "active",
      "itemData": {
        "sourceId": "Editing",
        "name": "Editing",
        "sourceName": "fiverr"
      },
      "itemId": "marketing_Editing"
    }
  ]
}

const Tokens = {
  MAX: 4096,
  MIN: 1,
  ADD_100: 100
};


module.exports = {
  languages,
  countries,
  engagementTypes,
  skillsForFixedPrompts,
  Tokens
};
