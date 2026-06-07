import type { Request, Response } from "express";
import * as venueService from "./venue.service.js";
import type { UpdateVenueProfileInput, UpdateVenueSearchIntentInput } from "./venue.schema.js";

export async function getMe(req: Request, res: Response): Promise<void> {
  const profile = await venueService.getMyProfile(req.user!.id);
  res.json(profile);
}

export async function putMe(req: Request, res: Response): Promise<void> {
  const profile = await venueService.updateMyProfile(
    req.user!.id,
    req.body as UpdateVenueProfileInput,
  );
  res.json(profile);
}

export async function putSearchIntent(req: Request, res: Response): Promise<void> {
  const intent = await venueService.upsertVenueSearchIntent(
    req.user!.id,
    req.body as UpdateVenueSearchIntentInput,
  );
  res.json({ searchIntent: intent });
}
