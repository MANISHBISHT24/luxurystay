import { Router, type IRouter } from "express";
import { SubmitContactBody, SubscribeNewsletterBody } from "@workspace/api-zod";
import { contactMessagesTable, db, newsletterSubscribersTable } from "@workspace/db";
import { contactRateLimit } from "../lib/rateLimits";

const router: IRouter = Router();

router.post(
  "/contact",
  contactRateLimit,
  async (req, res): Promise<void> => {
    const parsed = SubmitContactBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Please check the contact form fields." });
      return;
    }
    await db.insert(contactMessagesTable).values(parsed.data);
    res.status(201).send();
  },
);

router.post(
  "/newsletter",
  contactRateLimit,
  async (req, res): Promise<void> => {
    const parsed = SubscribeNewsletterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }
    await db
      .insert(newsletterSubscribersTable)
      .values({ email: parsed.data.email.toLowerCase().trim() })
      .onConflictDoNothing({ target: newsletterSubscribersTable.email });
    res.status(201).send();
  },
);

export default router;
