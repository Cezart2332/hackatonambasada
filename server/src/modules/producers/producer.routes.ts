import { Router } from "express";
import { requireSession } from "../../shared/middleware/requireSession.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  createProductSchema,
  updateProductSchema,
  updateProfileSchema,
} from "./producer.schema.js";
import * as controller from "./producer.controller.js";

export const producersRouter = Router();

producersRouter.use(requireSession);

producersRouter.get("/me", controller.getMe);
producersRouter.put("/me", validate(updateProfileSchema), controller.putMe);

producersRouter.get("/me/products", controller.getProducts);
producersRouter.post(
  "/me/products",
  validate(createProductSchema),
  controller.postProduct,
);
producersRouter.put(
  "/me/products/:id",
  validate(updateProductSchema),
  controller.putProduct,
);
producersRouter.delete("/me/products/:id", controller.deleteProduct);