/** @type {import("jest").Config} **/
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^@enums$': '<rootDir>/src/enums/index.ts',
    '^@entities$': '<rootDir>/src/entities/index.ts',
    '^@interfaces$': '<rootDir>/src/interfaces/index.ts',
    '^@models$': '<rootDir>/src/models/index.ts',
  },
}
