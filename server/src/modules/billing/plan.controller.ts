import type { Request, Response } from "express";
import * as planService from "./plan.service.js";

export async function getPlan(req: Request, res: Response): Promise<void> {
  const accountType = req.user!.accountType;
  const plan = await planService.getPlanContext(req.user!.id, accountType);
  res.json({ plan });
}

export async function upgradePro(req: Request, res: Response): Promise<void> {
  const plan = await planService.upgradeToPro(req.user!.id);
  res.json({ plan });
}

export async function downgradeFree(req: Request, res: Response): Promise<void> {
  const plan = await planService.downgradeToFree(req.user!.id);
  res.json({ plan });
}
