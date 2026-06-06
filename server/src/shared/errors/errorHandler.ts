import type { NextFunction, Request, Response } from "express";
import { AppError } from "./AppError.js";

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
        code: error.code,
      },
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: {
      message: "Ceva nu a mers pe server. Încearcă din nou.",
      code: "INTERNAL_SERVER_ERROR",
    },
  });
}