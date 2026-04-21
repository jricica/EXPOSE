// backend/src/services/health.service.ts
import { prisma } from "../lib/prisma"; // o tu ORM // AWS SDK para S3

export const checkDatabase = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

export const checkApp = () => {
  return true; // proceso vivo si llegó aquí
};