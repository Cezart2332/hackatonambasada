import type { NextFunction, Request, Response } from "express";
import { logUnipileWebhook, verifyUnipileWebhook } from "./unipile.webhook.js";
import { unipileService } from "./unipile.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { ConnectBody, SendMessageBody } from "./unipile.types.js";

export async function getUnipileStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Trebuie să fii conectat.", 401, "UNAUTHORIZED");
    }
    const result = await unipileService.listIntegrations(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function connectUnipile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Trebuie să fii conectat.", 401, "UNAUTHORIZED");
    }
    const body = req.body as ConnectBody;
    const result = await unipileService.connectAccount(req.user.id, body.provider);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function sendUnipileMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as SendMessageBody;
    const result = await unipileService.sendMessage(body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleUnipileWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!verifyUnipileWebhook(req)) {
      throw new AppError("Semnătură webhook invalidă.", 401, "WEBHOOK_SIGNATURE_INVALID");
    }

    logUnipileWebhook(req);
    const result = await unipileService.handleWebhook(req.body, req.headers);
    res.status(200).json({ received: true, ...result });
  } catch (error) {
    next(error);
  }
}
