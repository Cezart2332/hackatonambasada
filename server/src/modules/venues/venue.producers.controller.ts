import type { Request, Response } from "express";
import * as service from "./venue.producers.service.js";

function paramProducerId(req: Request): string {
  const value = req.params.producerUserId;
  return Array.isArray(value) ? value[0] : value;
}

function parseScope(req: Request): "matched" | "all" {
  const raw = req.query.scope;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "all" ? "all" : "matched";
}

function parseProductsNeeded(req: Request): string | undefined {
  const fromQuery = req.query.productsNeeded;
  if (typeof fromQuery === "string" && fromQuery.trim()) return fromQuery.trim();
  if (Array.isArray(fromQuery) && typeof fromQuery[0] === "string" && fromQuery[0].trim()) {
    return fromQuery[0].trim();
  }
  const body = req.body as { productsNeeded?: string } | undefined;
  if (typeof body?.productsNeeded === "string" && body.productsNeeded.trim()) {
    return body.productsNeeded.trim();
  }
  return undefined;
}

export async function listMatchedProducers(req: Request, res: Response): Promise<void> {
  const result = await service.listMatchedProducersForVenue(req.user!.id, {
    scope: parseScope(req),
    productsNeeded: parseProductsNeeded(req),
  });
  res.json(result);
}

export async function refreshMatchedProducers(req: Request, res: Response): Promise<void> {
  const result = await service.refreshMatchedProducersForVenue(req.user!.id, {
    productsNeeded: parseProductsNeeded(req),
  });
  res.json(result);
}

export async function discoverMatchedProducers(req: Request, res: Response): Promise<void> {
  const result = await service.refreshMatchedProducersForVenue(req.user!.id);
  res.json(result);
}

export async function discoverMoreProducers(req: Request, res: Response): Promise<void> {
  const result = await service.listMatchedProducersForVenue(req.user!.id, { scope: "all" });
  res.json(result);
}

export async function updateProducerStatus(req: Request, res: Response): Promise<void> {
  const result = await service.updateProducerMatchStatus(
    req.user!.id,
    paramProducerId(req),
    (req.body as { status: string }).status,
  );
  res.json(result);
}
