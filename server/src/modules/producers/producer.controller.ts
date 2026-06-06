import type { Request, Response } from "express";
import * as producerService from "./producer.service.js";
import type { ProductInput, UpdateProfileInput } from "./producer.schema.js";

function paramId(req: Request): string {
  const value = req.params.id;
  return Array.isArray(value) ? value[0] : value;
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const profile = await producerService.getMyProfile(req.user!.id);
  res.json(profile);
}

export async function putMe(req: Request, res: Response): Promise<void> {
  const profile = await producerService.updateMyProfile(
    req.user!.id,
    req.body as UpdateProfileInput,
  );
  res.json(profile);
}

export async function getProducts(req: Request, res: Response): Promise<void> {
  const products = await producerService.listMyProducts(req.user!.id);
  res.json(products);
}

export async function postProduct(req: Request, res: Response): Promise<void> {
  const product = await producerService.createProduct(
    req.user!.id,
    req.body as ProductInput,
  );
  res.status(201).json(product);
}

export async function putProduct(req: Request, res: Response): Promise<void> {
  const product = await producerService.updateProduct(
    req.user!.id,
    paramId(req),
    req.body as Partial<ProductInput>,
  );
  res.json(product);
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  await producerService.deleteProduct(req.user!.id, paramId(req));
  res.status(204).send();
}