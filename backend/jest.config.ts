module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
  
    setupFilesAfterEnv: [
      '<rootDir>/tests/setup.integration.ts',
      '<rootDir>/tests/teardown.integration.ts',
      '<rootDir>/tests/dynamo.setup.ts',
      '<rootDir>/tests/dynamo.teardown.ts'
    ],
  
    testMatch: ['**/*.integration.test.ts'],
  };