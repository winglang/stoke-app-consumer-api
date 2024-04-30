'use strict';
    
const src_middleware_authorize = require('../src/middleware/authorize.js');
const src_companies = require('../src/companies.js');

module.exports.handler = async (event, context) => {
  let end = false;
  context.end = () => end = true;

  const wrappedHandler = handler => prev => {
    if (end) return prev;
    context.prev = prev;
    return handler(event, context);
  };

  return Promise.resolve()
    .then(wrappedHandler(src_middleware_authorize.handler.bind(src_middleware_authorize)))
    .then(wrappedHandler(src_companies.addUserToCompany.bind(src_companies)));
};