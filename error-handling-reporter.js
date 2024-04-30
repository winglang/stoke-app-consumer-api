"use strict";

/* eslint-disable no-magic-numbers */

/**
 * this class is workaround for bug in serverless-jest-plugin
 * See https://github.com/SC5/serverless-jest-plugin/issues/9 
 */
class ErrorHandlingReporter {
  constructor (globalConfig, options) {
    // eslint-disable-next-line no-underscore-dangle
    this._globalConfig = globalConfig;
    // eslint-disable-next-line no-underscore-dangle
    this._options = options;
  }

  static onRunComplete (contexts, results) {
    if (results.numFailedTests) {
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }
  }
}

module.exports = ErrorHandlingReporter;
