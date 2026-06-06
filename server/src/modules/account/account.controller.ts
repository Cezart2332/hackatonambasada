import type { Request, Response } from "express";
import * as accountService from "./account.service.js";

export async function getMe(req: Request, res: Response): Promise<void> {
  const account = await accountService.getAccount(req.user!.id);
  res.json(account);
}
