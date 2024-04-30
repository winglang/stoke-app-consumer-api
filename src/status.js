/* eslint-disable no-console */

'use strict';

const { dynamoDbLib, responseLib } = require('stoke-app-common-api');

// eslint-disable-next-line no-unused-vars
module.exports.healthCheck = async (event, context) => {
  const params = {
    
    TableName: process.env.consumerAuthTableName,
  };
  try {
    const result = await dynamoDbLib.call("describeTable", params);
    if (result.Table.TableStatus) {
      // return the retrieved item
      return responseLib.success(result.Table.TableStatus);
    }    
  } catch (e) {
    console.log(e);
  }
  return responseLib.failure({ status: false });
}


