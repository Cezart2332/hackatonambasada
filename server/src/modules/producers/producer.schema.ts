import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1),
  estimatedQuantity: z.string().optional().default(""),
  unit: z.string().optional().default("kg"),
  pricePerKg: z.string().optional().default(""),
  availableFrom: z.string().optional().default("Saptamana asta"),
});

export const updateProfileSchema = z.object({
  businessName: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  locationChoice: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  rangeKm: z.number().positive().optional(),
  deliveryDays: z.string().optional(),
  extraDetails: z.string().optional(),
  products: z.array(productSchema).optional(),
});

export const createProductSchema = productSchema;
export const updateProductSchema = productSchema.partial().extend({
  name: z.string().min(1).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ProductInput = z.infer<typeof productSchema>;