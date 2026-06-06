import { Router } from "express";
import { requireSession } from "../../shared/middleware/requireSession.js";
import * as controller from "./account.controller.js";

export const accountRouter = Router();

accountRouter.use(requireSession);
accountRouter.get("/me", controller.getMe);
