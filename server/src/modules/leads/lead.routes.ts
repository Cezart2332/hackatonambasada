import { Router } from "express";
import { requireSession } from "../../shared/middleware/requireSession.js";
import { validate } from "../../shared/middleware/validate.js";
import { matchLeadsSchema, updateLeadStatusSchema, campaignSimulateSchema } from "./lead.schema.js";
import * as controller from "./lead.controller.js";

export const leadsRouter = Router();

leadsRouter.use(requireSession);

leadsRouter.post("/match", validate(matchLeadsSchema), controller.matchLeads);
leadsRouter.post("/match/more", validate(matchLeadsSchema), controller.matchMoreLeads);
leadsRouter.post(
  "/campaign/simulate",
  validate(campaignSimulateSchema),
  controller.simulateCampaign,
);
leadsRouter.get("/stats", controller.getLeadStats);
leadsRouter.get("/", controller.listLeads);
leadsRouter.get("/:id", controller.getLead);
leadsRouter.put(
  "/:id/status",
  validate(updateLeadStatusSchema),
  controller.putLeadStatus,
);