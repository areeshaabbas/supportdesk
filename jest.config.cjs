module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.cjs"],
  transform: { "^.+\\.ts$": "<rootDir>/tests/transform.cjs" },
  testTimeout: 15000,
};
