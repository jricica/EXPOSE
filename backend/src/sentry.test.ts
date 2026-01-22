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
