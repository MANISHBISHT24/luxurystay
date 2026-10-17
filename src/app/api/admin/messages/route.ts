import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  try {
    return NextResponse.json({ messages: await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 }) });
  } catch {
    return NextResponse.json({ error: "Contact messages are temporarily unavailable." }, { status: 503 });
  }
}
