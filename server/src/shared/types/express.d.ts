import type { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: {
        id: string;
        userId: string;
        token: string;
      };
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
      rawBody?: Buffer;
    }
  }
}

export {};