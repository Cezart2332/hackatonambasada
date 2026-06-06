import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { ProductInput, UpdateProfileInput } from "./producer.schema.js";
import { mapProduct, mapProfile } from "./producer.mapper.js";

async function getOrCreateProfile(userId: string) {
  const existing = await prisma.producerProfile.findUnique({
    where: { userId },
    include: { products: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.producerProfile.create({
    data: { userId },
    include: { products: true },
  });
}

export async function getMyProfile(userId: string) {
  const profile = await getOrCreateProfile(userId);
  return mapProfile(profile);
}

export async function updateMyProfile(userId: string, input: UpdateProfileInput) {
  const profile = await getOrCreateProfile(userId);

  const { products, ...profileData } = input;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { accountType: "PRODUCER" },
    });

    const nextProfile = await tx.producerProfile.update({
      where: { id: profile.id },
      data: profileData,
      include: { products: true },
    });

    if (products) {
      await tx.producerProduct.deleteMany({ where: { profileId: profile.id } });
      if (products.length) {
        await tx.producerProduct.createMany({
          data: products.map((product) => ({
            profileId: profile.id,
            ...product,
          })),
        });
      }
    }

    return tx.producerProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: { products: true },
    });
  });

  return mapProfile(updated);
}

function parseRangeKm(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string") return undefined;
  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean ? clean : undefined;
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("ro-RO");
}

function splitProductNames(value: string) {
  return value
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function productFromUnknown(value: unknown): (Partial<ProductInput> & { name: string; action?: string }) | null {
  if (typeof value === "string") {
    const name = value.trim();
    return name ? { name } : null;
  }
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const name = cleanText(record.name) ?? cleanText(record.product);
  if (!name) return null;

  return {
    name,
    estimatedQuantity:
      cleanText(record.estimatedQuantity) ?? cleanText(record.quantity),
    unit: cleanText(record.unit),
    pricePerKg: cleanText(record.pricePerKg) ?? cleanText(record.price),
    availableFrom:
      cleanText(record.availableFrom) ?? cleanText(record.availability),
    action: cleanText(record.action)?.toLowerCase(),
  };
}

function mergeProductInputs(
  current: ProductInput[],
  patches: Array<Partial<ProductInput> & { name: string; action?: string }>,
  mode: string,
) {
  const next = mode === "replace" ? [] : [...current];

  for (const patch of patches) {
    const normalized = normalizeName(patch.name);
    const index = next.findIndex((product) => normalizeName(product.name) === normalized);
    const shouldRemove = mode === "remove" || patch.action === "remove" || patch.action === "delete";

    if (shouldRemove) {
      if (index >= 0) next.splice(index, 1);
      continue;
    }

    const existing = index >= 0 ? next[index] : undefined;
    const merged: ProductInput = {
      name: patch.name,
      estimatedQuantity: patch.estimatedQuantity ?? existing?.estimatedQuantity ?? "",
      unit: patch.unit ?? existing?.unit ?? "kg",
      pricePerKg: patch.pricePerKg ?? existing?.pricePerKg ?? "",
      availableFrom: patch.availableFrom ?? existing?.availableFrom ?? "Saptamana asta",
    };

    if (index >= 0) {
      next[index] = merged;
    } else {
      next.push(merged);
    }
  }

  return next;
}

export async function applyAiProfileUpdates(userId: string, updates: Record<string, unknown>) {
  const profile = await getOrCreateProfile(userId);
  const input: UpdateProfileInput = {};

  const businessName = cleanText(updates.businessName);
  if (businessName !== undefined) input.businessName = businessName;

  const phone = cleanText(updates.phone);
  if (phone !== undefined) input.phone = phone;

  const location = cleanText(updates.location);
  if (location !== undefined) input.location = location;

  const latitude = typeof updates.latitude === "number" && Number.isFinite(updates.latitude)
    ? updates.latitude
    : undefined;
  if (latitude !== undefined) input.latitude = latitude;

  const longitude = typeof updates.longitude === "number" && Number.isFinite(updates.longitude)
    ? updates.longitude
    : undefined;
  if (longitude !== undefined) input.longitude = longitude;

  const rangeKm = parseRangeKm(updates.rangeKm ?? updates.range);
  if (rangeKm !== undefined) input.rangeKm = rangeKm;

  const deliveryDays =
    cleanText(updates.deliveryDays) ?? cleanText(updates.days) ?? cleanText(updates.preferredDays);
  if (deliveryDays !== undefined) input.deliveryDays = deliveryDays;

  const extraDetails = cleanText(updates.extraDetails) ?? cleanText(updates.notes);
  if (extraDetails !== undefined) input.extraDetails = extraDetails;

  const productMode = (cleanText(updates.productUpdateMode) ?? "replace").toLowerCase();
  const currentProducts: ProductInput[] = profile.products.map((product) => ({
    name: product.name,
    estimatedQuantity: product.estimatedQuantity,
    unit: product.unit,
    pricePerKg: product.pricePerKg,
    availableFrom: product.availableFrom,
  }));

  const productPatches: Array<Partial<ProductInput> & { name: string; action?: string }> = [];
  const rawProducts = updates.products;
  if (Array.isArray(rawProducts)) {
    for (const item of rawProducts) {
      const product = productFromUnknown(item);
      if (product) productPatches.push(product);
    }
  } else if (typeof updates.product === "string") {
    for (const name of splitProductNames(updates.product)) {
      productPatches.push({ name });
    }
  }

  const quantity = cleanText(updates.quantity);
  if (quantity && productPatches.length === 1 && !productPatches[0].estimatedQuantity) {
    productPatches[0].estimatedQuantity = quantity;
  }

  if (productPatches.length) {
    input.products = mergeProductInputs(
      currentProducts,
      productPatches,
      productMode === "merge" || productMode === "remove" ? productMode : "replace",
    );
  } else if (quantity && currentProducts.length === 1) {
    input.products = [{ ...currentProducts[0], estimatedQuantity: quantity }];
  }

  if (!Object.keys(input).length) {
    return mapProfile(profile);
  }

  return updateMyProfile(userId, input);
}

export async function listMyProducts(userId: string) {
  const profile = await getOrCreateProfile(userId);
  return profile.products.map(mapProduct);
}

export async function createProduct(userId: string, input: ProductInput) {
  const profile = await getOrCreateProfile(userId);
  const product = await prisma.producerProduct.create({
    data: { profileId: profile.id, ...input },
  });
  return mapProduct(product);
}

export async function updateProduct(
  userId: string,
  productId: string,
  input: Partial<ProductInput>,
) {
  const profile = await getOrCreateProfile(userId);
  const product = await prisma.producerProduct.findFirst({
    where: { id: productId, profileId: profile.id },
  });

  if (!product) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }

  const updated = await prisma.producerProduct.update({
    where: { id: productId },
    data: input,
  });

  return mapProduct(updated);
}

export async function deleteProduct(userId: string, productId: string) {
  const profile = await getOrCreateProfile(userId);
  const product = await prisma.producerProduct.findFirst({
    where: { id: productId, profileId: profile.id },
  });

  if (!product) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }

  await prisma.producerProduct.delete({ where: { id: productId } });
}
