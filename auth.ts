import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import { authPrisma as prisma } from "@/lib/auth-prisma";
import { isUserRole } from "@/lib/permissions";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

type LoginAttempt = { count: number; expiresAt: number };
type AuthGlobal = typeof globalThis & {
  edumanageAuthSecret?: string;
  edumanageLoginAttempts?: Map<string, LoginAttempt>;
};

const authGlobal = globalThis as AuthGlobal;
const developmentSecret =
  process.env.NODE_ENV === "production"
    ? undefined
    : (authGlobal.edumanageAuthSecret ??= randomBytes(32).toString("base64url"));
const authSecret = process.env.AUTH_SECRET ?? developmentSecret;
const loginAttempts = authGlobal.edumanageLoginAttempts ??= new Map();
const dummyPasswordHash = bcrypt.hash(randomBytes(32).toString("hex"), 12);

if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET must be configured before starting EduManage in production.");
}

class RateLimitedSignin extends CredentialsSignin {
  code = "too-many-attempts";
}

function loginAttemptKey(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

function isRateLimited(key: string, now: number): boolean {
  const attempt = loginAttempts.get(key);
  if (!attempt || attempt.expiresAt <= now) {
    loginAttempts.delete(key);
    return false;
  }
  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedAttempt(key: string, now: number): void {
  if (loginAttempts.size > 2000) {
    for (const [attemptKey, attempt] of loginAttempts) {
      if (attempt.expiresAt <= now) loginAttempts.delete(attemptKey);
    }
  }
  const current = loginAttempts.get(key);
  if (!current || current.expiresAt <= now) {
    loginAttempts.set(key, { count: 1, expiresAt: now + LOGIN_WINDOW_MS });
    return;
  }
  current.count += 1;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-edumanage.session-token"
          : "edumanage.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        loginType: { label: "Login type", type: "text" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials.email === "string"
            ? credentials.email.trim().toLocaleLowerCase("en-US")
            : "";
        const password =
          typeof credentials.password === "string" ? credentials.password : "";
        const loginType =
          credentials.loginType === "ADMIN" || credentials.loginType === "STAFF"
            ? credentials.loginType
            : null;
        if (
          !loginType ||
          !email ||
          email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          password.length < 1 ||
          password.length > 256
        ) {
          return null;
        }

        const key = loginAttemptKey(email);
        const now = Date.now();
        if (isRateLimited(key, now)) throw new RateLimitedSignin();

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            role: true,
            isActive: true,
          },
        });
        const passwordHash = user?.passwordHash ?? (await dummyPasswordHash);
        const passwordMatches = await bcrypt.compare(password, passwordHash);
        if (
          !user ||
          !user.isActive ||
          !passwordMatches ||
          !isUserRole(user.role) ||
          user.role !== loginType
        ) {
          recordFailedAttempt(key, now);
          return null;
        }

        loginAttempts.delete(key);
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const authenticatedUserId = typeof user?.id === "string" ? user.id : null;
      if (authenticatedUserId) {
        const sessionId = randomUUID();
        const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
        await prisma.authSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
        await prisma.authSession.create({
          data: { id: sessionId, userId: authenticatedUserId, expiresAt },
        });
        token.sessionId = sessionId;
        token.userId = authenticatedUserId;
      }

      const currentSessionId = typeof token.sessionId === "string" ? token.sessionId : null;
      if (!currentSessionId) {
        token.authInvalid = true;
        return token;
      }

      const session = await prisma.authSession.findUnique({
        where: { id: currentSessionId },
      });
      if (!session || session.expiresAt <= new Date()) {
        token.authInvalid = true;
        return token;
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      if (!currentUser?.isActive || !isUserRole(currentUser.role)) {
        token.authInvalid = true;
        return token;
      }

      token.userId = currentUser.id;
      token.name = currentUser.name;
      token.email = currentUser.email;
      token.role = currentUser.role;
      token.authInvalid = false;
      return token;
    },
    async session({ session, token }) {
      if (
        token.authInvalid ||
        typeof token.userId !== "string" ||
        !isUserRole(token.role)
      ) {
        return { expires: session.expires, user: undefined };
      }
      return {
        ...session,
        user: {
          ...session.user,
          id: token.userId,
          name: token.name ?? null,
          email: token.email ?? null,
          role: token.role,
        },
      };
    },
  },
  events: {
    async signOut(message) {
      if ("token" in message && typeof message.token?.sessionId === "string") {
        await prisma.authSession.deleteMany({
          where: { id: message.token.sessionId },
        });
      }
    },
  },
});
