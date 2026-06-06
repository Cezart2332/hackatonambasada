import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";
import { AppError } from "../errors/AppError.js";
import { prisma } from "../prisma.js";

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

  req.user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
  });
  req.session = session.session;
  next();
}