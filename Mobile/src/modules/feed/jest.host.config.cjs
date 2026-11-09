const path = require('path');
const mobileRoot = path.resolve(__dirname, '../../..');
module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['<rootDir>/tests/feedNavigation.host.js'],
  moduleNameMapper: {
    '^react$': path.join(mobileRoot, 'node_modules/react'),
    '^react/(.*)$': path.join(mobileRoot, 'node_modules/react/$1'),
    '^react-native$': path.join(mobileRoot, 'node_modules/react-native'),
    '^react-native/(.*)$': path.join(mobileRoot, 'node_modules/react-native/$1'),
  },
};
