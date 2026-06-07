import { AppError } from "../../shared/errors/AppError.js";
import type { IntegrationProvider } from "@prisma/client";
import { unipileClient } from "./unipile.client.js";
import * as repo from "./unipile.repository.js";
import {
  channelToIntegrationProvider,
  integrationProviderToChannel,
  isConnectedStatus,
  normalizeWebhookEvent,
  providerToIntegrationProvider,
  type UnipileChannel,
  type UnipileProvider,
  type UnipileWebhookPayload,
} from "./unipile.types.js";

function inferProviderFromHint(hint: string): IntegrationProvider | null {
  const normalized = hint.toUpperCase();
  if (normalized.includes("WHATSAPP")) return "WHATSAPP";
  if (
    normalized.includes("GOOGLE") ||
    normalized.includes("GMAIL") ||
    normalized.includes("MAIL")
  ) {
    return "GMAIL";
  }
  return null;
}

function isConnectedEvent(event: string, statusHint: string): boolean {
  const blob = `${event} ${statusHint}`.toLowerCase();
  return (
    blob.includes("connect") ||
    blob.includes("connected") ||
    blob.includes("creation_success") ||
    blob.includes("active") ||
    blob.includes("sync_success")
  );
}

function isDisconnectedEvent(event: string, statusHint: string): boolean {
  const blob = `${event} ${statusHint}`.toLowerCase();
  return (
    blob.includes("disconnect") ||
    blob.includes("disconnected") ||
    blob.includes("deleted") ||
    blob.includes("removed")
  );
}

function isErrorEvent(event: string, statusHint: string): boolean {
  const blob = `${event} ${statusHint}`.toLowerCase();
  return blob.includes("error") || blob.includes("fail") || blob.includes("failed");
}

function defaultEmailSubject(leadHint?: string): string {
  return leadHint
    ? `Propunere colaborare B2B — ${leadHint}`
    : "Propunere colaborare B2B — produse locale din Dobrogea";
}

function unwrapWebhookPayload(payload: unknown): UnipileWebhookPayload {
  if (!payload || typeof payload !== "object") {
    return {};
  }
  const body = payload as Record<string, unknown>;
  if (body.AccountStatus && typeof body.AccountStatus === "object") {
    const status = body.AccountStatus as Record<string, unknown>;
    return {
      account_id: String(status.account_id ?? status.accountId ?? ""),
      status: String(status.message ?? status.status ?? ""),
      provider: String(status.account_type ?? status.accountType ?? ""),
      name: String(status.name ?? ""),
    };
  }
  return body as UnipileWebhookPayload;
}

function accountProvider(account: Record<string, unknown>): IntegrationProvider | null {
  const type = String(account.type ?? account.provider ?? "").toUpperCase();
  if (type === "WHATSAPP") return "WHATSAPP";
  if (type.includes("GOOGLE") || type.includes("GMAIL") || type === "MAIL") return "GMAIL";
  return null;
}

function accountIsHealthy(account: Record<string, unknown>): boolean {
  const sources = account.sources;
  if (!Array.isArray(sources) || sources.length === 0) {
    return false;
  }
  const status = String((sources[0] as { status?: string })?.status ?? "").toUpperCase();
  return status === "OK" || status === "SYNC_SUCCESS" || status === "CREATION_SUCCESS";
}

export class UnipileService {
  async connectAccount(userId: string, provider: UnipileProvider): Promise<{ url: string }> {
    await repo.upsertPendingIntegration(userId, providerToIntegrationProvider(provider));
    const { url } = await unipileClient.createHostedAuthLink({ userId, provider });
    return { url };
  }

  async handleWebhook(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ processed: boolean; accountId?: string; status?: string }> {
    if (!payload || typeof payload !== "object") {
      throw new AppError("Webhook Unipile invalid.", 400, "WEBHOOK_INVALID");
    }

    const body = unwrapWebhookPayload(payload);
    const { event, accountId, providerHint, userId, statusHint } = normalizeWebhookEvent(body);

    if (!accountId && !userId) {
      throw new AppError("Webhook Unipile fără account_id sau userId.", 400, "WEBHOOK_INVALID");
    }

    const provider =
      inferProviderFromHint(providerHint) ??
      (userId
        ? (await repo.findIntegration(userId, "WHATSAPP"))?.provider ??
          (await repo.findIntegration(userId, "GMAIL"))?.provider ??
          null
        : null);

    if (process.env.NODE_ENV !== "production") {
      console.log("[unipile webhook]", { event, accountId, userId, providerHint, statusHint, headers });
    }

    if (accountId && isConnectedEvent(event, statusHint)) {
      if (userId && provider) {
        await repo.markConnected(userId, provider, accountId);
      } else {
        await repo.markConnectedByExternalAccountId(accountId, userId || undefined, provider ?? undefined);
      }
      return { processed: true, accountId, status: "CONNECTED" };
    }

    if (accountId && isDisconnectedEvent(event, statusHint)) {
      await repo.markDisconnected(accountId);
      return { processed: true, accountId, status: "DISCONNECTED" };
    }

    if (accountId && isErrorEvent(event, statusHint)) {
      await repo.markError(accountId);
      return { processed: true, accountId, status: "ERROR" };
    }

    if (accountId && userId && provider) {
      await repo.markConnected(userId, provider, accountId);
      return { processed: true, accountId, status: "CONNECTED" };
    }

    return { processed: false, accountId: accountId || undefined };
  }

