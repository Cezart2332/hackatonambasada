import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";

export function requireInternalToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const expected = process.env.INTERNAL_API_TOKEN?.trim();
  if (!expected) {
    next(
      new AppError(
        "INTERNAL_API_TOKEN nu este configurat pe server.",
        503,
        "INTERNAL_MISCONFIGURED",
      ),
    );
    return;
  }

  const provided = req.headers["x-internal-token"];
  if (!provided || Array.isArray(provided) || provided !== expected) {
    next(new AppError("Token intern invalid.", 401, "UNAUTHORIZED"));
    return;
  }

  next();
}
