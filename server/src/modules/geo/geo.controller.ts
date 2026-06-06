import type { Request, Response } from "express";
import type { GeoSearchInput } from "./geo.schema.js";
import * as geoService from "./geo.service.js";

export async function search(req: Request, res: Response): Promise<void> {
  const { q } = (req.validated?.query as GeoSearchInput | undefined) ?? {
    q: String(req.query.q ?? ""),
  };
  const results = await geoService.searchLocations(q);
  res.json({ results });
}