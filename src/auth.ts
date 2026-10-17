import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128)
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        if (!await consumeRateLimit(request, "login:" + parsed.data.email.toLowerCase(), 10, 600_000)) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user?.passwordHash || !await compare(parsed.data.password, user.passwordHash)) return null;
        if (process.env.RESEND_API_KEY && process.env.RESEND_FROM && !user.emailVerified) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role, sessionVersion: user.sessionVersion };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;
      } else if (token.id && typeof token.sessionVersion === "number") {
        const current = await prisma.user.findUnique({ where: { id: String(token.id) }, select: { sessionVersion: true } });
        if (!current || current.sessionVersion !== token.sessionVersion) {
          token.id = "";
          token.role = "CUSTOMER";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id || "");
        session.user.role = token.role === "ADMIN" ? "ADMIN" : "CUSTOMER";
      }
      return session;
    }
  }
});
