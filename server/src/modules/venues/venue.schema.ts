import { z } from "zod";

const venueTypeSchema = z.enum(["restaurant", "hotel", "cafe", "shop", "deli"]);

export const updateVenueProfileSchema = z.object({
  businessName: z.string().optional(),
  venueType: venueTypeSchema.optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  locationChoice: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export const updateVenueSearchIntentSchema = z.object({
  productsNeeded: z.string().max(500).default(""),
  supplyFrequency: z.string().max(200).default(""),
  preferredDays: z.string().max(200).default(""),
});

export type UpdateVenueProfileInput = z.infer<typeof updateVenueProfileSchema>;
export type UpdateVenueSearchIntentInput = z.infer<typeof updateVenueSearchIntentSchema>;
