import { AppError } from "../../shared/errors/AppError.js";
import type { UnipileProvider } from "./unipile.types.js";
import { unipileProviderType } from "./unipile.types.js";

function cleanBaseUrl(value: string | undefined): string {
  return (value ?? "https://api.unipile.com/api/v1").replace(/\/+$/, "");
}

/** Unipile DSN for hosted auth `api_url` — host:port only, no /api/v1 suffix. */
function unipileDsn(): string {
  const dsn = process.env.UNIPILE_DSN?.trim();
  if (dsn) {
    return dsn.startsWith("http") ? dsn.replace(/\/+$/, "") : `https://${dsn.replace(/\/+$/, "")}`;
  }
  const base = cleanBaseUrl(process.env.UNIPILE_BASE_URL);
  return base.replace(/\/api\/v\d+\/?$/i, "");
}

function hostedAuthExpiresOn(hoursAhead = 6): string {
  const expires = new Date();
  expires.setHours(expires.getHours() + hoursAhead);
  return expires.toISOString();
}

function apiKey(): string {
  const key = process.env.UNIPILE_API_KEY?.trim();
  if (!key) {
    throw new AppError(
      "UNIPILE_API_KEY nu este configurat.",
      503,
      "UNIPILE_API_ERROR",
    );
  }
  return key;
}

function headers(includeJson = true): Record<string, string> {
  const result: Record<string, string> = {
    "X-API-KEY": apiKey(),
    accept: "application/json",
  };
  if (includeJson) {
    result["content-type"] = "application/json";
  }
  return result;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    const detail =
      typeof body === "object" &&
      body &&
      "detail" in body &&
      typeof (body as { detail?: unknown }).detail === "string"
        ? (body as { detail: string }).detail
        : "";
    const message =
      typeof body === "object" &&
      body &&
      "message" in body &&
      typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : typeof body === "object" &&
            body &&
            "title" in body &&
            typeof (body as { title?: unknown }).title === "string"
          ? (body as { title: string }).title
          : `Unipile API error (${response.status})`;
    const fullMessage = detail ? `${message}: ${detail.slice(0, 240)}` : message;
    throw new AppError(fullMessage, response.status >= 500 ? 502 : 400, "UNIPILE_API_ERROR");
  }

  return body as T;
}

export function romanianPhoneToWhatsAppId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  let normalized = digits;
  if (normalized.startsWith("00")) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith("0") && normalized.length === 10) {
    normalized = `40${normalized.slice(1)}`;
  }
  if (normalized.length >= 10) {
    return `${normalized}@s.whatsapp.net`;
  }
  return "";
}

export class UnipileClient {
  private readonly baseUrl: string;

  constructor(baseUrl = cleanBaseUrl(process.env.UNIPILE_BASE_URL)) {
    this.baseUrl = baseUrl;
  }

  /**
   * TODO: Verify exact Hosted Auth endpoint, payload fields, and response shape
   * in official Unipile docs (notify_url, providers, name/state for userId).
   * https://developer.unipile.com/docs/hosted-auth
   */
  async createHostedAuthLink(input: {
    userId: string;
    provider: UnipileProvider;
    successRedirectUrl?: string;
    failureRedirectUrl?: string;
    notifyUrl?: string;
  }): Promise<{ url: string }> {
    const appUrl = (process.env.APP_URL ?? "http://localhost:3001").replace(/\/+$/, "");
    const tunnelUrl = process.env.CLOUDFLARE_TUNNEL_URL?.replace(/\/+$/, "");
    const notifyUrl =
      input.notifyUrl ??
      (tunnelUrl ? `${tunnelUrl}/api/webhooks/unipile` : `${appUrl}/api/webhooks/unipile`);

    if (!tunnelUrl && process.env.NODE_ENV !== "production") {
      console.warn(
        "[unipile] CLOUDFLARE_TUNNEL_URL is not set; notify_url uses internal APP_URL and Unipile cannot reach it. Status sync falls back to polling.",
      );
    }

    const payload = {
      type: "create",
      providers: [unipileProviderType(input.provider)],
      api_url: unipileDsn(),
      expiresOn: hostedAuthExpiresOn(),
      notify_url: notifyUrl,
      name: input.userId,
      success_redirect_url: input.successRedirectUrl ?? `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/integrations?status=success`,
      failure_redirect_url: input.failureRedirectUrl ?? `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/integrations?status=error`,
    };

    const response = await fetch(`${this.baseUrl}/hosted/accounts/link`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });

    const body = await parseResponse<{ url?: string; link?: string; hosted_auth_url?: string }>(
      response,
    );
    const url = body.url ?? body.link ?? body.hosted_auth_url;
    if (!url) {
      throw new AppError(
        "Unipile nu a returnat un URL de conectare.",
        502,
        "UNIPILE_API_ERROR",
      );
    }
    return { url };
  }

  async listAccounts(): Promise<Array<Record<string, unknown>>> {
    const response = await fetch(`${this.baseUrl}/accounts?limit=250`, {
      method: "GET",
      headers: headers(false),
    });
    const body = await parseResponse<{ items?: unknown[] } | unknown[]>(response);
    if (Array.isArray(body)) {
      return body.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
    }
    const items = body.items;
    if (Array.isArray(items)) {
      return items.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
    }
    return [];
  }

  async sendWhatsAppMessage(input: {
    accountId: string;
    recipient: string;
    message: string;
  }): Promise<unknown> {
    const whatsappId = romanianPhoneToWhatsAppId(input.recipient);
    if (!whatsappId) {
      throw new AppError("Număr WhatsApp invalid.", 422, "MISSING_RECIPIENT");
    }

    const response = await fetch(`${this.baseUrl}/chats`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        account_id: input.accountId,
        attendees_ids: [whatsappId],
        text: input.message,
      }),
    });
    return parseResponse(response);
  }

  async sendEmail(input: {
    accountId: string;
    recipient: string;
    subject: string;
    body: string;
  }): Promise<unknown> {
    const localPart = input.recipient.split("@", 1)[0] || "contact";
    const response = await fetch(`${this.baseUrl}/emails`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        account_id: input.accountId,
        to: [{ display_name: localPart, identifier: input.recipient }],
        subject: input.subject,
        body: input.body,
      }),
    });
    return parseResponse(response);
  }
}

export const unipileClient = new UnipileClient();
