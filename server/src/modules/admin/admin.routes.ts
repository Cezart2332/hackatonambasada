import { Router } from "express";
import { requireSession } from "../../shared/middleware/requireSession.js";
import { requireAdmin } from "../../shared/middleware/requireAdmin.js";
import { validate } from "../../shared/middleware/validate.js";
import { reviewRegistrationSchema, updateProducerVerifiedSchema } from "./admin.schema.js";
import * as controller from "./admin.controller.js";

export const adminRouter = Router();

adminRouter.use(requireSession, requireAdmin);

adminRouter.get("/registrations", controller.listRegistrations);
adminRouter.put(
  "/registrations/:userId",
  validate(reviewRegistrationSchema),
  controller.reviewRegistration,
);

adminRouter.get("/active-accounts", controller.listActiveAccounts);
adminRouter.put(
  "/active-accounts/:userId",
  validate(reviewRegistrationSchema),
  controller.updateActiveAccount,
);

adminRouter.put(
  "/producers/:userId/verified",
  validate(updateProducerVerifiedSchema),
  controller.updateProducerVerified,
);
