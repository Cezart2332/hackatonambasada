import type { Request, Response } from "express";
import * as leadService from "./lead.service.js";
import * as leadStatsService from "./lead.stats.service.js";
import type { MatchLeadsInput } from "./lead.schema.js";

function paramId(req: Request): string {
  const value = req.params.id;
  return Array.isArray(value) ? value[0] : value;
}

function accountType(req: Request): string {
  return req.user!.accountType;
}

export async function matchLeads(req: Request, res: Response): Promise<void> {
  const leads = await leadService.matchForUser(
    req.user!.id,
    req.body as MatchLeadsInput,
    accountType(req),
  );
  res.json({ leads });
}

export async function matchMoreLeads(req: Request, res: Response): Promise<void> {
  const leads = await leadService.matchMoreForUser(
    req.user!.id,
    req.body as MatchLeadsInput,
    accountType(req),
  );
  res.json({ leads });
}

export async function listLeads(req: Request, res: Response): Promise<void> {
  const leads = await leadService.listLeadsForUser(req.user!.id, accountType(req));
  res.json({ leads });
}

export async function getLeadStats(req: Request, res: Response): Promise<void> {
  const stats = await leadStatsService.getLeadStatsForUser(req.user!.id, accountType(req));
  res.json({ stats });
}

export async function getLead(req: Request, res: Response): Promise<void> {
  const lead = await leadService.getLeadById(req.user!.id, paramId(req), accountType(req));
  res.json(lead);
}

export async function putLeadStatus(req: Request, res: Response): Promise<void> {
  const body = req.body as { status: string; reason?: string };
  const result = await leadService.updateLeadStatus(
    req.user!.id,
    paramId(req),
    body.status,
    body.reason,
  );
  res.json(result);
}

export async function simulateCampaign(req: Request, res: Response): Promise<void> {
  const result = await leadService.simulateCampaignForUser(
    req.user!.id,
    req.body,
    accountType(req),
  );
  res.json(result);
}