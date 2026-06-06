import { Router } from "express";
import { requireSession } from "../../shared/middleware/requireSession.js";
import * as controller from "./account.controller.js";
import * as planController from "../billing/plan.controller.js";

export const accountRouter = Router();

accountRouter.use(requireSession);
accountRouter.get("/me", controller.getMe);
accountRouter.get("/plan", planController.getPlan);
accountRouter.post("/upgrade-pro", planController.upgradePro);
accountRouter.post("/downgrade-free", planController.downgradeFree);
