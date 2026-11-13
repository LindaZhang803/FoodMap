const path = require("path");

const base = require(
  "../../src/modules/feed/jest.host.config.cjs"
);

module.exports = {
  ...base,

  rootDir: path.resolve(__dirname, "../.."),

  testMatch: [
    "<rootDir>/test/frontend/*.test.js",
  ],

  // Store Jest cache inside the Mobile project.
  cacheDirectory: path.resolve(
    __dirname,
    "../../node_modules/.cache/jest-frontend"
  ),
};