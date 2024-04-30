/* eslint-disable no-return-assign */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-magic-numbers */

'use strict';

const { jsonLogger, responseLib } = require('stoke-app-common-api');

const { createCsv } = require('../helpers/csvReport/createCsv')

const handler = async (event) => {
    jsonLogger.info({ type: "TRACKING", function: "createCsvReport::handler", event });
    const userId = event.requestContext.identity.cognitoIdentityId;
    const data = JSON.parse(event.body);
    try {
        const { url } = await createCsv(userId, data)
        return responseLib.success(url);
    } catch (error) {
        const body = { message: error.message }
        return error.statusCode === 403 ? responseLib.forbidden(body) : responseLib.failure(body);
    }
    
};

module.exports = {
    handler
}
