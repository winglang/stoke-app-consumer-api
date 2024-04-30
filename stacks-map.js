'use strict';

// eslint-disable-next-line no-unused-vars
module.exports = (resource, logicalId) => {

    if (resource.Type === 'AWS::ApiGateway::Method') {
        return { destination: 'API' };
    }
    
    if (resource.Type === 'AWS::Logs::LogGroup') {
        return { destination: 'Logs' };
    }

    // falls back to default
    return null;
};
