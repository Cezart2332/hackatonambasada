import { Router } from "express";
import { requireSession } from "../../shared/middleware/requireSession.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  listMessagesQuerySchema,
  openConversationSchema,
  sendMessageSchema,
} from "./messages.schema.js";
import * as controller from "./messages.controller.js";

export const messagesRouter = Router();

messagesRouter.use(requireSession);

messagesRouter.get("/unread-count", controller.getUnreadCount);
messagesRouter.get("/conversations", controller.listConversations);
messagesRouter.post("/conversations", validate(openConversationSchema), controller.openConversation);
messagesRouter.get(
  "/conversations/:id",
  validate(listMessagesQuerySchema, "query"),
  controller.listMessages,
);
messagesRouter.post(
  "/conversations/:id/messages",
  validate(sendMessageSchema),
  controller.sendMessage,
);
messagesRouter.patch("/conversations/:id/read", controller.markRead);
