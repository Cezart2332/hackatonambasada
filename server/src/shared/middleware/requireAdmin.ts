import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.accountType !== "ADMIN") {
    next(new AppError("Acces permis doar administratorilor.", 403, "FORBIDDEN"));
    return;
  }

  next();
}
