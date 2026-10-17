import { NextResponse } from "next/server";
import { hashToken } from "@/lib/tokens";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return NextResponse.redirect(new URL("/login?verified=0", request.url));
  const hashed = hashToken(token);
  const record = await prisma.verificationToken.findFirst({ where: { token: hashed, expires: { gt: new Date() } } });
  if (!record) return NextResponse.redirect(new URL("/login?verified=0", request.url));
  await prisma.$transaction([
    prisma.user.update({ where: { email: record.identifier }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.deleteMany({ where: { identifier: record.identifier } })
  ]);
  return NextResponse.redirect(new URL("/login?verified=1", request.url));
}
