import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";
import { AppError } from "../errors/AppError.js";

export async function requireSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    next(new AppError("Trebuie să fii conectat.", 401, "UNAUTHORIZED"));
    return;
  }

  req.user = {
    ...session.user,
    image: session.user.image ?? null,
  };
  req.session = session.session;
  next();
}