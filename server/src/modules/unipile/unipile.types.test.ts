import { describe, expect, it } from "vitest";
import {
  normalizeWebhookEvent,
  providerToIntegrationProvider,
} from "./unipile.types.js";

describe("unipile.types", () => {
  it("maps provider to integration enum", () => {
    expect(providerToIntegrationProvider("whatsapp")).toBe("WHATSAPP");
    expect(providerToIntegrationProvider("gmail")).toBe("GMAIL");
  });

  it("normalizes webhook payload with state userId", () => {
    const result = normalizeWebhookEvent({
      event: "account.connected",
      account_id: "acc_1",
      state: "user_abc",
      provider: "WHATSAPP",
    });
    expect(result.accountId).toBe("acc_1");
    expect(result.userId).toBe("user_abc");
    expect(result.event).toBe("account.connected");
  });
});
