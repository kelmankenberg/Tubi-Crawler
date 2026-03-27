/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'app/**/*.js',
    '!app/main.js',
    '!app/renderer.js',
    '!app/preload.js',
    '!app/browser-preload.js',
    '!app/browser.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
