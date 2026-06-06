import { z } from "zod";

export const reviewRegistrationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export type ReviewRegistrationInput = z.infer<typeof reviewRegistrationSchema>;
