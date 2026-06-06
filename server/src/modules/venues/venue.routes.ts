import { Router } from "express";
import { requireSession } from "../../shared/middleware/requireSession.js";
import { validate } from "../../shared/middleware/validate.js";
import { updateLeadStatusSchema } from "../leads/lead.schema.js";
import { updateVenueProfileSchema } from "./venue.schema.js";
import * as controller from "./venue.controller.js";
import * as producersController from "./venue.producers.controller.js";

export const venuesRouter = Router();

venuesRouter.use(requireSession);

venuesRouter.get("/me", controller.getMe);
venuesRouter.put("/me", validate(updateVenueProfileSchema), controller.putMe);
venuesRouter.get("/me/matched-producers", producersController.listMatchedProducers);
venuesRouter.put(
  "/me/matched-producers/:producerUserId/status",
  validate(updateLeadStatusSchema),
  producersController.updateProducerStatus,
);
