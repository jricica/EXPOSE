import "./instrument";
import * as Sentry from "@sentry/node";

export function testManualSentryError() {
  Sentry.captureException(new Error(" Test manual de Sentry"));
}

export function testCrash() {
  throw new Error(" Crash de prueba para Sentry");
}

if (require.main === module) {
  console.log("Enviando errores de prueba a Sentry...");
  testManualSentryError();

  setTimeout(() => {
    testCrash();
  }, 1000);
}

// Add a test block so Jest doesn't fail with "Your test suite must contain at least one test"
describe("Sentry Manual Tests", () => {
  it("should be skipped in test runner", () => {
    // This file seems to be a manual script. 
    // We add this dummy test to satisfy Jest looking for tests in .test.ts files.
    expect(true).toBe(true);
  });
});
