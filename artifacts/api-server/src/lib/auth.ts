import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export const requireSignedIn: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  res.locals.clerkUserId = userId;
  next();
};

export const requireAdministrator: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  const administrators = new Set(
    (process.env.ADMIN_CLERK_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  if (!administrators.has(userId)) {
    res.status(403).json({ error: "Administrator access is required." });
    return;
  }

  res.locals.clerkUserId = userId;
  next();
};
