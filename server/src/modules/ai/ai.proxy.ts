import { Router } from "express";
import { requireSession } from "../../shared/middleware/requireSession.js";
import { applyAiProfileUpdates } from "../producers/producer.service.js";

/**
 * Thin reverse proxy to the Python FastAPI AI service.
 * No AI logic lives here — Node handles auth, CRUD, and lead matching only.
 */
export const aiProxyRouter = Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

type AiChatResponse = {
  reply?: string;
  profileUpdates?: Record<string, unknown> | null;
  leads?: unknown;
  onboardingComplete?: boolean;
  [key: string]: unknown;
};

function forwardHeaders(reqHeaders: Record<string, string | string[] | undefined>) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(reqHeaders)) {
    if (key === "host" || key === "connection" || key === "content-length" || value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

aiProxyRouter.post("/v1/chat/reply", requireSession, async (req, res, next) => {
  try {
    const target = new URL(`${AI_SERVICE_URL}/v1/chat/reply`);
    const headers = forwardHeaders(req.headers);
    headers.set("content-type", "application/json");

    const body = {
      ...(req.body && typeof req.body === "object" ? req.body : {}),
      userId: req.user!.id,
    };

    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    let data: AiChatResponse;
    try {
      data = text ? (JSON.parse(text) as AiChatResponse) : {};
    } catch {
      res.status(upstream.status).send(text);
      return;
    }

    if (
      upstream.ok &&
      body.accountType !== "venue" &&
      data.profileUpdates &&
      Object.keys(data.profileUpdates).length
    ) {
      const profile = await applyAiProfileUpdates(req.user!.id, data.profileUpdates);
      data.profile = profile;
      data.profileUpdates = {
        ...data.profileUpdates,
        product: profile.products.map((product) => product.name).join(", "),
        quantity: profile.products
          .map((product) =>
            product.estimatedQuantity.trim()
              ? `${product.estimatedQuantity.trim()} ${product.unit.trim() || "kg"}`
              : "",
          )
          .filter(Boolean)
          .join("; "),
        products: profile.products,
        location: profile.location,
        range: `${Math.round(profile.rangeKm)} km`,
        rangeKm: profile.rangeKm,
        days: profile.deliveryDays,
        deliveryDays: profile.deliveryDays,
      };
    }

    res.status(upstream.status).json(data);
  } catch (error) {
    next(error);
  }
});

aiProxyRouter.post("/lead-outreach", requireSession, async (req, res, next) => {
  try {
    const target = new URL(`${AI_SERVICE_URL}/v1/lead-outreach`);
    const headers = forwardHeaders(req.headers);
    headers.set("content-type", "application/json");

    const body = {
      ...(req.body && typeof req.body === "object" ? req.body : {}),
      userId: req.user!.id,
    };

    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key === "transfer-encoding") return;
      res.setHeader(key, value);
    });
    res.send(text);
  } catch (error) {
    next(error);
  }
});

aiProxyRouter.all("/*path", async (req, res, next) => {
  try {
    const path = req.params.path;
    const suffix = Array.isArray(path) ? path.join("/") : path ?? req.url.replace(/^\//, "");
    const target = new URL(`${AI_SERVICE_URL}/${suffix}`);
    target.search = new URL(req.url, "http://localhost").search;

    const headers = forwardHeaders(req.headers);

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    if (hasBody && req.body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody && req.body !== undefined ? JSON.stringify(req.body) : undefined,
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key === "transfer-encoding") return;
      res.setHeader(key, value);
    });

    const text = await upstream.text();
    res.send(text);
  } catch (error) {
    next(error);
  }
});
