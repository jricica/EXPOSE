// backend/src/controllers/health.controller.ts
import { checkDatabase, checkApp } from "../services/health.service";
import { Request, Response } from "express";

export const healthCheck = async (_req: Request, res: Response) => {
  const db = await checkDatabase();
  const app = checkApp();

  const status = db && app ? "ok" : "error";

  res.status(status === "ok" ? 200 : 503).json({
    status,
    checks: {
      app,
      database: db
    },
    timestamp: new Date().toISOString()
  });
};