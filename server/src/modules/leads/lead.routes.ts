import { Router } from "express";
import { requireSession } from "../../shared/middleware/requireSession.js";
import { validate } from "../../shared/middleware/validate.js";
import { matchLeadsSchema, updateLeadStatusSchema } from "./lead.schema.js";
import * as controller from "./lead.controller.js";

export const leadsRouter = Router();

leadsRouter.use(requireSession);

leadsRouter.post("/match", validate(matchLeadsSchema), controller.matchLeads);
leadsRouter.get("/", controller.listLeads);
leadsRouter.get("/:id", controller.getLead);
leadsRouter.put(
  "/:id/status",
  validate(updateLeadStatusSchema),
  controller.putLeadStatus,
);