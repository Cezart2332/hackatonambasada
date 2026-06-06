import type { Request, Response } from "express";
import * as service from "./venue.producers.service.js";

function paramProducerId(req: Request): string {
  const value = req.params.producerUserId;
  return Array.isArray(value) ? value[0] : value;
}

export async function listMatchedProducers(req: Request, res: Response): Promise<void> {
  const producers = await service.listMatchedProducersForVenue(req.user!.id);
  res.json({ producers });
}

export async function updateProducerStatus(req: Request, res: Response): Promise<void> {
  const result = await service.updateProducerMatchStatus(
    req.user!.id,
    paramProducerId(req),
    (req.body as { status: string }).status,
  );
  res.json(result);
}
