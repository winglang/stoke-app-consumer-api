'use strict';

// eslint-disable-next-line require-await
exports.setEnv = async (env) => {
  process.env = {
    ...process.env,
    ...env
  };
};
