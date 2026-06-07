import { Router } from "express";
import { requireSession } from "../../shared/middleware/requireSession.js";
import { validate } from "../../shared/middleware/validate.js";
import { updateLeadStatusSchema } from "../leads/lead.schema.js";
import { updateVenueProfileSchema, updateVenueSearchIntentSchema } from "./venue.schema.js";
import * as controller from "./venue.controller.js";
import * as producersController from "./venue.producers.controller.js";

export const venuesRouter = Router();

venuesRouter.use(requireSession);

venuesRouter.get("/me", controller.getMe);
venuesRouter.put("/me", validate(updateVenueProfileSchema), controller.putMe);
venuesRouter.put(
  "/me/search-intent",
  validate(updateVenueSearchIntentSchema),
  controller.putSearchIntent,
);
venuesRouter.get("/me/matched-producers", producersController.listMatchedProducers);
venuesRouter.post("/me/matched-producers/refresh", producersController.refreshMatchedProducers);
venuesRouter.post("/me/matched-producers/discover", producersController.discoverMatchedProducers);
venuesRouter.post(
  "/me/matched-producers/discover/more",
  producersController.discoverMoreProducers,
);
venuesRouter.put(
  "/me/matched-producers/:producerUserId/status",
  validate(updateLeadStatusSchema),
  producersController.updateProducerStatus,
);
