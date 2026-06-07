import { Router } from "express";
import { requireSession } from "../../shared/middleware/requireSession.js";
import { requireInternalToken } from "../../shared/middleware/requireInternalToken.js";
import { validate } from "../../shared/middleware/validate.js";
import { connectBodySchema, sendMessageBodySchema } from "./unipile.types.js";
import {
  connectUnipile,
  getUnipileStatus,
  handleUnipileWebhook,
  sendUnipileMessage,
} from "./unipile.controller.js";

export const integrationsRouter = Router();

integrationsRouter.get("/status", requireSession, getUnipileStatus);

integrationsRouter.post(
  "/connect",
  requireSession,
  validate(connectBodySchema),
  connectUnipile,
);

integrationsRouter.post(
  "/send",
  requireInternalToken,
  validate(sendMessageBodySchema),
  sendUnipileMessage,
);

export const webhookRouter = Router();

webhookRouter.post("/unipile", handleUnipileWebhook);
