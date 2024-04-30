'use strict'

const _ = require('lodash');
const { encode } = require('gpt-3-encoder');
const { jsonLogger, ssmLib, SettingsService, constants } = require("stoke-app-common-api");
const { Tokens } = require('./aiConstants');

const getAiService = async (companyId, isDisabledAzureServers) => {
    let isOpenAiInProdMode = false;
    if (process.env.stage === 'dev') {
        const settingsService = new SettingsService(process.env.settingsTableName, constants.projectionExpression.defaultAttributes, constants.attributeNames.defaultAttributes);
        const companySetting = await settingsService.get(`${constants.prefix.company}${companyId}`);
        isOpenAiInProdMode = _.get(companySetting, 'itemData.isOpenAiInProdMode', false);
    }

    let openaiSsmPath = `openai/apiKey`;
    let azureSsmPath = `openai/apiKeyAzure`;
    if (isOpenAiInProdMode) {
        jsonLogger.info({ type: 'TRACKING', function: 'aiServiceHelper::getAiService', msg: `this function runs in dev stage but company: ${companyId} allowed to use prod mode by this key isOpenAiInProdMode in the settings table` });
        openaiSsmPath = `openai/apiKeyPMode`;
        azureSsmPath = `openai/apiKeyPModeAzure`;
    }
    const [OPENAI_API_KEY, AZURE_OPENAI_API_KEY] = await ssmLib.getParametersFromSSM([openaiSsmPath, azureSsmPath]);
    if (!OPENAI_API_KEY) {
        jsonLogger.info({ type: 'TRACKING', function: 'aiServiceHelper::getAiService', msg: 'open ai api-key is missing' });
        return;
    }
    if (!AZURE_OPENAI_API_KEY) {
        jsonLogger.info({ type: 'TRACKING', function: 'aiServiceHelper::getAiService', msg: 'azure open ai api-key is missing' });
        return;
    }
    // eslint-disable-next-line global-require
    const { AIService } = require("stoke-ai");
    const aiService = new AIService(OPENAI_API_KEY, AZURE_OPENAI_API_KEY, isDisabledAzureServers);
    // eslint-disable-next-line consistent-return
    return aiService;
};

// using gpt-3-encoder (the equivalent of tiktoken, the python tokens estimator tool of openai) for estimating the number of tokens in a text
const getEstimatedTokensCountOfText = (text) => {
    const encoded = encode(text);
    const characters = text.length;
    const tokens = encoded.length;
    const textInfo = { characters, tokens };
    jsonLogger.info({ type: "TRACKING", function: "aiServiceHelper::getEstimatedTokensCountOfText", textInfo });
    return textInfo;
}

// eslint-disable-next-line no-magic-numbers
const roundToNext100 = (number) => Math.ceil(number * 0.01) * 100;

const removeConsecutiveSpacesFromPrompt = (prompt) => { 
    let jsonString = prompt;
    if (!_.isString(prompt)) {
        jsonString = JSON.stringify(prompt);
    }
    return jsonString.replace(/\s+/gu, ' ');
}

const getPromptAndMaxTokens = (prompt) => {
    const promptString = removeConsecutiveSpacesFromPrompt(prompt);
    const { tokens } = getEstimatedTokensCountOfText(promptString);
    const maxTokens = _.clamp(roundToNext100(tokens) + Tokens.ADD_100, Tokens.MIN, Tokens.MAX);
    return [JSON.parse(promptString), maxTokens];
}

module.exports = {
    getAiService,
    getEstimatedTokensCountOfText,
    roundToNext100,
    getPromptAndMaxTokens
}
