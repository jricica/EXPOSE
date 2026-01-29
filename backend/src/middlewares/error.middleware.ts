import { Request, Response, NextFunction } from "express";

export default function errorHandler(
  err: any,
  _req: Request,
  _res: Response,
  _next: NextFunction
) {
  const message = err instanceof Error ? err.message : "Unexpected error";
  const status =
    err?.statusCode ??
    err?.status ??
    (message === "Invalid credentials" ? 401 : 500);

  _res.status(status).json({
    success: false,
    message,
    data: null,
  });
}
