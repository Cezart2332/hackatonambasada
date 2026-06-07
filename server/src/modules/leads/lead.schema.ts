import { z } from "zod";

export const matchLeadsSchema = z.object({
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  rangeKm: z.coerce.number().positive().optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
  forceRefresh: z.coerce.boolean().optional(),
});

export const updateLeadStatusSchema = z.object({
  status: z.enum([
    "Bun",
    "Nu e potrivit",
    "Contactat",
    "A r\u0103spuns",
    "A cump\u0103rat",
  ]),
  reason: z.string().max(500).optional(),
});

export const campaignSimulateSchema = z.object({
  leadIds: z.array(z.string()).optional(),
  maxLeads: z.coerce.number().int().min(1).max(8).optional(),
});

export type MatchLeadsInput = z.infer<typeof matchLeadsSchema>;
export type CampaignSimulateInput = z.infer<typeof campaignSimulateSchema>;
