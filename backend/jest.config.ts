module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
  
    setupFilesAfterEnv: [
      '<rootDir>/tests/setup.integration.ts',
      '<rootDir>/tests/teardown.integration.ts'
    ],
  
    testMatch: ['**/*.integration.test.ts'],
  };