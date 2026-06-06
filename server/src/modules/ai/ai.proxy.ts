import { Router } from "express";

/**
 * Thin reverse proxy to the Python FastAPI AI service.
 * No AI logic lives here — Node handles auth, CRUD, and lead matching only.
 */
export const aiProxyRouter = Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

aiProxyRouter.all("/*path", async (req, res, next) => {
  try {
    const path = req.params.path;
    const suffix = Array.isArray(path) ? path.join("/") : path ?? req.url.replace(/^\//, "");
    const target = new URL(`${AI_SERVICE_URL}/${suffix}`);
    target.search = new URL(req.url, "http://localhost").search;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (key === "host" || key === "connection" || key === "content-length" || value === undefined) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }

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
