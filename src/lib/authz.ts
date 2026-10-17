import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true }
  });
}

export async function requireAdmin() {
  const user = await currentUser();
  return user?.role === "ADMIN" ? user : null;
}
