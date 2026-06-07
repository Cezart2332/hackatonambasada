import { z } from "zod";
import type { IntegrationProvider, IntegrationStatus } from "@prisma/client";

export const providerSchema = z.enum(["whatsapp", "gmail"]);
export type UnipileProvider = z.infer<typeof providerSchema>;

export const channelSchema = z.enum(["whatsapp", "email"]);
export type UnipileChannel = z.infer<typeof channelSchema>;

export const outreachModeSchema = z.enum(["draft", "send"]);
export type OutreachMode = z.infer<typeof outreachModeSchema>;

export const connectBodySchema = z.object({
  provider: providerSchema,
});

export const sendMessageBodySchema = z.object({
  userId: z.string().min(1),
  channel: channelSchema,
  recipient: z.string().min(1),
  subject: z.string().optional(),
  message: z.string().min(1),
});

export type ConnectBody = z.infer<typeof connectBodySchema>;
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;

export type UnipileAccount = {
  id: string;
  type?: string;
  provider?: string;
  name?: string;
  status?: string;
};

export type UnipileWebhookPayload = {
  event?: string;
  type?: string;
  status?: string;
  account_id?: string;
  accountId?: string;
  provider?: string;
  name?: string;
  state?: string;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

export function providerToIntegrationProvider(provider: UnipileProvider): IntegrationProvider {
  return provider === "whatsapp" ? "WHATSAPP" : "GMAIL";
}

export function channelToIntegrationProvider(channel: UnipileChannel): IntegrationProvider {
  return channel === "whatsapp" ? "WHATSAPP" : "GMAIL";
}

export function integrationProviderToChannel(provider: IntegrationProvider): UnipileChannel {
  return provider === "WHATSAPP" ? "whatsapp" : "email";
}

export function unipileProviderType(provider: UnipileProvider): string {
  return provider === "whatsapp" ? "WHATSAPP" : "GOOGLE";
}

export function isConnectedStatus(status: IntegrationStatus): boolean {
  return status === "CONNECTED";
}

export function normalizeWebhookEvent(payload: UnipileWebhookPayload): {
  event: string;
  accountId: string;
  providerHint: string;
  userId: string;
  statusHint: string;
} {
  const nested = payload.data && typeof payload.data === "object" ? payload.data : {};
  const accountId = String(
    payload.account_id ??
      payload.accountId ??
      nested.account_id ??
      nested.accountId ??
      "",
  ).trim();
  const event = String(payload.event ?? payload.type ?? nested.event ?? nested.type ?? "").trim();
  const providerHint = String(
    payload.provider ?? nested.provider ?? nested.type ?? "",
  ).trim();
  const userId = String(
    payload.state ??
      payload.name ??
      nested.state ??
      nested.name ??
      (payload.metadata?.userId as string | undefined) ??
      (nested.metadata as Record<string, unknown> | undefined)?.userId ??
      "",
  ).trim();
  const statusHint = String(payload.status ?? nested.status ?? "").trim();
  return { event, accountId, providerHint, userId, statusHint };
}
