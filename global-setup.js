/* eslint-disable import/no-extraneous-dependencies */
const setTZ = require('set-tz');

module.exports = () => {
  setTZ('UTC');
};
