import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./shared/auth.js";
import { errorHandler } from "./shared/errors/errorHandler.js";
import { aiProxyRouter } from "./modules/ai/ai.proxy.js";
import { geoRouter } from "./modules/geo/geo.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { leadsRouter } from "./modules/leads/lead.routes.js";
import { producersRouter } from "./modules/producers/producer.routes.js";

export function createApp() {
  const app = express();
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

  app.use(
    cors({
      origin: frontendUrl,
      credentials: true,
    }),
  );

  app.all("/api/auth/*path", toNodeHandler(auth));

  app.use(express.json());

  app.use("/api/health", healthRouter);
  app.use("/api/producers", producersRouter);
  app.use("/api/leads", leadsRouter);
  app.use("/api/geo", geoRouter);
  app.use("/api/ai", aiProxyRouter);

  app.use(errorHandler);

  return app;
}
