import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";

export type AuthenticatedRequest = Request & { userId: string };

export function currentUserId(req: Request): string | null {
  const auth = getAuth(req);
  return auth?.userId ?? null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = currentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  (req as AuthenticatedRequest).userId = userId;
  next();
}