  /**
   * Fallback when notify_url webhook did not arrive (e.g. missing CLOUDFLARE_TUNNEL_URL).
   * Matches healthy Unipile accounts to this user's pending integrations.
   */
  async syncIntegrationsFromUnipile(userId: string): Promise<void> {
    const [whatsapp, gmail, linkedIds, accounts] = await Promise.all([
      repo.findIntegration(userId, "WHATSAPP"),
      repo.findIntegration(userId, "GMAIL"),
      repo.listLinkedExternalAccountIds(),
      unipileClient.listAccounts(),
    ]);

    const linked = new Set(linkedIds);
    const pendingIntegrations = [whatsapp, gmail].filter(
      (integration): integration is NonNullable<typeof whatsapp> =>
        Boolean(integration && (!integration.externalAccountId || integration.status === "PENDING")),
    );

    for (const integration of pendingIntegrations) {
      const candidates = accounts
        .filter((account) => accountProvider(account) === integration.provider)
        .filter((account) => accountIsHealthy(account))
        .filter((account) => {
          const accountId = String(account.id ?? "");
          return accountId && !linked.has(accountId);
        });

      const byUserName = candidates.find((account) => String(account.name ?? "") === userId);
      const pendingSince = integration.updatedAt.getTime() - 10 * 60 * 1000;
      const byRecency = candidates
        .filter((account) => {
          const createdAt = Date.parse(String(account.created_at ?? ""));
          return Number.isFinite(createdAt) && createdAt >= pendingSince;
        })
        .sort((left, right) => {
          const leftTime = Date.parse(String(left.created_at ?? ""));
          const rightTime = Date.parse(String(right.created_at ?? ""));
          return rightTime - leftTime;
        })[0];

      const match = byUserName ?? byRecency;
      const accountId = String(match?.id ?? "");
      if (!accountId) continue;

      await repo.markConnected(userId, integration.provider, accountId);
      linked.add(accountId);
    }
  }

  async listIntegrations(userId: string): Promise<{
    whatsapp: { status: string; connected: boolean };
    gmail: { status: string; connected: boolean };
  }> {
    await this.syncIntegrationsFromUnipile(userId);

    const [whatsapp, gmail] = await Promise.all([
      repo.findIntegration(userId, "WHATSAPP"),
      repo.findIntegration(userId, "GMAIL"),
    ]);

    const mapStatus = (integration: Awaited<ReturnType<typeof repo.findIntegration>>) => ({
      status: integration?.status ?? "DISCONNECTED",
      connected: Boolean(integration && isConnectedStatus(integration.status) && integration.externalAccountId),
    });

    return {
      whatsapp: mapStatus(whatsapp),
      gmail: mapStatus(gmail),
    };
  }

  async sendMessage(input: {
    userId: string;
    channel: UnipileChannel;
    recipient: string;
    subject?: string;
    message: string;
  }): Promise<{ success: true; channel: UnipileChannel; recipient: string }> {
    await this.syncIntegrationsFromUnipile(input.userId);

    const provider = channelToIntegrationProvider(input.channel);
    const integration = await repo.findIntegration(input.userId, provider);

    if (!integration || !isConnectedStatus(integration.status)) {
      const label = input.channel === "whatsapp" ? "WhatsApp" : "Gmail";
      throw new AppError(
        `Integrarea ${label} nu este conectată. Conectează contul din setări.`,
        409,
        "INTEGRATION_NOT_CONNECTED",
      );
    }

    if (!integration.externalAccountId) {
      throw new AppError(
        "Contul Unipile nu are un ID extern salvat.",
        409,
        "INTEGRATION_NOT_CONNECTED",
      );
    }

    if (input.channel === "whatsapp") {
      await unipileClient.sendWhatsAppMessage({
        accountId: integration.externalAccountId,
        recipient: input.recipient,
        message: input.message,
      });
    } else {
      await unipileClient.sendEmail({
        accountId: integration.externalAccountId,
        recipient: input.recipient,
        subject: input.subject?.trim() || defaultEmailSubject(),
        body: input.message,
      });
    }

    return {
      success: true,
      channel: integrationProviderToChannel(provider),
      recipient: input.recipient,
    };
  }
}

export const unipileService = new UnipileService();
