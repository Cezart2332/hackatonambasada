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