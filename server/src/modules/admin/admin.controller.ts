import type { Request, Response } from "express";
import * as adminService from "./admin.service.js";
import type { ReviewRegistrationInput, UpdateProducerVerifiedInput } from "./admin.schema.js";

export async function listRegistrations(req: Request, res: Response): Promise<void> {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const registrations = await adminService.listRegistrations(status);
  res.json({ registrations });
}

export async function reviewRegistration(req: Request, res: Response): Promise<void> {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const result = await adminService.reviewRegistration(userId, req.body as ReviewRegistrationInput);
  res.json(result);
}

export async function listActiveAccounts(req: Request, res: Response): Promise<void> {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const accounts = await adminService.listActiveAccounts(type);
  res.json({ accounts });
}

export async function updateActiveAccount(req: Request, res: Response): Promise<void> {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const result = await adminService.updateAccountStatus(userId, req.body as ReviewRegistrationInput);
  res.json(result);
}

export async function updateProducerVerified(req: Request, res: Response): Promise<void> {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const result = await adminService.updateProducerVerified(userId, req.body as UpdateProducerVerifiedInput);
  res.json(result);
}
