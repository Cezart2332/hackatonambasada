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
  productsNeeded: z.string().optional(),
  supplyFrequency: z.string().optional(),
  preferredDays: z.string().optional(),
});

export type UpdateVenueProfileInput = z.infer<typeof updateVenueProfileSchema>;
