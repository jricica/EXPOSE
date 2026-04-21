// backend/src/utils/logger.ts
import pino from "pino";

export const logger = pino({
  level: "info"
});