import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://46a5b92063fd5cb777eb8eea33f9fb4b@o4510751779192832.ingest.us.sentry.io/4510751781158912",
  sendDefaultPii: true,
    environment: process.env.SENTRY_ENVIRONMENT || "development",
});
