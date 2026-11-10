module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/migrations/**', '!src/seeders/**'],
};
