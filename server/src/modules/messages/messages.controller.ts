import type { Request, Response } from "express";
import * as messagesService from "./messages.service.js";
import type {
  ListMessagesQuery,
  OpenConversationInput,
  SendMessageInput,
} from "./messages.schema.js";

function paramId(req: Request): string {
  const value = req.params.id;
  return Array.isArray(value) ? value[0] : value;
}

export async function listConversations(req: Request, res: Response): Promise<void> {
  const conversations = await messagesService.listConversations(req.user!);
  res.json({ conversations });
}

export async function openConversation(req: Request, res: Response): Promise<void> {
  const { counterpartUserId } = req.body as OpenConversationInput;
  const conversation = await messagesService.openConversation(req.user!, counterpartUserId);
  res.json({ conversation });
}

export async function listMessages(req: Request, res: Response): Promise<void> {
  const conversationId = paramId(req);
  const query = req.query as ListMessagesQuery;
  const result = await messagesService.listConversationMessages(req.user!, conversationId, {
    limit: query.limit,
    before: query.before,
  });
  res.json(result);
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const conversationId = paramId(req);
  const { body } = req.body as SendMessageInput;
  const message = await messagesService.sendMessage(req.user!, conversationId, body);
  res.json({ message });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const conversationId = paramId(req);
  const result = await messagesService.markConversationRead(req.user!, conversationId);
  res.json(result);
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const result = await messagesService.getUnreadCount(req.user!);
  res.json(result);
}
