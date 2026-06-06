import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "../errors/AppError.js";

type RequestPart = "body" | "query" | "params";

export function validate<T>(schema: ZodSchema<T>, part: RequestPart = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(
        new AppError(
          result.error.errors.map((item) => item.message).join("; "),
          422,
          "VALIDATION_ERROR",
        ),
      );
      return;
    }

    if (part === "body") {
      req.body = result.data;
    } else {
      req.validated ??= {};
      req.validated[part] = result.data;
    }
    next();
  };
}