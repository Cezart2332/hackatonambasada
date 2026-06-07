import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

export function logUnipileWebhook(req: Request): void {
  if (process.env.NODE_ENV === "production") return;
  console.log("Unipile webhook received");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
}

/**
 * TODO: Confirm Unipile webhook signature header name and HMAC algorithm
 * in official docs: https://developer.unipile.com/docs/webhooks
 */
export function verifyUnipileWebhook(req: Request): boolean {
  const secret = process.env.UNIPILE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return true;
  }

  const signatureHeader =
    req.headers["x-unipile-signature"] ??
    req.headers["x-webhook-signature"] ??
    req.headers["unipile-signature"];

  if (!signatureHeader || Array.isArray(signatureHeader)) {
    return false;
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(provided, "hex");
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}
