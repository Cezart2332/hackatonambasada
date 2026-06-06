import { Router } from "express";
import { validate } from "../../shared/middleware/validate.js";
import { geoSearchSchema } from "./geo.schema.js";
import * as controller from "./geo.controller.js";

export const geoRouter = Router();

geoRouter.get("/search", validate(geoSearchSchema, "query"), controller.search);