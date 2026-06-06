import { z } from "zod";

export const reviewRegistrationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export const updateProducerVerifiedSchema = z.object({
  verified: z.boolean(),
});

export type ReviewRegistrationInput = z.infer<typeof reviewRegistrationSchema>;
export type UpdateProducerVerifiedInput = z.infer<typeof updateProducerVerifiedSchema>;
