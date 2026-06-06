import { z } from "zod";

export const matchLeadsSchema = z.object({
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  rangeKm: z.coerce.number().positive().optional(),
});

export const updateLeadStatusSchema = z.object({
  status: z.enum([
    "Bun",
    "Nu e potrivit",
    "Contactat",
    "A r\u0103spuns",
    "A cump\u0103rat",
  ]),
});

export type MatchLeadsInput = z.infer<typeof matchLeadsSchema>;
