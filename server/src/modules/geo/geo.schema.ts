import { z } from "zod";

export const geoSearchSchema = z.object({
  q: z.string({ required_error: "Introdu cel puțin 2 caractere pentru căutare." }).min(2, {
    message: "Introdu cel puțin 2 caractere pentru căutare.",
  }),
});

export type GeoSearchInput = z.infer<typeof geoSearchSchema>;