import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export async function consumeRateLimit(request: Request, scope: string, limit: number, windowMs: number) {
  // shortcut: trust x-real-ip or a proxy-overwritten forwarded header; use a platform-specific client IP API if the ingress does not guarantee that.
  const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = createHash("sha256").update(scope + ":" + address).digest("hex");
  const now = new Date();
  const allowed = await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const row = await tx.rateLimit.findUnique({ where: { key } });
    if (!row || now.getTime() - row.windowStartedAt.getTime() >= windowMs) {
      await tx.rateLimit.upsert({
        where: { key },
        create: { key, windowStartedAt: now, count: 1 },
        update: { windowStartedAt: now, count: 1 }
      });
      return true;
    }
    if (row.count >= limit) return false;
    await tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return true;
  });
  if (Math.random() < 0.01) {
    void prisma.rateLimit.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - 3_600_000) } } }).catch(() => undefined);
  }
  return allowed;
}
