import { z } from "zod";

export const openConversationSchema = z.object({
  counterpartUserId: z.string().min(1),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: z.string().optional(),
});

export type OpenConversationInput = z.infer<typeof openConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
